<script setup lang="ts">
import { debug } from "@/store/debug";
import { theme, toggleTheme } from "@/store/theme";
import { onMounted, ref } from "vue";
const ws = ref<{ id: string; version: string; harness?: string; after?: string } | null>(null);
onMounted(async () => { try { ws.value = (await (await fetch("/api/health")).json()).workspace ?? null; } catch { /* API down */ } });
// which browser do agents use right now? (the connected Chrome you can watch, or the invisible private one): shown on every page
const br = ref<{ mode: string; reachable?: boolean; tabs?: unknown[] } | null>(null);
const pollBrowser = async () => { try { br.value = await (await fetch("/api/browser")).json(); } catch { br.value = null; } };
onMounted(() => { pollBrowser(); setInterval(pollBrowser, 5000); });
</script>
<template>
  <header class="top">
    <strong>Test_agent_3</strong>
    <router-link to="/">Flow</router-link><router-link to="/subagents">Sub-agents</router-link><router-link to="/experiment">ExperimentRun</router-link><router-link to="/browser">Browser</router-link>
    <router-link v-if="br" to="/browser" class="brchip" :class="br.mode === 'attached' ? (br.reachable ? 'ok' : 'bad') : 'off'" :title="br.mode === 'attached' ? (br.reachable ? 'Agents use your connected Chrome (you can watch it)' : 'The connected Chrome does not answer: agents use the invisible private Chrome. Press Launch on the Browser page.') : 'No browser connected: agents use the invisible private Chrome (same pictures, nothing to watch)'">{{ br.mode === "attached" ? (br.reachable ? "● Chrome connected" : "● Chrome not answering") : "○ headless" }}</router-link>
    <span v-if="ws" class="wsbadge mono" :title="ws.harness">.state/{{ ws.version }}/{{ ws.id }}<template v-if="ws.after"> · after {{ ws.after }}</template> · {{ ws.harness }}</span>
    <label class="dbgsw"><input v-model="debug" type="checkbox" /> Debug (D)</label>
    <button class="themebtn" :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'" :aria-label="'Theme: ' + theme" @click="toggleTheme">{{ theme === "dark" ? "☀ Light" : "☾ Dark" }}</button>
  </header>
  <router-view />
</template>
<style scoped>
.top { display:flex; gap:14px; align-items:center; height:48px; padding:0 14px; background:var(--card); border-bottom:1px solid var(--line); }
.wsbadge { font-size:11px; color:var(--mute); max-width:38vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:auto; } .wsbadge + .dbgsw { margin-left:0; }
.themebtn { font-weight:600; white-space:nowrap; }
.brchip { font-size:12px; font-weight:600; padding:2px 10px; border-radius:999px; border:1px solid var(--line); text-decoration:none; white-space:nowrap; } .brchip.ok { color:#12b76a; border-color:#12b76a; } .brchip.bad { color:#f04438; border-color:#f04438; } .brchip.off { color:var(--mute); }
.dbgsw { margin-left:auto; display:flex; gap:6px; align-items:center; } .dbgsw input { width:auto; }
</style>
