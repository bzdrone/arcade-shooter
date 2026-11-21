// Real-editor smoke checks. Requires the sibling pxt-arcade setup in VALIDATION.md.
// Uses Puppeteer already installed with that toolchain; no game dependencies added.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { createHash } = require('node:crypto')
const puppeteer = require('../../pxt-arcade/node_modules/puppeteer')
const root = path.resolve(__dirname, '..')
const target = path.resolve(root, '../pxt-arcade')
const artifacts = path.join(root, 'local/editor-smoke')
const port = 3242
const wsport = 3243
const origin = `http://127.0.0.1:${port}`
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const teamSimulator = require('./team-simulator.cjs')

async function main() {
    fs.mkdirSync(artifacts, { recursive: true })
    const server = spawn(process.execPath, [
        path.join(target, 'node_modules/pxt-core/built/pxt.js'), 'serve',
        '--just', '--noBrowser', '--noSerial', '--hostname', '127.0.0.1',
        '--port', String(port), '--wsport', String(wsport)
    ], { cwd: target, stdio: ['ignore', 'pipe', 'pipe'] })
    let browser
    try {
        const token = await new Promise((resolve, reject) => {
            let output = ''
            const timer = setTimeout(() => reject(Error('Editor server startup timed out')), 30000)
            const append = chunk => {
                output += chunk.toString()
                const match = output.match(/local_token=([^&\s]+)/)
                if (match) { clearTimeout(timer); resolve(match[1]) }
            }
            server.stdout.on('data', append)
            server.stderr.on('data', append)
            server.once('error', error => { clearTimeout(timer); reject(error) })
            server.once('exit', code => { clearTimeout(timer); reject(Error(`Editor server exited: ${code}`)) })
        })
        browser = await puppeteer.launch({
            executablePath: process.env.ARCADE_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
            headless: true, args: ['--mute-audio'], defaultViewport: { width: 1500, height: 1000 }
        })
        const pageErrors = []
        async function openEditor(context) {
            const page = await context.newPage()
            page.on('pageerror', error => pageErrors.push(error.message))
            await page.setRequestInterception(true)
            page.on('request', request => request.url() === `${origin}/validation-host`
                ? request.respond({ status: 200, contentType: 'text/html', body:
                    '<html style="height:100%"><body style="margin:0;height:100%"><iframe id="editor" style="width:100%;height:100%;border:0"></iframe></body></html>' })
                : request.continue())
            await page.goto(`${origin}/validation-host`)
            // Memory workspace avoids controller mode waiting for a parent storage provider.
            await page.evaluate(url => { document.querySelector('iframe').src = url },
                `${origin}/index.html?controller=1&ws=mem#local_token=${token}&wsport=${wsport}`)
            const editor = await (await page.$('#editor')).contentFrame()
            await editor.waitForFunction(() => typeof pxt !== 'undefined' && document.body.innerText.includes('Download'), { timeout: 60000 })
            return { page, editor }
        }
        const { page, editor } = await openEditor(browser)

        async function command(action, args = {}, host = page) {
            const response = await host.evaluate(({ action, args, origin }) => new Promise((resolve, reject) => {
                const id = crypto.randomUUID()
                const timer = setTimeout(() => {
                    window.removeEventListener('message', handler)
                    reject(Error(`Editor command timed out: ${action}`))
                }, 60000)
                function handler(event) {
                    if (event.origin === origin && event.data?.type === 'pxteditor' && event.data.id === id) {
                        clearTimeout(timer)
                        window.removeEventListener('message', handler)
                        resolve(event.data)
                    }
                }
                window.addEventListener('message', handler)
                document.querySelector('iframe').contentWindow.postMessage({ type: 'pxteditor', id, response: true, action, ...args }, origin)
            }), { action, args, origin })
            assert.equal(response.success, true, `${action}: ${JSON.stringify(response.error)}`)
        }
        const text = {}
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pxt.json'), 'utf8'))
        for (const name of ['pxt.json', ...manifest.files]) text[name] = fs.readFileSync(path.join(root, name), 'utf8')
        await command('importproject', { project: { text } })
        await editor.waitForFunction(() => typeof monaco !== 'undefined' && monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts')), { timeout: 30000 })
        await command('restartsimulator')
        await sleep(1000)
        const sim = await page.waitForFrame(frame => frame.url().includes('---simulator'), { timeout: 30000 })
        await sim.waitForFunction(() => typeof pxsim !== 'undefined' && pxsim.runtime?.running && Object.keys(pxsim.runtime.globals).some(k => /^player___/.test(k)), { timeout: 30000 })
        await teamSimulator.install(sim)
        async function snapshot() { return sim.evaluate(() => window.team.snapshot()) }
        async function button(key, down) {
            await sim.evaluate(({ key, down }) => pxsim.runtime.board.handleKeyEvent(key, down), { key, down })
        }
        let projectPNG
        if (process.argv.includes('--png')) {
            const downloadDir = fs.mkdtempSync(path.join(artifacts, 'download-'))
            const cdp = await page.createCDPSession()
            await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })
            assert.equal(await editor.evaluate(() => pxt.appTarget.compile.saveAsPNG), true,
                'The simulator camera must export a project PNG, not an ordinary screenshot')
            // Arcade's camera invokes downloadScreenshotAsync → saveProjectAsPNGAsync
            // for saveAsPNG targets, embedding the complete project via the editor exporter.
            await editor.click('.screenshot-button')
            const deadline = Date.now() + 30000
            let downloaded
            while (!downloaded && Date.now() < deadline) {
                downloaded = fs.readdirSync(downloadDir).find(name => name.endsWith('.png'))
                if (!downloaded) await sleep(200)
            }
            assert.ok(downloaded, 'Arcade exported a PNG download')
            const bytes = fs.readFileSync(path.join(downloadDir, downloaded))
            assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
            const files = await editor.evaluate(async base64 => {
                const blob = await pxt.Util.decodeBlobAsync(`data:image/png;base64,${base64}`)
                const json = blob[0] === 123 ? pxt.Util.uint8ArrayToString(blob) : await pxt.lzmaDecompressAsync(blob)
                return JSON.parse(JSON.parse(json).source)
            }, bytes.toString('base64'))
            const exportedManifest = JSON.parse(files['pxt.json'])
            for (const name of manifest.files) {
                assert.ok(exportedManifest.files.includes(name), `Export manifest contains ${name}`)
                assert.equal(files[name].replace(/\r\n/g, '\n'), text[name].replace(/\r\n/g, '\n'), `Baseline ${name} survives export`)
            }
            const outputDir = path.join(root, 'local/exports')
            fs.mkdirSync(outputDir, { recursive: true })
            const output = path.join(outputDir, 'arcade-shooter.png')
            fs.copyFileSync(path.join(downloadDir, downloaded), output)
            projectPNG = { output, bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
            console.log(`EXPORTED: ${output}`)
        }
        await sim.evaluate(() => window.team.freezeBots())
        const start = await snapshot()
        assert.equal(start.soldiers.filter(s => s.team === 0 && s.alive).length, 2)
        assert.equal(start.soldiers.filter(s => s.team === 1 && s.alive).length, 2)
        assert.equal(start.dead, false)
        await button(3, true) // Right; synthetic input through the real simulator board.
        await sleep(300)
        await button(3, false)
        const moved = await snapshot()
        assert.ok(moved.x > start.x + 10, 'Right input moves the player')
        await button(2, true) // Up
        await sleep(250)
        await button(2, false)
        await sleep(100)
        const aimed = await snapshot()
        assert.ok(aimed.y < moved.y - 8, 'Up input moves the player')
        assert.equal(aimed.facingY, -1)
        await button(5, true) // A
        await sleep(800)
        const firing = await snapshot()
        await button(5, false)
        await sleep(350)
        const released = await snapshot()
        assert.ok(firing.nextShotAt > aimed.nextShotAt, 'Held A fires')
        assert.equal(released.nextShotAt, firing.nextShotAt, 'Released A stops firing')
        assert.equal(released.facingY, -1, 'Aim persists at rest')
        assert.equal(released.soldiers.length, 4, 'Exactly four soldier slots')
        assert.ok(released.soldiers.every(s => s.health === 3), 'All soldiers share health')
        await button(3, true)
        await sleep(2200)
        const boundary = await snapshot()
        await sleep(300)
        const stillAtBoundary = await snapshot()
        await button(3, false)
        // Arcade bounds the hitbox, not necessarily the full image rectangle.
        assert.ok(boundary.x >= 139 && boundary.x <= 141, `Right boundary: ${JSON.stringify(boundary)}`)
        assert.equal(stillAtBoundary.x, boundary.x, 'Continued input cannot move beyond the boundary')
        await page.screenshot({ path: path.join(artifacts, 'simulator.png') })
        console.log('PASS: 2v2 startup, movement, retained aim, held/released fire and right boundary')

        if (process.argv.includes('--arena')) {
            await teamSimulator.checkArena({ sim, command, button, sleep, snapshot,
                screenshot: file => page.screenshot({ path: path.join(artifacts, file) }) })
            await page.screenshot({ path: path.join(artifacts, 'arena-pathing.png') })
        }

        // Force TS decompilation with a non-default value; do not merely load cached XML.
        await editor.evaluate(() => {
            const model = monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts'))
            model.setValue(model.getValue().replace('setWeapon(1, 750, 80)', 'setWeapon(2, 750, 80)'))
        })
        await command('switchblocks')
        await editor.waitForFunction(() => document.querySelector('.blocklySvg') && /start\s+shooter/.test(document.body.innerText), { timeout: 30000 })
        const blocks = await editor.evaluate(() => {
            const B = pxt.blocks.requireBlockly()
            const workspace = B.common.getMainWorkspace()
            const all = workspace.getAllBlocks(false)
            const weapon = all.find(b => b.type === 'shooter_set_weapon')
            const damage = weapon.getInputTargetBlock('damage')
            const result = { types: all.map(b => b.type), damage: damage.getFieldValue('NUM'),
                shooterCategory: document.body.innerText.includes('Shooter') }
            // Force Blocks compilation too, rather than accepting cached main.ts.
            damage.setFieldValue('4', 'NUM')
            return result
        })
        assert.equal(Number(blocks.damage), 2, 'TS argument survives decompilation')
        assert.equal(blocks.shooterCategory, true)
        for (const type of ['shooter_set_weapon', 'shooter_set_enemies', 'shooter_start_game', 'deathmatch_configure']) assert.ok(blocks.types.includes(type))
        assert.ok(!blocks.types.some(type => /typescript|javascript/.test(type)), 'No grey JavaScript blocks')
        await page.screenshot({ path: path.join(artifacts, 'blocks.png') })
        assert.ok(blocks.types.includes('set_current_tilemap'), 'Level setup stays Blocks-friendly')
        if (process.argv.includes('--arena') || process.argv.includes('--tilemap')) {
            await editor.evaluate(() => {
                const workspace = pxt.blocks.requireBlockly().common.getMainWorkspace()
                workspace.getAllBlocks(false).find(b => b.type === 'tiles_tilemap_editor').getField('tilemap').showEditor_()
            })
            await editor.waitForFunction(() => document.querySelector('.image-editor') && document.body.innerText.includes('Show walls'), { timeout: 10000 })
            await page.screenshot({ path: path.join(artifacts, 'tilemap-editor.png') })
            await editor.click('[title="Done"]')
            console.log('PASS: tilemap thumbnail opens the level editor with wall controls')
        }
        await sleep(500)
        await command('switchjavascript')
        await editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && /setWeapon\(4,\s*750,\s*80\)/.test(m.getValue())), { timeout: 30000 })
        const roundTrip = await editor.evaluate(() => monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts')).getValue())
        assert.match(roundTrip, /setSoldiers\(3,\s*10,\s*5000\)/)
        assert.match(roundTrip, /shooter.startGame\(\)/)
        assert.match(roundTrip, /deathmatch.configure\(\)/)
        assert.ok(!roundTrip.includes('namespace shooter'), 'Implementation is not inlined into main.ts')
        if (projectPNG) {
            // Independent storage/profile context, receiving only the exact exported PNG.
            const fresh = await browser.createBrowserContext()
            try {
                const imported = await openEditor(fresh)
                await imported.editor.evaluate(base64 => {
                    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
                    const transfer = new DataTransfer()
                    transfer.items.add(new File([bytes], 'arcade-shooter.png', { type: 'image/png' }))
                    document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
                }, projectPNG.bytes.toString('base64'))
                await imported.editor.waitForFunction(() => typeof monaco !== 'undefined' && monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('shooter.startGame()')), { timeout: 30000 })
                const main = await imported.editor.evaluate(() => monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts')).getValue())
                assert.equal(main.replace(/\r\n/g, '\n'), text['main.ts'].replace(/\r\n/g, '\n'))
                await command('restartsimulator', {}, imported.page)
                await sleep(1000)
                const importedSim = await imported.page.waitForFrame(f => f.url().includes('---simulator'), { timeout: 30000 })
                await importedSim.waitForFunction(() => typeof pxsim !== 'undefined' && pxsim.runtime?.running && Object.keys(pxsim.runtime.globals).some(k => /^player___/.test(k)), { timeout: 30000 })
                await teamSimulator.install(importedSim)
                const importedState = await importedSim.evaluate(() => team.snapshot())
                assert.equal(importedState.soldiers.filter(s => s.team === 0 && s.alive).length, 2)
                assert.equal(importedState.soldiers.filter(s => s.team === 1 && s.alive).length, 2)
                assert.equal(await importedSim.evaluate(() => {
                    const g = pxsim.runtime.globals
                    return g[Object.keys(g).find(k => k.startsWith('weaponDamage___'))]
                }), 1)
                await command('switchblocks', {}, imported.page)
                await imported.editor.waitForFunction(() => document.querySelector('.blocklySvg') && /start\s+shooter/.test(document.body.innerText), { timeout: 30000 })
                // The initial Blocks load can still be applying cached XML after the tab appears.
                await sleep(700)
                const types = await imported.editor.evaluate(() => {
                    const workspace = pxt.blocks.requireBlockly().common.getMainWorkspace()
                    const all = workspace.getAllBlocks(false)
                    all.find(b => b.type === 'shooter_set_weapon').getInputTargetBlock('damage').setFieldValue('3', 'NUM')
                    return all.map(b => b.type)
                })
                for (const type of ['shooter_set_weapon', 'shooter_set_enemies', 'shooter_start_game', 'deathmatch_configure']) assert.ok(types.includes(type))
                assert.ok(!types.some(type => /typescript|javascript/.test(type)))
                await sleep(500)
                await command('switchjavascript', {}, imported.page)
                await imported.editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && /setWeapon\(3,\s*750,\s*80\)/.test(m.getValue())), { timeout: 30000 }).catch(async error => {
                    console.log('IMPORT ROUNDTRIP', await imported.editor.evaluate(() => monaco.editor.getModels().filter(m => m.uri.path.endsWith('/main.ts')).map(m => m.getValue())))
                    throw error
                })
                // Fast restart reuses compiled code. Stop/start forces compilation of the edit.
                await command('stopsimulator', {}, imported.page)
                await command('startsimulator', {}, imported.page)
                await sleep(1000)
                await importedSim.waitForFunction(() => {
                    if (typeof pxsim === 'undefined' || !pxsim.runtime?.running) return false
                    const g = pxsim.runtime.globals
                    return g[Object.keys(g).find(k => k.startsWith('weaponDamage___'))] === 3
                }, { timeout: 30000 })
                await imported.page.screenshot({ path: path.join(artifacts, 'png-import.png') })
                const result = { file: path.relative(root, projectPNG.output), sha256: projectPNG.sha256,
                    bytes: projectPNG.bytes.length, requiredFiles: manifest.files,
                    checks: ['Embedded baseline sources match', 'Fresh-context PNG drag/drop import', '2v2 simulator starts',
                        'Custom Blocks appear without grey JavaScript', 'Blocks edit round-trips and changes runtime damage to 3'],
                    limitations: 'Full gameplay, physical controls, lesson instructions and hosted-editor import remain unverified.' }
                fs.writeFileSync(path.join(root, 'local/exports/validation.json'), JSON.stringify(result, null, 2))
                console.log('PASS: exact project PNG imports in fresh context, runs, and remains editable in Blocks')
                console.log(`SHA-256: ${projectPNG.sha256}`)
            } finally { await fresh.close() }
        }
        assert.deepEqual(pageErrors, [], 'No uncaught browser errors')
        fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({
            simulator: { start, moved, aimed, firing, released, boundary }, blocks, roundTrip,
            arenaChecks: process.argv.includes('--arena'),
            tilemapEditor: process.argv.includes('--arena') || process.argv.includes('--tilemap'),
            limitations: 'Synthetic input/controlled actor placement; match-end checks seed score 9 and use real bullets for the tenth elimination. Not a full natural match, physical keyboard, or lesson playtest. Browser uses the hosted simulator iframe.'
        }, null, 2))
        console.log('PASS: Shooter category, TS → Blocks → TS with edited arguments, no grey blocks')
        console.log('Screenshots and result JSON: local/editor-smoke/')
    } finally {
        if (browser) await browser.close()
        server.kill()
    }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
