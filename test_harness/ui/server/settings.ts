// Settings API: agents (tree, enable/disable, clone, create, move, delete), integrations (GitHub, Jira) and their per-agent access. State lives in the user home
// (core/userhome.ts: test_harness/.state/home). Defaults are read-only: every write to one is refused here, not only hidden in the UI. No secret ever leaves this file (secretInfo).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_DIR } from "@core/config.ts";
import { loadAgentsRaw, claudeEnv } from "@core/orchestrator.ts";
import { DEFAULT_RULES, type Rules } from "../../core/orchistraitor/f3_multiagent/harness/leadkit/guard.ts";
import { AGENT_NAME, HOME_DIR, INTEGRATIONS, installedPlugins, pluginSupported, USER_AGENTS_DIR, USER_SKILLS_DIR, cloneAgent, readSettings, reaches, removeUserAgent, secretInfo, secretValue, setSecret, updateSettings, type IntegrationId } from "@core/userhome.ts";
import { readdirSync } from "node:fs";

export interface AgentOut { name: string; description: string; role: string; model: string; origin: "default" | "user"; locked: boolean; disabled: boolean; callees: string[]; parent: string | null; callers: string[]; tools: string[]; writes: boolean; x?: number; y?: number; prompt?: string; cloned_from?: string }
const RESERVED = new Set(["lead"]);   // never created, moved under another agent, or disabled by the UI: the lead is the router

