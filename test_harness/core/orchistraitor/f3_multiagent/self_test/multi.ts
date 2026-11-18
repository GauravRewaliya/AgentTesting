// Test 2: f_1_withmulti_ag = the harness WITH multi-agent (on demand): many instances per role, agent.call, locks, worktrees + patches, board.
//   bun self_test/multi.ts            offline suite (scripted agents, real harness code, real git)
//   bun self_test/multi.ts --real     also the real suite (real claude -p: a lead that delegates, a lock-guarded writer, a fork; ~12 haiku calls)
import { AGENTS_DIR } from "@core/config.ts";
import { customDef } from "../harness/core/custom.ts";
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkRepo, results, rm, setSuite, t, writeReport } from "./lib.ts";
import { agentCall, costOf, defaultPolicy, markStalled, stopAgent, type CallReq, type CallRes, type Policy } from "../harness/core/agent_call.ts";
import { callAgent, checkAgents, RealRunner, ScriptRunner, projectDirFor, transcriptExistsAnywhere, transcriptExistsIn, transcriptFor, type AgentDef, type RunCall } from "../harness/core/base.ts";
import { MStore, boardStatus, inbox, noteContext, say, sessionStats } from "../harness/core/board.ts";
import { runCallee, sharedContext } from "../harness/core/callee.ts";
import { videoOffReason, appendRow, checkedOf, leftOf, memoryBlock, needsChangesOf, planChecks, projectStamp, readRows, renderQa, verdictOf, writeMemory } from "../harness/core/loops_ai.ts";
import { setupFailLines } from "../../../../infra/qa/web_dev_qa.ts";
import { videoAfterRun } from "../../../../infra/qa/video.ts";
import { sandboxable } from "../harness/core/base/docker_runner.ts";
import { usesTeamTools } from "../harness/core/base/agents.ts";
import { vueFlags } from "../../../../../TestCases/test_folders/agent_fixture/store/web_setup/scaffold.ts";
import { isStatusOnly, statusReply } from "../harness/core/status_reply.ts";
import { lintPlan } from "../harness/core/plan_lint.ts";
import { finishedTurn } from "../harness/core/base/hung.ts";
import { attention, dueAutoStops, dueNudges, waitSeconds } from "../harness/core/monitor.ts";
import { matchCalls } from "../testrun/cases.ts";
import { acquireSlot } from "../harness/core/base/slots.ts";
import { hookArgs } from "../harness/core/hooks_settings.ts";
import { declarations, launchDef, launchTools, nativeAgentsJson, nativeEnv } from "../harness/core/launch.ts";
import { acquire, covers, guardEdit, guardResource, overlaps, reap, release, resourcesFor } from "../harness/core/locks.ts";
import { replan, validatePlan, type PlanRow, type PlanTask } from "../harness/core/plan.ts";
import { chatLog, chatPM, conversationBlock, digest, renderBoard } from "../harness/core/pm.ts";
import { ensureRun, findRun, redactUrl, resumeRun } from "../harness/core/session_run.ts";
import { StoreLocks, locksFromEnv, type LockApi } from "../harness/core/lockapi.ts";
import { RedisLocks } from "../harness/core/locks_redis.ts";
import { parseNav, protoInit } from "../harness/core/proto_init.ts";
import { protoCheck } from "../harness/core/proto_check.ts";
import { browse, chromeBin } from "../harness/core/browse.ts";
import * as bconn from "../harness/core/browser_conn.ts";
import { refAssets } from "../harness/core/ref_assets.ts";
import { siteAudit } from "../harness/core/site_audit.ts";
import { buildStore, initStore } from "../harness/core/ref_store.ts";
import { contactSheets } from "../harness/core/ref_capture.ts";
import { applyQueue } from "../harness/core/patches.ts";
import { addWorktree, auditWrites, patchOf, removeWorktree } from "../harness/core/worktree.ts";
import { HARNESS_DIR, loadDefs } from "../harness/main.ts";
import { runLead } from "../harness/lead.ts";
import { InvariantViolation, Store as BaseStore } from "../harness/core/base/store.ts";
import { canaryFor } from "../harness/core/base/call.ts";
import { startWatchdog } from "../harness/core/base/watchdog.ts";
import { assertRegistry, checkRegistry, checkSessionFiles } from "../harness/core/invariants.ts";
import { appendFileSync } from "node:fs";
import { trace } from "../harness/core/base.ts";

const REAL = process.argv.includes("--real");
const defs = loadDefs();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** `plan_status --wait N` now ends EARLY (a failed task, a completed phase, an agent that needs the lead): a test that wants the FINAL state asks again until the plan has settled. */
const settle = async (tool: (a: string[]) => Promise<any>, plan: string, wait = "30") => { let st: any; for (let i = 0; i < 8; i++) { st = await tool(["plan_status", "--plan", plan, "--wait", wait]); if (["done", "failed", "aborted"].includes(st.status)) break; } return st; };
const mkDef = (name: string, o: Partial<AgentDef> = {}): AgentDef => ({ name, role: name, description: name, model: "haiku", session: "persistent", writes: false, max_children: 4, agents: [], tiers: [], allow: [], tools: [], dir: "", prompt_file: "", ...o });

function world(over: Partial<Policy> = {}, d: Map<string, AgentDef> = defs, leadName = "lead") {
  const store = new MStore(), policy = defaultPolicy({ agentMaxDepth: 4, ...over });
  const lead = store.addAgent("t", d.get(leadName)!, { level: 1 }); lead.status = "running";
  return { store, policy, lead, d };
}
type W = ReturnType<typeof world>;
const base: CallReq = { task_id: "t", caller_agent_id: "lead#1", role: "researcher", session_arg: "new", objective: "find X", output: "3 bullets", boundaries: "read only" };
const call = (w: W, o: Partial<CallReq> = {}) => agentCall(w.store, w.d, w.policy, { ...base, ...o });
function granted(r: CallRes) { if (!r.ok) throw new Error("expected granted: " + r.reason); return r; }
const st = (a: { status: string }) => a.status as string;
const code = (r: CallRes) => (r.ok ? "granted" : r.code);

