// PARALLEL runner for a suite: the independent CHAINS of a suite (a case with `after` continues the workspace of its parent) run at the same time, each chain in order, in its own process.
//   bun testrun/par.ts <suite> [--jobs=4] [--fake] [--video] [--rerun]      (all other flags go to testrun/run.ts)
// Why: a case costs 20 to 70 s because the LEAD is a real model (sub-agents are fixtures: milliseconds). 33 Expo cases one after another = ~30 min; the 8 independent chains in parallel = the longest chain.
// Each process has its own task, store and workspace (.state/<STATE_VERSION>/<task>/), one exp file per case, and HARNESS_MAX_LEADS=<jobs> lets that many leads run at once (default is 1 machine-wide).
// Output of each chain: test_harness/.state/<STATE_VERSION>/par/<suite>-<time>/<chain root>.txt ; the summary prints PASS/FAIL per case and the wall time per chain and in total.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSuites } from "./cases.ts";
import { STATE_VERSION } from "@core/paths.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), argv = process.argv.slice(2), suite = argv.find((a) => !a.startsWith("--"));
const jobs = Number(argv.find((a) => a.startsWith("--jobs="))?.split("=")[1] ?? 4), pass = argv.filter((a) => a.startsWith("--") && !a.startsWith("--jobs=")), want = argv.filter((a) => !a.startsWith("--")).slice(1);
if (!suite) { console.log("usage: bun testrun/par.ts <suite> [case ...] [--jobs=4] [--fake] [--video] [--rerun]"); process.exit(1); }
const all = (await loadSuites()).filter((c) => c.suite === suite && (!want.length || want.includes(c.id)));
const rootOf = (id: string): string => { const c = all.find((x) => x.id === id); return c?.after && all.some((x) => x.id === c.after) ? rootOf(c.after) : id; };
const groups = new Map<string, string[]>(); for (const c of all) { const r = rootOf(c.id); groups.set(r, [...(groups.get(r) ?? []), c.id]); }
const out = join(ROOT, "..", "..", "..", ".state", STATE_VERSION, "par", `${suite}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`); mkdirSync(out, { recursive: true });
console.log(`${suite}: ${all.length} cases in ${groups.size} chains, ${jobs} at a time. Output: ${out}`);
const queue = [...groups].sort((a, b) => b[1].length - a[1].length), results: { root: string; ids: string[]; secs: number; code: number }[] = [], t0 = Date.now();
async function worker() {
  for (let g = queue.shift(); g; g = queue.shift()) {
    const [root, ids] = g, t = Date.now(), log = createWriteStream(join(out, root + ".txt"));
    const code = await new Promise<number>((done) => { const p = spawn("bun", ["testrun/run.ts", suite!, ...ids, ...pass], { cwd: ROOT, env: { ...process.env, HARNESS_MAX_LEADS: String(jobs) } }); p.stdout.pipe(log, { end: false }); p.stderr.pipe(log, { end: false }); p.on("close", (c) => { log.end(); done(c ?? 1); }); });
    results.push({ root, ids, secs: Math.round((Date.now() - t) / 1000), code }); console.log(`  chain ${root} (${ids.length} cases) finished in ${Math.round((Date.now() - t) / 1000)} s, exit ${code}`);
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, groups.size) }, worker));
let pa = 0, fa = 0; for (const r of results) { let txt = ""; try { txt = readFileSync(join(out, r.root + ".txt"), "utf8"); } catch { /* none */ } for (const m of txt.matchAll(/^=> (\S+): (PASS|FAIL)/gm)) { m[2] === "PASS" ? pa++ : fa++; console.log(`    ${m[2]}  ${m[1]}`); } }
console.log(`\n${suite}: ${pa} PASS, ${fa} FAIL of ${all.length} in ${Math.round((Date.now() - t0) / 1000)} s wall (sequential would be the sum of the chains: ${results.reduce((a, r) => a + r.secs, 0)} s)`);
process.exit(fa || results.some((r) => r.code > 1) ? 1 : 0);
