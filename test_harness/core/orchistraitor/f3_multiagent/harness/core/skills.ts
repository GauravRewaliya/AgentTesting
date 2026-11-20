// SKILLS MOUNTED ON THE FLY: which skill goes to which agent is declared in ONE file, core/agents/skills.json. For each call the harness builds just the matching skills into a plugin
// folder in core/.build and the agent starts with `--plugin-dir <it>` (the same way the LSP plugin is loaded, runner.ts). An agent that is not listed, or whose hand-over does not match `when`,
// sees no skill at all, so its context holds only what it needs. Free: no model call. The mounted names are written as an event (skills.mounted) so a run shows what was offered.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlugin } from "../leadkit/build.ts";
import { AGENTS_DIR, TEST_AGENTS_DIR } from "@core/config.ts";

export const SKILLS_JSON = join(AGENTS_DIR, "..", "skills.json"), SHARED_SKILLS = join(AGENTS_DIR, "..", "skills");
export interface SkillMount { skills: string[]; agents: string[]; when?: string }

export const loadMounts = (file = SKILLS_JSON): SkillMount[] => { try { return (JSON.parse(readFileSync(file, "utf8")).mounts ?? []) as SkillMount[]; } catch { return []; } };

/** Every skill we have: name -> its folder. A skill kept in an agent's own folder can be mounted for another agent too (declare it in skills.json). */
export function skillLibrary(roots = [AGENTS_DIR, TEST_AGENTS_DIR], shared = SHARED_SKILLS): Map<string, string> {
  const lib = new Map<string, string>(), add = (dir: string) => { if (!existsSync(dir)) return; for (const n of readdirSync(dir)) if (existsSync(join(dir, n, "SKILL.md")) && !lib.has(n)) lib.set(n, join(dir, n)); };
  add(shared); for (const r of roots) if (existsSync(r)) for (const a of readdirSync(r)) add(join(r, a, ".claude", "skills"));
  return lib;
}
const globRe = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");

/** The skill names this agent gets for this hand-over. */
export function skillsFor(agent: string, handover: string, mounts = loadMounts(), lib = skillLibrary()): string[] {
  const out = new Set<string>();
  for (const m of mounts) {
    if (!m.agents.includes(agent) || (m.when && !new RegExp(m.when, "i").test(handover))) continue;
    for (const g of m.skills) for (const n of lib.keys()) if (globRe(g).test(n)) out.add(n);
  }
  return [...out].sort();
}

/** `--plugin-dir` for the skills of one call (empty when none match): a plugin folder built in core/.build by the shared builder (harness/leadkit/build.ts), once per set of skills. */
export function skillArgs(agent: string, handover: string): { args: string[]; names: string[] } {
  const lib = skillLibrary(), names = skillsFor(agent, handover, loadMounts(), lib);
  if (!names.length) return { args: [], names };
  const dir = buildPlugin(`skills-${agent}`, null, { ".claude-plugin/plugin.json": JSON.stringify({ name: "team-skills", version: "1.0.0", description: "Skills mounted for one agent call (core/agents/skills.json)" }) },
    Object.fromEntries(names.map((n) => [`skills/${n}`, lib.get(n)!])));
  return { args: ["--plugin-dir", dir], names };
}

/** Problems of skills.json: an agent that does not exist, a skill pattern that matches nothing, a bad `when`. Empty = fine. */
export function skillProblems(agentNames: string[], mounts = loadMounts(), lib = skillLibrary()): string[] {
  const bad: string[] = [];
  for (const m of mounts) {
    for (const a of m.agents) if (!agentNames.includes(a)) bad.push(`skills.json: agent "${a}" has no folder`);
    for (const g of m.skills) if (![...lib.keys()].some((n) => globRe(g).test(n))) bad.push(`skills.json: "${g}" matches no skill (the library: ${lib.size})`);
    if (m.when) try { new RegExp(m.when); } catch { bad.push(`skills.json: bad regex in when: ${m.when}`); }
  }
  return bad;
}