async function offline() {
  setSuite("offline: agent.call authority");
  { const bad = checkAgents(defs);
    t("M1", "agents:check passes; lead declares its sub-agents in agent.json (the 6 real ones: researcher, lookup, planner, builder, ux-designer, qa-reviewer; test stand-ins live in test_harness/core/agents/test_agents) (and may call custom ones); .claude/agents is empty everywhere", bad.length === 0 && defs.get("lead")!.agents.length === 6 && defs.get("lead")!.agents.includes("lookup") && defs.get("lead")!.custom === true, bad.join("; "));
    const d = declarations(defs.get("lead")!, defs);
    t("M1b", "declarations are built at run time from the callees' agent.json and tell the lead their REAL tools: researcher has web access, builder can write but has NO web access", /researcher \(read-only; has web access; tools: [^)]*WebFetch/.test(d) && /builder \(can write; must declare --writes; NO web access; tools:/.test(d), d); }
  { const w = world({ agentMaxDepth: 1 });
    const r = call(w);
    t("M2a", "multi-agent OFF (default depth 1): the lead cannot call anyone; the reason says so", !r.ok && r.code === "depth_exceeded" && r.reason.includes("multi-agent is off"), r.ok ? "" : r.reason);
    t("M2a2", "the default policy is off", defaultPolicy().agentMaxDepth === 1, ""); }
  { const w = world();
    const r = granted(call(w));
    t("M2b", "ON: lead calls researcher with session new -> researcher#1 at level 2, call recorded as granted",
      r.agent.agent_id === "researcher#1" && r.level === 2 && r.kind === "new" && w.store.calls.length === 1 && w.store.calls[0]!.status === "granted", JSON.stringify(w.store.calls[0]));
    r.agent.status = "running";
    const c = agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: "researcher#1", role: "builder", writes: ["a.txt"] });
    t("M2c", "a callee not in the caller's agent.json agents[] is denied (researcher -> builder)", code(c) === "not_declared", c.ok ? "" : c.reason); }
  { const w = world();
    t("M2d", "missing objective/output/boundaries is denied with the field named", code(call(w, { objective: "" })) === "missing_field" && code(call(w, { boundaries: undefined })) === "missing_field", "");
    const a = call(w, { session_arg: undefined }), b = call(w, { session_arg: "  " }), c = call(w, { session_arg: "banana" });
    t("M2e", "session is REQUIRED: none/blank -> session_required; an unknown id -> agent_not_in_task (and lists the known ones); never guessed into new",
      code(a) === "session_required" && code(b) === "session_required" && code(c) === "agent_not_in_task" && w.store.agentsOf("t").length === 1, [a, b, c].map((x) => (x.ok ? "" : x.reason)).join(" | ")); }
  { const w = world(); const r1 = granted(call(w)); r1.agent.session_id = "S1";
    const wrong = call(w, { role: "planner", session_arg: "researcher#1" });
    t("M2f", "an id of another role is refused (wrong_role)", code(wrong) === "wrong_role", wrong.ok ? "" : wrong.reason);
    r1.agent.status = "running";
    const busy = call(w, { session_arg: "researcher#1" });
    t("M2h", "continuing a running instance is refused (agent_busy) and the reason points to say", code(busy) === "agent_busy" && !busy.ok && busy.reason.includes("say"), busy.ok ? "" : busy.reason);
    r1.agent.status = "idle";
    const again = call(w, { session_arg: "researcher#1" });
    t("M2h2", "continuing an idle instance is granted as a resume of the same row", again.ok && again.kind === "resume" && again.agent === r1.agent, ""); }
  { const w = world(); const a = granted(call(w)); a.agent.status = "idle";
    const w2 = world(); w2.store.agents.push({ ...a.agent, task_id: "t2", agent_id: "researcher#2" });   // an agent of ANOTHER task
    const other = agentCall(w2.store, w2.d, w2.policy, { ...base, session_arg: "researcher#2" });
    t("M2g", "a session id of another task is refused (R-10): ids resolve only inside their task", code(other) === "agent_not_in_task", other.ok ? "" : other.reason); }
  { const d = new Map([["a", mkDef("a", { agents: ["b"] })], ["b", mkDef("b", { agents: ["a"] })]]);
    const w = world({}, d, "a"); w.store.agents[0]!.name = "a";
    const r = granted(agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: "a#1", role: "b" })); r.agent.status = "running";
    const c = agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: "b#1", role: "a" });
    t("M2i", "a cycle (a -> b -> a) is denied and shows the chain", code(c) === "cycle" && !c.ok && c.reason.includes("a -> b -> a"), c.ok ? "" : c.reason); }
  { // one-level self-split: a role that lists ITSELF may start copies of itself; a copy may not; a role that does not list itself may not
    const d = new Map([["root", mkDef("root", { agents: ["lk", "q"] })], ["lk", mkDef("lk", { agents: ["lk"], max_children: 3 })], ["q", mkDef("q", { agents: ["x"] })], ["x", mkDef("x", { agents: ["q"] })]]);
    const w = world({}, d, "root"); w.store.agents[0]!.name = "root";
    const l1 = granted(agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: "root#1", role: "lk" })); l1.agent.status = "running";
    const copy = agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: l1.agent.agent_id, role: "lk" }); if (copy.ok) copy.agent.status = "running";
    const again = copy.ok ? agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: copy.agent.agent_id, role: "lk" }) : copy;
    const q1 = granted(agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: "root#1", role: "q" })); q1.agent.status = "running";
    const qq = agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: q1.agent.agent_id, role: "q" });
    const x1 = granted(agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: q1.agent.agent_id, role: "x" })); x1.agent.status = "running";
    const xq = agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: x1.agent.agent_id, role: "q" });
    t("PK28", "ONE lookup agent may start copies of itself (opt-in: it lists itself in agents[]), but a copy may not (no recursion), a role that does not list itself may not, and a real cycle (q -> x -> q) is still denied", copy.ok && code(again) === "cycle" && !qq.ok && code(xq) === "cycle", `copy ok=${copy.ok} copy-of-copy=${code(again)} q->q=${code(qq)} q->x->q=${code(xq)}`); }
  { const names = ["a", "b", "c", "d", "e"], d = new Map(names.map((n, i) => [n, mkDef(n, { agents: names[i + 1] ? [names[i + 1]!] : [] })]));
    const w = world({ agentMaxDepth: 9 }, d, "a"); w.store.agents[0]!.name = "a"; let last = "a#1", res: CallRes = { ok: false, call_id: "", code: "", reason: "" };
    const lv: string[] = [];
    for (const n of names.slice(1)) { res = agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: last, role: n }); lv.push(code(res)); if (!res.ok) break; res.agent.status = "running"; last = res.agent.agent_id; }
    t("M2j", "depth: a policy of 9 is clipped to the hard limit 4: levels 2,3,4 are granted, the call that would be level 5 is denied", lv.join() === "granted,granted,granted,depth_exceeded" && !res.ok && res.reason.includes("limit 4"), lv.join() + " " + (res.ok ? "" : res.reason)); }
  { const d = new Map([["p", mkDef("p", { agents: ["k"], max_children: 2 })], ["k", mkDef("k")]]);
    const w = world({}, d, "p"); w.store.agents[0]!.name = "p";
    const mk = () => agentCall(w.store, w.d, w.policy, { ...base, caller_agent_id: "p#1", role: "k" });
    const k1 = granted(mk()), k2 = granted(mk()); k1.agent.status = "running"; k2.agent.status = "running";
    const k3 = mk(); k1.agent.status = "idle"; const k4 = mk();
    t("M2k", "fan-out: max_children 2 live sub-agents; the third is denied until one finishes", code(k3) === "fan_out" && code(k4) === "granted", code(k3) + "," + code(k4)); }
  { const w = world({ maxInstancesPerRole: 3 }); const rs = [1, 2, 3].map(() => granted(call(w))); rs.forEach((r) => (r.agent.status = "idle"));
    const x = call(w), y = call(w, { session_arg: "researcher#2" });
    t("M2l", "instance limit: the 4th NEW researcher is denied, continuing one still works", code(x) === "instance_limit" && code(y) === "granted", code(x) + "," + code(y)); }
  { const w = world(); const r1 = granted(call(w)); r1.agent.status = "idle";
    const noSess = call(w, { session_arg: "fork:researcher#1" }); r1.agent.session_id = "S1";
    const f = granted(call(w, { session_arg: "fork:researcher#1" }));
    t("M2m", "fork: needs a source with a session; creates researcher#2 whose parent is researcher#1", code(noSess) === "fork_source_invalid" && f.kind === "fork" && f.agent.parent_agent_id === "researcher#1" && f.agent.agent_id === "researcher#2", code(noSess) + " " + f.agent.agent_id); }
  { const k = call(world({ killSwitch: true })), s = call(world({ spendPaused: true })), w = world(); w.lead.status = "idle";
    const nl = call(w), unk = call(world(), { caller_agent_id: "ghost#9" });
    t("M2n", "kill switch, spend pause, a caller that is not running, an unknown caller: all denied", code(k) === "kill_switch" && code(s) === "spend_paused" && code(nl) === "caller_not_live" && code(unk) === "caller_not_live", [k, s, nl, unk].map(code).join()); }
  { const w = world();
    const a = call(w, { role: "builder", writes: undefined }), b = call(w, { role: "builder", writes: ["src/a.ts"] }), c = call(w, { role: "researcher", writes: ["x"] });
    const n = 3; t("M2p", "a writer must declare writes; a read-only agent may not; every call (granted or denied) leaves a call row with its reason",
      code(a) === "writes_required" && code(b) === "granted" && code(c) === "readonly_declared_writes" && w.store.calls.length === n && w.store.calls.filter((x) => x.status === "denied").every((x) => x.reason), w.store.calls.map((x) => x.status + ":" + (x.reason ?? "")).join(" | ")); }

  setSuite("offline: launch (tools per level, run-time declarations, native equivalents)");
  { const lead = defs.get("lead")!, res = defs.get("researcher")!;
    const on = launchTools(lead, 1, 4), off = launchTools(lead, 1, 1), leaf = launchTools(res, 2, 4);
    const lastLevel = launchTools(mkDef("x", { agents: ["y"], allow: ["Read", "Bash(bun *tools.ts delegate*)"] }), 4, 4);
    t("M3", "the delegate tool exists for the lead only when multi-agent is on, and is REMOVED at the last level and for leaves",
      on.delegate && !off.delegate && !leaf.delegate && !lastLevel.delegate && !lastLevel.allow.some((a) => a.includes("delegate")) && lastLevel.allow.includes("Read"), JSON.stringify({ on: on.delegate, off: off.delegate, leaf: leaf.delegate, last: lastLevel.allow }));
    const dir = join(tmpdir(), "lf-test-launch");
    const l1 = launchDef(lead, defs, 1, 4, dir), l0 = launchDef(lead, defs, 1, 1, dir);
    t("M3b", "the launch prompt = CLAUDE.md + the declarations when it may call; plain CLAUDE.md when it may not", readFileSync(l1.prompt_file, "utf8").includes("Sub-agents you may call") && !readFileSync(l0.prompt_file, "utf8").includes("Sub-agents you may call"), "");
    const nat = nativeAgentsJson(lead, defs), env = nativeEnv(9);
    t("M3c", "backend N from the same files: --agents holds every declared agent; the native depth wall is 3 below the lead and capped at the hard limit", Object.keys(nat).length === defs.get("lead")!.agents.length && env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH === "3" && nativeEnv(1).CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH === "0", JSON.stringify(env)); }

  setSuite("offline: write locks and the queue");
  { const s = new MStore(), N = 1000, T = (agent: string, call_id: string, paths: string[], now = N) => acquire(s, { task_id: "t", agent_id: agent, call_id, paths, ttlMs: 500, now });
    t("M4a", "overlap/cover rules", overlaps("src/*.ts", "src/a.ts") && !overlaps("docs/x.md", "src/y.ts") && covers("src/**", "src/a/b.ts") && covers("src/*.ts", "src/a.ts") && !covers("src/*.ts", "src/a/b.ts") && covers("src", "src/a.ts"), "");
    const a = T("A", "ca", ["src/a.ts", "src/b.ts"]), b = T("B", "cb", ["src/b.ts", "src/c.ts"]);
    t("M4b", "all-or-none: B wants b.ts+c.ts, b.ts is held -> B queues at position 1 and holds NOTHING (c.ts stays free)", a.ok && !b.ok && b.position === 1 && !s.locks.some((l) => l.agent_id === "B") && T("C", "cc", ["src/c.ts"]).ok === false /* queued behind B */, JSON.stringify(b));
    release(s, "cc", 500, N);
    const s2 = new MStore(); const X = (ag: string, id: string, p: string[]) => acquire(s2, { task_id: "t", agent_id: ag, call_id: id, paths: p, ttlMs: 500, now: N });
    const d1 = X("D1", "d1", ["x", "y"]), d2 = X("D2", "d2", ["y", "x"]);
    t("M4c", "no deadlock: two writers wanting {x,y} and {y,x}: one gets both, the other waits holding nothing", d1.ok && !d2.ok && s2.locks.every((l) => l.agent_id === "D1"), "");
    const s3 = new MStore(); const Y = (ag: string, id: string, p: string[], now = N) => acquire(s3, { task_id: "t", agent_id: ag, call_id: id, paths: p, ttlMs: 500, now });
    Y("A", "ca", ["a"]); const qb = Y("B", "cb", ["a"]), qc = Y("C", "cc", ["a"]), free = Y("E", "ce", ["z"]);
    t("M4d", "FIFO + fairness: B then C queue behind A; an unrelated file is granted at once", !qb.ok && qb.position === 1 && !qc.ok && qc.position === 2 && free.ok, "");
    const g1 = release(s3, "ca", 500, N), holder1 = s3.locks.filter((l) => l.path === "a").map((l) => l.agent_id).join();
    const g2 = release(s3, "cb", 500, N), holder2 = s3.locks.filter((l) => l.path === "a").map((l) => l.agent_id).join();
    t("M4e", "release hands the lock to the waiters in arrival order (B first, then C)", g1.join() === "cb" && holder1 === "B" && g2.join() === "cc" && holder2 === "C", `${g1} ${holder1} ${g2} ${holder2}`);
    const s4 = new MStore(); acquire(s4, { task_id: "t", agent_id: "A", call_id: "ca", paths: ["a"], ttlMs: 500, now: N });
    const early = acquire(s4, { task_id: "t", agent_id: "B", call_id: "cb", paths: ["a"], ttlMs: 500, now: N + 100 });
    const late = acquire(s4, { task_id: "t", agent_id: "B", call_id: "cb", paths: ["a"], ttlMs: 500, now: N + 600 });
    t("M4f", "a dead agent's lease expires: the waiter gets the lock on its next try, an event records it", !early.ok && late.ok && s4.evs("lock.expired").length === 1, "");
    const s5 = new MStore(); acquire(s5, { task_id: "t", agent_id: "A", call_id: "ca", paths: ["src/**"], ttlMs: 5000, now: N }); acquire(s5, { task_id: "t", agent_id: "B", call_id: "cb", paths: ["docs/x.md"], ttlMs: 5000, now: N });
    const ok = guardEdit(s5, "t", "A", "src/deep/f.ts", N), other = guardEdit(s5, "t", "A", "docs/x.md", N), undecl = guardEdit(s5, "t", "A", "README.md", N);
    t("M4g", "the edit guard: inside my locks = allow; a file another agent holds = LOCKED (names the holder, says what to do); outside what I declared = NOT DECLARED",
      ok.allow && !other.allow && other.reason.startsWith("LOCKED") && other.reason.includes("B") && !undecl.allow && undecl.reason.startsWith("NOT DECLARED"), `${other.allow ? "" : other.reason}`);
    const s6 = new MStore(); const Z = (ag: string, id: string) => acquire(s6, { task_id: "t", agent_id: ag, call_id: id, paths: ["a"], ttlMs: 500, now: N });
    Z("A", "ca"); Z("B", "cb"); s6.locks = [];   // A's lock vanishes without promotion (e.g. its lease just ran out), B is still waiting
    const cLate = Z("C", "cc"), bTurn = Z("B", "cb");
    t("M4i", "fairness: with the lock free but B already waiting, a later request C must queue behind B; B gets it on its next try", !cLate.ok && bTurn.ok, JSON.stringify([cLate, bTurn]));
    reap(s5, N + 1e7); t("M4h", "reap removes every expired lease", s5.locks.length === 0, ""); }

  setSuite("offline: worktrees, patches, the Bash-write audit (real git)");
  { const repo = mkRepo({ "a.txt": Array.from({ length: 12 }, (_, i) => "A" + (i + 1)).join("\n") + "\n", "b.txt": "B1\n", "c.txt": "C1\n" }), store = new MStore();
    const wt = (n: string) => addWorktree(repo, n);
    const w1 = wt("w1"), w2 = wt("w2"), w3 = wt("w3"), w4 = wt("w4");
    const sub = (p: { dir: string }, f: string, from: string, to: string) => writeFileSync(join(p.dir, f), readFileSync(join(p.dir, f), "utf8").replace(from, to));
    sub(w1, "a.txt", "A2", "W1-A2"); sub(w2, "b.txt", "B1", "W2-B1"); sub(w3, "a.txt", "A2", "W3-A2"); sub(w4, "a.txt", "A10", "W4-A10");
    writeFileSync(join(w2.dir, "c.txt"), "SNEAKY\n");   // a "Bash" write outside what w2 declared
    const viol = auditWrites(w2.dir, ["b.txt"]);
    t("M5a", "audit: a write outside the declared paths is detected from git status (the Bash gap's detective control)", viol.join() === "c.txt" && auditWrites(w1.dir, ["a.txt"]).length === 0, viol.join());
    const ps = [["builder#1", w1], ["builder#2", w2], ["builder#3", w3], ["builder#4", w4]] as const;
    const { addPatch } = await import("../harness/core/patches.ts");
    for (const [ag, w] of ps) { const p = patchOf(w.dir, w.base); addPatch(store, { task_id: "t", agent_id: ag, base: w.base, files: p.files, text: p.text }); }
    const sup = addPatch(store, { task_id: "t", agent_id: "builder#2", base: w2.base, files: ["b.txt"], text: store.patches[1]!.text });   // builder#2 re-sends: the old one is superseded
    const r = applyQueue(store, repo, "t");
    const a = readFileSync(join(repo, "a.txt"), "utf8"), st = (n: number) => store.patches[n]!.state;
    t("M5b", "applying patches in queue order: non-overlapping ones apply (two edits far apart in one file both land); the one touching the same line is REJECTED with the git error and nothing half-applied",
      st(0) === "applied" && st(3) === "applied" && st(2) === "rejected" && a.includes("W1-A2") && a.includes("W4-A10") && !a.includes("W3-A2") && readFileSync(join(repo, "b.txt"), "utf8").includes("W2-B1") && r.rejected.length === 1 && store.evs("patch.conflict").length === 1,
      `states=${store.patches.map((p) => p.state)} rejected=${JSON.stringify(r.rejected).slice(0, 160)}`);
    t("M5c", "a newer patch from the same agent supersedes its older unapplied one", st(1) === "superseded" && sup.state === "applied", store.patches.map((p) => p.state).join());
    for (const [, w] of ps) removeWorktree(repo, w.dir, w.branch);
    t("M5d", "worktrees and branches are cleaned up", execFileSync("git", ["-C", repo, "worktree", "list"], { encoding: "utf8" }).trim().split("\n").length === 1 && !execFileSync("git", ["-C", repo, "branch"], { encoding: "utf8" }).includes("wt/"), "");
    rm(repo); }

  setSuite("offline: board, notes, instances, stop, stalled, cost");
  { const s = new MStore(); const a = s.addAgent("t", defs.get("researcher")!, { level: 2 }), b = s.addAgent("t", defs.get("researcher")!, { level: 2 });
    say(s, "t", b.agent_id, a.agent_id, "x".repeat(1000)); say(s, "t", b.agent_id, "all", "builder#1 owns src/a.ts until it ends");
    const first = inbox(s, "t", a.agent_id), second = inbox(s, "t", a.agent_id), forB = inbox(s, "t", b.agent_id), ctx = noteContext(first);
    t("M6a", "notes: delivered once, capped at 400 chars, 'all' reaches others but not the sender, labelled as not from the person",
      first.length === 2 && first[0]!.text.length === 400 && second.length === 0 && forB.length === 0 && !!ctx && ctx.includes("not from the person") && JSON.parse(ctx).hookSpecificOutput.hookEventName === "PostToolUse", String(ctx).slice(0, 120));
    const bs = boardStatus(s, "t"); t("M6b", "board_status lists each agent with status, activity, held and queued paths, last note", bs.length === 2 && "writes" in bs[0]! && bs[0]!.last_note !== null, JSON.stringify(bs[0]).slice(0, 160)); }
  { const runner = new ScriptRunner(async (c: RunCall) => { await sleep(80); return `answer from ${c.row.agent_id}`; });
    const w = world(), ctx = { store: w.store, runner, defs, sessionCap: 3 };
    const q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, ...o });
    const r1 = granted(agentCall(w.store, w.d, w.policy, q({ objective: "topic one" }))), r2 = granted(agentCall(w.store, w.d, w.policy, q({ objective: "topic two" })));
    const res = defs.get("researcher")!, cwd = tmpdir();
    const p1 = runCallee(ctx, w.policy, r1, q({ objective: "topic one" }), res, { cwd, writerMode: "shared" }), p2 = runCallee(ctx, w.policy, r2, q({ objective: "topic two" }), res, { cwd, writerMode: "shared" });
    await sleep(25); const both = w.store.agentsOf("t").filter((a) => a.name === "researcher" && a.status === "running").length;
    await Promise.all([p1, p2]);
    const s1 = r1.agent.session_id, s2 = r2.agent.session_id;
    t("M7a", "two instances of one role run in parallel (both 'running' at once), each with its own session", both === 2 && !!s1 && !!s2 && s1 !== s2 && st(r1.agent) === "idle" && w.store.reports.length === 2, `running=${both}`);
    const c3 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "researcher#2", objective: "also check xyz" })));
    await runCallee(ctx, w.policy, c3, q({ session_arg: "researcher#2", objective: "also check xyz" }), res, { cwd, writerMode: "shared" });
    const last = runner.calls[runner.calls.length - 1]!;
    t("M7b", "continuing researcher#2: same session, resumed, the prompt is only the new instruction", last.session.resume && last.session.id === s2 && last.prompt.includes("also check xyz") && !last.prompt.startsWith("TASK") && r2.agent.resume_count === 1 && r1.agent.resume_count === 0, last.prompt.replace(/\n/g, " | "));
    const f = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "fork:researcher#2", objective: "side job" })));
    await runCallee(ctx, w.policy, f, q({ session_arg: "fork:researcher#2", objective: "side job" }), res, { cwd, writerMode: "shared" });
    const fc = runner.calls[runner.calls.length - 1]!;
    t("M7c", "fork: researcher#3 starts from a copy of #2's session (fork_from) under a NEW session id, with the full brief; #2 is unchanged", fc.session.fork_from === s2 && fc.session.id !== s2 && f.agent.session_id === fc.session.id && r2.agent.session_id === s2 && fc.prompt.startsWith("TASK"), `${fc.session.fork_from?.slice(0, 4)} ${fc.session.id.slice(0, 4)}`);
    t("M7d", "cost rolls up the call tree: the lead's total = its sub-agents' reports", Math.abs(costOf(w.store, "t", "lead#1") - 0.004) < 1e-9, String(costOf(w.store, "t", "lead#1"))); }
  // FUNCTIONAL proof (real runCallee, recorded prompts): the project memory is in front of a READ-ONLY agent's first call, in front of a RESUMED call, and a qa-reviewer's answer lands in QA.md
  { const lp2 = mkdtempSyncSafe(), pj = join(lp2, "run_test", "app"); mkdirSync(pj, { recursive: true }); writeFileSync(join(pj, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    appendRow(pj, { kind: "review", by: "qa-reviewer#9", verdict: "FAIL", stamp: projectStamp(pj), task: "earlier-task", note: "FAIL\nNEEDS_CHANGES: src/a.ts: error TS2304 Cannot find name x" }); writeMemory(pj, { dir: "app" });
    const runner = new ScriptRunner(async () => "FAIL\nthe footer is not translated at stop 6."), w = world(), ctx = { store: w.store, runner, defs, sessionCap: 3 };
    const q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, ...o }), rr = defs.get("researcher")!, qd = defs.get("qa-reviewer")!;
    const r1 = granted(agentCall(w.store, w.d, w.policy, q({ objective: "look at the page for the person" })));
    await runCallee(ctx, w.policy, r1, q({ objective: "look at the page for the person" }), rr, { cwd: lp2, writerMode: "shared" }); const first = runner.calls[runner.calls.length - 1]!;
    const r2 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: r1.agent.agent_id, objective: "and the second page" })));
    await runCallee(ctx, w.policy, r2, q({ session_arg: r1.agent.agent_id, objective: "and the second page" }), rr, { cwd: lp2, writerMode: "shared" }); const resumed = runner.calls[runner.calls.length - 1]!;
    const g3 = agentCall(w.store, w.d, w.policy, q({ role: "qa-reviewer", objective: "check the built page against the plan" })); let qaOk = false, qaMd = "";
    if ("agent" in g3) { await runCallee(ctx, w.policy, g3 as never, q({ role: "qa-reviewer", objective: "check the built page against the plan" }), qd, { cwd: lp2, writerMode: "shared" }); qaMd = readFileSync(join(pj, ".loopsAI", "QA.md"), "utf8"); qaOk = /QA REVIEW by qa-reviewer#1 · FAIL/.test(qaMd) && /footer is not translated/.test(qaMd); }
    t("CX26", "FUNCTIONAL: the project memory (latest QA verdict, what QA asked for; information only, no call to run QA) is in the prompt of a READ-ONLY agent's first call AND of its resumed call, and what a qa-reviewer answers is written into the project's QA.md by the harness",
      /PROJECT MEMORY/.test(first.prompt) && /last QA review FAIL/.test(first.prompt) && /TS2304/.test(first.prompt) && /information only/.test(first.prompt) && !/qa_check/.test(first.prompt) && first.prompt.indexOf("PROJECT MEMORY") < first.prompt.indexOf("OBJECTIVE:")
      && resumed.session.resume === true && /PROJECT MEMORY/.test(resumed.prompt) && /and the second page/.test(resumed.prompt) && qaOk, JSON.stringify([/PROJECT MEMORY/.test(first.prompt), /PROJECT MEMORY/.test(resumed.prompt), "agent" in g3, qaMd.length])); }
  // QA keeps ONE session per task: "new" on a singleton role continues the agent that exists (its memory), it never starts a fresh QA agent again and again
  { const runner = new ScriptRunner(async () => "review done"), w = world(), ctx = { store: w.store, runner, defs, sessionCap: 5 }, qd = defs.get("qa-reviewer")!, rd = defs.get("researcher")!;
    const q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, role: "qa-reviewer", session_arg: "new", ...o });
    const a1 = granted(agentCall(w.store, w.d, w.policy, q({ objective: "check the built page" }))); await runCallee(ctx, w.policy, a1, q({ objective: "check the built page" }), qd, { cwd: tmpdir(), writerMode: "shared" });
    const a2 = granted(agentCall(w.store, w.d, w.policy, q({ objective: "check it again after the fix" }))); await runCallee(ctx, w.policy, a2, q({ objective: "check it again after the fix" }), qd, { cwd: tmpdir(), writerMode: "shared" });
    const second = runner.calls[runner.calls.length - 1]!, one = w.store.agentsOf("t").filter((a) => a.name === "qa-reviewer").length;
    a2.agent.status = "running"; const busy = agentCall(w.store, w.d, w.policy, q({ objective: "and a third time" })); a2.agent.status = "failed";
    const afterFail = granted(agentCall(w.store, w.d, w.policy, q({ objective: "a failed QA agent does not block" }))), two = w.store.agentsOf("t").filter((a) => a.name === "qa-reviewer").length;
    const r1 = granted(agentCall(w.store, w.d, w.policy, q({ role: "researcher", objective: "topic one for the person" }))), r2 = granted(agentCall(w.store, w.d, w.policy, q({ role: "researcher", objective: "topic two for the person" })));
    t("CX28", "QA keeps ONE session per task: 'new' on qa-reviewer while it exists CONTINUES it (same agent id, resumed session, reused=true), a busy one is told to wait (agent_busy), a failed one does not block a new one, and a normal role (researcher) still gets separate instances",
      a2.agent.agent_id === a1.agent.agent_id && a2.kind === "resume" && a2.reused === true && second.session.resume === true && second.session.id === a1.agent.session_id && one === 1
      && busy.ok === false && (busy as { code: string }).code === "agent_busy" && afterFail.kind === "new" && afterFail.agent.agent_id !== a1.agent.agent_id && two === 2 && r1.agent.agent_id !== r2.agent.agent_id && !r2.reused && qd.singleton === true && !rd.singleton, JSON.stringify([a1.agent.agent_id, a2.agent.agent_id, a2.kind, a2.reused, one, (busy as { code?: string }).code, two])); }
  // the QA agent works in a THROWAWAY COPY: it may edit and run anything there, the copy is deleted, the real project stays as it was, no patch is made; touching the real project is flagged
  { const ws = mkdtempSyncSafe(); mkdirSync(join(ws, "run_test", "app"), { recursive: true }); writeFileSync(join(ws, "run_test", "app", "index.html"), "REAL"); writeFileSync(join(ws, "run_test", "app", "package.json"), "{}");
    execFileSync("git", ["-C", ws, "init", "-q"]); execFileSync("git", ["-C", ws, "-c", "user.name=h", "-c", "user.email=h@h", "add", "-A"]); execFileSync("git", ["-C", ws, "-c", "user.name=h", "-c", "user.email=h@h", "commit", "-qm", "base"]);
    let seen: { cwd: string; real?: string; scratch?: string; sawFile: string } | null = null, mode: "copy" | "real" = "copy";
    const runner = new ScriptRunner(async (c) => { const f = join(c.cwd, "run_test", "app", "index.html"); seen = { cwd: c.cwd, real: c.env?.HARNESS_REAL_CWD, scratch: c.env?.HARNESS_SCRATCH, sawFile: existsSync(f) ? readFileSync(f, "utf8") : "" }; writeFileSync(mode === "copy" ? f : join(ws, "run_test", "app", "index.html"), "MODIFIED BY QA"); return "PARTIAL\nNEEDS_CHANGES: app/index.html needs a login stub"; });
    const w = world(), ctx = { store: w.store, runner, defs, sessionCap: 5 }, qd = defs.get("qa-reviewer")!, q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, role: "qa-reviewer", session_arg: "new", ...o });
    const g1 = granted(agentCall(w.store, w.d, w.policy, q({ objective: "check the login flow with a fake user" }))); const r1 = await runCallee(ctx, w.policy, g1, q({ objective: "check the login flow with a fake user" }), qd, { cwd: ws, writerMode: "worktree" });
    const realAfter = readFileSync(join(ws, "run_test", "app", "index.html"), "utf8"), copyGone = !!seen && !existsSync((seen as { cwd: string }).cwd);
    mode = "real"; const g2 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: g1.agent.agent_id, objective: "check again" }))); const r2 = await runCallee(ctx, w.policy, g2, q({ session_arg: g1.agent.agent_id, objective: "check again" }), qd, { cwd: ws, writerMode: "worktree" });
    t("CX29", "the QA agent runs in a THROWAWAY COPY of run_test/ (a different folder, it sees the real files, HARNESS_REAL_CWD points back at the real workspace), edits there freely, the copy is deleted afterwards, the real project is unchanged, no patch is registered, its NEEDS_CHANGES: reaches the parent; if it touches the REAL project anyway that is flagged as a violation",
      !!seen && (seen as { cwd: string }).cwd !== ws && (seen as { real?: string }).real === ws && (seen as { scratch?: string }).scratch === "1" && (seen as { sawFile: string }).sawFile === "REAL" && copyGone && realAfter === "REAL" && w.store.patches.length === 0 && r1.violations.length === 0 && /NEEDS_CHANGES: app\/index\.html/.test(r1.reply) && r2.violations.length === 1 && /REAL project/.test(r2.violations[0]!), JSON.stringify([realAfter, copyGone, w.store.patches.length, r1.violations, r2.violations])); }
  // a builder's VERIFIED block goes into the project's memory (QA skips it, the master sees it); NOT VERIFIED stays out of it
  { const ws = mkdtempSyncSafe(); mkdirSync(join(ws, "run_test", "app"), { recursive: true }); writeFileSync(join(ws, "run_test", "app", "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    const runner = new ScriptRunner(async () => "Built the page.\n\nVERIFIED:\n- pnpm exec tsc --noEmit: 0 errors\n- opened the page in a browser: no console errors, 12 stops\nNOT VERIFIED: the video, the French captions"), w = world(), ctx = { store: w.store, runner, defs, sessionCap: 5 }, bd = defs.get("builder")!;
    const wr = ["run_test/app/index.html"], q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, role: "builder", session_arg: "new", writes: wr, ...o });
    const g = granted(agentCall(w.store, w.d, w.policy, q({ objective: "build the landing page of the app" }))); await runCallee(ctx, w.policy, g, q({ objective: "build the landing page of the app" }), bd, { cwd: ws, writerMode: "shared" });
    const rows = readRows(join(ws, "run_test", "app")), vr = rows.find((r) => r.kind === "builder"), mb = memoryBlock(join(ws, "run_test"));
    t("CX30", "a builder's VERIFIED: block is stored in the project's memory (kind builder, who said it), shown to every agent ('builder ... verified: tsc ..., opened the page ...'), and is never a QA verdict (it has no verdict); what it listed as NOT VERIFIED is not claimed",
      !!vr && /tsc --noEmit: 0 errors/.test(vr.note ?? "") && /12 stops/.test(vr.note ?? "") && !/French captions/.test(vr.note ?? "") && /builder builder#1 verified: .*tsc/.test(mb) && rows.every((r) => r.kind === "builder") && existsSync(join(ws, "run_test", "app", ".loopsAI", "config.json")), JSON.stringify([vr?.note, mb.slice(0, 200)])); }
  { const slow = new ScriptRunner(async () => { await sleep(300); return "late"; });
    const w = world(), ctx = { store: w.store, runner: slow, defs, sessionCap: 3 }, res = defs.get("researcher")!;
    const r1 = granted(agentCall(w.store, w.d, w.policy, base)); r1.agent.session_id = "OLD";
    const p = runCallee(ctx, w.policy, r1, base, res, { cwd: tmpdir(), writerMode: "shared" }); await sleep(30);
    const rows = stopAgent(w.store, "t", "researcher#1"); const out = await p;
    t("M7e", "agent_stop: the instance goes idle at once, its late result is discarded (stopped), its older session is kept, the call row says stopped",
      rows.length === 1 && !out.ok && out.error === "stopped" && st(r1.agent) === "idle" && r1.agent.session_id === "OLD" && w.store.calls[0]!.reason === "stopped", `${out.error} ${r1.agent.status}`);
    const w2 = world(); const b = granted(call(w2, { role: "builder", writes: ["a"] })); b.agent.status = "running";
    const rv = granted(agentCall(w2.store, w2.d, w2.policy, { ...base, caller_agent_id: "builder#1", role: "researcher" })); rv.agent.status = "running";
    stopAgent(w2.store, "t", "builder#1");
    t("M7f", "stop cascades down the call tree (builder -> its researcher)", st(b.agent) === "idle" && st(rv.agent) === "idle", "");
    const w3 = world(); const r = granted(call(w3)); r.agent.status = "running"; r.agent.last_event_at = Date.now() - 60_000;
    t("M7g", "a running agent with no events for the stall time is marked stalled (the lead is told on its next resume)", markStalled(w3.store, Date.now(), 30_000).length === 1 && st(r.agent) === "stalled", ""); }

  setSuite("offline: writers end to end (queue, worktree, patch, promote)");
  { const repo = mkRepo({ "a.txt": "A1\nA2\nA3\n" }), w = world(), builder = defs.get("builder")!;
    const runner = new ScriptRunner((c: RunCall) => { const f = join(c.cwd, "a.txt"); writeFileSync(f, readFileSync(f, "utf8").replace("A2", c.row.agent_id === "builder#1" ? "B1-A2" : "B2-A2")); return "edited"; });
    const ctx = { store: w.store, runner, defs, sessionCap: 3 };
    const q: CallReq = { ...base, role: "builder", writes: ["a.txt"] };
    const r1 = granted(agentCall(w.store, w.d, w.policy, q)), r2 = granted(agentCall(w.store, w.d, w.policy, q));
    t("M8a", "the second writer of the same file is granted but QUEUED (position 1, behind builder#1) and does not run", !r1.queued && !!r2.queued && r2.queued.position === 1 && r2.queued.heldBy[0] === "builder#1", JSON.stringify(r2.queued));
    const o1 = await runCallee(ctx, w.policy, r1, q, builder, { cwd: repo, writerMode: "worktree" });
    t("M8b", "builder#1 ran in its own worktree and returned a patch; its locks were released and the waiter promoted (event)", o1.ok && !!o1.patch_id && w.store.locks.some((l) => l.agent_id === "builder#2") && w.store.evs("lock.promoted").length === 1 && runner.calls[0]!.cwd !== repo, `${o1.patch_id} locks=${w.store.locks.map((l) => l.agent_id)}`);
    const a1 = applyQueue(w.store, repo, "t");
    execFileSync("git", ["-C", repo, "-c", "user.name=h", "-c", "user.email=h@h", "commit", "-qam", "apply builder#1"]);
    const o2 = await runCallee(ctx, w.policy, r2, q, builder, { cwd: repo, writerMode: "worktree" });   // promoted writer now runs, branching from the NEW head
    const a2 = applyQueue(w.store, repo, "t");
    t("M8c", "serial queue with a commit between: the second writer branches from the new head, so its patch applies on top (final file has both edits)", o2.ok && a1.applied.length === 1 && a2.applied.length === 1 && readFileSync(join(repo, "a.txt"), "utf8").includes("B1-B2-A2"), readFileSync(join(repo, "a.txt"), "utf8").replace(/\n/g, "|"));
    t("M8d", "no locks or waiters are left behind", w.store.locks.length === 0 && w.store.waiters.length === 0, "");
    rm(repo); }

  setSuite("offline: the lead's tools as a command (tools.ts, fake runner, separate process)");
  { const dir = mkdtempSyncSafe(), file = join(dir, "store.json"), s = new MStore(file);
    const lead = s.addAgent("t", defs.get("lead")!, { level: 1 }); lead.status = "running"; s.save();
    const run = (args: string[], env: Record<string, string> = {}) => { const r = spawnSync("bun", [join(HARNESS_DIR, "tools.ts"), ...args], { encoding: "utf8", env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", ...env } }); try { return JSON.parse(r.stdout.trim().split("\n").pop()!); } catch { return { raw: r.stdout + r.stderr }; } };
    const F = ["--objective", "o", "--output", "x", "--boundaries", "b"];
    const n1 = run(["delegate", "--role", "researcher", "--session", "new", ...F]), n2 = run(["delegate", "--role", "researcher", "--session", "new", ...F]);
    const cont = run(["delegate", "--role", "researcher", "--session", "researcher#1", ...F]);
    const nos = run(["delegate", "--role", "researcher", ...F]), off = run(["delegate", "--role", "researcher", "--session", "new", ...F], { HARNESS_MAX_DEPTH: "1" });
    t("M9a", "delegate via the command: new -> researcher#1, new -> researcher#2, then continue researcher#1 (session resume, same row)", n1.agent_id === "researcher#1" && n2.agent_id === "researcher#2" && cont.agent_id === "researcher#1" && cont.mode === "resumed" && n1.ok, JSON.stringify([n1, cont]).slice(0, 240));
    t("M9b", "a call without --session is refused with the reason; with multi-agent off it says so", nos.ok === false && nos.reason.includes("session_required") && off.ok === false && off.reason.includes("multi-agent is off"), `${nos.reason} | ${off.reason}`);
    const upd = run(["agent_update", "--agent", "researcher#2", "--title", "T".repeat(200), "--description", "owns the storage question"]);
    const lst = run(["agents_list"]), bad = run(["say", "--to", "ghost#1", "--text", "hi"]), good = run(["say", "--to", "researcher#2", "--text", "check xyz too"]);
    t("M9c", "agent_update edits title/description (title capped at 80); agents_list shows ids, status, resume counts; say to an unknown agent is refused", upd.title.length === 80 && lst.length === 3 && lst.find((a: { agent_id: string }) => a.agent_id === "researcher#1").resume_count === 1 && bad.ok === false && good.ok === true, JSON.stringify(lst.map((a: { agent_id: string; status: string }) => [a.agent_id, a.status])));
    const fresh = new MStore(file);
    t("M9d", "everything was written to the shared registry file by the child processes (rows, calls, reports, notes)", fresh.agentsOf("t").length === 3 && fresh.calls.filter((c) => c.status === "denied").length === 2 && fresh.reports.length === 3 && fresh.notes.length === 1, `agents=${fresh.agentsOf("t").length} calls=${fresh.calls.length}`);
    const tr = trace.renderTree(fresh, "t"), calls = trace.renderCalls(fresh, "t");
    t("M9e", "navigate a task: the tree shows the lead with its researchers nested under it (resume counts, sessions); the calls view shows who called whom, level, session arg, and the denied ones with reasons",
      /lead#1 \[lead\].*\n(├─|└─) researcher#1 \[researcher\] L2.*resumed=1x/.test(tr) && tr.includes("researcher#2") && calls.includes("lead#1 -> researcher#1 role=researcher L2 session=new done") && calls.includes("denied (session_required") && calls.includes("depth_exceeded"), tr + "\n" + calls);
    const mainCli = spawnSync("bun", [join(HARNESS_DIR, "main.ts"), "tree", "--store", file, "--task", "t"], { encoding: "utf8" }).stdout;
    t("M9f", "the same tree from the command line on the shared store file", mainCli.includes("researcher#2"), mainCli);
    rm(dir); }
}

/** Run `fn`; report whether it threw an InvariantViolation of this rule (a negative case must CRASH, not be handled). */
async function crashes(rule: string, fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch (e) { return e instanceof InvariantViolation && e.rule === rule; }
}
async function offlineSafety() {
  setSuite("offline: session persistence, fail-fast invariants (negative cases must CRASH), registry rules, watchdog, live log");
  const res = defs.get("researcher")!, q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, ...o });
  const run = async (w: W, rn: { run: (c: RunCall) => Promise<any>; calls?: RunCall[] }, k: Partial<CallReq>, extra: { transcriptExists?: (cwd: string, id: string) => boolean; sessionCap?: number } = {}) => {
    const r = granted(agentCall(w.store, w.d, w.policy, q(k)));
    return runCallee({ store: w.store, runner: rn as never, defs, sessionCap: extra.sessionCap ?? 3, transcriptExists: extra.transcriptExists, canary: undefined }, w.policy, r, q(k), res, { cwd: tmpdir(), writerMode: "shared" });
  };
  // S1/S2: the session file is gone but the caller asked to CONTINUE
  { const w = world(); w.store.strict = true; const rn = new ScriptRunner(() => "ok");
    await run(w, rn, {});
    const crashed = await crashes("resume_lost_session", () => run(w, rn, { session_arg: "researcher#1" }, { transcriptExists: () => false }));
    t("S1", "STRICT: asked to continue researcher#1 but its session is gone -> the run CRASHES with resume_lost_session at the call (nothing runs on a blank session); the event is on record and the agent is left idle", crashed && w.store.violations().length === 1 && w.store.agent("t", "researcher#1")!.status === "idle" && rn.calls.length === 1, `violations=${w.store.violations().length} calls=${rn.calls.length}`);
    const w2 = world(); const rn2 = new ScriptRunner(() => "ok"); await run(w2, rn2, {});
    await run(w2, rn2, { session_arg: "researcher#1" }, { transcriptExists: () => false });
    t("S2", "NOT strict: the same loss is still recorded as an error event (never silent), and the run carries on in a new session", w2.store.violations().length === 1 && w2.store.violations()[0]!.data!.rule === "resume_lost_session" && w2.store.evs("session.rolled").length === 1, ""); }
  // S3/S4: the memory canary
  { const mk = (forget: boolean) => { let code = ""; return new ScriptRunner((c: RunCall) => { const m = c.prompt.match(/SESSION CODE: (W-\w+)/); if (m) code = m[1]!; return forget && c.session.resume ? "I think it was blue" : `${code} fine`; }); };
    const good = world(), rg = mk(false); const cg = { store: good.store, runner: rg, defs, sessionCap: 3, canary: true };
    for (const k of [{}, { session_arg: "researcher#1" }, { session_arg: "researcher#1" }]) { const r = granted(agentCall(good.store, good.d, good.policy, q(k))); await runCallee(cg, good.policy, r, q(k), res, { cwd: tmpdir(), writerMode: "shared" }); }
    t("S3", "canary: the code is told in the first brief only, asked for on every resume, and a session that remembers passes", rg.calls[0]!.prompt.includes("SESSION CODE: " + canaryFor("t", "researcher#1")) && rg.calls[1]!.prompt.includes("Begin your reply with your SESSION CODE") && !rg.calls[1]!.prompt.includes("SESSION CODE: W-") && good.store.violations().length === 0, rg.calls[1]!.prompt.slice(-140));
    const bad = world(); bad.store.strict = true; const rb = mk(true), cb = { store: bad.store, runner: rb, defs, sessionCap: 3, canary: true };
    const r1 = granted(agentCall(bad.store, bad.d, bad.policy, q())); await runCallee(cb, bad.policy, r1, q(), res, { cwd: tmpdir(), writerMode: "shared" });
    const r2 = granted(agentCall(bad.store, bad.d, bad.policy, q({ session_arg: "researcher#1" })));
    t("S4", "STRICT canary: a resumed agent that does NOT recall its code (a silent reset the file checks cannot see) CRASHES the run with memory_lost", await crashes("memory_lost", () => runCallee(cb, bad.policy, r2, q({ session_arg: "researcher#1" }), res, { cwd: tmpdir(), writerMode: "shared" })), `violations=${bad.store.violations().map((v) => v.data!.rule)}`); }
  // S5: the CLI answers with a different session id than the one resumed
  { const w = world(); w.store.strict = true; await run(w, new ScriptRunner(() => "ok"), {});
    const liar = { calls: [] as RunCall[], async run(c: RunCall) { return { reply: "ok", session_id: "not-the-one", cost: 0, ok: true }; } };
    t("S5", "STRICT: a resume that comes back under a DIFFERENT session id crashes with session_id_mismatch", await crashes("session_id_mismatch", () => run(w, liar, { session_arg: "researcher#1" })), ""); }
  // S6: registry rules
  { const w = world(); const a = w.store.addAgent("t", res, { level: 2, caller: "lead#1" }), b = w.store.addAgent("t", res, { level: 2, caller: "lead#1" });
    a.session_id = b.session_id = "SAME-SESSION-ID"; const bd = w.store.addAgent("t", defs.get("builder")!, { level: 2, caller: "lead#1" }); bd.status = "running"; bd.activity = "stuck";
    w.store.locks.push({ path: "src/**", task_id: "t", agent_id: "builder#1", call_id: "c1", expires: Date.now() + 1e6 }, { path: "src/a.ts", task_id: "t", agent_id: "builder#2", call_id: "c2", expires: Date.now() + 1e6 });
    w.store.waiters.push({ id: "w", task_id: "t", agent_id: "x", call_id: "ghost", paths: ["z"], t: 1 }); a.level = 7;
    const rules = checkRegistry(w.store, "t", { expectIdle: true }).map((p) => p.rule);
    t("S6", "registry rules catch: shared session, depth over 4, lock overlap, lock left after the work, orphan waiter, an agent left running", ["session_shared", "depth_over_limit", "lock_overlap", "lock_leak", "orphan_waiter", "agent_left_running"].every((r) => rules.includes(r)), rules.join());
    const clean = world(); t("S6b", "and a healthy registry reports nothing", checkRegistry(clean.store, "t", { expectIdle: false }).length === 0, "");
    w.store.strict = true; let thrown = false; try { assertRegistry(w.store, "t"); } catch (e) { thrown = e instanceof InvariantViolation; }
    t("S6c", "STRICT: assertRegistry crashes on the first problem it finds", thrown && w.store.violations().length === 1, ""); }
  // S7: watchdog + abort flag
  { const dir = mkdtempSyncSafe(), f = join(dir, "s.json"), st = new MStore(f); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.save();
    let killed = 0; const t0 = Date.now(); let firedAt = 0;
    const wd = startWatchdog(f, { runners: [{ run: async () => ({ reply: "", session_id: "", cost: 0, ok: true }), killAll: () => killed++ }], ms: 100, onViolation: () => { firedAt = Date.now(); } });
    const other = new BaseStore(f); other.ev("invariant.violation", "t", "researcher#1", { rule: "memory_lost" });   // another process breaks a rule
    await new Promise((r) => setTimeout(r, 700)); wd.stop();
    const after = agentCall(new MStore(f), defs, defaultPolicy({ agentMaxDepth: 4 }), q({}));
    t("S7", "watchdog: a rule broken in ANOTHER process is seen within a second, every claude process is killed, the abort flag is written, and every new call is refused as 'aborted'", firedAt > 0 && firedAt - t0 < 1000 && killed === 1 && !after.ok && after.code === "aborted" && !!new MStore(f).aborted(), `fired after ${firedAt - t0} ms, killed=${killed}, next call: ${after.ok ? "granted" : after.code}`);
    const rn = new ScriptRunner(() => "x"), ctxA = { store: new MStore(f), runner: rn, defs, sessionCap: 3 };
    const row = ctxA.store.agent("t", "lead#1")!; const out = await callAgent(ctxA, row, tmpdir(), () => "p");
    t("S7b", "and even a call already past the permission check does not start once the flag is set", !out.ok && String(out.error).startsWith("aborted") && rn.calls.length === 0, String(out.error)); rm(dir); }
  // S8: the live log
  { const dir = mkdtempSyncSafe(), lf = join(dir, "run.jsonl"), st = new MStore(join(dir, "s.json")); st.logFile = lf;
    st.ev("task.start", "t"); st.ev("session.rolled", "t", "a#1", { reason: "full" }); st.ev("agent.failed", "t", "a#1", { error: "boom" }); try { st.strict = false; st.violation("x", "t", "a#1", { why: "test" }); } catch { /* not strict */ }
    const lines = readFileSync(lf, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    t("S8", "the live log: one JSON line per event the moment it happens, with a level (info / warn / error), so a crashed run still shows how far it got", lines.length === 4 && lines.map((l) => l.level).join() === "info,warn,error,error" && lines.every((l) => l.ts && l.kind), lines.map((l) => l.level + ":" + l.kind).join(" "));
    const cli = spawnSync("bun", [join(HARNESS_DIR, "main.ts"), "watch", "--log", lf], { encoding: "utf8", timeout: 8000 });
    t("S8b", "`main.ts watch --log` prints the lines live and EXITS 2 at the first broken rule (use it next to a long run)", cli.status === 2 && /ERROR\s+invariant.violation/.test(cli.stdout) && cli.stdout.includes("STOP"), cli.stdout.slice(-200)); rm(dir); }
}

async function offlineRecords() {
  setSuite("offline: what is stored per agent (so nothing is lost and any agent can look at its sub-agents)");
  const w = world(); w.lead.session_id = "LEAD-SESSION-1"; const rn = new ScriptRunner(() => "A".repeat(5000) + " END"), res = defs.get("researcher")!;
  const ctx = { store: w.store, runner: rn, defs, sessionCap: 3 }, q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, ...o });
  const r1 = granted(agentCall(w.store, w.d, w.policy, q())); await runCallee(ctx, w.policy, r1, q(), res, { cwd: "/work/a", writerMode: "shared" });
  const a = w.store.agent("t", "researcher#1")!, rep = w.store.reports.find((x) => x.agent_id === "researcher#1")!;
  t("D1", "the agent row keeps: its Claude session id and the folder it was created in, when its last call started and finished, the FULL final response (not cut at 2000), how many runs, the call that ran last, and where it came from (parent type + the parent's session id)",
    !!a.session_id && a.cwd === "/work/a" && !!a.started_at && !!a.finished_at && a.finished_at >= a.started_at && a.final_response!.length === 5004 && a.runs === 1 && a.last_call_id === r1.call_id && a.parent_type === "call" && a.parent_session_id === "LEAD-SESSION-1" && a.caller_agent_id === "lead#1" && rep.reply!.length === 5004 && rep.summary.length === 2000, JSON.stringify({ ...a, final_response: a.final_response!.length + " chars" }).slice(0, 500));
  const f = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "fork:researcher#1" }))); await runCallee(ctx, w.policy, f, q({ session_arg: "fork:researcher#1" }), res, { cwd: "/work/b", writerMode: "shared" });
  const fk = w.store.agent("t", "researcher#2")!;
  t("D2", "a fork records parent_type 'fork', the parent agent AND the parent's session id (so the branch point is known and the source can still be continued)", fk.parent_type === "fork" && fk.parent_agent_id === "researcher#1" && fk.parent_session_id === a.session_id && fk.session_id !== a.session_id, `${fk.parent_type} ${fk.parent_agent_id} ${fk.parent_session_id?.slice(0, 6)} -> ${fk.session_id?.slice(0, 6)}`);
  const dir = mkdtempSyncSafe(), file = join(dir, "s.json"), st = new MStore(file); const lead = st.addAgent("t", defs.get("lead")!, { level: 1, type: "root" }); lead.status = "running"; lead.session_id = "LEAD-SESSION-2"; st.save();
  const tool = (args: string[]) => JSON.parse(spawnSync("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), ...args], { encoding: "utf8", env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake" } }).stdout.trim().split("\n").pop()!);
  tool(["delegate", "--role", "researcher", "--session", "new", "--objective", "find the thing", "--output", "x", "--boundaries", "b"]);
  const info = tool(["agent_info", "--agent", "researcher#1"]), leadInfo = tool(["agent_info", "--agent", "lead#1"]), list = tool(["agents_list"]);
  t("D3", "an agent can look at any agent from another process: agent_info gives its session, parent, timestamps, final answer, who called it and what it called; the lead's info lists its sub-agents; agents_list carries session ids and parent types",
    info.session.id && info.session.parent_type === "call" && info.session.parent_session_id === "LEAD-SESSION-2" && info.session.called_by === "lead#1" && /FAKE REPLY/.test(info.final_response) && !!info.finished_at && info.calls_received[0].startsWith("lead#1 new done")
      && leadInfo.sub_agents.map((x: any) => x.agent_id).join() === "researcher#1" && leadInfo.calls_made[0].startsWith("researcher#1 done") && list.find((x: any) => x.agent_id === "researcher#1").parent_type === "call" && !!list.find((x: any) => x.agent_id === "researcher#1").session_id, JSON.stringify(info).slice(0, 400));
  const again = new MStore(file).agent("t", "researcher#1")!;
  t("D4", "and it is all on disk, not in memory: a brand new process reading the file sees the same session id, folder, final response and parent", again.session_id === info.session.id && !!again.final_response && again.parent_type === "call" && again.cwd === dir, ""); rm(dir);
}

