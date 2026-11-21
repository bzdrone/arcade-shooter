// Decode the committed PXT resource without requiring the Arcade toolchain.
const fs = require('node:fs')
const path = require('node:path')
module.exports = function levelFixture() {
    const jres = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tilemap.g.jres'), 'utf8'))
    const asset = Object.values(jres).find(entry => entry.mimeType === 'application/mkcd-tilemap')
    const bytes = Buffer.from(Buffer.from(asset.data, 'base64').toString(), 'hex')
    const size = bytes[0], width = bytes.readUInt16LE(1), height = bytes.readUInt16LE(3)
    const wallBytes = bytes.subarray(5 + width * height)
    const walls = Array.from({ length: width * height }, (_, i) => !!((wallBytes[i >> 1] >> (i % 2 * 4)) & 15))
    return { size, width, height, walls,
        map: { data: { width, height }, scale: Math.log2(size) },
        tiles: {
            getTileLocation: (column, row) => ({ column, row }),
            tileAtLocationIsWall: ({ column, row }) => walls[row * width + column],
            placeOnTile: (sprite, { column, row }) => sprite.setPosition((column + 0.5) * size, (row + 0.5) * size),
            setCurrentTilemap() {}
        }
    }
}
