---
audience: dev
title: Eiffel Tower 3D build contract
status: planned
---
# Build contract · Eiffel Tower 3D
> Everything a builder agrees on: stack, file tree with one owner per task, behaviour rules, state shapes, edge cases, requirements, done-checks. The tasks that use each part are named in `PHASES.md`.

## Build prompt
**Goal.** Build 'Eiffel Tower 3D' in `run_test/eiffel-tower-3d/`: a procedural 1889 tower, a 12-stop guided tour, photo placards, EN/FR, neutral grey museum UI. No backend, no AI, no key, no network.

**Stack.** Vite (pin `vite@8.3.5`, `typescript@^7.0.2`, `@types/three@0.186.0`: the set that passed a real run; do not raise them) + plain JavaScript modules (no React), three r186 with `OrbitControls` from `three/addons/controls/OrbitControls.js`. Scripts: `dev` = `vite --port=3000 --host=0.0.0.0`, `build` = `vite build`, `preview` = `vite preview --port=3000 --host=0.0.0.0`, `lint` = `tsc --noEmit`. `vite.config.ts`: `base: './'`, `worker.format: 'es'`. `tsconfig.json`: target ES2022, module ESNext, moduleResolution bundler, allowJs, skipLibCheck, noEmit, include `vite.config.ts` only. Photos and the camera catalog live in `public/` or are imported so `pnpm build` copies them.

**File tree (planned, owner builder).**
| file | purpose | task |
|---|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `style.css` | shell and tokens; `index.html` as in section 8 of `01_look.md` | T01 |
| `startup_orchestrator.js` | `bootPipeline`: starts workers and fetches at t=0, boot veil fade | T01 |
| `pbr_worker.js` | procedural iron/stone textures off the main thread (256 and 512 px) | T02 |
| `model/materials.js`, `model/tower_controller.js` | PBR iron bank, sketch/blueprint override, tower group, render modes | T02, T03 |
| `model/zones/*.js` (4 files: piers, floor 1, floor 2, upper shaft + lantern) | tower geometry (**guessed**: a simple lattice, not a 13-file model) | T03 |
| `world/atmosphere.js` | sky, fog, lights, shadows, `auditZeroEmissive` | T04 |
| `world/paris_1889.js` | ground and surroundings | T04 |
| `camera/tour_rig.js`, `camera/hero_rig.js` | Catmull-Rom paths, look-at, drag interruption; stop 12 hero and presets | T05, T06 |
| `ui/museum_header.js`, `ui/landing_intro.js` | header (language toggle), plaque, Explore | T07 |
| `ui/walkthrough_controller.js` | stop state machine, bar, keys, holds | T07 |
| `portals/photo_portals.js` | photo placards and the 3D alignment | T08 |
| `story/stops_en.js`, `story/stops_fr.js`, `story/i18n.js` | text and language state | T09 |
| `data/photo_cameras_3d.json` | the 11 photo poses | T08 |
| `references/photos/*_320.jpg` | the 11 photos from `build_inputs/photos/` | T08 |
| `app.js` | wires everything, exposes `window.__MUSEUM_UI__` | T10 |

**Behaviour (rules).**
| rule | trigger | result | numbers |
|---|---|---|---|
| R1 tower | boot | procedural tower with 4 inclined piers, platforms at 58, 116, 276 m, lantern at 300 m, mast 312 m, base span 125 m | metres |
| R2 materials | boot | PBR iron from worker textures; sketch mode swaps to override materials; no emissive anywhere | audit = 0 |
| R3 light | boot | daytime preset from `01_look.md` section 4; shadows update once, then only on request | `autoUpdate = false` |
| R4 landing | page load with no `stop`, `photo`, `autoplay` param | tower visible behind veil, Explore button shown; Enter/Space or click starts the tour | veil 0.45 s |
| R5 tour | Explore, then Next, or play | camera flies stop to stop along a Catmull-Rom (centripetal, 0.5) helix curve that stays clear of the 4 piers and looks at the tower | hold 2.6 s / 4.0 s |
| R6 zero jump | start and end of every move | position and orientation of the first frame equal the last frame of the previous state | 0 px |
| R7 drag | pointer drag during a move | tour pauses, camera follows the user, then eases back to the stop pose | no pop |
| R8 photo | stop 1-11 | placard shows photo, label, facts, headline, caption; 3D camera matches the photo pose and fov | table 6 |
| R9 hero | stop 12 | complete tower, turntable sway, free orbit, 5 view chips (overview + 4 details) | fov 42 / 56 portrait |
| R10 language | click `#btn-lang-toggle` or `?lang=fr` | every caption, label, aria text and button flips EN/FR at once; `<html lang>` follows | instant |
| R11 keys | keyboard | Enter/Space play, Arrow Right/Left next/prev, Home/End first/last, V pure view | - |
| R12 pace | boot | zones appear in build order while the veil is up (stage 2 pacing, **guessed**: may be skipped) | - |

**State shapes.** `Stop {n, id, photoId|null, step, label{en,fr}, facts{en,fr}, headline{en,fr}, caption{en,fr}}`; `TourState {mode:'landing'|'touring'|'paused'|'finale'|'dragging', index:0..11, lang:'en'|'fr', playing:boolean}`; `Pose {position:[x,y,z], target:[x,y,z], fov}`; `PhotoCamera {photo_id, position_xyz_m, fov_y_deg}`.

**Look (tokens).** Sections 1, 2, 3 of `build_inputs/01_look.md`; neutral grey only; serif captions; no glass.

