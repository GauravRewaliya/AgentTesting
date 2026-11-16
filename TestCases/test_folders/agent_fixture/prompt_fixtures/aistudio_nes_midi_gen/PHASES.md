---
audience: both
title: NES MIDI Generator phases
status: phase 1 of 3 · planning
---
# Phases · NES MIDI Generator
> phase 1 of 3 · planning · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Learn the real app](#phase-1) | replace the guess with facts | **planning** | all | - |
| 2 | [Build](#phase-2) | the must-have list works | **planning** | F1-F4 | 1 |
| 3 | [Verify](#phase-3) | every feature shown on a recorded video | **planning** | all | 2 |

## Next up
**Learn the real app** (planning): open the real app and write down screens and behaviours.

---
<a id="phase-1"></a>
## Phase 1 · Learn the real app · planning
**Goal:** replace the guess with facts  
**Covers:** all  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T00 | view the real app (Code tab) or ask the owner; update README and this page | planner | - |

**Done when (you can check each one):**
- each feature in the catalog is confirmed or changed
- the phases below match the real app

---
<a id="phase-2"></a>
## Phase 2 · Build · planning
**Goal:** the must-have list works  
**Covers:** F1-F4  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T01 | style picker, seeded-random track generation (`src/ai/provider.ts`, `mockProvider`), browser playback, .mid export | builder | P1 |

**Done when (you can check each one):**
- `pnpm install && pnpm build` passes and `tsc --noEmit` is clean
- opens in a browser with 0 console errors
- same style and seed give the same notes; no AI call, no key, no `.env` file

---
<a id="phase-3"></a>
## Phase 3 · Verify · planning
**Goal:** every feature shown on a recorded video  
**Covers:** all  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T02 | record a `qa` video that shows each feature | qa-reviewer | P2 |

**Done when (you can check each one):**
- each feature in the catalog is visible in the video
