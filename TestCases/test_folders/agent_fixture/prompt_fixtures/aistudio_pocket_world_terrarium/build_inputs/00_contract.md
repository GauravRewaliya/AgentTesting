---
audience: dev
title: Pocket World Terrarium build contract
status: planned
---
# Build contract · Pocket World Terrarium
> Everything a builder agrees on: stack, file tree with one owner per task, behaviour rules, data shapes, requirements, code flow, test plan, lessons. Tasks that use each part are named in `PHASES.md`.

## Build prompt
**Goal.** Build 'Pocket World Terrarium', a single-page 3D toy for a desktop or phone browser: a faceted low-poly planet (radius 0.75) inside a glass orb (radius 1.5) on a walnut stand in a cosy room. The player picks one of 24 tools and clicks the planet. Offline, no AI. For a relaxed audience of any age.

**Stack.** As in Build recipe step 3. `vite.config.ts`: plugins `react()` and `tailwindcss()`, alias `@` to the project root, `build.chunkSizeWarningLimit: 1600`, dev server `vite --port=3000 --host=0.0.0.0`. Scripts: `dev`, `build` (`vite build`), `preview`, `lint` (`tsc --noEmit`). `tsconfig`: target ES2022, module ESNext, bundler resolution, `jsx: react-jsx`, `noEmit`, `isolatedModules`, `allowImportingTsExtensions`, `paths @/* -> ./*`. `index.html`: title 'Pocket World // Terrarium Planet', body classes `bg-[#1e1b26] overflow-hidden antialiased`, Google Fonts link for Fraunces (500, 600, italic 400), Plus Jakarta Sans (400, 500, 600), JetBrains Mono (400, 500).

**File tree** (planned; owner in the table below)
```
index.html  vite.config.ts  tsconfig.json  package.json  .gitignore (node_modules, dist)
src/main.tsx                    StrictMode + App
src/index.css                   @import "tailwindcss"; font variables; .no-scrollbar; user-select none
src/types/world.ts              ToolId, ToolCategory, CameraViewId, TimeMode, WorldState, TOOL_DEFINITIONS
src/App.tsx                     tool rail, bottom dock, Filters panel, tooltip, WebGL-lost message
src/three/PocketWorldScene.ts   PocketWorldController: renderer, lights, input, camera, day cycle, Grow, tour, stats
src/three/PlanetTerrain.ts      createPlanetTerrain(): icosphere terrain, water, sculpt, rain and snow
src/three/MiniatureObjects.ts   one builder function per object (house, windmill, ... villager, sheep, cloud)
src/three/RoomEnvironment.ts    createRoomEnvironment(): sill, linen, succulent, walnut stand, brass collar, glass orb
src/utils/textures.ts           canvas textures: walnut, linen, chalky sill, room environment map
src/ai/provider.ts (phase 4)    mockProvider: seeded pick of name and story; one seam
```

**Behaviour (each rule is a test)**
| rule | trigger | result | numbers |
|---|---|---|---|
| B1 | click (not drag) on the planet with a placing tool | that object appears at the click point, standing on the surface | click = press and release with under 5 px movement |
| B2 | press, move over 5 px | planet spins with inertia instead of placing | spin speed = pixel move x 0.0055 |
| B3 | wheel over the view (not in tour) | camera moves nearer or farther along its line | distance += deltaY x 0.0022, clamped 1.15 to 5.6 |
| B4 | tool `raise` / `lower` | terrain facets near the click rise or sink, objects re-sit on the ground, sparkles | radius 0.25 / 0.26, step +0.026 / -0.028 |
| B5 | tool `mountain` / `lake` | bigger bump or basin; lake goes below sea level | radius 0.32 / 0.34, step +0.068 / -0.062 |
| B6 | any sculpt | surface radius is clamped | min 0.65, max 0.94 (sea level 0.738) |
| B7 | tool `remove` | nearest removable object within reach disappears (pink sparkles); then sailboats, ducks, balloons, clouds are checked | reach 0.16 for objects, 0.18 for sailboats |
| B8 | tool `tree` | oak on grass, palm on a beach, pine on a mountain | by surface type |
| B9 | water-only tools (`sailboat`, `duck`) | placed only on water | guessed from tool texts: not checked in code |
| B10 | button Grow | trees get bigger and bounce, a new cottage + path + 2 villagers appear near the well, 2 trees and 1 flower cluster on open land, day +1 | growth +0.18 up to 1.42; 28 tries for a free spot 0.19 to 0.45 from the well |
| B11 | timeMode `auto` | time of day advances; when it wraps past 1, day +1 | +0.014 per second (71 s a day) |
| B12 | timeMode Day / Twilight / Night | time jumps and stays | 0.22 / 0.52 / 0.78 |
| B13 | light blend by time t | day 1.0 until 0.38; to twilight at 0.54; to night at 0.68; night until 0.88; back to day at 1.0 | sun orbit radius 1.24 inside the orb, moon opposite |
| B14 | after any change | population = number of villagers; happiness = min(100, round(78 + 2 houses + 0.6 trees + 1.2 (flowers + beehives) + 3 windmills + 2 (lighthouses + watchtowers) + 4 rainbows + 2 campfires + 1.5 (sailboats + ducks))) | counts updated immediately |
| B15 | button 30s Tour | scripted tour, rail hidden, input ignored, ends by itself or on Esc / a view button, objects the tour added are removed | exactly 30.0 s wall clock |
| B16 | load | one 3 s intro spin, stops early if the user drags | then camera zooms out a bit |
| B17 | Esc | closes the Filters panel and tooltip; stops the tour | n/a |
| B18 | WebGL context lost | overlay 'Terrarium Viewport Paused' (text below); restored event removes it | n/a |

