// Arcade project PNG -> Portal files: map edits, script and strings.
import { readProjectPng, readTilemaps } from './project.js'
import { buildLevel } from './level.js'
import { translateProject } from './translate.js'

/** A file-name-safe version of the project name. */
export function slug(name) {
    return (name || 'arcade-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arcade-project'
}

/**
 * Convert the bytes of an exported Arcade project PNG.
 * `runtime` is the text of portal-runtime.ts.
 */
export async function convertPng(bytes, runtime) {
    const project = await readProjectPng(bytes)
    return convertProject(project, runtime)
}

export function convertProject(project, runtime) {
    const name = slug(project.meta.name || JSON.parse(project.files['pxt.json']).name)
    const rules = translateProject(project.files, runtime, name)
    const errors = [...rules.report.errors]
    const warnings = [...rules.report.warnings]
    const maps = readTilemaps(project.files)
    const mapName = rules.settings && rules.settings.tilemap
    let map = mapName ? maps.get(mapName) : null
    if (!map) {
        const all = [...new Set(maps.values())]
        if (mapName) errors.push(`The tilemap "${mapName}" chosen in main.ts was not found in the project.`)
        else if (all.length === 1) { map = all[0]; warnings.push('main.ts does not set a tilemap; using the only one in the project.') }
        else errors.push('main.ts does not choose a tilemap with "set tilemap to".')
    }
    const level = map ? buildLevel(map) : null
    if (level) { errors.push(...level.report.errors); warnings.push(...level.report.warnings) }
    return {
        name,
        project,
        map,
        level,
        files: errors.length ? null : {
            [`${name}.spatial.json`]: JSON.stringify(level.spatial, null, 2) + '\n',
            [`${name}.ts`]: rules.script,
            [`${name}.strings.json`]: JSON.stringify(rules.strings, null, 2) + '\n'
        },
        script: rules.script,
        report: { errors, warnings, rules: rules.report, level: level && level.report, settings: rules.settings }
    }
}
