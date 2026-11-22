# Battlefield 6 Portal reference (author notes)

Author-facing notes for designing this project's Portal-shaped `mod` layer. Learners do not need this file. Design decisions live in [PLAN.md](PLAN.md); PXT language findings live in [PXT-ARCADE.md](PXT-ARCADE.md).

The `mod` layer is **Portal-shaped, not Portal-compatible**. Arcade is a short ramp: learners get the idea of scripting a game mode with event handlers, functions and per-player variables, then move to Portal. Porting a mode needs a short list of fix-ups (below), not a shared source file or conversion tool.

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

## The Arcade `mod` layer

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

## Block help in Arcade

The JSDoc above exported blocks in `mod.ts` supplies the editor's hover tooltips; `@param` entries describe inputs for MakeCode's API metadata. Descriptions are paraphrased from the SDK 2.1.2.0 comments in `code/types/mod/index.d.ts` (including `EventHandlerSignatures`) and checked against this implementation. They are not an imported copy of the full SDK documentation. Shooter settings and Weapons presets are Arcade-specific, so their help comes from the implementation, not an SDK equivalent.

Keep the first sentence about what the learner can do; include Arcade limits where Portal's wording would mislead. In particular:

- Setting a score or target does not automatically end an Arcade match. A rule must check it and call `EndGameMode`.
- Arcade variables store numbers in slots 0–31; Portal variables can hold other value types.
- Arcade messages use typed text and shorter display times, with shared-screen audience filtering.
- `AllPlayers` is deprecated in this SDK; `GetAllPlayers` is the current Portal name. Arcade retains `AllPlayers` and its stable block ID for existing projects.
- `DisplayGameModeMessage` is not declared in this SDK's `index.d.ts`; `code/modlib/index.ts` comments out calls to it and supplies a widget workaround. Arcade's working message block is not evidence that the corresponding Portal API works.

Do not automatically replace these descriptions when updating the SDK: compare behavior and adapt the help. `tests/block-docs.cjs`, called by the local and hosted browser checks, reads actual custom block tooltips to catch missing or stale help. The exported project PNG carries these comments with its source, so learners do not need another documentation download.

### Procedure: bringing SDK descriptions into Arcade

This is a **manual, reviewed adaptation**, not a generated documentation sync. No SDK files are copied into this repository, and there is no doc-string importer to rerun.

1. **Identify the SDK and version.** Read `sdk.version.json` in the separately installed SDK before using its descriptions. The local installation used for this work is `C:/PortalSDK`, version 2.1.2.0. Treat that as a machine-local location, not a project dependency; another author can use a different path. Leave the SDK unchanged.

2. **List the Arcade blocks to document.** Read the exported functions carrying `//% blockId=...` in `mod.ts`. Also review `shooter.ts`, `weapons.ts`, and the legacy block in `deathmatch.ts`. Keep function names, argument order, block labels, and block IDs unchanged: this task changes help, not the API or saved-program compatibility.

3. **Find each corresponding SDK declaration and its immediately preceding comments.** Match by function name in `code/types/mod/index.d.ts`, checking all overloads for player/team targets and optional arguments. Event declarations live in `EventHandlerSignatures`. Most SDK descriptions are ordinary `//` comments, not JSDoc; searching only for `/** ... */` misses them and can accidentally associate a distant comment with the wrong function. For example, from a Bash shell:

   ```sh
   SDK=C:/PortalSDK
   rg -n -B 4 -A 8 'export function (SetGameModeScore|GetTeam|Message|OnPlayerEarnedKill)\(' "$SDK/code/types/mod/index.d.ts"
   ```

   Read enough surrounding lines to see the whole declaration, its overloads, and any deprecation notice. When a declaration is absent, inspect `code/modlib/index.ts` and the SDK's relevant documentation rather than inventing an SDK description. `DisplayGameModeMessage` is one such exception; `Wait` has a declaration but no useful adjacent description in this SDK.

4. **Compare the SDK description with the Arcade implementation.** Read the corresponding function in `mod.ts` and the engine/message/weapon functions it calls. Use the SDK to establish the shared idea, then describe what actually happens here. Check event-player roles, self-inflicted deaths, units, score versus elimination counts, numeric variable limits, audience filtering, and whether an action ends a match. Do not carry over Portal-only promises such as a six-second notification, arbitrary variable values, or an individual-player winner. Shooter settings and Weapons presets have no direct SDK equivalent; document their actual implementation instead.

5. **Write concise JSDoc above the block annotations.** Start with the action or value in plain language. Follow with a short caveat only where needed, then `@param` descriptions using the **Arcade function's exact parameter names**, not the SDK's names. Explain units and unfamiliar terms. For events, explain what `eventPlayer`, `eventOtherPlayer`, and any Arcade-only `eventWeapon` mean in the main description; they are callback values, not top-level function parameters.

   ```typescript
   /**
    * Read a team or player's current score. Team and personal scores are separate.
    * @param target team or player whose score to read
    */
   //% blockId=mod_get_game_mode_score block="game mode score of $target"
   //% group="Score" weight=89
   export function GetGameModeScore(target: shooter.Team | shooter.Player): number {
       return target ? shooter.getScore(target) : 0
   }
   ```

   PXT reads the description into the block's tooltip and parses `@param` entries into parameter metadata. Its block loader calls `setTooltip` with the API's JSDoc (`pxtblocks/loader.ts` in the reference checkout). A separate Markdown file or a plain `//` comment does not supply this block tooltip. Do not put raw `@param` text in a tooltip annotation or add help URLs that do not exist.

6. **Maintain the real-editor help check.** `tests/block-docs.cjs` creates each custom block in the live Blockly workspace, reads `getTooltip()`, and disposes of the temporary block with Blockly events disabled. Its expected phrases check that meaningful help reached each block and that raw `@param` tags did not leak into the tooltip. Add coverage when adding a block; change a phrase assertion only after reviewing the new description. This checks tooltip text, not the visual layout of a hover popup or every parameter-help UI.

7. **Build, export, and check the exact learner artifact.** From this repository, using the existing sibling toolchain:

   ```sh
   node ../pxt-arcade/node_modules/pxt-core/built/pxt.js build
   node --test tests/gameplay.test.cjs tests/pathing.test.cjs
   node tests/editor-smoke.cjs --png --tilemap
   node tests/png-hosted.cjs --tilemap
   git diff --check
   ```

   The local browser check runs the tooltip assertions, exports a baseline project PNG, imports it into a fresh context, and checks Blocks-first startup and an editable damage change. The hosted check imports those same PNG bytes and runs the tooltip assertions again, proving the help is carried in the artifact rather than supplied by repository files. It also checks startup, custom blocks, and tilemap editing. This is not a full gameplay or learner-usability test.

   The deliverable is `local/exports/arcade-shooter.png`. Local evidence includes `local/exports/validation.json`, `local/editor-smoke/block-docs.json`, `hosted-block-docs.json`, and `hosted-result.json`. A comment-only source change still needs a new export: an older PNG cannot acquire the new help. Do not distribute evidence screenshots as project PNGs.

8. **Review and record durable differences.** Update this reference when a newer SDK reveals a changed name, deprecation, or behavior difference. Keep source/version and maintenance instructions here, repeatable checks in `VALIDATION.md`, and learner usage in `README.md`. Do not vendor SDK dumps or add per-run logs to the docs. Commit or publish only with approval.

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
