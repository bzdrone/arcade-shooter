# Validation checklist

Run these checks in MakeCode Arcade before calling the starter verified. This checklist is not a record that the checks have passed.

## Compilation and simulator

- Import both TypeScript files with the Arcade target; check for compile errors.
- Confirm direction controls move the player and screen boundaries contain it.
- Hold A: shots fire repeatedly with the configured interval, aiming along the last movement axis.
- Release A: firing stops. Remaining projectiles disappear.
- Enemies spawn from the edges, follow the player, and never exceed six live enemies.
- With defaults, enemies require three hits; each defeated enemy adds one point.
- Enemy contact removes that enemy and costs one life, without scoring a kill.
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