async function offlineLocksAndPlans() {
  setSuite("offline: named resource locks (@git, @migrations, @tests) and the work-splitting plan");
  const { spawn } = await import("node:child_process");
  // ---- resources
  const cases: [string, string[]][] = [["git commit -m x", ["@git"]], ["git add -A && git commit -qm y", ["@git"]], ["git status", []], ["git diff HEAD", []], ["git log --oneline", []], ["bun run db:migrate", ["@migrations"]], ["npx drizzle-kit migrate", ["@migrations"]], ["bunx vitest run", ["@tests"]], ["npm test", ["@tests"]], ["playwright test", ["@tests"]], ["bun run db:migrate && bun run test", ["@migrations", "@tests"]], ["ls -la", []], ["cat package.json", []]];
  const wrong = cases.filter(([c, want]) => resourcesFor(c).join() !== want.join());
  t("L1", "shell commands are classified into resource families (git writes, migrations, test runs); read-only git and plain commands need none", wrong.length === 0, wrong.map(([c]) => c + " -> " + resourcesFor(c)).join(" | "));
  t("L2", "a resource conflicts only with the SAME name (@git does not clash with @github, a path, or another resource)", overlaps("@git", "@git") && !overlaps("@git", "@github") && !overlaps("@git", "src/**") && !overlaps("@migrations", "@tests"), "");
  { const st = new MStore(); const G = (ag: string) => guardResource(st, "t", ag, "@migrations", 1000);
    const nd = G("builder#1"); acquire(st, { task_id: "t", agent_id: "builder#1", call_id: "c1", paths: ["@migrations", "db/**"], ttlMs: 5000, now: 1000 });
    const mine = G("builder#1"), other = G("builder#2");
    release(st, "c1", 5000, 1000); const free = G("builder#2");
    t("L3", "the resource guard: not declared -> NOT DECLARED; holder -> allowed; another agent -> LOCKED naming the holder; after release it is NOT DECLARED again (it must declare to get it)", !nd.allow && nd.reason.startsWith("NOT DECLARED") && mine.allow && !other.allow && other.reason.startsWith("LOCKED") && other.reason.includes("builder#1") && !free.allow && free.reason.startsWith("NOT DECLARED"), `${other.allow ? "" : other.reason}`); }
  { const w = world(); const q2 = (o: Partial<CallReq> = {}): CallReq => ({ ...base, role: "builder", writes: ["db/**", "@migrations"], ...o });
    const a = granted(agentCall(w.store, w.d, w.policy, q2())), b = granted(agentCall(w.store, w.d, w.policy, q2({ writes: ["web.css", "@migrations"] })));
    const rev = call(w, { role: "qa-reviewer", writes: ["@tests"] }), revFile = call(w, { role: "qa-reviewer", writes: ["src/a.ts"] });   // f1 test was stale: the "reviewer" agent became "qa-reviewer"
    t("L4", "two writers that both need @migrations: the second is queued behind the first even though their files differ; a read-only reviewer may hold @tests but never a FILE lock",
      !a.queued && !!b.queued && b.queued.heldBy[0] === a.agent.agent_id && rev.ok && !revFile.ok && revFile.code === "readonly_declared_writes", `queued=${JSON.stringify(b.queued)} reviewer=${code(rev)} file=${code(revFile)}`);
    const granted2 = release(w.store, a.call_id, 5000, Date.now());
    t("L4b", "when the first finishes, the waiting writer is promoted and holds @migrations (one at a time, in arrival order)", granted2.includes(b.call_id) && w.store.locks.some((l) => l.path === "@migrations" && l.agent_id === b.agent.agent_id), ""); }
  { const dir = mkdtempSyncSafe(), f = join(dir, "s.json"), st = new MStore(f);
    st.addAgent("t", defs.get("builder")!, { level: 2 }); st.addAgent("t", defs.get("builder")!, { level: 2 });
    acquire(st, { task_id: "t", agent_id: "builder#2", call_id: "c2", paths: ["@git", "docs/**"], ttlMs: 600_000, now: Date.now() });
    acquire(st, { task_id: "t", agent_id: "builder#1", call_id: "c1", paths: ["@tests", "src/**"], ttlMs: 600_000, now: Date.now() }); st.save();
    const hook = (agent: string, tool: string, input: object) => spawnSync("bun", [join(HARNESS_DIR, "hooks", "guard.ts")], { input: JSON.stringify({ tool_name: tool, tool_input: input }), encoding: "utf8", env: { ...process.env, HARNESS_STORE: f, HARNESS_TASK: "t", HARNESS_AGENT: agent, HARNESS_CWD: dir } }).stdout.trim();
    const dec = (o: string) => (o ? JSON.parse(o).hookSpecificOutput.permissionDecisionReason as string : "ALLOW");
    const r = { notDeclared: dec(hook("builder#1", "Bash", { command: "git commit -m x" })), other: dec(hook("builder#1", "Bash", { command: "git add -A" })), tests: dec(hook("builder#1", "Bash", { command: "bunx vitest run" })), readOnlyGit: dec(hook("builder#1", "Bash", { command: "git status" })), plain: dec(hook("builder#1", "Bash", { command: "ls" })), holderGit: dec(hook("builder#2", "Bash", { command: "git commit -qm z" })), fileOther: dec(hook("builder#1", "Write", { file_path: join(dir, "docs/a.md") })), fileMine: dec(hook("builder#1", "Write", { file_path: join(dir, "src/a.ts") })) };
    t("L5", "the REAL hook process on shell commands: git by someone who did not declare @git -> LOCKED (held by builder#2); the holder may; tests by the holder may; read-only git and plain commands always; the file locks still work",
      r.notDeclared.startsWith("LOCKED") && r.notDeclared.includes("builder#2") && r.other.startsWith("LOCKED") && r.tests === "ALLOW" && r.readOnlyGit === "ALLOW" && r.plain === "ALLOW" && r.holderGit === "ALLOW" && r.fileOther.startsWith("LOCKED") && r.fileMine === "ALLOW", JSON.stringify(r).slice(0, 600));
    const bare = new MStore(join(dir, "b.json")); bare.addAgent("t", defs.get("builder")!, { level: 2 }); bare.save();
    const nd = spawnSync("bun", [join(HARNESS_DIR, "hooks", "guard.ts")], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "bun run db:migrate" } }), encoding: "utf8", env: { ...process.env, HARNESS_STORE: join(dir, "b.json"), HARNESS_TASK: "t", HARNESS_AGENT: "builder#1", HARNESS_CWD: dir } }).stdout;
    t("L5b", "a migration command from an agent that never declared @migrations is denied with NOT DECLARED and what to do", /NOT DECLARED[^"]*@migrations/.test(nd), nd.slice(0, 200));
    const tool = (args: string[], env: Record<string, string> = {}) => spawnSync("bun", [join(HARNESS_DIR, "tools.ts"), ...args], { encoding: "utf8", env: { ...process.env, HARNESS_STORE: f, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", ...env } }).stdout.trim().split("\n").pop()!;
    const blocked = JSON.parse(tool(["apply_patches"]));
    t("L6", "apply_patches (put finished files into the project and commit) refuses while an agent holds @git, and says who", blocked.ok === false && blocked.blocked === "builder#2" && /@git is held by builder#2/.test(blocked.reason), JSON.stringify(blocked));
    rm(dir); }
  // ---- plans
  const T = (id: string, role: string, o: Partial<PlanTask> = {}): PlanTask => ({ id, role, objective: "do " + id + " unique " + Math.random().toString(36).slice(2), output: "3 bullets", boundaries: "stay inside", ...(role === "builder" ? { writes: [id + ".html"] } : {}), ...o });
  const good = (): PlanTask[] => [T("r1", "researcher"), T("r2", "researcher"), T("r3", "researcher"), T("b1", "builder", { deps: ["r1"] }), T("b2", "builder", { deps: ["r2"] }), T("b3", "builder", { deps: ["r3"] })];
  const pol = defaultPolicy({ agentMaxDepth: 4, maxInstancesPerRole: 6 });
  const v = validatePlan(good(), defs, "lead", pol);
  t("P1", "a good split validates and the waves are computed: three researchers in parallel, then three builders in parallel", v.ok && v.waves.length === 2 && v.waves[0]!.join() === "r1,r2,r3" && v.waves[1]!.join() === "b1,b2,b3", JSON.stringify(v));
  const neg: [string, (p: PlanTask[]) => PlanTask[], RegExp][] = [
    ["empty plan", () => [], /no tasks/], ["duplicate id", (p) => [...p, T("r1", "researcher")], /duplicate task id/], ["unknown role", (p) => [...p, T("x1", "wizard")], /unknown role/],
    ["role the lead may not call", (p) => [...p, T("x1", "lead")], /may not call/], ["empty objective", (p) => [...p, T("x1", "researcher", { objective: " " })], /objective is empty/],
    ["unknown dependency", (p) => [...p, T("x1", "researcher", { deps: ["nope"] })], /unknown task "nope"/], ["self dependency", (p) => [...p, T("x1", "researcher", { deps: ["x1"] })], /depends on itself/],
    ["cycle", (p) => { p[0]!.deps = ["b1"]; return p; }, /dependency cycle/], ["writer without files", (p) => { p[3]!.writes = []; return p; }, /must list the files/],
    ["reader with files", (p) => { p[0]!.writes = ["a.txt"]; return p; }, /read-only and cannot have writes/],
    ["same work twice", (p) => [...p, T("r4", "researcher", { objective: p[0]!.objective })], /same work given twice/],
    ["writers on the same file at once", (p) => { p[4]!.writes = ["b1.html"]; return p; }, /write the same files at the same time/],
    ["two writers both need @migrations at once", (p) => { p[3]!.writes = ["b1.html", "@migrations"]; p[4]!.writes = ["b2.html", "@migrations"]; return p; }, /write the same files at the same time/],
    ["a wave wider than 4", (p) => [...p, T("r4", "researcher"), T("r5", "researcher")], /at once \(limit 4\)/], ["a session that is not an agent", (p) => [...p, T("x1", "researcher", { session: "researcher#9" })], /not an agent of this task/],
    ["too many new agents of one role", (p) => [...p, ...Array.from({ length: 4 }, (_, i) => T("y" + i, "researcher", { deps: ["b1"] }))], /exceed the limit/]];
  const fails: string[] = []; for (const [name, mut, re] of neg) { const r = validatePlan(mut(good()), defs, "lead", pol); if (r.ok || !r.errors.some((e) => re.test(e))) fails.push(name + (r.ok ? " (ACCEPTED)" : " -> " + r.errors.join("; "))); }
  t("P2", `${neg.length} bad splits are REJECTED up front, each with its specific reason (empty, duplicate id, unknown/uncallable role, missing fields, bad deps, cycle, writer/reader file rules, duplicate work, same-file or same-resource writers in one wave, too wide, bad session, too many agents)`, fails.length === 0, fails.join("\n"));
  // ---- execution through the real command, fake agents with a delay
  const dir = mkdtempSyncSafe(), file = join(dir, "s.json"); { const st = new MStore(file); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.save(); }
  const tool = (args: string[], env: Record<string, string> = {}) => new Promise<any>((res) => { const p = spawn("bun", [join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", HARNESS_MAX_INSTANCES: "8", HARNESS_FAKE_DELAY_MS: "800", ...env } }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
  const rej = await tool(["plan_submit", "--tasks", JSON.stringify([T("a", "researcher", { deps: ["b"] }), T("b", "researcher", { deps: ["a"] })])]);
  t("P3", "a rejected plan through the command: ok:false with the reasons; nothing is stored and no agent exists", rej.ok === false && rej.errors.length >= 1 && new MStore(file).plans.length === 0 && new MStore(file).agentsOf("t").length === 1 && new MStore(file).evs("plan.rejected").length === 1, JSON.stringify(rej).slice(0, 200));
  const t0 = Date.now(), sub = await tool(["plan_submit", "--tasks", JSON.stringify(good())]);
  const started = await tool(["plan_run", "--plan", sub.plan_id]);
  const st = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "30"]), wall = Date.now() - t0;
  const fin = new MStore(file), calls = fin.calls.filter((c) => c.status === "done"), b1 = calls.find((c) => c.role === "builder" && (c.req as any)?.writes?.[0] === "b1.html");
  const obj = String((b1?.req as any)?.objective ?? "");
  t("P4", "a plan runs by itself: two waves of three tasks finish in about two task-times (not six), every task done, and the plan is marked done", sub.ok && started.started && st.status === "done" && st.tasks.every((x: any) => x.status === "done") && wall < 4200, `wall ${wall} ms (sequential would be >= 4800); status ${st.status}`);
  t("P5", "each task receives the answers of the tasks it depends on (by reference to the ledger) and ONLY those: b1 sees r1, not r2 or r3", /RESULTS FROM THE TASKS YOU DEPEND ON/.test(obj) && /r1 \(researcher#1\)/.test(obj) && !/r2 \(/.test(obj) && !/r3 \(/.test(obj) && calls.length === 6, obj.slice(-300));
  const bad = good(); bad[1]!.objective += " FAILME"; const sub2 = await tool(["plan_submit", "--tasks", JSON.stringify(bad)]), st2 = await (async () => { await tool(["plan_run", "--plan", sub2.plan_id]); return settle(tool, sub2.plan_id); })();
  const by = (id: string) => st2.tasks.find((x: any) => x.id === id);
  t("P6", "when a task fails, its dependents are SKIPPED with the reason (nothing runs on missing facts), the other branches still finish, and the plan is marked failed", st2.status === "failed" && by("r2").status === "failed" && by("b2").status === "skipped" && /dependency r2/.test(by("b2").error) && by("b1").status === "done" && by("b3").status === "done", JSON.stringify(st2.tasks.map((x: any) => x.id + ":" + x.status)));
  rm(dir);
}

// ---------------------------------------------------------------------------- locks on two backends (file registry and Redis)
async function withRedis<T>(fn: (url: string) => Promise<T>): Promise<T | null> {
  const { spawn } = await import("node:child_process");
  const port = 6400 + Math.floor(Math.random() * 500), url = `redis://127.0.0.1:${port}`;
  const p = spawn("redis-server", ["--port", String(port), "--save", "", "--appendonly", "no", "--maxmemory", "100mb", "--loglevel", "warning"], { stdio: "ignore" });
  let spawnFailed = false; p.on("error", () => (spawnFailed = true));
  try {
    for (let i = 0; i < 60 && !spawnFailed; i++) { try { const L = RedisLocks.connect(url); await L.client.send("PING", []); L.close(); break; } catch { await sleep(100); } }
    if (spawnFailed) return null;
    return await fn(url);
  } finally { p.kill("SIGKILL"); }
}
async function parity(name: string, mk: () => LockApi) {
  const sleepMs = sleep, A = (api: LockApi, ag: string, call: string, paths: string[], ttlMs = 5000) => api.acquire({ task_id: "t", agent_id: ag, call_id: call, paths, ttlMs });
  { const api = mk();
    const a = await A(api, "A", "ca", ["src/a.ts", "src/b.ts"]), b = await A(api, "B", "cb", ["src/b.ts", "src/c.ts"]), c = await A(api, "C", "cc", ["src/c.ts"]);
    const held = (await api.holders("t")).map((h) => h.agent_id + ":" + h.path).sort().join();
    t(`K1[${name}]`, "all-or-none: B (b.ts+c.ts) queues at 1 behind A and holds NOTHING; C (c.ts only) queues behind B (fairness) even though c.ts is free", a.ok && !b.ok && b.position === 1 && b.heldBy.includes("A") && !c.ok && c.position === 2 && held === "A:src/a.ts,A:src/b.ts", held);
    const p1 = await api.release("t", "ca", 5000), h1 = (await api.holders("t")).map((h) => h.agent_id).sort().join();
    const p2 = await api.release("t", "cb", 5000);
    t(`K2[${name}]`, "release hands over in arrival order: A frees -> B (not C) gets b.ts+c.ts; B frees -> C gets c.ts", p1.join() === "cb" && h1 === "B,B" && p2.join() === "cc" && (await api.holders("t")).every((h) => h.agent_id === "C"), `${p1} ${h1} ${p2}`);
    await api.release("t", "cc", 5000); }
  { const api = mk(); const x = await A(api, "D1", "d1", ["x", "y"]), y = await A(api, "D2", "d2", ["y", "x"]);
    t(`K3[${name}]`, "no deadlock: {x,y} and {y,x} -> one gets both, the other waits holding nothing", x.ok && !y.ok && (await api.holders("t")).every((h) => h.agent_id === "D1"), ""); }
  { const api = mk(); const g1 = await A(api, "A", "c1", ["@git"]), g2 = await A(api, "B", "c2", ["@github"]), g3 = await A(api, "C", "c3", ["@git"]);
    t(`K4[${name}]`, "a resource name conflicts only with itself: @git and @github are held together, a second @git waits", g1.ok && g2.ok && !g3.ok, ""); }
  { const api = mk(); const a = await A(api, "A", "c1", ["src/a.ts"], 300), t0 = Date.now(); const early = await A(api, "B", "c2", ["src/a.ts"], 5000); await api.release("t", "c2", 5000);
    await sleepMs(450); const late = await A(api, "B", "c3", ["src/a.ts"], 5000), gA = await api.guard("t", "A", "src/a.ts");
    t(`K5[${name}]`, "TTL: a lock its holder stopped using lapses by itself (300 ms); another agent then claims it; the old holder is refused with LEASE EXPIRED, not silently allowed", a.ok && !early.ok && late.ok && !gA.allow && gA.reason.startsWith("LEASE EXPIRED"), `${Date.now() - t0} ms; ${gA.allow ? "" : gA.reason.slice(0, 60)}`); }
  { const api = mk(); await A(api, "A", "c1", ["src/a.ts"]); await A(api, "B", "c2", ["src/a.ts"]); const promoted = await api.release("t", "c1", 5000);
    const again = await A(api, "B", "c2", ["src/a.ts"]), third = await A(api, "C", "c3", ["src/a.ts"]), holders = (await api.holders("t")).map((h) => h.agent_id).join();
    t(`K12[${name}]`, "acquire is idempotent: a call that was promoted from the queue and asks again still holds the lock (it is NOT queued behind the others and left waiting for its lease to run out); a newcomer still waits", promoted.join() === "c2" && again.ok && !third.ok && holders === "B", `promoted=${promoted} again=${JSON.stringify(again)} holders=${holders}`); }
  { const api = mk(); await A(api, "A", "c1", ["src/a.ts"], 400); await sleepMs(250); await api.renew("t", "A", 400); await sleepMs(250); const stillA = await api.guard("t", "A", "src/a.ts", 400); const b = await A(api, "B", "c2", ["src/a.ts"]);
    t(`K6[${name}]`, "a working agent keeps its lock: renewals (and every allowed edit) push the lease out; the same lock without them would have lapsed at 400 ms", stillA.allow && !b.ok, ""); }
  { const api = mk(); await A(api, "A", "c1", ["src/**", "@tests"]);
    const mine = await api.guard("t", "A", "src/deep/f.ts"), res = await api.guard("t", "A", "@tests"), other = await api.guard("t", "B", "src/x.ts"), und = await api.guard("t", "A", "README.md"), otherRes = await api.guard("t", "B", "@tests");
    t(`K7[${name}]`, "the guard: holder allowed (glob + resource); another agent -> LOCKED naming the holder; outside the declaration -> NOT DECLARED", mine.allow && res.allow && !other.allow && other.reason.startsWith("LOCKED") && other.reason.includes("A") && !und.allow && und.reason.startsWith("NOT DECLARED") && !otherRes.allow && otherRes.reason.startsWith("LOCKED"), other.allow ? "" : other.reason); }
}
async function redisSuite() {
  setSuite("locks: file registry vs Redis (same cases on both), TTL, fail-closed hook, cross-process stress, end to end");
  await parity("file", () => new StoreLocks(new MStore()));
  const out = await withRedis(async (url) => {
    await parity("redis", () => locksFromEnv(new MStore(), { HARNESS_LOCKS_URL: url, HARNESS_LOCKS_PREFIX: "p" + Math.random().toString(36).slice(2, 8) }));
    // ---- cross-process stress: 12 processes want the same file; two may never be inside at once
    const { spawn } = await import("node:child_process"), L = RedisLocks.connect(url), c = L.client;
    await c.send("DEL", ["stress:active", "stress:violations", "stress:granted"]);
    const runBatch = (ids: number[]) => Promise.all(ids.map((i) => new Promise<void>((res) => { const p = spawn("bun", ["--smol", join(import.meta.dirname, "redis_worker.ts"), url, "stress", String(i), "60"], { stdio: "ignore" }); p.on("close", () => res()); })));
    const t0 = Date.now(); await runBatch([1, 2, 3, 4, 5, 6]); await runBatch([7, 8, 9, 10, 11, 12]);
    const viol = Number((await c.send("GET", ["stress:violations"])) ?? 0), granted = (await c.send("LRANGE", ["stress:granted", "0", "-1"])) as string[], left = await L.holders("stress");
    t("K8", "cross-process stress: 12 processes contending for ONE file are let in strictly one at a time (0 overlaps), all 12 get a turn, and nothing is left held", viol === 0 && new Set(granted).size === 12 && left.length === 0 && Date.now() - t0 >= 12 * 60 * 0.8, `violations=${viol} granted=${granted.length} held_after=${left.length} wall=${Date.now() - t0} ms`);
    L.close();
    // ---- the hook, as a real process, fails CLOSED and enforces on Redis
    const prefix = "h" + Math.random().toString(36).slice(2, 7), R = RedisLocks.connect(url, prefix);
    await R.acquire({ task_id: "t", agent_id: "builder#1", call_id: "c1", paths: ["src/**", "@tests"], ttlMs: 60_000 });
    await R.acquire({ task_id: "t", agent_id: "builder#3", call_id: "c3", paths: ["gone.ts"], ttlMs: 250 }); await sleep(450);
    const hook = (env: Record<string, string | undefined>, tool: string, input: object) => { const e: Record<string, string> = {}; for (const [k, v] of Object.entries({ ...process.env, ...env })) if (v !== undefined) e[k] = v; return spawnSync("bun", ["--smol", join(HARNESS_DIR, "hooks", "guard.ts")], { input: JSON.stringify({ tool_name: tool, tool_input: input }), encoding: "utf8", env: e }).stdout.trim(); };
    const dec = (o: string) => (o ? (JSON.parse(o).hookSpecificOutput.permissionDecisionReason as string) : "ALLOW");
    const base = { HARNESS_STORE: undefined, HARNESS_LOCKS_URL: url, HARNESS_LOCKS_PREFIX: prefix, HARNESS_TASK: "t", HARNESS_CWD: "/w" };
    const r = { holder: dec(hook({ ...base, HARNESS_AGENT: "builder#1" }, "Write", { file_path: "/w/src/a.ts" })), holderTests: dec(hook({ ...base, HARNESS_AGENT: "builder#1" }, "Bash", { command: "bunx vitest run" })), other: dec(hook({ ...base, HARNESS_AGENT: "builder#2" }, "Write", { file_path: "/w/src/a.ts" })), expired: dec(hook({ ...base, HARNESS_AGENT: "builder#3" }, "Write", { file_path: "/w/gone.ts" })), readOnlyGit: dec(hook({ ...base, HARNESS_AGENT: "builder#2" }, "Bash", { command: "git status" })) };
    t("K9", "the real hook on Redis: holder allowed (file and @tests), another agent LOCKED, an idle holder whose lease lapsed gets LEASE EXPIRED, read-only commands pass", r.holder === "ALLOW" && r.holderTests === "ALLOW" && r.other.startsWith("LOCKED") && r.expired.startsWith("LEASE EXPIRED") && r.readOnlyGit === "ALLOW", JSON.stringify(r));
    const closed = { deadRedis: dec(hook({ ...base, HARNESS_LOCKS_URL: "redis://127.0.0.1:1", HARNESS_AGENT: "builder#1" }, "Write", { file_path: "/w/src/a.ts" })), noAgent: dec(hook({ ...base, HARNESS_AGENT: undefined }, "Write", { file_path: "/w/src/a.ts" })), noFile: dec(hook({ ...base, HARNESS_AGENT: "builder#1" }, "Write", {})), nothing: dec(hook({ HARNESS_STORE: undefined, HARNESS_LOCKS_URL: undefined, HARNESS_TASK: undefined, HARNESS_AGENT: undefined }, "Bash", { command: "ls" })) };
    t("K10", "FAIL CLOSED: lock service down, no agent identity, an edit naming no file, or no lock configuration at all -> every one is DENIED (never allowed because it could not be checked)", closed.deadRedis.startsWith("LOCK SERVICE UNAVAILABLE") && closed.noAgent.startsWith("LOCK CHECK IMPOSSIBLE") && closed.noFile.startsWith("LOCK CHECK IMPOSSIBLE") && closed.nothing.startsWith("LOCK CHECK IMPOSSIBLE"), JSON.stringify(closed).slice(0, 400));
    R.close();
    // ---- end to end: the agent never touches a lock; the harness takes it before the callee starts and frees it after; Redis holds it meanwhile
    const dir = mkdtempSyncSafe(), file = join(dir, "s.json"), st = new MStore(file); const lead = st.addAgent("t", defs.get("lead")!, { level: 1 }); lead.status = "running"; st.save();
    const e2ePrefix = "e" + Math.random().toString(36).slice(2, 6), watch = RedisLocks.connect(url, e2ePrefix);
    const tool = (args: string[], env: Record<string, string> = {}) => new Promise<any>((res) => { const p = spawn("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", HARNESS_MAX_INSTANCES: "8", HARNESS_LOCKS_URL: url, HARNESS_LOCKS_PREFIX: e2ePrefix, HARNESS_FAKE_DELAY_MS: "1500", ...env } }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
    const W = ["--role", "builder", "--session", "new", "--async", "--writes", "page.html,@tests", "--objective", "o", "--output", "x", "--boundaries", "b"];
    const b1 = await tool(["delegate", ...W]), b2 = await tool(["delegate", ...W]);
    await sleep(500); const during = (await watch.holders("t")).map((h) => h.agent_id + ":" + h.path).sort().join();
    const w = await tool(["wait", "--agents", [b1.agent_id, b2.agent_id].join(","), "--timeout", "30"]);
    const f = new MStore(file), s1 = trace.spans(f, "t").find((x) => x.agent_id === b1.agent_id)!, s2 = trace.spans(f, "t").find((x) => x.agent_id === b2.agent_id)!, after = await watch.holders("t");
    t("K11", "end to end on Redis: the agent never calls a lock. Writer 1 holds page.html + @tests in Redis while it runs (not in the file store); writer 2 is queued and is started BY THE HARNESS when writer 1's call ends (no overlap); both finish; Redis is empty after",
      b1.async === true && b2.queued === true && /builder#\d+:@tests/.test(during) && /page\.html/.test(during) && f.locks.length === 0 && w.timed_out === false && s2.start >= s1.start + s1.ms - 60 && after.length === 0, `during=${during} s2 started ${s2.start - s1.start} ms after s1 began (s1 took ${s1.ms}); held after=${after.length}; file-store locks=${f.locks.length}`);
    watch.close(); rm(dir);
    return true;
  });
  if (out === null) t("K0", "redis-server is installed and started", false, "redis-server could not be started on this machine");
}

// ---------------------------------------------------------------------------- the Project Manager
async function pmSuite() {
  setSuite("project manager: replanning a live run, pause/resume, refusals, cancelling, chatting while the team works");
  const pol = defaultPolicy({ agentMaxDepth: 4, maxInstancesPerRole: 8 });
  const mkWorld = () => { const w = world(); for (const n of ["researcher", "researcher", "builder"]) w.store.addAgent("t", defs.get(n)!, { level: 2, caller: "lead#1" }); return w; };
  const mkPlan = (): PlanRow => ({ task_id: "t", plan_id: "plan1", owner: "lead#1", waves: [], status: "running", created: 0, version: 1, tasks: [
    { id: "r1", role: "researcher", objective: "study the alpha site", output: "3 bullets", boundaries: "read only", status: "done", agent_id: "researcher#1", report_id: "rep1" },
    { id: "r2", role: "researcher", objective: "study the beta site", output: "3 bullets", boundaries: "read only", status: "running", agent_id: "researcher#2", call_id: "c2" },
    { id: "b1", role: "builder", objective: "write the alpha page", output: "file", boundaries: "one file", writes: ["alpha.html"], deps: ["r1"], status: "done", agent_id: "builder#1" },
    { id: "b2", role: "builder", objective: "write the beta page", output: "file", boundaries: "one file", writes: ["beta.html"], deps: ["r2"], status: "pending" }] });
  const W = mkWorld(), P0 = mkPlan(), keep = (id: string, o: Partial<PlanTask> = {}): PlanTask => { const t = P0.tasks.find((x) => x.id === id)!; return { id: t.id, role: t.role, objective: t.objective, output: t.output, boundaries: t.boundaries, deps: t.deps, writes: t.writes, ...o }; };
  const R = (wanted: PlanTask[]) => replan(P0, wanted, "the site changed", defs, "lead", pol, W.store, "t");
  const before = JSON.stringify(P0);
  { const r = R([keep("r2"), keep("b2")]);
    t("PM1", "replan, nothing changed: no task is touched (finished ones stay as history, running ones keep running)", r.ok && r.added.length + r.modified.length + r.cancelled.length + r.redo.length === 0 && r.stop.length === 0, r.ok ? r.summary : r.errors.join()); }
  { const r = R([keep("r2", { objective: "study the beta site, but only its pricing page" }), keep("b2")]);
    const r2 = r.ok ? r.tasks.find((x) => x.id === "r2")! : null;
    t("PM2", "replan, a RUNNING task changes: its agent is stopped, the task goes back to pending, continues the SAME agent (session = researcher#2) with a 'change of requirements' note; its finished siblings are untouched",
      r.ok && r.modified.join() === "r2" && r.stop.map((x) => x.agent_id).join() === "researcher#2" && r2!.status === "pending" && r2!.session === "researcher#2" && /CHANGE OF REQUIREMENTS \(plan v2\)/.test(r2!.note ?? "") && r.tasks.find((x) => x.id === "r1")!.status === "done" && r.tasks.find((x) => x.id === "b1")!.status === "done", r.ok ? r.summary : r.errors.join()); }
  { const r = R([keep("r1", { objective: "study the alpha site, focus on its security page" }), keep("r2"), keep("b2")]);
    const b1 = r.ok ? r.tasks.find((x) => x.id === "b1")! : null;
    t("PM3", "replan, a FINISHED task changes: it is redone, and everything that used its result is redone too (b1 wrote the alpha page from r1's answer, so b1 goes back to pending with the same agent)", r.ok && r.modified.join() === "r1" && r.redo.join() === "b1" && b1!.status === "pending" && b1!.session === "builder#1" && /inputs? to your task changed/.test(b1!.note ?? ""), r.ok ? r.summary + " redo=" + r.redo : r.errors.join()); }
  { const r = R([keep("r1"), keep("r2", { objective: "study the beta site in depth" }), keep("b2"), { id: "r3", role: "researcher", objective: "study the gamma site", output: "3 bullets", boundaries: "read only" }]);
    t("PM4", "replan, a task is ADDED: it appears pending next to the running ones", r.ok && r.added.join() === "r3" && r.tasks.find((x) => x.id === "r3")!.status === "pending", r.ok ? r.summary : r.errors.join()); }
  { const r = R([keep("r1")]);
    t("PM5", "replan, tasks left out are CANCELLED (the running one is stopped); finished ones stay", r.ok && r.cancelled.sort().join() === "b2,r2" && r.stop.map((x) => x.agent_id).join() === "researcher#2" && r.tasks.find((x) => x.id === "r2")!.status === "cancelled" && r.tasks.find((x) => x.id === "b1")!.status === "done", r.ok ? r.summary : r.errors.join()); }
  { const bad: [string, PlanTask[], RegExp][] = [
      ["cancel r2 but keep b2 which needs it", [keep("r1"), keep("b2")], /unknown task "r2"/],
      ["a cycle", [keep("r2", { deps: ["b2"] }), keep("b2")], /dependency cycle/],
      ["two writers on one file in one wave", [keep("r2"), keep("b2"), { id: "b3", role: "builder", objective: "write the beta page again differently", output: "file", boundaries: "one file", writes: ["beta.html"], deps: ["r2"] }], /same files at the same time/],
      ["a role the lead may not call", [keep("r2"), { id: "x1", role: "wizard", objective: "magic", output: "x", boundaries: "y" }], /unknown role/]];
    const bad2 = bad.filter(([, w, re]) => { const r = R(w); return r.ok || !r.errors.some((e) => re.test(e)); }).map(([n]) => n);
    t("PM6", "a bad change is REFUSED whole with the reasons (dangling dependency, cycle, same-file writers, unknown role) and the plan is not touched", bad2.length === 0 && JSON.stringify(P0) === before, bad2.join() || "plan unchanged"); }

  // ---- live: replanning a plan that is running (real tools.ts processes, fake workers that take 1.5 s)
  const { spawn } = await import("node:child_process");
  const dir = mkdtempSyncSafe(), file = join(dir, "s.json"); { const st = new MStore(file); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.save(); }
  const tool = (args: string[], env: Record<string, string> = {}) => new Promise<any>((res) => { const p = spawn("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", HARNESS_MAX_INSTANCES: "60", HARNESS_FAKE_DELAY_MS: "1500", ...env } }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
  const T = (id: string, role: string, o: Partial<PlanTask> = {}): PlanTask => ({ id, role, objective: `${id} work about ${id === "r2" ? "beta" : id} topic ${id}${id}`, output: "3 bullets", boundaries: "stay inside", ...(role === "builder" ? { writes: [id + ".html"] } : {}), ...o });
  const tasks = (): PlanTask[] => [T("r1", "researcher"), T("r2", "researcher"), T("r3", "researcher"), T("b1", "builder", { deps: ["r1"] })];
  { const sub = await tool(["plan_submit", "--tasks", JSON.stringify(tasks())]); if (!sub.ok) t("PM7-setup", "plan accepted", false, JSON.stringify(sub).slice(0, 300)); await tool(["plan_run", "--plan", sub.plan_id]); await sleep(700);
    const t0 = Date.now(), rp = await tool(["plan_replan", "--plan", sub.plan_id, "--reason", "the beta site moved", "--tasks", JSON.stringify(tasks().map((x) => (x.id === "r2" ? { ...x, objective: "r2 work about the NEW beta address" } : x)))]);
    const st = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "40"]), f = new MStore(file), p = f.plans[0]!;
    const c2 = f.calls.filter((c) => c.callee_agent_id === "researcher#2"), reps2 = f.reports.filter((r) => r.agent_id === "researcher#2");
    t("PM7", "LIVE replan: r2 is changed while it runs -> researcher#2 is stopped and CONTINUED (same agent, session argument researcher#2, 'change of requirements' in its brief), the old run's late result is discarded, no extra agent is created, the other tasks never notice",
      rp.ok && rp.version === 2 && rp.changed.join() === "r2" && rp.stopped.join() === "researcher#2" && st.status === "done" && c2.length === 2 && c2[0]!.reason === "stopped" && c2[1]!.session_arg === "researcher#2" && /CHANGE OF REQUIREMENTS/.test(String((c2[1]!.req as any).objective)) && reps2.length === 1 && /CHANGE OF REQUIREMENTS \(plan v2\)/.test(reps2[0]!.summary) && f.agentsOf("t").length === 5,
      `${JSON.stringify(rp).slice(0, 200)} calls=${c2.map((c) => c.status + ":" + c.session_arg)} reports=${reps2.length} agents=${f.agentsOf("t").length}`);
    const notes = f.notes.filter((n) => /PLAN CHANGE v2/.test(n.text));
    t("PM8", "everyone is told: the affected agent gets a personal note and all agents get the summary, with who changed it and why; the plan keeps a change log", notes.some((n) => n.to === "researcher#2") && notes.some((n) => n.to === "all") && p.version === 2 && p.changes!.length === 1 && p.changes![0]!.reason === "the beta site moved" && f.evs("plan.replanned").length === 1, `notes=${notes.map((n) => n.to)} log=${JSON.stringify(p.changes?.[0]).slice(0, 120)}`); void t0; }
  { const sub = await tool(["plan_submit", "--tasks", JSON.stringify(tasks())]); await tool(["plan_run", "--plan", sub.plan_id]); await sleep(300);
    const paused = await tool(["plan_pause", "--plan", sub.plan_id]); await sleep(2300);
    const mid = await tool(["plan_show", "--plan", sub.plan_id]); const resumedAt = Date.now(); await tool(["plan_resume", "--plan", sub.plan_id]);
    const st = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "40"]), f = new MStore(file), b1 = f.plans.find((x) => x.plan_id === sub.plan_id)!.tasks.find((x) => x.id === "b1")!;
    const bs = trace.spans(f, "t").find((x) => x.agent_id === b1.agent_id)!;
    t("PM9", "pause: running tasks finish but NO new task starts (b1 waits although r1 is done); resume: it starts then and the plan completes", paused.paused === true && mid.paused === true && mid.tasks.filter((x: any) => x.status === "done").length === 3 && mid.tasks.find((x: any) => x.id === "b1").status === "pending" && st.status === "done" && bs.start >= resumedAt - 100, `mid=${mid.tasks.map((x: any) => x.id + ":" + x.status)} b1 started ${bs.start - resumedAt} ms after resume`); }
  { const sub = await tool(["plan_submit", "--tasks", JSON.stringify(tasks())]); await tool(["plan_run", "--plan", sub.plan_id]); await sleep(500);
    const stoppedBefore = new MStore(file).calls.filter((c) => c.reason === "stopped").length;
    const bad = await tool(["plan_replan", "--plan", sub.plan_id, "--reason", "x", "--tasks", JSON.stringify([T("r1", "researcher", { deps: ["b1"] }), T("b1", "builder", { deps: ["r1"] })])]);
    const st = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "40"]), f = new MStore(file);
    t("PM10", "a refused replan changes NOTHING on a live plan: version stays, no agent is stopped, every task still finishes", bad.ok === false && /dependency cycle/.test(bad.errors.join()) && /NOTHING was changed/.test(bad.note) && st.status === "done" && (st.version ?? 1) === 1 && f.evs("plan.replan_refused").length >= 1 && f.calls.filter((c) => c.reason === "stopped").length === stoppedBefore, JSON.stringify(bad).slice(0, 200)); }
  { const sub = await tool(["plan_submit", "--tasks", JSON.stringify([...tasks(), T("b3", "builder", { deps: ["r3"] })])]); await tool(["plan_run", "--plan", sub.plan_id]); await sleep(500);
    const keepIds = new Set(["r1", "r2", "b1"]), rp = await tool(["plan_replan", "--plan", sub.plan_id, "--reason", "the third site is out of scope", "--tasks", JSON.stringify([...tasks(), T("b3", "builder", { deps: ["r3"] })].filter((x) => keepIds.has(x.id)))]);
    const st = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "40"]), f = new MStore(file), pl = f.plans.find((x) => x.plan_id === sub.plan_id)!;
    const r3agent = pl.tasks.find((x) => x.id === "r3")!.agent_id!;
    t("PM11", "cancel while running: r3 is stopped and its late answer discarded (no report), b3 never starts, nothing waits for them, and the plan still ends 'done'", rp.ok && rp.cancelled.sort().join() === "b3,r3" && st.status === "done" && pl.tasks.find((x) => x.id === "r3")!.status === "cancelled" && pl.tasks.find((x) => x.id === "b3")!.status === "cancelled" && f.reports.filter((r) => r.agent_id === r3agent).length === 0 && !f.agentsOf("t").some((a) => a.name === "builder" && a.last_call_id && f.calls.find((c) => c.id === a.last_call_id && c.req && (c.req as any).writes?.[0] === "b3.html")), `${JSON.stringify(rp).slice(0, 160)}`); }

  // ---- chat with the PM while the team works
  { const rdir = mkdtempSyncSafe(), rf = join(rdir, "s.json"), st = new MStore(rf); const lead = st.addAgent("t", defs.get("lead")!, { level: 1 }); lead.status = "running";
    const a = st.addAgent("t", defs.get("researcher")!, { level: 2, caller: "lead#1" }); a.status = "running"; a.title = "beta pricing"; a.activity = "WebFetch https://beta.example";
    st.plans.push({ task_id: "t", plan_id: "plan1", owner: "lead#1", waves: [["r2"]], status: "running", created: Date.now(), version: 1, tasks: [{ id: "r2", role: "researcher", objective: "study beta", output: "x", boundaries: "y", status: "running", agent_id: "researcher#1" }] }); st.save();
    const rn = new ScriptRunner(async () => { await sleep(300); return "researcher#1 is on the beta pricing page; nothing is stuck."; }), ctx = { store: st, runner: rn, defs, sessionCap: 8 };
    const c1 = chatPM(ctx, { task_id: "t", repo: rdir, text: "how is it going?", runner: "fake" }); await sleep(80);
    const c2 = await chatPM(ctx, { task_id: "t", repo: rdir, text: "also make the pages blue", runner: "fake" }), r1 = await c1;
    const c3 = await chatPM(ctx, { task_id: "t", repo: rdir, text: "thanks", runner: "fake" });
    const p1 = rn.calls[0]!.prompt, p3 = rn.calls[1]!.prompt, log = chatLog(st, "t").map((n) => (n.from === "user" ? "U" : "P")).join("");
    t("PM12", "chat: the PM gets the live team status (tree, plan with the running task, the agent's title and activity) with the user's words; a message sent while it is busy is QUEUED (not lost, no second run) and read with the next one; the conversation is on record in order",
      !!c2.queued && !r1.queued && rn.calls.length === 2 && /TEAM STATUS NOW/.test(p1) && /beta pricing/.test(p1) && /PLAN plan1 v1 status=running/.test(p1) && /r2\s+\[researcher\] running/.test(p1) && p1.includes("how is it going?") && p3.includes("also make the pages blue") && p3.includes("thanks") && log === "UUPUP" && !c3.queued && rn.calls[1]!.session.resume, `log=${log} calls=${rn.calls.length} queued=${c2.queued}`);
    const board = renderBoard(st, "t"), cli = spawnSync("bun", ["--smol", join(HARNESS_DIR, "main.ts"), "board", "--store", rf, "--task", "t"], { encoding: "utf8" }).stdout;
    t("PM13", "the user's board shows, in one screen: the team tree, each agent's title/description/session, the plan, the conversation with the PM, and the latest events; the same from the command line", ["== TEAM", "== AGENTS (title, description, session)", "== PLAN ==", "== CHAT WITH THE PROJECT MANAGER ==", "== LATEST ==", "beta pricing", "you: how is it going?", "pm :"].every((x) => board.includes(x)) && cli.includes("== CHAT WITH THE PROJECT MANAGER ==") && cli.includes("beta pricing"), board.slice(0, 300));
    const chatCli = spawnSync("bun", ["--smol", join(HARNESS_DIR, "main.ts"), "chat", "--store", rf, "--task", "t", "--say", "status please", "--repo", rdir, "--runner", "fake"], { encoding: "utf8" }).stdout.trim();
    t("PM14", "and from the command line the user can chat with the PM (`main.ts chat --say ...`); the exchange lands in the same conversation record", chatCli.includes("fake project manager") && chatLog(new MStore(rf), "t").some((n) => n.text === "status please"), chatCli); rm(rdir); }
  rm(dir);
}

// ---------------------------------------------------------------------------- sessions: persistence proven against the CLI's own session rules
async function regressSuite() {
  setSuite("regress: the master-session problems found on 2026-11-06 must not come back");
  const { SESSION_CAP } = await import("../harness/core/session_run.ts");
  const src = (p: string) => readFileSync(join(import.meta.dirname, "..", p), "utf8");
  t("RG1", "every agent's role equals its folder name (the lead types the role into delegate --role; 'build' vs 'builder' was denied unknown_role)", [...defs.values()].every((d) => d.role === d.name));
  t("RG2", "one session cap for the lead, callees and defaults, at least 8; no hardcoded sessionCap number in the UI, tools or main", SESSION_CAP >= 8 && !/sessionCap:\s*\d/.test(readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "..", "TestCases", "ui", "test_structure", "server", "experiment.ts"), "utf8") + src("harness/tools.ts") + src("harness/main.ts")));
  const w = world(); w.store.tx(() => { const a = w.store.addAgent("t", defs.get("builder")!, { level: 2, caller: "lead#1" }); w.store.ev("session.rolled", "t", a.agent_id, { reason: "full" }); });
  const s = sessionStats(w.store, "t", "builder#1");
  t("RG3", "sessionStats counts a rolled session (1 roll = 2 sessions) so the lead's 'how many sessions' answer is true", s.rolls === 1 && s.sessions === 2);
  const lead = readFileSync(join(AGENTS_DIR, "lead", ".claude", "CLAUDE.md"), "utf8");
  t("RG4", "the lead's rules say: 'ask <agent>' means continue that agent, count sessions from agents_list, use exact role names", /MUST continue that agent/.test(lead) && /agents_list/.test(lead) && /exact name/.test(lead));
}
async function sessionsSuite() {
  setSuite("sessions: persistence proven end to end through the real runner against a stand-in CLI with the real CLI's session rules; every failure case must CRASH");
  const { symlinkSync, writeFileSync: wf, chmodSync } = await import("node:fs");
  const home = mkdtempSyncSafe(), bin = mkdtempSyncSafe(), saved = { HOME: process.env.HOME, PATH: process.env.PATH, FORGET: process.env.FAKE_CLAUDE_FORGET, CFG: process.env.CLAUDE_CONFIG_DIR };
  wf(join(bin, "claude"), `#!/bin/sh\nexec bun --smol ${join(import.meta.dirname, "fake_claude.ts")} "$@"\n`); chmodSync(join(bin, "claude"), 0o755);
  process.env.HOME = home; delete process.env.CLAUDE_CONFIG_DIR; process.env.PATH = bin + ":" + process.env.PATH;   // the temp HOME only isolates if CLAUDE_CONFIG_DIR (which wins over HOME) is not set: otherwise the suite wrote its fake transcripts into the REAL session folder
  const dirs = ["A", "B", "C", "D"].map((n) => { const d = join(home, "work", n); mkdirSync(d, { recursive: true }); return d; });
  const res = defs.get("researcher")!, root = join(home, ".claude", "projects");
  const mk = (o: { strict?: boolean; fileCheck?: ((cwd: string, id: string) => boolean) | null } = {}) => {
    const w = world(); w.store.strict = o.strict ?? true; const row = w.store.addAgent("t", res, { level: 2, caller: "lead#1" });
    const fc = o.fileCheck === undefined ? (_c: string, id: string) => transcriptExistsAnywhere(id) : o.fileCheck ?? undefined;
    return { w, row, ctx: { store: w.store, runner: new RealRunner(30_000), defs, sessionCap: 20, canary: true, transcriptExists: fc } };
  };
  const step = (m: ReturnType<typeof mk>, cwd: string, n: number, intent: "new" | "resume") => callAgent(m.ctx, m.w.store.agent("t", m.row.agent_id)!, cwd, () => `step ${n}`, undefined, { intent });
  const crashed = async (rule: string, fn: () => Promise<unknown>) => { try { await fn(); return false; } catch (e) { return e instanceof InvariantViolation && e.rule === rule; } };
  try {
    { const m = mk(), out = [await step(m, dirs[0]!, 1, "new")]; for (let i = 1; i < 4; i++) out.push(await step(m, dirs[i]!, i + 1, "resume"));
      const row = m.w.store.agent("t", m.row.agent_id)!, sid = row.session_id!, code = canaryFor("t", row.agent_id);
      t("SP1", "PERSISTED: one agent, four calls from four different folders, real runner, strict + canary on: first call new, the other three RESUMED under the SAME session id; the transcript file exists (in the folder it was created in); every resumed reply recites the code told in the FIRST call; no violation",
        out.map((o) => o.mode).join() === "new,resumed,resumed,resumed" && new Set(out.map((o) => o.session_id)).size === 1 && out[0]!.session_id === sid && existsSync(transcriptFor(dirs[0]!, sid)) && out.slice(1).every((o) => o.reply.startsWith(code)) && m.w.store.violations().length === 0 && row.created_cwd === dirs[0] && row.runs === 4, `modes=${out.map((o) => o.mode)} ids=${new Set(out.map((o) => o.session_id.slice(0, 6)))} replies=${out.map((o) => o.reply.slice(0, 12))}`);
      t("SP2", "the registry and the disk agree: every agent that has run has its transcript on disk (checkSessionFiles), and the check FAILS when a transcript is deleted", checkSessionFiles(m.w.store, "t", root).length === 0 && (() => { rmSync(transcriptFor(dirs[0]!, sid)); return checkSessionFiles(m.w.store, "t", root).some((p) => p.rule === "session_not_on_disk"); })(), "");
      m.w.lead.status = "idle"; t("SP2b", "every start has exactly one end (done, failed or stopped): a forged extra start is caught as unpaired_events", checkRegistry(m.w.store, "t", { expectIdle: true }).length === 0 && (() => { m.w.store.ev("agent.start", "t", row.agent_id); return checkRegistry(m.w.store, "t", { expectIdle: true }).some((p) => p.rule === "unpaired_events"); })(), ""); }
    { let folder = dirs[0]!;   // replay of the ORIGINAL bug: look for the transcript in the folder of THIS call
      const old = mk({ fileCheck: (_c, id) => transcriptExistsIn(folder)(id) }); await step(old, dirs[0]!, 1, "new"); folder = dirs[1]!;
      t("SP3", "REGRESSION: replaying the original bug (the transcript is looked for in the folder of the call being made) makes the same scenario CRASH with resume_lost_session on the second call. This test would have failed that day.", await crashed("resume_lost_session", () => step(old, dirs[1]!, 2, "resume")), `violations=${old.w.store.violations().map((v) => v.data!.rule)}`);
      let prev = dirs[0]!;   // replay of the FIRST attempt at a fix: the folder of the PREVIOUS call (fine for two folders)
      const half = mk({ fileCheck: (_c, id) => transcriptExistsIn(prev)(id) }); await step(half, dirs[0]!, 1, "new"); const second = await step(half, dirs[1]!, 2, "resume"); prev = dirs[1]!;
      t("SP3b", "REGRESSION: the incomplete first fix (the previous call's folder) passes the second call but CRASHES on the third, because the real CLI keeps the transcript in the folder where the session was created. Only a chain of three or more folders can show it.", second.mode === "resumed" && (await crashed("resume_lost_session", () => step(half, dirs[2]!, 3, "resume"))), `second=${second.mode}`); }
    { const m = mk(); await step(m, dirs[0]!, 1, "new"); rmSync(transcriptFor(dirs[0]!, m.w.store.agent("t", m.row.agent_id)!.session_id!));
      const ok = await crashed("resume_lost_session", () => step(m, dirs[1]!, 2, "resume")), r = m.w.store.agent("t", m.row.agent_id)!;
      t("SP4", "MUST FAIL: the transcript is deleted between calls -> the next continue CRASHES with resume_lost_session BEFORE anything runs on a blank session; the agent is not left running", ok && r.status !== "running" && m.w.store.violations().length === 1, `status=${r.status}`);
      const soft = mk({ strict: false }); await step(soft, dirs[0]!, 1, "new"); rmSync(transcriptFor(dirs[0]!, soft.w.store.agent("t", soft.row.agent_id)!.session_id!)); const o = await step(soft, dirs[1]!, 2, "resume");
      t("SP4b", "NOT strict: the same loss never passes silently: an error event, a rolled session, and the canary shows the new session knows nothing", soft.w.store.violations().some((v) => v.data!.rule === "resume_lost_session") && o.mode === "rolled", `mode=${o.mode}`); }
    { const m = mk({ fileCheck: null }); await step(m, dirs[0]!, 1, "new"); rmSync(transcriptFor(dirs[0]!, m.w.store.agent("t", m.row.agent_id)!.session_id!));
      const ok = await crashed("resume_lost_session", () => step(m, dirs[1]!, 2, "resume")), v = m.w.store.violations()[0];
      t("SP5", "MUST FAIL even if our own file check is switched off: the CLI answers 'No conversation found' and the harness turns that into a crash with resume_lost_session (said_by the CLI)", ok && v?.data?.said_by === "the CLI", JSON.stringify(v?.data).slice(0, 160)); }
    { const m = mk(); await step(m, dirs[0]!, 1, "new"); m.w.store.agent("t", m.row.agent_id)!.session_id = null;   // the registry write was lost
      t("SP6", "MUST FAIL: the registry lost the session id -> continuing crashes with resume_without_session (never a quiet new session)", await crashed("resume_without_session", () => step(m, dirs[1]!, 2, "resume")), ""); }
    { const m = mk(); await step(m, dirs[0]!, 1, "new"); process.env.FAKE_CLAUDE_FORGET = "1";
      const ok = await crashed("memory_lost", () => step(m, dirs[1]!, 2, "resume")); delete process.env.FAKE_CLAUDE_FORGET;
      t("SP7", "MUST FAIL: the session resumes under the right id but the model has lost its context (a silent reset the file checks cannot see) -> the canary crashes the run with memory_lost", ok, ""); }
    { const m = mk(); const first = await step(m, dirs[0]!, 1, "new"), src = m.w.store.agent("t", m.row.agent_id)!;
      const f = m.w.store.addAgent("t", res, { level: 2, caller: "lead#1", parent: src.agent_id, parentSession: src.session_id, type: "fork" }), fid = f.session_id;
      const fo = await callAgent(m.ctx, m.w.store.agent("t", f.agent_id)!, dirs[2]!, () => "side job", { id: randomUUID(), resume: false, fork_from: src.session_id! }, { intent: "fork" });
      const back = await step(m, dirs[3]!, 3, "resume"), fr = m.w.store.agent("t", f.agent_id)!;
      t("SP8", "FORK: the branch gets its own session id and file but starts with the source's memory; the source can still be continued afterwards from another folder under its own id", !fid && fo.ok && fo.session_id !== first.session_id && !!findTranscript(fo.session_id) && back.mode === "resumed" && back.session_id === first.session_id && back.reply.startsWith(canaryFor("t", src.agent_id)) && fr.parent_session_id === src.session_id, `fork=${fo.session_id.slice(0, 6)} src=${first.session_id.slice(0, 6)} back=${back.mode}`); }
  } finally { process.env.HOME = saved.HOME; process.env.PATH = saved.PATH; if (saved.CFG === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved.CFG; if (saved.FORGET === undefined) delete process.env.FAKE_CLAUDE_FORGET; rm(home); rm(bin); }
  function findTranscript(id: string) { try { return readdirSync(root).some((d) => existsSync(join(root, d, id + ".jsonl"))); } catch { return false; } }
}

// ---------------------------------------------------------------------------- session runs: the id you come back to after the laptop was closed
async function runsSuite() {
  setSuite("session runs: one id to come back to; resume after the processes died (the laptop was closed); NOT RUN YET when written, run with --suite runs");
  const mkCrashed = () => {
    const dir = mkdtempSyncSafe(), file = join(dir, "s.json"), st = new MStore(file);
    const lead = st.addAgent("t", defs.get("lead")!, { level: 1, type: "root" }); lead.status = "idle"; lead.session_id = "LEAD-SESSION-ID"; lead.runs = 1;
    const r1 = st.addAgent("t", defs.get("researcher")!, { level: 2, caller: "lead#1" }); r1.status = "running"; r1.activity = "WebFetch https://x"; r1.session_id = "R1-SESSION-ID"; r1.last_event_at = Date.now() - 120_000;
    const req = { task_id: "t", caller_agent_id: "lead#1", role: "researcher", session_arg: "new", objective: "study alpha", output: "3 bullets", boundaries: "read only" };
    st.calls.push({ id: "c1", task_id: "t", caller_agent_id: "lead#1", callee_agent_id: "researcher#1", role: "researcher", level: 2, session_arg: "new", status: "granted", reason: null, t: Date.now() - 120_000, req });
    st.plans.push({ task_id: "t", plan_id: "plan1", owner: "lead#1", waves: [["r1"]], status: "running", created: Date.now(), version: 1, tasks: [{ id: "r1", role: "researcher", objective: "study alpha", output: "3 bullets", boundaries: "read only", status: "running", agent_id: "researcher#1", call_id: "c1" }] });
    const run = ensureRun(st, { task_id: "t", repo: dir, config: { runner: "fake", maxDepth: 4, locks_url: "redis://user:secret@host:6379" } });
    st.save(); return { dir, file, run };
  };
  { const { dir, file, run } = mkCrashed(); const fresh = new MStore(file), again = findRun(fresh, { run: run.id })!;   // a NEW process reading the file: the laptop was closed and opened again
    t("RN1", "the session run is on disk: its id, task, folder, the main agent and its Claude session id, the project manager, the plans, and the settings; a fresh process finds it by id or by task",
      again.id === run.id && again.task_id === "t" && again.main_agent_id === "lead#1" && again.main_session_id === "LEAD-SESSION-ID" && again.plan_ids.join() === "plan1" && again.status === "active" && findRun(fresh, { task: "t" })!.id === run.id && again.config.runner === "fake" && again.repo === dir, JSON.stringify(again).slice(0, 300));
    t("RN2", "a password in the Redis address is NEVER stored (host and port only); give the credentials again through the environment on resume", !JSON.stringify(again).includes("secret") && again.config.locks_url === "redis://host:6379" && redactUrl("redis://u:p@h:1") === "redis://h:1", String(again.config.locks_url));
    t("RN2b", "one active run per task: asking again returns the same run, it does not create a second", ensureRun(fresh, { task_id: "t", repo: dir }).id === run.id && fresh.runs.length === 1, ""); rm(dir); }
  { const { dir, file, run } = mkCrashed(); const st = new MStore(file);
    const alive = st.addAgent("t", defs.get("researcher")!, { level: 2, caller: "lead#1" }); alive.status = "running"; alive.last_event_at = Date.now(); st.save();
    const r = resumeRun(new MStore(file), { run: run.id }, { projectsRoot: join(dir, "no-projects") });
    const after = new MStore(file), a1 = after.agent("t", "researcher#1")!, p = after.plans[0]!.tasks[0]!;
    t("RN3", "RESUME after the processes died: the agent whose last sign of life was 2 minutes ago is marked interrupted and goes idle with its Claude session id UNCHANGED and its epoch bumped; its call ends as 'interrupted'; its task goes back to pending and will CONTINUE THE SAME AGENT with a 'resumed after an interruption' note; the plan is flagged for restart",
      r.ok && r.report.interrupted_agents.join() === "researcher#1" && a1.status === "idle" && a1.session_id === "R1-SESSION-ID" && (a1.epoch ?? 0) === 1 && after.calls[0]!.status === "failed" && after.calls[0]!.reason === "interrupted" && p.status === "pending" && p.session === "researcher#1" && /RESUMED AFTER AN INTERRUPTION/.test(p.note ?? "") && r.report.plans_to_restart.join() === "plan1" && r.report.tasks_requeued.join() === "r1" && r.releaseCalls.join() === "c1", r.ok ? JSON.stringify(r.report).slice(0, 300) : r.error);
    t("RN4", "an agent that was seen alive a moment ago is LEFT ALONE (not every 'running' agent is dead); `--force` overrides", r.ok && r.report.skipped_alive.join() === "researcher#2" && after.agent("t", "researcher#2")!.status === "running", "");
    t("RN5", "the run record is bumped by a resume: resumed count 1, status active, one run.resumed event on record", r.ok && after.runs[0]!.resumed_count === 1 && after.runs[0]!.status === "active" && after.evs("run.resumed", "t").length === 1, JSON.stringify(after.runs[0]).slice(0, 200)); rm(dir); }
  { const { dir, file, run } = mkCrashed(); const st = new MStore(file); st.agent("t", "lead#1")!.runs = 1; st.agent("t", "researcher#1")!.runs = 2; st.save();
    const r = resumeRun(new MStore(file), { run: run.id }, { projectsRoot: join(dir, "empty") });
    t("RN6", "a missing Claude session file is REPORTED at resume (CONTEXT LOST for that agent), never found out later by surprise", r.ok && r.report.sessions_missing.length >= 1 && r.report.next.some((n) => /CONTEXT LOST/.test(n)), r.ok ? r.report.next.join(" | ") : r.error);
    const closed = new MStore(file); closed.runs[0]!.status = "closed"; closed.save();
    const no = resumeRun(new MStore(file), { run: run.id }), yes = resumeRun(new MStore(file), { run: run.id }, { force: true });
    t("RN7", "a closed run is not resumed by accident (refused with the reason), but can be with --force; an unknown id names the runs that exist", !no.ok && /closed/.test(no.error) && yes.ok && !resumeRun(new MStore(file), { run: "nope" }).ok, ""); rm(dir); }
  { const { dir, file, run } = mkCrashed(); const MAIN = join(HARNESS_DIR, "main.ts");
    const out = spawnSync("bun", ["--smol", MAIN, "resume", "--store", file, "--run", run.id], { encoding: "utf8", env: { ...process.env } });
    await sleep(100);
    const tl = (args: string[]) => new Promise<any>((res) => { const { spawn } = require("node:child_process"); const pr = spawn("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake" } }); let o = ""; pr.stdout.on("data", (d: Buffer) => (o += d)); pr.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
    const st2 = await tl(["plan_status", "--plan", "plan1", "--wait", "30"]), f = new MStore(file);
    t("RN8", "END TO END: `main.ts resume --run <id>` in a fresh process prints the recovery, restarts the plan's scheduler from the stored settings, and the cut-off task finishes by CONTINUING researcher#1 (same agent, session argument researcher#1, no new agent created)",
      /is active again/.test(out.stdout) && /scheduler restarted for plan1/.test(out.stdout) && st2.status === "done" && f.agentsOf("t").filter((a) => a.name === "researcher").length === 1 && f.calls.some((c) => c.status === "done" && c.session_arg === "researcher#1" && /RESUMED AFTER AN INTERRUPTION/.test(String((c.req as any)?.objective))), `${out.stdout.slice(0, 260)} | plan=${st2.status}`);
    const tree = spawnSync("bun", ["--smol", MAIN, "tree", "--store", file, "--run", run.id], { encoding: "utf8" }).stdout, runs = spawnSync("bun", ["--smol", MAIN, "runs", "--store", file], { encoding: "utf8" }).stdout;
    t("RN9", "the helper commands take the run id: `tree --run <id>` works like `--task`, and `runs` lists every run with its main agent and Claude session id", tree.includes("researcher#1") && runs.includes(run.id) && runs.includes("LEAD-SES"), runs.slice(0, 200)); rm(dir); }
}

// ---------------------------------------------------------------------------- an agent that is stuck stops and asks its parent
async function parentSuite() {
  setSuite("stuck agents ask their parent (NEEDS_PARENT), the parent answers, the same agent continues; who can call whom; the prompts");
  const { readdirSync: ls, readFileSync: rf } = await import("node:fs");
  // ---- the call / tools matrix (what the audit printed), asserted
  { const rows = [...defs.values()], callers = rows.filter((d) => launchTools(d, 1, 4).delegate).map((d) => d.name).sort();
    t("NP1", "who can call whom: only the lead, the planner (ux-designer, builder), the builder and the lookup coordinator (lookup-page workers) can call sub-agents; every other agent is a leaf; the call tool is REMOVED at level 4 and for everyone when multi-agent is off (max depth 1); every agent has at least one tool; every declared sub-agent exists",
      callers.join() === "builder,lead,lookup,planner" && rows.every((d) => !launchTools(d, 4, 4).delegate && !launchTools(d, 1, 1).delegate && d.tools.length >= 1) && rows.every((d) => d.agents.every((n) => defs.has(n))) && rows.filter((d) => d.agents.length === 0).every((d) => !launchTools(d, 1, 4).delegate), `callers=${callers}`);
    const dec = declarations(defs.get("lead")!, defs);   // the builder now calls only the researcher; the lead lists the researcher and the qa-reviewer
    t("NP2", "and a caller is TOLD what it may call and what each one can do: the lead's launch text lists the researcher (web access) and the qa-reviewer with their real tools", /researcher \(read-only; has web access/.test(dec) && /qa-reviewer \(read-only; NO web access/.test(dec), dec.slice(0, 160)); }
  // ---- the prompts
  { const bad: string[] = [];
    for (const root of ["."]) for (const a of ls(AGENTS_DIR)) {
      const txt = rf(join(AGENTS_DIR, a, ".claude", "CLAUDE.md"), "utf8");
      if (a === "lead") { if (!/NEVER write `NEEDS_PARENT:`/.test(txt) || !/STOP/.test(txt)) bad.push(root + "/lead must ask the person in plain words and never write NEEDS_PARENT:"); } else if (a === "pm") { if (!/plan_answer/.test(txt)) bad.push(root + "/pm lacks plan_answer"); } else if (!/NEEDS_PARENT/.test(txt) || !/STOP/.test(txt) || !/same conversation/.test(txt)) bad.push(root + "/" + a);
    }
    t("NP3", "the lead asks the PERSON in plain words (never the NEEDS_PARENT: marker); every other agent prompt says what to do when stuck (STOP, reply NEEDS_PARENT: with what is needed and what was done, the parent continues you in the same conversation); callers also say how to answer a child; the PM knows plan_answer", bad.length === 0, bad.join(", ")); }
  // ---- the question reaches the parent
  { const w = world(), res = defs.get("researcher")!, rn = new ScriptRunner((c: RunCall) => (c.prompt.includes("ASK") && !c.prompt.includes("ANSWER") ? "NEEDS_PARENT: which address should I use? I found two." : "done with the address given"));
    const ctx = { store: w.store, runner: rn, defs, sessionCap: 3 }, q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, objective: "ASK about the address", ...o });
    const r1 = granted(agentCall(w.store, w.d, w.policy, q())); const o1 = await runCallee(ctx, w.policy, r1, q(), res, { cwd: tmpdir(), writerMode: "shared" });
    const row = w.store.agent("t", "researcher#1")!, tree = trace.renderTree(w.store, "t");
    t("NP4", "a callee that replies NEEDS_PARENT: is marked 'waiting for its parent': the question is on its row, in the event log, in the call result, and shown in the tree (ASKS ITS PARENT)",
      o1.needs_parent === "which address should I use? I found two." && row.needs_parent === o1.needs_parent && w.store.evs("agent.needs_parent").length === 1 && /ASKS ITS PARENT: "which address/.test(tree), tree);
    const r2 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "researcher#1", objective: "ANSWER: use the first one" }))); const o2 = await runCallee(ctx, w.policy, r2, q({ session_arg: "researcher#1", objective: "ANSWER: use the first one" }), res, { cwd: tmpdir(), writerMode: "shared" });
    t("NP5", "when the parent continues the SAME agent with the answer, the question is cleared and the agent finishes (resumed, same session)", !o2.needs_parent && w.store.agent("t", "researcher#1")!.needs_parent === null && rn.calls[1]!.session.resume && rn.calls[1]!.session.id === rn.calls[0]!.session.id, ""); }
  // ---- a plan: a stuck task BLOCKS (it is not 'done'), dependents wait, the plan stays open until the parent answers
  { const { spawn } = await import("node:child_process"), dir = mkdtempSyncSafe(), file = join(dir, "s.json"); { const st = new MStore(file); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.save(); }
    const tool = (args: string[]) => new Promise<any>((res) => { const p = spawn("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", HARNESS_MAX_INSTANCES: "20" } }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
    const tasks: PlanTask[] = [{ id: "r1", role: "researcher", objective: "ASKPARENT find the address of the beta site", output: "one line", boundaries: "read only" }, { id: "b1", role: "builder", objective: "write the beta page from the address", output: "file", boundaries: "one file", writes: ["beta.html"], deps: ["r1"] }];
    const sub = await tool(["plan_submit", "--tasks", JSON.stringify(tasks)]); await tool(["plan_run", "--plan", sub.plan_id]);
    const mid = await tool(["plan_status", "--plan", sub.plan_id, "--wait", "5"]), f1 = new MStore(file);
    t("NP6", "PLAN: the task whose agent asked is BLOCKED with its question (not done); the task that needs its answer has NOT started (no builder exists); the plan stays open",
      mid.status === "running" && mid.tasks.find((x: any) => x.id === "r1").status === "blocked" && /which address/.test(mid.tasks.find((x: any) => x.id === "r1").question) && mid.tasks.find((x: any) => x.id === "b1").status === "pending" && !f1.agentsOf("t").some((a) => a.name === "builder"), JSON.stringify(mid.tasks.map((x: any) => x.id + ":" + x.status)));
    const bad1 = await tool(["plan_answer", "--plan", sub.plan_id, "--item", "b1", "--text", "x"]), bad2 = await tool(["plan_answer", "--plan", sub.plan_id, "--item", "r1", "--text", "  "]);
    t("NP7", "answering is strict: a task that is not blocked cannot be answered, and an empty answer is refused", bad1.ok === false && /not blocked/.test(bad1.reason) && bad2.ok === false && /empty/.test(bad2.reason), JSON.stringify([bad1, bad2]).slice(0, 200));
    const ans = await tool(["plan_answer", "--plan", sub.plan_id, "--item", "r1", "--text", "use https://beta.example/new"]), fin = await settle(tool, sub.plan_id), f2 = new MStore(file);
    const r1calls = f2.calls.filter((c) => c.callee_agent_id === "researcher#1");
    t("NP8", "the parent answers with plan_answer: the SAME agent (researcher#1, session argument researcher#1) continues with 'ANSWER FROM YOUR PARENT' in its brief, then the waiting task runs and the plan completes",
      ans.ok === true && fin.status === "done" && r1calls.length === 2 && r1calls[1]!.session_arg === "researcher#1" && /ANSWER FROM YOUR PARENT[^]*beta\.example\/new/.test(String((r1calls[1]!.req as any).objective)) && f2.agentsOf("t").filter((a) => a.name === "researcher").length === 1, JSON.stringify(ans) + " plan=" + fin.status);
    rm(dir); }
}

