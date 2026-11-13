// Runs the shared test cases (TestCases/test_folders/<suite>/main.ts) on THIS harness (the f1 lead + sub-agents).
// A case = one task id. `after` continues the parent's task (the same lead session, the same sub-agents); a second child of one parent gets a task of its own (it cannot share the parent's session).
// Nothing is asserted from the model's words: a turn is judged by WHO the lead called (role, new or follow-up) against `expected_agents_res`, plus the guard (no distractor).
// `expected.context` is shown beside the result for a human to read, as in the other harness.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { qaFailed, readQa } from "../harness/core/qa_loop.ts";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import type { MStore } from "../harness/core/board.ts";
import { FIXTURES } from "@core/paths.ts";
import { normalizeBranches } from "../../../../../TestCases/branch.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const AGENT_TESTING = resolve(HERE, "../../../../..");
export const CASES_DIR = join(AGENT_TESTING, "TestCases", "test_folders");
const FIXTURE_INDEX = join(FIXTURES, "index.json");   // the ONE fixture place (paths.ts)

export interface RawCase { expect_qa?: "stop" | "give_up" | "failed"; max_agent_calls?: number; allow_real_subAg?: boolean; id: string; title: string; after?: string; branch_from?: string; branch_auto?: boolean; agents: string[]; distractors?: string[]; router?: boolean; tags?: string[]; turns: { user: string; expected: { context: string; expected_agents_res: string[] } }[] }
export interface SuiteCase extends RawCase { suite: string; suiteTags: string[] }

