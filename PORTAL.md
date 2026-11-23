# Battlefield 6 Portal reference (author notes)

Author-facing notes for this Battlefield 6 Portal-specific project and its Arcade `mod` learning API. Creators do not need this file. Design decisions live in [PLAN.md](PLAN.md); PXT language findings live in [PXT-ARCADE.md](PXT-ARCADE.md).

Arcade is the starting environment for learning and authoring Battlefield 6 Portal maps and game modes. Creators script with event handlers, functions and per-player variables, then use the Arcade to Portal converter (`site/`, see the end of this file) to produce Portal rules and map edits. The conversion handles the supported API differences listed below; Arcade source is not uploaded directly as a Portal script.

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

`mod.ts` implements this subset under Portal's names. Creators see it as the **Mod** Blocks category; `deathmatch.ts` and `gungame.ts` are written with it as worked examples.

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

Keep the first sentence about what the creator can do; include Arcade limits where Portal's wording would mislead. In particular:

- Setting a score or target does not automatically end an Arcade match. A rule must check it and call `EndGameMode`.
- Arcade variables store numbers in slots 0–31; Portal variables can hold other value types.
- Arcade messages use typed text and shorter display times, with shared-screen audience filtering.
- `AllPlayers` is deprecated in this SDK; `GetAllPlayers` is the current Portal name. Arcade retains `AllPlayers` and its stable block ID for existing projects.
- `DisplayGameModeMessage` is not declared in this SDK's `index.d.ts`; `code/modlib/index.ts` comments out calls to it and supplies a widget workaround. Arcade's working message block is not evidence that the corresponding Portal API works.

Do not automatically replace these descriptions when updating the SDK: compare behavior and adapt the help. `tests/block-docs.cjs`, called by the local and hosted browser checks, reads actual custom block tooltips to catch missing or stale help. The exported project PNG carries these comments with its source, so creators do not need another documentation download.

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

7. **Build, export, and check the exact creator artifact.** From this repository, using the existing sibling toolchain:

   ```sh
   node ../pxt-arcade/node_modules/pxt-core/built/pxt.js build
   node --test tests/gameplay.test.cjs tests/pathing.test.cjs
   node tests/editor-smoke.cjs --png --tilemap
   node tests/png-hosted.cjs --tilemap
   git diff --check
   ```

   The local browser check runs the tooltip assertions, exports a baseline project PNG, imports it into a fresh context, and checks Blocks-first startup and an editable damage change. The hosted check imports those same PNG bytes and runs the tooltip assertions again, proving the help is carried in the artifact rather than supplied by repository files. It also checks startup, custom blocks, and tilemap editing. This is not a full gameplay or creator-usability test.

   The deliverable is `local/exports/arcade-shooter.png`. Local evidence includes `local/exports/validation.json`, `local/editor-smoke/block-docs.json`, `hosted-block-docs.json`, and `hosted-result.json`. A comment-only source change still needs a new export: an older PNG cannot acquire the new help. Do not distribute evidence screenshots as project PNGs.

8. **Review and record durable differences.** Update this reference when a newer SDK reveals a changed name, deprecation, or behavior difference. Keep source/version and maintenance instructions here, repeatable checks in `VALIDATION.md`, and creator usage in `README.md`. Do not vendor SDK dumps or add per-run logs to the docs. Commit or publish only with approval.

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

## Arcade to Portal converter

`site/converter/` turns an exported Arcade project PNG into three files: `<name>.spatial.json` (map edits), `<name>.ts` (rules script) and `<name>.strings.json` (message text). Design decisions are in PLAN.md; this section records the SDK facts it relies on. Nothing here has been confirmed in Portal yet.

### Map edits (`.spatial.json`)

