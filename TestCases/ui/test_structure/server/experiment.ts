// Experiment runner for the f1 multi-agent harness. It shells out to f1_multiagent/testrun/run.ts (so the CLI and this page do exactly the same thing)
// and reads the registry that run writes: ui/.ui-data/store.json (agents, calls, notes) and exp.json (case -> task, where each turn began).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { bgOf, taskProcs } from "./preview.ts";
import { MStore, say } from "@core/orchistraitor/f1_multiagent/harness/core/board.ts";
import { claudeDirs } from "@core/orchistraitor/f1_multiagent/harness/core/base.ts";
import { activeMs, lastCall } from "@core/orchistraitor/f1_multiagent/harness/core/peek.ts";
import { costOf, stopAgent } from "@core/orchistraitor/f1_multiagent/harness/core/agent_call.ts";
import { locksFromEnv } from "@core/orchistraitor/f1_multiagent/harness/core/lockapi.ts";
import { judgeTurn, loadSuites, readExp, statusOf, unsupported, writeExp, type ExpEntry, type SuiteCase } from "@core/orchistraitor/f1_multiagent/testrun/cases.ts";
import type { TalkIn, Transcript, TranscriptStep, AgentDetail, AvailableAgent, ChatOut, SendIn, CaseResultOut, CaseState, ExpSuite, ExperimentOverview, LiveAgent, LiveSession, RunInfo, RunLog } from "../shared/experiment.ts";

const F1 = resolve(import.meta.dir, "../../../../test_harness/core/orchistraitor/f1_multiagent");
const DATA = join(F1, "ui", ".ui-data"), STORE = resolve(process.env.UI_STORE ?? join(DATA, "store.json")), REPO = resolve(process.env.UI_REPO ?? join(DATA, "repo"));
const EXP = join(DATA, "exp.json"), RUNS = join(DATA, "web_runs");
const SESS = join(DATA, "web_sessions");
mkdirSync(RUNS, { recursive: true }); mkdirSync(SESS, { recursive: true });

// f1's testrun now keeps ONE store per master session (.state/<version>/<task>/store/store.json, workspace in .state/<version>/<task>/workspace) and one exp file per case
// (.state/<version>/f1_exp/<case>.json). The old shared ui/.ui-data store is still read (UI_STORE / older runs); everything is MERGED here so no run is invisible.
const STATE_DIR = join(F1, "..", "..", "..", ".state", process.env.STATE_VERSION ?? "v1"), EXP_DIR = join(STATE_DIR, "f1_exp");
const taskHomes = (): string[] => {   // every session folder: <task>/ and its branches <task>/branches/<branch>/ (a branch has its own store and workspace)
  const has = (d: string) => existsSync(join(d, "store", "store.json")), out: string[] = [];
  try { for (const d of readdirSync(STATE_DIR, { withFileTypes: true })) if (d.isDirectory()) { const h = join(STATE_DIR, d.name); if (has(h)) out.push(h);
    try { for (const b of readdirSync(join(h, "branches"))) if (has(join(h, "branches", b))) out.push(join(h, "branches", b)); } catch { /* no branches */ } } } catch { /* no state yet */ }
  return out;
};
const legacyStore = () => new MStore(STORE);   // a fresh read each time: run.ts is another process writing the same file
const MERGE = ["agents", "reports", "findings", "requests", "events", "calls", "locks", "waiters", "patches", "notes", "plans", "runs", "fixtureSessions"] as const;
/** READ-ONLY merged view (never call tx/save on it: it would write the merged rows into the legacy file). */
const store = (): MStore => {
  const m = legacyStore() as unknown as Record<string, unknown[]>;
  for (const h of taskHomes()) { const o = new MStore(join(h, "store", "store.json")) as unknown as Record<string, unknown[]>; for (const k of MERGE) if (Array.isArray(o[k]) && Array.isArray(m[k])) m[k] = [...m[k]!, ...o[k]!]; }
  return m as unknown as MStore;
};
const expAll = (): Record<string, ExpEntry> => {
  const o = readExp(EXP);
  try { for (const f of readdirSync(EXP_DIR)) if (f.endsWith(".json")) { const j = readExp(join(EXP_DIR, f)) as unknown as ExpEntry; if (j?.case) o[j.case] = j; } } catch { /* none yet */ }
  return o;
};
const repoFor = (task: string, home?: string) => { const w = join(STATE_DIR, home ?? task, "workspace"); return existsSync(w) ? w : REPO; };
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ---- runs started from the page (kept on disk so a restart of the API does not lose them)
const metaFile = (id: string) => join(RUNS, id + ".json"), logFile = (id: string) => join(RUNS, id + ".log");
const readRun = (id: string): RunInfo | undefined => {
  try {
    const r = JSON.parse(readFileSync(metaFile(id), "utf8")) as RunInfo;
    if (r.status === "running" && !alive(r.pid)) {   // the process is gone: its exit code is in <id>.exit (written by the shell wrapper of a UI run, or by run.ts itself for a manual one)
      const ef = join(RUNS, id + ".exit"), txt = existsSync(ef) ? readFileSync(ef, "utf8").trim() : "";
      if (txt === "" && r.exitCode === undefined && Date.now() - r.startedAt < 3000) return r;   // just started / just ending: do not guess
      const code = txt === "" ? r.exitCode ?? null : Number(txt);
      r.exitCode = code; r.status = code === 0 ? "done" : "failed"; r.endedAt ??= Date.now(); writeFileSync(metaFile(id), JSON.stringify(r));
    }
    return r;
  } catch { return undefined; }
};
export const listRuns = (): RunInfo[] => readdirSync(RUNS).filter((f) => f.endsWith(".json")).map((f) => readRun(f.slice(0, -5))).filter((x): x is RunInfo => !!x).sort((a, b) => b.startedAt - a.startedAt).slice(0, 30);

