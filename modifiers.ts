//% color=#4776B8 weight=90 block="Modifiers"
namespace modifiers {
    export let maxHealth = 100
    export let incomingDamagePercent = 100
    export let respawnSeconds = 5
    export let friendlyFire = false
    let locked = false

    export function lock(): void { locked = true }

    /** Set everyone's maximum health before start shooter. Later calls are ignored. */
    //% blockId=modifiers_max_health block="set maximum health $value"
    //% value.defl=100 value.min=1 value.max=500 weight=100
    export function setMaxHealth(value: number): void {
        if (!locked && value == value && Math.abs(value) < Infinity) maxHealth = Math.max(1, Math.min(500, Math.round(value)))
    }

    /** Scale incoming damage for everyone before start shooter. 100 is normal; 0 prevents damage. Rounded to steps of 5 percent. */
    //% blockId=modifiers_incoming_damage block="set incoming damage percent $value"
    //% value.defl=100 value.min=0 value.max=200 weight=90
    export function setIncomingDamagePercent(value: number): void {
        if (!locked && value == value && Math.abs(value) < Infinity) incomingDamagePercent = Math.max(0, Math.min(200, Math.round(value / 5) * 5))
    }

    /** Set the minimum wait after death in seconds. Occupied spawn points can delay a return. Put this before start shooter. */
    //% blockId=modifiers_respawn_seconds block="set respawn seconds $value"
    //% value.defl=5 value.min=0 value.max=60 weight=80
    export function setRespawnSeconds(value: number): void {
        if (!locked && value == value && Math.abs(value) < Infinity) respawnSeconds = Math.max(0, Math.min(60, value))
    }

    /** Allow shots to damage teammates. Bots still aim at opponents. Put this before start shooter. */
    //% blockId=modifiers_friendly_fire block="set friendly fire $enabled"
    //% enabled.defl=false weight=70
    export function setFriendlyFire(enabled: boolean): void {
        if (!locked) friendlyFire = enabled
    }
}
