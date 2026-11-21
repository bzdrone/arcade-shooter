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
- Next: run the simulator and Blocks checklist, then validate the project-PNG artifact. Local CLI setup and limitations are recorded in VALIDATION.md.

## Validation status

- Manifest JSON, referenced source files, and documentation links have been checked.
- Host-side regression suite: 10 tests passed using Node.js 24.22.3 (`node --test tests/gameplay.test.cjs`). These execute transformed source with mocked Arcade APIs, not the target runtime.
- Arcade project compilation passed with target 4.2.1 / PXT 13.2.13 on Node.js 24.22.3, using target checkout `0642e6159d3fdb652fb1465a0aff73c5b8188578`. `pxt install` and `pxt build` exited successfully and generated `built/debug/binary.js`. This is simulator-target code generation, not a hardware build or playtest.
- Toolchain caveats: the target `buildtarget --skipCore` command exited successfully but logged upstream browser-events typing errors and tutorial-cache missing-dependency errors. npm reported 24 vulnerabilities (4 low, 5 moderate, 15 high); no audit fixes or upstream source patches were applied.
- Simulator gameplay and Blocks compatibility have not been verified.
- A project PNG has not been exported or tested.

Update this status with evidence as the steps are completed; static checks are not a substitute for target compilation or playtesting.