**Data and state shapes** (copy `src/types/world.ts`)
- `ToolId` (24): tree, house, windmill, lighthouse, mountain, lake, flower, cloud, villager, sheep, raise, lower, remove, sailboat, dock, duck, campfire, balloon, watchtower, beehive, lantern, rainbow, snowcloud, shootingstar.
- `ToolCategory`: all, village, water, nature, weather, sculpt (the rail uses the five without `all`). `CameraViewId`: orb | surface | orbit | village. `TimeMode`: auto | day | twilight | night.
- `WorldState`: planetName, population, happiness, dayCount, activeTool, activeView, timeMode, timeOfDay (0..1), tourActive, tourElapsed, tourPhase, objectCounts {houses, trees, windmills, lighthouses, villagers, sheep, clouds, flowers, boats}.
- `ToolDefinition`: id, label, category, accentBg, accentBorder, accentText (Tailwind arbitrary colours), description.
- Start state: planet 'Little Meadow', tool `tree`, view `orb`, mode `auto`, timeOfDay 0.24, day 1. Population, happiness and counts shown at start come from the first stats sync of the starting world (the reference code puts placeholder numbers 12 / 96 in React state, then overwrites them; the starting world has a well, about 10 houses in 4 neighbourhoods, a windmill, a lighthouse, a fenced sheep pasture, oaks, pines, palms, flowers, campfires, beehives, lanterns, a watchtower, a dock).
- Controller API used by the UI: `new PocketWorldController(container, setState)`, `setTool`, `setTimeMode`, `setTimeOfDayManual`, `applyCameraPreset`, `triggerGrowVillage`, `startTour`, `stopTour`, `dispose`.

**Look (numbers)**
- Renderer: antialias, pixel ratio `min(devicePixelRatio, 2)`, PCF soft shadows, ACES filmic tone mapping, exposure 1.08. Camera: perspective fov 38, near 0.08, far 60. Frame delta capped at 0.05 s.
- Lights: ambient `#f2e6dc` 0.55; hemisphere `#dcd0f0` over `#5e4b3e` 0.52; window sun directional `#ffdfb8` 1.35 at (-4.8, 4.6, 3.8), shadow map 2048, shadow box 3.2.
- Camera views (position / look-at): orb (-1.12, 0.78, 4.35) / (0.08, -0.22, 0); surface (0.62, 0.22, 1.44) / (-0.12, 0.24, 0.62); orbit (0, 0.32, 2.58) / (0, 0, 0); village (-0.26, 0.34, 1.42) / (-0.16, 0.18, 0.74). Orb fills about 60% of the height.
- Terrain: icosphere detail 4, base radius 0.75, sea level 0.738, flat-shaded facets with a little jitter. Sun: core `#fff5b8`, 12 rays `#ffd45c` / `#ffae36`. Cursor ring `#fff8d6`, radius 0.028 to 0.036. 38 fireflies at dusk and night.
- UI sizes: rail 64 px wide; tool and Filters buttons 44 px, radius 12 px; icons 16 px; cards radius 16 px; tooltip max 244 px wide on `#2b231d` at 95%; panel title 14 px semibold; planet name 18 px semibold (Fraunces); stats 12 px mono tabular; section labels 11 px uppercase; Grow and Tour buttons 12 px semibold, padding 10 px 12 px. Colours as in Look and feel (above).

