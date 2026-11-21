# Arcade Shooter

A development repository for a MakeCode Arcade learning project about gameplay concepts that transfer to FPS modding.

## Audience and artifact

This repository is for authors developing the game and learning experience. Learners are not expected to clone it, use Git, or assemble its source files.

The learner-facing game artifact is a **MakeCode Arcade project PNG**: an image containing embedded project data that can be imported into the Arcade editor. It is not a screenshot. Learners import the PNG to play, inspect, and modify the game.

The implementation is primarily TypeScript, with a small Blocks-friendly customization surface. The PNG must carry the project files needed for that surface and its implementation, without relying on access to this repository.

## Gameplay and learning model

The example is a top-down shooter with one playfield, one weapon, and one enemy type. Direction buttons move the player; holding **A** fires along the last movement direction. Defeating 20 enemies wins, while enemy contact reduces the player's five lives.

Learning activities use a predict → change → test → explain loop. Weapon settings expose damage, fire interval, and projectile speed. Enemy settings expose health, speed, and spawn interval.

These are transferable shooter concepts, not a universal FPS modding API. The game is a local simulation with no networking or external assets; it does not implement first-person rendering or client/server authority.

## Training yard and navigation

The level is a single-screen **10×7 tile training yard**, using standard 16-pixel tiles. A solid perimeter surrounds two staggered cover barriers, with a central lane and routes above, below, and around the sides. The lower eight screen pixels are outside the 112-pixel-high map; there is no camera scrolling.

```text
##########
#........#
#..C.....#
#..CP.C..#
#.....C..#
#........#
##########
```

`#` is the perimeter, `C` is solid cover, `.` is floor, and `P` is the initial player position (the nearest floor center to screen center).

Walls block the player and bots; shots disappear on impact. Cover is indestructible and blocks shots from either side. Enemies spawn on reachable inner-perimeter floor at least 40 pixels from the player, with a maximum of six live enemies. If no safe entry is available, that spawn is skipped.

In **Blocks**, click the thumbnail in **set tilemap to** to open Arcade's level editor. Use **My Tiles** for this project's floor/wall/cover artwork, and the **wall tool** to mark cells blocked or passable. Changing artwork alone does not change collision. Keep the 10×7 dimensions, 16-pixel tile size, a solid outer border, and connected floor for this initial layout. Stop/start the simulator after editing.

`pathing.ts` reads those same wall markings. A shared reverse breadth-first search rebuilds a distance field toward the player every 250 ms. Bots follow cardinal tile-center waypoints, finishing a step before turning so they do not cut through cover corners. If a route is unavailable, they stop and retry as the field refreshes. This is basic pursuit, not tactical cover-seeking; the module is intended for small maps and sprites no larger than 8×8 pixels.

## Test an exported project PNG

Open https://arcade.makecode.com/ and drag the **original project PNG file** onto the page, or use **Import → Import File**. Press the simulator's Play button if it does not start automatically. No repository checkout, local server, or source-file assembly is needed.

Move with the arrow keys; use the on-screen **A** button or **Space** to fire (click inside the simulator first). Shots follow the last movement axis, keeping that aim when you stop. In **Blocks**, the Shooter category exposes the weapon and enemy settings. After changing a setting, stop and start the simulator to recompile; fast restart can reuse the previous compiled code.

For a short playtest, try the baseline, then change weapon damage from **1 to 3** and stop/start. Look for understandable aiming, readable sprites and HUD, noticeable weapon changes, and pacing that leaves room to experiment. Report anything confusing or frustrating. The current artifact is a development playtest build, not a fully verified release; lesson Markdown is not embedded.

The author-side export/import command and local artifact location are documented in VALIDATION.md; the exact tested artifact and checksum are recorded in PLAN.md.

## Authoring

Use https://arcade.makecode.com/ with the Arcade target. To assemble the source in an editor project:

1. Create a project and open JavaScript mode (MakeCode's TypeScript editor).
2. Copy the repository's pxt.json and all files it lists: main.ts, main.blocks, shooter.ts, pathing.ts, tilemap.g.ts, and tilemap.g.jres. The asset files are required for the level, not optional screenshots.
3. Keep main.blocks as the Blocks companion; without it Arcade treats the project as TypeScript-only.
4. Run the simulator and check the Blocks customization surface and tilemap editor.

Prefer importing the tested project PNG for playtesting. `tools/build-level.cjs` can regenerate the initial map using the sibling toolchain's asset serializer, but **overwrites editor-made level changes**; it is an authoring helper, not a learner requirement.

MakeCode's GitHub import is another authoring option for a hosted repository containing the Arcade pxt.json project. It is not the learner delivery mechanism.

Export the project using Arcade's project-PNG save/export facility. Import that exported PNG into a fresh editor project and validate it before distribution. Distribute the original file without image conversion or optimization that could damage its embedded project data.

## Source layout

- main.ts: learner-facing settings and startup calls inside the exported project.
- main.blocks: Blocks companion with the baseline settings; keep its values aligned with main.ts when editing source outside Arcade.
- shooter.ts: game implementation and annotated Blocks API.
- pathing.ts: shared tilemap distance field and per-bot waypoint movement.
- tilemap.g.ts / tilemap.g.jres: generated tilemap declarations, tile artwork, and wall markings; editable through Arcade's asset editor.
- tools/build-level.cjs: author-only initial-map generator (overwrites the asset files).
- pxt.json: Arcade project manifest.
- tests/gameplay.test.cjs / tests/pathing.test.cjs: dependency-free host-side logic and route checks; run with `node --test tests/gameplay.test.cjs tests/pathing.test.cjs` on Node.js 22.13+. These mocks do not replace Arcade compilation or simulator checks.
- tests/editor-smoke.cjs: real-editor browser smoke checks and optional project-PNG export/import using the sibling toolchain; see VALIDATION.md for setup and limitations.
- tests/png-hosted.cjs: imports an existing project PNG into a fresh hosted Arcade browser profile and checks simulator startup and Blocks.
- lessons/: learning-activity drafts for authors; these Markdown files are not automatically included as learner instructions in a project PNG.
- [Validation checklist](VALIDATION.md): gameplay, Blocks, and artifact checks.
- [Development plan](PLAN.md): agreed next steps and development status.

Settings apply before startGame(); later settings calls are ignored. Damage and health are whole numbers, intervals are milliseconds, and speeds are pixels per second.

## License

[MIT](LICENSE) — Copyright (c) 2026 bzdrone.
