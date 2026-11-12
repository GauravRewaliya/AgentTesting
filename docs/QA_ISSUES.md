# QA video: issues we hit, why, how we fixed them, and how loopferry avoids them

Written 2026-11-12 from the real work on `--video` and the QA stage (`stage-qa`, `infra/qa/*`, `helper/video.ts`).
Everything in the "Issue log" was observed in a real run (timings are measured). Loopferry facts come from `~/projects/loopferry`
(`src/services/coding/stages/prompt.ts`, `qa.ts`, `engine/providers/claude-coding.ts`, `engine/e2b-template.ts`, `handbook/ENGINE.md`, `TESTING_REPORT.md`).
Package manager for everything here is **pnpm** (see `CLAUDE.md`).

## 1. What works today

| what | status |
|---|---|
| QA video of a plain web page (`index.html`) in a throwaway Docker container (no network, read-only app folder) | **works**, about 5 to 7 s. Case `adv_4_qa_video`, `bun TestCases/test_folders/advance_test/offline_demo.ts` |
| Web export of an Expo app in a container (`web_export.ts` + `export.sh` + `web_only.mjs`) | **works**: cold 173 s once, warm 27 to 39 s |
| A video of an Expo app that actually shows the app | **NOT working yet** for the solarin demo: the page stays blank (issue 12) |

## 2. Issue log (symptom, cause, fix, status)

| # | what we saw | why | fix | status |
|---|---|---|---|---|
| 1 | "where is the video?": only JSON session records existed | we had recorded sessions, not video; loopferry's `qa.webm` was never ported | QA stage: agent `stage-qa`, Docker recorder (`record.mjs`), flag `--video`, helper `helper/video.ts` | fixed |
| 2 | first recording showed an empty slug text | the recorder clicked the first button ("Clear") before it read the page text | read texts and take the screenshot first, then click | fixed |
| 3 | `--video` on the solarin demo: "none", and the session folder looked empty, like a failure | nothing was written when there was nothing to record; the message also said "native app", which was wrong (the app has `react-native-web`) | helper writes `store/qa/NO_VIDEO.txt` with the real reason; the reason now says Expo with web support, not exported | fixed |
| 4 | export failed after 11 s | the docker volume for the cache was created owned by root, the container runs as your user | `chown` the volume once before use | fixed |
| 5 | export failed after 280 s: `Unable to resolve ../assets/fonts/Inter-Regular.ttf` | a fixture is a **text patch**: it has no fonts or images, so Metro cannot bundle the app | `stub_assets.mjs` creates the missing files in the COPY (a real `.ttf` taken from `node_modules`, a valid 1x1 PNG), and lists them in `stubbed_assets.txt` so a video is never mistaken for the real app | fixed |
| 6 | export failed after 251 s: `Unable to resolve @react-navigation/elements` | the app imports a package it never declares. npm hides this by flattening `node_modules`; pnpm is strict (that is one reason we use it) | on `Unable to resolve "<pkg>"` the export runs `pnpm add <pkg>` and retries (max 4). First version added the **latest** version, which is wrong; now it adds the version the tree already uses (`@react-navigation/elements@2.9.45`). Listed in `added_deps.txt` | fixed |
| 7 | export failed after 242 s: `expo-modules-core.requireNativeViewManager is not available on web` | the app uses an iOS-only module (`@expo/ui/swift-ui`); the **static** web export renders pages in Node, where it crashes | `web_only.mjs` makes a web-only COPY: `web.output = single`, and native-only modules are replaced by an empty stub **on web only** (Metro `resolveRequest`) | fixed |
| 8 | each attempt took 4 to 5 minutes; 7 attempts, about 25 minutes of waiting | every attempt was a fresh container: full dependency resolution (no lockfile), pnpm itself re-downloaded by corepack, the pnpm store and the app copy on different filesystems (pnpm copies instead of linking), Metro's transform cache lost with the container. I also found one problem per attempt instead of all at once | ONE docker volume (`agent-testing-pnpm-store`) holds the pnpm store, the corepack binary, a saved lockfile per app (key = hash of its `package.json`, saved WITH the dependencies the export added) and Metro's cache (`TMPDIR`); the app copy lives in the same volume (hard links) and is deleted after each run; the retry loop runs inside ONE container | fixed: cold 173 s once, **warm 27 to 39 s** (install 22 s from the saved lockfile, bundle 3 to 15 s) |
| 9 | stopped background jobs left a container running | stopping the job killed `bun`, not the container | check `docker ps` after a stop and stop leftovers; long steps run in the foreground | handled |
| 10 | an `npm` cache volume and `npm install` were in the first version | we never wanted npm | rule in `CLAUDE.md` and in the agents' prompts: pnpm only, via corepack in containers | fixed |
| 11 | a video of a page that renders late would be blank | an Expo bundle needs seconds (big JS, fonts) and the recorder waited a fixed 2.5 s | the recorder waits until the app root has real content (up to 20 s) and records `rendered: true/false` | fixed |
| 13 | a stopped job left its container running (it kept 4 cpus / 6 GB busy and slowed every later run) | killing the host script does not stop `docker run` | containers are named; a timeout or `killAll` runs `docker kill <name>`; hard caps 300 s (dev QA) / 420 s (export); waits 90 s | fixed |
| 12 | **blank page**: `Couldn't find a drawer. Is your component inside a drawer navigator?` (solarin, desktop and phone size) | see section 3 | see section 3 | **open** |

