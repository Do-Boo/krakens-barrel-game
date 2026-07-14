# Kraken's Barrel UI Asset Prompts

These assets were generated with the built-in image generator. Chroma-key sources are preserved in `artwork/ui-source/`; optimized game-ready outputs live in `public/assets/ui/`.

## Shared transparent-asset suffix

```text
Style: premium casual mobile pirate party-game icon, hand-painted 2D illustration, chunky rounded toy-like proportions, bold readable silhouette. Composition: one isolated subject, fully visible, centered with generous padding. Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform with no shadows, gradients, texture, floor or lighting variation. Do not use the key color in the subject. No cast shadow, no text, no letters, no frame, no logo, no watermark.
```

For blue or green subjects, use `#ff00ff` instead. The generator occasionally selected another flat key color; the final images were processed by border color sampling rather than assuming a fixed key.

## Menu scene

### Tavern menu background

```text
A polished hand-painted pirate tavern interior at night, viewed straight-on toward a large round wooden table and a softly lit ship-window wall, with an open uncluttered dark-teal center area reserved for menu UI. Premium casual mobile party-game concept art, chunky rounded shapes, symmetrical 16:9 landscape composition, warm amber lanterns against deep teal shadows, ropes, barrels and aged-brass details around the edges. No people, character, text, logo, buttons or UI panels.
```

### Kraken crest

```text
A centered kraken pirate crest combining a cheerful coral-red cartoon kraken head, small navy captain tricorn hat, two crossed cutlasses and a round aged-brass medallion frame. Symmetric, playful rather than scary.
```

### Menu frame

```text
A wide vertical pirate captain menu frame made from dark walnut planks, thick aged-brass corner caps, rope knots and tiny coral-red cloth accents. Keep the frame thin and leave a very large completely empty chroma-key center opening for HTML content. Front-facing and symmetric.
```

## Main actions

### Create crew

```text
A chunky dark-walnut ship wheel combined with a polished aged-brass anchor and a small coral-red ribbon, front-facing, symbolizing creating a new crew and becoming host.
```

### Join crew

```text
An aged-brass compass resting over a small rolled parchment treasure map with a coral-red wax seal, front-facing, symbolizing joining a friend's crew by room code. No writing or numbers.
```

### Practice

```text
A small oak training barrel with one rounded wooden practice dagger pointing toward it. The dagger tip direction must be obvious and it must not already pierce the barrel. Compact front-facing symbol for solo practice mode.
```

## Mode cards

```text
Classic: A small oak pirate barrel with one polished cutlass inserted tip-first and a friendly skull medallion, on a coral-red radial square card background.
Double: A small oak pirate barrel threatened by two playful purple kraken tentacles, with two polished cutlasses inserted tip-first on opposite sides, on a deep-purple radial square card background.
Speed: A chunky aged-brass ship bell beside a pirate hourglass, wrapped with a coral-red ribbon and small motion streaks, on an amber-orange radial square card background. No numerals.
Reverse: An aged-brass pirate compass with two curved arrows circling in opposite directions and a playful kraken eye in the center, on a deep teal-blue radial square card background.
```

## Container icons

```text
Oak barrel: One large warm honey-oak pirate barrel with a bulging middle, dark iron bands, brass rivets and an open top, front three-quarter view.
Blue drum: One large cobalt-blue steel drum barrel with three raised circular ribs, rounded top rim, small brass cap, subtle hand-painted wear and glossy highlights, front three-quarter view.
Powder barrel: One large dark charcoal wooden gunpowder barrel with a bulging middle, thick aged-brass bands, red warning cloth and a short unlit rope fuse near the top, front three-quarter view. No flame or explosion.
```

## Weapon icons

```text
Captain sword: One complete captain cutlass, broad polished silver blade with an obvious sharp tip, aged-brass D guard, navy leather grip and small coral-red wrap. Angle handle bottom-left to tip top-right.
D-guard cutlass: One complete pirate D-guard cutlass with a shorter strongly curved dark-steel blade, obvious pointed tip, oversized blackened-brass knuckle guard and brown leather grip. Angle handle bottom-left to tip top-right.
Kraken dagger: One complete kraken dagger, short straight dark-steel blade with a needle-sharp tip, aged-brass tentacle-shaped guard, turquoise gem and navy leather grip. Angle handle bottom-left to tip top-right.
Frozen mackerel: One complete frozen silver-blue mackerel comedy weapon, large expressive eye, closed mouth, frosty scales, tail clearly at the handle end and pointed nose at the insertion end. Angle tail bottom-left to nose top-right.
Legendary carrot: One legendary orange carrot comedy dagger, long straight tapered body with a sharp root tip, dark-teal leafy top bound with an aged-brass grip ring, and subtle magical gold highlights. Angle leafy handle bottom-left to tip top-right.
Captain umbrella: One complete closed pirate captain umbrella, tightly wrapped deep-navy fabric, long straight shaft, pointed aged-brass ferrule at one end, curved dark-wood handle at the opposite end and a tiny coral tie. Angle handle bottom-left to tip top-right.
```

## Illustrated control kit

Every control frame is intentionally blank. Button labels, room codes, form values, focus states and click targets remain accessible live HTML layered over the image asset.

```text
Primary button: A wide blank pirate tavern button, about 4:1, with a glowing amber-gold painted wood center, chunky dark-walnut rim, aged-brass corner guards and small rivets.

Secondary button: A wide blank pirate tavern button, about 4:1, with a deep navy-teal painted wood center, chunky dark-walnut rim, aged-brass corner guards and small rivets.

Danger button: A wide blank pirate tavern button, about 4:1, with a coral-red painted wood center, blackened-walnut rim, dark aged-brass corners and small rivets.

Square icon button: A blank square pirate tavern icon-button frame with a deep navy-teal painted wood center, chunky dark-walnut rim, aged-brass corners and rivets.

Selected square icon button: A blank selected-state square pirate tavern icon-button frame with a bright amber-gold painted wood center, glowing inner rim, chunky dark-walnut outer rim, aged-brass corners and rivets.

Choice card: A wide blank unselected choice card, about 3:1, made from nearly black navy-painted walnut with a thin dark-walnut rim and restrained aged-brass corner pins.

Selected choice card: A wide blank selected choice card, about 3:1, with an amber-gold painted wood center, dark-walnut rim and aged-brass corner pins.

Parchment input: A wide blank pirate tavern text input, about 4:1, with a warm cream parchment writing area, dark-walnut inset rim and aged-brass corner caps. Use a flat #ff00ff chroma-key background so the cream parchment remains opaque.

Status chip: A slim blank dark-walnut plaque, about 5:1, with a thin aged-brass rim and round end rivets.
```

Shared constraints: front-facing and horizontal, generous empty center, no text, letters, numerals, symbols, icons, logos or watermark. Isolate on a perfectly flat chroma-key background with no floor, cast shadow, gradient, texture or vignette.

## Chroma-key conversion

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input <source.png> \
  --out <final.png> \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```
