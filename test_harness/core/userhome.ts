// THE USER HOME (one user for now): everything a person adds or changes lives in ONE folder, like a session has `workspace/` + `store/`:
//   test_harness/.state/home/
//     settings.json       { disabled[], positions{}, integrations{} }   no secrets
//     secrets.json        { github: {token}, jira: {token} }            mode 600, never returned by an API, never in a prompt/log/fixture
//     custom_claude/      what the user ADDS on top of the container's Claude profile (the "extra claude"):
//       agents/<name>/    user agents and clones (agent.json + .claude/CLAUDE.md [+ settings.json]), same shape as a default one
//       skills/<name>/    user skills (SKILL.md), offered to agents as a plugin
//     artifact_runs/      what the Artifact cases (testrun/artifact_run.ts) published: one folder + json per case
//     chrome-profile/     the browser profile (logins stay); legacy: test_harness/.state/chrome-profile is used while this one does not exist
// Defaults (core/agents/main_flow_agents) are repo files and are NEVER written here or edited. Env AGENT_HOME moves the folder (a docker volume).
// The harness reads this layer ONLY when HARNESS_USER_HOME=1 (the dashboard sets it for runs it starts); test suites and self-tests never set it, so a person's settings cannot change a test.
// Imports nothing from the project (paths.ts / config.ts stay the only owners of their values).
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const STATE_BASE = join(import.meta.dir, "..", ".state");
export const HOME_DIR = process.env.AGENT_HOME ?? join(STATE_BASE, "home");
export const SETTINGS_FILE = join(HOME_DIR, "settings.json"), SECRETS_FILE = join(HOME_DIR, "secrets.json");
export const CUSTOM_CLAUDE = join(HOME_DIR, "custom_claude"), USER_AGENTS_DIR = join(CUSTOM_CLAUDE, "agents"), USER_SKILLS_DIR = join(CUSTOM_CLAUDE, "skills");
/** Browser profile: the home one, else the legacy one when only that exists (never moved automatically: a Chrome may be using it). */
export const chromeProfile = (): string => { const h = join(HOME_DIR, "chrome-profile"), legacy = join(STATE_BASE, "chrome-profile"); return !existsSync(h) && existsSync(legacy) ? legacy : h; };

/** Output of the Artifact runs (moved here from test_harness/.state/artifact_runs). */
export const ARTIFACT_RUNS = join(HOME_DIR, "artifact_runs");

import { DEFAULT_RULES, type Rules } from "./orchistraitor/f3_multiagent/harness/leadkit/guard.ts";
export type IntegrationId = "github" | "jira" | "figma";
export interface IntegrationSetting { enabled: boolean; agents: string[]; site?: string; email?: string }
/** `plugins`: name of an installed Claude plugin -> the agents it is loaded for (nothing ticked = not loaded) */
export interface HomeSettings { disabled: string[]; positions: Record<string, { parent?: string; x?: number; y?: number }>; integrations: Partial<Record<IntegrationId, IntegrationSetting>>; plugins: Record<string, string[]>;
  /** the lines the person drew on the agents page (free like Vue Flow: any agent may call any agent, several parents allowed, loops allowed): `add` = a call the defaults do not have, `remove` = a default call switched off */
  edges?: { add: [string, string][]; remove: [string, string][] };
  /** safety rules for git / GitHub / Jira (what an agent may NOT do); missing keys = the defaults */
  rules?: Partial<Rules> }
const EMPTY = (): HomeSettings => ({ disabled: [], positions: {}, integrations: {}, plugins: {}, edges: { add: [], remove: [] } });

export function readSettings(): HomeSettings {
  try { return { ...EMPTY(), ...JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) }; } catch { return EMPTY(); }
}
export function writeSettings(s: HomeSettings) { mkdirSync(HOME_DIR, { recursive: true }); writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 1)); }
/** One short block for the LEAD's prompt, built on the fly: only integrations that are added, switched on and ticked for at least one agent show up (nothing connected = no text at all).
 *  `what` is the hint per integration; edit it here. The lead then knows what is connected and whom to ask. */