## 3. Issue 12 in detail (the blank page)

Proved:
- the bundle contains **two copies of the drawer hook** (`useDrawerStatus`): counted in the built JS. The app's `DrawerContent` reads a different React context than the one `DrawerView` provides;
- there is only **one installed copy** of `@react-navigation/drawer` (7.14.4); the app and `expo-router` both resolve to it (checked inside the container).

Ruled out, with the evidence: duplicate install; the extra `@react-navigation/elements`; desktop width (phone size is also blank); missing fonts; **route code splitting** (with `expo-router` option `asyncRoutes: false` the export is ONE js file and the two hook copies are still there); `EXPO_ROUTER_IMPORT_MODE=sync` (no effect on this Expo version).

My earlier guesses were wrong five times (duplicate `elements`, two installed copies, wide screen, code splitting, fonts). The honest status: cause not proven. Most likely an ES-module build and a CommonJS build of the package both end up in the bundle. The Metro rule that forces one build fires for the app's imports (log shows `lib/module/index.js`), but `expo-router`'s own import never showed up in the log, so it could not be redirected.
Not yet done: an unminified single-bundle export. An earlier unminified build showed one drawer copy, no drawer error, and a rendered page (its only fault was a missing code-split chunk, which `asyncRoutes: false` now removes). That is the next 1-minute test.

## 4. How loopferry does QA, and why it feels smooth

Loopferry does **not** export an app and record it afterwards. QA is a step of the agent's own procedure (step 7 of 9 in `prompt.ts`), done by the agent in the **same live sandbox where it built the change**:

1. **The repo's own dev server.** Each repo has a configured `devCommand` / `devUrl` (prompt: "Dev server: `<cmd>` → `<url>`" or "(none — skip browser QA for this repo)"). The agent starts it in the background (`nohup <dev command> > /tmp/dev.log 2>&1 &`) and waits until it answers. No static export, no copy, no stubbing.
2. **A prepared machine.** The E2B template `loop-agent` has Node, git, ffmpeg, ripgrep and **Playwright with Chromium pre-installed** (the template build smoke-tests `chromium.launch()`). The prompt says "do not install browsers" and "do not install another version" of playwright.
3. **The agent writes the QA script and records the video itself.** "Write a short Playwright script ... with `recordVideo: { dir: OUTPUTS_DIR }`. Close the context so the video is flushed, then rename the .webm to `qa.webm`." It must **assert** the behaviour ("A QA that only loads the page is not QA") and replay the repo's configured critical flows.
4. **It reports honestly.** `result.json` has `qa.video_file` and one entry per configured flow: `pass`, `fail` or `skipped` with a note saying what stopped it. A Playwright MCP is also available for looking at the app while working (`browser_navigate`, `browser_snapshot`, `browser_click`, ...); it is for exploring, not for the recording.
5. **It adapts.** A missing dependency, a wrong route or a port problem is fixed by the agent in the same session. Our recorder is a fixed script with no judgment.
6. **Storage and sharing.** The video is streamed into R2 (never buffered: an isolate has 128 MB), capped by `QA_VIDEO_MAX_BYTES`, and a PR carries an HMAC-signed public link (`/api/files/qa/{run_id}?sig=`).
7. **Network rule.** The sandbox reaches only GitHub, the package registries and the app, so the agent can install what it needs, and nothing else.

