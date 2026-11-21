# PXT / MakeCode Arcade authoring knowledge

Project-local reference for what we have actually learned. Read this before re-investigating the toolchain, simulator, Blocks, tilemaps, or project PNGs. Keep repeatable commands/checklists in [VALIDATION.md](VALIDATION.md), current work/evidence in [PLAN.md](PLAN.md), and learner usage in [README.md](README.md).

These are observations from the versions below, not promises about all MakeCode targets or future releases. Prefer the committed tests and matching upstream sources over undocumented assumptions.

## 1. Environment and known versions

All checkouts are sibling directories next to this repository (tests reference them as `../../pxt-arcade` and so on):

| Directory | Purpose / known revision |
| --- | --- |
| `arcade-shooter` | Game and author-side tests; not the toolchain or learner interface |
| `pxt-arcade` | Installed target; Arcade **4.2.1**, checkout `0642e6159d3fdb652fb1465a0aff73c5b8188578` |
| `pxt` | Read-only reference checkout at **v13.2.13** |
| `pxt-common-packages` | Read-only reference checkout at **v14.2.1** |

- Local compilation uses PXT **13.2.13** installed under `pxt-arcade/node_modules/`, NOT the sibling `pxt` reference checkout. No npm linking has been done.
- Hosted stable was independently tested at Arcade **4.1.28** / PXT **13.1.25**. Record the version again on later hosted runs; it can change.
- Node **24.22.3** worked locally. The host test suites use Node's built-in TypeScript transformer, available on Node 22.13+; its experimental warning is expected on the tested Node version.
- `pxt-arcade-sim` is not a public repository. Do not retry cloning it. Public target simulator code is in `pxt-arcade/sim/`; shared simulator code is in PXT and common packages.
- Ask before new installs, dependencies, publishing, or upstream modifications. Existing sibling dependencies suffice for the current build/browser tests.
- Initial npm install reported **24 vulnerabilities: 4 low, 5 moderate, 15 high**. No automatic audit fixes were applied. Target setup exited successfully despite upstream browser-events typing and tutorial-cache dependency diagnostics. Successful setup exit is not proof that every target package built cleanly.

### Commands from the game directory

```sh
node ../pxt-arcade/node_modules/pxt-core/built/pxt.js build
node --test tests/gameplay.test.cjs tests/pathing.test.cjs
node tests/editor-smoke.cjs --arena --png
node tests/png-hosted.cjs --tilemap
git diff --check
```

The browser commands depend on the test implementation matching the current game model. Check PLAN.md before assuming they are currently passing.

Initial target setup and `pxt install` are documented in VALIDATION.md. Do not reinstall or clone again just to rediscover commands. A global `pxt` installation is unnecessary: the CLI resolves the sibling target from its installation path. Simulator output is `built/debug/binary.js`; a successful build is not a hardware build, runtime playtest, or Blocks check.

## 2. Where to look upstream

| Question | Reference location |
| --- | --- |
| Physics, overlap callbacks, controllers, sprite flags/kinds, tiles | `../pxt-common-packages/libs/game/` |
| Physics ordering / stale overlap investigation | `libs/game/physics.ts` in common packages |
| Tilemap / location APIs | `libs/game/tilemap.ts` in common packages |
| Gameplay API docs | `../pxt-common-packages/libs/game/docs/` |
| PXT compiler/subset | `../pxt/pxtcompiler/`, `../pxt/docs/` |
| Blocks and decompilation | `../pxt/pxtblocks/`, `../pxt/pxtcompiler/` |
| Shared runtime/simulator | `../pxt/pxtsim/` |
| Editor controller message protocol | `../pxt/pxteditor/editorcontroller.ts`, `../pxt/pxtservices/iframeEmbeddedClient.ts` |
| Editor/project-PNG behavior | `../pxt/webapp/src/app.tsx`, `dialogs.tsx`, `../pxt/pxtlib/` |
| Tilemap serialization / generated assets | `../pxt/pxtlib/tilemap.ts`, `spriteutils.ts` |
| Tilemap palette crash investigation | `../pxt/webapp/src/components/ImageEditor/tilemap/TilePalette.tsx` |
| Target configuration and Arcade docs | `../pxt-arcade/pxtarget.json`, `../pxt-arcade/docs/` |

Match source tags to installed dependencies when reasoning about behavior. Reference checkouts do not affect compilation unless deliberately linked/rebuilt.

## 3. PXT TypeScript is not general TypeScript

