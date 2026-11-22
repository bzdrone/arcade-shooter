# Lesson 2: Write your own game mode rules

## Goal

Write the scoring rule of a game mode yourself with **event handlers**, **functions** and **per-player variables**. The blocks use the same names and event shapes as Battlefield 6 Portal's `mod` scripting, so the ideas carry over.

## Set up

1. In Blocks, change **set shooter mode** to **no mode**. Stop and start the simulator. Soldiers still fight and respawn, but eliminations score nothing and nobody wins: there are no rules.
2. Open the **Mod** category. Event blocks such as **on player earned kill** run every time that thing happens in the game. Drag the round **eventPlayer** and **eventOtherPlayer** blocks out of the event to use them.

## Predict

- In **on player earned kill**, `eventPlayer` scored the elimination and `eventOtherPlayer` was eliminated. Which one's team should get a point?
- What should happen if both are on the same team? What if both are the same player?

## Change and test

Build this rule, then stop and start the simulator:

```typescript
mod.OnGameModeStarted(function () {
    mod.SetGameModeTargetScore(5)
})
mod.OnPlayerEarnedKill(function (eventPlayer, eventOtherPlayer, eventWeapon) {
    if (!(mod.Equals(mod.GetTeam(eventPlayer), mod.GetTeam(eventOtherPlayer)))) {
        mod.SetGameModeScore(mod.GetTeam(eventPlayer), mod.GetGameModeScore(mod.GetTeam(eventPlayer)) + 1)
        if (mod.GetGameModeScore(mod.GetTeam(eventPlayer)) >= mod.GetTargetScore()) {
            mod.EndGameMode(mod.GetTeam(eventPlayer))
        }
    }
})
```

Then try one change at a time:

- Show a message: add **show game mode message** with **message "{} SCORES" eventPlayer**. Each `{}` is filled by the next value.
- Count a streak: in **on player earned kill**, add one to **variable 0 of eventPlayer**. In **on player died**, set **variable 0 of eventPlayer** back to 0. Show the streak with a message. Player variables last through respawns.
- Reward a streak: when the streak reaches 3, **give eventPlayer weapon SMG**. In **on player deployed**, give the pistol back.

Teams are numbered like Portal: **team 1** is blue, **team 2** is red.

## Explain

- Which event did you use for each part of your rule, and why that one?
- What did the player variable remember that the score could not?
- Compare with **gungame.ts** in JavaScript: it is a whole game mode built from the same blocks.

## Toward Portal

A Portal script uses these same names. Moving a rule there takes a short list of changes, such as writing events as `export function OnPlayerEarnedKill(...)` and keeping message text in a strings file. Your teacher has the checklist.
