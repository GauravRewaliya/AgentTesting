// The fixture runner (core/run.ts) records a case here: ONE case -> ONE session folder in .state (store.ts does the file work).
//   sessions/fx_<case>/run/        raw logs of THIS case while it runs: trace.jsonl, harness.jsonl, guard.json   (a child starts from a copy of its parent's harness.jsonl so follow-ups to the parent's sub-agents still resolve)
//   sessions/fx_<case>/…           session.json, events.jsonl, workspace/ (written by store.writeSession at the end)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findParent, readIndex, readSession, sessionDir } from "./store.ts";
import { STATE2_VERSION, type AgentRec, type EventRec, type SessionRec, type TurnRec } from "./types.ts";

export const taskOf = (caseId: string) => "fx_" + caseId;
const split = (label: string) => ({ role: label.split("#")[0]!, n: Number(label.split("#")[1] ?? 1) });
const lines = (f: string) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

/** the PARENT (root of the chain) of a case that continues `after`; null when `after` is itself a root or there is none */
export function parentOf(ws: string, after?: string): string | null {
  if (!after) return null;
  const s = readSession(ws, taskOf(after))?.session;
  return s ? (s.parent ?? s.task) : null;
}
/** folder of a case's session (parent or child) */
export function caseDir(ws: string, caseId: string, after?: string) { return sessionDir(ws, taskOf(caseId), parentOf(ws, after)); }
export const runDir = (ws: string, caseId: string, after?: string) => join(caseDir(ws, caseId, after), "run");

/** what a continuing case needs from the case it runs after */
export function previous(ws: string, after: string): { sessionId: string; ids: Record<string, string>; workspace: string; harnessLog: string } | undefined {
  const r = readSession(ws, taskOf(after)); if (!r) return undefined;
  const s = r.session, dir = sessionDir(ws, s.task, s.parent);
  return { sessionId: s.master?.claude_session ?? "", ids: Object.fromEntries(s.agents.map((a) => [a.label, a.agent_id])), workspace: join(dir, "workspace"), harnessLog: join(dir, "run", "harness.jsonl") };
}
/** empty run/ for a case about to run; a child starts with its parent's harness.jsonl. Returns how many harness lines were inherited. */
export function openRun(ws: string, caseId: string, after?: string): { dir: string; inherited: number } {
  const dir = runDir(ws, caseId, after); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const prev = after ? previous(ws, after) : undefined;
  if (prev && existsSync(prev.harnessLog)) cpSync(prev.harnessLog, join(dir, "harness.jsonl"));
  return { dir, inherited: lines(join(dir, "harness.jsonl")).length };
}

export type CaseInfo = { id: string; suite: string; title: string; after?: string; turns: { user: string }[] };
export type LastFile = { suite: string; id: string; title: string; at: string; status: string; warnings?: string[]; turns: { expected: string[]; actual: string[]; match: boolean; guard: boolean; notfound: boolean; calls: number; cost: number; reply?: string }[] };

/** build the session record + events of a finished case (everything is read from this case's own run/ folder: no time windows) */
export function buildSession(o: { ws: string; c: CaseInfo; last: LastFile; sessionId: string; ids: Record<string, string>; prevIds: Record<string, string>; inherited: number; runDir: string }): { rec: SessionRec; events: EventRec[] } {
  const { ws, c, last } = o, parent = parentOf(ws, c.after);
  const turns: TurnRec[] = last.turns.map((t, i) => ({ n: i + 1, user: c.turns[i]?.user, expected: t.expected, actual: t.actual, match: t.match, guard: t.guard, notfound: t.notfound, calls: t.calls, cost: t.cost, reply: t.reply }));
  const cost = turns.reduce((a, t) => a + (t.cost ?? 0), 0);
  const ev = lines(join(o.runDir, "harness.jsonl")).slice(o.inherited) as { t: number; kind: string; id?: string; agent?: string; text?: string; fixture?: string | null }[];
  const replies = ev.filter((e) => e.kind === "reply").map((e) => e.fixture ?? null);
  const fresh = Object.keys(o.ids).filter((l) => !(l in o.prevIds)).sort((a, b) => split(a).n - split(b).n);
  const lead: AgentRec = { label: "lead#1", agent_id: "lead#1", role: "lead", caller: null, level: 1, claude_session: o.sessionId, status: "done", fixture: null, cost, runs: turns.length };
  const agents: AgentRec[] = Object.entries(o.ids).map(([label, id]) => ({ label, agent_id: id, role: split(label).role, caller: "lead#1", level: 2, claude_session: id, status: "done", fixture: fresh.includes(label) ? replies[fresh.indexOf(label)] ?? null : null, cost: 0, runs: 1 }));
  const ok = last.status === "ran" && turns.length > 0 && turns.every((t) => t.match && !t.guard && !t.notfound);
  const rec: SessionRec = { version: STATE2_VERSION, task: taskOf(c.id), workspace: ws, parent, runner: "fixture", tags: ["test_run"], case: c.id, suite: c.suite, after: c.after, title: c.title, state: "done", verdict: last.status !== "ran" ? "not_run" : ok ? "pass" : "fail", master: lead, agents, turns, cost, workspace_files: 0, created: Date.parse(last.at), updated: Date.now(), source: { kind: "run", path: "run/ (trace.jsonl, harness.jsonl, guard.json)" } };
  // harness.jsonl names a spawn "s…"; the k-th spawn of this case is the k-th NEW sub-agent of the case, so its events get that sub-agent's real id (the original stays in data.harness_id)
  const spawns = [...new Set(ev.filter((e) => e.kind === "spawn").map((e) => e.id!))], real = new Map(spawns.map((sid, k) => [sid, fresh[k] ? o.ids[fresh[k]!] : undefined]));
  const events: EventRec[] = ev.map((e) => ({ t: e.t, kind: e.kind, agent: e.agent, id: (e.id && real.get(e.id)) || e.id, fixture: e.fixture, text: e.text, data: { harness_id: e.id } }));
  return { rec, events };
}
export const hasRun = (ws: string, caseId: string) => !!findParent(readIndex(), ws, taskOf(caseId)) || !!readSession(ws, taskOf(caseId));
