# Validation checklist

Run these checks in MakeCode Arcade before calling the starter verified. This checklist is not a record that the checks have passed.

## Automated host-side logic checks

With Node.js 22.13+ installed, run from the repository root:

```sh
node --test tests/gameplay.test.cjs tests/pathing.test.cjs
```

No npm packages are required. The tests transform TypeScript using Node's built-in transformer and run it against a minimal mocked Arcade API. Node may emit an experimental-transformer warning.

These checks cover the actual main.ts entry point, exactly two soldiers per team, shared health/weapons, bot fire, retained human aim/cooldown, friendly-fire immunity, harmless contact, team scoring, both match outcomes, delayed human/bot respawns, occupied points, invalid spawn layouts, settings clamps, and external sprite cleanup. The rule suite injects a private-state inspection hook into its transformed test copy only; this hook is not exported in game source or the PNG.

Pathing checks decode committed tilemap assets, verify connected floor, exercise both barriers in both directions, check the 8×8 footprint, and test moving/replaced targets, independent fields, blocked/unreachable goals, reopened passages, and shot corridors (including bullet width). Collision checks delay destruction and replay stale overlaps so consumed shots or defeated soldiers cannot award duplicate damage/points.

The additional engine/mode checks cover persistent player identity and fresh soldier bodies across respawn, weapon replacement and persistence, actual fired-shot damage/attacker snapshots after attacker death, projectile record cleanup, rules-free engine operation beyond ten eliminations, idempotent deathmatch selection, and match-end guards. The baseline assertions use a test-only compatibility view of split player/soldier state; no flattened slot API is shipped.

The mocks do **not** validate PXT compatibility, physics, sprite lifetime/off-screen cleanup, rendering, input, automatic zero-life game over, restart, Blocks, or PNG packaging. Passing them is not simulator verification.

Message checks cover literal three-slot substitution, stable display names, all/human/team audience filtering, independent timers, FIFO bounds/overflow and firing while messages are active. With `--arena`, a disposable source variant also exercises actual HUD rendering, queue expiry and movement/firing; inspect `messages.png`. Variant source is not exported in the baseline PNG.

Weapon checks cover all four presets, range/color clamps, fire-time color/lifetime snapshots and range-aware bot behavior. `--arena` adds real short-shot expiry (cannot hit a distant target), aligned knife pursuit without out-of-range firing, and a close-range elimination; inspect `range-pursuit.png`. Baseline deathmatch checks still use `(1, 750, 80)` and its original colors/lifetime.

Mode checks cover last-wins `setMode` selection before startup, the legacy `deathmatch.configure()` path, engine-only operation, and gun game for both teams: per-player level persistence across death, independent teammate levels, team score as the highest level, old-weapon shots not advancing a level, and the final knife elimination winning for the finisher's team. `--arena` (or the faster `--modes`) also runs a controlled full gun-game ladder for each team with real bullets, checks the team result and game-over button restart, and round-trips the mode dropdown (gun game → no mode → gun game); inspect `gun-game-level-up.png`, `gun-blue-win.png`, `gun-red-win.png`, `gun-game-blocks.png`.

Mod layer checks cover handlers registered after startup still receiving game start and first deployments on the first frame, Portal player order in died/kill events (including self-inflicted and the firing weapon category), Portal team numbering (1/2, 0 = none), score/target/end mapping, player/team/global variables (player slots survive respawn, out-of-range ignored), message placeholders and audience filtering, learner rules running with no built-in mode, and the weapons library. `--arena` (or the faster `--mod`) appends a learner-style program of Mod/Weapons blocks after `startGame()` in a disposable no-mode project, checks its start/deploy/kill/died handlers and a non-blocking `Wait` with a real elimination, then converts it TS → Blocks (every Mod/Weapons block type, no grey blocks, edits the target score) → TS → compile → run; inspect `mod-rules.png` and `mod-blocks.png`.

## Portal port type check

Run `node tools/check-portal.cjs <path-to-portal-sdk>` (or set `PORTAL_SDK`). It type-checks `portal/*.ts` against that SDK's `mod` declarations and `modlib`, using the TypeScript compiler bundled with the sibling toolchain, and checks that every `mod.stringkeys` key exists in the matching `.strings.json`. It does not run anything in Portal; treat Portal behavior as untested until played there.

## Arcade to Portal converter

```sh
node --test tests/portal-convert.test.mjs                # PORTAL_SDK=<sdk> also type-checks the output
node --test tests/portal-runtime.test.mjs                # converted script against a simulated Portal
node tests/portal-site.cjs [project.png]                 # default: local/exports/arcade-shooter.png
```

