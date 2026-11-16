---
audience: both
title: Stacked toast (Clerk style) phases
status: phase 1 of 4 · planned
---
# Phases · Stacked toast (Clerk style)
> phase 1 of 4 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Core](#phase-1) | toasts show and stack correctly on both platforms | **planned** | F1, F3 | - |
| 2 | [Interaction](#phase-2) | pressing feels right | **planned** | F2, F4 | 1 |
| 3 | [Stability](#phase-3) | no jump under load | **planned** | F5, F6 | 2 |
| 4 | [Maintenance](#phase-4) | library changes are cheap | **planned** | F7 | 3 |

## Next up
**Core** (planned): constants, context and provider first; the component and the backdrops can run in parallel after.

---
<a id="phase-1"></a>
## Phase 1 · Core · planned
**Goal:** toasts show and stack correctly on both platforms  
**Covers:** F1, F3  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T01 | constants + context + provider | builder | - |
| T02 | stacked-toast component (springs only) | builder | T01 |
| T03 | backdrop iOS + Android variants | builder | T01 |

**Done when (you can check each one):**
- show 1, 3 and 5 toasts: the newest is in front, the older ones sit behind it with the offsets and scales of the layout table
- `backdrop/index.tsx` (iOS) and `backdrop/index.android.tsx` both exist and are imported by the stack
- `pnpm exec tsc --noEmit` passes
- no timing curve (`withTiming`) in `stacked-toast.tsx`

---
<a id="phase-2"></a>
## Phase 2 · Interaction · planned
**Goal:** pressing feels right  
**Covers:** F2, F4  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T04 | press expand / collapse with springs | builder | T01, T02, T03 |
| T05 | haptics once per press | builder | T04 |

**Done when (you can check each one):**
- tap: the stack expands; tap again: it collapses; both use `withSpring` (grep finds no `withTiming`)
- `expo-haptics` is called once per press (exactly 1 call in `pressable-scale.tsx`)
- `pnpm exec tsc --noEmit` passes

---
<a id="phase-3"></a>
## Phase 3 · Stability · planned
**Goal:** no jump under load  
**Covers:** F5, F6  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T06 | 20 rapid `toast()` calls recorded on video | lead | T04, T05 |
| T07 | status bar visible on iOS and Android | lead | T04, T05 |

**Done when (you can check each one):**
- 20 rapid `toast()` calls in the demo screen: the stack never holds more than the visible limit and no two toasts share a position (state logged, no device needed)
- `StatusBar` is rendered on iOS and Android (grep finds it in `App.tsx`)
- the lead says the video check was not run here

---
<a id="phase-4"></a>
## Phase 4 · Maintenance · planned
**Goal:** library changes are cheap  
**Covers:** F7  
**Needs:** 3

| task | what | owner | needs |
|---|---|---|---|
| T08 | migrate on library bump (e.g. `runOnJS` to `scheduleOnRN`) | builder | version change |

**Done when (you can check each one):**
- `pnpm exec expo export --platform android` passes after the bump
- `stacked-toast-manager/API.md` lists every library call used (`SharedValue`, `withSpring`, `scheduleOnRN`, `scheduleOnUI`, press + haptics)
