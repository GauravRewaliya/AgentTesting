// COMMANDS: delegate, fork_all, wait, apply_patches, agent_stop (+ the internal _run): start sub-agents, wait for them, apply their patches.
import { join } from "node:path";
import { stopAgent, type CallReq } from "../../core/agent_call.ts";
import { say } from "../../core/board.ts";
import { waitSeconds } from "../../core/monitor.ts";
import { modelProblem } from "../../core/models.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { attentionSpread, cmd, cwd, file, flag, locks, me, monitorTick, out, policy, rest, sleep, store, task, writerRanInTask } from "../ctx.ts";
import { applyPatchesCmd, grant, lastReport, runCall, siteGuard, spawnRun, withWrites } from "./core.ts";

export const COMMANDS = ["delegate", "fork_all", "_run", "_tick", "wait", "apply_patches", "agent_stop"];
export async function run(): Promise<void> {
if (cmd === "delegate") {
  const asyncMode = rest.includes("--async");
  const req: CallReq = { task_id: task, caller_agent_id: me, role: flag("role") ?? store.agent(task, flag("session") ?? "")?.name ?? "", session_arg: flag("session"), mode: flag("mode") === "ask" ? "ask" : "work",
    objective: flag("objective"), output: flag("output"), boundaries: flag("boundaries"), writes: flag("writes")?.split(",").filter(Boolean), title: flag("title"), model: flag("model") };
  const mp = modelProblem(req.role, req.model); if (mp) { out({ ok: false, reason: mp }); process.exit(0); }
  const sg = siteGuard(withWrites(req)); if (sg) { out({ ok: false, reason: sg }); process.exit(0); }
  if (req.role === "qa-reviewer" && !rest.includes("--user-asked") && !writerRanInTask()) { out({ ok: false, reason: "QA was NOT started: no builder or other writer has worked in this task, so there is nothing new to verify (a greeting, a question, a status, or a project that was only looked at). Answer the person. If the person explicitly asked you to check, test or run something, call it again with --user-asked." }); process.exit(0); }
  const res = await grant(withWrites(req), asyncMode);   // asyncMode: claimed at once, so it counts as live and cannot be double-called
  if (!res.ok) out({ ok: false, reason: res.reason });
  else if (res.queued) out({ ok: true, queued: true, agent_id: res.agent.agent_id, position: res.queued.position, waiting_for: res.queued.heldBy, note: "its locks are held; it starts by itself when they free; use wait" });
  else if (asyncMode) { spawnRun(res.call_id); out({ ok: true, async: true, agent_id: res.agent.agent_id, call_id: res.call_id, status: "running", ...(res.reused ? { reused: `this role keeps ONE session per task: ${res.agent.agent_id} was continued (it remembers its earlier work), not started fresh` } : {}), note: "use wait --agents <ids> to get the answers" }); }
  else { const { r } = await runCall(res.call_id); out({ ok: r.ok, needs_parent: r.needs_parent, agent_id: res.agent.agent_id, session: res.kind, ...(res.reused ? { reused: `this role keeps ONE session per task: ${res.agent.agent_id} was continued (it remembers its earlier work), not started fresh` } : {}), mode: r.mode, report_id: r.report_id, patch_id: r.patch_id, summary: r.summary, violations: r.violations, error: r.error }); }
}
if (cmd === "fork_all") {   // N tasks for N agents, ALL STARTED AT ONCE (async): `fork_all --from builder#3 --role builder --tasks '[{"title":"..","writes":["run_test/p/js/pages/a.js"],"objective":".."}, ...]' [--output ..] [--boundaries ..]`, then ONE `wait --agents <ids>`. Parallel by construction: no per-call --async to forget.
  let tasks: { title?: string; writes?: string[] | string; model?: string; objective?: string; output?: string; boundaries?: string }[] = [];
  try { tasks = JSON.parse(flag("tasks") ?? "[]"); } catch (e) { out({ ok: false, reason: "--tasks is not valid JSON: " + String(e).slice(0, 80) }); process.exit(0); }
  if (!Array.isArray(tasks) || !tasks.length) { out({ ok: false, reason: "--tasks must be a non-empty JSON array of {title, writes, objective}" }); process.exit(0); }
  const from = flag("from"), role = flag("role") ?? "builder", started: Record<string, unknown>[] = [];
  for (const t of tasks) {
    const req: CallReq = { task_id: task, caller_agent_id: me, role, session_arg: from ? `fork:${from}` : "new", mode: "work", objective: t.objective, output: t.output ?? flag("output") ?? "Reply in 3 lines: the files you wrote, what you could not do, what you did not check.", boundaries: t.boundaries ?? flag("boundaries") ?? "Write only the files in your writes; edit nothing else. No server, no tests, no npm/pnpm, no build.",
      writes: (Array.isArray(t.writes) ? t.writes : String(t.writes ?? "").split(",")).map((w) => String(w).trim()).filter(Boolean), title: t.title, model: t.model ?? flag("model") };
    const mp = modelProblem(role, req.model); if (mp) { started.push({ title: t.title, ok: false, reason: mp }); continue; }
    const sg = siteGuard(withWrites(req)); if (sg) { started.push({ title: t.title, ok: false, reason: sg }); continue; }
    const res = await grant(withWrites(req), true);
    if (!res.ok) started.push({ title: t.title, ok: false, reason: res.reason });
    else if (res.queued) started.push({ title: t.title, ok: true, queued: true, agent_id: res.agent.agent_id, waiting_for: res.queued.heldBy });
    else { spawnRun(res.call_id); started.push({ title: t.title, ok: true, agent_id: res.agent.agent_id, status: "running" }); }
  }
  const ids = started.filter((x) => x.ok).map((x) => String(x.agent_id));
  if (ids.length > 1) store.tx(() => { for (const id of ids) say(store, task, "harness", id, `TEAM (started together): ${ids.filter((x) => x !== id).map((x) => { const t = started.find((y) => y.agent_id === x); return x + (t?.title ? ` (${t.title})` : ""); }).join(", ")}. Each owns its own files; reach one with team say --to <agent_id>.`); });   // every starter learns who its neighbours are (a builder that began before the others were granted would not see them)
  out({ ok: started.every((x) => x.ok), started, next: ids.length ? `All started together. Now agent wait --any --agents ${ids.join(",")}: it returns as soon as ONE finishes, with a browser check of its pages; fix that builder at once if needed, then agent wait --any again with the ones still running (a timeout is NOT a failure: still_running shows each agent last_tool_s_ago; keep waiting while it is under 120 s, a big builder can write for 6+ minutes; answer the person only when an agent shows no tool use for 5 minutes).` : "Nothing started: fix the reasons above." });
}
if (cmd === "_tick") {   // internal: one monitor tick (core/monitor.ts: a nudge to an agent over 6 min, a stop for one silent 10 min). The a2 hook calls it while a plain Agent call blocks, because `wait` (which ticks) is not running then
  out({ ok: true, attention: (await monitorTick()) });
}
if (cmd === "_run") {
  await runCall(flag("call")!);
}
if (cmd === "wait") {
  const names = (flag("agents") ?? "").split(",").filter(Boolean), limit = waitSeconds(Number(flag("timeout") ?? 300)) * 1000, t0 = Date.now(); let leadNeeded = false;
  const jobDone = (n: string) => existsSync(join(cwd, "run_test", "_jobs", n + ".done")), pending = () => names.filter((n) => { if (n.startsWith("job_")) return !jobDone(n); const a = store.agent(task, n); return !a || a.status === "running" || store.calls.some((c) => c.task_id === task && c.callee_agent_id === n && c.status === "granted"); });   // running, or granted and waiting for its locks
  // a message the person sent while this turn runs: stop waiting so the PostToolUse hook (activity.ts) hands it to the master NOW; it is not marked read here
  const userMsgs = () => store.notes.filter((n) => n.task_id === task && n.from === "user" && (n.to === me || n.to === "all") && !n.read_by.includes(me)).length;
  let interrupted = false;
  const any = rest.includes("--any");   // --any: return as soon as ONE of them has finished (the master reacts to it at once while the others keep working), with the harness's own check of that agent's pages
  for (;;) { store.reload(); if (await monitorTick(names.filter((n) => !n.startsWith("job_")))) { leadNeeded = true; break; } const left = pending().length; if (any ? left < names.length : !left) break; if (Date.now() - t0 > limit) break; if (userMsgs()) { interrupted = true; break; } await sleep(400); }
  /** what a finished writer left behind, checked by the harness in a real browser (no model call): proto_check of its project + every page of ITS files opened (stub, dead link, JS error, undefined/NaN) */
  const checkWork = async (n: string) => {
    try {
      const writes = store.calls.filter((c) => c.task_id === task && c.callee_agent_id === n).flatMap((c) => c.req?.writes ?? []), m = writes.map((w) => /^run_test\/([^/]+)\//.exec(w)).find(Boolean); if (!m) return undefined;
      const proj = join(cwd, "run_test", m[1]!); if (!existsSync(join(proj, "proto.json")) || !existsSync(join(proj, "index.html")) || existsSync(join(proj, "package.json"))) return undefined;   // only a KIT prototype (proto.json): a three.js page or a plain wireframe is not one and proto_check would report false problems
      const { protoCheck } = await import("../../core/proto_check.ts"), { smokeRoutes } = await import("../../core/preview.ts"), pc = protoCheck(proj);
      let routes: { id: string; file?: string }[] = [], all: string[] = []; try { const rr = JSON.parse(readFileSync(join(proj, "proto.json"), "utf8")).routes as { id: string; file?: string }[]; all = rr.map((r) => r.id); routes = rr.filter((r) => writes.some((w) => w.endsWith(`js/screens/${r.file}.js`))); } catch { /* not a kit prototype */ }
      const bad = routes.length ? await smokeRoutes("file://" + join(proj, "index.html"), routes, 6_000, all) : [];
      return { agent_id: n, project: "run_test/" + m[1], pages_checked: routes.map((r) => "#/" + r.id), proto_check: pc.ok ? "ok" : pc.problems.slice(0, 6), page_problems: bad.map((x) => `${x.route}: ${x.problems.join("; ")}`), verdict: pc.ok && !bad.length ? "CLEAN: its pages open and work" : "FIX: hand these problems to THIS builder now (delegate --session " + n + "), the others keep working" };
    } catch { return undefined; }
  };
  // when the agents are done, check every NO-BUILD prototype in run_test/ for the master (it does not have to remember to): files exist, scripts parse, screens/components defined, no unstyled classes
  let protos: { dir: string; ok: boolean; problems: string[] }[] | undefined;
  if (!pending().length) { try { const root = join(cwd, "run_test"), { protoCheck } = await import("../../core/proto_check.ts"); protos = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(root, d.name, "proto.json")) && existsSync(join(root, d.name, "index.html")) && !existsSync(join(root, d.name, "package.json"))).map((d) => { const r = protoCheck(join(root, d.name)); return { dir: "run_test/" + d.name, ok: r.ok, problems: r.problems.slice(0, 6) }; }); if (!protos.length) protos = undefined; } catch { /* no run_test yet */ } }
  // a lookup agent finished: the HARNESS rebuilds the store index and the mind map (STORE.md, MAP.md) with its layouts and briefs linked in; nobody has to run ref_store (it needs the host, a sandboxed worker cannot)
  try { const { buildStore } = await import("../../core/ref_store.ts"), seen = new Set<string>(); for (const n of names.filter((x) => !pending().includes(x))) for (const c of store.calls.filter((c) => c.task_id === task && c.callee_agent_id === n)) for (const w of c.req?.writes ?? []) { const m = /^run_test\/_ref\/([^/]+)\//.exec(w); if (m && !seen.has(m[1]!)) { seen.add(m[1]!); buildStore(join(cwd, "run_test", "_ref", m[1]!), m[1]!); } } } catch { /* the index is regenerated by ref store */ }
  const finishedNow = names.filter((n) => !pending().includes(n)), checks = any && finishedNow.length ? (await Promise.all(finishedNow.map(checkWork))).filter(Boolean) : undefined;
  const jobs = names.filter((n) => n.startsWith("job_") && jobDone(n)).map((n) => { const f = join(cwd, "run_test", "_jobs", n); let res: unknown = null; try { const t = readFileSync(f + ".json", "utf8"); res = t.length > 3500 ? { truncated: true, head: t.slice(0, 3000) } : JSON.parse(t); } catch { res = null; } return { job_id: n, exit: readFileSync(f + ".done", "utf8").trim(), result: res, error: (() => { try { return readFileSync(f + ".err", "utf8").slice(0, 300) || undefined; } catch { return undefined; } })() }; });
  out({ ...(jobs.length ? { jobs } : {}), ...attentionSpread(names.filter((n) => !n.startsWith("job_"))), ...(any ? { finished_now: finishedNow, checks, next_step: pending().length ? `React to ${finishedNow.join(", ")} NOW (a FIX verdict goes back to that builder at once; CLEAN needs nothing), then agent wait --any --agents ${pending().join(",")}` : "everyone is done: run ref compare / preview" } : {}), ...(interrupted ? { interrupted: "user_message", note: "the person sent you a message: it follows in your context; answer it, then call wait again for the same agents" } : {}), proto_check: protos, timed_out: pending().length > 0 && !interrupted, still_running: pending().map((n) => { const ts = store.events.filter((e) => e.kind === "tool.used" && e.task_id === task && e.agent_id === n).map((e) => e.t), st = store.agent(task, n); return { agent_id: n, last_tool_s_ago: ts.length ? Math.round((Date.now() - Math.max(...ts)) / 1000) : null, tool_calls: ts.length, running_s: st?.started_at ? Math.round((Date.now() - st.started_at) / 1000) : null, activity: st?.activity }; }), ...(pending().length > 0 && !interrupted ? { keep_waiting: "A timeout is not a failure. Keep waiting while an agent's last_tool_s_ago is under 120. Stop waiting only if no agent used a tool for 5 minutes." } : {}), agents: names.filter((n) => !n.startsWith("job_")).map((n) => { const a = store.agent(task, n), r = lastReport(n); return { agent_id: n, status: a?.status ?? "unknown", needs_parent: a?.needs_parent ?? undefined, report_id: r?.id, summary: r?.summary.slice(0, 600) ?? null, ...((r?.summary.length ?? 0) > 600 ? { truncated: true, read_full_with: `ledger_get --report ${r!.id}` } : {}), patch: store.patches.filter((p) => p.task_id === task && p.agent_id === n).map((p) => `${p.id}:${p.state}`).join(",") || null }; }) });
}
if (cmd === "apply_patches") {
  await applyPatchesCmd();
}
if (cmd === "agent_stop") {
  let rows: { agent_id: string }[] = [], stopped: string[] = [];
  store.tx(() => { rows = stopAgent(store, task, flag("agent") ?? ""); stopped = store.calls.filter((x) => x.status === "failed" && x.reason === "stopped").map((x) => x.id); });
  for (const c of stopped) await locks.release(task, c, policy.lockTtlMs);
  out({ ok: true, stopped: rows.map((r) => r.agent_id) });
}
}
