// Package only the browser-facing files; no Arcade toolchain is needed.
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.join(root, 'site')
const output = path.join(root, 'local/site')

async function copy(relative) {
    const from = path.join(source, relative)
    const to = path.join(output, relative)
    await mkdir(path.dirname(to), { recursive: true })
    await copyFile(from, to)
}

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
for (const file of ['index.html', 'app.js', 'style.css']) await copy(file)
for (const entry of await readdir(path.join(source, 'converter'), { withFileTypes: true })) {
    if (!entry.isFile() || !(entry.name.endsWith('.js') || entry.name === 'portal-runtime.ts')) {
        throw new Error(`Unexpected converter entry: ${entry.name}; review before publishing.`)
    }
    await copy(`converter/${entry.name}`)
}
await writeFile(path.join(output, '.nojekyll'), '')
console.log(`Static site built: ${output}`)
