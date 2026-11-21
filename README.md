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

## Authoring

Use https://arcade.makecode.com/ with the Arcade target. To assemble the source in an editor project:

1. Create a project and open JavaScript mode (MakeCode's TypeScript editor).
2. Replace main.ts with this repository's main.ts.
3. Add shooter.ts in the Explorer and copy in this repository's shooter.ts.
4. Retain the new project's main.blocks file; it enables the Blocks editor. The repository manifest also includes main.blocks for imports/exports. Without that companion file, Arcade treats the project as TypeScript-only.
5. Run the simulator and check the Blocks customization surface.

MakeCode's GitHub import is another authoring option for a hosted repository containing the Arcade pxt.json project. It is not the learner delivery mechanism.

Export the project using Arcade's project-PNG save/export facility. Import that exported PNG into a fresh editor project and validate it before distribution. Distribute the original file without image conversion or optimization that could damage its embedded project data.

## Source layout

- main.ts: learner-facing settings and startup calls inside the exported project.
- main.blocks: Blocks companion with the baseline settings; keep its values aligned with main.ts when editing source outside Arcade.
- shooter.ts: game implementation and annotated Blocks API.
- pxt.json: Arcade project manifest.
- tests/gameplay.test.cjs: dependency-free host-side logic checks; run with `node --test tests/gameplay.test.cjs` on Node.js 22.13+. These mocks do not replace Arcade compilation or simulator checks.
- tests/editor-smoke.cjs: real-editor browser smoke checks using the sibling toolchain; see VALIDATION.md for setup and limitations.
- lessons/: learning-activity drafts for authors; these Markdown files are not automatically included as learner instructions in a project PNG.
- [Validation checklist](VALIDATION.md): gameplay, Blocks, and artifact checks.
- [Development plan](PLAN.md): agreed next steps and development status.

Settings apply before startGame(); later settings calls are ignored. Damage and health are whole numbers, intervals are milliseconds, and speeds are pixels per second.

## License

[MIT](LICENSE) — Copyright (c) 2026 bzdrone.
