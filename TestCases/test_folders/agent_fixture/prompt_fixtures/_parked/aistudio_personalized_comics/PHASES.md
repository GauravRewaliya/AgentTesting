---
audience: both
title: Infinite Heroes (personalized comic book) phases
status: phase 1 of 3 · planned
---
# Phases · Infinite Heroes (personalized comic book)
> phase 1 of 3 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts. Every task builds in `run_test/personalized_comics/` with **pnpm only**; numbers, mock rules and copy are in the README's *Build prompt* (DEV block). **No AI, no server, no key anywhere in this plan.**

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Setup](#phase-1) | collect the cast and choices; the mock provider seam exists | **planned** | F1, F8 | - |
| 2 | [Story and pictures](#phase-2) | a readable comic appears | **planned** | F2, F3, F4, F6 | 1 |
| 3 | [Choices and PDF](#phase-3) | the story reacts; keep it | **planned** | F5, F7 | 2 |
| 4 | [Bring your own model](#phase-4) | LATER, optional: paste key + base URL to use a real model | **later (not in the current build)** | - | 3 |

## Next up
**Setup** (planned): project plumbing, form, photo upload, the mock provider seam.

---
<a id="phase-1"></a>
## Phase 1 · Setup · planned
**Goal:** collect the cast and choices; the mock provider seam exists  
**Covers:** F1, F8  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | Plumbing and setup screen: `package.json` (pinned ranges, scripts), `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `index.tsx`, `index.html` (fonts, Tailwind CDN, comic CSS), `types.ts` (constants + 9 genres, 6 tones, 15 languages), `Setup.tsx` (uploads, selects, premise, Novel mode, POW burst, footer) | builder | - | README: Build prompt (Stack, File tree, Look, Content), Behaviour B1-B5 |
| T02 | Provider seam and mock: `src/ai/provider.ts` (`generate(request)`, `mockProvider`, seeded PRNG + run seed, SVG panel -> PNG, fake delays, `?fail=` / `?failbeat=` switch) and `src/ai/templates.ts` (story templates per genre/tone, decision pools); request/response types in `types.ts` | builder | T01 | README: Mock provider, Behaviour B13-B16 |

**Done when (you can check each one):**
- `pnpm install && pnpm exec tsc --noEmit` exits 0 (T01) and `pnpm build` produces `dist/index.html` (T02); no server, no `.env`
- at `http://localhost:5173` START is disabled with no photo and enabled within 1 s of choosing one; a green 'READY' shows and the preview is 80 x 80 px
- Custom genre shows the premise box; START with it empty shows the alert and starts nothing
- a script calls `generate()` twice with the same request: both answers are identical; with another seed they differ; a beat answer has `scene`, `choices`, `focus_char`; an image answer is a PNG data URL
- `grep -ri "genai\|gemini\|api_key\|AIza" src dist package.json` finds nothing; no network request for content; 0 console errors on load

---
<a id="phase-2"></a>
## Phase 2 · Story and pictures · planned
**Goal:** a readable comic appears (written and drawn by the mock)  
**Covers:** F2, F3, F4, F6  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T03 | `App.tsx` part 1: state and refs, build the beat and image requests and call `generate()`, apply the clean-up rules, `generateSinglePage`, sidekick, beat and picture fallbacks | builder | T02 | README: Mock provider, Data shapes, Behaviour B14-B16 |
| T04 | `Book.tsx`, `Panel.tsx`, `LoadingFX.tsx`: sheets (front = page 2k, back = 2k+1), flip 0.8 s, gloss, cover spine, cover button `PRINTING... n/2`, loading words, Retry control | builder | T01 | README: Look, Motion, Behaviour B8-B9, B15 |
| T05 | Batching in `App.tsx`: `launchStory` (tone pick, cover first, 1100 ms, pages 1-2 awaited, then pages 3-5), in-flight set, `generateBatch` | builder | T03, T04 | README: Behaviour B5-B7, Code flow |

**Done when (you can check each one):**
- `pnpm exec tsc --noEmit` and `pnpm build` exit 0
- the cover button goes from `PRINTING... 0/2` to 'READ ISSUE #1' within 5 s and the book opens (no key, no network)
- pages 3-5 show the loading card or a picture while you read; no page is generated twice (a console counter shows each page once)
- every page shows the uploaded photo cropped in the panel (reviewer checks pages 2, 5, 8 by eye)
- same photo, genre and `?seed=7` twice gives identical text and identical image data; `?seed=8` differs
- with `?fail=page-4` page 4 shows Retry, not a blank page, and Retry draws it; 0 console errors

---
<a id="phase-3"></a>
## Phase 3 · Choices and PDF · planned
**Goal:** the story reacts; keep it  
**Covers:** F5, F7  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T06 | Choice on page 3: the mock's 2-3 canned choices, buttons ('What drives you?'), `handleChoice` stores the pick, batch of 6 (pages after the last made one), the pick changes the template branch, page 10 cites the pick and ends 'TO BE CONTINUED...' | builder | P2 | README: Mock provider (decision page), Behaviour B10-B11 |
| T07 | PDF export (`downloadPDF`, jsPDF, 480 x 720 pt, `Infinite-Heroes-Issue.pdf`), back cover buttons, CREATE NEW ISSUE reset | builder | P2 | README: Behaviour B12, B17 |
| T08 | Verify: install, type-check, build; walk the whole flow in a browser at 1280 and 390 px, offline; run the same-seed test; fill the README test plan table | qa-reviewer | T06, T07 | README: Test plan, Quality bar |

**Done when (you can check each one):**
- `pnpm install && pnpm exec tsc --noEmit && pnpm build` all exit 0
- page 3 shows 2 or 3 choices; after a click the buttons fade (0.5 s) and pages 6-11 appear
- two runs with different picks give a different page 10 text that names the pick
- the PDF downloads, has one page per finished face (12 when all are drawn), each 480 x 720 pt
- CREATE NEW ISSUE returns to an empty setup with both photos cleared
- at 390 px wide there is no horizontal scroll and buttons are at least 40 px tall; 0 console errors; no key, AI word or network call for content anywhere

---
<a id="phase-4"></a>
## Phase 4 · Bring your own model · LATER (not part of the current build)
**Goal:** optionally use a real model of the user's choice instead of the mock  
**Covers:** none yet  
**Needs:** 3 (and an owner go-ahead)

Idea only, no tasks yet: a settings dialog where the user pastes an **API key + base URL (+ model name)** at runtime, so any provider works, not only Gemini. The key stays in the user's browser (`localStorage`), is sent per request, and is never committed or baked into the build. It would add a `realProvider` behind the same `generate(request)` seam, using the prompts kept in [reference_prompts.md](reference_prompts.md). Open: browser-direct calls need a provider that allows CORS, otherwise a tiny pass-through proxy. See the README, *Later: Bring your own model* and question Q2.
