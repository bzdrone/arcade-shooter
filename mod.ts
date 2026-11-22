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

    /** Runs once when the match begins. */
    //% blockId=mod_on_game_mode_started block="on game mode started"
    //% group="Events" weight=100
    export function OnGameModeStarted(handler: () => void): void {
        if (handler) gameModeStartedHandlers.push(handler)
    }

    /** Runs each time a player's soldier appears, including the first time. */
    //% blockId=mod_on_player_deployed block="on player deployed"
    //% draggableParameters="reporter"
    //% group="Events" weight=99
    export function OnPlayerDeployed(handler: (eventPlayer: shooter.Player) => void): void {
        if (handler) playerDeployedHandlers.push(handler)
    }

    /** eventPlayer died; eventOtherPlayer eliminated them. For self-inflicted deaths both are the same player. */
    //% blockId=mod_on_player_died block="on player died"
    //% draggableParameters="reporter"
    //% group="Events" weight=98
    export function OnPlayerDied(handler: (eventPlayer: shooter.Player, eventOtherPlayer: shooter.Player) => void): void {
        if (handler) playerDiedHandlers.push(handler)
    }

    /**
     * eventPlayer eliminated eventOtherPlayer using a weapon category (see Weapons), or -1.
     * For self-inflicted deaths both are the same player.
     */
    //% blockId=mod_on_player_earned_kill block="on player earned kill"
    //% draggableParameters="reporter"
    //% group="Events" weight=97
    export function OnPlayerEarnedKill(handler: (eventPlayer: shooter.Player, eventOtherPlayer: shooter.Player, eventWeapon: number) => void): void {
        if (handler) playerEarnedKillHandlers.push(handler)
    }

    // ---- Score and ending ----

    //% blockId=mod_set_game_mode_score block="set game mode score of $target to $score"
    //% group="Score" weight=90
    export function SetGameModeScore(target: shooter.Team | shooter.Player, score: number): void {
        if (target) shooter.setScore(target, score)
    }

    //% blockId=mod_get_game_mode_score block="game mode score of $target"
    //% group="Score" weight=89
    export function GetGameModeScore(target: shooter.Team | shooter.Player): number {
        return target ? shooter.getScore(target) : 0
    }

    //% blockId=mod_set_target_score block="set target score to $score"
    //% group="Score" weight=88
    export function SetGameModeTargetScore(score: number): void {
        shooter.setTargetScore(score)
    }

    //% blockId=mod_get_target_score block="target score"
    //% group="Score" weight=87
    export function GetTargetScore(): number {
        return shooter.getTargetScore()
    }

    /** End the match. A winning player wins for their team. */
    //% blockId=mod_end_game_mode block="end game mode winner $winner"
    //% group="Score" weight=86
    export function EndGameMode(winner: shooter.Team | shooter.Player): void {
        if (winner) shooter.endMatch(winner)
    }

    // ---- Teams and players ----

    /** The team of a player, or team 1 (blue) / team 2 (red) by number, as in Portal. */
    //% blockId=mod_get_team block="team of $target"
    //% group="Teams" weight=80
    export function GetTeam(target: shooter.Player | number): shooter.Team {
        if (target instanceof shooter.Player) return shooter.getTeam(target)
        return shooter.teamById((target as number) - 1)
    }

    /** True when two players, teams or values are the same. */
    //% blockId=mod_equals block="$left is same as $right"
    //% group="Teams" weight=79
    export function Equals(left: any, right: any): boolean {
        return left == right
    }

    //% blockId=mod_all_players block="all players"
    //% group="Players" weight=70
    export function AllPlayers(): shooter.Player[] {
        return shooter.allPlayers()
    }

    //% blockId=mod_get_player_kills block="eliminations by $player"
    //% group="Players" weight=69
    export function GetPlayerKills(player: shooter.Player): number {
        return player ? shooter.getEliminations(player) : 0
    }

    //% blockId=mod_get_player_deaths block="deaths of $player"
    //% group="Players" weight=68
    export function GetPlayerDeaths(player: shooter.Player): number {
        return player ? shooter.getDeaths(player) : 0
    }

    /** Damage a player. Omitting damageGiver is self-inflicted damage. */
    //% blockId=mod_deal_damage block="deal $damageAmount damage to $player||from $damageGiver"
    //% group="Players" weight=67
    export function DealDamage(player: shooter.Player, damageAmount: number, damageGiver: shooter.Player = null): void {
        if (player) shooter.dealDamage(player, damageAmount, damageGiver)
    }

    // ---- Variables ----

    /** Slot index (0-31) owned by a player or team; player slots survive respawn. */
    //% blockId=mod_object_variable block="variable $index of $owner"
    //% index.min=0 index.max=31
    //% group="Variables" weight=60
    export function ObjectVariable(owner: shooter.Player | shooter.Team, index: number): Variable {
        return new Variable(owner, Math.round(index))
    }

    /** Slot index (0-31) shared by the whole game. */
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

    //% blockId=mod_get_variable block="value of $variable"
    //% group="Variables" weight=57
    export function GetVariable(variable: Variable): number {
        if (!variable || variable.index < 0 || variable.index > 31) return 0
        if (variable.owner instanceof shooter.Player) return shooter.getVariable(variable.owner as shooter.Player, variable.index)
        const slots = slotsFor(variable)
        return variable.index < slots.length ? slots[variable.index] : 0
    }

    // ---- Messages ----

    /** Text with up to three {} placeholders filled by text, numbers or players. */
    //% blockId=mod_message block="message $text||$a $b $c"
    //% text.defl="hello {}" inlineInputMode=inline
    //% group="Messages" weight=50
    export function Message(text: string, a: string | number | shooter.Player = null, b: string | number | shooter.Player = null, c: string | number | shooter.Player = null): string {
        return messages.text(text, a, b, c)
    }

    /** Short message at the top of the screen. No target means everyone. */
    //% blockId=mod_display_notification_message block="show notification $message||to $target"
    //% group="Messages" weight=49
    export function DisplayNotificationMessage(message: string, target: shooter.Player | shooter.Team = null): void {
        messages.notify(message, target)
    }

    /** Large centred message. No target means everyone. */
    //% blockId=mod_display_game_mode_message block="show game mode message $message||to $target"
    //% group="Messages" weight=48
    export function DisplayGameModeMessage(message: string, target: shooter.Player | shooter.Team = null): void {
        messages.announce(message, target)
    }

    // ---- Timing ----

    /** Pause only this event handler; the game keeps running. */
    //% blockId=mod_wait block="wait $seconds seconds"
    //% seconds.defl=1
    //% group="Timing" weight=40
    export function Wait(seconds: number): void {
        pause(Math.max(0, seconds) * 1000)
    }
}
