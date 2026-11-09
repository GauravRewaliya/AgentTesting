<script setup lang="ts">
// Send a (random) query to the selected mock: before-run check first, then run() if accepted.
import { ref } from "vue";
import type { SubAgentMock, TryRunResult } from "@/types";
import { tryCall } from "@/store/mockRuntime";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ mock: SubAgentMock }>();
const query = ref("");
const result = ref<TryRunResult | null>(null);
const samples = ["hi", "search the web for vue flow docs", "Create a markdown file a.md that contains the word: Alpha"];
const send = () => (result.value = tryCall(props.mock, query.value));
const random = () => { query.value = samples[Math.floor(Math.random() * samples.length)]!; send(); };
</script>
<template>
  <DebugFrame name="TryCall">
    <textarea v-model="query" rows="3" placeholder="query to send to this sub-agent" />
    <div class="row"><button @click="send">Send</button><button @click="random">Random</button></div>
    <div v-if="result" class="res" :class="result.accepted ? 'ok' : 'no'">
      <strong>{{ result.accepted ? "accepted → run()" : "rejected before run()" }}</strong>
      <ul v-if="!result.check.ok"><li v-for="f in result.check.failures" :key="f.ruleId">{{ f.message }}</li></ul>
      <div v-if="result.fixtureId" class="mono muted">fixture: {{ result.fixtureId }}</div>
      <div>{{ result.reply }}</div>
    </div>
  </DebugFrame>
</template>
<style scoped>.row { display:flex; gap:6px; margin:6px 0; } .res { border-left:3px solid; padding:4px 8px; } .ok { border-color:var(--pass); } .no { border-color:var(--fail); } ul { margin:4px 0; padding-left:18px; }</style>
