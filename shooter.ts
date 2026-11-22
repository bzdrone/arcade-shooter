// Two teams, two players each. The engine owns match state; modes own rules.
//% color=#C75050 weight=100 block="Shooter"
namespace shooter {
    let weaponDamage = 1
    let fireInterval = 750
    let projectileSpeed = 80
    let soldierHealth = 3
    let botSpeed = 10
    let respawnDelay = 5000
    let started = false
    let finished = false
    let player: Sprite = null
    let facingX = 1
    let facingY = 0
    export enum Mode {
        //% block="deathmatch"
        Deathmatch,
        //% block="gun game"
        GunGame,
        //% block="no mode"
        None
    }
    let selectedMode = Mode.None
    let targetScore = 0
    let deployedHandlers: ((player: Player) => void)[] = []
    let eliminationHandlers: ((attacker: Player, victim: Player, weapon: Weapon) => void)[] = []
    const soldierKind = SpriteKind.create()
    const blueShotKind = SpriteKind.create()
    const redShotKind = SpriteKind.create()
    const spentShotKind = SpriteKind.create()
    let blueSpawns: tiles.Location[] = []
    let redSpawns: tiles.Location[] = []
    let players: Player[] = []
    let shots: Shot[] = []

    export class Weapon {
        constructor(public damage: number, public interval: number, public speed: number, public range: number, public color: number, public name: string) {}
    }

    // One body, discarded on death. No match-long identity lives here.
    class Soldier {
        health = soldierHealth
        nextShotAt = 0
        navigation: pathing.Bot = null
        field: pathing.Field = new pathing.Field()
        constructor(public sprite: Sprite) {}
    }

    export class Team {
        score = 0
        constructor(public id: number) {}
    }
    let teams: Team[] = [new Team(0), new Team(1)]

    export class Player {
        soldier: Soldier = null
        respawnAt = 0
        score = 0
        eliminations = 0
        deaths = 0
        variables: number[] = []
        name: string
        constructor(public team: number, public human: boolean, public spawnIndex: number, public weapon: Weapon) {
            this.name = human ? "YOU" : team == 0 ? "BLUE BOT" : "RED " + (spawnIndex + 1)
        }
    }

    class Shot {
        constructor(public sprite: Sprite, public attacker: Player, public damage: number, public weapon: Weapon) {}
    }

    /** Range is capped by the existing 2.5-second lifetime; color 0 keeps team colors. */
    export function createWeapon(damage: number, interval: number, speed: number, range: number = 200, color: number = 0, name: string = null): Weapon {
        speed = Math.max(10, Math.round(speed))
        range = Math.max(1, Math.min(speed * 2.5, Math.round(range)))
        return new Weapon(Math.max(1, Math.round(damage)), Math.max(50, Math.round(interval)), speed, range, Math.max(0, Math.min(15, Math.round(color))), name ? name : "Custom")
    }

    /** New shots use this weapon; existing shots and the current cooldown are unchanged. */
    export function giveWeapon(player: Player, weapon: Weapon): void {
        if (player && weapon) player.weapon = weapon
    }

    /** Register mode rules before starting the match. */
    export function onElimination(handler: (attacker: Player, victim: Player, weapon: Weapon) => void): void {
        if (!started && handler) eliminationHandlers.push(handler)
    }

    export function onDeployed(handler: (player: Player) => void): void {
        if (!started && handler) deployedHandlers.push(handler)
    }

    export function allPlayers(): Player[] { return players.slice() }
    export function teamById(id: number): Team { return id == 0 || id == 1 ? teams[id] : null }
    export function getTeam(player: Player): Team { return teams[player.team] }
    export function isHuman(player: Player): boolean { return player.human }
    export function getDisplayName(player: Player): string { return player.name }
    export function isAlive(player: Player): boolean { return player.soldier != null }
    export function getEliminations(player: Player): number { return player.eliminations }
    export function getDeaths(player: Player): number { return player.deaths }

    export function getScore(target: Team | Player): number { return target.score }
    export function setScore(target: Team | Player, score: number): void {
        if (!finished) target.score = Math.max(0, Math.round(score))
    }
    export function setTargetScore(score: number): void {
        if (!finished) targetScore = Math.max(0, Math.round(score))
    }
    export function getTargetScore(): number { return targetScore }

    /** Numeric slots start at zero and survive every soldier body. */
    export function getVariable(player: Player, index: number): number {
        index = Math.round(index)
        if (index < 0 || index >= player.variables.length) return 0
        return player.variables[index]
    }
    export function setVariable(player: Player, index: number, value: number): void {
        index = Math.round(index)
        if (index < 0 || index > 31 || finished) return
        while (player.variables.length <= index) player.variables.push(0)
        player.variables[index] = value
    }

