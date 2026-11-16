---
audience: dev
title: Clockwork Sanctum build contract
status: planned
---
# Build contract · Clockwork Sanctum
> Everything a builder agrees on: stack, file tree with one owner per task, behaviour rules, data shapes, requirements, code flow, test plan, lessons. Tasks that use each part are named in `PHASES.md`.

## Build prompt
**Goal.** Build 'Clockwork Sanctum' for puzzle players: 4 deterministic puzzle islands, one Knight, a Shadow Rogue that chases, sunbeams that shatter gargoyles. No backend, no AI model, no key, no network.

**Stack.** React 19 shell mounting `#game-canvas` and `#hud-root`; game in TypeScript modules; three.js r134; pnpm only. Scripts: `dev` = `vite --port=3000 --host=0.0.0.0`, `build` = `vite build`, `lint` = `tsc --noEmit`, `test` = node test runner (guessed: `node --experimental-strip-types --test test/*.test.ts`). `vite.config.ts`: `base: './'`, react plugin.

**File tree (planned, owner builder).**
| file | purpose | task |
|---|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` | shell; `index.html` has `<title>Clockwork Sanctum</title>`, `#canvas-container > #game-canvas`, `#hud-root`, meta description | T01 |
| `src/engine/config.ts` | grid, tile, palette, camera, hero specs, `reflectDir` | T01 |
| `src/engine/beam.ts` | pure `solveBeam` | T02 |
| `src/engine/state.ts`, `src/engine/rogue.ts` | state, actions, BFS Rogue, undo | T03 |
| `src/engine/levels.ts` | 4 levels and solutions | T04, T10-T12 |
| `src/engine/gears.ts` | row/column slide, Astral Aid | T08, T09 |
| `src/view/board.ts`, `src/view/units.ts`, `src/view/camera.ts` | three.js scene, models (simple boxes and cylinders are fine), orbit | T01, T05 |
| `src/hud/*.tsx`, `src/style.css` | HUD, title, banners | T06, T13 |
| `src/audio.ts` | WebAudio, no sound files | T13 |
| `test/beam.test.ts`, `test/levels.test.ts`, `test/smoke.test.mjs` | tests | T02, T04, T13 |

**Behaviour (rules).** Directions: 0 N (-Z), 1 E (+X), 2 S (+Z), 3 W (-X). Grid 8 x 8, tile size 2.0, board spans -7..+7 centre to centre, `gridToWorld(c,r) = ((c-3.5)*2, (r-3.5)*2)`. Beam travels at height 0.82.
| rule | trigger | result | numbers |
|---|---|---|---|
| R1 beam | emitter active | beam goes in its direction cell by cell | max 16 bounces; stops at pillar, board edge, or after 16 |
| R2 mirror | beam enters a mirror cell | even `rot` (0,2) is '/': N<->E, S<->W; odd `rot` (1,3) is '\': N<->W, S<->E | `rot` mod 4 |
| R3 shatter | beam touches a gargoyle | it shatters for good (`simultaneousBeam` false on all 4 islands) | - |
| R4 step | you move, turn a mirror, crank a gear, toggle a sluice, move the ferry, bash | `steps` +1, then the Rogue acts | every action counts |
| R5 move | click a glowing node | Knight walks up to 2 walkable tiles ('Warrior can dodge up to 2 walkable tiles per step!' otherwise) | range 2 |
| R6 mirror turn | click a mirror (range 16) | `rot` +1, beam re-traced | 1 step |
| R7 gear | click a crank | the whole row/column slides by 1 (offset in -1..1; tiles that fall off are replaced by sandstone; corner braziers never move), beam re-traced | 1 step |
| R8 Rogue | after each step | if frozen: `frozenSteps` -1, no move. Else if its tile is lit by a beam: sun-blinded, no move. Else 1 tile along the BFS shortest path to the Knight | 1 tile |
| R9 lose | Rogue on the Knight's tile (not frozen) | 'Shadow Ambush! Press [Z] to Undo your last step or [R] to Retry!' | - |
| R10 Astral Aid | key F or the Mage card, once per island | Rogue `frozenSteps` = 2; costs 0 steps; again: 'Astral Aid has already been used on this level!' | 1 charge |
| R11 win | all gargoyles gone (and the waterwheel lock on island 2) | exit unlocks; with `exitOnClear` true the win is immediate; Rogue banished; 'Sanctuary Purified! The Shadow Rogue is banished in golden light!' | - |
| R12 stars | on win | `steps <= par` 3 stars; `<= par+2` 2 stars; else 1 | par 4, 4, 4, 3 |
| R13 End Turn | button / Space | heroes' AP refill, gargoyles toggle sleep/awake, conveyors and the pendulum advance | - |
| R14 undo/reset | Z / R | Undo restores the previous snapshot; R reloads the level | Undo depth guessed unlimited |
Keys (real): Space/Enter end turn or continue; Z undo; R retry; H hint; F Astral Aid; Tab next hero; Q/E orbit; C reset camera; M mute; 1-4 pick an island; Esc title.