function agents(): AgentOut[] {
  const s = readSettings(), def = loadAgentsRaw([AGENTS_DIR]), usr = loadAgentsRaw([USER_AGENTS_DIR]);
  const all = new Map([...def, ...[...usr].filter(([n]) => !def.has(n))]);
  // the effective parent of each agent = the one whose callee list holds it after the user's moves
  const callees = new Map([...all].map(([n, d]) => [n, [...d.agents]]));
  for (const [n, pos] of Object.entries(s.positions)) if (all.has(n) && pos.parent && all.has(pos.parent) && !reaches(all, n, pos.parent)) { for (const l of callees.values()) { const i = l.indexOf(n); if (i >= 0) l.splice(i, 1); } callees.get(pos.parent)!.push(n); }
  for (const [f, t] of s.edges?.remove ?? []) { const l = callees.get(f); if (l) callees.set(f, l.filter((c) => c !== t)); }
  for (const [f, t] of s.edges?.add ?? []) { const l = callees.get(f); if (l && all.has(t) && !l.includes(t)) l.push(t); }
  const hint = (n: string): string | undefined => { try { return JSON.parse(readFileSync(join(all.get(n)!.dir, "agent.json"), "utf8")).tree_parent; } catch { return undefined; } };   // agent.json "tree_parent": where the tree draws an agent that several agents may call
  const parentOf = (n: string) => { const h = hint(n); return h && callees.get(h)?.includes(n) ? h : callees.get("lead")?.includes(n) ? "lead" : [...callees].find(([, l]) => l.includes(n))?.[0] ?? null; };   // the hint, else the lead: researcher, planner, lookup, builder hang directly under it; ux-designer under the planner
  return [...all].map(([name, d]) => {
    const isUser = !def.has(name), pos = s.positions[name], raw = (() => { try { return JSON.parse(readFileSync(join(d.dir, "agent.json"), "utf8")); } catch { return {}; } })();
    let prompt: string | undefined; try { prompt = readFileSync(d.prompt_file, "utf8"); } catch { /* none */ }
    return { name, description: d.description, role: d.role, model: d.model, origin: isUser ? "user" : "default", locked: !isUser, disabled: s.disabled.includes(name), callees: callees.get(name) ?? [], parent: parentOf(name), callers: [...callees].filter(([k, l]) => k !== name && l.includes(name)).map(([k]) => k), tools: d.tools, writes: d.writes, x: pos?.x, y: pos?.y, prompt, cloned_from: raw.cloned_from } as AgentOut;
  });
}
function integrations() {
  const s = readSettings();
  return INTEGRATIONS.map((d) => { const set = s.integrations[d.id]; return { id: d.id, label: d.label, about: d.about, fields: d.fields, enabled: !!set?.enabled, agents: set?.agents ?? [], site: set?.site ?? "", email: set?.email ?? "", ...secretInfo(d.id) }; });
}
// What the user's own Claude account has connected (Slack, Docs ...): listed so it is visible, NEVER passed to an agent. `claude mcp list` health-checks every server (seconds, no model call), so it runs only when asked.
export interface Connector { name: string; url: string; status: string; supported: false }
let connectors: Connector[] = [];
export async function scanConnectors() {
  try {
    const p = Bun.spawn(["claude", "mcp", "list"], { stdout: "pipe", stderr: "ignore", stdin: "ignore", env: { ...process.env, ...claudeEnv() } }), timer = setTimeout(() => p.kill(), 45_000);
    const out = await new Response(p.stdout).text(); clearTimeout(timer);
    connectors = out.split("\n").map((l) => /^(.+?): (\S+) - (.+)$/.exec(l.trim())).filter((m): m is RegExpExecArray => !!m).map((m) => ({ name: m[1]!, url: m[2]!, status: m[3]!.replace(/^[^\w]+/, ""), supported: false as const }));
  } catch { connectors = []; }
  return ok();
}
const RULE_FLAGS = ["noForcePush", "noDeleteBranch", "noMerge", "noPushProtected", "noPush", "jiraReadOnly"] as const;
/** Safety rules: only these keys, booleans and a clean branch list are saved; "reset" goes back to the defaults. */
export function setRules(b: Partial<Rules> & { reset?: boolean }) {
  updateSettings((s) => {
    if (b.reset) { delete s.rules; return; }
    const cur = { ...(s.rules ?? {}) } as Record<string, unknown>;
    for (const k of RULE_FLAGS) if (typeof b[k] === "boolean") cur[k] = b[k];
    if (Array.isArray(b.protectedBranches)) cur.protectedBranches = [...new Set(b.protectedBranches.map((x) => String(x).trim()).filter((x) => /^[\w./-]{1,80}$/.test(x)))].slice(0, 20);
    s.rules = cur as Partial<Rules>;
  });
  return ok();
}
export function state() {
  const skills = existsSync(USER_SKILLS_DIR) ? readdirSync(USER_SKILLS_DIR).filter((n) => existsSync(join(USER_SKILLS_DIR, n, "SKILL.md"))) : [];
  const ps = readSettings().plugins;
  return { home: HOME_DIR, rules: { ...DEFAULT_RULES, ...readSettings().rules } as Rules, defaults: DEFAULT_RULES, agents: agents(), integrations: integrations(), skills, plugins: installedPlugins().map((p) => ({ name: p.name, version: p.version, scope: p.scope, supported: true, agents: ps[p.name] ?? [], servers: p.servers.map((n) => ({ name: n, agents: ps[`${p.name}:${n}`] ?? [] })) })), connectors };
}
const find = (name: string) => agents().find((a) => a.name === name);
const fail = (reason: string) => ({ ok: false as const, reason });
const ok = () => ({ ok: true as const, ...state() });
const defDir = (name: string) => { const d = loadAgentsRaw([AGENTS_DIR, USER_AGENTS_DIR]).get(name); return d?.dir; };

