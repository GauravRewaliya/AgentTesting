---
audience: both
title: Research Visualization (quantum error correction) phases
status: phase 1 of 3 · planned
---
# Phases · Research Visualization (quantum error correction)
> phase 1 of 3 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts. Every task reads `README.md` (Contract) and `build_inputs/01_look_3d_content.md`, plus the files named in `reads`. Built in `run_test/research-visualization/`, pnpm only, about 15-30 min per task.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Page and story](#phase-1) | the readable page, all text, header and menu, no 3D yet | **planned** | F1, F2, F7 | - |
| 2 | [3D and diagrams](#phase-2) | the two 3D scenes and three interactive diagrams, wired in | **planned** | F3, F4, F5, F6 | 1 |
| 3 | [Verify](#phase-3) | builds and behaves, contrast and phone width checked | **planned** | all | 2 |

## Next up
**Page and story** (planned): scaffold, header and menu, hero text, the six sections and author cards.

---
<a id="phase-1"></a>
## Phase 1 · Page and story · planned
**Goal:** the readable page, all text, header and menu, no 3D yet  
**Covers:** F1, F2, F7  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | scaffold: `package.json` (pinned), `vite.config.ts`, `tsconfig.json`, `index.html` (Tailwind config, fonts, title), `index.tsx`, `index.css` (keyframes, reduced motion); `pnpm install` | builder | - | README Build recipe, build_inputs *Scaffold files* |
| T02 | `App.tsx` part 1: nav (scroll state, desktop links, 'View Paper'), mobile overlay menu, `scrollToSection` with 100 px offset, hero text and 'DISCOVER' cue (no scene yet) | builder | T01 | build_inputs *Content*, Behaviour B1-B4 |
| T03 | `App.tsx` part 2: sections Introduction, The Surface Code, Neural Decoding, Outperforming, Towards Fault Tolerance (text and empty layout boxes of the right size, no placeholder wording), footer | builder | T02 | build_inputs *Look*, *Content* |
| T04 | `App.tsx` part 3: `AuthorCard` and the six authors with 0.1 s stagger, closing line | builder | T03 | build_inputs *Content* item 6 |

**Done when (you can check each one):**
- `pnpm exec tsc --noEmit` and `pnpm build` exit 0; console has 0 errors
- at 1280 px the six section titles and all texts match *Content*; scrolling 60 px gives the cream blurred header
- at 390 px: `scrollWidth <= 390`; the menu button opens the overlay and 'Authors' scrolls so the title is 100 px (+/- 8) below the top
- six author cards appear one after another (0.1 s apart); text contrast at least 4.5:1 (gold text on light is `#8A6A2C`)

---
<a id="phase-2"></a>
## Phase 2 · 3D and diagrams · planned
**Goal:** the two 3D scenes and three interactive diagrams, wired in  
**Covers:** F3, F4, F5, F6  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T05 | `components/QuantumScene.tsx`: `QuantumParticle`, `MacroscopicWave`, `HeroScene` with the exact numbers; error boundary around the Canvas | builder | T04 | build_inputs *3D scenes* |
| T06 | same file: `QuantumComputerScene` (3 gold plates, 6 rods, 2 copper rings, chip) | builder | T05 | build_inputs *3D scenes* |
| T07 | `components/Diagrams.tsx`: `SurfaceCodeDiagram` (5 qubits, 4 checks, parity rule, caption, legend) | builder | T04 | Contract B5-B7 and data shapes |
| T08 | same file: `TransformerDecoderDiagram` (2 s step loop, stable dots, progress dots) | builder | T07 | Contract B8, build_inputs *Content* item 3 |
| T09 | same file: `PerformanceMetricDiagram` (distance buttons, spring bars, label format) | builder | T08 | Contract B9-B10, data table |
| T10 | wire all five into `App.tsx`: hero behind text, diagrams in their sections, scene in the Impact box; reduced-motion handling | builder | T06, T09 | Contract, Motion table |

**Done when (you can check each one):**
- click the centre qubit: all 4 checks light, caption 'Detected 4 parity violations.'; click again: 'System is stable.'
- click top-left qubit alone: top Z check and left X check light (2 violations)
- decoder passes through all 4 steps in 8 s, dots do not flicker
- Distance 11 shows '0.0041%' / '0.0009%'; Distance 3 shows '3.50%' / '2.90%'
- both 3D scenes visible, 0 console errors, 30 fps or more while scrolling; with the network off the page still works (no uncaught error)

---
<a id="phase-3"></a>
## Phase 3 · Verify · planned
**Goal:** builds and behaves, contrast and phone width checked  
**Covers:** all  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T11 | install, type-check, build, then run the 10 steps of the README *Test plan* in a real browser at 1280 and 390 px; write pass/fail with the measured numbers | lead | T10 | README Test plan, Quality bar |

**Done when (you can check each one):**
- `pnpm exec tsc --noEmit` and `pnpm build` exit 0
- all 10 test-plan steps pass; 0 console errors; every text 4.5:1 or more; tap targets 40 px or more
- `grep -rE "npm |npx |yarn|genai|api_key" run_test/research-visualization --exclude-dir=node_modules` finds nothing; no `.env` file
- the report lists every difference from the plan