export function startRun(b: { suite: string; cases?: string[]; fake?: boolean; rerun?: boolean; again?: boolean }): RunInfo {
  if (!/^[\w-]+$/.test(b.suite)) throw new Error("bad suite name");
  const cases = (b.cases ?? []).filter((c) => /^[\w-]+$/.test(c));
  if (listRuns().some((r) => r.status === "running")) throw new Error("a run is already going; stop it first (two runs would write the same store)");
  const id = "r" + Date.now().toString(36), args = ["testrun/run.ts", b.suite, ...cases, ...(b.fake ? ["--fake"] : []), ...(b.rerun ? ["--rerun"] : []), ...(b.again ? ["--again"] : [])];
  const fd = openSync(logFile(id), "a");
  const p = spawn("sh", ["-c", 'bun "$@"; echo $? > "$RUN_EXIT_FILE"', "sh", ...args], { cwd: F1, detached: true, stdio: ["ignore", fd, fd], env: { ...process.env, HARNESS_RUN_RECORDED: "1", RUN_EXIT_FILE: join(RUNS, id + ".exit") } });   // the UI writes the record itself
  p.unref();
  const run: RunInfo = { id, suite: b.suite, cases, fake: !!b.fake, rerun: !!b.rerun, startedAt: Date.now(), pid: p.pid ?? 0, status: "running" };
  writeFileSync(metaFile(id), JSON.stringify(run));
  p.on("exit", (_c, sig) => { const r = JSON.parse(readFileSync(metaFile(id), "utf8")) as RunInfo, ef = join(RUNS, id + ".exit"), code = existsSync(ef) ? Number(readFileSync(ef, "utf8").trim()) : null;   // the wrapper shell always exits 0: the real code is in the exit file
    if (r.status === "running") r.status = sig ? "stopped" : code === 0 ? "done" : "failed"; r.exitCode = code; r.endedAt = Date.now(); writeFileSync(metaFile(id), JSON.stringify(r)); });
  return run;
}
export function stopRun(id: string): RunInfo {
  const r = readRun(id); if (!r) throw new Error("no such run");
  if (r.status === "running") { try { process.kill(-r.pid, "SIGTERM"); } catch { try { process.kill(r.pid, "SIGTERM"); } catch { /* already gone */ } } r.status = "stopped"; r.endedAt = Date.now(); writeFileSync(metaFile(id), JSON.stringify(r)); }
  return r;
}
export function runLog(id: string): RunLog {
  const run = readRun(id); if (!run) throw new Error("no such run");
  const f = logFile(id), size = existsSync(f) ? statSync(f).size : 0, txt = size ? readFileSync(f, "utf8") : "";
  return { run, log: txt.length > 60_000 ? "…\n" + txt.slice(-60_000) : txt };
}

