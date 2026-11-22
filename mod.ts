// Portal-shaped scripting layer: a small subset of Battlefield 6 Portal's `mod`
// names, argument order and event shapes, mapped onto the shooter engine.
// It is Portal-shaped, not Portal-compatible; PORTAL.md lists the porting fix-ups.
//% color=#2E5FA8 weight=60 block="Mod"
//% groups='["Events", "Score", "Teams", "Players", "Variables", "Messages", "Timing"]'
namespace mod {
    /** A numeric slot owned by a player, a team, or the whole game (owner null). */
    export class Variable {
        constructor(public owner: shooter.Player | shooter.Team, public index: number) {}
    }

    let gameModeStartedHandlers: (() => void)[] = []
    let playerDeployedHandlers: ((player: shooter.Player) => void)[] = []
    let playerDiedHandlers: ((player: shooter.Player, otherPlayer: shooter.Player) => void)[] = []
    let playerEarnedKillHandlers: ((player: shooter.Player, otherPlayer: shooter.Player, weapon: number) => void)[] = []
    let modStarting = false
    let modRunning = false
    let pendingDeployments: shooter.Player[] = []
    let globalSlots: number[] = []
    let blueSlots: number[] = []
    let redSlots: number[] = []

    // Bridge engine events. Start and the first deployments wait for the first
    // frame, so handlers registered anywhere in the program still see them.
    shooter.onMatchStarted(function () { modStarting = true })
    shooter.onDeployed(function (player) {
        if (modRunning) dispatchDeployed(player)
        else pendingDeployments.push(player)
    })
    shooter.onElimination(function (attacker, victim, weapon) {
        const kind = weapons.kindOf(weapon)
        for (let i = 0; i < playerDiedHandlers.length; i++) playerDiedHandlers[i](victim, attacker)
        for (let i = 0; i < playerEarnedKillHandlers.length; i++) playerEarnedKillHandlers[i](attacker, victim, kind)
    })
    game.onUpdate(function () {
        if (!modStarting || modRunning) return
        modRunning = true
        for (let i = 0; i < gameModeStartedHandlers.length; i++) gameModeStartedHandlers[i]()
        const initial = pendingDeployments
        pendingDeployments = []
        for (let i = 0; i < initial.length; i++) if (shooter.isAlive(initial[i])) dispatchDeployed(initial[i])
    })

    function dispatchDeployed(player: shooter.Player): void {
        for (let i = 0; i < playerDeployedHandlers.length; i++) playerDeployedHandlers[i](player)
    }

    // ---- Events ----

    /**
     * Run these blocks once when the match begins. Use this to set up your rules.
     * @param handler blocks to run at the start of the match
     */
    //% blockId=mod_on_game_mode_started block="on game mode started"
    //% group="Events" weight=100
    export function OnGameModeStarted(handler: () => void): void {
        if (handler) gameModeStartedHandlers.push(handler)
    }

    /**
     * Run these blocks whenever a soldier enters the game, including after a death.
     * eventPlayer is the player whose soldier appeared.
     * @param handler blocks to run each time a soldier appears
     */
    //% blockId=mod_on_player_deployed block="on player deployed"
    //% draggableParameters="reporter"
    //% group="Events" weight=99
    export function OnPlayerDeployed(handler: (eventPlayer: shooter.Player) => void): void {
        if (handler) playerDeployedHandlers.push(handler)
    }

    /**
     * Run these blocks when a soldier dies. eventPlayer died; eventOtherPlayer caused the death.
     * For a self-inflicted death, both values are the same player.
     * @param handler blocks to run when a soldier dies
     */
    //% blockId=mod_on_player_died block="on player died"
    //% draggableParameters="reporter"
    //% group="Events" weight=98
    export function OnPlayerDied(handler: (eventPlayer: shooter.Player, eventOtherPlayer: shooter.Player) => void): void {
        if (handler) playerDiedHandlers.push(handler)
    }

    /**
     * Run these blocks when a player earns an elimination. eventPlayer caused it; eventOtherPlayer died.
     * For a self-inflicted death, both values are the same player; check before awarding points.
     * In Arcade, eventWeapon is a Weapons category number, or -1 for custom weapons or scripted damage.
     * @param handler blocks to run after an elimination
     */
    //% blockId=mod_on_player_earned_kill block="on player earned kill"
    //% draggableParameters="reporter"
    //% group="Events" weight=97
    export function OnPlayerEarnedKill(handler: (eventPlayer: shooter.Player, eventOtherPlayer: shooter.Player, eventWeapon: number) => void): void {
        if (handler) playerEarnedKillHandlers.push(handler)
    }

