// COMMANDS: report_bug, admin_issues, agent_peek, cost, agents_list/info/update, say, inbox, board_status, ledger_get, chapter, ls, read_file, grep: the team's board, bug tracker and read-only workspace tools.
import { dirname, join } from "node:path";
import { boardStatus, inbox, say, sessionStats } from "../core/board.ts";
import { peekAgent } from "../core/peek.ts";
import { turnContext } from "../core/turn_context.ts";
import { AGENTS_DIR } from "@core/config.ts";
import { wsGrep, wsLs, wsRead } from "../core/workspace_read.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { cmd, cwd, file, flag, locks, logIssue, me, out, policy, rest, store, task } from "./ctx.ts";

export const COMMANDS = ["_context", "_pending", "report_bug", "admin_issues", "agent_peek", "cost", "agents_list", "agent_info", "agent_update", "say", "inbox", "board_status", "ledger_get", "ls", "read_file", "chapter", "grep"];
/** ls / read_file / grep read the WORKSPACE (run_test/), and also this session's evidence: `--path store/qa/<agent>/...` or `store/bg/...` (read only; transcripts and the board stay closed). */
const where = (p?: string): { root: string; path?: string } | { error: string } => {
  if (p && /^store([\\/]|$)/.test(p)) { const rest = p.replace(/^store[\\/]?/, "") || "qa"; if (!/^(qa|bg)([\\/]|$)/.test(rest)) return { error: "only store/qa (evidence) and store/bg (server logs) can be read" }; return { root: dirname(file), path: rest }; }
  return { root: join(cwd, "run_test"), path: p };
};
export async function run(): Promise<void> {
if (cmd === "report_bug") {   // ANY agent records a bug or a problem for the admins' bug tracker (UI block "Bug reports"): about ITSELF by default (a tool that failed, a broken plan, a blocker) or about another agent (--agent: stalled, hung, slow, lazy, bad output). The session id and the agent's log file are attached, so nobody has to dig. Append-only admin_issues.jsonl + an `admin.issue` event; the work carries on.
  const ag = flag("agent") || me, text = (flag("text") ?? "").trim(), kind = (flag("kind") ?? "bug").replace(/[^a-z_]/g, "").slice(0, 20) || "bug", sev = ["low", "medium", "high"].includes(flag("severity") ?? "") ? flag("severity")! : "medium";
  if (!text) out({ ok: false, reason: "--text is required: what happened, what you expected, what you did about it" });
  else { const rec = logIssue({ agent: ag, kind, text: text.slice(0, 2000), severity: sev, reporter: me || "unknown", session_id: flag("session") }); out({ ok: true, id: rec.id, logged: "admin_issues.jsonl", session_id: rec.session_id, next: "Recorded in the admin bug tracker with your session id. Carry on with your task: reporting does not stop the work." }); }
}
if (cmd === "admin_issues") {   // the issues reported in this task (or --all tasks of this store), newest last
  const f = join(dirname(file), "admin_issues.jsonl"), rows = existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x): x is { task: string } => !!x) : [];
  out({ ok: true, issues: rows.filter((r) => rest.includes("--all") || r.task === task).slice(-50) });
}
if (cmd === "agent_peek") {   // read-only look inside an agent: recent tool calls, silence, held files, notes, and a hint (wait / answer / stop)
  store.reload(); const r = peekAgent(store, task, flag("agent") ?? "", Number(flag("n") ?? 8)); out(r);
}
if (cmd === "cost") {   // what the team has spent so far, per agent, against the project budget
  store.reload();
  const per = store.agentsOf(task).map((a) => ({ agent_id: a.agent_id, usd: Number(store.reports.filter((r) => r.task_id === task && r.agent_id === a.agent_id).reduce((s, r) => s + r.cost, 0).toFixed(4)) })).filter((x) => x.usd > 0);
  const total = Number(per.reduce((s, x) => s + x.usd, 0).toFixed(4)); out({ ok: true, total_usd: total, budget_usd: policy.budgetUsd || null, left_usd: policy.budgetUsd ? Number(Math.max(0, policy.budgetUsd - total).toFixed(4)) : null, agents: per });
}
if (cmd === "agents_list") {
  store.reload();
  out(store.agentsOf(task).map((a) => ({ agent_id: a.agent_id, role: a.role, title: a.title, description: a.description, status: a.status, activity: a.activity, session: a.session_id ? "live" : "none", session_id: a.session_id, resume_count: a.resume_count, ...sessionStats(store, task, a.agent_id), level: a.level, needs_parent: a.needs_parent ?? undefined, called_by: a.caller_agent_id, parent_type: a.parent_type, finished_at: a.finished_at ? new Date(a.finished_at).toISOString() : null })));
}
if (cmd === "agent_info") {
  store.reload(); const a = store.agent(task, flag("agent") ?? "");
  if (!a) out({ ok: false, reason: `agent_not_in_task: ${flag("agent")}` });
  else out({ agent_id: a.agent_id, role: a.role, title: a.title, description: a.description, status: a.status, activity: a.activity, level: a.level, needs_parent: a.needs_parent ?? undefined,
    session: { id: a.session_id, cwd: a.cwd, resume_count: a.resume_count, runs: a.runs ?? 0, parent_type: a.parent_type, parent_session_id: a.parent_session_id, parent_agent_id: a.parent_agent_id, called_by: a.caller_agent_id },
    started_at: a.started_at ? new Date(a.started_at).toISOString() : null, finished_at: a.finished_at ? new Date(a.finished_at).toISOString() : null,
    final_response: (a.final_response ?? "").slice(0, 4000), last_report_id: a.last_report_id,
    sub_agents: store.agentsOf(task).filter((x) => x.caller_agent_id === a.agent_id).map((x) => ({ agent_id: x.agent_id, role: x.role, status: x.status, session_id: x.session_id })),
    calls_made: store.calls.filter((c) => c.task_id === task && c.caller_agent_id === a.agent_id).map((c) => `${c.callee_agent_id ?? "(denied)"} ${c.status}${c.reason ? " (" + c.reason.slice(0, 60) + ")" : ""}`),
    calls_received: store.calls.filter((c) => c.task_id === task && c.callee_agent_id === a.agent_id).map((c) => `${c.caller_agent_id} ${c.session_arg} ${c.status}`) });
}
if (cmd === "agent_update") {
  let o: unknown;
  store.tx(() => { const a = store.agent(task, flag("agent") ?? ""); if (!a) { o = { ok: false, reason: `agent_not_in_task: ${flag("agent")}` }; return; }
    const t = flag("title"), d = flag("description"); if (t) a.title = t.slice(0, 80); if (d) a.description = d.slice(0, 300);
    store.ev("agent.updated", task, me, { agent: a.agent_id }); o = { ok: true, agent_id: a.agent_id, title: a.title, description: a.description }; });
  out(o);
}
if (cmd === "say") {
  const to = flag("to") ?? ""; let o: unknown;
  store.tx(() => { if (to !== "all" && !store.agent(task, to)) { o = { ok: false, reason: `agent_not_in_task: ${to}` }; return; } say(store, task, me, to, flag("text") ?? ""); o = { ok: true }; });
  out(o);
}
if (cmd === "inbox") { out(store.tx(() => inbox(store, task, me)).map((n) => ({ from: n.from, text: n.text })));
}
if (cmd === "_context") { store.reload(); out({ ok: true, text: turnContext(store, task, me, file, { first: rest.includes("--first") }) }); }   // internal: the per-turn context the a3 mod injects
if (cmd === "_pending") { store.reload(); const since = Number(flag("since") ?? 0); out({ ok: true, notes: store.notes.filter((n) => n.task_id === task && n.from !== me && (n.to === me || n.to === "all") && !n.read_by.includes(me)).length, running: store.agentsOf(task).filter((a) => a.name !== "lead" && a.status === "running").length, done: store.events.filter((e) => e.task_id === task && e.kind === "agent.done" && e.agent_id !== me && e.t > since).map((e) => e.agent_id) }); }   // internal: what the a3 wake-up timer looks at (nothing is marked read)
if (cmd === "board_status") { store.reload(); out(locks.kind === "redis" ? boardStatus(store, task, await locks.holders(task), await locks.waiting(task)) : boardStatus(store, task));
}
if (cmd === "ledger_get") { store.reload(); const r = store.reports.find((x) => x.id === flag("report")); out(r ? { id: r.id, agent: r.agent_id, text: r.reply ?? r.summary, files: r.files } : { ok: false, reason: "no such report" });
}
if (cmd === "ls") { const w = where(flag("path")); out("error" in w ? { ok: false, reason: w.error } : wsLs(w.root, w.path));
}
if (cmd === "read_file") { const w = where(flag("path") ?? ""); out("error" in w ? { ok: false, reason: w.error } : wsRead(w.root, w.path ?? "", Number(flag("offset") ?? 1), Number(flag("limit") ?? 200)));
}
if (cmd === "chapter") {   // on-demand details: agents/<role>/chapters/<name>.md of the CALLER first (qa-reviewer: tab, planner: plan_format), then the lead's; the core CLAUDE.md of every agent stays short
  const mine = store.agent(task, me)?.name ?? "lead", dirs = [...new Set([join(AGENTS_DIR, mine, "chapters"), join(AGENTS_DIR, "lead", "chapters")])], n = (flag("name") ?? "").toLowerCase().replace(/[^a-z_]/g, ""), f = dirs.map((d) => join(d, n + ".md")).find((x) => n && existsSync(x)) ?? "";
  const names = [...new Set(dirs.flatMap((d) => existsSync(d) ? readdirSync(d).filter((x) => x.endsWith(".md")).map((x) => x.slice(0, -3)) : []))];
  if (f) { store.reload(); store.ev("chapter.read", task, me, { name: n }); store.save(); out({ ok: true, chapter: n, text: readFileSync(f, "utf8") }); }
  else out({ ok: false, reason: n ? `no chapter '${n}'` : "--name is required", chapters: names });
}
if (cmd === "grep") { const w = where(flag("path")); out("error" in w ? { ok: false, reason: w.error } : wsGrep(w.root, flag("pattern") ?? "", w.path));
}
}
