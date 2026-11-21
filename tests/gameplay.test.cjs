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
    export function inspect() { return { soldiers, blueScore, redScore, player, finished,
        blueShotKind, redShotKind, spentShotKind, soldierKind, weaponDamage, fireInterval, projectileSpeed } }
}`)
const source = stripTypeScriptTypes(fs.readFileSync(path.join(root, 'pathing.ts'), 'utf8') + '\n' + shooter, { mode: 'transform' })

function createGame(modifyLevel) {
    const level = require('./tilemap-fixture.cjs')()
    if (modifyLevel) modifyLevel(level)
    let now = 0, nextKind = 10, nextId = 0, result, message
    const all = [], updates = [], overlaps = [], destroyed = [], pending = [], renders = []
    const A = { pressed: false, isPressed() { return this.pressed } }
    const kinds = { Projectile: 1, create: () => nextKind++ }
    function makeSprite(kind) {
        const sprite = { id: nextId++, x: 0, y: 0, vx: 0, vy: 0, dead: false, collisionKind: kind,
            kind: () => kind, setKind: value => { kind = value },
            setPosition(x, y) { this.x = x; this.y = y },
            setStayInScreen() {}, setFlag(flag, value) { this.flags = { ...this.flags, [flag]: value } },
            destroy() { if (this.dead) return; this.dead = true; pending.push({ kind, sprite: this }) }
        }
        all.push(sprite)
        return sprite
    }
    const context = vm.createContext({
        Math: Object.assign(Object.create(Math), { idiv: (a, b) => Math.trunc(a / b) }),
        pause() {}, img: () => ({ replace() {}, setPixel() {} }), image: { font5: {} },
        tilemap: () => level.map, myTiles: { blueSpawn: 'myTiles.blueSpawn', redSpawn: 'myTiles.redSpawn' },
        tiles: level.tiles, SpriteKind: kinds, SpriteFlag: { DestroyOnWall: 1 },
        scene: { setBackgroundColor() {}, screenWidth: () => 160, screenHeight: () => 120,
            createRenderable: (_, render) => renders.push(render) },
        controller: { A, moveSprite(sprite, x, y) { sprite.control = [x, y] } },
        game: { ScoringType: { None: 0 }, setGameOverScoringType() {}, setGameOverMessage() {},
            runtime: () => now, currentScene: () => ({ tileMap: level.map }),
            onUpdate: handler => updates.push(handler), over: value => { result = value }, splash: value => { message = value } },
        sprites: {
            create: (_, kind) => makeSprite(kind),
            createProjectileFromSprite: (_, from, vx, vy) => {
                const shot = makeSprite(kinds.Projectile)
                shot.setPosition(from.x, from.y); shot.vx = vx; shot.vy = vy
                return shot
            },
            onDestroyed: (kind, handler) => destroyed.push({ kind, handler }),
            onOverlap: (a, b, handler) => overlaps.push({ a, b, handler })
        }
    })
    vm.runInContext(source, context)
    return { api: context.shooter, A, all, level,
        state: () => context.shooter.inspect(),
        tick(time) { now = time; updates.forEach(handler => handler()) },
        runMain() { vm.runInContext(fs.readFileSync(path.join(root, 'main.ts'), 'utf8'), context) },
        shot(team) { return makeSprite(team === 0 ? this.state().blueShotKind : this.state().redShotKind) },
        overlap(a, b) {
            overlaps.filter(h => h.a === a.collisionKind && h.b === b.collisionKind).forEach(h => h.handler(a, b))
        },
        flush() {
            while (pending.length) { const event = pending.shift(); destroyed.filter(h => h.kind === event.kind).forEach(h => h.handler(event.sprite)) }
        },
        hud() { const lines = []; renders.forEach(render => render({ fillRect() {}, print: text => lines.push(text) })); return lines },
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

test('manifest packages implementation, pathing, Blocks and level assets', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pxt.json'), 'utf8'))
    for (const name of ['main.ts','main.blocks','shooter.ts','pathing.ts','tilemap.g.ts','tilemap.g.jres']) {
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
    const g = createGame(); g.api.setWeapon(3, 750, 80); g.api.startGame()
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
    const g = createGame(); g.runMain(); defeat(g, 0, 1)
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
    const g = createGame(); g.api.setWeapon(3, 750, 80); g.api.startGame()
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

test('invalid or disconnected team spawn tiles are reported', () => {
    const missing = createGame(level => level.indices.fill(1)); missing.api.startGame()
    assert.match(missing.message, /two walkable blue and two red/); assert.equal(missing.result, false)
    const blocked = createGame(level => level.walls.fill(true)); blocked.api.startGame()
    assert.match(blocked.message, /two walkable/)
    const split = createGame(level => { for (let row = 1; row < 6; row++) level.walls[row * level.width + 4] = true })
    split.api.startGame(); assert.match(split.message, /Connect every spawn/); assert.equal(split.result, false)
})
