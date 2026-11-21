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

Portal's `Weapons` enum lists 67 specific firearms grouped by name prefix (`Sidearm_`, `SMG_`, `Shotgun_`, `Carbine_`, `AssaultRifle_`, `LMG_`, `DMR_`, `Sniper_`), uses nine `InventorySlots`, and treats knives as gadgets (`Gadgets.Melee_Combat_Knife` in the `MeleeWeapon` slot). Arcade exposes a small set of weapon categories instead; a Portal-side table later maps each category to one concrete weapon and slot.

### Messages: why mirror `modlib`

Portal's full UI is widget-based (`AddUIText` with position, size, anchor, colours, fonts …). `modlib` already wraps the simple cases as `ShowNotificationMessage(msg, target?)`, `ShowEventGameModeMessage(msg, target?)` and `ShowHighlightedGameModeMessage(msg, target?)`, with an optional `Player | Team` target. `ShowEventGameModeMessage` notes that the built-in game-mode message is broken in this SDK and draws a temporary widget for six seconds instead. Arcade mirrors these helpers rather than any widget API. Portal message text must come from a strings file (`mod.stringkeys.someKey`) with up to three `{}` placeholders.

## Porting checklist (draft)

Expected fix-ups when moving an Arcade `mod` game mode to Portal:

1. **Events:** turn registered handlers (`mod.onPlayerEarnedKill(function (player, other) {…})` style, exact Arcade naming to be decided) into exported functions with Portal's full signatures (`export function OnPlayerEarnedKill(player, other, deathType, weaponUnlock)`).
2. **Waiting:** mark handlers that wait as `async` and write `await mod.Wait(...)`. Arcade code omits both keywords; PXT blocking calls wait implicitly, and PXT rejects `await`.
3. **Messages:** move each text into the strings file and reference it as `mod.stringkeys.name`. Using `{}` placeholders in Arcade keeps the text unchanged.
4. **Teams:** convert team numbering if the Arcade layer keeps 0/1 (open question in PLAN.md).
5. **Weapons:** replace the Arcade weapon-category library with the Portal-side category table.
6. **Everything else** (scores, ending, player variables) should port unchanged if the Arcade `mod` layer keeps Portal's names and argument order.
