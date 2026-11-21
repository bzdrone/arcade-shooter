# Development plan

Temporary status and agreed next steps live here. Durable usage is in README.md, repeatable checks in VALIDATION.md, and accumulated toolchain/API knowledge in PXT-ARCADE.md (linked from AGENTS.md).

## Agreed direction

- A TypeScript-first MakeCode Arcade top-down shooter teaching transferable gameplay concepts, not a universal FPS modding API.
- Small Blocks-friendly configuration surface; implementation stays in separate TypeScript files.
- The repository is the authoring environment. Learners receive an importable **embedded-source project PNG**, not source assembly instructions or a screenshot. Lesson Markdown is not automatically embedded.
- User-approved gameplay: even 2v2 teams, blue human + one friendly bot versus two red bots; all called soldiers. Slower bots, ranged damage instead of contact damage, distinct team spawn tiles, five-second respawns including the human, first team to ten eliminations.
- Commit and push only with explicit user approval, given per step. Exported PNG/evidence remain ignored local outputs; release assets are published through GitHub Releases. Previous milestones: `152ae90` (engine/deathmatch split, game modes milestone 1), `a422488` (2v2 teams), `8469043` (editable yard/pathing).

## Next: Portal-shaped modding (agreed direction, revised 2026-11-21)

Revised with the user after milestone 1. This replaces the earlier game-mode milestones 2–3 (gun game in plain engine terms, then a separate generic "custom" Blocks API). Background and Portal API facts are in [PORTAL.md](PORTAL.md).

### Purpose