- Format, as written by the SDK exporter (`code/gdconverter`): `{ "Portal_Dynamic": [...], "Static": [...] }`. Each object has `name`, `type` (an asset type from `FbExportData/asset_types.json`), `id` (unique path), `position` in **world** coordinates, and `right`/`up`/`front`: the Godot basis **columns** (x, y, z axes). Their lengths carry the scale; non-uniform scale is unsupported. Properties such as `ObjId`, `Team` or `InfantrySpawns` sit beside them, and `linked` lists the properties that refer to other objects by `id`.
- Godot's `.tscn` text writes `Transform3D(...)` basis values row by row, so its first three numbers are **not** `right`. Check with Godot rather than reading the text.
- The level for every converted map is `MP_Portal_Sand`; `Static` must list `MP_Portal_Sand_Terrain` and `MP_Portal_Sand_Assets`. The base `FbExportData/levels/MP_Portal_Sand.spatial.json` has an empty `Portal_Dynamic`, but the Godot level contains two HQs (ObjId 1 and 2), a combat area and a deploy camera, so an export of edits must contain its own. The converter writes them all.
- Gameplay objects used: `HQ_PlayerSpawner` (`Team`, `AltTeam`, `ObjId`, `InfantrySpawns`), `SpawnPoint`, `AI_Spawner` (`ObjId`; found in script with `mod.GetSpawner(ObjId)`), `CombatArea` (`CombatVolume`), `PolygonVolume` (`points`, `height`) and `DeployCam`. ObjIds are per object type (Besieged uses 1 for an HQ and an AI spawner). The SDK examples use **one AI spawner per bot** (Besieged places 48; BombSquad and Skirmish spawn each bot from its own ObjId) and never `AlternateSpawns`, so the converted map has spawners 111, 112 (team 1) and 121, 122 (team 2) on the team's spawn tiles.
- **Polygon volume height is ambiguous:** the SDK importer treats the points' y as the bottom (the Godot node sits at y + height/2), but its exporter writes the node's y back unchanged. The converter starts the combat volume 5 m below the ground with 100 m height, which contains the ground under either reading.
- `BarrierStoneBlock_01_*` blocks have no level restriction and cost 2 of `MP_Portal_Sand`'s physics budget of 100000 (`FbExportData/level_info.json`). Mesh bounds at scale 1, origin at the bottom centre: A 1.28 × 1.2 × 1.28 m, B 1.35 × 2.4 × 1.35, C 1.465 × 3.605 × 1.402, D 1.28 × 1.2 × 2.56, E 1.41 × 2.41 × 2.68, F 1.47 × 3.6 × 2.66, G 1.46 × 2.4 × 5.23, H 1.48 × 3.71 × 5.29. Walls use C at scale 2.8; cover uses 3 × 3 A at scale 1.1.
- The SDK's Godot project ships without the model files. EA's model download (here `C:/PortalSDK/FbExportData/PortalSDKModels/models/`, about 10,800 `.glb` files) has the meshes; read a mesh's bounds from the glTF JSON (`accessors[...].min/max` of `POSITION`) instead of importing models into Godot, which is slow.
- Ground height: the Sand terrain lies between 32.0 and 33.6 m within 100 m of the origin. `site/converter/sand-heights.js` holds a 4 m grid generated by `tools/sand-heights.gd` (instructions in the script) with the SDK's bundled Godot running headless; regenerate it for a new SDK.
- Validate generated map edits with the SDK converter, which reports unknown types and properties: `PYTHONPATH=code/gdconverter/src ./python/python.exe -m gdconverter.import_spatial FbExportData <out-dir> <file>.spatial.json`, then `-m gdconverter.export_tscn <out-dir>/<file>.tscn FbExportData <out-dir2>` and compare. "Property linked is not found in asset data" also appears for EA's Besieged example and is harmless.

### Rules script

Findings from playing converted output in Portal:

