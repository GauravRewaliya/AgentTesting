---
audience: both
title: Wavelet (music player) phases
status: phase 1 of 4 · planned
---
# Phases · Wavelet (music player)
> phase 1 of 4 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Foundations](#phase-1) | the empty app runs and has its data, covers, tones and routes | **planned** | F3 | - |
| 2 | [Engine](#phase-2) | sound plays and the colour logic works, with no screens yet | **planned** | F1, F2, F10 | 1 |
| 3 | [Screens](#phase-3) | all screens usable with sound and colour | **planned** | F1, F4-F9 | 2 |
| 4 | [Verify](#phase-4) | the numbers promised in this plan are measured | **planned** | F11 | 3 |

## Next up
**Foundations** (planned): scaffold and tokens (T01), then four small files at once (T02).

---
<a id="phase-1"></a>
## Phase 1 · Foundations · planned
**Goal:** the empty app runs and has its data, covers, tones and routes  
**Covers:** F3  
**Needs:** -

| task | what | owner | needs |
|---|---|---|---|
| T01 | scaffold Vite + TypeScript + React, tokens in `styles.css`, 300 px | 1fr grid | builder | - |
| T02a | `data.ts` (8 playlists, 40 tracks) + `covers.ts` | builder | T01 |
| T02b | `tones.ts` (arpeggio to WAV) + `router.ts` (3 hash routes) | builder | T01 |

**Done when (you can check each one):**
- app starts with 0 console errors
- every playlist has a drawn cover
- the 3 routes open (empty pages are fine)

---
<a id="phase-2"></a>
## Phase 2 · Engine · planned
**Goal:** sound plays and the colour logic works, with no screens yet  
**Covers:** F1, F2, F10  
**Needs:** 1

| task | what | owner | needs |
|---|---|---|---|
| T03 | `player.ts`: one audio element + `useSyncExternalStore`; verbs skipToNext, skipToPrevious, seekTo, setVolume, setShuffle, setRepeat; volume in localStorage | builder | P1 |
| T04 | `color.ts` (48x48 canvas, 36 hue buckets, darken to 4.7:1) + `--page` `@property` | builder | P1 |

**Done when (you can check each one):**
- all 6 verbs have a test that passes
- W-02, W-03, W-07, W-08 hold
- text contrast is at least 4.7:1 for every playlist

---
<a id="phase-3"></a>
## Phase 3 · Screens · planned
**Goal:** all screens usable with sound and colour  
**Covers:** F1, F4-F9  
**Needs:** 2

| task | what | owner | needs |
|---|---|---|---|
| T05 | Sidebar + PlayerBar | builder | P2 |
| T06 | Home + Search | builder | P2 |
| T07 | PlaylistView + TrackTable | builder | P2 |
| T08 | NowPlaying panel | builder | P2 |

**Done when (you can check each one):**
- W-01, W-04, W-05, W-06 hold
- search for a word: matching tracks; no match shows a message
- the layout still works below 900 px

---
<a id="phase-4"></a>
## Phase 4 · Verify · planned
**Goal:** the numbers promised in this plan are measured  
**Covers:** F11  
**Needs:** 3

| task | what | owner | needs |
|---|---|---|---|
| T09 | measure contrast, fade time, test ids, brand strings | qa-reviewer | P3 |

**Done when (you can check each one):**
- contrast >= 4.7:1 on every playlist
- fade settles <= 500 ms (record the real value; the original measured 452 ms)
- test ids from the list exist
- `pnpm build` (`tsc -b && vite build`) passes
