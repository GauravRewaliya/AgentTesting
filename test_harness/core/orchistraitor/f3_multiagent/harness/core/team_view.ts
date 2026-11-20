// THE TEAM, AS THE DASHBOARD SEES IT (Settings > Team): every agent with the agents it may call, its tools, its skills and its prompt; the skill library and where each skill is mounted (with the
// person's own layer: add a skill, mount it for an agent); and the a3 mod: its hooks (scanned from the source), when each piece of context is added, and which features are done or still to do.
// Free: no model call, no process started. The server (ui/server/team.ts) is a thin wrapper; every rule lives here so a script or a test can use it too.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTS_DIR, TEST_AGENTS_DIR } from "@core/config.ts";
import { currentApproach, approachName } from "../../approaches/index.ts";
import { MOD_CONTEXT, MOD_FEATURES } from "../../approaches/a3_native_mod/info.ts";
import { listed } from "../leadkit/team_tools.ts";
import { loadAgentsRaw } from "./base/agents.ts";
import { declarations, launchDef, launchTools } from "./launch.ts";
import { SKILLS_JSON, TEAM_HOME, USER_LIBRARY, USER_MOUNTS, readMounts, skillLibrary, type SkillMount } from "./skills.ts";
import type { AgentDef } from "./base.ts";

const F3 = join(import.meta.dir, "..", "..");
const defsAll = (): Map<string, AgentDef> => loadAgentsRaw([AGENTS_DIR, TEST_AGENTS_DIR]);
const NAME = /^[a-z][a-z0-9-]{1,39}$/;
const globRe = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const descriptionOf = (dir: string): string => { try { return /^description:\s*(.+)$/m.exec(readFileSync(join(dir, "SKILL.md"), "utf8"))?.[1]?.trim() ?? ""; } catch { return ""; } };

export interface MountOut { skills: string[]; agents: string[]; when?: string; by: "repo" | "you" }
export interface AgentOut { name: string; role: string; description: string; model: string; writes: boolean; kind: "main" | "test"; fixtures: boolean; branches: string[]; callers: string[]; allow: string[]; promptChars: number; skills: string[]; ownSkills: string[] }
export interface SkillOut { name: string; from: string; description: string; mountedFor: string[]; by: "repo" | "you" }

function mountsAll(): MountOut[] {
  const tag = (m: SkillMount[], by: "repo" | "you"): MountOut[] => m.map((x) => ({ ...x, by }));
  return [...tag(readMounts(SKILLS_JSON), "repo"), ...tag(readMounts(USER_MOUNTS), "you")];
}
const resolve = (patterns: string[], lib: Map<string, string>) => [...lib.keys()].filter((n) => patterns.some((p) => globRe(p).test(n)));

