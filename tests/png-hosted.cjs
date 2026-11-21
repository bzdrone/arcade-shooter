// Imports an existing project PNG into a fresh hosted Arcade browser profile.
// Uses only the supplied PNG, not repository source files. Nothing is published.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const puppeteer = require('../../pxt-arcade/node_modules/puppeteer')
const root = path.resolve(__dirname, '..')
const file = path.resolve(process.argv[2] || path.join(root, 'local/exports/arcade-shooter.png'))
const evidence = path.join(root, 'local/editor-smoke')

async function main() {
    const bytes = fs.readFileSync(file)
    fs.mkdirSync(evidence, { recursive: true })
    const browser = await puppeteer.launch({
        executablePath: process.env.ARCADE_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true, defaultViewport: { width: 1500, height: 1000 }, args: ['--mute-audio']
    })
    try {
        const page = await browser.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto('https://arcade.makecode.com/', { waitUntil: 'networkidle2', timeout: 60000 })
        await page.waitForFunction(() => typeof pxt !== 'undefined' && document.body.innerText.includes('New Project'), { timeout: 60000 })
        const versions = await page.evaluate(() => pxt.appTarget.versions)
        await page.evaluate(base64 => {
            const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const transfer = new DataTransfer()
            transfer.items.add(new File([data], 'arcade-shooter.png', { type: 'image/png' }))
            document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
        }, bytes.toString('base64'))
        await page.waitForFunction(() => typeof monaco !== 'undefined' && monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('shooter.startGame()')), { timeout: 60000 })
        // Allow the import's editor transition to finish before clicking Play.
        await new Promise(resolve => setTimeout(resolve, 3000))
        const play = await page.$('.play-button.play')
        if (play) await play.click()
        const sim = await page.waitForFrame(frame => frame.url().includes('---simulator'), { timeout: 30000 })
        await sim.waitForFunction(() => typeof pxsim !== 'undefined' && pxsim.runtime?.running && Object.keys(pxsim.runtime.globals).some(k => /^player___/.test(k)), { timeout: 30000 })
        const main = await page.evaluate(() => monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts')).getValue())
        assert.match(main, /shooter.setWeapon\(1,\s*250,\s*120\)/)
        assert.match(main, /shooter.setEnemies\(3,\s*20,\s*1500\)/)
        await page.screenshot({ path: path.join(evidence, 'hosted-png.png') })
        await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('span,div')).find(e => e.textContent.trim() === 'Blocks' && e.children.length === 0)
            if (!label) throw Error('Blocks editor tab not found')
            label.click()
        })
        await page.waitForFunction(() => document.querySelector('.blocklySvg') && /start\s+shooter/.test(document.body.innerText), { timeout: 30000 })
        const blocks = await page.evaluate(() => {
            const B = pxt.blocks.requireBlockly?.() || Blockly
            return { category: document.body.innerText.includes('Shooter'),
                types: (B.common?.getMainWorkspace?.() || B.getMainWorkspace()).getAllBlocks(false).map(b => b.type) }
        })
        assert.equal(blocks.category, true)
        for (const type of ['shooter_set_weapon', 'shooter_set_enemies', 'shooter_start_game']) assert.ok(blocks.types.includes(type))
        assert.ok(!blocks.types.some(type => /typescript|javascript/.test(type)))
        assert.deepEqual(errors, [])
        await page.screenshot({ path: path.join(evidence, 'hosted-blocks.png') })
        const result = { file, sha256: createHash('sha256').update(bytes).digest('hex'), versions,
            checks: ['Fresh hosted-editor PNG import', 'Baseline main.ts', 'Simulator startup', 'Shooter category and three custom blocks, no grey JavaScript'],
            limitations: 'Not full gameplay, physical keyboard, lesson, or hosted settings-change validation.' }
        fs.writeFileSync(path.join(evidence, 'hosted-result.json'), JSON.stringify(result, null, 2))
        console.log(`PASS: PNG import, simulator startup and Blocks on hosted Arcade ${versions.target} / PXT ${versions.pxt}`)
        console.log(`SHA-256: ${result.sha256}`)
    } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
