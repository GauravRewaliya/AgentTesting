<script setup lang="ts">
// Sidebar: agents grouped by category. Click to filter the index to that agent.
import { computed } from "vue";
import { openAgent, state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
const groups = computed(() => {
  const m = new Map<string, typeof state.agents>();
  for (const a of state.agents) m.set(a.category, [...(m.get(a.category) ?? []), a]);
  return [...m];
});
const h = (name: string) => state.health?.agents[name];
</script>
<template>
  <DebugFrame name="AgentList">
    <nav class="side">
      <button class="it" :class="{ on: !state.agent }" @click="openAgent(null)">All responses <span class="muted">{{ state.responses.length }}</span></button>
      <div v-for="[cat, list] in groups" :key="cat">
        <div class="cat muted">{{ cat }}</div>
        <button v-for="a in list" :key="a.name" class="it" :class="{ on: state.agent === a.name }" @click="openAgent(a.name)">
          {{ a.name }}<span v-if="a.forbidden"> ⛔</span>
          <span class="muted n">{{ a.responses }}</span>
          <span v-if="h(a.name)" class="n" :style="{ color: h(a.name)!.pass === h(a.name)!.total ? 'var(--pass)' : 'var(--fail)' }" title="guard cases">g {{ h(a.name)!.pass }}/{{ h(a.name)!.total }}</span>
        </button>
      </div>
    </nav>
  </DebugFrame>
</template>
<style scoped>
.side { display:flex; flex-direction:column; gap:2px; padding:8px; min-width:190px; } .cat { font-size:11px; text-transform:uppercase; margin:10px 0 2px 4px; }
.it { display:flex; gap:6px; align-items:center; text-align:left; border-color:transparent; background:transparent; } .it.on { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, transparent); } .n { margin-left:auto; font-size:11px; }
.it .n + .n { margin-left:4px; }
</style>
