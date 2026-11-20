// Approach 1: the lead delegates with the `team` shell commands (team agent <role> / agent wait / plan submit ...), served by harness/tools.ts.
// The lead's tool is Bash(team *); everything it can do is in the command list of leadkit/common.ts teamCommands("cli").
// Sub-agents, tools, locks, worktrees and fixtures are the shared ones. Nothing here needs a hook: a shell command is already one call.
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTS_DIR } from "@core/config.ts";
import type { AgentDef } from "../../harness/core/base.ts";
import { launchDef, launchTools } from "../../harness/core/launch.ts";
import { requestPieces, teamCommands } from "../../harness/leadkit/common.ts";
import { BaseApproach, type ApproachSpec, type LeadLaunch, type LeadRun } from "../approach_port.ts";

const SPEC: ApproachSpec = {
  name: "a1_team_cli", delegate: "shell-cli", hooks: [], guard: null,   // TODO: a lite guard for the a1 lead too (it has Bash(team *) and Read like a2); a1's behaviour stays as it was for now
  capabilities: { spawn: "ok", followup: "ok", async_wait: "ok", fork: "ok", locks_worktrees_patches: "ok", phases_plans: "ok", budget_kill: "ok", stock_lead_agent_tool: "no" },
};

export class A1 extends BaseApproach {
  readonly spec = SPEC;
  readonly promptDir = join(AGENTS_DIR, "lead");   // lead CLAUDE.md + chapters/; override in approaches/custom/a1_team_cli/ or custom/_all/

  async describeLaunch(defs: Map<string, AgentDef>, o: Pick<LeadRun, "agents" | "maxDepth">): Promise<LeadLaunch> {
    const def = defs.get("lead") as AgentDef, roles = o.agents ? { ...def, agents: o.agents } : def;
    const ld = launchDef(roles, defs, 1, o.maxDepth, join(tmpdir(), "lf-launch"));   // CLAUDE.md + the roles it may call
    return { text: readFileSync(ld.prompt_file, "utf8"), allow: ld.allow, tools: ld.tools, delegate: launchTools(roles, 1, o.maxDepth).delegate, extra: () => [] };
  }

  protected request(first: boolean, o: LeadRun, store: Parameters<typeof requestPieces>[0], L: LeadLaunch): string {
    return [...requestPieces(store, o, first), L.delegate ? teamCommands("team", "cli") : "You have no `agent` command: multi-agent is off for this task. Answer without sub-agents."].join("\n\n");
  }
}
export const a1 = new A1();
// NOT_TESTED: no real lead run through this adapter yet (self_test/multi.ts parity run and the offline checks only).
