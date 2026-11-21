// Source variants run only in a disposable editor project, never in the exported baseline.
const assert = require('node:assert/strict')
const teamSimulator = require('./team-simulator.cjs')

async function variant(ctx, extra) {
    const main = ctx.text['main.ts'] + '\n' + extra
    await ctx.command('importproject', { project: { text: { ...ctx.text, 'main.ts': main } } })
    await ctx.editor.waitForFunction(main => typeof monaco !== 'undefined' && monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().replace(/\r\n/g, '\n') === main.replace(/\r\n/g, '\n')), {}, main)
    await ctx.command('stopsimulator'); await ctx.command('startsimulator'); await ctx.sleep(1000)
    ctx.sim = await ctx.page.waitForFrame(f => f.url().includes('---simulator'))
    await teamSimulator.install(ctx.sim)
    ctx.button = (key, down) => ctx.sim.evaluate(({ key, down }) => pxsim.runtime.board.handleKeyEvent(key, down), { key, down })
}

async function checkMessages(ctx) {
    await variant(ctx, `
messages.notify(messages.text("{} READY {}", shooter.allPlayers()[0], 1))
messages.notify("HIDDEN BOT", shooter.allPlayers()[1])
messages.notify("HIDDEN RED", shooter.teamById(1))
messages.notify("BLUE NEXT", shooter.teamById(0))
messages.announce("TRAINING CONTINUES")
`)
    const entries = await ctx.sim.evaluate(() => ({
        notifications: team.get('notifications').data.map(e => e.fields.text),
        announcements: team.get('announcements').data.map(e => e.fields.text)
    }))
    assert.deepEqual(entries.notifications, ['YOU READY 1', 'BLUE NEXT'])
    assert.deepEqual(entries.announcements, ['TRAINING CONTINUES'])
    await ctx.screenshot('messages.png')
    const before = await ctx.sim.evaluate(() => team.snapshot())
    await ctx.button(3, true); await ctx.button(5, true); await ctx.sleep(400)
    await ctx.button(3, false); await ctx.button(5, false)
    const after = await ctx.sim.evaluate(() => team.snapshot())
    assert.ok(after.x > before.x + 8, 'Messages do not block movement')
    assert.ok(after.nextShotAt > before.nextShotAt, 'Messages do not block fire')
    await ctx.sim.waitForFunction(() => !team.get('notifications').data.length && !team.get('announcements').data.length, { timeout: 7000 })
    assert.equal(await ctx.sim.evaluate(() => team.get('finished')), false)
    console.log('PASS: real HUD notifications/announcement, audience filtering, queue expiry, non-blocking movement/fire')
}
async function checkWeapons(ctx) {
    await variant(ctx, `
shooter.giveWeapon(shooter.allPlayers()[0], weapons.create(weapons.Kind.Shotgun))
shooter.giveWeapon(shooter.allPlayers()[2], weapons.create(weapons.Kind.Knife))
`)
    await ctx.sim.evaluate(() => {
        team.freezeBots(); [[24,24],[24,88],[88,24],[136,88]].forEach((p,i) => team.place(i,...p))
    })
    await ctx.button(5, true); await ctx.sleep(850); await ctx.button(5, false); await ctx.sleep(600)
    assert.equal(await ctx.sim.evaluate(() => team.slots()[2].health), 3, 'Short shot cannot reach a distant target')
    assert.equal(await ctx.sim.evaluate(() => team.snapshot().blueShots), 0, 'Range expires before old 2.5s cap')
    await ctx.sim.evaluate(() => {
        team.place(0,40,24)
        team.slots()[2].navigation.fields.speed = 10
        team.slots()[2].nextShotAt = 0
    })
    await ctx.sleep(900)
    const pursuing = await ctx.sim.evaluate(() => team.snapshot())
    assert.ok(pursuing.soldiers[2].x < 83 && pursuing.soldiers[2].x > 65)
    assert.equal(pursuing.soldiers[2].nextShotAt, 0, 'Aligned bot closes distance without wasting shots')
    await ctx.screenshot('range-pursuit.png')
    await ctx.sim.waitForFunction(() => !team.slots()[0].sprite, { timeout: 7500 })
    assert.equal(await ctx.sim.evaluate(() => team.get('redScore')), 1)
    console.log('PASS: real short-range projectile expiry, range-aware pursuit and close-range elimination')
}
module.exports = { variant, checkMessages, checkWeapons }