    /** A player winner wins for their team in this 2v2 engine. */
    export function endMatch(winner: Team | Player): void {
        if (!started || finished) return
        finished = true
        // Paint the final mode status before game-over captures the background.
        pause(50)
        const winningTeam = winner instanceof Team ? winner : getTeam(winner)
        game.over(winningTeam.id == 0)
    }

    /** Last selection before startup wins. No mode runs combat without rules. */
    //% blockId=shooter_set_mode block="set shooter mode $mode"
    //% mode.defl=shooter.Mode.Deathmatch weight=75
    export function setMode(mode: Mode): void {
        if (!started) selectedMode = mode
    }

    /** Shared starting weapon for every player. Configure before starting. */
    //% blockId=shooter_set_weapon block="set weapon damage $damage fire interval (ms) $interval projectile speed $speed"
    //% damage.defl=1 damage.min=1 interval.defl=750 interval.min=50 speed.defl=80 speed.min=10
    //% weight=90
    export function setWeapon(damage: number, interval: number, speed: number): void {
        if (started) return
        const weapon = createWeapon(damage, interval, speed)
        weaponDamage = weapon.damage
        fireInterval = weapon.interval
        projectileSpeed = weapon.speed
    }

    /** Shared health/respawn settings; speed applies equally to all three bots. */
    // Retain the original settings block ID so existing block references remain stable.
    //% blockId=shooter_set_enemies block="set soldier health $hitPoints bot speed $speed respawn delay (ms) $interval"
    //% hitPoints.defl=3 hitPoints.min=1 speed.defl=10 speed.min=1 interval.defl=5000 interval.min=1000
    //% weight=80
    export function setSoldiers(hitPoints: number, speed: number, interval: number): void {
        if (started) return
        soldierHealth = Math.max(1, Math.round(hitPoints))
        botSpeed = Math.max(1, Math.round(speed))
        respawnDelay = Math.max(1000, Math.round(interval))
    }

    function playerFor(sprite: Sprite): Player {
        for (let i = 0; i < players.length; i++) if (players[i].soldier && players[i].soldier.sprite == sprite) return players[i]
        return null
    }

    function retire(owner: Player): void {
        const sprite = owner.soldier.sprite
        owner.soldier = null
        owner.respawnAt = game.runtime() + respawnDelay
        if (owner.human) {
            controller.moveSprite(sprite, 0, 0)
            player = null
        }
        sprite.destroy()
    }

    function deployed(owner: Player): void {
        for (let i = 0; i < deployedHandlers.length; i++) deployedHandlers[i](owner)
    }

    function spawn(owner: Player, now: number, notify: boolean = true): void {
        const entries = owner.team == 0 ? blueSpawns : redSpawns
        for (let offset = 0; offset < entries.length; offset++) {
            const index = (owner.spawnIndex + offset) % entries.length
            const location = entries[index]
            if (!pathing.walkable(location.column, location.row)) continue
            const x = (location.column + 0.5) * pathing.size()
            const y = (location.row + 0.5) * pathing.size()
            let occupied = false
            for (let i = 0; i < players.length; i++) {
                const other = players[i].soldier ? players[i].soldier.sprite : null
                if (other && Math.abs(other.x - x) < 12 && Math.abs(other.y - y) < 12) occupied = true
            }
            if (occupied) continue
            const picture = img`
                . . 8 8 8 8 . .
                . 8 8 8 8 8 8 .
                8 8 1 8 8 1 8 8
                8 8 f 8 8 f 8 8
                8 8 8 8 8 8 8 8
                . 8 8 8 8 8 8 .
                . 8 . 8 8 . 8 .
                . 8 . . . . 8 .
            `
            if (owner.team == 1) picture.replace(8, 2)
            // White helmet stripe distinguishes the human from the blue bot.
            if (owner.human) for (let x = 2; x <= 5; x++) picture.setPixel(x, 0, 1)
            const sprite = sprites.create(picture, soldierKind)
            tiles.placeOnTile(sprite, location)
            sprite.setStayInScreen(true)
            const soldier = new Soldier(sprite)
            owner.soldier = soldier
            soldier.nextShotAt = now + owner.weapon.interval
            owner.spawnIndex = (index + 1) % entries.length
            soldier.field.refresh(sprite, now, true)
            if (owner.human) {
                player = sprite
                facingX = 1
                facingY = 0
                controller.moveSprite(sprite, 70, 70)
            } else {
                soldier.navigation = new pathing.Bot(sprite, botSpeed)
            }
            if (notify) deployed(owner)
            return
        }
        // Occupied/blocked points delay this player; never create another slot.
    }

