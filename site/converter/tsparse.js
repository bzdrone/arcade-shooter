// A small parser for the TypeScript subset found in MakeCode Arcade programs
// (Blocks output and simple hand-written rules). Every node keeps its source
// range [start, end), so translations can be made as text edits that preserve
// the author's layout and comments. Types are skipped and recorded as ranges.

const PUNCTUATORS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.',
    '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
    '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '?', ':', '=', '.', '@']

export class ParseError extends Error {
    constructor(message, source, pos) {
        const line = source.slice(0, pos).split('\n').length
        super(`${message} (line ${line})`)
        this.pos = pos
        this.line = line
    }
}

export function tokenize(src) {
    const tokens = []
    let i = 0, nl = false
    while (i < src.length) {
        const c = src[i]
        if (c === '\n') { nl = true; i++; continue }
        if (/\s/.test(c)) { i++; continue }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2)
            if (end < 0) throw new ParseError('Unclosed comment', src, i)
            if (src.slice(i, end).includes('\n')) nl = true
            i = end + 2
            continue
        }
        const start = i
        let tok
        if (/[A-Za-z_$]/.test(c)) {
            while (i < src.length && /[\w$]/.test(src[i])) i++
            tok = { t: 'name', v: src.slice(start, i) }
        } else if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1]))) {
            if (c === '0' && /[xXbBoO]/.test(src[i + 1])) { i += 2; while (/[\da-fA-F_]/.test(src[i])) i++ }
            else {
                while (/[\d_]/.test(src[i])) i++
                if (src[i] === '.') { i++; while (/[\d_]/.test(src[i])) i++ }
                if (/[eE]/.test(src[i])) { i++; if (/[+-]/.test(src[i])) i++; while (/\d/.test(src[i])) i++ }
            }
            tok = { t: 'number', v: src.slice(start, i) }
        } else if (c === '"' || c === "'") {
            i++
            let value = ''
            while (i < src.length && src[i] !== c) {
                if (src[i] === '\n') throw new ParseError('Unclosed string', src, start)
                if (src[i] === '\\') {
                    const e = src[i + 1]
                    value += { n: '\n', t: '\t', r: '\r', '0': '\0' }[e] ?? e
                    i += 2
                } else value += src[i++]
            }
            if (i >= src.length) throw new ParseError('Unclosed string', src, start)
            i++
            tok = { t: 'string', v: value }
        } else if (c === '`') {
            i++
            let depth = 0, hasSubst = false
            while (i < src.length) {
                if (depth === 0 && src[i] === '`') break
                if (src[i] === '\\') { i += 2; continue }
                if (depth === 0 && src[i] === '$' && src[i + 1] === '{') { depth = 1; hasSubst = true; i += 2; continue }
                if (depth > 0 && src[i] === '{') depth++
                else if (depth > 0 && src[i] === '}') depth--
                i++
            }
            if (i >= src.length) throw new ParseError('Unclosed template', src, start)
            i++
            tok = { t: 'template', v: src.slice(start + 1, i - 1), hasSubst }
        } else {
            const p = PUNCTUATORS.find(p => src.startsWith(p, i))
            if (!p) throw new ParseError(`Unexpected character ${JSON.stringify(c)}`, src, i)
            i += p.length
            tok = { t: 'punct', v: p }
        }
        tok.start = start
        tok.end = i
        tok.nl = nl
        nl = false
        tokens.push(tok)
    }
    tokens.push({ t: 'eof', v: '', start: src.length, end: src.length, nl: true })
    return tokens
}

const BINARY = [
    ['??'], ['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!=', '===', '!=='],
    ['<', '>', '<=', '>=', 'instanceof', 'in'], ['<<', '>>', '>>>'], ['+', '-'], ['*', '/', '%'], ['**']
]
const ASSIGN = ['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=']

