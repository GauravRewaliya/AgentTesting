---
audience: both
title: Five creative browser demos
status: phase 1 of 2 · planned
---
# Five creative browser demos · phase 1 of 2 · planned
> Five small, independent web toys: a 3D night scene, a 2D action game, a granular synth, a game-feel tuner and a sound-reactive 3D world.

> **Planning phase only: nothing is built from this plan yet.** File and folder names below are the *planned* layout (taken from the analysed reference app), not files that exist. Test cases in `TestCases/` check the finished reference project or try to build from this plan; they are not the product.

| who reads | what | where |
|---|---|---|
| **Audience (users)** | Someone who wants ready-to-open demos to learn from or restyle, or to hand to five builders at once (they share no files). | this page: What is it, What you get, Look, Motion |
| **Stakeholders** | decide scope, answer questions | Decisions and open questions, Phases at a glance |
| **Builders (dev)** | stack: plain JavaScript + Canvas 2D / Web Audio; three.js r187 copied into the two 3D demos; no build step | `PHASES.md` and the grey DEV blocks (switch to Dev) |

## What is it
Five separate mini-projects, one folder each. Open them in a browser (no build step; only a local copy of three.js in the two 3D ones). Each folder has a README with Run, Controls and What to try, plus `window.<NAME>` hooks (`SCENE`, `GAME`, `SYNTH`, `JUICE`, `VIZ`) so tests can drive it. Every visual effect has an on/off key so you can feel what it adds.

**For:** Someone who wants ready-to-open demos to learn from or restyle, or to hand to five builders at once (they share no files).

## What you get (feature catalog)
| id | feature | what you see or do | phase | status |
|---|---|---|---|---|
| F1 | Moonlit Ruins (3d-scene) | orbit a night scene: broken columns, floating crystal, two fires, 1,500 grass blades, fog, 16 mist sprites, 320 fireflies; loops every 16 s | [1. Build the five](PHASES.md) | planned |
| F2 | Lantern Keep (action-game) | 320x180 pixel game at 60 updates/s: run, jump, dash, 3-hit combo; one room, one enemy; effects on keys 1-4 | [1. Build the five](PHASES.md) | planned |
| F3 | Grain Cloud (grain-synth) | granular synth: each grain is a glowing dot over the waveform; upload, drag a file, demo `plucks.wav`, built-in tone or noise | [1. Build the five](PHASES.md) | planned |
| F4 | Juice Sandbox (juice-sandbox) | 240x135 scene, 5 real sliders (hit-stop, shake, particles, flash, chroma), 4 presets, auto-hit, extras | [1. Build the five](PHASES.md) | planned |
| F5 | Sound World (sound-world) | 3D world reacts to sound: loudness = orb, bass = ground, mids = spin, treble = sparkle, 96 pillars, beat ripples; demo beat (16 s, 120 BPM), file or mic | [1. Build the five](PHASES.md) | planned |
| F6 | Scripting hooks and URL options | `?ui=0`, `?step=1`, `?manual=1`, `?pr1=1`, `window.SCENE/GAME/SYNTH/JUICE/VIZ` | [1. Build the five](PHASES.md) | planned |
| F7 | Calm mode | camera shake and flashing respect 'reduce motion' (added requirement; not in the originals) | [2. QA sweep](PHASES.md) | planned |

## Look and feel
- **Shared style:** each demo is its own look; none uses a design system. Everything is drawn in code (no image or model files). Pixel demos (action-game 320x180, juice-sandbox 240x135) are scaled up with hard pixel edges.
- **3d-scene:** stylised night, soft sky light, moon with shadows, pulsing crystal light, two flickering fire lights, fog and mist.
- **grain-synth / sound-world:** glowing dots and a glowing orb on dark; sound-world palettes **Aurora, Ember, Neon, Mono**.

## Motion and animation
| demo | animation | rule |
|---|---|---|
| 3d-scene | crystal floats and spins, shards orbit it, grass and trees sway, fires flicker | everything repeats every 16 s (`LOOP`), seamless at any length |
| action-game | hit-stop, screen shake, sparks, lighting | each toggled by keys 1-4; G toggles all; fixed 60 updates/s |
| juice-sandbox | hit-stop (0-300 ms, whole frames), shake (0-12 px), 0-200 particles, flash 0-100%, chroma 0-8 px; heavy hit = about 2x | extras (E): dummy wobble, sword trail, damage numbers |
| grain-synth | each grain is born when it starts and fades with its envelope | scheduled ahead on the audio clock, smooth fade in/out |
| sound-world | bass swells the ground, mids spin particles, beats send a ripple and ring | sensitivity 0.2x to 3x; auto-orbit option |
| all | `prefers-reduced-motion` must tone down shake and flashing | **new requirement (F7)** |

