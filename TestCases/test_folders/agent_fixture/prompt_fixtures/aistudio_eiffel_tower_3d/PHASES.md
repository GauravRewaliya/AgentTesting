---
audience: both
title: Eiffel Tower 3D phases
status: phase 1 of 3 · planned
---
# Phases · Eiffel Tower 3D
> phase 1 of 3 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Every task is 15-30 minutes, one owner (`builder`), and reads the parts in its `reads` column (Contract = `build_inputs/00_contract.md`, Look file = `build_inputs/01_look.md`, Stops file = `build_inputs/02_stops_and_text.md`). Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Tower and world](#phase-1) | a lit, procedural tower you can orbit | **planned** | F1, F2 | - |
| 2 | [Camera and tour](#phase-2) | the 12-stop tour and the hero stop | **planned** | F3, F4 | 1 |
| 3 | [Photos and language](#phase-3) | photo placards and EN/FR | **planned** | F5, F6 | 2 |

## Next up
**Tower and world** (planned): set up the shell and boot veil (T01), then materials and the worker (T02), the tower (T03) and the light (T04).

---
<a id="phase-1"></a>
## Phase 1 · Tower and world · planned
**Goal:** a lit, procedural tower you can orbit  
**Covers:** F1, F2  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | shell: `package.json` (pinned, `pnpm add three@0.186.0`, no `@google/genai`), `tsconfig.json`, `vite.config.ts`, `index.html`, `style.css` tokens, `startup_orchestrator.js` boot veil | builder | - | Build recipe, Contract (Stack), Look file 1-3, 8 |
| T02 | `pbr_worker.js` (procedural iron and stone textures) + `model/materials.js` (PBR bank, sketch override) with main-thread fallback | builder | T01 | Contract (R2, Edge cases) |
| T03 | `model/tower_controller.js` + `model/zones/*.js`: 4 piers, platforms at 58, 116, 276 m, lantern 300 m, mast 312 m (simple lattice) | builder | T02 | Contract (R1), README Q1, Look file 4 |
| T04 | `world/atmosphere.js` (sky, fog, lights, shadows, `auditZeroEmissive`) + `world/paris_1889.js` (ground, lawn, low blocks) | builder | T01 | Contract (R3), README Q2, Look file 4 |

**Done when (you can check each one):**
- `pnpm install && pnpm exec tsc --noEmit && pnpm build` exit 0
- open the page: 4 piers and 3 platforms are visible and you can orbit; the boot veil fades in 0.45 s; 0 console errors
- `auditZeroEmissive(scene)` in the console returns 0 offenders
- `package.json` pins `three` 0.186.0 and has no `@google/genai`

---
<a id="phase-2"></a>
## Phase 2 · Camera and tour · planned
**Goal:** the 12-stop tour and the hero stop  
**Covers:** F3, F4  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T05 | `camera/tour_rig.js`: Catmull-Rom helix paths clear of the piers, look-at, zero-jump start and end, drag interruption and recovery | builder | T03, T04 | Contract (R5-R7), Look file 7 |
| T06 | `camera/hero_rig.js`: stop 12 turntable sway, 5 view presets, portrait fov 56 | builder | T05 | Contract (R9), Look file 5 |
| T07 | `ui/museum_header.js`, `ui/landing_intro.js`, `ui/walkthrough_controller.js`: Explore, bar, holds 2.6 s / 4.0 s, keys, `?stop=` clamp | builder | T05 | Contract (R4, R11, Edge cases), Look file 8, Stops file 9 |

**Done when (you can check each one):**
- tour stops 1-12 run with 0 console errors and the camera never enters a pier
- a per-frame pose log shows under 0.001 m difference at every move start and end
- dragging mid-move pauses the tour and then eases back; Enter, Arrow Right/Left, Home, End and V work
- stop 12 shows the complete tower turning slowly; the 5 view chips fly to their poses

---
<a id="phase-3"></a>
## Phase 3 · Photos and language · planned
**Goal:** photo placards and EN/FR  
**Covers:** F5, F6  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T08 | `portals/photo_portals.js`, `data/photo_cameras_3d.json`, copy the 11 photos from `build_inputs/photos/` | builder | T06, T07 | Contract (R8), README Q3, Look file 6 |
| T09 | `story/stops_en.js`, `stops_fr.js`, `i18n.js`; language toggle and `<html lang>`; every string in both languages | builder | T06, T07 | Contract (R10, Content), Stops file 10, 11 |
| T10 | `app.js` wiring, reduced motion, 390 px layout, contrast pass, final checks | builder | T08, T09 | Quality bar, Contract (Done-when) |

**Done when (you can check each one):**
- stops 1-11 show the photo whose id is in the stops file; stop 12 shows none
- toggling language at stops 1, 6 and 12 changes every caption and aria text; 0 console errors in EN and FR
- at 390 x 844 there is no horizontal scroll; caption contrast is 4.5:1 or better; targets are 40 px or more
- with reduced motion on, no infinite animation runs
- `pnpm exec tsc --noEmit` and `pnpm build` exit 0; `@google/genai` is not in `package.json`
