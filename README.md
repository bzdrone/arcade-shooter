# Arcade Shooter

A development repository for a MakeCode Arcade learning project about gameplay concepts that transfer to FPS modding.

**To play:** download `arcade-shooter.png` and `INTRO.md` from the newest version on the [Releases page](https://github.com/bzdrone/arcade-shooter/releases), then import the PNG at https://arcade.makecode.com/. You don't need to clone this repository.

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

Learning activities use a predict → change → test → explain loop. Weapon settings apply to **both teams**, exposing damage, fire interval, and projectile speed. Soldier settings expose shared health, bot speed, and respawn delay.

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

The author-side export/import command and local artifact location are documented in VALIDATION.md; the exact tested artifact and checksum are recorded in PLAN.md.

## Authoring

Use https://arcade.makecode.com/ with the Arcade target. To assemble the source in an editor project:

1. Create a project and open JavaScript mode (MakeCode's TypeScript editor).
2. Copy the repository's pxt.json and all files it lists: main.ts, main.blocks, shooter.ts, deathmatch.ts, pathing.ts, tilemap.g.ts, and tilemap.g.jres. The asset files are required for the level, not optional screenshots.
3. Keep main.blocks as the Blocks companion; without it Arcade treats the project as TypeScript-only.
4. Run the simulator and check the Blocks customization surface and tilemap editor.

Prefer importing the tested project PNG for playtesting. `tools/build-level.cjs` can regenerate the initial map using the sibling toolchain's asset serializer, but **overwrites editor-made level changes**; it is an authoring helper, not a learner requirement.

MakeCode's GitHub import is another authoring option for a hosted repository containing the Arcade pxt.json project. It is not the learner delivery mechanism.

Export the project using Arcade's project-PNG save/export facility. Import that exported PNG into a fresh editor project and validate it before distribution. Distribute the original file without image conversion or optimization that could damage its embedded project data.

## Source layout

- main.ts: learner-facing settings and startup calls inside the exported project.
- main.blocks: Blocks companion with the baseline settings; keep its values aligned with main.ts when editing source outside Arcade.
- shooter.ts: combat engine, persistent players, per-life soldiers, weapons, respawns, bots, and annotated settings/start Blocks API.
- deathmatch.ts: first-team-to-ten rules over engine-owned team scores; selected by `deathmatch.configure()` before startup.
- pathing.ts: per-target tilemap distance fields, cardinal shot visibility, and per-bot waypoint movement.
- tilemap.g.ts / tilemap.g.jres: generated tilemap declarations, tile artwork, and wall markings; editable through Arcade's asset editor.
- tools/build-level.cjs: author-only initial-map generator (overwrites the asset files).
- pxt.json: Arcade project manifest.
- tests/gameplay.test.cjs / tests/pathing.test.cjs: dependency-free host-side logic and route checks; run with `node --test tests/gameplay.test.cjs tests/pathing.test.cjs` on Node.js 22.13+. These mocks do not replace Arcade compilation or simulator checks.
- tests/editor-smoke.cjs / tests/team-simulator.cjs: real-editor browser checks, controlled 2v2 combat/respawn/endgame checks, and optional project-PNG export/import using the sibling toolchain; see VALIDATION.md for setup and limitations.
- tests/png-hosted.cjs: imports an existing project PNG into a fresh hosted Arcade browser profile and checks simulator startup and Blocks.
- lessons/: learning-activity drafts for authors; these Markdown files are not automatically included as learner instructions in a project PNG.
- [PXT / Arcade authoring knowledge](PXT-ARCADE.md): toolchain/source map, compiler restrictions, Blocks, tilemap, simulator automation, and PNG pitfalls already investigated.
- [Battlefield 6 Portal reference](PORTAL.md): author notes on the Portal SDK and how the planned Portal-shaped mod layer, weapon and message libraries map onto it.
- [Validation checklist](VALIDATION.md): gameplay, Blocks, and artifact checks.
- [Release preparation](RELEASING.md): stage the validated PNG and learner handouts for a versioned preview release, without publishing.
- [Development plan](PLAN.md): agreed next steps and development status.

Baseline settings and mode selection apply before startGame(); later settings calls are ignored. The Shooter category retains its three settings/start blocks; the Deathmatch category adds **use deathmatch rules**. Without mode rules, the engine still runs combat and respawns but does not score eliminations or end a match automatically.

For TypeScript mode authors, `shooter.createWeapon(damage, interval, speed)` makes a weapon value, and `shooter.giveWeapon(player, weapon)` changes that player's subsequent shots and survives respawn. Already-fired shots retain their original damage and attacker; replacing a weapon does not reset the current cooldown. `shooter.onElimination(function (attacker, victim) { ... })` registers rules before startup and reports persistent players, not disposable soldier bodies. External sprite removal is not an elimination and does not change elimination/death statistics. `shooter.dealDamage(victim, damage, attacker?)` supports scripted damage; omitted attacker means self-inflicted damage (same attacker/victim in the event, no elimination credit).

Match state belongs to the engine: `getScore`/`setScore` accept a `Team | Player`; `getTargetScore`/`setTargetScore` control the target. Deathmatch increments only team scores and supplies the ten-point rule. `shooter.endMatch(teamOrPlayer)` accepts either value; a player winner wins for their team. `teamById(0/1)` and `getTeam(player)` return team values. `allPlayers()` returns a copy of the roster; `isHuman`, `isAlive`, `getEliminations`, and `getDeaths` provide player queries. `onDeployed` fires once per successful spawn, including initial deployment after map validation. Register events before startup.

`getVariable(player, index)` / `setVariable(player, index, value)` provide 32 numeric slots (0–31) per player, initially zero, surviving respawn. The HUD owns team scores, target, health/respawn status, and the human's nonzero personal score. Deathmatch's HUD remains unchanged. Player/action/event Blocks and other modes are planned, not implemented yet.

Settings apply before startGame(); later settings calls are ignored. Damage and health are whole numbers, intervals are milliseconds, and speeds are pixels per second.

## License

[MIT](LICENSE) — Copyright (c) 2026 bzdrone.
