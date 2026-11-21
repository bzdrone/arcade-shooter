// Small engine vocabulary, not a real-world inventory or external weapon enum.
namespace weapons {
    export enum Kind {
        Pistol,
        SMG,
        Shotgun,
        Knife
    }

    /** Fresh values so assigning a preset never mutates another player's weapon. */
    export function create(kind: Kind): shooter.Weapon {
        if (kind == Kind.SMG) return shooter.createWeapon(1, 300, 100, 64, 7, "SMG")
        // One short-range heavy shot, not a pellet/spread simulation.
        if (kind == Kind.Shotgun) return shooter.createWeapon(3, 1000, 70, 32, 4, "Shotgun")
        // Knife uses the same collision rules with a very short-lived projectile.
        if (kind == Kind.Knife) return shooter.createWeapon(3, 500, 80, 12, 1, "Knife")
        return shooter.createWeapon(1, 750, 80, 200, 0, "Pistol")
    }
}
