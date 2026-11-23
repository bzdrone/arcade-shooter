const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const { stripTypeScriptTypes } = require('node:module')
const fixture = require('./tilemap-fixture.cjs')
const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'pathing.ts'), 'utf8'), { mode: 'transform' })
function setup(name) {
    const level = fixture(name)
    const context = vm.createContext({
        Math: Object.assign(Object.create(Math), { idiv: (a, b) => Math.trunc(a / b) }),
        tiles: level.tiles, game: { currentScene: () => ({ tileMap: level.map }) }
    })
    vm.runInContext(source, context)
    let id = 0
    const sprite = (column, row) => ({ id: id++, x: (column + 0.5) * level.size, y: (row + 0.5) * level.size, vx: 0, vy: 0,
        setPosition(x, y) { this.x = x; this.y = y } })
    const field = new context.pathing.Field()
    const api = { ...context.pathing, refresh: (...args) => field.refresh(...args), reachable: (...args) => field.reachable(...args) }
    return { ...level, api, field, sprite }
}
function pursue(s, from, target, ticks = 1600, moveTarget) {
    const bot = new s.api.Bot(from, 20)
    const visited = []
    for (let i = 0; i < ticks; i++) {
        if (moveTarget) moveTarget(i, target)
        s.api.refresh(target, i * 16, i === 0)
        bot.update(target, s.field)
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

test('compound has connected rooms, courtyard, perimeter and three clear spawns per team', () => {
    const s = setup('combatCompound')
    assert.deepEqual([s.width, s.height, s.size], [25, 19, 16])
    s.api.refresh(s.sprite(3, 3), 0, true)
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
        if (x === 0 || y === 0 || x === s.width - 1 || y === s.height - 1) assert.equal(s.api.walkable(x, y), false)
        else if (s.api.walkable(x, y)) assert.ok(s.api.reachable(x, y), `Disconnected floor ${x},${y}`)
    }
    for (const team of ['blueSpawn', 'redSpawn']) {
        const spawns = s.tiles.getTilesByType('myTiles.' + team)
        assert.equal(spawns.length, 3)
        assert.ok(spawns.every(p => s.api.reachable(p.column, p.row)))
    }
    for (const y of [4, 9, 14]) for (const x of [7, 17]) assert.ok(s.api.walkable(x, y), 'Three courtyard approaches per side')
    assert.equal(s.api.walkable(12, 8), false, 'Courtyard cover is solid')
})

for (const [from, to] of [[[3, 3], [21, 15]], [[21, 3], [3, 15]], [[5, 9], [19, 9]]]) {
    test(`compound navigation ${from} to ${to} respects the soldier footprint`, () => {
        const s = setup('combatCompound'), bot = s.sprite(...from), target = s.sprite(...to)
        pursue(s, bot, target, 4000)
        assert.ok(Math.hypot(bot.x - target.x, bot.y - target.y) < 1)
    })
}

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
    bot.update(target, s.field)
    assert.equal(from.vx, 0)
    assert.equal(from.vy, 0)
    assert.equal(s.api.reachable(1, 3), false)
    s.walls[1 * s.width + 2] = false
    pursue(s, from, target)
    assert.ok(Math.hypot(from.x - target.x, from.y - target.y) < 1)
})

test('target fields stay independent and refresh when a sprite is replaced', () => {
    const s = setup(), left = s.sprite(1, 1), right = s.sprite(8, 5)
    const other = new s.api.Field()
    s.field.refresh(left, 0)
    const goal = s.field.goal, distances = Array.from(s.field.distances)
    other.refresh(right, 0)
    assert.notEqual(other.goal, goal)
    assert.deepEqual(Array.from(s.field.distances), distances)
    left.setPosition(40, 24)
    s.field.refresh(left, 249)
    assert.equal(s.field.goal, goal, 'Same target is throttled')
    s.field.refresh(left, 250)
    assert.equal(s.field.goal, 12)
    const replacement = s.sprite(4, 1)
    s.field.refresh(replacement, 251)
    assert.equal(s.field.goal, 14, 'New sprite bypasses old refresh deadline')
    assert.equal(other.goal, 58, 'Other target remains unchanged')
})

test('cardinal shot corridors respect cover, map edges and projectile width', () => {
    const s = setup(); s.api.loadMap()
    assert.equal(s.api.clearLine(24, 24, 136, 24), true)
    assert.equal(s.api.clearLine(24, 56, 72, 56), false)
    assert.equal(s.api.clearLine(72, 24, 72, 88), true)
    assert.equal(s.api.clearLine(56, 24, 56, 88), false)
    assert.equal(s.api.clearLine(24, 24, 72, 88), false, 'No diagonal shots')
    assert.equal(s.api.clearLine(24, 30, 72, 30), true)
    assert.equal(s.api.clearLine(24, 31, 72, 31), false, 'Bullet edge clips cover')
    assert.equal(s.api.clearLine(24, 24, -8, 24), false)
    assert.equal(s.api.clearLine(24, 24, 24, 24), true)
})

test('blocked goals and out-of-map cells are rejected', () => {
    const s = setup(), from = s.sprite(1, 3), target = s.sprite(3, 2)
    s.api.refresh(target, 0, true)
    const bot = new s.api.Bot(from, 20)
    bot.update(target, s.field)
    assert.equal(from.vx, 0)
    assert.equal(from.vy, 0)
    assert.equal(s.api.walkable(-1, 3), false)
    assert.equal(s.api.walkable(10, 3), false)
})
