# Battlefield 6 Portal reference (author notes)

Author-facing notes for designing this project's Portal-shaped `mod` layer. Learners do not need this file. Agreed direction and milestones live in [PLAN.md](PLAN.md); PXT language findings live in [PXT-ARCADE.md](PXT-ARCADE.md).

The `mod` layer is **Portal-shaped, not Portal-compatible**. Arcade is a short ramp: learners get the idea of scripting a game mode with event handlers, functions and per-player variables, then move to Portal. Porting a mode is expected to need a short list of fix-ups (below), not a shared source file or conversion tool.

## Sources and versions

- Primary source: the official Portal SDK, **version 2.1.2.0** (`sdk.version.json`), downloaded separately; not vendored here. Key files inside it:
  - `code/types/mod/index.d.ts`: the full `mod` API and the `EventHandlerSignatures` namespace. Authoritative for names and parameters.
  - `code/modlib/index.ts`: EA's helper library (array/condition helpers, simple message helpers).
  - `docs/pages/gameplay_logic.html`: scripting overview (Blockly or TypeScript, debugging via `PortalLog.txt` when local hosting).
  - `unsupported/`: full example modes (Skirmish, BombSquad, Exfil, Vertigo, WarFactory, Besieged) and `modsim`, an offline simulator its own readme calls buggy and incomplete. No gun game example.