    function fire(owner: Player, dx: number, dy: number, now: number): void {
        const soldier = owner.soldier
        const weapon = owner.weapon
        if (now < soldier.nextShotAt) return
        const picture = img`5 5
                            5 5`
        picture.replace(5, weapon.color > 0 ? weapon.color : owner.team == 0 ? 5 : 3)
        const shot = sprites.createProjectileFromSprite(picture, soldier.sprite, dx * weapon.speed, dy * weapon.speed)
        shots.push(new Shot(shot, owner, weapon.damage, weapon))
        shot.setKind(owner.team == 0 ? blueShotKind : redShotKind)
        shot.setFlag(SpriteFlag.DestroyOnWall, true)
        shot.lifespan = Math.min(2500, Math.max(1, Math.floor(weapon.range * 1000 / weapon.speed)))
        soldier.nextShotAt = now + weapon.interval
    }

    function forgetShot(sprite: Sprite): void {
        for (let i = shots.length - 1; i >= 0; i--) if (shots[i].sprite == sprite) shots.removeAt(i)
    }

    function hit(shot: Sprite, sprite: Sprite, team: number, kind: number): void {
        if (finished || shot.kind() != kind) return
        const victim = playerFor(sprite)
        if (!victim || victim.team == team) return // Friendly shots pass through.
        let fired: Shot = null
        for (let i = 0; i < shots.length; i++) if (shots[i].sprite == shot) fired = shots[i]
        if (!fired) return
        shot.setKind(spentShotKind)
        shots.removeElement(fired)
        shot.destroy()
        dealDamage(victim, fired.damage, fired.attacker, fired.weapon)
    }

    /** Generic scripted damage. Omitting the attacker is self-inflicted damage. */
    export function dealDamage(victim: Player, damage: number, attacker: Player = null, weapon: Weapon = null): void {
        if (finished || !victim || !victim.soldier || damage <= 0) return
        victim.soldier.health -= Math.max(0, Math.round(damage))
        if (victim.soldier.health > 0) return
        if (!attacker) attacker = victim
        victim.deaths++
        if (attacker != victim) attacker.eliminations++
        retire(victim) // Untrack before destruction or event callbacks run.
        for (let i = 0; i < eliminationHandlers.length; i++) eliminationHandlers[i](attacker, victim, weapon)
    }

    function targetFor(owner: Player, now: number): Soldier {
        const soldier = owner.soldier
        let target: Soldier = null
        let best = 1000000
        const column = Math.floor(soldier.sprite.x / pathing.size())
        const row = Math.floor(soldier.sprite.y / pathing.size())
        for (let i = 0; i < players.length; i++) {
            const other = players[i].soldier
            if (!other || players[i].team == owner.team) continue
            other.field.refresh(other.sprite, now)
            if (!other.field.reachable(column, row)) continue
            const dx = other.sprite.x - soldier.sprite.x
            const dy = other.sprite.y - soldier.sprite.y
            const distance = other.field.distances[row * pathing.width() + column] * pathing.size()
                + Math.sqrt(dx * dx + dy * dy) / 1000
            if (distance < best) {
                best = distance
                target = other
            }
        }
        return target
    }

    function updateBot(owner: Player, now: number): void {
        const soldier = owner.soldier
        const target = targetFor(owner, now)
        soldier.sprite.vx = 0
        soldier.sprite.vy = 0
        if (!target) return
        const dx = target.sprite.x - soldier.sprite.x
        const dy = target.sprite.y - soldier.sprite.y
        if (Math.abs(dx) <= owner.weapon.range && Math.abs(dy) <= 3 && pathing.clearLine(soldier.sprite.x, soldier.sprite.y, target.sprite.x, soldier.sprite.y)) {
            fire(owner, dx < 0 ? -1 : 1, 0, now)
        } else if (Math.abs(dy) <= owner.weapon.range && Math.abs(dx) <= 3 && pathing.clearLine(soldier.sprite.x, soldier.sprite.y, soldier.sprite.x, target.sprite.y)) {
            fire(owner, 0, dy < 0 ? -1 : 1, now)
        } else {
            soldier.navigation.update(target.sprite, target.field)
        }
    }

