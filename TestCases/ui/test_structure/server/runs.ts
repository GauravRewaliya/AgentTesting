// Runs of the fixture-mock runner: `bun core/run.ts <suite> <case...>` in test_harness (real lead on haiku, sub-agents answered from agent_fixture, state in test_harness/.state/<version>).
// The second kind of run, next to the f1 harness behind the ExperimentRun page (server/experiment.ts). One at a time: both share run_test/.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentWorkspace, HARNESS, workspaceDir } from "@core/paths.ts";
import { loadSuites } from "./data.ts";
import type { CaseRuns, RunSummary, SessionRun, StateRun, StateRunLog } from "../shared/types.ts";

const runsDir = () => join(workspaceDir(), "runs");   // per request: follows the pointer
const meta = (id: string) => join(runsDir(), id + ".json"), logf = (id: string) => join(runsDir(), id + ".log"), exitf = (id: string) => join(runsDir(), id + ".exit");
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function read(id: string): StateRun | undefined {
  try {
    const r = JSON.parse(readFileSync(meta(id), "utf8")) as StateRun;
    if (r.status === "running" && !alive(r.pid)) {   // the shell wrapper writes `$?` to the exit file BEFORE it exits; an empty/missing file = not written yet (or it was killed)
      const txt = existsSync(exitf(id)) ? readFileSync(exitf(id), "utf8").trim() : "";
      const code = txt === "" ? null : Number(txt);
      if (code === null && Date.now() - r.startedAt < 3000) return r;   // just started / just ending: do not guess
      r.exitCode = code; r.status = code === 0 ? "done" : "failed"; r.endedAt ??= Date.now(); writeFileSync(meta(id), JSON.stringify(r));
    }
    return r;
  } catch { return undefined; }
}
export function listRuns(): StateRun[] {
  if (!existsSync(runsDir())) return [];   // never create a workspace folder just by looking
  return readdirSync(runsDir()).filter((f) => f.endsWith(".json")).map((f) => read(f.slice(0, -5))).filter((x): x is StateRun => !!x).sort((a, b) => b.startedAt - a.startedAt).slice(0, 30);
}

/** Every step of the chain a case belongs to, in run order: its ancestors (`after`) from the first step, the case itself, then everything that continues from it. A case with no links is just itself. */
export function chainOf(cases: { id: string; after?: string }[], id: string): string[] {
  const by = new Map(cases.map((c) => [c.id, c])), up: string[] = [];
  for (let c = by.get(id); c; c = c.after ? by.get(c.after) : undefined) up.unshift(c.id);
  const inChain = new Set(up);
  for (const c of cases) if (c.after && inChain.has(c.after)) inChain.add(c.id);   // suite order = parents before children
  return cases.filter((c) => inChain.has(c.id)).map((c) => c.id);
}

/** Run ALL steps of the case's chain, in order, in one go (a step that already has a result is skipped unless `rerun`; then every step runs again and its old result is archived). */
export async function startRun(b: { case: string; rerun?: boolean }): Promise<StateRun> {
  if (!/^[\w-]+$/.test(b.case)) throw new Error("bad case id");
  if (listRuns().some((r) => r.status === "running")) throw new Error("a run is already going; wait for it or stop it (two runs share run_test/)");
  const suites = await loadSuites(), s = suites.find((x) => x.cases.some((c) => c.id === b.case));
  if (!s) throw new Error(`unknown case ${b.case}`);
  const chain = chainOf(s.cases, b.case);
  mkdirSync(runsDir(), { recursive: true });
  const id = "r" + Date.now().toString(36), fd = openSync(logf(id), "a");
  const p = spawn("sh", ["-c", 'bun "$@"; echo $? > "$RUN_EXIT_FILE"', "sh", "core/run.ts", s.suite, ...chain, ...(b.rerun ? ["--rerun"] : [])], { cwd: HARNESS, detached: true, stdio: ["ignore", fd, fd], env: { ...process.env, RUN_EXIT_FILE: exitf(id) } });
  p.unref();
  const run: StateRun = { id, suite: s.suite, cases: chain, rerun: !!b.rerun, startedAt: Date.now(), pid: p.pid ?? 0, status: "running" };
  writeFileSync(meta(id), JSON.stringify(run));
  return run;
}
export function stopRun(id: string): StateRun {
  const r = read(id); if (!r) throw new Error("no such run");
  if (r.status === "running") { try { process.kill(-r.pid, "SIGTERM"); } catch { try { process.kill(r.pid, "SIGTERM"); } catch { /* gone */ } } r.status = "stopped"; r.endedAt = Date.now(); writeFileSync(meta(id), JSON.stringify(r)); }
  return r;
}
export function runLog(id: string): StateRunLog {
  const run = read(id); if (!run) throw new Error("no such run");
  let log = ""; try { log = readFileSync(logf(id), "utf8"); } catch { /* not written yet */ }
  return { run, log: log.length > 30000 ? "…\n" + log.slice(-30000) : log };
}

