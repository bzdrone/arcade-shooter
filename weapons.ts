// Weapon compatibility library: a small category vocabulary, not a real-world
// inventory or external weapon enum. portal/weapons.ts implements the same calls
// with concrete Portal weapons, so mode code using it ports unchanged.
//% color=#B0702A weight=55 block="Weapons"
namespace weapons {
    export enum Kind {
        //% block="pistol"
        Pistol,
        //% block="SMG"
        SMG,
        //% block="shotgun"
        Shotgun,
        //% block="knife"
        Knife
    }

    const names = ["Pistol", "SMG", "Shotgun", "Knife"]

    /** Fresh values so assigning a preset never mutates another player's weapon. */
    export function create(kind: Kind): shooter.Weapon {
        if (kind == Kind.SMG) return shooter.createWeapon(1, 300, 100, 64, 7, "SMG")
        // One short-range heavy shot, not a pellet/spread simulation.
        if (kind == Kind.Shotgun) return shooter.createWeapon(3, 1000, 70, 32, 4, "Shotgun")
        // Knife uses the same collision rules with a very short-lived projectile.
        if (kind == Kind.Knife) return shooter.createWeapon(3, 500, 80, 12, 1, "Knife")
        return shooter.createWeapon(1, 750, 80, 200, 0, "Pistol")
    }

    /** Replace the player's weapon; the next shot uses it, even while waiting to respawn. */
    //% blockId=weapons_give block="give $player weapon $kind"
    //% weight=90
    export function give(player: shooter.Player, kind: Kind): void {
        shooter.giveWeapon(player, create(kind))
    }

    /** The category of a weapon value, or -1 for a custom or missing weapon. */
    export function kindOf(weapon: shooter.Weapon): number {
        if (!weapon) return -1
        return names.indexOf(weapon.name)
    }

    /** The category the player currently carries, or -1 for a custom weapon. */
    //% blockId=weapons_current block="weapon of $player"
    //% weight=80
    export function current(player: shooter.Player): number {
        return kindOf(player.weapon)
    }

    /** A category as a number, for comparing with event weapons. */
    //% blockId=weapons_kind block="$kind"
    //% weight=70
    export function kind(kind: Kind): number {
        return kind
    }

    /** Display name for messages, such as "SMG". */
    //% blockId=weapons_name block="name of weapon $kind"
    //% weight=60
    export function name(kind: number): string {
        return kind >= 0 && kind < names.length ? names[kind] : "Custom"
    }
}
