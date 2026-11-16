// A window onto the multi-agent harness: chat with the master (lead) on the left, the sub-agent sessions and their states on the right.
//   cd ui && bun run dev        real claude (haiku, cents per turn)        bun run dev:fake     scripted agents, no model calls
// Env: UI_PORT (5174)  UI_RUNNER real|fake  UI_MAX_DEPTH (4; 1 = multi-agent off)  UI_REPO (project the agents work on)  UI_STORE (registry file)  UI_WRITER_MODE shared|worktree
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RealRunner, ScriptRunner, callAgent, findArchive, loadAgents, projectsRoot, transcriptExistsAnywhere, type AgentRow } from "../harness/core/base.ts";
import { MStore, inbox, say } from "../harness/core/board.ts";
import { SESSION_CAP } from "../harness/core/session_run.ts";
import { isStatusOnly, statusReply } from "../harness/core/status_reply.ts";
import { costOf, stopAgent } from "../harness/core/agent_call.ts";
import { locksFromEnv } from "../harness/core/lockapi.ts";
import { hookArgs } from "../harness/core/hooks_settings.ts";
import { runLead } from "../harness/lead.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), E = process.env;
const DATA = join(ROOT, "ui", ".ui-data"), STORE = resolve(E.UI_STORE ?? join(DATA, "store.json")), REPO = resolve(E.UI_REPO ?? join(DATA, "repo"));
const RUNNER = E.UI_RUNNER === "fake" ? "fake" : "real", MAX_DEPTH = Number(E.UI_MAX_DEPTH ?? 4), WRITER = E.UI_WRITER_MODE === "shared" ? "shared" : "worktree";
const PORT = Number(E.UI_PORT ?? 5174);

mkdirSync(DATA, { recursive: true });
if (!existsSync(join(REPO, ".git"))) {   // a throwaway project for the agents, with one commit (worktrees need a HEAD)
  mkdirSync(REPO, { recursive: true });
  writeFileSync(join(REPO, "README.md"), "# scratch project\nThe agents work here.\n");
  const g = (...a: string[]) => execFileSync("git", ["-C", REPO, "-c", "user.name=ui", "-c", "user.email=ui@local", ...a], { stdio: "ignore" });
  g("init", "-q"); g("add", "-A"); g("commit", "-qm", "init");
}

const defs = loadAgents(join(ROOT, "harness", "agents"));
const store = new MStore(STORE);                       // the instance that runs the lead
// A session = one task id (its master, its sub-agents, its chat). The console shows one at a time; the others keep running in the background.
const newTaskId = () => "s" + Date.now().toString(36);
// Which session a request is about comes from the request itself (header x-session), so two browser tabs never fight over it.
// Without the header (first load of the bare URL) it is the most recently active session.
const als = new AsyncLocalStorage<string>();
const latestTask = () => { store.reload(); return [...store.runs].sort((a, b) => b.last_active_at - a.last_active_at)[0]?.task_id ?? "new"; };
const curTask = () => als.getStore() ?? latestTask();
const ctx = {
  store, defs, sessionCap: SESSION_CAP,
  runner: RUNNER === "real" ? new RealRunner(600_000) : new ScriptRunner(async (c) => { await new Promise((r) => setTimeout(r, 1500)); return `(fake lead) I heard: ${c.prompt.split("REQUEST FROM THE PERSON:\n")[1]?.split("\n\n")[0]?.slice(0, 300) ?? "?"}`; }),
  transcriptExists: RUNNER === "real" ? (_c: string, id: string) => transcriptExistsAnywhere(id) : undefined,
};

