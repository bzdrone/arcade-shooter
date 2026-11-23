// Host-side rule checks, not Arcade physics. The private-state inspection hook
// is injected ONLY into the transformed test copy; it is not shipped in the PNG.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { stripTypeScriptTypes } = require('node:module')
const { test } = require('node:test')
const root = path.resolve(__dirname, '..')
const shooter = fs.readFileSync(path.join(root, 'shooter.ts'), 'utf8').replace(/\n}\s*$/, `
    export function inspect() { return { players, shots, teams, player, finished, blueScore: teams[0].score, redScore: teams[1].score,
        blueShotKind, redShotKind, spentShotKind, soldierKind, weaponDamage, fireInterval, projectileSpeed } }
    export function registerShot(sprite, attacker) { shots.push(new Shot(sprite, attacker, attacker.weapon.damage, attacker.weapon)) }
}`)
const mode = fs.readFileSync(path.join(root, 'deathmatch.ts'), 'utf8')
const messages = fs.readFileSync(path.join(root, 'messages.ts'), 'utf8').replace(/\n}\s*$/, `
    export function inspect() { return { notifications, announcements } }
}`)
// Same order as pxt.json: engine, messages, weapons, mod bridge, then modes that register with it.
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const source = stripTypeScriptTypes([read('pathing.ts'), shooter, messages, read('weapons.ts'), read('mod.ts'), mode, read('gungame.ts')].join('\n'), { mode: 'transform' })

function createGame(modifyLevel, mapName = 'trainingYard') {
    const level = require('./tilemap-fixture.cjs')(mapName)
    if (modifyLevel) modifyLevel(level)
    let now = 0, nextKind = 10, nextId = 0, result, message
    const all = [], updates = [], overlaps = [], destroyed = [], pending = [], renders = []
    const camera = { sprite: null, drawOffsetX: 0, drawOffsetY: 0 }
    const A = { pressed: false, isPressed() { return this.pressed } }
    const kinds = { Projectile: 1, create: () => nextKind++ }
    function makeSprite(kind) {
        const sprite = { id: nextId++, x: 0, y: 0, vx: 0, vy: 0, dead: false, collisionKind: kind,
            kind: () => kind, setKind: value => { if (kind === kinds.Projectile) sprite.collisionKind = value; kind = value },
            setPosition(x, y) { this.x = x; this.y = y },
            setStayInScreen(value) { this.stayInScreen = value }, setFlag(flag, value) { this.flags = { ...this.flags, [flag]: value } },
            destroy() { if (this.dead) return; this.dead = true; pending.push({ kind, sprite: this }) }
        }
        all.push(sprite)
        return sprite
    }
    const context = vm.createContext({
        Math: Object.assign(Object.create(Math), { idiv: (a, b) => Math.trunc(a / b) }),
        pause() {}, img: () => ({ colors: [], replace(from, to) { this.colors.push([from, to]) }, setPixel() {} }), image: { font5: {} },
        tilemap: () => level.map, myTiles: { blueSpawn: 'myTiles.blueSpawn', redSpawn: 'myTiles.redSpawn' },
        tiles: level.tiles, SpriteKind: kinds, SpriteFlag: { DestroyOnWall: 1, AutoDestroy: 2 },
        scene: { setBackgroundColor() {}, screenWidth: () => 160, screenHeight: () => 120,
            cameraFollowSprite(sprite) { camera.sprite = sprite },
            createRenderable: (_, render) => renders.push(render) },
        controller: { A, moveSprite(sprite, x, y) { sprite.control = [x, y] } },
        game: { ScoringType: { None: 0 }, setGameOverScoringType() {}, setGameOverMessage() {},
            runtime: () => now, currentScene: () => ({ tileMap: level.map }),
            onUpdate: handler => updates.push(handler), over: value => { result = value }, splash: value => { message = value } },
        sprites: {
            create: (_, kind) => makeSprite(kind),
            createProjectileFromSprite: (picture, from, vx, vy) => {
                const shot = makeSprite(kinds.Projectile)
                shot.picture = picture
                shot.setPosition(from.x, from.y); shot.vx = vx; shot.vy = vy
                return shot
            },
            onDestroyed: (kind, handler) => destroyed.push({ kind, handler }),
            onOverlap: (a, b, handler) => overlaps.push({ a, b, handler })
        }
    })
    vm.runInContext('Array.prototype.removeAt = function(i) { return this.splice(i, 1)[0] }; Array.prototype.removeElement = function(x) { const i = this.indexOf(x); if (i >= 0) this.splice(i, 1) }', context)
    vm.runInContext(source, context)
    // Compatibility view for baseline assertions; lifecycle state remains real engine state.
    const state = () => {
        const s = context.shooter.inspect()
        return { ...s, soldiers: s.players.map(p => new Proxy(p, {
            get(p, key) { return ['sprite', 'health', 'nextShotAt', 'navigation', 'field'].includes(key)
                ? (p.soldier?.[key] ?? (key === 'health' ? 0 : null)) : p[key] }
        })) }
    }
    return { api: context.shooter, mode: context.deathmatch, messages: context.messages, weapons: context.weapons, mod: context.mod, A, all, level, camera,
        state,
        tick(time) { now = time; updates.forEach(handler => handler()) },
        runMain() { vm.runInContext(fs.readFileSync(path.join(root, 'main.ts'), 'utf8'), context) },
        shot(team) {
            const s = this.state(), shot = makeSprite(team === 0 ? s.blueShotKind : s.redShotKind)
            context.shooter.registerShot(shot, s.players[team === 0 ? 0 : 2])
            return shot
        },
        overlap(a, b) {
            overlaps.filter(h => h.a === a.collisionKind && h.b === b.collisionKind).forEach(h => h.handler(a, b))
        },
        flush() {
            while (pending.length) { const event = pending.shift(); destroyed.filter(h => h.kind === event.kind).forEach(h => h.handler(event.sprite)) }
        },
        draw() {
            const lines = [], rectangles = []
            renders.forEach(render => render({ fillRect: (...args) => rectangles.push(args), print: text => lines.push(text) }, camera))
            return { lines, rectangles }
        },
        hud() { return this.draw().lines },
        get result() { return result }, get message() { return message }
    }
}
function defeat(g, slot, team) {
    const target = g.state().soldiers[slot].sprite
    for (let i = 0; i < 3; i++) g.overlap(g.shot(team), target)
    return target
}
function lineUp(g) {
    const points = [[24, 24], [40, 24], [136, 24], [120, 24]]
    g.state().soldiers.forEach((s, i) => s.sprite.setPosition(...points[i]))
}

