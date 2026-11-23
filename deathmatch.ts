// First team to ten eliminations wins.
//% color=#C75050 block="Deathmatch"
namespace deathmatch {
    /** Select the original first-team-to-ten rules before starting the engine. */
    //% blockId=deathmatch_configure block="use deathmatch rules"
    export function configure(): void {
        shooter.setMode(shooter.Mode.Deathmatch)
    }

    function rules(): void {
        mod.OnGameModeStarted(function () {
            mod.SetGameModeTargetScore(10)
        })
        mod.OnPlayerEarnedKill(function (eventPlayer, eventOtherPlayer) {
            // Self-inflicted and friendly eliminations score nothing.
            if (mod.Equals(eventPlayer, eventOtherPlayer)) return
            const team = mod.GetTeam(eventPlayer)
            if (mod.Equals(team, mod.GetTeam(eventOtherPlayer))) return
            mod.SetGameModeScore(team, mod.GetGameModeScore(team) + 1)
            if (mod.GetGameModeScore(team) >= mod.GetTargetScore()) mod.EndGameMode(team)
        })
    }

    shooter.registerMode(shooter.Mode.Deathmatch, rules)
}
