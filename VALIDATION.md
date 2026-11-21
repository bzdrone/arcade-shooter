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

The tested checkout and toolchain warnings are recorded in PLAN.md. Do not assume a successful target setup exit means every bundled package/tutorial built cleanly. Review npm audit findings before exposing or deploying the development server; do not run automatic breaking upgrades as part of game validation.

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

Checks include two live soldiers per team, right/up human movement, retained aim, held/released firing, shared initial health, and the right wall boundary. Input is synthetic controller input through the simulator board, not a physical keyboard test. It then changes weapon damage in TypeScript, decompiles to Blocks, checks all four custom block types (three Shooter blocks plus deathmatch selection) and absence of grey blocks, edits damage in Blocks, and checks the regenerated TypeScript. This avoids a false pass from cached Blocks/TypeScript files.

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
node tests/png-hosted.cjs --tilemap
```

The first command exports the **baseline before test edits**, using Arcade's simulator-camera action. Although its tooltip says "Take Screenshot", this target's `saveAsPNG` setting routes that action through the official `saveProjectAsPNGAsync` exporter, embedding compressed project source. The script asserts that setting, decodes the resulting PNG using PXT, and compares every manifest-listed source file to the baseline. It does not construct a substitute PNG or re-encode the exported bytes.

The original downloaded bytes are copied to ignored `local/exports/arcade-shooter.png`. A fresh isolated browser context receives only that file through the editor's drag/drop importer. It checks 2v2 startup, custom Blocks, and a damage edit that round-trips and takes effect after stop/start compilation. `local/exports/validation.json` records the checksum and checks. Changing settings in the test does not modify the exported baseline.

The second command imports the same file into a fresh browser profile at `https://arcade.makecode.com/`, presses Play if needed, and checks simulator startup and all four custom Blocks without grey JavaScript. It does not publish the project. An alternate PNG path can be passed as the first argument. Evidence, target versions, and the tested checksum are written to `local/editor-smoke/hosted-result.json`.

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
- Play at least one unmodified natural match to assess pacing/readability; controlled smoke checks do not prove that the bots are fun, balanced, or tactically strong.

## Customization and Blocks

- Change each setting independently and verify its effect after stopping and starting the simulator (forces compilation). Fast restart can reuse previously compiled code.
- Verify the Shooter category contains weapon settings, soldier settings, and start shooter. Verify **use deathmatch rules** in the Deathmatch category and that `deathmatch.configure()` survives both round-trip directions. The soldier block keeps the legacy `shooter_set_enemies` ID, but displays soldier terminology and generates `setSoldiers`.
- Switch main.ts to Blocks and back: calls and argument values should survive without grey JavaScript blocks.
- Confirm shooter.ts remains a separate implementation file and is not inlined into main.ts.
- Verify settings below supported minima are clamped and do not crash.

## Project PNG delivery

- Export using Arcade's project-PNG facility, not a screenshot or ordinary image export.
- Import the exported PNG into a fresh editor project without access to this repository.
- Confirm main.ts, main.blocks, shooter.ts, deathmatch.ts, pathing.ts, tilemap.g.ts, tilemap.g.jres, and the required project configuration survive import.
- Open the tilemap thumbnail in Blocks and verify the level editor and wall tool work on the imported artifact.
- Repeat gameplay and Blocks checks against the imported artifact.
- Make a settings change after import and verify its effect after restart.
- Test the exact file intended for distribution; do not substitute a re-encoded image.
- Confirm learner instructions do not require cloning the repository or assembling source files. Do not assume the Markdown lesson drafts are embedded in the PNG.

## Learning activity

- Complete lesson 01 with the baseline and both variants.
- Check whether the learner can explain fire interval versus projectile speed and damage versus hits-to-defeat.
