<script setup lang="ts">
// PROMPT TESTING (flag prompt_testing): the prompt cases in TestCases/test_folders/prompt_test, apart from the real cases. Each case is ONE short call of ONE agent with its real prompt and tools (nothing runs);
// phases chain like the harness cases (after / branches). The page shows what a case protects, what it EXPECTS and what the last run GOT, so a prompt change can be judged by eye as well as by the verdict.
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useLive } from "@/store/live";
import { admin, loadCatalog, loadLog, pt, results, runSelection, running, runs, score, suite, suiteStats, verdictOf, visibleCases } from "@/store/promptTests";
import PromptSuiteRail from "@/components/prompt/PromptSuiteRail.vue";
import PromptCaseList from "@/components/prompt/PromptCaseList.vue";
import PromptCaseDetail from "@/components/prompt/PromptCaseDetail.vue";
import PromptSizes from "@/components/prompt/PromptSizes.vue";
const live = useLive();
onMounted(() => { live.start(); live.watch({ prompttests: true }); void loadCatalog(); });
onUnmounted(() => { live.watch({}); live.stop(); });
// open something useful at once: the first failing case of the suite, else its first case
watch([visibleCases, () => results.value], () => { if (pt.selected && visibleCases.value.some((c) => c.id === pt.selected)) return; pt.selected = (visibleCases.value.find((c) => verdictOf(c.id) === "fail") ?? visibleCases.value[0])?.id ?? null; }, { immediate: true });
const tags = [["", "all"], ["cost", "cost"], ["loop", "loop"], ["split_task", "split"], ["no_cost", "no cost"]] as const;
const stats = computed(() => (suite.value ? suiteStats(suite.value) : null));
const adminOpen = ref(false);
const total = computed(() => Object.values(results.value).reduce((n, r) => n + r.cost, 0));
const costTagged = computed(() => visibleCases.value.filter((c) => c.tags.includes("cost")).length);
const runSuite = () => { if (!suite.value) return; const n = visibleCases.value.length; if (confirm(`Run ${n} case${n === 1 ? "" : "s"} of ${pt.suite} (real model calls, about $${(n * 0.025).toFixed(2)})?`)) void runSelection(visibleCases.value.map((c) => c.id)); };
const toggle = <K extends "status" | "tag">(k: K, v: (typeof pt)[K]) => { (pt[k] as unknown) = pt[k] === v ? "" : v; };
</script>
<template>
  <div class="pt">
    <header class="bar">
      <div class="grp"><button v-for="t in tags" :key="t[0]" :class="{ on: pt.tag === t[0] }" @click="pt.tag = pt.tag === t[0] ? '' : t[0]">{{ t[1] }}</button></div>
      <div class="grp"><button v-for="v in (['pass', 'fail', 'never'] as const)" :key="v" :class="[v, { on: pt.status === v }]" @click="toggle('status', v)">{{ v === "never" ? "never run" : v }}</button></div>
      <input v-model="pt.query" placeholder="filter cases…" class="q" />
      <span class="score mono" :class="{ ok: score.ok, bad: score.failed > 0 }" title="all suites, current cases: passed | failed. - | - = nothing run yet; ok = nothing failed">total: <template v-if="score.none">- | -</template><template v-else>{{ score.pass }} pass | {{ score.failed }} failed<b v-if="score.ok"> · ok</b></template><small v-if="score.marked" class="mute"> ({{ score.marked }} marked)</small></span>
      <span class="mute mono">{{ visibleCases.length }} / {{ suite?.cases.length ?? 0 }} cases<template v-if="stats"> · {{ stats.pass }} pass · {{ stats.fail }} fail · {{ stats.never }} never</template><template v-if="costTagged"> · {{ costTagged }} cost-tagged</template> · ${{ total.toFixed(2) }} spent</span>
      <button class="primary" :disabled="!!running || pt.busy || !visibleCases.length" title="runs the cases shown (their parents run as history). Real model calls." @click="runSuite">▶ run these</button>
      <button :class="{ on: adminOpen }" :title="'what agents reported to the admin (report_bug): real runs and prompt tests'" @click="adminOpen = !adminOpen">admin reports <b class="mono">{{ admin.length }}</b></button>
      <button :class="{ on: pt.sizes }" @click="pt.sizes = !pt.sizes">prompt sizes</button>
    </header>
    <p v-if="pt.error" class="err">{{ pt.error }}</p>
    <div v-if="running" class="banner">Running <b>{{ running.suite }}</b>{{ running.ids.length ? ` (${running.ids.length} case${running.ids.length === 1 ? "" : "s"})` : "" }} since {{ new Date(running.startedAt).toLocaleTimeString() }} — results appear here when it ends.
      <button @click="pt.logId = running.id; loadLog()">log</button></div>
    <div v-else-if="runs[0]" class="banner done">Last run: <b>{{ runs[0].suite }}</b> {{ runs[0].status }}<template v-if="runs[0].endedAt"> in {{ Math.round((runs[0].endedAt - runs[0].startedAt) / 1000) }} s</template>. <button @click="pt.logId = runs[0].id; loadLog()">log</button></div>
    <pre v-if="pt.log" class="log">{{ pt.log }}</pre>
    <section v-if="adminOpen" class="admin card">
      <h3>Admin reports <small class="mute">an agent files one with <span class="mono">report_bug</span> when a tool fails, a plan is broken or it is blocked: from real runs (store/admin_issues.jsonl) and from prompt tests</small></h3>
      <p v-if="!admin.length" class="mute">Nothing reported.</p>
      <div v-for="a in admin" :key="a.id" class="arow"><span class="mono mute">{{ a.at.slice(5, 16).replace("T", " ") }}</span><span class="kind" :class="a.severity">{{ a.kind || "report" }}</span><span class="mono mute">{{ a.source }}</span><span class="mono">{{ a.agent || a.reporter }}</span><span class="atext">{{ a.text }}</span></div>
    </section>
    <PromptSizes v-if="pt.sizes" />
    <p class="mute intro" v-if="suite"><b>{{ suite.name }}</b> tests <b>{{ suite.agent === "lead" ? "the master" : suite.agent }}</b>: {{ suite.about }}. One call per case, nothing is executed; a phase with a parent continues the parent's real behaviour, and a failed parent skips its children.</p>
    <div class="cols">
      <PromptSuiteRail class="c1" />
      <PromptCaseList class="c2" />
      <PromptCaseDetail class="c3" />
    </div>
  </div>