**Content (real texts)**
- Rail groups in order: Village & Landmarks (house, windmill, lighthouse, watchtower, campfire, lantern, balloon); Water & Coastal Life (sailboat, dock, duck); Nature & Life (tree, flower, beehive, villager, sheep); Weather & Sky (cloud, snowcloud, rainbow, shootingstar); Sculpt & Clear (mountain, lake, raise, lower, remove).
- The 24 tools (id, label, group, icon, colours, tooltip text) are in [tools.md](../tools.md); copy them exactly. Rail groups in order: Village & Landmarks (7 tools), Water & Coastal Life (3), Nature & Life (5), Weather & Sky (4), Sculpt & Clear (5).
- Filters panel: title 'Filters'; planet name (click to rename, pencil icon, tooltip 'Click to rename planet'); 'Pop n', 'Happy n%', 'Day n'; object counts; buttons 'Grow' (tooltip 'Advance village development with new homes, paths, and trees') and '30s Tour'; 'Camera View' with Orb, Surface, Orbit, Village; lighting buttons Cycle, Day, Twilight, Night. Rail top button 'Filters & World Controls' ('Planet stats, Grow, 30s Tour, camera views & lighting'). Desktop: centred modal (max width 24 rem, max height 85vh); phone: bottom sheet (max height 80vh, top radius 24 px, grab bar 40x6 px).
- Tour acts (the first `tourPhase` label is 'Act I: Full Globe Orbit'): full script with seconds in [extras.md](../extras.md).
- WebGL lost: 'Terrarium Viewport Paused' / 'The 3D WebGL context was interrupted. Reload or restore the tab to resume inspecting <planet name>.'

**Edge cases and error states**
- Click while dragging, during the tour, or off the planet: nothing is placed. Remove with nothing near: nothing happens (no error).
- Grow with no free spot after 28 tries: skips the house, still grows trees and adds the plants.
- Sculpt past the limits: clamped (B6). Resize: renderer and camera aspect update. Unmount: `dispose()` removes listeners and the render loop (React StrictMode mounts twice: no double canvas).
- No network: fonts fall back; nothing else changes. WebGL lost: B18.
- Phase 4 only: the mock never fails (no network); if the seed list is empty show the fixed name and story below.

**Mock story (phase 4, optional; NOT in the reference, all guessed).** Full spec in [extras.md](../extras.md): `src/ai/provider.ts` with `mockProvider`, reply shape `{name, story}`, picked from a bundled list by a seed made from the object counts (same input, same output). No AI, no key, no network.

**Out of scope.** Saving or loading a world, multiplayer, audio (none found in the reference), account, a map editor, more than 24 tools, translations, a new camera system.

**Done-when (checkable)**
1. `pnpm install`, `pnpm exec tsc --noEmit` exit 0; `pnpm build` exit 0.
2. `pnpm dev`, open `http://localhost:3000`: planet in the orb, 3 s intro spin, console 0 errors.
3. Click each of the 24 tools once on grass or water as suited: a visible change each time (sculpt tools change the ground, remove deletes one object).
4. Click the four views: the camera glides and ends at the positions above (within 0.05).
5. Day / Twilight / Night buttons: the scene is visibly warm / blue / dark; Cycle moves on its own (about 71 s a day).
6. Place 3 houses: 'Happy' rises by 6 or more until the cap of 100. Grow adds a cottage and day +1.
7. 30s Tour runs 30 s and returns to Orb; Esc stops it early.
8. fps at 200 extra objects: 55 or more average (note the machine).
9. 390 px wide: bottom dock shows, no horizontal scroll, Filters opens as a sheet.

## Requirements (EARS)
| id | requirement | source |
|---|---|---|
| R1 | When the user clicks the planet (movement under 5 px) with a placing tool, the app shall place that object at the point. | real |
| R2 | When the user drags more than 5 px, the app shall spin the planet and shall not place anything. | real |
| R3 | While the tool is raise, lower, mountain or lake, a click shall change the terrain with the brush numbers in B4/B5, clamped to 0.65 - 0.94. | real |
| R4 | When the tool is remove and an object is within 0.16 of the click, the app shall delete it. | real |
| R5 | The app shall offer 24 tools in 5 groups, each with a label, tooltip and icon. | real |
| R6 | When a camera view button is pressed, the camera shall glide to that preset. | real |
| R7 | While the time mode is auto, the time of day shall advance by 0.014 per second and the day count shall rise each wrap. | real |
| R8 | When Day, Twilight or Night is chosen, the time shall be set to 0.22, 0.52 or 0.78 and held. | real |
| R9 | The app shall compute happiness with the formula in B14, capped at 100, and population as the villager count. | real |
| R10 | When Grow is pressed, the app shall mature trees, add a cottage, path and 2 villagers if a spot is found, add 2 trees and 1 flower cluster, and add 1 to the day. | real |
| R11 | When 30s Tour is pressed, the app shall run a scripted 30 s film with the rail hidden and shall stop on Esc. | real |
| R12 | If WebGL is lost, the app shall show the pause message. | real |
| R13 | The planet name shall be editable. | real |
| R14 | Where the user prefers reduced motion, the app shall skip the intro spin and the tour. | guessed |
| R15 | Where the mock story is built, the same world (same object counts) shall always give the same name and story, with no network call. | guessed |

