# Lesson 1: Change how a weapon feels

## Goal

Use three parameters to create different weapon behaviors without changing the firing implementation.

In main.ts, find:

```typescript
shooter.setWeapon(1, 750, 80)
```

The arguments are damage per hit, minimum milliseconds between shots, and projectile speed in pixels per second. These settings apply equally to **every soldier on both teams**, not just you. Keep soldier settings `(3, 10, 5000)` unchanged for this experiment.

## Predict

- What changes if you lower the fire interval?
- Is a faster projectile the same as a faster firing weapon?
- With three-health soldiers, how many hits does one damage require? What about two damage?

## Change and test

Play the baseline, then try these separately, stopping and starting the simulator each time to recompile:

```typescript
// Rapid: weaker individual hits, frequent shots.
shooter.setWeapon(1, 300, 80)
```

```typescript
// Heavy: one hit defeats a default soldier, but shots are less frequent.
shooter.setWeapon(3, 1500, 80)
```

In Blocks, use the matching weapon settings block and edit its number fields before the start block.

For each version, note the settings, hits needed, and what made aiming or survival easier or harder. Repeat runs: bot decisions, respawn occupancy, and player practice can affect the result. Watch both teams' scores, and remember that increasing damage helps opposing soldiers too.

## Explain

Design a weapon of your own. Explain a benefit and a drawback. Do not assume equal theoretical damage per second produces equal gameplay: misses, discrete soldier health, and time between shots matter too.

## Connection to FPS modding

Damage, firing cooldown, and projectile travel speed are common concepts, but their APIs and units vary by game. Some weapons use instant hit detection rather than traveling projectiles. This experiment changes source-level gameplay settings; a particular FPS may expose different modding hooks or disallow a change.