// ---- the lead's turns, per session: one at a time; messages sent meanwhile are queued and become the next turn
interface Turn { busy: boolean; since: number; error: string; queue: { id: string; text: string; t: number }[] }
const turns = new Map<string, Turn>();
const turn = (t: string): Turn => { let x = turns.get(t); if (!x) turns.set(t, (x = { busy: false, since: 0, error: "", queue: [] })); return x; };
async function pump(task: string) {
  const T = turn(task);
  if (T.busy) return;
  T.busy = true;
  try {
    while (T.queue.length) {
      const msg = T.queue.shift()!, text = msg.text;   // one message per turn: each gets its own reply, in order
      T.since = Date.now();
      try {
        store.reload(); store.tx(() => { const n = say(store, task, "user", "lead", text, [], Infinity); n.t = msg.t; store.save(); });   // the time shown is when the person pressed send, not when the master picked it up   // only now does it enter the conversation; until then it waits in the queue
        if (isStatusOnly(text)) { store.reload(); store.tx(() => { say(store, task, "lead", "user", statusReply(store, task), [], Infinity); }); continue; }   // a plain "status?" is answered from the board for free (no lead resume, see core/status_reply.ts)
        const out = await runLead(ctx as never, { task_id: task, repo: REPO, request: text, maxDepth: MAX_DEPTH, runner: RUNNER, writerMode: WRITER });
        T.error = out.ok ? "" : String(out.error ?? "the lead failed"); if (!out.ok) problem(task, `the master turn failed: ${T.error}`);
        store.reload(); store.tx(() => { say(store, task, "lead", "user", out.ok ? out.reply : `(the lead could not answer: ${out.error})`, [], Infinity); });
      } catch (e) {
        T.error = String(e); problem(task, `the master turn crashed: ${T.error}`);
        store.reload(); store.tx(() => { say(store, task, "lead", "user", `(error: ${T.error})`); });
      }
    }
  } finally { T.busy = false; }
}

// ---- processes: an agent's work is a `claude` process found by its session id (the same way for pause, continue and stop)
interface Proc { pid: number; ppid: number; stat: string; args: string }
function psList(): Proc[] {
  const r = spawnSync("ps", ["-eo", "pid=,ppid=,stat=,args="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return (r.stdout ?? "").split("\n").map((l) => { const m = l.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/); return m ? { pid: +m[1]!, ppid: +m[2]!, stat: m[3]!, args: m[4]! } : null; }).filter((x): x is Proc => !!x);
}
/** The claude process(es) running this session: `--session-id <id>` or `--resume <id>` (a fork's source id does not count). */
function claudeProcs(all: Proc[], sessionId: string | null): Proc[] {
  if (!sessionId) return [];
  const own = new RegExp(`--session-id[ =]${sessionId}\\b`), res = new RegExp(`--resume[ =]${sessionId}\\b`);
  return all.filter((p) => p.pid !== process.pid && /\bclaude\b/.test(p.args.slice(0, 160)) && (own.test(p.args) || (!p.args.includes("--fork-session") && res.test(p.args))));
}
function withChildren(all: Proc[], roots: Proc[]): number[] {
  const out = new Set(roots.map((p) => p.pid)), todo = [...out];
  while (todo.length) { const id = todo.pop()!; for (const p of all) if (p.ppid === id && !out.has(p.pid)) { out.add(p.pid); todo.push(p.pid); } }
  return [...out];
}
const signal = (pids: number[], sig: NodeJS.Signals) => pids.filter((pid) => { try { process.kill(pid, sig); return true; } catch { return false; } }).length;
const isPaused = (all: Proc[], sessionId: string | null) => { const ps = claudeProcs(all, sessionId); return ps.length > 0 && ps.every((p) => p.stat.startsWith("T")); };

// A paused agent does not touch its locks, so their lease would run out; keep renewing it while it is paused.
setInterval(() => {
  try {
    const s = new MStore(STORE), run = s.agents.filter((a) => a.name !== "lead" && a.status === "running");
    if (!run.length) return;
    const all = psList();
    for (const a of run) if (isPaused(all, a.session_id)) void locksFromEnv(store).renew(a.task_id, a.agent_id, 120_000);
  } catch { /* best effort */ }
}, 20_000).unref();

// ---- a session's transcript (the CLI keeps every message in ~/.claude/projects/<folder>/<session>.jsonl)
interface Item { role: "user" | "assistant"; kind: "text" | "tool_use" | "tool_result"; text: string; t: number; label?: string; tool?: Record<string, string> }
const tcache = new Map<string, { size: number; items: Item[] }>();
function transcriptPath(id: string): string | null {
  try { const root = projectsRoot(); for (const d of readdirSync(root)) { const f = join(root, d, id + ".jsonl"); if (existsSync(f)) return f; } } catch { /* none */ }
  return findArchive(STORE, id);   // Claude's copy is gone (a writer's temporary worktree): our own copy
}
/** A Bash call to tools.ts (delegate, wait, say, ...) is the agents' own API: parse it so the console can show "delegate -> researcher" instead of a shell line. */
function toolInfo(name: string | undefined, input: unknown): { label: string; tool?: Record<string, string> } {
  const inp = (input ?? {}) as { command?: string; file_path?: string; pattern?: string; url?: string };
  const cmd = String(inp.command ?? ""), m = name === "Bash" ? cmd.match(/tools\.ts\s+(\w+)/) : null;
  if (m) {
    const tool: Record<string, string> = { cmd: m[1]! };
    for (const x of cmd.matchAll(/--(\w+)\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/g)) tool[x[1]!] = x[2] ?? x[3] ?? x[4] ?? "";
    if (cmd.includes("--async")) tool.async = "1";
    return { tool, label: [tool.cmd, tool.role && "-> " + tool.role, tool.agents, tool.agent, tool.to && "to " + tool.to].filter(Boolean).join(" ") };
  }
  return { label: `${name ?? "tool"} ${inp.file_path ?? inp.command ?? inp.pattern ?? inp.url ?? ""}`.trim().slice(0, 90) };
}
const cap = (x: string, _n?: number) => x;   // never shorten what the person reads
function transcript(id: string | null): Item[] | null {
  if (!id) return null;
  const f = transcriptPath(id); if (!f) return null;
  const size = statSync(f).size, hit = tcache.get(f);
  if (hit && hit.size === size) return hit.items;
  const items: Item[] = [];
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line) continue;
    let j: { type?: string; isMeta?: boolean; timestamp?: string; message?: { content?: unknown } };
    try { j = JSON.parse(line); } catch { continue; }
    if ((j.type !== "user" && j.type !== "assistant") || j.isMeta) continue;
    const role = j.type, t = j.timestamp ? Date.parse(j.timestamp) : 0, c = j.message?.content;
    if (typeof c === "string") { if (c.trim()) items.push({ role, kind: "text", text: cap(c), t }); continue; }
    if (!Array.isArray(c)) continue;
    for (const b of c as { type?: string; text?: string; name?: string; input?: unknown; content?: unknown }[]) {
      if (b.type === "text" && b.text?.trim()) items.push({ role, kind: "text", text: cap(b.text), t });
      else if (b.type === "tool_use") items.push({ role, kind: "tool_use", text: cap(`${b.name} ${JSON.stringify(b.input ?? {})}`, 600), t, ...toolInfo(b.name, b.input) });
      else if (b.type === "tool_result") items.push({ role, kind: "tool_result", text: cap(typeof b.content === "string" ? b.content : Array.isArray(b.content) ? (b.content as { text?: string }[]).map((x) => x.text ?? "").join("\n") : JSON.stringify(b.content ?? "")), t });
    }
  }
  const tail = items;
  tcache.set(f, { size, items: tail }); return tail;
}

