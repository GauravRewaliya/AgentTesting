// WHAT EVERY APPROACH'S LEAD DOES THE SAME WAY (one copy, used by approaches/approach_port.ts for every approach):
// start the run record and the lead's agent row, the HARNESS_* environment, the request the lead reads each turn, the list of `team` commands, the reply for the person.
import { join } from "node:path";
import type { CallCtx, AgentDef } from "../core/base.ts";
import type { MStore } from "../core/board.ts";
import { conversationBlock, digest } from "../core/board_view.ts";
import { memoryBlock } from "../core/loops_ai.ts";
import { ensureRun } from "../core/session_run.ts";
import type { LeadRun } from "../../approaches/approach_port.ts";

/** The run record (the id you come back to) and the lead's agent row. */
export function startLeadRun(ctx: CallCtx & { store: MStore }, o: LeadRun) {
  const { store, defs } = ctx, def = defs.get("lead") as AgentDef;
  store.tx(() => ensureRun(store, { task_id: o.task_id, repo: o.repo, config: { maxDepth: o.maxDepth, runner: o.runner, locks: process.env.HARNESS_LOCKS_URL ? "redis" : "store", locks_url: process.env.HARNESS_LOCKS_URL, models: o.models, strict: store.strict, canary: process.env.HARNESS_CANARY === "1", sessionCap: ctx.sessionCap } }));
  const row = store.agentsOf(o.task_id).find((a) => a.name === "lead") ?? store.addAgent(o.task_id, def, { level: 1, cwd: o.repo });
  return { def, row };
}

/** The environment every tool, hook and sub-agent of this lead reads (tools/ctx.ts, hooks). Same for every approach. */
export const leadEnv = (store: MStore, o: LeadRun, agentId: string): Record<string, string> => ({
  HARNESS_STORE: store.file!, HARNESS_TASK: o.task_id, MASTER_SESSION_ID: o.task_id, HARNESS_AGENT: agentId, HARNESS_CWD: o.repo, HARNESS_MAX_DEPTH: String(o.maxDepth), HARNESS_RUNNER: o.runner,
  HARNESS_WRITER_MODE: o.writerMode ?? "shared", HARNESS_MODELS: JSON.stringify(o.models ?? {}), HARNESS_MAX_INSTANCES: "12", ...(o.agents ? { HARNESS_LEAD_AGENTS: o.agents.join(",") } : {}),
});

/** What the lead reads each turn, as the pieces every approach shares: the task line, the conversation so far and the team (first turn only), the project memory, the person's words.
 *  An approach adds its own tail (a1: the command list) and joins them. */
export function requestPieces(store: MStore, o: LeadRun, first: boolean): string[] {
  return [`TASK ${o.task_id}${first ? "" : " (continuing)"}`, first ? conversationBlock(store, o.task_id, o.request) : "", first && store.agentsOf(o.task_id).length > 1 ? "THE TEAM RIGHT NOW:\n" + digest(store, o.task_id) : "",
    memoryBlock(join(o.repo, "run_test")).trimEnd(), `REQUEST FROM THE PERSON:\n${o.request}`];
}

/** The `team` commands of a lead (harness/bin/team = bun tools.ts, on every agent's PATH). `cli` (a1) also starts sub-agents with `team agent <role>`; `native` (a2) starts them with the Agent tool, so that line is not there. */
export function teamCommands(t: string, how: "cli" | "native"): string {
  const qa = how === "cli" ? "agent qa-reviewer (one per task, 'new' continues it)" : "the qa-reviewer agent (one per task, SendMessage continues it)";
  return [
    how === "cli" ? `COMMANDS (run them with Bash, one per call; each prints one line of JSON):` : `TEAM COMMANDS (run them with Bash, one per call; each prints one line of JSON). Sub-agents are started with the Agent tool, not with a command here:`,
    ...(how === "cli" ? [`  ${t} agent <role> --session new|<agent_id>|fork:<agent_id> --objective "<what>" --output "<format>" --boundaries "<limits>" [--async] [--mode ask] [--writes a,b] [--title "<what this agent is for>"] [--model haiku]`] : []),
    `  ${t} agent wait --agents <id>,<id> [--timeout 300]     (after --async: waits and returns the answers)`,
    `  ${t} plan lint --dir run_test/plan                (FREE check that a plan can be built from alone: README sections, PHASES with Done-when, one owner per file, links)`,
    `  ${t} bug --kind <bug|tool_error|plan_defect|blocked|slow|hung|stalled|lazy|bad_output> --severity <low|medium|high> --text "<what you saw, what you did>" [--agent <agent_id>]   (the admin bug tracker: about yourself by default, or about a sub-agent; the session id is attached)`,
    `  ${t} chapter --name <clone|prototype|qa|preview_bg|parallel|planning|new_project|artifact>   (the details of a recipe: read it ONCE before that recipe's first step)`,
    `  ${t} ledger_get --report <report_id>              (the FULL answer of an agent; use it when wait shows truncated:true)`,
    `  ${t} ls [--path <dir>]                            (READ-ONLY: files in the shared workspace run_test/)`,
    `  ${t} read_file --path <file> [--offset N --limit N]   (READ-ONLY: numbered lines of a file in run_test/)`,
    `  ${t} grep --pattern <regex> [--path <dir>]        (READ-ONLY: matching lines in run_test/)`,
    `  VERIFICATION is the QA agent's job, not a command of yours: ${qa} after your team built or changed something, or when the person asks you to check it. Give it the request, what changed and what the builders verified; it answers PASS / FAIL / PARTIAL with evidence and NEEDS_CHANGES:. Never for a greeting, a question or a status.`,
    `  ${t} agent patches                                (puts finished writers' files into the project)`,
    `  ${t} plan answer --plan <id> --item <plan task id> --text "<answer>"   (an agent replied NEEDS_PARENT: you are its parent; answer it, the same agent continues)`,
    `  ${t} agent list`,
    `  ${t} agent update --agent <agent_id> --title "<short>" --description "<what it is for>"`,
    `  ${t} say --to <agent_id> --text "<fact or question>"`,
    `  ${t} agent peek --agent <agent_id> [--n 8]        (READ-ONLY look inside a running agent: last tool calls, silence, held files, a hint: wait / answer / stop)`,
    `  ${t} cost                                         (what the team spent so far and what is left of the project budget)`,
    `  PHASED WORK (code enforces "n+1 waits for n"): ${t} plan submit --tasks '<JSON [{id,role,objective,output,boundaries,deps?,writes?,phase:1|2|3..}]>' then plan run --plan <id>; ${t} plan status --plan <id> --wait 300; when a phase's tasks are done and its exit check passed (the checks you ran, or the QA agent's PASS): ${t} phase pass --plan <id> --phase <n> --evidence "<checks run and what they showed>" (opens phase n+1); ${t} phase status --plan <id>`,
    `  ${t} board_status`,
  ].join("\n");
}

/** The lead talks to a PERSON: the sub-agent protocol marker `NEEDS_PARENT:` must never reach them (a real lead wrote it in front of its question). The question stays, the marker goes. */
export const personReply = (reply: string): string => (reply ?? "").replace(/^[ \t>*_]*NEEDS_PARENT:?[*_ \t]*/gim, "");
