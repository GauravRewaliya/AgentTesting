// Free check of the user home + Settings API logic (bun self_test/userhome.ts). Uses a temp AGENT_HOME: the real .state/home is never touched.
import { mkdtempSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.AGENT_HOME = mkdtempSync(join(tmpdir(), "home-"));
const st = await import("../../../../ui/server/settings.ts"), uh = await import("@core/userhome.ts"), { loadAgents } = await import("../harness/core/base/agents.ts");
const { results, setSuite, t } = await import("./lib.ts");
setSuite("user home + settings");
const names = () => new Set(st.state().agents.map((a) => a.name)), get = (n: string) => st.state().agents.find((a) => a.name === n)!;
t("uh.1", "defaults are listed and locked; test stand-ins are not", get("builder").locked && get("builder").origin === "default" && !names().has("web-setup"));
t("uh.2", "a default cannot be edited or deleted", st.edit("builder", { description: "x" }).ok === false && st.remove("builder").ok === false);
t("uh.3", "the lead cannot be disabled, cloned or moved", [st.setDisabled("lead", true), st.clone("lead", "lead-copy"), st.move("lead", { parent: "builder" })].every((r) => r.ok === false));
const c = st.clone("builder", "builder-copy");
t("uh.4", "clone = an editable user agent under the same parent, not a stand-in", c.ok === true && get("builder-copy").origin === "user" && !get("builder-copy").locked && get("builder-copy").parent === "lead" && !existsSync(join(uh.USER_AGENTS_DIR, "builder-copy", "fixtures")));
t("uh.5", "edit a user agent", st.edit("builder-copy", { description: "my builder", model: "haiku" }).ok === true && get("builder-copy").description === "my builder" && get("builder-copy").model === "haiku");
t("uh.6", "create validates the name and needs a description", st.create({ name: "Bad Name", description: "x" }).ok === false && st.create({ name: "my-rev", description: "" }).ok === false && st.create({ name: "my-rev", description: "reviews text", parent: "lead" }).ok === true);
t("uh.7", "a loop is refused (an agent under its own callee)", (() => { st.move("my-rev", { parent: "builder-copy" }); return st.move("builder-copy", { parent: "my-rev" }).ok === false; })());
t("uh.8", "disable keeps the node, enable restores", st.setDisabled("researcher", true).ok === true && get("researcher").disabled && st.setDisabled("researcher", false).ok === true && !get("researcher").disabled);
// the harness side: layer is OFF unless HARNESS_USER_HOME=1
st.setDisabled("researcher", true);
delete process.env.HARNESS_USER_HOME; const plain = loadAgents();
t("uh.9", "layer off: loadAgents() is exactly the defaults (tests are never changed by Settings)", !plain.has("my-rev") && plain.get("lead")!.agents.includes("researcher"));
process.env.HARNESS_USER_HOME = "1"; const on = loadAgents();
t("uh.10", "layer on: user agents load, a disabled agent leaves its parent's list, a moved one sits under its new parent", on.has("my-rev") && !on.get("lead")!.agents.includes("researcher") && on.get("builder-copy")!.agents.includes("my-rev") && !on.get("lead")!.agents.includes("my-rev") && on.get("lead")!.agents.includes("builder-copy"));
delete process.env.HARNESS_USER_HOME;
// integrations
const r0 = st.setIntegration("github", { token: "ghp_abcdefgh1234", enabled: true, agents: ["builder", "lead", "ghost"] });
const json = JSON.stringify(st.state());
t("uh.11", "a token is stored, shown only as has_token + last4, never returned", r0.ok === true && json.includes('"last4":"1234"') && !json.includes("ghp_abcdefgh"));
t("uh.12", "secrets.json is mode 600 and settings.json holds no token", (statSync(uh.SECRETS_FILE).mode & 0o777) === 0o600 && !readFileSync(uh.SETTINGS_FILE, "utf8").includes("ghp_"));
t("uh.13", "the lead can be ticked, unknown agents cannot", JSON.stringify(uh.readSettings().integrations.github!.agents) === '["builder","lead"]');
process.env.HARNESS_USER_HOME = "1";
const lb = uh.homeLaunch("builder"), lr = uh.homeLaunch("researcher");
t("uh.14", "only the ticked agent gets the MCP server + allow entry", lb.args[0] === "--mcp-config" && lb.allow[0] === "mcp__github" && lr.args.length === 0 && lr.allow.length === 0);
t("uh.15", "the launch config carries the token only inside the MCP server definition of that launch", lb.args[1]!.includes("Bearer ghp_abcdefgh1234") && !lr.args.join("").includes("ghp_"));
delete process.env.HARNESS_USER_HOME;
t("uh.16", "layer off: no integration args at all", uh.homeLaunch("builder").args.length === 0);
t("uh.17", "removing the token switches the integration off", st.setIntegration("github", { token: "" }).ok === true && !st.state().integrations.find((i) => i.id === "github")!.has_token && !st.state().integrations.find((i) => i.id === "github")!.enabled);
t("uh.18", "delete a user agent removes it from positions and ticks", st.remove("builder-copy").ok === true && !names().has("builder-copy") && !uh.readSettings().positions["builder-copy"]);
// figma / jira shapes + plugins
st.setIntegration("figma", { token: "figd_testtoken99", enabled: true, agents: ["researcher"] }); st.setIntegration("jira", { token: "atl_tok_12345678", email: "a@b.c", enabled: true, agents: ["researcher"] });
process.env.HARNESS_USER_HOME = "1"; const lj = JSON.parse(uh.homeLaunch("researcher").args[1]!).mcpServers;
t("uh.19", "figma = local stdio server (pnpm dlx) with the key in its env only", lj.figma.command === "pnpm" && lj.figma.args.includes("figma-developer-mcp") && lj.figma.env.FIGMA_API_KEY === "figd_testtoken99");
t("uh.20", "jira = remote http server with Basic base64(email:token); github = remote http with a bearer token", lj.jira.type === "http" && lj.jira.headers.Authorization === "Basic " + Buffer.from("a@b.c:atl_tok_12345678").toString("base64") && uh.INTEGRATIONS.find((d) => d.id === "github")!.server({ enabled: true, agents: [] }, "tok") ["url" as never] === "https://api.githubcopilot.com/mcp/");
t("uh.21", "the three integrations are offered, and none of them returns a token through the API", uh.INTEGRATIONS.map((d) => d.id).join() === "figma,github,jira" && !JSON.stringify(st.state()).includes("figd_testtoken99") && !JSON.stringify(st.state()).includes("atl_tok_"));
delete process.env.HARNESS_USER_HOME;
const plug = uh.installedPlugins(), withSrv = plug.find((p) => p.servers.length);
t("uh.22", "every installed plugin is listed and can be ticked; an unknown plugin or server is refused", st.state().plugins.every((p) => p.supported === true) && st.setPlugin("no-such-plugin:x", ["builder"]).ok === false && (!withSrv || st.setPlugin(withSrv.name + ":no-such-server", ["builder"]).ok === false));
if (withSrv) {   // the lead can be ticked; only the ticked agent gets --plugin-dir, the no-strict marker and the allow entry of THAT server
  const key = withSrv.name + ":" + withSrv.servers[0]!, tn = (x: string) => x.replace(/@.*$/, "").replace(/[^A-Za-z0-9_-]/g, "_");
  process.env.HARNESS_USER_HOME = "1"; const r = st.setPlugin(key, ["lead"]);
  const l = uh.toolsLaunch("lead"), bl = uh.toolsLaunch("builder");
  t("uh.23", "ticked for the lead only: the lead gets the plugin dir, the marker and the server's allow entry; the builder gets nothing", r.ok === true && l.args.includes("--plugin-dir") && l.args.includes(uh.LOOSE_MCP) && l.allow.includes(`mcp__plugin_${tn(withSrv.name)}_${tn(withSrv.servers[0]!)}`) && bl.args.length === 0 && bl.allow.length === 0);
  st.setPlugin(key, []); t("uh.24", "unticked = nothing again", uh.toolsLaunch("lead").args.length === 0); delete process.env.HARNESS_USER_HOME;
}
t("uh.25", "connectors are listed (never supported) and the state has the key", Array.isArray(st.state().connectors) && st.state().connectors.every((c) => c.supported === false));
const bad = results.filter((x) => !x.ok).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
