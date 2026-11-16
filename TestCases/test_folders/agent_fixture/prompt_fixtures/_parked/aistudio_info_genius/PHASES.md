---
audience: both
title: InfoGenius phases
status: phase 1 of 3 · planned
---
# Phases · InfoGenius
> phase 1 of 3 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts. Every task is 15-30 minutes; every task reads [README.md](README.md) (Build recipe, Build prompt) first.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Shell and controls](#phase-1) | the page, the one generate seam and its choices | **planned** | F1, F2 | - |
| 2 | [Research and draw](#phase-2) | a topic becomes a (mock) sourced infographic | **planned** | F3, F4, F5 | 1 |
| 3 | [Edit, history, verify](#phase-3) | change, keep, and check the results | **planned** | F6, F7 | 2 |

## Next up
**Shell and controls** (planned): scaffold, the `generate()` seam with the seeded mock provider, intro, topic form with three selectors, dark mode.

---
<a id="phase-1"></a>
## Phase 1 · Shell and controls · planned
**Goal:** the page, the one generate seam and its choices  
**Covers:** F1, F2  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | scaffold: `package.json` (pnpm, versions from the recipe), `vite.config.ts` (port 3000, host 0.0.0.0), `tsconfig.json`, `.gitignore`, `index.html` (Tailwind CDN, 3 fonts, no importmap), `index.css` (keyframes), `index.tsx`, `types.ts` (no server, no `.env`, no AI package) | builder-1 | - | README: Build recipe, Data shapes, Look |
| T02 | `src/ai/provider.ts` (types `GenerateRequest` / `GenerateResponse`, `Provider`, `mockProvider`, the fake-delay constants, `?fast=1`) + `src/ai/mock/seed.ts` (hash32 + mulberry32) and the `fail` test input | builder-1 | T01 | README: The seam, The mock |
| T03 | `components/IntroScreen.tsx` (3 timed phases, Skip, enter button) | builder-2 | T01 | README: B1, Motion, Content |
| T04 | `App.tsx` shell: header, theme toggle, topic form, 3 selector tiles, INITIATE, empty-topic error | builder-2 | T01, T03 | README: B2-B4, B5 (form dim), Look, Content |

**Done when (you can check each one):**
- `pnpm install && pnpm exec tsc --noEmit` exit 0 and `pnpm dev` serves the page on port 3000
- `package.json` has no `@google/genai`, `express`, `tsx` or other AI/server package; no `.env*` file exists
- calling `provider.generate` twice with the same research request (console or a tiny script) returns deep-equal results after the delay; `?fast=1` makes it return at once
- intro shows the title at about 5.5 s and "Skip Intro" works at 0 s
- the 3 tiles show 4, 8 and 10 options; changing them changes the form state (React devtools or console log)
- empty topic shows "Please enter a topic to visualize." and calls nothing
- dark/light toggle flips the `dark` class on `<html>`; 0 console errors at 1280 px and 390 px

---
<a id="phase-2"></a>
## Phase 2 · Research and draw · planned
**Goal:** a topic becomes a (mock) sourced infographic  
**Covers:** F3, F4, F5  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T05 | mock generator: `src/ai/mock/facts.ts` (12 facts per level), `src/ai/mock/drawSvg.ts` (1600x900 SVG, 8 style looks, 4 level densities, XML-escaped text), research + image branches in `provider.ts`, and `services/infographicService.ts` (facts max 5, sources de-duplicated, calls only the seam) | builder-1 | T02 | README: The seam, The mock, Reference prompts (level/style texts only) |
| T06 | `components/Loading.tsx`: core rings, flying items, fact rotation 3.5 s, progress bar 30% / 50%, "Establishing connection..." | builder-2 | T01 | README: Motion, Content, B5-B6 |
| T07 | `components/Infographic.tsx` (frame, image, `PROMPT:` line) + `components/SearchResults.tsx` + `App.tsx` generate flow and error panel | builder-2 | T05, T06 | README: B6-B8, B13, Edge cases |

**Done when (you can check each one):**
- topic "photosynthesis" shows step 1 (about 2.5 s) then step 2 (about 3 s) text, then a picture and 3 source cards labelled as example links
- same topic, level, style and language twice (reload between) give identical facts, links and picture bytes; changing only the style changes the picture
- each of the 8 styles and 4 levels gives a visibly different SVG; a topic with `<`, `&`, quotes or 300+ characters still renders
- facts rotate every 3.5 s (+/- 0.3 s); at most 5 facts are ever kept
- a source with a non-http URL does not open anything; hostname label has no `www.`
- topic `fail` shows the red panel and the page stays usable
- network tab shows no request besides the app's own files; 0 console errors

---
<a id="phase-3"></a>
## Phase 3 · Edit, history, verify · planned
**Goal:** change, keep, and check the results  
**Covers:** F6, F7  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T08 | `edit` branch in `provider.ts` + `editInfographic` in `infographicService.ts` (re-seed with `seedFrom + instruction`, new colour variation, ribbon `Edit: "<text>"`) | builder-1 | P2 | README: The mock (edit) |
| T09 | `Infographic.tsx` edit bar ("Enhance"), fullscreen + zoom 50-400%, download (`infographic-<id>.svg`); `App.tsx` `handleEdit`, history grid "Session Archives", restore on click | builder-2 | T08 | README: B9-B12, Motion |
| T10 | QA: install, type-check, build, run the README Test plan T01-T10 at 1280 px and 390 px with the network off, write pass/fail | qa-reviewer | T09 | README: Test plan, Quality bar |

**Done when (you can check each one):**
- `pnpm install && pnpm exec tsc --noEmit && pnpm build` exit 0; `dist/index.html` exists
- an edit adds a second picture showing the ribbon `Edit: "<your text>"`; the grid shows exactly 1 older thumbnail; clicking it moves it first
- the same edit text on the same picture gives the same result (seeded)
- Enhance is disabled for empty text and while busy
- fullscreen zoom stops at 50% and 400%; download file is named `infographic-<id>.svg`
- `grep -ri "genai\|gemini\|api_key" src dist` finds nothing and no `.env*` file exists
- body text contrast at least 4.5:1 in both themes, tap targets at least 40 px, no horizontal scroll at 390 px, 0 console errors

---
## Later, optional (NOT part of the current build) · Bring your own model
Not a planned phase and not counted above; only if the owner decides yes (README Q3).
- **Idea:** a settings dialog where the user pastes an API key + base URL (+ model name) at runtime, so any provider works, not only Gemini.
- **Needs:** a `realProvider` behind the same `generate(request) -> response` seam (the reference prompts in the README dev block can be reused); key, URL and model kept in the browser's `localStorage` only, sent per request, never committed or baked in.
- **Done when (later):** with settings saved, a topic returns a real picture with no UI change; with no settings the mock still answers; `grep` for the key in `dist` and git finds nothing.
- **Open:** CORS for some providers (maybe a tiny proxy), and parsing each reply into `ResearchResult`.
