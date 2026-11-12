// WEB EXPORT of an Expo app, in a throwaway container, so the QA recorder has a page to record (an Expo app has no index.html until it is exported).
//   - the app folder is mounted READ-ONLY (/src); it is COPIED inside the container and `pnpm install` runs there (pnpm from corepack; NEVER npm, see CLAUDE.md): nothing is installed on the host and the workspace is never touched
//   - network is ON for this step only (pnpm needs it); all capabilities dropped, no-new-privileges, 1 cpu, 2 GB, 512 pids, non-root user; the container is removed afterwards (--rm)
//   - an import the app never declared in package.json (pnpm is strict about this) is added with `pnpm add` and the export retried; the packages are listed in <out>/added_deps.txt
//   - missing binary assets (a fixture is a text patch: no fonts/images) are stubbed in the COPY (stub_assets.mjs) and listed in <out>/stubbed_assets.txt
//   - the only writable host path is the output folder; result: <out>/dist/index.html (+ the routes' html, _expo/static/js/web/*.js)
//   - pnpm's content-addressable store (/pnpm/store) AND the app copy (/pnpm/app, deleted at the end) live in ONE volume `agent-testing-pnpm-store`: same filesystem, so pnpm HARD-LINKS instead of copying (fast, and one copy of each package on disk), reused by every export; `docker volume rm agent-testing-pnpm-store` forgets it
// bun test_harness/infra/qa/web_export.ts <app folder> <out folder>
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const EXPORT_IMAGE = "node:22-bookworm-slim", PNPM_STORE_VOLUME = "agent-testing-pnpm-store";
export interface ExportResult { ok: boolean; dist?: string; log: string; seconds: number; error?: string }

export function exportExpoWeb(o: { appDir: string; out: string; timeoutMs?: number }): ExportResult {
  const app = resolve(o.appDir), out = resolve(o.out), t0 = Date.now(), log = join(out, "export.log");
  if (!existsSync(join(app, "package.json"))) return { ok: false, log, seconds: 0, error: `no package.json in ${app}` };
  mkdirSync(out, { recursive: true });
  const uid = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  // a new docker volume is owned by root: hand it to the user the export runs as, once, or pnpm cannot write its store
  spawnSync("docker", ["run", "--rm", "--user", "0", "-v", `${PNPM_STORE_VOLUME}:/pnpm`, EXPORT_IMAGE, "chown", uid, "/pnpm"], { encoding: "utf8", timeout: 60_000 });
  const script = "sh /qa/export.sh";   // see export.sh: copy, pnpm install, stub assets, expo export (+ pnpm add of undeclared imports)
  const NAME = `qa-export-${Date.now()}`;   // named, so a timeout or an interrupted caller can KILL it (a stopped host script leaves the container running)
  const r = spawnSync("docker", ["run", "--rm", "--name", NAME, "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "2g", "--cpus", "1", "--user", uid,
    "-e", "HOME=/tmp", ...(process.env.QA_EXPORT_DEBUG ? ["-e", "QA_EXPORT_DEBUG=1"] : []), "-e", "npm_config_store_dir=/pnpm/store", "-v", `${PNPM_STORE_VOLUME}:/pnpm`, "-v", `${app}:/src:ro`, "-v", `${out}:/out`, "-v", `${import.meta.dir}:/qa:ro`, "-w", "/tmp", EXPORT_IMAGE, "sh", "-c", script],
    { encoding: "utf8", timeout: o.timeoutMs ?? 420_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.signal) spawnSync("docker", ["kill", NAME], { timeout: 20_000 });   // timeout: do not leave it running
  const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`; writeFileSync(log, text);
  const dist = join(out, "dist"), seconds = Math.round((Date.now() - t0) / 1000);
  if (r.status === 0 && existsSync(join(dist, "index.html"))) return { ok: true, dist, log, seconds };
  return { ok: false, log, seconds, error: (r.error ? String(r.error) + " " : "") + text.split("\n").filter(Boolean).slice(-6).join(" | ").slice(-500) };
}
if (import.meta.main) {
  const [a, b] = process.argv.slice(2); if (!a || !b) { console.log("usage: bun test_harness/infra/qa/web_export.ts <app folder> <out folder>"); process.exit(1); }
  const r = exportExpoWeb({ appDir: a, out: b }); console.log(JSON.stringify(r, null, 1)); process.exit(r.ok ? 0 : 1);
}
