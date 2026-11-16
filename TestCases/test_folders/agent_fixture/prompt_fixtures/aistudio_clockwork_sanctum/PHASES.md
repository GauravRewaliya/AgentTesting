---
audience: both
title: Clockwork Sanctum phases
status: phase 1 of 4 · planned
---
# Phases · Clockwork Sanctum
> phase 1 of 4 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts. Every task is 15-30 minutes, one owner (`builder`), and reads the README sections named in its `reads` column (Contract = the DEV block in the README).

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Board and beam](#phase-1) | one island where the beam works | **planned** | F1, F2 | - |
| 2 | [Turn loop](#phase-2) | you can win and lose | **planned** | F3 | 1 |
| 3 | [Content](#phase-3) | gears, Mage and four islands | **planned** | F4, F5 | 2 |
| 4 | [Polish](#phase-4) | feels like a finished game | **planned** | F6 | 3 |

## Next up
**Board and beam** (planned): set up the shell (T01), then build the beam solver as a pure function with unit tests (T02), then draw the board (T05).

---
<a id="phase-1"></a>
## Phase 1 · Board and beam · planned
**Goal:** one island where the beam works  
**Covers:** F1, F2  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | shell: `package.json` (pinned), `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/engine/config.ts` (grid 8 x 8, tile 2.0, palette, camera, `reflectDir`) | builder | - | Build recipe, Contract (Stack, Look) |
| T02 | `src/engine/beam.ts` pure `solveBeam` + `test/beam.test.ts` (8 cases) | builder | T01 | Contract (Behaviour R1-R3) |
| T05 | `src/view/board.ts`, `camera.ts`: isometric tiles, 4 braziers, sky background, orbit with Q/E, island 1 layout drawn | builder | T01 | Contract (Look, island table row 1) |
| T05b | draw the beam from `solveBeam` and mirrors you can click to turn (`rot` +1) | builder | T02, T05 | Contract (R2, R6) |

**Done when (you can check each one):**
- `pnpm test` shows at least 8 beam tests passing in under 5 s
- `pnpm exec tsc --noEmit` and `pnpm build` exit 0
- open the page: an 8 x 8 board with 4 corner braziers; click mirror m5 on island 1 and the golden beam visibly changes direction; 0 console errors

---
<a id="phase-2"></a>
## Phase 2 · Turn loop · planned
**Goal:** you can win and lose  
**Covers:** F3  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T03 | `src/engine/state.ts`, `rogue.ts`: actions, steps, BFS Rogue, frozen and sun-blind skip, win, lose, stars, undo, retry | builder | T01, T02, T05 | Contract (R4-R14, State shapes) |
| T04 | `src/engine/levels.ts` island 1 data + `test/levels.test.ts` replaying the recorded solution | builder | T03 | Contract (island table row 1) |
| T06 | HUD: step counter, End Turn, Undo, Retry, win and lose banners with real texts | builder | T03 | Contract (Content, Look) |

**Done when (you can check each one):**
- the island 1 solution test ends in victory with 3 stars at 4 steps
- browser: after each click the Rogue moves exactly 1 tile; let it reach you and the text 'Shadow Ambush! Press [Z] to Undo your last step or [R] to Retry!' shows; press Z and the step is undone
- a unit test shows a Rogue on a lit tile does not move

---
<a id="phase-3"></a>
## Phase 3 · Content · planned
**Goal:** gears, Mage and four islands  
**Covers:** F4, F5  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T08 | `src/engine/gears.ts`: row/column slide (R7) and a crank click in the view | builder | T03, T04, T06 | Contract (R7, island 1 gears) |
| T09 | Astral Aid (F key and Mage card, once per island, 0 steps, freeze 2) + `csAstralPulse` | builder | T08 | Contract (R10, Motion) |
| T10 | island 2: sluices, water lock, bridge row | builder | T09 | Contract (island table row 2, Q3) |
| T11 | island 3: pendulum, conveyor rollers, Shield-Bash | builder | T09 | Contract (island table row 3) |
| T12 | island 4: sky ferry across the chasm, exit zone | builder | T09 | Contract (island table row 4) |

**Done when (you can check each one):**
- the recorded solution of each of the four islands ends in victory with 3 stars (a test replays all four)
- press F twice on island 1: first freezes the Rogue 2 steps and the step counter stays; second shows 'Astral Aid has already been used on this level!'
- keys 1-4 load each island; 0 console errors on all four

---
<a id="phase-4"></a>
## Phase 4 · Polish · planned
**Goal:** feels like a finished game  
**Covers:** F6  
**Needs:** 3

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T13 | title screen (CSS, Q2), island picker, `src/audio.ts` (WebAudio, M mutes), hint (H), stars, motion table, reduced motion, final checks | builder | T08, T09, T10, T11, T12 | Contract (Look, Motion, Content), Quality bar |

**Done when (you can check each one):**
- `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm test` exit 0
- 0 console errors for a full play of islands 1-4
- M mutes and unmutes; H highlights the next solution step; Esc opens the title; the win banner says 'Next Level →' (island 4: 'Play Again (Lv 1) →')
- HUD text contrast at least 4.5:1, click targets at least 40 px, usable at 390 px width
