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
| T01 | 3d-scene (`index.html`, `scene.js`, vendor three.js) | builder | - |
| T02 | action-game (`index.html`, `game.js`) | builder | - |
| T03 | grain-synth (`index.html`, `synth.js`, `samples/plucks.wav` generated in code) | builder | - |
| T04 | juice-sandbox (`index.html`, `juice.js`) | builder | - |
| T05 | sound-world (`index.html`, `viz.js`, vendor three.js) | builder | - |

**Done when (you can check each one):**
- each page loads with 0 console errors
- every Controls row works
- every effect has an on/off key
- no image files: sprites and shapes are drawn in code

---
<a id="phase-2"></a>
## Phase 2 · QA sweep · planned
**Goal:** all five pass together and respect reduced motion  
**Covers:** F7  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T06 | QA sweep of all five + reduced-motion check | qa-reviewer | P1 |

**Done when (you can check each one):**
- every Controls row passes in a real browser
- with 'reduce motion' on, shake and flashing stop
