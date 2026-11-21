# Validation checklist

Run these checks in MakeCode Arcade before calling the starter verified. This checklist is not a record that the checks have passed.

## Automated host-side logic checks

With Node.js 22.13+ installed, run from the repository root:

```sh
node --test tests/gameplay.test.cjs
```

No npm packages are required. The tests transform TypeScript using Node's built-in transformer and run it against a minimal mocked Arcade API. Node may emit an experimental-transformer warning.

These checks cover startup (including main.ts), firing cadence and retained aim, spawn edges and cap, health and scoring, contact, settings clamps, victory, and enemy cleanup. Collision tests deliberately delay destruction callbacks and replay stale overlap callbacks to check that a shot is consumed once and an enemy cannot award score or contact damage twice.

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

## Compilation and simulator

- Import both TypeScript files with the Arcade target; check for compile errors.
- Confirm direction controls move the player and screen boundaries contain it.
- Hold A: shots fire repeatedly with the configured interval, aiming along the last movement axis.
- Release A: firing stops. Remaining projectiles disappear.
- Enemies spawn from the edges, follow the player, and never exceed six live enemies.
- With defaults, enemies require three hits; each defeated enemy adds one point.
- Enemy contact removes that enemy and costs one life, without scoring a kill.
- A shot touching overlapping enemies damages only one. Defeated/contacted enemies cannot award duplicate score or contact damage within the same frame.
- Zero lives loses; 20 kills wins. Restart produces a fresh game.

## Customization and Blocks

- Change each setting independently and verify its effect after restart.
- Verify the Shooter category contains weapon settings, enemy settings, and start shooter.
- Switch main.ts to Blocks and back: calls and argument values should survive without grey JavaScript blocks.
- Confirm shooter.ts remains a separate implementation file and is not inlined into main.ts.
- Verify settings below supported minima are clamped and do not crash.

## Project PNG delivery

- Export using Arcade's project-PNG facility, not a screenshot or ordinary image export.
- Import the exported PNG into a fresh editor project without access to this repository.
- Confirm main.ts, shooter.ts, and the required project configuration survive import.
- Repeat gameplay and Blocks checks against the imported artifact.
- Make a settings change after import and verify its effect after restart.
- Test the exact file intended for distribution; do not substitute a re-encoded image.
- Confirm learner instructions do not require cloning the repository or assembling source files. Do not assume the Markdown lesson drafts are embedded in the PNG.

## Learning activity

- Complete lesson 01 with the baseline and both variants.
- Check whether the learner can explain fire interval versus projectile speed and damage versus hits-to-defeat.
