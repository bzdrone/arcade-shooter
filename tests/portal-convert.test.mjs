// Host tests for the Arcade to Portal converter (site/converter).
//   node --test tests/portal-convert.test.mjs
// Builds its own project PNGs from the repository files, so no export is needed.
// With PORTAL_SDK set, also type-checks the generated scripts against the SDK.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { lzmaDecompress } from '../site/converter/lzma.js'
import { readProjectPng, readTilemaps, decodeLzmaJsText } from '../site/converter/project.js'
import { buildLevel, TILE_METRES } from '../site/converter/level.js'
import { convertProject, convertPng } from '../site/converter/convert.js'
import { parse } from '../site/converter/tsparse.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const runtime = fs.readFileSync(path.join(root, 'site/converter/portal-runtime.ts'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pxt.json'), 'utf8'))
const repoFiles = Object.fromEntries(['pxt.json', ...manifest.files].map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]))
let lzma = null
try { lzma = require('../../pxt-arcade/node_modules/lzma') } catch { /* optional reference compressor */ }

const project = (main, name = 'test') => ({ meta: { name }, files: { ...repoFiles, 'main.ts': main } })
const withMode = mode => repoFiles['main.ts'].replace(/shooter\.Mode\.\w+/, `shooter.Mode.${mode}`)

// ---- A PNG writer and pxtlib's encodeBlobAsync, to build fixtures ----
function crc32(bytes) {
    let c, crc = 0xFFFFFFFF
    for (const b of bytes) { c = (crc ^ b) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c }
    return (crc ^ 0xFFFFFFFF) >>> 0
}
function pngBytes(width, height, rgba) {
    const chunk = (type, data) => {
        const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1')
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])))
        return Buffer.concat([head, data, crc])
    }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
    const raw = Buffer.alloc(height * (width * 4 + 1))
    for (let y = 0; y < height; y++) {
        raw[y * (width * 4 + 1)] = 0
        Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
    }
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function encodeBlobPng(blob, width = 160, height = 120) {
    const header = Buffer.alloc(36); header.writeUInt32LE(0x59347a7d, 0); header.writeUInt32LE(blob.length, 4)
    const usable = (width * height - 1) * 3
    let bpp = 1
    while (bpp < 4 && usable * bpp < (36 + blob.length) * 8) bpp++
    assert.ok(usable * bpp >= (36 + blob.length) * 8, 'fixture image large enough')
    const img = new Uint8Array(width * height * 4).fill(0x80)
    const encode = (ptr, bits, data) => {
        let shift = 0, dp = 0, v = data[dp++]
        const mask = (1 << bits) - 1
        for (let go = true; go;) {
            let b = (v >> shift) & mask
            const left = 8 - shift
            if (left <= bits) {
                if (dp >= data.length) { if (left === 0) break; else go = false }
                v = data[dp++]; b |= (v << left) & mask; shift = bits - left
            } else shift += bits
            img[ptr] = ((img[ptr] & ~mask) | b) & 0xff
            ptr++
            if ((ptr & 3) === 3) img[ptr++] = 0xff
        }
        return ptr
    }
    encode(0, 1, [bpp])
    encode(encode(4, bpp, header), bpp, blob)
    for (let i = 3; i < img.length; i += 4) img[i] = 0xff
    return pngBytes(width, height, img)
}
const container = files => JSON.stringify({ meta: { name: 'Fixture Project', editor: 'blocksprj' }, source: JSON.stringify(files) })

test('LZMA decoder matches the MakeCode compressor', { skip: !lzma && 'sibling pxt-arcade lzma not installed' }, () => {
    const words = ['mod.', 'Player', 'team', ' ', '\n', '{', '}', '(', ')', 'export function ', '0123', 'é', '🙂']
    for (let t = 0; t < 12; t++) {
        let s = ''
        while (s.length < 2000 + t * 9000) s += Math.random() < 0.2 ? String.fromCharCode(Math.floor(Math.random() * 400)) : words[Math.floor(Math.random() * words.length)]
        const compressed = new Uint8Array(lzma.compress(s, 1 + (t % 9)).map(b => b & 255))
        assert.equal(decodeLzmaJsText(lzmaDecompress(compressed)), s)
    }
})

