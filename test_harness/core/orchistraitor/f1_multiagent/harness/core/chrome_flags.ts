// Headless Chrome with SOFTWARE WebGL. The harness used `--disable-gpu`, which also disables WebGL: every 3D page showed its "needs WebGL" fallback and the lead could not
// verify a three.js app (pp_eiffel: "the headless Chrome here has no WebGL"). SwiftShader renders WebGL on the CPU, so a 3D page can be opened, screenshotted and stepped through.
// (Verified by hand: the Eiffel tower, the Paris blocks, the photo plate and the 12-stop bar render with these flags.)
import { existsSync } from "node:fs";
/** WebGL: the machine's REAL GPU when there is one (/dev/dri/renderD128): the Eiffel scene ran at 25 fps on the Intel GPU against 1.3 fps with SwiftShader (software, on the CPU); software only when no GPU is there. CHROME_GL_FLAGS overrides. */
export const GPU_GL = ["--use-gl=angle", "--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"];
const SOFT = ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
export const SOFT_GL = process.env.CHROME_GL_FLAGS ? process.env.CHROME_GL_FLAGS.split(" ").filter(Boolean) : existsSync("/dev/dri/renderD128") ? GPU_GL : SOFT;

/** Run Chrome on at most 3 CPU cores and at low priority (SwiftShader draws WebGL on the CPU and would take every core of the machine); one core stays free for the person, the UI and ffmpeg. Empty when taskset is missing or the machine has 3 cores or less. */
import { spawnSync } from "node:child_process";
import { cpus } from "node:os";
export const CHROME_PREFIX: string[] = (() => { const n = cpus().length; if (n <= 3 || spawnSync("which", ["taskset"]).status !== 0) return ["nice", "-n", "5"]; return ["nice", "-n", "5", "taskset", "-c", `0-${Math.min(n - 1, 2)}`]; })();