    // ---- Score and ending ----

    /**
     * Replace a team or player's current score. To add a point, read the score and add 1.
     * Setting a score does not end the match automatically; use end game mode in your rules.
     * @param target team or player whose score to change
     * @param score new score, a whole number of zero or more
     */
    //% blockId=mod_set_game_mode_score block="set game mode score of $target to $score"
    //% group="Score" weight=90
    export function SetGameModeScore(target: shooter.Team | shooter.Player, score: number): void {
        if (target) shooter.setScore(target, score)
    }

    /**
     * Read a team or player's current score. Team and personal scores are separate.
     * @param target team or player whose score to read
     */
    //% blockId=mod_get_game_mode_score block="game mode score of $target"
    //% group="Score" weight=89
    export function GetGameModeScore(target: shooter.Team | shooter.Player): number {
        return target ? shooter.getScore(target) : 0
    }

    /**
     * Set the score that your rules use as the goal. This does not check for a winner by itself.
     * @param score goal score; 0 hides the goal on Arcade's team score display
     */
    //% blockId=mod_set_target_score block="set target score to $score"
    //% group="Score" weight=88
    export function SetGameModeTargetScore(score: number): void {
        shooter.setTargetScore(score)
    }

    /** Read the goal score, so your rules can compare it with the current score. */
    //% blockId=mod_get_target_score block="target score"
    //% group="Score" weight=87
    export function GetTargetScore(): number {
        return shooter.getTargetScore()
    }

    /**
     * End the match and show the winning team. In Arcade, choosing a player makes that player's team win.
     * Portal can instead name an individual player as the winner.
     * @param winner winning team, or a player on the winning team
     */
    //% blockId=mod_end_game_mode block="end game mode winner $winner"
    //% group="Score" weight=86
    export function EndGameMode(winner: shooter.Team | shooter.Player): void {
        if (winner) shooter.endMatch(winner)
    }

    // ---- Teams and players ----

    /**
     * Find a player's team, or choose a team by number: 1 is blue and 2 is red.
     * Arcade has no neutral team; other numbers return no team.
     * @param target player to look up, or team number 1 or 2
     */
    //% blockId=mod_get_team block="team of $target"
    //% group="Teams" weight=80
    export function GetTeam(target: shooter.Player | number): shooter.Team {
        if (target instanceof shooter.Player) return shooter.getTeam(target)
        return shooter.teamById((target as number) - 1)
    }

    /**
     * Check whether two values are the same. For example, compare two players' teams to check for teammates.
     * @param left first player, team, or value to compare
     * @param right second player, team, or value to compare
     */
    //% blockId=mod_equals block="$left is same as $right"
    //% group="Teams" weight=79
    export function Equals(left: any, right: any): boolean {
        return left == right
    }

    /** List all four players, including computer-controlled players and players waiting to return after a death. */
    //% blockId=mod_all_players block="all players"
    //% group="Players" weight=70
    export function AllPlayers(): shooter.Player[] {
        return shooter.allPlayers()
    }

    /**
     * Read how many eliminations this player has earned during the match. This is separate from their score.
     * @param player player whose eliminations to count
     */
    //% blockId=mod_get_player_kills block="eliminations by $player"
    //% group="Players" weight=69
    export function GetPlayerKills(player: shooter.Player): number {
        return player ? shooter.getEliminations(player) : 0
    }

    /**
     * Read how many times this player's soldier has died during the match.
     * @param player player whose deaths to count
     */
    //% blockId=mod_get_player_deaths block="deaths of $player"
    //% group="Players" weight=68
    export function GetPlayerDeaths(player: shooter.Player): number {
        return player ? shooter.getDeaths(player) : 0
    }

    /**
     * Take health away from a player's living soldier. Enough damage causes a death and the usual events.
     * Without a damage giver, Arcade treats the damage as self-inflicted. Scripted damage can hurt teammates.
     * @param player player whose soldier takes damage
     * @param damageAmount health to take away, rounded to a whole number
     * @param damageGiver optional player responsible for the damage
     */
    //% blockId=mod_deal_damage block="deal $damageAmount damage to $player||from $damageGiver"
    //% group="Players" weight=67
    export function DealDamage(player: shooter.Player, damageAmount: number, damageGiver: shooter.Player = null): void {
        if (player) shooter.dealDamage(player, damageAmount, damageGiver)
    }

    // ---- Variables ----

