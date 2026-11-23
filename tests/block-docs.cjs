// Check the actual tooltips installed on custom blocks by the Arcade editor.
const assert = require('node:assert/strict')

module.exports = async function checkBlockDocs(editor) {
    const expected = {
        shooter_set_weapon: 'both teams',
        shooter_set_enemies: 'computer players',
        shooter_set_mode: 'No mode',
        shooter_start_game: 'blue computer teammate',
        deathmatch_configure: 'first-team-to-ten',
        mod_on_game_mode_started: 'once',
        mod_on_player_deployed: 'eventPlayer',
        mod_on_player_died: 'eventOtherPlayer',
        mod_on_player_earned_kill: 'eventWeapon',
        mod_set_game_mode_score: 'does not end the match',
        mod_get_game_mode_score: 'separate',
        mod_set_target_score: 'does not check for a winner',
        mod_get_target_score: 'goal score',
        mod_end_game_mode: "player's team win",
        mod_get_team: '1 is blue and 2 is red',
        mod_equals: 'teammates',
        mod_all_players: 'all four players',
        mod_get_player_kills: 'separate from their score',
        mod_get_player_deaths: 'died',
        mod_deal_damage: 'self-inflicted',
        mod_object_variable: '0 to 31',
        mod_global_variable: 'shared by everyone',
        mod_set_variable: 'Store a number',
        mod_get_variable: 'returns 0',
        mod_message: 'Each {}',
        mod_display_notification_message: "Portal's 6 seconds",
        mod_display_game_mode_message: 'without pausing play',
        mod_wait: 'rest of the game keeps running',
        weapons_give: 'not Portal inventory items',
        weapons_current: '-1',
        weapons_kind: 'eventWeapon',
        weapons_name: 'text for a message'
    }
    const tooltips = await editor.evaluate(types => {
        const B = pxt.blocks.requireBlockly()
        const workspace = B.common.getMainWorkspace()
        const result = {}
        B.Events.disable()
        try {
            for (const type of types) {
                const block = workspace.newBlock(type)
                try { result[type] = block.getTooltip() }
                finally { block.dispose(false) }
            }
        } finally { B.Events.enable() }
        return result
    }, Object.keys(expected))
    for (const [type, fragment] of Object.entries(expected)) {
        assert.equal(typeof tooltips[type], 'string', `${type} has text help`)
        assert.ok(tooltips[type].includes(fragment), `${type} tooltip includes ${JSON.stringify(fragment)}: ${tooltips[type]}`)
        assert.ok(!tooltips[type].includes('@param'), `${type} does not leak raw JSDoc tags`)
    }
    console.log(`PASS: ${Object.keys(expected).length} custom block tooltips contain creator help in the real editor`)
    return tooltips
}
