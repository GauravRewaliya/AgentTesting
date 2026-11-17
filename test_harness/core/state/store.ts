// Reads and writes .state (types in ./types.ts). Only this file knows the paths. Every write is atomic (temp file + rename).
// Rules it enforces: a session has a workspace; a child has a parent that already exists IN THE SAME workspace.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_ROOT, currentWorkspace, workspacePath } from "../paths.ts";
import { STATE_VERSION, type ChildSummary, type EventRec, type IndexFile, type SessionRec, type SessionSummary, type SubSession, type WorkspaceRec } from "./types.ts";

export const STATE = STATE_ROOT;   // .state/<version>/ : the version is set by hand in paths.ts
export const indexFile = () => join(STATE, "index.json");
export const wsPath = workspacePath;
const safe = (s: string) => { if (!/^[\w.-]+$/.test(s)) throw new Error("bad id: " + s); return s; };
/** folder of a session: parents under sessions/, children under their parent's children/ */
export const sessionDir = (ws: string, task: string, parent?: string | null) => parent ? join(wsPath(safe(ws)), "sessions", safe(parent), "children", safe(task)) : join(wsPath(safe(ws)), "sessions", safe(task));
const rel = (ws: string, task: string, parent?: string | null) => `data/${ws}/sessions/${parent ? parent + "/children/" : ""}${task}`;
const put = (f: string, text: string) => { mkdirSync(join(f, ".."), { recursive: true }); const t = f + ".tmp" + process.pid; writeFileSync(t, text); renameSync(t, f); };

export function readIndex(): IndexFile {
  try { const j = JSON.parse(readFileSync(indexFile(), "utf8")) as IndexFile; if (j.version === STATE_VERSION) return j; } catch { /* none yet */ }
  return { version: STATE_VERSION, current_workspace: currentWorkspace(), workspaces: [], sessions: [] };
}
export const findParent = (ix: IndexFile, ws: string, task: string) => ix.sessions.find((s) => s.workspace === ws && s.task === task);
export function ensureWorkspace(w: WorkspaceRec) {
  const ix = readIndex(); ix.current_workspace = currentWorkspace();
  if (!ix.workspaces.some((x) => x.id === w.id)) ix.workspaces.push(w);
  put(join(STATE, w.path, "workspace.json"), JSON.stringify(w, null, 1)); put(indexFile(), JSON.stringify(ix, null, 1));
  const ptr = join(STATE, "current_pointer.json"); if (!existsSync(ptr)) put(ptr, JSON.stringify({ current_workspace: w.id }, null, 1));   // a fresh version gets its pointer with its first workspace
}
/** register the workspace once (manifest + index + pointer); returns its id */
export function openWorkspace(ws: string, harness: string): string {
  if (!existsSync(join(wsPath(ws), "workspace.json"))) ensureWorkspace({ id: ws, harness, created: new Date().toISOString().slice(0, 10), path: `data/${ws}` });
  return ws;
}
/** the latest result of a case in a workspace (last/<case>.json) */
export const lastPath = (ws: string, caseId: string) => join(wsPath(safe(ws)), "last", safe(caseId) + ".json");
export const readLastCase = <T = unknown>(ws: string, caseId: string): T | undefined => { try { return JSON.parse(readFileSync(lastPath(ws, caseId), "utf8")) as T; } catch { return undefined; } };
export const writeLastCase = (ws: string, caseId: string, v: unknown) => put(lastPath(ws, caseId), JSON.stringify(v, null, 1));
/** a rerun never discards: copy the case's current session (without its children) and last.json to cache/<case>.<n>/, return that folder */
export function archiveCase(ws: string, caseId: string, task: string, parent?: string | null): string {
  const base = join(wsPath(safe(ws)), "cache"); mkdirSync(base, { recursive: true });
  let n = 1; while (existsSync(join(base, `${caseId}.${n}`))) n++;
  const dst = join(base, `${safe(caseId)}.${n}`), src = sessionDir(ws, task, parent); mkdirSync(dst, { recursive: true });
  if (existsSync(src)) cpSync(src, dst, { recursive: true, filter: (f) => !f.startsWith(join(src, "children")) });
  if (existsSync(lastPath(ws, caseId))) cpSync(lastPath(ws, caseId), join(dst, "last.json"));
  return dst;
}
const worst = (v: SessionRec["verdict"][]): SessionRec["verdict"] => v.includes("fail") ? "fail" : v.includes("partial") ? "partial" : v.includes("not_run") ? "not_run" : "pass";
const sub = (a: SessionRec["agents"][number], owner?: string): SubSession => ({ label: a.label, agent_id: a.agent_id, role: a.role, caller: a.caller, level: a.level, fixture: a.fixture, owner_case: owner });