## Data model
No database and no storage: all state is in memory (`WorldState` plus lists inside the controller: placed objects, villagers, sheep, sailboats, ducks, clouds). A reload resets the world. Mock story: reply shape above; nothing saved.

## Code flow (dev)
- `main.tsx` mounts `App`; `App` creates `PocketWorldController(container, setWorldState)` in an effect and calls `dispose()` on cleanup.
- UI to scene: only through the controller methods listed above. Scene to UI: the controller calls `onStateChange(prev => next)` after tool, view, time, stats and tour changes; stats are recomputed by `syncWorldStats()`.
- Loop: `requestAnimationFrame` with dt capped at 0.05: time of day, tour, intro spin, camera easing, light blend, sun and moon, villagers, sheep, boats, clouds, sparkles.
- Input: pointer events on the canvas (down, move on window, up), wheel, Esc key, ResizeObserver.
- Tools never create files; `MiniatureObjects.ts` exports builder functions that return a `THREE.Group`.
- Check: `pnpm exec tsc --noEmit` and `pnpm build`, then the browser steps.

## Packages and owners (no file owned twice)
| package | owner | owns | tasks |
|---|---|---|---|
| setup | builder | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/index.css`, `.gitignore`, `src/types/world.ts` | T01 |
| room | builder | `src/three/RoomEnvironment.ts`, `src/utils/textures.ts` | T02 |
| terrain | builder | `src/three/PlanetTerrain.ts` | T03 |
| scene | builder | `src/three/PocketWorldScene.ts` | T04, T05, T06, T08, T09, T10 |
| objects | builder | `src/three/MiniatureObjects.ts` | T05, T06, T09 |
| ui | builder | `src/App.tsx` | T07 (rail, Filters), T11 (story button) |
| ai-mock | builder | `src/ai/provider.ts` | T11 |

`PocketWorldScene.ts` is the largest file (about 3,900 lines in the reference). If it passes 1,200 lines, split it into `scene/*.ts` and update this table; one owner per file still holds.

## Test plan
| task | steps (human-style) | pass when |
|---|---|---|
| T01 | `pnpm install`, `pnpm exec tsc --noEmit`, `pnpm build` | both exit 0; only pnpm used (no `package-lock.json`) |
| T02 | `pnpm dev`, open the page | room, glass orb, stand, plant visible; console 0 errors |
| T04 | drag on the planet; wheel up and down | planet spins; zoom stops at 1.15 and 5.6 |
| T05-T07 | click each of the 24 rail buttons, then click the planet | each makes a visible change; no grey box |
| T06 | click raise 3 times in one spot | ground there is visibly higher; objects on it sit on the ground |
| T05 | click remove on a placed object | it disappears; Pop or counts update |
| T07 | click the 4 view buttons | camera glides, ends at the preset |
| T08 | press Day, Twilight, Night, Cycle | warm, blue, dark; Cycle changes by itself (about 71 s a day) |
| T09 | place 3 houses; press Grow | Happy rises; Grow adds a cottage and day +1 |
| T10 | press 30s Tour; press Esc at 10 s | tour plays and stops; rail returns |
| T10 | add 200 objects (repeat clicks), watch fps counter for 10 s | 55 fps or more average |
| T11 | press the story button twice in the same world | the same name and story both times, no network request; game still works |
| T11 | change the world (place objects), press it | name of 3 words or fewer and a story of 60 words or fewer |
| all | resize to 390 px wide; Tab through the rail | bottom dock, no horizontal scroll; focus ring visible; every button announced |

## Lessons and risks
- Raycasting a faceted, sculpted planet is easy to get wrong: place on the hit point, not on the sphere radius, and re-sit all objects after sculpting.
- React StrictMode runs effects twice: dispose the controller and listeners or two canvases appear.
- Heavy shadows (2048 map) plus 200 objects can drop fps on a phone: cap pixel ratio at 2 and merge small meshes if needed.
- A grey placeholder for a hard object (watchtower, balloon) passes a quick look but fails the 'no placeholder' rule.
- Do not claim 60 fps without measuring; the reference never published a measurement.
- No AI: all text for the story comes from `mockProvider`; no key, no `.env`, no network call.
