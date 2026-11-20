// Approach 2: Claude's NATIVE delegation. The lead is a stock `claude -p` with the `Agent` / `SendMessage` tools; a PreToolUse hook (hook.ts) answers them from the shared core
// (same store, locks, fixtures, patches, budget, judging as a1). The lead also has Bash(team *) for everything that is not "start an agent" (wait, plans, bg, browser ...), exactly the commands
// of a1 (leadkit/common.ts teamCommands), minus the `team agent <role>` line. The lead's tool list is the lead's own .claude/settings.json plus the native tools: nothing is declared twice.
// Hooks (all in hook.ts, one entry, one function per event): PreToolUse (lite guard + Agent -> delegate), UserPromptSubmit (unread notes), Stop (OFF, see SPEC), SubagentStop (observe mode).
// PostToolUse runs harness/hooks/activity.ts: live activity, lease renewal and notes, the same as for every sub-agent.
//   a2_native_hook     intercept: the native call never runs; the core answers it (fixtures work, locks/patches/budget work).
//   a2_native_observe  observe: Claude's own sub-agent engine runs for real; hooks only record and may refuse (no fixtures, no locks: the core never sees those tools).
import { join } from "node:path";
import type { AgentDef } from "../../harness/core/base.ts";
import { declarations, launchTools, nativeAgentsJson, nativeEnv } from "../../harness/core/launch.ts";
import type { MStore } from "../../harness/core/board.ts";
import type { CallCtx } from "../../harness/core/base.ts";
import { requestPieces, teamCommands } from "../../harness/leadkit/common.ts";
import { DEFAULT_GUARD, type GuardPolicy } from "../../harness/leadkit/guard.ts";
import { resolve } from "../resolve.ts";
import { BaseApproach, type ApproachSpec, type LeadLaunch, type LeadRun } from "../approach_port.ts";

const HOOK = join(import.meta.dir, "hook.ts"), ACTIVITY = join(import.meta.dir, "..", "..", "harness", "hooks", "activity.ts");
const NAME = "a2_native_hook";
/** The lead may NOT start a sub-agent through the shell: the Agent tool is the way (the hook answers it). */
const GUARD: GuardPolicy = { ...DEFAULT_GUARD, denyDelegateCommand: true };
const CAPS = { spawn: "ok", followup: "ok", async_wait: "ok", fork: "ok", locks_worktrees_patches: "ok", phases_plans: "ok", budget_kill: "ok", stock_lead_agent_tool: "ok" } as const;
// TODO(phase 3): typed MCP tools for the team commands (team_mcp.ts is kept and tested). OFF: Bash(team *) does the same for now; switching on means an allow rule `mcp__team`, a prompt that names the tools and this flag.
const USE_MCP = false, TEAM_MCP = join(import.meta.dir, "team_mcp.ts");
// Stop and SessionStart handlers exist in hook.ts but are not listed in `hooks`: add "Stop" here to refuse the end of a lead turn while a background agent still runs (decide after a real run).
const SPEC: ApproachSpec = { name: NAME, delegate: "native-hook", hooks: ["PreToolUse", "PostToolUse", "UserPromptSubmit"], guard: GUARD, capabilities: CAPS };
const SPEC_OBSERVE: ApproachSpec = { name: "a2_native_observe", delegate: "native-observe", hooks: ["PreToolUse", "PostToolUse", "UserPromptSubmit", "SubagentStop"], guard: GUARD, capabilities: { ...CAPS, locks_worktrees_patches: "no", budget_kill: "partial" } };

export class A2 extends BaseApproach {
  readonly spec: ApproachSpec = SPEC;
  readonly promptDir = join(import.meta.dir, "prompts");
  /** The approach's own lead prompt (a3 overrides it). */
  protected headFile(observe: boolean): string { return resolve(observe ? "prompts/lead_native.md" : "prompts/lead.md", NAME).path; }
  protected get observe() { return this.spec.delegate === "native-observe"; }

