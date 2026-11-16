---
audience: both
title: NES Player (jsnes)
status: phase 1 of 3 · planned
---
# NES Player (jsnes) · phase 1 of 3 · planned
> A good NES player in the browser: open a .nes file, play it, and keep save states in a tree: ROM first, its save states below.

> **This plan is ready to build.** Everything a builder needs is in this folder. It is a player built AROUND the open-source `jsnes` library (https://github.com/bfirsh/jsnes, npm `jsnes@2`). We do not write a new emulator.

| who reads | what | where |
|---|---|---|
| **Audience (users)** | Retro players who own ROMs, homebrew fans. | What is it, What you get, Look |
| **Stakeholders** | decide scope | Decisions and open questions |
| **Builders (dev)** | Vite + TypeScript, jsnes, IndexedDB; pnpm only | `PHASES.md`, the grey DEV block |

## What is it
You open a .nes file (drag it in or pick it). The game runs on a canvas with sound. A left panel is a **tree**: every ROM you ever opened is a branch, and its **save states** hang below it. Open another ROM and its own states show up; the earlier ROM stays in the tree with its states under its own name. States live in the browser; any state can be exported as a file and imported again (also on another computer).

**For:** people who want a clean, no-install NES player with real save states.

## What you get (feature catalog)
| id | feature | what you see or do | phase | status |
|---|---|---|---|---|
| F1 | Open a ROM | drag a .nes file in or use *Open*; header is checked, a broken or unsupported file gives a clear message | [2](PHASES.md) | planned |
| F2 | Play with sound | 256x240 canvas scaled sharp (integer scale or fit), audio on first click, mute and volume | [2](PHASES.md) | planned |
| F3 | Pause, reset, power cycle | buttons and keys | [2](PHASES.md) | planned |
| F4 | Speed control | 0.25x, 0.5x, 1x, 2x, 4x; a hold-to-fast-forward key; audio only at 1x | [2](PHASES.md) | planned |
| F5 | Controller options | keyboard map per player (P1, P2), click-to-rebind, gamepad detected and mapped, turbo A and B, reset-to-defaults; saved locally | [2](PHASES.md) | planned |
| F6 | Save state | quick save (key) or *Save* with a name; a thumbnail of the screen is stored with it | [3](PHASES.md) | planned |
| F7 | Load state | click a state in the tree, or quick load (key); the game continues exactly there | [3](PHASES.md) | planned |
| F8 | **Tree of ROMs and states** | ROM branches, states below, newest first; rename, delete, expand or collapse; the ROM now playing is marked; the earlier ROMs stay with their states | [3](PHASES.md) | planned |
| F9 | Export and import a state | *Export* downloads one `.nesstate.json` file; *Import* adds it under the matching ROM (by ROM hash) | [3](PHASES.md) | planned |
| F10 | Battery save (SRAM) | games with a battery keep their in-game save between visits | [3](PHASES.md) | planned |
| F11 | Screenshot | download the current frame as PNG | [2](PHASES.md) | planned |
| F12 | Status line | ROM name, mapper, FPS, errors from the emulator (a crash does not freeze the page: shown, with *Reset*) | [2](PHASES.md) | planned |

## How the tree works (the key feature)
- A ROM is known by the **SHA-256 of its bytes**, not by its file name. Same file under a new name = same branch. The shown name is the file name (renamable).
- Each state is saved under its ROM hash with: id, name, time, thumbnail, jsnes version, the state itself.
- **Opening another ROM never deletes or hides anything.** The tree shows every ROM; the one playing is open, the others stay collapsed with their own states.
- A state of a ROM that is not currently loaded is listed (greyed, "open this ROM to load"). Clicking it asks for that ROM file; if the file's hash matches, the state loads.
- **Import:** the exported file carries the ROM hash and name. It is added under that ROM's branch (a new greyed branch if the ROM was never opened here). A file that is not a state, or from an incompatible jsnes version, is refused with a message and nothing is stored.
- **Export:** one state = one file `<rom name>_<state name>.nesstate.json`: `{ format: 1, jsnes, romHash, romName, name, createdAt, thumbnail, state }`.

## Look and feel
- Dark, calm, retro-modern: the game is the hero. Left: the tree (collapsible). Centre: the screen. Right or bottom: a slim toolbar (open, pause, reset, speed, volume, screenshot, controls).
- Pixel-sharp canvas (no blur). Keyboard help shown once in a small overlay.
- Phone layout is a non-goal (keyboard and gamepad first).

## Real or guessed
**Real:** `jsnes` features from its README: `NES` class (`loadROM`, `frame`, `buttonDown/Up`, `reset`, `toJSON`, `fromJSON` which THROWS on an incompatible version, `onBatteryRamWrite`), `Browser` helper (canvas, audio, keyboard, gamepad, frame timing), turbo buttons, 2 players, Zapper, many mappers, passes all 134 AccuracyCoin tests. **Our design:** the tree, hashing, export format, speed control and the rest.
**ROMs are not in this repo.** Build and check with a free homebrew or test ROM that the owner supplies (for example a licence-free homebrew .nes).

## Decisions and open questions
| id | what | answer / default | state |
|---|---|---|---|
| D-01 | Own emulator? | no: use jsnes@2 from npm (`pnpm add jsnes`) | agreed |
| D-02 | Where are states kept? | IndexedDB (states are big), controls in localStorage | agreed |
| D-03 | Use jsnes `Browser` or the `NES` class? | `NES` class with our own loop: needed for speed control, tree and states; reuse jsnes's keyboard and gamepad ideas | default |
| Q1 | Which ROM for the checks? | owner supplies a free homebrew or test .nes | open |
| Q2 | Rewind and cheats? | later, not in this plan | open |

## Phases at a glance
**1. Setup** (planned), **2. Player** (planned), **3. States and tree** (planned) → [full phase page](PHASES.md)

## Share and change
- **Share:** *Copy link* in the plan viewer. **Change:** *Ask Claude* on the page; Claude edits this file and the phase page.
- Status words: planning · planned (**nothing built yet**) · in progress · review · done.

<!-- dev -->
Stack: Vite + TypeScript, `jsnes@2` (pnpm only, never npm), IndexedDB (plain wrapper, no extra library), `crypto.subtle.digest("SHA-256")` for ROM hash. No backend, no key.

Layout, no file owned twice:
- `src/emu/` (builder A): `core.ts` wraps `new NES({onFrame,onAudioSample,onBatteryRamWrite})`, own `requestAnimationFrame` loop with a speed factor (run N frames per tick; audio ring buffer in an AudioWorklet or ScriptProcessor, silent when speed is not 1x), `rom.ts` (read file, check `NES\x1a` header, hash), `input.ts` (keymap, gamepad, turbo), `screen.ts` (canvas, integer scale, PNG).
- `src/store/` (builder B): `db.ts` (IndexedDB: `roms` {hash,name,lastOpened}, `states` {id,romHash,name,createdAt,thumb,jsnes,data}, `sram` {romHash,data}), `states.ts` (save, load, rename, delete, export, import with validation), `format.ts` (the export file type and checks).
- `src/ui/` (builder C): `tree.ts`, `toolbar.ts`, `controls_dialog.ts`, `app.ts` (wires A and B), `style.css`.
- Test hook: `window.__nes = { frameHash(), listStates(), runFrames(n) }` so checks need no human eye. `frameHash()` = hash of the last 256x240 framebuffer.
- `toJSON()` output is large: store it as is (structured clone) or compressed (CompressionStream), the choice stays inside `states.ts`.
- README of the BUILT app stays under 12 KB.
<!-- /dev -->