- Compile game changes with the Arcade CLI, even when host tests pass. Node's transformer accepts constructs the PXT compiler may reject.
- **Classes with field initializers need an explicit constructor.** The new navigation `Field` initially failed with TS9209 until `constructor() {}` was added. A Node host test cannot detect this restriction.
- Typed classes and two-argument function callbacks work for the player/weapon/elimination API (milestone 1 CLI build and real simulator). Reference `../pxt/docs/language.md` and `../pxt-common-packages/libs/game/spriteevents.ts`: use namespace-based files, explicit constructors, and plain function callbacks, not class methods used as bound values. Typed event/action Blocks remain a separate milestone; TypeScript callback success alone does not prove their decompilation.
- Game code must use Arcade/PXT APIs, not Node/browser APIs. Keep Node helpers in author-side `.cjs` scripts outside the project manifest.
- Keep `main.ts` limited to editable asset selection, configuration, and startup. Put mechanics in separate TypeScript files. The implementation does not need to decompile to Blocks.
- Settings are applied before startup; the current setters ignore later calls. Tests must restart/recompile rather than assume runtime configuration changed.
- Health/damage are integers, velocity is pixels/second, intervals are milliseconds. Clamp/round settings deliberately.
- **Union types, `instanceof`, `typeof`, `await`:**
  - `pxtcompiler/emitter/emitter.ts` `checkType` enforces no type-system restrictions, so union-typed parameters such as `Team | Player` should compile.
  - `instanceof` is supported against **classes only**; other right-hand sides raise error 9275 ("unsupported instanceof expression"). Use classes, not interfaces, for types a function must tell apart.
  - `typeof` compiles to a runtime `pxt::typeOf` call; it distinguishes number/string/object but cannot tell two classes apart.
  - Multiple overload declarations for one function appear unsupported (only a TODO exists for an error message). Use one implementation with a union parameter instead.
  - `await` is **not** supported: its emitter case is inside a commented-out block, so it reaches `unhandled` (error 9202). Blocking calls such as `pause` already wait implicitly, so Arcade code simply omits `async`/`await`. Whether a bare `async` modifier is accepted was not determined.
  - Confirmed with `node tests/editor-smoke.cjs --scratch` on Arcade 4.2.1 / PXT 13.2.13: a temporary project compiles and runs class-union `instanceof` dispatch (`Team` → T, `Player` → P). Blocks accepts both class reporters, rejects numbers, and survives TS → Blocks → edited TS with no grey JavaScript. No default shadow is supplied: the input is an empty value socket when disconnected, not a number/text shadow.
  - The same real-simulator probe confirms a `pause`-based wait suspends only its calling parallel handler while another handler completes; no `async`/`await` is needed. `typeof` and rejection of `await` remain source-reading findings, not additional compile tests.
  - The probe creates/removes its project in an OS temporary directory and copies existing bundled dependencies; it installs nothing. Evidence stays ignored. Set `preferredEditor: tsprj` when importing a probe with an empty Blocks companion, or editor import may prefer empty Blocks over main.ts.
  - Blocks: `pxtblocks/loader.ts` `getBlocklyCheckForType` splits a parameter type on `|`; any `any` part makes the input accept everything.
- Regular TypeScript namespace-private state is not automatically exposed to host tests. The current rule suite injects an inspection hook into the **transformed test copy only**; do not add debug exports to the shipped game just to satisfy host tests.

## 4. Blocks: file presence and real round trips matter

- **Include `main.blocks` in `pxt.json` as well as on disk.** Without it, the original project was treated as TypeScript-only: no useful Blocks tab and controller switching to Blocks was a no-op, not an obvious compiler error.
- Keep baseline `main.blocks` values aligned with `main.ts` when editing outside Arcade. An old cached XML companion can produce a misleading test pass.
- Expose the small custom category with PXT annotations on exported functions in `shooter.ts`. Preserve explicit `blockId`s when changing labels/function names where practical.
- The soldier settings function is now `setSoldiers`, but deliberately retains the legacy `shooter_set_enemies` block ID. The ID is compatibility metadata, not visible gameplay terminology.
- Test BOTH directions: change a non-default value in TypeScript, decompile to Blocks, then edit a block value and inspect regenerated TypeScript. Merely seeing blocks is insufficient.
- Verify the custom category, expected custom block types, and absence of grey JavaScript blocks in `main.ts`; verify implementation files remain separate after import/round trip.
- In this editor, obtain Blockly with `pxt.blocks.requireBlockly()` and its workspace through `.common.getMainWorkspace()`. Do not assume a global `Blockly` exists in every build.
- **Stop then start after edits.** Fast `restartSimulator()` / controller `restartsimulator` can reuse previously compiled code. A successful edit round trip does not prove the simulator is running the new values; inspect a runtime setting after stop/start.

## 5. Tilemaps and navigation

### One source of truth

