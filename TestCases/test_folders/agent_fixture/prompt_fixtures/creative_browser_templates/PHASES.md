---
audience: both
title: Five creative browser demos phases
status: phase 1 of 2 · planned
---
# Phases · Five creative browser demos
> phase 1 of 2 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Build the five](#phase-1) | five folders, each opens with 0 console errors and its Controls work | **planned** | F1-F6 | - |
| 2 | [QA sweep](#phase-2) | all five pass together and respect reduced motion | **planned** | F7 | 1 |

## Next up
**Build the five** (planned): start all five together; no file is shared.

---
<a id="phase-1"></a>
## Phase 1 · Build the five · planned
**Goal:** five folders, each opens with 0 console errors and its Controls work  
**Covers:** F1-F6  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T01 | 3d-scene (`3d-scene/index.html`, `3d-scene/scene.js`, `3d-scene/vendor/`, `3d-scene/README.md`) | builder | - |
| T02 | action-game (`action-game/index.html`, `action-game/game.js`, `action-game/README.md`) | builder | - |
| T03 | grain-synth (`grain-synth/index.html`, `grain-synth/synth.js`, `grain-synth/samples/plucks.wav`, `grain-synth/README.md`) | builder | - |
| T04 | juice-sandbox (`juice-sandbox/index.html`, `juice-sandbox/juice.js`, `juice-sandbox/README.md`) | builder | - |
| T05 | sound-world (`sound-world/index.html`, `sound-world/viz.js`, `sound-world/vendor/`, `sound-world/README.md`) | builder | - |

**Done when (you can check each one):**
- each of the 5 pages loads from `python3 -m http.server 8000` with 0 console errors
- each page exposes its hook (`SCENE`, `GAME`, `SYNTH`, `JUICE`, `VIZ`) and `?ui=0` hides its UI
- every key in the Controls rows of the README changes something visible (e.g. juice-sandbox: J = light hit, 1-4 = presets)
- no image file in the 5 folders (the only binary is `grain-synth/samples/plucks.wav`)

---
<a id="phase-2"></a>
## Phase 2 · QA sweep · planned
**Goal:** all five pass together and respect reduced motion  
**Covers:** F7  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T06 | QA sweep of all five + reduced-motion check | lead | T01, T02, T03, T04, T05 |

**Done when (you can check each one):**
- every Controls row passes in a headless browser run (list each demo: pass or fail)
- with `prefers-reduced-motion: reduce`, screen shake and flashing are off or much smaller in action-game and juice-sandbox
