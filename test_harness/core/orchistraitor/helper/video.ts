// EXTRA FLAG helper `--video`: record a QA video AFTER a case, from OUTSIDE the harness (some harnesses do this internally; ours do not, so the runner passes the flag).
// Harness-independent: it only needs the workspace folder and a store folder. Used by f1_multiagent/testrun/run.ts; any other runner can call it the same way.
//   const r = await videoAfterRun({ workspace, storeDir });      // storeDir/qa/<app>-<ts>/qa.webm|png|json
// What can be recorded: a WEB page (an `index.html` in run_test/<dir>/ or run_test/<dir>/dist/), and an EXPO app that has web support (react-native-web in package.json): it is exported first, in a throwaway container
// (infra/qa/web_export.ts: pnpm install + `expo export --platform web` inside Docker, nothing on the host; a few minutes, a few hundred MB in the npm cache volume). Skip that with QA_EXPO_EXPORT=0.
// An Expo app WITHOUT react-native-web, or a failed export, records nothing and says why in store/qa/NO_VIDEO.txt. `route` (e.g. "/3d-rotate") picks the screen to open.
// Backend: QA_SANDBOX=docker (default) | off | e2b(not implemented), see test_harness/infra/qa/run_qa.ts. Needs the image once: bun test_harness/infra/qa/run_qa.ts --build
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordQa } from "../../../infra/qa/run_qa.ts";
import { exportExpoWeb } from "../../../infra/qa/web_export.ts";
import { recordExpoDev } from "../../../infra/qa/web_dev_qa.ts";
import type { QaSpec } from "../../../../TestCases/types.ts";

export interface VideoResult { ok: boolean; videos: string[]; skipped?: string; notes: string[] }
/** Folders under <workspace>/run_test that hold a web page (index.html, or dist/index.html of a web export), at most `max`. */
/** Expo apps in run_test with web support (expo + react-native-web in package.json). */
export function expoWebApps(workspace: string): string[] {
  const root = join(workspace, "run_test"); if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => { try { const p = JSON.parse(readFileSync(join(root, d, "package.json"), "utf8")), deps = { ...p.dependencies, ...p.devDependencies }; return !!(deps.expo && deps["react-native-web"]); } catch { return false; } });
}
export function findWebApps(workspace: string, max = 3): string[] {
  const root = join(workspace, "run_test"); if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const d of readdirSync(root)) {
    const p = join(root, d); if (!statSync(p).isDirectory()) continue;
    for (const cand of [p, join(p, "dist")]) if (existsSync(join(cand, "index.html"))) { out.push(cand); break; }
    if (out.length >= max) break;
  }
  return out;
}
const noVideo = (storeDir: string, why: string, workspace: string): VideoResult => {
  mkdirSync(join(storeDir, "qa"), { recursive: true }); writeFileSync(join(storeDir, "qa", "NO_VIDEO.txt"), `--video was asked, but no video was made.\nReason: ${why}\nWorkspace checked: ${join(workspace, "run_test")}\n`);
  return { ok: false, videos: [], skipped: why, notes: [] };
};
/** `qa`: what the CASE declared (`Case.qa(req)` in TestCases/types.ts). A spec says how to record or why not; `null` = the case declares nothing: skipped (QA_AUTO=1 detects a web page instead); `undefined` = old behaviour (detect). */
export async function videoAfterRun(o: { workspace: string; storeDir: string; route?: string; qa?: QaSpec | null }): Promise<VideoResult> {
  if (o.qa === null && process.env.QA_AUTO !== "1") return noVideo(o.storeDir, "this case does not declare `qa` (TestCases/types.ts Case.qa): not marked as QA-testable, so no video", o.workspace);
  if (o.qa && !o.qa.enabled) return noVideo(o.storeDir, `case says no video: ${o.qa.why}`, o.workspace);
  if (o.qa && o.qa.enabled) {   // the case says HOW: record exactly that
    const spec = o.qa, app = join(o.workspace, "run_test", spec.app), out = join(o.storeDir, "qa", `${spec.app}-${Date.now()}`);
    if (!existsSync(app)) return noVideo(o.storeDir, `qa spec names run_test/${spec.app} but it does not exist (the agents did not build it)`, o.workspace);
    const r = spec.kind === "static" ? recordQa({ appDir: app, out, route: spec.route ?? o.route, viewport: spec.viewport }) : recordExpoDev({ appDir: app, out, route: spec.route ?? o.route, viewport: spec.viewport, start: spec.start, port: spec.port, type: spec.type, typecheck: spec.typecheck, render_timeout_ms: spec.render_timeout_ms, native_only: spec.native_only, stub_unresolved: spec.stub_unresolved, browser_args: spec.browser_args, fail_on_text: spec.fail_on_text, timeoutMs: spec.timeout_ms });
    return r.ok && r.video ? { ok: true, videos: [r.video], notes: [] } : { ...noVideo(o.storeDir, `${spec.kind} QA of run_test/${spec.app} failed: ${r.error ?? "no video"}`, o.workspace), notes: [`stage ${(r as { stage?: string }).stage ?? "?"} (broken app caught BEFORE any video time)`, ...(((r as { reasons?: string[] }).reasons ?? [r.error ?? ""]).slice(0, 4))] };
  }
  const apps = findWebApps(o.workspace), notes: string[] = [];
  if (!apps.length && process.env.QA_EXPO_EXPORT !== "0") {   // an Expo app with web support: export it first
    for (const d of expoWebApps(o.workspace)) {
      const ex = exportExpoWeb({ appDir: join(o.workspace, "run_test", d), out: join(o.storeDir, "web", d) });
      if (ex.ok && ex.dist) apps.push(ex.dist); else notes.push(`export of ${d} failed after ${ex.seconds}s: ${ex.error ?? "?"} (log: ${ex.log})`);
    }
  }
  if (!apps.length) {
    const expoWeb = expoWebApps(o.workspace);
    const why = expoWeb.length
      ? `no video: run_test/${expoWeb.join(", run_test/")} is an Expo app with web support but its web export ${process.env.QA_EXPO_EXPORT === "0" ? "is switched off (QA_EXPO_EXPORT=0)" : "failed"}: ${notes.join("; ") || "see the export log in store/web/"}`
      : "no web page to record: run_test has no index.html and no Expo web app was found";
    mkdirSync(join(o.storeDir, "qa"), { recursive: true }); writeFileSync(join(o.storeDir, "qa", "NO_VIDEO.txt"), `--video was asked, but no video was made.\nReason: ${why}\nWorkspace checked: ${join(o.workspace, "run_test")}\n`);   // the folder explains itself (an empty store/ looked like a failure)
    return { ok: false, videos: [], skipped: why, notes };
  }
  const videos: string[] = []; let ok = true;
  for (const app of apps) {
    const name = app.split("/").filter(Boolean).slice(-2).join("_"), r = recordQa({ appDir: app, out: join(o.storeDir, "qa", `${name}-${Date.now()}`), route: o.route });
    if (r.ok && r.video) videos.push(r.video); else { ok = false; notes.push(`${name}: ${r.error ?? "failed"}`); }
  }
  return { ok, videos, notes };
}
