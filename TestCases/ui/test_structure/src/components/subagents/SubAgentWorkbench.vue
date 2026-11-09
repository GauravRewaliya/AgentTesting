<script setup lang="ts">
// Sidebar (agents) + content. Content is the index (with the agent summary when one is picked);
// clicking a row REPLACES it with that response's page, "← index" brings the index back.
import { onMounted } from "vue";
import { loadSubagents, openAgent, runHealth, state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import AgentList from "./AgentList.vue";
import AgentSummary from "./AgentSummary.vue";
import ResponseDetail from "./ResponseDetail.vue";
import ResponseIndex from "./ResponseIndex.vue";
defineProps<{ compact?: boolean }>();
onMounted(() => { if (!state.agents.length) loadSubagents(); });
</script>
<template>
  <DebugFrame name="SubAgentWorkbench" :hint="compact ? 'compact' : 'full page'">
    <div class="wb" :class="{ compact }">
      <aside v-if="!compact" class="sb"><AgentList /></aside>
      <div class="ct">
        <div v-if="compact" class="pick"><select :value="state.agent ?? ''" @change="openAgent(($event.target as HTMLSelectElement).value || null)"><option value="">All responses</option><option v-for="a in state.agents" :key="a.name" :value="a.name">{{ a.name }} · {{ a.category }}</option></select></div>
        <template v-if="state.responseId"><ResponseDetail /></template>
        <template v-else>
          <AgentSummary />
          <div class="bar"><span class="muted">{{ state.agent ?? "all agents" }}</span><button @click="runHealth">Run all cases</button></div>
          <ResponseIndex :compact="compact" />
        </template>
        <p v-if="state.error" style="color:var(--fail)">API: {{ state.error }} (is `bun server/index.ts` running?)</p>
      </div>
    </div>
  </DebugFrame>
</template>
<style scoped>.wb { display:flex; } .sb { border-right:1px solid var(--line); background:var(--card); } .ct { flex:1; min-width:0; } .bar { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; } .pick { padding:8px; } select { width:100%; font:inherit; color:inherit; background:var(--card); border:1px solid var(--line); border-radius:6px; padding:4px; }</style>
