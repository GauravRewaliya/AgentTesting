<script setup lang="ts">
// Settings: left menu (Agents, Integrations, Browser, Usage) + the section. One live socket for the whole page (settings, usage and browser topics); no polling.
import DebugFrame from "@/components/common/DebugFrame.vue";
import { useLive } from "@/store/live";
import { onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
const live = useLive(), route = useRoute();
const items = [{ to: "agents", label: "Agents" }, { to: "team", label: "Team" }, { to: "integrations", label: "Integrations" }, { to: "browser", label: "Browser" }, { to: "usage", label: "Usage" }];
onMounted(() => { live.start(); live.watch({ settings: true, usage: true }); });
onUnmounted(() => { live.watch({}); live.stop(); });
</script>
<template>
  <DebugFrame name="SettingsPage">
    <div class="settings">
      <nav class="menu">
        <h3>Settings</h3>
        <router-link v-for="i in items" :key="i.to" :to="'/settings/' + i.to" :class="{ on: route.path.endsWith('/' + i.to) }">{{ i.label }}</router-link>
        <p class="mute home" v-if="live.settings.value" :title="live.settings.value.home">your home: <span class="mono">{{ live.settings.value.home.split("/").slice(-3).join("/") }}</span></p>
      </nav>
      <section class="body"><router-view /></section>
    </div>
  </DebugFrame>
</template>
<style scoped>
.settings { display: grid; grid-template-columns: 190px 1fr; min-height: calc(100vh - 48px); }
.menu { border-right: 1px solid var(--line); background: var(--card); padding: 14px 10px; display: grid; align-content: start; gap: 4px; }
.menu h3 { margin: 0 0 8px 8px; } .menu a { padding: 7px 10px; border-radius: 6px; color: var(--ink); } .menu a.on { background: color-mix(in srgb, var(--accent) 16%, transparent); font-weight: 600; }
.home { font-size: 11px; margin: 14px 8px 0; word-break: break-all; } .mute { color: var(--mute); }
.body { padding: 18px 20px 60px; min-width: 0; }
@media (max-width: 720px) { .settings { grid-template-columns: 1fr; } .menu { grid-auto-flow: column; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--line); } }
</style>
