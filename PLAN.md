# Development plan

Temporary status and agreed next steps live here. Durable usage is in README.md, repeatable checks in VALIDATION.md, and accumulated toolchain/API knowledge in PXT-ARCADE.md (linked from AGENTS.md).

## Agreed direction

- A TypeScript-first MakeCode Arcade top-down shooter teaching transferable gameplay concepts, not a universal FPS modding API.
- Small Blocks-friendly configuration surface; implementation stays in separate TypeScript files.
- The repository is the authoring environment. Learners receive an importable **embedded-source project PNG**, not source assembly instructions or a screenshot. Lesson Markdown is not automatically embedded.
- User-approved gameplay: even 2v2 teams, blue human + one friendly bot versus two red bots; all called soldiers. Slower bots, ranged damage instead of contact damage, distinct team spawn tiles, five-second respawns including the human, first team to ten eliminations.
- Commit and push only with explicit user approval, given per step. Exported PNG/evidence remain ignored local outputs; release assets are published through GitHub Releases. Previous milestones: `a422488` (2v2 teams), `8469043` (editable yard/pathing).

## Next: game modes (milestone 1 implemented)

Direction agreed with the user on 2026-11-21. User approved the concrete API sketch and milestone 1 implementation in this session.

- **Engine vs. game mode.** `shooter.ts` becomes the engine: players, soldiers, weapons, combat, respawns, bots, an elimination event, and match control. It has no built-in scoring or win rule. Rules such as "first team to ten" or a weapon progression live in a game mode, not the engine.
- **Player vs. soldier.** A **player** lasts the whole match: team, human or bot control, current weapon, score/stats, data a mode stores (such as gun game level), respawn timer and spawn rotation. A **soldier** is the body for one life: sprite, health, position, weapon cooldown. Today's `Soldier` class mixes both and will be split. Weapons belong to the player, so a change applies immediately and survives respawn. Events and mode APIs speak in players.
- **Terminology.** Use plain "player" and "soldier". Do not adopt engine-specific terms such as Unreal's PlayerController (the audience does not know Unreal, and "controller" collides with Arcade's built-in `controller` namespace). No engine glossary in learner material; an author-only note is acceptable if ever useful. Blocks labels may need care to avoid confusion with Arcade's own "player" blocks.
- **Mode selection.** A block in `main.ts` picks **deathmatch**, **gun game**, or **custom** (working name; alternatives considered: sandbox, free play). Deathmatch and gun game are TypeScript mode files. Custom runs the engine with no rules so learners can write their own in Blocks, for example rebuilding gun game with `gungame.ts` as the reference answer.
- **Milestones**, one at a time, each with full validation (Arcade build, host tests, simulator smoke, Blocks round-trip, PNG export/fresh import); the user decides which become releases:
  1. Split player from soldier; add the engine API (weapons as values given to players, elimination event with attacker and victim, match control/end); move today's rules into a deathmatch mode. Must play identically to `v0.1.0-preview.1` so existing players and the weapon lesson stay valid.
  2. Gun game mode in TypeScript: per-shot ownership and damage captured at fire time, per-player weapon levels, weapon range (and per-weapon projectile color), range-aware bots that close distance before firing, first elimination with the last weapon wins. Watch balance: the human moves 70 px/s versus bots at 10 px/s, which matters more with individual progression.
  3. Custom mode and Blocks API: player-based event and action blocks (on elimination, give weapon, end match, status text), with stable block IDs, plus a lesson to rebuild gun game in Blocks.
- **Open design questions:** individual vs. team weapon progression for gun game (leaning individual ladders with a team win); how weapons and players appear in Blocks under PXT restrictions (custom types vs. numbered references; check PXT-ARCADE.md and PXT sources first); final name for custom mode; whether to add demotion or weapon names later.
- **Milestone 1 design review completed:** checked PXT-ARCADE.md, the matching PXT language/compiler sources, and Arcade sprite-event implementations; presented the concrete API sketch before changing game code. User approved proceeding.

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
- Remaining: user playtest/review of this refactor and decision whether to commit/release; then milestone 2 gun game. Synthetic-input/controlled scenarios are not a new natural-match, physical-keyboard, balance, or learner evaluation. The prior positive playtest belongs to the published baseline, not this refactor.

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
- Gather real learner feedback on this release when a learner is available; tune the existing match from that feedback. New feature work continues under "Next: game modes". Delete the local `backup/pre-email-rewrite` branch when no longer needed.

## Toolchain caveats

- Initial approved sibling target setup exited successfully but logged upstream browser-events typing/tutorial-cache dependency diagnostics. npm reported 24 vulnerabilities (4 low, 5 moderate, 15 high); no automatic audit fixes applied.
- Reference siblings `pxt` v13.2.13 and `pxt-common-packages` v14.2.1 are not npm-linked replacements. Compilation uses installed packages under `pxt-arcade/node_modules/`.
- Public `pxt-arcade-sim` source is unavailable; do not retry cloning. See PXT-ARCADE.md for source locations and already-solved setup/editor pitfalls.
