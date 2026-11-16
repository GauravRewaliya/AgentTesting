---
audience: both
title: Image to Voxel Art phases
status: phase 1 of 3 · planned
---
# Phases · Image to Voxel Art
> phase 1 of 3 · planned · [overview](README.md) · [build prompt](BUILD_PROMPT.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts. Every task is 15-30 minutes. Built in `run_test/image-to-voxel/`, pnpm only. **No AI, no key, no network call in this build** (decision D-03): a seeded mock stands in.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Mock and image](#phase-1) | the one seam, and make or upload a picture | **planned** | F1, F2 | - |
| 2 | [Voxelize and view](#phase-2) | picture becomes a scene you can orbit | **planned** | F3, F4, F5 | 1 |
| 3 | [Download and verify](#phase-3) | save it and prove it | **planned** | F6 | 2 |

Later, not part of the current build: [Phase 4 · Bring your own model](#phase-4).

## Next up
**Mock and image** (planned): project shell first (T01), then the seeded mock seam and picture generator (T02), then the picture tile (T03).

---
<a id="phase-1"></a>
## Phase 1 · Mock and image · planned
**Goal:** the one seam `generate(request)` with a seeded mock, and make or upload a picture  
**Covers:** F1, F2  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | project shell: `package.json` (pinned ranges, scripts dev/build/preview/test), `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `index.tsx`; `pnpm install` | builder-1 | - | README Build recipe, BUILD_PROMPT Stack |
| T02 | `src/ai/provider.ts` (types, `generate`, `mockProvider`), `src/ai/rng.ts`, `src/ai/mock_image.ts`; unit tests incl. same seed same picture | builder-1 | T01 | BUILD_PROMPT The provider seam and the mock |
| T03 | `App.tsx` header, tile row, Generate tile + panel (upload zone, prompt, 5 ratios, Optimise switch), error box; calls only `generate` | builder-2 | T02 | BUILD_PROMPT Look, Content, B1-B7 |

**Done when (you can check each one):**
- `pnpm test` passes: the same request with seed 42 twice gives an identical picture; seed 43 gives a different one
- open the page: 4 tiles in a row, title 36 px black 900-weight, 0 console errors
- the panel shows exactly 5 ratios (1:1 default) and the hint text changes every 3 s
- "a dragon" gives a picture at once; reload with `?seed=7` twice gives the same picture
- upload a .png: it shows; upload a .txt: the type error shows
- `git grep -il -e genai -e gemini -e AIza -- src package.json` prints nothing; no `.env*` file and no server file

---
<a id="phase-2"></a>
## Phase 2 · Voxelize and view · planned
**Goal:** picture becomes a scene you can orbit  
**Covers:** F3, F4, F5  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T04 | `utils/html.ts`: `extractHtmlFromText`, `hideBodyText`, `zoomCamera(0.8)` | builder-2 | T03 | BUILD_PROMPT Helper rules |
| T05 | `src/ai/mock_scene.ts` + voxel branch of `mockProvider`: seeded thinking lines streamed with short delays, scene = a bundled example or a procedural page; unit tests (thought chunks first, joined HTML, same seed same output) | builder-1 | T04 | BUILD_PROMPT Mock thinking, Mock scene |
| T06 | `App.tsx`: Generate voxels, loading screen, thought headline (last `**bold**`), iframe viewer, View Scene / Image toggle | builder-2 | T05 | BUILD_PROMPT B8-B10, B12, B14, Motion |
| T07 | `public/examples/example1-3.html` copied from the reference, mock thumbnails, example click (B11), own work kept (B15) | builder-2 | T06 | BUILD_PROMPT B2, B11, B15 |

**Done when (you can check each one):**
- unit check: `camera.position.set(60, 30, 60)` becomes `camera.position.set(48, 24, 48)`; chatter around `<html>..</html>` is removed
- unit check: the voxel stream yields at least 3 thought chunks before the answer; the same seed gives the same chunks, a different seed does not
- click each of the 3 examples: scene shows in under 3 s, 0 console errors, the info text is hidden
- Generate voxels shows a headline line, then a scene in the iframe, button now reads "Regenerate voxels"
- an empty or HTML-less answer shows a red error, never a blank viewer
- all tiles and buttons are disabled while a call runs

---
<a id="phase-3"></a>
## Phase 3 · Download and verify · planned
**Goal:** save it and prove it  
**Covers:** F6  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T08 | download buttons (HTML and image) with the exact file names; reduced-motion CSS; contrast fix for hint text | builder-2 | T07 | BUILD_PROMPT B13, Motion, README Quality bar |
| T09 | production build: `pnpm build`, `dist/` has no AI leftovers; `pnpm test` green | builder-1 | T08 | BUILD_PROMPT Stack scripts |
| T10 | install, type-check, tests, build, browser sweep at 390 px and keyboard, writes pass/fail | qa-reviewer | T09 | README Test plan, Quality bar |

**Done when (you can check each one):**
- `pnpm install && pnpm exec tsc --noEmit` exits 0, `pnpm test` exits 0 and `pnpm build` exits 0 with `dist/index.html`
- `pnpm preview` serves the page; no network request except the three.js script
- Download HTML gives `voxel-scene-<digits>.html`; double-click it: the scene shows, no info text
- at 390 px no sideways scroll; every button at least 40 px tall; Tab reaches every button with a visible focus ring
- text contrast at least 4.5:1 and 0 console errors on load and on each example
- no `npm`, `npx` or `yarn` in scripts or docs; no AI package, key or `.env`

---
<a id="phase-4"></a>
## Phase 4 · Bring your own model · LATER (optional, not part of the current build)
**Idea:** a settings dialog where the user pastes an API key, a base URL and a model name at run time, so any provider works, not only Gemini. Open question Q5: build it?
What it would need:
- a dialog (key, base URL, model name) and a second provider in `src/ai/` behind the same `generate(request)`; the screen does not change
- the key kept only in the user's browser (`localStorage`), sent per request, never committed, never baked into the build
- the prompts from "Reference prompts for the later real provider" in the Build prompt, adapted to the chosen provider's request format
- a clear error for a wrong key, a blocked cross-origin call or a model that cannot read images, and a switch back to the mock
