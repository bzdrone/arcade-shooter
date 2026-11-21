// Author-only probe. All Arcade project files/build output live in an OS temp directory.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')

module.exports = async function ({ editor, page, command, sleep, artifacts, target }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-compat-'))
    const text = {
        'pxt.json': JSON.stringify({ name: 'compat-probe', preferredEditor: 'tsprj', dependencies: { device: '*' }, files: ['main.ts', 'main.blocks', 'probe.ts'] }),
        'main.blocks': '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
        'main.ts': 'probe.route(probe.team())\nprobe.route(probe.player())\nprobe.start()\n',
        'probe.ts': `//% color=#C75050 block="Probe"
namespace probe {
    export class Team { constructor(public id: number) {} }
    export class Player { constructor(public id: number) {} }
    let compatRoutes = ""
    let compatBeforeWait = false
    let compatOtherHandler = false
    let compatAfterWait = false
    //% blockId=compat_team block="probe team"
    export function team(): Team { return new Team(0) }
    //% blockId=compat_player block="probe player"
    export function player(): Player { return new Player(1) }
    //% blockId=compat_route block="route $target"
    export function route(target: Team | Player): void {
        if (target instanceof Team) compatRoutes += "T"
        else compatRoutes += "P"
    }
    function wait(seconds: number): void { pause(seconds * 1000) }
    //% blockId=compat_start block="start wait probe"
    export function start(): void {
        scene.createRenderable(100, function (target) {
            target.print(compatRoutes + compatBeforeWait + compatOtherHandler + compatAfterWait, 0, 0)
        })
        control.runInParallel(function () {
            compatBeforeWait = true
            wait(10)
            compatAfterWait = true
        })
        control.runInParallel(function () {
            pause(100)
            compatOtherHandler = true
        })
    }
}`
    }
    try {
        for (const [name, content] of Object.entries(text)) fs.writeFileSync(path.join(dir, name), content)
        const cli = path.join(target, 'node_modules/pxt-core/built/pxt.js')
        fs.cpSync(path.resolve(__dirname, '../pxt_modules'), path.join(dir, 'pxt_modules'), { recursive: true })
        execFileSync(process.execPath, [cli, 'build'], { cwd: dir, stdio: 'pipe' })
        await command('importproject', { project: { text } })
        await editor.waitForFunction(() => typeof monaco !== 'undefined' && monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && m.getValue().includes('probe.start()')))
        await command('restartsimulator'); await sleep(1000)
        const sim = await page.waitForFrame(f => f.url().includes('---simulator'))
        await sim.waitForFunction(() => {
            const g = typeof pxsim !== 'undefined' && pxsim.runtime?.globals
            const get = n => g && g[Object.keys(g).find(k => k.startsWith(n + '___'))]
            return get('compatBeforeWait') && get('compatOtherHandler') && !get('compatAfterWait')
        }, { timeout: 30000 }).catch(async error => {
            console.log('SCRATCH EDITOR', await editor.evaluate(() => document.body.innerText))
            console.log('SCRATCH GLOBALS', await sim.evaluate(() => ({ running: pxsim.runtime.running, keys: Object.keys(pxsim.runtime.globals), text: document.body.innerText })))
            throw error
        })
        assert.equal(await sim.evaluate(() => {
            const g = pxsim.runtime.globals
            return g[Object.keys(g).find(k => k.startsWith('compatRoutes___'))]
        }), 'TP')
        await sim.waitForFunction(() => {
            const g = pxsim.runtime.globals
            return g[Object.keys(g).find(k => k.startsWith('compatAfterWait___'))]
        }, { timeout: 15000 })
        await command('switchblocks'); await sleep(800)
        const checks = await editor.evaluate(() => {
            const w = pxt.blocks.requireBlockly().common.getMainWorkspace()
            const blocks = w.getAllBlocks(false)
            const routes = blocks.filter(b => b.type === 'compat_route')
            const input = routes[0].getInput('target').connection
            const team = blocks.find(b => b.type === 'compat_team')
            const player = blocks.find(b => b.type === 'compat_player')
            const number = w.newBlock('math_number'); number.initSvg(); number.render()
            const result = {
                types: blocks.map(b => b.type), check: input.getCheck(),
                acceptsTeam: w.connectionChecker.doTypeChecks(input, team.outputConnection),
                acceptsPlayer: w.connectionChecker.doTypeChecks(input, player.outputConnection),
                rejectsNumber: !w.connectionChecker.doTypeChecks(input, number.outputConnection),
                shadow: input.targetBlock()?.isShadow()
            }
            number.dispose()
            input.disconnect()
            team.dispose()
            const replacement = w.newBlock('compat_player'); replacement.initSvg(); replacement.render()
            input.connect(replacement.outputConnection)
            return result
        })
        assert.ok(checks.acceptsTeam && checks.acceptsPlayer && checks.rejectsNumber)
        assert.ok(!checks.types.some(t => /typescript|javascript/.test(t)))
        assert.equal(checks.shadow, false)
        await page.screenshot({ path: path.join(artifacts, 'scratch-union-blocks.png') })
        await sleep(400); await command('switchjavascript')
        await editor.waitForFunction(() => monaco.editor.getModels().some(m => m.uri.path.endsWith('/main.ts') && (m.getValue().match(/route\(probe.player\(\)\)/g) || []).length === 2))
        fs.writeFileSync(path.join(artifacts, 'scratch-compat.json'), JSON.stringify({ build: true, dispatch: 'TP', concurrentWait: true, ...checks }, null, 2))
        console.log('PASS: scratch union dispatch/build, typed Blocks connections, TS ↔ Blocks edit, concurrent pause wait')
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