// ---- failures are never silent: they go to the console, to .ui-data/problems.log, and into the session's chat
const PROBLEMS = join(DATA, "problems.log");
function problem(task: string | null, text: string) {
  const line = `${new Date().toISOString()} ${task ?? "-"} ${text}`;
  console.error("PROBLEM " + line);
  try { appendFileSync(PROBLEMS, line + "\n"); } catch { /* the console line above is still there */ }
}
/** An agent the registry calls "running" whose process is gone (the console or the machine stopped) would show "working" for ever. Mark it interrupted and SAY SO in its chat.
 *  An agent whose claude process, or whose detached `tools.ts _run --call <id>` process, is still alive is left alone. */
async function reconcile(why: string) {
  if (RUNNER !== "real" && !E.UI_RECONCILE) return;   // a fake runner has no processes to look for
  store.reload();
  const all = psList(), alive = (a: AgentRow) => claudeProcs(all, a.session_id).length > 0 || (!!a.last_call_id && all.some((p) => p.args.includes("tools.ts") && p.args.includes(`_run --call ${a.last_call_id}`)));
  const stale = store.agents.filter((a) => (a.status === "running" || a.status === "stalled") && !alive(a) && !(a.name === "lead" && turn(a.task_id).busy) && !directRuns.has(a.agent_id));
  if (!stale.length) return;
  const ended: { task: string; call: string }[] = [], tasks = new Set<string>();
  store.tx(() => {
    for (const a of stale) {
      a.status = "idle"; a.activity = `interrupted (${why})`; a.epoch = (a.epoch ?? 0) + 1; tasks.add(a.task_id);
      store.ev("agent.interrupted", a.task_id, a.agent_id, { why });
    }
    for (const c of store.calls.filter((x) => x.status === "granted" && stale.some((a) => a.agent_id === x.callee_agent_id && a.task_id === x.task_id))) { c.status = "failed"; c.reason = "interrupted"; ended.push({ task: c.task_id, call: c.id }); }
    for (const task of tasks) {
      const mine = stale.filter((a) => a.task_id === task), lead_ = mine.some((a) => a.name === "lead"), subs = mine.filter((a) => a.name !== "lead").map((a) => a.agent_id);
      say(store, task, "lead", "user", `⚠ INTERRUPTED (${why}). ` + (lead_ ? "The master was in the middle of your last request when it stopped, so that request is NOT finished. Send it again, or write \"continue\" and it picks up from its own memory. " : "") + (subs.length ? `Sub-agents cut off: ${subs.join(", ")}. Ask the master to continue or redo them.` : ""), [], Infinity);
    }
  });
  const locks = locksFromEnv(store);
  for (const e of ended) await locks.release(e.task, e.call, 120_000);
  for (const a of stale) problem(a.task_id, `${a.agent_id} was "running" but its process is gone (${why}); marked interrupted`);
}

