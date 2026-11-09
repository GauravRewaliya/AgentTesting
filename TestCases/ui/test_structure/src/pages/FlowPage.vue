<script setup lang="ts">
import { onMounted } from "vue";
import { loadCards, loadSubagents, state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import HeadPicker from "@/components/flow/HeadPicker.vue";
import FlowCanvas from "@/components/flow/FlowCanvas.vue";
import SubAgentPanel from "@/components/panels/SubAgentPanel.vue";
import type { Status } from "@/types";
onMounted(() => { loadCards(); loadSubagents(); });
const statuses: Status[] = ["pass", "fail", "skipped", "never_run"];
const toggle = (s: Status) => (state.statusFilter.has(s) ? state.statusFilter.delete(s) : state.statusFilter.add(s));
</script>
<template>
  <DebugFrame name="FlowPage">
    <HeadPicker />
    <div class="bar">
      <input v-model="state.query" placeholder="filter cases…" style="max-width:260px" />
      <button v-for="s in statuses" :key="s" :class="{ on: state.statusFilter.has(s) }" @click="toggle(s)">{{ s.replace("_", " ") }}</button>
      <span class="sep" />
      <button v-for="m in (['all', 'multi', 'solo'] as const)" :key="m" :class="{ on: state.mode === m }" @click="state.mode = m">{{ m === "all" ? "any agents" : m === "multi" ? "multi-agent" : "solo" }}</button>
      <button :class="{ on: state.onlyMultiPrompt }" title="more than one user prompt" @click="state.onlyMultiPrompt = !state.onlyMultiPrompt">multi-prompt</button>
      <button :class="{ on: state.onlyMultiSession }" title="more than one session" @click="state.onlyMultiSession = !state.onlyMultiSession">multi-session</button>
      <span class="muted mono">{{ state.cards.reduce((n, c) => n + c.cases.length, 0) }} cases · {{ state.cards.length }} cards</span>
      <span v-if="state.error" style="color:var(--fail)">API: {{ state.error }}</span>
    </div>
    <div class="split"><div class="main"><FlowCanvas /></div><SubAgentPanel /></div>
  </DebugFrame>
</template>
<style scoped>.sep { width:1px; height:20px; background:var(--line); margin:0 4px; } .bar { display:flex; flex-wrap:wrap; gap:6px; padding:8px 12px; align-items:center; } .split { display:flex; } .main { flex:1; min-width:0; } .on { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, transparent); }</style>
