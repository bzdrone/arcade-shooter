# Design and open work

Why the project is shaped the way it is, and what is still open. Usage is in [README.md](README.md), repeatable checks in [VALIDATION.md](VALIDATION.md), toolchain knowledge in [PXT-ARCADE.md](PXT-ARCADE.md), and Portal facts and porting notes in [PORTAL.md](PORTAL.md). Git history records how the project got here.

## Purpose

- A TypeScript-first MakeCode Arcade top-down shooter that teaches gameplay scripting concepts, not a universal FPS modding API.
- Arcade is a **short ramp to Battlefield 6 Portal**. Learners stay long enough to understand scripting a game mode with **event handlers, functions and per-player variables**, then move to Portal. Arcade-side polish that does not serve that path (balance tuning, more maps, more weapons, demotion) is out of scope unless asked for.
- **What learners make in Arcade can be played in Portal.** A static converter page turns an exported project PNG into Portal map edits, a rules script and its strings file: the tilemap becomes an arena on the Portal Sandbox, and the selected mode plus the learner's own `mod` rules become a Portal script. This gives learners a concrete reason to build something and a visible payoff.
- The repository is the authoring environment. The latest release offers just two learner downloads: the importable **embedded-source project PNG** and **INTRO.md**, which links to optional activities online. License and activity files stay in the repository; checksums and build records stay in local release evidence. Instructions are not embedded in the PNG. Older published releases retain their original attachments.

## Architecture

1. **Engine** (`shooter.ts`, `messages.ts`, `pathing.ts`): players with per-life soldier bodies, weapons, combat, respawns, bots, scores, match end, per-player variables, HUD messages. Plain "player"/"soldier" names; learners do not program against it directly. Modes plug in with `shooter.registerMode`; the engine does not name any mode.
2. **`mod` layer** (`mod.ts`): the only learner-facing scripting surface. It copies Portal's `mod` names, argument order and event shapes for the subset game modes need. Portal overloads become one function with a union parameter (`Team | Player`) dispatched with `instanceof`.
3. **Compatibility libraries** for Portal systems too large to mirror:
   - **Weapons** (`weapons.ts`): four categories (pistol, SMG, shotgun, knife) mapped to Arcade stats; the Portal side maps each to one real item and inventory slot. Portal's full weapon enum and real gun names are not mirrored.
   - **Messages** (in `mod`): `Message` with `{}` placeholders, notifications and large announcements, drawn as timed, non-blocking HUD queues instead of Portal's widget UI.
4. **Modes** (`deathmatch.ts`, `gungame.ts`): written against `mod` and `weapons`, so they double as worked examples that read almost like Portal scripts. "No mode" leaves the rules to the learner.

5. **Arcade to Portal converter** (`site/`): a static page with no backend and no external libraries. `site/converter/` reads the project PNG (its own PNG and LZMA decoders), builds a `.spatial.json` from the tilemap, and translates the rules by applying PORTAL.md's porting checklist as text edits on the learner's own code. A bundled Portal runtime (`portal-runtime.ts`) supplies what the Arcade engine did: bots, settings, numbered variables and the weapon categories. `tools/convert-portal.mjs` runs the same code from the command line.

The mod layer is **Portal-shaped, not Portal-compatible**: Arcade code does not run in Portal unchanged. The converter closes that gap mechanically for the supported subset; PORTAL.md records the format and runtime facts it relies on. `portal/gungame.ts` remains as the hand-written port the converter's output was modelled on.

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
- **Converter delivery:** a static site so it can be hosted anywhere (GitHub Pages intended) and nothing leaves the learner's browser. No dependencies: a PNG reader and an LZMA decoder (checked against MakeCode's compressor) were cheaper than adding libraries. The page and the command line share one implementation and must produce identical files.
- **Converted map:** always `MP_Portal_Sand`, centred on the origin, one tile = 4 m, at most 50 × 50 tiles. Each wall-marked tile becomes one 10 m stone block; wall-marked tiles whose image name contains "cover" become 3 × 3 chest-high blocks (Arcade cover blocks shots, but low cover plays better in first person); blue/red spawn tiles become team 1/2 HQ spawn points and bot spawner locations; the map edge plus 6 m becomes the combat area. Ground height comes from a sampled terrain grid.
- **Converted rules:** registered handlers become functions called from exported Portal events, in Arcade's registration order; waits become `await mod.Wait`, with `async` propagated through functions that wait; message text and text arguments move to the strings file, and `"text" + value` joins become `{}` placeholders. Statements using Arcade-only APIs are commented out with a note rather than failing the conversion.
- **Converted behaviour:** bots fill each team to two soldiers, counting humans; a bot keeps a "seat" across lives so its variables, weapon and kill counts persist as in Arcade. Variables, scores and the target score (Portal would end the round at the target; in Arcade only the rules end a match), `EndGameMode` (a player wins for their team), `DealDamage` (Arcade health points) and kill/death counts go through the runtime. Damage and health become an incoming-damage factor, respawn delay the redeploy time, bot speed a move speed, and a fast fire interval (≤ 400 ms) starts everyone with the SMG; projectile speed has no equivalent. In kill events `eventWeapon` is the killer's current category.

