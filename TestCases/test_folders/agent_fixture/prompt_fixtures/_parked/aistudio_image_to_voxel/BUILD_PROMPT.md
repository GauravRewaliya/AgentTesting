---
audience: dev
title: Image to Voxel Art build prompt
status: phase 1 of 3 · planned
---
# Build prompt · Image to Voxel Art
> Planned, nothing built. Part of the plan: [overview](README.md) · [phases](PHASES.md). Give this whole page to the builder.

## Goal and who it is for
Build **Image to Voxel Art**: a one-page web app with **no AI and no server**. The user makes a picture (a built-in seeded generator draws it from a text, or the user uploads one), presses **Generate voxels**, and the same generator returns a single-page three.js scene that rebuilds the picture out of blocks, with fake "thinking" lines streamed first. The scene runs in an iframe and can be downloaded as one `.html`. For anyone who wants a fast 3D block version of a picture, and as a test of "a generator returns code that runs". A real model is dropped in LATER behind the same one function (see the last section).

## Stack
React 19 + TypeScript + Vite 6, front end only. pnpm only. Versions: see step 3 of the Build recipe in [README](README.md). No Express, no AI package, no `.env`.
Scripts: `dev` = `vite`; `build` = `vite build`; `preview` = `vite preview`; `test` = `vitest run`. `tsconfig`: ES2022, `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit`, `paths @/* -> ./*`. Vite: port 3000, host 0.0.0.0, react plugin, alias `@`. `.gitignore` must contain `node_modules`, `dist`, `*.local`.

## File tree (one owner per file)
| file | what | owner |
|---|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `index.css`, `index.tsx` | project shell | builder-1 |
| `src/ai/provider.ts` | THE seam: types `ProviderRequest`, `ProviderChunk`, the function `generate(request)`, and `mockProvider` | builder-1 |
| `src/ai/rng.ts` | `hashSeed(string) -> number`, `makeRng(seed)` (mulberry32 style): the only source of randomness | builder-1 |
| `src/ai/mock_image.ts`, `src/ai/mock_scene.ts` | seeded picture (SVG) and seeded scene (HTML) generators, used by `mockProvider` | builder-1 |
| `utils/html.ts` | `extractHtmlFromText`, `hideBodyText`, `zoomCamera` | builder-2 |
| `App.tsx` | the whole screen; calls ONLY `generate` | builder-2 |
| `public/examples/example1.html` ... `example3.html` | 3 ready three.js scenes copied from the reference | builder-2 |
| `src/ai/provider.test.ts`, `utils/html.test.ts` (guessed: the reference has no test file) | unit checks incl. same-seed-same-output | qa-reviewer |

## The provider seam and the mock
One function, one file. Everything that used to be an AI call goes through it, so a real provider can replace `mockProvider` without touching `App.tsx`.
```ts
type ProviderRequest =
  | { kind: 'image'; prompt: string; aspectRatio: string; optimise: boolean; seed?: number; delayMs?: number }
  | { kind: 'voxel'; image: string /* data URL */; seed?: number; delayMs?: number };
type Part = { text: string; thought?: boolean } | { inlineData: { mimeType: string; data: string } };
type ProviderChunk = { parts: Part[] };            // same shape a real streamed answer has
function generate(request: ProviderRequest): AsyncIterable<ProviderChunk>;   // image = one chunk
```
Image: `parts[0].inlineData` -> `data:<mimeType>;base64,<data>`; none -> throw `"No image generated."`. Voxel: parts with `thought: true` are thinking text, the others are answer text; after the stream `extractHtmlFromText(answer)`.

**Seed rule:** `seed = request.seed ?? Number(new URLSearchParams(location.search).get('seed')) ?? hashSeed(JSON.stringify(request without seed, delayMs))`. Same input, same seed, same output. `src/ai/` must not use `Math.random`, `Date.now`, `new Date` or `performance.now` for content (a clock may only be used for the delay timers).

**Mock picture (image):** a seeded SVG (UTF-8, base64 data URL, mime `image/svg+xml`) of the requested ratio: plain light background, then an isolated blocky shape (8-14 squares or a stepped pyramid, 4-6 colours from a fixed palette chosen by the rng). The prompt text is part of the seed. With `optimise: true` the shape is centred on a plain background with nothing else; with it off, add 6-10 small background specks (guessed). Uploaded images are never touched.

