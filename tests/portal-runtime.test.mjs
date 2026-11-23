// Runs a converted Portal script against a small simulation of the Portal behaviour
// seen in PortalLog.txt: player ids reused by new bots (even on the other team),
// one bot per AI spawner, bots unspawned after death, and RemoveEquipment throwing
// for empty slots. It checks the runtime's bot seats, respawns and variables; it is
// not Portal and cannot show how bots fight.
//   node --test tests/portal-runtime.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { stripTypeScriptTypes } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { convertProject } from '../site/converter/convert.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtime = fs.readFileSync(path.join(root, 'site/converter/portal-runtime.ts'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pxt.json'), 'utf8'))
const repoFiles = Object.fromEntries(['pxt.json', ...manifest.files].map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]))

class Player { constructor(id, team, ai) { Object.assign(this, { id, team, ai, alive: true, slots: new Set() }) } }

function simulatePortal() {
    const sim = { clock: 0, timers: [], players: [], removeErrors: 0, spawns: [], logs: [], scores: new Map(), target: 0, header: [], names: [] }
    const teams = { 1: { team: 1 }, 2: { team: 2 } }
    const noop = () => {}
    const known = {
        SoldierStateBool: { IsAISoldier: 'ai', IsAlive: 'alive' },
        MoveSpeed: { Walk: 'walk', Run: 'run', Sprint: 'sprint' },
        InventorySlots: { PrimaryWeapon: 'primary', SecondaryWeapon: 'secondary', GadgetOne: 'g1', GadgetTwo: 'g2', Throwable: 'throw', ClassGadget: 'class', MeleeWeapon: 'melee' },
        Weapons: new Proxy({}, { get: (_, k) => k }), Gadgets: new Proxy({}, { get: (_, k) => k }),
        Types: { Player: 'player' }, stringkeys: new Proxy({}, { get: (_, k) => k }),
        GetObjId: o => o.id, Equals: (a, b) => a === b,
        GetTeam: x => typeof x === 'number' ? teams[x] : teams[x.team],
        IsPlayerValid: p => sim.players.includes(p),
        GetSoldierState: (p, s) => s === 'ai' ? p.ai : p.alive,
        IsType: (v, t) => t === 'player' && v instanceof Player,
        AllPlayers: () => sim.players.slice(),
        GetMatchTimeElapsed: () => sim.clock,
        Wait: s => new Promise(resolve => sim.timers.push({ at: sim.clock + s, resolve })),
        GetSpawner: id => ({ id }),
        SpawnAIFromAISpawner: (spawner, ...rest) => {
            const team = rest[rest.length - 1]
            if (rest.length > 1) sim.names.push(rest[0])
            sim.spawns.push({ spawner, team: team.team })
        },
        Message: (key, ...args) => ({ key, args }),
        CustomNotificationSlots: { HeaderText: 'header' },
        DisplayCustomNotificationMessage: (message, slot) => sim.header.push({ slot, ...message }),
        SetGameModeScore: (target, score) => sim.scores.set(target, score),
        GetGameModeScore: target => sim.scores.get(target) ?? 0,
        SetGameModeTargetScore: score => { sim.target = score },
        GetTargetScore: () => sim.target,
        EndGameMode: winner => { sim.winner = winner },
        RemoveEquipment: (p, slot) => { if (!p.slots.delete(slot)) { sim.removeErrors++; throw new Error('NoWeaponOnSlot') } },
        AddEquipment: (p, item, slot) => p.slots.add(slot),
    }
    globalThis.mod = new Proxy(known, { get: (t, k) => k in t ? t[k] : noop })
    globalThis.modlib = { ConvertArray: a => a, ShowEventGameModeMessage: noop }
    globalThis.console = { ...console, log: text => sim.logs.push(text) }
    // Portal gives a new player the lowest free id, as the log showed.
    sim.join = (team, ai) => {
        let id = 0
        while (sim.players.some(p => p.id === id)) id++
        const p = new Player(id, team, ai)
        p.slots = new Set(['primary', 'secondary', 'g1', 'g2', 'throw', 'melee'])
        sim.players.push(p)
        return p
    }
    return sim
}