Their own report shows the cost of this freedom (`TESTING_REPORT.md` 5.20): for a trivial `cp` the agent wrote and ran a browser test three times (183 s, $0.61). They conclude it needs an explicit rule: a copy, rename or comment change needs one quick check and no browser test.

## 5. Why ours kept breaking where theirs does not

| | loopferry | ours |
|---|---|---|
| when QA runs | during the run, in the sandbox that built the code | afterwards, in a fresh container, on a copy |
| source of the app | the real repo with its binaries and its dev server | a **fixture**: a text patch, no fonts/images, no dev config, preview versions |
| who decides how to test | the agent (adapts, asserts, replays flows) | a fixed script: first input, first button |
| missing pieces | the agent installs / fixes them | we stub assets, add undeclared packages, swap native modules |
| cost | model tokens for the QA work | none for the recorder, but a lot of my time when a fixture is not web-ready |

## 6. What to take from loopferry (proposed, in order)

1. **Per-case QA declaration** (**done 2026-11-12**), like loopferry's per-repo `devCommand`/`devUrl`: every test case may carry `qa: (req) => QaSpec` (`TestCases/types.ts`). The function says `{ enabled: true, kind: "static" | "expo-web" | "dev-server", app, route, viewport, start, port, type }` (HOW to start and record) or `{ enabled: false, why }`. A case that declares nothing, or says `enabled: false`, is simply left alone by `--video` (no video, no files, no output); only an enabled case is recorded, and it also gets a session record (`store/record/`) and its optional `guide` (testing guidance and commands) appended to the first message. Today: `adv_4_qa_video` enabled (static), the 3 adv cases without UI and the solarin cases disabled with a reason (`NO_VIDEO.txt`), 48 cases undeclared. The recipe for solarin once it renders: `{ enabled: true, kind: "expo-web", app: "my-app", route: "/3d-rotate", viewport: "390x844" }`.
2. **Use the demo's own web dev server** (`pnpm exec expo start --web`) inside the same container instead of a static export (**built**: `infra/qa/web_dev_qa.ts` + `dev_qa.sh`, start command and port from the case's `qa`; limits 2 GB / 1 CPU, container named and killed on timeout). **Not yet run on solarin** under the 2 GB / 1 CPU limits, so its speed and memory are unmeasured.
3. **Assert, do not just load**: each demo gets one check (an element, a text) and the report says `pass`, `fail` or `skipped` with a note, as in `result.json`.
4. **Skip rules**: no QA when there is no UI or the change is trivial; cap QA runs per case.
5. **A fixture that carries its binaries**, or a documented stub list per demo, so the app builds the same way every time.

## 7. Files

`record.mjs` (in-container recorder, route / viewport / wait-for-render) · `run_qa.ts` (host side, `QA_SANDBOX=docker|off|e2b`) · `Dockerfile` (image `agent-testing-qa:1`, pnpm + playwright-core + chromium headless shell, about 900 MB) ·
`web_export.ts` + `export.sh` (Expo export in a throwaway container) · `web_only.mjs` (web-only copy rules) · `stub_assets.mjs` (missing fonts/images) · `../../core/orchistraitor/helper/video.ts` (the `--video` flag) ·
per-run notes under `<session>/store/web/<app>/`: `timing.txt`, `added_deps.txt`, `stubbed_assets.txt`, `export.log`; videos under `<session>/store/qa/`.
