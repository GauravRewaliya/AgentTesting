// Approach 2: "Claude internal" delegation. The lead is a stock `claude -p` that calls its OWN `Agent` / `SendMessage` tools; a PreToolUse hook (hook.ts) answers them
// from the shared core (same store, locks, fixtures, patches, budget, judging as a1). Only the lead's tools, prompt and the hook differ from a1.
// Replaces the lost `.claude/mods/interrupt` mod (docs/06): a hook needs no plugin API, so a Claude Code update cannot break the reply shape.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { callAgent, type AgentDef, type CallCtx } from "../../harness/core/base.ts";
import type { MStore } from "../../harness/core/board.ts";
import { ensureRun, touchRun } from "../../harness/core/session_run.ts";
import { conversationBlock } from "../../harness/core/board_view.ts";
import { declarations, launchTools, nativeAgentsJson, nativeEnv } from "../../harness/core/launch.ts";
import { personReply } from "../../harness/lead.ts";
import { resolve } from "../resolve.ts";
import type { Approach, LeadRun } from "../approach_port.ts";

type Mode = "intercept" | "observe";
const HOOK = join(import.meta.dir, "hook.ts");
const NATIVE_TOOLS = ["Agent", "SendMessage", "Read", "Glob", "Grep"];
/** The a1 lead's shell powers (wait, fork_all, plans, phases, patches, workspace reads) as TYPED tools of an MCP server (team_mcp.ts) over the same harness/tools.ts. No Bash, no shell quoting, no `delegate`. */
const TEAM_MCP = join(import.meta.dir, "team_mcp.ts"), TEAM_ALLOW = ["mcp__team"];

/** The lead's launch text, tool allow list and `--agents` JSON for one mode. runLead uses it, and so does the prompt-test runner (test_harness/scripts/prompt_test.ts): ONE assembly, no copy that can drift. */
export async function buildLead(defs: Map<string, AgentDef>, o: { agents?: string[]; maxDepth: number; mode: Mode; name?: string }) {
  const NAME = o.name ?? "a2_native_hook", mode = o.mode, def = defs.get("lead") as AgentDef, roles = o.agents ? { ...def, agents: o.agents } : def, t = launchTools(roles, 1, o.maxDepth);
  const shared = (await Bun.file(def.prompt_file).text()).trimEnd();
  const text = (await Bun.file(resolve(mode === "observe" ? "prompts/lead_native.md" : "prompts/lead.md", NAME).path).text()).trimEnd() + "\n\n# Team rules (same for every approach)\n" + shared + (t.delegate ? `\n\n# Agent types you may call (subagent_type)\n${declarations(roles, defs)}\n` : "\n\nYou have no sub-agents: answer without calling any.\n");
  const teamAllow = mode === "observe" ? [...new Set(roles.agents.flatMap((n) => defs.get(n)?.allow ?? []).filter((a) => !/tools\.ts|delegate/.test(a)))] : [];
  const allow = [...new Set([...NATIVE_TOOLS, ...TEAM_ALLOW, ...teamAllow])];
  const agents = mode === "observe" ? (t.delegate ? nativeAgentsJson(roles, defs) : {}) : Object.fromEntries((t.delegate ? roles.agents : []).flatMap((n) => { const d = defs.get(n); return d ? [[n, { description: d.description, prompt: "unused" }]] : []; }));
  return { text, allow, tools: [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))], agents, roles, delegate: t.delegate, def };
}