// ---- a question nobody answered, and a call that was refused, are shown on BOTH sides with the same words
const firstLine = (x: string) => x.split("\n")[0]!.slice(0, 220);
function waitingNotices(s: MStore, all: AgentRow[]) {
  return all.filter((a) => a.needs_parent).map((a) => {
    const parent = all.find((x) => x.agent_id === a.caller_agent_id), q = firstLine(a.needs_parent!);
    return parent
      ? { id: "np:" + a.agent_id + ":" + q.length, t: a.last_event_at, agent: parent.agent_id, text: `${a.agent_id} is waiting for an answer from ${parent.agent_id}: ${q}` }
      : { id: "np:" + a.agent_id + ":nop", t: a.last_event_at, agent: a.agent_id, text: `Something went wrong: ${a.agent_id} is waiting for its parent ${a.caller_agent_id ?? "(none)"}, which no longer exists, so nobody can answer: ${q}` };
  });
}
function deniedNotices(s: MStore) {
  return s.events.filter((e) => e.task_id === curTask() && e.kind === "agent.call.denied").slice(-5).map((e) => {
    const d = (e.data ?? {}) as { role?: string; code?: string; reason?: string };
    return { id: "dn:" + (e.id ?? e.t), t: e.t, agent: e.agent_id ?? null, text: `Something went wrong: ${e.agent_id} could not call ${d.role}: ${d.reason ?? d.code}` };
  });
}