  async describeLaunch(defs: Map<string, AgentDef>, o: Pick<LeadRun, "agents" | "maxDepth">): Promise<LeadLaunch> {
    const def = defs.get("lead") as AgentDef, roles = o.agents ? { ...def, agents: o.agents } : def, t = launchTools(roles, 1, o.maxDepth), observe = this.observe;
    const shared = (await Bun.file(def.prompt_file).text()).trimEnd();
    const head = (await Bun.file(this.headFile(observe)).text()).trimEnd();
    const text = head + "\n\n# Team rules (same for every approach)\n" + shared
      + (t.delegate ? `\n\n# Agent types you may call (subagent_type)\n${declarations(roles, defs)}\n` : "\n\nYou have no sub-agents: answer without calling any.\n");
    // the lead's own settings.json (Bash(team *), Read ...) + the native tools; observe mode also lets the sub-agents' own tools run (their allow rules, without the team shell commands)
    const subAllow = observe ? roles.agents.flatMap((n) => defs.get(n)?.allow ?? []).filter((a) => !/tools\.ts|delegate|^Bash\(team\b/.test(a)) : [];
    const allow = [...new Set([...t.allow, ...(t.delegate ? ["Agent", "SendMessage"] : []), "Glob", "Grep", ...(USE_MCP ? ["mcp__team"] : []), ...subAllow])];
    const agents = !t.delegate ? {} : observe ? nativeAgentsJson(roles, defs)
      : Object.fromEntries(roles.agents.flatMap((n) => { const d = defs.get(n); return d ? [[n, { description: d.description, prompt: "unused" }]] : []; }));   // intercept: the native engine never runs them, the declaration only makes the types known
    const hook = { type: "command", command: `bun --smol ${HOOK}`, timeout: 1800 };   // seconds: an Agent call blocks inside the hook until the sub-agent answered
    const settings = { hooks: {
      PreToolUse: [{ matcher: "Agent|Task|SendMessage|Read|Glob|Grep|Bash", hooks: [hook] }],
      PostToolUse: observe ? [{ matcher: "Agent|Task|SendMessage", hooks: [hook] }] : [{ matcher: "*", hooks: [{ type: "command", command: `bun --smol ${ACTIVITY}` }] }],
      UserPromptSubmit: [{ hooks: [hook] }],
      ...(observe ? { SubagentStop: [{ hooks: [hook] }] } : {}),
      ...(this.spec.hooks.includes("Stop") ? { Stop: [{ hooks: [hook] }] } : {}),
    } };
    return { text, allow, tools: [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))], delegate: t.delegate,
      extra: (env) => ["--settings", JSON.stringify(settings), "--agents", JSON.stringify(agents),
        ...(USE_MCP ? ["--mcp-config", JSON.stringify({ mcpServers: { team: { command: "bun", args: ["--smol", TEAM_MCP], env: Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([k, v]) => v !== undefined && /^(HARNESS_|PATH$|HOME$|CLAUDE_CONFIG_DIR$|TMPDIR$|BUN_)/.test(k)) as [string, string][]) } } })] : [])] };
  }

  protected request(first: boolean, o: LeadRun, store: MStore, L: LeadLaunch): string {   // the command list rides in the turn, like a1: the system prompt stays under the size limit
    return [...requestPieces(store, o, first), L.delegate ? teamCommands("team", "native") : ""].filter(Boolean).join("\n\n");
  }

  protected extraEnv(o: LeadRun): Record<string, string> {
    return { A2_MODE: this.observe ? "observe" : "intercept", HARNESS_GUARD: JSON.stringify(GUARD), ...(this.observe ? nativeEnv(o.maxDepth) : {}) };
  }

  protected async afterRun({ store }: CallCtx & { store: MStore }, o: LeadRun): Promise<void> {
    if (!this.observe) return;
    // a native sub-agent whose SubagentStop never came must not hang the runner's wait loop: give it 120 s, then close the call as failed
    for (let w = 0; w < 120; w++) { store.reload(); if (!store.calls.some((c) => c.task_id === o.task_id && c.status === "granted" && c.callee_agent_id)) break; await Bun.sleep(1000); }
    store.tx(() => { for (const c of store.calls) if (c.task_id === o.task_id && c.status === "granted" && c.callee_agent_id) { c.status = "failed"; c.reason = "native_no_stop: no SubagentStop within 120 s of the lead's end"; const a = store.agent(o.task_id, c.callee_agent_id); if (a && a.status === "running") { a.status = "failed"; a.activity = "native_no_stop"; } } });
  }
}
export class A2Observe extends A2 { readonly spec: ApproachSpec = SPEC_OBSERVE; }

export const a2 = new A2(), a2observe = new A2Observe();
// TESTED: self_test/approach_a2.ts (offline); ONE real run 2026-11-18 (before this refactor): test_expo_go eg_tw_01_0073f46 PASS (lead called expo-go once, $0.07).
// NOT_TESTED after the refactor: any real run; follow-up via SendMessage; the Bash(team *) lead; the guard hooks; UserPromptSubmit. Stop is written but off.
// NOT_POSSIBLE: the reply reaches the lead as a hook deny reason, not as the native Agent tool_result.
