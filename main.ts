// Click the tilemap to edit walls, cover, and team spawn points.
tiles.setCurrentTilemap(tilemap`trainingYard`)
// Experience settings apply to everyone.
modifiers.setMaxHealth(100)
modifiers.setIncomingDamagePercent(100)
modifiers.setRespawnSeconds(5)
modifiers.setFriendlyFire(false)
// Choose deathmatch, gun game, or no mode.
shooter.setMode(shooter.Mode.Deathmatch)
shooter.startGame()
