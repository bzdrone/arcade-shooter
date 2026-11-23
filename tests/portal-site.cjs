// Browser check of the static converter page (site/): serves it locally, loads a
// project PNG through the real file input, and checks the result, the downloads
// and that the page's output matches the command-line converter.
//
//   node tests/portal-site.cjs [project.png]      (default: local/exports/arcade-shooter.png)
//
// Screenshots go to local/portal-site/. Uses the Puppeteer installed with the
// sibling pxt-arcade toolchain.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const puppeteer = require('../../pxt-arcade/node_modules/puppeteer')

const root = path.resolve(__dirname, '..')
const site = path.join(root, 'site')
const png = path.resolve(process.argv[2] || path.join(root, 'local/exports/arcade-shooter.png'))
const outDir = path.join(root, 'local/portal-site')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ts': 'text/plain', '.json': 'application/json' }

function serve() {
    const server = http.createServer((req, res) => {
        const file = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'))
        if (!file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
        res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' })
        fs.createReadStream(file).pipe(res)
    })
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

;(async () => {
    assert.ok(fs.existsSync(png), `Project PNG not found: ${png}`)
    fs.mkdirSync(outDir, { recursive: true })
    const server = await serve()
    const url = `http://127.0.0.1:${server.address().port}/`
    const browser = await puppeteer.launch({
        executablePath: process.env.ARCADE_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true, args: ['--mute-audio']
    })
    try {
        for (const [label, viewport, scheme] of [['desktop', { width: 1200, height: 900 }, 'light'], ['phone', { width: 390, height: 844 }, 'dark']]) {
            const page = await browser.newPage()
            await page.setViewport(viewport)
            await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
            const errors = []
            page.on('pageerror', e => errors.push(e.message))
            page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
            await page.goto(url, { waitUntil: 'networkidle0' })
            const input = await page.$('#file')
            await input.uploadFile(png)
            await page.waitForFunction(() => !document.getElementById('result').hidden || document.querySelector('#status.error'), { timeout: 20000 })
            const state = await page.evaluate(() => ({
                status: document.getElementById('status').textContent,
                error: document.getElementById('status').classList.contains('error'),
                downloads: [...document.querySelectorAll('#downloads button')].map(b => b.textContent),
                facts: document.getElementById('facts').innerText,
                files: window.lastConversion && window.lastConversion.files,
                canvas: ['arcade-map', 'portal-map'].map(id => { const c = document.getElementById(id); return [c.width, c.height] }),
                overflow: document.documentElement.scrollWidth > window.innerWidth
            }))
            assert.deepEqual(errors, [], `${label}: no page errors`)
            assert.equal(state.error, false, `${label}: conversion succeeded: ${state.status}`)
            assert.equal(state.downloads.length, 4, `${label}: download all plus three files`)
            assert.ok(state.canvas.every(([w, h]) => w > 0 && h > 0), `${label}: both map previews drawn`)
            assert.equal(state.overflow, false, `${label}: no horizontal scrolling`)
            assert.match(state.facts, /Game mode/)
            // The page must produce exactly what the command-line converter produces.
            const { convertPng } = await import('../site/converter/convert.js')
            const cli = await convertPng(fs.readFileSync(png), fs.readFileSync(path.join(site, 'converter/portal-runtime.ts'), 'utf8'))
            assert.deepEqual(state.files, cli.files, `${label}: page output matches the command-line converter`)
            await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true })
            console.log(`PASS ${label}: ${state.status.trim()} Files: ${state.downloads.slice(1).join(', ')}`)
            await page.close()
        }
        console.log(`Screenshots: ${outDir}`)
    } finally {
        await browser.close()
        server.close()
    }
})().catch(e => { console.error(e); process.exit(1) })