export function overview() {
  const defs = defsAll(), lib = skillLibrary(undefined, undefined, true), mounts = mountsAll(), callers = new Map<string, string[]>();
  for (const d of defs.values()) for (const c of d.agents) callers.set(c, [...(callers.get(c) ?? []), d.name]);
  const agents: AgentOut[] = [...defs.values()].map((d) => {
    const own = join(d.dir, ".claude", "skills");
    return { name: d.name, role: d.role, description: d.description, model: d.model, writes: !!d.writes, kind: d.dir.startsWith(TEST_AGENTS_DIR) ? "test" : "main", fixtures: !!d.fixtures, branches: d.agents, callers: callers.get(d.name) ?? [], allow: d.allow,
      promptChars: existsSync(d.prompt_file) ? statSync(d.prompt_file).size : 0, skills: resolve(mounts.filter((m) => m.agents.includes(d.name)).flatMap((m) => m.skills), lib), ownSkills: existsSync(own) ? readdirSync(own).filter((n) => existsSync(join(own, n, "SKILL.md"))) : [] };
  });
  const skills: SkillOut[] = [...lib].map(([name, dir]) => ({ name, from: dir.startsWith(USER_LIBRARY) ? "you" : (/\/agents\/(?:main_flow_agents|test_agents)\/([^/]+)\/\.claude\//.exec(dir)?.[1] ?? "shared"), description: descriptionOf(dir), by: dir.startsWith(USER_LIBRARY) ? "you" : "repo",
    mountedFor: mounts.filter((m) => resolve(m.skills, new Map([[name, dir]])).length).flatMap((m) => m.agents) }));
  return { approach: approachName(), agents, skills, mounts, home: TEAM_HOME };
}

/** What the model really gets as the system prompt of one agent (the lead: of the CHOSEN approach, plus the section the a3 mod adds with prompt.compose). */
export async function agentPrompt(name: string): Promise<{ text: string; chars: number; note: string }> {
  const defs = defsAll(), def = defs.get(name); if (!def) throw new Error(`no agent "${name}"`);
  if (name === "lead") {
    const L = await currentApproach().describeLaunch(defs, { maxDepth: 2 });
    const section = approachName() === "a3_native_mod" ? `\n\n--- system prompt section "team:agents" (added by the mod with prompt.compose) ---\n# Agent types you may call (subagent_type)\n${declarations(def, defs)}` : "";
    return { text: L.text + section, chars: L.text.length + section.length, note: `approach ${approachName()}` };
  }
  const text = readFileSync(launchDef(def, defs, 2, 4, tmpdir(), "team").prompt_file, "utf8");
  return { text, chars: text.length, note: "as launched at level 2: its CLAUDE.md + the team command docs it needs" };
}

export async function agentTools(name: string) {
  const defs = defsAll(), def = defs.get(name); if (!def) throw new Error(`no agent "${name}"`);
  if (name === "lead") {
    const L = await currentApproach().describeLaunch(defs, { maxDepth: 2 }), typed = approachName() === "a3_native_mod" ? listed().map((t) => ({ name: "mcp__team__" + t.name, description: t.description })) : [];
    return { allow: L.allow, tools: L.tools, typed, canCall: launchTools(def, 1, 2).delegate, note: `approach ${approachName()}${typed.length ? "" : ": the lead types `team ...` commands in Bash"}` };
  }
  return { allow: def.allow, tools: def.tools, typed: [], canCall: def.agents.length > 0, note: def.team_commands?.length ? `team command groups: ${def.team_commands.join(", ")}` : "" };
}

// ---- skills: the person's layer (repo files are never written)
const writeUser = (m: SkillMount[]) => { mkdirSync(TEAM_HOME, { recursive: true }); writeFileSync(USER_MOUNTS, JSON.stringify({ _doc: "Your skill mounts (Settings > Team). The repo's core/agents/skills.json is never written.", mounts: m }, null, 1)); };

export function addSkill(b: { name: string; description: string; body: string }) {
  if (!NAME.test(b.name ?? "")) throw new Error("the name: 2 to 40 characters, lower-case letters, digits and -, starting with a letter");
  if (!b.description?.trim() || !b.body?.trim()) throw new Error("a skill needs a description (when to use it) and a body (what to do)");
  if (skillLibrary(undefined, undefined, true).has(b.name)) throw new Error(`a skill named "${b.name}" already exists`);
  mkdirSync(join(USER_LIBRARY, b.name), { recursive: true });
  writeFileSync(join(USER_LIBRARY, b.name, "SKILL.md"), `---\nname: ${b.name}\ndescription: ${b.description.trim().replace(/\n+/g, " ")}\n---\n${b.body.trim()}\n`);
  return overview();
}
export function mountSkill(b: { skill: string; agents: string[]; when?: string }) {
  const lib = skillLibrary(undefined, undefined, true), defs = defsAll();
  if (!lib.has(b.skill)) throw new Error(`no skill "${b.skill}"`);
  for (const a of b.agents ?? []) if (!defs.has(a)) throw new Error(`no agent "${a}"`);
  if (!b.agents?.length) throw new Error("name at least one agent");
  if (b.when) try { new RegExp(b.when); } catch { throw new Error("`when` is not a valid regular expression"); }
  const mine = readMounts(USER_MOUNTS), same = mine.find((m) => m.skills.length === 1 && m.skills[0] === b.skill && (m.when ?? "") === (b.when ?? ""));
  if (same) same.agents = [...new Set([...same.agents, ...b.agents])]; else mine.push({ skills: [b.skill], agents: b.agents, ...(b.when ? { when: b.when } : {}) });
  writeUser(mine); return overview();
}
export function unmountSkill(b: { skill: string; agent: string }) {
  const mine = readMounts(USER_MOUNTS), had = mine.some((m) => m.skills.includes(b.skill) && m.agents.includes(b.agent));
  if (!had) throw new Error(mountsAll().some((m) => m.by === "repo" && m.agents.includes(b.agent)) ? "this mount is declared in the repo (core/agents/skills.json): change it there" : "no such mount of yours");
  writeUser(mine.map((m) => (m.skills.includes(b.skill) ? { ...m, agents: m.agents.filter((a) => a !== b.agent) } : m)).filter((m) => m.agents.length));
  return overview();
}

// ---- the a3 mod: hooks scanned from the source, context table, features
export function modInfo() {
  const dir = join(F3, "approaches", "a3_native_mod", "mod", "hooks"), files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.includes(".test.") && f !== "config.ts").sort() : [];
  const hooks = files.map((f) => {
    const src = readFileSync(join(dir, f), "utf8"), what = (/^\/\/\s*(.+)$/m.exec(src)?.[1] ?? "").slice(0, 220), loopTools = /for \(const tool of \[([^\]]+)\]/.exec(src)?.[1]?.replace(/['\s]/g, "").split(",").join("|");
    const events = [...src.matchAll(/\bon\(\s*'([\w.]+)'(?:\s*,\s*\{\s*(?:tool(?::\s*'([^']+)'(\s*\+)?)?)?)?/g)].map((m) => ({ event: m[1]!, matcher: m[2] ? m[2] + (m[3] ? "*" : "") : /\{ tool \}/.test(m[0] + src.slice(m.index! + m[0].length, m.index! + m[0].length + 14)) ? loopTools ?? "" : "" }));
    return { file: f, what, events, guarded: /\.catch\(/.test(src) };
  });
  const bd = join(F3, "..", "..", ".build"), built = existsSync(bd) ? readdirSync(bd).filter((n) => n.startsWith("team-lead.")).sort((a, b) => statSync(join(bd, b)).mtimeMs - statSync(join(bd, a)).mtimeMs)[0] ?? null : null;
  return { approach: approachName(), isMod: approachName() === "a3_native_mod", dir: "approaches/a3_native_mod/mod/hooks", built, hooks, context: MOD_CONTEXT, features: MOD_FEATURES };
}
