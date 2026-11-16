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
- app boots; tree matches the plan; no duplicate files
- the static pill renders

---
<a id="phase-2"></a>
## Phase 2 · Pill gestures · planned
**Goal:** drag stretch, glow, release-to-route  
**Covers:** F2, F3  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T03 | drag stretch + glow, release-to-route, hold glow | builder | P1 |

**Done when (you can check each one):**
- B-02, B-02b and B-06 rows pass
- the page never changes while dragging
- the glow never stays stuck

---
<a id="phase-3"></a>
## Phase 3 · Search · planned
**Goal:** search button and box  
**Covers:** F4  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T05 | search button to input + close | builder | P2 |

**Done when (you can check each one):**
- B-04 and B-05 rows pass
- the keyboard never covers the bar

---
<a id="phase-4"></a>
## Phase 4 · Menu · planned
**Goal:** pull-up menu  
**Covers:** F5  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T06 | menu panel + drag-up threshold | builder | P2 |

**Done when (you can check each one):**
- B-03 row passes
- under 50 px the pill springs back and no menu opens

---
<a id="phase-5"></a>
## Phase 5 · Polish · planned
**Goal:** gradient border  
**Covers:** F6  
**Needs:** 4

| task | what | owner | needs |
|---|---|---|---|
| T08 | masked gradient border on glass | builder | P4 |

**Done when (you can check each one):**
- border visible on pill, search and menu

---
<a id="phase-6"></a>
## Phase 6 · Perf and cleanup · planned
**Goal:** no waste, reduced motion  
**Covers:** F7  
**Needs:** 5

| task | what | owner | needs |
|---|---|---|---|
| T09 | perf + dead-code audit, reduced motion | qa-reviewer | P5 |

**Done when (you can check each one):**
- B-07 passes
- no unused file or hook
- no JS-thread work inside gesture handlers except plain callbacks
