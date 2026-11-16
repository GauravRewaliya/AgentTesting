---
audience: both
title: NES Player (jsnes) phases
status: phase 1 of 3 · planned
---
# Phases · NES Player (jsnes)
> phase 1 of 3 · planned · [overview](README.md) · status words: planning · planned (**nothing built yet**) · in progress · review · done

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [Setup](#phase-1) | project builds, jsnes installed, ROM supplied | **planned** | - | - |
| 2 | [Player](#phase-2) | open, play, speed, controls | **planned** | F1-F5, F11, F12 | 1 |
| 3 | [States and tree](#phase-3) | save, load, tree, export, import, SRAM | **planned** | F6-F10 | 2 |

## Next up
**Setup:** Vite + TypeScript app, `pnpm add jsnes@2`, a free homebrew or test ROM from the owner placed OUTSIDE the repo (path given in `.env.local`-style config or chosen in the file picker).

---
<a id="phase-1"></a>
## Phase 1 · Setup · planned
| task | what | owner | needs |
|---|---|---|---|
| T00 | scaffold, install jsnes with pnpm, check the owner's ROM header | builder A | - |

**Done when:**
- `pnpm install && pnpm build` passes and `tsc --noEmit` is clean
- `window.__nes.frameHash()` exists and returns a value after a ROM runs 60 frames

---
<a id="phase-2"></a>
## Phase 2 · Player · planned
| task | what | owner | needs |
|---|---|---|---|
| T01 | `src/emu/*`: ROM load and hash, loop, speed, audio, input, screenshot | builder A | P1 |
| T02 | `src/ui/` shell: toolbar, screen, controls dialog, status line | builder C | P1 |

**Done when (no human eye needed):**
- an invalid file is refused with a message and the page keeps running
- running 600 frames gives a framebuffer hash that is NOT blank, and the same ROM + same frame count gives the same hash twice
- at speed 4x, `runFrames` for one second advances about 4x the frames of 1x (frame counter)
- a remapped key changes which button `buttonDown` is called with, and the map is still there after reload
- 0 console errors; a forced emulator error shows in the status line, *Reset* recovers

---
<a id="phase-3"></a>
## Phase 3 · States and tree · planned
| task | what | owner | needs |
|---|---|---|---|
| T03 | `src/store/*`: IndexedDB, save and load, rename, delete, export, import, SRAM | builder B | P2 |
| T04 | `src/ui/tree.ts` and wiring in `app.ts` | builder C | T03 |

**Done when (no human eye needed):**
- **Round trip:** run N frames, save state S, run M more frames, load S, run the same M frames: the framebuffer hash equals the hash from the first pass
- **Export and import:** export S, delete S, import the file: S is listed again under the same ROM; load it: the hash matches again
- **Tree:** open ROM A, save 2 states; open ROM B, save 1 state: the tree lists A with 2 and B with 1; A's states are still listed (and loadable after reopening A) after switching to B
- the same ROM file under another file name lands in the same branch (same hash)
- import of a non-state file or a state from another jsnes version is refused, nothing is stored
- a state of a ROM that is not loaded is greyed; loading it asks for the ROM and only accepts a file with the matching hash
- reload the page: ROMs, states and SRAM are still there
- the built app's README is under 12 KB; 0 console errors