</template>
<style scoped>
.score { font-weight: 700; } .score.ok { color: var(--pass); } .score.bad { color: var(--fail); } .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; } .admin h3 { margin: 0 0 6px; font-size: 14px; } .admin small { font-weight: 400; } .arow { display: grid; grid-template-columns: 90px 90px 190px 110px 1fr; gap: 8px; padding: 4px 0; border-top: 1px solid var(--line); font-size: 12px; align-items: baseline; } .kind { padding: 0 7px; border-radius: 999px; border: 1px solid var(--line); text-align: center; } .kind.high { color: var(--fail); border-color: var(--fail); } .atext { word-break: break-word; }
.pt { padding: 12px 14px 40px; display: grid; gap: 10px; } .bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .grp { display: flex; gap: 4px; } .q { max-width: 220px; } .mute { color: var(--mute); }
button.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--card)); } .primary { border-color: var(--accent); margin-left: auto; } .pass.on { border-color: var(--pass); } .fail.on { border-color: var(--fail); }
.cols { display: grid; grid-template-columns: 200px minmax(300px, 1fr) minmax(360px, 460px); gap: 14px; align-items: start; min-height: 60vh; } .c2 { max-height: 74vh; } .c3 { max-height: 74vh; position: sticky; top: 8px; }
.banner { padding: 8px 12px; border: 1px solid var(--accent); border-radius: 8px; background: color-mix(in srgb, var(--accent) 8%, var(--card)); font-size: 13px; } .banner.done { border-color: var(--line); background: var(--card); } .err { color: var(--fail); margin: 0; }
.log { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; max-height: 260px; overflow: auto; white-space: pre-wrap; font-size: 12px; margin: 0; } .intro { margin: 0; font-size: 13px; }
@media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } .c3 { position: static; max-height: none; } }
</style>
