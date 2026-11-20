// Integrations through Claude's OWN CLI, the way a person does it in /plugin and /mcp: nothing is re-implemented, we run the real commands with the profile the agents use (claudeEnv).
//   claude mcp list                  status of every server (Connected / Needs authentication / Failed)     claude mcp login|logout <name>   the browser login (OAuth) of one server
//   claude plugin list              installed plugins                                                      claude plugin enable|disable <id@marketplace>
// Adding things (the marketplace, connectors) is done on claude.ai/plugins or with /plugin: this page only shows the result and picks the agents. One-off requests on a click: no polling.
import { claudeEnv } from "@core/orchestrator.ts";
import { installedPlugins } from "@core/userhome.ts";

async function claude(args: string[], timeoutMs = 60_000): Promise<{ ok: boolean; out: string }> {
  try {
    const p = Bun.spawn(["claude", ...args], { stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { ...process.env, ...claudeEnv() } }), timer = setTimeout(() => p.kill(), timeoutMs);
    const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]); clearTimeout(timer);
    return { ok: code === 0, out: (out + (err ? "\n" + err : "")).trim() };
  } catch (e) { return { ok: false, out: String((e as Error).message) }; }
}
const clean = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");   // no colour codes in what the page shows
const ID = /^[A-Za-z0-9_.@-]{1,120}$/;   // a plugin id (name@marketplace) or a server name part: never a flag or a path

// ---- MCP servers (claude mcp list)
export type McpState = "connected" | "needs_login" | "failed" | "off" | "pending";
export interface McpRow { name: string; kind: "plugin" | "connector" | "server"; plugin?: string; server: string; url: string; state: McpState; detail: string; key?: string }
const stateOf = (mark: string): McpState => (mark === "✔" ? "connected" : mark === "!" ? "needs_login" : mark === "✘" ? "failed" : mark === "⏸" ? "pending" : "off");
/** Parse `claude mcp list`. A plugin server is `plugin:<plugin>:<server>`; its `key` is the tick key Settings uses (`<plugin id>:<server>`) when the plugin is installed here and really brings that server. */
export function parseMcpList(text: string): McpRow[] {
  const have = installedPlugins(), rows: McpRow[] = [];
  for (const raw of clean(text).split("\n")) {
    const m = /^(.+?):\s+(\S*)\s*(?:\((\w+)\))?\s+-\s+(\S)\s*(.*)$/.exec(raw.trim()); if (!m) continue;
    const [, name, url, , mark, detail] = m as unknown as [string, string, string, string, string, string];
    const pm = /^plugin:([^:]+):(.+)$/.exec(name);
    const row: McpRow = { name, url, state: stateOf(mark), detail: detail.replace(/^Failed to connect\s*[—-]\s*/, ""), kind: pm ? "plugin" : name.startsWith("claude.ai ") ? "connector" : "server", server: pm ? pm[2]! : name };
    if (row.kind === "connector") row.key = "claude.ai:" + name.slice(10);
    if (pm) { row.plugin = pm[1]; const p = have.find((x) => x.name.split("@")[0] === pm[1] && x.servers.includes(pm[2]!)); if (p) row.key = `${p.name}:${pm[2]}`; }
    rows.push(row);
  }
  return rows;
}
export async function mcpList(): Promise<{ ok: boolean; rows: McpRow[]; reason?: string }> {
  const r = await claude(["mcp", "list"], 90_000); const rows = parseMcpList(r.out);
  return rows.length || r.ok ? { ok: true, rows } : { ok: false, rows: [], reason: r.out.slice(0, 300) || "claude mcp list failed" };
}
/** `claude mcp login <name>` needs a terminal: it prints the login address, waits for the browser to come back to a port on THIS machine, and can also take the redirect address pasted in. We give it a pseudo-terminal (`script`),
 *  read the address from its output and hand it to the page; the login finishes by itself when the person approves in the browser (the process exits; a stray one is stopped after 3 minutes). */