// ---- what can be run, and what already ran
function stateOf(c: SuiteCase, e: ExpEntry | undefined, st: MStore, running: Set<string>): CaseState {
  if (unsupported(c)) return "skipped";
  if (!e) return "never_run";
  if (running.has(e.task) && e.done < c.turns.length) return "running";
  if (e.done < c.turns.length) return "partial";
  return statusOf(judgeAll(st, c, e)) as CaseState;   // the SAME rule as run.ts and the Flow page (match, no guard, no gate, no reply problem)
}
const known = () => { try { return new Set([join(F1, "harness", "agents"), join(F1, "..", "..", "..", "..", "TestCases", "test_folders", "agent_fixture", "agents")].flatMap((x) => { try { return readdirSync(x, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } })); } catch { return new Set<string>(); } };
function judgeAll(st: MStore, c: SuiteCase, e: ExpEntry) {
  const repo = repoFor(e.task, (e as { home?: string }).home), files = existsSync(repo) ? readdirSync(repo).filter((f) => f !== ".git") : [], k = known();
  const home = (e as { home?: string }).home, own = home && existsSync(join(STATE_DIR, home, "store", "store.json")) ? new MStore(join(STATE_DIR, home, "store", "store.json")) : st;   // judged on the case's OWN session store (the merged view also holds legacy rows and a branch's copy of the parent's rows)
  // a turn counts only its OWN calls: up to where it ended (`ends`), or (older records) up to the first message typed in the chat after it started: later free chat in the same session is not part of the case
  const notes = (own.notes ?? []).filter((n) => n.task_id === e.task && n.from === "user" && !n.refs.includes("testrun")), taskCalls = own.calls.filter((x) => x.task_id === e.task);
  const endOf = (i: number): number | undefined => { const ends = (e as { ends?: number[] }).ends?.[i]; if (ends !== undefined) return ends; if (e.marks[i + 1] !== undefined) return e.marks[i + 1]; const t0 = e.started?.[i] ?? 0, free = notes.filter((n) => n.t > t0).sort((a, b) => a.t - b.t)[0]; return free ? taskCalls.filter((x) => x.t < free.t).length : undefined; };
  return Array.from({ length: Math.min(e.done, c.turns.length) }, (_, i) => judgeTurn(own, e.task, c, i, e.marks[i] ?? 0, endOf(i), files, k));
}

export async function overview(): Promise<ExperimentOverview> {
  const all = await loadSuites(), exp = expAll(), st = store(), runs = listRuns();
  const running = new Set(st.agents.filter((a) => a.name === "lead" && a.status === "running").map((a) => a.task_id));
  if (runs.some((r) => r.status === "running")) for (const e of Object.values(exp)) if (e.at > Date.now() - 600_000) running.add(e.task);   // a turn between two lead calls still counts as running
  const suites = new Map<string, ExpSuite>();
  for (const c of all) {
    const e = exp[c.id], s = suites.get(c.suite) ?? (suites.set(c.suite, { suite: c.suite, cases: [] }), suites.get(c.suite)!);
    s.cases.push({ id: c.id, title: c.title, after: c.after, agents: c.agents, distractors: c.distractors ?? [], turns: c.turns.length, prompts: c.turns.map((t) => t.user), unsupported: unsupported(c), state: stateOf(c, e, st, running), task: e?.task, done: e?.done ?? 0, at: e?.at });
  }
  return { config: { f1: F1, store: STORE, repo: REPO, storeExists: existsSync(STORE) }, suites: [...suites.values()], runs };
}

export async function caseResult(id: string): Promise<CaseResultOut | null> {
  const all = await loadSuites(), c = all.find((x) => x.id === id), e = expAll()[id];
  if (!c || !e) return null;
  const st = store(), judged = judgeAll(st, c, e);
  const turns = judged.map((j, i) => ({ ...j, finished: i < e.done }));
  return { case: id, task: e.task, suite: e.suite, state: e.done < c.turns.length ? "partial" : statusOf(judged) as CaseState, done: e.done, total: c.turns.length, turns };
}

// ---- who is alive right now: every master session in the store, with its sub-agents
// ---- sessions made on this page: which sub-agents were allowed, and the master's message queue (one turn at a time per session)
interface Side { task: string; agents: string[]; fake: boolean; case?: string; suite?: string; createdAt: number }
const sideFile = (t: string) => join(SESS, t + ".json");
const readSide = (t: string): Side | undefined => { try { return JSON.parse(readFileSync(sideFile(t), "utf8")); } catch { return undefined; } };
interface Q { busy: boolean; stopped?: boolean; error: string; queue: { id: string; text: string; t: number; noSay?: boolean; caseId?: string; suite?: string; auto?: boolean }[] }
const queues = new Map<string, Q>();
const q = (t: string) => queues.get(t) ?? (queues.set(t, { busy: false, error: "", queue: [] }), queues.get(t)!);

export function availableAgents(): AvailableAgent[] {
  // exactly the master's own team (harness/agents/lead/agent.json). Internal agents such as the project manager (pm) are not something the master calls.
  const dir = join(F1, "harness", "agents"), team: string[] = (() => { try { return JSON.parse(readFileSync(join(dir, "lead", "agent.json"), "utf8")).agents ?? []; } catch { return []; } })();
  return team.filter((n) => existsSync(join(dir, n, "agent.json"))).map((n) => {
    const j = JSON.parse(readFileSync(join(dir, n, "agent.json"), "utf8")) as { description?: string; writes?: boolean };
    return { name: n, description: j.description ?? "", writes: !!j.writes, byDefault: true };
  });
}

/** Send a message to a session's master. No task = a new session. The master answers one message at a time; the rest wait in the queue. */
export function send(b: SendIn & { auto?: boolean }): { task: string; queued: boolean; live?: boolean } {
  const text = String(b.text ?? "").trim(); if (!text) throw new Error("empty message");
  const names = new Set(availableAgents().map((a) => a.name));
  let task = b.task;
  if (!task) {
    const taken = !!(b.caseId && expAll()[b.caseId]);
    task = b.caseId ? "t_" + b.caseId + (taken ? "_" + Date.now().toString(36) : "") : "s" + Date.now().toString(36);
    writeFileSync(sideFile(task), JSON.stringify({ task, agents: b.agents.filter((a) => names.has(a)), fake: !!b.fake, case: b.caseId, suite: b.suite, createdAt: Date.now() } satisfies Side));
  } else if (!/^[\w-]+$/.test(task)) throw new Error("bad session id");
  const Qt = q(task), wasBusy = Qt.busy;
  if (wasBusy && !b.caseId && !b.auto && sendLive(task, text)) return { task, queued: false, live: true };   // the master is mid-turn (maybe in `wait`): hand it over now, not after the turn
  Qt.queue.push({ id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, t: Date.now(), caseId: b.caseId, suite: b.suite, auto: b.auto });
  void pump(task);
  return { task, queued: wasBusy };
}
/** The master is busy: put the message straight into its inbox (the PostToolUse hook shows it at its next tool call, `wait` returns early for it). Returns false when the session store is not found. */
function sendLive(task: string, text: string): boolean {
  const e = Object.values(expAll()).find((x) => x.task === task), file = join(STATE_DIR, (e as { home?: string } | undefined)?.home ?? task, "store", "store.json");
  if (!existsSync(file)) return false;
  const s = new MStore(file); s.reload(); s.tx(() => { say(s, task, "user", "lead", text, ["live"], Infinity); }); return true;
}
/** After a turn: a live message the master never read (its turn ended first) becomes its next turn, without writing the message twice. */
function unreadLive(task: string): string[] {
  const e = Object.values(expAll()).find((x) => x.task === task), file = join(STATE_DIR, (e as { home?: string } | undefined)?.home ?? task, "store", "store.json");
  if (!existsSync(file)) return [];
  const s = new MStore(file); s.reload(); let out: string[] = [];
  s.tx(() => { const ns = s.notes.filter((n) => n.task_id === task && n.from === "user" && n.to === "lead" && n.refs.includes("live") && !n.read_by.includes("lead")); for (const n of ns) n.read_by.push("lead"); out = ns.map((n) => n.text); });
  return out;
}
async function pump(task: string) {
  const Qt = q(task); if (Qt.busy) return; Qt.busy = true;
  try {
    while (Qt.queue.length) {
      const m = Qt.queue.shift()!, side = readSide(task), tf = join(SESS, task + "." + m.id + ".txt");
      writeFileSync(tf, m.text);
      const exp = expAll(), linked = side?.case, turn = linked && exp[linked]?.task === task ? exp[linked]!.done : 0;
      const args = ["testrun/chat.ts", "--task", task, "--text-file", tf]; if (m.noSay) args.push("--no-say");
      if (side) args.push("--agents", side.agents.length ? side.agents.join(",") : "-");   // "-" = no sub-agents
      if (side?.fake) args.push("--fake");
      if (m.auto) args.push("--auto");
      if (linked) args.push("--case", linked, "--turn", String(turn), "--suite", side?.suite ?? "");
      Qt.stopped = false;
      Qt.error = await new Promise<string>((res) => {
        let out = ""; const p = spawn("bun", args, { cwd: F1, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
        p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
        p.on("error", (e) => res(String(e))); p.on("exit", (code) => res(code === 0 ? "" : out.trim().slice(-400) || `exit ${code}`));
      });
      if (Qt.stopped) { Qt.error = "stopped by you"; Qt.stopped = false; }
      else { const left = unreadLive(task); if (left.length) Qt.queue.unshift({ id: "q" + Date.now().toString(36), text: left.join("\n\n"), t: Date.now(), noSay: true }); }
      try { rmSync(tf, { force: true }); } catch { /* best effort */ }
    }
  } finally { Qt.busy = false; }
}
export function cancelQueued(task: string, id: string) { const Qt = q(task), i = Qt.queue.findIndex((m) => m.id === id); if (i >= 0) Qt.queue.splice(i, 1); return { ok: i >= 0 }; }
export function chat(task: string): ChatOut {
  if (!/^[\w-]+$/.test(task)) throw new Error("bad session id");
  const st = store(), Qt = q(task), side = readSide(task), e = side?.case ? expAll()[side.case] : undefined;
  const messages = st.notes.filter((n) => n.task_id === task && (n.from === "user" || n.to === "user")).map((n) => ({ id: n.id, from: (n.from === "user" ? "user" : "lead") as "user" | "lead", text: n.refs.includes("auto_run") && n.from === "user" ? n.text.split("\n")[0]!.slice(0, 160) : n.text, t: n.t, ...(n.refs.includes("auto_run") && n.from === "user" ? { auto: true as const } : {}) }));
  return { task, messages, queued: Qt.queue.map((m) => ({ id: m.id, text: m.text, t: m.t })), busy: Qt.busy, error: Qt.error, nextTurn: side?.case ? (e && e.task === task ? e.done : 0) : null };
}

export function live(): LiveSession[] {
  const st = store(), NOW = Math.floor(Date.now() / 30_000) * 30_000, exp = Object.values(expAll()), byTask = new Map(exp.map((e) => [e.task, e]));
  const row = (a: ReturnType<MStore["agentsOf"]>[number], task: string): LiveAgent => ({ id: a.agent_id, name: a.name, level: a.level, caller: a.caller_agent_id ?? null, status: a.status, title: a.title || a.name, activity: a.activity ?? "", needsParent: a.needs_parent ?? null, runs: a.runs ?? 0, cost: costOf(st, task, a.agent_id), lastEventAt: a.last_event_at, activeMs: activeMs(st, task, NOW, a.agent_id), lastCall: lastCall(st, task, a.agent_id, NOW), session: a.session_id ?? undefined, fixture: st.events.some((ev) => ev.task_id === task && ev.agent_id === a.agent_id && ev.kind === "fixture.call") });
  const tasks = new Map<string, number>(st.runs.map((r) => [r.task_id, r.last_active_at]));
  for (const f of readdirSync(SESS).filter((x) => x.endsWith(".json"))) { const sd = readSide(f.slice(0, -5)); if (sd && !tasks.has(sd.task)) tasks.set(sd.task, sd.createdAt); }
  const procs = psList(), runGoing = listRuns().some((r) => r.status === "running"), alive = (task: string) => (runGoing && (byTask.get(task)?.at ?? 0) > Date.now() - 600_000) || procs.some((p) => !p.args.startsWith("ps ") && (p.args.includes(task) || (/testrun\/(run|chat)\.ts/.test(p.args) && exp.some((x) => x.task === task && p.args.includes(x.case)))));   // a chat.ts / run.ts / claude process of this session (run.ts is given the CASE id, not the task id; it may be waiting for the one master slot, with no claude child yet)
  return [...tasks].map(([task, last]) => {
    const ag = st.agentsOf(task), lead = ag.find((a) => a.name === "lead"), subs = ag.filter((a) => a.name !== "lead"), e = byTask.get(task), sd = readSide(task), Qt = q(task);
    const dead = lead?.status === "running" && !Qt.busy && !alive(task);   // marked running, but nothing is running it: it ended without writing back
    const state = dead ? "stalled" : Qt.busy || lead?.status === "running" ? "working" : subs.some((a) => a.status === "running" || a.status === "stalled") ? "running" : "active";
    const userText = st.notes.find((n) => n.task_id === task && n.from === "user")?.text ?? Qt.queue[0]?.text;
    const guess = /^t_/.test(task) ? task.replace(/^t_/, "").replace(/_[a-z0-9]{4}$/, "") : undefined;   // a test run's task is t_<case>[_<suffix>]: its name is the title when nobody typed a message
    const fixtures = st.evs("fixture.call", task).filter((x) => (x.data as { verdict?: string }).verdict === "served").length;   // sub-agent answers served from a recorded fixture (no model call)
    const hide = !userText && !subs.length && !e && !sd;   // nothing typed, no sub-agent, no test case behind it: an empty shell (listed nowhere; the folder stays on disk)
    return { hide, fixtures, kind: /^t_/.test(task) ? "test" : "experiment", tags: ["test_run"], task, agentsAllowed: sd?.agents ?? e?.agents ?? [], fake: sd?.fake ?? false, queued: Qt.queue.length, busy: Qt.busy, case: sd?.case ?? e?.case, suite: sd?.suite ?? e?.suite, title: (userText ?? e?.case ?? guess ?? "(empty)").replace(/\s+/g, " ").slice(0, 90), last, activeMs: activeMs(st, task, NOW), state, cost: lead ? costOf(st, task, lead.agent_id) : 0, master: lead ? { ...row(lead, task), ...(dead ? { status: "stalled", activity: "process is gone: the master ended without finishing the turn (see its log)" } : {}) } : null, agents: subs.map((a) => row(a, task)) } as LiveSession;
  }).filter((x) => !(x as { hide?: boolean }).hide).sort((a, b) => b.last - a.last).slice(0, 60).map((x) => { const { hide: _h, ...rest } = x as LiveSession & { hide?: boolean }; return rest as LiveSession; });
}

/** Things that look like leftovers, found while scanning .state at start (`bun run dev`). It only REPORTS: nothing is moved or deleted; you decide. */
export function cleanupHints(): string[] {
  const out: string[] = [], exp = Object.values(expAll());
  const ids = (file: string) => { const o = new Set<string>(); try { const d = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown[]>; for (const k of ["agents", "events", "runs", "notes"]) for (const r of d[k] ?? []) { const t = (r as { task_id?: string }).task_id; if (t) o.add(t); } } catch { /* unreadable */ } return o; };
  for (const h of taskHomes()) {
    const key = h.slice(STATE_DIR.length + 1), top = key.split("/")[0]!, found = new Set([...ids(join(h, "store", "store.json")), ...ids(join(h, "store", "store.json.board"))]);
    const other = [...found].filter((t) => t !== top);
    if (other.length && !key.includes("/branches/")) out.push(`session folder ${key} also holds rows of other task id(s): ${other.join(", ")} (an older run id; the list shows it as a separate master session)`);
    if (!existsSync(join(h, "workspace"))) out.push(`session folder ${key} has no workspace/ (a session must have one)`);
  }
  for (const e of exp) { const home = (e as { home?: string }).home ?? e.task; if (!existsSync(join(STATE_DIR, home))) out.push(`exp entry ${e.case} points at ${home}, which is not on disk`); }
  const haveExp = new Set(exp.map((e) => (e as { home?: string }).home ?? e.task));
  for (const h of taskHomes()) { const key = h.slice(STATE_DIR.length + 1); if (/^t_/.test(key) && !key.includes("/branches/") && !haveExp.has(key) && !exp.some((e) => e.task === key)) out.push(`session folder ${key} has no exp entry (invisible on the Experiment page; \`bun testrun/rebuild_exp.ts\` rebuilds it)`); }
  return out;
}

// ---- delete a master session and everything under it (the same cleanup as the f1 console)
interface Proc { pid: number; ppid: number; args: string }
const psList = (): Proc[] => (spawnSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout ?? "").split("\n").map((l) => { const m = l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/); return m ? { pid: +m[1]!, ppid: +m[2]!, args: m[3]! } : null; }).filter((x): x is Proc => !!x);
function killTree(all: Proc[], roots: Proc[]) {
  const out = new Set(roots.map((p) => p.pid)), todo = [...out];
  while (todo.length) { const id = todo.pop()!; for (const p of all) if (p.ppid === id && !out.has(p.pid)) { out.add(p.pid); todo.push(p.pid); } }
  let n = 0; for (const pid of out) { try { process.kill(pid, "SIGKILL"); n++; } catch { /* gone */ } } return n;
}
/** STOP the session's current work: drops queued messages, kills the master's turn (testrun/chat.ts) and every claude / tools.ts process of the session (sub-agents too). The session and its chat are kept; a new message continues it. */
export async function stopSession(task: string) {
  if (!/^[\w-]+$/.test(task)) throw new Error("bad session id");
  const Qt = q(task), dropped = Qt.queue.length; Qt.queue.length = 0; Qt.stopped = true;   // pump() reads stopped: a killed turn is not a failure
  const e = Object.values(expAll()).find((x) => x.task === task), file = join(STATE_DIR, (e as { home?: string } | undefined)?.home ?? task, "store", "store.json");
  const own = existsSync(file) ? new MStore(file) : null;
  // 1) registry first: every agent of the session (master and all sub-agents, any depth) -> stopped, epoch bumped (a late result is thrown away), granted calls -> failed
  let stoppedAgents = 0, failedCalls: string[] = [];
  if (own) { own.reload(); own.tx(() => { const lead = own.agentsOf(task).find((a) => a.name === "lead"); if (lead) stoppedAgents = stopAgent(own, task, lead.agent_id).length; for (const a of own.agentsOf(task)) if (a.status === "running" || a.status === "stalled") { a.status = "idle"; a.activity = "stopped"; a.epoch = (a.epoch ?? 0) + 1; stoppedAgents++; } failedCalls = own.calls.filter((c) => c.task_id === task && c.status === "failed" && c.reason === "stopped").map((c) => c.id); }); }
  // 2) kill the processes, twice (the second pass catches a call that was starting while the first ran)
  let killed = 0;
  for (let pass = 0; pass < 2; pass++) {
    const st = own ?? store(), sids = st.agents.filter((a) => a.task_id === task).map((a) => a.session_id).filter((x): x is string => !!x);
    const callIds = st.calls.filter((c) => c.task_id === task).map((c) => c.id), all = psList();
    killed += killTree(all, all.filter((p) => p.args.includes("testrun/chat.ts") && p.args.includes(`--task ${task} `)));
    killed += killTree(all, all.filter((p) => /\bclaude\b/.test(p.args.slice(0, 160)) && sids.some((sid) => p.args.includes(`--session-id ${sid}`) || p.args.includes(`--resume ${sid}`))));
    killed += killTree(all, all.filter((p) => p.args.includes("tools.ts") && callIds.some((c) => p.args.includes(`_run --call ${c}`))));
    if (pass === 0) await new Promise((r) => setTimeout(r, 700));
  }
  // 3) free the locks the stopped calls held; nothing that was waiting for them is started (stopping means stopping)
  if (own) { try { const locks = locksFromEnv(own); for (const c of failedCalls) await locks.release(task, c, 120_000); } catch { /* the lease ends by itself */ } }
  return { ok: true, task, killed, dropped, stopped_agents: stoppedAgents };
}
export function deleteSession(task: string) {
  if (!/^[\w-]+$/.test(task)) throw new Error("bad session id");
  const st = store();
  if (!st.runs.some((r) => r.task_id === task) && !st.agents.some((a) => a.task_id === task) && !readSide(task)) throw new Error("no such session");
  if (q(task).busy) throw new Error("the master is answering right now: wait for it to finish (or stop the run) before deleting");
  const home = join(STATE_DIR, task), perTask = existsSync(join(home, "store", "store.json"));
  const logDir = join(perTask ? join(home, "store") : dirname(STORE), "logs", task);
  const archived = existsSync(logDir) ? readdirSync(logDir).map((f) => f.match(/\.([0-9a-f-]{36})\.jsonl$/)?.[1]).filter((x): x is string => !!x) : [];
  const sids = [...new Set([...st.agents.filter((a) => a.task_id === task).map((a) => a.session_id).filter((x): x is string => !!x), ...archived])];
  const callIds = st.calls.filter((c) => c.task_id === task).map((c) => c.id), all = psList();
  let killed = killTree(all, all.filter((p) => /\bclaude\b/.test(p.args.slice(0, 160)) && sids.some((sid) => p.args.includes(`--session-id ${sid}`) || p.args.includes(`--resume ${sid}`))));
  killed += killTree(all, all.filter((p) => p.args.includes("tools.ts") && callIds.some((c) => p.args.includes(`_run --call ${c}`))));
  let transcripts = 0;
  for (const dir of claudeDirs()) try { const root = join(dir, "projects"); for (const d of readdirSync(root)) for (const sid of sids) { const f = join(root, d, sid + ".jsonl"); if (existsSync(f)) { rmSync(f, { force: true }); transcripts++; } } } catch { /* none */ }
  rmSync(logDir, { recursive: true, force: true }); rmSync(sideFile(task), { force: true }); queues.delete(task);
  if (perTask) { rmSync(home, { recursive: true, force: true }); try { for (const f of readdirSync(EXP_DIR)) if (readExp(join(EXP_DIR, f)) && (readExp(join(EXP_DIR, f)) as unknown as ExpEntry).task === task) rmSync(join(EXP_DIR, f), { force: true }); } catch { /* none */ } }
  const st0 = perTask ? null : legacyStore();
  if (st0) st0.tx(() => { const m = st0 as unknown as Record<string, { task_id?: string }[]>; for (const k of ["agents", "reports", "findings", "requests", "events", "calls", "locks", "waiters", "patches", "notes", "plans", "runs"]) if (Array.isArray(m[k])) m[k] = m[k]!.filter((x) => x.task_id !== task); });
  const e = readExp(EXP); let changed = false; for (const [k, v] of Object.entries(e)) if (v.task === task) { delete e[k]; changed = true; }
  if (changed) writeExp(EXP, e);
  return { ok: true, deleted: task, killed, transcripts };
}

/** raw events of one session (for .state/…/events.jsonl) */
export const sessionEvents = (task: string) => store().events.filter((e) => e.task_id === task).map((e) => ({ t: e.t, kind: e.kind, agent: e.agent_id || undefined, data: e.data }));


/** Details for a click on a card: everything the master/sub-agent has in the store. Read-only. */
export function agentDetail(task: string, id: string): AgentDetail | { error: string } {
  const st = store(), a = st.agentsOf(task).find((x) => x.agent_id === id);
  if (!a) return { error: "no such agent in this session" };
  const clip = (v: unknown, n = 4000) => String(v ?? "").slice(0, n);
  const tools = st.events.filter((e) => e.task_id === task && e.agent_id === id && e.kind === "tool.used").slice(-80).map((e) => ({ t: e.t, tool: String((e.data as { tool?: string }).tool ?? ""), text: clip((e.data as { activity?: string }).activity, 1500) }));
  const briefs = st.calls.filter((c) => c.task_id === task && (c.callee_agent_id === id || c.caller_agent_id === id)).slice(-12).map((c) => { const r = (c.req ?? {}) as Record<string, string>; return { id: c.id, from: c.caller_agent_id ?? null, to: c.callee_agent_id ?? null, role: c.role, status: c.status, objective: clip(r.objective), output: clip(r.output, 600), boundaries: clip(r.boundaries, 600), t: c.t }; });
  const rep = [...st.reports].reverse().find((r) => r.task_id === task && r.agent_id === id);
  const proc = taskProcs(task);
  return { id, name: a.name, status: a.status, activity: a.activity ?? "", session: a.session_id ?? undefined, tools, briefs, answer: clip(rep?.reply ?? rep?.summary ?? a.final_response, 6000), scripts: bgOf(task).scripts, processes: proc };
}

// ---- ONE runner, ONE record: the Flow page reads exactly what testrun/run.ts wrote (f1_exp/<case>.json + .state/<v>/<home>/store). Nothing is copied.
// A case = its f1_exp entry; its session = <home>/store + <home>/workspace; a chain (`after`) shares ONE home, so each case owns the window from its own first turn to the first turn of the next case in that home.
const homeOf = (e: ExpEntry) => (e as { home?: string }).home ?? e.task;
export const f1Home = (id: string): string | undefined => { const e = expAll()[id]; return e ? homeOf(e) : undefined; };
export const f1WsDir = (id: string) => { const h = f1Home(id); return h ? join(STATE_DIR, h, "workspace") : join(STATE_DIR, "-no-session-", id); };
export interface F1Turn { actual: string[]; expected: string[]; match: boolean; guard: boolean; notfound: boolean; calls: number; cost: number; reply?: string }
export interface F1Last { at: string; status: "ran" | "skipped"; verdict?: "pass" | "fail" | "skipped"; title: string; task: string; home: string; warnings: string[]; turns: F1Turn[] }
export interface F1Snap { last: Map<string, F1Last>; ckpt: Map<string, { sessionId: string; ids: Record<string, string> }>; fixtureOf: Map<string, Record<string, string>>; events: Map<string, { t: number; kind: string; agent?: string; text?: string; fixture?: string | null }[]> }
let snap: F1Snap = { last: new Map(), ckpt: new Map(), fixtureOf: new Map(), events: new Map() };
export const f1 = () => snap;
export async function refreshF1(): Promise<F1Snap> {
  const all = await loadSuites(), exp = expAll(), k = known(), stores = new Map<string, MStore | undefined>(), n: F1Snap = { last: new Map(), ckpt: new Map(), fixtureOf: new Map(), events: new Map() };
  const open = (h: string) => { if (!stores.has(h)) { const f = join(STATE_DIR, h, "store", "store.json"); stores.set(h, existsSync(f) ? new MStore(f) : undefined); } return stores.get(h); };
  for (const c of all) {
    const e = exp[c.id]; if (!e) continue;
    const h = homeOf(e), s = open(h); if (!s) continue;
    const noLead = !!(c as { no_lead?: boolean }).no_lead, status = (e as { status?: string }).status as "pass" | "fail" | "skipped" | undefined;
    const next = Object.values(exp).filter((o) => homeOf(o) === h && o.case !== e.case && (o.started?.[0] ?? 0) > (e.started?.[0] ?? 0)).sort((a, b) => a.started[0]! - b.started[0]!)[0];   // the case that continues in this home
    const turns = noLead ? [] : judgeAll(s, c, e);
    const cost = s.agentsOf(e.task).reduce((x, a) => x + costOf(s, e.task, a.agent_id), 0);   // the whole session so far (a chain shares one session)
    n.last.set(c.id, { at: new Date(e.at).toISOString(), status: status === "skipped" ? "skipped" : "ran", verdict: noLead || status === "skipped" ? status : undefined, title: c.title, task: e.task, home: h, warnings: [],
      turns: turns.map((j, i) => ({ actual: j.calls.map((x) => `${x.kind}:${x.role}`), expected: j.expected.map((x) => `${x.kind}:${x.role}`), match: j.match && !j.gate && !j.reply_problem, guard: j.guard, notfound: false, calls: j.calls.length, cost: i === 0 ? cost : 0, reply: j.reply })) });
    const endIdx = next?.marks?.[0] ?? Infinity, endT = next?.started?.[0] ?? Infinity, startT = e.started?.[0] ?? 0;
    const calls = s.calls.filter((x) => x.task_id === e.task).slice(0, endIdx), seen = new Set<string>(), perRole = new Map<string, number>(), ids: Record<string, string> = {}, fx: Record<string, string> = {};
    for (const x of calls) { const a = x.callee_agent_id && !seen.has(x.callee_agent_id) ? s.agent(e.task, x.callee_agent_id) : undefined; if (!a || a.name === "lead") continue; seen.add(a.agent_id); const i = (perRole.get(a.name) ?? 0) + 1; perRole.set(a.name, i); ids[`${a.name}#${i}`] = a.agent_id; }
    const callee = new Map(calls.map((x) => [x.id, x.callee_agent_id]));
    for (const ev of s.events) if (ev.task_id === e.task && ev.kind === "fixture.call" && ev.t < endT) { const d = ev.data as { call?: string; verdict?: string; result?: string }; const who = callee.get(String(d.call)); if (who && d.verdict === "served" && d.result) fx[who] = d.result; }
    n.ckpt.set(c.id, { sessionId: s.agentsOf(e.task).find((a) => a.name === "lead")?.session_id ?? "", ids });
    n.fixtureOf.set(c.id, fx);
    n.events.set(c.id, s.events.filter((ev) => ev.task_id === e.task && ev.t >= startT && ev.t < endT).map((ev) => ({ t: ev.t, kind: ev.kind, agent: ev.agent_id ?? "", text: JSON.stringify(ev.data ?? {}), fixture: ev.kind === "fixture.call" ? String((ev.data as { result?: string })?.result ?? "") || null : null })));
  }
  return (snap = n);
}

export type RunInfoLike = RunInfo;
export const runsDir = () => RUNS;
export const caseEntry = (id: string): { at: number; done: number; status?: string; task: string } | undefined => { const e = expAll()[id]; return e ? { at: e.at, done: e.done, status: (e as { status?: string }).status, task: e.task } : undefined; };


/** The full conversation of one agent: its claude transcript (.state/<v>/<task>/store/logs/<task>/<name>_<n>.<session>.jsonl), tool calls paired with their results. */
const stepCache = new Map<string, TranscriptStep[]>();
export function transcript(task: string, id: string): Transcript | { error: string } {
  if (!/^[\w-]+$/.test(task)) return { error: "bad session id" };
  const st = store(), a = st.agentsOf(task).find((x) => x.agent_id === id);
  if (!a) return { error: "no such agent in this session" };
  const clip = (v: unknown, n = 6000) => { const t = typeof v === "string" ? v : JSON.stringify(v, null, 2); return t.length > n ? t.slice(0, n) + `\n… (${t.length - n} more characters)` : t; };
  const dir = join(STATE_DIR, task, "store", "logs", task);
  const file = a.session_id && existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith(`.${a.session_id}.jsonl`)) : undefined;
  const path = file ? join(dir, file) : "", sig = path ? `${path}:${statSync(path).mtimeMs}:${statSync(path).size}` : "", hit = sig ? stepCache.get(sig) : undefined;   // the socket asks every tick: parse a transcript again only when its file changed
  const steps: TranscriptStep[] = hit ? [...hit] : [], byUse = new Map<string, TranscriptStep>();
  if (file && !hit) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let j: { type?: string; timestamp?: string; message?: { content?: unknown } };
      try { j = JSON.parse(line); } catch { continue; }
      if (j.type !== "assistant" && j.type !== "user") continue;
      const t = Date.parse(j.timestamp ?? "") || 0, c = j.message?.content;
      for (const b of (typeof c === "string" ? [{ type: "text", text: c }] : Array.isArray(c) ? c : []) as Record<string, unknown>[]) {
        if (b.type === "thinking") steps.push({ kind: "thinking", t, text: typeof b.thinking === "string" ? clip(b.thinking) : "" });
        else if (b.type === "text" && typeof b.text === "string" && b.text.trim()) steps.push({ kind: j.type === "user" ? "user" : "text", t, text: clip(b.text) });
        else if (b.type === "tool_use") {
          const inp = b.input as { command?: string } | undefined, cmd = inp?.command ?? "";
          const s: TranscriptStep = { kind: "tool", id: String(b.id), t, text: "", tool: String(b.name), input: clip(cmd || b.input) };
          if (/tools\.ts\s+delegate\b/.test(cmd)) s.calls = "?";   // resolved from its result below
          steps.push(s); byUse.set(String(b.id), s);
        } else if (b.type === "tool_result") {
          const s = byUse.get(String(b.tool_use_id)); if (!s) continue;
          const raw = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? (b.content as { text?: string }[]).map((x) => x.text ?? "").join("\n") : "";
          s.result = clip(raw); s.isError = b.is_error === true; s.end = t;
          if (s.calls === "?") { try { s.calls = (JSON.parse(raw) as { agent_id?: string }).agent_id ?? undefined; } catch { s.calls = undefined; } }
        }
      }
    }
  }
  if (sig && !hit) { stepCache.set(sig, steps); if (stepCache.size > 40) stepCache.delete(stepCache.keys().next().value!); }
  const calls = st.calls.filter((c) => c.task_id === task);
  const children = calls.filter((c) => c.caller_agent_id === id).map((c) => {
    const ca = st.agentsOf(task).find((x) => x.agent_id === c.callee_agent_id), r = (c.req ?? {}) as Record<string, string>, rep = [...st.reports].reverse().find((x) => x.task_id === task && x.agent_id === c.callee_agent_id);
    return { id: c.callee_agent_id ?? "", name: ca?.name ?? c.role, status: c.status, role: c.role, objective: String(r.objective ?? "").slice(0, 1500), answer: String(rep?.summary ?? "").slice(0, 1500) };
  });
  // site_build / fork_all start several sub-agents in the background: they have no result to read, so link them by time (calls this agent made after the step, before the next such step)
  const spawners = steps.filter((x) => x.kind === "tool" && /tools\.ts\s+(site_build|fork_all)\b/.test(x.input ?? ""));
  const delegated = steps.filter((x) => x.kind === "tool" && x.calls);   // an explicit `delegate` already has its own row
  spawners.forEach((x, i) => {
    const until = spawners[i + 1]?.t ?? Infinity;
    x.spawned = calls.filter((c) => c.caller_agent_id === id && c.t >= x.t - 2000 && c.t < until && !delegated.some((d) => c.t >= d.t - 2000 && c.t <= (d.end ?? d.t) + 2000)).map((c) => { const r = (c.req ?? {}) as Record<string, string>, rep = [...st.reports].reverse().find((y) => y.task_id === task && y.agent_id === c.callee_agent_id); return { id: c.callee_agent_id ?? "", role: c.role, status: c.status, objective: String(r.objective ?? "").slice(0, 600), answer: String(rep?.summary ?? "").slice(0, 600) }; });
  });
  const mine = [...calls].reverse().find((c) => c.callee_agent_id === id), r = (mine?.req ?? {}) as Record<string, string>;
  const rep = [...st.reports].reverse().find((x) => x.task_id === task && x.agent_id === id);
  // what was sent to this agent, with its answers (calls and reports pair up in order), plus the person's notes to it; and the times the person stopped it
  const reps = st.reports.filter((x) => x.task_id === task && x.agent_id === id).sort((x, y) => x.round - y.round);
  const inbox: Transcript["inbox"] = calls.filter((c) => c.callee_agent_id === id).sort((x, y) => x.t - y.t).map((c, i) => ({ t: c.t, from: c.caller_agent_id ?? "?", text: String(((c.req ?? {}) as Record<string, string>).objective ?? ""), answer: reps[i] ? String(reps[i]!.reply ?? reps[i]!.summary ?? "") : undefined }));
  for (const n of st.notes) if (n.task_id === task && n.from === "user" && n.to === id && !n.refs.includes("auto_run")) inbox.push({ t: n.t, from: "you", text: n.text, note: true });
  inbox.sort((x, y) => x.t - y.t);
  const marks = st.events.filter((x) => x.task_id === task && x.agent_id === id && x.kind === "agent.stopped").map((x) => ({ t: x.t, text: "Interrupted by user" }));
  const tk = talking.get(task + "|" + id);
  return { task, id, name: a.name, status: a.status, caller: a.caller_agent_id ?? null, steps, source: file ? "transcript" : "recorded", children, inbox, marks, fake: !!readSide(task)?.fake, talk: tk ? { running: tk.running, error: tk.error } : undefined,
    brief: mine ? { objective: String(r.objective ?? ""), output: String(r.output ?? ""), boundaries: String(r.boundaries ?? "") } : undefined, answer: String(rep?.reply ?? rep?.summary ?? a.final_response ?? "") };
}