// ---------------------------------------------------------------------------- locks, from the AGENT side: real agents, real Redis, a slow command
async function lockAgentsSuite() {
  setSuite("locks from the agents' side (REAL claude, REAL Redis, strict): A sleeps while holding a file, B must wait for it, C is refused when it reaches for it");
  const { spawn } = await import("node:child_process");
  const out = await withRedis(async (url) => {
    const repo = mkRepo({ "README.md": "locks\n" }), dir = mkdtempSyncSafe(), file = join(dir, "s.json"), logf = join(dir, "run.jsonl"), prefix = "la" + Math.random().toString(36).slice(2, 6);
    { const st = new MStore(file); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.save(); }
    const watch = RedisLocks.connect(url, prefix);
    const tool = (args: string[]) => new Promise<any>((res) => { const p = spawn("bun", ["--smol", join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: repo, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "real", HARNESS_LOCKS_URL: url, HARNESS_LOCKS_PREFIX: prefix, HARNESS_STRICT: "1", HARNESS_MAX_INSTANCES: "10", HARNESS_MAX_PROCS: "3", HARNESS_LOG: logf } }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { try { res(JSON.parse(o.trim().split("\n").pop()!)); } catch { res({ raw: o }); } }); });
    const D = (writes: string, objective: string) => ["delegate", "--role", "builder", "--session", "new", "--async", "--writes", writes, "--objective", objective, "--output", "short lines", "--boundaries", "only the files named"];
    try {
      const A = await tool(D("shared.txt", 'Run exactly this shell command and wait for it to finish: node -e "setTimeout(()=>{},9000)"   Then write the text A into shared.txt. Reply with one short line.'));
      const B = await tool(D("shared.txt", "Write the text B into shared.txt. Reply with one short line."));
      const C = await tool(D("c.txt", "Write the text one into c.txt. Then write the text two into shared.txt. If any write is refused, do NOT work around it: say which file was refused and the exact reason you were shown. Reply with two short lines."));
      t("LA1", "A starts (it holds shared.txt); B asks for the same file and is QUEUED behind A and does not start; C asks for a different file and starts at once",
        A.async === true && B.queued === true && (B.waiting_for ?? []).includes(A.agent_id) && C.async === true, JSON.stringify({ A: A.agent_id, B, C: C.agent_id }).slice(0, 300));
      await sleep(2500);
      const held = (await watch.holders("t")).map((h) => h.agent_id + ":" + h.path).sort().join(), fmid = new MStore(file);
      t("LA2", "while A is busy (2.5 s in) Redis shows exactly: A holds shared.txt, C holds c.txt, and B (waiting) holds nothing; the registry file holds no locks",
        held === `${A.agent_id}:shared.txt,${C.agent_id}:c.txt` && fmid.locks.length === 0 && !fmid.agentsOf("t").find((a) => a.agent_id === B.agent_id)?.session_id, held);
      const w = await tool(["wait", "--agents", [A.agent_id, B.agent_id, C.agent_id].join(","), "--timeout", "150"]);
      const f = new MStore(file), sp = (id: string) => trace.spans(f, "t").find((x) => x.agent_id === id)!, sA = sp(A.agent_id), sB = sp(B.agent_id), sC = sp(C.agent_id);
      t("LA3", "all three finish; A (the sleeper) and C ran AT THE SAME TIME (their spans overlap) because they needed different files", w.timed_out === false && w.agents.every((a: any) => a.status === "idle") && sC.start < sA.start + sA.ms && sA.start < sC.start + sC.ms, `A ${sA.ms} ms, C ${sC.ms} ms, C started ${sC.start - sA.start} ms after A`);
      t("LA4", "B started only AFTER A finished (the queue, not luck), and B then wrote last: shared.txt contains B", sB.start >= sA.start + sA.ms - 300 && readFileSync(join(repo, "shared.txt"), "utf8").trim() === "B", `B started ${sB.start - (sA.start + sA.ms)} ms after A ended; shared.txt=${JSON.stringify(readFileSync(join(repo, "shared.txt"), "utf8").trim())}`);
      const denied = f.events.filter((e) => e.kind === "edit.denied" && e.agent_id === C.agent_id), cReply = String(w.agents.find((a: any) => a.agent_id === C.agent_id)?.summary ?? "");
      t("LA5", "C reaching for shared.txt while A held it was REFUSED BY THE HOOK (an edit.denied event naming A as the holder), C wrote its own c.txt, and C reported the refusal instead of working around it",
        denied.some((e) => String(e.data?.file).includes("shared.txt") && e.data?.holder === A.agent_id) && existsSync(join(repo, "c.txt")) && /shared\.txt/i.test(cReply) && /lock|refus|denied|held/i.test(cReply), `denied=${denied.length} reply=${cReply.slice(0, 200).replace(/\n/g, " ")}`);
      const left = await watch.holders("t"), viol = f.violations();
      t("LA6", "afterwards: Redis holds nothing, strict mode saw no broken rule, and the whole thing cost under 15 cents", left.length === 0 && viol.length === 0 && f.reports.reduce((x, r) => x + r.cost, 0) < 0.15, `held=${left.length} violations=${viol.length} cost=$${f.reports.reduce((x, r) => x + r.cost, 0).toFixed(4)}`);
    } finally {
      if (process.env.LF_KEEP) { const ff = new MStore(file); console.log("KEPT for inspection: repo=" + repo + " store=" + file + " log=" + logf); for (const id of ["builder#1", "builder#2", "builder#3"]) { const ag = ff.agent("t", id); console.log("  " + id + " status=" + ag?.status + " final=" + JSON.stringify((ag?.final_response ?? "").slice(0, 300))); } for (const e of ff.events.filter((x) => /denied|needs_parent|lock\./.test(x.kind))) console.log("  event " + e.kind + " " + (e.agent_id ?? "") + " " + JSON.stringify(e.data ?? {}).slice(0, 160)); watch.close(); }
      else { watch.close(); rmSync(projectDirFor(repo), { recursive: true, force: true }); rm(repo); rm(dir); }
    }
    return true;
  });
  if (out === null) t("LA0", "redis-server can be started", false, "redis-server missing");
}