- Local hosting writes `%TEMP%\Battlefield™ 6\PortalLog.txt`: "Script loading succeeded", then each uncaught exception in an event with the API error name, the native function and a stack of script functions with `main:<line>` numbers in the uploaded script. Each exception appeared six times in a row.
- `mod.RemoveEquipment(player, slot)` throws `NoWeaponOnSlot` when the slot is empty, which aborts the rest of the event. Portal logs the exception even when the script catches it, so `weapons.give` clears every slot only on the first change in a life (the deploy loadout is unknown) and afterwards only the slot it filled.
- `console.log` output appears in the log as `QuickJS: console.log: ...`.
- **Portal ends the round when a team's game mode score reaches the target score** set with `SetGameModeTargetScore`: a gun game round ended the moment blue reached 4 (a player levelled up to the knife), with no knife kill. Portal's team scores also dropped on their own (3–3 to 1–1) after bots rejoined with reused ids. The runtime therefore keeps scores and the target itself (`arcade.SetGameModeScore` and friends), copies scores to Portal for the scoreboard, never sets Portal's target, and logs "(Portal has blue … red …)" when Portal's team scores differ.
- No exceptions in a full gun game run with the per-slot weapon clearing, and weapon changes took effect in play.
- In play, soldiers spawning towards the map centre faced sensibly, and the 10 m walls and chest-high cover (scales above) looked right.
- Bots are named per seat (`SpawnAIFromAISpawner(spawner, name, team)`, "Blue bot 1", "Red bot 2"). With default names a friendly bot appeared to switch teams, consistent with its reused id being given to a new enemy bot.
- Arcade's score HUD becomes the header custom notification slot (`DisplayCustomNotificationMessage(..., HeaderText, ...)`), refreshed after each kill and every second. Portal routes `mod.DisplayCustomNotificationMessage` to `modlib`'s widget implementation, so call it through `mod`; there is no need to import the `modlib` version.
- **Player ids are reused.** A new bot takes the lowest free id, including an id last used by a bot on the other team. Never identify a bot by its id alone: the runtime matches each bot to its seat through `OnSpawnerSpawned`, which names the spawner, and fires in Portal before `OnPlayerDeployed`. Bots also fire `OnPlayerJoinGame`, and with `AISetUnspawnOnDead` they leave the game after dying.
- A single AI spawner per team, asked for one bot at a time, produced both of its team's bots and their respawns. The converter still gives each bot its own spawner, as the SDK examples do, because `OnSpawnerSpawned` then identifies the bot.

- The script is the runtime (`site/converter/portal-runtime.ts`, settings filled in), then the converted rules, then exported Portal events that call `arcade` hooks and the converted handlers. `OnPlayerJoinGame` and `OnPlayerDeployed` set the redeploy time; `OnPlayerDeployed` also applies the damage factor, bot behaviour and the player's remembered weapon category before the rules' own handlers.
- Bots: `arcade.start()` sets `AISetUnspawnOnDead(spawner, true)` and starts a loop that runs once a second. It checks which AI soldiers actually exist and are alive (`IsPlayerValid`, `GetSoldierState`) rather than relying on events, then requests at most one bot per team with `SpawnAIFromAISpawner(spawner, team)` until each team has two soldiers, counting humans. Each seat owns one spawner, and `OnSpawnerSpawned` reports the spawner, so a bot is matched to its seat exactly. Dead bots are replaced after the respawn delay; a request that produces no bot within 10 s is retried. Each bot takes a "seat" when first seen (the loop, `OnSpawnerSpawned`, `OnPlayerDeployed` or any rule), so variables keyed by seat survive its next life. Errors in the loop are caught and logged so it keeps running: an exception in a detached `async` loop is not reported and would stop it silently.
- Variables are stored by the runtime (number values, slots 0–31), not with Portal `ObjectVariable` slots, which would need editor declarations and would not follow bots between lives.
- `weapons.give` removes primary, secondary, gadgets, throwable, class gadget and melee, then adds the category's item; it only records the category for a dead player.
- With `settings.debug` (on in converted scripts for now), the runtime writes bot and player events to `PortalLog.txt` with `console.log`, which EA's examples also use.
- `tools/check-portal.cjs <sdk> <script.ts ...>` type-checks generated scripts with `strict`, and `tests/portal-convert.test.mjs` does the same for all three modes when `PORTAL_SDK` is set.
