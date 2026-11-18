// Runs of the f1 runner: `bun testrun/run.ts <suite> <case...>` in <orchestrator>: real lead (haiku), sub-agents answered from agent_fixture. The CLI, the Experiment page and the Flow page ALL start and read the SAME runs
// (server/experiment.ts: run list + logs; exp/<case>.json + .state/<v>/<home>/store: results). The Flow page only adds the chain: starting a case runs its missing `after` ancestors first.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS } from "@core/paths.ts";
import { loadSuites, readLast } from "./data.ts";
import * as exp from "./experiment.ts";
import type { CaseRuns, RunSummary, SessionRun, StateRun } from "../shared/types.ts";

const asRun = (r: exp.RunInfoLike): StateRun => ({ id: r.id, suite: r.suite, cases: r.cases, rerun: r.rerun, startedAt: r.startedAt, endedAt: r.endedAt, pid: r.pid, status: r.status, exitCode: r.exitCode });
export const listRuns = (): StateRun[] => exp.listRuns().map(asRun);

/** Every step of the chain a case belongs to, in run order: its ancestors (`after`) from the first step, the case itself, then everything that continues from it. A case with no links is just itself. */
export function chainOf(cases: { id: string; after?: string }[], id: string): string[] {
  const by = new Map(cases.map((c) => [c.id, c])), up: string[] = [];
  for (let c = by.get(id); c; c = c.after ? by.get(c.after) : undefined) up.unshift(c.id);
  const inChain = new Set(up);
  for (const c of cases) if (c.after && inChain.has(c.after)) inChain.add(c.id);   // suite order = parents before children
  return cases.filter((c) => inChain.has(c.id)).map((c) => c.id);
}

/** "Run" = the same command as the CLI. A case that already ran gets its prompts sent AGAIN into its existing session (`--again`: no archive, no new task) and the answers are judged; a case that never ran starts its chain at the first missing ancestor. */
export async function startRun(b: { case: string }): Promise<StateRun> {
  if (!/^[\w-]+$/.test(b.case)) throw new Error("bad case id");
  const suites = await loadSuites(), s = suites.find((x) => x.cases.some((c) => c.id === b.case));
  if (!s) throw new Error(`unknown case ${b.case}`);
  const ran = !!exp.caseEntry(b.case)?.done;
  return asRun(exp.startRun({ suite: s.suite, cases: ran ? [b.case] : chainOf(s.cases, b.case), again: ran }));
}
export const stopRun = (id: string): StateRun => asRun(exp.stopRun(id));
export const runLog = (id: string) => { const x = exp.runLog(id); return { run: asRun(x.run), log: x.log }; };

// ---- what the page shows: the result of a case (exp), and the runs that included it or one of its ancestors
const okOf = (id: string): "ok" | "fail" | "skipped" | "not_run" => { const l = readLast(id); return !l ? "not_run" : l.verdict ? (l.verdict === "pass" ? "ok" : l.verdict === "skipped" ? "skipped" : "fail") : l.turns.length && l.turns.every((t) => t.match && !t.guard && !t.notfound) ? "ok" : "fail"; };
const withSub = (r: StateRun): SessionRun => ({ ...r, sub: r.cases.map((c) => ({ caseId: c, state: okOf(c) })) });
export const sessionRuns = (): SessionRun[] => listRuns().map(withSub);
const summary = (id: string): RunSummary | null => { const l = readLast(id); if (!l) return null; return { at: l.at, status: l.status, ok: okOf(id) === "ok", cost: l.turns.reduce((x, t) => x + (t.cost ?? 0), 0), turns: l.turns.length, notes: [] }; };
/** The left panel of a selected case: its chain (ancestors first), its result, and the runs that touched this chain (the parent's run counts: the child continues its state). */
export async function caseRuns(caseId: string): Promise<CaseRuns> {
  if (!/^[\w-]+$/.test(caseId)) throw new Error("bad case id");
  await exp.refreshF1();
  const s = (await loadSuites()).find((x) => x.cases.some((c) => c.id === caseId)), chain = s ? chainOf(s.cases, caseId) : [caseId], mine = new Set(chain.slice(0, chain.indexOf(caseId) + 1));
  return { chain, steps: chain.map((c) => ({ caseId: c, state: okOf(c), at: readLast(c)?.at })), workspace: exp.f1Home(caseId) ?? "(not run yet)", current: summary(caseId), sessionRuns: sessionRuns().filter((r) => r.cases.some((c) => mine.has(c))).slice(0, 8) };
}

/** `claude -p` as the judge: it reads the run log (EXPECTED vs ACTUAL lines the runner prints) and says per case PASS/FAIL and why. Saved next to the run so it is judged once. */
const judgef = (id: string) => join(exp.runsDir(), id + ".judge.txt");
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