// ---------------------------------------------------------------------------- process slots
async function protoKitSuite() {
  const bstate = join(tmpdir(), "bstate-" + randomUUID().slice(0, 6) + ".json"), bstateSaved = process.env.HARNESS_BROWSER_STATE; process.env.HARNESS_BROWSER_STATE = bstate;   // a REAL saved browser connection is never read or changed by the tests
  setSuite("prototype starter kit: proto_init makes a working shell in a blink (no model call), proto_check understands it, nothing is invented by a builder");
  const nav = parseNav("Overview, Apps, Build>Logs, Build>Playground, Settings"), d = join(tmpdir(), "protokit-" + randomUUID().slice(0, 6));
  t("PK1", "parseNav: text and JSON both work, ids are slugs, 'Group>Label' groups screens into one file, icons are guessed, duplicates dropped",
    nav.length === 5 && nav[2]!.group === "Build" && nav[2]!.file === "build" && nav[0]!.file === "main" && nav[0]!.icon === "home" && parseNav('[{"label":"Auth configs"},"Auth configs"]').length === 1, JSON.stringify(nav.map((n) => [n.id, n.file])));
  const r = protoInit(d, { title: "Acme Admin", nav, rel: "run_test/acme" });
  t("PK2", "proto_init writes the shell (index.html, kit.css, kit.js, one screens file + one pages css per group, proto.json, PROTO.md) and says how to fork", r.ok && ["index.html", "css/kit.css", "js/kit.js", "js/screens/main.js", "js/screens/build.js", "css/pages-build.css", "proto.json", "PROTO.md"].every((f) => existsSync(join(d, f))) && r.next.includes("run_test/acme/js/screens/<file>.js"), JSON.stringify(r).slice(0, 200));
  const pc = protoCheck(d);
  t("PK3", "the untouched starter passes proto_check (every kit class used by kit.js exists, scripts parse, every screen is defined)", pc.ok, pc.problems.join(" | "));
  t("PK4", "starting a prototype twice is refused (a redo must edit the existing one, never overwrite it)", !protoInit(d, { title: "x", nav }).ok, "");
  const stub = readFileSync(join(d, "js/screens/main.js"), "utf8");
  t("PK5", "every nav item has a stub that says TODO (the preview smoke check refuses it until a builder replaces it)", nav.every((n) => stub.includes("Screens.") || readFileSync(join(d, `js/screens/${n.file}.js`), "utf8").includes("TODO")), "");
  writeFileSync(join(d, "js/screens/main.js"), stub.replace("Screens.Apps = {", "Screens.Apps = { template: '<div class=\"nope-class\">x</div>',"));
  t("PK6", "an unstyled class a builder invents is reported by proto_check", protoCheck(d).problems.some((x) => x.includes("nope-class")), "");
  rmSync(d, { recursive: true, force: true });
  // ---- the SITE kit (marketing / blog websites): themes, scroll animations, every page linked
  const sd = join(tmpdir(), "sitekit-" + randomUUID().slice(0, 6)), sr = protoInit(sd, { kind: "site", title: "Pingly", accent: "#10b981", font: "DM Sans", bgDark: "#0b0d10", nav: parseNav("Home, Features, Blog, Pricing, Get started"), extra: parseNav("Privacy, Terms"), rel: "run_test/pingly" });
  const html = sr.ok ? readFileSync(join(sd, "index.html"), "utf8") : "", pj = sr.ok ? JSON.parse(readFileSync(join(sd, "proto.json"), "utf8")) : { routes: [] }, ids: string[] = pj.routes.map((r: { id: string }) => r.id);
  t("PK7", "proto_init --kind site writes site.css, site.js, theme.css (accent, font, dark background), one stub per page (nav + extra), balanced files, proto.json kit=site", sr.ok && ["css/site.css", "js/site.js", "css/theme.css", "js/screens/part-1.js", "js/screens/part-2.js", "PROTO.md"].every((f) => existsSync(join(sd, f))) && readFileSync(join(sd, "css/theme.css"), "utf8").includes("#10b981") && readFileSync(join(sd, "css/theme.css"), "utf8").includes("#0b0d10") && html.includes("DM+Sans") && ids.length === 7 && pj.kit === "site", JSON.stringify(sr).slice(0, 160));
  const foot = [...html.matchAll(/"to":"([\w-]+)"/g)].map((m) => m[1]!);
  t("PK8", "the footer and the header button link ONLY to real routes, and every route is in the footer or the header (no page without a way in)", foot.length >= 6 && foot.every((x) => ids.includes(x)) && ids.every((x) => foot.includes(x) || html.includes(`"id":"${x}"`)), foot.join(","));
  t("PK9", "the untouched site starter passes proto_check", protoCheck(sd).ok, protoCheck(sd).problems.join(" | "));
  const { statSync } = await import("node:fs"), BIN = join(import.meta.dirname, "..", "harness", "bin"), cmds = ["proto_check", "proto_init", "browse", "ref_compare", "ref_capture"];   // "preview" has no bin script any more (replaced by bg_start / get_public_url)
  t("PK10", "every team command is a real executable on the agents' PATH (harness/bin): builders no longer hunt for `bun .../tools.ts` (it cost them ~6 steps)", cmds.every((c) => existsSync(join(BIN, c)) && (statSync(join(BIN, c)).mode & 0o111) !== 0 && readFileSync(join(BIN, c), "utf8").includes(`tools.ts" ${c}`)), "");
  if (chromeBin()) {
    const L = await browse({ url: `file://${sd}/index.html#/home`, outDir: sd, scheme: "light", steps: [{ outline: true }] }), D = await browse({ url: `file://${sd}/index.html#/home`, outDir: sd, scheme: "dark", steps: [{ outline: true }] });
    const lum = (c: string) => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(c) ?? []; return (+m[1]! + +m[2]! + +m[3]!) / 3; };
    t("PK11", "REAL BROWSER: the site follows the system theme (light bg bright, dark bg dark), no JavaScript error", !!L.outline && !!D.outline && lum(L.outline.theme.bg) > 200 && lum(D.outline.theme.bg) < 60 && L.console.length === 0, `${L.outline?.theme.bg} / ${D.outline?.theme.bg} ${L.console}`);
    const N = await browse({ url: `file://${sd}/index.html#/home`, outDir: sd, steps: [{ click: "Features" }, { eval: "location.hash" }, { click: "Switch to dark" }, { eval: "document.documentElement.getAttribute('data-theme')" }] });
    t("PK12", "REAL BROWSER: clicking a nav item opens that route, the toggle switches the theme (the browser driver can click, scroll and evaluate like a person)", JSON.stringify(N.results.map((x) => (x as { eval?: string }).eval).filter(Boolean)) === JSON.stringify(["#/features", "dark"]), JSON.stringify(N.results));
  } else t("PK11", "REAL BROWSER checks skipped: no Chrome on this machine", true, "");
  rmSync(sd, { recursive: true, force: true });
  // ---- the CONNECTED browser: a Chrome with a debug port that a person can see; agents attach to it, list its tabs, use a tab of their own (closed afterwards), or inspect one that is open
  if (chromeBin()) {
    const { spawn } = await import("node:child_process"), pd = join(tmpdir(), "cdpprof-" + randomUUID().slice(0, 6)), pg = join(tmpdir(), "cdppage-" + randomUUID().slice(0, 6) + ".html"), port = 9440 + Math.floor(Math.random() * 40), ep = `http://127.0.0.1:${port}`;
    writeFileSync(pg, "<title>Open page</title><h1>Logged-in page</h1>");
    const ch = spawn(chromeBin()!, ["--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", `--remote-debugging-port=${port}`, `--user-data-dir=${pd}`, "file://" + pg], { stdio: "ignore" }), saved = process.env.HARNESS_CDP_URL;
    try {
      for (let i = 0; i < 60; i++) { try { const tabs = (await bconn.sessions(ep)).tabs; if (tabs.some((x) => x.title === "Open page")) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 250)); }   // wait for the PAGE (its title), not only for the debug port
      delete process.env.HARNESS_CDP_URL; const before = await bconn.status();
      process.env.HARNESS_CDP_URL = ep; const st = await bconn.status();
      t("PK13", "connected browser: without an endpoint agents use the private headless Chrome; with one, browser_status says attached, names the browser and lists the open tabs", before.mode === "headless" && st.mode === "attached" && st.reachable === true && !!st.browser && (st.tabs ?? []).some((x) => x.title === "Open page"), JSON.stringify(st).slice(0, 160));
      const tabsBefore = (await bconn.sessions(ep)).tabs.length, r = await browse({ url: "file://" + pg, outDir: sd, steps: [{ eval: "document.title" }] }), tabsAfter = (await bconn.sessions(ep)).tabs.length;
      t("PK14", "browse through the connected browser opens its OWN tab, works, and closes it again (the person's tabs are left as they were)", r.ok && (r.results[0] as { eval?: string }).eval === "Open page" && tabsBefore === tabsAfter, `${tabsBefore} -> ${tabsAfter} ${r.reason ?? ""}`);
      t("PK29", "the result of a browse through the connected browser says so (via: connected), so a person is never left guessing which Chrome did the looking", r.via === "connected", String(r.via));
      const re = await browse({ url: "", tab: "Open page", outDir: sd, steps: [{ eval: "document.querySelector('h1').innerText" }] }), none = await browse({ url: "", tab: "no-such-tab-xyz", outDir: sd, steps: [] });
      t("PK15", "browse --tab attaches to a tab that is ALREADY open (reads its page without navigating) and says clearly when no tab matches", re.ok && (re.results[0] as { eval?: string }).eval === "Logged-in page" && !none.ok && /no open tab matches/.test(none.reason ?? ""), `${JSON.stringify(re.results)} ${none.reason}`);
      const cfgFile = bstate;
      delete process.env.HARNESS_CDP_URL; writeFileSync(cfgFile, JSON.stringify({ endpoint: ep, enabled: true })); const on = bconn.attachedEndpoint(); await bconn.toggle(false); const off = bconn.attachedEndpoint(), offSt = await bconn.status(); await bconn.toggle(true); const on2 = bconn.attachedEndpoint();
      rmSync(cfgFile, { force: true });
      t("PK17", "the on/off toggle: OFF = agents use the private headless Chrome (the connection is remembered and says so), ON = the connected browser again", on === ep && off === undefined && offSt.mode === "headless" && /switched OFF/.test(offSt.note) && on2 === ep, `${on} ${off} ${on2}`);
      process.env.HARNESS_CDP_URL = "http://127.0.0.1:9"; const dead = await bconn.status(), fb = await browse({ url: "file://" + pg, outDir: sd, steps: [{ eval: "document.title" }] });
      t("PK16", "a connected browser that stops answering is reported (not reachable) and agents fall back to the private headless Chrome instead of failing, and the result SAYS which browser did the work (via)", dead.mode === "attached" && dead.reachable === false && fb.ok && fb.via === "headless" && fb.console.some((x) => x.includes("does not answer")), JSON.stringify(dead).slice(0, 120));
    } finally { if (saved === undefined) delete process.env.HARNESS_CDP_URL; else process.env.HARNESS_CDP_URL = saved; ch.kill("SIGKILL"); rmSync(pd, { recursive: true, force: true }); rmSync(pg, { force: true }); }
  }
  // ---- the LOOKUP agent (UI/UX reference analyst) and its asset puller
  const ad = join(tmpdir(), "refassets-" + randomUUID().slice(0, 6)); mkdirSync(ad, { recursive: true });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const srv = Bun.serve({ port: 0, fetch: (q) => { const u = new URL(q.url).pathname; return u.endsWith(".png") && !u.includes("missing") ? new Response(png, { headers: { "content-type": "image/png" } }) : new Response("nope", { status: 404 }); } });
  writeFileSync(join(ad, "page.html"), `<link rel="icon" href="/fav.png"><meta property="og:image" content="/og.png"><img src="/logo.png" alt="Brand logo"><img src="/hero.png" alt="Hero shot"><img src="/missing.png" alt="gone">`); writeFileSync(join(ad, "styles.css"), `.x{background:url(/bg.png)}`);
  const ra = await refAssets({ dir: ad, url: `http://127.0.0.1:${srv.port}/` }) as { ok: boolean; downloaded?: number; assets?: string[] }, man = JSON.parse(readFileSync(join(ad, "assets.json"), "utf8")) as { assets: { role: string; width?: number }[]; skipped: string[] };
  srv.stop(true);
  t("PK18", "ref_assets pulls logo, hero image, favicon, social image and css background into assets/ with roles and pixel sizes, and reports (not crashes on) a missing file", ra.ok && ra.downloaded === 5 && ["logo", "favicon", "social-preview", "css-background", "image"].every((r) => man.assets.some((a) => a.role === r)) && man.assets.every((a) => a.width === 1) && man.skipped.length === 1, JSON.stringify(ra).slice(0, 200));
  rmSync(ad, { recursive: true, force: true });
  // ---- the reference STORE (fixed layout, mind map) and the SITE AUDIT of our own pages
  const rs = join(tmpdir(), "refstore-" + randomUUID().slice(0, 6)); initStore(rs);
  writeFileSync(join(rs, "outline.json"), JSON.stringify({ url: "https://x.test/", title: "X site", theme: { scheme: "light", bg: "rgb(255, 255, 255)", color: "rgb(0,0,0)", font: "DM Sans", accent: "rgb(16, 185, 129)" }, doc_h: 3000, nav: ["Home -> /"], fonts: [], keyframes: [], scrollReveal: true, links: [], sections: [{ i: 0, tag: "section", id: "hero", y: 0, h: 800, heading: "Big promise", headings: 1, bg: "rgb(255,255,255)", color: "", font: "DM Sans", h_size: "64px", h_weight: "700", buttons: ["Start"], links: 3, images: 2, cards: 0, lists: 0, forms: 0, inputs: 0, animated: true, radius: "", text: "Big promise ..." }, { i: 1, tag: "section", id: "feat", y: 800, h: 900, heading: "Features", headings: 2, bg: "rgb(247,248,250)", color: "", font: "DM Sans", h_size: "40px", h_weight: "700", buttons: [], links: 0, images: 6, cards: 6, lists: 0, forms: 0, inputs: 0, animated: false, radius: "16px", text: "Features" }] }));
  writeFileSync(join(rs, "assets.json"), JSON.stringify({ assets: [{ file: "assets/logo/01-logo.png", role: "logo" }, { file: "assets/images/02-hero.webp", role: "image", width: 800, height: 600 }] })); writeFileSync(join(rs, "briefs", "BRIEF.md"), "x"); writeFileSync(join(rs, "layouts", "home.md"), "x");
  buildStore(rs, "x"); const mm = readFileSync(join(rs, "MAP.md"), "utf8"), st = readFileSync(join(rs, "STORE.md"), "utf8");
  t("PK20", "the reference store has a fixed layout (pictures/ raw/ assets/<role>/ layouts/ briefs/), a generated mind map (tree + Mermaid mindmap: sections, components, pictures, assets, layouts, briefs) and an index that says where everything is", ["pictures", "raw", "assets", "layouts", "briefs"].every((d) => existsSync(join(rs, d))) && mm.includes("```mermaid") && mm.includes("mindmap") && mm.includes("pictures/desktop-light-section-02.png") && mm.includes("6-item grid/list") && mm.includes("assets/logo/01-logo.png") && mm.includes("layouts/home.md") && mm.includes("briefs/BRIEF.md") && st.includes("MAP.md") && st.includes("assets/") && st.includes("../_ref/x/assets/"), mm.slice(0, 200));
  rmSync(rs, { recursive: true, force: true });
  if (chromeBin()) {
    const bad = join(tmpdir(), "audit-bad-" + randomUUID().slice(0, 6) + ".html"), good = join(tmpdir(), "audit-good-" + randomUUID().slice(0, 6) + ".html"), ao = join(tmpdir(), "audit-out-" + randomUUID().slice(0, 6));
    writeFileSync(bad, `<html><body style="margin:0"><p style="color:#bbb;background:#fff;font-size:16px">Pale grey text that nobody can read</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40"><a href="#">Go nowhere</a><h2>Skipped</h2><h4>Heading levels</h4><div style="width:900px;height:20px;background:#eee">wide</div></body></html>`);
    writeFileSync(good, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A clean page for the audit</title><meta name="description" content="A clean page with every basic in place."><style>body{margin:0;font:16px system-ui;color:#101828;background:#fff}main{padding:24px;max-width:600px}a{color:#175cd3}</style></head><body><main><h1>Clean page</h1><p>Readable text with strong contrast on a plain background.</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="decorative dot" width="20" height="20"><p><a href="https://example.com/">A real link</a></p></main></body></html>`);
    const rb = await siteAudit({ base: "file://" + bad, routes: [], outDir: ao, name: "bad" }) as { score: number; high: number; top: string[] }, rg = await siteAudit({ base: "file://" + good, routes: [], outDir: ao, name: "good" }) as { score: number; high: number; medium: number };
    const md = readFileSync(join(ao, "AUDIT.md"), "utf8");
    t("PK21", "site_audit (real browser) flags planted defects (low contrast, missing alt / lang / viewport / title, dead link, skipped headings, phone overflow) and passes a clean page", rb.high >= 2 && rb.score < 70 && rg.high === 0 && rg.medium === 0 && rg.score >= 90, `bad ${rb.score}/${rb.high} high; good ${rg.score}`);
    const cm = join(tmpdir(), "audit-cm-" + randomUUID().slice(0, 6) + ".html");
    writeFileSync(cm, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colour formats for the audit</title><meta name="description" content="x"><style>body{margin:0;font:16px system-ui;background:#fff}.ok{background:color-mix(in srgb,#10b981 66%,#000);color:#fff;padding:12px;display:inline-block}.bad{background:color-mix(in srgb,#10b981 90%,#fff);color:#fff;padding:12px;display:inline-block}</style></head><body><main><h1>Colour formats</h1><p><span class="ok">Passing button text</span></p><p><span class="bad">Failing button text</span></p></main></body></html>`);
    const rc = await siteAudit({ base: "file://" + cm, routes: [], outDir: ao, name: "cm" }) as { top: string[] }, mdc = readFileSync(join(ao, "AUDIT.md"), "utf8");
    t("PK27", "contrast is read through the browser's own colour normalisation: a color-mix() button that passes (white on a dark green, 5+:1) is NOT flagged, one that really fails (white on a pale green) IS (a hand-written parser once reported a passing button as 1.0:1 and cost two fix rounds)", /Failing button text/.test(mdc) && !/Passing button text/.test(mdc), mdc.slice(0, 260).replace(/\n/g, " "));
    rmSync(cm, { force: true });
    rmSync(bad, { force: true }); rmSync(good, { force: true }); rmSync(ao, { recursive: true, force: true });
  }
  if (chromeBin()) {   // contact sheets: 4 section pictures per image, one browser for all of them, so a lookup agent Reads 3 images instead of 12
    const cs = join(tmpdir(), "sheets-" + randomUUID().slice(0, 6)); mkdirSync(cs, { recursive: true });
    const tiny = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    for (let i = 1; i <= 6; i++) writeFileSync(join(cs, `desktop-light-section-${String(i).padStart(2, "0")}.png`), tiny);
    const t0s = Date.now(), n = await contactSheets(cs), took = Date.now() - t0s;
    t("PK23", "contact sheets: 6 section pictures become 2 overview images (4 + 2), made in ONE browser in a few seconds, the temporary html is removed", n === 2 && existsSync(join(cs, "overview-1.png")) && existsSync(join(cs, "overview-2.png")) && statSync(join(cs, "overview-1.png")).size > 200 && !existsSync(join(cs, "_sheets.html")) && took < 15_000, `${n} sheets in ${took} ms`);
    rmSync(cs, { recursive: true, force: true });
  }
  if (chromeBin()) {   // clean capture: consent dialogs, promo / bottom bars, chat widgets, ad slots, modal backdrops are gone before a picture is taken; a fixed header shows once; no scrollbar
    const mp = join(tmpdir(), "messy-" + randomUUID().slice(0, 6) + ".html"), mo = join(tmpdir(), "messyout-" + randomUUID().slice(0, 6));
    writeFileSync(mp, `<!doctype html><title>m</title><style>body{margin:0}header{position:fixed;top:0;left:0;right:0;height:60px;background:#123}.sec{height:900px}.cookie-banner{position:fixed;left:0;right:0;bottom:0;height:90px;background:#222}.promo-bar{position:fixed;top:60px;left:0;right:0;height:40px;background:#f60;z-index:50}#chat-widget{position:fixed;right:20px;bottom:110px;width:60px;height:60px;background:#09f;z-index:98}.ads-slot{position:fixed;right:0;top:200px;width:160px;height:300px;background:#ccc;z-index:60}.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200}</style><header>H</header><div class="promo-bar">sale</div><div class="sec"><h1>Real content</h1></div><div class="sec"></div><div class="cookie-banner" id="cookie-consent">We use cookies <button onclick="document.getElementById('cookie-consent').remove()">Accept all</button></div><div id="chat-widget"></div><div class="ads-slot"></div><div class="backdrop" aria-modal="true"></div>`);
    const cr = await browse({ url: "file://" + mp, outDir: mo, clean: true, steps: [{ eval: "JSON.stringify({sb: innerWidth - document.documentElement.clientWidth, hdr: getComputedStyle(document.querySelector('header')).position, cookie: !!document.getElementById('cookie-consent'), promo: getComputedStyle(document.querySelector('.promo-bar')).display, chat: getComputedStyle(document.getElementById('chat-widget')).display, ads: getComputedStyle(document.querySelector('.ads-slot')).display, bd: getComputedStyle(document.querySelector('.backdrop')).display})" }] }), st = JSON.parse((cr.results[0] as { eval: string }).eval) as Record<string, unknown>, raw = await browse({ url: "file://" + mp, outDir: mo, clean: false, steps: [{ eval: "getComputedStyle(document.querySelector('.backdrop')).display" }] });
    t("PK24", "clean capture removes the cookie dialog (accepts it), promo bar, chat widget, ad slot and modal backdrop, pins the fixed header in the flow, hides the scrollbar, and says what it did; with clean off nothing is touched", st.sb === 0 && st.hdr === "absolute" && st.cookie === false && st.promo === "none" && st.chat === "none" && st.ads === "none" && st.bd === "none" && (cr.cleaned ?? []).length >= 5 && (raw.results[0] as { eval?: string }).eval === "block", JSON.stringify(st) + " " + JSON.stringify(cr.cleaned));
    rmSync(mp, { force: true }); rmSync(mo, { recursive: true, force: true });
  }
  { // site_build: the pipeline of a website clone is GENERATED by the harness (design + brief + builder per screens file, a builder depends only on its own brief), validated by the plan runner, nothing started in a dry run
    const wd = join(tmpdir(), "sitebuild-" + randomUUID().slice(0, 6)); mkdirSync(join(wd, "run_test", "_ref", "x"), { recursive: true }); writeFileSync(join(wd, "run_test", "_ref", "x", "STORE.md"), "x");
    protoInit(join(wd, "run_test", "demo"), { kind: "site", title: "Demo", nav: parseNav("Home, Blog, Features, Download, About"), rel: "run_test/demo" });
    const sf = join(wd, "store.json"), TOOLS = join(import.meta.dirname, "..", "harness", "tools.ts");
    const run = spawnSync("bun", ["--smol", TOOLS, "site_build", "--dir", "run_test/demo", "--ref", "x", "--request", "a clone for testing"], { encoding: "utf8", env: { ...process.env, HARNESS_STORE: sf, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: wd, HARNESS_PLAN_DRY: "1", HARNESS_MAX_DEPTH: "4" } });
    let o: { ok?: boolean; tasks?: string[]; waves?: string[][]; errors?: string[] } = {}; try { o = JSON.parse(run.stdout.trim().split("\n").pop() ?? "{}"); } catch { /* shown below */ }
    const names = o.tasks ?? [], w0 = (o.waves ?? [])[0] ?? [];
    t("PK25", "site_build generates the whole pipeline: per screens file ONE lookup call and a builder that depends ONLY on its own brief (5 pages = 3 files = 6 tasks: the design system is written by the first brief call), the first wave starts all lookup calls together, builders come in the next wave", o.ok === true && names.length === 6 && names.filter((x) => x.startsWith("brief-") && x.includes("(lookup")).length === 3 && names.filter((x) => x.includes("(builder after brief-part-")).length === 3 && w0.filter((x) => x.startsWith("brief-")).length === 3 && !w0.some((x) => x.startsWith("build-")), (o.errors ?? []).join(" | ") + " " + names.join(" ; ") + " " + JSON.stringify(o.waves) + run.stderr.slice(0, 150));
    rmSync(wd, { recursive: true, force: true });
  }
  { // the guard: a WEBSITE project refuses a lone builder until the pipeline exists (a real run skipped the lookup "to stay fast"); the routing table and the agent descriptions are the first thing the lead reads
    const gd = join(tmpdir(), "siteguard-" + randomUUID().slice(0, 6)); mkdirSync(join(gd, "run_test"), { recursive: true });
    protoInit(join(gd, "run_test", "demo"), { kind: "site", title: "Demo", nav: parseNav("Home, Blog, About"), rel: "run_test/demo" });
    mkdirSync(join(gd, "run_test", "_ref", "x"), { recursive: true }); writeFileSync(join(gd, "run_test", "_ref", "x", "STORE.md"), "x");   // a reference was captured: now a clone is built by the pipeline
    const gr = spawnSync("bun", ["--smol", join(import.meta.dirname, "..", "harness", "tools.ts"), "delegate", "--role", "builder", "--session", "new", "--writes", "run_test/demo/js/screens/main.js", "--objective", "build it", "--output", "x", "--boundaries", "y"], { encoding: "utf8", env: { ...process.env, HARNESS_STORE: join(gd, "s.json"), HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: gd, HARNESS_MAX_DEPTH: "4" } });
    let go: { ok?: boolean; reason?: string } = {}; try { go = JSON.parse(gr.stdout.trim().split("\n").pop() ?? "{}"); } catch { /* shown */ }
    const lp2 = readFileSync(join(AGENTS_DIR, "lead", ".claude", "CLAUDE.md"), "utf8"), head = lp2.slice(0, 3500), descs = ["lookup", "lookup", "researcher", "builder", "ux-designer"].map((n) => defs.get(n)?.description ?? "");
    t("PK26", "a lone builder for a CLONE project (a reference store exists) is refused with the exact command to run (site_build); the lead's prompt STARTS with a routing table (recipe SITE / APP / BUILD / FACTS and the agents with when-to-use) and the agent descriptions say when to use and when NOT to", go.ok === false && /site_build/.test(go.reason ?? "") && /PIPELINE/.test(go.reason ?? "") && head.includes("ROUTING") && head.includes("RECIPE CLONE") && head.includes("RECIPE APP") && head.includes("never skip a step") && /USE WHEN/.test(descs[0]!) && /NOT for/.test(descs[2]!) && /NOT for/.test(descs[4]!) && /site_build/.test(descs[3]!), `${go.reason?.slice(0, 80)} | head ${head.length}`);
    rmSync(gd, { recursive: true, force: true });
  }
  const lk = defs.get("lookup"), ld = defs.get("lead"), lp = readFileSync(join(AGENTS_DIR, "lookup", ".claude", "CLAUDE.md"), "utf8"), leadP = readFileSync(join(AGENTS_DIR, "lead", ".claude", "CLAUDE.md"), "utf8"), bp = readFileSync(join(AGENTS_DIR, "builder", ".claude", "CLAUDE.md"), "utf8");
  t("PK19", "ONE lookup agent (no separate worker role): a writer that lists itself so it may split a big job across copies of itself (at most 3), the lead may call it, the lookup-page role is gone, the researcher stays text based, builders are told the brief is their complete context", !!lk && lk.writes === true && lk.agents.join() === "lookup" && lk.max_children === 3 && !defs.has("lookup-page") && !!ld && ld.agents.includes("lookup") && !ld.agents.includes("lookup-page") && lp.includes("fork_all --role lookup") && lp.includes("wait --any") && lp.includes("DO IT YOURSELF") && lp.includes("BRIEF_<file>.md") && leadP.includes("site_build") && bp.includes("do NOT run `ref_capture`") && !(defs.get("researcher")?.tools ?? []).includes("Bash"), `${lk?.agents} ${lk?.max_children}`);
  // splitting without deadlock: the coordinator declares only ITS OWN two files, every worker its own disjoint files, so all start at once; a coordinator that declared the whole folder would lock its workers out (queue)
  { const ls = new MStore(), N2 = Date.now(), A = (ag: string, id: string, paths: string[]) => acquire(ls, { task_id: "t", agent_id: ag, call_id: id, paths, ttlMs: 60_000, now: N2 }), R = "run_test/_ref/x/";
    const c = A("lookup#1", "c0", [R + "briefs/BRIEF.md", R + "layouts/_overview.md"]), w1 = A("lookup-page#1", "c1", [R + "briefs/BRIEF_part-1.md", R + "layouts/home.md", R + "layouts/features.md"]), w2 = A("lookup-page#2", "c2", [R + "briefs/BRIEF_part-2.md", R + "layouts/blog.md"]);
    const ls2 = new MStore(), wide = acquire(ls2, { task_id: "t", agent_id: "lookup#1", call_id: "c0", paths: [R + "**"], ttlMs: 60_000, now: N2 }), blocked = acquire(ls2, { task_id: "t", agent_id: "lookup-page#1", call_id: "c1", paths: [R + "layouts/home.md"], ttlMs: 60_000, now: N2 });
    t("PK22", "the lookup coordinator and its parallel workers hold disjoint files and ALL start at once (no queue); the same job under a whole-folder lock would block every worker (which is why the lead gives the coordinator only its own two files)", c.ok && w1.ok && w2.ok && wide.ok && !blocked.ok, `${c.ok} ${w1.ok} ${w2.ok} wide-then-worker ok=${blocked.ok}`); }
  rmSync(sd, { recursive: true, force: true }); rmSync(bstate, { force: true }); if (bstateSaved === undefined) delete process.env.HARNESS_BROWSER_STATE; else process.env.HARNESS_BROWSER_STATE = bstateSaved;
}
async function slotsSuite() {
  setSuite("process slots: a waiting lead never takes a worker's place; time spent waiting for a slot is visible in the log (stand-in CLI with a delay)");
  const { writeFileSync: wf, chmodSync } = await import("node:fs");
  const home = mkdtempSyncSafe(), bin = mkdtempSyncSafe(), saved = { HOME: process.env.HOME, PATH: process.env.PATH, MAX: process.env.HARNESS_MAX_PROCS, CFG: process.env.CLAUDE_CONFIG_DIR };
  wf(join(bin, "claude"), `#!/bin/sh\nexec bun --smol ${join(import.meta.dirname, "fake_claude.ts")} "$@"\n`); chmodSync(join(bin, "claude"), 0o755);
  process.env.HOME = home; delete process.env.CLAUDE_CONFIG_DIR; process.env.PATH = bin + ":" + process.env.PATH; process.env.HARNESS_MAX_PROCS = "3";
  try {
    const mk = () => { const w = world(); return { w, ctx: { store: w.store, runner: new RealRunner(30_000), defs, sessionCap: 20 } }; };
    const run = (m: ReturnType<typeof mk>, name: string, ms: number) => { const row = m.w.store.addAgent("t", defs.get(name)!, { level: 2, caller: "lead#1" }); return callAgent(m.ctx, row, home, () => "work", undefined, { intent: "new" }, { env: { FAKE_CLAUDE_DELAY_MS: String(ms) } }); };
    const waits = (m: ReturnType<typeof mk>) => m.w.store.events.filter((e) => e.kind === "agent.done" && e.agent_id !== "lead#1").map((e) => Number(e.data?.waited_ms ?? -1));
    { const m = mk(), t0 = Date.now();
      const lead = callAgent(m.ctx, m.w.store.agent("t", "lead#1")!, home, () => "plan", undefined, { intent: "new" }, { env: { FAKE_CLAUDE_DELAY_MS: "3500" } });   // the lead holds a process for its whole (mostly waiting) turn
      await sleep(400);
      const outs = await Promise.all([run(m, "researcher", 1200), run(m, "researcher", 1200), run(m, "researcher", 1200)]), took = Date.now() - t0 - 400; await lead;
      t("SL1", "a waiting lead does NOT take a worker's slot: with a lead running, three workers (cap 3) all start at once (none waits), and the three together take about one task-time, not three",
        outs.every((o) => o.ok) && waits(m).every((x) => x >= 0 && x < 500) && took < 2800, `waited_ms=${waits(m)} three workers took ${took} ms`); }
    { const m = mk(), outs = await Promise.all([run(m, "researcher", 1500), run(m, "researcher", 1500), run(m, "researcher", 1500), run(m, "researcher", 1500)]), w = waits(m).sort((x, y) => x - y);
      t("SL2", "the cap still holds for workers (3 at a time): a fourth waits for a free slot, and the wait is RECORDED on its agent.done event (waited_ms) so a hidden delay shows up in the log and the summary",
        outs.every((o) => o.ok) && w[0]! < 500 && w[2]! < 500 && w[3]! >= 900 && trace.renderSummary(m.w.store, "t").includes("waited for a process slot"), `waited_ms sorted=${w}`); }
  } finally { process.env.HOME = saved.HOME; process.env.PATH = saved.PATH; if (saved.CFG === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved.CFG; if (saved.MAX === undefined) delete process.env.HARNESS_MAX_PROCS; else process.env.HARNESS_MAX_PROCS = saved.MAX; rm(home); rm(bin); }
}

// ---------------------------------------------------------------------------- the master (lead) and the PM are conversations: found in real UI sessions
async function mastersSuite() {
  setSuite("masters: the lead and the PM keep their conversation (high resume cap; after a reset they get the record), role names and agent names both work");
  const lead = defs.get("lead")!, pmd = defs.get("pm")!, res = defs.get("researcher")!;
  t("MS1", "the lead and the project manager are conversations, not tasks: their resume cap is far above a worker's (a real session rolled the lead on its 5th message with a cap of 3 and the lead told the person it had lost track)", (lead.session_cap ?? 0) >= 40 && (pmd.session_cap ?? 0) >= 40 && res.session_cap === undefined, `lead=${lead.session_cap} pm=${pmd.session_cap} researcher=${res.session_cap}`);
  { const w = world(), rn = new ScriptRunner(() => "ok"), ctx = { store: w.store, runner: rn, defs, sessionCap: 3 };   // the caller's cap is 3, like the UI
    const leadRow = w.store.agent("t", "lead#1")!, wrow = w.store.addAgent("t", res, { level: 2, caller: "lead#1" });
    for (let i = 0; i < 6; i++) { await callAgent(ctx, w.store.agent("t", "lead#1")!, tmpdir(), () => "turn " + i, undefined, { intent: i ? "resume" : "new" }); await callAgent(ctx, w.store.agent("t", wrow.agent_id)!, tmpdir(), () => "work " + i, undefined, { intent: i ? "resume" : "new" }); }
    const rolled = w.store.evs("session.rolled").map((e) => e.agent_id);
    t("MS2", "with the ui's cap of 3: six turns later the LEAD was never rolled (it keeps one session), while a worker was rolled at the 4th resume as designed", !rolled.includes("lead#1") && rolled.includes("researcher#1") && leadRow.session_id === w.store.agent("t", "lead#1")!.session_id, `rolled=${rolled}`); }
  { const w = world(); const st = w.store; say(st, "t", "user", "lead", "can you build a hello world page"); say(st, "t", "lead", "user", "I made index.html"); say(st, "t", "user", "lead", "how many lines does it have?");
    const blk = conversationBlock(st, "t", "how many lines does it have?");
    t("MS3", "if a master IS reset (or is new in a store that already has a chat), its brief carries the conversation from the record (not the message being answered), so it does not start blank", /THE CONVERSATION SO FAR/.test(blk) && /person: can you build a hello world page/.test(blk) && /you: I made index.html/.test(blk) && !/how many lines/.test(blk), blk); }
  { // the shipped definitions now use the same word for an agent's name and its role (another session made them equal after a real "unknown_role: build" refusal);
    // the alias stays as a safety net for any definition where they differ, so build the case with role words that differ from the names
    const split = new Map([...defs].map(([k, d]) => [k, { ...d, ...(k === "lead" ? { custom: false } : {}), role: ({ researcher: "research", builder: "build", planner: "plan", "qa-reviewer": "qa-review" } as Record<string, string>)[k] ?? d.role }]));
    const w = world({}, split); w.lead.status = "running";
    const byRole = agentCall(w.store, w.d, w.policy, { ...base, role: "research" }), byName = agentCall(w.store, w.d, w.policy, { ...base, role: "researcher" }), wrong = agentCall(w.store, w.d, w.policy, { ...base, role: "wizard" });
    t("MS4", "a call by ROLE word (\"research\") works like a call by agent NAME (\"researcher\") where the two differ, and a truly wrong name is refused and told the valid names; the shipped definitions use one word for both",
      byRole.ok && byRole.agent.name === "researcher" && byName.ok && !wrong.ok && /Use one of: researcher, (lookup, )?planner, builder, (ux-designer, )?qa-reviewer/.test(wrong.reason) && [...defs.values()].every((d) => d.role === d.name || d.name === "lead" || d.name === "pm"), `${byRole.ok ? byRole.agent.name : byRole.reason} | ${wrong.ok ? "" : wrong.reason} | roles=${[...defs.values()].map((d) => d.name + ":" + d.role)}`); }
  { // custom sub-agents: a role with no folder, called with a title
    const w = world({}); w.lead.status = "running";
    const noTitle = agentCall(w.store, w.d, w.policy, { ...base, role: "market-researcher" });
    const withTitle = agentCall(w.store, w.d, w.policy, { ...base, role: "market-researcher", title: "compares three bundlers" });
    const again = agentCall(w.store, w.d, w.policy, { ...base, role: "market-researcher", title: "compares three bundlers", session_arg: "market-researcher#1" });
    const badName = agentCall(w.store, w.d, w.policy, { ...base, role: "Bad Name!", title: "x" });
    const decoyW = world({}, new Map([...defs, ["decoy", { ...defs.get("researcher")!, name: "decoy", role: "decoy", forbidden: true }]])); decoyW.lead.status = "running";   // a distractor agent, made here: no such folder ships any more
    const poet = agentCall(decoyW.store, decoyW.d, decoyW.policy, { ...base, role: "decoy" });
    const plain = world({}, new Map([...defs].filter(([, d]) => !d.ad_hoc).map(([k, d]) => [k, k === "lead" ? { ...d, custom: false } : d]))); plain.lead.status = "running";
    const refused = agentCall(plain.store, plain.d, plain.policy, { ...base, role: "market-researcher", title: "x" });
    t("CU1", "a lead marked custom can call a role with no folder: without --title it is refused and told to give one; with a title the agent is made, named and titled, read-only; continuing it works; a bad name is refused; a lead not marked custom still gets unknown_role",
      !noTitle.ok && /title_required/.test(noTitle.reason) && withTitle.ok && withTitle.agent.name === "market-researcher" && withTitle.agent.title === "compares three bundlers" && w.d.get("market-researcher")?.ad_hoc === true && w.d.get("market-researcher")?.writes === false
      && again.ok && again.kind === "resume" && !badName.ok && /bad_custom_name/.test(badName.reason) && !refused.ok && /unknown_role/.test(refused.reason),
      [noTitle, withTitle, again, badName, refused].map((x) => (x.ok ? "ok" : x.reason.slice(0, 60))).join(" | "));
    t("CU2", "a distractor agent (agent.json forbidden) is refused with code forbidden and an event is logged; a custom agent given --writes becomes a writer with write tools",
      !poet.ok && /forbidden/.test(poet.reason) && decoyW.store.events.some((e) => e.kind === "guard.forbidden") && customDef("scribe", "writes notes", true).writes === true && customDef("scribe", "writes notes", true).tools.includes("Write") && !customDef("scribe", "x", false).tools.includes("Write"), poet.ok ? "poet was accepted" : poet.reason); }
  { const txt = readFileSync(join(AGENTS_DIR, "lead", ".claude", "CLAUDE.md"), "utf8");
    t("MS5", "the lead's prompt carries the rules the real sessions called for: count what the person lists (one agent per item, cover each plausible reading), 'ask <agent>' means continue THAT agent, role value is the exact name, keep internals out of the answer", /COUNT what the person lists/.test(txt) && /MUST continue that agent/.test(txt) && /exact name/.test(txt) && /keep internal detail/.test(txt), ""); }
}

async function offlineParallel() {
  setSuite("offline: parallel delegation, the shared store under load, the queue driver, nested calls, apply_patches");
  const { spawn } = await import("node:child_process");
  const dir = mkdtempSyncSafe(), file = join(dir, "store.json");
  const tool = (args: string[], env: Record<string, string> = {}) => new Promise<{ json: any; ms: number }>((res) => {
    const t0 = Date.now(), p = spawn("bun", [join(HARNESS_DIR, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: file, HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: dir, HARNESS_MAX_DEPTH: "4", HARNESS_RUNNER: "fake", HARNESS_MAX_INSTANCES: "8", ...env } });
    let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => { let json: any; try { json = JSON.parse(o.trim().split("\n").pop()!); } catch { json = { raw: o }; } res({ json, ms: Date.now() - t0 }); });
  });
  const seed = () => { const st = new MStore(file); const l = st.addAgent("t", defs.get("lead")!, { level: 1 }); l.status = "running"; st.addAgent("t", defs.get("researcher")!, { level: 2, caller: "lead#1" }); st.save(); };
  seed();
  const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => tool(["say", "--to", "researcher#1", "--text", "note " + i])));
  const st0 = new MStore(file);
  t("M10", "the shared store under load: 8 processes writing at once lose NOTHING (before the transaction lock this lost one: 7 of 8)", rs.every((r) => r.json.ok) && st0.notes.length === 8 && new Set(st0.notes.map((n) => n.text)).size === 8, `notes=${st0.notes.length} texts=${[...new Set(st0.notes.map((n) => n.text))].join("|")} results=${JSON.stringify(rs.map((r) => [r.json.ok ?? false, r.ms, String(r.json.reason ?? r.json.raw ?? "").slice(0, 80)]))}`);

  const F = ["--objective", "o", "--output", "x", "--boundaries", "b"], DELAY = { HARNESS_FAKE_DELAY_MS: "2000" };
  const t0 = Date.now();
  const started = await Promise.all([1, 2, 3].map(() => tool(["delegate", "--role", "researcher", "--session", "new", "--async", ...F], DELAY)));
  const startedMs = Date.now() - t0;
  const ids = started.map((x) => x.json.agent_id as string);
  const w = await tool(["wait", "--agents", ids.join(","), "--timeout", "30"], DELAY);
  const wall = Date.now() - t0, st1 = new MStore(file), sp = trace.spans(st1, "t").filter((x) => ids.includes(x.agent_id)), sum = sp.reduce((a, b) => a + b.ms, 0);
  const starts = sp.map((x) => x.start), spread = Math.max(...starts) - Math.min(...starts);
  t("M11", "parallel delegation: 3 async calls return at once (before any callee finishes), run at the same time (starts within 1.5 s, summed agent time ~3x the wall), and wait returns all three answers",
    started.every((x) => x.json.async && x.json.status === "running") && startedMs < 1900 && w.json.timed_out === false && w.json.agents.length === 3 && w.json.agents.every((a: any) => a.status === "idle" && /FAKE REPLY/.test(a.summary)) && spread < 1500 && sum > wall * 1.6 && wall < 5500,
    `start calls returned in ${startedMs} ms; all done after ${wall} ms; summed agent time ${sum} ms; start spread ${spread} ms; ids ${ids}`);
  const sequentialWouldBe = 3 * 2000; t("M11b", "so parallel beats sequential for independent work (a 2 s job x 3)", wall < sequentialWouldBe, `wall ${wall} ms vs sequential >= ${sequentialWouldBe} ms`);

  const W = ["--role", "builder", "--session", "new", "--async", "--writes", "page.html", ...F];
  const b1 = await tool(["delegate", ...W], { HARNESS_FAKE_DELAY_MS: "1500" }), b2 = await tool(["delegate", ...W], { HARNESS_FAKE_DELAY_MS: "1500" });
  const bw = await tool(["wait", "--agents", [b1.json.agent_id, b2.json.agent_id].join(","), "--timeout", "30"]);
  const st2 = new MStore(file), s1 = trace.spans(st2, "t").find((x) => x.agent_id === b1.json.agent_id)!, s2 = trace.spans(st2, "t").find((x) => x.agent_id === b2.json.agent_id)!;
  t("M12", "queue driver: two writers declaring the same file: the second is queued, starts BY ITSELF when the first finishes (not before), and both end done",
    b1.json.async === true && b2.json.queued === true && bw.json.timed_out === false && bw.json.agents.every((a: any) => a.status === "idle") && s2.start >= s1.start + s1.ms - 50 && st2.evs("lock.promoted", "t").length >= 1 && st2.locks.length === 0, `second queued=${b2.json.queued} s1=${s1.ms}ms s2 started ${s2.start - s1.start} ms after s1 began`);

  { const w = world(), rn = new ScriptRunner(() => "ok"), ctx = { store: w.store, runner: rn, defs, sessionCap: 3 };
    const q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, ...o }), res = defs.get("researcher")!;
    const r1 = granted(agentCall(w.store, w.d, w.policy, q())); await runCallee(ctx, w.policy, r1, q(), res, { cwd: tmpdir(), writerMode: "shared" });
    say(w.store, "t", "builder#9", "researcher#1", "the site moved to /new");   // left for an IDLE agent
    const r2 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "researcher#1", objective: "again" }))); await runCallee(ctx, w.policy, r2, q({ session_arg: "researcher#1", objective: "again" }), res, { cwd: tmpdir(), writerMode: "shared" });
    const p2 = rn.calls[1]!.prompt;
    const r3 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "researcher#1", objective: "third" }))); await runCallee(ctx, w.policy, r3, q({ session_arg: "researcher#1", objective: "third" }), res, { cwd: tmpdir(), writerMode: "shared" });
    t("M15", "a note left for an idle agent is shown at the start of its next call (labelled as not from the person), once", p2.includes("NOTES FROM OTHER AGENTS") && p2.includes("the site moved to /new") && p2.includes("not from the person") && !rn.calls[2]!.prompt.includes("the site moved"), p2.slice(-260)); }
  { const w = world(), rn = new ScriptRunner(() => "found: the answer is 42"), res = defs.get("researcher")!;
    const ctxA = { store: w.store, runner: rn, defs, sessionCap: 3, transcriptExists: (cwd: string) => cwd === "/old" };
    const q = (o: Partial<CallReq> = {}): CallReq => ({ ...base, ...o });
    const a1 = granted(agentCall(w.store, w.d, w.policy, q())); await runCallee(ctxA, w.policy, a1, q(), res, { cwd: "/old", writerMode: "shared" });
    for (const cwd of ["/new", "/third"]) { const a2 = granted(agentCall(w.store, w.d, w.policy, q({ session_arg: "researcher#1" }))); await runCallee(ctxA, w.policy, a2, q({ session_arg: "researcher#1" }), res, { cwd, writerMode: "shared" }); }
    t("M16", "a writer gets a new folder (worktree) on EVERY call: across THREE folders the session is still found where it was created and RESUMED each time, never rolled (the first fix passed two folders and broke on the third; the real CLI keeps the transcript in the creation folder)", rn.calls.length === 3 && rn.calls.slice(1).every((c) => c.session.resume && c.session.id === rn.calls[0]!.session.id) && w.store.evs("session.rolled").length === 0, `resume=${rn.calls.map((c) => c.session.resume)} rolled=${w.store.evs("session.rolled").length}`);
    const w2 = world(), rn2 = new ScriptRunner((c: RunCall) => `answer ${c.row.resume_count} about site 3`), ctxB = { store: w2.store, runner: rn2, defs, sessionCap: 1 };
    for (let k = 0; k < 3; k++) { const rr = granted(agentCall(w2.store, w2.d, w2.policy, q(k === 0 ? {} : { session_arg: "researcher#1" }))); await runCallee(ctxB, w2.policy, rr, q(k === 0 ? {} : { session_arg: "researcher#1" }), res, { cwd: tmpdir(), writerMode: "shared" }); }
    t("M17", "when the resume cap forces a NEW session, the agent is handed its own earlier answers from the ledger (a visible rolled event, and no silent loss of what it found)", w2.store.evs("session.rolled").length === 1 && rn2.calls[2]!.prompt.includes("YOUR EARLIER ANSWERS") && /answer 0 about site 3/.test(rn2.calls[2]!.prompt) && !rn2.calls[1]!.prompt.includes("YOUR EARLIER ANSWERS"), rn2.calls[2]!.prompt.slice(-300)); }
  const nest = new MStore(file); const resR = nest.agent("t", ids[0]!)!; resR.status = "idle";
  const bRow = nest.addAgent("t", defs.get("builder")!, { level: 2, caller: "lead#1" }); bRow.status = "running"; nest.save();
  const nres = agentCall(nest, defs, defaultPolicy({ agentMaxDepth: 4 }), { task_id: "t", caller_agent_id: bRow.agent_id, role: "researcher", session_arg: ids[0], mode: "ask", objective: "more on site 3", output: "5 bullets", boundaries: "ask only" });
  t("M13", "nested: a builder (level 2) continues the researcher that already studied the topic (level 3 call); the researcher keeps its own level and owner, and the call is recorded with the builder as caller",
    nres.ok && nres.kind === "resume" && nres.agent.level === 2 && nres.agent.caller_agent_id === "lead#1" && nest.calls.at(-1)!.caller_agent_id === bRow.agent_id && nest.calls.at(-1)!.level === 3, JSON.stringify(nest.calls.at(-1)));

  const repo = mkRepo({ "a.txt": "A\n" }), f2 = join(dir, "store2.json"), s2s = new MStore(f2);
  const lead = s2s.addAgent("t", defs.get("lead")!, { level: 1 }); lead.status = "running";
  const wtA = addWorktree(repo, "wA"), wtB = addWorktree(repo, "wB");
  writeFileSync(join(wtA.dir, "web1.html"), "<html>1</html>\n"); writeFileSync(join(wtB.dir, "web2.html"), "<html>2</html>\n");
  const { addPatch } = await import("../harness/core/patches.ts");
  for (const [ag, w] of [["builder#1", wtA], ["builder#2", wtB]] as const) { const pp = patchOf(w.dir, w.base); addPatch(s2s, { task_id: "t", agent_id: ag, base: w.base, files: pp.files, text: pp.text }); removeWorktree(repo, w.dir, w.branch); }
  s2s.save();
  const ap = await tool(["apply_patches"], { HARNESS_STORE: f2, HARNESS_CWD: repo });
  const log = execFileSync("git", ["-C", repo, "log", "--oneline"], { encoding: "utf8" });
  t("M14", "apply_patches puts every finished writer's files into the project in queue order and commits, so the next writers branch from the new head", ap.json.applied === 2 && existsSync(join(repo, "web1.html")) && existsSync(join(repo, "web2.html")) && ap.json.committed === true && /apply agent patches/.test(log), JSON.stringify(ap.json));
  rm(repo); rm(dir);
}
function mkdtempSyncSafe() { const d = join(tmpdir(), "lfm-" + Math.random().toString(36).slice(2, 8)); mkdirSync(d, { recursive: true }); return d; }

