// Shared by every recorded expo-go result (agent_fixture/results/role-expo-go-*.ts). The orchestrator is what is tested, so the sub-agent is NOT run:
// this does its work from the developer's REAL history instead: phase 1 puts the start state (bases/<name>) into run_test/<dir>,
// then the commit's real diff (patches/<name>/NN_<sha>.patch) is applied with `git apply`, PLAN.md gets the phase section, and a REPORT line comes back.
// Not a results/*.ts file on purpose: loadResults imports every .ts in results/ and wants a default export there.
import { cpSync, existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Req } from "@core/types.ts";
import { phases, source } from "../../../test_expo_go/lib/data.ts";   // parsed + validated against lib/types.ts
import type { ExpoGoVerdict } from "../../../test_expo_go/lib/types.ts";
import { buildSlim } from "./slim_demo.ts";

export type PhaseRun = { name: string; n: number; dir: string; skills: string[]; expo_go: ExpoGoVerdict; blockers?: string[] };

const report = (o: object) => `REPORT: ${JSON.stringify(o)}`;
function plan(req: Req, dir: string, text: string) {
  mkdirSync(join(req.ws, dir), { recursive: true });
  appendFileSync(join(req.ws, dir, "PLAN.md"), text.endsWith("\n") ? text : text + "\n");
}
function putBase(req: Req, name: string, dir: string) {
  const base = join(req.store, "expo_go", "bases", name);
  if (existsSync(base)) cpSync(base, join(req.ws, dir), { recursive: true });
  else mkdirSync(join(req.ws, dir), { recursive: true });   // empty start (the project did not exist yet)
}

/** One git-history phase: start state (phase 1) + the real diff of that commit + PLAN.md + REPORT. */
export function applyPhase(req: Req, r: PhaseRun): string {
  const rows = phases[r.name], row = rows[r.n - 1];
  if (r.n === 1) putBase(req, r.name, r.dir);
  else if (!existsSync(join(req.ws, r.dir))) return `ERROR: run_test/${r.dir} does not exist; phase ${r.n} continues the work of phase ${r.n - 1}`;
  // path inside the repo decides how many leading directories the patch has: "a/" + each segment of `path` (none for the whole repo)
  const path = source(r.name).path ?? ".";
  const strip = 1 + (path === "." ? 0 : path.replace(/\*$/, "").split("/").length);
  plan(req, r.dir, `\n## Phase ${r.n} of ${rows.length}: ${row.subject}\n- files: ${row.files.join(", ") || "(see diff)"}\n- Expo Go check: ${r.expo_go}\n`);
  // GIT_CEILING_DIRECTORIES: run_test/ usually sits INSIDE a git repo, and inside a repo `git apply` silently skips files outside the current folder's tracked view and still exits 0.
  // With the parent as ceiling git does not see the repo and applies like plain `patch`.
  const p = spawnSync("git", ["apply", `-p${strip}`, `--directory=${r.dir}`, "--whitespace=nowarn", join(req.store, "expo_go", row.patch)], { cwd: req.ws, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(req.ws) } });
  if (p.status !== 0) return `ERROR: could not apply phase ${r.n}: ${(p.stderr || p.stdout).slice(0, 300)}`;
  // never report DONE on faith: every file the commit adds or changes must be there now (a deleted file is not in `files`)
  const missing = row.files.filter((f) => !existsSync(join(req.ws, r.dir, f.split("/").slice(strip - 1).join("/"))));
  if (missing.length) return `ERROR: phase ${r.n} applied but ${missing.length} file(s) are missing in run_test/${r.dir}: ${missing.slice(0, 5).join(", ")}`;
  const where = row.files.map((f) => `run_test/${r.dir}/${f.split("/").slice(strip - 1).join("/")}`);   // where the files REALLY are now (not the patch's repo paths)
  return `PHASE ${r.n}/${rows.length} DONE: all files are written in run_test/${r.dir}.\nPLAN.md: run_test/${r.dir}/PLAN.md (the section for this phase is written).\n${row.subject}\nchanged (${where.length}): ${where.join(", ") || "(deletions only)"}\n`
    + report({ summary: row.subject, files: where, skills: r.skills, expo_go: r.expo_go, blockers: r.blockers ?? [] });
}

