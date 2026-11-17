// Runs the LEAD for one request: its session is persistent too (plan 5.5), its tools are only the tools.ts commands (plus nothing else).
import { tmpdir } from "node:os";
import { memoryBlock } from "./core/loops_ai.ts";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { callAgent, type AgentDef, type CallCtx } from "./core/base.ts";
import type { MStore } from "./core/board.ts";
import { launchDef } from "./core/launch.ts";
import { ensureRun, touchRun } from "./core/session_run.ts";
import { conversationBlock, digest } from "./core/pm.ts";

const HDIR = dirname(fileURLToPath(import.meta.url));
export async function runLead(ctx: CallCtx & { store: MStore }, o: { task_id: string; repo: string; request: string; maxDepth: number; runner: "real" | "fake"; writerMode?: "shared" | "worktree"; models?: Record<string, string>; agents?: string[]; forceSel?: { id: string; resume: boolean; fork_from?: string } }) {
  const { store, defs } = ctx, def = defs.get("lead") as AgentDef;
  store.tx(() => ensureRun(store, { task_id: o.task_id, repo: o.repo, config: { maxDepth: o.maxDepth, runner: o.runner, locks: process.env.HARNESS_LOCKS_URL ? "redis" : "store", locks_url: process.env.HARNESS_LOCKS_URL, models: o.models, strict: store.strict, canary: process.env.HARNESS_CANARY === "1", sessionCap: ctx.sessionCap } }));   // the id to come back to
  const row = store.agentsOf(o.task_id).find((a) => a.name === "lead") ?? store.addAgent(o.task_id, def, { level: 1, cwd: o.repo });
  const ld = launchDef(o.agents ? { ...def, agents: o.agents } : def, defs, 1, o.maxDepth, join(tmpdir(), "lf-launch"));
  const tools = "team";   // harness/bin/team = bun tools.ts (on every agent's PATH): short, nothing to alias; the long `bun --smol /path/tools.ts` form stays allowed
  const env = { HARNESS_STORE: store.file!, HARNESS_TASK: o.task_id, HARNESS_AGENT: row.agent_id, HARNESS_CWD: o.repo, HARNESS_MAX_DEPTH: String(o.maxDepth), HARNESS_RUNNER: o.runner, HARNESS_WRITER_MODE: o.writerMode ?? "shared", HARNESS_MODELS: JSON.stringify(o.models ?? {}), HARNESS_MAX_INSTANCES: "12", ...(o.agents ? { HARNESS_LEAD_AGENTS: o.agents.join(",") } : {}) };
  const prompt = (first: boolean) => [`TASK ${o.task_id}${first ? "" : " (continuing)"}`, first ? conversationBlock(store, o.task_id, o.request) : "", first && store.agentsOf(o.task_id).length > 1 ? "THE TEAM RIGHT NOW:\n" + digest(store, o.task_id) : "", memoryBlock(join(o.repo, "run_test")).trimEnd(), `REQUEST FROM THE PERSON:\n${o.request}`,
    ld.allow.some((a) => a.includes("delegate")) ? `COMMANDS (run them with Bash, one per call; each prints one line of JSON):
  ${tools} delegate --role <role> --session new|<agent_id>|fork:<agent_id> --objective "<what>" --output "<format>" --boundaries "<limits>" [--async] [--mode ask] [--writes a,b] [--title "<what this agent is for>"] [--model haiku]
  ${tools} wait --agents <id>,<id> [--timeout 300]     (after --async: waits and returns the answers)
  ${tools} plan_lint --dir run_test/plan                (FREE check that a plan can be built from alone: README sections, PHASES with Done-when, one owner per file, links)
  ${tools} report_bug --kind <bug|tool_error|plan_defect|blocked|slow|hung|stalled|lazy|bad_output> --severity <low|medium|high> --text "<what you saw, what you did>" [--agent <agent_id>]   (the admin bug tracker: about yourself by default, or about a sub-agent; the session id is attached)
  ${tools} chapter --name <clone|prototype|qa|preview_bg|parallel|planning|new_project|artifact>   (the details of a recipe: read it ONCE before that recipe's first step)
  ${tools} ledger_get --report <report_id>              (the FULL answer of an agent; use it when wait shows truncated:true)
  ${tools} ls [--path <dir>]                            (READ-ONLY: files in the shared workspace run_test/)
  ${tools} read_file --path <file> [--offset N --limit N]   (READ-ONLY: numbered lines of a file in run_test/)
  ${tools} grep --pattern <regex> [--path <dir>]        (READ-ONLY: matching lines in run_test/)
  VERIFICATION is the QA agent's job, not a command of yours: delegate --role qa-reviewer (one per task, 'new' continues it) after your team built or changed something, or when the person asks you to check it. Give it the request, what changed and what the builders verified; it answers PASS / FAIL / PARTIAL with evidence and NEEDS_CHANGES:. Never for a greeting, a question or a status.
  ${tools} apply_patches                                (puts finished writers' files into the project)
  ${tools} plan_answer --plan <id> --item <plan task id> --text "<answer>"   (an agent replied NEEDS_PARENT: you are its parent; answer it, the same agent continues)
  ${tools} agents_list
  ${tools} agent_update --agent <agent_id> --title "<short>" --description "<what it is for>"
  ${tools} say --to <agent_id> --text "<fact or question>"
  ${tools} agent_peek --agent <agent_id> [--n 8]        (READ-ONLY look inside a running agent: last tool calls, silence, held files, a hint: wait / answer / stop)
  ${tools} cost                                         (what the team spent so far and what is left of the project budget)
  PHASED WORK (code enforces "n+1 waits for n"): ${tools} plan_submit --tasks '<JSON [{id,role,objective,output,boundaries,deps?,writes?,phase:1|2|3..}]>' then plan_run --plan <id>; ${tools} plan_status --plan <id> --wait 300; when a phase's tasks are done and its exit check passed (the checks you ran, or the QA agent's PASS): ${tools} phase_pass --plan <id> --phase <n> --evidence "<checks run and what they showed>" (opens phase n+1); ${tools} phase_status --plan <id>
  ${tools} board_status` :"You have no delegate command: multi-agent is off for this task. Answer without sub-agents."].join("\n\n");
  const out = await callAgent({ ...ctx, defs: new Map(defs).set("lead", ld) }, row, o.repo, prompt, o.forceSel, {}, { env });   // the launch copy: prompt = CLAUDE.md + the roles it may call
  store.tx(() => touchRun(store, o.task_id));   // the main agent's Claude session id is now on the run record
  return { row, ...out };
}