test('actual entry point starts exactly two soldiers per team, once', () => {
    const g = createGame(); g.runMain(); g.api.startGame()
    const s = g.state()
    assert.equal(s.soldiers.length, 4)
    assert.deepEqual(Array.from(s.soldiers, x => x.team), [0, 0, 1, 1])
    assert.deepEqual(Array.from(s.soldiers, x => x.human), [true, false, false, false])
    assert.deepEqual(Array.from(s.soldiers, x => x.health), [3, 3, 3, 3])
    assert.deepEqual(Array.from(s.soldiers, x => [x.sprite.x, x.sprite.y]), [[24, 40], [24, 72], [136, 40], [136, 72]])
    assert.ok(s.soldiers.every(x => x.human || x.navigation.speed === 10))
    assert.equal(g.all.length, 4)
})

test('camera follows only the human, detaches on death and rebinds on respawn', () => {
    const g = createGame(); g.runMain()
    const original = g.state().player
    assert.equal(g.camera.sprite, original)
    assert.ok(g.all.every(s => !s.stayInScreen), 'Bots and human are not viewport-confined')
    g.camera.drawOffsetX = 160; g.camera.drawOffsetY = 120
    defeat(g, 0, 1)
    assert.equal(g.camera.sprite, null)
    assert.deepEqual([g.camera.drawOffsetX, g.camera.drawOffsetY], [160, 120])
    g.tick(5000)
    assert.notEqual(g.state().player, original)
    assert.equal(g.camera.sprite, g.state().player)
})

test('health bars subtract camera offsets while HUD stays fixed and draws on top', () => {
    const g = createGame(); g.runMain()
    g.state().player.setPosition(240, 180)
    g.camera.drawOffsetX = 160; g.camera.drawOffsetY = 120
    const { rectangles, lines } = g.draw()
    assert.deepEqual(rectangles[0], [77, 54, 6, 1, 15])
    assert.deepEqual(rectangles[1], [77, 54, 6, 1, 9])
    assert.deepEqual(rectangles.slice(-2), [[0, 0, 160, 9, 15], [0, 112, 160, 8, 15]])
    assert.match(lines[0], /BLUE 0  RED 0/)
})

for (const map of ['trainingYard', 'combatCompound']) for (const mode of ['Deathmatch', 'GunGame', 'None']) {
    test(`${mode} starts independently on ${map}`, () => {
        const g = createGame(null, map)
        g.api.setMode(g.api.Mode[mode]); g.api.startGame(); g.tick(0)
        assert.equal(g.result, undefined)
        assert.equal(g.message, undefined)
        assert.equal(g.state().players.length, 4)
        assert.ok(g.state().players.every(p => p.soldier))
        assert.equal(g.camera.sprite, g.state().player)
        assert.equal(g.api.getTargetScore(), mode === 'Deathmatch' ? 10 : mode === 'GunGame' ? 4 : 0)
    })
}