const HINT: Record<IntegrationId, string> = {
  github: "repos, pull requests and branches (clone, review, fix in the same PR, branch from a branch, open a PR)",
  jira: "tickets and tasks (what is left, who has what); read-only",
  figma: "design files and frames (read-only)",
};
export function integrationHints(): string {
  if (!userHomeOn()) return "";
  const s = readSettings(), rows = INTEGRATIONS.filter((d) => s.integrations[d.id]?.enabled && secretValue(d.id) && s.integrations[d.id]!.agents.length)
    .map((d) => `- ${d.label} (${HINT[d.id]}): ${s.integrations[d.id]!.agents.join(", ")}`);
  for (const [key, ags] of Object.entries(s.plugins)) if (ags.length && key.includes(":") && pluginSupported(key)) rows.push(`- ${key.replace(":", " / ")} (${CONNECTOR_KEY.test(key) ? "connector" : "plugin"}): ${ags.join(", ")}`);
  return rows.length ? `# Connected tools\nAsk the listed agent for work on these (the lead may use its own, for a quick look):\n${rows.join("\n")}` : "";
}
/** The rules every agent launch gets: the defaults, plus what the person set in Settings (only on runs the dashboard starts). */
export const guardRules = (): Rules => ({ ...DEFAULT_RULES, ...(process.env.HARNESS_USER_HOME === "1" ? readSettings().rules : {}) });
export const updateSettings = (f: (s: HomeSettings) => void): HomeSettings => { const s = readSettings(); f(s); writeSettings(s); return s; };

// ---- secrets: written 600, read only by `integrationLaunch` and the connection test; `secretInfo` is all an API may show
type Secrets = Partial<Record<IntegrationId, { token: string }>>;
const readSecrets = (): Secrets => { try { return JSON.parse(readFileSync(SECRETS_FILE, "utf8")); } catch { return {}; } };
export function setSecret(id: IntegrationId, token: string | null) {
  const s = readSecrets(); if (token) s[id] = { token }; else delete s[id];
  mkdirSync(HOME_DIR, { recursive: true }); writeFileSync(SECRETS_FILE, JSON.stringify(s)); try { chmodSync(SECRETS_FILE, 0o600); } catch { /* best effort */ }
}
export const secretInfo = (id: IntegrationId): { has_token: boolean; last4?: string } => { const t = readSecrets()[id]?.token; return t ? { has_token: true, last4: t.slice(-4) } : { has_token: false }; };
export const secretValue = (id: IntegrationId): string | undefined => readSecrets()[id]?.token;

// ---- integrations: each is an MCP server definition (remote HTTP or a local stdio command) built from the saved credentials at launch time only.
//   github  official remote server (the one Claude's own `github` plugin uses), bearer token
//   jira    Atlassian Rovo remote server, personal API token as Basic auth (an org admin must enable API-token auth; endpoint /v1/mcp, verify with a real token)
//   figma   the official remote server is OAuth-only (no static token), so a token needs the community Framelink server (`figma-developer-mcp`, run with pnpm dlx; read-only design data)
// The definitions are DATA: if a vendor moves an endpoint or a package, change it here.
export type McpServer = { type: "http"; url: string; headers: Record<string, string> } | { command: string; args: string[]; env: Record<string, string> };
export interface IntegrationDef { id: IntegrationId; label: string; about: string; fields: { key: "site" | "email" | "token"; label: string; secret?: boolean; placeholder?: string }[]; server: (s: IntegrationSetting, token: string) => McpServer }
export const INTEGRATIONS: IntegrationDef[] = [
  { id: "figma", label: "Figma", about: "Read design files, frames and components (read-only). Token: Figma > Settings > Security > Personal access tokens. Uses the community Framelink server because Figma's own remote server only accepts a browser login.",
    fields: [{ key: "token", label: "Personal access token", secret: true, placeholder: "figd_…" }],
    server: (_s, token) => ({ command: "pnpm", args: ["dlx", "figma-developer-mcp", "--stdio"], env: { FIGMA_API_KEY: token } }) },
  { id: "github", label: "GitHub", about: "Repos, issues and pull requests through GitHub's official MCP server. Use a fine-grained token with only the scopes you want agents to have.",
    fields: [{ key: "token", label: "Personal access token", secret: true, placeholder: "github_pat_…" }],
    server: (_s, token) => ({ type: "http", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: `Bearer ${token}` } }) },
  { id: "jira", label: "Jira", about: "Jira (and Confluence) through Atlassian's remote MCP server. Needs an Atlassian API token (id.atlassian.com > Security > API tokens); an org admin must allow API-token auth.",
    fields: [{ key: "email", label: "Account email" }, { key: "token", label: "API token", secret: true }],
    server: (s, token) => ({ type: "http", url: "https://mcp.atlassian.com/v1/mcp", headers: { Authorization: "Basic " + Buffer.from(`${s.email ?? ""}:${token}`).toString("base64") } }) },
];

