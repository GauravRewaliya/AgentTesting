// Approach 3: a MOD, Claude Code's own plugin runtime (the newest way). The lead is a stock `claude -p` with `--plugin-dir <built folder>`; the mod (mod/hooks/*.ts, one file per job) answers
// `Agent` / `SendMessage` from the shared core with a REAL tool result, serves the `team` commands as typed tools, injects per-turn context, guards the reads and adds the agent list to the system prompt.
// The `.claude` (the plugin folder) is built on the fly by harness/leadkit/build.ts into test_harness/core/.build/. The lead has NO Bash: its tools are the typed team tools + Agent / SendMessage + Read / Glob / Grep.
// Everything else (prompt pieces, `--agents`, fixtures, locks, budget, the CLI) is the a2 / core code: A3 extends A2. Sub-agents stay `claude -p` (their skills and guard come from agentPlugin below).
import { join } from "node:path";
import type { AgentDef } from "../../harness/core/base.ts";
import { declarations, launchTools } from "../../harness/core/launch.ts";
import { buildPlugin } from "../../harness/leadkit/build.ts";
import { requestPieces } from "../../harness/leadkit/common.ts";
import { DEFAULT_GUARD, type GuardPolicy } from "../../harness/leadkit/guard.ts";
import { A2 } from "../a2_native_hook/adapter.ts";
import type { ApproachSpec, LeadLaunch, LeadRun } from "../approach_port.ts";
import type { MStore } from "../../harness/core/board.ts";

const HERE = import.meta.dir, H = join(HERE, "..", "..", "harness");
const GUARD: GuardPolicy = { ...DEFAULT_GUARD, denyDelegateCommand: true };
const SPEC: ApproachSpec = { name: "a3_native_mod", delegate: "native-mod", hooks: ["tool.call", "tool.run", "prompt.submit", "prompt.compose", "session.start"], guard: GUARD,
  capabilities: { spawn: "ok", followup: "ok", async_wait: "ok", fork: "ok", locks_worktrees_patches: "ok", phases_plans: "ok", budget_kill: "ok", stock_lead_agent_tool: "ok" } };

/** The lead's plugin folder: the mod template + a generated config.ts + copies of the shared pure files (guard, team tool list). `agents` = the text of the agent list (a section of the system prompt). */
export const buildLeadMod = (agents = ""): string => buildPlugin("team-lead", join(HERE, "mod"),
  { "hooks/config.ts": `export const CFG = ${JSON.stringify({ tools: join(H, "tools.ts"), guard: GUARD, agents })} as const\n` },
  { "hooks/guard.ts": join(H, "leadkit", "guard.ts"), "hooks/team_tools.ts": join(H, "leadkit", "team_tools.ts") });

export class A3 extends A2 {
  readonly spec: ApproachSpec = SPEC;
  readonly promptDir = join(HERE, "prompts");
  protected headFile(): string { return join(HERE, "prompts", "lead.md"); }

  async describeLaunch(defs: Map<string, AgentDef>, o: Pick<LeadRun, "agents" | "maxDepth">): Promise<LeadLaunch> {
    const L = await super.describeLaunch(defs, o), def = defs.get("lead") as AgentDef, roles = o.agents ? { ...def, agents: o.agents } : def, t = launchTools(roles, 1, o.maxDepth);
    const agents = t.delegate ? `# Agent types you may call (subagent_type)\n${declarations(roles, defs)}` : "";
    const mod = buildLeadMod(agents);
    // the lead has no shell: drop every Bash rule, add the typed team tools (plugin tools are `mcp__team__*`, allowed as a rule, not listed in --tools)
    const allow = [...new Set([...L.allow.filter((a) => !/^Bash\b/.test(a)), "mcp__team"])], tools = [...new Set(allow.filter((a) => !a.startsWith("mcp__")).map((a) => a.replace(/\(.*$/, "")))];
    const text = L.text.replace(/\n\n# Agent types you may call[\s\S]*$/, "\n");   // the agent list is a prompt section now (prompt.compose); a lead without sub-agents keeps a2's "no sub-agents" line
    // from a2 keep --agents; replace its hook settings by the shared activity hook only (the mod does the rest) and load the plugin
    const settings = { hooks: { PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: `bun --smol ${join(H, "hooks", "activity.ts")}` }] }] } };
    return { ...L, text, allow, tools, extra: (env) => { const a = L.extra(env), i = a.indexOf("--settings"); a.splice(i, 2, "--settings", JSON.stringify(settings)); return [...a, "--plugin-dir", mod]; } };
  }

  /** What the lead reads each turn: the shared pieces only (the command list is the tools' schemas now; notes, running agents and bg tasks come from the mod's context hook). */
  protected request(first: boolean, o: LeadRun, store: MStore): string { return requestPieces(store, o, first).filter(Boolean).join("\n\n"); }
}
export const a3 = new A3();
// TESTED: self_test/approach_a3.ts (free), test_web_setup, test_basic, test_basic_2 on the hook-era a3 (README "a3_native_mod"); the typed-tools / context / compose version is checked live below in the README.
