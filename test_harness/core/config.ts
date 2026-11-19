// THE ONE CONFIG FILE of the test harness (test_harness/core/config.ts): which orchestrator, which approach and which run-data version are current. Nothing else holds these values.
// Change a value here and every consumer follows (test_harness/core/paths.ts reads stateVersion; env STATE_VERSION still overrides for one run).
//   orchestrator   folder under test_harness/core/orchistraitor/ that is the current engine. Outside code (tests, the console, helpers) NEVER names it: it imports test_harness/core/orchestrator.ts (code, not config), which re-exports the current one.
//   approach       how the lead delegates (<orchestrator>/approaches/<name>); env APPROACH overrides for one run
//   stateVersion   run data lives in test_harness/.state/<stateVersion>/ (a new version starts empty, the old one stays on disk)
// AGENTS (same for every orchestrator and approach, below): AGENTS_DIR = the real team, TEST_AGENTS_DIR = test stand-ins.
// Claude profile: ENFORCED in the runner (`claudeEnv()`): every `claude` the harness starts gets CLAUDE_CONFIG_DIR from CONFIG.claudeProfile below (HARNESS_CLAUDE_PROFILE overrides), the shell's value is ignored (warning). Docker mounts the same profile (infra/docker-compose.yml).
// This file must import NOTHING from the project (paths.ts imports it).
import { join } from "node:path";
export const CONFIG = {
  // WHICH CLAUDE ACCOUNT every `claude` the harness starts uses (one static string, change it here only):
  //   "" = ~/.claude (default)   any other text is APPENDED to ~/.claude exactly as written: "-personal" = ~/.claude-personal, "_personal" = ~/.claude_personal, "-other" = ~/.claude-other   or an absolute folder.  Env HARNESS_CLAUDE_PROFILE (a folder) overrides for one run.
  // IF YOU CHANGE IT ALSO CHECK: (1) Docker: nothing to do, the runner passes the same folder to infra/docker-compose.yml as CLAUDE_PROFILE_DIR;
  //   (2) a shell that exports CLAUDE_CONFIG_DIR is ignored (the harness prints a warning); (3) old sessions stay in the other folder (claudeDirs() still finds them for resume);
  //   (4) the account's usage limit is per account: a "hit your limit" failure of a run is the account, not the prompt.
  claudeProfile: "-personal",
  orchestrator: "f3_multiagent",
  approach: "a1_team_cli",
  stateVersion: "v3",
} as const;

/** The real team (one folder per agent: agent.json + .claude/CLAUDE.md + settings.json): lead, builder, planner, researcher, lookup, ux-designer, qa-reviewer. The lead calls the other six. */
export const AGENTS_DIR = join(import.meta.dir, "agents", "main_flow_agents");
/** Test stand-ins ("fixtures": true, answered from recorded results, declared per case): writer, reviewer, expo-go, package-researcher, web-setup. Never part of the real team. */
export const TEST_AGENTS_DIR = join(import.meta.dir, "agents", "test_agents");
