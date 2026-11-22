// Individual ladders; the player finishing the last weapon wins for their team.
namespace gungame {
    let configured = false
    const levelSlot = 0

    function weaponFor(level: number): shooter.Weapon {
        if (level == 1) return weapons.create(weapons.Kind.SMG)
        if (level == 2) return weapons.create(weapons.Kind.Shotgun)
        if (level >= 3) return weapons.create(weapons.Kind.Knife)
        return weapons.create(weapons.Kind.Pistol)
    }

    function equip(player: shooter.Player): void {
        const level = shooter.getVariable(player, levelSlot)
        shooter.giveWeapon(player, weaponFor(level))
        shooter.setScore(player, level + 1)
        const team = shooter.getTeam(player)
        shooter.setScore(team, Math.max(shooter.getScore(team), level + 1))
    }

    // Author-facing setup; no learner event/action Blocks in this slice.
    export function initialize(): void {
        if (configured) return
        configured = true
        shooter.setTargetScore(4)
        shooter.onDeployed(function (player) { equip(player) })
        shooter.onElimination(function (attacker, victim, weapon) {
            if (attacker == victim || shooter.getTeam(attacker) == shooter.getTeam(victim)) return
            const level = shooter.getVariable(attacker, levelSlot)
            // Late shots from earlier weapons still deal damage/credit kills, but cannot skip levels.
            if (!weapon || weapon.name != weaponFor(level).name) return
            if (level >= 3) {
                shooter.endMatch(attacker)
                return
            }
            shooter.setVariable(attacker, levelSlot, level + 1)
            equip(attacker) // Applies even if the attacker is waiting to respawn.
            messages.announce(messages.text("{}: {} LEVEL {}", attacker, attacker.weapon.name, level + 2))
        })
        messages.notify("GUN GAME: PISTOL > SMG > SHOTGUN > KNIFE")
    }
}