test('manifest packages implementation, pathing, Blocks and level assets', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pxt.json'), 'utf8'))
    for (const name of ['main.ts','main.blocks','shooter.ts','messages.ts','weapons.ts','mod.ts','deathmatch.ts','gungame.ts','pathing.ts','tilemap.g.ts','tilemap.g.jres']) {
        assert.ok(manifest.files.includes(name)); assert.ok(fs.readFileSync(path.join(root, name), 'utf8').length)
    }
})

test('human held/released fire uses the shared cooldown and retained aim', () => {
    const g = createGame(); g.runMain(); g.A.pressed = true
    const human = g.state().soldiers[0]
    human.sprite.vy = -70
    g.tick(749)
    assert.equal(g.all.length, 4)
    g.tick(750)
    const shot = g.all.at(-1)
    assert.equal(shot.kind(), g.state().blueShotKind)
    assert.deepEqual([shot.vx, shot.vy], [0, -80])
    assert.equal(shot.flags[1], true)
    assert.equal(shot.flags[2], false, 'Off-screen shots survive until wall impact or range expiry')
    human.sprite.vy = 0
    g.tick(1499); assert.equal(g.all.length, 5)
    g.tick(1500); assert.equal(g.all.length, 6)
    assert.equal(g.all.at(-1).vy, -80)
    g.A.pressed = false; g.tick(2250); assert.equal(g.all.length, 6)
})

test('all three bots fire under identical rules and do not target teammates', () => {
    const g = createGame(); g.runMain(); lineUp(g)
    g.tick(750)
    const s = g.state(), shots = g.all.filter(x => x.kind() === s.blueShotKind || x.kind() === s.redShotKind)
    assert.equal(shots.filter(x => x.kind() === s.blueShotKind).length, 1)
    assert.equal(shots.filter(x => x.kind() === s.redShotKind).length, 2)
    assert.ok(shots.every(x => Math.abs(x.vx) === 80 && x.vy === 0))
    assert.ok(shots.filter(x => x.kind() === s.blueShotKind).every(x => x.vx > 0))
    assert.ok(shots.filter(x => x.kind() === s.redShotKind).every(x => x.vx < 0))
    g.tick(1499); assert.equal(g.all.length, 7)
    g.tick(1500); assert.equal(g.all.length, 10)
})

test('cover blocks bot shots and bots pursue rather than shoot through it', () => {
    const g = createGame(); g.runMain(); g.tick(750)
    assert.equal(g.all.length, 4)
    assert.ok(g.state().soldiers.slice(1).some(s => Math.hypot(s.sprite.vx, s.sprite.vy) > 0))
    assert.ok(g.state().soldiers.slice(1).every(s => Math.hypot(s.sprite.vx, s.sprite.vy) <= 10.001))
})

test('touching soldiers causes no damage or points', () => {
    const g = createGame(); g.runMain()
    const s = g.state(); g.overlap(s.soldiers[0].sprite, s.soldiers[2].sprite)
    assert.ok(s.soldiers.every(x => x.health === 3))
    assert.equal(g.state().blueScore + g.state().redScore, 0)
})

test('friendly fire is off, and a friendly shot can continue to an opponent', () => {
    const g = createGame(); g.runMain()
    const s = g.state(), shot = g.shot(0)
    g.overlap(shot, s.soldiers[1].sprite)
    assert.equal(s.soldiers[1].health, 3); assert.equal(shot.dead, false)
    g.overlap(shot, s.soldiers[2].sprite)
    assert.equal(s.soldiers[2].health, 2); assert.equal(shot.dead, true)
})

test('consumed projectiles and defeated soldiers reject stale overlaps', () => {
    const g = createGame(); g.api.setWeapon(3, 750, 80); g.mode.configure(); g.api.startGame()
    const s = g.state(), target = s.soldiers[2].sprite, shot = g.shot(0)
    g.overlap(shot, target); g.overlap(shot, target); g.overlap(shot, s.soldiers[3].sprite)
    assert.equal(g.state().blueScore, 1); assert.equal(s.soldiers[3].health, 3)
    g.overlap(g.shot(0), target); g.flush()
    assert.equal(g.state().blueScore, 1)
    assert.equal(s.soldiers[2].sprite, null)
})

for (const [name, slot, team] of [['human', 0, 1], ['friendly bot', 1, 1], ['red bot', 2, 0]]) {
    test(`${name} has three-hit health and waits five seconds to respawn`, () => {
        const g = createGame(); g.runMain(); g.tick(100)
        const s = g.state().soldiers[slot], old = s.sprite
        const first = g.shot(team); g.overlap(first, old)
        assert.equal(s.health, 2); assert.equal(s.sprite, old)
        g.overlap(g.shot(team), old); assert.equal(s.health, 1)
        g.overlap(g.shot(team), old); assert.equal(s.sprite, null)
        assert.equal(s.respawnAt, 5100)
        if (slot === 0) { assert.equal(g.state().player, null); assert.match(g.hud()[1], /RESPAWN IN 5s/) }
        g.tick(5099); assert.equal(s.sprite, null)
        g.tick(5100); assert.ok(s.sprite && s.sprite !== old); assert.equal(s.health, 3)
        assert.equal(g.state().soldiers.length, 4)
        if (slot === 0) assert.equal(g.state().player, s.sprite)
    })
}

