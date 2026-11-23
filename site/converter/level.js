// Arcade tilemap -> Battlefield 6 Portal map edits (.spatial.json) on MP_Portal_Sand.
//
// One Arcade tile becomes a TILE_METRES square. Wall-marked tiles become tall
// stone blocks; wall-marked tiles whose image is a cover tile become chest-high
// blocks; blue and red spawn tiles become team HQ spawn points plus bot spawners.
// Format follows the SDK exporter (code/gdconverter): world positions, and
// right/up/front are the Godot basis columns, whose lengths carry the scale.
import { SAND_HEIGHTS } from './sand-heights.js'

export const LEVEL = 'MP_Portal_Sand'
export const TILE_METRES = 4
export const PHYSICS_BUDGET = 100000
/** Bots per team; portal-runtime.ts's teamSize must not exceed it. */
export const BOTS_PER_TEAM = 2
/** AI_Spawner ObjId for bot `index` (from 0) of team 1 or 2: 111, 112, 121, 122. Matches portal-runtime.ts. */
export function botSpawnerId(team, index) { return 100 + team * 10 + index + 1 }

// Measured with the SDK's Godot project (mesh bounds at scale 1, origin at the bottom centre).
const WALL = { type: 'BarrierStoneBlock_01_C', size: [1.465, 3.605, 1.402], physicsCost: 2 }
const COVER = { type: 'BarrierStoneBlock_01_A', size: [1.28, 1.2, 1.28], physicsCost: 2 }
const WALL_SCALE = 2.8          // about 4.1 x 10 x 3.9 m: one block fills a tile
const WALL_SINK = 0.5           // metres below the lowest ground point under the tile
const COVER_GRID = 3            // 3 x 3 blocks per cover tile
const COVER_SCALE = 1.1         // each about 1.4 m wide and 1.3 m high: chest-high cover
const COMBAT_MARGIN = 6         // metres of combat area around the map

const SAND_STATIC = [`${LEVEL}_Terrain`, `${LEVEL}_Assets`].map(name => ({
    name, type: name, right: vec(1, 0, 0), up: vec(0, 1, 0), front: vec(0, 0, 1), position: vec(0, 0, 0)
}))

function round(v) { return Math.round(v * 10000) / 10000 || 0 }
function vec(x, y, z) { return { x: round(x), y: round(y), z: round(z) } }

