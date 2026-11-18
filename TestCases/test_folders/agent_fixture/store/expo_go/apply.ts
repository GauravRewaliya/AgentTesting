// Shared by every recorded expo-go result (agent_fixture/results/role-expo-go-*.ts). The orchestrator is what is tested, so the sub-agent is NOT run:
// this does its work from the developer's REAL history instead: phase 1 puts the start state (bases/<name>) into run_test/<dir>,
// then the commit's real diff (patches/<name>/NN_<sha>.patch) is applied with `git apply`, PLAN.md gets the phase section, and a REPORT line comes back.
// Not a results/*.ts file on purpose: loadResults imports every .ts in results/ and wants a default export there.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Req } from "@core/types.ts";
import { phases, source } from "../../../Cases/real_usecases/test_expo_go/lib/data.ts";   // parsed + validated against lib/types.ts
import type { ExpoGoVerdict } from "../../../Cases/real_usecases/test_expo_go/lib/types.ts";
import { buildSlim } from "./slim_demo.ts";
import { FOLIO_BUILD } from "./folio_build.ts";

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

// Expo Go ships these native modules; everything else that is not a plain JS package needs a development build.
const IN_EXPO_GO = /^(expo|expo-[a-z-]+|react|react-native|react-native-gesture-handler|react-native-reanimated|react-native-worklets|react-native-safe-area-context|@shopify\/react-native-skia|react-native-skia)$/;
const USES: [RegExp, string][] = [[/\bGPU[A-Z]\w+|navigator\.gpu|@vertex|@fragment/, "react-native-webgpu"], [/\bSkia\b|CanvasKit|SkSurface/, "@shopify/react-native-skia"], [/useSharedValue|'worklet'|"worklet"/, "react-native-reanimated"], [/\bGesture\.[A-Z]/, "react-native-gesture-handler"]];
const BUILTIN = new Set(["fs", "path", "os", "url", "crypto", "child_process", "util", "assert"]);
const pkgOf = (spec: string) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!);
const walk = (root: string, rel: string): string[] => !existsSync(join(root, rel)) ? [] : statSync(join(root, rel)).isDirectory() ? readdirSync(join(root, rel)).flatMap((e) => walk(root, `${rel}/${e}`)) : [rel];

