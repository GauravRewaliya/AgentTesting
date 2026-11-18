<script setup lang="ts">
// RIGHT side: the runs of the f1 runner (the same ones the CLI and the Experiment page start). With a case (a node picked on Flow, or the Test page) it shows THAT case: its chain (ancestors first), its result
// and the runs that touched the chain (a parent's run counts: the child continues its state). Without a case it shows the latest runs only. Click a run to read its log.
import { computed, onMounted, ref, watch } from "vue";
import { api } from "@/store/api";
import { chainPlan, loadAllRuns, loadCaseRuns, runState, viewRun } from "@/store/runs";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ caseId?: string }>();
onMounted(() => { void loadAllRuns(); if (props.caseId) void loadCaseRuns(props.caseId); });
watch(() => props.caseId, (id) => { if (id) void loadCaseRuns(id); });
const runs = computed(() => (props.caseId ? runState.caseRuns?.sessionRuns ?? [] : runState.all.slice(0, 8)));
// details of the clicked run (its log + a claude -p verdict); the same run is also shown on the Test page
const verdict = ref(""), judging = ref(false), jerr = ref("");
watch(() => runState.run?.id, () => { verdict.value = ""; jerr.value = ""; });
async function judge() { const r = runState.run; if (!r) return; judging.value = true; jerr.value = ""; try { verdict.value = (await api.runJudge(r.id)).verdict; } catch (e) { jerr.value = (e as Error).message; } finally { judging.value = false; } }
const dur = (a: number, b?: number) => (b ? Math.max(0, Math.round((b - a) / 1000)) + "s" : "…");
const shown = computed(() => (runState.run ? runs.value.find((r) => r.id === runState.run?.id) : undefined));   // the open run must belong to the list of THIS node
const mark = { ok: "✓", fail: "✗", skipped: "⤼", not_run: "–" } as const;
const hm = (t: number) => new Date(t).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => iso.slice(5, 16).replace("T", " ");
</script>
<template>
  <DebugFrame name="RunsSidebar">
    <aside class="side">
      <h4 v-if="caseId">{{ caseId }} <span class="muted small">session {{ runState.caseRuns?.workspace ?? "" }}</span></h4>
      <h4 v-else>Latest runs</h4>
      <div v-if="caseId && runState.caseRuns" class="mono small">
        <span :class="runState.caseRuns.current ? (runState.caseRuns.current.ok ? 'okc' : 'badc') : 'muted'">{{ runState.caseRuns.current ? (runState.caseRuns.current.ok ? "✓ pass" : "✗ " + (runState.caseRuns.current.status === "ran" ? "differs" : runState.caseRuns.current.status)) : "not run yet" }}</span>
        <span v-if="runState.caseRuns.current" class="muted"> · {{ when(runState.caseRuns.current.at) }} · ${{ runState.caseRuns.current.cost.toFixed(4) }}</span>
        <div v-if="(runState.caseRuns.steps?.length ?? 0) > 1" class="muted">chain {{ chainPlan.done }}/{{ chainPlan.n }} ran:</div>
        <div v-for="st in runState.caseRuns.steps ?? []" :key="st.caseId" class="step" :class="st.state">{{ mark[st.state] }} {{ st.caseId }}<span class="muted"> · {{ st.at ? when(st.at) : "never run" }}</span></div>
      </div>
      <p v-if="!runs.length" class="muted small">{{ caseId ? "No run log for this chain yet (the steps above show when each last ran, even if it was a manual run). Press ▶." : "No run yet. Pick a node and press ▶." }}</p>
      <div v-for="r in runs" :key="r.id" class="sr" :class="{ sel: runState.run?.id === r.id }" @click="viewRun(r.id)">
        <div class="t1"><span class="dot" :class="r.status" />{{ r.id }} <span class="muted">{{ r.status }}{{ r.rerun ? " · again" : "" }}</span><span class="muted small"> {{ hm(r.startedAt) }}</span><router-link v-if="r.cases.length" class="go" :to="{ name: 'test', params: { caseId: r.cases[r.cases.length - 1] } }" title="open this run's session (stack, log, workspace)" @click.stop>session ↗</router-link></div>
        <div v-for="s in r.sub" :key="s.caseId" class="sub mono" :class="s.state"><span>{{ mark[s.state] }}</span> {{ s.caseId }} <router-link class="go" :to="{ name: 'test', params: { caseId: s.caseId } }" title="open the session of this case" @click.stop>↗</router-link></div>
      </div>
      <section v-if="shown" class="det">
        <h4>Run details <button class="x" title="close" @click="runState.run = null; runState.log = ''">✕</button></h4>
        <div class="mono small">{{ shown.id }} · {{ shown.status }}<template v-if="shown.exitCode != null"> (exit {{ shown.exitCode }})</template> · {{ dur(shown.startedAt, shown.endedAt) }}</div>
        <div class="mono small muted">suite {{ shown.suite }}{{ shown.rerun ? " · rerun" : "" }}</div>
        <div v-for="s in shown.sub" :key="s.caseId" class="mono small sub" :class="s.state">{{ mark[s.state] }} {{ s.caseId }}
          <router-link class="go" :to="{ name: 'test', params: { caseId: s.caseId } }">open session ↗</router-link></div>
        <button :disabled="judging || shown.status === 'running'" @click="judge">{{ judging ? "judging…" : "⚖ Judge with claude" }}</button>
        <pre v-if="verdict" class="log">{{ verdict }}</pre><div v-if="jerr" class="badc small">{{ jerr }}</div>
        <h4>Log</h4>
        <pre class="log">{{ runState.log || "(no output yet)" }}</pre>
      </section>
    </aside>
  </DebugFrame>
</template>
<style scoped>
.side { min-width:260px; max-width:100%; } h4 { margin:8px 0 6px; } .sr { padding:6px 8px; border:1px solid var(--line); border-radius:6px; margin-bottom:6px; cursor:pointer; background:var(--card); }
.sel { border-color:var(--accent); } .t1 { font:12px/18px ui-monospace,monospace; } .sub { font-size:11px; padding-left:14px; color:var(--mute); } .sub.ok { color:var(--pass); } .sub.fail { color:var(--fail); }
.dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; background:var(--mute); } .dot.running { background:var(--accent); } .dot.done { background:var(--pass); } .dot.failed { background:var(--fail); }
.step { padding-left:10px; } .step.ok { color:var(--pass); } .step.fail { color:var(--fail); } .step .muted { color:var(--mute); }
.go { margin-left:6px; color:var(--accent); font-size:11px; }
.det { border-top:2px solid var(--line); margin-top:10px; } .x { float:right; border:0; background:none; } .log { max-height:260px; overflow:auto; margin:4px 0; padding:6px; background:var(--card); border:1px solid var(--line); font:11px/1.4 ui-monospace,monospace; white-space:pre-wrap; }
.hist { font-size:11px; padding:2px 0; } .okc { color:var(--pass); } .badc { color:var(--fail); }
</style>
