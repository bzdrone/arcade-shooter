// First team to ten is a mode rule, not part of the combat engine.
//% color=#C75050 block="Deathmatch"
namespace deathmatch {
    let configured = false
    let blueScore = 0
    let redScore = 0

    function updateStatus(): void {
        shooter.setStatus("BLUE " + blueScore + "  RED " + redScore, "FIRST TO 10")
    }

    /** Select the original first-team-to-ten rules before starting the engine. */
    //% blockId=deathmatch_configure block="use deathmatch rules"
    export function configure(): void {
        if (configured) return
        configured = true
        updateStatus()
        shooter.onElimination(function (attacker, victim) {
            if (attacker.team == 0) blueScore++
            else redScore++
            updateStatus()
            if (blueScore >= 10 || redScore >= 10) shooter.endMatch(attacker.team)
        })
    }
}
