// Loads agents/<name>/agent.json + .claude/{CLAUDE.md,settings.json} (plan, section 20) and checks them (`agents:check`).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDef } from "./types.ts";

export function loadAgents(agentsDir: string): Map<string, AgentDef> {
  const m = new Map<string, AgentDef>();
  for (const name of readdirSync(agentsDir).sort()) {
    const dir = join(agentsDir, name);
    const jf = join(dir, "agent.json");
    if (!existsSync(jf)) continue;
    const j = JSON.parse(readFileSync(jf, "utf8")) as Partial<AgentDef>;
    const sf = join(dir, ".claude", "settings.json");
    const allow: string[] = existsSync(sf) ? (JSON.parse(readFileSync(sf, "utf8")).permissions?.allow ?? []) : [];
    const tools = [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))];
    m.set(name, {
      name, role: j.role ?? "", description: j.description ?? "", model: j.model ?? "haiku", session: j.session ?? "persistent",
      writes: j.writes ?? false, max_children: j.max_children ?? 0, agents: j.agents ?? [], tiers: j.tiers ?? [], session_cap: j.session_cap, timeout_s: j.timeout_s, forbidden: j.forbidden, custom: j.custom, fixtures: j.fixtures, prompts: j.prompts, team_tools: j.team_tools,
      allow, tools, dir, prompt_file: join(dir, ".claude", "CLAUDE.md"),
    });
  }
  return m;
}

/** `agents:check`: returns problems; empty means fine. */
export function checkAgents(defs: Map<string, AgentDef>, maxDepth = 4): string[] {
  const bad: string[] = [];
  for (const d of defs.values()) {
    if (!d.role) bad.push(`${d.name}: agent.json has no role`);
    if (!d.description) bad.push(`${d.name}: agent.json has no description`);
    if (!existsSync(d.prompt_file)) bad.push(`${d.name}: .claude/CLAUDE.md is missing`);
    for (const f of d.prompts ?? []) if (!existsSync(join(d.dir, ".claude", f))) bad.push(`${d.name}: prompts[] names "${f}" which is not in .claude/`);
    if (existsSync(join(d.dir, "prompt.md"))) bad.push(`${d.name}: prompt.md must not exist (the prompt is .claude/CLAUDE.md)`);
    const sub = join(d.dir, ".claude", "agents");
    if (existsSync(sub) && readdirSync(sub).some((f) => f !== ".gitkeep")) bad.push(`${d.name}: .claude/agents must stay empty (declarations are added at run time)`);
    if (d.writes === false && d.tools.some((t) => ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(t))) bad.push(`${d.name}: writes:false but has a write tool`);
    for (const a of d.agents) if (!defs.has(a)) bad.push(`${d.name}: agents[] names "${a}" which has no folder`);
    if (d.agents.length === 0 && d.max_children > 0) bad.push(`${d.name}: max_children>0 but agents[] is empty`);
  }
  // longest call chain must fit MAX_DEPTH, and no cycle
  const depth = (n: string, seen: string[]): number => {
    if (seen.includes(n)) { bad.push(`cycle: ${[...seen, n].join(" -> ")}`); return 0; }
    const d = defs.get(n); if (!d) return 0;
    // an agent that lists ITSELF (opt-in: it may start copies of itself, one level deep) is not a cycle: it adds one level for the copy
    return 1 + Math.max(d.agents.includes(n) ? 1 : 0, ...d.agents.filter((a) => a !== n).map((a) => depth(a, [...seen, n])));
  };
  for (const n of defs.keys()) if (depth(n, []) > maxDepth) bad.push(`${n}: call chain longer than ${maxDepth}`);
  return [...new Set(bad)];
}