## Releases

- **Latest:** [`v0.2.0-preview.2`](https://github.com/bzdrone/arcade-shooter/releases/tag/v0.2.0-preview.2), a prerelease with Blocks-first opening, SDK-informed block help, a gentler introduction, and only the PNG and introduction attached (game commit `7920808`, tag on `c397b76`). The published PNG matches the local and hosted validated artifact. Its identity and source revision are pinned in `releases/v0.2.0-preview.2.json`.
- **Earlier:** [`v0.2.0-preview.1`](https://github.com/bzdrone/arcade-shooter/releases/tag/v0.2.0-preview.1) introduced game modes, the Mod and Weapons blocks, and lesson 2. [`v0.1.0-preview.1`](https://github.com/bzdrone/arcade-shooter/releases/tag/v0.1.0-preview.1) is the original 2v2 deathmatch. Their descriptors and notes remain under `releases/`.
- Exported PNGs and validation evidence are ignored local outputs under `local/`; releases go through GitHub Releases (RELEASING.md).

## Not yet verified

- **Converter output in Portal:** deathmatch and gun game on the converted training yard load and play: two soldiers per team, bots respawning from their own spawners, a score header, weapon changes that work in play, spawn facing and wall and cover heights that look right, and bots matched to seats although Portal reuses player ids. Not yet played: the latest script, which keeps scores and the target in the runtime because Portal ended a gun game round at the target score (the simulation passes). Not checked: whether the web builder steps on the page are right, bot names on the scoreboard, a full gun game match to a knife kill, learner-made maps other than the training yard, and learner rules beyond the built-in modes.
- **Converter hosting:** the page runs locally (`tests/portal-site.cjs`) but is not published.
- **Portal port experiment:** `portal/gungame.ts` passes the SDK 2.1.2.0 type check but has never run in Portal. Unknown: player `ObjectVariable` slots without editor declarations, weapon swap feel, how numbers display in messages.
- **Learners:** neither lesson has been tried with a learner. The published baseline was playtested by the author and played well; that is not learner evidence.
- **Balance:** no natural full gun-game match has been played. The human's speed advantage matters more with individual ladders (kiting bots, especially at the knife stage), and blue's team win often depends on the human. Tune only from feedback.
- Browser checks use synthetic input and controlled placements, not physical keyboards or natural matches.

## Possible next work

- **Finish the Portal check** (first): play the latest gun game script to a knife kill and confirm it ends only then, the score header never drops, and the log shows whether Portal's own team scores still drift ("Portal has blue … red …"). Then convert a project with a different tilemap and some learner rules (lesson 2), and check the page's web builder steps against the real tool. Record findings in PORTAL.md.
- Turn the runtime's `debug` logging off by default once the Portal check is done (it is on in converted scripts for now).
- Decide whether `site/converter/sand-heights.js` (ground heights sampled from the SDK's Sand terrain) may be public before pushing or hosting it.
- Publish `site/` (GitHub Pages, with approval) once the Portal check passes, and link it from the README and introduction.
- A short learner activity: change the tilemap in Arcade, convert, play it in Portal.
- A beginner trial of the tutorial → import → play → change-one-number path. Observe where help is needed, whether the learner can find the existing block and apply the change, and whether they can explain the result.
- An annotated workspace image highlighting the damage field and simulator stop/Play controls, captured from the actual editor.
- Break lesson 2 into smaller scripting activities, beginning with one event and one visible action before introducing scoring, conditions, and per-player variables.
- A learner trial of the later activities, tuning from what is observed.
