// Read a MakeCode Arcade project PNG: decode the PNG pixels, extract the blob that
// MakeCode hides in the low bits (pxtlib/util.ts encodeBlobAsync), decompress it
// and return the project files. Works in browsers and Node 18+ without libraries.
import { lzmaDecompress } from './lzma.js'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const BLOB_MAGIC = 0x59347a7d
const BLOB_HEADER_SIZE = 36

async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0

/** Decode an 8-bit RGB or RGBA, non-interlaced PNG to RGBA pixels. */
export async function decodePng(bytes) {
    if (!PNG_SIGNATURE.every((v, i) => bytes[i] === v)) throw new Error('This file is not a PNG image.')
    let pos = 8, width = 0, height = 0, colorType = -1, depth = 0, interlace = 0
    const idat = []
    while (pos + 8 <= bytes.length) {
        const length = u32(bytes, pos)
        const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
        const data = bytes.subarray(pos + 8, pos + 8 + length)
        if (type === 'IHDR') {
            width = u32(data, 0); height = u32(data, 4); depth = data[8]; colorType = data[9]; interlace = data[12]
        } else if (type === 'IDAT') idat.push(data)
        else if (type === 'IEND') break
        pos += 12 + length
    }
    if (depth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0)
        throw new Error('This PNG was not saved by MakeCode (unexpected image format).')
    const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0))
    let offset = 0
    for (const d of idat) { joined.set(d, offset); offset += d.length }
    const raw = await inflate(joined)
    const bpp = colorType === 6 ? 4 : 3, stride = width * bpp
    const pixels = new Uint8Array(width * height * 4)
    let prev = new Uint8Array(stride)
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)]
        const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1))
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0
            let v = line[i]
            if (filter === 1) v += a
            else if (filter === 2) v += b
            else if (filter === 3) v += (a + b) >> 1
            else if (filter === 4) {
                const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
            }
            line[i] = v & 255
        }
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4
            for (let k = 0; k < bpp; k++) pixels[o + k] = line[x * bpp + k]
            if (bpp === 3) pixels[o + 3] = 255
        }
        prev = line
    }
    return { width, height, pixels }
}

/** The inverse of pxtlib's encodeBlobAsync. */
export function extractBlob({ width, height, pixels: d }) {
    const bpp = (d[0] & 1) | ((d[1] & 1) << 1) | ((d[2] & 1) << 2)
    if (bpp === 0 || bpp > 5) throw new Error('No MakeCode project found in this PNG. Save it from the Arcade editor (the project download, not a screenshot).')
    function decode(ptr, bits, target) {
        let shift = 0, i = 0, acc = 0
        const mask = (1 << bits) - 1
        while (i < target.length) {
            acc |= (d[ptr++] & mask) << shift
            if ((ptr & 3) === 3) ptr++
            shift += bits
            if (shift >= 8) { target[i++] = acc & 0xff; acc >>= 8; shift -= 8 }
        }
        return ptr
    }
    const header = new Uint8Array(BLOB_HEADER_SIZE)
    const ptr = decode(4, bpp, header)
    const word = i => (header[i] | (header[i + 1] << 8) | (header[i + 2] << 16) | (header[i + 3] << 24)) >>> 0
    if (word(0) !== BLOB_MAGIC) throw new Error('No MakeCode project found in this PNG. Save it from the Arcade editor (the project download, not a screenshot).')
    const result = new Uint8Array(word(4))
    const addedLines = word(8)
    if (addedLines > 0) {
        const originalSize = (height - addedLines) * width
        const capacity = ((originalSize - 1) * 3 * bpp) >> 3
        const first = new Uint8Array(capacity - BLOB_HEADER_SIZE)
        decode(ptr, bpp, first)
        result.set(first)
        const rest = new Uint8Array(result.length - first.length)
        decode(originalSize * 4, 8, rest)
        result.set(rest, first.length)
    } else decode(ptr, bpp, result)
    return result
}

/**
 * Text as LZMA-JS (used by MakeCode) encodes it: UTF-8 per UTF-16 code unit, so
 * surrogate halves are separate 3-byte sequences and NUL is C0 80.
 */