**State shapes (TypeScript).** `Tile {col,row,type:'sandstone'|'moss'|'channel'|'bridge'|'chasm'|'pillar'|'roller', walkable?, blocksBeam, blocksWater, hasBrazier}`; `Mirror {id,col,row,rot:0..3,movable,rotatable}`; `Emitter {id,col,row,dir,active}`; `Gargoyle {id,col,row,hp:9,defeated,sunstruck,sleeping}`; `Rogue {col,row,facing,frozenSteps,sunBlinded,banished}`; `Gear {id,axis:'row'|'col',index,offset,minOffset:-1,maxOffset:1,stepDir,knobCol,knobRow}`; `AstralAid {charges,maxCharges,freezeSteps:2}`; `GameState {levelId,steps,parSteps,victory,defeated,stars,history[]}`. `solveBeam(tiles, emitters, mirrors) -> {segments, hits, bounces}`; must be pure (no three.js, no DOM).

**Hero numbers (real).** Knight: move 2, mirror and gear range 16, armour 2, ability 'Titan Crank'. Mage: 1 charge, freeze 2 steps, ability 'Astral Aid', 'Pocket Summon [F]'. Rogue: 1 tile per step, 'Relentless Hunter', 'Stalks 1 Tile/Step · Blind w/ Sun'. Gargoyle: 9 hp, armour 3, starts asleep, 'Vulnerable to sunbeams & cliff drops'.

**The four islands (real, `x,y` = col,row).** Corners (0,0) (7,0) (7,7) (0,7) are braziers, not walkable, on all.
| id | name | Knight / Rogue start | gargoyles | emitter | mirrors | extras | par | recorded solution |
|---|---|---|---|---|---|---|---|---|
| 1 | The Sundial Courtyard | 3,6 / 5,5 | g1 3,1; g2 6,4; g3 6,5 | e1 at 2,7 facing N | m1 2,3 r0; m2 4,3 r1; m3 4,5 r0; m4 1,5 r1; m5 2,1 r1; m6 6,2 r0 | gears: row 3 (+1), column 6 (-1); exit 2,6; moss at (0,2)(0,3)(0,4)(0,6)(1,1)(1,2)(1,6)(2,0)(5,6)(5,7)(6,2)(6,6)(7,2)(7,3)(7,6) | 4 | Astral Aid, row 3 +1, column 6 -1, rotate m5, rotate m6 |
| 2 | The Waterwheel Aqueduct | 1,4 / 4,4 | g1 1,1; g2 6,6; g3 1,6 | e1 at 0,5 facing N | m0 0,3 r0; m1 3,3 r1 (water powered); m2 3,6 r1 (fixed positions) | sluice gates sg_north 3,1 and sg_east 6,3; water lock 6,5; gear row 4 (+1) slides the bridge; exit 2,7; lock must be on | 4 | Astral Aid, open both sluices, row 4 +1, rotate m2 |
| 3 | The Clockwork Bell-Hammer | 5,7 / 2,7 | g1 4,2; g2 5,6; g3 5,2 | e1 at 1,7 facing N | m1 1,6 r0; m2 3,6 r1; m3 1,1 r1; m4 5,1 r1 | pendulum over rows 3-4 (period 2 turns, hero push damage 4); bronze conveyor rollers; gears column 4 (+1), row 6 (+1); Shield-Bash; exit 2,5 | 4 | column 4 +1, row 6 +1, bash g2 at 6,6, rotate m3 |
| 4 | The Twin-Cog Sky Split | 1,6 / 4,5 | g1 3,2; g2 4,2; g3 4,6; g4 6,1 | e1 at 0,5 facing E | m1 1,5 r0 (fixed); m2 2,2 r0; m3 5,2 r1; m4 3,6 r1; m5 5,6 r1 | chasm rows 3-4 crossed by a 2 x 2 sky ferry (columns 0-6); gears row 6 (+1), row 2 (-1); exit zone (3,0)(4,0)(5,0) | 3 | row 6 +1, rotate m5, row 2 -1 |
Island 2 sluice and water numbers beyond the table (headwater cells, flow direction) are in the reference `levels.js`; the builder may simplify water to 'open both gates, slide row 4, lock turns on' and must report it. Rogue start positions are real.