test('reads project files from a MakeCode project PNG (plain and LZMA payloads)', async () => {
    const plain = encodeBlobPng(Buffer.from(container(repoFiles)), 400, 300)
    assert.deepEqual((await readProjectPng(plain)).files, repoFiles)
    if (lzma) {
        const packed = encodeBlobPng(Buffer.from(lzma.compress(container(repoFiles), 9).map(b => b & 255)))
        const read = await readProjectPng(packed)
        assert.deepEqual(read.files, repoFiles)
        assert.equal(read.meta.name, 'Fixture Project')
    }
    await assert.rejects(readProjectPng(pngBytes(4, 4, new Uint8Array(64))), /No MakeCode project/)
    await assert.rejects(readProjectPng(Buffer.from('not a png')), /not a PNG/)
})

test('builds Portal map edits from the training yard', () => {
    const map = readTilemaps(repoFiles).get('trainingYard')
    const { spatial, report } = buildLevel(map)
    assert.deepEqual(report.errors, [])
    assert.equal(report.walls + report.coverTiles, map.walls.filter(Boolean).length, 'every wall-marked tile is built')
    assert.equal(report.coverTiles, 4)
    assert.deepEqual([report.blueSpawns, report.redSpawns], [2, 2])
    const objects = spatial.Portal_Dynamic
    const ids = objects.map(o => o.id)
    assert.equal(new Set(ids).size, ids.length, 'object ids are unique')
    for (const o of objects) for (const link of o.linked || []) {
        const targets = [].concat(o[link])
        assert.ok(targets.length && targets.every(t => ids.includes(t)), `${o.id}.${link} points at existing objects`)
    }
    const hq = team => objects.find(o => o.type === 'HQ_PlayerSpawner' && o.ObjId === team)
    assert.equal(hq(1).Team, 'Team1'); assert.equal(hq(2).Team, 'Team2')
    assert.ok(hq(1).position.x < 0 && hq(2).position.x > 0, 'blue spawns on the left, red on the right, as in Arcade')
    const spawners = objects.filter(o => o.type === 'AI_Spawner')
    assert.deepEqual(spawners.map(o => o.ObjId), [111, 112, 121, 122], 'one AI spawner per bot')
    for (const team of [1, 2]) {
        const spots = objects.filter(o => o.type === 'SpawnPoint' && o.id.startsWith(`TEAM_${team}_HQ/`)).map(o => `${o.position.x},${o.position.z}`)
        const own = spawners.filter(o => Math.floor(o.ObjId / 10) === 10 + team).map(o => `${o.position.x},${o.position.z}`)
        assert.equal(new Set(own).size, own.length, `team ${team} bots spawn on different tiles`)
        assert.ok(own.every(s => spots.includes(s)), `team ${team} bots spawn on their team's spawn tiles`)
    }
    const area = objects.find(o => o.type === 'PolygonVolume' && o.id === 'CombatArea/CombatVolume')
    const maxX = Math.max(...area.points.map(p => p.x)), maxZ = Math.max(...area.points.map(p => p.z))
    for (const o of objects.filter(o => o.position && o.type !== 'DeployCam'))
        assert.ok(Math.abs(o.position.x) < maxX && Math.abs(o.position.z) < maxZ, `${o.id} inside the combat area`)
    for (const o of objects.filter(o => o.type === 'SpawnPoint'))
        assert.ok(Math.abs(Math.hypot(o.front.x, o.front.z) - 1) < 1e-3 && o.right.x * o.front.x + o.right.z * o.front.z === 0, 'spawn facing is a rotation')
    assert.equal(report.widthM, map.width * TILE_METRES)
})

test('compound converts with every mode and keeps its rooms, cover and team spawns', () => {
    const map = readTilemaps(repoFiles).get('combatCompound')
    const { report } = buildLevel(map)
    assert.deepEqual(report.errors, [])
    assert.deepEqual([report.widthM, report.blueSpawns, report.redSpawns], [100, 3, 3])
    assert.equal(report.walls + report.coverTiles, map.walls.filter(Boolean).length)
    assert.equal(report.coverTiles, 12)
    for (const mode of ['Deathmatch', 'GunGame', 'None']) {
        const main = withMode(mode).replace('tilemap`trainingYard`', 'tilemap`combatCompound`')
        const result = convertProject(project(main), runtime)
        assert.deepEqual(result.report.errors, [], mode)
        assert.deepEqual(result.report.warnings, [], mode)
        const spatial = JSON.parse(result.files['test.spatial.json'])
        assert.equal(spatial.Portal_Dynamic.filter(o => o.type === 'SpawnPoint').length, 6)
    }
})