// ---------------------------------------------------------------------------- real suite
async function real() {
  setSuite("real: claude -p (a lead that delegates, a lock-guarded writer, a fork)");
  const repo = mkRepo({ "docs/a.md": "# Apples\n\n## Storage\nApples keep best at 4 degrees C and 90 percent humidity.\n\n## Origin\nFirst grown in Kazakhstan.\n", "docs/b.md": "# Bridges\n\n## Span\nThe Harbor Bridge main span is 120 metres.\n\n## Material\nSteel arch.\n" });
  mkdirSync(join(repo, "docs"), { recursive: true });
  const file = join(tmpdir(), "lfr-" + Math.random().toString(36).slice(2, 8) + ".json"), store = new MStore(file);
  const runner = new RealRunner(300_000), ctx = { store, runner, defs, sessionCap: 3, transcriptExists: () => true };
  try {
    // MR1: the lead splits the work, opens two researchers, then continues one
    const lead = await runLead(ctx, { task_id: "T1", repo, maxDepth: 4, runner: "real",
      request: "Two questions: (1) In docs/a.md, at what temperature do apples keep best? (2) In docs/b.md, how long is the main span of the bridge? Open ONE new researcher per question (two new researchers). When both answers are in, continue the researcher that read docs/b.md with the follow-up question 'under which heading did you find the span?' using its agent id. Then give me the final answers and list the agent ids you used." });
    store.reload();
    const rs = store.agentsOf("T1").filter((a) => a.name === "researcher");
    const starts = store.evs("agent.start", "T1").filter((e) => (e.agent_id ?? "").startsWith("researcher"));
    const denied = store.calls.filter((c) => c.status === "denied");
    t("MR1", "real lead opens two researchers (new sessions), each with its own session id and transcript on disk", lead.ok && rs.length >= 2 && new Set(rs.map((r) => r.session_id)).size === rs.length && rs.every((r) => r.session_id && existsSync(transcriptFor(repo, r.session_id!))),
      `lead ok=${lead.ok} err=${lead.error ?? ""} researchers=${rs.map((r) => r.agent_id + ":" + r.session_id?.slice(0, 5))} denied=${denied.map((d) => d.reason).join(" | ")}`);
    t("MR1b", "the lead continued an existing researcher (a 'resumed' start), so the follow-up used the same session", starts.some((e) => e.data?.mode === "resumed"), starts.map((e) => `${e.agent_id}:${e.data?.mode}`).join(" "));
    t("MR1c", "the lead's final answer holds both facts (4 degrees, 120 metres) and names agent ids", /\b4\b/.test(lead.reply) && /120/.test(lead.reply) && /researcher#\d/.test(lead.reply), lead.reply.slice(0, 300).replace(/\n/g, " "));
    t("MR1d", "every call is on record: call rows with caller, callee, level 2, status; denied ones carry a reason", store.calls.length >= 3 && store.calls.filter((c) => c.status !== "denied").every((c) => c.level === 2 && c.caller_agent_id === "lead#1" && c.callee_agent_id), `calls=${store.calls.length} ${store.calls.map((c) => c.status).join()}`);
    const costM = store.reports.reduce((s, r) => s + r.cost, 0) + lead.cost;
    console.log(`  (MR1 cost ~ $${costM.toFixed(4)}, lead turns reported by the CLI)`);

    // MR2: a real writer under the lock guard hook (Write/Edit denied outside its locks; identity from the process env)
    const w = new MStore(file); w.reload();
    const ld = w.addAgent("T2", defs.get("lead")!, { level: 1 }); ld.status = "running";
    const bsrc = defs.get("builder")!;
    const bdef: AgentDef = { ...bsrc, allow: ["Read", "Write", "Edit", "Glob", "Grep"], tools: ["Read", "Write", "Edit", "Glob", "Grep"] };   // no Bash: the Bash gap is documented, not hidden
    mkdirSync(join(repo, "src"), { recursive: true });
    const q: CallReq = { task_id: "T2", caller_agent_id: ld.agent_id, role: "builder", session_arg: "new", objective: "Write the text hello into src/a.txt, then write the text x into src/locked.txt. If a write is denied, do not work around it: stop and report which file was denied and the exact reason you were given.", output: "one sentence", boundaries: "only these two files", writes: ["src/a.txt"] };
    const other = w.addAgent("T2", defs.get("builder")!, { level: 2, caller: ld.agent_id }); other.status = "running";
    acquire(w, { task_id: "T2", agent_id: other.agent_id, call_id: "other_call", paths: ["src/locked.txt"], ttlMs: 600_000, now: Date.now() });
    const res = granted(agentCall(w, defs, defaultPolicy({ agentMaxDepth: 4 }), q));
    const wctx = { store: w, runner, defs, sessionCap: 3 };
    const out = await runCallee(wctx, defaultPolicy({ agentMaxDepth: 4 }), res, q, bdef, { cwd: repo, writerMode: "shared", env: { HARNESS_STORE: file }, extraArgs: () => hookArgs(HARNESS_DIR) });
    w.reload();
    t("MR2", "real writer: the allowed file is written, the file held by another agent is NOT (hook denied it), and the agent reported the reason instead of working around it",
      existsSync(join(repo, "src/a.txt")) && !existsSync(join(repo, "src/locked.txt")) && /lock|builder#/i.test(out.reply) && w.evs("edit.denied", "T2").length >= 1, `a.txt=${existsSync(join(repo, "src/a.txt"))} locked.txt=${existsSync(join(repo, "src/locked.txt"))} denied=${w.evs("edit.denied", "T2").length} reply=${out.reply.slice(0, 200).replace(/\n/g, " ")}`);
    const row = w.agent("T2", res.agent.agent_id)!;
    t("MR2b", "live activity came from the PostToolUse hook (no output parsing): a tool.used event per tool call with the agent id", w.evs("tool.used", "T2").some((e) => e.agent_id === res.agent.agent_id && /Write|Edit|Read|Glob/.test(String(e.data?.tool))), `tool.used events=${w.evs("tool.used", "T2").map((e) => e.data?.tool).join()}`);

    // MR3: a real fork keeps the source's memory under a new session and leaves the source untouched
    const f = new MStore(file); f.reload();
    const l3 = f.addAgent("T3", defs.get("lead")!, { level: 1 }); l3.status = "running";
    const fctx = { store: f, runner, defs, sessionCap: 3 }, pol = defaultPolicy({ agentMaxDepth: 4 }), rdef = defs.get("researcher")!;
    const q1: CallReq = { task_id: "T3", caller_agent_id: "lead#1", role: "researcher", session_arg: "new", objective: "Remember this code word for later: MANGO-3. Do not use tools. Reply OK.", output: "OK", boundaries: "no tools" };
    const r1 = granted(agentCall(f, defs, pol, q1)); await runCallee(fctx, pol, r1, q1, rdef, { cwd: repo, writerMode: "shared", env: { HARNESS_STORE: file } });
    f.reload(); const srcSession = f.agent("T3", "researcher#1")!.session_id;
    const q2: CallReq = { ...q1, session_arg: "fork:researcher#1", objective: "What was the code word I told you? Do not use tools. One word.", output: "one word" };
    const r2 = granted(agentCall(f, defs, pol, q2)); const o2 = await runCallee(fctx, pol, r2, q2, rdef, { cwd: repo, writerMode: "shared", env: { HARNESS_STORE: file } });
    f.reload(); const fr = f.agent("T3", "researcher#2")!;
    const srcAfter = await runCallee(fctx, pol, granted(agentCall(f, defs, pol, { ...q1, session_arg: "researcher#1", objective: "What was the code word? Do not use tools. One word.", output: "one word" })), { ...q1, session_arg: "researcher#1", objective: "What was the code word? Do not use tools. One word.", output: "one word" }, rdef, { cwd: repo, writerMode: "shared", env: { HARNESS_STORE: file } });
    t("MR3", "real fork: researcher#2 (parent researcher#1) answers MANGO-3 from the copied memory, has its own session id, and researcher#1 still resumes under its own id",
      /MANGO/i.test(o2.reply) && fr.parent_agent_id === "researcher#1" && !!fr.session_id && fr.session_id !== srcSession && new Store2(file).agent("T3", "researcher#1")!.session_id === srcSession && /MANGO/i.test(srcAfter.reply), `fork reply=${o2.reply.slice(0, 40)} src reply=${srcAfter.reply.slice(0, 40)} sessions ${srcSession?.slice(0, 5)} -> ${fr.session_id?.slice(0, 5)}`);
    const all = new MStore(file); console.log(`\nreal suite cost ~ $${all.reports.reduce((s, r) => s + r.cost, 0).toFixed(4)} (+ lead); calls recorded=${all.calls.length}`);
  } finally {
    rmSync(projectDirFor(repo), { recursive: true, force: true }); rm(repo); rmSync(file, { force: true }); rmSync(file + ".board", { force: true });
  }
}
class Store2 extends MStore {}

const SUITES = process.argv.includes("--suite") ? new Set(process.argv[process.argv.indexOf("--suite") + 1]!.split(",")) : null;   // e.g. --suite pm,locks : run only what you changed

async function contextSuite() {
  setSuite("context: short prompts in layers, shared context, kit reference, free status, queue visibility, judge tolerance");
  const H = join(import.meta.dirname, "..", "harness");
  // 1. prompt layers and size caps (Anthropic: concise main file; details on demand)
  const leadMd = readFileSync(join(AGENTS_DIR, "lead", ".claude", "CLAUDE.md"), "utf8"), builderMd = readFileSync(join(AGENTS_DIR, "builder", ".claude", "CLAUDE.md"), "utf8");
  t("CX1", "the lead's CLAUDE.md is a short core (under 200 lines and 9 KB), the builder's under 6 KB; every chapter it names exists", leadMd.split("\n").length < 200 && leadMd.length < 9000 && builderMd.length < 6000
    && [...leadMd.matchAll(/`(clone|prototype|qa|preview_bg|parallel|planning|new_project|artifact)`/g)].every((m) => existsSync(join(AGENTS_DIR, "lead", "chapters", m[1] + ".md"))), `${leadMd.length} / ${builderMd.length} bytes`);
  t("CX2", "agent.json prompts[] / team_tools[] are honoured: a builder's launch prompt documents only the team tools it lists (proto_check, browse with --video, bg_start; no preview, no site_build, no QA command), and agents:check is clean", (() => {
    const b = launchDef(defs.get("builder")!, defs, 2, 3, mkdtempSyncSafe(), "team"), txt = readFileSync(b.prompt_file, "utf8");
    return txt.includes("team proto_check") && txt.includes("team browse") && txt.includes("team bg_start") && txt.includes("--video") && !txt.includes("team preview") && !txt.includes("team site_build") && !txt.includes("team qa_") && checkAgents(defs).length === 0;
  })());
  // 2. chapter command: a name from the list works, a path trick is neutralised
  const cwd = mkdtempSyncSafe(); const st0 = new MStore(join(cwd, "store.json")); st0.save();
  const ch = (name: string) => JSON.parse(spawnSync("bun", ["--smol", join(H, "tools.ts"), "chapter", "--name", name], { env: { ...process.env, HARNESS_STORE: join(cwd, "store.json"), HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: cwd }, encoding: "utf8" }).stdout);
  const c1 = ch("clone"), c2 = ch("../../tools");
  t("CX3", "`chapter --name clone` returns the chapter text; a path-trick name is refused with the list of chapters", c1.ok === true && /site_build/.test(c1.text) && c2.ok === false && Array.isArray(c2.chapters) && c2.chapters.includes("clone"), JSON.stringify(c2).slice(0, 120));
  // 3. shared context in front of a writer's first prompt: listed files only, inside run_test/, capped
  const ws = mkdtempSyncSafe(); mkdirSync(join(ws, "run_test", "plan"), { recursive: true }); writeFileSync(join(ws, "run_test", "a.md"), "AAA"); writeFileSync(join(ws, "secret.txt"), "SECRET");
  writeFileSync(join(ws, "run_test", "plan", "CONTEXT.txt"), "# comment\na.md\nmissing.md\n../secret.txt\n");
  const sc = sharedContext(ws);
  t("CX4", "sharedContext inlines the files listed in plan/CONTEXT.txt, skips missing ones and anything outside run_test/, and is empty without a manifest", sc.includes("=== run_test/a.md") && sc.includes("AAA") && !sc.includes("SECRET") && sharedContext(mkdtempSyncSafe()) === "");
  // 4. generated kit reference in PROTO.md (no grep turns for the builder)
  const pd = join(mkdtempSyncSafe(), "p"); protoInit(pd, { title: "Demo", nav: parseNav("Home, Blog, Features"), kind: "site" });
  const proto = readFileSync(join(pd, "PROTO.md"), "utf8");
  t("CX5", "proto_init appends a Kit reference (classes, icons, helpers) generated from the real kit files", proto.includes("## Kit reference") && /\.btn-primary/.test(proto) && /<ui-icon name/.test(proto) && /\$go/.test(proto));
  // 5. free status: strict whitelist, answered from the board
  t("CX6", "a plain status question is answered from the board (no lead resume); longer or mixed messages still go to the lead", isStatusOnly("Status?") && isStatusOnly("what's running?") && !isStatusOnly("status and continue") && !isStatusOnly("continue") && !isStatusOnly("why is the header slow")
    && /Spent so far/.test(statusReply(new MStore(join(cwd, "store.json")), "t")));
  // 6. judge: expected_roles = each role at least once; other calls must match exactly
  t("CX7", "matchCalls: several builders and fix-round resumes satisfy expected_roles [builder]; a missing role or an extra other role does not", matchCalls(["new:builder", "new:builder", "resume:builder"], ["new:builder"], new Set(["builder"])) && !matchCalls([], [], new Set(["builder"])) && !matchCalls(["new:builder", "new:reviewer"], ["new:builder"], new Set(["builder"])) && matchCalls(["new:planner", "new:researcher", "new:researcher"], ["new:planner"], new Set(["planner", "researcher"]), new Set(["planner"])) && !matchCalls(["new:researcher"], [], new Set(["planner", "researcher"]), new Set(["planner"])));
  // 8. the planner: a writer that does R&D and writes the plan in the proven format; plan_lint is the free gate
  const pl = defs.get("planner")!, plPrompt = readFileSync(launchDef(pl, defs, 2, 3, mkdtempSyncSafe(), "team").prompt_file, "utf8");
  t("CX9", "the planner is a writer with web access that may call researcher / lookup / ux-designer, its prompt = behaviour + plan_format.md + declarations, under 13 KB, and it knows plan_lint", pl.writes === true && pl.tools.includes("WebSearch") && pl.tools.includes("Write") && pl.agents.join() === "researcher,lookup,ux-designer" && plPrompt.includes("## Build recipe".replace("## ", "")) && plPrompt.includes("plan_lint") && plPrompt.length < 13000, `${plPrompt.length} bytes`);
  const FX = join(import.meta.dirname, "..", "..", "..", "..", "..", "TestCases", "test_folders", "agent_fixture", "prompt_fixtures"), good = lintPlan(join(FX, "site_clone_pingharbor", "one_phase_complete"));
  const bad = mkdtempSyncSafe(); writeFileSync(join(bad, "README.md"), "# x\nTBD here\n[gone](nope.md)\n");
  const lb = lintPlan(bad);
  t("CX10", "plan_lint passes a plan that built well (pp_site) and fails an empty one with: missing frontmatter and sections, no PHASES, a placeholder and a broken link", good.ok && !lb.ok && lb.errors.some((e) => /audience/.test(e)) && lb.errors.some((e) => /Build recipe/.test(e)) && lb.errors.some((e) => /PHASES\.md is missing/.test(e)) && lb.errors.some((e) => /placeholder/.test(e)) && lb.errors.some((e) => /broken link/.test(e)), JSON.stringify(lb.errors).slice(0, 160));
  const two = mkdtempSyncSafe(); writeFileSync(join(two, "README.md"), "---\naudience: both\n---\n## Build recipe\n## What is it\n## What you get\n## Quality bar\n"); writeFileSync(join(two, "PHASES.md"), "| T01 | `js/a.js` | builder |\n| T02 | `js/a.js` | builder |\n\n**Done when:**\n- one\n- two\n");
  const noRes = mkdtempSyncSafe(); writeFileSync(join(noRes, "README.md"), "---\naudience: both\n---\n## Build recipe\n## What is it\n## What you get\n## Quality bar\n"); writeFileSync(join(noRes, "PHASES.md"), "| T01 | x | builder |\n\nDone when:\n1. one\n2. two\n");
  const withRes = mkdtempSyncSafe(); writeFileSync(join(withRes, "README.md"), "---\naudience: both\n---\n## Build recipe\n## What is it\n## What you get\n## Quality bar\n## Research\n- https://example.com/a: x\n- https://example.org/b: y\n"); writeFileSync(join(withRes, "PHASES.md"), "| T01 | x | builder |\n\n### Done when\n- one\n- two\n");
  t("CX12", "plan_lint: a plan without research (fewer than 2 sources, no `research: none`) is refused; two sources pass; Done when may be written as plain, bold or heading", lintPlan(noRes).errors.some((e) => /no research/.test(e)) && !lintPlan(noRes).errors.some((e) => /Done when/.test(e)) && !lintPlan(withRes).errors.some((e) => /research|Done when/.test(e)), JSON.stringify(lintPlan(withRes).errors).slice(0, 140));
  // the loopholes found when reviewing the planner: empty sections, a recipe without steps, made-up sources, a review agent, folder overlap, vague checks, missing brand tokens
  const mkPlan = (readme: string, phases: string) => { const d = mkdtempSyncSafe(); writeFileSync(join(d, "README.md"), readme); writeFileSync(join(d, "PHASES.md"), phases); writeFileSync(join(d, "00_contract.md"), "names and routes\n"); writeFileSync(join(d, "CONTEXT.txt"), "plan/00_contract.md\n"); return d; };
  const fm = "---\naudience: both\n---\n", rows = "| F1 | a | b | 1 | planned |\n| F2 | a | b | 1 | planned |\n| F3 | a | b | 1 | planned |\n";
  const goodR = fm + "<!-- dev -->\n## Build recipe\n1. build in run_test/x with the kit command now\n2. owners are listed in the task table below\n3. verify with proto_check and the preview\n<!-- /dev -->\n## What is it\nA small public page that shows the state of things; every screen is invented in the style of comparable pages.\n## What you get\n" + rows + "## Quality bar\n- contrast 4.5:1 or better in both themes, tap targets of 40 px, and no text under 12 px anywhere\n## Research\n- https://a.example/x: it showed the component order, so the list comes first\n- https://b.example/y: it showed email subscribe is standard, so we only store the address\n";
  const goodP = "| T01 | `js/a.js` | builder |\n\n**Done when:**\n- open `#/home`: the banner shows \"All good\" and 3 rows\n- reload keeps the theme saved in `localStorage` from before\n- 0 console errors on every route at 1280 px\n- tap targets are at least 40 px at 375 px width\n";
  const gp = lintPlan(mkPlan(goodR, goodP), undefined, { fetched: ["https://a.example/x", "https://b.example/y"] });
  const stub = lintPlan(mkPlan(goodR.replace("1. build in run_test/x with the kit command now\n2. owners are listed in the task table below\n3. verify with proto_check and the preview\n", "1. go\n"), goodP));
  const nofeat = lintPlan(mkPlan(goodR.replace(rows, "| F1 | a | b | 1 | planned |\n"), goodP));
  const madeUp = lintPlan(mkPlan(goodR, goodP), undefined, { fetched: ["https://other.example/z"] });
  const qa = lintPlan(mkPlan(goodR, goodP + "| T02 | audit the result | qa-reviewer | T01 |\n"));
  const seq = lintPlan(mkPlan(goodR, "| T01 | `js/a.js` | builder | - |\n| T02 | `js/a.js` | builder | T01 |\n| T03 | `js/a.js` | builder | T02 |\n\n**Done when:**\n- open `#/a` and see 3 rows\n- reload keeps theme 1\n- 0 errors at 1280 px\n- taps are 40 px\n")), par = lintPlan(mkPlan(goodR, "| T01 | `js/a.js` | builder | - |\n| T02 | `js/a.js` | builder | - |\n\n**Done when:**\n- open `#/a` and see 3 rows\n- reload keeps theme 1\n- 0 errors at 1280 px\n- taps are 40 px\n"));
  t("CX14", "plan_lint ownership is order-aware: tasks in sequence (needs) may edit one file, tasks that can run in parallel may not; a `## Build prompt` counts as the build recipe", !seq.errors.some((e) => /overlaps/.test(e)) && par.errors.some((e) => /overlaps/.test(e)) && !lintPlan(mkPlan(goodR.replace("## Build recipe", "## Build prompt"), goodP)).errors.some((e) => /Build/.test(e)));
  const folder = lintPlan(mkPlan(goodR, "| T01 | `model/` | builder |\n| T02 | `model/tower.js` | builder |\n\n**Done when:**\n- open `#/a` and see 3 rows\n- reload keeps theme 1\n"));
  const vague = lintPlan(mkPlan(goodR, "| T01 | `js/a.js` | builder |\n\n**Done when:**\n- looks good and works well enough\n- the users are happy with it overall\n- feels fast and smooth to use today\n- nothing seems broken at all in there\n"));
  const tokens = lintPlan(mkPlan(goodR.replace("1. build in run_test/x with the kit command now", "1. run `proto_init --kind site --dir run_test/x --accent #10b981` now"), goodP));
  t("CX13", "plan_lint loopholes closed: a good plan passes clean; a stub recipe, a 1-feature catalog and a cited-but-never-fetched source are caught; a review-agent task, a folder/file overlap, vague Done-when checks and missing brand tokens are flagged",
    gp.ok && gp.warnings.length === 0 && stub.errors.some((e) => /Build recipe/.test(e)) && nofeat.errors.some((e) => /feature catalog/.test(e)) && madeUp.warnings.some((w) => /never fetched/.test(w))
    && qa.warnings.some((w) => /review agent/.test(w)) && folder.errors.some((e) => /overlaps/.test(e)) && vague.warnings.some((w) => /no concrete number/.test(w)) && tokens.warnings.some((w) => /--font/.test(w) || /--bg-dark/.test(w)),
    JSON.stringify({ gp: gp.errors.concat(gp.warnings), stub: stub.errors.length, nofeat: nofeat.errors.length, madeUp: madeUp.warnings.length, qa: qa.warnings.length, folder: folder.errors.length, vague: vague.warnings.length, tokens: tokens.warnings.length }).slice(0, 300));
  // the CLI that answered but never exited (pp_eiffel builder #3): finished-turn detection from the session log
  const T0 = Date.parse("2026-01-01T10:00:00Z"), rec = (o: object) => JSON.stringify(o) + "\n";
  const asst = (ts: string, id: string, stop: string | null, text: string, out = 50) => rec({ type: "assistant", timestamp: ts, message: { id, model: "claude-sonnet-5-5", stop_reason: stop, content: text ? [{ type: "text", text }] : [], usage: { input_tokens: 2, output_tokens: out, cache_read_input_tokens: 10000, cache_creation_input_tokens: 500 } } });
  const hungLog = asst("2026-01-01T10:00:05Z", "m1", "tool_use", "") + rec({ type: "user", timestamp: "2026-01-01T10:00:06Z", message: { content: [{ type: "tool_result", content: "ok" }] } }) + asst("2026-01-01T10:00:09Z", "m2", "end_turn", "DONE: wrote world/a.js", 900);
  const fin = finishedTurn(hungLog, T0, T0 + 9_000, T0 + 9_000 + 60_000);
  t("CX15", "a call whose log ends with a finished turn (end_turn) and 45 s of silence is DONE: the answer comes from the log and the cost is estimated; with a tool result pending, a clean exit (cost-state), too little silence, or the end_turn of an earlier call it is NOT",
    !!fin && fin.reply === "DONE: wrote world/a.js" && fin.cost > 0 && fin.cost < 1
    && finishedTurn(hungLog + rec({ type: "cost-state" }), T0, T0 + 9_000, T0 + 69_000) === null
    && finishedTurn(hungLog, T0, T0 + 9_000, T0 + 30_000) === null
    && finishedTurn(asst("2026-01-01T10:00:05Z", "m1", "tool_use", "") + rec({ type: "user", timestamp: "2026-01-01T10:00:06Z", message: {} }), T0, T0 + 6_000, T0 + 70_000) === null
    && finishedTurn(hungLog, Date.parse("2026-01-01T11:00:00Z"), T0 + 9_000, T0 + 69_000) === null, JSON.stringify(fin));
  // the monitor: which running sub-agents need the lead, and the one automatic nudge at 6 minutes
  const NOW = Date.now(), mdir = mkdtempSyncSafe(), ms = new MStore(join(mdir, "store.json")), mrow = ms.addAgent("t", defs.get("builder")!, { level: 2, caller: "lead#1" });
  const setup = (runS: number, lastToolS: number) => { mrow.status = "running"; mrow.started_at = NOW - runS * 1000; ms.events = ms.events.filter((e) => e.kind !== "tool.used"); ms.ev("tool.used", "t", mrow.agent_id, { tool: "Bash" }); ms.events[ms.events.length - 1]!.t = NOW - lastToolS * 1000; };
  setup(200, 20); const ok0 = attention(ms, "t", undefined, NOW).length === 0;
  setup(400, 30); const slow = attention(ms, "t", undefined, NOW)[0];
  setup(400, 150); const silent = attention(ms, "t", undefined, NOW)[0];
  setup(700, 420); const stalled = attention(ms, "t", undefined, NOW)[0];
  setup(400, 30); const due1 = dueNudges(ms, "t", NOW).length; ms.ev("monitor.nudge", "t", mrow.agent_id, { started_at: mrow.started_at }); const due2 = dueNudges(ms, "t", NOW).length;
  t("CX16", "monitor: a young agent needs nothing; over 6 min but moving = slow (look once); 2 min without a tool call = silent; 5 min = stalled (stop, but verify its files first, and report); the automatic nudge is due once per call",
    ok0 && slow?.level === "slow" && silent?.level === "silent" && stalled?.level === "stalled" && /verify|CHECK its files/i.test(stalled!.do) && /report_bug/.test(stalled!.do) && due1 === 1 && due2 === 0, JSON.stringify([slow?.level, silent?.level, stalled?.level, due1, due2]));
  // report_issue_to_admin: appends to admin_issues.jsonl next to the store with the agent's session id, refuses an empty text, admin_issues lists it
  mrow.session_id = "11111111-2222-3333-4444-555555555555"; ms.save();
  const tcli = (...args: string[]) => JSON.parse(spawnSync("bun", ["--smol", join(H, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: join(mdir, "store.json"), HARNESS_TASK: "t", HARNESS_AGENT: "lead#1", HARNESS_CWD: mdir }, encoding: "utf8" }).stdout);
  const rep = tcli("report_bug", "--agent", mrow.agent_id, "--kind", "hung", "--text", "answered but the call stayed running; stopped it, files complete"), repBad = tcli("report_bug", "--agent", mrow.agent_id, "--text", ""), lst = tcli("admin_issues");
  t("CX17", "report_issue_to_admin records the issue with the agent's session id for the admins (admin_issues.jsonl + an admin.issue event), refuses an empty text, and admin_issues lists it",
    rep.ok === true && rep.session_id === "11111111-2222-3333-4444-555555555555" && repBad.ok === false && lst.issues?.length === 1 && lst.issues[0].kind === "hung" && existsSync(join(mdir, "admin_issues.jsonl")), JSON.stringify([rep.ok, repBad.ok, lst.issues?.length]));
  // report_bug: any agent files a bug about ITSELF (no --agent), the harness attaches its session id, the log file and the severity; an unknown severity falls back to medium
  const tcliAs = (agent: string, ...args: string[]) => JSON.parse(spawnSync("bun", ["--smol", join(H, "tools.ts"), ...args], { env: { ...process.env, HARNESS_STORE: join(mdir, "store.json"), HARNESS_TASK: "t", HARNESS_AGENT: agent, HARNESS_CWD: mdir }, encoding: "utf8" }).stdout);
  const own = tcliAs(mrow.agent_id, "report_bug", "--kind", "tool_error", "--severity", "high", "--text", "pnpm install failed with ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION; pinned an older vite"), odd = tcliAs(mrow.agent_id, "report_bug", "--severity", "nope", "--text", "x"), all = tcli("admin_issues").issues ?? [];
  const mine = all.find((i: { kind: string }) => i.kind === "tool_error");
  t("CX17b", "report_bug: an agent files a bug about itself with no --agent; the session id, severity and reporter are recorded; a bad severity becomes medium; an empty text is refused",
    own.ok === true && own.session_id === "11111111-2222-3333-4444-555555555555" && mine?.agent === mrow.agent_id && mine?.severity === "high" && mine?.reporter === mrow.agent_id && odd.ok === true && all.find((i: { text: string }) => i.text === "x")?.severity === "medium" && tcliAs(mrow.agent_id, "report_bug").ok === false, JSON.stringify([own.ok, mine?.severity, mine?.agent]));
  // ---- the container recorder's helpers (still used by the test runner's own video): the report keeps the lines AFTER an error, and the container uses the HOST's pnpm
  const envLines = ["Error: ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION", "× installing dependencies", "╰─▶ 1 lockfile entries failed verification:", "- rolldown@1.2.19 (published 5 days ago)", "unrelated noise", "more noise"];
  const sf = setupFailLines(["pnpm output", ...envLines].join("\n"));
  t("CX19", "the container report keeps the lines AFTER an error line, so the package pnpm names is never dropped (an error-only filter dropped it and the lead had to send a builder to find it)", sf.some((x) => /rolldown@1\.2\.19/.test(x)) && sf.length <= 10, JSON.stringify(sf));
  const qaDir = join(import.meta.dirname, "..", "..", "..", "..", "infra", "qa"), prep = readFileSync(join(qaDir, "prepare.sh"), "utf8"), wq = readFileSync(join(qaDir, "web_dev_qa.ts"), "utf8"), dockerfile = readFileSync(join(qaDir, "Dockerfile"), "utf8");
  const pm = (pkg: object, env: Record<string, string> = {}) => { const d = mkdtempSyncSafe(), f = join(d, "package.json"); writeFileSync(f, JSON.stringify(pkg)); const r = spawnSync("node", [join(qaDir, "pin_pm.mjs"), f], { encoding: "utf8", env: { ...process.env, PNPM_DEFAULT_VERSION: "", ...env } }); return { pin: JSON.parse(readFileSync(f, "utf8")).packageManager as string | undefined, say: (r.stdout ?? "").trim() }; };
  const hooks = (() => { const d = mkdtempSyncSafe(), f = join(d, "package.json"); writeFileSync(f, JSON.stringify({ scripts: { dev: "vite", prepare: "cypress install", postinstall: "x", "test:unit": "vitest" } })); const r = spawnSync("node", [join(qaDir, "pin_pm.mjs"), f], { encoding: "utf8" }); return { sc: JSON.parse(readFileSync(f, "utf8")).scripts as Record<string, string>, say: r.stdout ?? "" }; })();
  const own9 = pm({ name: "a", packageManager: "pnpm@9.15.0" }), ownHash = pm({ packageManager: "pnpm@10.4.1+sha512.abcdef" }), none = pm({ name: "b" }), yarn = pm({ packageManager: "yarn@4.1.0" }), forced = pm({ packageManager: "pnpm@9.15.0" }, { PNPM_VERSION: "10.1.0" }), dflt = pm({ name: "c" }, { PNPM_DEFAULT_VERSION: "10.9.0" });
  t("CX21", "the pnpm version follows the PROJECT: a project that pins pnpm keeps exactly its version (also with a +sha hash), a project that pins none or pins yarn/npm gets the image's DEFAULT pnpm (PNPM_DEFAULT_VERSION, 10.28.0 when unset), the project's own install hooks (prepare, postinstall ...: Cypress, husky) are dropped in the container's copy so they cannot break QA; PNPM_VERSION forces one for a run; there is no global version file, prepare.sh uses pin_pm.mjs, the default lives in the image's Dockerfile",
    own9.pin === "pnpm@9.15.0" && /project pins pnpm@9\.15\.0/.test(own9.say) && ownHash.pin === "pnpm@10.4.1+sha512.abcdef" && none.pin === "pnpm@10.28.0" && yarn.pin === "pnpm@10.28.0" && /said yarn/.test(yarn.say) && forced.pin === "pnpm@10.1.0" && dflt.pin === "pnpm@10.9.0"
    && !("prepare" in hooks.sc) && !("postinstall" in hooks.sc) && hooks.sc.dev === "vite" && hooks.sc["test:unit"] === "vitest" && /install hooks .* dropped for QA: postinstall, prepare/.test(hooks.say) && /node \/qa\/pin_pm\.mjs package\.json/.test(prep) && !/delete j\.packageManager/.test(prep) && !/cat \/qa\/PNPM_VERSION/.test(prep) && !existsSync(join(qaDir, "PNPM_VERSION")) && !/readFileSync\(join\(import\.meta\.dir, "PNPM_VERSION"/.test(wq) && /PNPM_DEFAULT_VERSION=10\.28\.0/.test(dockerfile), JSON.stringify([own9.pin, ownHash.pin, none.pin, yarn.pin, forced.pin, dflt.pin]));
  // ---- the web-setup fixture's flag parser (found by a real run: "no Playwright/Cypress/e2e" produced --cypress)
  const vf = (txt: string) => vueFlags(txt).join(" ");
  t("CX33", "vueFlags: a negation covers a slash-joined list ('no Playwright/Cypress/e2e'), an 'or' / 'and' list and a plain word; a comma ends a plain 'no' ('no JSX, Pinia' still picks Pinia) but a 'do NOT add A, B or C' covers its whole list; a chosen option is still picked",
    vf("Options: TypeScript yes, Vue Router yes, Pinia yes, Vitest yes. Nothing else: no JSX, no Playwright/Cypress/e2e, no ESLint, no Prettier, no devtools extras.") === "--ts --router --pinia --vitest"
    && vf("TypeScript and Router, without Cypress or Playwright") === "--ts --router" && vf("TypeScript, no e2e, no Cypress, Vitest") === "--ts --vitest" && vf("skip ESLint/Prettier, TypeScript, Pinia") === "--ts --pinia"
    && vf("no JSX, Pinia") === "--pinia" && vf("TypeScript and Vue Router. Do NOT add JSX, ESLint or Prettier, and no Vitest.") === "--ts --router" && vf("Do not add Cypress, Playwright. Add Pinia and TypeScript") === "--ts --pinia" && vf("skip ESLint/Prettier, TypeScript, Pinia") === "--ts --pinia" && vf("TypeScript with Cypress") === "--ts --cypress" && vf("TypeScript, Vitest and Playwright") === "--ts --vitest --playwright", [vf("no JSX, no Playwright/Cypress/e2e, TypeScript"), vf("no JSX, Pinia"), vf("TypeScript with Cypress")].join(" | "));
  // ---- the project memory (.loopsAI): built from QA agent reviews and builder notes, per PROJECT, surviving tasks
  const lp = mkdtempSyncSafe(), proj = join(lp, "run_test", "app"); mkdirSync(proj, { recursive: true }); writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "app", scripts: { dev: "vite --port=3000", build: "vite build", lint: "tsc --noEmit" } })); writeFileSync(join(proj, "index.html"), "<p>v1</p>");
  appendRow(proj, { kind: "builder", by: "builder#1", task: "task-A", note: "pnpm exec tsc --noEmit: 0 errors; opened the page: no console errors", stamp: projectStamp(proj) });
  appendRow(proj, { kind: "review", by: "qa-reviewer#1", task: "task-A", verdict: "FAIL", stamp: projectStamp(proj), note: "FAIL\nThe French toggle does not change the footer.\nNEEDS_CHANGES:\n- ui/footer.js: translate the footer text" });
  writeMemory(proj, { dir: "app", phases: [{ phase: 1, state: "passed" }, { phase: 2, state: "open" }], planTitle: "Demo", planBlurb: "A demo app." });
  const ctxOpen = sharedContext(lp), qa1 = readFileSync(join(proj, ".loopsAI", "QA.md"), "utf8"), rd1 = readFileSync(join(proj, ".loopsAI", "README.md"), "utf8");
  appendRow(proj, { kind: "review", by: "qa-reviewer#1", task: "task-B", verdict: "PASS", stamp: projectStamp(proj), note: "PASS\nFooter translated; screenshots run_test/_shots/fr.png" }); writeMemory(proj, {});   // a NEW task: the project's history must survive
  const qa2 = readFileSync(join(proj, ".loopsAI", "QA.md"), "utf8"), rd2 = readFileSync(join(proj, ".loopsAI", "README.md"), "utf8");
  t("CX22", ".loopsAI is the PROJECT's memory, rendered from qa.json: README.md (what it is, how to run, how to check, phases, QA now), QA.md (latest verdict, what QA asked for while it is not PASS, every review and builder note), config.json (the switches); a later task's PASS replaces the asked-for list but the earlier history stays; a render without plan info keeps the title and phases an earlier call knew; it reaches a fresh builder as shared context even without a plan manifest",
    /How to run/.test(rd1) && /pnpm install/.test(rd1) && /phase 2: open/.test(rd1) && /A demo app/.test(rd1) && /Latest QA review.*FAIL/.test(qa1) && /QA asked for these changes/.test(qa1) && /ui\/footer\.js/.test(qa1) && /BUILDER builder#1 says it verified/.test(qa1) && ctxOpen.includes("run_test/app/.loopsAI/README.md")
    && /Latest QA review.*PASS/.test(qa2) && !/QA asked for these changes/.test(qa2) && /French toggle/.test(qa2) && /Demo/.test(rd2) && /phase 2: open/.test(rd2) && readRows(proj).length === 3 && existsSync(join(proj, ".loopsAI", "config.json")) && renderQa([]).includes("No QA review yet"), JSON.stringify([readRows(proj).length, qa2.slice(0, 120)]));
  // the stamp is the identity of the CODE (content), not of a folder or a clock
  const proj2 = join(lp, "run_test", "app2"); mkdirSync(proj2, { recursive: true }); writeFileSync(join(proj2, "package.json"), "{}"); writeFileSync(join(proj2, "a.js"), "1");
  const stamp0 = projectStamp(proj2), copy = join(lp, "copy"); cpSync(proj2, copy, { recursive: true }); const stCopy = projectStamp(copy);   // an untouched COPY (what a QA agent works in) is the same code
  writeFileSync(join(proj2, "a.js"), "12345"); const st1 = projectStamp(proj2);
  mkdirSync(join(proj2, "node_modules", "x"), { recursive: true }); writeFileSync(join(proj2, "node_modules", "x", "i.js"), "zzz"); mkdirSync(join(proj2, "_shots"), { recursive: true }); writeFileSync(join(proj2, "_shots", "a.png"), "png"); writeMemory(proj2, { dir: "app2" });
  t("CX23", "the code stamp is a CONTENT hash: the same files in another folder (a QA agent's untouched copy) give the same stamp, a changed file gives a different one, and node_modules, screenshots and .loopsAI never count",
    stamp0 === stCopy && stamp0 !== st1 && projectStamp(proj2) === st1, JSON.stringify([stamp0, stCopy, st1]));
  // the QA agent's answer is parsed: verdict from the first line (markdown ignored), the asked-for changes after NEEDS_CHANGES:
  t("CX25", "verdictOf reads PASS / FAIL / PARTIAL from the first non-empty line (bold, quotes, case ignored), says nothing when the answer does not start with one; needsChangesOf returns what follows NEEDS_CHANGES:",
    verdictOf("PASS\nall good") === "PASS" && verdictOf("\n**FAIL** the page is blank") === "FAIL" && verdictOf("> partial: login only") === "PARTIAL" && verdictOf("I think it passes") === undefined && verdictOf("") === undefined && /ui\/footer\.js/.test(needsChangesOf("FAIL\nx\nNEEDS_CHANGES:\n- ui/footer.js: translate")) && needsChangesOf("PASS") === "");
  // ---- the QA to-do context: from FILES (the plan's Done-when of the phase being built, the config) and from what QA itself said it checked / did not check
  { const td = mkdtempSyncSafe(), rt = join(td, "run_test"), pp = join(rt, "shop"); mkdirSync(join(rt, "plan"), { recursive: true }); mkdirSync(pp, { recursive: true }); writeFileSync(join(pp, "package.json"), "{}");
    writeFileSync(join(rt, "plan", "PHASES.md"), "# Phases\n\n## Phase 1 · Tower\n**Done when:**\n- the page loads and the veil fades in 0.45 s\n- 4 piers are visible\n\n---\n<a id=\"phase-2\"></a>\n## Phase 2 · Tour\n**Done when (you can check each one):**\n- stops 1 to 12 play with 0 console errors\n- dragging mid-move pauses the tour\n- Enter and the arrow keys work\n");
    const ans = "PARTIAL\nCHECKED:\n- the page loads: run_test/_shots/load.png\n- 4 piers visible: run_test/_shots/piers.png\nNOT CHECKED:\n- the veil timing (needs a video, video is off)\nNEEDS_CHANGES:\n- ui/veil.js: fade is 1 s";
    const p1 = planChecks(rt, [{ phase: 1, state: "open" }, { phase: 2, state: "waiting" }]), p2 = planChecks(rt, [{ phase: 1, state: "passed" }, { phase: 2, state: "open" }]);
    writeFileSync(join(pp, ".loopsAI-tmp"), ""); mkdirSync(join(pp, ".loopsAI"), { recursive: true }); writeFileSync(join(pp, ".loopsAI", "config.json"), JSON.stringify({ qa_check: false, qa_skip: ["docs/**", "legacy/"] }));
    writeMemory(pp, { dir: "shop", phases: [{ phase: 1, state: "passed" }, { phase: 2, state: "open" }] });
    const qa0 = readFileSync(join(pp, ".loopsAI", "QA.md"), "utf8"), mb0 = memoryBlock(rt);
    appendRow(pp, { kind: "review", by: "qa-reviewer#1", verdict: "PARTIAL", stamp: projectStamp(pp), note: ans, checked: checkedOf(ans), left: leftOf(ans) }); writeMemory(pp, {});
    const qa1 = readFileSync(join(pp, ".loopsAI", "QA.md"), "utf8"), mb1 = memoryBlock(rt);
    t("CX34", "the QA to-do context comes from files and from QA's own words: with no review yet QA.md and the memory block show the plan's Done-when of the phase being built (phase 2 when phase 1 passed, from PHASES.md); config.json's qa_check:false and qa_skip are shown; after a QA answer its CHECKED: and NOT CHECKED: are parsed and stored, and the next QA call is told what is still to check (not the whole plan again)",
      p1?.phase === 1 && p1.items.length === 2 && p2?.phase === 2 && p2.items.length === 3 && /Enter and the arrow keys/.test(p2.items.join("|")) && /To check: the plan's own checks for phase 2/.test(qa0) && /dragging mid-move pauses the tour/.test(qa0) && /QA skips/.test(qa0) && /legacy\//.test(qa0)
      && /plan checks to cover \(phase 2\)/.test(mb0) && /QA must skip: docs\/\*\*, legacy\//.test(mb0) && /video OFF/.test(mb0)
      && /4 piers visible: run_test\/_shots\/piers\.png/.test(checkedOf(ans)) && !/veil timing/.test(checkedOf(ans)) && /veil timing/.test(leftOf(ans)) && !/piers/.test(leftOf(ans)) && /Still to check/.test(qa1) && /veil timing/.test(qa1) && /Covered by QA so far/.test(qa1) && /piers\.png/.test(qa1)
      && /QA still has to check: .*veil timing/.test(mb1) && !/plan checks to cover/.test(mb1) && mb1.length <= 1500, JSON.stringify([p1?.phase, p2?.phase, mb1.slice(0, 260)])); }
  // ---- the host / Docker binding: an agent that uses the host's team tools is told about them AND runs on the host; one that does not use them runs in Docker and is told nothing about them (a QA agent once went to Docker, where team, background tasks, Chrome and ports do not exist)
  { const rows = [...defs.values()].map((a) => { const uses = usesTeamTools(a), docker = sandboxable({ agent: a } as never), prompt = a.allow.some((x) => x === "Bash" || x.includes("tools.ts")) ? readFileSync(launchDef(a, defs, 2, 3, mkdtempSyncSafe(), "team").prompt_file, "utf8") : "";
      return { name: a.name, uses, docker, docs: prompt.includes("# Shared team tools"), ok: (a.role === "lead" || a.role === "pm") ? !docker : uses ? !docker && (prompt === "" || prompt.includes("# Shared team tools")) : docker === true && !prompt.includes("# Shared team tools") }; });
    const bad = rows.filter((r) => !r.ok).map((r) => r.name);
    t("CX36", "ONE rule decides both: an agent that uses the host's team tools (calls other agents, lists team_tools, works in a throwaway copy, or has tools.ts in its permissions) runs on the HOST and its prompt documents them; every other agent may go to Docker and its prompt never mentions them; lead and pm always host; the QA agent, builder and planner are host agents, researcher, reviewer and web-setup are Docker agents",
      bad.length === 0 && rows.find((r) => r.name === "qa-reviewer")!.docker === false && rows.find((r) => r.name === "qa-reviewer")!.docs && rows.find((r) => r.name === "builder")!.docker === false && rows.find((r) => r.name === "researcher")!.docker === true && rows.find((r) => r.name === "web-setup")!.docker === true, JSON.stringify(bad.length ? bad : rows.map((r) => r.name + ":" + (r.docker ? "D" : "H")).join(" ")));
  }
  // ---- no prompt, doc line or command list may name a command that no longer exists (the master's list once still offered qa_give_up)
  { const removed = ["qa_check", "qa_record", "qa_give_up", "report_issue_to_admin", "preview_list", "preview_stop", "preview_restart", "team preview", "preview --dir"], files: string[] = [];
    const walkMd = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) { if (e.name !== "skills" && e.name !== "node_modules") walkMd(f); } else if (/\.(md|json)$/.test(e.name)) files.push(f); } };
    walkMd(AGENTS_DIR); files.push(join(H, "lead.ts"), join(H, "core", "launch.ts"), join(H, "core", "proto_check.ts"), join(H, "core", "monitor.ts"));
    const bad = files.flatMap((f) => removed.filter((w) => readFileSync(f, "utf8").includes(w) && !(w === "qa_check" && /config\.json|qa_check: false|"qa_check"|qa_check false|`qa_check`/.test(readFileSync(f, "utf8")))).map((w) => `${f.split("/harness/")[1]} names ${w}`));
    t("CX35", "no agent prompt, chapter, tool doc or hint names a command that no longer exists (qa_give_up, preview ..., report_issue_to_admin, the QA commands); the only 'qa_check' left is the config switch name", bad.length === 0 && !existsSync(join(H, "bin", "preview")), JSON.stringify(bad.slice(0, 6))); }
  // memory reaches every agent on every call, informs and never invites QA
  const mb = memoryBlock(join(lp, "run_test")), calleeSrc = readFileSync(join(H, "core", "callee.ts"), "utf8"), leadSrc = readFileSync(join(H, "lead.ts"), "utf8");
  t("CX24", "project memory reaches every agent on every call: the compact block (latest QA verdict, what QA asked for, builder notes, under 1.5 KB) is labelled information only, never tells anyone to run QA, is put in front of the prompt of ANY agent (readers, QA agent, resumed calls) and of every lead turn, and is empty when no project has a memory",
    /PROJECT MEMORY/.test(mb) && /information only/.test(mb) && /QA is not to be started because of it/.test(mb) && /last QA review PASS/.test(mb) && /builder builder#1 verified: .*tsc/.test(mb) && !/qa_check|team qa/.test(mb) && mb.length <= 1500 && memoryBlock(join(lp, "nothing")) === ""
    && /memoryBlock\(join\(o\.cwd, "run_test"\)\) \+ callPrompt/.test(calleeSrc) && !/first && isWriter \? memoryBlock/.test(calleeSrc) && /memoryBlock\(join\(o\.repo, "run_test"\)\)/.test(leadSrc), mb.slice(0, 200));
  // ---- the REAL tools in a temp workspace: the QA commands are gone, the QA agent is not started for a greeting, video follows the project's switch, background tasks are generic
  { const qd = mkdtempSyncSafe(), qp = join(qd, "run_test", "app"); mkdirSync(qp, { recursive: true }); writeFileSync(join(qp, "package.json"), "{}"); writeFileSync(join(qp, "index.html"), "<p>v1</p>");
    const stf = join(qd, "store.json"), sq = new Store2(stf); sq.addAgent("t", defs.get("lead")!, { level: 1 }); sq.save();
    const run = (agent: string, ...a: string[]) => { const r = spawnSync(process.execPath, ["--smol", join(H, "tools.ts"), ...a], { env: { ...process.env, HARNESS_STORE: stf, HARNESS_TASK: "t", HARNESS_AGENT: agent, HARNESS_CWD: qd, HARNESS_RUNNER: "fake" }, encoding: "utf8", timeout: 60_000 }); try { return JSON.parse(r.stdout.trim().split("\n").pop()!); } catch { return { raw: r.stdout + r.stderr }; } };
    const gone = ["qa_check", "qa_record", "qa_give_up", "preview", "preview_list", "preview_stop", "preview_restart", "report_issue_to_admin"].map((c) => run("lead#1", c, "--dir", "app"));
    const hi = run("lead#1", "delegate", "--role", "qa-reviewer", "--session", "new", "--objective", "check the app", "--output", "a verdict", "--boundaries", "read only");   // a greeting: no writer in the task
    const asked = run("lead#1", "delegate", "--role", "qa-reviewer", "--session", "new", "--objective", "check the login flow", "--output", "a verdict", "--boundaries", "read only", "--user-asked");
    const sb = new Store2(stf); sb.addAgent("t", defs.get("builder")!, { level: 2 }); const bb = sb.agentsOf("t").find((x) => x.name === "builder")!; bb.runs = 1; sb.save();
    const built = run("lead#1", "delegate", "--role", "qa-reviewer", "--session", "new", "--objective", "check what the builder made", "--output", "a verdict", "--boundaries", "read only");
    mkdirSync(join(qp, ".loopsAI"), { recursive: true }); writeFileSync(join(qp, ".loopsAI", "config.json"), JSON.stringify({ qa_check: false })); appendRow(qp, { kind: "review", verdict: "PASS", note: "PASS" });
    const vidOff = run("planner#1", "browse", "--url", "http://127.0.0.1:1", "--video"), shotOk = run("planner#1", "browse", "--url", "http://127.0.0.1:1");
    t("CX27", "FUNCTIONAL, the real tools: (1) qa_check, qa_record, qa_give_up, the four preview_* commands and the old report alias no longer exist; (2) the master cannot start the QA agent for a greeting (no writer in the task): refused with the reason, even without a model call; (3) --user-asked starts it; (4) after a builder worked it starts; (5) a project with .loopsAI/config.json qa_check:false refuses VIDEO for any agent (a planner here) but not a screenshot",
      gone.every((g) => g.ok === false && /unknown command/.test(String(g.reason))) && hi.ok === false && /QA was NOT started/.test(hi.reason) && !/QA was NOT started/.test(String(asked.reason ?? "")) && !/QA was NOT started/.test(String(built.reason ?? ""))
      && vidOff.ok === false && /video is OFF/.test(String(vidOff.reason)) && !/video is OFF/.test(String(shotOk.reason ?? "")), JSON.stringify([gone.map((g) => String(g.reason ?? g.raw).slice(0, 30)), hi.reason?.slice(0, 40), String(asked.reason ?? asked.raw ?? "").slice(0, 60), String(vidOff.reason).slice(0, 50), String(shotOk.reason ?? "").slice(0, 40)]));
    // background tasks are GENERIC: any command, a description, a status, a log file; a port on request; no time limit, no project logic
    const one = run("builder#1", "bg_start", "--cmd", "echo hello from a task; sleep 1", "--label", "one-off", "--wait", "5");
    const titled = run("builder#1", "bg_start", "--cmd", "sleep 1", "--title", "preview", "--label", "landing page preview", "--wait", "3");
    const srv = run("builder#1", "bg_start", "--cmd", "python3 -m http.server {port} --bind 127.0.0.1", "--dir", "run_test/app", "--port", "auto", "--label", "app folder", "--wait", "10");
    let served = ""; try { served = (spawnSync("curl", ["-s", "-m", "3", String(srv.url)], { encoding: "utf8" }).stdout ?? "").slice(0, 20); } catch { /* no curl */ }
    const pub = run("builder#1", "get_public_url", "--id", String(srv.id)), pubPort = run("builder#1", "get_public_url", "--port", String(srv.port), "--path", "x"), pubNone = run("builder#1", "get_public_url");
    const fixed = run("builder#1", "bg_start", "--cmd", "python3 -m http.server 5377 --bind 127.0.0.1", "--label", "a server that chose its own port", "--wait", "3"), unlinked = fixed.public_url === undefined && fixed.port === undefined;
    const linkedRes = run("builder#1", "get_public_url", "--port", "5377", "--id", String(fixed.id)), listed = (run("builder#1", "bg_list").tasks ?? []).find((x: { id: string }) => x.id === fixed.id); run("builder#1", "bg_stop", "--id", String(fixed.id));
    const restarted = run("builder#1", "bg_restart", "--id", String(srv.id)); const stopped = run("builder#1", "bg_stop", "--id", String(restarted.id ?? srv.id)), left = run("builder#1", "bg_list");
    t("CX31", "background tasks are generic: any command with a title (default server_run, or a kind like preview), a description, a status, an exit code and a log file; --port auto gives a free port and a url the task really answers on; restart keeps the port; get_public_url turns a PORT into the address a person's browser opens (and says whether it answers), and with --id links that port to a task that had none, so bg_list shows it; stop ends it; no default time limit and no project detection",
      one.status === "succeeded" && one.exit_code === 0 && one.description === "one-off" && one.title === "server_run" && titled.title === "preview" && /hello from a task/.test(one.log) && typeof one.log_file === "string" && srv.ready === true && srv.port >= 5300 && /p>v1/.test(served) && srv.timeout_s === undefined && restarted.port === srv.port && pub.ok === true && pub.reachable === true && /^http:\/\/127\.0\.0\.1:\d+$/.test(pub.url) && /^http:\/\/[^/]+:\d+$/.test(pub.public_url) && pub.public_url.endsWith(":" + srv.port) && /:\d+\/x$/.test(pubPort.public_url) && pubNone.ok === false && unlinked && linkedRes.linked_task === fixed.id && linkedRes.reachable === true && listed?.port === 5377 && /^http:\/\/[^/]+:5377$/.test(listed?.public_url ?? "") && stopped.ok === true && (left.tasks ?? []).length === 0,
      JSON.stringify([one.status, srv.ready, srv.port, served, restarted.port, stopped.ok, (left.tasks ?? []).length])); }
  // ---- the "no video" switch really switches video off in EVERY place a video can be made, also when config.json is the only file of .loopsAI (before any QA note exists)
  { const wd = mkdtempSyncSafe(), wp = join(wd, "run_test", "site"); mkdirSync(join(wp, ".loopsAI"), { recursive: true }); writeFileSync(join(wp, "index.html"), "<p>x</p>");
    const stf = join(wd, "store.json"); new Store2(stf).save();
    const brw = (...a: string[]) => { const r = spawnSync(process.execPath, ["--smol", join(H, "tools.ts"), "browse", "--url", "http://127.0.0.1:1", ...a], { env: { ...process.env, HARNESS_STORE: stf, HARNESS_TASK: "t", HARNESS_AGENT: "planner#1", HARNESS_CWD: wd }, encoding: "utf8", timeout: 60_000 }); try { return JSON.parse(r.stdout.trim().split("\n").pop()!); } catch { return { raw: r.stdout + r.stderr }; } };
    const sd = join(wd, "store"); mkdirSync(sd, { recursive: true });
    writeFileSync(join(wp, ".loopsAI", "config.json"), JSON.stringify({ qa_check: false }));
    const offTool = brw("--video"), offShot = brw(), offRun = await videoAfterRun({ workspace: wd, storeDir: sd, offReason: videoOffReason, qa: { enabled: true, kind: "static", app: "site" } as never });
    writeFileSync(join(wp, ".loopsAI", "config.json"), JSON.stringify({ qa_check: true }));
    const onTool = brw("--video"), onRun = await videoAfterRun({ workspace: wd, storeDir: sd, offReason: videoOffReason, qa: { enabled: true, kind: "static", app: "nope" } as never });   // an app that is not there: the switch must NOT be what stops it
    rmSync(join(wp, ".loopsAI", "config.json")); const noCfg = brw("--video");
    t("CX32", "the no-video switch (.loopsAI/config.json qa_check:false) works with NOTHING else in .loopsAI: browse --video is refused for any agent, a plain screenshot is not, and the test runner's --video is skipped with a NO_VIDEO.txt; with qa_check true or no config the switch is not what stops them",
      offTool.ok === false && /video is OFF/.test(String(offTool.reason)) && !/video is OFF/.test(String(offShot.reason ?? "")) && offRun.ok === false && /video is OFF/.test(String(offRun.skipped)) && existsSync(join(sd, "qa", "NO_VIDEO.txt"))
      && !/video is OFF/.test(String(onTool.reason ?? "")) && !/video is OFF/.test(String(onRun.skipped ?? "")) && /does not exist/.test(String(onRun.skipped)) && !/video is OFF/.test(String(noCfg.reason ?? "")),
      JSON.stringify([String(offTool.reason).slice(0, 40), String(offShot.reason ?? "").slice(0, 30), String(offRun.skipped).slice(0, 40), String(onTool.reason ?? "").slice(0, 40), String(onRun.skipped).slice(0, 50), String(noCfg.reason ?? "").slice(0, 30)])); }
  // the backstop: 10 minutes without a tool call and nobody acted = the harness stops it; a moving agent never; waits are long (4 min minimum) and end early
  setup(900, 650); const stopDue = dueAutoStops(ms, "t", NOW).map((x) => x.agent_id).join(), notYet = (setup(900, 400), dueAutoStops(ms, "t", NOW).length), moving = (setup(900, 20), dueAutoStops(ms, "t", NOW).length);
  t("CX18", "backstop: an agent silent for 10 min is due for the harness stop, one silent for 6.6 min or still moving is not; a requested wait of 30 s or more lasts at least 4 min (it ends early on events), a quick look stays short",
    stopDue === mrow.agent_id && notYet === 0 && moving === 0 && waitSeconds(90) === 240 && waitSeconds(300) === 300 && waitSeconds(5) === 5 && waitSeconds(0) === 0, JSON.stringify([stopDue, notYet, moving, waitSeconds(90)]));
  t("CX11", "plan_lint: one owner per file (the same file in two build tasks is an error)", lintPlan(two).errors.some((e) => /overlaps|owned by/.test(e)));
  // 7. a call that waits for a slot says so (visible queue) and says when it got it
  const dir = mkdtempSyncSafe(), rel = await acquireSlot("lead", 1, dir); let told = 0; const p2 = acquireSlot("lead", 1, dir, () => { told++; }); await new Promise((r) => setTimeout(r, 400)); rel(); const rel2 = await p2; rel2();
  t("CX8", "a call that has to wait for a slot is told once (onWait), so the console shows 'queued' instead of 'running'", told === 1);
}