test('occupied spawn points delay respawn until a point becomes clear', () => {
    const g = createGame(); g.runMain(); g.tick(0); defeat(g, 0, 1)
    const s = g.state().soldiers
    s[1].sprite.setPosition(24, 40); s[2].sprite.setPosition(24, 72)
    g.tick(5000); assert.equal(s[0].sprite, null)
    assert.match(g.hud()[1], /WAITING FOR BLUE SPAWN/)
    s[2].sprite.setPosition(120, 24)
    g.tick(5001); assert.ok(s[0].sprite)
    assert.deepEqual([s[0].sprite.x, s[0].sprite.y], [24, 72])
})

test('external sprite removal schedules respawn without an elimination point', () => {
    const g = createGame(); g.runMain()
    g.state().soldiers[2].sprite.destroy(); g.flush()
    assert.equal(g.state().soldiers[2].sprite, null)
    assert.equal(g.state().blueScore, 0)
    g.tick(4999); assert.equal(g.state().soldiers[2].sprite, null)
    g.tick(5000); assert.ok(g.state().soldiers[2].sprite)
})

for (const [team, slot, won] of [[0, 2, true], [1, 0, false]]) test(`team ${team} wins at ten eliminations`, () => {
    const g = createGame(); g.api.setWeapon(3, 750, 80); g.mode.configure(); g.api.startGame()
    for (let i = 0; i < 10; i++) {
        g.tick(i * 5000)
        const sprite = g.state().soldiers[slot].sprite
        assert.ok(sprite); g.overlap(g.shot(team), sprite); g.flush()
        if (i < 9) assert.equal(g.result, undefined)
    }
    assert.equal(g.result, won)
    assert.equal(team === 0 ? g.state().blueScore : g.state().redScore, 10)
    const other = g.state().soldiers[slot === 0 ? 1 : 3].sprite
    g.overlap(g.shot(team), other)
    assert.equal(team === 0 ? g.state().blueScore : g.state().redScore, 10)
})

test('settings clamp and remain immutable after startup', () => {
    const g = createGame(); g.api.setWeapon(-2, -2, -2); g.api.setSoldiers(-2, -2, -2); g.api.startGame()
    g.api.setWeapon(99, 9999, 9999); g.api.setSoldiers(99, 99, 9999)
    assert.equal(g.state().weaponDamage, 1); assert.equal(g.state().fireInterval, 50); assert.equal(g.state().projectileSpeed, 10)
    assert.ok(g.state().soldiers.every(s => s.health === 1))
    assert.ok(g.state().soldiers.slice(1).every(s => s.navigation.speed === 1))
    g.overlap(g.shot(0), g.state().soldiers[2].sprite)
    assert.equal(g.state().soldiers[2].respawnAt, 1000)
})

test('engine alone emits persistent players without scoring or ending the match', () => {
    const g = createGame(), events = []
    g.api.onElimination((attacker, victim) => events.push([attacker, victim]))
    g.api.setWeapon(3, 750, 80); g.api.startGame()
    const attacker = g.state().players[0], victim = g.state().players[2], body = victim.soldier
    for (let i = 0; i < 11; i++) {
        g.tick(i * 5000)
        g.overlap(g.shot(0), victim.soldier.sprite)
    }
    assert.equal(events.length, 11)
    assert.ok(events.every(e => e[0] === attacker && e[1] === victim))
    assert.equal(victim.soldier, null)
    g.tick(55000)
    assert.notEqual(victim.soldier, body)
    assert.equal(g.state().players[2], victim)
    assert.equal(g.result, undefined)
    assert.equal(g.state().blueScore, 0)
    assert.ok(!g.hud().some(s => /FIRST TO 10/.test(s)))
})

