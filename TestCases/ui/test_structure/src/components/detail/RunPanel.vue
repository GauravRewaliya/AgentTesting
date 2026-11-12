<script setup lang="ts">
// TOP of the Test page: run this case with the fixture-mock runner (real lead on haiku, sub-agents answered from agent_fixture). If it already ran in the CURRENT workspace its result is shown here at once.
import { computed, onMounted, ref, watch } from "vue";
import { api } from "@/store/api";
import { isRunning, loadCaseRuns, resumeRuns, runCase, runState, stopRun } from "@/store/runs";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ caseId: string }>();
onMounted(() => { void loadCaseRuns(props.caseId); void resumeRuns(); });
watch(() => props.caseId, (id) => loadCaseRuns(id));
const steps = computed(() => runState.caseRuns?.chain.length ?? 1);
const cur = computed(() => runState.caseRuns?.current ?? null), ws = computed(() => runState.caseRuns?.workspace ?? "?");
const verdict = ref(""), judging = ref("");
async function judge() { const r = runState.run; if (!r) return; judging.value = "judging…"; verdict.value = ""; try { verdict.value = (await api.runJudge(r.id)).verdict; judging.value = ""; } catch (e) { judging.value = (e as Error).message; } }
watch(() => runState.run?.id, () => { verdict.value = ""; judging.value = ""; });
const when = (iso: string) => iso.slice(5, 16).replace("T", " ");
</script>
<template>
  <DebugFrame name="RunPanel">
    <div class="run">
      <button class="primary" :disabled="isRunning" @click="runCase(caseId, !!cur)">{{ isRunning ? "running…" : (cur ? "↻ Run all again" : "▶ Run all") + (steps > 1 ? ` (${steps} steps)` : "") }}</button>
      <button v-if="isRunning" @click="stopRun">■ Stop</button>
      <button v-else-if="runState.run" :disabled="judging === 'judging…'" title="claude -p reads the run log and judges expected vs actual" @click="judge">⚖ Judge with claude</button>
      <span v-if="cur" class="res" :class="cur.ok ? 'ok' : 'bad'">{{ cur.ok ? "✓ pass" : "✗ " + (cur.status === "ran" ? "differs" : cur.status) }}</span>
      <span v-if="cur" class="mono small">result in workspace {{ ws }} · {{ when(cur.at) }} · {{ cur.turns }} turn(s) · ${{ cur.cost.toFixed(4) }}<template v-if="runState.caseRuns?.history.length"> · {{ runState.caseRuns.history.length }} earlier</template></span>
      <span v-else class="muted small">no result in workspace {{ ws }} yet</span>
      <span class="muted small">fixture runner: real haiku lead (cents), sub-agents from agent_fixture, saved in .state/…/{{ ws }}</span>
      <span v-if="runState.run" class="mono small">run {{ runState.run.id }} · {{ runState.run.status }}<template v-if="runState.run.cases.length > 1"> · {{ runState.run.cases.join(" → ") }}</template></span>
      <pre v-if="verdict" class="log verdict">{{ verdict }}</pre><div v-else-if="judging" class="muted small">{{ judging }}</div>
      <div v-if="runState.error" class="err">{{ runState.error }}</div>
      <pre v-if="runState.log" class="log">{{ runState.log }}</pre>
    </div>
  </DebugFrame>
</template>
<style scoped>
.run { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:6px 0; } .err { color:var(--fail); width:100%; }
.primary { border-color:var(--accent); } .res { font-weight:600; } .res.ok { color:var(--pass); } .res.bad { color:var(--fail); }
.log { width:100%; max-height:300px; overflow:auto; margin:4px 0 0; padding:8px; background:var(--card); border:1px solid var(--line); font:11px/1.4 ui-monospace,monospace; white-space:pre-wrap; }
</style>
