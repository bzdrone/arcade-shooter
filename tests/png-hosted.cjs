// Imports an existing project PNG into a fresh hosted Arcade browser profile.
// Uses only the supplied PNG, not repository source files. Nothing is published.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const puppeteer = require('../../pxt-arcade/node_modules/puppeteer')
const root = path.resolve(__dirname, '..')
const file = path.resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || path.join(root, 'local/exports/arcade-shooter.png'))
const evidence = path.join(root, 'local/editor-smoke')
const teamSimulator = require('./team-simulator.cjs')

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
        page.on('console', msg => { if (/error|diagnostic|shooter.ts/i.test(msg.text())) console.log('HOSTED CONSOLE', msg.text()) })
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
        await sim.waitForFunction(() => typeof pxsim !== 'undefined' && pxsim.runtime?.running && Object.keys(pxsim.runtime.globals).some(k => /^player___/.test(k)), { timeout: 30000 }).catch(async error => {
            await page.screenshot({ path: path.join(evidence, 'hosted-failure.png') })
            console.log('HOSTED DIAGNOSTIC', await page.evaluate(() => document.body.innerText))
            console.log('HOSTED ERRORS', errors)
            throw error
        })
        const main = await page.evaluate(() => monaco.editor.getModels().find(m => m.uri.path.endsWith('/main.ts')).getValue())
        assert.match(main, /shooter.setWeapon\(1,\s*750,\s*80\)/)
        assert.match(main, /shooter.setSoldiers\(3,\s*10,\s*5000\)/)
        await teamSimulator.install(sim)
        const soldiers = (await sim.evaluate(() => team.snapshot())).soldiers
        assert.equal(soldiers.filter(s => s.team === 0 && s.alive).length, 2)
        assert.equal(soldiers.filter(s => s.team === 1 && s.alive).length, 2)
        assert.ok(soldiers.every(s => s.health === 3))
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
        for (const type of ['shooter_set_weapon', 'shooter_set_enemies', 'shooter_start_game', 'shooter_set_mode']) assert.ok(blocks.types.includes(type))
        assert.ok(!blocks.types.some(type => /typescript|javascript/.test(type)))
        if (process.argv.includes('--tilemap')) {
            await page.evaluate(() => {
                const B = pxt.blocks.requireBlockly?.() || Blockly
                const workspace = B.common?.getMainWorkspace?.() || B.getMainWorkspace()
                workspace.getAllBlocks(false).find(b => b.type === 'tiles_tilemap_editor').getField('tilemap').showEditor_()
            })
            await page.waitForFunction(() => document.querySelector('.image-editor') && document.body.innerText.includes('Show walls'), { timeout: 10000 })
            await page.screenshot({ path: path.join(evidence, 'hosted-tilemap.png') })
            await page.click('[title="Done"]')
            console.log('PASS: imported PNG tilemap opens in the hosted level editor with wall controls')
        }
        await page.screenshot({ path: path.join(evidence, 'hosted-blocks.png') })
        if (process.argv.includes('--modes')) {
            // Exercise packaged non-default code too: unused APIs can be tree-shaken from deathmatch.
            await new Promise(r => setTimeout(r, 1000))
            await page.evaluate(() => {
                const w = pxt.blocks.requireBlockly().common.getMainWorkspace()
                w.getAllBlocks(false).find(b => b.type === 'shooter_set_mode').setFieldValue('shooter.Mode.GunGame', 'mode')
            })
            await new Promise(r => setTimeout(r, 1200))
            await page.evaluate(() => Array.from(document.querySelectorAll('span,div')).find(e => e.textContent.trim() === 'JavaScript' && !e.children.length).click())
            await page.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('shooter.Mode.GunGame')))
            const stop = await page.$('.play-button.stop'); if (stop) await stop.click()
            await new Promise(r => setTimeout(r, 300))
            await page.click('.play-button.play')
            await new Promise(r => setTimeout(r, 1000))
            const gunSim = await page.waitForFrame(f => f.url().includes('---simulator'))
            await teamSimulator.install(gunSim)
            await gunSim.waitForFunction(() => team.get('targetScore') === 4 && team.get('players').data.every(p => p.fields.score === 1 && p.fields.weapon.fields.name === 'Pistol'))
            await gunSim.evaluate(() => {
                team.freezeBots(); [[40,24],[24,88],[88,24],[136,88]].forEach((p,i) => team.place(i,...p))
                team.slots()[2].health = 1; team.slots()[0].nextShotAt = 0
                pxsim.runtime.board.handleKeyEvent(5, true)
            })
            await gunSim.waitForFunction(() => team.get('players').data[0].fields.weapon.fields.name === 'SMG', { timeout: 5000 })
            await gunSim.evaluate(() => pxsim.runtime.board.handleKeyEvent(5, false))
            assert.equal(await gunSim.evaluate(() => team.get('announcements').data[0].fields.text), 'YOU: SMG LEVEL 2')
            await page.screenshot({ path: path.join(evidence, 'hosted-gun-game.png') })
            console.log('PASS: hosted PNG mode selection compiles gun game, actual elimination advances weapon and formats level-up message')
        }
        assert.deepEqual(errors, [])
        const result = { file, sha256: createHash('sha256').update(bytes).digest('hex'), versions,
            checks: ['Fresh hosted-editor PNG import', 'Baseline main.ts', '2v2 simulator startup (two soldiers per team, shared health)', 'Shooter settings/start and mode selector blocks, no grey JavaScript'],
            tilemapEditor: process.argv.includes('--tilemap'),
            gunGame: process.argv.includes('--modes'),
            limitations: 'Not full gameplay, physical keyboard, lesson, or hosted settings-change validation.' }
        fs.writeFileSync(path.join(evidence, 'hosted-result.json'), JSON.stringify(result, null, 2))
        console.log(`PASS: PNG import, simulator startup and Blocks on hosted Arcade ${versions.target} / PXT ${versions.pxt}`)
        console.log(`SHA-256: ${result.sha256}`)
    } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
