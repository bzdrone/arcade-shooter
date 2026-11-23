// ---- Arcade runtime for Portal ----
// Does in Portal what the Arcade engine did for your rules: fills each team with
// bots, applies the Arcade settings, keeps numbered variables (also for bots,
// which are new Portal players each life), and provides the weapon categories.
namespace arcade {
    //@settings-start
    export const settings = {
        damage: 1,          // Arcade weapon damage per hit
        health: 3,          // Arcade soldier health
        respawnSeconds: 5,  // time before a soldier returns
        botMoveSpeed: mod.MoveSpeed.Walk,
        teamSize: 2,        // soldiers per team, humans first; at most 2, the bot spawners per team in the map
        startWeapon: 0,     // weapons.Kind everyone starts with
        debug: true,        // write runtime notes to PortalLog.txt when hosting locally
    }
    //@settings-end

    const spawnTimeout = 10                // seconds to wait for a requested bot before asking again

    /** The converted map has one AI_Spawner per bot: 111, 112 for team 1 and 121, 122 for team 2. */
    function spawnerId(team: number, index: number): number {
        return 100 + team * 10 + index + 1
    }

    export function log(text: string): void {
        if (!settings.debug) return
        const c = (globalThis as any).console
        if (c && c.log) c.log('[arcade ' + now().toFixed(1) + 's] ' + text)
    }

    function now(): number {
        try { return mod.GetMatchTimeElapsed() } catch { return 0 }
    }

    // A bot "seat" outlives each Portal bot that fills it, so a bot's variables,
    // weapon and counts carry over to its next life as they do in Arcade.
    type SeatState = 'empty' | 'requested' | 'alive' | 'dead'
    interface Seat { team: number; key: string; state: SeatState; since: number; objId: number; spawner: number }
    const seats: Seat[] = []
    const seatOf: { [objId: number]: Seat } = {}
    const lastRequest = [-100, -100, -100]
    const values: { [key: string]: number } = {}
    const weaponKinds: { [key: string]: number } = {}
    const kills: { [key: string]: number } = {}
    const deaths: { [key: string]: number } = {}

    export function teamNumber(team: mod.Team): number {
        if (mod.Equals(team, mod.GetTeam(1))) return 1
        if (mod.Equals(team, mod.GetTeam(2))) return 2
        return 0
    }

    function soldier(player: mod.Player, state: mod.SoldierStateBool): boolean {
        try { return mod.IsPlayerValid(player) && mod.GetSoldierState(player, state) } catch { return false }
    }

    function isBot(player: mod.Player): boolean {
        const seat = seatOf[mod.GetObjId(player)]
        return (seat != undefined && seat.objId == mod.GetObjId(player)) || soldier(player, mod.SoldierStateBool.IsAISoldier)
    }

    /**
     * Give a bot its seat: the one owning the spawner that produced it when known,
     * otherwise one waiting for a requested bot, then any free one.
     * Portal reuses player ids, even across teams, so an id says nothing about which bot it was.
     */
    function claim(player: mod.Player, spawner = -1): Seat {
        const id = mod.GetObjId(player)
        const team = teamNumber(mod.GetTeam(player))
        const free = seats.filter(s => s.team == team && s.state != 'alive')
        let seat = (spawner > 0 ? seats.find(s => s.spawner == spawner) : undefined) ??
            free.find(s => s.state == 'requested') ?? free.find(s => s.state == 'dead') ?? free[0]
        if (!seat) {
            seat = { team, key: 'b' + team + '_' + seats.length, state: 'alive', since: now(), objId: id, spawner: -1 }
            seats.push(seat)
        }
        for (const other of seats)
            if (other !== seat && other.objId == id) {
                markDead(other, 'its player id now belongs to another bot')
                other.objId = -1
            }
        seat.state = 'alive'
        seat.since = now()
        seat.objId = id
        seatOf[id] = seat
        log('bot ' + id + ' on team ' + team + ' takes seat ' + seat.key)
        return seat
    }

    /** A living bot without a current seat (new, or reusing an old bot's id). */
    function needsSeat(player: mod.Player): boolean {
        const seat = seatOf[mod.GetObjId(player)]
        return soldier(player, mod.SoldierStateBool.IsAISoldier) && soldier(player, mod.SoldierStateBool.IsAlive) &&
            (!seat || seat.objId != mod.GetObjId(player) || seat.state != 'alive')
    }

