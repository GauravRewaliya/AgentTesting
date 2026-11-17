// QA video of an Expo app by running ITS OWN web dev server in a throwaway container (what loopferry does in its sandbox: the repo's real dev command, then a Playwright recording).
// Same container rules as web_export.ts (volume `agent-testing-pnpm-store`, app mounted read-only, only <out> writable, 1 cpu / 2 GB, caps dropped, --rm); network ON (package registries are needed).
//   bun test_harness/infra/qa/web_dev_qa.ts <app folder> <out folder> [route] [viewport]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { QA_IMAGE, type QaResult } from "./run_qa.ts";
import { PNPM_STORE_VOLUME } from "./web_export.ts";

export function recordExpoDev(o: { appDir: string; out: string; route?: string; viewport?: string; start?: string; port?: number; type?: string; typecheck?: "strict" | "warn" | "off"; render_timeout_ms?: number; native_only?: string[]; stub_unresolved?: boolean; browser_args?: string[]; fail_on_text?: string[]; steps?: unknown[]; timeoutMs?: number; mode?: "check" | "record" }): QaResult & { seconds: number; stage?: string; reasons?: string[] } {
  const app = resolve(o.appDir), out = resolve(o.out), t0 = Date.now(), uid = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  if (!existsSync(join(app, "package.json"))) return { ok: false, backend: "docker-dev", error: `no package.json in ${app}`, seconds: 0 };
  mkdirSync(out, { recursive: true });
  spawnSync("docker", ["run", "--rm", "--user", "0", "-v", `${PNPM_STORE_VOLUME}:/pnpm`, "node:22-bookworm-slim", "chown", uid, "/pnpm"], { encoding: "utf8", timeout: 60_000 });   // a new volume is root-owned
  const NAME = `qa-dev-${Date.now()}`;   // named, so a timeout or an interrupted caller can KILL it (a stopped host script leaves the container running)
  const r = spawnSync("docker", ["run", "--rm", "--name", NAME, "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "2g", "--cpus", "1", "--user", uid,
    "-e", "HOME=/tmp", ...(process.env.QA_PNPM_VERSION ? ["-e", `PNPM_VERSION=${process.env.QA_PNPM_VERSION}`] : []), "-e", "npm_config_store_dir=/pnpm/store", "-e", `QA_TYPECHECK=${o.typecheck ?? process.env.QA_TYPECHECK ?? "strict"}`, "-e", `QA_ROUTE=${o.route ?? "/"}`, ...(o.fail_on_text?.length ? ["-e", `QA_FAIL_ON_TEXT=${JSON.stringify(o.fail_on_text)}`] : []), ...(o.browser_args?.length ? ["-e", `QA_BROWSER_ARGS=${o.browser_args.join(" ")}`] : []), ...(o.stub_unresolved ? ["-e", "QA_STUB_UNRESOLVED=1"] : []), ...(o.native_only?.length ? ["-e", `QA_NATIVE_ONLY=${o.native_only.join(",")}`] : []), ...(o.render_timeout_ms ? ["-e", `QA_RENDER_TIMEOUT=${o.render_timeout_ms}`] : []), ...(o.steps ? ["-e", `QA_STEPS=${JSON.stringify(o.steps)}`] : []), "-e", `QA_VIEWPORT=${o.viewport ?? "390x844"}`, ...(o.start ? ["-e", `QA_START=${o.start}`] : []), ...(o.port ? ["-e", `QA_PORT=${o.port}`] : []), ...(o.type ? ["-e", `QA_TYPE=${o.type}`] : []), ...(o.mode === "check" ? ["-e", "QA_MODE=check"] : []),
    "-v", `${PNPM_STORE_VOLUME}:/pnpm`, "-v", `${app}:/src:ro`, "-v", `${out}:/out`, "-v", `${import.meta.dir}:/qa:ro`, "-w", "/tmp", "--entrypoint", "sh", QA_IMAGE, "/qa/dev_qa.sh"],
    { encoding: "utf8", timeout: o.timeoutMs ?? 300_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.signal) spawnSync("docker", ["kill", NAME], { timeout: 20_000 });   // timeout: do not leave it running
  const json = join(out, "qa.json"), video = join(out, "qa.webm"), summary = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : undefined;
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`, seconds = Math.round((Date.now() - t0) / 1000), healthy = !!summary?.ok && r.status === 0;
  // END REPORT (one small text file, any outcome): was it working, at which stage, why not, what evidence exists. The master reads this instead of looking at a picture.
  const spawnErr = r.error && (r.error as NodeJS.ErrnoException).code !== "ETIMEDOUT" ? `docker could not be started: ${r.error.message}` : r.error ? `the check timed out after ${Math.round((o.timeoutMs ?? 300_000) / 1000)} s` : undefined;   // never "unknown": say why the container did not run
  const setupFail = !summary ? (spawnErr ? [spawnErr, ...setupFailLines(text)] : setupFailLines(text)) : [];   // the container died before the check wrote anything (install failed ...): say so, never "unknown"
  const stageName = summary?.stage ?? (setupFail.length || r.status ? "install/setup" : "?");
  const okNow = healthy && (o.mode === "check" || existsSync(video));
  const lines = [`QA REPORT: ${okNow ? "WORKING" : "NOT WORKING"}`, `mode: ${o.mode ?? "record"}   stage: ${stageName}   took: ${seconds} s`,
    ...(((summary?.reasons as string[] | undefined) ?? setupFail)).slice(0, 8).map((x) => "reason: " + x.replace(/\s+/g, " ").slice(0, 300)),
    `evidence: ${[existsSync(join(out, "typecheck.txt")) && "typecheck.txt", existsSync(join(out, "dev.log")) && "dev.log", existsSync(join(out, "qa.png")) && "qa.png (only needed when the logs say nothing)", existsSync(video) && "qa.webm"].filter(Boolean).join(", ") || "none"}`];
  try { writeFileSync(join(out, "REPORT.txt"), lines.join("\n") + "\n"); } catch { /* the report is a convenience */ }
  return { ok: o.mode === "check" ? healthy : healthy && existsSync(video), backend: "docker-dev", video: existsSync(video) ? video : undefined, screenshot: existsSync(join(out, "qa.png")) ? join(out, "qa.png") : undefined, json: summary ? json : undefined, summary, seconds,
    stage: stageName, reasons: (summary?.reasons as string[] | undefined) ?? setupFail,
    error: healthy ? undefined : ((summary?.reasons as string[] | undefined)?.[0] ?? text.split("\n").filter(Boolean).slice(-4).join(" | ")).slice(0, 400) };
}
if (import.meta.main) {
  const [a, b, route, viewport] = process.argv.slice(2); if (!a || !b) { console.log("usage: bun test_harness/infra/qa/web_dev_qa.ts <app folder> <out folder> [route] [viewport]"); process.exit(1); }
  const r = recordExpoDev({ appDir: a, out: b, route, viewport }); console.log(JSON.stringify({ ...r, summary: r.summary ? { title: r.summary.title, rendered: r.summary.rendered, page_errors: r.summary.page_errors, texts: (r.summary.texts as string[]).filter((t) => t.length < 80).slice(0, 8) } : undefined }, null, 1)); process.exit(r.ok ? 0 : 1);
}
/** Same thing for ANY app with a dev server (Vite, Next, ...): the declared `start` command and `port` are what differ. */
/** What went wrong when the container died before the check wrote anything (install failed ...): the error lines AND the 3 lines after each (pnpm prints the failing package AFTER "N lockfile entries failed verification:", which an error-only filter dropped), up to 10. */
export function setupFailLines(text: string): string[] {
  const ls = text.split("\n").map((l) => l.trim()), out: string[] = [];
  for (let i = 0; i < ls.length && out.length < 10; i++) {
    if (!/error|ERR_|×|failed|Unable|not found|Cannot connect|daemon|refused|No such image|permission denied/i.test(ls[i]!)) continue;
    for (const x of ls.slice(i, i + 4)) if (x && !out.includes(x) && out.length < 10) out.push(x);
    i += 3;
  }
  return out;
}