    /** Start the 2v2 engine. Select mode rules before starting. */
    //% blockId=shooter_start_game block="start shooter"
    //% weight=70
    export function startGame(): void {
        if (started) return
        if (selectedMode == Mode.Deathmatch) deathmatch.initialize()
        else if (selectedMode == Mode.GunGame) gungame.initialize()
        started = true
        scene.setBackgroundColor(15)
        game.setGameOverScoringType(game.ScoringType.None)
        game.setGameOverMessage(true, "BLUE TEAM WINS")
        game.setGameOverMessage(false, "RED TEAM WINS")
        pathing.loadMap()
        blueSpawns = tiles.getTilesByType(myTiles.blueSpawn)
        redSpawns = tiles.getTilesByType(myTiles.redSpawn)
        let validBlue = 0
        let validRed = 0
        for (let i = 0; i < blueSpawns.length; i++) if (pathing.walkable(blueSpawns[i].column, blueSpawns[i].row)) validBlue++
        for (let i = 0; i < redSpawns.length; i++) if (pathing.walkable(redSpawns[i].column, redSpawns[i].row)) validRed++
        if (validBlue < 2 || validRed < 2) {
            finished = true
            game.splash("Add two walkable blue and two red spawn tiles.")
            game.over(false)
            return
        }
        const weapon = createWeapon(weaponDamage, fireInterval, projectileSpeed)
        players = [new Player(0, true, 0, weapon), new Player(0, false, 1, weapon), new Player(1, false, 0, weapon), new Player(1, false, 1, weapon)]
        sprites.onDestroyed(soldierKind, function (sprite) {
            const owner = playerFor(sprite)
            if (owner) retire(owner) // External removal is not an elimination.
        })
        sprites.onDestroyed(blueShotKind, forgetShot)
        sprites.onDestroyed(redShotKind, forgetShot)
        sprites.onDestroyed(spentShotKind, forgetShot)
        sprites.onOverlap(blueShotKind, soldierKind, function (shot, sprite) { hit(shot, sprite, 0, blueShotKind) })
        sprites.onOverlap(redShotKind, soldierKind, function (shot, sprite) { hit(shot, sprite, 1, redShotKind) })
        const now = game.runtime()
        for (let i = 0; i < players.length; i++) spawn(players[i], now, false)
        for (let i = 0; i < blueSpawns.length + redSpawns.length; i++) {
            const location = i < blueSpawns.length ? blueSpawns[i] : redSpawns[i - blueSpawns.length]
            if (!players[0].soldier.field.reachable(location.column, location.row)) {
                finished = true
                game.splash("Connect every spawn tile with walkable floor.")
                game.over(false)
                return
            }
        }
        for (let i = 0; i < players.length; i++) deployed(players[i])
        scene.createRenderable(100, function (target) {
            target.fillRect(0, 0, scene.screenWidth(), 9, 15)
            target.print("BLUE " + teams[0].score + "  RED " + teams[1].score, 2, 1, 1, image.font5)
            target.fillRect(0, 112, scene.screenWidth(), 8, 15)
            const human = players[0]
            let status = "YOU HP " + (human.soldier ? human.soldier.health : 0) + (targetScore > 0 ? "  FIRST TO " + targetScore : "")
            if (human.score > 0) status = "YOU HP " + (human.soldier ? human.soldier.health : 0) + " SCORE " + human.score + "/" + targetScore
            if (!human.soldier) {
                const seconds = Math.max(0, Math.ceil((human.respawnAt - game.runtime()) / 1000))
                status = seconds > 0 ? "RESPAWN IN " + seconds + "s" : "WAITING FOR BLUE SPAWN"
            }
            target.print(status, 2, 113, 1, image.font5)
            messages.draw(target)
            for (let i = 0; i < players.length; i++) {
                const soldier = players[i].soldier
                if (soldier) {
                    const width = Math.max(1, Math.round(6 * soldier.health / soldierHealth))
                    target.fillRect(soldier.sprite.x - 3, soldier.sprite.y - 6, 6, 1, 15)
                    target.fillRect(soldier.sprite.x - 3, soldier.sprite.y - 6, width, 1, players[i].team == 0 ? 9 : 2)
                }
            }
        })
        game.onUpdate(function () {
            if (finished) return
            const now = game.runtime()
            messages.update(now)
            for (let i = 0; i < players.length; i++) {
                const owner = players[i]
                if (!owner.soldier && now >= owner.respawnAt) spawn(owner, now)
                if (!owner.soldier) continue
                if (owner.human) {
                    if (player.vx != 0 || player.vy != 0) {
                        if (Math.abs(player.vx) >= Math.abs(player.vy)) {
                            facingX = player.vx > 0 ? 1 : -1
                            facingY = 0
                        } else {
                            facingX = 0
                            facingY = player.vy > 0 ? 1 : -1
                        }
                    }
                    if (controller.A.isPressed()) fire(owner, facingX, facingY, now)
                } else updateBot(owner, now)
            }
        })
    }
}
