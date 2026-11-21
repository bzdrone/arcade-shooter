// Controlled tests in the REAL simulator, using runtime internals only to place
// actors/freeze unrelated bots. No debug APIs are shipped in the game source.
const assert = require('node:assert/strict')

async function install(sim) {
    await sim.waitForFunction(() => {
        const g = typeof pxsim !== 'undefined' && pxsim.runtime?.globals
        return g && Object.keys(g).some(k => k.startsWith('players___') && g[k]?.data?.length === 4)
    }, { timeout: 30000 })
    await sim.evaluate(() => {
        const get = name => {
            if (name === 'blueScore' || name === 'redScore') return get('teams').data[name === 'blueScore' ? 0 : 1].fields.score
            const g = pxsim.runtime.globals
            return g[Object.keys(g).find(k => k.startsWith(name + '___') &&
                (name !== 'players' || g[k]?.data?.some(p => p.fields && 'soldier' in p.fields)))]
        }
        // Keep the controlled-test slot view while reading/writing the split runtime model.
        const bodyKeys = ['sprite', 'health', 'nextShotAt', 'navigation', 'field']
        const slots = () => get('players').data.map(p => new Proxy(p.fields, {
            get(p, key) { return bodyKeys.includes(key) ? p.soldier?.fields[key] : p[key] },
            set(p, key, value) {
                if (bodyKeys.includes(key)) p.soldier.fields[key] = value
                else p[key] = value
                return true
            }
        }))
        const point = sprite => sprite ? { x: sprite.fields._x / 256 + 4, y: sprite.fields._y / 256 + 4 } : {}
        window.team = {
            get, slots, point,
            set(name, value) {
                if (name === 'blueScore' || name === 'redScore') {
                    get('teams').data[name === 'blueScore' ? 0 : 1].fields.score = value
                    return
                }
                const g = pxsim.runtime.globals
                g[Object.keys(g).find(k => k.startsWith(name + '___'))] = value
            },
            place(index, x, y) {
                const f = slots()[index].sprite.fields
                f._x = (x - 4) * 256; f._y = (y - 4) * 256
                f._lastX = f._x; f._lastY = f._y
                f._vx = 0; f._vy = 0
                const slot = slots()[index]
                if (slot.navigation) slot.navigation.fields.waypoint = -1
                slot.field.fields.nextRefreshAt = 0
            },
            freezeBots() {
                slots().slice(1).forEach(s => { s.navigation.fields.speed = 0; s.nextShotAt = 1e9 })
            },
            snapshot() {
                const s = slots(), scene = get('_scene').fields
                const shots = scene.allSprites.data.filter(sprite => [get('blueShotKind'), get('redShotKind')].includes(sprite.fields._kind))
                return { dead: pxsim.runtime.dead, ...point(get('player')),
                    facingX: get('facingX'), facingY: get('facingY'), nextShotAt: s[0].nextShotAt,
                    blueScore: get('blueScore'), redScore: get('redScore'),
                    soldiers: s.map(s => ({ team: s.team, human: s.human, health: s.health, alive: !!s.sprite,
                        respawnAt: s.respawnAt, nextShotAt: s.nextShotAt, ...point(s.sprite) })),
                    blueShots: shots.filter(s => s.fields._kind === get('blueShotKind')).length,
                    redShots: shots.filter(s => s.fields._kind === get('redShotKind')).length }
            }
        }
    })
}

