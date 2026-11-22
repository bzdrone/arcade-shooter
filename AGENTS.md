# Arcade Shooter

Read README.md, PLAN.md, main.ts, shooter.ts, and VALIDATION.md before changing the game.
Read PXT-ARCADE.md before investigating toolchain setup, PXT/compiler restrictions, Blocks, tilemaps, simulator automation, or PNG delivery; it records already-solved pitfalls and source locations. Add durable technical discoveries there rather than repeatedly re-deriving them.
Read PORTAL.md before designing or changing the Portal-shaped `mod` layer, weapon or message compatibility libraries, or porting material; it records the Portal SDK facts this project relies on.

Keep design decisions and open work in PLAN.md, repeatable checks in VALIDATION.md, and durable descriptions and usage in README.md. Docs describe the project as it is, not progress reports: no slice or milestone logs, superseded checksums or per-run test counts. History belongs in Git.

Handoffs, run logs, scratch scripts and investigation notes are temporary working material (usually under ignored `local/`). Remove them once the work they served is done: a handoff when the receiving agent has finished, a log when its investigation is resolved. When finishing a task, check for leftovers and remove them, or ask about any worth keeping.

- This repository is an authoring environment, not the learner deliverable. Target an importable MakeCode Arcade project PNG containing the required implementation and customization surface.
- Do not treat a screenshot as a project artifact or assume Markdown lessons are automatically embedded. Verify the exported PNG by importing it into a fresh editor project.
- Keep the implementation TypeScript-first and compatible with MakeCode Arcade's PXT subset, not arbitrary Node.js or browser TypeScript.
- Keep main.ts small and Blocks-friendly; expose deliberate customization functions with stable block IDs in shooter.ts.
- Do not require the implementation to round-trip through Blocks. Test that main.ts does, and that the custom category appears.
- Teach generic shooter gameplay concepts; do not imply compatibility with every FPS engine or claim this top-down example is first-person.
- Prefer one small playable mechanic and one focused learning activity at a time.
- Keep simulator/Blocks validation distinct from static checks. Do not claim the game is verified without running it in the target environment.
- Ask before adding dependencies, installing toolchains, or publishing. Do not use unlicensed external assets.
