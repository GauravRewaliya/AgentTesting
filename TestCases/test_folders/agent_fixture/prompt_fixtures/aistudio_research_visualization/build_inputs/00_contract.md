---
audience: dev
title: Research Visualization build contract
status: planned
---
# Build contract · Research Visualization
> Everything a builder agrees on: stack, file tree with one owner per task, behaviour rules, data shapes, requirements, code flow, test plan, lessons. Tasks that use each part are named in `PHASES.md`.

## Build prompt
**Goal.** Build 'Research Visualization': ONE static page that retells the AlphaQubit paper (Nature 2024) for readers. React + TypeScript + Vite, three 3D/interactive parts. No server, no AI, no router.

**Stack.** As in *Build recipe* step 3. Scaffold details (`index.html` Tailwind config, fonts, `vite.config.ts`, `tsconfig`, `index.css` keyframes) are in [build_inputs/01_look_3d_content.md](01_look_3d_content.md), section *Scaffold files*.

**File tree and owner.** See Build recipe step 4. `App.tsx` = nav, mobile menu, all sections, `AuthorCard`, footer; `components/QuantumScene.tsx` exports `HeroScene`, `QuantumComputerScene`; `components/Diagrams.tsx` exports `SurfaceCodeDiagram`, `TransformerDecoderDiagram`, `PerformanceMetricDiagram`.

**Behaviour (rules).**
| rule | trigger | result | numbers |
|---|---|---|---|
| B1 header | `window.scrollY` changes | `scrolled = scrollY > 50`; nav is transparent with `py-6`, or `bg-[#F9F8F4]/90 backdrop-blur-md shadow-sm py-4` | threshold 50 px, 0.3 s transition |
| B2 smooth scroll | click a menu link (id `introduction`, `science`, `impact`, `authors`) | prevent default, close mobile menu, scroll to `element.top + pageYOffset - 100`, smooth | offset 100 px |
| B3 logo | click logo block | smooth scroll to top | the text 'ALPHAQUBIT 2024' is hidden on phone until scrolled, always shown from 768 px |
| B4 mobile menu | click the button (icon `Menu` / `X`) | toggles a full-screen overlay (`fixed inset-0 z-40`, cream), 5 items, fade in; any link closes it | visible under 768 px only |
| B5 surface code | click a data qubit | toggle its id in `errors` | see data below |
| B6 stabilizer | `errors` change | a check is ON when an ODD number of its neighbouring qubits are in `errors` | ON = full colour, scale 110%, ring 4 px, offset 2 px; OFF = grey `bg-stone-300` at 40% |
| B7 caption | `errors` change | 0 errors: 'System is stable.'; else 'Detected N parity violations.' (N = ON checks, may be 0) | italic serif 14 px, fixed height 24 px (no jump) |
| B8 decoder | timer | `step = (step+1) % 4` | every 2000 ms; clear the interval on unmount |
| B9 chart | click Distance 3 / 5 / 11 | `distance` changes; bar heights = `value / (max(mwpm, alpha) * 1.25) * 100 %`; alpha bar at least 1% | default 5 |
| B10 value label | distance changes | `< 0.01` shows 4 decimals, else 2, plus '%' | e.g. '0.0009%' |

**Data and state shapes.**
- `errors: number[]` (data qubit ids). Data qubits (id, left, top of the 256 px box): `0` 20%/20%, `1` 80%/20%, `4` 50%/50% (centre), `2` 20%/80%, `3` 80%/80%. Checks (id, type, colour, left/top): `0` Z blue `bg-blue-500` 50%/20%; `1` X red `bg-red-500` 20%/50%; `2` X red 80%/50%; `3` Z blue 50%/80%. `adjacency = {0:[0,1], 1:[0,2], 2:[1,3], 3:[2,3], 4:[0,1,2,3]}` (qubit to checks). The source comment says '3x3, 9 qubits': the real picture has 5 qubits and 4 checks. Keep 5 and 4. Check cells 40 px, qubit buttons 32 px (raise the tap area to 40 px with padding, fix).
- `step: 0|1|2|3` decoder. `distance: 3|5|11`. `scrolled`, `menuOpen: boolean`.
- Chart data, logical error rate in %: `3: {mwpm 3.5, alpha 2.9}`, `5: {mwpm 3.6, alpha 2.75}`, `11: {mwpm 0.0041, alpha 0.0009}`. Note: bars are scaled per distance, so only the ratio inside one distance is comparable. Say so in a small caption under the chart (fix).
- Authors: Johannes Bausch, Andrew W. Senior, Francisco J. H. Heras, Thomas Edlich, Alex Davies (all 'Google DeepMind'); Michael Newman ('Google Quantum AI').

**Look, 3D scenes, content.** Kept in [build_inputs/01_look_3d_content.md](01_look_3d_content.md) so this page stays short: colour tokens, fonts, sizes, layout per section, the exact 3D scene parameters (cameras, lights, shapes, colours) and every real text, label and list. The builder MUST read it before T02. Key numbers: page `#F9F8F4`, panel `#F5F4F0`, dark band `#1c1917`, gold `#C5A059` (dark gold `#8A6A2C` for small text on light), Playfair Display + Inter, hero H1 48 / 72 / 128 px, section `py-24`, cards `rounded-xl`, hero 3D wrapper 60% opacity, 2 Canvas total.

**Motion table.** See the Motion table above; add `prefers-reduced-motion`: Canvas `frameloop="demand"`, no `Float`, no setInterval, `step` fixed at 3.

