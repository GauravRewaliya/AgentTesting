<script setup lang="ts">
// One sub_agent_response: its query + setup, and its + / − cases run against the real lookup right now.
import { ref, watchEffect } from "vue";
import { api } from "@/store/api";
import { backToIndex, currentResponse, runHealth } from "@/store/dashboard";
import type { CaseResult } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
import CaseResultRow from "./CaseResultRow.vue";
import UsagePanel from "./UsagePanel.vue";
import TryBox from "./TryBox.vue";
const cases = ref<CaseResult[]>([]), busy = ref(false), err = ref("");
async function run() {
  const r = currentResponse.value; if (!r) return;
  busy.value = true; err.value = "";
  try { cases.value = await api.responseCases(r.id); } catch (e) { err.value = (e as Error).message; }
  busy.value = false;
}
watchEffect(run);
const count = (k: string) => cases.value.filter((c) => c.kind === k);
</script>
<template>
  <DebugFrame name="ResponseDetail">
    <div v-if="currentResponse" class="det">
      <button @click="backToIndex">← index</button>
      <h3>{{ currentResponse.id }} <span class="muted">{{ currentResponse.category }} · {{ currentResponse.agent ?? "any agent" }}</span></h3>
      <dl>
        <dt>query</dt><dd>{{ currentResponse.query }}</dd>
        <dt>matched by</dt><dd>{{ currentResponse.setup.matchBy }}<span v-if="currentResponse.setup.keywords.length">: <code>{{ currentResponse.setup.keywords.join(", ") }}</code></span></dd>
        <dt>run() copies</dt><dd><code v-if="currentResponse.setup.copies.length">{{ currentResponse.setup.copies.join(", ") }}</code><span v-else class="muted">writes inline</span></dd>
        <dt>file</dt><dd class="mono">agent_fixture/{{ currentResponse.setup.file }}</dd>
      </dl>
      <h4>Used by</h4><UsagePanel :id="currentResponse.id" />
      <div class="bar"><h4>Cases</h4>
        <span class="mono" :style="{ color: cases.every((c) => c.pass) ? 'var(--pass)' : 'var(--fail)' }">{{ cases.filter((c) => c.pass).length }}/{{ cases.length }} pass</span>
        <button :disabled="busy" @click="run().then(runHealth)">{{ busy ? "running…" : "Run again" }}</button></div>
      <p v-if="err" style="color:var(--fail)">{{ err }}</p>
      <h5>+ should be served ({{ count("positive").length }})</h5><CaseResultRow v-for="c in count('positive')" :key="c.id" :c="c" />
      <h5>− should NOT be served ({{ count("negative").length }})</h5><CaseResultRow v-for="c in count('negative')" :key="c.id" :c="c" />
      <h4>Try your own</h4><TryBox :agent="currentResponse.agent ?? 'researcher'" :seed="currentResponse.query" />
    </div>
  </DebugFrame>
</template>
<style scoped>.det { padding:8px; } dl { display:grid; grid-template-columns:100px 1fr; gap:2px 8px; } dt { color:var(--mute); } dd { margin:0; } .bar { display:flex; gap:10px; align-items:center; } h4,h5 { margin:12px 0 4px; }</style>