// ---- what the page shows: the current result of a case in THIS workspace, its archived earlier results, and the session runs (UI triggers) that included it
type LastFile = { at: string; status: string; warnings?: string[]; turns?: { match: boolean; guard: boolean; notfound: boolean; cost: number }[] };
const readLast = (f: string): LastFile | undefined => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return undefined; } };
const summarize = (j: LastFile, n: number, source: RunSummary["source"]): RunSummary => ({
  source, n, at: j.at, status: j.status, ok: j.status === "ran" && !!j.turns?.length && j.turns.every((t) => t.match && !t.guard && !t.notfound),
  cost: (j.turns ?? []).reduce((s, t) => s + (t.cost ?? 0), 0), turns: j.turns?.length ?? 0, notes: j.warnings ?? []
});
const subState = (caseId: string): "ok" | "fail" | "not_run" => { const j = readLast(join(workspaceDir(), "last", caseId + ".json")); return !j ? "not_run" : summarize(j, 0, "now").ok ? "ok" : "fail"; };
const withSub = (r: StateRun): SessionRun => ({ ...r, sub: r.cases.map((c) => ({ caseId: c, state: subState(c) })) });

export const sessionRuns = (): SessionRun[] => listRuns().map(withSub);
export async function caseRuns(caseId: string): Promise<CaseRuns> {
  if (!/^[\w-]+$/.test(caseId)) throw new Error("bad case id");
  const last = readLast(join(workspaceDir(), "last", caseId + ".json")), cache = join(workspaceDir(), "cache");
  const history = !existsSync(cache) ? [] : readdirSync(cache).map((d) => ({ d, m: d.match(new RegExp("^" + caseId + "\\.(\\d+)$")) })).filter((x) => x.m).map((x) => ({ n: Number(x.m![1]), j: readLast(join(cache, x.d, "last.json")) }))
    .filter((x): x is { n: number; j: LastFile } => !!x.j).sort((a, b) => b.n - a.n).map((x) => summarize(x.j, x.n, "archived"));
  const s = (await loadSuites()).find((x) => x.cases.some((c) => c.id === caseId));
  return { chain: s ? chainOf(s.cases, caseId) : [caseId], workspace: currentWorkspace(), current: last ? summarize(last, 0, "now") : null, history, sessionRuns: sessionRuns().filter((r) => r.cases.includes(caseId)) };
}

/** `claude -p` as the judge: it reads the run log (EXPECTED vs ACTUAL lines the runner prints) and says per case PASS/FAIL and why. Saved next to the run so it is judged once. */
const judgef = (id: string) => join(runsDir(), id + ".judge.txt");
export async function judgeRun(id: string, again = false): Promise<{ id: string; verdict: string }> {
  if (!/^[\w-]+$/.test(id)) throw new Error("bad run id");
  const { run, log } = runLog(id);
  if (run.status === "running") throw new Error("the run is still going: judge it when it ends");
  if (!again && existsSync(judgef(id))) return { id, verdict: readFileSync(judgef(id), "utf8") };
  const prompt = "You judge a test run of a multi-agent orchestrator. Below is the runner log. For each case compare the EXPECTED lines with what ACTUALLY happened (responders, calls, hand-over, files, lead reply). "
    + "Answer in plain text, no tools: one line per case `PASS <case> - reason` or `FAIL <case> - reason` (say what differs), then one line `ISSUE:` naming the most likely cause if anything failed (e.g. thin hand-over, wrong sub-agent, cached/not run, runner crash).\n\n" + log;
  const p = Bun.spawn(["claude", "-p", "--model", "haiku", "--allowedTools", ""], { cwd: HARNESS, stdin: new Blob([prompt]), stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0 || !out.trim()) throw new Error("judge failed: " + (err.trim().slice(-300) || `exit ${code}`));
  writeFileSync(judgef(id), out.trim()); return { id, verdict: out.trim() };
}
