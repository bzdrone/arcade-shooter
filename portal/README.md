# Portal-side examples (author files)

A hand-written port of the Arcade gun game to Battlefield 6 Portal. It checked that the `mod` layer's shape is close enough to Portal's, and the Arcade to Portal converter (`../site/`) generates scripts modelled on it. These files are **not** part of the Arcade project or its PNG, and creators do not need them.

- `gungame.ts`: the Portal port of `../gungame.ts`. It contains the Portal side of the weapons compatibility library (the `weapons` namespace, mapping each category to one real Portal item) followed by the gun game rules. Every change from the Arcade version is marked `PORT:`; [PORTAL.md](../PORTAL.md) lists them as a checklist.
- `gungame.strings.json`: the message text for that script. Portal looks up message text by key, with up to three `{}` placeholders.

## Status

- Type-checked against the Portal SDK 2.1.2.0 type declarations with `node tools/check-portal.cjs <path-to-portal-sdk>`. That check also confirms that every `mod.stringkeys` key used exists in the strings file.
- **Not yet run in Portal.** Unverified behavior includes how `ObjectVariable` slots on players behave without declarations made in the Portal editor, whether the weapon swap feels right, and how plain number arguments display in messages.

## Using a script

A Portal mode is one TypeScript file plus its strings file. Upload both through the Portal web tool. To use the weapons library in another mode, copy the `weapons` namespace into that mode's script.