test('real fired shots retain damage and attacker after weapon change and attacker death', () => {
    const g = createGame(), events = []
    g.api.onElimination((a, v) => events.push([a, v]))
    g.api.startGame()
    const [human, ally, red] = g.state().players
    const initialBody = human.soldier
    g.A.pressed = true; g.tick(750); g.A.pressed = false
    const oldShot = g.state().shots.find(s => s.attacker === human).sprite
    const upgraded = g.api.createWeapon(3, 100, 120)
    g.api.giveWeapon(human, upgraded)
    assert.notEqual(ally.weapon, upgraded)
    g.overlap(oldShot, red.soldier.sprite)
    assert.equal(red.soldier.health, 2, 'Old shot keeps original damage')
    g.A.pressed = true; g.tick(1500); g.A.pressed = false
    const newShot = g.state().shots.find(s => s.attacker === human).sprite
    assert.equal(newShot.vx, 120)
    const oldSprite = human.soldier.sprite
    for (let i = 0; i < 3; i++) g.overlap(g.shot(1), oldSprite)
    assert.equal(human.soldier, null)
    g.overlap(newShot, red.soldier.sprite)
    assert.equal(events.at(-1)[0], human, 'Dead attacker still owns the elimination')
    assert.equal(events.at(-1)[1], red)
    g.tick(6500)
    assert.notEqual(human.soldier, initialBody)
    assert.equal(human.weapon, upgraded)
    assert.equal(human.soldier.nextShotAt, 6600)
    g.A.pressed = true; g.tick(6600); g.A.pressed = false
    const cleanup = g.state().shots.find(s => s.attacker === human).sprite
    cleanup.destroy(); g.flush()
    assert.ok(!g.state().shots.some(s => s.sprite === cleanup), 'Wall/expiry destruction forgets ownership records')
})

test('deathmatch selection is idempotent and endMatch blocks later damage and respawns', () => {
    const g = createGame(); g.mode.configure(); g.mode.configure(); g.api.startGame(); g.tick(0)
    defeat(g, 2, 0)
    assert.equal(g.state().blueScore, 1)
    g.api.endMatch(g.api.teamById(1))
    assert.equal(g.result, false)
    g.overlap(g.shot(0), g.state().players[3].soldier.sprite)
    g.tick(10000)
    assert.equal(g.state().players[3].soldier.health, 3)
    assert.equal(g.state().players[2].soldier, null)
    g.api.endMatch(g.api.teamById(0))
    assert.equal(g.result, false)
})

test('deployment, numeric variables, scores and queries belong to persistent players', () => {
    const g = createGame(), deployments = []
    g.api.onDeployed(p => { deployments.push(p); g.api.setVariable(p, 2, g.api.getVariable(p, 2) + 1) })
    g.runMain(); g.tick(0)
    const all = g.api.allPlayers(), human = all[0], red = all[2]
    assert.equal(all.length, 4); all.pop(); assert.equal(g.api.allPlayers().length, 4)
    assert.equal(deployments.length, 4)
    assert.equal(g.api.isHuman(human), true); assert.equal(g.api.isHuman(red), false)
    assert.equal(g.api.getTeam(red), g.api.teamById(1))
    assert.equal(g.api.getVariable(red, 0), 0)
    g.api.setScore(human, 2); assert.equal(g.api.getScore(human), 2)
    assert.equal(g.api.getTargetScore(), 10)
    g.api.dealDamage(red, 3, human)
    assert.equal(g.api.isAlive(red), false)
    assert.equal(g.api.getEliminations(human), 1); assert.equal(g.api.getDeaths(red), 1)
    g.tick(5000)
    assert.equal(deployments.length, 5); assert.equal(deployments.at(-1), red)
    assert.equal(g.api.getVariable(red, 2), 2)
    assert.equal(g.api.getScore(human), 2)
    g.api.endMatch(human); assert.equal(g.result, true)
})

test('self-inflicted death has identical event players, no kill or deathmatch point', () => {
    const g = createGame(), events = []
    g.api.onElimination((a, v) => events.push([a, v])); g.runMain()
    const human = g.api.allPlayers()[0]
    g.api.dealDamage(human, 3)
    g.api.dealDamage(human, 3)
    assert.equal(events.length, 1)
    assert.equal(events[0][0], human); assert.equal(events[0][1], human)
    assert.equal(g.api.getEliminations(human), 0); assert.equal(g.api.getDeaths(human), 1)
    assert.equal(g.state().blueScore, 0); assert.equal(g.state().redScore, 0)
    g.tick(5000)
    human.soldier.sprite.destroy(); g.flush()
    assert.equal(events.length, 1); assert.equal(g.api.getDeaths(human), 1)
})

test('messages filter targets and substitute literal placeholders without touching game state', () => {
    const g = createGame(); g.runMain()
    const [human, bot, red] = g.api.allPlayers(), m = g.messages
    assert.equal(m.text('{} {} {} {}', human, 2, 'done'), 'YOU 2 done {}')
    assert.equal(m.text('{} {}', '{}', 'literal'), '{} literal')
    assert.equal(m.text('{}', red), 'RED 1')
    m.notify('everyone'); m.notify('human', human); m.notify('team', g.api.getTeam(human))
    m.notify('bot', bot); m.notify('red', red); m.notify('red team', g.api.getTeam(red))
    assert.deepEqual(Array.from(m.inspect().notifications, e => e.text), ['everyone', 'human', 'team'])
    m.announce('large'); assert.equal(m.inspect().announcements.length, 1)
    assert.ok(g.hud().includes('large')); assert.ok(g.hud().includes('everyone'))
    assert.equal(g.result, undefined); assert.equal(g.state().blueScore, 0)
})

