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
  // Which Claude account every `claude` the harness starts uses (Docker follows it too). Change it here only.
  //   ""          = ~/.claude (default)
  //   "-personal" = ~/.claude-personal (any text is appended to ~/.claude as written), or an absolute folder
  //   env HARNESS_CLAUDE_PROFILE (a folder) overrides it for one run.
  // Good to know:
  //   - a CLAUDE_CONFIG_DIR exported in your shell is ignored (the harness prints a warning);
  //   - old sessions stay in their old folder and are still found for resume;
  //   - the usage limit is per account: a "hit your limit" failure is the account, not the prompt.
  claudeProfile: "",
  orchestrator: "f3_multiagent",
  approach: "a2_native_hook",
  stateVersion: "v3",
} as const;

/** The real team (one folder per agent: agent.json + .claude/CLAUDE.md + settings.json): lead, builder, planner, researcher, lookup, ux-designer, qa-reviewer. The lead calls the other six. */
export const AGENTS_DIR = join(import.meta.dir, "agents", "main_flow_agents");
/** Test stand-ins ("fixtures": true, answered from recorded results, declared per case): writer, reviewer, expo-go, package-researcher, web-setup. Never part of the real team. */
export const TEST_AGENTS_DIR = join(import.meta.dir, "agents", "test_agents");