**Mock thinking (voxel):** 5 lines streamed as `thought: true` chunks, `delayMs` (default 250, tests pass 0) between them, each a bold headline plus a short sentence, e.g. `**Reading the shapes**\nThe image is built from blocky colour areas.`. Headlines come from a fixed list of 10 (guessed: "Reading the shapes", "Picking a palette", "Sizing the grid", "Stacking the layers", "Adding light", "Placing the camera", "Checking the edges", "Writing the scene", "Tidying the code", "Final pass"), chosen and ordered by the rng. The answer follows as 3-5 text chunks that join to one full HTML page.

**Mock scene (voxel):** `variant = rng() % 4`. 0-2: the matching bundled `examples/exampleN.html` (fetched from `/examples/`), unchanged. 3 (and any fetch failure): a procedural page: a three.js scene (CDN `three@0.160.0`, `OrbitControls` via import map) with a 16 x 16 grid of cubes whose heights come from the rng (smooth: average of neighbours), palette of 5 colours from the rng (the first from the uploaded or made picture bytes: hash only, guessed), a ground plane, 2 lights, `camera.position.set(...)` in literal form, an `#info` label (so `hideBodyText` has something to hide). The whole page is one string built only from rng numbers.

**Failure paths for the UI:** the mock may throw `"No scene was returned."` when `request.image` is empty (so the red error path is testable without a network).

## Behaviour (rules)
| id | trigger | result | numbers |
|---|---|---|---|
| B1 | page load | tiles: 3 example tiles + 1 "Generate" tile; viewer shows hint "Select an example, or generate your own!" | grid 4 columns |
| B2 | page load | example thumbnails made by the mock picture generator, seeded by the example number (works offline); until made the tile shows pulsing "Loading..." | - |
| B3 | prompt box empty | placeholder rotates through the 6 sample prompts | every 3000 ms |
| B4 | click Generate tile (nothing made yet) | panel opens, viewer hides, tile turns black with text "Close" | - |
| B5 | click Generate tile again | panel closes, viewer shows again; if nothing was made the tile is deselected | - |
| B6 | click "Generate" (needs non-empty prompt) | status `generating_image`; loading screen; on success picture shown, panel closes, tile shows the picture | disabled while loading |
| B7 | drop or choose a file | allowed: png, jpeg, webp, heic, heif; else error "Invalid file type. Please upload PNG, JPEG, WEBP, HEIC, or HEIF."; read as data URL; shown as picture; panel closes | - |
| B8 | click "Generate voxels" (needs a picture) | status `generating_voxels`; loading screen with the source thumbnail, the request line and thought headlines | label becomes "Regenerate voxels" once a scene exists |
| B9 | thinking text arrives | keep a buffer; find all `**bold**` headlines; show the LAST one (without the stars) | only update if changed |
| B10 | scene done | `zoomCamera(hideBodyText(html))` -> iframe; view mode = voxel; thinking cleared | zoom factor 0.8 |
| B11 | click example tile | fetch its html from `/examples/`, clean + zoom, show scene directly (no `generate` call); ignored while loading | - |
| B12 | "View Scene" / "View Image" | toggles between picture and scene (only when both exist) | - |
| B13 | "Download Image" / "Download HTML" | picture: `voxelize-image-<Date.now()>.<svg, jpg or png by mime>`; scene: `voxel-scene-<Date.now()>.html` (data URL) | - |
| B14 | iframe | `srcDoc`, `sandbox="allow-scripts allow-popups"`, no border | square viewer |
| B15 | the user's own work | kept separately from examples: switching to an example and back restores picture, scene and prompt | - |
| B16 | "Regenerate voxels" with the same picture | same output (same seed rule); only a new picture or `?seed=` changes it | guessed |

## Data and state shapes
```ts
type AppStatus = 'idle' | 'generating_image' | 'generating_voxels' | 'error';
const ASPECT_RATIOS = ["1:1","3:4","4:3","16:9","9:16"];            // default "1:1"
const ALLOWED_MIME_TYPES = ['image/png','image/jpeg','image/webp','image/heic','image/heif'];
const SAMPLE_PROMPTS = ["A tree house under the sea","A cyberpunk street food stall","An ancient temple floating in the sky","A cozy winter cabin with smoke","A futuristic mars rover","A dragon guarding gold"];
interface Example { img: string; html: string }   // img = made by the mock picture generator (seed = example number), html = '/examples/exampleN.html'
userContent: { image: string; voxel: string | null; prompt: string } | null
selectedTile: number | 'user' | null;  viewMode: 'image' | 'voxel';  useOptimization = true
```