- Use Arcade's built-in tilemap editor and wall flags for rendering, collision, and navigation. No custom level editor, separate nav layout, or navigation extension is required for this map.
- Artwork and walls are independent. Painting a cover-looking tile is not enough: the cell must have its wall marking. Conversely a spawn-looking tile can be mistakenly marked as a wall.
- Include BOTH `tilemap.g.ts` and `tilemap.g.jres` in the manifest/export. The declarations alone do not contain the map/artwork data.
- `tools/build-level.cjs` calls the sibling toolchain's asset serializer to generate matching resources/declarations. **It overwrites editor-made asset changes.** Use it only when intentionally regenerating the baseline.

### The tile-size trap we already resolved

- An initial **8-pixel** map compiled and ran, but opening the tilemap editor crashed with `TypeError: Cannot read properties of undefined (reading 'id')` in the palette path, associated with empty gallery categories.
- Switching to standard **16-pixel** tiles fixed the local AND hosted tilemap-editor checks. Do not change back just because an 8-pixel map works in the simulator; asset editing must be tested too.
- Current yard: **10×7**, 16-pixel cells = **160×112**. Arcade screen is 160×120; eight pixels remain below the map. No scrolling. Perimeter and two staggered barriers are solid.

### Navigation design and limits

- Reverse BFS is cheap on a 70-cell map. Rebuild at most every 250 ms per target, not every frame for every bot.
- The original singleton field worked only when all bots chased the human. With teams and multiple targets, fields must be independent. The team design gives each target soldier its own `pathing.Field`, shared by bots pursuing that target.
- A replacement sprite must force a field refresh; cache identity as well as refresh time. Never steer from an invalid/blocked goal or unreachable cell.
- Finish cardinal tile-center waypoints before turning. Directly steering toward the next target every frame cuts cover corners. The current movement assumes sprites no larger than **8×8** within 16-pixel corridors.
- Stop on unreachable routes and retry after refresh. Host route tests integrate positions and check the whole 8×8 footprint, not just a center point.
- Cardinal shot visibility must check the projectile's width too. Current `clearLine` checks a two-pixel-wide corridor against the same wall flags; alignment alone is not permission to shoot through cover.
- `tests/tilemap-fixture.cjs` decodes the committed `.jres` without toolchain dependencies. It exposes map dimensions, tile indices/IDs, and wall flags for host checks; it is not Arcade's physics engine.

## 6. Collision and lifecycle lessons

- Overlap work can already be queued when an earlier callback destroys a sprite. Do not assume `destroy()` cancels every callback involving it immediately.
- A projectile must be consumed **before** destruction: change it to a private spent-projectile kind, then destroy it. Each hit callback checks the current kind so a queued overlap cannot reuse the shot.
- Untrack a defeated actor **before** destroying it. Later queued hits/destruction handlers must see that it is no longer live, preventing duplicate score/damage/respawn bookkeeping.
- In the engine/mode model, four persistent players own identity, team, weapon, spawn rotation, and respawn time. Each owns a nullable per-life soldier (sprite, health, cooldown, navigation/target field). Death clears the player's soldier before destruction; delayed respawn creates a fresh body for the same player, never another player slot.
- Active shots retain the persistent attacker and a damage snapshot captured at fire time. Remove consumed records before destruction; register destruction cleanup for both team shot kinds and the spent kind so wall/lifespan cleanup cannot grow the record list indefinitely.
- Match projectiles to teams, not to whether the firing sprite is still alive. Friendly overlaps do not consume the shot; opposing hits do. Cover destroys projectiles through `SpriteFlag.DestroyOnWall`.
- Test stale callbacks explicitly: delay destruction notifications and replay overlap callbacks after consumption/elimination. Mocking only the ideal callback order misses the original bug.
- Bot line-of-sight tests and consumed-shot bookkeeping do not establish real physics behavior. Keep the real-simulator cover and collision checks.
- `game.over` captures the current screen as the result background before the next HUD draw. Calling it immediately after incrementing a custom score captured **9** behind the dialog even though state was **10**. Mark the match finished first (blocking further hits), yield 50 ms to paint the final point, then call game over.
- Configure explicit blue/red game-over messages and disable unrelated built-in high-score judging for the custom team scoreboard. The result dialog waits for a button and calls `control.reset()`; test this actual button restart, not only the editor's restart command.

## 7. Browser/editor automation: reuse the existing harness

The working patterns are in `tests/editor-smoke.cjs` and `tests/png-hosted.cjs`; adapt them rather than starting another browser harness.

- Puppeteer is already installed in sibling `pxt-arcade/node_modules/`. No game-side npm dependency is needed.
- Chrome path: `C:/Program Files/Google/Chrome/Application/chrome.exe`; override with `ARCADE_BROWSER` if needed.
- Start `pxt serve` with target checkout as cwd, loopback hostname, `--just --noBrowser --noSerial`, ports **3242/3243**. Capture the `local_token` from server output. Close browser/server in cleanup.
- Parent page embeds editor at:

  ```text
  http://127.0.0.1:3242/index.html?controller=1&ws=mem#local_token=TOKEN&wsport=3243
  ```

