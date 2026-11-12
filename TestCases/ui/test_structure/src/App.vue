<script setup lang="ts">
import { debug } from "@/store/debug";
import { theme, toggleTheme } from "@/store/theme";
import { onMounted, ref } from "vue";
const ws = ref<{ id: string; version: string; harness?: string; after?: string } | null>(null);
onMounted(async () => { try { ws.value = (await (await fetch("/api/health")).json()).workspace ?? null; } catch { /* API down */ } });
</script>
<template>
  <header class="top">
    <strong>Test_agent_3</strong>
    <router-link to="/">Flow</router-link><router-link to="/subagents">Sub-agents</router-link><router-link to="/experiment">ExperimentRun</router-link>
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
.dbgsw { margin-left:auto; display:flex; gap:6px; align-items:center; } .dbgsw input { width:auto; }
</style>
