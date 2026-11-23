// Arcade `mod` rules -> a Battlefield 6 Portal TypeScript script and strings file.
//
// Applies the porting checklist in PORTAL.md as text edits on the creator's own
// code: registered handlers become functions called from exported Portal events,
// waits become `await mod.Wait`, message text moves to the strings file, and
// calls whose Portal behaviour differs go to the bundled runtime (`arcade`).
import { parse, children, dottedName, ParseError } from './tsparse.js'

export const EVENTS = {
    OnGameModeStarted: { types: [], params: '', args: '' },
    OnPlayerDeployed: { types: ['mod.Player'], params: 'eventPlayer: mod.Player', args: 'eventPlayer' },
    OnPlayerDied: {
        types: ['mod.Player', 'mod.Player'],
        params: 'eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock',
        args: 'eventPlayer, eventOtherPlayer'
    },
    OnPlayerEarnedKill: {
        types: ['mod.Player', 'mod.Player', 'number'],
        params: 'eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock',
        args: 'eventPlayer, eventOtherPlayer, eventWeapon'
    }
}

// Calls whose Arcade meaning differs from Portal's go to the runtime.
const REWRITES = {
    'mod.ObjectVariable': 'arcade.ObjectVariable', 'mod.GlobalVariable': 'arcade.GlobalVariable',
    'mod.SetVariable': 'arcade.SetVariable', 'mod.GetVariable': 'arcade.GetVariable',
    'mod.EndGameMode': 'arcade.EndGameMode', 'mod.DealDamage': 'arcade.DealDamage',
    'mod.GetPlayerKills': 'arcade.GetPlayerKills', 'mod.GetPlayerDeaths': 'arcade.GetPlayerDeaths',
    'mod.AllPlayers': 'arcade.AllPlayers',
    // Portal ends the round itself when a team reaches the target and changes team scores on its own;
    // in Arcade the target is only shown and scores change only through the rules.
    'mod.SetGameModeScore': 'arcade.SetGameModeScore', 'mod.GetGameModeScore': 'arcade.GetGameModeScore',
    'mod.SetGameModeTargetScore': 'arcade.SetGameModeTargetScore', 'mod.GetTargetScore': 'arcade.GetTargetScore',
    'mod.DisplayGameModeMessage': 'modlib.ShowEventGameModeMessage',
    'randint': 'arcade.randint', 'Math.randomRange': 'arcade.randint', 'Math.constrain': 'arcade.constrain',
    'convertToText': 'arcade.convertToText'
}
// Arcade `mod` and `weapons` names that exist in Portal (or the runtime) unchanged.
const SUPPORTED = new Set(['mod.GetTeam', 'mod.Equals', 'mod.DisplayNotificationMessage', 'mod.Message', 'mod.Wait',
    'weapons.give', 'weapons.current', 'weapons.kind', 'weapons.name', 'weapons.Kind'])
const JS_GLOBALS = new Set(['Math', 'Number', 'String', 'Array', 'JSON', 'Object', 'Boolean', 'parseInt', 'parseFloat', 'isNaN',
    'undefined', 'null', 'true', 'false', 'NaN', 'Infinity', 'this', 'arguments'])
const TYPE_REWRITES = [[/\bshooter\.Player\b/g, 'mod.Player'], [/\bshooter\.Team\b/g, 'mod.Team'], [/\bmod\.Variable\b/g, 'arcade.Variable']]
const SETTINGS_CALLS = new Set(['tiles.setCurrentTilemap', 'tiles.setTilemap', 'shooter.setWeapon', 'shooter.setSoldiers',
    'shooter.setMode', 'shooter.startGame', 'deathmatch.configure'])
