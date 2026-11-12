// Table `fixture_sessions` (in the board file next to patches/notes): every call that reaches a MOCKED sub-agent (FixtureGate) belongs to a fixture session.
//   master task/agent  ->  fixture session_id  ->  { state, version, served results, history }
// A call is the first turn of a session, or a follow-up when the master sends the SAME session id again ("check with <agent>"). The gate answers a follow-up from this table (history + what is on disk),
// it never starts a real `claude -p` / --session-id for it. The WORKSPACE is common: every fixture session of one master task shares `<cwd>/run_test`, so what an earlier session wrote is what a later one sees.
import type { MStore } from "./board.ts";
import type { RunCall } from "./base/types.ts";

export type FixtureTurnKind = "served" | "verify" | "corrected" | "real";
export interface FixtureTurn { v: number; at: number; kind: FixtureTurnKind; result?: string; prompt: string; reply: string }
export interface FixtureSessionRow {
  /** the LAST claude session id of this call. NOT the key: a mocked agent has no claude transcript, so the harness rolls a new id on every call; the stable identity is agent_id (what the master passes as `--session <agent_id>`) */
  session_id: string;
  /** the master's task (= the shared workspace owner) */
  task_id: string;
  role: string;
  agent_id: string;
  /** who called: the master agent and its session */
  master_agent: string | null;
  master_session: string | null;
  /** shared workspace (run_test) of the task: the same path for every session of the task */
  workspace: string;
  /** +1 on every turn of this session (state version) */
  version: number;
  /** open = nothing served yet, served/verified = mocked, real = this session is a REAL claude session (allow_real_subAg): its follow-ups go to the real runner */
  state: "open" | "served" | "verified" | "real";
  /** recorded result ids served in THIS session */
  served: string[];
  history: FixtureTurn[];
  created: number;
  updated: number;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "..." : s);

/** The session row of this call, or undefined for a brand-new session (nothing recorded yet). */
/** Keyed by (task, agent_id): `expo-go#1` is the same fixture session for every call the master makes to it, whatever claude session id the harness rolled. */
export const findSession = (st: MStore, c: RunCall, task: string): FixtureSessionRow | undefined => st.fixtureSessions.find((x) => x.task_id === task && x.agent_id === c.row.agent_id);

/** Every recorded result served so far in this master task (only this role's when `role` is given), over ALL fixture sessions (the workspace is shared: a `fix` may follow in another session, and a stage may require a result another AGENT served: `match.after`). */
export const servedInTask = (st: MStore, task: string, role?: string): string[] => st.fixtureSessions.filter((x) => x.task_id === task && (!role || x.role === role)).flatMap((x) => x.served);

/** Record one turn (creates the session row on its first turn). Call inside st.tx(). */
export function recordTurn(st: MStore, c: RunCall, task: string, role: string, workspace: string, t: { kind: FixtureTurnKind; result?: string; reply: string }): FixtureSessionRow {
  let row = findSession(st, c, task);
  const now = Date.now();
  if (!row) {
    row = { session_id: c.session.id, task_id: task, role, agent_id: c.row.agent_id, master_agent: c.row.caller_agent_id ?? c.row.parent_agent_id ?? null, master_session: c.row.parent_session_id ?? null,
      workspace, version: 0, state: "open", served: [], history: [], created: now, updated: now };
    st.fixtureSessions.push(row);
  }
  row.version += 1; row.updated = now; row.session_id = c.session.id;
  row.history.push({ v: row.version, at: now, kind: t.kind, result: t.result, prompt: cut(c.prompt, 600), reply: cut(t.reply, 4000) });
  if (t.kind === "served" && t.result) { row.served.push(t.result); row.state = "served"; }
  if (t.kind === "verify") row.state = "verified";
  if (t.kind === "real") row.state = "real";
  return row;
}

/** A "check / what did you do" ask (answered from the table) versus a request for NEW work. NEW work = the ask STARTS with a work verb ("Now add ...", "Create ..."); anything with a check word that does not start like that is a check
 *  (a real lead mixes verbs into its verification questions: "Verify ... Report which file App.tsx imports ... did you run git commit?"). Cheap heuristic on purpose, no model. */
export const isVerifyAsk = (prompt: string): boolean => {
  const newWork = /^\W*(now |also |then |please |next )*(add|create|build|write|implement|make|install|remove|delete|refactor|update|change|redo|fix|set up|put)\b/i.test(prompt.trim());
  return !newWork && /\b(verify|check|confirm|answer|report|what (did|have|exactly|is|are)|which|list|show me|quote|status|did you|have you|is the|are there|summar(y|ise|ize)|tell me|describe|explain|what you|what was|what were|are you done|is it done|finished|how did|how many|recap)\b/i.test(prompt);
};

/** The whole history of the task's sessions of this role, as text for a REAL call that has no memory of its own (stateless claude call): what was asked, what each answer said, newest last. */
export function historyForReal(st: MStore, task: string, role: string, maxChars = 6000): string {
  const rows = st.fixtureSessions.filter((x) => x.task_id === task && x.role === role && x.history.length);
  if (!rows.length) return "";
  const turns = rows.flatMap((r) => r.history.filter((h) => h.kind !== "corrected").map((h) => ({ at: h.at, s: `[${h.kind}${h.result ? " " + h.result : ""}] asked: ${cut(h.prompt.replace(/\s+/g, " "), 300)}\n   answer: ${cut(h.reply.replace(/\s+/g, " "), 700)}` }))).sort((a, b) => a.at - b.at).map((t) => t.s);
  let out = ""; for (const t of turns.reverse()) { if ((out + t).length > maxChars) break; out = t + "\n" + out; }   // keep the newest turns when it gets long
  return out.trim();
}

/** The session's history as the sub-agent would remember it: one line per turn. */
/** The sub-agent's own words of a served reply: without the observer line in front and the observer block at the end (those are the harness's, not the agent's). */
export const rawOf = (reply: string): string => reply.replace(/^OBSERVER\(harness saw\)[^\n]*\n\n/, "").replace(/\n\nOBSERVER \(the harness compared[\s\S]*$/, "");
export const historyDigest = (row: FixtureSessionRow): string =>
  row.history.map((h) => h.kind === "verify" ? `  v${h.v} verify (asked again, nothing new run)` : h.kind === "corrected" ? `  v${h.v} corrected (hand-over refused)` : `  v${h.v} ${h.kind}${h.result ? " " + h.result : ""}: ${cut(rawOf(h.reply), 700)}`).join("\n");
