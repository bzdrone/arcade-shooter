// Two teams, two soldiers each. The human and every bot share combat rules.
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
    let blueScore = 0
    let redScore = 0
    const soldierKind = SpriteKind.create()
    const blueShotKind = SpriteKind.create()
    const redShotKind = SpriteKind.create()
    const spentShotKind = SpriteKind.create()
    let blueSpawns: tiles.Location[] = []
    let redSpawns: tiles.Location[] = []
    let soldiers: Soldier[] = []

    class Soldier {
        sprite: Sprite = null
        health = 0
        respawnAt = 0
        nextShotAt = 0
        navigation: pathing.Bot = null
        field: pathing.Field = new pathing.Field()
        constructor(public team: number, public human: boolean, public spawnIndex: number) {}
    }

    /** Shared weapon settings for every soldier. Configure before starting. */
    //% blockId=shooter_set_weapon block="set weapon damage $damage fire interval (ms) $interval projectile speed $speed"
    //% damage.defl=1 damage.min=1 interval.defl=750 interval.min=50 speed.defl=80 speed.min=10
    //% weight=90
    export function setWeapon(damage: number, interval: number, speed: number): void {
        if (started) return
        weaponDamage = Math.max(1, Math.round(damage))
        fireInterval = Math.max(50, Math.round(interval))
        projectileSpeed = Math.max(10, Math.round(speed))
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

    function soldierFor(sprite: Sprite): Soldier {
        for (let i = 0; i < soldiers.length; i++) if (soldiers[i].sprite == sprite) return soldiers[i]
        return null
    }

    function retire(soldier: Soldier): void {
        const sprite = soldier.sprite
        soldier.sprite = null
        soldier.navigation = null
        soldier.health = 0
        soldier.respawnAt = game.runtime() + respawnDelay
        if (soldier.human) {
            controller.moveSprite(sprite, 0, 0)
            player = null
        }
        sprite.destroy()
    }

    function spawn(soldier: Soldier, now: number): void {
        const entries = soldier.team == 0 ? blueSpawns : redSpawns
        for (let offset = 0; offset < entries.length; offset++) {
            const index = (soldier.spawnIndex + offset) % entries.length
            const location = entries[index]
            if (!pathing.walkable(location.column, location.row)) continue
            const x = (location.column + 0.5) * pathing.size()
            const y = (location.row + 0.5) * pathing.size()
            let occupied = false
            for (let i = 0; i < soldiers.length; i++) {
                const other = soldiers[i].sprite
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
            if (soldier.team == 1) picture.replace(8, 2)
            // White helmet stripe distinguishes the human from the blue bot.
            if (soldier.human) for (let x = 2; x <= 5; x++) picture.setPixel(x, 0, 1)
            const sprite = sprites.create(picture, soldierKind)
            tiles.placeOnTile(sprite, location)
            sprite.setStayInScreen(true)
            soldier.sprite = sprite
            soldier.health = soldierHealth
            soldier.nextShotAt = now + fireInterval
            soldier.spawnIndex = (index + 1) % entries.length
            soldier.field.refresh(sprite, now, true)
            if (soldier.human) {
                player = sprite
                facingX = 1
                facingY = 0
                controller.moveSprite(sprite, 70, 70)
            } else {
                soldier.navigation = new pathing.Bot(sprite, botSpeed)
            }
            return
        }
        // An occupied/blocked point delays this slot; it never creates another soldier.
    }

    function fire(soldier: Soldier, dx: number, dy: number, now: number): void {
        if (now < soldier.nextShotAt) return
        const picture = img`5 5
                            5 5`
        if (soldier.team == 1) picture.replace(5, 3)
        const shot = sprites.createProjectileFromSprite(picture, soldier.sprite, dx * projectileSpeed, dy * projectileSpeed)
        shot.setKind(soldier.team == 0 ? blueShotKind : redShotKind)
        shot.setFlag(SpriteFlag.DestroyOnWall, true)
        shot.lifespan = 2500
        soldier.nextShotAt = now + fireInterval
    }

    function hit(shot: Sprite, sprite: Sprite, team: number, kind: number): void {
        if (finished || shot.kind() != kind) return
        const soldier = soldierFor(sprite)
        if (!soldier || soldier.team == team) return // Friendly shots pass through; no friendly fire.
        shot.setKind(spentShotKind)
        shot.destroy()
        soldier.health -= weaponDamage
        if (soldier.health > 0) return
        retire(soldier) // Remove before destruction events or stale overlaps can run.
        if (team == 0) blueScore++
        else redScore++
        if (blueScore >= 10 || redScore >= 10) {
            finished = true
            // Paint the final point before game-over captures the scene background.
            pause(50)
            game.over(blueScore >= 10)
        }
    }

    function targetFor(soldier: Soldier, now: number): Soldier {
        let target: Soldier = null
        let best = 1000000
        const column = Math.floor(soldier.sprite.x / pathing.size())
        const row = Math.floor(soldier.sprite.y / pathing.size())
        for (let i = 0; i < soldiers.length; i++) {
            const other = soldiers[i]
            if (!other.sprite || other.team == soldier.team) continue
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

    function updateBot(soldier: Soldier, now: number): void {
        const target = targetFor(soldier, now)
        soldier.sprite.vx = 0
        soldier.sprite.vy = 0
        if (!target) return
        const dx = target.sprite.x - soldier.sprite.x
        const dy = target.sprite.y - soldier.sprite.y
        if (Math.abs(dy) <= 3 && pathing.clearLine(soldier.sprite.x, soldier.sprite.y, target.sprite.x, soldier.sprite.y)) {
            fire(soldier, dx < 0 ? -1 : 1, 0, now)
        } else if (Math.abs(dx) <= 3 && pathing.clearLine(soldier.sprite.x, soldier.sprite.y, soldier.sprite.x, target.sprite.y)) {
            fire(soldier, 0, dy < 0 ? -1 : 1, now)
        } else {
            soldier.navigation.update(target.sprite, target.field)
        }
    }

    /** Start a 2v2 match. Blue: human + bot. Red: two bots. First team to 10 wins. */
    //% blockId=shooter_start_game block="start shooter"
    //% weight=70
    export function startGame(): void {
        if (started) return
        started = true
        scene.setBackgroundColor(15)
        game.setGameOverScoringType(game.ScoringType.None)
        game.setGameOverMessage(true, "BLUE TEAM WINS")
        game.setGameOverMessage(false, "RED TEAM WINS")
        pathing.loadMap()
        blueSpawns = tiles.getTilesByType(myTiles.blueSpawn)
        redSpawns = tiles.getTilesByType(myTiles.redSpawn)
        // Require two usable points per team so the opening match is genuinely 2v2.
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
        soldiers = [new Soldier(0, true, 0), new Soldier(0, false, 1), new Soldier(1, false, 0), new Soldier(1, false, 1)]
        sprites.onDestroyed(soldierKind, function (sprite) {
            const soldier = soldierFor(sprite)
            if (soldier) retire(soldier) // External removal schedules a respawn, but awards no point.
        })
        sprites.onOverlap(blueShotKind, soldierKind, function (shot, sprite) { hit(shot, sprite, 0, blueShotKind) })
        sprites.onOverlap(redShotKind, soldierKind, function (shot, sprite) { hit(shot, sprite, 1, redShotKind) })
        const now = game.runtime()
        for (let i = 0; i < soldiers.length; i++) spawn(soldiers[i], now)
        for (let i = 0; i < blueSpawns.length + redSpawns.length; i++) {
            const location = i < blueSpawns.length ? blueSpawns[i] : redSpawns[i - blueSpawns.length]
            if (!soldiers[0].field.reachable(location.column, location.row)) {
                finished = true
                game.splash("Connect every spawn tile with walkable floor.")
                game.over(false)
                return
            }
        }
        scene.createRenderable(100, function (target) {
            target.fillRect(0, 0, scene.screenWidth(), 9, 15)
            target.print("BLUE " + blueScore + "  RED " + redScore, 2, 1, 1, image.font5)
            target.fillRect(0, 112, scene.screenWidth(), 8, 15)
            const human = soldiers[0]
            let status = "YOU HP " + human.health + "  FIRST TO 10"
            if (!human.sprite) {
                const seconds = Math.max(0, Math.ceil((human.respawnAt - game.runtime()) / 1000))
                status = seconds > 0 ? "RESPAWN IN " + seconds + "s" : "WAITING FOR BLUE SPAWN"
            }
            target.print(status, 2, 113, 1, image.font5)
            for (let i = 0; i < soldiers.length; i++) {
                const soldier = soldiers[i]
                if (soldier.sprite) {
                    const width = Math.max(1, Math.round(6 * soldier.health / soldierHealth))
                    target.fillRect(soldier.sprite.x - 3, soldier.sprite.y - 6, 6, 1, 15)
                    target.fillRect(soldier.sprite.x - 3, soldier.sprite.y - 6, width, 1, soldier.team == 0 ? 9 : 2)
                }
            }
        })
        game.onUpdate(function () {
            if (finished) return
            const now = game.runtime()
            for (let i = 0; i < soldiers.length; i++) {
                const soldier = soldiers[i]
                if (!soldier.sprite && now >= soldier.respawnAt) spawn(soldier, now)
                if (!soldier.sprite) continue
                if (soldier.human) {
                    if (player.vx != 0 || player.vy != 0) {
                        if (Math.abs(player.vx) >= Math.abs(player.vy)) {
                            facingX = player.vx > 0 ? 1 : -1
                            facingY = 0
                        } else {
                            facingX = 0
                            facingY = player.vy > 0 ? 1 : -1
                        }
                    }
                    if (controller.A.isPressed()) fire(soldier, facingX, facingY, now)
                } else updateBot(soldier, now)
            }
        })
    }
}