## Look (Tailwind terms; all real unless marked)
| token | value |
|---|---|
| page / panels | white `#ffffff`; panel and viewer fill gray-50 `#f9fafb`; thumbnails gray-100 `#f3f4f6` |
| ink | black `#000000` text, borders and shadows |
| grays | gray-200 `#e5e7eb` (divider, drag hover), gray-400 `#9ca3af`, gray-500 `#6b7280` (switch off), gray-600 `#4b5563` (tagline), gray-900 `#111827` (button hover) |
| error | border red-500 `#ef4444`, fill red-50 `#fef2f2`, text red-700 `#b91c1c` |
| font | Tailwind default sans stack for all text; monospace stack for the loading screen text. No web font is loaded |
| title | "IMAGE TO VOXEL ART", 36 px (48 px from 640 px up), weight 900, line height 0.9, tight tracking; underline 2 px black, 24 px padding below |
| tagline | 18 px, weight 600, gray-600: "Create voxel art scenes inspired by any image." |
| layout | column max 672 px (`max-w-2xl`), page padding 48 px top and bottom, 16 px sides (24 px from 640, 32 px from 1024), 32 px gap between blocks |
| tiles | 4 square columns, 16 px gap, 2 px black border, flat shadow 4 px 4 px 0 black (6 px when hovered or chosen), chosen tile scale 1.02 and up 4 px, square corners everywhere |
| viewer | square, 2 px black border, shadow 4 px, gray-50 fill |
| inputs | 48 px tall, 2 px black border, 18 px text; labels 14 px bold uppercase |
| buttons | wide row, 16 px gap, min width 140 px (160 px for the black one), 16 px vertical padding (about 56 px tall), bold uppercase; black variant = black fill white text; others white fill |
| upload zone | 256 px tall, 2 px dashed black, text "Drag and drop or click to upload image" |
| switch | 40 x 24 px box, 2 px black; on = black, off = gray-500; knob 16 px white slides 16 px |
| loading screen | white, 32-48 px padding; title line 20 px bold; request block mono 12-14 px, 70% opacity, grey left rule; thinking block mono 12-14 px, 70% opacity, max height 40%, scrolls |

