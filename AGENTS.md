# Arcade Shooter

Read README.md, PLAN.md, main.ts, shooter.ts, and VALIDATION.md before changing the game.

Keep agreed next steps and temporary development status in PLAN.md, repeatable checks in VALIDATION.md, and durable descriptions and usage in README.md.

- This repository is an authoring environment, not the learner deliverable. Target an importable MakeCode Arcade project PNG containing the required implementation and customization surface.
- Do not treat a screenshot as a project artifact or assume Markdown lessons are automatically embedded. Verify the exported PNG by importing it into a fresh editor project.
- Keep the implementation TypeScript-first and compatible with MakeCode Arcade's PXT subset, not arbitrary Node.js or browser TypeScript.
- Keep main.ts small and Blocks-friendly; expose deliberate customization functions with stable block IDs in shooter.ts.
- Do not require the implementation to round-trip through Blocks. Test that main.ts does, and that the custom category appears.
- Teach generic shooter gameplay concepts; do not imply compatibility with every FPS engine or claim this top-down example is first-person.
- Prefer one small playable mechanic and one focused learning activity at a time.
- Keep simulator/Blocks validation distinct from static checks. Do not claim the game is verified without running it in the target environment.
- Ask before adding dependencies, installing toolchains, or publishing. Do not use unlicensed external assets.
