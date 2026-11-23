// LZMA ("lzma_alone" / .lzma) decoder: the format MakeCode uses to compress
// project source inside an exported project PNG. Follows the reference decoder
// in the LZMA SDK (LzmaSpec.cpp). Uses plain arithmetic instead of 32-bit
// shifts so unsigned values stay exact in JavaScript.

const TOP = 2 ** 24

class RangeDecoder {
    constructor(data, pos) {
        this.data = data
        this.pos = pos
        if (data[this.pos++] !== 0) throw new Error('LZMA: corrupted stream start')
        this.range = 0xFFFFFFFF
        this.code = 0
        for (let i = 0; i < 4; i++) this.code = this.code * 256 + this.next()
        if (this.code === this.range) throw new Error('LZMA: corrupted stream start')
    }
    next() {
        if (this.pos >= this.data.length) throw new Error('LZMA: unexpected end of data')
        return this.data[this.pos++]
    }
    normalize() {
        if (this.range < TOP) {
            this.range *= 256
            this.code = this.code * 256 + this.next()
        }
    }
    bit(probs, i) {
        const p = probs[i]
        const bound = Math.floor(this.range / 2048) * p
        let bit
        if (this.code < bound) {
            this.range = bound
            probs[i] = p + ((2048 - p) >> 5)
            bit = 0
        } else {
            this.range -= bound
            this.code -= bound
            probs[i] = p - (p >> 5)
            bit = 1
        }
        this.normalize()
        return bit
    }
    direct(count) {
        let result = 0
        for (let i = 0; i < count; i++) {
            this.range = Math.floor(this.range / 2)
            let bit = 0
            if (this.code >= this.range) { this.code -= this.range; bit = 1 }
            this.normalize()
            result = result * 2 + bit
        }
        return result
    }
    tree(probs, base, bits) {
        let m = 1
        for (let i = 0; i < bits; i++) m = m * 2 + this.bit(probs, base + m)
        return m - (1 << bits)
    }
    reverseTree(probs, base, bits) {
        let m = 1, symbol = 0
        for (let i = 0; i < bits; i++) {
            const bit = this.bit(probs, base + m)
            m = m * 2 + bit
            symbol |= bit << i
        }
        return symbol
    }
}

function probabilities(count) {
    return new Uint16Array(count).fill(1024)
}

class LengthDecoder {
    constructor() {
        this.choice = probabilities(2)
        this.low = probabilities(16 << 3)
        this.mid = probabilities(16 << 3)
        this.high = probabilities(256)
    }
    decode(rc, posState) {
        if (rc.bit(this.choice, 0) === 0) return rc.tree(this.low, posState << 3, 3)
        if (rc.bit(this.choice, 1) === 0) return 8 + rc.tree(this.mid, posState << 3, 3)
        return 16 + rc.tree(this.high, 0, 8)
    }
}

/** Decompress an lzma_alone stream (13-byte header). Returns the bytes. */
export function lzmaDecompress(input) {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input)
    if (data.length < 13) throw new Error('LZMA: header too short')
    let props = data[0]
    if (props >= 9 * 5 * 5) throw new Error('LZMA: bad properties')
    const lc = props % 9; props = Math.floor(props / 9)
    const lp = props % 5
    const pb = Math.floor(props / 5)
    let dictSize = 0
    for (let i = 0; i < 4; i++) dictSize += data[1 + i] * 2 ** (8 * i)
    dictSize = Math.max(dictSize, 4096)
    let unknownSize = true, size = 0
    for (let i = 0; i < 8; i++) {
        if (data[5 + i] !== 0xFF) unknownSize = false
        size += data[5 + i] * 2 ** (8 * i)
    }
    if (!unknownSize && size > 512 * 1024 * 1024) throw new Error('LZMA: output too large')

    const rc = new RangeDecoder(data, 13)
    let out = new Uint8Array(unknownSize ? 1 << 16 : size)
    let total = 0
    const put = b => {
        if (total === out.length) { const bigger = new Uint8Array(out.length * 2); bigger.set(out); out = bigger }
        out[total++] = b
    }

    const literal = probabilities(0x300 << (lc + lp))
    const posSlot = probabilities(4 << 6)
    const posDecoders = probabilities(1 + 114)
    const align = probabilities(16)
    const isMatch = probabilities(12 << 4)
    const isRep = probabilities(12)
    const isRepG0 = probabilities(12)
    const isRepG1 = probabilities(12)
    const isRepG2 = probabilities(12)
    const isRep0Long = probabilities(12 << 4)
    const lengths = new LengthDecoder()
    const repLengths = new LengthDecoder()
    const pbMask = (1 << pb) - 1, lpMask = (1 << lp) - 1

    let state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0
    for (;;) {
        if (!unknownSize && total === size) break
        const posState = total & pbMask
        if (rc.bit(isMatch, (state << 4) + posState) === 0) {
            const prev = total > 0 ? out[total - 1] : 0
            const base = 0x300 * (((total & lpMask) << lc) + (prev >> (8 - lc)))
            let symbol = 1
            if (state >= 7) {
                let matchByte = out[total - rep0 - 1]
                do {
                    const matchBit = (matchByte >> 7) & 1
                    matchByte <<= 1
                    const bit = rc.bit(literal, base + ((1 + matchBit) << 8) + symbol)
                    symbol = (symbol << 1) | bit
                    if (matchBit !== bit) break
                } while (symbol < 0x100)
            }
            while (symbol < 0x100) symbol = (symbol << 1) | rc.bit(literal, base + symbol)
            put(symbol - 0x100)
            state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6
            continue
        }
        let len
        if (rc.bit(isRep, state) !== 0) {
            if (total === 0) throw new Error('LZMA: corrupted stream')
            if (rc.bit(isRepG0, state) === 0) {
                if (rc.bit(isRep0Long, (state << 4) + posState) === 0) {
                    state = state < 7 ? 9 : 11
                    put(out[total - rep0 - 1])
                    continue
                }
            } else {
                let dist
                if (rc.bit(isRepG1, state) === 0) dist = rep1
                else {
                    if (rc.bit(isRepG2, state) === 0) dist = rep2
                    else { dist = rep3; rep3 = rep2 }
                    rep2 = rep1
                }
                rep1 = rep0
                rep0 = dist
            }
            len = repLengths.decode(rc, posState)
            state = state < 7 ? 8 : 11
        } else {
            rep3 = rep2; rep2 = rep1; rep1 = rep0
            len = lengths.decode(rc, posState)
            state = state < 7 ? 7 : 10
            const slot = rc.tree(posSlot, Math.min(len, 3) << 6, 6)
            if (slot < 4) rep0 = slot
            else {
                const directBits = (slot >> 1) - 1
                let dist = (2 | (slot & 1)) * 2 ** directBits
                if (slot < 14) dist += rc.reverseTree(posDecoders, dist - slot, directBits)
                else dist += rc.direct(directBits - 4) * 16 + rc.reverseTree(align, 0, 4)
                rep0 = dist
            }
            if (rep0 === 0xFFFFFFFF) break // end marker
            if (rep0 >= total || rep0 >= dictSize) throw new Error('LZMA: bad match distance')
        }
        len += 2
        if (!unknownSize && len > size - total) throw new Error('LZMA: data past declared size')
        for (let i = 0; i < len; i++) put(out[total - rep0 - 1])
    }
    return out.subarray(0, total)
}