**Look (tokens).** Sky `#4FA6E8`/`#8FD3FF`; sandstone `#E2AA5A` (light `#EBB96E`, bevel `#C88A3B`, mortar `#1E1108`); moss `#8FD11F`; cliff `#7D8491` / slate `#4E5768`; bronze `#8C5B24`, brass `#E5A832`; wood `#784520`; beam `#FFF9DC`/`#FFB01E`; prism `#9ADFFF`; brazier `#FFF2A6`/`#FF8818`; water `#149CE6`; highlights: move `#33F0FF`, attack `#FF5E5E`, gear `#FFB82E`, hint `#FFD94A`, exit `#FFE066`; HUD gold `#E5A93B`, outline `#261C16`, slate `#333B4C`, heart `#FF5E5E`, AP `#5CE6FF`, text `#FFF8E8`. Fonts: 'Trebuchet MS', 'Nunito', 'Segoe UI', system-ui. Camera: position (18.0, 20.2, 21.8), target (0, -1.45, 0), fov 34, near 0.25, far 180, orbit distance 16 to 38. Renderer: antialias, pixel ratio min(device, 2), soft shadows. Tile depth 0.58. Radii and HUD pixel sizes: not extracted (guessed: 12 px cards, 999 px pills). Title images: see Q2.

**Motion.** As the table above, plus in-game: Knight hops along its path, Rogue hops one tile, gargoyle shatter burst, sun flash (win 0.42 s, Astral Aid 0.26 s), camera shake on ambush (0.20 amplitude, 0.36 s). Durations of hops and shatters not extracted (guessed 0.25 s hop).

**Content (real texts).** Title: 'Clockwork Sanctum', 'Shatter Gargoyles · Outsmart the Rogue', PLAY, '4 SKY ISLANDS'. Level goals: 'Shatter all 3 Gargoyles before Rogue strikes'; 'Wash 2 Gargoyles & sun-shatter the 3rd'; 'Feed 2 Gargoyles to Pendulum & beam the 3rd'; 'Shatter all 4 Gargoyles across the Sky Chasm'. Toasts: 'Astral Aid! Mage freezes the Shadow Rogue in starlight for 2 steps!'; 'Shadow Rogue is frozen in Mage's Time-Crystal (N steps left)!'; 'Time-Crystal shattered — Shadow Rogue resumes the hunt!'; 'Sun-Blinded! The golden sunbeam dazzles the Shadow Rogue!'. Win button: 'Next Level →', on island 4 'Play Again (Lv 1) →'; picker button 'Play Island N →'. Hints: one line per recorded solution step, for example 'Click the Row 3 Brass Gear Crank at (0, 3) — slide Row 3 East!'.

**Edge cases and errors.** Island picker keys other than 1-4 do nothing. Moving onto a mirror, gargoyle, pillar, brazier, emitter or off the board is refused with the error sound (no step spent). A refused action never moves the Rogue. A Rogue with no path stays put. Win and lose block every action except Undo/Retry/Next. WebGL missing: show 'This game needs WebGL' (guessed, the reference does not). Audio starts only after the first click (browser rule).