export function setDisabled(name: string, disabled: boolean) {
  if (!find(name)) return fail("unknown agent"); if (RESERVED.has(name)) return fail(`${name} cannot be disabled`);
  updateSettings((s) => { s.disabled = disabled ? [...new Set([...s.disabled, name])] : s.disabled.filter((x) => x !== name); }); return ok();
}
export function clone(from: string, name: string, parent?: string) {
  if (!AGENT_NAME.test(name)) return fail("name: lowercase letters, digits and dashes, 2-40 characters, starting with a letter");
  if (find(name)) return fail(`"${name}" already exists`); const dir = defDir(from); if (!dir) return fail("unknown agent to clone");
  if (RESERVED.has(from)) return fail("lead and pm cannot be cloned");
  try { cloneAgent(dir, name, { cloned_from: from, agents: [] }); } catch (e) { return fail((e as Error).message); }
  updateSettings((s) => { s.positions[name] = { parent: parent && find(parent) ? parent : find(from)?.parent ?? "lead" }; }); return ok();
}
export function create(b: { name: string; description: string; model?: string; parent?: string; prompt?: string; tools?: string[]; writes?: boolean }) {
  if (!AGENT_NAME.test(b.name)) return fail("name: lowercase letters, digits and dashes, 2-40 characters, starting with a letter");
  if (RESERVED.has(b.name) || find(b.name)) return fail(`"${b.name}" already exists`); if (!b.description?.trim()) return fail("a description is required: the lead reads it to decide when to call this agent");
  const dir = join(USER_AGENTS_DIR, b.name); mkdirSync(join(dir, ".claude"), { recursive: true });
  const tools = (b.tools?.length ? b.tools : ["Read", "Grep", "Glob"]).filter((t) => /^[A-Za-z_*()., :-]+$/.test(t));
  writeFileSync(join(dir, "agent.json"), JSON.stringify({ role: b.name, description: b.description.trim(), model: ["sonnet", "haiku"].includes(b.model ?? "") ? b.model : "sonnet", session: "persistent", writes: !!b.writes, max_children: 0, agents: [], tiers: ["T1", "T2", "T3", "T4"], timeout_s: 900, prompts: ["CLAUDE.md"], origin: "user" }, null, 1));
  writeFileSync(join(dir, ".claude", "CLAUDE.md"), b.prompt?.trim() || `You are ${b.name}. ${b.description.trim()}\nAnswer with what you did and what you could not do.\n`);
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ permissions: { allow: tools } }, null, 1));
  updateSettings((s) => { s.positions[b.name] = { parent: b.parent && find(b.parent) ? b.parent : "lead" }; }); return ok();
}
export function edit(name: string, b: { description?: string; model?: string; prompt?: string; tools?: string[]; writes?: boolean }) {
  const a = find(name); if (!a) return fail("unknown agent"); if (a.locked) return fail("a default agent cannot be edited: clone it first");
  const dir = join(USER_AGENTS_DIR, name), jf = join(dir, "agent.json"), j = JSON.parse(readFileSync(jf, "utf8"));
  if (b.description !== undefined) { if (!b.description.trim()) return fail("a description is required"); j.description = b.description.trim(); }
  if (b.model && ["sonnet", "haiku"].includes(b.model)) j.model = b.model; if (b.writes !== undefined) j.writes = !!b.writes;
  writeFileSync(jf, JSON.stringify(j, null, 1));
  if (b.prompt !== undefined) writeFileSync(join(dir, ".claude", "CLAUDE.md"), b.prompt);
  if (b.tools) writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ permissions: { allow: b.tools.filter((t) => /^[A-Za-z_*()., :-]+$/.test(t)) } }, null, 1)); return ok();
}
export function move(name: string, b: { parent?: string; x?: number; y?: number }) {
  const a = find(name); if (!a) return fail("unknown agent"); if (RESERVED.has(name)) return fail(`${name} stays where it is`);
  const all = new Map(agents().map((x) => [x.name, x]));
  if (b.parent !== undefined) {
    if (!all.has(b.parent)) return fail("unknown parent"); if (b.parent === name || reaches(new Map([...all].map(([k, v]) => [k, { agents: v.callees }])), name, b.parent)) return fail("that would make a loop: an agent cannot sit under itself or its own callees");
    if (all.get(b.parent)!.disabled) return fail("the parent is disabled");
  }
  updateSettings((s) => { s.positions[name] = { ...s.positions[name], ...(b.parent !== undefined ? { parent: b.parent } : {}), ...(b.x !== undefined ? { x: b.x, y: b.y } : {}) }; }); return ok();
}
/** draw a line: `from` may call `to`. No restriction (an agent may have several parents, loops are allowed); a default line that was switched off comes back. */
export function connect(from: string, to: string) {
  const all = new Map(agents().map((x) => [x.name, x])); if (!all.has(from) || !all.has(to)) return fail("unknown agent");
  if (all.get(from)!.callees.includes(to)) return ok();
  updateSettings((s) => { const e = (s.edges ??= { add: [], remove: [] }), i = e.remove.findIndex(([f, t]) => f === from && t === to); if (i >= 0) e.remove.splice(i, 1); else e.add.push([from, to]); }); return ok();
}
/** remove a line: a drawn one is forgotten, a default one is switched off (the defaults' files stay untouched). */
export function disconnect(from: string, to: string) {
  const all = new Map(agents().map((x) => [x.name, x])); if (!all.has(from) || !all.has(to)) return fail("unknown agent");
  updateSettings((s) => { const e = (s.edges ??= { add: [], remove: [] }), i = e.add.findIndex(([f, t]) => f === from && t === to); if (i >= 0) e.add.splice(i, 1); else if (!e.remove.some(([f, t]) => f === from && t === to)) e.remove.push([from, to]); }); return ok();
}
/** back to the defaults: every drawn or removed line is forgotten */
export function resetLines() { updateSettings((s) => { s.edges = { add: [], remove: [] }; }); return ok(); }
export function remove(name: string) {
  const a = find(name); if (!a) return fail("unknown agent"); if (a.locked) return fail("a default agent cannot be deleted: disable it instead");
  removeUserAgent(name); updateSettings((s) => { delete s.positions[name]; s.disabled = s.disabled.filter((x) => x !== name); for (const i of Object.values(s.integrations)) if (i) i.agents = i.agents.filter((x) => x !== name); }); return ok();
}