    export function key(player: mod.Player): string {
        const id = mod.GetObjId(player)
        let seat: Seat | undefined = seatOf[id]
        if (needsSeat(player)) seat = claim(player)
        else if (seat && seat.objId != id) seat = undefined
        return seat ? seat.key : 'h' + id
    }

    function humans(team: number): number {
        let count = 0
        for (const player of AllPlayers())
            if (!isBot(player) && teamNumber(mod.GetTeam(player)) == team) count++
        return count
    }

    function markDead(seat: Seat, why: string): void {
        if (seat.state != 'alive') return
        seat.state = 'dead'
        seat.since = now()
        log('seat ' + seat.key + ' is free (' + why + ')')
    }

    /** Once a second: see which bots really exist, then request at most one bot per team. */
    function tick(): void {
        const t = now()
        const players = AllPlayers()
        for (const player of players) if (needsSeat(player)) claim(player)
        for (const seat of seats) {
            if (seat.state == 'alive') {
                const player = players.find(p => mod.GetObjId(p) == seat.objId)
                if (!player) markDead(seat, 'bot left the game')
                else if (!soldier(player, mod.SoldierStateBool.IsAlive)) markDead(seat, 'bot is not alive')
            } else if (seat.state == 'requested' && t - seat.since > spawnTimeout) {
                seat.state = 'empty'
                log('seat ' + seat.key + ': no bot arrived, asking again')
            }
        }
        for (const team of [1, 2]) {
            const wanted = Math.max(0, settings.teamSize - humans(team))
            const active = seats.filter(s => s.team == team && (s.state == 'alive' || s.state == 'requested')).length
            if (active >= wanted || t - lastRequest[team] < 1.5) continue
            const seat = seats.find(s => s.team == team && s.spawner > 0 &&
                (s.state == 'empty' || (s.state == 'dead' && t - s.since >= settings.respawnSeconds)))
            if (!seat) continue
            seat.state = 'requested'
            seat.since = t
            lastRequest[team] = t
            log('team ' + team + ' has ' + active + ' of ' + wanted + ' bots: spawner ' + seat.spawner + ' for seat ' + seat.key)
            // A fixed name per seat: Portal reuses player ids, so a default name can reappear on the other team.
            const name = mod.Message(team == 1 ? mod.stringkeys.arcadeBlueBot : mod.stringkeys.arcadeRedBot, seats.filter(s => s.team == team).indexOf(seat) + 1)
            mod.SpawnAIFromAISpawner(mod.GetSpawner(seat.spawner), name, mod.GetTeam(team))
        }
    }

    async function director(): Promise<void> {
        await mod.Wait(1)
        for (;;) {
            try { tick() } catch (e) { log('bot director error: ' + e) }
            showScore()
            await mod.Wait(1)
        }
    }

    // ---- Hooks called by the generated Portal events ----

    export function start(): void {
        log('game mode started')
        mod.SetFriendlyFire(false)
        for (const team of [1, 2])
            for (let i = 0; i < settings.teamSize; i++) {
                const spawner = spawnerId(team, i)
                seats.push({ team, key: 'b' + team + '_' + i, state: 'empty', since: -100, objId: -1, spawner })
                try { mod.AISetUnspawnOnDead(mod.GetSpawner(spawner), true) } catch (e) { log('spawner ' + spawner + ': ' + e) }
            }
        director()
    }

    export function joined(player: mod.Player): void {
        log('player ' + mod.GetObjId(player) + ' joined' + (isBot(player) ? ' (bot)' : ''))
        if (!isBot(player)) mod.SetRedeployTime(player, settings.respawnSeconds)
    }

    export function left(objId: number): void {
        log('player ' + objId + ' left')
        const seat = seatOf[objId]
        if (seat && seat.objId == objId) markDead(seat, 'bot left the game')
    }

    export function spawnerSpawned(player: mod.Player, spawner: mod.Spawner): void {
        const id = mod.GetObjId(spawner)
        log('spawner ' + id + ' produced bot ' + mod.GetObjId(player))
        claim(player, id)
    }

    export function deployed(player: mod.Player): void {
        const k = key(player)
        const bot = isBot(player)
        log((bot ? 'bot ' : 'player ') + mod.GetObjId(player) + ' deployed on team ' + teamNumber(mod.GetTeam(player)) + ' as ' + k)
        mod.SetPlayerIncomingDamageFactor(player, 3 * settings.damage / Math.max(1, settings.health))
        if (bot) {
            mod.AISetMoveSpeed(player, settings.botMoveSpeed)
            mod.AIBattlefieldBehavior(player)
        } else mod.SetRedeployTime(player, settings.respawnSeconds)
        weapons.newLife(player)
        weapons.give(player, weaponKinds[k] ?? settings.startWeapon)
    }