- Community docs (not EA): [docs.bfportal.gg](https://docs.bfportal.gg/) rules-editor pages and block reference. Useful for the Blockly rules editor; check names against `index.d.ts`.
- EA: [Portal 101: Advanced Creations](https://www.ea.com/en/games/battlefield/battlefield-6/news/portal-101-advanced-creations).

Recheck names against a newer SDK before relying on this file; the API may change between SDK versions.

## How Portal scripting works

- Two authoring routes over one API: the **Blockly rules editor** in the Portal web tool, or **TypeScript** (written in the web tool or uploaded). TypeScript uses the `mod` namespace.
- **Events are exported functions found by name**, for example `export function OnPlayerEarnedKill(...)`. Ongoing rules (`OngoingPlayer`, `OngoingTeam`, `OngoingGlobal`, …) are evaluated every tick; `modlib.ConditionState` reproduces the rules editor's "fire once when the condition becomes true" behaviour in TypeScript.
- Rules editor shape: everything hangs off a mod block; each rule is event → AND-ed conditions → actions run in order, in a Global, Player or Team context.
- Portal also separates the **player** (passed to events) from the **soldier** body (queried with `GetSoldierState(player, …)`), matching this engine's player/soldier split.
- Scripts use `async`/`await` with `mod.Wait(seconds)`; without `await`, the wait is skipped.

## API subset relevant to game modes

Signatures as of SDK 2.1.2.0; check `index.d.ts` for the full set.

| Purpose | Portal |
|---|---|
| Match start/end | `OnGameModeStarted()`, `OnGameModeEnding()`, `OnTimeLimitReached()` |
| Deploy/death | `OnPlayerDeployed(player)`, `OnPlayerDied(player, otherPlayer, deathType, weaponUnlock)`, `OnPlayerEarnedKill(player, otherPlayer, deathType, weaponUnlock)`; for self-inflicted deaths both players are the same |
| Joining/teams | `OnPlayerJoinGame(player)`, `OnPlayerLeaveGame(number)`, `OnPlayerSwitchTeam(player, team)`, `GetTeam(player)` / `GetTeam(teamId)`, `SetTeam`, `AllPlayers()` |
| Scoring | `SetGameModeScore(team \| player, score)`, `GetGameModeScore(team \| player)`, `SetGameModeTargetScore(score)`, `GetTargetScore()`, `GetPlayerKills(player)` |
| Ending | `EndGameMode(team \| player)` |
| Respawn/health | `SetRedeployTime(player, seconds)`, `EnablePlayerDeploy`, `DealDamage`, `Heal`, `Kill`, `SetPlayerMaxHealth` |
| Variables | `SetVariable(variable, value)`, `GetVariable(variable)`, `ObjectVariable(object, index)`, `GlobalVariable(index)` |
| Waiting | `Wait(seconds): Promise<void>` |
| Weapons | `AddEquipment(player, weapon[, slot])`, `RemoveEquipment(player, slot \| weapon \| gadget)`, `HasEquipment`, `ForceSwitchInventory` |
| Messages | `Message(text, a?, b?, c?)`, `DisplayNotificationMessage(msg[, player \| team])`, `DisplayHighlightedWorldLogMessage(msg[, target])`, `DisplayCustomNotificationMessage(msg, slot, duration[, target])` |

`|` in the table marks Portal overloads (separate declarations). Teams are numbered 1 and 2; team 0 is neutral.

### Weapons: why a compatibility library

Portal's `Weapons` enum lists 67 specific firearms grouped by name prefix (`Sidearm_`, `SMG_`, `Shotgun_`, `Carbine_`, `AssaultRifle_`, `LMG_`, `DMR_`, `Sniper_`), uses nine `InventorySlots`, and treats knives as gadgets (`Gadgets.Melee_Combat_Knife` in the `MeleeWeapon` slot). Arcade exposes four weapon categories instead (`weapons.ts`); the Portal side maps each category to one concrete weapon and slot (`portal/gungame.ts`).

### Messages: why a small subset

Portal's full UI is widget-based (`AddUIText` with position, size, anchor, colours, fonts …). `modlib` already wraps the simple cases as `ShowNotificationMessage(msg, target?)`, `ShowEventGameModeMessage(msg, target?)` and `ShowHighlightedGameModeMessage(msg, target?)`, with an optional `Player | Team` target. `ShowEventGameModeMessage` notes that the built-in game-mode message is broken in this SDK and draws a temporary widget for six seconds instead. Arcade keeps everything in `mod` instead: `DisplayNotificationMessage` (a real Portal function) and `DisplayGameModeMessage` (the real name of the broken built-in, so porting switches it to `modlib.ShowEventGameModeMessage`). No widget API is mirrored. Portal message text must come from a strings file (`mod.stringkeys.someKey`) with up to three `{}` placeholders.

## The Arcade `mod` layer (implemented)

`mod.ts` implements this subset under Portal's names. Learners see it as the **Mod** Blocks category; `deathmatch.ts` and `gungame.ts` are written with it as worked examples.

| Arcade | Notes |
|---|---|
| `mod.OnGameModeStarted(handler)`, `OnPlayerDeployed(handler(eventPlayer))`, `OnPlayerDied(handler(eventPlayer, eventOtherPlayer))`, `OnPlayerEarnedKill(handler(eventPlayer, eventOtherPlayer, eventWeapon))` | Registered handlers, not exported functions. Self-inflicted: both players are the same. Game start and the first deployments are delivered on the first frame, so registration order in the program does not matter. `eventWeapon` is an Arcade weapon category (or -1), not Portal's `WeaponUnlock`. |
| `SetGameModeScore`, `GetGameModeScore` (team or player), `SetGameModeTargetScore`, `GetTargetScore`, `EndGameMode` (team or player) | One function with a `Team \| Player` union per Portal overload set. `EndGameMode(player)` wins for that player's team (2v2 engine). |
| `GetTeam(player \| 1 \| 2)`, `Equals`, `AllPlayers`, `GetPlayerKills`, `GetPlayerDeaths`, `DealDamage(player, amount[, giver])` | Portal team numbering: 1 = blue, 2 = red; 0 (neutral) returns null. `AllPlayers` returns a plain array. |
| `ObjectVariable(player \| team, index)`, `GlobalVariable(index)`, `SetVariable`, `GetVariable` | Numeric slots 0–31. Player slots survive respawn. |
| `Message(text, a?, b?, c?)`, `DisplayNotificationMessage(msg, target?)`, `DisplayGameModeMessage(msg, target?)` | `{}` placeholders filled with text, numbers or player names. Notification = short top line; game mode message = large centred text. Target: player or team; omitted = everyone. Single screen: only messages for everyone, the human or blue are shown. |
| `Wait(seconds)` | Pauses only the calling handler. |

Weapons use the compatibility library in `weapons.ts`: `weapons.give(player, weapons.Kind.SMG)`, `weapons.current(player)`, `weapons.name(kind)`, with categories pistol, SMG, shotgun and knife. `portal/gungame.ts` contains the same calls implemented with real Portal items.

## Porting checklist

Changes when moving an Arcade mode written with `mod` and `weapons` to Portal. `portal/gungame.ts` is a worked example; each change there is marked `PORT:`.

1. **Events:** turn each `mod.OnX(function (...) {...})` into `export function OnX(...)` with Portal's full parameter list and types, for example `OnPlayerEarnedKill(eventPlayer: mod.Player, eventOtherPlayer: mod.Player, eventDeathType: mod.DeathType, eventWeaponUnlock: mod.WeaponUnlock)`. Merge several handlers for the same event into one function.
2. **Weapon in kill events:** Portal passes a `WeaponUnlock`, not an Arcade category. Drop or rewrite checks on `eventWeapon` (gun game drops its late-shot check; Portal bullets arrive almost instantly).
3. **Waiting:** mark handlers that call `mod.Wait` as `async` and write `await mod.Wait(...)`. PXT rejects `await`, so Arcade code omits both keywords.
4. **Message text:** move each message text to the mode's strings file and write `mod.Message(mod.stringkeys.someKey, ...)`. `{}` placeholders stay the same. Text-valued arguments (such as weapon names) become string keys too.
5. **Game mode messages:** in SDK 2.1.2.0 `mod.DisplayGameModeMessage` is broken; use `modlib.ShowEventGameModeMessage` (import `modlib`). `DisplayNotificationMessage` ports unchanged.
6. **Weapons:** paste the Portal-side `weapons` namespace from `portal/gungame.ts`; calls to `weapons.give` port unchanged. Pick the real items in its table.
7. **Types:** add `mod.Player` / `mod.Team` types where TypeScript needs them; cast `mod.GetVariable(...)` results (`as number`). `AllPlayers()` returns a `mod.Array`; convert it with `modlib.ConvertArray`.
8. **Winners:** `EndGameMode(player)` makes that player the winner in Portal, not their team.
9. **Unchanged:** scores, target score, teams (already numbered 1/2), `Equals`, variables, `DealDamage`, kills/deaths queries.

Check the result with `node tools/check-portal.cjs <path-to-portal-sdk>` (type-checks against the SDK and checks string keys). It does not run the mode; test in Portal before relying on it.
