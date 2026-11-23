// Disposable larger-map variant in the real editor; never changes shipped assets.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { variant } = require('./engine-features.cjs')

module.exports = async function checkScrolling(ctx) {
    const jres = JSON.parse(ctx.text['tilemap.g.jres'])
    const asset = Object.values(jres).find(a => a.mimeType === 'application/mkcd-tilemap')
    const width = 30, height = 20, cells = width * height
    const bytes = Buffer.alloc(5 + cells + Math.ceil(cells / 2))
    bytes[0] = 16; bytes.writeUInt16LE(width, 1); bytes.writeUInt16LE(height, 3)
    const tile = name => asset.tileset.indexOf('myTiles.' + name)
    assert.ok(['yardFloor', 'yardWall', 'blueSpawn', 'redSpawn'].every(name => tile(name) >= 0))
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const cell = y * width + x, wall = x === 0 || y === 0 || x === width - 1 || y === height - 1
        bytes[5 + cell] = tile(wall ? 'yardWall' : 'yardFloor')
        if (wall) bytes[5 + cells + (cell >> 1)] |= 1 << (cell % 2 * 4)
    }
    for (const [x, y, name] of [[2, 2, 'blueSpawn'], [2, 4, 'blueSpawn'], [27, 2, 'redSpawn'], [27, 4, 'redSpawn']]) {
        bytes[5 + y * width + x] = tile(name)
    }
    asset.data = Buffer.from(bytes.toString('hex')).toString('base64')
    const wallImage = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
        x === 0 || y === 0 || x === width - 1 || y === height - 1 ? '2' : '.').join(' ')).join('\n')
    const declarations = ctx.text['tilemap.g.ts'].replace(/tiles\.createTilemap\(hex`[^`]*`, img`[^`]*`/,
        'tiles.createTilemap(hex`' + bytes.subarray(1, 5 + cells).toString('hex') + '`, img`\n' + wallImage + '\n`')
    ctx.text = { ...ctx.text, 'tilemap.g.jres': JSON.stringify(jres), 'tilemap.g.ts': declarations,
        'pxt.json': JSON.stringify({ ...JSON.parse(ctx.text['pxt.json']), preferredEditor: 'tsprj' }) }
    // A test-only death trigger exercises the same public damage/respawn lifecycle.
    await variant(ctx, `
controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    shooter.dealDamage(shooter.allPlayers()[0], 100)
})
`, 'None')
    const sim = ctx.sim
    const state = () => sim.evaluate(() => {
        const scene = team.get('_scene').fields, camera = scene.camera.fields
        return { ...team.snapshot(), left: camera._offsetX, top: camera._offsetY,
            following: camera.sprite === team.get('player') }
    })
    await sim.evaluate(() => { team.freezeBots(); team.place(0, 160, 120) })
    await ctx.button(3, true); await ctx.button(4, true); await ctx.sleep(1800)
    await ctx.button(3, false); await ctx.button(4, false)
    let s = await state()
    assert.ok(s.x > 220 && s.y > 180, 'Human moves beyond original screen in both axes')
    assert.ok(Math.abs(s.left - (s.x - 80)) <= 2 && Math.abs(s.top - (s.y - 60)) <= 2, 'Camera follows in both axes')
    assert.equal(s.following, true)
    await ctx.screenshot('scrolling-follow.png')

    // Off-screen navigation must not be clamped to the camera rectangle.
    await sim.evaluate(() => {
        team.place(0, 360, 200); team.place(1, 360, 248); team.place(2, 120, 200)
        team.slots()[2].navigation.fields.speed = 10
    })
    await ctx.sleep(1100)
    s = await state()
    assert.ok(s.soldiers[2].x > 125 && s.soldiers[2].x < s.left, 'Off-screen bot pursues without snapping into view')

    // Two bots fight outside the viewport, using real projectiles and physics.
    await sim.evaluate(() => {
        team.freezeBots(); team.place(1, 56, 40); team.place(2, 120, 40)
        team.slots()[1].nextShotAt = 0
    })
    await sim.waitForFunction(() => team.slots()[2].health < 100, { timeout: 3000 })
    assert.ok((await state()).left > 120, 'Off-screen shot hit while both combatants were outside the view')

    // Detach on death, hold the view, then follow a fresh human body at team spawn.
    await sim.evaluate(() => team.freezeBots())
    const before = await state()
    await ctx.button(6, true); await ctx.sleep(100); await ctx.button(6, false)
    assert.equal((await state()).soldiers[0].alive, false)
    await ctx.sleep(1000)
    const dead = await state()
    assert.deepEqual([dead.left, dead.top], [before.left, before.top], 'Death holds the last camera view')
    await ctx.screenshot('scrolling-respawn-wait.png')
    await sim.waitForFunction(() => !!team.slots()[0].sprite, { timeout: 6000 })
    s = await state()
    assert.equal(s.following, true)
    assert.equal(s.left, 0)
    assert.ok(s.x < 80, 'Respawn returns to blue team spawn')

    // Camera clamps to map edges; perimeter walls, not viewport flags, contain actors.
    await sim.evaluate(() => { team.freezeBots(); team.place(0, 440, 280) })
    await ctx.button(3, true); await ctx.button(4, true); await ctx.sleep(900)
    await ctx.button(3, false); await ctx.button(4, false)
    s = await state()
    assert.equal(s.left, width * 16 - 160)
    assert.equal(s.top, height * 16 - 120)
    assert.ok(s.x <= 460 && s.y <= 300, 'Outer walls contain the human')
    await ctx.screenshot('scrolling-edge.png')
    fs.writeFileSync(path.join(ctx.artifacts, 'scrolling-result.json'), JSON.stringify({ width, height, checks: ['camera XY follow', 'off-screen pursuit', 'off-screen projectile hit', 'death view hold', 'respawn rebind', 'edge clamp and walls'], final: s }, null, 2))
    console.log('PASS: larger-map scrolling, off-screen bots/combat, camera hold/respawn, map boundaries')
}
