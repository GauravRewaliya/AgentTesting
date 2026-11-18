<script setup lang="ts">
// Right, collapsible, on the flow page: the compact workbench, plus a link to the same thing as a full page.
import { state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import SubAgentWorkbench from "@/components/subagents/SubAgentWorkbench.vue";
</script>
<template>
  <DebugFrame name="SubAgentPanel">
    <aside class="panel" :class="{ closed: !state.panelOpen }">
      <div class="hd"><button @click="state.panelOpen = !state.panelOpen">{{ state.panelOpen ? "›" : "‹ sub-agents" }}</button>
        <template v-if="state.panelOpen"><button :class="{ on: state.rightTab === 'agents' }" @click="state.rightTab = 'agents'">sub-agents</button></template>
        <router-link v-if="state.panelOpen && state.rightTab === 'agents'" to="/subagents">open full page ↗</router-link></div>
      <SubAgentWorkbench v-if="state.panelOpen && state.rightTab === 'agents'" compact />
    </aside>
  </DebugFrame>
</template>
<style scoped>.panel { width:520px; height:calc(100vh - 140px); overflow:auto; background:var(--bg); border-left:1px solid var(--line); } .closed { width:auto; } .hd { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:var(--card); position:sticky; top:0; z-index:3; }</style>
