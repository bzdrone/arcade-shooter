import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'local/site')

test('site build is clean, portable, and includes the runtime unchanged', async () => {
    await mkdir(output, { recursive: true })
    await writeFile(path.join(output, 'stale.txt'), 'must not ship')
    execFileSync(process.execPath, ['tools/build-site.mjs'], { cwd: root })
    assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', 'app.js', 'converter', 'index.html', 'style.css'])
    const modules = await readdir(path.join(root, 'site/converter'))
    assert.deepEqual((await readdir(path.join(output, 'converter'))).sort(), modules.sort())
    for (const file of ['index.html', 'app.js', 'style.css', ...modules.map(name => `converter/${name}`)]) {
        const bytes = await readFile(path.join(output, file))
        assert.deepEqual(bytes, await readFile(path.join(root, 'site', file)), file)
        const text = bytes.toString()
        // Root-relative resources would break on a Pages project subpath.
        if (file.endsWith('.html')) assert.doesNotMatch(text, /(?:src|href)=["']\/(?!\/)/)
        if (file.endsWith('.js')) assert.doesNotMatch(text, /(?:from\s*|import\s*|fetch\(\s*)["']\/(?!\/)/)
    }
    assert.equal((await readFile(path.join(output, '.nojekyll'))).length, 0)
})