**Edge cases and error states.**
- 3D unavailable (no WebGL): wrap each Canvas in an error boundary; hero shows only the cream gradient, the Impact box shows its caption; page stays usable.
- `Environment` presets need internet: if the light map fails to load, the scene must still render with its lights (catch the error, no uncaught console error).
- All errors cleared: caption back to 'System is stable.'; two errors on the same check cancel (0 violations) and the caption still reads 'Detected 0 parity violations.'
- Fast distance clicks: heights animate from the current value, no jump to 0.
- Resize: hero stays one screen; 3D canvases resize with their box.
- Menu open: scroll is allowed to continue behind; Escape closes it (fix, guessed).

**Out of scope.** Any input, topic search, any AI, router, other papers, backend, analytics, tests for text, server rendering.

**Done-when (checkable).** (1) `pnpm install && pnpm exec tsc --noEmit && pnpm build` exit 0. (2) `pnpm exec vite preview`: 0 console errors after scrolling top to bottom. (3) At 390 px: `document.documentElement.scrollWidth <= 390`, menu opens, each link lands its section title 100 px (+/- 8) below the top. (4) Click qubit centre: Z and X checks match the adjacency table; click again: back to 'System is stable.' (5) Distance 11 shows '0.0041%' and '0.0009%'. (6) Both canvases visible; 30 fps or more in the browser performance panel. (7) Text contrast at least 4.5:1 on every text under 24 px. (8) `grep -rE "npm |npx |yarn|genai|api_key"` in the app finds nothing.

## Requirements (EARS)
| id | requirement | source |
|---|---|---|
| R1 | While the page is scrolled more than 50 px, the header shall show a cream 90% blurred background. | real |
| R2 | When a menu link is pressed, the page shall scroll smoothly so the section starts 100 px below the top and the mobile menu shall close. | real |
| R3 | Under 768 px the page shall show a menu button that opens a full-screen menu with 5 items. | real |
| R4 | When a data qubit is pressed, the diagram shall toggle its error and light each check that has an odd number of errors among its qubits. | real |
| R5 | The caption shall read 'System is stable.' with no errors, else 'Detected N parity violations.'. | real |
| R6 | The decoder diagram shall move to the next of 4 steps every 2000 ms. | real |
| R7 | When a distance button is pressed, both bars shall animate to the values in the data table, labels formatted as in B10. | real |
| R8 | The page shall contain exactly two 3D canvases (hero, Impact). | real |
| R9 | The six sections, their ids and their texts shall be exactly those in *Content*. | real |
| R10 | Where the user prefers reduced motion, the page shall stop float, loops and the decoder timer. | guessed |
| R11 | If WebGL or a light map fails, the page shall still work without uncaught errors. | guessed |
| R12 | The page shall use no AI and make no network call except fonts, Tailwind CDN and the light maps. | real |

## Data model
No database. Constants inside the components: `adjacency`, qubit and check position tables, chart table, authors array (above). UI state: `scrolled`, `menuOpen`, `errors`, `step`, `distance`. Nothing is stored.

## Code flow
- `index.tsx` mounts `App`; `App` holds `scrolled`, `menuOpen`, one `scroll` listener (removed on unmount) and `scrollToSection(id)`.
- `App` renders `HeroScene` (absolute, behind the hero text), then sections. Each diagram owns its own state; there is no shared store.
- `SurfaceCodeDiagram`: `activeStabilizers` is derived from `errors` and `adjacency` on every render (not stored).
- `TransformerDecoderDiagram`: `setInterval` 2000 ms in `useEffect`, cleared on unmount.
- `PerformanceMetricDiagram`: framer-motion `animate` height from `distance` data.
- Check: `pnpm exec tsc --noEmit`, `pnpm build`, preview, console.

## Test plan
| task | steps (human-style) | pass when |
|---|---|---|
| T-A load | open the page at 1280 px, wait 3 s | hero title 'AlphaQubit', 3D shapes visible, console has 0 errors |
| T-B header | scroll down 60 px | header background turns cream and blurred (R1) |
| T-C menu | resize to 390 px, press the menu button, press 'Authors' | overlay closes, authors title sits about 100 px below the top (R2, R3) |
| T-D qubits | click the centre qubit | all 4 checks lit, caption 'Detected 4 parity violations.' |
| T-E qubits 2 | click centre again, then the top-left qubit | top Z check and left X check lit, caption 'Detected 2 parity violations.' |
| T-F decoder | watch 8 s | all 4 steps show, then it repeats; dots do not flicker |
| T-G chart | click Distance 11, then 3 | labels '0.0041%' / '0.0009%', then '3.50%' / '2.90%'; bars move smoothly |
| T-H 3D | scroll to Impact | gold machine visible, slowly floating; fps 30 or more |
| T-I a11y | Tab through the page, run a contrast check | focus ring visible; every text 4.5:1 or more |
| T-J build | `pnpm build` | exit 0 |

## Lessons and risks (what goes wrong)
- **Empty `index.css`:** the classes `animate-*` are not in Tailwind by default; the source shows nothing animating. Define the keyframes yourself.
- **Gold on light fails contrast** (2.3:1); also `stone-400` on white (2.5:1) and `stone-600` on `stone-900` (2.3:1). Use `#8A6A2C`, `stone-500` or darker, and `stone-400` on dark.
- **`Math.random()` in render** makes the decoder dots flicker on every state change.
- **Two WebGL contexts** plus `Stars` 1000 can drop fps on phones: cap `dpr` at 2, pause the Impact canvas when off screen.
- **Environment presets load from the internet**; offline the canvas can throw. Guard it.
- **Version drift:** r3f 9 needs React 19; do not mix with React 18. Pin the versions above.
- **Do not build to 'help':** no extra pages, no data fetching, no AI box.
