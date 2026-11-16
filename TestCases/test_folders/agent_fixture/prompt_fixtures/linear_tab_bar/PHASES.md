---
audience: both
title: Linear-style tab bar phases
status: phase 1 of 6 · planned
---
# Phases · Linear-style tab bar
> phase 1 of 6 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Skeleton](#phase-1) | the static bar is on screen | **planned** | F1 | - |
| 2 | [Pill gestures](#phase-2) | drag stretch, glow, release-to-route | **planned** | F2, F3 | 1 |
| 3 | [Search](#phase-3) | search button and box | **planned** | F4 | 2 |
| 4 | [Menu](#phase-4) | pull-up menu | **planned** | F5 | 2 |
| 5 | [Polish](#phase-5) | gradient border | **planned** | F6 | 4 |
| 6 | [Perf and cleanup](#phase-6) | no waste, reduced motion | **planned** | F7 | 5 |

## Next up
**Skeleton** (planned): scaffold, file tree and constants, then the static pill with glass.

---
<a id="phase-1"></a>
## Phase 1 · Skeleton · planned
**Goal:** the static bar is on screen  
**Covers:** F1  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T01 | scaffold: app, deps, file tree, constants/theme | builder | - |
| T02 | static pill + glass material + 3 icons + notification dot | builder | T01 |

**Done when (you can check each one):**
- `pnpm build` passes and `/` opens with 0 console errors
- the files of the Build recipe exist, none twice
- the static pill shows 3 tab icons and 1 notification dot; tapping another tab changes the page (B-01)

---
<a id="phase-2"></a>
## Phase 2 · Pill gestures · planned
**Goal:** drag stretch, glow, release-to-route  
**Covers:** F2, F3  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T03 | drag stretch + glow, release-to-route, hold glow | builder | T01, T02 |

**Done when (you can check each one):**
- B-02: during a sideways drag the pill stretches, the tab under it is previewed, and the active page stays the same
- B-02b: on release over another tab the page changes to that tab
- B-06: after a hold and release the glow is gone within 500 ms (never stuck)

---
<a id="phase-3"></a>
## Phase 3 · Search · planned
**Goal:** search button and box  
**Covers:** F4  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T05 | search button to input + close | builder | T03 |

**Done when (you can check each one):**
- B-04: tapping the search button grows it into a box over the tabs
- B-05: tapping the ✕ shrinks it back to the button
- the input stays visible when the on-screen keyboard is open (viewport meta + bottom inset)

---
<a id="phase-4"></a>
## Phase 4 · Menu · planned
**Goal:** pull-up menu  
**Covers:** F5  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T06 | menu panel + drag-up threshold | builder | T03 |

**Done when (you can check each one):**
- B-03: a drag up of more than 50 px opens the menu with 3 items (Profile, Settings, Help); it stays open on release; the page does not change
- under 50 px the pill springs back and no menu opens

---
<a id="phase-5"></a>
## Phase 5 · Polish · planned
**Goal:** gradient border  
**Covers:** F6  
**Needs:** 4

| task | what | owner | needs |
|---|---|---|---|
| T08 | masked gradient border on glass | builder | T06 |

**Done when (you can check each one):**
- a masked gradient border is visible on the pill, the search box and the menu
- all three use the SAME glass style (one class in `glass.css`)

---
<a id="phase-6"></a>
## Phase 6 · Perf and cleanup · planned
**Goal:** no waste, reduced motion  
**Covers:** F7  
**Needs:** 5

| task | what | owner | needs |
|---|---|---|---|
| T09 | perf + dead-code audit, reduced motion | lead | T08 |

**Done when (you can check each one):**
- B-07: with `prefers-reduced-motion: reduce` stretch and glow become instant colour changes
- no unused file or hook (`pnpm exec vue-tsc --noEmit` clean)
- no heavy work inside the pointer handlers except plain state updates