test('message queues expire independently, stay bounded and never block firing', () => {
    const g = createGame(); g.runMain()
    const m = g.messages
    m.notify('first'); m.notify('second'); m.announce('announcement')
    g.A.pressed = true; g.tick(750); g.A.pressed = false
    assert.ok(g.state().shots.length > 0)
    g.tick(1799); assert.equal(m.inspect().notifications[0].text, 'first')
    g.tick(1800); assert.equal(m.inspect().notifications[0].text, 'second')
    assert.equal(m.inspect().announcements.length, 1)
    g.tick(2400); assert.equal(m.inspect().announcements.length, 0)
    g.tick(3600); assert.equal(m.inspect().notifications.length, 0)
    for (let i = 0; i < 20; i++) m.notify('N' + i)
    assert.equal(m.inspect().notifications.length, 8)
    assert.equal(m.inspect().notifications[0].text, 'N0')
    assert.equal(m.inspect().notifications.at(-1).text, 'N19')
})

test('weapon catalog has four distinct presets, clamped ranges and captured shot appearance/lifetime', () => {
    const g = createGame(); g.runMain()
    const presets = [0, 1, 2, 3].map(k => g.weapons.create(k))
    assert.deepEqual(presets.map(w => w.name), ['Pistol', 'SMG', 'Shotgun', 'Knife'])
    assert.equal(presets[0].damage, 1); assert.equal(presets[0].interval, 750); assert.equal(presets[0].speed, 80)
    assert.equal(presets[0].range, 200)
    assert.ok(presets[1].interval < presets[0].interval)
    assert.ok(presets[2].damage > presets[0].damage)
    assert.ok(presets[3].range < presets[2].range)
    assert.equal(g.api.createWeapon(1, 100, 10, 999, 99).range, 25)
    assert.equal(g.api.createWeapon(1, 100, 80, -1, -1).range, 1)
    const human = g.api.allPlayers()[0]
    g.api.giveWeapon(human, presets[2]); g.A.pressed = true; g.tick(750); g.A.pressed = false
    const shot = g.state().shots.find(s => s.attacker === human).sprite
    assert.equal(shot.lifespan, Math.floor(32000 / 70))
    assert.equal(shot.picture.colors[0][1], 4)
    g.api.giveWeapon(human, presets[3])
    assert.equal(shot.picture.colors[0][1], 4)
    assert.equal(shot.lifespan, Math.floor(32000 / 70))
})

test('short-range bots advance while aligned, then stop and fire in range', () => {
    const g = createGame(); g.runMain(); lineUp(g)
    const bot = g.api.allPlayers()[2]
    g.api.giveWeapon(bot, g.weapons.create(3))
    g.tick(750)
    assert.ok(Math.hypot(bot.soldier.sprite.vx, bot.soldier.sprite.vy) > 0)
    assert.ok(!g.state().shots.some(s => s.attacker === bot))
    bot.soldier.sprite.setPosition(48, 24)
    g.tick(1000)
    assert.equal(bot.soldier.sprite.vx, 0)
    assert.ok(g.state().shots.some(s => s.attacker === bot))
    const shot = g.state().shots.find(s => s.attacker === bot).sprite
    assert.equal(shot.lifespan, 150)
})

for (const team of [0, 1]) test(`gun game individual ladder wins for team ${team}, persists across death and ignores old shots`, () => {
    const g = createGame(); g.api.setMode(g.api.Mode.GunGame); g.api.startGame(); g.tick(0)
    const ps = g.api.allPlayers(), attacker = ps[team === 0 ? 0 : 2], victim = ps[team === 0 ? 2 : 0]
    assert.ok(ps.every(p => p.weapon.name === 'Pistol' && g.api.getScore(p) === 1))
    const fire = () => g.shot(team)
    const hit = shot => g.overlap(shot, victim.soldier.sprite)
    const old = fire()
    hit(fire()); hit(fire()); hit(fire())
    assert.equal(attacker.weapon.name, 'SMG'); assert.equal(g.api.getVariable(attacker, 0), 1)
    assert.equal(ps[team === 0 ? 1 : 3].weapon.name, 'Pistol', 'Teammate ladder is independent')
    g.tick(5000)
    victim.soldier.health = 1
    hit(old)
    assert.equal(attacker.weapon.name, 'SMG', 'Old pistol elimination cannot advance the SMG level')
    g.tick(10000)
    hit(fire()); hit(fire()); hit(fire())
    assert.equal(attacker.weapon.name, 'Shotgun')
    g.tick(15000)
    const lateShotgun = fire()
    hit(fire())
    assert.equal(attacker.weapon.name, 'Knife')
    g.api.dealDamage(attacker, 3)
    g.tick(20000)
    assert.equal(attacker.weapon.name, 'Knife'); assert.equal(g.api.getVariable(attacker, 0), 3)
    hit(lateShotgun)
    assert.equal(g.result, undefined, 'Late shotgun cannot win the knife level')
    g.tick(25000)
    const winning = fire(), finalBody = victim.soldier.sprite; hit(winning); g.overlap(winning, finalBody)
    assert.equal(g.result, team === 0)
    assert.equal(g.api.getScore(attacker), 4)
    assert.equal(g.api.getScore(g.api.getTeam(attacker)), 4)
})

