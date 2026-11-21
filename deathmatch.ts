// First team to ten is a mode rule; scores live in the engine.
//% color=#C75050 block="Deathmatch"
namespace deathmatch {
    let configured = false

    /** Select the original first-team-to-ten rules before starting the engine. */
    //% blockId=deathmatch_configure block="use deathmatch rules"
    export function configure(): void {
        if (configured) return
        configured = true
        shooter.setTargetScore(10)
        shooter.onElimination(function (attacker, victim) {
            if (attacker == victim || attacker.team == victim.team) return
            const team = shooter.getTeam(attacker)
            shooter.setScore(team, shooter.getScore(team) + 1)
            if (shooter.getScore(team) >= shooter.getTargetScore()) shooter.endMatch(team)
        })
    }
}