**Motion / tour timings.** Section 7 of `01_look.md`. Reduced motion: durations 0.01 ms; the tour jumps to each pose (guessed).

**The 12 stops.** Table and full EN/FR text in `02_stops_and_text.md`, sections 9 and 11 (use as is). Summary: 1 plate 55 (1884-1889 design), 2 photo 13 (caissons), 3 photo 09 (base shoes), 4 photo 51 (timber falsework), 5 photo 23 (first-floor belt), 6 photo 14 (second-stage piers), 7 photo 01 (second platform), 8 photo 46 (upper shaft), 9 photo 18 (opening 1889), 10 photo 36 (lower arch), 11 photo 38 (basin and piers), 12 no photo (3D hero).

**Content (EN/FR).** `02_stops_and_text.md` sections 10 and 11. Every visible string exists in both languages; never show an EN string while FR is chosen.

**Edge cases and errors.** WebGL missing: show 'This exhibit needs WebGL' (guessed). A photo that fails to load: show the placard text without the image, one console warning, no error. Worker blocked: generate textures on the main thread. `?stop=13` or a non-number: clamp to 1..12. Drag during a hold: pause the timer. Window resize or phone rotation: re-frame the current pose, no jump. Language toggle during a move: text flips, the move continues. Tab hidden: pause the tour.

**Out of scope.** Backend, accounts, AI, audio, VR, the debug drawer, the 5-room archive light-table, night and dusk presets, loading `.glb` files.

**Done-when (checkable).** (1) `pnpm install && pnpm exec tsc --noEmit && pnpm build` exit 0; no `@google/genai` in `package.json`. (2) `auditZeroEmissive(scene)` returns 0 offenders. (3) Tour 1-12 in a browser: 0 console errors, in EN and FR. (4) At every move start and end the camera position differs from the previous frame by under 0.001 m (a test reads the pose each frame). (5) 11 photo placards show with the right photo id; stop 12 has none. (6) Toggle: all 12 headlines change; text count with EN = text count with FR. (7) At 390 x 844 no horizontal scroll and the placard fits. (8) Computed text contrast 4.5:1 or better on caption and buttons. (9) UI colours: every computed UI chrome colour has its R, G and B channels within 8 of each other (neutral grey check). (10) With reduced motion on, no infinite animation runs.

## Requirements (EARS)
| id | requirement | source |
|---|---|---|
| RQ1 | The tower shall be built in code with 4 piers and platforms at 58, 116 and 276 m | real |
| RQ2 | The system shall use no emissive material and shall expose an audit that reports 0 | real |
| RQ3 | When the user presses Explore, the system shall start the 12-stop tour | real |
| RQ4 | While moving between stops, the camera shall follow a smooth curve clear of the piers and look at the tower | real |
| RQ5 | When a move starts or ends, the camera shall not jump | real |
| RQ6 | When the user drags during the tour, the system shall pause and then ease back smoothly | real |
| RQ7 | When stop 12 is reached, the system shall show the complete 3D tower with a turntable sway and no photo | real |
| RQ8 | At stops 1-11 the system shall show the matching photo and text | real |
| RQ9 | When the user toggles the language, every caption shall change at once | real |
| RQ10 | The UI shall use neutral grey tones only | real |
| RQ11 | The app shall make no network request to any AI service | real |
| RQ12 | Where the user prefers reduced motion, no infinite animation shall run | real (CSS), guessed (tour) |
| RQ13 | The app shall hold 60 fps on a laptop and 30 fps minimum | guessed |

## Data model
No database. Static data: the 12 stops, the 11 photo cameras, 5 hero presets. State is in memory (`TourState`). Language may be kept in `localStorage` key `et_lang` (guessed; `?lang=` is also read).

## Code flow (dev)
`index.html` -> `startup_orchestrator.bootPipeline` (workers, catalog fetch, plate 55 decode) -> `app.js` builds renderer, scene, `atmosphere`, `TowerModelController`, `paris_1889`, `PhotoPortalSystem`, camera rig -> veil fades -> landing -> Explore -> `walkthrough_controller` loops: camera move (rig) -> photo dissolve (portals) -> hold -> next. Language change -> `i18n` -> re-render placard, header and bar. Pose and audit functions are plain functions, so the no-jump and emissive checks need no UI.

## Test plan
| task | steps a person does | pass when |
|---|---|---|
| T03 tower | open the page, orbit | 4 piers and 3 platforms are visible |
| T04 light | console: `auditZeroEmissive` | 0 offenders |
| T05 paths | play stops 1-12 | no camera pop; the camera never passes through a pier |
| T07 UI | Explore, Next, Prev, Home, End | each key does what the table says |
| T08 photos | each of stops 1-11 | placard photo matches the id in the stops file |
| T09 language | toggle at stops 1, 6, 12 | all text flips |
| a11y | zoom 100%, contrast check, 390 px | text 4.5:1, targets 40 px, no horizontal scroll |
| perf | performance panel during the tour | fps number written in the report (60 target, 30 floor, guessed) |

## Lessons and risks
- Do not build a 13-zone model; it is huge. Simple lattice first, detail only if time remains.
- Add no `predev` / `prebuild` hooks that call bun or npm (pnpm only).
- Camera jumps come from mixing a user drag, a fly-to and `OrbitControls` damping in one frame: have one owner of the camera pose per mode.
- Build textures in the worker but keep a main-thread fallback.
- Shadows with `autoUpdate = false` need `needsUpdate = true` after any change.
- No vendor folder and no `three` alias are needed with pnpm.

