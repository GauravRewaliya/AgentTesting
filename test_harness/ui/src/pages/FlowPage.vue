<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { activeHead, loadCards, loadSubagents, selectHead, state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import HeadPicker from "@/components/flow/HeadPicker.vue";
import FlowCanvas from "@/components/flow/FlowCanvas.vue";
import SubAgentPanel from "@/components/panels/SubAgentPanel.vue";
import { busyElsewhere, chainPlan, isRunning, pauseRuns, resumeRuns, runCase, runsHere } from "@/store/runs";
import { computed, watch } from "vue";
import type { Status } from "@/types";
const props = defineProps<{ group: "real" | "core" }>();
watch(() => props.group, (g) => { state.group = g; state.head = "__first"; state.selectedCaseId = null; state.readyFilter.clear(); if (activeHead.value) selectHead(activeHead.value); }, { immediate: true });
const picked = computed(() => state.cards.flatMap((c) => c.cases).find((r) => r.caseId === state.selectedCaseId) ?? null);
onUnmounted(pauseRuns);   // the runs topic is closed with the page
onMounted(async () => { await loadCards(); loadSubagents(); void resumeRuns(); if (!state.selectedCaseId && activeHead.value) selectHead(activeHead.value); });   // the first head is picked at start: its first node is selected
const statuses: Status[] = ["pass", "fail", "skipped", "never_run"];
const toggle = (s: Status) => (state.statusFilter.has(s) ? state.statusFilter.delete(s) : state.statusFilter.add(s));
</script>
<template>
  <DebugFrame name="FlowPage">
    <HeadPicker :group="group" />
    <div class="bar runbar">
      <button class="primary" :disabled="!picked || isRunning" :title="picked ? 'same runner as the CLI (testrun/run.ts)' : 'select a case first'" @click="picked && runCase(picked.caseId)">{{ runsHere ? "running…" : !picked ? "▶ Run (select a node)" : picked.ran ? "▶ Run: " + picked.caseId : "▶ Run" + (chainPlan.n > 1 ? ` all (${chainPlan.n} steps): ` : ": ") + picked.caseId }}</button>
      <span v-if="picked" class="mono small" :style="{ color: picked.status === 'pass' ? 'var(--pass)' : picked.status === 'fail' ? 'var(--fail)' : 'var(--mute)' }">{{ picked.ran ? picked.status + (picked.at ? " · " + picked.at.slice(5, 16).replace("T", " ") : "") : "not run yet" }}</span>
      <span v-if="picked && chainPlan.n > 1" class="muted small mono">chain {{ chainPlan.done }}/{{ chainPlan.n }} ran</span>
      <span v-if="runsHere" class="muted small">running — see the runs tab on the right</span>
      <span v-else-if="busyElsewhere" class="muted small">another run is going on a different chain (one run at a time)</span>
    </div>
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
<style scoped>.primary { border-color:var(--accent); } .runbar { border-bottom:1px solid var(--line); } .sep { width:1px; height:20px; background:var(--line); margin:0 4px; } .bar { display:flex; flex-wrap:wrap; gap:6px; padding:8px 12px; align-items:center; } .split { display:flex; } .main { flex:1; min-width:0; } .on { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, transparent); }</style>
