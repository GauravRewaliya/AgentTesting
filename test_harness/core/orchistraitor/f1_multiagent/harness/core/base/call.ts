// callAgent: the ONE place a role runs. Chooses the session, runs, records status/events. (Both the loop and `delegate` use it.)
// The registry is touched only in two short store transactions (before and after the model call), never across it, so several
// agents of one task can run at the same time in different processes without losing each other's updates.
import { randomUUID } from "node:crypto";
import { afterRun, chooseSession, type Selection } from "./sessions.ts";
import { archiveTranscript, restoreFromArchive } from "./archive.ts";
import type { Store } from "./store.ts";
import type { AgentDef, AgentRow, RunCall, RunResult, Runner } from "./types.ts";

export interface CallCtx { store: Store; runner: Runner; defs: Map<string, AgentDef>; sessionCap: number; transcriptExists?: (cwd: string, id: string) => boolean; canary?: boolean }
/** A stable per-agent code. Told in the first brief; a resumed agent must recall it. A resume that does not is a silent reset. */
export const canaryFor = (task: string, agent: string) => "W-" + [...(task + agent)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase().padStart(6, "0");
export type Mode = "new" | "resumed" | "rolled" | "forked";
export interface CallOut extends RunResult { mode: Mode; prompt_chars: number }

export async function callAgent(ctx: CallCtx, row0: AgentRow, cwd: string, makePrompt: (first: boolean) => string,
  forceSel?: Selection, evExtra: Record<string, unknown> = {}, extra?: Pick<RunCall, "env" | "extraArgs">): Promise<CallOut> {
  const { store } = ctx, task = row0.task_id, id = row0.agent_id;
  const def = ctx.defs.get(row0.name);
  if (!def) throw new Error(`no definition for ${row0.name}`);
  const canary = ctx.canary ?? process.env.HARNESS_CANARY === "1", code = canaryFor(task, id);
  let sel!: Selection, mode: Mode = "new", prompt = "", busy = false, epoch0 = 0;
  const stopWhy = store.aborted();
  if (stopWhy) return { ok: false, error: "aborted: " + stopWhy, mode: "new", reply: "", session_id: "", cost: 0, prompt_chars: 0 };
  store.tx(() => {   // phase 1: claim the agent
    const row = store.agent(task, id)!;
    if (row.status === "running" && row.activity !== "starting") { busy = true; return; }   // "starting" = a driver already claimed it for this call
    if (ctx.transcriptExists && row.session_id && store.file) {   // Claude's copy of the log is gone but ours is not: put it back BEFORE the session is chosen, so the agent resumes instead of starting blank
      try { if (restoreFromArchive(store.file, task, id, row.session_id, row.created_cwd ?? row.cwd ?? cwd)) store.ev("log.restored", task, id, { session: row.session_id }); }
      catch (e) { store.ev("log.restore_failed", task, id, { session: row.session_id, error: String(e) }); }
    }
    sel = forceSel ?? (def.session === "persistent"
      ? chooseSession(row, def.session_cap ?? ctx.sessionCap, ctx.transcriptExists ? (sid) => ctx.transcriptExists!(row.created_cwd ?? row.cwd ?? cwd, sid) : undefined)
      : { id: randomUUID(), resume: false });
    mode = sel.fork_from ? "forked" : sel.rolled ? "rolled" : sel.resume ? "resumed" : "new";
    if (sel.rolled) store.ev("session.rolled", task, id, { reason: sel.rolled, old: row.session_id });
    // RULE: an agent that was asked to CONTINUE must come back as a resumed session. A lost transcript is context loss, never a quiet restart.
    const wantsResume = (row.runs ?? 0) > 0 && (evExtra.intent === "resume" || (evExtra.intent === undefined && !!row.session_id && !forceSel));   // an agent that never finished a run has no memory to lose
    if (wantsResume && !sel.resume) {
      if (sel.rolled === "missing") store.violation("resume_lost_session", task, id, { session: row.session_id, looked_in: row.cwd ?? cwd, wanted: "resume" });
      else if (!sel.rolled) store.violation("resume_without_session", task, id, { had_session: !!row.session_id });
      /* rolled "full" is the resume cap: allowed, logged as session.rolled, and the caller gives the new session its ledger brief */
    }
    prompt = makePrompt(!sel.resume);   // a fork changes topic: it gets the full brief on top of the copied memory
    if (canary) prompt += sel.resume ? "\n\n(Begin your reply with your SESSION CODE, the one you were given earlier in this conversation. Recall it; do not make one up.)" : `\n\nSESSION CODE: ${code}. Remember it exactly; you will be asked for it later.`;
    epoch0 = row.epoch ?? 0; row.needs_parent = null;   // the parent is continuing it: the question has been answered
    if (!sel.resume) row.created_cwd = cwd;   // a new (or rolled / forked) session is born in this folder
    if (!row.session_id && def.session === "persistent" && !sel.resume && !sel.fork_from) row.session_id = sel.id;   // recorded at once: a stop (replan) can then CONTINUE this agent instead of starting over
    row.status = "running"; row.activity = `${mode} session`; row.last_event_at = Date.now(); row.cwd = cwd; row.started_at = Date.now(); row.finished_at = null; row.last_call_id = (evExtra.call as string | undefined) ?? row.last_call_id ?? null;
    store.ev("agent.start", task, id, { mode, session: sel.id, prompt_chars: prompt.length, ...evExtra });
  });
  if (busy) return { ok: false, error: "agent_busy", mode: "resumed", reply: "", session_id: "", cost: 0, prompt_chars: 0 };

  const r = await ctx.runner.run({ agent: def, row: store.agent(task, id) ?? row0, cwd, prompt, session: sel, ...(extra ?? {}) });

  let archived: string | null = null, archiveErr = "";   // a real run must leave a log; keep our own copy of it, and SAY SO if there is none
  if (ctx.transcriptExists && store.file) {
    try { archived = archiveTranscript(store.file, task, id, r.session_id || sel.id, cwd); if (!archived && r.ok) archiveErr = `no log file found for session ${r.session_id || sel.id}`; }
    catch (e) { archiveErr = String(e); }
  }
  let stopped = false;
  store.tx(() => {   // phase 2: record the result
    if (archiveErr) store.ev("log.missing", task, id, { error: archiveErr, cwd });
    else if (archived) { const rw = store.agent(task, id); if (rw) rw.log_file = archived; }
    const row = store.agent(task, id)!;
    row.last_event_at = Date.now();
    if (row.activity === "stopped" || (row.epoch ?? 0) !== epoch0) { stopped = true; store.ev("agent.stopped", task, id); return; }
    row.finished_at = Date.now(); row.runs = (row.runs ?? 0) + 1; row.final_response = r.reply;   // the full final answer, on the agent's row
    if (r.ok) { afterRun(row, sel); row.status = "idle"; row.activity = "done"; } else { row.status = "failed"; row.activity = r.error ?? "failed"; }
    if (r.ok && r.session_id !== sel.id) store.ev("session.id_mismatch", task, id, { wanted: sel.id, got: r.session_id });
    store.ev(r.ok ? "agent.done" : "agent.failed", task, id, { mode, cost: r.cost, error: r.error, waited_ms: r.waited_ms });   // waited_ms: time spent waiting for a process slot before the run could start
  });
  if (sel.resume && !r.ok && /no conversation found/i.test(r.error ?? "")) store.violation("resume_lost_session", task, id, { said_by: "the CLI", error: (r.error ?? "").slice(0, 140), session: sel.id });   // our own file check was skipped or wrong: the CLI says it is gone
  if (stopped) return { ...r, ok: false, error: "stopped", mode, prompt_chars: prompt.length };
  if (r.ok && sel.resume && r.session_id !== sel.id) store.violation("session_id_mismatch", task, id, { wanted: sel.id, got: r.session_id });
  if (canary && sel.resume && r.ok && !r.reply.includes(code)) store.violation("memory_lost", task, id, { expected: code, session: sel.id, reply_starts: r.reply.slice(0, 100) });
  return { ...r, mode, prompt_chars: prompt.length };
}