// ---- reading state (a fresh read each time: tools.ts child processes write the same file)
const lead = (s: MStore) => s.agentsOf(curTask()).find((a) => a.name === "lead");
const short = (a: AgentRow) => ({
  id: a.agent_id, name: a.name, role: a.role, level: a.level, caller: a.caller_agent_id, status: a.status, title: a.title, description: a.description,
  activity: a.activity, needs_parent: a.needs_parent ?? null, session: a.session_id, resumes: a.resume_count, runs: a.runs ?? 0, last_event_at: a.last_event_at, started_at: a.started_at ?? null, finished_at: a.finished_at ?? null,
});
function state() {
  const s = new MStore(STORE), L = lead(s), T = turn(curTask()), all = s.agentsOf(curTask()), others = all.filter((a) => a.name !== "lead");
  const live = others.some((a) => a.status === "running"), ps = live ? psList() : [], paused = new Set(others.filter((a) => a.status === "running" && isPaused(ps, a.session_id)).map((a) => a.agent_id));
  const leadWorking = T.busy || L?.status === "running", othersRunning = others.filter((a) => (a.status === "running" || a.status === "stalled") && !paused.has(a.agent_id));
  // working: the master itself is in a turn. running: the master is free but other agents are doing work. active: nobody is working, ready to talk.
  const master = leadWorking ? "working" : othersRunning.length ? "running" : "active";
  const LT = L ? transcript(L.session_id) : null;
  const lastText = (tr: Item[] | null, fallback: string | null | undefined) => (tr ? [...tr].reverse().find((i) => i.role === "assistant" && i.kind === "text")?.text : undefined) ?? fallback ?? "";
  const doing = (a: AgentRow, tr: Item[] | null, isPaused_: boolean, busy = a.status === "running") => {
    if (isPaused_) return "paused by you";
    if (a.needs_parent && !busy) return "waiting for its parent (" + (a.caller_agent_id ?? "?") + "): " + a.needs_parent.split("\n")[0];   // NOT finished: it asked a question and nobody answered
    if (busy) {
      const last = tr?.[tr.length - 1];
      if (!last) return /^(new|resumed|rolled|forked) session$|^starting$/.test(a.activity) || !a.activity ? "starting up" : a.activity;
      if (last.kind === "tool_use") return "tool: " + (last.label ?? last.text.slice(0, 80));
      if (last.kind === "tool_result") return "thinking (after a tool result)";
      return last.role === "assistant" ? "writing its reply" : "reading its task";
    }
    return a.status === "failed" ? "failed: " + a.activity : a.activity === "stopped" ? "stopped by you" : a.runs ? "finished" : "not started";
  };
  const seen = (a: AgentRow) => (a.status === "idle" && (a.runs ?? 0) > 0 && LT ? LT.some((i) => i.kind === "tool_result" && i.t >= (a.finished_at ?? 0) - 1500 && i.text.includes(a.agent_id)) : null);   // heuristic: the master's tool output after it finished mentions it
  const chat = s.notes.filter((n) => n.task_id === curTask() && (n.from === "user" || n.to === "user")).map((n) => ({ id: n.id, from: n.from === "user" ? "user" : "lead", text: n.text, t: n.t }));
  const sessions = s.runs.map((r) => { const ag = s.agentsOf(r.task_id), sb = ag.filter((a) => a.name !== "lead");
    return { task: r.task_id, title: (s.notes.find((n) => n.task_id === r.task_id && n.from === "user")?.text ?? "(empty)").replace(/\s+/g, " ").slice(0, 70), last: r.last_active_at, subs: sb.length,
      state: turn(r.task_id).busy || ag.find((a) => a.name === "lead")?.status === "running" ? "working" : sb.some((a) => a.status === "running") ? "running" : "active" }; }).sort((a, b) => b.last - a.last);
  const known = sessions.some((x) => x.task === curTask());
  if (!known) sessions.unshift({ task: curTask(), title: "New session", last: Date.now(), subs: 0, state: "active" });
  return {
    problems: [...waitingNotices(s, all), ...deniedNotices(s), ...s.events.filter((e) => e.task_id === curTask() && /^(agent\.failed|agent\.interrupted|writes\.violation|agent\.stalled|log\.missing|log\.restore_failed)$/.test(e.kind)).slice(-5).map((e) => ({ id: e.id ?? String(e.t), t: e.t, agent: e.agent_id ?? null, text: `Something went wrong: ${e.kind} ${e.agent_id ?? ""} ${JSON.stringify(e.data ?? {})}` })), ...(T.error ? [{ id: "err:" + T.error.slice(0, 40), t: Date.now(), text: "master: " + T.error }] : [])],
    task: curTask(), known, sessions, master, master_doing: L ? doing(L, LT, false, leadWorking) : "", master_detail: { waiting_on_master: others.filter((a) => a.needs_parent && a.caller_agent_id === L?.agent_id).length, activity: L?.activity ?? "", queued_messages: T.queue.length, queued: T.queue.map((m) => ({ id: m.id, text: m.text, t: m.t })), working_for_ms: T.busy ? Date.now() - T.since : 0, other_running: othersRunning.length, other_paused: paused.size, error: T.error },
    config: { runner: RUNNER, max_depth: MAX_DEPTH, writer_mode: WRITER, repo: REPO, task: curTask() },
    lead: L ? { ...short(L), kind: "master", cost: costOf(s, curTask(), L.agent_id) } : null,
    agents: others.map((a) => { const tr = transcript(a.session_id); return { ...short(a), ...labels(s, a), kind: a.name, paused: paused.has(a.agent_id), cost: costOf(s, curTask(), a.agent_id),
      last_msg: lastText(tr, a.final_response).replace(/\s+/g, " "), doing: doing(a, tr, paused.has(a.agent_id)), seen_by_master: seen(a) }; }),
    calls: s.calls.filter((c) => c.task_id === curTask()).slice(-60).map((c) => ({ id: c.id, from: c.caller_agent_id, to: c.callee_agent_id, role: c.role, level: c.level, status: c.status, reason: c.reason, t: c.t, objective: ((c.req as { objective?: string } | undefined)?.objective ?? "") })),
    chat, events: s.events.filter((e) => e.task_id === curTask()).slice(-40).map((e) => ({ t: e.t, kind: e.kind, agent: e.agent_id ?? "", data: JSON.stringify(e.data ?? {}) })),
    patches: s.patches.filter((p) => p.task_id === curTask()).map((p) => ({ id: p.id, agent: p.agent_id, state: p.state, files: p.files.length })),
    locks: s.locks.filter((l) => l.task_id === curTask()).map((l) => ({ path: l.path, agent: l.agent_id })),
  };
}
/** A card must say what the agent is FOR. The master sets a title/description with agent_update; until it does, use the task it was given. */
function labels(s: MStore, a: AgentRow): { title: string; description: string } {
  const obj = String(([...s.calls].reverse().find((c) => c.callee_agent_id === a.agent_id && (c.req as { objective?: string } | undefined)?.objective)?.req as { objective?: string } | undefined)?.objective ?? "").replace(/\s+/g, " ").trim();
  const base = defs.get(a.name)?.description;
  return { title: a.title && a.title !== a.name ? a.title : obj ? obj.slice(0, 60) + (obj.length > 60 ? "…" : "") : a.name,
    description: a.description && a.description !== base ? a.description : obj ? obj : a.description };
}
const tversion = (sid: string | null) => { const f = sid ? transcriptPath(sid) : null; try { return f ? statSync(f).size : -1; } catch { return -1; } };
function agentDetail(id: string, v?: string | null) {
  const s = new MStore(STORE), a = s.agent(curTask(), id);
  if (!a) return null;
  const paused = a.status === "running" && isPaused(psList(), a.session_id), kids = descendantsOf(s, id);
  return { ...short(a), ...labels(s, a), paused, final_response: a.final_response ?? null, cost: costOf(s, curTask(), id), descendants: kids.length,
    tv: tversion(a.session_id), log: a.session_id ? transcriptPath(a.session_id) : null, archive: a.session_id ? findArchive(STORE, a.session_id) : null, transcript_same: v != null && v === String(tversion(a.session_id)), transcript: v != null && v === String(tversion(a.session_id)) ? undefined : transcript(a.session_id),
    notes: s.notes.filter((n) => n.task_id === curTask() && ((n.from === "user" && n.to === id) || (n.from === id && n.to === "user"))).slice(-30).map((n) => ({ from: n.from, text: n.text, t: n.t, read: n.read_by.length > 0 })),
    reports: s.reports.filter((r) => r.task_id === curTask() && r.agent_id === id).slice(-5).map((r) => ({ t: (r as { t?: number }).t ?? 0, summary: r.summary, files: r.files, cost: r.cost })),
    calls: s.calls.filter((c) => c.task_id === curTask() && (c.callee_agent_id === id || c.caller_agent_id === id)).slice(-10).map((c) => ({ id: c.id, from: c.caller_agent_id, to: c.callee_agent_id, role: c.role, status: c.status, reason: c.reason, t: c.t, objective: (c.req as { objective?: string } | undefined)?.objective ?? "" })),
    events: s.events.filter((e) => e.task_id === curTask() && e.agent_id === id).slice(-25).map((e) => ({ t: e.t, kind: e.kind, data: JSON.stringify(e.data ?? {}) })) };
}
const descendantsOf = (s: MStore, id: string) => { const out: AgentRow[] = [], todo = [id]; while (todo.length) { const x = todo.pop()!; for (const a of s.agentsOf(curTask())) if (a.caller_agent_id === x && !out.includes(a)) { out.push(a); todo.push(a.agent_id); } } return out; };