export async function loadSuites(): Promise<SuiteCase[]> {
  const out: SuiteCase[] = [];
  for (const d of readdirSync(CASES_DIR, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const f = join(CASES_DIR, d.name, "main.ts");
    if (!existsSync(f)) continue;
    const m = await import(pathToFileURL(f).href);
    for (const c of m.cases as RawCase[]) out.push({ ...c, suite: d.name, suiteTags: m.tags ?? [] });
  }
  return normalizeBranches(out);   // across all suites (see TestCases/branch.ts): extra `after` siblings become branches automatically
}

const fixtureAgent = (() => { try { return new Map((JSON.parse(readFileSync(FIXTURE_INDEX, "utf8")) as { id: string; agent?: string }[]).map((f) => [f.id, f.agent])); } catch { return new Map<string, string | undefined>(); } })();

/** What the case wants from the lead in one turn, as [kind, role]: a recorded result id = a NEW agent of the fixture's type; `session:writer#1` = a follow-up to that writer. */
export const expectedCalls = (ids: string[]) => ids.map((e) => (e.startsWith("session:") ? { kind: "resume" as const, role: e.slice(8).split("#")[0]! } : { kind: "new" as const, role: fixtureAgent.get(e) ?? "?" }));

/** Why this harness cannot run a case at all (or undefined). */
export const unsupported = (c: RawCase) => (c.router === false ? "router:false means the lead works ALONE; the f1 lead never WRITES files and only reads run_test/ (ls, read_file, grep): it delegates" : undefined);

/** The task id a case runs in, given the chain. */
export function taskFor(c: SuiteCase, all: SuiteCase[], exp: Record<string, ExpEntry> = {}): string {
  if (!c.after || c.branch_from) return "t_" + c.id;   // a `branch` case always has a task (and a folder) of its own
  const first = all.filter((x) => x.after === c.after)[0]?.id === c.id;   // the first child continues the parent's task; further children are branches with a task of their own
  return first ? exp[c.after]?.task ?? taskFor(all.find((x) => x.id === c.after) ?? c, all, exp) : "t_" + c.id;
}
export const agentsFor = (c: RawCase) => [...new Set([...c.agents, ...(c.distractors ?? [])])];

export interface CallOut { id: string; role: string; kind: "new" | "resume" | "fork"; agent: string | null; status: string; reason: string | null; title: string; objective: string; custom: boolean }
/** The reply_must / reply_forbid check of a turn (plain word lists, no model), or undefined when the reply is fine. */
export function replyProblem(ex: { reply_must?: string[]; reply_forbid?: string[] }, reply: string): string | undefined {
  const low = reply.toLowerCase(), miss = (ex.reply_must ?? []).filter((w) => !low.includes(w.toLowerCase())), bad = (ex.reply_forbid ?? []).find((w) => low.includes(w.toLowerCase()));
  return miss.length ? `the final reply lacks: ${miss.join(", ")}` : bad ? `the final reply says "${bad}"` : undefined;
}
export interface TurnJudge { /** set when the final reply breaks the case's reply_must / reply_forbid */ reply_problem?: string; gate?: string; turn: number; user: string; expectedContext: string; expected: { kind: string; role: string }[]; calls: CallOut[]; denied: CallOut[]; match: boolean; guard: boolean; reply: string; files: string[] }

/** Judge turn `i` of a case from the registry. `mark` = how many calls the task had when the turn began; `next` = when the following turn began (or undefined). */
export function judgeTurn(store: MStore, task: string, c: RawCase, i: number, mark: number, next?: number, repoFiles: string[] = [], known: Set<string> = new Set()): TurnJudge {
  const all = store.calls.filter((x) => x.task_id === task).slice(mark, next);
  const mapped: CallOut[] = all.map((x) => ({ id: x.id, role: x.role, kind: x.session_arg === "new" ? "new" : x.session_arg.startsWith("fork:") ? "fork" : "resume", agent: x.callee_agent_id, status: x.status, reason: x.reason,
    title: store.agent(task, x.callee_agent_id ?? "")?.title ?? "", objective: String((x.req as { objective?: string } | undefined)?.objective ?? ""), custom: !known.has(x.role) }));   // custom = a role with no folder, made from the lead's --title
  // Calls the fixture gate handled (harness/core/fixture_gate.ts): a corrected / extra call is part of ONE conversation with the sub-agent. If the gate served it, the whole group counts once, as its first call.
  const gateOf = new Map(store.evs("fixture.call", task).map((e) => [String((e.data as { call?: string }).call), e.data as unknown as { verdict: string; role: string }]));
  // Each SERVED recorded result counts once (a rework case serves two results to the same role: the bad answer, then the fix). Corrected (refused) and "already done" calls are not counted.
  const served = new Set([...gateOf.values()].filter((g) => g.verdict === "served").map((g) => g.role));
  // A call that got a recorded result served counts as that result, whether the lead used a NEW call or a message to the SAME sub-agent (resume): both are fine for a rework.
  const calls: typeof mapped = mapped.filter((x) => x.status !== "denied").filter((x) => { const g = gateOf.get(x.id); return !g || !served.has(g.role) || g.verdict === "served" || g.verdict === "real"; })
    .map((x) => (gateOf.get(x.id)?.verdict === "served" ? { ...x, kind: "new" as const } : x));
  // A follow-up the case EXPECTS (`session:<role>#n`) is a call answered from the session table ("extra"): count it once per such role. Other verify asks stay free and invisible.
  const wantResume = new Set(c.turns[i]!.expected.expected_agents_res.filter((e) => e.startsWith("session:")).map((e) => e.slice(8).split("#")[0]!));
  for (const x of mapped) if (x.status !== "denied" && gateOf.get(x.id)?.verdict === "extra" && wantResume.has(x.role) && !calls.some((k) => k.kind === "resume" && k.role === x.role)) calls.push({ ...x, kind: "resume" as const });
  const denied = mapped.filter((x) => x.status === "denied");
  const mine = new Set(all.map((x) => x.id)), gate = store.evs("fixture.fail", task).filter((e) => mine.has(String((e.data as { call?: string }).call))).map((e) => String((e.data as { reason?: string }).reason)).pop();
  const exp = expectedCalls(c.turns[i]!.expected.expected_agents_res), key = (x: { kind: string; role: string }) => `${x.kind === "fork" ? "new" : x.kind}:${x.role}`;
  const a = calls.map(key).sort(), b = exp.map(key).sort();
  const forbidden = new Set(c.distractors ?? []);
  const lead = store.notes.filter((n) => n.task_id === task && n.from === "lead" && n.to === "user" && !n.refs.includes("testrun"));   // not the copy the runner writes for the UI chat
  const qs = store.file ? readQa(dirname(store.file)) : undefined, want = (c as { expect_qa?: "stop" | "give_up" | "failed" }).expect_qa;
  // the master's QA repair loop ended failed (the same issue 3 times in a row = "stopped", or it gave up): the test is FAILED, whatever else matched. A case that EXPECTS that ending passes only when it happened.
  const qaGate = want ? (qs && qaFailed(qs) && (want === "failed" || qs.status === (want === "stop" ? "stopped" : "gave_up")) ? undefined : `expected the QA loop to end with ${want}, it ended: ${qs?.status ?? "no loop"}`) : qs && qaFailed(qs) ? `QA loop ended failed: ${qs.reason}` : undefined;
  const reply_problem = replyProblem(c.turns[i]!.expected as { reply_must?: string[]; reply_forbid?: string[] }, lead[lead.length - 1]?.text ?? "");   // re-checked in run.ts when the reply comes from the lead's last answer instead of a note
  return { reply_problem, gate: gate ?? qaGate, turn: i + 1, user: c.turns[i]!.user, expectedContext: c.turns[i]!.expected.context, expected: exp, calls, denied,
    match: a.length === b.length && a.every((x, k) => x === b[k]), guard: mapped.some((x) => forbidden.has(x.role)), reply: lead[lead.length - 1]?.text ?? "", files: repoFiles };
}

/** Agents the registry still calls "running" whose process is gone (a run that was killed) would block the next run of the same task for ever. Mark them interrupted, as the console does at start.
 *  An agent whose claude process (its session id on a command line) or whose detached `tools.ts _run --call <id>` is alive is left alone. Returns the agent ids it freed. */
export function reconcileDead(store: MStore, why = "the run that started it is gone"): string[] {
  store.reload();
  const ps = spawnSync("ps", ["-eo", "args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout ?? "";
  const alive = (a: { session_id: string | null; last_call_id?: string | null }) => (!!a.session_id && ps.includes(a.session_id)) || (!!a.last_call_id && ps.includes(`_run --call ${a.last_call_id}`));
  const stale = store.agents.filter((a) => (a.status === "running" || a.status === "stalled") && !alive(a));
  if (!stale.length) return [];
  store.tx(() => {
    for (const a of stale) { a.status = "idle"; a.activity = `interrupted (${why})`; a.epoch = (a.epoch ?? 0) + 1; store.ev("agent.interrupted", a.task_id, a.agent_id, { why }); }
    for (const c of store.calls.filter((x) => x.status === "granted" && stale.some((a) => a.agent_id === x.callee_agent_id && a.task_id === x.task_id))) { c.status = "failed"; c.reason = "interrupted"; }
  });
  return stale.map((a) => `${a.task_id}/${a.agent_id}`);
}

/** Hand the case's declared call limit to the fixture gate (it runs in another process, so it reads it from the store). */
export function declareGateLimit(store: MStore, task: string, c: { max_agent_calls?: number; allow_real_subAg?: boolean }) {
  if (c.max_agent_calls) store.tx(() => store.ev("fixture.limit", task, "", { limit: c.max_agent_calls }));
  if (c.allow_real_subAg) store.tx(() => store.ev("fixture.allow_real", task, "", { allow: true }));   // the gate may pass a call with no fixture to the REAL runner
}

export const statusOf = (turns: TurnJudge[]) => (turns.length && turns.every((t) => t.match && !t.guard && !t.gate && !t.reply_problem) ? "pass" : "fail");

/** exp.json (keyed by case id): which task the case ran in, and where each turn began. Shared by the CLI and the console. */
export interface ExpEntry { case: string; task: string; home?: string; suite: string; agents: string[]; marks: number[]; started: number[]; done: number; at: number }
export const readExp = (file: string): Record<string, ExpEntry> => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; } };
export const writeExp = (file: string, o: Record<string, ExpEntry>) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(o, null, 1)); };