/** `key` = `<plugin>` (the plugin's skills) or `<plugin>:<server>` (one of its MCP servers). Only the ticked agents get it; the lead may be ticked. */
export function setPlugin(key: string, agentsOn: string[]) {
  if (!pluginSupported(key)) return fail("that plugin (or server) is not installed in your Claude profile");
  const names = new Set(agents().map((a) => a.name));
  updateSettings((s) => { const l = agentsOn.filter((n) => names.has(n) && n !== "pm"); if (l.length) s.plugins[key] = l; else delete s.plugins[key]; }); return ok();
}
export function setIntegration(id: string, b: { enabled?: boolean; agents?: string[]; site?: string; email?: string; token?: string }) {
  const d = INTEGRATIONS.find((x) => x.id === id); if (!d) return fail("unknown integration");
  if (b.token !== undefined) { if (b.token === "") setSecret(d.id, null); else if (b.token.length < 8) return fail("that does not look like a token"); else setSecret(d.id, b.token); }
  const names = new Set(agents().map((a) => a.name));
  updateSettings((s) => {
    const cur = s.integrations[d.id] ?? { enabled: false, agents: [] };
    s.integrations[d.id] = { ...cur, ...(b.enabled !== undefined ? { enabled: b.enabled } : {}), ...(b.agents ? { agents: b.agents.filter((n) => names.has(n) && n !== "pm") } : {}), ...(b.site !== undefined ? { site: b.site.trim() } : {}), ...(b.email !== undefined ? { email: b.email.trim() } : {}) };
    if (b.token === "") s.integrations[d.id]!.enabled = false;
  });
  return ok();
}
/** One cheap read call to the vendor to see whether the saved credentials work. Never echoes the token. */
export async function testIntegration(id: string) {
  const d = INTEGRATIONS.find((x) => x.id === id), s = readSettings().integrations[id as IntegrationId], t = secretValue(id as IntegrationId);
  if (!d || !t) return fail("no token saved");
  try {
    const r = id === "github" ? await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${t}`, "user-agent": "agent-testing" } })
      : id === "figma" ? await fetch("https://api.figma.com/v1/me", { headers: { "x-figma-token": t } })
      : await fetch("https://mcp.atlassian.com/v1/mcp", { method: "POST", headers: { authorization: "Basic " + Buffer.from(`${s?.email ?? ""}:${t}`).toString("base64"), "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "agent-testing", version: "1" } } }) });   // Jira: the MCP handshake itself proves the email + API token pair (and that the admin allowed API-token auth)
    if (!r.ok) return fail(`the service answered ${r.status}`);
    if (id === "jira") return { ok: true as const, who: s?.email || "connected" };
    const j = await r.json() as { login?: string; handle?: string; email?: string }; return { ok: true as const, who: j.login ?? j.handle ?? j.email ?? "connected" };
  } catch (e) { return fail("could not reach the service: " + (e as Error).message.slice(0, 80)); }
}
