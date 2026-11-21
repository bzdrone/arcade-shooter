// The implementation stays in TypeScript; the annotated functions are the
// intentionally small customization surface available to the Blocks editor.

//% color=#C75050 weight=100 block="Shooter"
namespace shooter {
    let weaponDamage = 1
    let fireInterval = 250
    let projectileSpeed = 120
    let enemyStartingHealth = 3
    let enemySpeed = 20
    let spawnInterval = 1500
    let started = false
    let player: Sprite = null
    let facingX = 1
    let facingY = 0
    let nextShotAt = 0
    let nextSpawnAt = 0
    let enemies: Sprite[] = []
    let health: number[] = []
    const spentProjectileKind = SpriteKind.create()

    function untrackEnemy(enemy: Sprite): void {
        const index = enemies.indexOf(enemy)
        if (index >= 0) {
            enemies.removeAt(index)
            health.removeAt(index)
        }
    }

    /** Configure the weapon before starting the game. Speed is in pixels per second. */
    //% blockId=shooter_set_weapon block="set weapon damage $damage fire interval (ms) $interval projectile speed $speed"
    //% damage.defl=1 damage.min=1 interval.defl=250 interval.min=50 speed.defl=120 speed.min=10
    //% weight=90
    export function setWeapon(damage: number, interval: number, speed: number): void {
        if (started) return
        weaponDamage = Math.max(1, Math.round(damage))
        fireInterval = Math.max(50, Math.round(interval))
        projectileSpeed = Math.max(10, Math.round(speed))
    }

    /** Configure enemies before starting the game. Speed is in pixels per second. */
    //% blockId=shooter_set_enemies block="set enemy health $hitPoints speed $speed spawn interval (ms) $interval"
    //% hitPoints.defl=3 hitPoints.min=1 speed.defl=20 speed.min=1 interval.defl=1500 interval.min=250
    //% weight=80
    export function setEnemies(hitPoints: number, speed: number, interval: number): void {
        if (started) return
        enemyStartingHealth = Math.max(1, Math.round(hitPoints))
        enemySpeed = Math.max(1, Math.round(speed))
        spawnInterval = Math.max(250, Math.round(interval))
    }

    function spawnEnemy(): void {
        // Bound the number of live enemies so experimentation cannot flood the screen.
        if (enemies.length >= 6) return
        const enemy = sprites.create(img`
            . . 2 2 2 2 . .
            . 2 2 2 2 2 2 .
            2 2 1 2 2 1 2 2
            2 2 f 2 2 f 2 2
            2 2 2 2 2 2 2 2
            . 2 2 f f 2 2 .
            . 2 2 2 2 2 2 .
            . . 2 . . 2 . .
        `, SpriteKind.Enemy)
        // Pick an edge, leaving a small margin inside the playfield.
        const edge = randint(0, 3)
        if (edge == 0) {
            enemy.setPosition(5, randint(20, scene.screenHeight() - 5))
        } else if (edge == 1) {
            enemy.setPosition(scene.screenWidth() - 5, randint(20, scene.screenHeight() - 5))
        } else if (edge == 2) {
            enemy.setPosition(randint(5, scene.screenWidth() - 5), 20)
        } else {
            enemy.setPosition(randint(5, scene.screenWidth() - 5), scene.screenHeight() - 5)
        }
        enemies.push(enemy)
        health.push(enemyStartingHealth)
        enemy.follow(player, enemySpeed)
    }

    function fire(): void {
        const projectile = sprites.createProjectileFromSprite(img`
            5 5
            5 5
        `, player, facingX * projectileSpeed, facingY * projectileSpeed)
        projectile.lifespan = 1600
    }

    /** Start one game. Call the settings blocks first. Move with arrows; hold A to fire. */
    //% blockId=shooter_start_game block="start shooter"
    //% weight=70
    export function startGame(): void {
        if (started) return
        started = true
        scene.setBackgroundColor(15)
        player = sprites.create(img`
            . . 8 8 8 8 . .
            . 8 8 8 8 8 8 .
            8 8 1 8 8 1 8 8
            8 8 f 8 8 f 8 8
            8 8 8 8 8 8 8 8
            . 8 8 8 8 8 8 .
            . 8 . 8 8 . 8 .
            . 8 . . . . 8 .
        `, SpriteKind.Player)
        player.setPosition(scene.screenWidth() / 2, scene.screenHeight() / 2)
        player.setStayInScreen(true)
        controller.moveSprite(player, 70, 70)
        info.setLife(5)
        info.setScore(0)
        nextSpawnAt = game.runtime() + 1000

        // Keep the health table aligned when an enemy is destroyed for any reason.
        sprites.onDestroyed(SpriteKind.Enemy, function (enemy) {
            untrackEnemy(enemy)
        })

        sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Enemy, function (projectile, enemy) {
            const index = enemies.indexOf(enemy)
            if (index < 0 || projectile.kind() != SpriteKind.Projectile) return
            // Consume the shot before destruction callbacks can run. One shot
            // must not damage multiple enemies sharing the same position.
            projectile.setKind(spentProjectileKind)
            projectile.destroy()
            health[index] -= weaponDamage
            if (health[index] <= 0) {
                // Remove immediately; do not depend on destruction event timing.
                untrackEnemy(enemy)
                enemy.destroy()
                info.changeScoreBy(1)
                if (info.score() >= 20) game.over(true)
            }
        })

        sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (sprite, enemy) {
            if (enemies.indexOf(enemy) < 0) return
            untrackEnemy(enemy)
            enemy.destroy()
            info.changeLifeBy(-1)
        })

        game.onUpdate(function () {
            // Aim along the most recent movement axis; retain aim when stationary.
            if (player.vx != 0 || player.vy != 0) {
                if (Math.abs(player.vx) >= Math.abs(player.vy)) {
                    facingX = player.vx > 0 ? 1 : -1
                    facingY = 0
                } else {
                    facingX = 0
                    facingY = player.vy > 0 ? 1 : -1
                }
            }
            const now = game.runtime()
            if (controller.A.isPressed() && now >= nextShotAt) {
                fire()
                nextShotAt = now + fireInterval
            }
            if (now >= nextSpawnAt) {
                spawnEnemy()
                nextSpawnAt = now + spawnInterval
            }
        })
    }
}