const makeRunLead = (NAME: string, mode: Mode) => async function runLead(ctx: CallCtx & { store: MStore }, o: LeadRun) {
  const { store, defs } = ctx, def = defs.get("lead") as AgentDef;
  store.tx(() => ensureRun(store, { task_id: o.task_id, repo: o.repo, config: { maxDepth: o.maxDepth, runner: o.runner, locks: process.env.HARNESS_LOCKS_URL ? "redis" : "store", locks_url: process.env.HARNESS_LOCKS_URL, models: o.models, strict: store.strict, canary: process.env.HARNESS_CANARY === "1", sessionCap: ctx.sessionCap } }));
  const row = store.agentsOf(o.task_id).find((a) => a.name === "lead") ?? store.addAgent(o.task_id, def, { level: 1, cwd: o.repo });
  const L = await buildLead(defs, { agents: o.agents, maxDepth: o.maxDepth, mode, name: NAME }), roles = L.roles, t = { delegate: L.delegate };
  const dir = join(tmpdir(), "lf-launch"); mkdirSync(dir, { recursive: true });
  const prompt_file = join(dir, `lead.${NAME}.${Date.now().toString(36)}.md`); writeFileSync(prompt_file, L.text);
  const ld: AgentDef = { ...def, prompt_file, tools: L.tools, allow: L.allow }, agents = L.agents;
  const env = { HARNESS_STORE: store.file!, HARNESS_TASK: o.task_id, HARNESS_AGENT: row.agent_id, HARNESS_CWD: o.repo, HARNESS_MAX_DEPTH: String(o.maxDepth), HARNESS_RUNNER: o.runner, HARNESS_WRITER_MODE: o.writerMode ?? "shared", HARNESS_MODELS: JSON.stringify(o.models ?? {}), HARNESS_MAX_INSTANCES: "12", ...(o.agents ? { HARNESS_LEAD_AGENTS: o.agents.join(",") } : {}), A2_MODE: mode, ...(mode === "observe" ? nativeEnv(o.maxDepth) : {}) };
  const hk = [{ matcher: "Agent|Task|SendMessage", hooks: [{ type: "command", command: `bun --smol ${HOOK}` }] }];
  const settings = { hooks: { PreToolUse: hk, ...(mode === "observe" ? { PostToolUse: hk, SubagentStop: [{ hooks: [{ type: "command", command: `bun --smol ${HOOK}` }] }] } : {}) } };
  const request = [`TASK ${o.task_id}`, conversationBlock(store, o.task_id, o.request), `REQUEST FROM THE PERSON:\n${o.request}`].filter(Boolean).join("\n\n");
  const out = await callAgent({ ...ctx, defs: new Map(defs).set("lead", ld) }, row, o.repo, (first) => first ? request : `TASK ${o.task_id} (continuing)\nREQUEST FROM THE PERSON:\n${o.request}`, o.forceSel, {}, { env, extraArgs: ["--settings", JSON.stringify(settings), "--agents", JSON.stringify(agents), "--mcp-config", JSON.stringify({ mcpServers: { team: { command: "bun", args: ["--smol", TEAM_MCP], env: Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([k, v]) => v !== undefined && /^(HARNESS_|PATH$|HOME$|CLAUDE_CONFIG_DIR$|TMPDIR$|BUN_)/.test(k)) as [string, string][]) } } })] });
  if (mode === "observe") {   // a native sub-agent whose SubagentStop never came must not hang the runner's wait loop: give it 120 s, then close the call as failed
    for (let w = 0; w < 120; w++) { store.reload(); if (!store.calls.some((c) => c.task_id === o.task_id && c.status === "granted" && c.callee_agent_id)) break; await Bun.sleep(1000); }
    store.tx(() => { for (const c of store.calls) if (c.task_id === o.task_id && c.status === "granted" && c.callee_agent_id) { c.status = "failed"; c.reason = "native_no_stop: no SubagentStop within 120 s of the lead's end"; const a = store.agent(o.task_id, c.callee_agent_id); if (a && a.status === "running") { a.status = "failed"; a.activity = "native_no_stop"; } } });
  }
  store.tx(() => touchRun(store, o.task_id));
  return { row, ...out, reply: personReply(out.reply) };
}

const caps = { spawn: "ok", followup: "ok", async_wait: "ok", fork: "ok", locks_worktrees_patches: "ok", phases_plans: "ok", budget_kill: "ok", stock_lead_agent_tool: "ok" } as const;
export const a2: Approach = {
  name: "a2_native_hook",
  promptDir: join(import.meta.dir, "prompts"),
  capabilities: caps,
  runLead: makeRunLead("a2_native_hook", "intercept"),
};
/** Same lead, but the NATIVE Agent tool runs real sub-agents; hooks only record and police (observe.ts). Answers "does the native flow work?" */
export const a2observe: Approach = {
  name: "a2_native_observe",
  promptDir: join(import.meta.dir, "prompts"),
  capabilities: { ...caps, locks_worktrees_patches: "no", budget_kill: "partial" },
  runLead: makeRunLead("a2_native_hook", "observe"),
};
// TESTED: self_test/approach_a2.ts (offline); `--fake` run; ONE real run 2026-11-18: test_expo_go eg_tw_01_0073f46 PASS (lead called expo-go once, $0.07). NOT_TESTED: follow-up via SendMessage, multi-call cases, chains.
// NOT_POSSIBLE: the reply reaches the lead as a hook deny reason, not as the native Agent tool_result. (--async/wait/fork_all/plans: ok since 2026-11-18, through `Agent{run_in_background}` + the `team` commands.)
