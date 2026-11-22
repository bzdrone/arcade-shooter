// Source variants run only in a disposable editor project, never in the exported baseline.
const assert = require('node:assert/strict')
const teamSimulator = require('./team-simulator.cjs')

async function variant(ctx, extra, mode = 'Deathmatch') {
    const main = ctx.text['main.ts'].replace('shooter.Mode.Deathmatch', 'shooter.Mode.' + mode) + '\n' + extra
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
async function checkModes(ctx) {
    await variant(ctx, '', 'GunGame')
    assert.equal(await ctx.sim.evaluate(() => team.get('players').data.every(p => p.fields.weapon.fields.name === 'Pistol')), true)
    // Test enum selection in BOTH directions and the original legacy block ID.
    await ctx.command('switchblocks'); await ctx.sleep(1800)
    const types = await ctx.editor.evaluate(() => {
        const w = pxt.blocks.requireBlockly().common.getMainWorkspace()
        const all = w.getAllBlocks(false)
        const block = all.find(b => b.type === 'shooter_set_mode')
        const options = block.getField('mode').getOptions()
        block.setFieldValue('shooter.Mode.None', 'mode')
        return { types: all.map(b => b.type), options }
    })
    console.log('MODE OPTIONS', JSON.stringify(types.options))
    assert.ok(!types.types.some(t => /javascript|typescript/.test(t)))
    await ctx.sleep(1200); await ctx.command('switchjavascript')
    await ctx.editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('shooter.Mode.None'))).catch(async e => {
        console.log('MODE MAIN', await ctx.editor.evaluate(() => monaco.editor.getModels().filter(m => m.uri.path.endsWith('/main.ts')).map(m => m.getValue())))
        throw e
    })
    await ctx.command('stopsimulator'); await ctx.command('startsimulator'); await ctx.sleep(1000)
    ctx.sim = await ctx.page.waitForFrame(f => f.url().includes('---simulator'))
    await teamSimulator.install(ctx.sim)
    assert.equal(await ctx.sim.evaluate(() => team.get('targetScore')), 0, 'No mode has no win target')
    await ctx.editor.evaluate(() => {
        const m = monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts'))
        m.setValue(m.getValue().replace('shooter.Mode.None', 'shooter.Mode.GunGame'))
    })
    await ctx.command('switchblocks'); await ctx.sleep(700)
    assert.equal(await ctx.editor.evaluate(() => pxt.blocks.requireBlockly().common.getMainWorkspace().getAllBlocks(false).find(b => b.type === 'shooter_set_mode').getFieldValue('mode')), 'shooter.Mode.GunGame')
    await ctx.screenshot('gun-game-blocks.png')
    await ctx.command('switchjavascript')
    for (const winningTeam of [0, 1]) {
        await variant(ctx, '', 'GunGame')
        const killer = winningTeam === 0 ? 0 : 2, victim = winningTeam === 0 ? 2 : 0
        for (let level = 0; level < 4; level++) {
            await ctx.sim.waitForFunction(v => !!team.slots()[v].sprite, { timeout: 7000 }, victim)
            await ctx.sim.evaluate(({ killer, victim, level }) => {
                team.freezeBots()
                // Others cannot interfere. Keep every phase in the clear upper lane.
                team.slots().forEach((s,i) => { if (s.sprite) team.place(i, i === 1 ? 24 : 136, 88) })
                team.place(killer, 40, 24); team.place(victim, level < 2 ? 88 : level === 2 ? 64 : 50, 24)
                team.slots()[victim].health = 1
                team.slots()[killer].nextShotAt = 0
            }, { killer, victim, level })
            if (winningTeam === 0) await ctx.button(5, true)
            if (level < 3) {
                await ctx.sim.waitForFunction(({ killer, level }) => team.get('players').data[killer].fields.score === level + 2, { timeout: 5000 }, { killer, level })
                if (winningTeam === 0) await ctx.button(5, false)
                const progression = await ctx.sim.evaluate(k => ({
                    weapon: team.get('players').data[k].fields.weapon.fields.name,
                    others: team.get('players').data.filter((p,i) => i !== k).map(p => p.fields.score)
                }), killer)
                assert.equal(progression.weapon, ['SMG', 'Shotgun', 'Knife'][level])
                assert.ok(progression.others.every(score => score === 1), 'Other player ladders stay independent')
                if (level === 0) await ctx.screenshot('gun-game-level-up.png')
            } else {
                await ctx.sim.waitForFunction(() => team.get('finished'), { timeout: 5000 })
                if (winningTeam === 0) await ctx.button(5, false)
            }
        }
        await ctx.sleep(1300)
        await ctx.screenshot(winningTeam === 0 ? 'gun-blue-win.png' : 'gun-red-win.png')
        await ctx.button(5, true); await ctx.sleep(100); await ctx.button(5, false)
        await ctx.sim.waitForFunction(() => {
            const g = pxsim.runtime.globals
            const get = n => g[Object.keys(g).find(k => k.startsWith(n + '___') && (n !== 'players' || g[k]?.data?.some(p => p.fields && 'soldier' in p.fields)))]
            return !get('finished') && get('players')?.data?.every(p => p.fields.score === 1 && p.fields.weapon.fields.name === 'Pistol' && p.fields.soldier)
        }, { timeout: 15000 })
        console.log(`PASS: real gun game team ${winningTeam} completes all four weapons, team victory and button restart`)
    }
    const legacy = ctx.text['main.ts'].replace('shooter.setMode(shooter.Mode.Deathmatch)', 'deathmatch.configure()')
    await ctx.command('importproject', { project: { text: { ...ctx.text, 'main.ts': legacy } } })
    await ctx.sleep(1000); await ctx.command('switchblocks'); await ctx.sleep(800)
    assert.equal(await ctx.editor.evaluate(() => pxt.blocks.requireBlockly().common.getMainWorkspace().getAllBlocks(false).some(b => b.type === 'deathmatch_configure')), true)
    console.log('PASS: three-way mode enum round-trips, no-mode runtime and legacy deathmatch block retained')
}
// A learner-style program using only Mod/Weapons blocks, with no built-in mode.
// It is appended AFTER startGame(), so it also proves registration order does not matter.
const learnerRules = `
mod.OnGameModeStarted(function () {
    mod.SetGameModeTargetScore(3)
    mod.DisplayNotificationMessage(mod.Message("FIRST TEAM TO {} WINS", mod.GetTargetScore()))
})
mod.OnPlayerDeployed(function (eventPlayer) {
    mod.SetVariable(mod.ObjectVariable(eventPlayer, 0), mod.GetVariable(mod.ObjectVariable(eventPlayer, 0)) + 1)
})
mod.OnPlayerEarnedKill(function (eventPlayer, eventOtherPlayer, eventWeapon) {
    if (!(mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(eventOtherPlayer)))) {
        mod.SetGameModeScore(mod.GetTeam(eventPlayer), mod.GetGameModeScore(mod.GetTeam(eventPlayer)) + 1)
        weapons.give(eventPlayer, weapons.Kind.SMG)
        mod.DisplayGameModeMessage(mod.Message("{} SCORES WITH {}", eventPlayer, weapons.name(eventWeapon)), mod.GetTeam(1))
        if (mod.GetGameModeScore(mod.GetTeam(eventPlayer)) >= mod.GetTargetScore()) {
            mod.EndGameMode(eventPlayer)
        }
    }
})
mod.OnPlayerDied(function (eventPlayer, eventOtherPlayer) {
    mod.Wait(1)
    mod.SetVariable(mod.GlobalVariable(1), mod.GetPlayerDeaths(eventPlayer))
})
`
async function checkMod(ctx) {
    await variant(ctx, learnerRules, 'None')
    await ctx.sim.waitForFunction(() => team.get('targetScore') === 3, { timeout: 5000 })
    const started = await ctx.sim.evaluate(() => ({
        deployments: team.get('players').data.map(p => p.fields.variables.data[0]),
        notifications: team.get('notifications').data.map(e => e.fields.text)
    }))
    assert.deepEqual(started.deployments, [1, 1, 1, 1], 'Initial deployment reached handlers registered after startGame')
    assert.deepEqual(started.notifications, ['FIRST TEAM TO 3 WINS'])
    // One real elimination by the human with the baseline (custom) weapon.
    await ctx.sim.evaluate(() => {
        team.freezeBots()
        team.slots().forEach((s, i) => { if (s.sprite) team.place(i, i === 1 ? 24 : 136, 88) })
        team.place(0, 40, 24); team.place(2, 88, 24)
        team.slots()[2].health = 1; team.slots()[0].nextShotAt = 0
    })
    await ctx.button(5, true)
    await ctx.sim.waitForFunction(() => team.get('blueScore') === 1, { timeout: 5000 })
    await ctx.button(5, false)
    const scored = await ctx.sim.evaluate(() => ({
        weapon: team.get('players').data[0].fields.weapon.fields.name,
        announcements: team.get('announcements').data.map(e => e.fields.text),
        finished: team.get('finished')
    }))
    assert.equal(scored.weapon, 'SMG')
    assert.deepEqual(scored.announcements, ['YOU SCORES WITH Custom'])
    assert.equal(scored.finished, false)
    await ctx.screenshot('mod-rules.png')
    // Died handler waits 1 s without blocking the game, then records the victim's deaths.
    await ctx.sim.waitForFunction(() => {
        const g = team.get('globalSlots'); return g && g.data && g.data[1] === 1
    }, { timeout: 4000 })
    await ctx.sim.waitForFunction(() => team.slots()[2].sprite && team.get('players').data[2].fields.variables.data[0] === 2, { timeout: 8000 })

    // Learner program round trip: TS -> Blocks (edit) -> TS -> compile -> run.
    await ctx.command('switchblocks'); await ctx.sleep(1800)
    const blocks = await ctx.editor.evaluate(() => {
        const all = pxt.blocks.requireBlockly().common.getMainWorkspace().getAllBlocks(false)
        const target = all.find(b => b.type === 'mod_set_target_score').getInputTargetBlock('score')
        target.setFieldValue('2', 'NUM')
        return { types: [...new Set(all.map(b => b.type))], categories: ['Mod', 'Weapons'].map(c => document.body.innerText.includes(c)) }
    })
    for (const type of ['mod_on_game_mode_started', 'mod_on_player_deployed', 'mod_on_player_earned_kill', 'mod_on_player_died',
        'mod_set_target_score', 'mod_get_target_score', 'mod_set_game_mode_score', 'mod_get_game_mode_score', 'mod_get_team', 'mod_equals',
        'mod_end_game_mode', 'mod_object_variable', 'mod_global_variable', 'mod_set_variable', 'mod_get_variable', 'mod_get_player_deaths',
        'mod_message', 'mod_display_notification_message', 'mod_display_game_mode_message', 'mod_wait', 'weapons_give', 'weapons_name'])
        assert.ok(blocks.types.includes(type), 'Missing block ' + type)
    assert.ok(!blocks.types.some(t => /javascript|typescript/.test(t)), 'No grey JavaScript blocks: ' + blocks.types.join(','))
    assert.deepEqual(blocks.categories, [true, true])
    await ctx.screenshot('mod-blocks.png')
    await ctx.sleep(1200); await ctx.command('switchjavascript')
    await ctx.editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('mod.SetGameModeTargetScore(2)')), { timeout: 10000 })
    const regenerated = await ctx.editor.evaluate(() => monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts')).getValue())
    for (const call of ['mod.OnPlayerEarnedKill(function (eventPlayer, eventOtherPlayer, eventWeapon)', 'mod.OnPlayerDied(function (eventPlayer, eventOtherPlayer)',
        'mod.GetTeam(1)', 'weapons.give(eventPlayer, weapons.Kind.SMG)', 'mod.Wait(1)', 'shooter.setMode(shooter.Mode.None)'])
        assert.ok(regenerated.includes(call), 'Regenerated TypeScript keeps ' + call + '\n' + regenerated)
    await ctx.command('stopsimulator'); await ctx.command('startsimulator'); await ctx.sleep(1000)
    ctx.sim = await ctx.page.waitForFrame(f => f.url().includes('---simulator'))
    await teamSimulator.install(ctx.sim)
    await ctx.sim.waitForFunction(() => team.get('targetScore') === 2, { timeout: 5000 })
    console.log('PASS: learner mod rules (no mode) run, wait without blocking, and round-trip through Mod/Weapons Blocks with no grey blocks')
}
module.exports = { variant, checkMessages, checkWeapons, checkModes, checkMod, learnerRules }