export type ModuleRun = { name: string; n: number; N: number; dir_src: string; dir_out: string; title: string; files: string; skills: string[]; expo_go: ExpoGoVerdict; blockers: string[] };
/** One module step of a single-commit repo: no diff exists, so step 1 provides the source and every step writes its PLAN.md section + an honest REPORT. */
export function applyModule(req: Req, r: ModuleRun): string {
  if (r.n === 1) putBase(req, r.name, r.dir_src);
  plan(req, r.dir_out, `\n## Step ${r.n} of ${r.N}: ${r.title}\n- reads: ${r.files}\n- Expo Go check: ${r.expo_go}${r.blockers.length ? `, blockers: ${r.blockers.join(", ")}` : ""}\n`);
  return `STEP ${r.n}/${r.N} DONE: ${r.title}\n` + report({ summary: r.title, files: [`${r.dir_out}/PLAN.md`], skills: r.skills, expo_go: r.expo_go, blockers: r.blockers });
}


/** CLONE-AND-RUN: the sub-agent clones a git repo (shallow, at a pinned sha) into run_test/<dir> and writes PLAN.md; nothing else. Needs network (a real clone, no model). `name` only labels the source in sources.json. */
export function cloneRepo(req: Req, o: { name: string; repo: string; sha: string; dir: string; run: string; slim?: { slug: string } }): string {
  const out = join(req.ws, o.dir);
  if (existsSync(join(out, "package.json"))) return `ALREADY CLONED: run_test/${o.dir} exists (nothing new to do). To run: ${o.run}`;
  const tmp = join(req.ws, `.clone-${Date.now()}`), g = (a: string[], cwd = tmp) => spawnSync("git", a, { cwd, encoding: "utf8", timeout: 240_000 });
  mkdirSync(tmp, { recursive: true });
  g(["init", "-q"]); g(["remote", "add", "origin", o.repo]);
  const f = g(["fetch", "-q", "--depth", "1", "origin", o.sha]);
  if (f.status !== 0 || g(["checkout", "-q", "FETCH_HEAD"]).status !== 0) { spawnSync("rm", ["-rf", tmp]); return `ERROR: could not clone ${o.repo} at ${o.sha.slice(0, 7)}: ${(f.stderr || f.stdout).slice(0, 200)}`; }
  spawnSync("rm", ["-rf", join(tmp, ".git")]); mkdirSync(dirname(out), { recursive: true }); cpSync(tmp, out, { recursive: true }); spawnSync("rm", ["-rf", tmp]);
  // a big collection repo is run through a SLIM app (slim_demo.ts): ONLY the demo folder + its packages, built on the fly; the clone itself is untouched
  const slim = o.slim ? buildSlim({ ws: req.ws, cloneDir: o.dir, slug: o.slim.slug, outDir: `${o.slim.slug}-app` }) : undefined, run = slim?.ok ? `cd run_test/${o.slim!.slug}-app && corepack pnpm install && corepack pnpm exec expo start --web (the app renders only ${o.slim!.slug})` : o.run;
  plan(req, o.dir, `## Clone and run\n- cloned ${o.repo} at ${o.sha.slice(0, 7)} into run_test/${o.dir}\n${slim ? `- ${slim.ok ? "built the slim runner" : "slim runner FAILED"} run_test/${o.slim!.slug}-app (only the ${o.slim!.slug} demo and its packages; ${slim.notes.join("; ")})\n` : ""}- run (pnpm only): ${run}\n- nothing else is changed\n`);
  return `CLONED ${o.repo} (${o.sha.slice(0, 7)}) into run_test/${o.dir}. PLAN.md written. ${slim ? (slim.ok ? `Built the slim runner run_test/${o.slim!.slug}-app (only the ${o.slim!.slug} demo; ${slim.notes.join("; ")}). ` : `Slim runner failed: ${slim.notes.join("; ")}. `) : ""}To run it: ${run}. I did not change any code in the clone.\n`
    + report({ summary: `cloned ${o.name}`, files: [`${o.dir}/package.json`, `${o.dir}/PLAN.md`, ...(slim?.ok ? [`${o.slim!.slug}-app/package.json`] : [])], skills: ["expo-router"], expo_go: "ok", blockers: [] });
}
