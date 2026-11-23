# Arcade Shooter

Read README.md, PLAN.md, main.ts, shooter.ts, and VALIDATION.md before changing the game.
Read PXT-ARCADE.md before investigating toolchain setup, PXT/compiler restrictions, Blocks, tilemaps, simulator automation, or PNG delivery; it records already-solved pitfalls and source locations. Add durable technical discoveries there rather than repeatedly re-deriving them.
Read PORTAL.md before designing or changing the Portal `mod` learning API, weapon or message compatibility libraries, or porting material; it records the Portal SDK facts this project relies on.

Keep design decisions and open work in PLAN.md, repeatable checks in VALIDATION.md, and durable descriptions and usage in README.md. Docs describe the project as it is, not progress reports: no slice or milestone logs, superseded checksums or per-run test counts. History belongs in Git.

Project boundaries: this project owns its product decisions, code, validation, deliverables, and temporary task operations. Keep its task handoffs, browser continuation notes, inspection displays, and dedicated browser session/profile state under ignored `local/`; never force-add or publish them. The private research collection owns captured sources, provenance, research findings, and personal research working agreements—not this project's browser/task handoffs. The research toolkit owns reusable tools, generic safety contracts, skills, and synthetic tests, without private account data or personal consent records. The hub owns discovery/routing only. Cross-project work does not merge commit or publication permissions. Do not move an active browser profile; document any legacy-location exception locally and relocate only after orderly shutdown.

Handoffs, run logs, scratch scripts and investigation notes are temporary working material (usually under ignored `local/`). Remove them once the work they served is done: a handoff when the receiving agent has finished, a log when its investigation is resolved. When finishing a task, check for leftovers and remove them, or ask about any worth keeping.

- This repository is an authoring environment, not the creator deliverable. Target an importable MakeCode Arcade project PNG containing the required implementation and customization surface.
- Do not treat a screenshot as a project artifact or assume Markdown lessons are automatically embedded. Verify the exported PNG by importing it into a fresh editor project.
- Keep the implementation TypeScript-first and compatible with MakeCode Arcade's PXT subset, not arbitrary Node.js or browser TypeScript.
- Keep main.ts small and Blocks-friendly; expose deliberate customization functions with stable block IDs in shooter.ts.
- Do not require the implementation to round-trip through Blocks. Test that main.ts does, and that the custom category appears.
- The main branch is Battlefield 6 Portal-specific: Arcade is the starting environment for learning and authoring Portal maps and game modes. Describe it that way, not as a generic shooter or a "Portal-shaped" layer. Document concrete Arcade/Portal differences and conversion limits without implying that Arcade source runs unchanged in Portal or that the Arcade view is first-person.
- Use **creator** rather than **learner** or **maker** for the person building maps and game modes; use **player** for someone playing.
- Prefer one small playable mechanic and one focused learning activity at a time.
- Keep code comments minimal and useful to creators. In sample modes and main.ts, focus on the rules and customization, not engine edge cases or Arcade implementation rationale. Keep maintenance comments only where they explain a non-obvious constraint in engine code. Retain concise block help where it supports editor use.
- Keep simulator/Blocks validation distinct from static checks. Do not claim the game is verified without running it in the target environment.
- For Portal behavior, prefer SDK-based working assumptions and enough checking for the sample to serve its purpose. Investigate further when a concrete blocker appears, not to build an exhaustive compatibility or verification backlog. Keep assumptions distinct from observed behavior.
- Ask before adding dependencies, installing toolchains, or publishing. Do not use unlicensed external assets.
