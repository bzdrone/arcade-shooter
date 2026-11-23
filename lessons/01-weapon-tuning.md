# Activity 1: Change experience modifiers

Start with **INTRO.md**, including its MakeCode Arcade tutorials if the editor is new to you. You should already be able to open the shooter, play it, and change incoming damage in an existing block.

Stay in **Blocks**. You do not need to open JavaScript or edit code.

## Find your starting settings

The existing **Modifiers** blocks configure everyone:

| Block | Starting value | Meaning |
| --- | --- | --- |
| set maximum health | 100 | Health at the start of each life |
| set incoming damage percent | 100 | Normal damage; 200 doubles it, 0 prevents damage |
| set respawn seconds | 5 | Minimum wait after death |
| set friendly fire | false | Shots pass through teammates without damage |

Put these blocks before **start shooter**. After every change, stop the game preview and press Play, rather than using fast restart. Change only one setting at a time.

## Try more health

1. Restore incoming damage percent to **100**.
2. Predict what will happen if every soldier has twice as much health.
3. Change maximum health from **100** to **200**.
4. Stop and play. Does it take more hits to defeat you? Does the red team also last longer?
5. Restore maximum health to **100** and stop/play again.

In this Arcade model, the starting pistol takes three hits at 100 health and six at 200. Portal uses real weapons, so do not assume identical hit counts there.

## Try a shorter return

1. Change respawn seconds from **5** to **1**.
2. Predict how this will affect the time spent waiting after a death.
3. Stop and play. Watch your respawn countdown.
4. Restore **5** when finished.

The delay is a minimum: if all your team's spawn points are occupied, you must wait for a clear one.

## Optional: friendly fire

Change friendly fire to **true**, then stop/play. Your shots can now hurt your blue teammate, and theirs can hurt you. Bots still aim at opponents; an ally can be caught between the shooter and the target. Defeating a teammate does not earn a team point or advance a gun-game weapon.

Restore **false** afterward.

## Make your own choice

Choose one modifier to change. Predict, play, then explain what changed for both teams. There is no single best value: you are deciding how the experience should feel.

These blocks are a small Portal-oriented convention, not copies of the website's controls. The converter applies supported settings through Portal SDK actions. Builder's health and redeploy-delay **multipliers** are different from our absolute health and seconds; the converter does not produce a website modifier-import file. Arcade has no health regeneration or headshot model, and Portal weapon damage and other settings still affect the result.
