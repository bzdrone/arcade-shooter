// Real-editor smoke checks. Requires the sibling pxt-arcade setup in VALIDATION.md.
// Uses Puppeteer already installed with that toolchain; no game dependencies added.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const puppeteer = require('../../pxt-arcade/node_modules/puppeteer')
const root = path.resolve(__dirname, '..')
const target = path.resolve(root, '../pxt-arcade')
const artifacts = path.join(root, 'local/editor-smoke')
const port = 3242
const wsport = 3243
const origin = `http://127.0.0.1:${port}`
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

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
        const page = await browser.newPage()
        const pageErrors = []
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

        async function command(action, args = {}) {
            const response = await page.evaluate(({ action, args, origin }) => new Promise((resolve, reject) => {
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
        const sim = page.frames().find(frame => frame.url().includes('---simulator'))
        assert.ok(sim, 'Simulator iframe exists')
        await sim.waitForFunction(() => typeof pxsim !== 'undefined' && pxsim.runtime?.running && Object.keys(pxsim.runtime.globals).some(k => /^player___/.test(k)), { timeout: 30000 })
        async function snapshot() {
            return sim.evaluate(() => {
                const g = pxsim.runtime.globals
                const get = name => g[Object.keys(g).find(k => k.startsWith(name + '___'))]
                const player = get('player').fields
                return { dead: pxsim.runtime.dead, x: player._x / 256, y: player._y / 256,
                    facingX: get('facingX'), facingY: get('facingY'), nextShotAt: get('nextShotAt'),
                    enemies: get('enemies').data.length, health: get('health').data.slice() }
            })
        }
        async function button(key, down) {
            await sim.evaluate(({ key, down }) => pxsim.runtime.board.handleKeyEvent(key, down), { key, down })
        }
        const start = await snapshot()
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
        assert.ok(released.enemies > 0 && released.enemies <= 6, 'Enemies spawn')
        assert.ok(released.health.every(value => value > 0 && value <= 3))
        await button(3, true)
        await sleep(2200)
        const boundary = await snapshot()
        await sleep(300)
        const stillAtBoundary = await snapshot()
        await button(3, false)
        // Arcade bounds the hitbox, not necessarily the full image rectangle.
        assert.ok(boundary.x >= 148 && boundary.x <= 154, `Right boundary: ${JSON.stringify(boundary)}`)
        assert.equal(stillAtBoundary.x, boundary.x, 'Continued input cannot move beyond the boundary')
        await page.screenshot({ path: path.join(artifacts, 'simulator.png') })
        console.log('PASS: simulator startup, directional movement, retained aim, held/released fire, spawn and right boundary')

        // Force TS decompilation with a non-default value; do not merely load cached XML.
        await editor.evaluate(() => {
            const model = monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts'))
            model.setValue(model.getValue().replace('setWeapon(1, 250, 120)', 'setWeapon(2, 250, 120)'))
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
        for (const type of ['shooter_set_weapon', 'shooter_set_enemies', 'shooter_start_game']) assert.ok(blocks.types.includes(type))
        assert.ok(!blocks.types.some(type => /typescript|javascript/.test(type)), 'No grey JavaScript blocks')
        await page.screenshot({ path: path.join(artifacts, 'blocks.png') })
        await sleep(500)
        await command('switchjavascript')
        await editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && /setWeapon\(4,\s*250,\s*120\)/.test(m.getValue())), { timeout: 30000 })
        const roundTrip = await editor.evaluate(() => monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts')).getValue())
        assert.match(roundTrip, /setEnemies\(3,\s*20,\s*1500\)/)
        assert.match(roundTrip, /shooter.startGame\(\)/)
        assert.ok(!roundTrip.includes('namespace shooter'), 'Implementation is not inlined into main.ts')
        assert.deepEqual(pageErrors, [], 'No uncaught browser errors')
        fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({
            simulator: { start, moved, aimed, firing, released, boundary }, blocks, roundTrip,
            limitations: 'Synthetic controller input; not a complete gameplay, keyboard, restart, win/lose, or PNG-delivery test. Browser uses the hosted simulator iframe.'
        }, null, 2))
        console.log('PASS: Shooter category, TS → Blocks → TS with edited arguments, no grey blocks')
        console.log('Screenshots and result JSON: local/editor-smoke/')
    } finally {
        if (browser) await browser.close()
        server.kill()
    }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
