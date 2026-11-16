# Facts and numbers taken from the analysed reference demos (data only, no code)
> Use these values as they are. Everything not listed here is your own design inside the rules of README.md.

## three.js (the two 3D demos)
Version **r187** (`three@0.187.0`). pnpm only, no CDN: in each 3D folder run `pnpm add three@0.187.0` (or `pnpm dlx` in a scratch folder), then COPY `three.module.js`, `three.core.js`, `addons/controls/OrbitControls.js` and `LICENSE-three.txt` from `node_modules/three/build` and `examples/jsm` into that folder's `vendor/` (so `vendor/three.module.js`, `vendor/three.core.js`, `vendor/addons/controls/OrbitControls.js`, `vendor/LICENSE-three.txt`), import from `./vendor/...`, and delete `node_modules` and `package.json` afterwards. The page must work from `python3 -m http.server 8000`.

## 3d-scene (Moonlit Ruins)
- `LOOP = 16` seconds; fog `FogExp2(0x1b1f3a, 0.032)`; hemisphere light sky `0x5a66b8`, ground `0x1c1626`, strength 0.75; moon = directional light `0xa9bcff`, strength 3.0, casts shadows.
- ground: stone tiles on a 13x13 grid (x, z from -6 to 6, only where distance from the centre < 6.2, about 10 % left out), 1,500 grass blades in ONE instanced batch, 16 mist sprites, 320 fireflies, two braziers at x = ±3.3, auto-orbit speed = one turn per loop.

## action-game (Lantern Keep)
Canvas 320x180, tile size 8 px, fixed 60 updates/s. The room is this text map (`#` stone, `.` empty, `P` player start, `E` enemy, `L` hanging lantern; a `|` pins everything after it to the right wall; a row shorter than the room is padded with `.`; the room is 54 columns wide inside a 1-tile stone border; empty lines are empty rows):
```
(empty)
(empty)
........L.....................L...............L
(empty)
(empty)
(empty)
|#########......
(empty)
(empty)
...............######
(empty)
................................E
#######......................#######
#######|####
#######|####
#######.................####|####
#######|#####
#######.....###|#####
#######|#########
#######|#########
#######..P..............E.............E|#########
######################################################
######################################################
######################################################
```

## juice-sandbox
Canvas 240x135 (padding 20), floor y = 108, fixed 60 updates/s. Sliders (key, range, step, heavy-hit multiplier): hitstop 0-300 ms step 10 (x2) · shake 0-12 px step 1 (x2) · particles 0-200 step 1 (x2) · flash 0-100 % step 5 (x1, held 2x longer) · chroma 0-8 px step 1 (x2).
Presets as [hitstop, shake, particles, flash, chroma]: Off [0,0,0,0,0] · Subtle [30,1,8,40,0] · Crunchy [80,4,28,80,1] · Too much [220,12,160,100,6].
Attack timing in frames (wind-up / hold / recovery): light 4 / 3 / 6, damage 8-15 · heavy 12 / 8 / 10, damage 24-39. Hit-stop is rounded to whole frames. The player stands at x = 104, the dummy at x = 136.

## sound-world
- Palettes (background, a, b, c): **Aurora** `#050814`, `#38f5c8`, `#6a7dff`, `#d16bff` · **Ember** `#120606`, `#ffc857`, `#ff5e3a`, `#c81d5e` · **Neon** `#07020f`, `#00f0ff`, `#ff2bd6`, `#f9f871` · **Mono** `#08090b`, `#ffffff`, `#9aa3b2`, `#4d5564`. Default Aurora.
- Bands: bass 30-140 Hz, mids 300-2,000 Hz, treble 4-12 kHz. Beat = a sudden jump of low-end energy with a minimum gap between beats. A beat sends a ground ripple (at most 5 at once), an expanding ring and a short camera zoom pulse.
- Demo beat: 16 s loop at 120 BPM made in code (sine kick 150 Hz sliding to 45 Hz, plus hats and a bass note). 96 pillars in a ring.

## grain-synth
`samples/plucks.wav` is a short plucked-string phrase **generated in code** (write a small Node script that renders it once, mono 16-bit WAV, about 4-5 s at 44.1 kHz, and save the file; do not download one).
