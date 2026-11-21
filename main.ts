// Start by modifying these settings. Keep the game implementation in shooter.ts.
// Click the tilemap thumbnail to edit the yard and its wall markings.
tiles.setCurrentTilemap(tilemap`trainingYard`)
// Weapon: damage per hit, minimum milliseconds between shots, projectile speed.
shooter.setWeapon(1, 250, 120)
// Enemies: health, movement speed, minimum milliseconds between spawns.
shooter.setEnemies(3, 20, 1500)
shooter.startGame()