test('mode selection is last-wins before startup, immutable after, with legacy selection retained', () => {
    const g = createGame()
    g.mode.configure(); g.api.setMode(g.api.Mode.GunGame); g.api.setMode(g.api.Mode.None); g.api.startGame()
    g.api.setMode(g.api.Mode.Deathmatch)
    defeat(g, 2, 0)
    assert.equal(g.state().blueScore, 0); assert.equal(g.api.getTargetScore(), 0)
    const legacy = createGame(); legacy.mode.configure(); legacy.api.startGame(); legacy.tick(0)
    assert.equal(legacy.api.getTargetScore(), 10)
})

test('invalid or disconnected team spawn tiles are reported', () => {
    const missing = createGame(level => level.indices.fill(1)); missing.api.startGame()
    assert.match(missing.message, /two walkable blue and two red/); assert.equal(missing.result, false)
    const blocked = createGame(level => level.walls.fill(true)); blocked.api.startGame()
    assert.match(blocked.message, /two walkable/)
    const split = createGame(level => { for (let row = 1; row < 6; row++) level.walls[row * level.width + 4] = true })
    split.api.startGame(); assert.match(split.message, /Connect every spawn/); assert.equal(split.result, false)
})

test('mod events reach handlers registered after startup, with Portal player order', () => {
    const g = createGame(), log = []
    g.api.setMode(g.api.Mode.None); g.api.startGame()
    // Registered after startGame, as a Blocks program may order them: start and first deployments wait one frame.
    g.mod.OnGameModeStarted(() => log.push('started'))
    g.mod.OnPlayerDeployed(p => log.push('deployed ' + g.api.getDisplayName(p)))
    g.mod.OnPlayerDied((p, o) => log.push('died ' + g.api.getDisplayName(p) + ' by ' + g.api.getDisplayName(o)))
    g.mod.OnPlayerEarnedKill((p, o, w) => log.push('kill ' + g.api.getDisplayName(p) + ' ' + g.api.getDisplayName(o) + ' ' + w))
    assert.deepEqual(log, [])
    g.tick(0)
    assert.deepEqual(log, ['started', 'deployed YOU', 'deployed BLUE BOT', 'deployed RED 1', 'deployed RED 2'])
    log.length = 0; g.tick(1)
    assert.deepEqual(log, [], 'Start runs once')
    const [human, , red] = g.api.allPlayers()
    g.mod.DealDamage(red, 3, human)
    assert.deepEqual(log, ['died RED 1 by YOU', 'kill YOU RED 1 -1'])
    log.length = 0; g.mod.DealDamage(human, 3)
    assert.deepEqual(log, ['died YOU by YOU', 'kill YOU YOU -1'], 'Self-inflicted: same player twice')
    log.length = 0; g.tick(6000)
    assert.deepEqual(log, ['deployed YOU', 'deployed RED 1'])
    g.weapons.give(human, g.weapons.Kind.SMG)
    g.shot(0); const shot = g.state().shots.at(-1).sprite
    red.soldier.health = 1; g.overlap(shot, red.soldier.sprite)
    assert.equal(log.at(-1), 'kill YOU RED 1 ' + g.weapons.Kind.SMG, 'Kill event reports the firing weapon category')
})

