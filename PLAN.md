# Design and open work

Why the project is shaped the way it is, and what is still open. Usage is in [README.md](README.md), repeatable checks in [VALIDATION.md](VALIDATION.md), toolchain knowledge in [PXT-ARCADE.md](PXT-ARCADE.md), and Portal facts and porting notes in [PORTAL.md](PORTAL.md). Git history records how the project got here.

## Purpose

- A TypeScript-first MakeCode Arcade top-down shooter that teaches gameplay scripting concepts, not a universal FPS modding API.
- Arcade is a **short ramp to Battlefield 6 Portal**. Learners stay long enough to understand scripting a game mode with **event handlers, functions and per-player variables**, then move to Portal. Arcade-side polish that does not serve that path (balance tuning, more maps, more weapons, demotion) is out of scope unless asked for.
- The repository is the authoring environment. Future releases offer just two learner downloads: the importable **embedded-source project PNG** and **INTRO.md**, which links to optional activities online. License and activity files stay in the repository; checksums and build records stay in local release evidence. Instructions are not embedded in the PNG. Existing published releases retain their original attachments.

## Architecture

1. **Engine** (`shooter.ts`, `messages.ts`, `pathing.ts`): players with per-life soldier bodies, weapons, combat, respawns, bots, scores, match end, per-player variables, HUD messages. Plain "player"/"soldier" names; learners do not program against it directly. Modes plug in with `shooter.registerMode`; the engine does not name any mode.
2. **`mod` layer** (`mod.ts`): the only learner-facing scripting surface. It copies Portal's `mod` names, argument order and event shapes for the subset game modes need. Portal overloads become one function with a union parameter (`Team | Player`) dispatched with `instanceof`.
3. **Compatibility libraries** for Portal systems too large to mirror:
   - **Weapons** (`weapons.ts`): four categories (pistol, SMG, shotgun, knife) mapped to Arcade stats; the Portal side maps each to one real item and inventory slot. Portal's full weapon enum and real gun names are not mirrored.
   - **Messages** (in `mod`): `Message` with `{}` placeholders, notifications and large announcements, drawn as timed, non-blocking HUD queues instead of Portal's widget UI.
4. **Modes** (`deathmatch.ts`, `gungame.ts`): written against `mod` and `weapons`, so they double as worked examples that read almost like Portal scripts. "No mode" leaves the rules to the learner.

The mod layer is **Portal-shaped, not Portal-compatible**: the ideas and names carry over, not the code. Porting modes is not a goal. An author-side experiment porting gun game (`portal/`, with its fix-up list in PORTAL.md) checks that the shape is close enough; there is no conversion tooling.

## Design decisions

- **Teams:** even 2v2, blue human plus one friendly bot against two red bots, all called soldiers. Bots move at 10 px/s, the human at 70 px/s. Ranged damage only, distinct team spawn tiles, five-second respawns including the human.
- **Deathmatch:** first team to ten eliminations. Self and friendly eliminations do not score.
- **Gun game:** individual ladders (pistol → SMG → shotgun → knife); the first player to score a knife elimination wins for their team. A late shot from a player's previous weapon still damages but does not advance them, which needs an extra `eventWeapon` kill-event parameter that Portal lacks (a listed porting fix-up).
- **Weapons:** no sniper or rifle, one automatic weapon. Range caps shot lifetime; bots close to within range before firing. Shotgun is one heavy short-range shot and knife a very short-range projectile; there is no spread or separate melee system.
- **Messages:** two kinds (short notifications and large announcements). The bottom health/respawn line stays engine-only. On the single screen, messages aimed only at bots or the red team are dropped.
- **mod layer:** Portal team numbering (team 1 blue, team 2 red); everything in `mod`, with no separate `modlib` namespace; plain MakeCode event blocks with draggable parameters named as in Portal (`eventPlayer`, `eventOtherPlayer`, `eventWeapon`). Game start and initial deployments are delivered on the first frame, so handlers placed anywhere in a program receive them.
- **Blocks:** keep existing block IDs stable; only configuration, mode selection, Mod and Weapons blocks are learner-facing.
- **First experience:** learners new to MakeCode Arcade work through a few beginner tutorials, then practice saving a tutorial game as a project PNG and importing it again, checking that their blocks and a recognizable change survive. The shooter introduction focuses on playing and changing damage in an existing block, with no code editing or mode selection. Activity 1 introduces other weapon settings one at a time in Blocks. Game-mode scripting comes later; the first session does not require finishing a match or reading the engine source.
- **The Portal port experiment** lives in `portal/`, outside the PNG manifest and the learner path.

## Releases

- **Latest:** [`v0.2.0-preview.1`](https://github.com/bzdrone/arcade-shooter/releases/tag/v0.2.0-preview.1), a prerelease with game modes, the Mod and Weapons blocks and lesson 2 (game commit `d8d0625`, tag on `9043ec5`). Its PNG is 60,326 bytes, SHA-256 `e5597dcdede26f40fdc90c5b4a9e7a0937afa01e3b6fa35973e2bf0f1ebaf333`.
- **Earlier:** [`v0.1.0-preview.1`](https://github.com/bzdrone/arcade-shooter/releases/tag/v0.1.0-preview.1), the original 2v2 deathmatch (game commit `a422488`, tag on `692ee8a`). Its PNG is 37,778 bytes, SHA-256 `4292f96a126c99eabcd9d493fb877eac780454e7d112813f9667fe243056b21b`.
- Exported PNGs and validation evidence are ignored local outputs under `local/`; releases go through GitHub Releases (RELEASING.md).

## Not yet verified

- **Portal port experiment:** `portal/gungame.ts` passes the SDK 2.1.2.0 type check but has never run in Portal. Unknown: player `ObjectVariable` slots without editor declarations, weapon swap feel, how numbers display in messages.
- **Learners:** neither lesson has been tried with a learner. The published baseline was playtested by the author and played well; that is not learner evidence.
- **Balance:** no natural full gun-game match has been played. The human's speed advantage matters more with individual ladders (kiting bots, especially at the knife stage), and blue's team win often depends on the human. Tune only from feedback.
- Browser checks use synthetic input and controlled placements, not physical keyboards or natural matches.

## Possible next work

- A beginner trial of the tutorial → import → play → change-one-number path. Observe where help is needed, whether the learner can find the existing block and apply the change, and whether they can explain the result.
- An annotated workspace image highlighting the damage field and simulator stop/Play controls, captured from the actual editor.
- Break lesson 2 into smaller scripting activities, beginning with one event and one visible action before introducing scoring, conditions, and per-player variables.
- A learner trial of the later activities, tuning from what is observed.
