import type { TestTag } from "../../tags.ts";
import type { Case, QaSpec } from "@core/types.ts";
import { seedProject } from "./lib/zip_seed.ts";

// project_check: "is this project working or not?" The recorded project is UNZIPPED into run_test/<dir> before the lead starts
// (before_node_run + agent_fixture/store/projects/<zip>.zip), then the user asks the lead to run it. The lead works ALONE (no sub-agent,
// real tools); the judge reads the report: did it install, build, type-check, and say works / broken with the real reason; if it was
// asked to fix, was the change small and re-run?
//
// SOURCES (where each project comes from; the AI Studio origin list is TestCases/test_folders/agent_fixture/prompt_fixtures/aistudio_examples/index.md, its plan is TestCases/test_folders/agent_fixture/prompt_fixtures/<plan>/):
//   pc_clockwork   clockwork-sanctum.zip         AI Studio bundled app "clockwork-sanctum"            plan aistudio_clockwork_sanctum
//   pc_eiffel      eiffel-tower-3d.zip           AI Studio bundled app "eiffel-tower-3d" (7.5 MB)    plan aistudio_eiffel_tower_3d
//   pc_terrarium   pocket-world-terrarium.zip    AI Studio bundled app "pocket-world-terrarium"       plan aistudio_pocket_world_terrarium
//   pc_voxel       image-to-voxel-art.zip        AI Studio bundled app "image_to_voxel"               plan aistudio_image_to_voxel
//   pc_infogenius  infogenius.zip                AI Studio bundled app "info_genius"                  plan aistudio_info_genius
//   pc_research    research-visualization.zip    AI Studio bundled app "research_visualization"       plan aistudio_research_visualization
//   pc_heroes      infinite-heroes.zip           AI Studio bundled app "personalized_comics"          plan aistudio_personalized_comics
//   pc_wavelet     wavelet-spotify-clone.zip     web music player (own design), from docs zip         plan wavelet_spotify_clone
//   pc_creative    creative-browser-templates.zip five standalone browser demos, from docs zip        plan creative_browser_templates
// OPEN URLS (view the app, Code tab, Export -> Download .zip; prefix https://aistudio.google.com/apps/bundled/ , short form https://ai.studio/apps/bundled/<id>):
//   pc_clockwork   .../clockwork-sanctum         pc_eiffel     .../eiffel-tower-3d          pc_terrarium  .../pocket-world-terrarium
//   pc_voxel       .../image_to_voxel            pc_infogenius .../info_genius              pc_research    .../research_visualization
//   pc_heroes      .../personalized_comics       (these have no public git repo; the zips ARE the source; also kept unzipped in docs/aistudio_examples/<app>/original/)
//   pc_wavelet, pc_creative: no URL (docs zips docs/wavelet-spotify-clone.zip, docs/creative-browser-templates.zip)
// Rules: pnpm only (never npm), installs happen in the sandbox container (docs/SANDBOX.md), no API key exists here, so "works" means
// "installs, type-checks, builds"; Gemini features cannot be exercised and the lead must say so instead of faking a result.
// Video (--video) is NOT used yet: every case below sets qa to disabled; turn it on per case later.
export const tags: TestTag[] = ["single_ag", "single_prompt", "coding"];

const NO_VIDEO = (why = "video test comes later; first only the install/build check"): ((r: unknown) => QaSpec) => () => ({ enabled: false, why });
const base = { agents: ["qa-reviewer", "builder"], allow_real_subAg: true as const, max_cost_usd: 1, qa: NO_VIDEO() };
const ASK = (dir: string, extra = "") => `The project is already unpacked in run_test/${dir}. Is it working? Use pnpm (never npm): install, run the type check and the build. ${extra}Answer in a few lines: works or broken, and the real reason if broken. If something fails, fix it with the smallest change and run it again.`;
const NOKEY = " There is no Gemini API key here, so the Gemini features cannot run: say that plainly, do not invent a result.";

