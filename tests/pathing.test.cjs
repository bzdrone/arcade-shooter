const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const { stripTypeScriptTypes } = require('node:module')
const fixture = require('./tilemap-fixture.cjs')
const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'pathing.ts'), 'utf8'), { mode: 'transform' })
function setup() {
    const level = fixture()
    const context = vm.createContext({
        Math: Object.assign(Object.create(Math), { idiv: (a, b) => Math.trunc(a / b) }),
        tiles: level.tiles, game: { currentScene: () => ({ tileMap: level.map }) }
    })
    vm.runInContext(source, context)
    const sprite = (column, row) => ({ x: (column + 0.5) * level.size, y: (row + 0.5) * level.size, vx: 0, vy: 0,
        setPosition(x, y) { this.x = x; this.y = y } })
    return { ...level, api: context.pathing, sprite }
}
function pursue(s, from, target, ticks = 1600, moveTarget) {
    const bot = new s.api.Bot(from, 20)
    const visited = []
    for (let i = 0; i < ticks; i++) {
        if (moveTarget) moveTarget(i, target)
        s.api.refresh(target, i * 16, i === 0)
        bot.update(target)
        from.x += from.vx * 0.016
        from.y += from.vy * 0.016
        const column = Math.floor(from.x / s.size), row = Math.floor(from.y / s.size)
        assert.ok(s.api.walkable(column, row), `Bot entered wall at ${column},${row}`)
        // Check an 8x8 footprint, not just the center: no clipping corners.
        for (const dx of [-3.9, 3.9]) for (const dy of [-3.9, 3.9]) {
            assert.ok(s.api.walkable(Math.floor((from.x + dx) / s.size), Math.floor((from.y + dy) / s.size)), 'Bot footprint crossed a wall')
        }
        visited.push([column, row])
    }
    return visited
}

test('training yard fits one screen and has solid cover with connected floor', () => {
    const s = setup(), target = s.sprite(4, 3)
    s.api.refresh(target, 0, true)
    assert.equal(s.width * s.size, 160)
    assert.ok(s.height * s.size <= 120)
    assert.equal(s.api.walkable(3, 2), false)
    assert.equal(s.api.walkable(6, 4), false)
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
        if (s.api.walkable(x, y)) assert.ok(s.api.reachable(x, y), `Disconnected floor ${x},${y}`)
    }
})

for (const [name, fromCell, targetCell] of [
    ['left barrier', [1, 3], [4, 3]], ['left barrier reversed', [4, 3], [1, 3]],
    ['right barrier', [8, 4], [5, 4]], ['right barrier reversed', [5, 4], [8, 4]],
    ['both barriers', [1, 2], [8, 4]]
]) test(`bots route around ${name} without cutting corners`, () => {
    const s = setup(), from = s.sprite(...fromCell), target = s.sprite(...targetCell)
    const visited = pursue(s, from, target)
    assert.ok(Math.hypot(from.x - target.x, from.y - target.y) < 1)
    assert.ok(visited.length > 0)
})

test('pursuit adapts when the player changes cells mid-route', () => {
    const s = setup(), from = s.sprite(1, 3), target = s.sprite(4, 3)
    pursue(s, from, target, 1800, (i, target) => { if (i === 70) target.setPosition(136, 72) })
    assert.ok(Math.hypot(from.x - target.x, from.y - target.y) < 1)
})

test('unreachable goals stop bots, and reopening a passage resumes pursuit', () => {
    const s = setup(), from = s.sprite(1, 3), target = s.sprite(4, 3)
    for (let y = 1; y < 6; y++) s.walls[y * s.width + 2] = true
    s.api.refresh(target, 0, true)
    const bot = new s.api.Bot(from, 20)
    bot.update(target)
    assert.equal(from.vx, 0)
    assert.equal(from.vy, 0)
    assert.equal(s.api.reachable(1, 3), false)
    s.walls[1 * s.width + 2] = false
    pursue(s, from, target)
    assert.ok(Math.hypot(from.x - target.x, from.y - target.y) < 1)
})

test('blocked goals and out-of-map cells are rejected', () => {
    const s = setup(), from = s.sprite(1, 3), target = s.sprite(3, 2)
    s.api.refresh(target, 0, true)
    const bot = new s.api.Bot(from, 20)
    bot.update(target)
    assert.equal(from.vx, 0)
    assert.equal(from.vy, 0)
    assert.equal(s.api.walkable(-1, 3), false)
    assert.equal(s.api.walkable(10, 3), false)
})
