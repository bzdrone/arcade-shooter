// Convert an exported Arcade project PNG to Battlefield 6 Portal files, using the
// same code as the converter web page (site/converter).
//
//   node tools/convert-portal.mjs <project.png> [output-folder]
//
// Writes <name>.spatial.json, <name>.ts and <name>.strings.json (default folder:
// local/portal/) and prints the conversion report.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertPng } from '../site/converter/convert.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [input, outDir = path.join(root, 'local/portal')] = process.argv.slice(2)
if (!input) {
    console.error('Usage: node tools/convert-portal.mjs <project.png> [output-folder]')
    process.exit(2)
}
const runtime = fs.readFileSync(path.join(root, 'site/converter/portal-runtime.ts'), 'utf8')
const result = await convertPng(fs.readFileSync(input), runtime)
const { report } = result
for (const e of report.errors) console.error(`ERROR: ${e}`)
for (const w of report.warnings) console.warn(`WARNING: ${w}`)
if (!result.files) process.exit(1)
fs.mkdirSync(outDir, { recursive: true })
for (const [name, text] of Object.entries(result.files)) {
    fs.writeFileSync(path.join(outDir, name), text)
    console.log(`WROTE: ${path.join(outDir, name)}`)
}
const l = report.level
console.log(`Map: ${l.widthM} x ${l.depthM} m on ${l.level}, ${l.walls} wall tiles, ${l.coverTiles} cover tiles, ` +
    `${l.blueSpawns}+${l.redSpawns} spawns, ${l.objects} objects, physics ${l.physicsCost}`)
console.log(`Mode: ${report.rules.mode}; handlers: ${report.rules.handlers.map(h => `${h.event} (${h.from})`).join(', ') || 'none'}`)
for (const m of report.rules.mapped) console.log(`Setting: ${m}`)
