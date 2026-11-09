// Runs the LEAD for one request: its session is persistent too (plan 5.5), its tools are only the tools.ts commands (plus nothing else).
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { callAgent, type AgentDef, type CallCtx } from "./core/base.ts";
import type { MStore } from "./core/board.ts";
import { launchDef } from "./core/launch.ts";
import { ensureRun, touchRun } from "./core/session_run.ts";
import { conversationBlock, digest } from "./core/pm.ts";

const HDIR = dirname(fileURLToPath(import.meta.url));
export async function runLead(ctx: CallCtx & { store: MStore }, o: { task_id: string; repo: string; request: string; maxDepth: number; runner: "real" | "fake"; writerMode?: "shared" | "worktree"; models?: Record<string, string> }) {
  const { store, defs } = ctx, def = defs.get("lead") as AgentDef;
  store.tx(() => ensureRun(store, { task_id: o.task_id, repo: o.repo, config: { maxDepth: o.maxDepth, runner: o.runner, locks: process.env.HARNESS_LOCKS_URL ? "redis" : "store", locks_url: process.env.HARNESS_LOCKS_URL, models: o.models, strict: store.strict, canary: process.env.HARNESS_CANARY === "1", sessionCap: ctx.sessionCap } }));   // the id to come back to
  const row = store.agentsOf(o.task_id).find((a) => a.name === "lead") ?? store.addAgent(o.task_id, def, { level: 1, cwd: o.repo });
  const ld = launchDef(def, defs, 1, o.maxDepth, join(tmpdir(), "lf-launch"));
  const tools = `bun --smol ${join(HDIR, "tools.ts")}`;
  const env = { HARNESS_STORE: store.file!, HARNESS_TASK: o.task_id, HARNESS_AGENT: row.agent_id, HARNESS_CWD: o.repo, HARNESS_MAX_DEPTH: String(o.maxDepth), HARNESS_RUNNER: o.runner, HARNESS_WRITER_MODE: o.writerMode ?? "shared", HARNESS_MODELS: JSON.stringify(o.models ?? {}), HARNESS_MAX_INSTANCES: "6" };
  const prompt = (first: boolean) => [`TASK ${o.task_id}${first ? "" : " (continuing)"}`, first ? conversationBlock(store, o.task_id, o.request) : "", first && store.agentsOf(o.task_id).length > 1 ? "THE TEAM RIGHT NOW:\n" + digest(store, o.task_id) : "", `REQUEST FROM THE PERSON:\n${o.request}`,
    ld.allow.some((a) => a.includes("delegate")) ? `COMMANDS (run them with Bash, one per call; each prints one line of JSON):
  ${tools} delegate --role <role> --session new|<agent_id>|fork:<agent_id> --objective "<what>" --output "<format>" --boundaries "<limits>" [--async] [--mode ask] [--writes a,b]
  ${tools} wait --agents <id>,<id> [--timeout 90]     (after --async: waits and returns the answers)
  ${tools} ledger_get --report <report_id>              (the FULL answer of an agent; use it when wait shows truncated:true)
  ${tools} apply_patches                                (puts finished writers' files into the project)
  ${tools} plan_answer --plan <id> --item <plan task id> --text "<answer>"   (an agent replied NEEDS_PARENT: you are its parent; answer it, the same agent continues)
  ${tools} agents_list
  ${tools} agent_update --agent <agent_id> --title "<short>" --description "<what it is for>"
  ${tools} say --to <agent_id> --text "<fact or question>"
  ${tools} board_status` : "You have no delegate command: multi-agent is off for this task. Answer without sub-agents."].join("\n\n");
  const out = await callAgent({ ...ctx, defs: new Map(defs).set("lead", ld) }, row, o.repo, prompt, undefined, {}, { env });   // the launch copy: prompt = CLAUDE.md + the roles it may call
  store.tx(() => touchRun(store, o.task_id));   // the main agent's Claude session id is now on the run record
  return { row, ...out };
}
