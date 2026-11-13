// REF: https://github.com/enzomanuelmangano/demos -> src/animations/cherry-blossom-qrcode and src/animations/sculptures-in-words. TWO cases (one per demo): "clone the repo and run that demo, nothing else", so the harness can record the video.
// The lead hands it to the mocked sub-agent `expo-go`. Fixture (agent_fixture/results/test_expo_go/role-expo-go-eg_*_01_clone_run.ts): a real shallow clone at the pinned sha into run_test/demos, then a SLIM runner built on the fly
// (agent_fixture/store/expo_go/slim_demo.ts): run_test/<slug>-app = ONLY that demo folder + the packages it imports, because the whole repo (hundreds of demos, native packages) cannot be bundled for the browser in a small container.
// `--video` starts that slim app's web dev server in the Docker QA container and records it. Both demos draw with WebGPU, so the recording browser gets software-WebGPU flags (no GPU in the container).
// Run: bun testrun/run.ts test_expo_go eg_cherry_01_clone_run eg_sculpt_01_clone_run --video      (about 1 to 2 minutes per case; the first container run also installs the packages)
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

// iOS-only packages whose JS the demo only touches for haptics / keyboard events: stubbed on WEB only (empty components) so the browser can bundle the app.
const NATIVE_ONLY = ["^react-native-pulsar", "^react-native-keyboard-controller"];
// no GPU in the container: Chromium's software Vulkan (SwiftShader) gives navigator.gpu.requestAdapter() an adapter, so the WebGPU scene renders.
const SOFTWARE_WEBGPU = ["--enable-unsafe-webgpu", "--enable-features=Vulkan,UseSkiaRenderer", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--use-angle=swiftshader", "--disable-vulkan-surface", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const slimQa = (slug: string, note: string): Case["qa"] => () => ({ enabled: true, kind: "expo-web", app: `${slug}-app`, route: "/", viewport: "390x844", typecheck: "off", native_only: NATIVE_ONLY, browser_args: SOFTWARE_WEBGPU,
  render_timeout_ms: 240_000, timeout_ms: 600_000, steps: [{ wait: 7000 }, { shot: "1_scene" }, { wait: 5000 }, { shot: "2_scene_later" }], note,
  guide: "To test: this is an Expo project that also runs in the browser (Expo web). Do not install packages in the workspace yourself: the QA step does it in a container with the shared pnpm store." });
const ask = (slug: string, what: string) => `Clone https://github.com/enzomanuelmangano/demos into run_test/demos and run the ${slug} demo (${what}). Write the steps in PLAN.md first. Do nothing else: do not change any code of the repo (a tiny runner app that contains only that demo is fine, it is how the demo is run).`;
const expected = (slug: string, id: string) => ({
  context: `The lead calls expo-go ONCE (nothing else, no own work). The hand-over carries: run_test/demos, the repo URL, the demo name ${slug}, PLAN.md first, and 'do not change code'. Recorded result role-expo-go-${id} does a real shallow clone at the pinned sha, builds the slim runner run_test/${slug}-app and writes PLAN.md. With --video the QA step runs the slim app on web (software WebGPU) and records it.`,
  expected_agents_res: [`role-expo-go-${id}`],
});

export const cases: Case[] = [
  {
    ...expoGo,
    no_qa_check: true as const,   // clone and run ONLY: the lead must not run its own qa_check (an extra install + bundle in a container); the --video step is the one run
    id: "eg_cherry_01_clone_run",
    qa: slimQa("cherry-blossom-qrcode", "a voxel cherry tree on a QR code (WebGPU); the demo is registered in src/animations/registry.ts"),
    title: "[ref github enzomanuelmangano/demos src/animations/cherry-blossom-qrcode] clone the repo and run the cherry blossom QR demo, nothing else",
    turns: [{ user: ask("cherry-blossom-qrcode", "the cherry blossom QR code animation"), allowed: ["expo-go"], expected: expected("cherry-blossom-qrcode", "eg_cherry_01_clone_run") }],
  },
  {
    ...expoGo,
    no_qa_check: true as const,
    id: "eg_sculpt_01_clone_run",
    qa: slimQa("sculptures-in-words", "sculptures made of words (WebGPU + Skia); registered in src/animations/registry.ts"),
    title: "[ref github enzomanuelmangano/demos src/animations/sculptures-in-words] clone the repo and run the sculptures-in-words demo, nothing else",
    turns: [{ user: ask("sculptures-in-words", "the sculptures-in-words animation"), allowed: ["expo-go"], expected: expected("sculptures-in-words", "eg_sculpt_01_clone_run") }],
  },
];