async function load(mode) {
    const files = { ...repoFiles, 'main.ts': repoFiles['main.ts'].replace(/shooter\.Mode\.\w+/, `shooter.Mode.${mode}`) }
    const script = convertProject({ meta: { name: `sim-${mode}` }, files }, runtime).files[`sim-${mode.toLowerCase()}.ts`]
    const js = stripTypeScriptTypes(script.replace(/^import \* as modlib from 'modlib';$/m, ''), { mode: 'transform' })
    const dir = path.join(root, 'local/portal-runtime-test')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `sim-${mode}-${process.hrtime.bigint()}.mjs`)
    fs.writeFileSync(file, js)
    return import(pathToFileURL(file))
}

async function run(sim, events, seconds) {
    for (let i = 0; i < seconds * 4; i++) {
        sim.clock += 0.25
        for (const t of sim.timers.filter(t => t.at <= sim.clock + 1e-9)) { sim.timers.splice(sim.timers.indexOf(t), 1); t.resolve() }
        await new Promise(r => setImmediate(r))
        // Portal answers spawn requests at once: join, spawner event, deploy.
        for (const { spawner, team } of sim.spawns.splice(0)) {
            const bot = sim.join(team, true)
            events.OnPlayerJoinGame(bot)
            events.OnSpawnerSpawned(bot, spawner)
            events.OnPlayerDeployed(bot)
        }
    }
}

function kill(sim, events, victim, killer) {
    victim.alive = false
    events.OnPlayerDied(victim, killer, 0, 0)
    events.OnPlayerEarnedKill(killer, victim, 0, 0)
    // With AISetUnspawnOnDead the bot then leaves, freeing its id for the next bot.
    if (victim.ai) { sim.players.splice(sim.players.indexOf(victim), 1); events.OnPlayerLeaveGame(victim.id) }
}

const bots = (sim, team) => sim.players.filter(p => p.ai && p.alive && p.team === team)

test('bots fill both teams, respawn after the delay, and keep their seat when Portal reuses ids', async () => {
    const sim = simulatePortal()
    const events = await load('GunGame')
    const human = sim.join(1, false)
    events.OnPlayerJoinGame(human)
    events.OnGameModeStarted()
    events.OnPlayerDeployed(human)
    await run(sim, events, 6)
    assert.equal(bots(sim, 1).length, 1, 'one blue bot beside the human')
    assert.equal(bots(sim, 2).length, 2, 'two red bots')

    // Give the first red bot a level, then kill it; its replacement comes from the same spawner.
    const red = bots(sim, 2)[0]
    events.OnPlayerEarnedKill(red, human, 0, 0)
    const levelBefore = sim.players.length
    kill(sim, events, red, human)
    kill(sim, events, bots(sim, 1)[0], bots(sim, 2)[0])
    await run(sim, events, 2)
    assert.equal(bots(sim, 2).length, 1, 'not replaced before the respawn delay')
    await run(sim, events, 6)
    assert.equal(bots(sim, 1).length, 1)
    assert.equal(bots(sim, 2).length, 2)
    assert.ok(sim.players.length >= levelBefore - 1)

    // Many deaths in a row, with ids reused across teams: never extra bots, always refilled.
    for (let round = 0; round < 6; round++) {
        for (const bot of [...bots(sim, 1), ...bots(sim, 2)]) kill(sim, events, bot, human)
        await run(sim, events, 8)
        assert.equal(bots(sim, 1).length, 1, `round ${round}: blue refilled`)
        assert.equal(bots(sim, 2).length, 2, `round ${round}: red refilled`)
    }
    assert.ok(!sim.logs.some(l => /no bot arrived|error/.test(l)), 'no lost spawns or runtime errors:\n' + sim.logs.filter(l => /no bot arrived|error/.test(l)).join('\n'))
    const reused = sim.logs.filter(l => /spawner 1\d\d produced bot/.test(l)).map(l => l.match(/bot (\d+)/)[1])
    assert.ok(new Set(reused).size < reused.length, 'the simulation did reuse player ids')
})

