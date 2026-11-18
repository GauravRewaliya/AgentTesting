// THE agent index: which agents exist and what they are, read from the agent.json files (no second copy of name/description/role anywhere).
//   main_flow_agents/  the real team          test_agents/  test stand-ins ("fixtures": true)      (both folders: see config.ts)
// Used by test_harness/scripts/validate_cases.ts (does every case agent exist?), the console (available agents) and test_harness/core/orchistraitor/harness_own_custom/runner/claude.ts (the agent types handed to a lead).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_DIR, TEST_AGENTS_DIR } from "../config.ts";
import type { AgentDef } from "../types.ts";

export interface AgentInfo extends AgentDef { kind: "main_flow" | "test"; dir: string; fixtures: boolean }

export function listAgents(): AgentInfo[] {
  const out: AgentInfo[] = [];
  for (const [kind, root] of [["main_flow", AGENTS_DIR], ["test", TEST_AGENTS_DIR]] as const) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root).sort()) {
      const jf = join(root, name, "agent.json");
      if (!existsSync(jf)) continue;
      const j = JSON.parse(readFileSync(jf, "utf8")) as { role?: string; description?: string; forbidden?: boolean; fixtures?: boolean };
      out.push({ name, description: j.description ?? "", role: j.role ?? name, ...(j.forbidden ? { forbidden: true } : {}), kind, dir: join(root, name), fixtures: !!j.fixtures });
    }
  }
  return out;
}
export const agentInfo = (name: string): AgentInfo | undefined => listAgents().find((a) => a.name === name);
export const agentExists = (name: string): boolean => !!agentInfo(name);
