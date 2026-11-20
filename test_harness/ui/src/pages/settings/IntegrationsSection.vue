<script setup lang="ts">
// Integrations = what Claude already manages, shown the way Claude shows it (/mcp and /plugin), plus the one thing only this dashboard has: WHICH AGENT may use it.
//   Tools    `claude mcp list` (status) and `claude mcp login` (the browser login); a server is passed to an agent only when you tick the agent.
//   Plugins  `claude plugin list` / `--available` / `install` / `enable` / `disable`: the same marketplace as /plugin.
//   Safety   what an agent may NOT do with git, GitHub and Jira (enforced by a guard).
// Nothing here stores a token: a login is Claude's own. Every list loads on a click or when the page opens (no polling).
import AgentPicker from "@/components/settings/AgentPicker.vue";
import TerminalPane from "@/components/settings/TerminalPane.vue";
import { api } from "@/store/api";
import { useLive } from "@/store/live";
import { computed, onMounted, ref, watch } from "vue";
import type { McpRow, PluginRow } from "../../../shared/settings";
const { settings } = useLive();
const tab = ref<"tools" | "plugins" | "safety" | "cli">("tools"), err = ref(""), note = ref<Record<string, string>>({}), busy = ref("");
const mcp = ref<McpRow[] | null>(null), mcpErr = ref(""), loadingMcp = ref(false);
const installed = ref<PluginRow[] | null>(null);
const agents = computed(() => settings.value?.agents ?? []);
const ticks = (key?: string) => (key ? settings.value?.ticks?.[key] ?? [] : []);
async function act(id: string, fn: () => Promise<{ ok?: boolean; out?: string; reason?: string } | unknown>, done = "") {
  busy.value = id; err.value = ""; note.value[id] = ""; try { const r = (await fn()) as { ok?: boolean; out?: string; reason?: string }; if (r?.ok === false) err.value = r.out || r.reason || "failed"; else if (done || r?.out) note.value[id] = done || r.out!; } catch (e) { err.value = (e as Error).message; } busy.value = "";
}
async function loadMcp() { loadingMcp.value = true; mcpErr.value = ""; try { const r = await api.mcpList(); if (r.ok) mcp.value = r.rows; else mcpErr.value = r.reason ?? "could not run claude mcp list"; } catch (e) { mcpErr.value = (e as Error).message; } loadingMcp.value = false; }
const loadInstalled = async () => { try { installed.value = await api.pluginsInstalled(); } catch (e) { err.value = (e as Error).message; } };
const who = ref<Awaited<ReturnType<typeof api.claudeWho>> | null>(null), line = ref("mcp list"), cliOut = ref(""), cliBusy = ref(""), copied = ref(false);
async function runLine(l: string) { line.value = l; cliBusy.value = "run"; cliOut.value = ""; try { const r = await api.claudeRun(l); cliOut.value = r.out; } catch (e) { cliOut.value = (e as Error).message; } cliBusy.value = ""; }
const copyCmd = async () => { try { await navigator.clipboard.writeText(who.value?.interactive ?? ""); copied.value = true; setTimeout(() => (copied.value = false), 1800); } catch { /* the text is shown: select it */ } };
onMounted(() => { loadMcp(); loadInstalled(); api.claudeWho().then((w) => (who.value = w)).catch(() => {}); });
const loginUrl = ref<Record<string, string>>({}), pasted = ref<Record<string, string>>({});
const login = (r: McpRow) => act(r.name, async () => { const x = await api.mcpLogin(r.name); if (x.ok && x.url) loginUrl.value[r.name] = x.url; return x; });
const paste = (r: McpRow) => act(r.name, async () => { const x = await api.mcpLoginPaste(r.name, pasted.value[r.name] ?? ""); if (x.ok) { delete loginUrl.value[r.name]; await loadMcp(); } return x; }, "Sent");
const logout = (r: McpRow) => act(r.name, async () => { const x = await api.mcpLogout(r.name); await loadMcp(); return x; }, "Logged out");
const setTicks = (key: string, a: string[]) => act("tick:" + key, () => api.settingsPlugin(key, a));
const pluginAct = (a: "enable" | "disable", id: string) => act(id, async () => { const x = await api.pluginAct(a, id); await loadInstalled(); await loadMcp(); return x; }, a === "enable" ? "Enabled" : "Disabled");
const keyFor = (id: string) => (settings.value?.plugins ?? []).find((p) => p.name === id || (id.endsWith("@synced") && p.name === id.split("@")[0]))?.name;
const isInstalled = (id: string) => !!installed.value?.some((p) => p.id === id);
const PILL: Record<string, string> = { connected: "Connected", needs_login: "Needs login", failed: "Failed", off: "Not configured", pending: "Pending approval" };
const where = (r: McpRow) => (r.kind === "plugin" ? `Plugin ${r.plugin}` : r.kind === "connector" ? "Connected on claude.ai" : "MCP server");
// safety rules
const RULES: { key: string; label: string; hint: string }[] = [
  { key: "noForcePush", label: "No force-push", hint: "git push --force, -f" },
  { key: "noDeleteBranch", label: "No deleting branches or repos", hint: "git branch -D, push --delete" },
  { key: "noMerge", label: "No merging pull requests", hint: "the person merges" },
  { key: "noPushProtected", label: "No push to protected branches", hint: "use a new branch and a PR" },
  { key: "noPush", label: "No pushing at all", hint: "read-only git" },
  { key: "jiraReadOnly", label: "Jira is read-only", hint: "no create, edit or transition" },
];
const branches = ref(""), editing = ref(false);
watch(() => settings.value?.rules.protectedBranches, (b) => { if (b && !editing.value) branches.value = b.join(", "); }, { immediate: true });
const setRule = (k: string, v: boolean) => act("rules", () => api.settingsRules({ [k]: v }));
const saveBranches = () => act("rules", () => api.settingsRules({ protectedBranches: branches.value.split(/[\s,]+/).filter(Boolean) }), "Saved");
const resetRules = () => act("rules", () => api.settingsRules({ reset: true }), "Defaults restored");
</script>
<template>
  <div class="int">
    <header><h2>Integrations</h2><p class="mute">The tools and plugins Claude already has. Here you choose which agent may use each one. Nothing is shared until you tick an agent.</p></header>
    <p class="who small" :class="{ warn: who && !who.loggedIn }"><template v-if="who">Using Claude profile <b class="mono">{{ who.profile }}</b> · <template v-if="who.loggedIn">signed in as <b>{{ who.email }}</b><span v-if="who.plan"> ({{ who.plan }})</span></template><template v-else>not signed in: run <span class="mono">claude</span> with this profile and <span class="mono">/login</span></template></template><template v-else>Checking which Claude this is…</template></p>
    <nav class="tabs" role="tablist"><button v-for="t in (['tools', 'plugins', 'safety', 'cli'] as const)" :key="t" role="tab" :aria-selected="tab === t" :class="{ on: tab === t }" @click="tab = t">{{ t === "tools" ? "Tools" : t === "plugins" ? "Plugins" : t === "safety" ? "Safety rules" : "Claude CLI" }}</button></nav>
    <p v-if="err" class="err" role="alert">{{ err }}</p>

    <section v-if="tab === 'tools'">
      <div class="bar"><p class="mute small grow">What Claude has connected for this profile (<span class="mono">claude mcp list</span>). Add or connect services on <a href="https://claude.ai/plugins" target="_blank" rel="noopener">claude.ai/plugins</a>, then press Refresh.</p><a class="btn" href="https://claude.ai/plugins" target="_blank" rel="noopener">Add on claude.ai ↗</a><button :disabled="loadingMcp" @click="loadMcp">{{ loadingMcp ? "Checking…" : "Refresh" }}</button></div>
      <p v-if="mcpErr" class="err">{{ mcpErr }}</p>
      <p v-else-if="!mcp" class="mute">Checking your servers…</p>
      <p v-else-if="!mcp.length" class="mute">Nothing connected yet. Add a service on claude.ai/plugins, then press Refresh.</p>
      <div v-if="mcp?.length" class="list">
        <div v-for="r in mcp" :key="r.name" class="item">
          <div class="row">
            <div class="grow"><b>{{ r.server }}</b><div class="mute small">{{ where(r) }}<span v-if="r.url"> · {{ r.url }}</span></div></div>
            <span class="pill" :class="r.state">{{ PILL[r.state] }}</span>
            <button v-if="r.state === 'needs_login'" class="primary" :disabled="busy === r.name" @click="login(r)">{{ busy === r.name ? "Starting…" : "Log in" }}</button>
            <button v-else-if="r.state === 'connected' && r.kind !== 'connector'" :disabled="busy === r.name" @click="logout(r)">Log out</button>
            <AgentPicker v-if="r.key && r.state === 'connected' || r.key && r.state === 'needs_login' || r.key && r.state === 'failed'" :model-value="ticks(r.key)" :agents="agents" @update:model-value="setTicks(r.key!, $event)" />
            
          </div>
          <p v-if="(r.state === 'failed' || note[r.name]) && !loginUrl[r.name]" class="detail small" :class="{ err: r.state === 'failed' && !note[r.name] }">{{ note[r.name] || r.detail }}
          </p>
          <div v-if="loginUrl[r.name]" class="detail small login"><a class="btn primary" :href="loginUrl[r.name]" target="_blank" rel="noopener">Open the login page ↗</a> <span class="mute">Approve there, then press</span> <button @click="loadMcp(); delete loginUrl[r.name]">Refresh</button>
            <details><summary class="mute">Browser on another machine? Paste the address it ends on</summary><div class="bar"><input v-model="pasted[r.name]" class="grow" placeholder="http://localhost:…/callback?code=…" /><button @click="paste(r)">Send</button></div></details></div>
          <p v-else-if="r.state === 'needs_login' && r.key && ticks(r.key).length" class="detail small mute">Ticked for {{ ticks(r.key).join(", ") }}, but the login is missing: agents cannot use it yet.</p>
        </div>
      </div>
    </section>

    <section v-if="tab === 'plugins'">
      <h3>Installed</h3>
      <p v-if="!installed" class="mute">Loading…</p>
      <template v-else>
        <div class="list"><div v-for="p in installed.filter((x) => x.enabled)" :key="p.id" class="item">
          <div class="row">
            <div class="grow"><b>{{ p.name }}</b> <span class="mute small">{{ p.marketplace }} · v{{ p.version }} · {{ p.scope }}</span></div>
            <AgentPicker v-if="keyFor(p.id)" :model-value="ticks(keyFor(p.id))" :agents="agents" @update:model-value="setTicks(keyFor(p.id)!, $event)" />
            <button v-if="p.scope !== 'synced'" :disabled="busy === p.id" @click="pluginAct('disable', p.id)">Disable</button>
          </div>
          <p v-if="note[p.id]" class="detail small mute pre">{{ note[p.id] }}</p>
        </div></div>
        <details v-if="installed.some((x) => !x.enabled)" class="more"><summary>Disabled ({{ installed.filter((x) => !x.enabled).length }})</summary>
          <div class="list"><div v-for="p in installed.filter((x) => !x.enabled)" :key="p.id" class="item"><div class="row">
            <div class="grow"><b>{{ p.name }}</b> <span class="mute small">{{ p.marketplace }} · v{{ p.version }} · {{ p.scope }}</span></div>
            <button :disabled="busy === p.id" @click="pluginAct('enable', p.id)">Enable</button></div>
            <p v-if="note[p.id]" class="detail small mute">{{ note[p.id] }}</p></div></div></details>
      </template>
      <p class="mute small">To add a plugin, open <a href="https://claude.ai/plugins" target="_blank" rel="noopener">claude.ai/plugins</a> or run <span class="mono">/plugin</span> in Claude, then press Refresh.</p>
    </section>

    <section v-if="tab === 'cli'">
      <TerminalPane />
      <details class="more"><summary>Run one command without a terminal</summary>
        <div class="bar"><span class="mono">claude</span><input v-model="line" class="grow" placeholder="mcp list" aria-label="claude command" @keydown.enter="runLine(line)" /><button class="primary" :disabled="!!cliBusy" @click="runLine(line)">{{ cliBusy ? "Running…" : "Run" }}</button></div>
        <div class="bar"><button v-for="c in ['auth status', 'mcp list', 'plugin list']" :key="c" :disabled="!!cliBusy" @click="runLine(c)">{{ c }}</button></div>
        <pre v-if="cliOut" class="out">{{ cliOut }}</pre></details>
    </section>

    <section v-if="tab === 'safety'">
      <div class="bar"><h3>Safety rules</h3><span class="pill connected">Enforced</span></div>
      <p class="mute small">A guard refuses these for every agent that has git, GitHub or Jira tools, and tells the agent why.</p>
      <div v-if="settings" class="rules"><label v-for="r in RULES" :key="r.key"><input type="checkbox" :checked="settings.rules[r.key as keyof typeof settings.rules] as boolean" :disabled="busy === 'rules'" @change="setRule(r.key, ($event.target as HTMLInputElement).checked)" /> <span class="rl"><b>{{ r.label }}</b><span class="mute small">{{ r.hint }}</span></span></label></div>
      <div class="row nopad"><label class="grow fields"><span>Protected branches</span><input v-model="branches" placeholder="main, master" @focus="editing = true" @blur="editing = false" @keydown.enter="saveBranches" /></label>
        <button :disabled="busy === 'rules'" @click="saveBranches">Save</button><button :disabled="busy === 'rules'" @click="resetRules">Reset</button></div>
      <p v-if="note.rules" class="mute small">{{ note.rules }}</p>
    </section>
  </div>