## Controls (each row is a test)
**3d-scene:** drag = orbit · scroll = zoom · right-drag = pan · R = reset camera · 1/2/3/4/5 = shadows / fog / particles / point lights / motion · A = auto-orbit. URL `?ui=0` hides UI; `?step=1` = no clock, frames only from `SCENE.frame(t, camera)`.

**action-game:** A/D or arrows = move · Space/W/Up = jump · Shift/K = dash · J/X/click = attack (3-hit combo) · R = restart · 1/2/3/4 = hit-stop / shake / particles / lighting · G = all effects. URL `?juice=0`, `?hud=0`, `?manual=1` (`GAME.step(keys)`). Room is a text map (`#` stone, `P` start, `E` enemy, `L` lantern). No sound, no touch.

**grain-synth:** sliders: grain size 10-500 ms · position (click or drag the waveform) · spray · density 1-120/s · pitch -24 to +24 semitones · reverse chance · wet/dry · Space = play/stop. Sources: upload, drag a file, `samples/plucks.wav`, built-in tone, built-in noise.

**juice-sandbox:** J = light hit · K = heavy hit · 1/2/3/4 = presets Off, Subtle, Crunchy, Too much · A = auto-hit (light, light, heavy) · E = extras · R = reset. A 'Last hit' box shows what was measured. URL `?ui=0`, `?big=1`, `?manual=1`.

**sound-world:** Load recording (or drag), Demo beat, Use mic (asks permission; never played back) · Sensitivity · Palette · Auto-orbit · Space = pause · drag/scroll = orbit/zoom. Live meters for loudness, bass, mids, treble and a beat dot. URL `?ui=0`, `?pr1=1`. Mic needs localhost or HTTPS.

## Shared rules
No build step (three.js r187 is fetched ONCE with `pnpm add` and copied into `vendor/` of the two 3D demos; see `build_inputs/01_facts.md`; never npm), no image files, serve with `python3 -m http.server 8000` (modules and the mic need it), each folder standalone.

## Team: who does what
| who | does | tasks |
|---|---|---|
| builder | writes the code of its own files only (no file is owned twice) | T01, T02, T03, T04, T05 |
| qa-reviewer | checks every phase in a real browser or build; writes pass/fail, never builds | T06 |

You (the owner) answer the open questions and judge each phase; Claude edits this plan when you ask (see Share and change).

## Quality bar (what 'professional' means here)
- Each page loads with 0 console errors
- Every row of the Controls above does what it says (a person can check each by keyboard)
- Every effect can be switched off; with 'reduce motion' on, shake and flashing stop
- Fixed time step (60 updates/s) so the games feel the same on any screen
- Tested in desktop Chrome only in the originals: say which browsers a run covered

## Real or guessed
Analysed from the five original READMEs and file lists of the working demos (the real project is the fixture zip). 'Calm mode' is the one requirement added by this plan.

## Test cases (not the product)
- `pp_creative` in `test_prompt_planning` builds the five demos from THIS plan only (no source code given); the numbers they need are in `build_inputs/01_facts.md`.
- `pc_creative` checks the **finished reference project** (`agent_fixture/store/projects/creative-browser-templates.zip`): does it install and build?

## Decisions and open questions
| id | what | answer / default | state |
|---|---|---|---|
| D-01 | three.js is copied into both 3D folders instead of a shared `vendor/` | keep standalone folders; cost: one duplicate 1 MB file | agreed |
| D-02 | Serving | `python3 -m http.server 8000` | agreed |
| Q1 | Build all five or start with one? | all five, they are independent | agreed |

## Phases at a glance
**1. Build the five** (planned), **2. QA sweep** (planned) → [full phase page](PHASES.md)

## Share and change
- **Share:** press *Copy link* in the plan viewer; one link = one page.
- **Change something:** press *Ask Claude* on the page and write your wish. Claude edits THIS file (and the phase page if scope moves), so `git diff docs/` shows what the plan changed.
- Status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done.
