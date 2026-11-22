// Battlefield 6 Portal port of ../gungame.ts (author example, not part of the Arcade PNG).
// Type-checked against Portal SDK 2.1.2.0 types; NOT yet run in Portal.
// Each change from the Arcade version is marked "PORT:" and listed in PORTAL.md.
import * as modlib from 'modlib';

// ---- Weapons compatibility library, Portal side ----
// Same calls as ../weapons.ts. Each category maps to one concrete Portal item.
namespace weapons {
    export enum Kind {
        Pistol,
        SMG,
        Shotgun,
        Knife,
    }

    // Change these to pick different real weapons for each category.
    const pistol = mod.Weapons.Sidearm_M45A1;
    const smg = mod.Weapons.SMG_PW5A3;
    const shotgun = mod.Weapons.Shotgun_M1014;
    const knife = mod.Gadgets.Melee_Combat_Knife;

    /** Replace the player's guns with the category's item and switch to it. */
    export function give(player: mod.Player, kind: Kind): void {
        mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
        mod.RemoveEquipment(player, mod.InventorySlots.SecondaryWeapon);
        if (kind == Kind.Pistol) {
            mod.AddEquipment(player, pistol, mod.InventorySlots.SecondaryWeapon);
            mod.ForceSwitchInventory(player, mod.InventorySlots.SecondaryWeapon);
        } else if (kind == Kind.SMG) {
            mod.AddEquipment(player, smg, mod.InventorySlots.PrimaryWeapon);
            mod.ForceSwitchInventory(player, mod.InventorySlots.PrimaryWeapon);
        } else if (kind == Kind.Shotgun) {
            mod.AddEquipment(player, shotgun, mod.InventorySlots.PrimaryWeapon);
            mod.ForceSwitchInventory(player, mod.InventorySlots.PrimaryWeapon);
        } else {
            mod.AddEquipment(player, knife, mod.InventorySlots.MeleeWeapon);
            mod.ForceSwitchInventory(player, mod.InventorySlots.MeleeWeapon);
        }
    }

    /** PORT: message text comes from the strings file, so names are string keys. */
    export function name(kind: number): any {
        return [mod.stringkeys.pistol, mod.stringkeys.smg, mod.stringkeys.shotgun, mod.stringkeys.knife][kind];
    }
}

// ---- Gun game rules ----
const levelSlot = 0;
const ladder = [weapons.Kind.Pistol, weapons.Kind.SMG, weapons.Kind.Shotgun, weapons.Kind.Knife];

function level(player: mod.Player): number {
    return mod.GetVariable(mod.ObjectVariable(player, levelSlot)) as number;
}

function equip(player: mod.Player): void {
    weapons.give(player, ladder[level(player)]);
    mod.SetGameModeScore(player, level(player) + 1);
    const team = mod.GetTeam(player);
    mod.SetGameModeScore(team, Math.max(mod.GetGameModeScore(team), level(player) + 1));
}

// PORT: registered handlers become exported functions with Portal's full parameter lists.
export function OnGameModeStarted(): void {
    mod.SetGameModeTargetScore(ladder.length);
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.gunGameLadder)); // PORT: text moved to the strings file.
}

export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    equip(eventPlayer);
}

export function OnPlayerEarnedKill(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    if (mod.Equals(eventPlayer, eventOtherPlayer) || mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(eventOtherPlayer))) return;
    const current = level(eventPlayer);
    // PORT: Arcade's late-shot check (eventWeapon != ladder[current]) is dropped; Portal
    // reports a WeaponUnlock, not an Arcade weapon category, and bullets arrive almost instantly.
    if (current >= ladder.length - 1) {
        mod.EndGameMode(eventPlayer); // PORT: in Portal the player wins, not the player's team.
        return;
    }
    mod.SetVariable(mod.ObjectVariable(eventPlayer, levelSlot), current + 1);
    equip(eventPlayer);
    // PORT: DisplayGameModeMessage is broken in SDK 2.1.2.0; modlib's helper draws it instead.
    modlib.ShowEventGameModeMessage(mod.Message(mod.stringkeys.levelUp, eventPlayer, weapons.name(ladder[current + 1]), current + 2));
}