/** Ground height at world x, z (bilinear over the sampled grid). */
export function groundHeight(x, z) {
    const { origin, step, count, heights } = SAND_HEIGHTS
    const fx = Math.min(Math.max((x - origin) / step, 0), count - 1.0001)
    const fz = Math.min(Math.max((z - origin) / step, 0), count - 1.0001)
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz
    const h = (i, j) => heights[j * count + i]
    return (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) + (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz
}

function scaled(s) { return { right: vec(s, 0, 0), up: vec(0, s, 0), front: vec(0, 0, s) } }

/** Facing for an object at (x, z) that should look towards (tx, tz). */
function facing(x, z, tx, tz, fallbackX) {
    let fx = tx - x, fz = tz - z
    const length = Math.hypot(fx, fz)
    if (length < 0.01) { fx = fallbackX; fz = 0 } else { fx /= length; fz /= length }
    return { right: vec(fz, 0, -fx), up: vec(0, 1, 0), front: vec(fx, 0, fz) }
}

/** Classify every cell of an Arcade tilemap. */
export function classifyTiles(map) {
    const cells = []
    const warnings = []
    for (let row = 0; row < map.height; row++)
        for (let column = 0; column < map.width; column++) {
            const i = row * map.width + column
            const tile = map.tileset[map.indices[i]] || ''
            const short = tile.split('.').pop().toLowerCase()
            const spawn = /bluespawn/.test(short) ? 1 : /redspawn/.test(short) ? 2 : 0
            let role = 'floor'
            if (map.walls[i]) {
                role = /cover/.test(short) ? 'cover' : 'wall'
                if (spawn) warnings.push(`The ${spawn === 1 ? 'blue' : 'red'} spawn tile at column ${column}, row ${row} is marked as a wall, so it is built as a wall.`)
            } else if (spawn) role = spawn === 1 ? 'blueSpawn' : 'redSpawn'
            cells.push({ column, row, tile, role })
        }
    return { cells, warnings }
}

/**
 * Build Portal map edits from a tilemap read by readTilemaps().
 * Returns { spatial, cells, report } where report lists counts, size and warnings.
 */
export function buildLevel(map) {
    const errors = [], warnings = []
    const widthM = map.width * TILE_METRES, depthM = map.height * TILE_METRES
    const limit = 2 * Math.abs(SAND_HEIGHTS.origin)
    if (widthM > limit || depthM > limit)
        errors.push(`The tilemap is ${map.width} x ${map.height} tiles; the converter supports up to ${limit / TILE_METRES} x ${limit / TILE_METRES}.`)
    const { cells, warnings: tileWarnings } = classifyTiles(map)
    warnings.push(...tileWarnings)
    const centre = cell => ({ x: (cell.column + 0.5) * TILE_METRES - widthM / 2, z: (cell.row + 0.5) * TILE_METRES - depthM / 2 })
    const spawns = { 1: cells.filter(c => c.role === 'blueSpawn'), 2: cells.filter(c => c.role === 'redSpawn') }
    for (const team of [1, 2]) {
        const name = team === 1 ? 'blue' : 'red'
        if (spawns[team].length === 0) errors.push(`The map has no ${name} spawn tile. Paint at least two ${name} spawn tiles in Arcade.`)
        else if (spawns[team].length < 2) warnings.push(`The map has only one ${name} spawn tile; Arcade needs two.`)
    }
    if (errors.length) return { spatial: null, cells, report: { errors, warnings } }

    const objects = []
    let physicsCost = 0, walls = 0, coverTiles = 0
    for (const cell of cells) {
        const { x, z } = centre(cell)
        const half = TILE_METRES / 2
        if (cell.role === 'wall') {
            const ground = Math.min(groundHeight(x, z), groundHeight(x - half, z - half), groundHeight(x + half, z - half),
                groundHeight(x - half, z + half), groundHeight(x + half, z + half))
            objects.push({ name: WALL.type, type: WALL.type, ...scaled(WALL_SCALE), position: vec(x, ground - WALL_SINK, z),
                id: `ArcadeWall_${cell.column}_${cell.row}` })
            physicsCost += WALL.physicsCost
            walls++
        } else if (cell.role === 'cover') {
            const spacing = TILE_METRES / COVER_GRID
            for (let i = 0; i < COVER_GRID; i++)
                for (let j = 0; j < COVER_GRID; j++) {
                    const bx = x + (i - (COVER_GRID - 1) / 2) * spacing, bz = z + (j - (COVER_GRID - 1) / 2) * spacing
                    const ground = Math.min(groundHeight(bx - spacing / 2, bz - spacing / 2), groundHeight(bx + spacing / 2, bz + spacing / 2),
                        groundHeight(bx - spacing / 2, bz + spacing / 2), groundHeight(bx + spacing / 2, bz - spacing / 2))
                    objects.push({ name: COVER.type, type: COVER.type, ...scaled(COVER_SCALE), position: vec(bx, ground - 0.1, bz),
                        id: `ArcadeCover_${cell.column}_${cell.row}_${i * COVER_GRID + j}` })
                    physicsCost += COVER.physicsCost
                }
            coverTiles++
        }
    }

    for (const team of [1, 2]) {
        const points = spawns[team].map(centre)
        const hqX = points.reduce((s, p) => s + p.x, 0) / points.length
        const hqZ = points.reduce((s, p) => s + p.z, 0) / points.length
        const hqId = `TEAM_${team}_HQ`
        const spawnPoints = points.map((p, n) => ({ name: `SpawnPoint_${team}_${n + 1}`, type: 'SpawnPoint',
            ...facing(p.x, p.z, 0, 0, team === 1 ? 1 : -1), position: vec(p.x, groundHeight(p.x, p.z), p.z), id: `${hqId}/SpawnPoint_${team}_${n + 1}` }))
        objects.push({ name: hqId, Team: `Team${team}`, AltTeam: 'TeamNeutral', ObjId: team, InfantrySpawns: spawnPoints.map(s => s.id),
            type: 'HQ_PlayerSpawner', ...scaled(1), position: vec(hqX, groundHeight(hqX, hqZ), hqZ), id: hqId, linked: ['InfantrySpawns'] })
        objects.push(...spawnPoints)

        // One AI spawner per bot, as in the SDK examples; bot n uses the team's n-th spawn tile.
        for (let n = 0; n < BOTS_PER_TEAM; n++) {
            const p = points[n % points.length]
            const id = `ArcadeBot_Team${team}_${n + 1}`
            objects.push({ name: id, ObjId: botSpawnerId(team, n), type: 'AI_Spawner', ...facing(p.x, p.z, 0, 0, team === 1 ? 1 : -1),
                position: vec(p.x, groundHeight(p.x, p.z), p.z), id })
        }
    }

    let lowest = Infinity, highest = -Infinity
    for (let x = -widthM / 2 - COMBAT_MARGIN; x <= widthM / 2 + COMBAT_MARGIN; x += 2)
        for (let z = -depthM / 2 - COMBAT_MARGIN; z <= depthM / 2 + COMBAT_MARGIN; z += 2) {
            const h = groundHeight(x, z); lowest = Math.min(lowest, h); highest = Math.max(highest, h)
        }
    const ax = widthM / 2 + COMBAT_MARGIN, az = depthM / 2 + COMBAT_MARGIN
    objects.push({ name: 'CombatArea', CombatVolume: 'CombatArea/CombatVolume', type: 'CombatArea', ...scaled(1), position: vec(0, 0, 0),
        id: 'CombatArea', linked: ['CombatVolume'] })
    objects.push({ name: 'CombatVolume', type: 'PolygonVolume', id: 'CombatArea/CombatVolume', height: 100,
        points: [vec(-ax, lowest - 5, -az), vec(-ax, lowest - 5, az), vec(ax, lowest - 5, az), vec(ax, lowest - 5, -az)] })
    // The SDK importer treats point y as the volume's bottom, its exporter as the centre;
    // starting 5 m below the ground with 100 m height contains the ground either way.
    // Deploy screen camera above the map, looking down (orientation as in the SDK's Sand level).
    objects.push({ name: 'DeployCam', type: 'DeployCam', right: vec(1, 0, 0), up: vec(0, 0.101056, -0.994881), front: vec(0, 0.994881, 0.101056),
        position: vec(0, highest + Math.max(60, 1.6 * Math.max(widthM, depthM)), 0), id: 'DeployCam', ObjId: 0 })

    if (physicsCost > PHYSICS_BUDGET) errors.push(`The map needs ${physicsCost} physics budget; ${LEVEL} allows ${PHYSICS_BUDGET}. Use fewer wall tiles.`)
    return {
        spatial: { Portal_Dynamic: objects, Static: SAND_STATIC },
        cells,
        report: { errors, warnings, level: LEVEL, tileMetres: TILE_METRES, widthM, depthM, walls, coverTiles,
            blueSpawns: spawns[1].length, redSpawns: spawns[2].length, objects: objects.length, physicsCost }
    }
}