const RUNTIME_STRINGS = { arcadePistol: 'PISTOL', arcadeSmg: 'SMG', arcadeShotgun: 'SHOTGUN', arcadeKnife: 'KNIFE', arcadeCustom: 'CUSTOM',
    arcadeBlueBot: 'Blue bot {}', arcadeRedBot: 'Red bot {}', arcadeScore: 'BLUE {}   RED {}', arcadeScoreTarget: 'BLUE {}   RED {}   FIRST TO {}' }

/** Message text -> strings-file keys. */
class Strings {
    constructor() { this.byText = new Map(); this.entries = { ...RUNTIME_STRINGS } }
    key(text) {
        if (this.byText.has(text)) return this.byText.get(text)
        const words = (text.match(/[A-Za-z0-9]+/g) || []).slice(0, 5).map(w => w.toLowerCase())
        let base = words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join('') || 'message'
        if (/^\d/.test(base)) base = 'm' + base
        let key = base, n = 2
        while (key in this.entries) key = base + n++
        this.entries[key] = text
        this.byText.set(text, key)
        return key
    }
}

/** Text edits over one source file; nested edits are resolved by replaceRange. */
class Edits {
    constructor(source) { this.source = source; this.list = [] }
    add(start, end, text) { this.list.push({ start, end, text }) }
    insert(at, text) { this.add(at, at, text) }
    replaceRange(start, end, text) {
        this.list = this.list.filter(e => e.end <= start || e.start >= end)
        this.add(start, end, text)
    }
    render(start, end) {
        const inside = this.list.filter(e => e.start >= start && e.end <= end)
            .sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start))
        let out = '', pos = start
        for (const e of inside) {
            if (e.start < pos) continue
            out += this.source.slice(pos, e.start) + e.text
            pos = e.end
        }
        return out + this.source.slice(pos, end)
    }
}

export function reindent(text, indent) {
    const lines = text.replace(/\t/g, '    ').split('\n')
    while (lines.length && !lines[0].trim()) lines.shift()
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    const min = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length))
    return lines.map(l => l.trim() ? indent + l.slice(min).trimEnd() : '').join('\n')
}

function lineOf(source, pos) { return source.slice(0, pos).split('\n').length }

/** Start of the comment lines directly above a node (not `//%` annotations). */
function leadingStart(source, start) {
    let lineStart = source.lastIndexOf('\n', start - 1) + 1
    for (;;) {
        if (lineStart === 0) return lineStart
        const prevStart = source.lastIndexOf('\n', lineStart - 2) + 1
        const prev = source.slice(prevStart, lineStart - 1).trim()
        if (!prev.startsWith('//') || prev.startsWith('//%')) return lineStart
        lineStart = prevStart
    }
}