const logins = new Map<string, { p: ReturnType<typeof Bun.spawn>; timer: ReturnType<typeof setTimeout> }>();
const sq = (x: string) => `'${x.replace(/'/g, "'\\''")}'`;
export async function mcpLoginStart(name: string) {
  const known = (await mcpList()).rows.find((r) => r.name === name); if (!known) return { ok: false, out: "that server is not in `claude mcp list`" };
  const old = logins.get(name); if (old) { clearTimeout(old.timer); old.p.kill(); logins.delete(name); }
  const p = Bun.spawn(["script", "-qec", `claude mcp login --no-browser ${sq(name)}`, "/dev/null"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { ...process.env, ...claudeEnv() } });
  const timer = setTimeout(() => p.kill(), 180_000); logins.set(name, { p, timer }); void p.exited.then(() => { clearTimeout(timer); if (logins.get(name)?.p === p) logins.delete(name); });
  const reader = p.stdout.getReader(), dec = new TextDecoder(); let text = "", url = ""; const until = Date.now() + 20_000;
  while (!url && Date.now() < until) {
    const r = await Promise.race([reader.read(), new Promise<{ done: true; value: undefined }>((ok) => setTimeout(() => ok({ done: true, value: undefined }), 2000))]);
    if (r.value) text += dec.decode(r.value); url = /https?:\/\/[^\s\x07\x1b]+/.exec(clean(text).replace(/\x1b\]8;;/g, " "))?.[0] ?? ""; if (r.done && !r.value && p.exitCode !== null) break;
  }
  reader.releaseLock();
  return url ? { ok: true, url, out: "Open the address, approve, then press Refresh." } : { ok: false, out: clean(text).slice(0, 400) || "Claude did not print a login address" };
}
/** The redirect address pasted back (when the browser is on another machine than the dashboard). */
export async function mcpLoginPaste(name: string, redirect: string) {
  const l = logins.get(name); if (!l) return { ok: false, out: "No login is waiting for this server: press Log in again." };
  if (!/^https?:\/\/\S+$/.test(redirect.trim())) return { ok: false, out: "Paste the whole address the browser ended up on." };
  (l.p.stdin as unknown as { write(s: string): void; flush?: () => void }).write(redirect.trim() + "\n"); (l.p.stdin as unknown as { flush?: () => void }).flush?.();
  await Promise.race([l.p.exited, new Promise((ok) => setTimeout(ok, 15_000))]);
  return { ok: true, out: "Sent. Press Refresh to see the status." };
}
export async function mcpLogout(name: string) { const known = (await mcpList()).rows.find((r) => r.name === name); if (!known) return { ok: false, out: "that server is not in `claude mcp list`" }; const r = await claude(["mcp", "logout", name]); return { ok: r.ok, out: clean(r.out).slice(0, 400) }; }

// ---- plugins (claude plugin ...)
export interface PluginRow { id: string; name: string; marketplace: string; version: string; scope: string; enabled: boolean }
export async function pluginsInstalled(): Promise<PluginRow[]> {
  const r = await claude(["plugin", "list", "--json"]); let d: { id: string; version?: string; scope?: string; enabled?: boolean }[] = []; try { d = JSON.parse(r.out); } catch { return []; }
  const by = new Map<string, PluginRow>();
  for (const x of d) { const [name, mk] = x.id.split("@"), cur = by.get(x.id), on = !!x.enabled; if (!cur) by.set(x.id, { id: x.id, name: name!, marketplace: mk ?? "", version: x.version ?? "", scope: x.scope ?? "", enabled: on }); else if (on) { cur.enabled = true; if (x.scope === "user") cur.scope = "user"; } }
  return [...by.values()].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
}
export async function pluginAct(act: "enable" | "disable", id: string) {
  if (!ID.test(id) || !id.includes("@")) return { ok: false, out: "use the full id: name@marketplace" };
  const r = await claude(["plugin", act, id], 60_000); return { ok: r.ok, out: clean(r.out).slice(0, 600) };
}
// ---- which Claude this is, and a small runner so you can try the commands from the page
const home = (p: string) => p.replace(process.env.HOME ?? "\u0000", "~");
/** The profile the agents use (CONFIG.claudeProfile, enforced by claudeEnv) and the account signed in there (`claude auth status`). */
export async function claudeWho() {
  const profile = claudeEnv().CLAUDE_CONFIG_DIR ?? "", r = await claude(["auth", "status"], 20_000); let j: { loggedIn?: boolean; email?: string; orgName?: string; subscriptionType?: string; authMethod?: string } = {};
  try { j = JSON.parse(r.out); } catch { /* not logged in or an older CLI */ }
  return { profile: home(profile), profileFull: profile, loggedIn: !!j.loggedIn, email: j.email ?? "", org: j.orgName ?? "", plan: j.subscriptionType ?? "", method: j.authMethod ?? "", interactive: `CLAUDE_CONFIG_DIR=${profile} claude` };
}
/** `claude <args>` for the subcommands that manage things (mcp, plugin, auth): no shell, the arguments are split here, the output is capped. The interactive screens (/mcp, /plugin) need a terminal: use `interactive` from claudeWho. */
const ALLOWED = new Set(["mcp", "plugin", "plugins", "auth"]);
export function splitArgs(line: string): string[] { return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!); }
export async function runCli(line: string) {
  const args = splitArgs(line.replace(/^\s*claude\s+/, "")); if (!args.length || !ALLOWED.has(args[0]!)) return { ok: false, out: "Only `claude mcp ...`, `claude plugin ...` and `claude auth ...` can run here. For the interactive /mcp and /plugin screens use the terminal command above." };
  if (args[0] === "mcp" && args[1] === "serve") return { ok: false, out: "`claude mcp serve` keeps running: start it in a terminal." };
  const r = await claude(args, 180_000); return { ok: r.ok, out: clean(r.out).slice(0, 20_000) || (r.ok ? "(no output)" : "failed") };
}
