// A2 observe mode (approach `a2_native_observe`): the stock Claude `Agent` / `SendMessage` tools run for REAL (real sub-agents from `--agents`, Claude's own engine);
// these hooks only WATCH, so the flow is the same as a1 for the judge: PreToolUse = the shared policy (agentCall: role exists, depth, budget, caller live) records the call and
// may DENY it; PostToolUse closes the call and keeps the native agentId <-> our agent_id map (needed for SendMessage). Called by hook.ts when A2_MODE=observe.
// NOT_POSSIBLE here: file locks / worktrees / patches / FixtureGate (the native engine runs the sub-agent, our core never sees its tools); sub-agents share the lead's permission list.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadAgents } from "../../harness/core/base.ts";
import { MStore } from "../../harness/core/board.ts";
import { agentCall, defaultPolicy, type CallReq } from "../../harness/core/agent_call.ts";
import { release } from "../../harness/core/locks.ts";

type Ev = { agent_id?: string; hook_event_name?: string; tool_name?: string; tool_input?: Record<string, unknown>; tool_response?: unknown; tool_use_id?: string };
type Side = { pending: Record<string, string>; native: Record<string, string> };   // pending: tool_use_id -> call_id ; native: Claude agentId -> our agent_id

export function observe(ev: Ev, E = process.env): { deny?: string } {
  const file = E.HARNESS_STORE!, task = E.HARNESS_TASK!, me = E.HARNESS_AGENT ?? "", store = new MStore(file), sf = join(dirname(file), "a2_native_map.json");
  const side: Side = existsSync(sf) ? JSON.parse(readFileSync(sf, "utf8")) : { pending: {}, native: {} };
  const save = () => writeFileSync(sf, JSON.stringify(side));
  const i = ev.tool_input ?? {}, id = ev.tool_use_id ?? "";
  const close = (a: ReturnType<typeof store.agent>, c: { status: string } | undefined, call_id: string, extra: object) => {
    if (c) c.status = "done"; if (a) { a.status = "idle"; a.activity = "done"; a.last_event_at = Date.now(); }
    store.ev("native.result", task, a?.agent_id ?? me, { call: call_id, ...extra });
  };
  if (ev.hook_event_name === "PostToolUse") {
    const call_id = side.pending[id]; if (!call_id) return {};
    const r = ev.tool_response as { status?: string; agentId?: string } | string | undefined, text = typeof r === "string" ? r : JSON.stringify(r ?? "");
    const nid = (typeof r === "object" ? r?.agentId : undefined) ?? /agentId["']?\s*[:=]\s*["']?([\w-]+)/.exec(text)?.[1];
    const async_ = typeof r === "object" && r?.status === "async_launched";   // this Claude build runs a native sub-agent in the BACKGROUND: PostToolUse is the launch, SubagentStop is the end
    store.tx(() => {
      const c = store.calls.find((x) => x.id === call_id), a = c?.callee_agent_id ? store.agent(task, c.callee_agent_id) : undefined;
      if (a && nid) { a.session_id = nid; side.native[nid] = a.agent_id; }
      if (async_) store.ev("native.launched", task, a?.agent_id ?? me, { call: call_id, native_id: nid ?? null }); else close(a, c, call_id, { native_id: nid ?? null, chars: text.length });
    });
    if (!async_) delete side.pending[id]; save(); return {};
  }
  if (ev.hook_event_name === "SubagentStop") {   // the native sub-agent finished: close OUR call/agent row
    const nid = String((ev as { agent_id?: string }).agent_id ?? ""), aid = side.native[nid]; if (!aid) return {};
    store.tx(() => { const c = [...store.calls].reverse().find((x) => x.task_id === task && x.callee_agent_id === aid && x.status === "granted"); close(store.agent(task, aid), c, c?.id ?? "", { native_id: nid, stop: true }); });
    for (const k of Object.keys(side.pending)) if (side.pending[k] && store.calls.find((x) => x.id === side.pending[k])?.status === "done") delete side.pending[k];
    save(); return {};
  }
  // PreToolUse
  const defs = loadAgents(), lead = defs.get("lead"); if (E.HARNESS_LEAD_AGENTS !== undefined && lead) lead.agents = E.HARNESS_LEAD_AGENTS.split(",").filter(Boolean);
  let role = String(i.subagent_type ?? ""), session = "new", text = String(i.prompt ?? "");
  if (ev.tool_name === "SendMessage") {
    const to = String(i.to ?? ""), a = store.agentsOf(task).find((x) => x.agent_id === to || x.name === to || x.agent_id === side.native[to]);
    if (!a) return { deny: `AGENT REFUSED: no sub-agent "${to}" in this task.` };
    role = a.name; session = a.agent_id; text = String(i.message ?? "");
  }
  if (!role) return { deny: "AGENT REFUSED: subagent_type is missing." };
  const req: CallReq = { task_id: task, caller_agent_id: me, role, session_arg: session, mode: "work", objective: text, output: "native", boundaries: "native" };
  // a writer must declare its paths (core rule); a native call has no such field: the folder the hand-over names, else run_test/ (NOT enforced: no lock hook runs for native sub-agents)
  if (defs.get(role)?.writes) req.writes = [/run_test\/[\w.-]+/.exec(text)?.[0] ?? "run_test"];
  let res!: ReturnType<typeof agentCall>;
  store.tx(() => { res = agentCall(store, defs, defaultPolicy({ agentMaxDepth: Number(E.HARNESS_MAX_DEPTH ?? 1), maxInstancesPerRole: Number(E.HARNESS_MAX_INSTANCES ?? 4) }), req);
    if (res.ok) { const ag = store.agent(task, res.agent.agent_id)!; ag.status = "running"; ag.activity = "native " + res.kind; ag.last_event_at = Date.now(); release(store, res.call_id, 0, Date.now()); } });   // the lock agentCall took is meaningless here (no lock hook runs for native sub-agents) and would block every later writer: freed at once
  if (!res.ok) return { deny: `AGENT REFUSED: ${res.reason}` };
  side.pending[id] = res.call_id; save(); return {};
}