## Motion
| name | what | duration | easing |
|---|---|---|---|
| tile lift | translateY -4 px and shadow 4 -> 6 px on hover; chosen scale 1.02 | 200 ms | Tailwind default (cubic-bezier(0.4,0,0.2,1)) |
| tile press | back to 0 offset, shadow 2 px, scale 1 | 200 ms | same |
| panel open | slide down 16 px + fade in | 300 ms | default (implement with a CSS keyframe, not `animate-in`) |
| thumbnail wait | pulse | Tailwind `animate-pulse` | - |
| dots | "", ".", "..", "..." in `::after` | 2 s loop | steps(4, end) |
| hint rotate | placeholder text changes | 3000 ms interval | none |
| fake thinking | one new headline about every 250 ms (the mock's `delayMs`) | - | none |
| reduced motion | all of the above off except the text itself (guessed) | - | - |

## Content (exact texts)
Title, tagline: see Look. Tile labels: "Generate" (idle), "Close" (panel open), "Editing" (overlay on own picture), aria-labels "Load Example N", "Generate new scene". Panel: "UPLOAD IMAGE", "OR", "MAKE AN IMAGE", "ASPECT RATIO", "OPTIMISE SCENE" (tooltip `Tidy the prompt: isolated object on a plain background`), button "Generate" / "Generating...". Loading screen line: "Generating three.js scene"; before the first headline the thinking block shows "Thinking" + dots. Buttons: "Generate voxels" / "Regenerate voxels", "View Scene" / "View Image", "Download HTML" / "Download Image". Errors render as `ERROR: <message>` with `role="alert"`.

## Helper rules (`utils/html.ts`, real)
- `extractHtmlFromText`: 1) first match of `(<!DOCTYPE html>|<html)...</html>` (case-insensitive); 2) else the first code fence (```` ```html ````); 3) else the trimmed text; empty input -> `""`.
- `hideBodyText`: inject a `<style>` before `</head>` (else before `</body>`, else append) that hides `#info, #loading, #ui, #instructions, .label, .overlay, #description` (display none, opacity 0, visibility hidden, no pointer events) and sets `body {user-select:none}`.
- `zoomCamera(html, 0.8)`: regex-replace every `camera.position.set(x, y, z)` with the three numbers multiplied by 0.8.

## Edge cases and error states
- Empty answer or no HTML found: show a red error "No scene was returned. Try again." (a blank iframe is NOT allowed).
- A thrown error from `generate`: red message, status back to usable; buttons re-enabled.
- Unsupported file: B7 message. Huge upload: read in the browser; no limit set (guessed).
- Example html missing: placeholder page text "<file> not found." (real).
- User switches tile during a run: tiles are disabled while loading (real).
- A real model may answer with the scene inside a code fence or with chatter around it: handled by `extractHtmlFromText` (tested with such text; the mock itself answers cleanly).

## Out of scope
Any real AI call, API key, `.env`, server or proxy, key dialog, chat, video, image-model endpoints, user accounts, saving to a server, editing the generated code, sharing links, any dark theme. The Bring-your-own-model dialog is LATER (Phase 4 in PHASES.md), not part of the current build.

## Done-when (checkable)
1. `pnpm install && pnpm exec tsc --noEmit` exits 0.
2. `pnpm test` exits 0, including: same seed gives the same output for image and voxel (C8), different seed differs.
3. `pnpm build` exits 0 and creates `dist/index.html`; there is no `server.ts` and no `dist/server.cjs`.
4. `git grep -il -e genai -e gemini -e AIza -e "process.env" -- src utils App.tsx package.json vite.config.ts` and `grep -ril -e AIza -e genai dist/` print nothing; no `.env*` file exists.
5. `pnpm dev`, open the page: click Example 1: the scene appears in under 3 s, console shows 0 errors; the same for examples 2 and 3.
6. Click Generate, type "a dragon", Generate: a picture shows; reload with `?seed=7` twice: the same picture both times. Generate voxels shows headline text, then a scene, and the button reads "Regenerate voxels".
7. At 390 px wide: no sideways scroll; every button is at least 40 px tall.
8. Download HTML gives `voxel-scene-<digits>.html` that opens alone with the scene visible.

## Reference prompts for the later real provider (not used now)
Nothing in this block is built or called today. It is kept so a real provider can be written later behind `generate(request)` with the same `ProviderChunk` shape. Taken from the reference app's source.
- **Models:** image = `gemini-2.5-flash-image`; scene = `gemini-3-pro-preview` (the reference server also swaps the scene model for `gemini-3.1-pro-preview`; models get renamed, keep names in one constants block).
- **`IMAGE_SYSTEM_PROMPT`** = `Generate an isolated object/scene on a simple background.` Used only when "Optimise Scene" is on: `finalPrompt = IMAGE_SYSTEM_PROMPT + "\n\nSubject: " + prompt`; off: the prompt as typed.
- **`VOXEL_PROMPT`** = `I have provided an image. Code a beautiful voxel art scene inspired by this image. Write threejs code as a single-page.`
- **Image call:** parts `[{text: finalPrompt}]`, config `{responseModalities:['IMAGE'], imageConfig:{aspectRatio}}`; result = `candidates[0].content.parts[0].inlineData`.
- **Scene call:** streamed, parts `[{inlineData:{mimeType, data}}, {text: VOXEL_PROMPT}]` (mime from the data URL, default `image/jpeg`), config `{thinkingConfig:{includeThoughts:true}}`; per part: `thought` true -> thinking text, else answer text.
- **Reference loading texts:** "Generating three.js scene with Gemini 3 Pro"; panel title "GENERATE WITH GEMINI 2.5 FLASH IMAGE"; tagline "Create voxel art scenes inspired by any image, with Gemini 3."
- **Reference server (not built):** Express holding the key, `/api/generate-content`, NDJSON `/api/generate-content-stream`, model-name guard, 503 when no key. In a later build, prefer the Bring-your-own-model route (Phase 4) over a server.