test('reports maps that Portal cannot use', () => {
    const map = readTilemaps(repoFiles).get('trainingYard')
    const noRed = { ...map, indices: map.indices.map(i => map.tileset[i] === 'myTiles.redSpawn' ? 1 : i) }
    assert.match(buildLevel(noRed).report.errors.join(), /no red spawn/)
    const huge = { ...map, width: 60, height: 7, indices: new Uint8Array(420), walls: new Array(420).fill(false) }
    assert.match(buildLevel(huge).report.errors.join(), /supports up to 50/)
})

test('converts the deathmatch and gun game modes', () => {
    for (const mode of ['Deathmatch', 'GunGame']) {
        const r = convertProject(project(withMode(mode)), runtime)
        assert.deepEqual(r.report.errors, [], mode)
        assert.deepEqual(r.report.warnings, [], mode)
        const script = r.files['test.ts']
        assert.match(script, /^import \* as modlib from 'modlib';/m)
        assert.match(script, /export function OnPlayerEarnedKill\(eventPlayer: mod\.Player, eventOtherPlayer: mod\.Player, eventDeathType: mod\.DeathType, eventWeaponUnlock: mod\.WeaponUnlock\)/)
        assert.match(script, /arcade\.EndGameMode\(/, 'player or team wins for the team, as in Arcade')
        assert.doesNotMatch(script, /shooter\./, 'no Arcade engine calls remain')
        const rules = script.slice(script.indexOf(' rules ('))
        assert.doesNotMatch(rules, /mod\.(GetVariable|SetVariable|ObjectVariable|EndGameMode|DisplayGameModeMessage)\(/, 'Arcade-specific calls go to the runtime')
        parse(rules.slice(rules.indexOf('\n'))) // converted rules stay in the supported subset
        for (const event of ['OnGameModeStarted', 'OnPlayerJoinGame', 'OnPlayerLeaveGame', 'OnSpawnerSpawned', 'OnPlayerDeployed', 'OnPlayerDied', 'OnPlayerEarnedKill'])
            assert.match(script, new RegExp(`^export function ${event}\\(`, 'm'), `${event} is exported for the runtime`)
        assert.match(script, /try \{ mod\.RemoveEquipment\(player, slot\) \} catch/, 'clearing an empty slot does not abort a weapon change')
    }
    const gun = convertProject(project(withMode('GunGame')), runtime)
    assert.equal(gun.report.rules.handlers.map(h => h.event).join(), 'OnGameModeStarted,OnPlayerDeployed,OnPlayerEarnedKill')
    assert.equal(JSON.parse(gun.files['test.strings.json']).level, '{}: {} LEVEL {}')
    assert.match(gun.files['test.ts'], /modlib\.ShowEventGameModeMessage\(mod\.Message\(mod\.stringkeys\.level, eventPlayer, weapons\.name\(ladder\[current \+ 1\]\), current \+ 2\)\)/)
    assert.match(gun.files['test.ts'], /const eventWeapon = weapons\.current\(eventPlayer\)\n {4}gungame\.onPlayerEarnedKill1\(eventPlayer, eventOtherPlayer, eventWeapon\)/)
    const none = convertProject(project(withMode('None')), runtime)
    assert.deepEqual(none.report.rules.handlers, [])
    assert.match(none.files['test.ts'], /export function OnPlayerDeployed\(eventPlayer: mod\.Player\): void \{\n {4}arcade\.deployed\(eventPlayer\)\n\}/)
})

test('runtime settings substitution accepts Windows and Unix line endings', () => {
    const main = withMode('None').replace('shooter.setWeapon(1, 750, 80)', 'shooter.setWeapon(2, 300, 80)')
    for (const newline of ['\n', '\r\n']) {
        const result = convertProject(project(main), runtime.replace(/\r?\n/g, newline))
        assert.match(result.files['test.ts'], /damage: 2,/)
        assert.match(result.files['test.ts'], /startWeapon: 1,/)
        assert.doesNotMatch(result.files['test.ts'], /@settings-start|@settings-end/)
    }
})

test('converts creator rules: waits, variables, messages and Arcade-only blocks', () => {
    const main = withMode('None').replace('shooter.setWeapon(1, 750, 80)', 'shooter.setWeapon(2, 300, 80)') + `
function countdown (seconds: number) {
    for (let index = 0; index <= seconds - 1; index++) {
        mod.DisplayNotificationMessage(mod.Message("Starting in " + (seconds - index)))
        mod.Wait(1)
    }
}
mod.OnGameModeStarted(function () {
    countdown(3)
    mod.DisplayGameModeMessage(mod.Message("FIGHT"))
})
mod.OnPlayerEarnedKill(function (eventPlayer, eventOtherPlayer, eventWeapon) {
    mod.SetVariable(mod.ObjectVariable(eventPlayer, 0), mod.GetVariable(mod.ObjectVariable(eventPlayer, 0)) + 1)
    if (mod.GetVariable(mod.ObjectVariable(eventPlayer, 0)) == 3) {
        weapons.give(eventPlayer, weapons.Kind.SMG)
        mod.DisplayNotificationMessage(mod.Message("{} has a streak", eventPlayer), eventPlayer)
    }
    info.changeScoreBy(1)
})
mod.OnPlayerDied(function (eventPlayer, eventOtherPlayer) {
    mod.SetVariable(mod.ObjectVariable(eventPlayer, 0), 0)
})
`
    const r = convertProject(project(main), runtime)
    assert.deepEqual(r.report.errors, [])
    assert.equal(r.report.warnings.length, 1)
    assert.match(r.report.warnings[0], /info\.changeScoreBy is Arcade only/)
    const s = r.files['test.ts']
    assert.match(s, /async function countdown \(seconds: number\)/)
    assert.match(s, /await mod\.Wait\(1\)/)
    assert.match(s, /await countdown\(3\)/)
    assert.match(s, /mod\.Message\(mod\.stringkeys\.startingIn, \(seconds - index\)\)/)
    assert.match(s, /\/\/ Not converted, info\.changeScoreBy is Arcade only: info\.changeScoreBy\(1\)/)
    assert.match(s, /arcade\.SetVariable\(arcade\.ObjectVariable\(eventPlayer, 0\), arcade\.GetVariable/)
    assert.match(s, /damage: 2,/)
    assert.match(s, /startWeapon: 1,/, 'a fast fire interval starts players with the SMG')
    const strings = JSON.parse(r.files['test.strings.json'])
    assert.equal(strings.startingIn, 'Starting in {}')
    assert.equal(strings.hasAStreak, '{} has a streak')
    assert.equal(strings.fight, 'FIGHT')
    for (const key of s.matchAll(/mod\.stringkeys\.(\w+)/g)) assert.ok(key[1] in strings, `string key ${key[1]} exists`)
})

test('explains projects it cannot convert', () => {
    const broken = convertProject(project(withMode('None') + '\nmod.OnPlayerEarnedKill(function (p) {\n    let x = \n})\n'), runtime)
    assert.equal(broken.files, null)
    assert.match(broken.report.errors.join(), /main\.ts: could not read the code/)
    const tooMany = convertProject(project(withMode('None') + '\nmod.OnGameModeStarted(function () {\n    mod.DisplayNotificationMessage(mod.Message("{} {} " + 1 + 2, 3, 4))\n})\n'), runtime)
    assert.match(tooMany.report.errors.join(), /at most three values/)
})

test('generated scripts type-check against the Portal SDK', { skip: !process.env.PORTAL_SDK && 'set PORTAL_SDK to the Portal SDK folder' }, async () => {
    const dir = path.join(root, 'local/portal-convert-test')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const scripts = []
    for (const mode of ['Deathmatch', 'GunGame', 'None']) {
        const r = convertProject(project(withMode(mode), `check-${mode}`), runtime)
        for (const [name, text] of Object.entries(r.files)) fs.writeFileSync(path.join(dir, name), text)
        scripts.push(path.join(dir, `check-${mode.toLowerCase()}.ts`))
    }
    const result = spawnSync(process.execPath, [path.join(root, 'tools/check-portal.cjs'), process.env.PORTAL_SDK, ...scripts], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('converts an exported project PNG end to end', { skip: !fs.existsSync(path.join(root, 'local/exports/arcade-shooter.png')) && 'no local export' }, async () => {
    const r = await convertPng(fs.readFileSync(path.join(root, 'local/exports/arcade-shooter.png')), runtime)
    assert.deepEqual(r.report.errors, [])
    assert.deepEqual(Object.keys(r.files), ['arcade-shooter.spatial.json', 'arcade-shooter.ts', 'arcade-shooter.strings.json'])
})
