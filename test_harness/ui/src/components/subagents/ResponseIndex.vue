<script setup lang="ts">
// The index: one row per recorded sub_agent_response: id, category, agent, query, setup. Click a row to open its page.
import { openResponse, state, visibleResponses } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
defineProps<{ compact?: boolean }>();
const h = (id: string) => state.health?.responses[id];
</script>
<template>
  <DebugFrame name="ResponseIndex">
    <table class="idx">
      <thead><tr><th>id</th><th>category</th><th v-if="!compact">agent</th><th>query</th><th v-if="!compact">setup</th><th>used by</th><th>cases</th></tr></thead>
      <tbody>
        <tr v-for="r in visibleResponses" :key="r.id" @click="openResponse(r.id)">
          <td class="mono">{{ r.id }}</td><td>{{ r.category }}</td><td v-if="!compact">{{ r.agent ?? "any" }}</td>
          <td class="q">{{ r.query }}</td>
          <td v-if="!compact" class="mono muted">{{ r.setup.keywords.length ? r.setup.keywords.join(" + ") : "similarity" }}<span v-if="r.setup.copies.length"> · copies {{ r.setup.copies.length }}</span></td>
          <td class="mono"><span v-if="state.usage[r.id]?.orphan" style="color:var(--warn)" title="no case expects it, none was served by it">unused</span><span v-else-if="state.usage[r.id]">{{ state.usage[r.id]!.expectedBy.length }} expect · {{ state.usage[r.id]!.servedIn.length }} ran</span></td>
          <td class="mono"><span v-if="h(r.id)" :style="{ color: h(r.id)!.pass === h(r.id)!.total ? 'var(--pass)' : 'var(--fail)' }">{{ h(r.id)!.pass }}/{{ h(r.id)!.total }}</span><span v-else class="muted">–</span></td>
        </tr>
      </tbody>
    </table>
  </DebugFrame>
</template>
<style scoped>
.idx { width:100%; border-collapse:collapse; background:var(--card); } th { text-align:left; font-size:11px; text-transform:uppercase; color:var(--mute); }
th, td { padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:top; } tbody tr { cursor:pointer; } tbody tr:hover { background:color-mix(in srgb, var(--accent) 8%, transparent); } .q { max-width:360px; }
</style>
