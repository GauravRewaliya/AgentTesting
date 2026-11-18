// Loads agents/<name>/agent.json + .claude/{CLAUDE.md,settings.json} (plan, section 20) and checks them (`agents:check`).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDef } from "./types.ts";

import { AGENTS_DIR, TEST_AGENTS_DIR } from "@core/config.ts";
export function loadAgents(roots: string[] = [AGENTS_DIR, TEST_AGENTS_DIR]): Map<string, AgentDef> {
  const m = new Map<string, AgentDef>();
  // real team: AGENTS_DIR; test stand-ins (recorded fixtures, declared per case): TEST_AGENTS_DIR (both in test_harness/core, see config.ts)
  const dirs = roots.filter((r) => existsSync(r)).flatMap((r) => readdirSync(r).sort().map((n) => [n, join(r, n)] as const));
  for (const [name, dir] of dirs) {
    const jf = join(dir, "agent.json");
    if (!existsSync(jf)) continue;
    const j = JSON.parse(readFileSync(jf, "utf8")) as Partial<AgentDef>;
    const sf = join(dir, ".claude", "settings.json");
    const allow: string[] = existsSync(sf) ? (JSON.parse(readFileSync(sf, "utf8")).permissions?.allow ?? []) : [];
    const tools = [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))];
    m.set(name, {
      name, role: j.role ?? "", description: j.description ?? "", model: j.model ?? "haiku", session: j.session ?? "persistent",
      writes: j.writes ?? false, max_children: j.max_children ?? 0, agents: j.agents ?? [], tiers: j.tiers ?? [], session_cap: j.session_cap, timeout_s: j.timeout_s, forbidden: j.forbidden, singleton: j.singleton, scratch: j.scratch, custom: j.custom, fixtures: j.fixtures, prompts: j.prompts, team_tools: j.team_tools,
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
    if (d.writes === false && !d.scratch && d.tools.some((t) => ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(t))) bad.push(`${d.name}: writes:false but has a write tool`);   // a SCRATCH agent writes only in its throwaway copy (callee.ts discards it and flags any change to the real project)
    if (d.scratch && d.writes) bad.push(`${d.name}: scratch and writes together: a scratch agent never changes the real project`);
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

/** Does this agent use the HOST's `team` commands (delegate, bg_start, browse, get_public_url ...)? Then it (1) is TOLD about them and (2) must run on the HOST, never in a Docker sandbox: the commands, the background tasks, Chrome and their ports live on the host, and inside a container `localhost:port` is the container's, not the machine's. An agent qualifies when it can call other agents, lists `team_tools`, works in a throwaway copy (`scratch`), or has `tools.ts` in its permissions. The lead and the pm are always host agents. */
export const usesTeamTools = (a: { agents: string[]; team_tools?: string[]; scratch?: boolean; allow: string[] }): boolean => a.agents.length > 0 || !!a.team_tools?.length || !!a.scratch || a.allow.some((x) => x.includes("tools.ts"));