    export function died(player: mod.Player, killer: mod.Player | undefined): void {
        const k = key(player)
        log('player ' + mod.GetObjId(player) + ' (' + k + ') died')
        deaths[k] = (deaths[k] ?? 0) + 1
        if (killer && !mod.Equals(killer, player)) {
            const kk = key(killer)
            kills[kk] = (kills[kk] ?? 0) + 1
        }
        const seat = seatOf[mod.GetObjId(player)]
        if (seat && seat.objId == mod.GetObjId(player)) markDead(seat, 'bot died')
    }

    // ---- Arcade versions of mod functions whose Portal behaviour differs ----

    export class Variable {
        constructor(public owner: string, public index: number) {}
    }

    export function ObjectVariable(owner: mod.Player | mod.Team, index: number): Variable {
        const name = mod.IsType(owner, mod.Types.Player) ? key(owner as mod.Player) : 't' + teamNumber(owner as mod.Team)
        return new Variable(name, Math.round(index))
    }

    export function GlobalVariable(index: number): Variable {
        return new Variable('g', Math.round(index))
    }

    export function SetVariable(variable: Variable, value: number): void {
        if (variable && variable.index >= 0 && variable.index <= 31) values[variable.owner + ':' + variable.index] = value
    }

    export function GetVariable(variable: Variable): number {
        return variable ? values[variable.owner + ':' + variable.index] ?? 0 : 0
    }

    /** Arcade: a player's win is a win for their team. */
    export function EndGameMode(winner: mod.Player | mod.Team): void {
        if (mod.IsType(winner, mod.Types.Player)) mod.EndGameMode(mod.GetTeam(winner as mod.Player))
        else mod.EndGameMode(winner as mod.Team)
    }

    /** Arcade damage is in Arcade health points; Portal soldiers have 100 health. */
    export function DealDamage(player: mod.Player, amount: number, giver?: mod.Player): void {
        const scaled = amount * 100 / Math.max(1, settings.health)
        if (giver) mod.DealDamage(player, scaled, giver)
        else mod.DealDamage(player, scaled)
    }

    export function GetPlayerKills(player: mod.Player): number {
        return kills[key(player)] ?? 0
    }

    export function GetPlayerDeaths(player: mod.Player): number {
        return deaths[key(player)] ?? 0
    }

    export function AllPlayers(): mod.Player[] {
        return modlib.ConvertArray(mod.AllPlayers()) as mod.Player[]
    }

    export function rememberWeapon(player: mod.Player, kind: number): void {
        weaponKinds[key(player)] = kind
    }

    // ---- Scores, kept the Arcade way ----
    // Portal ends the round by itself when a team reaches the target score, and its team scores
    // changed on their own during play. In Arcade the target is only shown and the rules decide
    // when the match ends, so scores live here (bots' by seat) and are copied to Portal for its
    // scoreboard; the target is never given to Portal.
    const scores: { [key: string]: number } = {}
    let targetScore = 0

    function scoreKey(target: mod.Player | mod.Team): string {
        return mod.IsType(target, mod.Types.Player) ? 'p' + key(target as mod.Player) : 't' + teamNumber(target as mod.Team)
    }

    export function SetGameModeScore(target: mod.Player | mod.Team, score: number): void {
        if (!target) return
        scores[scoreKey(target)] = score
        try {
            if (mod.IsType(target, mod.Types.Player)) mod.SetGameModeScore(target as mod.Player, score)
            else mod.SetGameModeScore(target as mod.Team, score)
        } catch (e) { log('SetGameModeScore error: ' + e) }
    }

    export function GetGameModeScore(target: mod.Player | mod.Team): number {
        return target ? scores[scoreKey(target)] ?? 0 : 0
    }

    export function SetGameModeTargetScore(score: number): void {
        targetScore = score
    }

    export function GetTargetScore(): number {
        return targetScore
    }

    // Arcade's HUD shows both team scores and the target; Portal shows them in the header slot.
    let shownScore = ''