test('a bot keeps its variables, weapon and level across lives', async () => {
    const sim = simulatePortal()
    const events = await load('GunGame')
    const human = sim.join(1, false)
    events.OnGameModeStarted()
    events.OnPlayerDeployed(human)
    await run(sim, events, 6)
    const red = bots(sim, 2).find(b => sim.logs.some(l => l.includes(`spawner 121 produced bot ${b.id}`)))
    assert.ok(red, 'the bot from spawner 121')
    // Two gun game kills: pistol -> SMG -> shotgun.
    events.OnPlayerEarnedKill(red, human, 0, 0)
    events.OnPlayerEarnedKill(red, human, 0, 0)
    assert.deepEqual([...red.slots], ['primary'], 'shotgun in the primary slot only')
    kill(sim, events, red, human)
    await run(sim, events, 8)
    const next = bots(sim, 2).find(b => sim.logs.some(l => l.includes(`spawner 121 produced bot ${b.id}`)) && b !== red)
    assert.ok(next, 'a new bot from the same spawner')
    assert.deepEqual([...next.slots], ['primary'], 'the new life gets the shotgun again')
    assert.ok(sim.logs.some(l => l.includes('deployed on team 2 as b2_0')), 'seat b2_0 redeployed')
})

test('weapon changes after the first in a life clear only the slot the script filled', async () => {
    const sim = simulatePortal()
    const events = await load('GunGame')
    const human = sim.join(1, false)
    events.OnGameModeStarted()
    events.OnPlayerDeployed(human)
    const afterDeploy = sim.removeErrors
    for (let i = 0; i < 3; i++) events.OnPlayerEarnedKill(human, sim.join(2, true), 0, 0)
    assert.equal(sim.removeErrors, afterDeploy, 'no NoWeaponOnSlot errors from later changes')
    assert.deepEqual([...human.slots], ['melee'], 'knife only at the last level')
})

test('deathmatch shows the team scores and names bots by team', async () => {
    const sim = simulatePortal()
    const events = await load('Deathmatch')
    const human = sim.join(1, false)
    events.OnGameModeStarted()
    events.OnPlayerDeployed(human)
    await run(sim, events, 6)
    const names = sim.names.map(n => n.key + ' ' + n.args.join())
    assert.deepEqual(names.sort(), ['arcadeBlueBot 1', 'arcadeRedBot 1', 'arcadeRedBot 2'])
    assert.deepEqual(sim.header.at(-1), { slot: 'header', key: 'arcadeScoreTarget', args: [0, 0, 10] }, 'target shown at the start')
    for (let i = 0; i < 2; i++) kill(sim, events, bots(sim, 2)[0], human)
    assert.deepEqual(sim.header.at(-1).args, [2, 0, 10], 'score updated straight after each kill')
    for (let i = 0; i < 8; i++) { await run(sim, events, 7); kill(sim, events, bots(sim, 2)[0], human) }
    assert.equal(sim.winner && sim.winner.team, 1, 'blue wins at ten')
})

test('gun game ends on the knife kill, not when a team score reaches the target', async () => {
    const sim = simulatePortal()
    const events = await load('GunGame')
    const human = sim.join(1, false)
    events.OnGameModeStarted()
    events.OnPlayerDeployed(human)
    await run(sim, events, 6)
    for (let i = 0; i < 3; i++) { kill(sim, events, bots(sim, 2)[0], human); await run(sim, events, 7) }
    assert.equal(sim.header.at(-1).args.join(), '4,1,4', 'blue reached the knife: score 4 of 4')
    assert.equal(sim.target, 0, 'the target is never given to Portal, which would end the round')
    assert.equal(sim.winner, undefined, 'reaching the knife does not win')
    // Portal changed its own team scores during play; the rules must not see that.
    sim.scores.clear()
    kill(sim, events, bots(sim, 2)[0], human)
    assert.equal(sim.winner && sim.winner.team, 1, 'the knife kill wins for blue')
})

test.after(() => fs.rmSync(path.join(root, 'local/portal-runtime-test'), { recursive: true, force: true }))
