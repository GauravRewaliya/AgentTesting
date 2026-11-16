---
audience: both
title: Pocket World Terrarium phases
status: phase 1 of 4 · planned
---
# Phases · Pocket World Terrarium
> phase 1 of 4 · planned · [overview](README.md) · status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done

> **Planned tasks and files only: nothing exists yet.** Statuses move forward only when work really starts.

| # | phase | goal | status | covers | needs |
|---|---|---|---|---|---|
| 1 | [World](#phase-1) | a lit room with a planet in a glass orb | **planned** | F1 | - |
| 2 | [Tools](#phase-2) | place, sculpt, remove | **planned** | F2, F3, F4 | 1 |
| 3 | [Life](#phase-3) | the world feels alive | **planned** | F5, F6 | 2 |
| 4 | [Mock story (optional)](#phase-4) | name and story (seeded mock) | **planned** | F7 | 3 |

## Next up
**World** (planned): project setup and types (T01), then room, terrain and the scene skeleton.
Every task below is 15 to 30 minutes, one owner (`builder`), and lists the files it reads. Rules for all tasks: pnpm only; read README *Build recipe* and *Contract* first; no placeholder objects.

---
<a id="phase-1"></a>
## Phase 1 · World · planned
**Goal:** a lit room with a planet in a glass orb  
**Covers:** F1  
**Needs:** -

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T01 | project files: `package.json` (pinned versions), `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/index.css`, `.gitignore`, `src/types/world.ts` (types + 24 `TOOL_DEFINITIONS` from `tools.md`) | builder | - | README Build recipe + Contract (Stack, Data shapes), `tools.md` |
| T02 | `RoomEnvironment.ts` + `textures.ts`: windowsill, linen, jade succulent, walnut stand, brass collar, glass orb (radius 1.5), room env map | builder | T01 | README Look (scene, lights) |
| T03 | `PlanetTerrain.ts`: icosphere detail 4, radius 0.75, sea level 0.738, flat facets, water sphere, `sculptAtDirection` | builder | T01 | README Look (terrain), B4-B6 |
| T04 | `PocketWorldScene.ts` skeleton: renderer, camera (fov 38), lights, planet in orb, pointer drag spin, wheel zoom, 3 s intro spin, dispose; minimal `App.tsx` mount | builder | T02, T03 | README B2, B3, B16, Look (renderer, lights, views) |

**Done when (you can check each one):**
- `pnpm exec tsc --noEmit` exit 0 and `pnpm build` exit 0
- `pnpm dev`, open `localhost:3000`: planet inside the glass orb on the walnut stand, window and plant visible, console 0 errors
- the planet turns once in about 3 s on load; dragging spins it with inertia; wheel zoom stops at distance 1.15 and 5.6
- resize the window: no stretch, no blank canvas

---
<a id="phase-2"></a>
## Phase 2 · Tools · planned
**Goal:** place, sculpt, remove  
**Covers:** F2, F3, F4  
**Needs:** 1

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T05 | `MiniatureObjects.ts` batch A: well, fence, path, house (variants), windmill, lighthouse, oak / pine / palm, flower, sailboat, dock, duck, villager, sheep (static pose); placement on click and `remove` in the scene | builder | T01, T02, T03, T04 | `tools.md`, README B1, B7, B8 |
| T06 | `MiniatureObjects.ts` batch B: campfire, balloon, watchtower, beehive, lantern, rainbow, rain cloud, snow cloud, shooting star; wire `raise`, `lower`, `mountain`, `lake` sculpt with sparkles | builder | T05 | `tools.md`, README B4-B6 |
| T07 | `App.tsx`: right rail (64 px, 44 px buttons, 5 groups), bottom dock under 768 px, Filters panel (name edit, 4 view buttons), tooltip, WebGL-lost message, Esc | builder | T04 | README Look, Content, B17, B18, `tools.md` |

**Done when (you can check each one):**
- click each of the 24 tools once: a visible change each time (tools that place show a finished model, not a grey box); remove deletes one object; raise x3 lifts the ground and objects stay on it
- sculpt never goes below radius 0.65 or above 0.94 (click raise 30 times in one spot: it stops)
- click Orb, Surface, Orbit, Village: the camera glides and ends within 0.05 of the preset positions
- 390 px wide: bottom dock, no horizontal scroll; every rail button has an `aria-label` and a 44 px target; selected tool has a coloured chip
- console 0 errors during all of the above

---
<a id="phase-3"></a>
## Phase 3 · Life · planned
**Goal:** the world feels alive  
**Covers:** F5, F6  
**Needs:** 2

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T08 | day/night: time of day, light blend bands, sun and moon, fireflies, window and campfire glow, Cycle / Day / Twilight / Night buttons | builder | T05, T06, T07 | README B11-B13, Motion table |
| T09 | villagers and sheep walk (`MiniatureObjects.ts` animation, scene update); `syncWorldStats`: population, happiness (B14), counts in the panel; Grow button | builder | T05, T06, T07 | README B10, B14 |
| T10 | 30 s tour (scripted camera, rail hidden, Esc) and the fps check with 200 objects; reduced-motion skip | builder | T08, T09 | `extras.md`, README B15, Quality bar |

**Done when (you can check each one):**
- Day, Twilight, Night give a warm, a blue and a dark scene; Cycle moves by itself and a full day takes about 71 s (day count rises by 1)
- place 3 houses: 'Happy' rises by 6 or more (cap 100); 'Pop' equals the number of villagers
- Grow: a new cottage with 2 villagers appears near the well and the day count rises by 1
- 30s Tour ends by itself at 30 s (or at once on Esc) and returns to Orb; the rail comes back
- 200 extra objects: 55 fps or more average over 10 s (write the machine in the report); console 0 errors

---
<a id="phase-4"></a>
## Phase 4 · Mock story (optional) · planned
**Goal:** name and story  
**Covers:** F7  
**Needs:** 3

| task | what | owner | needs | reads |
|---|---|---|---|---|
| T11 | `src/ai/provider.ts` (`mockProvider`, seeded pick from a bundled list), story button in the Filters panel | builder | T08, T09, T10 | `extras.md` |

**Done when (you can check each one):**
- the button gives a name of 3 words or fewer and a story of 60 words or fewer; the same world always gives the same text; the network tab shows no request
- `grep -rEi "genai|GEMINI|api_key" src/ package.json` finds nothing; no `.env` file
