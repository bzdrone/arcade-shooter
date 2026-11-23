# Arcade Shooter

A development repository for a MakeCode Arcade learning project: a gentle on-ramp to scripting game modes in Battlefield 6 Portal.

**Start here:** read the [learner introduction](INTRO.md). New to MakeCode Arcade? Work through a few beginner tutorials on [its home page](https://arcade.makecode.com/) first. Then download `arcade-shooter.png` from the newest version on the [Releases page](https://github.com/bzdrone/arcade-shooter/releases) and follow the introduction to play and change one number. You don't need to clone this repository. The handouts here may be newer than those attached to a published release.

## Audience and artifact

This repository is for authors developing the game and learning experience. Learners are not expected to clone it, use Git, or assemble its source files.

The learner-facing game artifact is a **MakeCode Arcade project PNG**: an image containing embedded project data that can be imported into the Arcade editor. It is not a screenshot. Learners import the PNG to play, inspect, and modify the game. Supply the short [learner introduction](INTRO.md) alongside it for import instructions, controls, and a first experiment.

The implementation is primarily TypeScript, with a small Blocks-friendly customization surface. The PNG must carry the project files needed for that surface and its implementation, without relying on access to this repository.

## Gameplay and learning model

The example is a **two-versus-two top-down soldier match**: you and one blue bot versus two red bots. Your soldier has a white helmet stripe. Direction buttons move you; holding **A** fires along the last movement axis, retaining aim when you stop.

- Every soldier starts with **3 health** and uses the same weapon: **1 damage**, **750 ms** between shots, projectiles at **80 px/s**. Small bars above soldiers show remaining health.
- All three bots move at **10 px/s**, choose reachable opposing soldiers independently, route around walls, and shoot when cardinally aligned with a clear shot. Human movement is **70 px/s**.
- **Only bullets cause damage.** Touching soldiers is harmless; friendly fire is off, and friendly bullets pass through teammates. Cover blocks both teams and destroys shots.
- Each elimination earns the shooter's team one point. The **first team to 10** wins. The HUD shows both scores and your health/respawn status; the result screen names the winning team. Press a button there to restart.
- An eliminated soldier—including you—waits **five seconds**, then returns with full health at a clear spawn tile for its own team. If all its team's points are occupied, it waits rather than spawning on someone. There are always four soldier slots, never a growing swarm.

The learner path starts with a few MakeCode Arcade beginner tutorials, then a short play session and one damage change in the existing Blocks workspace. Activity 1 stays in Blocks and introduces the other weapon settings one at a time; writing game-mode rules is a later activity, not part of the first session. Learning activities use a predict → change → test → explain loop. Weapon settings apply to **both teams**, exposing damage, fire interval, and projectile speed. Soldier settings expose shared health, bot speed, and respawn delay.

These are transferable shooter concepts, not a universal FPS modding API. The game is a local simulation with no networking or external assets; it does not implement first-person rendering or client/server authority.

## Training yard and navigation

The level is a single-screen **10×7 tile training yard**, using standard 16-pixel tiles. A solid perimeter surrounds two staggered cover barriers, with a central lane and routes above, below, and around the sides. The lower eight screen pixels are outside the 112-pixel-high map; there is no camera scrolling.

```text
##########
#........#
#B.C....R#
#..C..C..#
#B....C.R#
#........#
##########
```

`#` is the perimeter, `C` is solid cover, `.` is floor, and `B`/`R` are blue/red spawn tiles. These are tile identities, not just decorative colors. The human starts at the upper blue point and the friendly bot at the lower one; red soldiers start at the two red points. Respawns rotate through available points for that team. Cover is indestructible.

In **Blocks**, click the thumbnail in **set tilemap to** to open Arcade's level editor. Use **My Tiles** for this project's floor/wall/cover artwork, and the **wall tool** to mark cells blocked or passable. Changing artwork alone does not change collision. Keep the 10×7 dimensions, 16-pixel tile size, a solid outer border, and connected floor for this initial layout. Use the existing **blueSpawn** and **redSpawn** tiles to move/add team entry points. Keep at least **two walkable spawn tiles per team**, connected by floor to all other spawn tiles; startup reports invalid layouts. Stop/start the simulator after editing.

`pathing.ts` reads those same wall markings. Each target soldier owns an independent reverse breadth-first distance field, refreshed at most every 250 ms and shared by bots pursuing it. Bots select an opposing soldier by shortest reachable tile route, then follow cardinal tile-center waypoints, finishing a step before turning so they do not cut cover corners. If a route is unavailable, they stop and retry. They shoot instead of advancing when aligned and unobstructed. This is basic pursuit and shooting, not tactical cover-seeking; the module is intended for small maps and sprites no larger than 8×8 pixels.

## Test an exported project PNG

Open https://arcade.makecode.com/ and drag the **original project PNG file** onto the page, or use **Import → Import File**. Press the simulator's Play button if it does not start automatically. No repository checkout, local server, or source-file assembly is needed.

Move with the arrow keys; use the on-screen **A** button or **Space** to fire (click inside the simulator first). Shots follow the last movement axis, keeping that aim when you stop. In **Blocks**, the Shooter category exposes the weapon and soldier settings. After changing a setting, stop and start the simulator to recompile; fast restart can reuse the previous compiled code.

For a short playtest, try the baseline, then change weapon damage from **1 to 3** and stop/start. The change applies to every soldier, not only your weapon. Look for understandable aiming, readable teams/HUD, noticeable weapon changes, and pacing that leaves room to experiment. Report anything confusing or frustrating. The current artifact is a development playtest build, not a fully verified release; lesson Markdown is not embedded.

The author-side export/import command and local artifact location are documented in VALIDATION.md; the local export's checksum is in `local/exports/validation.json`, and published releases are listed in PLAN.md.

## Authoring

Use https://arcade.makecode.com/ with the Arcade target. To assemble the source in an editor project:

1. Create a project and open JavaScript mode (MakeCode's TypeScript editor).
2. Copy the repository's pxt.json and all files it lists: main.ts, main.blocks, shooter.ts, messages.ts, weapons.ts, mod.ts, deathmatch.ts, gungame.ts, pathing.ts, tilemap.g.ts, and tilemap.g.jres. The asset files are required for the level, not optional screenshots.
3. Keep main.blocks as the Blocks companion; without it Arcade treats the project as TypeScript-only.
4. Run the simulator and check the Blocks customization surface and tilemap editor.

Prefer importing the tested project PNG for playtesting. `tools/build-level.cjs` can regenerate the initial map using the sibling toolchain's asset serializer, but **overwrites editor-made level changes**; it is an authoring helper, not a learner requirement.

MakeCode's GitHub import is another authoring option for a hosted repository containing the Arcade pxt.json project. It is not the learner delivery mechanism.

Export the project using Arcade's project-PNG save/export facility. Import that exported PNG into a fresh editor project and validate it before distribution. Distribute the original file without image conversion or optimization that could damage its embedded project data.

## Source layout

- main.ts: learner-facing settings and startup calls inside the exported project.
- main.blocks: Blocks companion with the baseline settings; keep its values aligned with main.ts when editing source outside Arcade.
- shooter.ts: combat engine, persistent players, per-life soldiers, weapons, respawns, bots, and annotated settings/start Blocks API.
- mod.ts: the Portal-shaped scripting layer (Mod Blocks category): events, score, teams, variables, messages and wait under Battlefield 6 Portal's names.
- deathmatch.ts: first-team-to-ten rules, written with `mod` as a worked example.
- gungame.ts: individual weapon ladders (pistol → SMG → shotgun → knife), written with `mod`; the player who finishes wins for their team.
- weapons.ts: weapon compatibility library (Weapons Blocks category): four named categories, not a real inventory simulation.
- messages.ts: non-blocking notification/announcement queues and single-screen audience filtering.
- pathing.ts: per-target tilemap distance fields, cardinal shot visibility, and per-bot waypoint movement.
- tilemap.g.ts / tilemap.g.jres: generated tilemap declarations, tile artwork, and wall markings; editable through Arcade's asset editor.
- tools/build-level.cjs: author-only initial-map generator (overwrites the asset files).
- site/: the Arcade to Portal converter, a static web page (see below). `site/converter/` holds the conversion code, shared with `tools/convert-portal.mjs`; `portal-runtime.ts` is the Portal-side runtime included in every converted script; `sand-heights.js` is generated by `tools/sand-heights.gd`.
- portal/ and tools/check-portal.cjs: the hand-written Portal port of gun game that the converter's output is modelled on, and a type check of Portal scripts against a local Portal SDK. Not part of the PNG.
- tests/portal-convert.test.mjs / tests/portal-runtime.test.mjs / tests/portal-site.cjs: converter host tests, the converted script run against a simulated Portal, and a browser check of the converter page.
- pxt.json: Arcade project manifest.
- tests/gameplay.test.cjs / tests/pathing.test.cjs: dependency-free host-side logic and route checks; run with `node --test tests/gameplay.test.cjs tests/pathing.test.cjs` on Node.js 22.13+. These mocks do not replace Arcade compilation or simulator checks.
- tests/editor-smoke.cjs / tests/team-simulator.cjs: real-editor browser checks, controlled 2v2 combat/respawn/endgame checks, and optional project-PNG export/import using the sibling toolchain; see VALIDATION.md for setup and limitations.
- tests/png-hosted.cjs: imports an existing project PNG into a fresh hosted Arcade browser profile and checks simulator startup and Blocks.
- lessons/: learning-activity drafts for authors; these Markdown files are not automatically included as learner instructions in a project PNG.
- [PXT / Arcade authoring knowledge](PXT-ARCADE.md): toolchain/source map, compiler restrictions, Blocks, tilemap, simulator automation, and PNG pitfalls already investigated.
- [Battlefield 6 Portal reference](PORTAL.md): author notes on the Portal SDK and the Portal-shaped `mod` layer.
- [Validation checklist](VALIDATION.md): gameplay, Blocks, and artifact checks.
- [Release preparation](RELEASING.md): stage just the validated PNG and introduction for download, with supporting records kept separately, without publishing.
- [Design and open work](PLAN.md): architecture, design decisions, releases and what is not yet verified.

Baseline settings and mode selection apply before startGame(); later settings calls are ignored. **set shooter mode** chooses deathmatch (the baseline), gun game, or no mode; the last selection before startup wins. The older **use deathmatch rules** block still works and selects deathmatch. With no mode, the engine still runs combat and respawns but does not score eliminations or end a match automatically.

**Gun game:** every soldier starts with the pistol. Each elimination of an opponent moves only that player up one weapon (pistol → SMG → shotgun → knife) and shows an announcement; levels survive death. An elimination with the knife wins for that player's team. The HUD's team score is the team's highest level and the target is 4. Only shots from the player's current weapon advance a level, so a late shot from an earlier weapon still damages but cannot skip a level. The level is stored in player variable slot 0. There is no demotion.

For TypeScript mode authors, `shooter.createWeapon(damage, interval, speed)` makes a weapon value, and `shooter.giveWeapon(player, weapon)` changes that player's subsequent shots and survives respawn. Already-fired shots retain their original damage and attacker; replacing a weapon does not reset the current cooldown. `shooter.onElimination(function (attacker, victim, weapon) { ... })` registers rules before startup (the `weapon` argument is optional: the weapon that fired the eliminating shot, or null for scripted damage) and reports persistent players, not disposable soldier bodies. External sprite removal is not an elimination and does not change elimination/death statistics. `shooter.dealDamage(victim, damage, attacker?)` supports scripted damage; omitted attacker means self-inflicted damage (same attacker/victim in the event, no elimination credit).

Match state belongs to the engine: `getScore`/`setScore` accept a `Team | Player`; `getTargetScore`/`setTargetScore` control the target. Deathmatch increments only team scores and supplies the ten-point rule. `shooter.endMatch(teamOrPlayer)` accepts either value; a player winner wins for their team. `teamById(0/1)` and `getTeam(player)` return team values. `allPlayers()` returns a copy of the roster; `isHuman`, `isAlive`, `getEliminations`, and `getDeaths` provide player queries. `onDeployed` fires once per successful spawn, including initial deployment after map validation. Register events before startup.

`getVariable(player, index)` / `setVariable(player, index, value)` provide 32 numeric slots (0–31) per player, initially zero, surviving respawn. The HUD owns team scores, target, health/respawn status, and the human's nonzero personal score. Deathmatch's HUD remains unchanged. Learners script rules through the `mod` layer below rather than these engine calls.

For mode messages, `messages.text("{} reached level {}", player, level)` substitutes up to three placeholders (strings, numbers, or players by display name). Send it using `messages.notify(text, target?)` or `messages.announce(text, target?)`. Omitted target means everyone; a player/team target uses the same union types as match state. On this single screen, only everyone/human/blue-team messages are shown. Notifications last 1.8 seconds, announcements 2.4 seconds, with separate queues capped at eight entries each. They never pause play; overflow removes the oldest waiting entry, preserving the current message.

`createWeapon` also accepts optional range (pixels), projectile color (0 = team color, 1–15 = palette), and display name. Range is capped at speed × 2.5 seconds; wall/off-screen cleanup still applies. `weapons.create(weapons.Kind.Pistol/SMG/Shotgun/Knife)` returns a fresh preset. Pistol matches baseline; SMG fires faster at medium range, shotgun fires one heavy short-range shot (no spread), and knife is a very short-range shot using existing combat rules. Bots keep approaching until their current weapon can reach the target. There is no sniper or separate rifle preset.

## Portal-shaped mod layer

The **Mod** and **Weapons** Blocks categories are the learner scripting surface: event handlers, functions and per-player variables, using Battlefield 6 Portal's names so the ideas transfer. Choose **no mode** to write rules from scratch; [lesson 2](lessons/02-mod-rules.md) walks through it. `deathmatch.ts` and `gungame.ts` are complete modes written the same way.

- Events: `mod.OnGameModeStarted`, `OnPlayerDeployed(eventPlayer)`, `OnPlayerDied(eventPlayer, eventOtherPlayer)` (eventPlayer died) and `OnPlayerEarnedKill(eventPlayer, eventOtherPlayer, eventWeapon)` (eventPlayer eliminated eventOtherPlayer; `eventWeapon` is a weapon category or -1). Self-inflicted eliminations pass the same player twice. Start and first deployments arrive on the first frame, so event blocks may be placed anywhere.
- Actions: `SetGameModeScore` / `GetGameModeScore` (team or player), `SetGameModeTargetScore`, `GetTargetScore`, `EndGameMode` (team or player; a player wins for their team), `GetTeam` (a player, or **1** = blue / **2** = red as in Portal), `Equals`, `AllPlayers`, `GetPlayerKills`, `GetPlayerDeaths`, `DealDamage`.
- Variables: `SetVariable` / `GetVariable` on `ObjectVariable(player or team, 0–31)` or `GlobalVariable(0–31)`. Player slots are the engine's slots and survive respawn.
- Messages: `Message(text, a?, b?, c?)` with `{}` placeholders, shown with `DisplayNotificationMessage` or `DisplayGameModeMessage` (large centred), optionally to a player or team.
- `Wait(seconds)` pauses only the current handler.
- Weapons: `weapons.give(player, kind)`, `weapons.current(player)`, `weapons.name(kind)`.

Hover over a custom block in Arcade to read its help. Shooter, Mod, and Weapons blocks explain their purpose, with input descriptions in the source JSDoc. Mod descriptions are adapted from the Portal SDK and call out Arcade-specific behavior; the help travels inside the project PNG, with no extra download.

The layer is Portal-shaped, not Portal-compatible: Arcade code does not run in Portal unchanged. The converter below translates it.

## Play your project in Portal (experimental)

The Arcade to Portal converter turns a saved project PNG into files for a Battlefield 6 Portal experience: the tilemap becomes walls, cover and team spawns on the Portal Sandbox map (`MP_Portal_Sand`, one tile = 4 m), and the selected mode plus your own Mod rules become a Portal TypeScript script with its strings file. Bots fill each team to two soldiers, as in Arcade. Its output has **not yet been tested in Portal**; see PLAN.md.

- **Web page:** `site/` is static and needs no server-side code. Serve the folder over HTTP (browsers block its modules from `file://`), for example with `python -m http.server -d site` or any static host, open it and drop the PNG on it. Nothing is uploaded.
- **Command line:** `node tools/convert-portal.mjs <project.png> [output-folder]` writes the three files (default `local/portal/`) and prints what was converted.

In Portal's web builder, create an experience on Portal Sandbox, attach the `.spatial.json` map edits, and add the `.ts` script and `.strings.json` strings file to the rules. Rules that use Arcade-only blocks (sprites, info, game, and so on) are commented out in the script and listed as notes; message text must be typed into the message block so it can move to the strings file.

Settings apply before startGame(); later settings calls are ignored. Damage and health are whole numbers, intervals are milliseconds, and speeds are pixels per second.

## License

[MIT](LICENSE) — Copyright (c) 2026 bzdrone.
