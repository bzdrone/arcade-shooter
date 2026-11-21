// Host-side logic checks only: this is not a PXT compiler or Arcade simulator.
// Run with Node.js 22.13+ (built-in TypeScript transformation; no dependencies).
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { stripTypeScriptTypes } = require('node:module')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const source = stripTypeScriptTypes(
    readFileSync(join(__dirname, '..', 'shooter.ts'), 'utf8'),
    { mode: 'transform' }
)

function createGame() {
    let now = 0
    let score = 0
    let life = 0
    let result
    let nextKind = 10
    let edge = 0
    const all = []
    const updates = []
    const overlaps = []
    const destroyed = []
    const pendingDestruction = []
    const kinds = { Player: 0, Enemy: 1, Projectile: 2, create: () => nextKind++ }
    const button = { pressed: false, isPressed() { return this.pressed } }
    const context = vm.createContext({
        Math,
        img: () => ({}),
        SpriteKind: kinds,
        randint: (min, max) => min === 0 && max === 3 ? edge : Math.floor((min + max) / 2),
        scene: { setBackgroundColor() {}, screenWidth: () => 160, screenHeight: () => 120 },
        controller: { A: button, moveSprite() {} },
        info: {
            setLife: value => { life = value },
            setScore: value => { score = value },
            changeLifeBy: value => { life += value; if (life <= 0) result = false },
            changeScoreBy: value => { score += value },
            score: () => score
        },
        game: {
            runtime: () => now,
            onUpdate: handler => updates.push(handler),
            over: won => { result = won }
        },
        sprites: {
            create: (_, kind) => makeSprite(kind),
            createProjectileFromSprite: (_, player, vx, vy) => {
                const shot = makeSprite(kinds.Projectile)
                shot.setPosition(player.x, player.y)
                shot.vx = vx
                shot.vy = vy
                return shot
            },
            onDestroyed: (kind, handler) => destroyed.push({ kind, handler }),
            onOverlap: (a, b, handler) => overlaps.push({ a, b, handler })
        }
    })
    vm.runInContext('Array.prototype.removeAt = function (i) { return this.splice(i, 1)[0] }', context)
    vm.runInContext(source, context)

    function makeSprite(kind) {
        const sprite = {
            vx: 0, vy: 0, dead: false, collisionKind: kind,
            kind: () => kind,
            setKind: value => { kind = value },
            setPosition(x, y) { this.x = x; this.y = y },
            setStayInScreen(value) { this.stayInScreen = value },
            follow(target, speed) { this.target = target; this.speed = speed },
            destroy() {
                if (this.dead) return
                this.dead = true
                // Deliberately defer callbacks to exercise collision bookkeeping.
                pendingDestruction.push({ sprite: this, kind })
            }
        }
        all.push(sprite)
        return sprite
    }

    return {
        api: context.shooter, kinds, button, all,
        get score() { return score },
        get life() { return life },
        get result() { return result },
        get player() { return all.find(s => s.kind() === kinds.Player) },
        enemies: () => all.filter(s => s.kind() === kinds.Enemy && !s.dead),
        shots: () => all.filter(s => s.kind() === kinds.Projectile && !s.dead),
        tick(time) { now = time; updates.forEach(handler => handler()) },
        edge(value) { edge = value },
        overlap(a, b) {
            // Call captured handlers even for consumed sprites, to test stale events.
            overlaps.filter(h => h.b === b.collisionKind && h.a === a.collisionKind)
                .forEach(h => h.handler(a, b))
        },
        flushDestruction() {
            while (pendingDestruction.length) {
                const event = pendingDestruction.shift()
                destroyed.filter(h => h.kind === event.kind).forEach(h => h.handler(event.sprite))
            }
        }
    }
}

function shoot(game, time) {
    game.button.pressed = true
    game.tick(time)
    game.button.pressed = false
    return game.shots().at(-1)
}

test('startup is idempotent and uses the default life, score and position', () => {
    const g = createGame()
    g.api.startGame()
    g.api.startGame()
    assert.equal(g.all.length, 1)
    assert.equal(g.life, 5)
    assert.equal(g.score, 0)
    assert.deepEqual([g.player.x, g.player.y, g.player.stayInScreen], [80, 60, true])
})

test('the project manifest packages a Blocks companion and all required sources', () => {
    const root = join(__dirname, '..')
    const manifest = JSON.parse(readFileSync(join(root, 'pxt.json'), 'utf8'))
    for (const name of ['main.ts', 'main.blocks', 'shooter.ts']) {
        assert.ok(manifest.files.includes(name), `${name} must survive project export`)
        assert.ok(readFileSync(join(root, name), 'utf8').length > 0)
    }
    const blocks = readFileSync(join(root, 'main.blocks'), 'utf8')
    for (const id of ['shooter_set_weapon', 'shooter_set_enemies', 'shooter_start_game']) {
        assert.ok(blocks.includes(`type="${id}"`))
    }
})