const countFiles = (d: string): number => !existsSync(d) ? 0 : readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? countFiles(join(d, e.name)) : 1), 0);
export function writeSession(s: SessionRec, events: EventRec[], extra?: { lastCase?: unknown; workspaceFrom?: string }) {
  safe(s.workspace); safe(s.task);
  if (!existsSync(join(wsPath(s.workspace), "workspace.json"))) throw new Error(`workspace ${s.workspace} is not registered: a session cannot exist without its workspace`);
  const ix = readIndex(); ix.current_workspace = currentWorkspace();
  const par = s.parent ? findParent(ix, s.workspace, s.parent) : undefined;
  if (s.parent && !par) throw new Error(`child ${s.task} needs its parent ${s.parent} in workspace ${s.workspace} first`);
  const dir = sessionDir(s.workspace, s.task, s.parent);
  if (extra?.workspaceFrom && existsSync(extra.workspaceFrom)) { rmSync(join(dir, "workspace"), { recursive: true, force: true }); cpSync(extra.workspaceFrom, join(dir, "workspace"), { recursive: true }); }
  s.workspace_files = countFiles(join(dir, "workspace"));
  put(join(dir, "session.json"), JSON.stringify(s, null, 1));
  put(join(dir, "events.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
  if (extra?.lastCase && s.case) put(join(wsPath(s.workspace), "last", safe(s.case) + ".json"), JSON.stringify(extra.lastCase, null, 1));
  const path = rel(s.workspace, s.task, s.parent);
  if (par) {   // child: nest it in the parent, grow the parent's agent tree with the agents this case added, recompute the parent's verdict
    const c: ChildSummary = { task: s.task, case: s.case, after: s.after, title: s.title, state: s.state, verdict: s.verdict, cost: s.cost, updated: s.updated, path };
    const i = par.children.findIndex((x) => x.task === s.task); if (i >= 0) par.children[i] = c; else par.children.push(c);
    for (const a of s.agents) if (!par.sub_sessions.some((x) => x.agent_id === a.agent_id)) par.sub_sessions.push(sub(a, s.case));
    par.verdict = worst([par.rootVerdict ?? par.verdict, ...par.children.map((x) => x.verdict)]); par.updated = Math.max(par.updated, s.updated);
    par.cost = Math.max(par.cost, s.cost);   // a chain shares one master: its cost is cumulative, so the latest child holds the total
  } else {
    const old = findParent(ix, s.workspace, s.task), keep = old?.children ?? [];
    const sum: SessionSummary = {
      session_id: s.master?.claude_session || s.task, task: s.task, workspace: s.workspace, runner: s.runner, case: s.case, suite: s.suite, title: s.title, state: s.state, verdict: worst([s.verdict, ...keep.map((x) => x.verdict)]), cost: Math.max(s.cost, old?.cost ?? 0), updated: s.updated, path,
      sub_sessions: [...(old?.sub_sessions ?? []).filter((x) => !s.agents.some((a) => a.agent_id === x.agent_id)), ...s.agents.map((a) => sub(a, old?.sub_sessions.find((x) => x.agent_id === a.agent_id)?.owner_case ?? s.case))], children: keep
    };
    sum.rootVerdict = s.verdict;
    const i = ix.sessions.findIndex((x) => x.workspace === s.workspace && x.task === s.task); if (i >= 0) ix.sessions[i] = sum; else ix.sessions.push(sum);
  }
  put(indexFile(), JSON.stringify(ix, null, 1));
}
/** open any session (parent or child) by workspace + task, through the index */
export function readSession(ws: string, task: string): { session: SessionRec; events: EventRec[] } | undefined {
  const ix = readIndex(); safe(ws); safe(task);
  const par = findParent(ix, ws, task), host = par ?? ix.sessions.find((p) => p.workspace === ws && p.children.some((c) => c.task === task));
  if (!host) return undefined;
  const dir = join(STATE, par ? par.path : host.children.find((c) => c.task === task)!.path);
  if (!existsSync(join(dir, "session.json"))) return undefined;
  const ev = join(dir, "events.jsonl");
  return { session: JSON.parse(readFileSync(join(dir, "session.json"), "utf8")), events: existsSync(ev) ? readFileSync(ev, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [] };
}