export function parse(src) {
    const tokens = tokenize(src)
    let p = 0
    const peek = (o = 0) => tokens[Math.min(p + o, tokens.length - 1)]
    const at = v => peek().v === v && peek().t !== 'string' && peek().t !== 'template'
    const fail = (msg, tok = peek()) => { throw new ParseError(msg, src, tok.start) }
    const next = () => tokens[p++]
    const expect = v => { if (!at(v)) fail(`Expected "${v}" but found "${peek().v || 'end of file'}"`); return next() }
    const node = (type, start, props) => ({ type, start, end: tokens[p - 1].end, ...props })
    const eat = v => at(v) ? next() : null

    // ---- Types: skipped, but their range is kept for rewriting ----
    function skipBalanced(open, close) {
        let depth = 0
        do {
            const t = next()
            if (t.t === 'eof') fail('Unbalanced brackets in type')
            if (t.t === 'punct') {
                if (t.v === open) depth++
                else if (t.v === close) depth--
                else if (open === '<' && /^>+$/.test(t.v)) depth -= t.v.length
            }
        } while (depth > 0)
    }
    function parseType() {
        const start = peek().start
        eat('|'); eat('&')
        do {
            if (at('(')) { skipBalanced('(', ')'); if (eat('=>')) parseType() }
            else if (at('{')) skipBalanced('{', '}')
            else if (at('[')) skipBalanced('[', ']')
            else if (at('typeof') || at('keyof')) { next(); parseType() }
            else if (peek().t === 'string' || peek().t === 'number') next()
            else {
                if (peek().t !== 'name') fail('Expected a type')
                next()
                while (at('.')) { next(); next() }
                if (at('<')) skipBalanced('<', '>')
            }
            while (at('[') && peek(1).v === ']') { next(); next() }
        } while (eat('|') || eat('&'))
        return { start, end: tokens[p - 1].end }
    }

    // ---- Statements ----
    function parseBlock() {
        const start = expect('{').start
        const body = []
        while (!at('}')) {
            if (peek().t === 'eof') fail('Missing "}"')
            body.push(parseStatement())
        }
        next()
        return node('Block', start, { body })
    }
    function endStatement() {
        if (eat(';')) return
        if (at('}') || peek().t === 'eof' || peek().nl) return
        fail(`Unexpected "${peek().v}"`)
    }
    function parseParams() {
        expect('(')
        const params = []
        while (!at(')')) {
            const start = peek().start
            eat('...')
            if (peek().t !== 'name') fail('Expected a parameter name')
            const name = next().v
            eat('?')
            const type = eat(':') ? parseType() : null
            const init = eat('=') ? parseAssign() : null
            params.push(node('Param', start, { name, typeRange: type, init }))
            if (!eat(',')) break
        }
        expect(')')
        return params
    }
    function parseFunctionRest(start, extra) {
        const name = peek().t === 'name' && !at('(') ? next().v : null
        const params = parseParams()
        const returnType = eat(':') ? parseType() : null
        const body = parseBlock()
        return node('Function', start, { name, params, returnType, body, ...extra })
    }
    function parseVar(start, kind) {
        const decls = []
        do {
            const dStart = peek().start
            if (peek().t !== 'name') fail('Expected a variable name')
            const name = next().v
            const type = eat(':') ? parseType() : null
            const init = eat('=') ? parseAssign() : null
            decls.push(node('Declarator', dStart, { name, typeRange: type, init }))
        } while (eat(','))
        return node('Var', start, { kind, decls })
    }
    function parseStatement() {
        const tok = peek()
        const start = tok.start
        if (tok.t === 'name') {
            switch (tok.v) {
                case 'export': {
                    next()
                    if (at('default')) fail('"export default" is not supported')
                    const inner = parseStatement()
                    inner.exported = true
                    inner.start = start
                    return inner
                }
                case 'declare': fail('"declare" is not supported')
                // falls through
                case 'async':
                    if (peek(1).v === 'function') { next(); next(); return parseFunctionRest(start, { isAsync: true, keywordStart: start }) }
                    break
                case 'function': next(); return parseFunctionRest(start, { keywordStart: start })
                case 'namespace': case 'module': {
                    next()
                    let name = next().v
                    while (eat('.')) name += '.' + next().v
                    const body = parseBlock()
                    return node('Namespace', start, { name, body: body.body, bodyRange: body })
                }
                case 'let': case 'const': case 'var': {
                    if (tok.v === 'const' && peek(1).v === 'enum') { next(); return parseEnum(start) }
                    next()
                    const decl = parseVar(start, tok.v)
                    endStatement()
                    decl.end = tokens[p - 1].end
                    return decl
                }
                case 'enum': return parseEnum(start)
                case 'class': case 'interface': case 'abstract': {
                    while (!at('{')) { if (peek().t === 'eof') fail('Unexpected end'); next() }
                    skipBalanced('{', '}')
                    return node('Unsupported', start, { what: tok.v })
                }
                case 'type':
                    if (peek(1).t === 'name' && peek(2).v === '=') {
                        next(); next(); next(); parseType(); endStatement()
                        return node('Unsupported', start, { what: 'type' })
                    }
                    break
                case 'if': {
                    next(); expect('(')
                    const test = parseExpression()
                    expect(')')
                    const consequent = parseStatement()
                    const alternate = eat('else') ? parseStatement() : null
                    return node('If', start, { test, consequent, alternate })
                }
                case 'for': {
                    next(); expect('(')
                    if ((at('let') || at('const') || at('var')) && peek(1).t === 'name' && (peek(2).v === 'of' || peek(2).v === 'in')) {
                        const kind = next().v
                        const declStart = peek().start
                        const name = next().v
                        const of = next().v
                        const iterable = parseExpression()
                        expect(')')
                        const body = parseStatement()
                        return node('ForOf', start, { kind, name, nameStart: declStart, of, iterable, body })
                    }
                    let init = null
                    if (!at(';')) {
                        if (at('let') || at('const') || at('var')) { const s = peek().start; const k = next().v; init = parseVar(s, k) }
                        else init = parseExpression()
                    }
                    expect(';')
                    const test = at(';') ? null : parseExpression()
                    expect(';')
                    const update = at(')') ? null : parseExpression()
                    expect(')')
                    const body = parseStatement()
                    return node('For', start, { init, test, update, body })
                }
                case 'while': {
                    next(); expect('(')
                    const test = parseExpression()
                    expect(')')
                    return node('While', start, { test, body: parseStatement() })
                }
                case 'do': {
                    next()
                    const body = parseStatement()
                    expect('while'); expect('(')
                    const test = parseExpression()
                    expect(')')
                    endStatement()
                    return node('DoWhile', start, { body, test })
                }
                case 'return': {
                    next()
                    const argument = at(';') || at('}') || peek().nl || peek().t === 'eof' ? null : parseExpression()
                    endStatement()
                    return node('Return', start, { argument })
                }
                case 'break': case 'continue': next(); endStatement(); return node(tok.v === 'break' ? 'Break' : 'Continue', start, {})
                case 'switch': {
                    next(); expect('(')
                    const discriminant = parseExpression()
                    expect(')'); expect('{')
                    const cases = []
                    while (!eat('}')) {
                        const cStart = peek().start
                        let test = null
                        if (eat('default')) expect(':')
                        else { expect('case'); test = parseExpression(); expect(':') }
                        const body = []
                        while (!at('case') && !at('default') && !at('}')) body.push(parseStatement())
                        cases.push(node('Case', cStart, { test, body }))
                    }
                    return node('Switch', start, { discriminant, cases })
                }
                case 'throw': case 'try': fail(`"${tok.v}" is not supported`)
            }
        }
        if (at('{')) return parseBlock()
        if (at(';')) { next(); return node('Empty', start, {}) }
        const expression = parseExpression()
        endStatement()
        return node('Expression', start, { expression })
    }
    function parseEnum(start) {
        expect('enum')
        const name = next().v
        skipBalanced('{', '}')
        return node('Enum', start, { name })
    }

    // ---- Expressions ----
    function parseExpression() {
        const start = peek().start
        const first = parseAssign()
        if (!at(',')) return first
        const expressions = [first]
        while (eat(',')) expressions.push(parseAssign())
        return node('Sequence', start, { expressions })
    }
    function tryArrow() {
        const save = p
        const start = peek().start
        let isAsync = false
        if (at('async') && (peek(1).v === '(' || (peek(1).t === 'name' && peek(2).v === '=>'))) { next(); isAsync = true }
        if (peek().t === 'name' && peek(1).v === '=>') {
            const param = next()
            next()
            return arrowBody(start, [{ type: 'Param', name: param.v, start: param.start, end: param.end, typeRange: null }], isAsync)
        }
        if (!at('(')) { p = save; return null }
        try {
            const params = parseParams()
            if (eat(':')) parseType()
            if (!at('=>')) { p = save; return null }
            next()
            return arrowBody(start, params, isAsync)
        } catch (e) {
            if (!(e instanceof ParseError)) throw e
            p = save
            return null
        }
    }
    function arrowBody(start, params, isAsync) {
        if (at('{')) return node('Function', start, { name: null, params, body: parseBlock(), arrow: true, isAsync })
        const body = parseAssign()
        return node('Function', start, { name: null, params, body, arrow: true, expressionBody: true, isAsync })
    }
    function parseAssign() {
        const arrow = tryArrow()
        if (arrow) return arrow
        const start = peek().start
        const left = parseConditional()
        if (peek().t === 'punct' && ASSIGN.includes(peek().v)) {
            const operator = next().v
            const right = parseAssign()
            return node('Assign', start, { operator, left, right })
        }
        return left
    }
    function parseConditional() {
        const start = peek().start
        const test = parseBinary(0)
        if (!eat('?')) return test
        const consequent = parseAssign()
        expect(':')
        const alternate = parseAssign()
        return node('Conditional', start, { test, consequent, alternate })
    }
    function parseBinary(level) {
        if (level >= BINARY.length) return parseUnary()
        const start = peek().start
        let left = parseBinary(level + 1)
        for (;;) {
            const t = peek()
            if (t.t === 'string' || t.t === 'template' || !BINARY[level].includes(t.v)) break
            next()
            const right = level === BINARY.length - 1 ? parseBinary(level) : parseBinary(level + 1)
            left = node('Binary', start, { operator: t.v, left, right })
            if (level === BINARY.length - 1) break
        }
        return left
    }
    function parseUnary() {
        const start = peek().start
        const t = peek()
        if (t.t === 'punct' && ['!', '-', '+', '~'].includes(t.v) || t.t === 'name' && ['typeof', 'void', 'delete', 'await'].includes(t.v)) {
            next()
            return node('Unary', start, { operator: t.v, argument: parseUnary() })
        }
        if (t.t === 'punct' && (t.v === '++' || t.v === '--')) {
            next()
            return node('Update', start, { operator: t.v, prefix: true, argument: parseUnary() })
        }
        let expression = parsePostfix()
        if (peek().t === 'punct' && (at('++') || at('--')) && !peek().nl)
            expression = node('Update', start, { operator: next().v, prefix: false, argument: expression })
        while (at('as') && !peek().nl) {
            next()
            const typeRange = parseType()
            expression = node('As', start, { expression, typeRange })
        }
        return expression
    }
    function parseArguments() {
        expect('(')
        const args = []
        while (!at(')')) {
            args.push(parseAssign())
            if (!eat(',')) break
        }
        expect(')')
        return args
    }
    function parsePostfix() {
        const start = peek().start
        let expression = parsePrimary()
        for (;;) {
            if (at('.') || at('?.')) {
                const optional = next().v === '?.'
                if (optional && at('(')) { expression = node('Call', start, { callee: expression, args: parseArguments(), optional }); continue }
                const prop = next()
                if (prop.t !== 'name') fail('Expected a property name', prop)
                expression = node('Member', start, { object: expression, property: prop.v, propertyStart: prop.start })
            } else if (at('(') && !peek().nl) {
                expression = node('Call', start, { callee: expression, args: parseArguments() })
            } else if (at('[') && !peek().nl) {
                next()
                const index = parseExpression()
                expect(']')
                expression = node('Index', start, { object: expression, index })
            } else if (peek().t === 'template' && !peek().nl) {
                const quasi = next()
                expression = node('TaggedTemplate', start, { tag: expression, text: quasi.v })
            } else if (at('!') && !peek().nl && !['=', '=='].includes(peek(1).v)) {
                next()
                expression = node('NonNull', start, { expression })
            } else break
        }
        return expression
    }
    function parsePrimary() {
        const t = peek()
        const start = t.start
        if (t.t === 'number') { next(); return node('Number', start, { raw: t.v, value: Number(t.v.replace(/_/g, '')) }) }
        if (t.t === 'string') { next(); return node('String', start, { value: t.v }) }
        if (t.t === 'template') { next(); return node('Template', start, { text: t.v, hasSubst: t.hasSubst }) }
        if (t.t === 'name') {
            if (t.v === 'function') { next(); return parseFunctionRest(start, { expression: true, keywordStart: start }) }
            if (t.v === 'async' && peek(1).v === 'function') { next(); next(); return parseFunctionRest(start, { expression: true, isAsync: true }) }
            if (t.v === 'new') {
                next()
                let callee = parsePrimary()
                while (at('.')) { next(); const prop = next(); callee = node('Member', start, { object: callee, property: prop.v, propertyStart: prop.start }) }
                if (at('<')) skipBalanced('<', '>')
                const args = at('(') ? parseArguments() : []
                return node('New', start, { callee, args })
            }
            next()
            return node('Identifier', start, { name: t.v })
        }
        if (at('(')) {
            next()
            const expression = parseExpression()
            expect(')')
            return node('Paren', start, { expression })
        }
        if (at('[')) {
            next()
            const elements = []
            while (!at(']')) { eat('...'); elements.push(parseAssign()); if (!eat(',')) break }
            expect(']')
            return node('Array', start, { elements })
        }
        if (at('{')) {
            next()
            const properties = []
            while (!at('}')) {
                const pStart = peek().start
                const key = next()
                if (eat(':')) properties.push(node('Property', pStart, { key: key.v, value: parseAssign() }))
                else if (at('(')) {
                    p--
                    next()
                    const fn = parseFunctionRest(peek().start, { expression: true })
                    properties.push(node('Property', pStart, { key: key.v, value: fn }))
                } else properties.push(node('Property', pStart, { key: key.v, value: node('Identifier', key.start, { name: key.v }) }))
                if (!eat(',')) break
            }
            expect('}')
            return node('Object', start, { properties })
        }
        fail(t.t === 'eof' ? 'Unexpected end of file' : `Unexpected "${t.v}"`)
    }

    const body = []
    while (peek().t !== 'eof') body.push(parseStatement())
    return { type: 'Program', start: 0, end: src.length, body }
}

const CHILD_KEYS = ['body', 'params', 'init', 'test', 'update', 'consequent', 'alternate', 'iterable', 'argument', 'discriminant', 'cases',
    'expression', 'expressions', 'decls', 'left', 'right', 'object', 'index', 'callee', 'args', 'elements', 'properties', 'value', 'tag']

/** Child nodes of a node, in source order. */
export function children(node) {
    const out = []
    for (const key of CHILD_KEYS) {
        const value = node[key]
        if (!value) continue
        if (Array.isArray(value)) { for (const v of value) if (v && typeof v === 'object' && v.type) out.push(v) }
        else if (typeof value === 'object' && value.type) out.push(value)
    }
    return out.sort((a, b) => a.start - b.start)
}

/** "mod.Wait" for a member chain of identifiers, otherwise null. */
export function dottedName(node) {
    if (!node) return null
    if (node.type === 'Identifier') return node.name
    if (node.type === 'Member') {
        const object = dottedName(node.object)
        return object ? `${object}.${node.property}` : null
    }
    return null
}
