// REF: https://github.com/enzomanuelmangano/demos -> src/animations/cherry-blossom-qrcode and src/animations/sculptures-in-words. THREE NODES on ONE workspace, nothing cloned twice:
//   node 1  eg_demos_01_clone         the lead hands "clone the repo and set up both demos" to the mocked sub-agent `expo-go` (fixture: a real SPARSE clone at the pinned sha, one slim runner app per demo, PLAN.md). Runs nothing.
//   node 2  eg_cherry_02_run_video    branch_from node 1 with `branch_share`: it runs IN node 1's workspace (no copy), no lead call (`no_lead`): the harness starts the slim cherry app on web and records the video.
//   node 3  eg_sculpt_02_run_video    sculptures-in-words: NO VIDEO by design. It needs Skia Graphite (native iOS/Android only; on web Skia is CanvasKit), so QA is disabled for it with that reason and the node is SKIPPED (flagged "no video"), never run.
// The slim runner (agent_fixture/store/expo_go/slim_demo.ts) holds ONLY the demo folder + its packages: the whole repo (hundreds of demos, native packages) cannot be bundled for the browser in a small container.
// Run: bun testrun/run.ts test_expo_go eg_demos_01_clone eg_cherry_02_run_video eg_sculpt_02_run_video      (the video nodes record by themselves; about 1 minute each, node 1 about 30 s)
// Redo only one node later: ... eg_cherry_02_run_video --rerun (the parent is not run again).
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

// iOS-only packages whose JS the demo only touches for haptics / keyboard events: stubbed on WEB only (empty components) so the browser can bundle the app.
const NATIVE_ONLY = ["^react-native-pulsar", "^react-native-keyboard-controller"];
// no GPU in the container: Chromium's software Vulkan (SwiftShader) gives navigator.gpu.requestAdapter() an adapter, so a WebGPU scene renders.
const SOFTWARE_WEBGPU = ["--enable-unsafe-webgpu", "--enable-features=Vulkan,UseSkiaRenderer", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const slimQa = (slug: string, note: string, failOnText: string[] = []): Case["qa"] => () => ({ enabled: true, kind: "expo-web", app: `${slug}-app`, route: "/", viewport: "390x844", typecheck: "off", native_only: NATIVE_ONLY, browser_args: SOFTWARE_WEBGPU, fail_on_text: failOnText,
  render_timeout_ms: 240_000, timeout_ms: 600_000, steps: [{ wait: 7000 }, { shot: "1_scene" }, { wait: 5000 }, { shot: "2_scene_later" }], note,
  guide: "To test: this is an Expo project that also runs in the browser (Expo web). Do not install packages in the workspace yourself: the QA step does it in a container with the shared pnpm store." });

export const cases: Case[] = [
  {
    ...expoGo,
    id: "eg_demos_01_clone",
    title: "[ref github enzomanuelmangano/demos] node 1: clone the repo once and set up the cherry-blossom-qrcode and sculptures-in-words runners, nothing else",
    turns: [{
      user: "Clone https://github.com/enzomanuelmangano/demos into run_test/demos and set up the cherry-blossom-qrcode and sculptures-in-words demos so that each one can be run later (a tiny runner app that contains only that demo is fine, it is how a demo is run). Write the steps in PLAN.md first. Do nothing else: do not run them and do not change any code of the repo.",
      allowed: ["expo-go"],
      expected: {
        context: "The lead calls expo-go ONCE (nothing else, no own work). The hand-over carries: run_test/demos, the repo URL, both demo names, PLAN.md first, 'do not run' and 'do not change code'. Recorded result role-expo-go-eg_demos_01_clone does a real sparse clone at the pinned sha, builds the slim runner apps run_test/cherry-blossom-qrcode-app and run_test/sculptures-in-words-app, writes PLAN.md. Nodes 2 and 3 then run them in this same workspace.",
        expected_agents_res: ["role-expo-go-eg_demos_01_clone"],
      },
    }],
  },
  {
    id: "eg_cherry_02_run_video", branch_from: "eg_demos_01_clone", branch_share: true, no_lead: true, allow_real_subAg: true as const, needs: [], agents: [], tags: ["multi_prompt"],
    qa: slimQa("cherry-blossom-qrcode", "a voxel cherry tree on a QR code (WebGPU); the demo is registered in src/animations/registry.ts"),
    title: "[ref github enzomanuelmangano/demos src/animations/cherry-blossom-qrcode] node 2: run the cherry blossom QR demo in node 1's workspace and record the video (no lead call)",
    turns: [{ user: "(no lead) run run_test/cherry-blossom-qrcode-app on web in the workspace of node 1 and record the video", allowed: [], expected: { context: "No lead and no sub-agent: the harness installs and starts the slim app in a container (software WebGPU), opens it and records qa.webm. PASS = the video exists.", expected_agents_res: [] } }],
  },
  {
    id: "eg_sculpt_02_run_video", branch_from: "eg_demos_01_clone", branch_share: true, no_lead: true, allow_real_subAg: true as const, needs: [], agents: [], tags: ["multi_prompt"],
    // NO VIDEO, by design: the demo shares ONE native GPU device between Skia and WebGPU (`Skia.getNativeDevice()` in hooks/use-portrait-renderer.ts) and says "needs Skia Graphite" without it.
    // Skia Graphite exists only in the NATIVE iOS/Android builds; on web Skia is CanvasKit (no Graphite), so the scene can never draw in a browser. QA (and any preview) is switched off for it: nothing is started, it is flagged "no video".
    qa: () => ({ enabled: false, why: "needs Skia Graphite (Skia.getNativeDevice shares one native GPU device with WebGPU): native iOS/Android only, it cannot render on web" }),
    title: "[ref github enzomanuelmangano/demos src/animations/sculptures-in-words] node 3 [NO VIDEO]: native-only demo (needs Skia Graphite), QA is switched off for it",
    turns: [{ user: "(no lead, no video) run_test/sculptures-in-words-app is native-only: it needs Skia Graphite, which exists only in the iOS/Android builds", allowed: [], expected: { context: "No lead, no sub-agent, no QA container: the case is flagged 'no video' with the reason and is SKIPPED, not failed.", expected_agents_res: [] } }],
  },
];