The runtime simulation runs a converted gun game script against mocks of the Portal behaviour recorded in PORTAL.md: new bots take the lowest free player id (also across teams), one bot per AI spawner, bots leave after dying, and `RemoveEquipment` throws for empty slots. It checks that both teams fill and refill after the respawn delay through repeated deaths without extra or lost bots, that a bot keeps its seat, level and weapon across lives, and that later weapon changes clear only the filled slot. It cannot show how bots behave in Portal.

The host tests build their own project PNGs from the repository files (JSON and, with the sibling toolchain's `lzma` package, LZMA payloads) and check the LZMA decoder against MakeCode's compressor. They check the training yard's map edits (every wall tile built, unique ids, links that resolve, team sides, everything inside the combat area), map errors (missing spawns, too large), deathmatch, gun game and no-mode output, a learner program (waits through a helper function, variables, joined message text, an Arcade-only statement), unreadable code, and too many message values. With `PORTAL_SDK` set they type-check the converted scripts for all three modes against the SDK; with a local export they also convert it end to end.

The browser check serves `site/` locally, loads the PNG through the real file input at desktop size (light) and phone size (dark), and checks for page errors, a successful conversion, the downloads, both map previews and no horizontal scrolling. It also checks that the page's files are identical to the command-line converter's. Inspect `local/portal-site/desktop.png` and `phone.png`.

To check map edits with the SDK's own converter, see PORTAL.md. None of these checks shows that the output works in Portal; only playing it there does.

## Compatibility probe

Run `node tests/editor-smoke.cjs --scratch` to build a temporary Arcade project outside this repository using copies of existing bundled dependencies. It tests class-union dispatch, Blocks connection acceptance/rejection and an edited TS ↔ Blocks round-trip, and concurrent handlers around a `pause`-based wait. No probe APIs are packaged in the game. Results/screenshots go to ignored editor evidence. Normal rule tests also cover initial/respawn deployment, numeric variable persistence, team/player score isolation, roster-copy queries, statistics and self-inflicted/external-removal conventions.

## Local Arcade CLI compilation

Keep the toolchain separate from the game, as a sibling checkout under `~/Source`. Initial setup (already performed locally with approval):

```sh
cd ~/Source
git clone https://github.com/microsoft/pxt-arcade.git
cd pxt-arcade
npm install
node node_modules/pxt-core/built/pxt.js buildtarget --skipCore
```

From this game's repository root, install bundled Arcade dependencies and compile:

```sh
node ../pxt-arcade/node_modules/pxt-core/built/pxt.js install
node ../pxt-arcade/node_modules/pxt-core/built/pxt.js build
```

The CLI resolves the sibling Arcade target from its installation path; no global `pxt` executable is needed. Generated `pxt_modules/`, `built/`, and `tsconfig.json` are ignored and are not learner deliverables. For this configuration, simulator code is written to `built/debug/binary.js`. A successful build does not establish simulator behavior, Blocks compatibility, or hardware compatibility.

The tested checkout and toolchain warnings are recorded in PXT-ARCADE.md. Do not assume a successful target setup exit means every bundled package/tutorial built cleanly. Review npm audit findings before exposing or deploying the development server; do not run automatic breaking upgrades as part of game validation.

## Upstream source and documentation

Public dependency repositories are also checked out as siblings under `~/Source`, at tags matching the installed npm dependencies:

- `../pxt` — microsoft/pxt, tag `v13.2.13`: compiler in `pxtcompiler/`, Blocks support in `pxtblocks/`, shared simulator infrastructure in `pxtsim/`, and authoring/CLI documentation in `docs/`.
- `../pxt-common-packages` — microsoft/pxt-common-packages, tag `v14.2.1`: Arcade gameplay APIs in `libs/game/` (sprites, physics, overlap handling, controllers), with API docs in `libs/game/docs/`.
- `../pxt-arcade` — target configuration, bundled libraries, Arcade docs in `docs/`, and public target simulator code in `sim/`.

The dependency checkouts are read-only references for now, not npm-linked replacements. Compilation still uses the installed packages in `pxt-arcade/node_modules/`. Keep versions aligned when investigating behavior; only link and rebuild source checkouts when deliberately testing upstream changes. The separate `pxt-arcade-sim` repository is not public and has not been cloned.

## Real-editor browser smoke checks

After the local target setup above, run:

```sh
node tests/editor-smoke.cjs
```

This uses Puppeteer already installed in the sibling Arcade toolchain and an installed Chrome browser. On this Windows machine Chrome is detected at its standard Program Files path; set `ARCADE_BROWSER` to another compatible Chromium executable if needed. No extra packages are added to the game.

The script starts its own loopback-only editor server on ports 3242/3243, uses a disposable browser profile and in-memory workspace, and closes the browser/server on completion. It does not publish a project or change repository source. An internet connection is currently needed: this target loads the hosted simulator iframe at `https://trg-arcade.userpxt.io/---simulator`.

Checks include two live soldiers per team, right/up human movement, retained aim, held/released firing, shared initial health, and the right wall boundary. Input is synthetic controller input through the simulator board, not a physical keyboard test. It then changes weapon damage in TypeScript, decompiles to Blocks, checks the four custom block types in the baseline (three Shooter settings/start blocks plus the **set shooter mode** dropdown) and absence of grey blocks, edits damage in Blocks, and checks the regenerated TypeScript. This avoids a false pass from cached Blocks/TypeScript files.

Screenshots and a JSON result are written to ignored `local/editor-smoke/`. Screenshots are evidence only, **not project PNG artifacts**. The baseline smoke checks do not cover the complete gameplay checklist, match endings, physical controls, lesson variants, or PNG export/import. Optional checks below cover controlled combat/endgame and artifact import. A successful Blocks round trip must also preserve shooter.ts as a separate project file during final artifact validation.

For the team/training-yard checks, run `node tests/editor-smoke.cjs --arena`. `tests/team-simulator.cjs` uses controlled placement of existing soldiers and freezes unrelated bots; it does not alter shipped game source. Checks cover:

- Human/shot wall collision and 10 px/s bot detours around each barrier.
- All three bots firing, both projectile teams, harmless contact, and friendly bullets passing through an ally to damage a red soldier.
- Real bullet eliminations, team points, persistent red player identity with a fresh soldier body on respawn, five-second red and human respawn delays, team-specific entry points, occupied points delaying human respawn, and controls rebinding afterward.
- Both team victory paths: seed the relevant score at nine and target health at one, then use a **real bullet for the tenth point**. Inspect result screenshots and use the game-over dialog's actual button restart; verify fresh scores and 2v2 soldiers. This does not simulate ten natural eliminations or establish match balance.
- Tilemap thumbnail opening with wall controls, then Done. `--tilemap` runs just the editor-opening check alongside baseline smoke checks.

Controlled teleports reset that soldier's navigation waypoint and field refresh deadline, since retained waypoints from the old location otherwise create artificial wall stalls. Evidence includes `blue-win.png`, `red-win.png`, `arena-pathing.png`, and `result.json` under `local/editor-smoke/`.

## Repeatable project-PNG export/import

With the same local toolchain and browser setup:

```sh
node tests/editor-smoke.cjs --arena --png
node tests/png-hosted.cjs --tilemap --modes
```

The first command exports the **baseline before test edits**, using Arcade's simulator-camera action. Although its tooltip says "Take Screenshot", this target's `saveAsPNG` setting routes that action through the official `saveProjectAsPNGAsync` exporter, embedding compressed project source. The script asserts that setting, decodes the resulting PNG using PXT, and compares every manifest-listed source file to the baseline. It does not construct a substitute PNG or re-encode the exported bytes.

The original downloaded bytes are copied to ignored `local/exports/arcade-shooter.png`. The exporter asserts `preferredEditor: blocksprj` in the embedded manifest. A fresh isolated browser context receives only that file through the editor's drag/drop importer. Before any tab-switch command, it verifies that the Blocks workspace is visible. It then checks 2v2 startup, custom Blocks, and a damage edit that round-trips and takes effect after stop/start compilation. `local/exports/validation.json` records the checksum and checks. Changing settings in the test does not modify the exported baseline.

The second command imports the same file into a fresh browser profile at `https://arcade.makecode.com/`, verifies that it opens directly in Blocks without switching tabs, presses Play if needed, and checks simulator startup and all four custom Blocks without grey JavaScript. With `--modes`, it switches the imported project's dropdown to gun game in Blocks, recompiles, and checks that a real elimination advances the weapon and shows the level-up message (`hosted-gun-game.png`). It does not publish the project. An alternate PNG path can be passed as the first argument. Evidence, target versions, and the tested checksum are written to `local/editor-smoke/hosted-result.json`.

These checks need internet access. Exporting again may change image pixels and PNG bytes; revalidate and record the checksum of the exact file handed to a tester. Files under `local/editor-smoke/` are ordinary evidence screenshots, not project artifacts. Full gameplay and physical-control testing remain separate.

## Compilation and simulator

- Import all manifest-listed source and asset files with the Arcade target; check for compile errors.
- Confirm direction controls move the player and screen boundaries contain it.
- Hold A: shots fire repeatedly with the configured interval, aiming along the last movement axis.
- Release A: firing stops. Remaining projectiles disappear.
- Start with a blue human (white helmet stripe), one blue bot, and two red bots at their team's spawn tiles. There must be exactly four soldier slots; death/respawn never adds a fifth.
- The level fits on screen without scrolling. Perimeter and cover stop the player; projectiles disappear on wall impact.
- Bots route around both barriers from either side without clipping corners or sticking to walls. Move around a corner mid-chase and verify pursuit adapts.
- Close a passage in the level editor: bots must respect the new wall markings. An unreachable bot stops; reopening a passage permits routing again.
- Move/edit the blue/red spawn tiles; startup uses their identities. Missing, blocked, or disconnected required points report an invalid layout rather than starting an unfair/inaccessible match. Keep two walkable points per team.
- All soldiers have three health by default and use the same weapon. All bots move at 10 px/s, target reachable opponents independently, and shoot only with clear cardinal alignment.
- Touching opponents does no damage. Friendly shots pass through teammates without damage; opposing shots damage exactly one soldier and are consumed.
- Each elimination awards one point to the firing team, including when the firing soldier has died. Stale callbacks never duplicate damage/points.
- Human and bot deaths wait five seconds before returning at an unoccupied team point, with restored health and a fresh cooldown. Occupied points delay respawn without adding soldiers. Human death does not end the match; HUD shows the countdown/wait state and controls work after returning.
- First team to ten eliminations wins. Result screen names blue/red correctly and shows the final score behind the dialog. Press a button to restart with scores zero and four healthy soldiers.
- Gun game (select it in Blocks): every soldier starts with the pistol; an opposing elimination immediately moves only that player to SMG, shotgun, then knife, with a level-up announcement; a level survives death; the first knife elimination wins for that player's team. Human speed (70 px/s) versus bots (10 px/s) favours the human more here than in deathmatch; note pacing rather than tuning.
- Play at least one unmodified natural match to assess pacing/readability; controlled smoke checks do not prove that the bots are fun, balanced, or tactically strong.

## Customization and Blocks

- Change each setting independently and verify its effect after stopping and starting the simulator (forces compilation). Fast restart can reuse previously compiled code.
- Verify the Shooter category contains weapon settings, soldier settings, and start shooter. Verify **set shooter mode** offers deathmatch, gun game and no mode and survives both round-trip directions (`shooter_set_mode`). The legacy **use deathmatch rules** block (`deathmatch_configure`) remains and selects deathmatch. The soldier block keeps the legacy `shooter_set_enemies` ID, but displays soldier terminology and generates `setSoldiers`.
- Switch main.ts to Blocks and back: calls and argument values should survive without grey JavaScript blocks.
- Confirm shooter.ts remains a separate implementation file and is not inlined into main.ts.
- Hover over custom Shooter, Mod, and Weapons blocks to check that their help is readable and matches Arcade's behavior. The local and hosted scripts also call `tests/block-docs.cjs` to inspect the actual tooltips on all custom blocks, including the legacy deathmatch block; evidence is saved as `block-docs.json` / `hosted-block-docs.json`.
- Verify settings below supported minima are clamped and do not crash.

## Project PNG delivery

- Export using Arcade's project-PNG facility, not a screenshot or ordinary image export.
- Import the exported PNG into a fresh editor project without access to this repository.
- Confirm main.ts, main.blocks, shooter.ts, deathmatch.ts, gungame.ts, messages.ts, weapons.ts, pathing.ts, tilemap.g.ts, tilemap.g.jres, and the required project configuration survive import.
- Open the tilemap thumbnail in Blocks and verify the level editor and wall tool work on the imported artifact.
- Repeat gameplay and Blocks checks against the imported artifact.
- Make a settings change after import and verify its effect after restart.
- Test the exact file intended for distribution; do not substitute a re-encoded image.
- Confirm learner instructions do not require cloning the repository or assembling source files. Do not assume the Markdown lesson drafts are embedded in the PNG.

## Learning activity

- Follow the introduction's tutorial-project PNG save/import practice, then import the shooter and change damage from 1 to 3.
- Complete activity 1's firing-interval experiment and optional projectile-speed experiment.
- Check whether the learner can explain fire interval versus projectile speed and damage versus hits-to-defeat.
