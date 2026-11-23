const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { variant } = require('./engine-features.cjs')

module.exports = async function checkMaps(ctx) {
    const baseline = ctx.text
    const results = []
    for (const map of ['trainingYard', 'combatCompound']) for (const mode of ['Deathmatch', 'GunGame', 'None']) {
        ctx.text = { ...baseline,
            'main.ts': baseline['main.ts'].replace('tilemap`trainingYard`', 'tilemap`' + map + '`'),
            'pxt.json': JSON.stringify({ ...JSON.parse(baseline['pxt.json']), preferredEditor: 'tsprj' }) }
        await variant(ctx, '', mode)
        await ctx.sleep(200)
        const s = await ctx.sim.evaluate(() => {
            team.freezeBots()
            return { ...team.snapshot(), target: team.get('targetScore') }
        })
        assert.equal(s.soldiers.length, 4)
        assert.ok(s.soldiers.every(p => p.alive))
        assert.equal(s.target, mode === 'Deathmatch' ? 10 : mode === 'GunGame' ? 4 : 0)
        assert.ok(Math.abs(s.x - (map === 'trainingYard' ? 24 : 56)) < 2)
        results.push({ map, mode, target: s.target })
    }
    // The last imported project is the compound with no automatic scoring rules.
    await ctx.sim.evaluate(() => { team.freezeBots(); team.place(0, 104, 88) })
    await ctx.button(3, true); await ctx.sleep(500); await ctx.button(3, false)
    let s = await ctx.sim.evaluate(() => team.snapshot())
    assert.ok(s.x <= 108, 'Room wall stops the human')
    await ctx.sim.evaluate(() => team.place(0, 104, 72))
    await ctx.button(3, true); await ctx.sleep(700); await ctx.button(3, false)
    s = await ctx.sim.evaluate(() => team.snapshot())
    assert.ok(s.x > 132, 'Doorway connects the room to the courtyard')
    await ctx.sim.evaluate(() => {
        team.freezeBots()
        ;[[168,152],[88,152],[232,152],[232,216]].forEach((p, i) => team.place(i, ...p))
    })
    await ctx.sleep(200)
    await ctx.screenshot('compound-courtyard.png')
    await ctx.sim.evaluate(() => team.place(0, 56, 56))
    await ctx.sleep(200)
    await ctx.screenshot('compound-rooms.png')
    // Check the chosen map survives TS -> Blocks -> TS alongside mode selection.
    await ctx.command('switchblocks'); await ctx.sleep(1800)
    const blocks = await ctx.editor.evaluate(() => {
        const ws = pxt.blocks.requireBlockly().common.getMainWorkspace()
        return ws.getAllBlocks(false).map(b => ({ type: b.type, map: b.getFieldValue('tilemap') }))
    })
    assert.ok(blocks.some(b => b.type === 'tiles_tilemap_editor' && b.map.includes('combatCompound')))
    assert.ok(blocks.some(b => b.type === 'shooter_set_mode'))
    assert.ok(!blocks.some(b => b.type === 'typescript_statement'))
    await ctx.command('switchjavascript')
    await ctx.editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('tilemap`combatCompound`')))
    fs.writeFileSync(path.join(ctx.artifacts, 'maps-result.json'), JSON.stringify({ starts: results, collision: true, doorway: true, blocksRoundTrip: true }, null, 2))
    console.log('PASS: both maps in all modes, compound walls/doorway, map and mode Blocks round-trip')
}
