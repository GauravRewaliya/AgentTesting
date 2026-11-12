// QA video of an Expo app by running ITS OWN web dev server in a throwaway container (what loopferry does in its sandbox: the repo's real dev command, then a Playwright recording).
// Same container rules as web_export.ts (volume `agent-testing-pnpm-store`, app mounted read-only, only <out> writable, 1 cpu / 2 GB, caps dropped, --rm); network ON (package registries are needed).
//   bun test_harness/infra/qa/web_dev_qa.ts <app folder> <out folder> [route] [viewport]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { QA_IMAGE, type QaResult } from "./run_qa.ts";
import { PNPM_STORE_VOLUME } from "./web_export.ts";

export function recordExpoDev(o: { appDir: string; out: string; route?: string; viewport?: string; start?: string; port?: number; type?: string; timeoutMs?: number }): QaResult & { seconds: number } {
  const app = resolve(o.appDir), out = resolve(o.out), t0 = Date.now(), uid = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  if (!existsSync(join(app, "package.json"))) return { ok: false, backend: "docker-dev", error: `no package.json in ${app}`, seconds: 0 };
  mkdirSync(out, { recursive: true });
  spawnSync("docker", ["run", "--rm", "--user", "0", "-v", `${PNPM_STORE_VOLUME}:/pnpm`, "node:22-bookworm-slim", "chown", uid, "/pnpm"], { encoding: "utf8", timeout: 60_000 });   // a new volume is root-owned
  const NAME = `qa-dev-${Date.now()}`;   // named, so a timeout or an interrupted caller can KILL it (a stopped host script leaves the container running)
  const r = spawnSync("docker", ["run", "--rm", "--name", NAME, "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "2g", "--cpus", "1", "--user", uid,
    "-e", "HOME=/tmp", "-e", "npm_config_store_dir=/pnpm/store", "-e", `QA_ROUTE=${o.route ?? "/"}`, "-e", `QA_VIEWPORT=${o.viewport ?? "390x844"}`, ...(o.start ? ["-e", `QA_START=${o.start}`] : []), ...(o.port ? ["-e", `QA_PORT=${o.port}`] : []), ...(o.type ? ["-e", `QA_TYPE=${o.type}`] : []),
    "-v", `${PNPM_STORE_VOLUME}:/pnpm`, "-v", `${app}:/src:ro`, "-v", `${out}:/out`, "-v", `${import.meta.dir}:/qa:ro`, "-w", "/tmp", "--entrypoint", "sh", QA_IMAGE, "/qa/dev_qa.sh"],
    { encoding: "utf8", timeout: o.timeoutMs ?? 300_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.signal) spawnSync("docker", ["kill", NAME], { timeout: 20_000 });   // timeout: do not leave it running
  const json = join(out, "qa.json"), video = join(out, "qa.webm"), summary = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : undefined;
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`, seconds = Math.round((Date.now() - t0) / 1000);
  return { ok: r.status === 0 && existsSync(video) && summary?.rendered === true, backend: "docker-dev", video: existsSync(video) ? video : undefined, screenshot: existsSync(join(out, "qa.png")) ? join(out, "qa.png") : undefined, json: summary ? json : undefined, summary, seconds,
    error: r.status === 0 && summary?.rendered ? undefined : (summary?.page_errors?.[0] ?? text.split("\n").filter(Boolean).slice(-4).join(" | ")).slice(-400) };
}
if (import.meta.main) {
  const [a, b, route, viewport] = process.argv.slice(2); if (!a || !b) { console.log("usage: bun test_harness/infra/qa/web_dev_qa.ts <app folder> <out folder> [route] [viewport]"); process.exit(1); }
  const r = recordExpoDev({ appDir: a, out: b, route, viewport }); console.log(JSON.stringify({ ...r, summary: r.summary ? { title: r.summary.title, rendered: r.summary.rendered, page_errors: r.summary.page_errors, texts: (r.summary.texts as string[]).filter((t) => t.length < 80).slice(0, 8) } : undefined }, null, 1)); process.exit(r.ok ? 0 : 1);
}
/** Same thing for ANY app with a dev server (Vite, Next, ...): the declared `start` command and `port` are what differ. */
export const recordDevServer = recordExpoDev;