- Use **`/index.html`**, not `/`: the root redirect previously discarded query parameters.
- Use **`ws=mem`**: controller mode without it can wait for a parent-provided storage implementation. Disposable contexts/memory workspaces avoid modifying a real user's projects.
- Send editor requests via `postMessage` with `{ type: "pxteditor", id, response: true, action, ...args }`; correlate by origin and ID. Responses also have **`type: "pxteditor"`**, not a guessed different response type. Check `success` and errors.
- Import project text from `pxt.json` plus every manifest-listed file; don't maintain another incomplete hardcoded source list.
- The simulator is a **separate iframe**. Current local target loads `https://trg-arcade.userpxt.io/---simulator`; these browser checks need internet and are NOT wholly offline.
- Wait for `pxsim.runtime.running` AND required globals, not just iframe existence. Access simulator state in its own frame.
- Global prefixes are not unique across namespaces: Arcade already has a `players___...` array. The test harness disambiguates the engine's player array by its element fields (`soldier`); do not blindly take the first prefix match.
- Compiled simulator globals have generated suffixes: find a key starting with `name + "___"`, not a complete hardcoded generated name. PXT runtime objects may wrap data: sprite `.fields`, array `.data`; sprite positions observed as `_x / 256`, `_y / 256`. These are version-specific test internals, not public gameplay APIs.
- Synthetic input goes through `pxsim.runtime.board.handleKeyEvent(key, down)` in the simulator frame. Existing tests show the key IDs. This is not verification of physical keyboard focus/mapping.
- Controlled placement of existing actors is useful for deterministic wall/detour checks; state explicitly that it is not a full natural match playtest. **Reset the moved bot's cached waypoint and its target field refresh deadline when teleporting it.** Otherwise it tries to finish a waypoint from its previous location, potentially steering diagonally into cover. This was a test-setup stall, not a production respawn defect (respawn creates a fresh navigator).
- Allow the initial Blocks load to settle before immediately editing imported cached XML. One fresh-import test lost an early field edit during that load; the harness now waits before editing, then verifies regenerated TypeScript AND the runtime value.
- Evidence screenshots/results go under ignored `local/editor-smoke/`. Do not confuse these screenshots with importable project PNGs.

## 8. Project PNGs: export the real project, validate exact bytes

- A learner deliverable is an **embedded-source MakeCode project PNG**, not a screenshot. Markdown lessons are not automatically embedded.
- In the tested Arcade target, `pxt.appTarget.compile.saveAsPNG` is true. Its simulator camera button is misleadingly labelled **"Take Screenshot"**, but calls the official project-PNG path (`downloadScreenshotAsync` → `saveProjectAsPNGAsync`). Assert this target setting before relying on the camera.
- Use the actual editor download. Do not replace it with a screenshot plus separately zipped sources, or an invented PNG encoder.
- The existing exporter decodes with `pxt.Util.decodeBlobAsync`, handles JSON versus LZMA payloads, parses the outer project container and its `.source`, and compares **every manifest-listed source/asset file** with the baseline (allowing CRLF/LF normalization).
- Export the baseline BEFORE automation changes any settings. Otherwise the artifact can accidentally contain a test variant.
- Copy the downloaded original bytes to `local/exports/arcade-shooter.png`; record SHA-256 and byte count. Re-exporting may change pixels and bytes, so validate the exact file intended for delivery.
- Import ONLY that PNG into a fresh isolated editor context; check startup, files, custom Blocks, a setting round trip/runtime change after stop/start, AND tilemap editing. Test the same bytes in hosted Arcade too.
- The hosted editor may need Play pressed after import. Don't treat a paused simulator as a compile failure.
- Do not optimize/re-encode the PNG or distribute an image preview/screenshot in its place. It can lose the embedded data.
- Local artifacts/evidence are ignored and not committed/published automatically. Old PNGs do not acquire source changes when the working tree changes; PLAN.md must identify which gameplay model the current artifact actually contains.

## 9. Evidence ladder / avoid false claims

1. Host rule/path tests: logic under mocks; no PXT compatibility or real physics guarantee.
2. Arcade CLI build: PXT subset and simulator code generation; no gameplay guarantee.
3. Real editor/simulator: targeted runtime/input/Blocks/tilemap checks; not automatically a full match or physical controls test.
4. Exact PNG fresh import: packaging/self-contained delivery; test actual imported gameplay too.
5. Full manual playtest: pacing, readability, both match outcomes, restart, physical keyboard, and lesson usefulness.

Keep the distinctions in reports. If mechanics change, update stale tests and documentation before calling the new build verified. Do not rerun a known stale test suite and mistake its old assumptions for a new gameplay regression.
