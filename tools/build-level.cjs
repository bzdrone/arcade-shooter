// Authoring helper for the initial arena. Uses PXT's own asset serializer.
// Run deliberately: it overwrites tilemap.g.jres/.ts, including editor-made changes.
const fs = require('node:fs')
const path = require('node:path')
require('../../pxt-arcade/node_modules/pxt-core/built/pxt.js')
const project = new pxt.TilemapProject()
function tile(name, pixels) {
    const bitmap = new pxt.sprite.Bitmap(16, 16)
    pixels.forEach((row, y) => [...row].forEach((pixel, x) => {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) bitmap.set(x * 2 + dx, y * 2 + dy, parseInt(pixel, 16))
    }))
    return project.createNewTile(bitmap.data(), `myTiles.${name}`, name)
}
const transparent = project.getTransparency(16)
const floor = tile('yardFloor', ['cccccccc','cccccccc','cccccccc','cccccccc','cccccccc','cccccccc','cccccccc','fccccccc'])
const border = tile('yardWall', ['bbbbbbbb','b111111b','bccccccb','bccccccb','bccccccb','bccccccb','bffffffb','bbbbbbbb'])
const cover = tile('yardCover', ['44444444','4eeeeee4','4e4444e4','4e4ee4e4','4e4ee4e4','4e4444e4','4eeeeee4','eeeeeeee'])
const lane = tile('yardLane', ['cccccccc','cccccccc','cccccccc','cccccccc','cccccccc','cccccccc','cccccccc','fcccbccc'])
const tileset = { tileWidth: 16, tiles: [transparent, floor, border, cover, lane] }
const map = new pxt.sprite.Tilemap(10, 7)
const walls = new pxt.sprite.Bitmap(10, 7)
for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 10; x++) {
        const perimeter = y === 0 || y === 6 || x === 0 || x === 9
        const obstacle = x === 3 && y >= 2 && y <= 3
            || x === 6 && y >= 3 && y <= 4
        map.set(x, y, perimeter ? 2 : obstacle ? 3 : x === 4 || x === 5 ? 4 : 1)
        if (perimeter || obstacle) walls.set(x, y, 2)
    }
}
project.createNewTilemapFromData(new pxt.sprite.TilemapData(map, tileset, walls.data()), 'trainingYard')
const jres = project.getProjectTilesetJRes()
const root = path.resolve(__dirname, '..')
fs.writeFileSync(path.join(root, 'tilemap.g.jres'), JSON.stringify(jres, null, 4) + '\n')
// Normalize resource IDs as the compiler does before generating asset declarations.
const expanded = {}
for (const [key, value] of Object.entries(jres)) {
    if (key === '*') continue
    const id = value.mimeType === pxt.TILEMAP_MIME_TYPE || key.includes('.') ? key : `myTiles.${key}`
    expanded[id] = { ...value, id }
}
fs.writeFileSync(path.join(root, 'tilemap.g.ts'), pxt.emitTilemapsFromJRes(expanded))
console.log('Generated trainingYard: 10x7, 16px tiles, two staggered cover barriers')
