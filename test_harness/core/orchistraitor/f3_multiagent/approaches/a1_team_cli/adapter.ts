// Approach 1: the lead delegates with the `team` shell commands (team delegate / wait / plan_submit ...), served by harness/tools.ts.
// This is today's f1 engine, unchanged. Sub-agents, tools, locks, worktrees, fixtures are the shared ones.
import { join } from "node:path";
import { AGENTS_DIR } from "@core/config.ts";
import { runLead } from "../../harness/lead.ts";
import type { Approach } from "../approach_port.ts";

export const a1: Approach = {
  name: "a1_team_cli",
  promptDir: join(AGENTS_DIR, "lead"),   // lead CLAUDE.md + chapters/ (the real team lives in test_harness/core/agents/main_flow_agents; override in approaches/custom/a1_team_cli/ or custom/_all/)
  capabilities: { spawn: "ok", followup: "ok", async_wait: "ok", fork: "ok", locks_worktrees_patches: "ok", phases_plans: "ok", budget_kill: "ok", stock_lead_agent_tool: "no" },
  runLead: (ctx, o) => runLead(ctx, o),
};
// NOT_TESTED: only the self_test/multi.ts parity run (230/234, same 4 failures as f1); no real lead run through this adapter yet.
// ImprovementsNeeded: lead.ts, tools.ts and launch.ts still live in ../../harness (shared layout kept so every relative path in the copy stays valid); move them here when core/delegate.ts exists (docs/08 step 4).