// ---- TALK TO A SUB-AGENT: the person's message goes in through the SAME harness command the master uses (tools.ts delegate --session <agent>), so every rule applies
// (locks, call limits, fixtures). A fake-runner session answers from the recorded fixture session (no model call; no fixture = the error is shown); a real one is a real call.
// An agent that is still working cannot be called: the message is left as a note (tools.ts say) it reads at its next step.
const talking = new Map<string, { running: boolean; error?: string }>();
export function talkToAgent(b: TalkIn): { ok: boolean; mode?: "note" | "call"; reason?: string } {
  const { task, agent: id } = b, text = (b.text ?? "").trim();
  if (!/^[\w-]+$/.test(task) || !text) return { ok: false, reason: "missing session or text" };
  const a = store().agentsOf(task).find((x) => x.agent_id === id);
  if (!a) return { ok: false, reason: "no such agent in this session" };
  const sf = join(STATE_DIR, task, "store", "store.json");
  if (!existsSync(sf)) return { ok: false, reason: "this session has no store of its own (an old shared-store session): it cannot be called from here" };
  const tools = join(F1, "harness", "tools.ts"), key = task + "|" + id;
  const env = { ...process.env, HARNESS_STORE: sf, HARNESS_TASK: task, HARNESS_CWD: join(STATE_DIR, task, "workspace"), HARNESS_RUNNER: readSide(task)?.fake ? "fake" : "real" };
  if (a.status === "running") {
    const r = spawnSync("bun", ["--smol", tools, "say", "--to", id, "--text", text], { encoding: "utf8", env: { ...env, HARNESS_AGENT: "user" } });
    return r.status === 0 ? { ok: true, mode: "note" } : { ok: false, reason: (r.stderr || r.stdout).slice(-300) };
  }
  if (talking.get(key)?.running) return { ok: false, reason: "your last message to this agent is still being answered" };
  talking.set(key, { running: true });
  const p = spawn("bun", ["--smol", tools, "delegate", "--role", a.name, "--session", id, "--objective", text, "--output", "Reply to the person in a few lines.", "--boundaries", "The person is talking to you directly, not the master. Answer them. Change files only if they ask for it."],
    { env: { ...env, HARNESS_AGENT: a.caller_agent_id ?? "lead#1" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", () => {
    let error: string | undefined;
    try { const j = JSON.parse(out.trim().split("\n").pop() ?? "{}") as { ok?: boolean; reason?: string; error?: string }; if (j.ok === false) error = j.reason ?? j.error ?? "refused"; } catch { error = out.trim().slice(-300) || "no answer"; }
    talking.set(key, { running: false, error });
  });
  return { ok: true, mode: "call" };
}