test('mod teams use Portal numbering; score, target and end map onto the engine', () => {
    const g = createGame(); g.api.setMode(g.api.Mode.None); g.api.startGame(); g.tick(0)
    const [human, ally, red] = g.api.allPlayers(), m = g.mod
    assert.equal(m.GetTeam(1), g.api.teamById(0)); assert.equal(m.GetTeam(2), g.api.teamById(1))
    assert.equal(m.GetTeam(0), null, 'Team 0 is neutral; no players belong to it')
    assert.equal(m.GetTeam(red), m.GetTeam(2))
    assert.ok(m.Equals(m.GetTeam(human), m.GetTeam(ally))); assert.ok(!m.Equals(human, ally))
    m.SetGameModeScore(m.GetTeam(1), 3); m.SetGameModeScore(red, 2)
    assert.equal(m.GetGameModeScore(g.api.teamById(0)), 3); assert.equal(m.GetGameModeScore(red), 2)
    m.SetGameModeTargetScore(7); assert.equal(m.GetTargetScore(), 7)
    assert.equal(m.AllPlayers().length, 4)
    m.DealDamage(red, 3, human)
    assert.equal(m.GetPlayerKills(human), 1); assert.equal(m.GetPlayerDeaths(red), 1)
    assert.equal(g.state().blueScore, 3, 'No mode: kills do not score by themselves')
    m.EndGameMode(red); assert.equal(g.result, false)
})

test('mod variables: player slots survive respawn, team and global slots are separate', () => {
    const g = createGame(); g.api.setMode(g.api.Mode.None); g.api.startGame(); g.tick(0)
    const [human, , red] = g.api.allPlayers(), m = g.mod
    m.SetVariable(m.ObjectVariable(red, 4), 9)
    assert.equal(g.api.getVariable(red, 4), 9, 'Player slots are the engine slots')
    m.SetVariable(m.ObjectVariable(m.GetTeam(1), 4), 5)
    m.SetVariable(m.ObjectVariable(m.GetTeam(2), 4), 6)
    m.SetVariable(m.GlobalVariable(4), 7)
    m.SetVariable(m.GlobalVariable(32), 99); m.SetVariable(m.ObjectVariable(human, -1), 99)
    m.DealDamage(red, 3, human); g.tick(6000)
    assert.ok(g.api.isAlive(red))
    assert.deepEqual([m.ObjectVariable(red, 4), m.ObjectVariable(m.GetTeam(1), 4), m.ObjectVariable(m.GetTeam(2), 4), m.GlobalVariable(4), m.GlobalVariable(32), m.ObjectVariable(human, 4)].map(m.GetVariable), [9, 5, 6, 7, 0, 0])
})

test('mod messages fill placeholders and keep single-screen audience filtering', () => {
    const g = createGame(); g.api.setMode(g.api.Mode.None); g.api.startGame(); g.tick(0)
    const [human, ally, red] = g.api.allPlayers(), m = g.mod
    assert.equal(m.Message('{} has {} of {}', human, 2, 'three'), 'YOU has 2 of three')
    m.DisplayNotificationMessage(m.Message('ALL'))
    m.DisplayNotificationMessage(m.Message('BOT ONLY'), ally)
    m.DisplayNotificationMessage(m.Message('BLUE'), m.GetTeam(1))
    m.DisplayGameModeMessage(m.Message('{} ROUND', red), m.GetTeam(2))
    m.DisplayGameModeMessage(m.Message('{} ROUND', red))
    const q = g.messages.inspect()
    assert.deepEqual(Array.from(q.notifications, e => e.text), ['ALL', 'BLUE'])
    assert.deepEqual(Array.from(q.announcements, e => e.text), ['RED 1 ROUND'])
})

test('creator rules written with mod run with no built-in mode', () => {
    const g = createGame(), m = () => g.mod
    g.api.setMode(g.api.Mode.None)
    // The deathmatch rule in creator form, registered before startup as main.ts would.
    g.mod.OnGameModeStarted(() => m().SetGameModeTargetScore(2))
    g.mod.OnPlayerEarnedKill((player, otherPlayer) => {
        if (m().Equals(m().GetTeam(player), m().GetTeam(otherPlayer))) return
        const team = m().GetTeam(player)
        m().SetGameModeScore(team, m().GetGameModeScore(team) + 1)
        if (m().GetGameModeScore(team) >= m().GetTargetScore()) m().EndGameMode(team)
    })
    g.api.startGame(); g.tick(0)
    assert.equal(g.api.getTargetScore(), 2)
    defeat(g, 3, 0); assert.equal(g.result, undefined)
    defeat(g, 2, 0); assert.equal(g.result, true)
})

test('weapons compatibility library gives categories and reports them', () => {
    const g = createGame(); g.runMain(); g.tick(0)
    const [human, ally] = g.api.allPlayers(), w = g.weapons
    assert.equal(w.current(human), -1, 'Baseline weapon is custom')
    w.give(human, w.Kind.Shotgun)
    assert.equal(w.current(human), w.Kind.Shotgun); assert.equal(w.current(ally), -1)
    assert.equal(human.weapon.damage, 3)
    assert.deepEqual([0, 1, 2, 3, -1, 9].map(w.name), ['Pistol', 'SMG', 'Shotgun', 'Knife', 'Custom', 'Custom'])
    assert.equal(w.kind(w.Kind.Knife), 3); assert.equal(w.kindOf(null), -1)
})
