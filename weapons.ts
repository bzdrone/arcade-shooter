// Shared weapon categories for Arcade and Portal.
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

    export function create(kind: Kind): shooter.Weapon {
        if (kind == Kind.SMG) return shooter.createWeapon(34, 300, 100, 64, 7, "SMG")
        if (kind == Kind.Shotgun) return shooter.createWeapon(100, 1000, 70, 32, 4, "Shotgun")
        if (kind == Kind.Knife) return shooter.createWeapon(100, 500, 80, 12, 1, "Knife")
        return shooter.createWeapon(34, 750, 80, 200, 0, "Pistol")
    }

    /**
     * Change one player's weapon for their next shots. They keep it after a death; shots already fired do not change.
     * These are Arcade presets, not Portal inventory items: shotgun fires one heavy shot and knife is a very short-range shot.
     * @param player player receiving the weapon
     * @param kind pistol, SMG (fast-firing weapon), shotgun, or knife
     */
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

    /**
     * Read the player's weapon category number. Compare it with a weapon category block; -1 means a custom weapon.
     * @param player player whose weapon to check
     */
    //% blockId=weapons_current block="weapon of $player"
    //% weight=80
    export function current(player: shooter.Player): number {
        return kindOf(player.weapon)
    }

    /**
     * Choose a weapon category to compare with weapon of player or eventWeapon in an elimination event.
     * @param kind weapon category: pistol, SMG, shotgun, or knife
     */
    //% blockId=weapons_kind block="$kind"
    //% weight=70
    export function kind(kind: Kind): number {
        return kind
    }

    /**
     * Turn a weapon category number into text for a message, such as Pistol or SMG. Unknown numbers give Custom.
     * @param kind category number from weapon of player, a weapon category block, or eventWeapon
     */
    //% blockId=weapons_name block="name of weapon $kind"
    //% weight=60
    export function name(kind: number): string {
        return kind >= 0 && kind < names.length ? names[kind] : "Custom"
    }
}