    export function showScore(): void {
        try {
            const blue = GetGameModeScore(mod.GetTeam(1)), red = GetGameModeScore(mod.GetTeam(2)), target = targetScore
            const text = blue + ':' + red + ':' + target
            if (text == shownScore || (!blue && !red && !target)) return
            shownScore = text
            const message = target > 0 ? mod.Message(mod.stringkeys.arcadeScoreTarget, blue, red, target) : mod.Message(mod.stringkeys.arcadeScore, blue, red)
            mod.DisplayCustomNotificationMessage(message, mod.CustomNotificationSlots.HeaderText, 100000)
            const portalBlue = mod.GetGameModeScore(mod.GetTeam(1)), portalRed = mod.GetGameModeScore(mod.GetTeam(2))
            log('score blue ' + blue + ' red ' + red + ' target ' + target +
                (portalBlue != blue || portalRed != red ? ' (Portal has blue ' + portalBlue + ' red ' + portalRed + ')' : ''))
        } catch (e) { log('score display error: ' + e) }
    }

    export function weaponOf(player: mod.Player): number {
        return weaponKinds[key(player)] ?? settings.startWeapon
    }

    export function isAlive(player: mod.Player): boolean {
        return soldier(player, mod.SoldierStateBool.IsAlive)
    }

    // ---- Arcade math and text blocks ----

    export function randint(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    export function constrain(value: number, low: number, high: number): number {
        return Math.min(Math.max(value, low), high)
    }

    export function convertToText(value: any): string {
        return '' + value
    }
}

// ---- Weapons compatibility library, Portal side ----
// Same calls as Arcade's weapons blocks. Each category is one real Portal item;
// change the four items below to pick different weapons.
namespace weapons {
    export enum Kind {
        Pistol,
        SMG,
        Shotgun,
        Knife,
    }

    const pistol = mod.Weapons.Sidearm_M45A1
    const smg = mod.Weapons.SMG_PW5A3
    const shotgun = mod.Weapons.Shotgun_M1014
    const knife = mod.Gadgets.Melee_Combat_Knife
    const clearedSlots = [mod.InventorySlots.PrimaryWeapon, mod.InventorySlots.SecondaryWeapon, mod.InventorySlots.GadgetOne,
        mod.InventorySlots.GadgetTwo, mod.InventorySlots.Throwable, mod.InventorySlots.ClassGadget, mod.InventorySlots.MeleeWeapon]

    // The slot this script filled in each player's current life; until then the deploy loadout is unknown.
    const filled: { [objId: number]: mod.InventorySlots } = {}

    /** Called on each deploy: the soldier starts with their chosen loadout again. */
    export function newLife(player: mod.Player): void {
        delete filled[mod.GetObjId(player)]
    }

    /**
     * Replace the player's equipment with the category's item and switch to it. Arcade has no gadgets or grenades.
     * Like Arcade, the player keeps the category after a death; it is applied again on each deploy.
     */
    export function give(player: mod.Player, kind: number): void {
        arcade.rememberWeapon(player, kind)
        if (!arcade.isAlive(player)) return
        const id = mod.GetObjId(player)
        // RemoveEquipment throws NoWeaponOnSlot for an empty slot; Portal logs it even when caught,
        // so after the first change in a life only the slot this script filled is cleared.
        for (const slot of filled[id] != undefined ? [filled[id]] : clearedSlots) {
            try { mod.RemoveEquipment(player, slot) } catch { /* already empty */ }
        }
        const slot = kind == Kind.SMG || kind == Kind.Shotgun ? mod.InventorySlots.PrimaryWeapon
            : kind == Kind.Knife ? mod.InventorySlots.MeleeWeapon : mod.InventorySlots.SecondaryWeapon
        if (kind == Kind.Knife) mod.AddEquipment(player, knife, slot)
        else mod.AddEquipment(player, kind == Kind.SMG ? smg : kind == Kind.Shotgun ? shotgun : pistol, slot)
        mod.ForceSwitchInventory(player, slot)
        filled[id] = slot
    }

    export function current(player: mod.Player): number {
        return arcade.weaponOf(player)
    }

    export function kind(kind: Kind): number {
        return kind
    }

    /** A string key for messages: Portal message text comes from the strings file. */
    export function name(kind: number): any {
        return [mod.stringkeys.arcadePistol, mod.stringkeys.arcadeSmg, mod.stringkeys.arcadeShotgun, mod.stringkeys.arcadeKnife][kind] ?? mod.stringkeys.arcadeCustom
    }
}
