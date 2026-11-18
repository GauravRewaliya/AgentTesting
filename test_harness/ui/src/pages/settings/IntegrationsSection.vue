<script setup lang="ts">
// Integrations: GitHub and Jira. Not added = nothing reaches any agent. Added = a vendor MCP server starts ONLY for the agents ticked here. A token is typed once and never shown again.
import { api } from "@/store/api";
import { useLive } from "@/store/live";
import { reactive, ref } from "vue";
import type { SettingsIntegration } from "../../../shared/settings";
const { settings } = useLive();
const form = reactive<Record<string, Record<string, string>>>({}), busy = ref(""), msg = ref<Record<string, string>>({}), err = ref("");
const f = (i: SettingsIntegration) => (form[i.id] ??= { site: i.site, email: i.email, token: "" });
async function run(id: string, fn: () => Promise<unknown>, ok = "") { busy.value = id; err.value = ""; try { const r = await fn() as { ok?: boolean; reason?: string }; if (r && r.ok === false) err.value = r.reason ?? "failed"; else if (ok) msg.value[id] = ok; } catch (e) { err.value = (e as Error).message; } busy.value = ""; }
const save = (i: SettingsIntegration) => run(i.id, async () => { const x = f(i), r = await api.settingsIntegration(i.id, { site: x.site, email: x.email, ...(x.token ? { token: x.token } : {}), enabled: true }); x.token = ""; return r; }, "saved");
const remove = (i: SettingsIntegration) => run(i.id, () => api.settingsIntegration(i.id, { token: "", enabled: false }), "removed");
const test = (i: SettingsIntegration) => run(i.id, async () => { const r = await api.settingsIntegrationTest(i.id); if (r.ok) msg.value[i.id] = "connected as " + r.who; return r; });
const scan = () => run("scan", () => api.settingsScanConnectors());
const tick = (i: SettingsIntegration, a: string, on: boolean) => run(i.id, () => api.settingsIntegration(i.id, { agents: on ? [...i.agents, a] : i.agents.filter((x) => x !== a) }));
</script>
<template>
  <div class="int">
    <h2>Integrations <small class="mute">Figma, GitHub and Jira: nothing is shared with an agent until you add it and tick the agent</small></h2>
    <p v-if="err" class="err">{{ err }}</p>
    <p v-if="!settings" class="mute">Loading…</p>
    <section v-for="i in settings?.integrations" :key="i.id" class="card">
      <div class="head"><h3>{{ i.label }}</h3><span class="pill" :class="i.has_token && i.enabled ? 'ok' : 'off'">{{ i.has_token ? (i.enabled ? "added" : "added · off") : "not added" }}</span></div>
      <p class="mute">{{ i.about }}</p>
      <div class="fields">
        <label v-for="fl in i.fields" :key="fl.key">{{ fl.label }}
          <input v-model="f(i)[fl.key]" :type="fl.secret ? 'password' : 'text'" :placeholder="fl.secret && i.has_token ? '•••• ' + i.last4 + ' (saved; type to replace)' : fl.placeholder" autocomplete="off" />
        </label>
      </div>
      <div class="row">
        <button :disabled="!!busy" @click="save(i)">{{ i.has_token ? "Save" : "Add" }}</button>
        <button :disabled="!!busy || !i.has_token" @click="test(i)">Test connection</button>
        <label v-if="i.has_token" class="sw"><input type="checkbox" :checked="i.enabled" @change="run(i.id, () => api.settingsIntegration(i.id, { enabled: ($event.target as HTMLInputElement).checked }))" /> on</label>
        <button v-if="i.has_token" class="danger" :disabled="!!busy" @click="remove(i)">Remove</button>
        <span class="mute">{{ msg[i.id] }}</span>
      </div>
      <div v-if="i.has_token" class="agents"><b>Agents that may use {{ i.label }}</b>
        <label v-for="a in settings!.agents.filter((x) => x.name !== 'lead')" :key="a.name" :class="{ dim: a.disabled }"><input type="checkbox" :checked="i.agents.includes(a.name)" @change="tick(i, a.name, ($event.target as HTMLInputElement).checked)" /> {{ a.name }}</label>
        <p class="mute small" v-if="!i.agents.length">None ticked: no agent can reach {{ i.label }}.</p>
      </div>
    </section>
    <section class="card" v-if="settings"><h3>What you already have in Claude <small class="mute">listed so you can see it; off and never used by the agents for now</small></h3>
      <p class="mute small">Only Figma, GitHub and Jira (above) can be switched on at the moment. Everything below stays OFF by default and is not passed to any agent.</p>
      <b>Plugins <small class="mute">installed in your Claude profile</small></b>
      <p v-if="!settings.plugins.length" class="mute small">No plugin is installed. Install one with Claude (<span class="mono">/plugin</span>) and it shows up here.</p>
      <div v-for="p in settings.plugins" :key="p.name" class="extra"><span class="mono grow">{{ p.name }}</span><span class="mute small">v{{ p.version }} · {{ p.scope }}</span>
        <label class="sw off" title="Not supported yet: stays off"><input type="checkbox" disabled :checked="false" /> off</label><span class="pill">not supported yet</span></div>
      <b>Connectors <small class="mute">added on claude.ai (your account)</small></b>
      <div v-for="c in settings.connectors" :key="c.name" class="extra"><span class="grow">{{ c.name }}</span><span class="mute small mono">{{ c.status }}</span>
        <label class="sw off" title="Not supported yet: stays off"><input type="checkbox" disabled :checked="false" /> off</label><span class="pill">not supported yet</span></div>
      <div class="row"><button :disabled="!!busy" @click="scan">{{ busy === "scan" ? "Looking…" : settings.connectors.length ? "Scan again" : "Scan my Claude connectors" }}</button>
        <span class="mute small">Asks Claude which connectors your account has (takes a few seconds, no model call).</span></div>
    </section>
    <section class="card" v-if="settings"><h3>Skills <small class="mute">custom_claude/skills</small></h3>
      <p class="mute">Put a skill folder (with a SKILL.md) in <span class="mono">{{ settings.home }}/custom_claude/skills/</span>; every agent run from the dashboard sees it. {{ settings.skills.length ? "Found: " + settings.skills.join(", ") : "None yet." }}</p></section>
  </div>
</template>
<style scoped>
.int { display: grid; gap: 14px; max-width: 820px; } h2, h3 { margin: 0; } small { font-weight: 400; font-size: 13px; } .mute { color: var(--mute); } .small { font-size: 12px; margin: 4px 0 0; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: grid; gap: 10px; } .head { display: flex; gap: 10px; align-items: center; }
.pill { padding: 1px 9px; border-radius: 999px; font-size: 12px; border: 1px solid var(--line); } .pill.ok { color: #12b76a; border-color: #12b76a; }
.fields { display: grid; gap: 8px; } .fields label { display: grid; gap: 3px; font-size: 12px; color: var(--mute); } .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sw { display: flex; gap: 4px; align-items: center; } .sw input, .agents input { width: auto; } .agents { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; } .agents label { display: flex; gap: 4px; align-items: center; } .dim { opacity: .5; }
  .extra { display: flex; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); } .grow { flex: 1; } .sw.off { opacity: .6; }
.danger { color: #f04438; border-color: #f04438; } .err { color: #f04438; margin: 0; }
</style>