test('the actual learner entry point starts successfully', () => {
    const g = createGame()
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    vm.runInNewContext(main, { shooter: g.api })
    assert.equal(g.life, 5)
    assert.equal(g.all.length, 1)
})

test('held fire respects cooldown; aim follows movement and persists at rest', () => {
    const g = createGame()
    g.api.startGame()
    g.button.pressed = true
    g.tick(0)
    g.tick(249)
    assert.equal(g.shots().length, 1)
    assert.equal(g.shots()[0].vx, 120)
    g.player.vy = -70
    g.tick(250)
    g.player.vy = 0
    g.tick(500)
    assert.equal(g.shots().length, 3)
    assert.deepEqual(g.shots().slice(1).map(s => [s.vx, s.vy]), [[0, -120], [0, -120]])
    g.button.pressed = false
    g.tick(750)
    assert.equal(g.shots().length, 3)
})

test('spawns use all four edges, follow the player, and cap at six', () => {
    const g = createGame()
    g.api.startGame()
    g.tick(999)
    assert.equal(g.enemies().length, 0)
    for (let i = 0; i < 10; i++) {
        g.edge(i % 4)
        g.tick(1000 + i * 1500)
    }
    const enemies = g.enemies()
    assert.equal(enemies.length, 6)
    assert.equal(enemies[0].x, 5)
    assert.equal(enemies[1].x, 155)
    assert.equal(enemies[2].y, 20)
    assert.equal(enemies[3].y, 115)
    assert.ok(enemies.every(e => e.target === g.player && e.speed === 20))
})

test('three default hits defeat an enemy exactly once, even before destruction callbacks', () => {
    const g = createGame()
    g.api.startGame()
    g.tick(1000)
    const enemy = g.enemies()[0]
    for (let i = 0; i < 3; i++) {
        g.overlap(shoot(g, 1000 + i * 250), enemy)
        assert.equal(g.score, i === 2 ? 1 : 0)
    }
    g.overlap(g.player, enemy)
    assert.equal(g.life, 5)
    g.flushDestruction()
    assert.equal(g.enemies().length, 0)
})

test('one projectile cannot hit twice or damage two overlapping enemies', () => {
    const g = createGame()
    g.api.setEnemies(1, 20, 250)
    g.api.startGame()
    g.tick(1000)
    g.tick(1250)
    const [first, second] = g.enemies()
    const shot = shoot(g, 1250)
    g.overlap(shot, first)
    g.overlap(shot, first)
    g.overlap(shot, second)
    assert.equal(g.score, 1)
    assert.equal(second.dead, false)
})

test('contact costs one life without score; removal frees a spawn slot', () => {
    const g = createGame()
    g.api.startGame()
    for (let i = 0; i < 6; i++) g.tick(1000 + i * 1500)
    const enemy = g.enemies()[0]
    g.overlap(g.player, enemy)
    g.overlap(g.player, enemy)
    assert.equal(g.life, 4)
    assert.equal(g.score, 0)
    g.tick(10000)
    assert.equal(g.enemies().length, 6)
    g.flushDestruction()
})

test('settings clamp minima and cannot change after startup', () => {
    const g = createGame()
    g.api.setWeapon(-1, -1, -1)
    g.api.setEnemies(-1, -1, -1)
    g.api.startGame()
    g.api.setWeapon(99, 9999, 9999)
    g.api.setEnemies(99, 99, 9999)
    const first = shoot(g, 0)
    assert.equal(first.vx, 10)
    g.button.pressed = true
    g.tick(49)
    assert.equal(g.shots().length, 1)
    g.tick(50)
    assert.equal(g.shots().length, 2)
    g.tick(1000)
    const enemy = g.enemies()[0]
    assert.equal(enemy.speed, 1)
    g.overlap(first, enemy)
    assert.equal(g.score, 1)
    g.tick(1250)
    assert.equal(g.enemies().length, 1)
})

test('configured damage rounds to whole numbers and 20 kills wins', () => {
    const g = createGame()
    g.api.setWeapon(1.6, 50, 120)
    g.api.setEnemies(2, 20, 250)
    g.api.startGame()
    for (let i = 0; i < 20; i++) {
        const time = 1000 + i * 250
        g.tick(time)
        g.overlap(shoot(g, time), g.enemies()[0])
        g.flushDestruction()
    }
    assert.equal(g.score, 20)
    assert.equal(g.result, true)
})

test('externally destroyed enemies are removed from the health table', () => {
    const g = createGame()
    g.api.startGame()
    g.tick(1000)
    g.enemies()[0].destroy()
    g.flushDestruction()
    g.tick(2500)
    const enemy = g.enemies()[0]
    for (let i = 0; i < 3; i++) g.overlap(shoot(g, 2500 + i * 250), enemy)
    assert.equal(g.score, 1)
})