</template>
<style scoped>
.int { display: grid; gap: 14px; max-width: 800px; } h2, h3, p { margin: 0; } h3 { font-size: 15px; } header { display: grid; gap: 4px; }
.mute { color: var(--mute); } .small { font-size: 12px; } .mono { font-family: ui-monospace, monospace; font-size: 12px; } section { display: grid; gap: 10px; } .err { color: var(--fail); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); } .tabs button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 8px 12px; color: var(--mute); } .tabs button.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
.bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .grow { flex: 1; min-width: 0; } .search { width: 260px; }
.list { border: 1px solid var(--line); border-radius: 10px; background: var(--card); } .item + .item { border-top: 1px solid var(--line); }
.row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; flex-wrap: wrap; } .row.nopad { padding: 0; } .detail { padding: 0 14px 10px; } .pre { white-space: pre-wrap; } .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pill { padding: 1px 9px; border-radius: 999px; font-size: 12px; border: 1px solid var(--line); color: var(--mute); white-space: nowrap; } .pill.connected { color: var(--pass); border-color: var(--pass); } .pill.needs_login { color: var(--warn); border-color: var(--warn); } .pill.failed { color: var(--fail); border-color: var(--fail); }
.more summary { cursor: pointer; color: var(--mute); font-size: 13px; margin: 2px 0 8px; }
.btn { display: inline-block; border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; background: var(--card); color: var(--ink); }
.who { margin: 0; color: var(--mute); } .who.warn { color: var(--warn); } .term { display: flex; gap: 8px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; overflow-x: auto; }
.out { margin: 0; max-height: 420px; overflow: auto; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px; font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap; }
.login { display: grid; gap: 6px; } .login summary { cursor: pointer; }
.primary { background: var(--accent); border-color: var(--accent); color: #fff; } .link { border: 0; background: none; color: var(--accent); padding: 0 0 0 6px; }
.fields { display: grid; gap: 3px; font-size: 12px; color: var(--mute); } .rules { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; } .rules label { display: flex; gap: 8px; align-items: flex-start; } .rules input { width: auto; margin-top: 3px; } .rl { display: grid; line-height: 1.3; }
@media (max-width: 640px) { .rules { grid-template-columns: 1fr; } .search { width: 100%; } }
</style>