// ---- acting on one sub-agent
const toolsTs = join(ROOT, "harness", "tools.ts");
const agentEnv = (agent: string) => ({ HARNESS_STORE: STORE, HARNESS_TASK: curTask(), HARNESS_AGENT: agent, HARNESS_CWD: REPO, HARNESS_MAX_DEPTH: String(MAX_DEPTH), HARNESS_RUNNER: RUNNER, HARNESS_WRITER_MODE: WRITER === "worktree" ? "worktree" : "shared", HARNESS_MODELS: "{}", HARNESS_MAX_INSTANCES: "6" });
const sub = (id: string) => { store.reload(); const a = store.agent(curTask(), id); return a && a.name !== "lead" ? a : undefined; };

function pauseAgent(id: string, on: boolean) {
  const a = sub(id); if (!a) return { status: 404, body: { error: "no such sub-agent" } };
  if (a.status !== "running") return { status: 409, body: { error: `${id} is ${a.status}, not running` } };
  const all = psList(), ps = claudeProcs(all, a.session_id);
  if (!ps.length) return { status: 409, body: { error: RUNNER === "fake" ? "fake runner: there is no process to pause" : "no live claude process for this agent right now" } };
  const n = signal(withChildren(all, ps), on ? "SIGSTOP" : "SIGCONT");
  store.tx(() => { store.ev(on ? "agent.paused" : "agent.continued", curTask(), id, { by: "user", signalled: n }); });
  return { status: 200, body: { ok: true, paused: on, signalled: n } };
}
async function stopSub(id: string) {
  const task = curTask();
  const a = sub(id); if (!a) return { status: 404, body: { error: "no such sub-agent" } };
  let rows: AgentRow[] = [], calls: string[] = [];
  store.tx(() => { rows = stopAgent(store, task, id); calls = store.calls.filter((c) => c.status === "failed" && c.reason === "stopped").map((c) => c.id); });   // bumps the epoch: a late result is thrown away
  const all = psList(); let killed = 0;
  for (const r of rows) killed += signal(withChildren(all, claudeProcs(all, r.session_id)), "SIGKILL");   // at once, not at the next 1 s watchdog tick
  const locks = locksFromEnv(store), promoted: string[] = [];
  for (const c of calls) promoted.push(...(await locks.release(task, c, 120_000)));
  for (const pc of promoted) {   // a writer that was queued behind the stopped one gets its locks: start it, as the finishing callee would have
    store.tx(() => { const call = store.calls.find((x) => x.id === pc), ag = call && store.agent(task, call.callee_agent_id!); if (ag) { ag.status = "running"; ag.activity = "starting"; ag.last_event_at = Date.now(); } });
    spawn("bun", ["--smol", toolsTs, "_run", "--call", pc], { detached: true, stdio: "ignore", env: { ...process.env, ...agentEnv(lead(store)?.agent_id ?? "") } }).on("error", (e) => problem(task, `could not start the queued call ${pc}: ${e}`)).unref();
  }
  return { status: 200, body: { ok: true, stopped: rows.map((r) => r.agent_id), killed, started_next: promoted.length } };
}
/** Delete a whole master session: kill its processes, drop every record of it, its archived logs and the CLI's own transcripts. */
function deleteSession(task: string) {
  store.reload();
  if (!store.runs.some((r) => r.task_id === task) && !store.agents.some((a) => a.task_id === task)) return { status: 404, body: { error: "no such session" } };
  const t = turn(task); t.queue.length = 0;
  const logDir = join(dirname(STORE), "logs", task);   // archived logs name every session an agent ever had, rolled ones too
  const archived = existsSync(logDir) ? readdirSync(logDir).map((f) => f.match(/\.([0-9a-f-]{36})\.jsonl$/)?.[1]).filter((x): x is string => !!x) : [];
  const sids = [...new Set([...store.agents.filter((a) => a.task_id === task).map((a) => a.session_id).filter((x): x is string => !!x), ...archived])];
  const all = psList(), callIds = store.calls.filter((c) => c.task_id === task).map((c) => c.id); let killed = 0;
  for (const sid of sids) killed += signal(withChildren(all, claudeProcs(all, sid)), "SIGKILL");
  killed += signal(withChildren(all, all.filter((p) => p.args.includes("tools.ts") && callIds.some((c) => p.args.includes(`_run --call ${c}`)))), "SIGKILL");
  let transcripts = 0;
  try { const root = projectsRoot(); for (const d of readdirSync(root)) for (const sid of sids) { const f = join(root, d, sid + ".jsonl"); if (existsSync(f)) { rmSync(f, { force: true }); transcripts++; } } } catch { /* none */ }
  rmSync(logDir, { recursive: true, force: true });
  store.tx(() => { const m = store as unknown as Record<string, { task_id?: string }[]>; for (const k of ["agents", "reports", "findings", "requests", "events", "calls", "locks", "waiters", "patches", "notes", "plans", "runs"]) if (Array.isArray(m[k])) m[k] = m[k]!.filter((x) => x.task_id !== task); });
  turns.delete(task);
  return { status: 200, body: { ok: true, deleted: task, killed, transcripts } };
}
const directRuns = new Set<string>();
function messageSub(id: string, text: string) {
  const task = curTask();
  const a = sub(id); if (!a) return { status: 404, body: { error: "no such sub-agent" } };
  if (directRuns.has(id)) return { status: 409, body: { error: "it is still answering your last message" } };
  store.tx(() => { say(store, task, "user", id, text, [], Infinity); });   // on record at once
  if (a.status === "running") return { status: 200, body: { ok: true, mode: "note", detail: "delivered after its next tool call" } };   // the PostToolUse hook hands it over
  store.tx(() => { inbox(store, task, id); });   // this message goes in the prompt itself, so it must not also arrive as a note
  directRuns.add(id);
  const cwd = a.cwd && existsSync(a.cwd) ? a.cwd : REPO;
  const runner = RUNNER === "real" ? new RealRunner(600_000) : new ScriptRunner(async () => { await new Promise((r) => setTimeout(r, 1500)); return `(fake ${a.name}) I heard: ${text.slice(0, 200)}`; });
  void callAgent({ ...ctx, runner } as never, a, cwd, () => `MESSAGE FROM THE PERSON (sent to you directly, not through the lead):\n${text}`, undefined, { intent: "resume" },
    { env: agentEnv(id), extraArgs: RUNNER === "real" ? hookArgs(join(ROOT, "harness")) : undefined })
    .then((out) => { store.reload(); store.tx(() => { say(store, task, id, "user", out.ok ? out.reply : `(could not answer: ${out.error})`, [], Infinity); }); })
    .catch((e) => { store.reload(); store.tx(() => { say(store, task, id, "user", `(error: ${String(e).slice(0, 200)})`); }); })
    .finally(() => directRuns.delete(id));
  return { status: 200, body: { ok: true, mode: "turn", detail: "started a new turn with your message" } };
}

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
await reconcile("the console was restarted");
const handle = async (req: Request): Promise<Response> => {
    const u = new URL(req.url);
    try {
      if (req.method === "POST") {   // a page on another site must not be able to drive this console
        const o = req.headers.get("origin");
        if (req.headers.get("content-type")?.split(";")[0] !== "application/json" || (o && new URL(o).host !== u.host)) return json({ error: "forbidden" }, 403);
      }
      if (u.pathname === "/api/state") return json(state());
      if (u.pathname === "/api/agent") { const d = agentDetail(u.searchParams.get("id") ?? "", u.searchParams.get("v")); return d ? json(d) : json({ error: "no such agent" }, 404); }
      if (u.pathname === "/api/chat" && req.method === "POST") {
        const text = String(((await req.json()) as { text?: string }).text ?? "").trim();
        if (!text) return json({ error: "empty message" }, 400);
        const task = curTask(), queued = turn(task).busy, id = "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        turn(task).queue.push({ id, text, t: Date.now() }); void pump(task);   // idle: pump starts at once and the message is in the conversation before this returns
        return json({ ok: true, queued, id });
      }
      if (u.pathname === "/api/chat/cancel" && req.method === "POST") {   // a queued message can be withdrawn until the master picks it up
        const id = String(((await req.json()) as { id?: string }).id ?? ""), q = turn(curTask()).queue, i = q.findIndex((m) => m.id === id);
        if (i >= 0) q.splice(i, 1);
        return json({ ok: i >= 0 });
      }
      if (u.pathname === "/api/session" && req.method === "POST") {
        const b = (await req.json()) as { action?: string; task?: string };
        if (b.action === "new") return json({ ok: true, task: newTaskId() });
        if (b.action === "select") { store.reload(); return store.runs.some((r) => r.task_id === b.task) ? json({ ok: true, task: b.task }) : json({ error: "no such session" }, 404); }
        if (b.action === "delete") { const r = deleteSession(String(b.task ?? "")); return json(r.body, r.status); }
        return json({ error: "unknown action" }, 400);
      }
      if (u.pathname.startsWith("/api/agent/") && req.method === "POST") {
        const act = u.pathname.slice("/api/agent/".length), b = (await req.json()) as { id?: string; text?: string }, id = String(b.id ?? "");
        const r = act === "pause" ? pauseAgent(id, true) : act === "continue" ? pauseAgent(id, false) : act === "stop" ? await stopSub(id)
          : act === "message" ? (String(b.text ?? "").trim() ? messageSub(id, String(b.text).trim()) : { status: 400, body: { error: "empty message" } }) : { status: 404, body: { error: "unknown action" } };
        return json(r.body, r.status);
      }
      if (u.pathname === "/" || u.pathname === "/index.html") return new Response(Bun.file(join(ROOT, "ui", "index.html")), { headers: { "content-type": "text/html; charset=utf-8" } });
      return new Response("not found", { status: 404 });
    } catch (e) { problem(null, `${req.method} ${u.pathname} failed: ${String(e)}`); return json({ error: String(e) }, 500); }
};
Bun.serve({
  port: PORT, hostname: "127.0.0.1",   // these endpoints start agents and kill processes: this machine only
  fetch(req) {
    const t = req.headers.get("x-session");
    if (t !== null && !/^[A-Za-z0-9_-]{1,40}$/.test(t)) return Promise.resolve(json({ error: "bad session id" }, 400));
    return t ? als.run(t, () => handle(req)) : handle(req);   // the session is the TAB's, never the server's
  },
});
console.log(`harness UI  http://localhost:${PORT}   runner=${RUNNER} max_depth=${MAX_DEPTH} writers=${WRITER}\n  repo  ${REPO}\n  store ${STORE}`);
