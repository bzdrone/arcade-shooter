# Arcade Shooter: play, change, experiment

This small top-down game lets you explore how weapon settings change a shooter. You do not need to install anything or know how to code to start.

## Open the game

1. Get the original **arcade-shooter.png** project file supplied with this introduction.
2. Open [MakeCode Arcade](https://arcade.makecode.com/).
3. Drag the PNG onto the page, or choose **Import → Import File**.
4. Press **Play** if the simulator does not start automatically.

The PNG contains the editable game, not just a picture. Keep the original file so you can return to the starting version.

## Play a match

You are the **blue soldier with a white helmet stripe**. One blue bot is your teammate; two red soldiers oppose you.

- **Arrow keys:** move.
- **Space or the on-screen A button:** shoot; hold for repeated shots. Click inside the simulator first if the keyboard does not respond.
- Shots follow your last movement direction, even after you stop.
- Use cover to block incoming shots. Touching soldiers is harmless, and friendly fire is off.
- Each soldier starts with three health and returns after at least five seconds when eliminated.
- The first team to **10 eliminations** wins. Press a button on the result screen to play again.

## Try one change

After playing, open **Blocks** and find **set weapon damage**. Change damage from **1 to 3**, then **stop and start** the simulator to apply it.

Before playing, predict what will change. Afterward, explain what you noticed. The setting affects **every soldier on both teams**, not only you. Restore damage to **1** to return to the baseline.

For a longer experiment, use the accompanying **weapon-tuning activity** (`01-weapon-tuning.md`), supplied as a separate release download.

## Try another game mode

In Blocks, the **set shooter mode** block chooses the rules:

- **deathmatch:** the match described above.
- **gun game:** everyone starts with a pistol. Each elimination moves only you up to the next weapon (SMG, shotgun, then knife); the first knife elimination wins for your team.
- **no mode:** soldiers fight, but nothing scores. You write the rules yourself with the **Mod** blocks, which use the same names as Battlefield 6 Portal's scripting. The **mod rules activity** (`02-mod-rules.md`) walks through it.

Stop and start the simulator after changing the mode.

*This introduction and the activity are separate handouts; they are not embedded in the game PNG.*
