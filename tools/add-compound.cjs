// Adds the sample compound without changing existing maps or artwork.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
require('../../pxt-arcade/node_modules/pxt-core/built/pxt.js')
const root = path.resolve(__dirname, '..')
const resourcePath = path.join(root, 'tilemap.g.jres')
const jres = JSON.parse(fs.readFileSync(resourcePath, 'utf8'))
assert.ok(!Object.values(jres).some(a => a.displayName === 'combatCompound'), 'combatCompound already exists; do not overwrite editor changes')
const project = new pxt.TilemapProject()
project.loadTilemapJRes(jres)
const width = 25, height = 19
const map = new pxt.sprite.Tilemap(width, height)
const walls = new pxt.sprite.Bitmap(width, height)
const names = ['transparency16', 'yardFloor', 'yardWall', 'yardCover', 'yardLane', 'blueSpawn', 'redSpawn']
const tileset = { tileWidth: 16, tiles: names.map(name => project.resolveTile('myTiles.' + name)) }
assert.ok(tileset.tiles.every(Boolean))
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const perimeter = x === 0 || y === 0 || x === width - 1 || y === height - 1
    const roomSide = (x === 7 || x === 17) && y >= 2 && y <= 16 && ![4, 9, 14].includes(y)
    const roomDivider = (y === 6 || y === 12) && ((x >= 2 && x <= 7 && x !== 4) || (x >= 17 && x <= 22 && x !== 20))
    const courtEnd = (y === 3 || y === 15) && x >= 8 && x <= 16 && !(x >= 11 && x <= 13)
    const cover = (x === 10 && (y === 6 || y === 7)) || (x === 14 && (y === 11 || y === 12))
        || (y === 8 && (x === 12 || x === 13)) || (y === 10 && (x === 11 || x === 12))
        || (x === 3 && (y === 8 || y === 9)) || (x === 21 && (y === 9 || y === 10))
    const wall = perimeter || roomSide || roomDivider || courtEnd
    map.set(x, y, wall ? 2 : cover ? 3 : (x >= 11 && x <= 13) || y === 9 ? 4 : 1)
    if (wall || cover) walls.set(x, y, 2)
}
for (const [x, y] of [[3, 3], [3, 15], [5, 9]]) map.set(x, y, 5)
for (const [x, y] of [[21, 3], [21, 15], [19, 9]]) map.set(x, y, 6)
const [id] = project.createNewTilemapFromData(new pxt.sprite.TilemapData(map, tileset, walls.data()), 'combatCompound')
const generated = project.getProjectTilesetJRes()
const asset = generated[id]
assert.ok(asset, 'Serialized compound resource exists')
// Keep every original resource verbatim, rather than reserializing their values.
jres[id] = asset
fs.writeFileSync(resourcePath, JSON.stringify(jres, null, 4) + '\n')
const expanded = {}
for (const [key, value] of Object.entries(jres)) {
    if (key === '*') continue
    const id = value.mimeType === pxt.TILEMAP_MIME_TYPE || key.includes('.') ? key : `myTiles.${key}`
    expanded[id] = { ...value, id }
}
fs.writeFileSync(path.join(root, 'tilemap.g.ts'), pxt.emitTilemapsFromJRes(expanded))
console.log('Added combatCompound: 25x19, rooms, courtyard, flanking routes, three spawns per team')
