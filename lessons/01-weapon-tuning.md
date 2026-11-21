# Lesson 1: Change how a weapon feels

## Goal

Use three parameters to create different weapon behaviors without changing the firing implementation.

In main.ts, find:

```typescript
shooter.setWeapon(1, 250, 120)
```

The arguments are damage per hit, minimum milliseconds between shots, and projectile speed in pixels per second. Keep enemy settings unchanged for this experiment.

## Predict

- What changes if you lower the fire interval?
- Is a faster projectile the same as a faster firing weapon?
- With three-health enemies, how many hits does one damage require? What about two damage?

## Change and test

Play the baseline, then try these separately, restarting each time:

```typescript
// Rapid: weaker individual hits, frequent shots.
shooter.setWeapon(1, 100, 120)
```

```typescript
// Heavy: one hit defeats a default enemy, but shots are less frequent.
shooter.setWeapon(3, 600, 120)
```

In Blocks, use the matching weapon settings block and edit its number fields before the start block.

For each version, note the settings, hits needed, and what made aiming or survival easier or harder. Repeat runs: random spawns and player practice can affect the result.

## Explain

Design a weapon of your own. Explain a benefit and a drawback. Do not assume equal theoretical damage per second produces equal gameplay: misses, discrete enemy health, and time between shots matter too.

## Connection to FPS modding

Damage, firing cooldown, and projectile travel speed are common concepts, but their APIs and units vary by game. Some weapons use instant hit detection rather than traveling projectiles. This experiment changes source-level gameplay settings; a particular FPS may expose different modding hooks or disallow a change.
