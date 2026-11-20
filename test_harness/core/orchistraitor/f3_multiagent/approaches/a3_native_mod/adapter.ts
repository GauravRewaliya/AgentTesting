// Approach 3: a MOD, Claude Code's own plugin runtime (the newest way). The lead is a stock `claude -p` with `--plugin-dir <built folder>`; the folder's mod (mod/hooks/register.ts) answers the
// `Agent` / `SendMessage` tools from the shared core and guards the reads, so the lead gets a REAL tool result, not a deny reason. The `.claude` (the plugin folder) is built on the fly by
// harness/leadkit/build.ts into test_harness/core/.build/. Everything else (prompt pieces, `team` commands in Bash, agents declared with --agents, fixtures, locks, budget) is the a2 code: A3 extends A2.
// TODO(phase 3): the `team` commands as typed `$.tool.register` tools, the lead prompt composed with `prompt.compose`, notes/Stop as mod events, sub-agents' own plugin folders (skills, guard) built the same way.
import { join } from "node:path";
import type { AgentDef } from "../../harness/core/base.ts";
import { buildPlugin } from "../../harness/leadkit/build.ts";
import { DEFAULT_GUARD, type GuardPolicy } from "../../harness/leadkit/guard.ts";
import { A2 } from "../a2_native_hook/adapter.ts";
import type { ApproachSpec, LeadLaunch, LeadRun } from "../approach_port.ts";

const HERE = import.meta.dir, TOOLS = join(HERE, "..", "..", "harness", "tools.ts"), GUARD_TS = join(HERE, "..", "..", "harness", "leadkit", "guard.ts"), ACTIVITY = join(HERE, "..", "..", "harness", "hooks", "activity.ts");
const GUARD: GuardPolicy = { ...DEFAULT_GUARD, denyDelegateCommand: true };
const SPEC: ApproachSpec = { name: "a3_native_mod", delegate: "native-mod", hooks: ["tool.call"], guard: GUARD,
  capabilities: { spawn: "ok", followup: "ok", async_wait: "ok", fork: "ok", locks_worktrees_patches: "ok", phases_plans: "ok", budget_kill: "ok", stock_lead_agent_tool: "ok" } };

/** The lead's plugin folder, built from the template: the mod, its generated config.ts and a copy of the guard. */
export const buildLeadMod = (): string => buildPlugin("team-lead", join(HERE, "mod"), { "hooks/config.ts": `export const CFG = ${JSON.stringify({ tools: TOOLS, guard: GUARD })} as const\n` }, { "hooks/guard.ts": GUARD_TS });

export class A3 extends A2 {
  readonly spec: ApproachSpec = SPEC;
  readonly promptDir = join(HERE, "prompts");
  protected headFile(): string { return join(HERE, "prompts", "lead.md"); }

  async describeLaunch(defs: Map<string, AgentDef>, o: Pick<LeadRun, "agents" | "maxDepth">): Promise<LeadLaunch> {
    const L = await super.describeLaunch(defs, o), mod = buildLeadMod();
    // from a2 keep the prompt, the allow list and --agents; drop its hook settings (the mod does that work) and keep only the activity hook (notes, lease) of the shared core
    const settings = { hooks: { PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: `bun --smol ${ACTIVITY}` }] }] } };
    return { ...L, extra: (env) => { const a = L.extra(env), i = a.indexOf("--settings"); a.splice(i, 2, "--settings", JSON.stringify(settings)); return [...a, "--plugin-dir", mod]; } };
  }
}
export const a3 = new A3();
// NOT_TESTED live before this file was written: see self_test/approach_a3.ts (free) and the web_setup run noted in the README.
