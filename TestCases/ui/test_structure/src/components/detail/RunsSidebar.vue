<script setup lang="ts">
// RIGHT side: "session runs" = the runs started from the UI. Each one is a trigger plus its sub tasks (the cases it ran, ancestors first). With a case (Test page) it lists the runs that included it
// and the case's earlier results (archived by "Run again"); without (Flow page) it lists all runs. Click a run to read its log; run again from the button at the top of the page.
import { computed, onMounted, ref, watch } from "vue";
import { api } from "@/store/api";
import { loadAllRuns, loadCaseRuns, runState, viewRun } from "@/store/runs";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ caseId?: string }>();
onMounted(() => { void loadAllRuns(); if (props.caseId) void loadCaseRuns(props.caseId); });
const runs = computed(() => (props.caseId ? runState.caseRuns?.sessionRuns ?? [] : runState.all));
const history = computed(() => (props.caseId ? runState.caseRuns?.history ?? [] : []));
// details of the clicked run (its log + a claude -p verdict); the same run is also shown on the Test page
const verdict = ref(""), judging = ref(false), jerr = ref("");
watch(() => runState.run?.id, () => { verdict.value = ""; jerr.value = ""; });
async function judge() { const r = runState.run; if (!r) return; judging.value = true; jerr.value = ""; try { verdict.value = (await api.runJudge(r.id)).verdict; } catch (e) { jerr.value = (e as Error).message; } finally { judging.value = false; } }
const dur = (a: number, b?: number) => (b ? Math.max(0, Math.round((b - a) / 1000)) + "s" : "…");
const shown = computed(() => (props.caseId ? true : !!runState.run) && runs.value.find((r) => r.id === runState.run?.id));
const mark = { ok: "✓", fail: "✗", not_run: "–" } as const;
const hm = (t: number) => new Date(t).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => iso.slice(5, 16).replace("T", " ");
</script>
<template>
  <DebugFrame name="RunsSidebar">
    <aside class="side">
      <h4>Session runs <span class="muted small">workspace {{ runState.caseRuns?.workspace ?? "" }}</span></h4>
      <p v-if="!runs.length" class="muted small">No run was started from this page yet. Press ▶ Run.</p>
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
      <template v-if="history.length">
        <h4>Earlier results of this case</h4>
        <div v-for="h in history" :key="h.n" class="hist mono"><span :class="h.ok ? 'okc' : 'badc'">{{ h.ok ? "✓" : "✗" }}</span> #{{ h.n }} · {{ when(h.at) }} · ${{ h.cost.toFixed(4) }}</div>
      </template>
    </aside>
  </DebugFrame>
</template>
<style scoped>
.side { min-width:260px; max-width:100%; } h4 { margin:8px 0 6px; } .sr { padding:6px 8px; border:1px solid var(--line); border-radius:6px; margin-bottom:6px; cursor:pointer; background:var(--card); }
.sel { border-color:var(--accent); } .t1 { font:12px/18px ui-monospace,monospace; } .sub { font-size:11px; padding-left:14px; color:var(--mute); } .sub.ok { color:var(--pass); } .sub.fail { color:var(--fail); }
.dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; background:var(--mute); } .dot.running { background:var(--accent); } .dot.done { background:var(--pass); } .dot.failed { background:var(--fail); }
.go { margin-left:6px; color:var(--accent); font-size:11px; }
.det { border-top:2px solid var(--line); margin-top:10px; } .x { float:right; border:0; background:none; } .log { max-height:260px; overflow:auto; margin:4px 0; padding:6px; background:var(--card); border:1px solid var(--line); font:11px/1.4 ui-monospace,monospace; white-space:pre-wrap; }
.hist { font-size:11px; padding:2px 0; } .okc { color:var(--pass); } .badc { color:var(--fail); }
</style>
