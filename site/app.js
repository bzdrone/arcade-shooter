// Page logic for the Arcade to Portal converter. Everything runs in the browser.
import { convertPng } from './converter/convert.js'
import { ARCADE_PALETTE } from './converter/project.js'

const $ = id => document.getElementById(id)
let runtimePromise = null
const runtime = () => runtimePromise ??= fetch(new URL('./converter/portal-runtime.ts', import.meta.url)).then(r => {
    if (!r.ok) throw new Error('Could not load the Portal runtime.')
    return r.text()
})

function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function showStatus(kind, title, items = []) {
    const box = $('status')
    box.hidden = false
    box.className = `status ${kind}`
    box.replaceChildren()
    const p = document.createElement('p')
    p.style.margin = '0'
    p.textContent = title
    box.append(p)
    if (items.length) {
        const ul = document.createElement('ul')
        for (const item of items) { const li = document.createElement('li'); li.textContent = item; ul.append(li) }
        box.append(ul)
    }
}

function drawArcadeMap(canvas, map) {
    const size = map.tileSize
    canvas.width = map.width * size
    canvas.height = map.height * size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const image = ctx.createImageData(canvas.width, canvas.height)
    for (let row = 0; row < map.height; row++)
        for (let column = 0; column < map.width; column++) {
            const tile = map.tileImages[map.tileset[map.indices[row * map.width + column]]]
            if (!tile) continue
            for (let y = 0; y < Math.min(size, tile.height); y++)
                for (let x = 0; x < Math.min(size, tile.width); x++) {
                    const index = tile.pixels[y * tile.width + x]
                    if (!index) continue
                    const hex = ARCADE_PALETTE[index]
                    const o = ((row * size + y) * canvas.width + column * size + x) * 4
                    image.data[o] = parseInt(hex.slice(1, 3), 16)
                    image.data[o + 1] = parseInt(hex.slice(3, 5), 16)
                    image.data[o + 2] = parseInt(hex.slice(5, 7), 16)
                    image.data[o + 3] = 255
                }
        }
    ctx.putImageData(image, 0, 0)
}

function drawPortalMap(canvas, map, cells, metres) {
    const scale = 8   // pixels per metre / 2, keeps the plan sharp
    const cell = metres * scale / 2
    canvas.width = map.width * cell
    canvas.height = map.height * cell
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = cssVar('--ground')
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const colours = { wall: cssVar('--wall'), cover: cssVar('--cover'), blueSpawn: cssVar('--blue'), redSpawn: cssVar('--red') }
    for (const c of cells) {
        const x = c.column * cell, y = c.row * cell
        if (c.role === 'wall') { ctx.fillStyle = colours.wall; ctx.fillRect(x, y, cell, cell) }
        else if (c.role === 'cover') {
            ctx.fillStyle = colours.cover
            const sub = cell / 3
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(x + i * sub + 1, y + j * sub + 1, sub - 2, sub - 2)
        } else if (c.role === 'blueSpawn' || c.role === 'redSpawn') {
            ctx.fillStyle = colours[c.role]
            ctx.beginPath()
            ctx.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2)
            ctx.fill()
        }
    }
    // Grid lines every tile, for scale.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    for (let i = 1; i < map.width; i++) { ctx.beginPath(); ctx.moveTo(i * cell + 0.5, 0); ctx.lineTo(i * cell + 0.5, canvas.height); ctx.stroke() }
    for (let i = 1; i < map.height; i++) { ctx.beginPath(); ctx.moveTo(0, i * cell + 0.5); ctx.lineTo(canvas.width, i * cell + 0.5); ctx.stroke() }
}

function addFact(list, term, value) {
    const dt = document.createElement('dt')
    dt.textContent = term
    const dd = document.createElement('dd')
    if (Array.isArray(value)) {
        const ul = document.createElement('ul')
        for (const v of value) { const li = document.createElement('li'); li.textContent = v; ul.append(li) }
        dd.append(ul)
    } else dd.textContent = value
    list.append(dt, dd)
}