/** What the step READ, taken from the real source in run_test/<dir_src>: files with line counts + a one-line purpose, and every external package with its Expo Go verdict. */
function readNotes(req: Req, r: ModuleRun): { lines: string[]; total: number; packages: Map<string, boolean> } {
  const root = join(req.ws, r.dir_src), files = r.files.split(",").map((x) => x.trim()).flatMap((g) => (g.endsWith("/*") ? walk(root, g.slice(0, -2)) : walk(root, g))).sort();
  const packages = new Map<string, boolean>(), lines: string[] = []; let total = 0;
  for (const f of files) {
    const txt = readFileSync(join(root, f), "utf8"), n = txt.split("\n").length; total += txt.length;
    const why = (txt.split("\n").find((l) => /^\s*(\/\/|\/\*\*?|#)\s*\S/.test(l)) ?? "").replace(/^\s*(\/\/|\/\*\*?|#)\s*/, "").slice(0, 110);
    lines.push(`- ${f} (${n} lines)${why ? `: ${why}` : ""}`);
    if (/\.(tsx?|jsx?|js)$/.test(f)) for (const m of txt.matchAll(/(?:from\s+|import\s+|require\()['"]([^'"]+)['"]/g)) { const spec = m[1]!; if (!spec.startsWith(".") && !spec.startsWith("node:") && !BUILTIN.has(spec)) packages.set(pkgOf(spec), IN_EXPO_GO.test(pkgOf(spec))); }
    // code that gets its API passed in (a GPUDevice, a Skia object) imports nothing: the API it USES names the package
    for (const [re, pkg] of USES) if (re.test(txt)) packages.set(pkg, IN_EXPO_GO.test(pkg));
    if (/^(modules|plugins)\//.test(f)) packages.set(`${f.split("/").slice(0, 2).join("/")} (local native code / config plugin)`, false);
    if (f === "app.json") packages.set(`(config) ${f}`, !/plugins|withSceneLifecycle/.test(txt));
  }
  return { lines, total, packages };
}

/** One module step of a single-commit repo: no diff exists, so step 1 provides the source and every step writes its PLAN.md section (derived from the real source) + the small deliverables of FOLIO_BUILD + an honest REPORT. */
export function applyModule(req: Req, r: ModuleRun): string {
  if (r.n === 1) putBase(req, r.name, r.dir_src);
  const notes = readNotes(req, r), built = Object.keys(FOLIO_BUILD[r.n] ?? {}).filter(() => r.name === "folio-popup-book");
  for (const f of built) { const to = join(req.ws, r.dir_out, f); mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, FOLIO_BUILD[r.n]![f]!); }
  const pk = [...notes.packages].sort(([a], [b]) => a.localeCompare(b));
  plan(req, r.dir_out, [`\n## Step ${r.n} of ${r.N}: ${r.title}`, `Read (${notes.lines.length} files, ~${Math.round(notes.total / 1024)} KB) in run_test/${r.dir_src} (read-only):`, ...notes.lines,
    `\nExpo Go check: ${r.expo_go}${r.blockers.length ? `, blockers: ${r.blockers.join(", ")}` : ""}`, "| package | stock Expo Go |", "|---|---|", ...pk.map(([k, ok]) => `| ${k} | ${ok ? "runs" : "does NOT run (needs a development build)"} |`),
    built.length ? `\nBuilt in run_test/${r.dir_out}: ${built.join(", ")}` : "\nBuilt: nothing (this step is analysis only)"].join("\n"));
  return `STEP ${r.n}/${r.N} DONE: ${r.title}\nThis answer is COMPLETE: the explanation and the Expo Go table are in run_test/${r.dir_out}/PLAN.md (the section for this step), ${built.length ? "the code is in " + built.map((f) => `run_test/${r.dir_out}/${f}`).join(", ") : "no code was needed"}. Nothing is left to do for this step.\n`
    + report({ summary: r.title, files: [`${r.dir_out}/PLAN.md`, ...built.map((f) => `${r.dir_out}/${f}`)], skills: r.skills, expo_go: r.expo_go, blockers: r.blockers });
}


/** CLONE ONCE: the sub-agent clones a git repo (shallow, blobless, SPARSE: only what the slim runners need) at a pinned sha into run_test/<dir>, builds one SLIM runner app per demo (slim_demo.ts: run_test/<slug>-app) and writes PLAN.md. Nothing is run here:
 *  the run + video are separate test nodes (branches that share this workspace). Needs network (a real clone, no model). `name` only labels the source in sources.json. */
export function cloneRepo(req: Req, o: { name: string; repo: string; sha: string; dir: string; slims: string[] }): string {
  const out = join(req.ws, o.dir);
  if (existsSync(join(out, "package.json"))) return `ALREADY CLONED: run_test/${o.dir} exists (nothing new to do). Slim runners: ${o.slims.map((s) => `run_test/${s}-app`).join(", ")}`;
  const tmp = join(req.ws, `.clone-${Date.now()}`), g = (a: string[], cwd = tmp) => spawnSync("git", a, { cwd, encoding: "utf8", timeout: 240_000 });
  mkdirSync(tmp, { recursive: true });
  g(["init", "-q"]); g(["remote", "add", "origin", o.repo]);
  // SMALL clone: a slim run needs only package.json, the registry, the demo folders and the app-shell file they import, not the whole collection repo (116 MB). Blobless + sparse = a few MB.
  const sparse = ["/package.json", "/src/animations/registry.ts", ...o.slims.map((s) => `/src/animations/${s}/`), "/src/navigation/home/launch-transition.tsx"];
  g(["config", "core.sparseCheckout", "true"]); mkdirSync(join(tmp, ".git", "info"), { recursive: true }); writeFileSync(join(tmp, ".git", "info", "sparse-checkout"), sparse.join("\n") + "\n");
  const f = g(["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", o.sha]);
  if (f.status !== 0 || g(["checkout", "-q", "FETCH_HEAD"]).status !== 0) { spawnSync("rm", ["-rf", tmp]); return `ERROR: could not clone ${o.repo} at ${o.sha.slice(0, 7)}: ${(f.stderr || f.stdout).slice(0, 200)}`; }
  spawnSync("rm", ["-rf", join(tmp, ".git")]); mkdirSync(dirname(out), { recursive: true }); cpSync(tmp, out, { recursive: true }); spawnSync("rm", ["-rf", tmp]);
  const built = o.slims.map((slug) => ({ slug, r: buildSlim({ ws: req.ws, cloneDir: o.dir, slug, outDir: `${slug}-app` }) }));
  const summary = built.map((b) => `run_test/${b.slug}-app ${b.r.ok ? "OK" : "FAILED"} (${b.r.notes.join("; ")})`).join("\n- ");
  plan(req, o.dir, `## Clone once\n- cloned ${o.repo} at ${o.sha.slice(0, 7)} into run_test/${o.dir} (sparse: package.json, the registry and the demo folders)\n- slim runners:\n- ${summary}\n- run each one (pnpm only): cd run_test/<demo>-app && corepack pnpm install && corepack pnpm exec expo start --web\n- nothing else is changed\n`);
  return `CLONED ${o.repo} (${o.sha.slice(0, 7)}) into run_test/${o.dir}. PLAN.md written. Slim runner apps (one per demo, each renders only that demo):\n- ${summary}\nTo run one: cd run_test/<demo>-app && corepack pnpm install && corepack pnpm exec expo start --web. I did not run them and did not change any code in the clone.\n`
    + report({ summary: `cloned ${o.name}`, files: [`${o.dir}/package.json`, `${o.dir}/PLAN.md`, ...built.filter((b) => b.r.ok).map((b) => `${b.slug}-app/package.json`)], skills: ["expo-router"], expo_go: "ok", blockers: [] });
}
