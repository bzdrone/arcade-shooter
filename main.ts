// Start by modifying these settings.
// Click the tilemap to edit cover, walls, and the blue/red soldier spawn tiles.
tiles.setCurrentTilemap(tilemap`trainingYard`)
// Weapon: damage per hit, minimum milliseconds between shots, projectile speed.
shooter.setWeapon(1, 750, 80)
// All soldiers: health, bot movement speed, minimum respawn delay.
shooter.setSoldiers(3, 10, 5000)
// Choose deathmatch, gun game, or no mode (combat without scoring/win rules).
shooter.setMode(shooter.Mode.Deathmatch)
shooter.startGame()