/** `--mcp-config` + the allow entries for ONE agent: only the integrations that are enabled, have a token AND were ticked for this agent. Nothing ticked = nothing added. */
export function integrationLaunch(agent: string): { args: string[]; allow: string[] } {
  const s = readSettings(), servers: Record<string, unknown> = {}, allow: string[] = [];
  for (const d of INTEGRATIONS) {
    const set = s.integrations[d.id], token = secretValue(d.id);
    if (!set?.enabled || !token || !set.agents.includes(agent)) continue;
    servers[d.id] = d.server(set, token); allow.push("mcp__" + d.id);
  }
  return Object.keys(servers).length ? { args: ["--mcp-config", JSON.stringify({ mcpServers: servers })], allow } : { args: [], allow: [] };
}
// ---- the user's own Claude plugins (installed through Claude itself, kept in the Claude profile = the volume): listed here, loaded per agent with --plugin-dir
export interface InstalledPlugin { name: string; version: string; scope: string; dir: string; profile: string; /** MCP servers the plugin brings (its .mcp.json): each can be ticked on its own */ servers: string[] }
/** the MCP servers a plugin folder declares (.mcp.json, either `{mcpServers:{..}}` or `{..}`) */
const pluginServers = (dir: string): string[] => { try { const j = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")); return Object.keys(j.mcpServers ?? j); } catch { return []; } };
const profiles = (): string[] => [...new Set([process.env.CLAUDE_CONFIG_DIR, join(homedir(), ".claude"), join(homedir(), ".claude-personal")].filter((x): x is string => !!x))];
export function installedPlugins(): InstalledPlugin[] {
  const out = new Map<string, InstalledPlugin>();
  for (const prof of profiles()) {
    let d: { plugins?: Record<string, { scope?: string; version?: string; installPath?: string }[]> }; try { d = JSON.parse(readFileSync(join(prof, "plugins", "installed_plugins.json"), "utf8")); } catch { continue; }
    for (const [name, v] of Object.entries(d.plugins ?? {})) { const x = v[0]; if (x?.installPath && existsSync(x.installPath) && !out.has(name)) out.set(name, { name, version: x.version ?? "", scope: x.scope ?? "user", dir: x.installPath, profile: prof, servers: pluginServers(x.installPath) }); }
    // plugins your Claude account syncs to this profile (plugins/synced/<org>/<id>/.claude-plugin/plugin.json): they are not in installed_plugins.json
    const sy = join(prof, "plugins", "synced");
    const subdirs = (d: string): string[] => { try { return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };
    for (const a of subdirs(sy)) for (const b of subdirs(join(sy, a))) {
      const dir = join(sy, a, b); let j: { name?: string; version?: string }; try { j = JSON.parse(readFileSync(join(dir, ".claude-plugin", "plugin.json"), "utf8")); } catch { continue; }
      if (j.name && !out.has(j.name)) out.set(j.name, { name: j.name, version: j.version ?? "", scope: "synced", dir, profile: prof, servers: pluginServers(dir) });
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}
/** A plugin (or one of its MCP servers) can be ticked when it is installed in the profile. The tick key is `<plugin>` or `<plugin>:<server>`. */
export const CONNECTOR_KEY = /^claude\.ai:[\w .&()-]{1,60}$/;   // a connector added on claude.ai (shown as `claude.ai <Name>` in `claude mcp list`)
export const pluginSupported = (key: string): boolean => CONNECTOR_KEY.test(key) || installedPlugins().some((p) => p.name === key.split(":")[0] && (!key.includes(":") || p.servers.includes(key.slice(key.indexOf(":") + 1))));
/** The runner drops this marker from the arguments; it means "do not pass --strict-mcp-config" (a ticked plugin's MCP server must be allowed to start). Every tool not allowed by name stays denied. */
export const LOOSE_MCP = "--harness-plugin-mcp";
const toolName = (s: string) => s.replace(/@.*$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
/** What the plugins ticked for this agent add: `--plugin-dir`, the marker when a server is ticked, and one allow entry per ticked server (`mcp__plugin_<plugin>_<server>`); nothing ticked = nothing. */
export function pluginLaunch(agent: string): { args: string[]; allow: string[] } {
  const s = readSettings(), have = new Map(installedPlugins().map((p) => [p.name, p])), dirs = new Set<string>(), allow: string[] = [];
  for (const [key, ags] of Object.entries(s.plugins)) {
    if (!ags.includes(agent) || !pluginSupported(key)) continue;
    if (CONNECTOR_KEY.test(key)) { allow.push(`mcp__claude_ai_${toolName(key.slice(10))}`); continue; }   // the account's connector: the login lives on claude.ai, nothing to load
    const [n, srv] = [key.split(":")[0]!, key.includes(":") ? key.slice(key.indexOf(":") + 1) : ""];
    dirs.add(have.get(n)!.dir); if (srv) allow.push(`mcp__plugin_${toolName(n)}_${toolName(srv)}`);
  }
  return allow.length || dirs.size ? { args: [...[...dirs].flatMap((d) => ["--plugin-dir", d]), ...(allow.length ? [LOOSE_MCP] : [])], allow } : { args: [], allow: [] };
}
/** Integrations + ticked plugins for ONE agent, without the user's own skills (the lead uses this). */
export function toolsLaunch(agent: string): { args: string[]; allow: string[] } {
  if (!userHomeOn()) return { args: [], allow: [] };
  const i = integrationLaunch(agent), p = pluginLaunch(agent);
  return { args: [...i.args, ...p.args], allow: [...i.allow, ...p.allow] };
}

/** The user's skills as a Claude plugin (`--plugin-dir`): a plugin.json is written on the fly the first time there is a skill. */
export function skillsPlugin(): string[] {
  if (!existsSync(USER_SKILLS_DIR) || !readdirSync(USER_SKILLS_DIR).some((n) => existsSync(join(USER_SKILLS_DIR, n, "SKILL.md")))) return [];
  const f = join(CUSTOM_CLAUDE, ".claude-plugin", "plugin.json");
  if (!existsSync(f)) { mkdirSync(join(CUSTOM_CLAUDE, ".claude-plugin"), { recursive: true }); writeFileSync(f, JSON.stringify({ name: "custom-claude", version: "1.0.0", description: "Skills the user added in Settings" })); }
  return ["--plugin-dir", CUSTOM_CLAUDE];
}
export const userHomeOn = (): boolean => process.env.HARNESS_USER_HOME === "1";
/** Everything the launch of agent `name` takes from the user home (empty when the layer is off). */
export function homeLaunch(name: string): { args: string[]; allow: string[] } {
  if (!userHomeOn()) return { args: [], allow: [] };
  const t = toolsLaunch(name);
  return { args: [...t.args, ...skillsPlugin()], allow: t.allow };
}

// ---- the agent layer
export const AGENT_NAME = /^[a-z][a-z0-9-]{1,39}$/;
type Def = { name: string; agents: string[]; dir: string };
/** Where does `a` sit in the tree: does `of` (transitively) call it? Used to keep the tree a DAG. */
export function reaches<T extends { agents: string[] }>(defs: Map<string, T>, from: string, to: string, seen = new Set<string>()): boolean {
  if (from === to) return true; if (seen.has(from)) return false; seen.add(from);
  return (defs.get(from)?.agents ?? []).some((c) => reaches(defs, c, to, seen));
}
/** Apply the user's layer to the loaded defaults (`load` = loadAgents, passed in so this file imports nothing): user agents are added (a default of the same name wins),
 *  a disabled agent is removed from every parent's callee list (it stays loadable), a moved agent changes parent. Idempotent; the defaults' files are untouched. */
export function applyUserLayer<T extends Def>(m: Map<string, T>, load: (roots: string[]) => Map<string, T>): Map<string, T> {
  if (!userHomeOn()) return m;
  const s = readSettings();
  for (const [name, def] of load([USER_AGENTS_DIR])) if (!m.has(name)) m.set(name, def);
  for (const [name, pos] of Object.entries(s.positions)) {
    const d = m.get(name); if (!d || !pos.parent || !m.has(pos.parent) || reaches(m, name, pos.parent)) continue;   // unknown parent or a loop: ignored
    for (const p of m.values()) p.agents = p.agents.filter((c) => c !== name);
    const np = m.get(pos.parent)!; if (!np.agents.includes(name)) np.agents = [...np.agents, name];
  }
  // the drawn lines (no restriction: several parents, loops; the depth cap of a run guards recursion)
  for (const [f, t] of s.edges?.remove ?? []) { const p = m.get(f); if (p) p.agents = p.agents.filter((c) => c !== t); }
  for (const [f, t] of s.edges?.add ?? []) { const p = m.get(f) as (Def & { max_children?: number }) | undefined; if (p && m.has(t) && !p.agents.includes(t)) { p.agents = [...p.agents, t]; p.max_children = Math.max(p.max_children ?? 0, 3); } }
  for (const name of s.disabled) for (const p of m.values()) p.agents = p.agents.filter((c) => c !== name);
  return m;
}
/** A copy of a default (or user) agent folder as a new user agent. */
export function cloneAgent(srcDir: string, name: string, extra: Record<string, unknown> = {}): string {
  const dst = join(USER_AGENTS_DIR, name);
  if (existsSync(dst)) throw new Error(`agent "${name}" already exists`);
  mkdirSync(USER_AGENTS_DIR, { recursive: true }); cpSync(srcDir, dst, { recursive: true });
  const jf = join(dst, "agent.json"), j = JSON.parse(readFileSync(jf, "utf8")); delete j.fixtures; delete j.forbidden;   // a user agent is never a test stand-in
  writeFileSync(jf, JSON.stringify({ ...j, origin: "user", ...extra }, null, 1)); return dst;
}
export const removeUserAgent = (name: string) => { if (!AGENT_NAME.test(name)) throw new Error("bad name"); rmSync(join(USER_AGENTS_DIR, name), { recursive: true, force: true }); };
