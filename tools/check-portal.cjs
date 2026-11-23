// Author-only: type-check Portal scripts against a local Battlefield 6 Portal SDK:
// the examples in portal/ by default, or the given scripts (such as converter
// output). Each script's <name>.strings.json must hold every mod.stringkeys key it
// uses. Uses the TypeScript compiler already installed with the sibling pxt-arcade
// toolchain; adds no dependency. Does not run anything in Portal.
//
//   node tools/check-portal.cjs <path-to-portal-sdk> [script.ts ...]   (or set PORTAL_SDK)
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const sdk = path.resolve(process.argv[2] || process.env.PORTAL_SDK || '')
const types = path.join(sdk, 'code/types/mod/index.d.ts')
if (!process.argv[2] && !process.env.PORTAL_SDK || !fs.existsSync(types)) {
    console.error('Pass the Portal SDK folder (containing code/types/mod/index.d.ts) as an argument or PORTAL_SDK.')
    process.exit(2)
}
const tsc = path.resolve(root, '../pxt-arcade/node_modules/typescript/bin/tsc')
const version = JSON.parse(fs.readFileSync(path.join(sdk, 'sdk.version.json'), 'utf8'))
const given = process.argv.slice(3).map(f => path.resolve(f))
const scripts = given.length ? given : fs.readdirSync(path.join(root, 'portal')).filter(f => f.endsWith('.ts')).map(f => path.join(root, 'portal', f))
fs.mkdirSync(path.join(root, 'local'), { recursive: true })
const dir = fs.mkdtempSync(path.join(root, 'local', 'portal-check-'))
try {
    const config = path.join(dir, 'tsconfig.json')
    fs.writeFileSync(config, JSON.stringify({
        compilerOptions: { target: 'ES2020', module: 'NodeNext', moduleResolution: 'nodenext', strict: true, noEmit: true,
            baseUrl: sdk, paths: { modlib: ['./code/modlib'] }, types: [] },
        files: [types, ...scripts]
    }))
    for (const script of scripts) {
        // Every message key used must exist in the matching strings file.
        const strings = script.replace(/\.ts$/, '.strings.json')
        const keys = fs.existsSync(strings) ? Object.keys(JSON.parse(fs.readFileSync(strings, 'utf8'))) : []
        for (const [, key] of fs.readFileSync(script, 'utf8').matchAll(/mod\.stringkeys\.(\w+)/g))
            if (!keys.includes(key)) { console.error(`${path.basename(script)}: missing string key ${key}`); process.exitCode = 1 }
    }
    const result = spawnSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit' })
    if (result.status !== 0) process.exitCode = 1
    if (!process.exitCode) console.log(`PASS: ${scripts.length} Portal script(s) type-check against Portal SDK ${version.version}; string keys present`)
} finally { fs.rmSync(dir, { recursive: true, force: true }) }