function hasBlockAnnotation(source, start) {
    const before = source.slice(Math.max(0, start - 400), start).split('\n').slice(0, -1).reverse()
    for (const line of before) {
        const t = line.trim()
        if (t.startsWith('//%')) return true
        if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/**')) return false
    }
    return false
}

function declaredNames(ast) {
    const names = new Set()
    const visit = n => {
        if (n.type === 'Function' && n.name) names.add(n.name)
        if (n.type === 'Function') n.params.forEach(p => names.add(p.name))
        if (n.type === 'Declarator' || n.type === 'Enum' || n.type === 'Namespace') names.add(n.name)
        if (n.type === 'ForOf') names.add(n.name)
        children(n).forEach(visit)
    }
    visit(ast)
    return names
}

function numberValue(node) {
    if (!node) return null
    if (node.type === 'Number') return node.value
    if (node.type === 'Unary' && node.operator === '-' && node.argument.type === 'Number') return -node.argument.value
    if (node.type === 'Paren') return numberValue(node.expression)
    return null
}

/**
 * Translate one parsed file. `scope` is the set of names declared in it.
 * Returns an object with edits and helpers for emitting parts of the file.
 */
function translateFile(fileName, source, ast, ctx) {
    const edits = new Edits(source)
    const scope = declaredNames(ast)
    const functions = new Map()
    const collect = n => {
        if (n.type === 'Function' && n.name && !n.expression) functions.set(n.name, n)
        if (n.type === 'Function' && n !== ast) { if (n.name && !n.expression) n.body && children(n.body).forEach(collect); else children(n).forEach(collect); return }
        children(n).forEach(collect)
    }
    collect(ast)
    const isWait = n => n.type === 'Call' && dottedName(n.callee) === 'mod.Wait'
    const callsAsync = (fn, asyncSet) => {
        let found = false
        const visit = n => {
            if (found) return
            if (n.type === 'Function' && n !== fn) return
            if (isWait(n) || (n.type === 'Call' && n.callee.type === 'Identifier' && asyncSet.has(n.callee.name))) { found = true; return }
            children(n).forEach(visit)
        }
        visit(fn.body || fn)
        return found
    }
    const asyncFns = new Set()
    for (let changed = true; changed;) {
        changed = false
        for (const [name, fn] of functions)
            if (!asyncFns.has(name) && callsAsync(fn, asyncFns)) { asyncFns.add(name); changed = true }
    }
    for (const name of asyncFns) {
        const fn = functions.get(name)
        if (!fn.isAsync) edits.insert(fn.keywordStart, 'async ')
    }

    const warn = (pos, message) => ctx.warnings.push(`${fileName} line ${lineOf(source, pos)}: ${message}`)
    const unsupported = []   // statements to comment out

    // Walk a region. `asyncContext` says whether `await` is allowed here.
    function walk(n, stmt, asyncContext) {
        if (n.type === 'Function') {
            const isAsyncFn = n.isAsync || (n.name && asyncFns.has(n.name)) || n.handler
            for (const p of n.params) typeEdit(p.typeRange)
            typeEdit(n.returnType)
            const body = n.body
            if (body.type === 'Block') body.body.forEach(s => walk(s, s, isAsyncFn))
            else walk(body, stmt, isAsyncFn)
            return
        }
        if (n.type === 'Expression' || n.type === 'Var' || n.type === 'Return' || n.type === 'Unsupported') stmt = n
        if (n.type === 'Unsupported') { unsupported.push({ stmt: n, reason: `${n.what} declarations are not converted` }); return }
        if (n.type === 'Declarator') typeEdit(n.typeRange)
        if (n.type === 'As') typeEdit(n.typeRange)
        if (n.type === 'Call') {
            const name = dottedName(n.callee)
            if (name === 'mod.Wait' || (n.callee.type === 'Identifier' && asyncFns.has(n.callee.name))) {
                if (asyncContext) edits.insert(n.start, 'await ')
                else warn(n.start, 'a wait inside this callback cannot pause in Portal (it is not awaited).')
            }
            if (name && name.startsWith('modifiers.')) ctx.errors.push(`${fileName}: modifiers must be literal top-level settings before startGame().`)
            if (name && REWRITES[name]) edits.add(n.callee.start, n.callee.end, REWRITES[name])
            if (name === 'mod.Message') pendingMessages.push(n)
        }
        if (n.type === 'Identifier' || n.type === 'Member') {
            const name = dottedName(n)
            if (name) {
                const root = name.split('.')[0]
                const ok = scope.has(root) || JS_GLOBALS.has(root) || REWRITES[name] ||
                    (root === 'mod' || root === 'weapons') && [...SUPPORTED, ...Object.keys(REWRITES)].some(s => name === s || name.startsWith(s + '.') || s.startsWith(name + '.'))
                if (!ok && !(n.type === 'Member' && (root === 'Math' || root === 'JSON'))) {
                    unsupported.push({ stmt, reason: `${name} is Arcade only` })
                }
                if (n.type === 'Member' && dottedName(n)) return // a whole dotted name; don't revisit its parts
            }
        }
        for (const c of children(n)) walk(c, stmt, asyncContext)
    }

    function typeEdit(range) {
        if (!range) return
        const text = source.slice(range.start, range.end)
        let replaced = text
        for (const [re, to] of TYPE_REWRITES) replaced = replaced.replace(re, to)
        if (/\bshooter\./.test(replaced)) warn(range.start, `the type ${text} is Arcade only.`)
        if (replaced !== text) edits.add(range.start, range.end, replaced)
    }

    // Message text must come from the strings file: string literals become keys,
    // and "text " + value joins become "{}" placeholders.
    const pendingMessages = []
    function finishMessages() {
        for (const call of pendingMessages) {
            const [first, ...rest] = call.args
            if (!first) continue
            const parts = []
            const flatten = n => {
                if (n.type === 'Binary' && n.operator === '+' && (isText(n.left) || isText(n.right) || containsText(n.left))) { flatten(n.left); flatten(n.right) }
                else if (n.type === 'Paren' && containsText(n.expression)) flatten(n.expression)
                else parts.push(n)
            }
            flatten(first)
            if (parts.length === 1 && first.type !== 'String' && !(first.type === 'Template' && !first.hasSubst)) {
                warn(first.start, 'message text should be typed into the message block; Portal reads it from the strings file.')
            } else {
                let format = ''
                const values = []
                for (const part of parts) {
                    if (part.type === 'String') format += part.value
                    else if (part.type === 'Template' && !part.hasSubst) format += part.text
                    else { format += '{}'; values.push(edits.render(part.start, part.end)) }
                }
                if (values.length && rest.length) warn(first.start, 'combine joined text and extra message values carefully: Portal fills {} in order.')
                if (values.length + rest.length > 3) ctx.errors.push(`${fileName} line ${lineOf(source, first.start)}: a Portal message can show at most three values.`)
                edits.replaceRange(first.start, first.end, [`mod.stringkeys.${ctx.strings.key(format)}`, ...values].join(', '))
            }
            for (const arg of rest)
                if (arg.type === 'String') edits.replaceRange(arg.start, arg.end, `mod.stringkeys.${ctx.strings.key(arg.value)}`)
        }
        pendingMessages.length = 0
    }
    const isText = n => n.type === 'String' || n.type === 'Template'
    const containsText = n => isText(n) || (n.type === 'Binary' && n.operator === '+' && (containsText(n.left) || containsText(n.right)))

    function finishUnsupported() {
        const seen = new Set()
        for (const { stmt, reason } of unsupported) {
            if (!stmt || seen.has(stmt)) continue
            seen.add(stmt)
            const text = source.slice(stmt.start, stmt.end)
            warn(stmt.start, `not converted (${reason}): ${text.split('\n')[0].trim()}`)
            edits.replaceRange(stmt.start, stmt.end, `// Not converted, ${reason}: ` + text.replace(/\n/g, '\n// '))
        }
    }

    return {
        source, ast, edits, asyncFns, walk,
        finish() { finishMessages(); finishUnsupported() },
        render: (start, end) => edits.render(start, end),
        nodeText: (n, indent) => reindent(edits.render(leadingStart(source, n.start), n.end), indent)
    }
}

/** Split a list of statements into registrations, declarations and other statements. */
function classify(statements, file, ctx, prefix) {
    const out = { handlers: [], declarations: [], startup: [], settings: [] }
    for (const s of statements) {
        if (s.type === 'Expression' && s.expression.type === 'Call') {
            const call = s.expression
            const name = dottedName(call.callee)
            const event = name && name.startsWith('mod.On') ? name.slice(4) : null
            if (event) {
                if (!EVENTS[event]) { ctx.errors.push(`${file.name} line ${lineOf(file.source, s.start)}: ${name} is not supported.`); continue }
                const fn = call.args[0]
                if (!fn) continue
                if (fn.type === 'Identifier') {
                    // A named function: the Portal event calls it directly.
                    if (prefix) ctx.errors.push(`${file.name} line ${lineOf(file.source, s.start)}: pass the handler as a function, not by name.`)
                    out.handlers.push({ event, name: fn.name, fn, prefix, statement: s, direct: true })
                    continue
                }
                if (fn.type !== 'Function') { ctx.errors.push(`${file.name} line ${lineOf(file.source, s.start)}: ${name} needs a function.`); continue }
                const index = ctx.handlerCount[event] = (ctx.handlerCount[event] || 0) + 1
                fn.handler = true
                out.handlers.push({ event, name: `${event[0].toLowerCase()}${event.slice(1)}${index}`, fn, prefix, statement: s })
                continue
            }
            if (name && (SETTINGS_CALLS.has(name) || name.startsWith('modifiers.'))) { out.settings.push(call); continue }
            if (name === 'shooter.registerMode') continue
        }
        if (s.type === 'Function' || s.type === 'Var' || s.type === 'Enum') out.declarations.push(s)
        else if (s.type !== 'Empty') out.startup.push(s)
    }
    return out
}

function readSettings(calls, ctx) {
    const s = { damage: 34, interval: 750, speed: 80, health: 100, incomingDamagePercent: 100, friendlyFire: false, botSpeed: 10, respawnMs: 5000, mode: 'None', tilemap: null }
    const num = (call, i, key) => {
        const v = numberValue(call.args[i])
        if (v === null) ctx.warnings.push(`main.ts: ${dottedName(call.callee)} argument ${i + 1} is not a plain number; using ${s[key]}.`)
        else s[key] = v
    }
    let started = false
    const limits = { setMaxHealth: [1, 500, 'health'], setIncomingDamagePercent: [0, 200, 'incomingDamagePercent'], setRespawnSeconds: [0, 60, 'respawnMs'] }
    for (const call of calls) {
        const name = dottedName(call.callee)
        if (name === 'shooter.startGame') { started = true; continue }
        if (name && name.startsWith('modifiers.')) {
            const method = name.slice('modifiers.'.length)
            if (!Object.hasOwn(limits, method) && method !== 'setFriendlyFire') { ctx.errors.push(`main.ts: unsupported modifier ${name}.`); continue }
            if (started) { ctx.warnings.push(`main.ts: ${name} after startGame() is ignored, as in Arcade.`); continue }
            if (call.args.length !== 1) { ctx.errors.push(`main.ts: ${name} requires one literal argument.`); continue }
            if (method === 'setFriendlyFire') {
                const arg = call.args[0]
                if (arg.type !== 'Identifier' || !['true', 'false'].includes(arg.name)) ctx.errors.push(`main.ts: ${name} requires a literal boolean.`)
                else s.friendlyFire = arg.name === 'true'
            } else {
                const value = numberValue(call.args[0])
                if (value === null || !Number.isFinite(value)) { ctx.errors.push(`main.ts: ${name} requires a finite literal number.`); continue }
                const [min, max, key] = limits[method]
                const rounded = method === 'setRespawnSeconds' ? value : method === 'setIncomingDamagePercent' ? Math.round(value / 5) * 5 : Math.round(value)
                const clamped = Math.max(min, Math.min(max, rounded))
                s[key] = method === 'setRespawnSeconds' ? clamped * 1000 : clamped
            }
            continue
        }
        if (started) { ctx.warnings.push(`main.ts: ${name} after startGame() is ignored.`); continue }
        if (name === 'shooter.setWeapon') {
            num(call, 0, 'damage'); num(call, 1, 'interval'); num(call, 2, 'speed')
            ctx.warnings.push('Legacy weapon settings are Arcade-only; Portal starts with the pistol, without fire-interval or projectile-speed conversion.')
        }
        else if (name === 'shooter.setSoldiers') {
            num(call, 0, 'health'); num(call, 1, 'botSpeed'); num(call, 2, 'respawnMs')
            s.health = Math.max(1, Math.min(500, Math.round(s.health)))
            s.respawnMs = Math.max(1000, Math.min(60000, Math.round(s.respawnMs)))
        }
        else if (name === 'shooter.setMode') {
            const mode = dottedName(call.args[0])
            if (mode && mode.startsWith('shooter.Mode.')) s.mode = mode.slice('shooter.Mode.'.length)
            else ctx.warnings.push('main.ts: the shooter mode is not a mode block; using no mode.')
        } else if (name === 'deathmatch.configure') s.mode = 'Deathmatch'
        else if (name === 'tiles.setCurrentTilemap' || name === 'tiles.setTilemap') {
            const arg = call.args[0]
            if (arg && arg.type === 'TaggedTemplate') s.tilemap = arg.text.trim()
            else if (arg && arg.type === 'Call' && arg.args[0] && arg.args[0].type === 'TaggedTemplate') s.tilemap = arg.args[0].text.trim()
        }
    }
    return s
}

function parseFile(name, source, ctx) {
    try {
        return parse(source)
    } catch (e) {
        if (e instanceof ParseError) { ctx.errors.push(`${name}: could not read the code: ${e.message}`); return null }
        throw e
    }
}

function handlerFunction(h, file, indent, exported) {
    const event = EVENTS[h.event]
    const fn = h.fn
    const params = fn.params.slice(0, event.types.length).map((p, i) => `${p.name}: ${event.types[i]}`).join(', ')
    let body
    if (fn.type !== 'Function') return null
    if (fn.expressionBody) body = reindent(file.render(fn.body.start, fn.body.end), indent + '    ')
    else body = file.render(fn.body.start + 1, fn.body.end - 1).trim() ? reindent(file.render(fn.body.start + 1, fn.body.end - 1), indent + '    ') : ''
    return `${indent}${exported ? 'export ' : ''}async function ${h.name}(${params}) {\n${body}${body ? '\n' : ''}${indent}}`
}

/**
 * Translate a project's rules. `files` maps file names to source text;
 * `runtime` is the text of portal-runtime.ts. Returns { script, strings, settings, report }.
 */
export function translateProject(files, runtime, projectName) {
    const ctx = { warnings: [], errors: [], strings: new Strings(), handlerCount: {} }
    const mainSource = files['main.ts']
    const mainAst = parseFile('main.ts', mainSource, ctx)
    if (!mainAst) return { script: null, strings: null, settings: null, report: { errors: ctx.errors, warnings: ctx.warnings, handlers: [] } }
    const main = { name: 'main.ts', source: mainSource, ast: mainAst }
    const mainParts = classify(mainAst.body, main, ctx, '')
    const settings = readSettings(mainParts.settings, ctx)

    // The selected mode's rules live in the file that registers it.
    let modeFile = null, modeNamespace = null, modeParts = null
    if (settings.mode !== 'None') {
        for (const [name, source] of Object.entries(files)) {
            if (!name.endsWith('.ts') || !source.includes(`shooter.Mode.${settings.mode}`) || !source.includes('shooter.registerMode')) continue
            const ast = parseFile(name, source, ctx)
            if (!ast) continue
            for (const ns of ast.body.filter(s => s.type === 'Namespace')) {
                const reg = ns.body.find(s => s.type === 'Expression' && s.expression.type === 'Call' && dottedName(s.expression.callee) === 'shooter.registerMode' &&
                    dottedName(s.expression.args[0]) === `shooter.Mode.${settings.mode}`)
                if (!reg) continue
                const rulesName = reg.expression.args[1] && reg.expression.args[1].name
                const rules = ns.body.find(s => s.type === 'Function' && s.name === rulesName)
                if (!rules) continue
                modeFile = { name, source, ast }
                modeNamespace = { node: ns, rules, members: ns.body.filter(s => s !== rules && s !== reg && !(s.type === 'Function' && hasBlockAnnotation(source, s.start))) }
            }
        }
        if (!modeFile) ctx.errors.push(`The ${settings.mode} mode's rules were not found in the project.`)
    }

    // Translate main.ts: everything except the consumed settings calls.
    const mainT = translateFile('main.ts', mainSource, mainAst, ctx)
    for (const d of mainParts.declarations) mainT.walk(d, d, false)
    for (const s of mainParts.startup) mainT.walk(s, s, true)
    for (const h of mainParts.handlers) mainT.walk(h.fn, h.statement, true)
    mainT.finish()

    let modeT = null
    if (modeFile) {
        modeParts = classify(modeNamespace.rules.body.body, modeFile, ctx, modeNamespace.node.name + '.')
        for (const call of modeParts.settings) {
            if (dottedName(call.callee)?.startsWith('modifiers.')) ctx.errors.push(`${modeFile.name}: modifiers belong in main.ts before startGame(), not in mode rules.`)
        }
        modeT = translateFile(modeFile.name, modeFile.source, modeFile.ast, ctx)
        for (const m of modeNamespace.members) modeT.walk(m, m, false)
        for (const d of modeParts.declarations) modeT.walk(d, d, true)
        for (const s of modeParts.startup) modeT.walk(s, s, true)
        for (const h of modeParts.handlers) modeT.walk(h.fn, h.statement, true)
        modeT.finish()
    }

    // Handlers run in Arcade's registration order: main.ts handlers before the
    // "start shooter" block, then the mode's, then the rest of main.ts.
    const startIndex = mainAst.body.findIndex(s => s.type === 'Expression' && dottedName(s.expression.callee) === 'shooter.startGame')
    const startPos = startIndex >= 0 ? mainAst.body[startIndex].start : Infinity
    const ordered = [...mainParts.handlers.filter(h => h.statement.start < startPos), ...(modeParts ? modeParts.handlers : []),
        ...mainParts.handlers.filter(h => h.statement.start >= startPos)]

    const out = []
    const moveSpeed = settings.botSpeed <= 20 ? 'Walk' : settings.botSpeed <= 50 ? 'Run' : 'Sprint'
    const startWeapon = 0
    const settingsText = [
        '    export const settings = {',
        `        health: ${settings.health},`,
        `        incomingDamagePercent: ${settings.incomingDamagePercent},`,
        `        friendlyFire: ${settings.friendlyFire},`,
        `        respawnSeconds: ${settings.respawnMs / 1000},  // time before a soldier returns`,
        `        botMoveSpeed: mod.MoveSpeed.${moveSpeed},  // Arcade bot speed ${settings.botSpeed}`,
        '        teamSize: 2,        // soldiers per team, humans first; at most 2, the bot spawners per team in the map',
        `        startWeapon: ${startWeapon},     // pistol; fire interval does not select a Portal weapon`,
        '        debug: true,        // write runtime notes to PortalLog.txt when hosting locally',
        '    }'
    ].join('\n')
    const runtimeText = runtime.replace(/ *\/\/@settings-start[\s\S]*\/\/@settings-end\r?\n/, settingsText + '\n')

    out.push(`// ${projectName}: Battlefield 6 Portal script converted from a MakeCode Arcade project.`,
        `// Use it with the map edits in ${projectName}.spatial.json (on ${'MP_Portal_Sand'}) and the`,
        `// message text in ${projectName}.strings.json. Generated by the Arcade to Portal converter.`,
        `import * as modlib from 'modlib';`, '', runtimeText.trim(), '')

    const mainDecls = mainParts.declarations.map(d => mainT.nodeText(d, ''))
    const mainStartup = mainParts.startup.map(s => mainT.nodeText(s, '    '))
    const mainHandlers = mainParts.handlers.map(h => handlerFunction(h, mainT, '', false)).filter(Boolean)
    if (mainDecls.length || mainStartup.length || mainHandlers.length) {
        out.push('// ---- Your rules (main.ts) ----', '')
        for (const d of mainDecls) out.push(d, '')
        if (mainStartup.length) out.push('async function startRules() {', ...mainStartup, '}', '')
        for (const h of mainHandlers) out.push(h, '')
    }
    let modeStartup = false
    if (modeT) {
        const ns = modeNamespace.node.name
        out.push(`// ---- ${settings.mode} rules (${modeFile.name}) ----`, '', `namespace ${ns} {`)
        for (const m of modeNamespace.members) out.push(modeT.nodeText(m, '    '), '')
        for (const d of modeParts.declarations) out.push(modeT.nodeText(d, '    '), '')
        if (modeParts.startup.length) {
            modeStartup = true
            out.push('    export async function startRules() {', ...modeParts.startup.map(s => modeT.nodeText(s, '        ')), '    }', '')
        }
        for (const h of modeParts.handlers.filter(h => !h.direct)) out.push(handlerFunction(h, modeT, '    ', true), '')
        if (out[out.length - 1] === '') out.pop()
        out.push('}', '')
    }

    const calls = event => ordered.filter(h => h.event === event).map(h => {
        const args = EVENTS[event].args.split(', ').filter(Boolean)
        return `    ${h.prefix}${h.name}(${(h.direct ? args : args.slice(0, h.fn.params.length)).join(', ')})`
    })
    out.push('// ---- Portal events ----', '',
        'export function OnGameModeStarted(): void {', '    arcade.start()',
        ...(mainStartup.length ? ['    startRules()'] : []), ...(modeStartup ? [`    ${modeNamespace.node.name}.startRules()`] : []),
        ...calls('OnGameModeStarted'), '}', '',
        'export function OnPlayerJoinGame(eventPlayer: mod.Player): void {', '    arcade.joined(eventPlayer)', '}', '',
        'export function OnPlayerLeaveGame(eventNumber: number): void {', '    arcade.left(eventNumber)', '}', '',
        'export function OnSpawnerSpawned(eventPlayer: mod.Player, eventSpawner: mod.Spawner): void {', '    arcade.spawnerSpawned(eventPlayer, eventSpawner)', '}', '',
        `export function OnPlayerDeployed(${EVENTS.OnPlayerDeployed.params}): void {`, '    arcade.deployed(eventPlayer)', ...calls('OnPlayerDeployed'), '}', '',
        `export function OnPlayerDied(${EVENTS.OnPlayerDied.params}): void {`, '    arcade.died(eventPlayer, eventOtherPlayer)', ...calls('OnPlayerDied'), '}', '',
        `export function OnPlayerEarnedKill(${EVENTS.OnPlayerEarnedKill.params}): void {`,
        ...(calls('OnPlayerEarnedKill').length ? ['    // Arcade passes the weapon category; Portal bullets arrive at once, so it is the current one.',
            '    const eventWeapon = weapons.current(eventPlayer)', ...calls('OnPlayerEarnedKill')] : []), '    arcade.showScore()', '}', '')

    return {
        script: out.join('\n'),
        strings: ctx.strings.entries,
        settings,
        report: {
            errors: ctx.errors, warnings: ctx.warnings, mode: settings.mode, modeFile: modeFile && modeFile.name,
            handlers: ordered.map(h => ({ event: h.event, from: h.prefix ? modeFile.name : 'main.ts' })),
            mapped: [
                `Maximum health ${settings.health}; incoming damage ${settings.incomingDamagePercent}% (100 = normal, SDK-based assumption).`,
                `Friendly fire ${settings.friendlyFire ? 'on' : 'off'} for everyone.`,
                'Modifiers use SDK runtime actions, not a website modifier-import file; Builder multipliers are not equivalent to absolute health or respawn seconds.',
                `Respawn delay ${settings.respawnMs} ms: ${settings.respawnMs / 1000} s redeploy time for players and bots.`,
                `Bot speed ${settings.botSpeed}: Portal bots ${moveSpeed.toLowerCase()}.`,
                'Everyone starts with the pistol unless mode rules equip another weapon. Arcade fire interval and projectile speed are not converted.'
            ]
        }
    }
}
