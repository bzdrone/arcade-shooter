// Stage the previously verified PNG and separate handouts. No dependencies,
// installs, network access, Git changes, tagging, or publication.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const version = process.argv[2] || 'v0.1.0-preview.1'
assert.match(version, /^v\d+\.\d+\.\d+-preview\.\d+$/, 'Expected a preview version, e.g. v0.1.0-preview.1')
const read = name => fs.readFileSync(path.join(root, name))
const json = name => JSON.parse(read(name).toString('utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 })
const normalize = text => text.replace(/\r\n/g, '\n')

const candidate = json(`releases/${version}.json`)
assert.equal(candidate.version, version)
const gameCommit = git(['rev-parse', '--verify', `${candidate.gameSourceCommit}^{commit}`]).trim()
// Documentation may advance since the tested build; packaged game source may not.
const manifest = json('pxt.json')
const sourceFiles = ['pxt.json', ...manifest.files]
for (const name of sourceFiles) {
    assert.equal(normalize(read(name).toString('utf8')), normalize(git(['show', `${gameCommit}:${name}`])),
        `${name} differs from the tested game revision: rebuild, export and validate before preparing a different candidate`)
}
const png = read('local/exports/arcade-shooter.png')
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
assert.equal(hash(png), candidate.pngSha256, 'PNG differs from the pinned, validated candidate')
assert.equal(png.length, candidate.pngBytes)
const local = json('local/exports/validation.json')
const hosted = json('local/editor-smoke/hosted-result.json')
assert.equal(local.sha256, candidate.pngSha256, 'Local import evidence must match this PNG')
assert.equal(hosted.sha256, candidate.pngSha256, 'Hosted import evidence must match this PNG')
assert.equal(local.bytes, candidate.pngBytes)
assert.equal(hosted.tilemapEditor, true)
assert.deepEqual(local.requiredFiles, manifest.files)
const notes = read(`releases/${version}.md`)
const files = {
    'arcade-shooter.png': png,
    'INTRO.md': read('INTRO.md'),
    '01-weapon-tuning.md': read('lessons/01-weapon-tuning.md'),
    'LICENSE': read('LICENSE')
}
const releaseManifest = {
    version, gameSourceCommit: gameCommit,
    preparedFromCommit: git(['rev-parse', 'HEAD']).trim(),
    // Preparation is allowed before the final docs commit; do not imply a clean tag.
    workingTreeDirty: git(['status', '--porcelain', '--untracked-files=normal']).trim().length > 0,
    hostedVersions: hosted.versions,
    files: Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: hash(bytes) })),
    sourceFiles: sourceFiles.map(name => ({ name, sha256Lf: hash(Buffer.from(normalize(read(name).toString('utf8')))) }))
}
files['release-manifest.json'] = Buffer.from(JSON.stringify(releaseManifest, null, 2) + '\n')
files.SHA256SUMS = Buffer.from(Object.entries(files).map(([name, bytes]) => `${hash(bytes)}  ${name}`).join('\n') + '\n')
const output = path.join(root, 'local/releases', version)
// Reject stale/unexpected assets instead of silently uploading old leftovers.
if (fs.existsSync(output)) {
    for (const name of fs.readdirSync(output)) assert.ok(name in files || name === 'release-notes.md', `Unexpected existing release asset: ${name}`)
}
fs.mkdirSync(output, { recursive: true })
for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(output, name), bytes)
fs.writeFileSync(path.join(output, 'release-notes.md'), notes)
console.log(`Prepared ${version} in ${output}`)
console.log(`Game source: ${gameCommit}`)
console.log(`PNG SHA-256: ${candidate.pngSha256}`)
console.log(`Working tree dirty: ${releaseManifest.workingTreeDirty}; commit approved preparation changes, then rerun before publishing.`)
console.log('Upload the six assets listed above in releases/<version>.md; use release-notes.md as the release body, not an asset.')
console.log('Nothing committed, tagged, pushed, or published.')