const want = (n: string) => !SUITES || SUITES.has(n);
if (want("core")) await offline();
if (want("parallel")) await offlineParallel();
if (want("safety")) await offlineSafety();
if (want("plans")) await offlineLocksAndPlans();
if (want("records")) await offlineRecords();
if (want("redis")) await redisSuite();
if (want("pm")) await pmSuite();
if (want("regress")) await regressSuite();
if (want("sessions")) await sessionsSuite();
if (want("runs")) await runsSuite();
if (want("parent")) await parentSuite();
if (want("slots")) await slotsSuite();
if (want("protokit")) await protoKitSuite();
if (want("masters")) await mastersSuite();
if (want("context")) await contextSuite();
if (SUITES?.has("lockagents") || (REAL && !SUITES)) await lockAgentsSuite();   // real model: only when asked for
if (REAL) await real(); else console.log("\n(real suite skipped; add --real)");
const failed = writeReport(join(import.meta.dirname, "test_report.md"), "Test 2: f_1_withmulti_ag (multi-agent on demand)",
  `Harness under test: \`harness/\` = the base harness (harness/core/base/) + agent.call, instances, locks, worktrees/patches, board, tools. ${REAL ? "Real suite included." : "Real suite NOT run."}`);
process.exit(failed ? 1 : 0);