    /**
     * Choose a numbered place to remember a value for one player or team. Use set variable or value of variable with it.
     * Arcade stores numbers in slots 0 to 31; each starts at 0. A player's values survive their soldier's death.
     * @param owner player or team that owns this value
     * @param index slot number from 0 to 31
     */
    //% blockId=mod_object_variable block="variable $index of $owner"
    //% index.min=0 index.max=31
    //% group="Variables" weight=60
    export function ObjectVariable(owner: shooter.Player | shooter.Team, index: number): Variable {
        return new Variable(owner, Math.round(index))
    }

    /**
     * Choose a numbered place to remember a value for the whole match, shared by everyone.
     * Arcade stores numbers in slots 0 to 31; each starts at 0.
     * @param index slot number from 0 to 31
     */
    //% blockId=mod_global_variable block="global variable $index"
    //% index.min=0 index.max=31
    //% group="Variables" weight=59
    export function GlobalVariable(index: number): Variable {
        return new Variable(null, Math.round(index))
    }

    function slotsFor(variable: Variable): number[] {
        if (!variable.owner) return globalSlots
        return variable.owner == shooter.teamById(0) ? blueSlots : redSlots
    }

    /**
     * Store a number in the chosen variable. For example, remember a player's streak separately from their score.
     * @param variable place to store the number, chosen with variable of or global variable
     * @param value number to remember
     */
    //% blockId=mod_set_variable block="set $variable to $value"
    //% group="Variables" weight=58
    export function SetVariable(variable: Variable, value: number): void {
        if (!variable || variable.index < 0 || variable.index > 31) return
        if (variable.owner instanceof shooter.Player) {
            shooter.setVariable(variable.owner as shooter.Player, variable.index, value)
            return
        }
        const slots = slotsFor(variable)
        while (slots.length <= variable.index) slots.push(0)
        slots[variable.index] = value
    }

    /**
     * Read the number remembered in the chosen variable. A slot that has not been set returns 0.
     * @param variable place to read, chosen with variable of or global variable
     */
    //% blockId=mod_get_variable block="value of $variable"
    //% group="Variables" weight=57
    export function GetVariable(variable: Variable): number {
        if (!variable || variable.index < 0 || variable.index > 31) return 0
        if (variable.owner instanceof shooter.Player) return shooter.getVariable(variable.owner as shooter.Player, variable.index)
        const slots = slotsFor(variable)
        return variable.index < slots.length ? slots[variable.index] : 0
    }

    // ---- Messages ----

    /**
     * Build message text, then show it with a notification or game mode message block.
     * Each {} is a blank filled by the next value. Arcade accepts typed text; Portal uses keys from a strings file.
     * @param text message text with up to three {} blanks
     * @param a text, number, or player name for the first blank
     * @param b value for the second blank
     * @param c value for the third blank
     */
    //% blockId=mod_message block="message $text||$a $b $c"
    //% text.defl="hello {}" inlineInputMode=inline
    //% group="Messages" weight=50
    export function Message(text: string, a: string | number | shooter.Player = null, b: string | number | shooter.Player = null, c: string | number | shooter.Player = null): string {
        return messages.text(text, a, b, c)
    }

    /**
     * Show a short message at the top without pausing play. In Arcade it lasts about 2 seconds, not Portal's 6 seconds.
     * Omit the target for everyone. On this shared screen, messages only for red or a computer player are not shown.
     * @param message text built with the message block
     * @param target optional player or team that should see the message
     */
    //% blockId=mod_display_notification_message block="show notification $message||to $target"
    //% group="Messages" weight=49
    export function DisplayNotificationMessage(message: string, target: shooter.Player | shooter.Team = null): void {
        messages.notify(message, target)
    }

    /**
     * Show a large message in the middle without pausing play. In Arcade it lasts about 2 seconds.
     * Omit the target for everyone. On this shared screen, messages only for red or a computer player are not shown.
     * @param message text built with the message block
     * @param target optional player or team that should see the message
     */
    //% blockId=mod_display_game_mode_message block="show game mode message $message||to $target"
    //% group="Messages" weight=48
    export function DisplayGameModeMessage(message: string, target: shooter.Player | shooter.Team = null): void {
        messages.announce(message, target)
    }

    // ---- Timing ----

    /**
     * Wait before running the next block in this event. The rest of the game keeps running.
     * @param seconds time to wait in seconds; 0.5 is half a second
     */
    //% blockId=mod_wait block="wait $seconds seconds"
    //% seconds.defl=1
    //% group="Timing" weight=40
    export function Wait(seconds: number): void {
        pause(Math.max(0, seconds) * 1000)
    }
}