async function checkArena({ sim, command, button, sleep, snapshot, screenshot }) {
    async function restart() {
        await command('restartsimulator')
        await sleep(500)
        await install(sim)
    }
    await restart()
    await sim.evaluate(() => { team.freezeBots(); team.place(0, 24, 56) })
    await button(3, true); await sleep(500); await button(3, false)
    const blocked = await snapshot()
    assert.ok(blocked.x >= 43 && blocked.x <= 45, `Cover stops human: ${JSON.stringify(blocked)}`)
    await button(5, true); await sleep(850); await button(5, false); await sleep(150)
    assert.ok((await snapshot()).nextShotAt > blocked.nextShotAt)
    assert.equal((await snapshot()).blueShots, 0, 'Cover destroys shots before lifespan expiry')
    console.log('PASS: real simulator cover stops the human and destroys shots')

    for (const scenario of [
        { name: 'left cover', bot: [24, 56], target: [72, 56], ally: [136, 88], beyondX: 68, direction: 1, top: 28, bottom: 68 },
        { name: 'right cover', bot: [136, 72], target: [88, 72], ally: [24, 24], beyondX: 92, direction: -1, top: 44, bottom: 84 }
    ]) {
        await restart()
        await sim.evaluate(s => {
            team.freezeBots()
            team.place(0, ...s.target); team.place(2, ...s.bot)
            // The other blue soldier is farther away by walking distance.
            team.place(1, ...s.ally); team.place(3, 136, 24)
            team.slots()[2].navigation.fields.speed = 10
            window.arenaDetoured = false
        }, scenario)
        await sim.waitForFunction(({ beyondX, direction, top, bottom }) => {
            const p = team.point(team.slots()[2].sprite)
            if (p.y <= top + 0.5 || p.y >= bottom - 0.5) window.arenaDetoured = true
            return direction > 0 ? p.x > beyondX : p.x < beyondX
        }, { timeout: 22000 }, scenario).catch(async error => {
            console.log('ROUTE DIAGNOSTIC', JSON.stringify(await sim.evaluate(() => ({
                ...team.snapshot(), navigation: { speed: team.slots()[2].navigation.fields.speed,
                    waypoint: team.slots()[2].navigation.fields.waypoint },
                fields: team.slots().map(s => ({ goal: s.field.fields.goal, distances: s.field.fields.distances.data }))
            }))))
            throw error
        })
        assert.equal(await sim.evaluate(() => window.arenaDetoured), true)
        console.log(`PASS: real 10px/s soldier routes around ${scenario.name}`)
    }

    await restart()
    await sim.evaluate(() => {
        team.freezeBots()
        ;[[24,24],[40,24],[136,24],[120,24]].forEach((p,i) => team.place(i,...p))
        team.slots().slice(1).forEach(s => { s.nextShotAt = 0 })
    })
    await sleep(250)
    const firing = await snapshot()
    assert.ok(firing.blueShots > 0 && firing.redShots > 0, 'Both teams shoot real projectiles')
    assert.ok(firing.soldiers.slice(1).every(s => s.nextShotAt > 0 && s.nextShotAt < 1e9), 'Every bot fires')
    console.log('PASS: friendly and both opposing bots shoot')

    await restart()
    await sim.evaluate(() => { team.freezeBots(); team.place(0,24,24); team.place(2,24,24) })
    await sleep(1000)
    assert.ok((await snapshot()).soldiers.every(s => s.health === 3), 'Touching causes no damage')
    assert.equal((await snapshot()).blueScore + (await snapshot()).redScore, 0)
    console.log('PASS: opposing soldiers touch without damage or score')

    await restart()
    await sim.evaluate(() => {
        team.freezeBots()
        ;[[24,24],[56,24],[88,24],[136,88]].forEach((p,i) => team.place(i,...p))
        window.originalRedPlayer = team.get('players').data[2]
        window.originalRedSoldier = window.originalRedPlayer.fields.soldier
    })
    await button(5, true)
    await sim.waitForFunction(() => !team.slots()[2].sprite, { timeout: 6500 })
    await button(5, false)
    let death = await snapshot()
    assert.equal(death.soldiers[1].health, 3, 'Friendly bullets pass through the ally without damage')
    assert.equal(death.blueScore, 1)
    await sleep(4500)
    assert.equal((await snapshot()).soldiers[2].alive, false, 'No red respawn before five seconds')
    await sim.waitForFunction(() => !!team.slots()[2].sprite, { timeout: 2500 })
    const redRespawn = (await snapshot()).soldiers[2]
    assert.equal(redRespawn.health, 3)
    assert.ok(await sim.evaluate(() => team.get('players').data[2] === window.originalRedPlayer &&
        window.originalRedPlayer.fields.soldier !== window.originalRedSoldier), 'Respawn preserves player and replaces soldier')
    assert.ok(redRespawn.x > 128, 'Red soldier returns at a red spawn')
    console.log('PASS: real bullets, friendly fire off, elimination point, delayed red respawn')

    await restart()
    await sim.evaluate(() => {
        team.freezeBots()
        ;[[40,24],[24,88],[88,24],[136,88]].forEach((p,i) => team.place(i,...p))
        team.slots()[2].nextShotAt = 0
    })
    await sim.waitForFunction(() => !team.slots()[0].sprite, { timeout: 6500 })
    death = await snapshot()
    assert.equal(death.redScore, 1)
    assert.equal(death.dead, false, 'Human death does not end the match')
    await sim.evaluate(() => { team.freezeBots(); team.place(1,24,40); team.place(2,24,72) })
    await button(3, true); await sleep(200); await button(3, false)
    await sleep(4200)
    assert.equal((await snapshot()).soldiers[0].alive, false)
    await sleep(1000)
    assert.equal((await snapshot()).soldiers[0].alive, false, 'Both occupied points prevent respawn after the timer')
    await sim.evaluate(() => team.place(1,40,88))
    await sim.waitForFunction(() => !!team.slots()[0].sprite, { timeout: 2500 })
    const humanRespawn = await snapshot()
    assert.equal(humanRespawn.soldiers[0].health, 3)
    assert.ok(humanRespawn.x < 32, 'Human returns at a blue spawn')
    await button(3, true); await sleep(200); await button(3, false)
    assert.ok((await snapshot()).x > humanRespawn.x + 8, 'Input rebinds to respawned human')
    console.log('PASS: human death, five-second timer, occupied-spawn retry, rebound controls')

    for (const winningTeam of [0, 1]) {
        await restart()
        await sim.evaluate(winner => {
            team.freezeBots()
            ;[[40,24],[24,88],[88,24],[136,88]].forEach((p,i) => team.place(i,...p))
            team.set(winner === 0 ? 'blueScore' : 'redScore', 9)
            team.slots()[winner === 0 ? 2 : 0].health = 1
            if (winner === 1) team.slots()[2].nextShotAt = 0
        }, winningTeam)
        if (winningTeam === 0) await button(5,true)
        await sim.waitForFunction(() => team.get('finished'), { timeout: 5000 })
        if (winningTeam === 0) await button(5,false)
        assert.equal(await sim.evaluate(winner => team.get(winner === 0 ? 'blueScore' : 'redScore'), winningTeam), 10)
        await sleep(1300)
        await screenshot(winningTeam === 0 ? 'blue-win.png' : 'red-win.png')
        // The actual game-over dialog's any-button restart, not controller restart.
        await button(5,true); await sleep(100); await button(5,false)
        await sim.waitForFunction(() => {
            const g = pxsim.runtime?.globals || {}
            const get = name => g[Object.keys(g).find(k => k.startsWith(name + '___') &&
                (name !== 'players' || g[k]?.data?.some(p => p.fields && 'soldier' in p.fields)))]
            return !get('finished') && get('teams')?.data?.every(t => t.fields.score === 0)
                && get('players')?.data?.length === 4 && get('players').data.every(p => p.fields.soldier?.fields.sprite)
        }, { timeout: 15000 })
        await install(sim)
        console.log(`PASS: team ${winningTeam} wins on tenth real elimination, game-over button restarts 2v2`)
    }
}
module.exports = { install, checkArena }