function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: name.endsWith('.json') ? 'application/json' : 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const EVENT_NAMES = { OnGameModeStarted: 'game mode started', OnPlayerDeployed: 'player deployed', OnPlayerDied: 'player died', OnPlayerEarnedKill: 'player earned kill' }
const MODE_NAMES = { Deathmatch: 'Deathmatch', GunGame: 'Gun game', None: 'No mode (your own rules)' }

function render(result) {
    const { report, level, map } = result
    $('result').hidden = false
    if (map) {
        drawArcadeMap($('arcade-map'), map)
        if (level) drawPortalMap($('portal-map'), map, level.cells, level.report.tileMetres || 4)
    }
    const facts = $('facts')
    facts.replaceChildren()
    if (level && level.report.widthM) {
        const l = level.report
        $('portal-caption').textContent = `Portal layout from above: ${l.widthM} × ${l.depthM} m, one tile = ${l.tileMetres} m`
        addFact(facts, 'Map', `${map.name}: ${l.walls} wall tiles, ${l.coverTiles} cover tiles, ${l.blueSpawns} + ${l.redSpawns} spawns`)
        addFact(facts, 'Portal objects', `${l.objects} objects on ${l.level}, physics cost ${l.physicsCost} of 100000`)
    }
    if (report.rules && report.rules.mode) {
        addFact(facts, 'Game mode', MODE_NAMES[report.rules.mode] || report.rules.mode)
        const handlers = report.rules.handlers.map(h => `on ${EVENT_NAMES[h.event] || h.event} (${h.from})`)
        addFact(facts, 'Rules', handlers.length ? handlers : ['none: combat only'])
        addFact(facts, 'Settings', report.rules.mapped)
    }

    const warnings = report.warnings
    $('warnings-box').hidden = !warnings.length
    $('warning-count').textContent = warnings.length
    $('warnings').replaceChildren(...warnings.map(w => { const li = document.createElement('li'); li.textContent = w; return li }))

    const downloads = $('downloads')
    downloads.replaceChildren()
    if (result.files) {
        const all = document.createElement('button')
        all.className = 'primary'
        all.textContent = 'Download all three files'
        all.addEventListener('click', async () => {
            for (const [name, text] of Object.entries(result.files)) { download(name, text); await new Promise(r => setTimeout(r, 300)) }
        })
        downloads.append(all)
        for (const [name, text] of Object.entries(result.files)) {
            const b = document.createElement('button')
            b.textContent = name
            b.addEventListener('click', () => download(name, text))
            downloads.append(b)
        }
    } else {
        const p = document.createElement('p')
        p.className = 'note'
        p.textContent = 'Fix the problems above in Arcade, save the project again and drop the new PNG here.'
        downloads.append(p)
    }
    $('script').textContent = result.script || ''

    if (report.errors.length) showStatus('error', 'This project could not be converted yet:', report.errors)
    else showStatus('ok', `Converted "${result.project.meta.name || result.name}".${warnings.length ? ` See the ${warnings.length} note${warnings.length > 1 ? 's' : ''} below.` : ''}`)
}

async function handleFile(file) {
    if (!file) return
    $('result').hidden = true
    showStatus('ok', `Reading ${file.name}…`)
    try {
        const result = await convertPng(new Uint8Array(await file.arrayBuffer()), await runtime())
        window.lastConversion = result
        render(result)
    } catch (e) {
        showStatus('error', e.message || String(e))
        console.error(e)
    }
}

$('file').addEventListener('change', e => handleFile(e.target.files[0]))
const drop = $('drop')
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over') })
drop.addEventListener('dragleave', () => drop.classList.remove('over'))
drop.addEventListener('drop', e => {
    e.preventDefault()
    drop.classList.remove('over')
    handleFile(e.dataTransfer.files[0])
})
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click() } })
