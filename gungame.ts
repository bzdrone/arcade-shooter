// Worked example: individual weapon ladders, written with the Portal-shaped `mod`
// layer and the weapons compatibility library. Finishing the ladder wins for your team.
namespace gungame {
    const levelSlot = 0
    const ladder = [weapons.Kind.Pistol, weapons.Kind.SMG, weapons.Kind.Shotgun, weapons.Kind.Knife]

    function level(player: shooter.Player): number {
        return mod.GetVariable(mod.ObjectVariable(player, levelSlot))
    }

    function equip(player: shooter.Player): void {
        weapons.give(player, ladder[level(player)])
        mod.SetGameModeScore(player, level(player) + 1)
        const team = mod.GetTeam(player)
        mod.SetGameModeScore(team, Math.max(mod.GetGameModeScore(team), level(player) + 1))
    }

    function rules(): void {
        mod.OnGameModeStarted(function () {
            mod.SetGameModeTargetScore(ladder.length)
            mod.DisplayNotificationMessage(mod.Message("GUN GAME: PISTOL > SMG > SHOTGUN > KNIFE"))
        })
        mod.OnPlayerDeployed(function (eventPlayer) {
            equip(eventPlayer)
        })
        mod.OnPlayerEarnedKill(function (eventPlayer, eventOtherPlayer, eventWeapon) {
            if (mod.Equals(eventPlayer, eventOtherPlayer) || mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(eventOtherPlayer))) return
            const current = level(eventPlayer)
            // Arcade shots fly slowly: a late shot from an earlier weapon cannot skip a level.
            if (eventWeapon != ladder[current]) return
            if (current >= ladder.length - 1) {
                mod.EndGameMode(eventPlayer)
                return
            }
            mod.SetVariable(mod.ObjectVariable(eventPlayer, levelSlot), current + 1)
            equip(eventPlayer) // Applies even if the player is waiting to respawn.
            mod.DisplayGameModeMessage(mod.Message("{}: {} LEVEL {}", eventPlayer, weapons.name(ladder[current + 1]), current + 2))
        })
    }

    shooter.registerMode(shooter.Mode.GunGame, rules)
}
