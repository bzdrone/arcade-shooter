# Development plan

This file tracks agreed next steps and temporary development status. README.md describes the project and its usage; VALIDATION.md holds the repeatable verification checklist.

## Agreed direction

- Teach gameplay concepts that transfer across FPS games, rather than a specific engine's modding API.
- Use MakeCode Arcade for a small top-down shooter example.
- Keep the implementation primarily TypeScript, with a deliberately small Blocks-friendly customization surface.
- Use this repository to develop the game and learning experience, not as the learner's starting interface.
- Deliver the editable game as a MakeCode Arcade project PNG containing its required source files.
- Keep learning-activity drafts here during development. Decide how learners receive the instructions; Markdown lessons are not automatically packaged into the PNG.

## Starting scope

One playfield, one weapon, one enemy type, movement, directional shooting, health, scoring, and restartable win/lose conditions.

The first learning activity changes weapon damage, fire interval, and projectile speed using the predict → change → test → explain loop.

## First steps

1. **Compile in MakeCode Arcade.** Load main.ts and shooter.ts with the Arcade target and resolve any PXT compatibility issues.
2. **Play the smallest example.** Work through the gameplay checks in VALIDATION.md. Refine controls, aiming, pacing, and feedback based on play rather than adding features.
3. **Verify the Blocks surface.** Confirm the Shooter category appears and main.ts survives a TypeScript/Blocks round trip without grey JavaScript blocks. Keep shooter.ts separate.
4. **Try the first lesson.** Play the baseline and weapon variants. Check that the differences are observable and the explanations match the behavior.
5. **Validate the delivery artifact.** Export a project PNG from Arcade, import it into a fresh editor project, and repeat the gameplay and Blocks checks using only that file. Confirm the learner does not need this repository.
6. **Review before expanding.** Record the results and open questions, including how learning instructions accompany or appear within the game, then agree on the next refinement. Additional mechanics and engine-specific lessons are not yet committed scope.

## Implementation progress

- Hardened collision handling: shots switch to a private spent-projectile kind before destruction, and enemies are removed from health tracking before destruction. Repeated/stale overlap callbacks cannot reuse a shot or double-count an enemy.
- Added dependency-free Node host-side regression tests covering the existing baseline and collision bookkeeping. No new gameplay mechanics or dependencies were added.
- With user approval, cloned microsoft/pxt-arcade to the sibling `~/Source/pxt-arcade` directory and installed its npm dependencies (no global CLI installation).
- Added main.blocks to the manifest after the real editor exposed that the original project was TypeScript-only (no Blocks tab and switch-to-Blocks was a no-op). The companion contains the baseline settings; shooter.ts remains separate.
- Added repeatable real-editor smoke checks using the toolchain's existing Puppeteer dependency, a loopback-only server, disposable profile, and memory workspace. Results/screenshots are ignored under local/editor-smoke/.
- Reordered the next milestone at the user's request: export and validate the project PNG first so manual playtesting does not require assembling sources.
- Added optional PNG export/import to editor-smoke.cjs and a separate hosted-editor import check. No gameplay or default settings changed.
- Next: user playtest from the PNG, followed by remaining gameplay checks (health/scoring, win/lose, restart, physical controls and lesson variants). Local CLI setup and limitations are recorded in VALIDATION.md.

## Validation status

- Manifest JSON, referenced source files, and documentation links have been checked.
- Host-side regression suite: 11 tests passed using Node.js 24.22.3 (`node --test tests/gameplay.test.cjs`). These execute transformed source with mocked Arcade APIs, not the target runtime.
- Arcade project compilation passed with target 4.2.1 / PXT 13.2.13 on Node.js 24.22.3, using target checkout `0642e6159d3fdb652fb1465a0aff73c5b8188578`. `pxt install` and `pxt build` exited successfully and generated `built/debug/binary.js`. This is simulator-target code generation, not a hardware build or playtest.
- Toolchain caveats: the target `buildtarget --skipCore` command exited successfully but logged upstream browser-events typing errors and tutorial-cache missing-dependency errors. npm reported 24 vulnerabilities (4 low, 5 moderate, 15 high); no audit fixes or upstream source patches were applied.
- Real-editor smoke checks passed using Chrome 157: simulator startup, right/up movement, retained aim, held/released fire, enemy spawning, and right-boundary containment using synthetic simulator controller input. This is not full manual playtesting. The local editor currently uses the hosted Arcade simulator iframe, not a wholly offline simulator build.
- Blocks smoke checks passed: Shooter category and all three custom blocks appear; no grey JavaScript blocks; a non-default TypeScript argument decompiles to Blocks and a subsequent Blocks edit appears in regenerated main.ts.
- Project PNG exported through the local Arcade editor's project-PNG path and decoded to verify exact baseline main.ts, main.blocks, and shooter.ts plus their manifest entries. A fresh browser context imported only that PNG, started the game, round-tripped a Blocks damage change, and confirmed runtime damage became 3 after stop/start compilation. Fast restart alone can reuse old code.
- The exact PNG also imported and started in the hosted stable editor (Arcade 4.1.28 / PXT 13.1.25); Shooter blocks appeared without grey JavaScript. Full gameplay, physical controls and lesson validation remain outstanding.

## Current playtest artifact

- File: `local/exports/arcade-shooter.png` (21,701 bytes; ignored local output, not committed or published).
- SHA-256: `6ce38473dc6bcaa5be9ac039e8fed5043da197fca45032a40a8a86451008c030`.
- Exported baseline settings: weapon `(1, 250, 120)`, enemies `(3, 20, 1500)`.
- Evidence: `local/exports/validation.json`, `local/editor-smoke/hosted-result.json`, and screenshots under `local/editor-smoke/`.
- Import instructions: README.md, "Test an exported project PNG". Learners need only the PNG and hosted editor, not these authoring files. The PNG does not include the lesson drafts.

Update this status with evidence as the steps are completed; static checks are not a substitute for target compilation or playtesting.