const apps: { id: string; zip: string; dir: string; title: string; ask: string; context: string }[] = [
  { id: "pc_clockwork", zip: "clockwork-sanctum", dir: "clockwork-sanctum", title: "Clockwork Sanctum (React + Three.js puzzle game)",
    ask: ASK("clockwork-sanctum", "It also has a smoke test in test/ (`node test/applet_smoke.test.mjs`); run it after the build. "),
    context: "The lead installs with pnpm, runs `tsc --noEmit` (the lint script) and `vite build`, then the smoke test in test/. It reports works/broken with the real result of each step. No Gemini key is needed for this app. No npm." },
  { id: "pc_eiffel", zip: "eiffel-tower-3d", dir: "eiffel-tower-3d", title: "Eiffel Tower 3D (plain JS + three.js, 7.5 MB)",
    ask: ASK("eiffel-tower-3d", "It is plain JavaScript modules with three.js kept in vendor/. "),
    context: "The lead installs with pnpm (only vite and @google/genai), runs the type check and `vite build`. It notes that the exhibit itself needs no network or key. It reports each step's real result." },
  { id: "pc_terrarium", zip: "pocket-world-terrarium", dir: "pocket-world-terrarium", title: "Pocket World Terrarium (React 19 + Three.js + Tailwind 4)",
    ask: ASK("pocket-world-terrarium", NOKEY.trimStart() + " "),
    context: "The lead installs with pnpm (a bun.lock exists, it must still use pnpm), runs `tsc --noEmit` and `vite build`. It says the optional Gemini planet-name route cannot run without a key. It reports each step's real result." },
  { id: "pc_voxel", zip: "image-to-voxel-art", dir: "image-to-voxel-art", title: "Image to Voxel Art (React + Express Gemini proxy)",
    ask: ASK("image-to-voxel-art", "Its build script also bundles server.ts with esbuild. " + NOKEY.trimStart() + " "),
    context: "The lead installs with pnpm and runs `vite build` plus the esbuild server bundle (the build script), and a type check. It says that generating an image and the Voxelize step need GEMINI_API_KEY and were not run." },
  { id: "pc_infogenius", zip: "infogenius", dir: "infogenius", title: "InfoGenius (React + Express Gemini proxy)",
    ask: ASK("infogenius", "Its build script also bundles server.ts with esbuild. " + NOKEY.trimStart() + " "),
    context: "The lead installs with pnpm and runs the build (vite + esbuild server bundle) and a type check. It says search grounding and image generation need GEMINI_API_KEY and were not run." },
  { id: "pc_research", zip: "research-visualization", dir: "research-visualization", title: "Research Visualization (React + react-three-fiber narrative page)",
    ask: ASK("research-visualization"),
    context: "The lead installs with pnpm (react-three-fiber, drei, three, framer-motion) and runs a type check and `vite build`. This app has no Gemini part. It reports each step's real result." },
  { id: "pc_heroes", zip: "infinite-heroes", dir: "infinite-heroes", title: "Infinite Heroes (comic generator: React + Express Gemini proxy + jsPDF)",
    ask: ASK("infinite-heroes", "Its build script also bundles server.ts with esbuild. " + NOKEY.trimStart() + " "),
    context: "The lead installs with pnpm and runs the build (vite + esbuild server bundle) and a type check. It says that writing and drawing pages needs GEMINI_API_KEY and was not run; PDF export was not run either." },
  { id: "pc_wavelet", zip: "wavelet-spotify-clone", dir: "wavelet", title: "Wavelet (own-design web music player)",
    ask: ASK("wavelet", "Its build script is `tsc -b && vite build`. It ships a package-lock.json: ignore it, use pnpm. "),
    context: "The lead installs with pnpm (not the package-lock), runs `tsc -b && vite build` and reports the real result. No server and no key." },
  { id: "pc_creative", zip: "creative-browser-templates", dir: "creative", title: "Five creative browser demos (no build step)",
    ask: "The five demos are already unpacked in run_test/creative (3d-scene, action-game, grain-synth, juice-sandbox, sound-world). They have no build step. Check each folder: it has an index.html, every .js file parses (`node --check`, modules need `--input-type=module` or the .mjs rule: pick what works), and serving the folder with `python3 -m http.server 8000` answers 200 for each page. Answer in a few lines: which of the five are fine and which are not, with the reason. Do not open a browser.",
    context: "The lead checks all FIVE folders (not just one), says per folder fine/not fine with a reason (index.html present, js parses, page served with 200). It does not claim anything about visuals or sound (no browser). No build and no npm install is needed." },
];

export const cases: Case[] = apps.map((a) => ({
  id: a.id, title: `[project_check] ${a.title}: install, type-check, build, report`, ...base,
  before_node_run: (ctx) => seedProject(ctx, a.zip, a.dir),
  turns: [{ user: a.ask, expected: { context: "The lead hands the check to ONE qa-reviewer (the hand-over names run_test/" + a.dir + " and says pnpm, never npm). The qa-reviewer: " + a.context.replace(/^The lead /, "") + " The final answer says works or broken with the real reason.", expected_agents_res: [], expected_roles: ["qa-reviewer"] } }],
}));
