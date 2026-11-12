<script setup lang="ts">
// What the harness recorded for this case's sub-agent sessions (session events.jsonl in .state), filtered to the selected session.
import { computed } from "vue";
import type { CaseDetail } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ s: CaseDetail; sessionId: string | null }>();
const rows = computed(() => props.s.events.filter((e) => !props.sessionId || e.id === props.sessionId));
const t0 = computed(() => props.s.events[0]?.t ?? 0);
</script>
<template>
  <DebugFrame name="EventLog">
    <table class="log">
      <tr v-for="(e, i) in rows" :key="i" :class="{ inh: e.own === false }">
        <td class="mono muted">+{{ ((e.t - t0) / 1000).toFixed(1) }}s</td><td><code>{{ e.kind }}</code></td><td class="mono">{{ e.agent ?? "" }}<br /><span class="muted">{{ e.id }}</span></td>
        <td>{{ e.text }} <code v-if="e.fixture" class="muted">[{{ e.fixture }}]</code></td>
      </tr>
      <tr v-if="!rows.length"><td class="muted">no events (this case never ran, or the session was not logged)</td></tr>
    </table>
  </DebugFrame>
</template>
<style scoped>.log { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); } td { padding:4px 8px; border-top:1px solid var(--line); vertical-align:top; word-break:break-word; }.inh { opacity:.5; }</style>