export function decodeLzmaJsText(bytes) {
    const units = []
    let out = ''
    for (let i = 0; i < bytes.length;) {
        const b = bytes[i]
        if (b < 0x80) { units.push(b); i++ }
        else if ((b & 0xE0) === 0xC0) { units.push(((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F)); i += 2 }
        else if ((b & 0xF0) === 0xE0) { units.push(((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)); i += 3 }
        else {
            const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F)
            units.push(0xD800 + ((cp - 0x10000) >> 10), 0xDC00 + ((cp - 0x10000) & 0x3FF))
            i += 4
        }
        if (units.length >= 8192) { out += String.fromCharCode(...units); units.length = 0 }
    }
    return out + String.fromCharCode(...units)
}

/** Project files and metadata from the bytes of an exported project PNG. */
export async function readProjectPng(bytes) {
    const blob = extractBlob(await decodePng(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)))
    const json = blob[0] === 0x7b ? new TextDecoder().decode(blob) : decodeLzmaJsText(lzmaDecompress(blob))
    const container = JSON.parse(json)
    const files = JSON.parse(container.source)
    if (!files['pxt.json'] || !files['main.ts']) throw new Error('This PNG holds a MakeCode project without main.ts.')
    return { meta: container.meta || {}, files }
}

// ---- Tilemaps and tile images ----

function base64Bytes(text) {
    const binary = atob(text)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
}

function hexBytes(text) {
    const out = new Uint8Array(text.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(text.substr(i * 2, 2), 16)
    return out
}

/** Decode a MakeCode 4-bit image (image/x-mkcd-f4) to palette indices, row-major. */
export function decodeImage(bytes) {
    if (bytes[0] !== 0x87 || bytes[1] !== 4) return null
    const width = bytes[2] | (bytes[3] << 8), height = bytes[4] | (bytes[5] << 8)
    const column = ((height * 4 + 31) >> 5) * 4
    const pixels = new Uint8Array(width * height)
    for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++) {
            const byte = bytes[8 + x * column + (y >> 1)]
            pixels[y * width + x] = y & 1 ? byte >> 4 : byte & 15
        }
    return { width, height, pixels }
}

/** Every tilemap in the project's .jres resources, keyed by display name and id. */
export function readTilemaps(files) {
    const maps = new Map()
    for (const [name, text] of Object.entries(files)) {
        if (!name.endsWith('.jres')) continue
        const jres = JSON.parse(text)
        const defaults = jres['*'] || {}
        const tileImages = {}
        for (const [key, entry] of Object.entries(jres)) {
            if (key === '*' || (entry.mimeType || defaults.mimeType) !== 'image/x-mkcd-f4' || !entry.tilemapTile) continue
            const id = `${entry.namespace || defaults.namespace || 'myTiles'}.${key}`
            tileImages[id] = decodeImage(base64Bytes(entry.data))
        }
        for (const [key, entry] of Object.entries(jres)) {
            if (key === '*' || entry.mimeType !== 'application/mkcd-tilemap') continue
            const bytes = hexBytes(new TextDecoder().decode(base64Bytes(entry.data)))
            const tileSize = bytes[0], width = bytes[1] | (bytes[2] << 8), height = bytes[3] | (bytes[4] << 8)
            const indices = bytes.slice(5, 5 + width * height)
            const wallBytes = bytes.subarray(5 + width * height)
            const walls = Array.from({ length: width * height }, (_, i) => !!((wallBytes[i >> 1] >> ((i % 2) * 4)) & 15))
            const map = { id: entry.id || key, name: entry.displayName || key, tileSize, width, height, indices, walls,
                tileset: entry.tileset || [], tileImages }
            maps.set(map.name, map)
            maps.set(map.id, map)
        }
    }
    return maps
}

/** MakeCode Arcade's default palette, index 0 transparent. */
export const ARCADE_PALETTE = ['#000000', '#ffffff', '#ff2121', '#ff93c4', '#ff8135', '#fff609', '#249ca3', '#78dc52',
    '#003fad', '#87f2ff', '#8e2ec4', '#a4839f', '#5c406c', '#e5cdc4', '#91463d', '#000000']