- MakeCode Arcade is a **short ramp to Battlefield 6 Portal**, not a destination. Learners stay only long enough to understand scripting a game mode with **event handlers, functions, and per-player variables**, then move to Portal.
- Keep the Arcade side small. Do not add polish that does not serve that path (balance tuning, more maps, weapon variety beyond gun game's needs, demotion, and so on) unless the user asks.
- The mod layer is **Portal-shaped, not Portal-compatible**. Porting a mode to Portal is expected to take a short, predictable list of fix-ups (see PORTAL.md). A single source file shared verbatim by both platforms is **not** a goal; no build-time conversion tooling.

### Layers

1. **Engine** (`shooter.ts`, done in milestone 1): players, soldiers, weapons, combat, respawns, bots, elimination event, match control. Author-facing plumbing; keeps plain "player"/"soldier" naming. Learners do not program against it directly.
2. **`mod` layer** (new): the only learner-facing scripting surface. Copies Portal's `mod` names, argument order and event shapes for the subset game modes need, mapped thinly onto the engine. This reverses the earlier "plain words only" decision **for this layer**: Portal's names are the point. Portal overloads become one function with a union parameter (for example `SetGameModeScore(target: Team | Player, score)`) dispatched with `instanceof`; Blocks accept union-typed inputs.
3. **Compatibility libraries** that hide Portal systems too large to mirror:
   - **Weapons:** a small weapon-category vocabulary (about 4–6 categories, enough for a gun game ladder), with `giveWeapon(player, category)`-style calls. Arcade maps a category to stats (damage, interval, speed, range, projectile color); a later Portal-side table maps it to one concrete `mod.Weapons` value plus inventory slot and removes the previous weapon. Do not mirror Portal's 67-gun `Weapons` enum, inventory slots, or real gun names.
   - **Messages:** mirror Portal `modlib`'s simple helpers instead of its widget UI system: `mod.Message(text, a?, b?, c?)` with `{}` placeholders, `ShowNotificationMessage(msg, target?)`, `ShowEventGameModeMessage(msg, target?)`, optionally `ShowHighlightedGameModeMessage`. Target is an optional `Player | Team`; omitted means everyone. Arcade draws messages in the HUD on a timer with a queue (never `game.splash`), and drops messages aimed only at bots or the red team since there is one screen.
4. **Modes**: `deathmatch.ts` and `gungame.ts` are rewritten/written **against `mod`** so they double as worked examples that read almost like Portal scripts. "Custom" is simply no built-in mode loaded: the learner writes rules with `mod`.

### Engine additions the mod layer needs

Required (no longer optional): a **deployed/respawned event**; **engine-owned team and player scores** plus target score, drawn by the HUD (replacing per-mode score state); **ending the match with a winning player or team**; **per-player variables that survive respawn** (Portal `ObjectVariable`); the **self-inflicted-death convention** (attacker and victim are the same player); and, for gun game, **weapon range** and **range-aware bots** that close distance before firing. Milestone 1 already added per-shot ownership/damage snapshots.

### Revised milestones

The user decided to put the Portal-shaped layer **last**. Build the shared generic engine support first, using plain engine names; deathmatch and gun game use the engine directly until the later adapter work. The layers above describe the eventual architecture, not the implementation order.

The user authorized autonomous implementation of A–D using best judgment, full validation and a separate commit after each slice. Report progress between slices without waiting for approval. Do not push, publish, add dependencies, or implement E. If unions fail, use separately named team/player functions rather than stopping.

**A. Match state owned by the engine** (next; not started)

- First run a scratch test outside the tracked project, confirming the source-reading findings in PXT-ARCADE.md §3: a union parameter with `instanceof` dispatch between two classes compiles and runs; a union-typed Blocks input accepts both types and rejects unrelated types (record its appearance without a default shadow); TypeScript ↔ Blocks round-trip works; a generic wait built on `pause` blocks only the calling event handler. Record confirmed results in PXT-ARCADE.md. If unions fail, document the limitation and use separately named functions as authorized by the user.
- Add a deployed event receiving the player on every spawn, including the initial spawn.
- Move team/player scores and target score into the engine and draw them in its HUD. Deathmatch stops owning counters and must still play identically to `v0.1.0-preview.1`.
- Change `endMatch` to one function accepting a winning team or player through a union parameter; preserve team-win messages and button restart.
- Add a simple numeric per-player variable store that survives respawn; choose name or index keys based on PXT simplicity and document the choice.
- Add queries for all players, team, human/bot control, alive state, and elimination/death counts.
- Test the elimination conventions: self-inflicted elimination reports the same attacker and victim; external sprite removal schedules respawn without a point or elimination event.

**B. Messages: generic HUD notifications**

- Add short notifications and large centered announcements, targeted to everyone (default), a player, or a team through one union-typed target parameter.
- Use timed HUD queues, never `game.splash` or another gameplay-blocking UI. On the single screen, show messages for everyone, the human, or the human's team; drop bot-only/opposing-team messages.
- Support up to three `{}` placeholders filled by strings, numbers, or players (using display names). Keep the bottom status line engine-only.

**C. Weapons**

- Add range and projectile color while respecting current shot lifetime and wall behavior. Keep deathmatch's default `(1, 750, 80)` weapon and effectively unchanged range.
- Add a small named preset catalog in generic engine terms, not Portal enums or real gun names. User excluded sniper and preferred one automatic weapon. Selected catalog: pistol, SMG, shotgun, knife (very short range); omit rifle.
- Make bots close distance until within weapon range before firing; retain alignment, cover and visibility rules.

**D. Gun game and mode selection**

- Implement `gungame.ts` against the engine, not `mod`: per-player level in a player variable, advance on elimination, immediately assign the next catalog weapon, announce level-ups using slice B, and end via `endMatch(player)` on the last weapon's elimination, subject to the agreed victory model.
- User approved individual ladders with a team win. `endMatch(player)` credits the finishing player's team. Demotion is out of scope.
- Add deathmatch / gun game / no-mode (engine-only) selection to `main.ts` and Blocks. Keep existing block IDs stable and assign stable IDs to new blocks.
- Report balance observations, especially human 70 px/s versus bots 10 px/s; ask before tuning beyond basic playability.

**E. Deferred: Portal-shaped layer and learner path**

- Not part of slices A–D: the `mod` layer, rewriting modes against it, learner event/action Blocks, lessons, porting checklist work, Portal-side files, or releases. Do not start these yet.

For A–D, prefer one function per action with a team/player union where applicable (separately named functions are the approved fallback); events pass players, never sprites. No learner-facing engine event/action Blocks: only configuration and mode-selection blocks. Keep the scope to engine support needed by these slices; no extra maps or unrelated polish.

**Validation after each slice:** Arcade CLI build; host tests with new behavior coverage; `node tests/editor-smoke.cjs --arena --png`; both Blocks round-trip directions without grey JavaScript; exact-source PNG export and fresh import; `node tests/png-hosted.cjs --tilemap`. Inspect screenshots for visible HUD/message changes. Slices A–C must preserve published deathmatch gameplay; report skipped checks or behavior changes plainly.

### Open design questions

- Gun game progression: individual ladders with a team win (leaning) vs. one team ladder.
- Weapon vocabulary: smaller kid-friendly set (pistol, SMG, shotgun, rifle, sniper, knife; leaning) vs. Portal's eight categories plus knife.
- Messages: two types (notification + event message; leaning) or three. Whether the persistent HUD status line joins the mod layer (Portal custom notification slot `HeaderText`) or stays engine-only (leaning engine-only).
- Namespaces: whether Arcade also has a `modlib` namespace so helper calls match Portal scripts exactly (`modlib.ShowNotificationMessage`), at the cost of one more concept.
- Team numbering in `mod`: expose Portal's 1/2 (0 = neutral) or keep the engine's 0/1 and list it as a porting fix-up.
- Where Portal-side files live: a folder here (outside the PNG manifest) or a separate repository/project.
- Blocks presentation of `mod` rules: plain MakeCode event blocks or a Portal-like rule shape.

## Game modes milestone 1: implemented and automated checks passed

- `shooter.ts` now holds four persistent `Player` values, each with a nullable per-life `Soldier`. Identity/team/control/weapon/respawn timing/spawn rotation stay on the player; body health, sprite, cooldown, navigation and target field are recreated per life.
- Added typed weapon creation/assignment, attacker/victim elimination callbacks, mode HUD text, and guarded match ending. `deathmatch.ts` owns team scores and the ten-elimination rule; running only the engine has no scoring or automatic victory.
- `main.ts` and `main.blocks` select deathmatch before starting. Existing three Shooter block IDs are unchanged; a separate `deathmatch_configure` block selects the original rules. Three-way mode selection, gun game, and learner event/action Blocks remain future work.
- Per-shot ownership/damage snapshots moved forward from milestone 2 because reliable attacker events and runtime weapon changes need them now. Destroyed/consumed shots release their records; shots still credit a dead attacker. Weapon replacement affects subsequent shots, retains the current cooldown, and survives respawn. No range/color/bot-balance changes in this slice.
- **31 host tests pass** (20 rules/lifecycle/mode checks + 11 pathing checks). New coverage includes engine-only operation beyond ten eliminations, player/body identity, weapon persistence, shot snapshots after attacker death, record cleanup, duplicate mode selection, and match-end guards. These remain mocks, not physics verification.
- **Arcade CLI build passes** on the existing Arcade 4.2.1 / PXT 13.2.13 toolchain. No dependencies, installs, upstream modifications, commits, pushes, or publishing.
- **`node tests/editor-smoke.cjs --arena --png` passes**: baseline 2v2 movement/aim/fire, cover, bot detours/fire, friendly/contact rules, team points, five-second red/human respawns, occupied-spawn retry, rebound controls, both tenth-point game-over paths and actual button restart. Runtime checks also verify the same red player receives a new soldier body on respawn. Inspected both result screenshots: correct team and final score ten.
- Both TS ↔ Blocks directions retain all four custom blocks including deathmatch selection, with no grey JavaScript. Tilemap editor opens with wall controls. Exported manifest-listed sources match exactly; fresh local import starts 2v2 and a Blocks damage edit takes effect after recompilation.
- **`node tests/png-hosted.cjs --tilemap` passes** for the same PNG bytes on hosted Arcade 4.1.28 / PXT 13.1.25: baseline startup, all four blocks, and editable tilemap.
- **Current local playtest PNG:** `local/exports/arcade-shooter.png`, **42,130 bytes**, SHA-256 **`f6245535a07e1405a25b7afa29ff6b4791ab0c08d7e102488232dc83ad87425f`**. This overwrites the local export path, not the published preview asset. Evidence: `local/exports/validation.json`, `local/editor-smoke/result.json`, `local/editor-smoke/hosted-result.json`; logs `local/modes-smoke.log`, `local/modes-hosted.log`.
- Committed as `152ae90`; not tagged or released. Optional user playtest of this refactor remains. Next work follows "Next: Portal-shaped modding" above, starting with the scratch compile test. Synthetic-input/controlled scenarios are not a new natural-match, physical-keyboard, balance, or learner evaluation. The prior positive playtest belongs to the published baseline, not this refactor.

## Previous 2v2 implementation milestone (published baseline)

- Four fixed soldier slots own team, health, live sprite, weapon cooldown, respawn deadline, and target distance field. Death clears the live sprite before destruction; a respawn reuses that slot rather than growing a swarm.
- Both teams share health/weapon rules. Defaults: three health; damage 1, fire interval 750 ms, projectile speed 80 px/s. All three bots use identical target selection, movement and firing logic at 10 px/s; human movement is 70 px/s.
- Bots independently select reachable opponents by shortest tile route, follow cardinal waypoints, and shoot when cardinally aligned and unobstructed. Cover blocks soldiers and shots. Each target owns an independent reverse BFS field, refreshed at most every 250 ms and shared by its pursuers.
- Bullet-only damage, friendly fire off, friendly projectiles pass through teammates, one consumed shot damages at most one opposing soldier. Stale collision callbacks cannot duplicate damage/points.
- Blue/red spawn tile assets are editable in the tilemap. Baseline: blue column 1 / rows 2 and 4; red column 8 / rows 2 and 4. Startup requires two walkable points per team and connected routes. Respawns wait at least five seconds, then choose an unoccupied own-team point or keep waiting.
- HUD shows team scores, human health/respawn status, and small soldier health bars. Human helmet stripe identifies the controlled soldier. First team to ten wins; explicit team-result messages and actual button restart are implemented.
- Final score is painted before game-over captures the background (50 ms yield after marking match finished). Screenshots confirm final score ten, not a stale nine.
- `main.ts` / `main.blocks` configure weapon `(1, 750, 80)` and soldiers `(3, 10, 5000)`. New `setSoldiers` function keeps legacy `shooter_set_enemies` block ID; visible labels/code use soldier terminology.
- README, validation checklist, and weapon lesson now describe shared team rules/settings. Technical discoveries are persisted in PXT-ARCADE.md. No new dependencies, installs, or upstream patches.

## Previous 2v2 verification completed

- **28 host tests pass** on Node 24.22.3: 17 rule/team tests + 11 navigation/visibility tests. Includes the actual entry point, team counts, all bot fire, friendly-fire/contact rules, stale callbacks, human/friendly/red respawns, occupied points, invalid maps, both ten-point outcomes, independent/replaced target fields, projectile-width visibility and cover routes/footprints. Host tests use mocked APIs, not Arcade physics.
- **Arcade CLI build passes** with Arcade 4.2.1 / PXT 13.2.13, target checkout `0642e6159d3fdb652fb1465a0aff73c5b8188578`. Simulator code generation, not a hardware build. PXT's explicit-constructor restriction was resolved.
- **`node tests/editor-smoke.cjs --arena --png` passes**: real-simulator 2v2 startup, human movement/retained aim/held and released fire, right boundary, cover collision/shot destruction, 10 px/s detours around both barriers, all three bots firing, harmless contact, friendly bullets passing through an ally, real eliminations and team points, five-second red/human respawns, occupied-point retry, and rebound human controls.
- Both real-simulator match-end paths pass: seed a team score at nine and target health at one, fire a real bullet for the tenth point, inspect winning-team screenshots, and use the **game-over dialog button** to restart. Scores reset and four healthy soldiers return. These are controlled outcome tests, not full natural matches.
- Actual TypeScript → Blocks → TypeScript changes pass, with three custom blocks, soldier labels/settings, tilemap setup, no grey JavaScript blocks, and implementation remaining separate. Tilemap editor opens with wall controls.
- Exact PNG export decodes and matches every manifest-listed baseline source/asset file. A fresh local context imports only that PNG, starts 2v2, round-trips a damage change through Blocks, and verifies runtime damage 3 after stop/start compilation.
- **`node tests/png-hosted.cjs --tilemap` passes** for the same bytes in fresh hosted Arcade **4.1.28 / PXT 13.1.25**: baseline settings, two soldiers per team with shared health, custom Blocks without grey JavaScript, and imported tilemap editor with wall controls.
- Browser checks use synthetic simulator-board input and controlled actor placements, not physical keyboard play. Local editor still loads a hosted simulator iframe and requires internet.

## Published baseline artifact (historical local export)

The local export/evidence paths below have since been replaced by milestone 1 above. The original PNG remains available from the published preview release; its checksum is still valid for that release asset only.

- Original file: **`local/exports/arcade-shooter.png`**, **37,778 bytes**, ignored local output. This replaced the previous solo/enemy yard PNG with the 2v2 soldier match.
- SHA-256: **`4292f96a126c99eabcd9d493fb877eac780454e7d112813f9667fe243056b21b`**.
- Evidence: `local/exports/validation.json`, `local/editor-smoke/result.json`, `local/editor-smoke/hosted-result.json`; screenshots including `blue-win.png`, `red-win.png`, `blocks.png`, `tilemap-editor.png`, `hosted-png.png`, `hosted-tilemap.png`. Run logs: `local/team-smoke.log`, `local/team-hosted.log`.
- Import the original PNG into https://arcade.makecode.com/ via drag/drop or Import → Import File. It contains source/assets, not the lesson Markdown. No repository/toolchain required for the learner.
- Re-exporting can change PNG bytes: validate and record the exact new checksum rather than reusing this evidence for a different file.

## User review and learner handoff

- User playtested the current game and reported that it played well. Keep the baseline mechanics/pacing unless concrete feedback identifies a problem; this is positive playtest feedback, not evidence that every manual checklist item was separately exercised.
- User agreed to defer further learner-path evaluation until an actual learner is available. This milestone is a learner-test candidate, not a validated lesson.
- Added `INTRO.md`: a short separate learner handout covering PNG import, controls, match rules, and one predict/change/test/explain experiment, with a link to the existing weapon activity. Supply these documents alongside the original PNG; they are not embedded.
- When a learner is available, observe where they need help and what they can explain afterward, including that weapon changes affect both teams. Do not substitute author rehearsals for learner evidence.
- Tune from feedback rather than expanding scope automatically. Further commits and any push require explicit approval.

## Preview release v0.1.0-preview.1 (published)

- User agreed to head toward a GitHub Release rather than build a Pages site now. Proposed version: `v0.1.0-preview.1`, marked prerelease because actual learner evaluation is pending.
- Added release notes and a pinned candidate descriptor under `releases/`, `RELEASING.md`, and dependency-free `tools/prepare-release.cjs`. The helper stages original PNG bytes, separate learner handouts, license, SHA256SUMS and provenance under ignored `local/releases/v0.1.0-preview.1/`. It checks source against tested game commit `a422488` and PNG identity against matching local/hosted evidence; it does not rerun runtime tests or publish.
- Introduction now references the separately attached activity by filename, avoiding a repository-relative link that would break for flat release downloads.
- Before the first push, history was rewritten (with user approval) to replace a personal author email with the GitHub noreply address. Trees are identical; the tested game commit is now `a422488` (was `c35b715`). A local `backup/pre-email-rewrite` branch keeps the old history and should not be pushed.
- Remote `origin` = https://github.com/bzdrone/arcade-shooter, created private for validation, made **public** on 2026-11-21 after a publish-suitability audit (history, PNG-embedded project, assets). Annotated tag `v0.1.0-preview.1` → `692ee8a` (preparation commit).
- **Published prerelease:** https://github.com/bzdrone/arcade-shooter/releases/tag/v0.1.0-preview.1 (2026-11-21). All six assets downloaded anonymously pass `SHA256SUMS`; the PNG is the validated 37,778-byte file with SHA-256 `4292f96a…b21b`.
- Gather real learner feedback on this release when a learner is available; tune the existing match from that feedback. New feature work continues under "Next: Portal-shaped modding". Delete the local `backup/pre-email-rewrite` branch when no longer needed.

## Toolchain caveats

- Initial approved sibling target setup exited successfully but logged upstream browser-events typing/tutorial-cache dependency diagnostics. npm reported 24 vulnerabilities (4 low, 5 moderate, 15 high); no automatic audit fixes applied.
- Reference siblings `pxt` v13.2.13 and `pxt-common-packages` v14.2.1 are not npm-linked replacements. Compilation uses installed packages under `pxt-arcade/node_modules/`.
- Public `pxt-arcade-sim` source is unavailable; do not retry cloning. See PXT-ARCADE.md for source locations and already-solved setup/editor pitfalls.
