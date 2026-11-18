// What the MODEL really receives per agent, not just the static CLAUDE.md: the harness appends the agent's team-tool documentation (and the lead gets its call-syntax section and the agent declarations).
// Used by `scripts/check_prompts.ts` and the dashboard (Prompt testing page). Free: no model call.
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { AGENTS_DIR } from "./config.ts";
import { buildLead, launchDef } from "./orchestrator.ts";
import { loadAgentsRaw } from "./orchestrator.ts";

export interface LaunchSize { agent: string; staticChars: number; launchChars: number }
export async function launchSizes(): Promise<LaunchSize[]> {
  const defs = loadAgentsRaw([AGENTS_DIR]), out: LaunchSize[] = [];
  for (const [name, def] of defs) {
    let launch = 0;
    try { launch = name === "lead" ? (await buildLead(defs, { maxDepth: 2, mode: "intercept" })).text.length : readFileSync(launchDef(def, defs, 2, 4, tmpdir(), "team").prompt_file, "utf8").length; } catch { /* an agent without a launch prompt */ }
    const files: string[] = JSON.parse(readFileSync(def.dir + "/agent.json", "utf8")).prompts ?? ["CLAUDE.md"];
    out.push({ agent: name, staticChars: files.reduce((n, f) => { try { return n + readFileSync(def.dir + "/.claude/" + f, "utf8").length; } catch { return n; } }, 0), launchChars: launch });
  }
  return out.sort((a, b) => b.launchChars - a.launchChars);
}
