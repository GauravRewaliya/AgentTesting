// QA video of an app folder, in a throwaway Docker container (loopferry records `qa.webm` in its E2B sandbox; this is the local equivalent).
//   QA_SANDBOX=docker (default)  container from test_harness/infra/qa: NO network, read-only root fs, ALL capabilities dropped, no-new-privileges, 1 cpu, 2 GB, 256 pids, non-root user.
//                                the app folder is mounted READ-ONLY; the only writable path is the output folder, ALWAYS inside a session: test_harness/.state/v1/<session>/store/qa/<id>/
//   QA_SANDBOX=off               skip (returns ok:false, skipped)
//   QA_SANDBOX=e2b               NOT implemented on purpose: it needs E2B_API_KEY and bills sandbox minutes; the docker backend does the same job here
//   bun test_harness/infra/qa/run_qa.ts <app folder> <out folder inside a session>     (prints the result as JSON)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const QA_IMAGE = "agent-testing-qa:1";
export interface QaResult { ok: boolean; backend: string; skipped?: boolean; video?: string; screenshot?: string; json?: string; summary?: Record<string, unknown>; error?: string }

const sh = (args: string[], timeout = 120_000) => spawnSync("docker", args, { encoding: "utf8", timeout });
export function qaImageReady(): boolean { return sh(["image", "inspect", QA_IMAGE], 20_000).status === 0; }
export function buildQaImage(): { ok: boolean; log: string } { const r = sh(["build", "-t", QA_IMAGE, join(import.meta.dir)], 900_000); return { ok: r.status === 0, log: (r.stdout + r.stderr).slice(-600) }; }

export function recordQa(o: { appDir: string; out?: string; route?: string; viewport?: string }): QaResult {
  const backend = process.env.QA_SANDBOX ?? "docker";
  if (backend === "off") return { ok: false, backend, skipped: true, error: "QA recording is off (QA_SANDBOX=off)" };
  if (backend === "e2b") return { ok: false, backend, error: "QA_SANDBOX=e2b is not implemented here: it needs E2B_API_KEY and bills sandbox minutes. Use QA_SANDBOX=docker." };
  if (backend !== "docker") return { ok: false, backend, error: `unknown QA_SANDBOX "${backend}" (docker | off | e2b)` };
  if (!o.out) return { ok: false, backend, error: "no output folder: QA output goes ONLY inside a session, test_harness/.state/v1/<session>/store/qa/<id>/ (never a loose folder in .state)" };
  const app = resolve(o.appDir), out = resolve(o.out);
  if (!existsSync(join(app, "index.html"))) return { ok: false, backend, error: `no index.html in ${app}` };
  if (!qaImageReady()) return { ok: false, backend, error: `image ${QA_IMAGE} is missing: bun test_harness/infra/qa/run_qa.ts --build` };
  mkdirSync(out, { recursive: true });
  const uid = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  const r = sh(["run", "--rm", "--network", "none", "--read-only", "--tmpfs", "/tmp:rw,size=256m", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "256", "--memory", "2g", "--cpus", "1",
    "--user", uid, "-e", `QA_ROUTE=${o.route ?? "/"}`, "-e", `QA_VIEWPORT=${o.viewport ?? process.env.QA_VIEWPORT ?? "1280x720"}`, "-v", `${app}:/work:ro`, "-v", `${out}:/out`, QA_IMAGE], 180_000);
  const json = join(out, "qa.json"), summary = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : undefined;
  const video = join(out, "qa.webm"), shot = join(out, "qa.png");
  return { ok: r.status === 0 && existsSync(video), backend, video: existsSync(video) ? video : undefined, screenshot: existsSync(shot) ? shot : undefined, json: summary ? json : undefined, summary, error: r.status === 0 ? undefined : (r.stderr || r.stdout || "container failed").slice(-400) };
}

if (import.meta.main) {
  const [a, b] = process.argv.slice(2);
  if (a === "--build") { const r = buildQaImage(); console.log(r.ok ? `built ${QA_IMAGE}` : "BUILD FAILED\n" + r.log); process.exit(r.ok ? 0 : 1); }
  if (!a || !b) { console.log("usage: bun test_harness/infra/qa/run_qa.ts --build | <app folder> <out folder inside a session: .state/v1/<session>/store/qa/<id>>"); process.exit(1); }
  const r = recordQa({ appDir: a, out: b }); console.log(JSON.stringify(r, null, 1)); process.exit(r.ok ? 0 : 1);
}