**Out of scope.** Backend, accounts, save slots, AI model calls, multiplayer, mobile touch gestures beyond click/tap, level editor. No-key fallback: not needed, there is no key.

**Done-when (checkable).** (1) `pnpm install && pnpm exec tsc --noEmit && pnpm build && pnpm test` all exit 0. (2) Beam tests at least 8, all pass. (3) Replaying the recorded solution of each island ends in victory with 3 stars (island 1: 4 steps). (4) Browser, island 1: click mirror m5 and the beam path changes on screen; the Rogue moves exactly 1 tile after each click. (5) Astral Aid pressed twice: second press shows the 'already used' text and the step counter does not change. (6) 0 console errors across islands 1-4. (7) A lit Rogue tile skips its move in a unit test.

## Requirements (EARS)
| id | requirement | source |
|---|---|---|
| RQ1 | The board shall be 8 x 8 tiles of size 2.0 with brazier corners that are not walkable | real |
| RQ2 | When a beam enters a mirror cell the system shall reflect it by the parity of `rot` | real |
| RQ3 | The beam shall stop after 16 bounces | real |
| RQ4 | When a gargoyle is hit by a beam it shall shatter | real |
| RQ5 | When the player performs any action the system shall add 1 step and then run the Rogue | real |
| RQ6 | While the Rogue is frozen or on a lit tile it shall not move | real |
| RQ7 | When the Rogue reaches the Knight and is not frozen the system shall show the ambush message | real |
| RQ8 | When Astral Aid is used the Rogue shall freeze for 2 steps at no step cost, once per island | real |
| RQ9 | When all gargoyles are gone the system shall win and give 3, 2 or 1 stars by par | real |
| RQ10 | The player shall be able to undo, retry, hint, mute and pick island 1 to 4 | real |
| RQ11 | The engine (beam, Rogue, levels) shall not import three.js or the DOM | guessed |
| RQ12 | While the user prefers reduced motion no infinite animation shall run | guessed |

## Data model
No database. Levels are static data (table above); `GameState` lives in memory with a `history` array for undo; best stars per island may be kept in `localStorage` key `cs_stars` (guessed, the reference has no storage).

## Code flow (dev)
`main.tsx` -> `App` boots the scene -> user click picks a node or mirror -> `executeAction(action)` in `state.ts` -> `pushHistory` -> apply change (move, `rot`+1, gear slide) -> `solveBeam` re-trace -> shatter check -> `advanceRogue` (frozen, sun-blind, BFS) -> win/lose check -> notify view and HUD. Beam tracing, Rogue and levels are pure and tested without a browser.

## Test plan
| task | steps a person does | pass when |
|---|---|---|
| T02 beam | run `pnpm test` | 8+ beam cases pass in under 5 s |
| T03 turn | island 1, click a node 3 tiles away | refused with error sound; a 2-tile node works; Rogue moved exactly 1 tile |
| T08 Astral Aid | press F, then F again | first: Rogue frozen 2 steps, steps unchanged; second: 'already used' |
| T10-T12 islands | press 1, 2, 3, 4 and replay each recorded solution | victory and 3 stars each |
| T13 polish | M, H, Z, R, Esc | mute toggles, hint highlights the next solution step, undo reverts 1 step, retry resets, title opens |
| a11y | zoom 100%, run the browser's contrast check on HUD | text at least 4.5:1, targets at least 40 px |

## Lessons and risks
- Mixing the Rogue into the beam test: keep the solver pure or it cannot be unit tested.
- A gear slide moves mirrors and gargoyles with their tile: re-trace the beam after every slide, and check the Rogue is not pushed onto the Knight (the reference treats that as an ambush).
- Island 2, 3 and 4 mechanics are the bulk of the reference (about 900 KB of JS in all): size task 30 minutes at most and use simple shapes for models.
- Autoplaying audio is blocked: create the AudioContext after the first click.
- Do not copy `public/js` globals; the plan wants typed modules.
