---
audience: both
title: Eiffel Tower 3D phases
status: planned
---
# Phases · Eiffel Tower 3D
> planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Build the whole exhibit](#phase-1) | tower, tour, photos and both languages in one go | **planned** | F1-F6 | - |

## Next up
**Build the whole exhibit** (planned). Nothing else is planned after this.

---
<a id="phase-1"></a>
## Phase 1 · Build the whole exhibit · planned
**Goal:** a finished Eiffel Tower exhibit in `run_test/eiffel/`.  
**Covers:** F1-F6  
**Needs:** nothing (all text and photos are in `build_inputs/`)

| task | what | owner | needs |
|---|---|---|---|
| T01 | tower model + PBR iron + sketch mode (`model/`), atmosphere + Paris 1889 (`world/`), `startup_orchestrator.js` | builder | - |
| T02 | camera choreography: Catmull-Rom helix paths, look-at, drag-interrupt (`camera/`); stop 12 hero model + mobile framing | builder | T01 |
| T03 | photo portals + EN/FR text from `build_inputs/01_tour_stops.md`, photos from `build_inputs/photos/`, language toggle | builder | T01 |

**Done when (you can check each one):**
- tower renders with 4 piers and platforms; audit function reports zero emissive materials
- tour runs stops 1-12 with 0 console errors; no visible jump at the start or end of any move
- a photo shows at each stop that has one; the toggle changes every caption on screen
- `pnpm build` passes
