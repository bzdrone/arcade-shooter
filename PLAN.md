# Development plan

Temporary status and agreed next steps live here. Durable usage is in README.md, repeatable checks in VALIDATION.md, and accumulated toolchain/API knowledge in PXT-ARCADE.md (linked from AGENTS.md).

## Agreed direction

- A TypeScript-first MakeCode Arcade top-down shooter teaching transferable gameplay concepts, not a universal FPS modding API.
- Small Blocks-friendly configuration surface; implementation stays in separate TypeScript files.
- The repository is the authoring environment. Learners receive an importable **embedded-source project PNG**, not source assembly instructions or a screenshot. Lesson Markdown is not automatically embedded.
- User-approved gameplay: even 2v2 teams, blue human + one friendly bot versus two red bots; all called soldiers. Slower bots, ranged damage instead of contact damage, distinct team spawn tiles, five-second respawns including the human, first team to ten eliminations.
- Commit only with explicit user approval. The user approved committing this completed 2v2 milestone. No push authorized; exported PNG/evidence remain ignored local outputs. Previous milestone: `8469043` (editable yard/pathing).

## Implementation milestone: complete, ready for user playtest

- Four fixed soldier slots own team, health, live sprite, weapon cooldown, respawn deadline, and target distance field. Death clears the live sprite before destruction; a respawn reuses that slot rather than growing a swarm.
- Both teams share health/weapon rules. Defaults: three health; damage 1, fire interval 750 ms, projectile speed 80 px/s. All three bots use identical target selection, movement and firing logic at 10 px/s; human movement is 70 px/s.
- Bots independently select reachable opponents by shortest tile route, follow cardinal waypoints, and shoot when cardinally aligned and unobstructed. Cover blocks soldiers and shots. Each target owns an independent reverse BFS field, refreshed at most every 250 ms and shared by its pursuers.
- Bullet-only damage, friendly fire off, friendly projectiles pass through teammates, one consumed shot damages at most one opposing soldier. Stale collision callbacks cannot duplicate damage/points.
- Blue/red spawn tile assets are editable in the tilemap. Baseline: blue column 1 / rows 2 and 4; red column 8 / rows 2 and 4. Startup requires two walkable points per team and connected routes. Respawns wait at least five seconds, then choose an unoccupied own-team point or keep waiting.
- HUD shows team scores, human health/respawn status, and small soldier health bars. Human helmet stripe identifies the controlled soldier. First team to ten wins; explicit team-result messages and actual button restart are implemented.
- Final score is painted before game-over captures the background (50 ms yield after marking match finished). Screenshots confirm final score ten, not a stale nine.
- `main.ts` / `main.blocks` configure weapon `(1, 750, 80)` and soldiers `(3, 10, 5000)`. New `setSoldiers` function keeps legacy `shooter_set_enemies` block ID; visible labels/code use soldier terminology.
- README, validation checklist, and weapon lesson now describe shared team rules/settings. Technical discoveries are persisted in PXT-ARCADE.md. No new dependencies, installs, or upstream patches.

## Verification completed

- **28 host tests pass** on Node 24.22.3: 17 rule/team tests + 11 navigation/visibility tests. Includes the actual entry point, team counts, all bot fire, friendly-fire/contact rules, stale callbacks, human/friendly/red respawns, occupied points, invalid maps, both ten-point outcomes, independent/replaced target fields, projectile-width visibility and cover routes/footprints. Host tests use mocked APIs, not Arcade physics.
- **Arcade CLI build passes** with Arcade 4.2.1 / PXT 13.2.13, target checkout `0642e6159d3fdb652fb1465a0aff73c5b8188578`. Simulator code generation, not a hardware build. PXT's explicit-constructor restriction was resolved.
- **`node tests/editor-smoke.cjs --arena --png` passes**: real-simulator 2v2 startup, human movement/retained aim/held and released fire, right boundary, cover collision/shot destruction, 10 px/s detours around both barriers, all three bots firing, harmless contact, friendly bullets passing through an ally, real eliminations and team points, five-second red/human respawns, occupied-point retry, and rebound human controls.
- Both real-simulator match-end paths pass: seed a team score at nine and target health at one, fire a real bullet for the tenth point, inspect winning-team screenshots, and use the **game-over dialog button** to restart. Scores reset and four healthy soldiers return. These are controlled outcome tests, not full natural matches.
- Actual TypeScript → Blocks → TypeScript changes pass, with three custom blocks, soldier labels/settings, tilemap setup, no grey JavaScript blocks, and implementation remaining separate. Tilemap editor opens with wall controls.
- Exact PNG export decodes and matches every manifest-listed baseline source/asset file. A fresh local context imports only that PNG, starts 2v2, round-trips a damage change through Blocks, and verifies runtime damage 3 after stop/start compilation.
- **`node tests/png-hosted.cjs --tilemap` passes** for the same bytes in fresh hosted Arcade **4.1.28 / PXT 13.1.25**: baseline settings, two soldiers per team with shared health, custom Blocks without grey JavaScript, and imported tilemap editor with wall controls.
- Browser checks use synthetic simulator-board input and controlled actor placements, not physical keyboard play. Local editor still loads a hosted simulator iframe and requires internet.

## Current playtest artifact

- File: **`local/exports/arcade-shooter.png`**, **37,778 bytes**, ignored local output. This replaces the previous solo/enemy yard PNG with the 2v2 soldier match.
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

## Preview release preparation (not published)

- User agreed to head toward a GitHub Release rather than build a Pages site now. Proposed version: `v0.1.0-preview.1`, marked prerelease because actual learner evaluation is pending.
- Added release notes and a pinned candidate descriptor under `releases/`, `RELEASING.md`, and dependency-free `tools/prepare-release.cjs`. The helper stages original PNG bytes, separate learner handouts, license, SHA256SUMS and provenance under ignored `local/releases/v0.1.0-preview.1/`. It checks source against tested game commit `a422488` and PNG identity against matching local/hosted evidence; it does not rerun runtime tests or publish.
- Introduction now references the separately attached activity by filename, avoiding a repository-relative link that would break for flat release downloads.
- Before the first push, history was rewritten (with user approval) to replace a personal author email with the GitHub noreply address. Trees are identical; the tested game commit is now `a422488` (was `c35b715`). A local `backup/pre-email-rewrite` branch keeps the old history and should not be pushed.
- Remote `origin` = https://github.com/bzdrone/arcade-shooter, created **private** for validation; the intended final visibility is public. `main` and annotated tag `v0.1.0-preview.1` (→ `692ee8a`, preparation commit) are pushed.
- **Draft prerelease** created with the prepared notes and exactly the six assets; re-downloaded assets pass `SHA256SUMS`. Not yet published.
- Remaining, each needing user approval: review the draft, make the repository public, publish the draft, then re-download the PNG and record the final release URL here.

## Toolchain caveats

- Initial approved sibling target setup exited successfully but logged upstream browser-events typing/tutorial-cache dependency diagnostics. npm reported 24 vulnerabilities (4 low, 5 moderate, 15 high); no automatic audit fixes applied.
- Reference siblings `pxt` v13.2.13 and `pxt-common-packages` v14.2.1 are not npm-linked replacements. Compilation uses installed packages under `pxt-arcade/node_modules/`.
- Public `pxt-arcade-sim` source is unavailable; do not retry cloning. See PXT-ARCADE.md for source locations and already-solved setup/editor pitfalls.
