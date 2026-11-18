<script setup lang="ts">
// One case: what it protects, why it matters, what is sent (history, context, message), what is EXPECTED, and what the last run GOT. A failure shows both side by side.
import { computed, ref } from "vue";
import { ancestors, pmarks, pt, results, runSelection, running, selectedCase, setPMark, suite, verdictOf } from "@/store/promptTests";
import type { PtCall } from "../../../shared/prompttests";
const c = selectedCase, res = computed(() => (c.value ? results.value[c.value.id] : undefined)), runIdx = ref(0);
const hist = computed(() => (suite.value && c.value ? ancestors(suite.value, c.value) : []));
const run = computed(() => res.value?.runs[Math.min(runIdx.value, (res.value?.runs.length ?? 1) - 1)]);
const callLine = (x: PtCall) => { const i = x.input as Record<string, unknown>, role = i.subagent_type ?? i.role ?? ""; return { tool: x.tool.replace("mcp__team__", "team: "), role: String(role), text: String(i.prompt ?? i.message ?? i.command ?? JSON.stringify(i)).slice(0, 600) }; };
const sign = (l: string) => (l.startsWith("-ve") ? "no" : l.startsWith("+ve") ? "yes" : "");
const ok = (cost: number) => `$${cost.toFixed(3)}`;
</script>
<template>
  <aside class="detail" v-if="c">
    <div class="top">
      <h3 class="mono">{{ c.id }}</h3>
      <span class="pill" :class="verdictOf(c.id)">{{ verdictOf(c.id) === "never" ? "never run" : verdictOf(c.id) }}</span>
      <span v-for="t in c.tags" :key="t" class="tag" :class="t">{{ t }}</span>
      <template v-if="verdictOf(c.id) === 'fail'"><button v-if="!pmarks[c.id]" title="you fixed it: the case stays FAILED until a re-run passes" @click="setPMark(c.id, 'fixed')">mark fixed</button><button v-if="!pmarks[c.id]" title="accepted for now" @click="setPMark(c.id, 'known')">known issue</button><button v-else @click="setPMark(c.id, null)">reopen ({{ pmarks[c.id]!.mark }})</button></template>
      <button class="go" :disabled="!!running || pt.busy" :title="`runs this case${hist.length ? ' and its ' + hist.length + ' parent(s) as history' : ''} (about $${(0.02 * (hist.length + 1)).toFixed(2)})`" @click="runSelection([c.id])">▶ run{{ hist.length ? ` (+${hist.length} parents)` : "" }}</button>
    </div>
    <p class="about">{{ c.about }}</p>
    <p v-if="c.why" class="why"><b>Why it matters</b> {{ c.why }}</p>

    <h4>Expected</h4>
    <ul class="exp"><li v-for="(l, i) in c.expect" :key="i" :class="sign(l)">{{ l }}</li></ul>
    <p v-if="c.judge" class="look"><b>Look at (by hand)</b> {{ c.judge }}</p>

    <h4>Last run <small v-if="res" class="mute">{{ res.stamp.replace("T", " ").slice(0, 16) }} · {{ ok(res.cost) }}<template v-if="res.runs.length > 1"> · {{ res.pass }}/{{ res.total }} runs passed</template></small></h4>
    <p v-if="!res" class="mute">Not run yet. The ▶ button runs it (a real model call, about $0.02).</p>
    <template v-else>
      <div v-if="res.runs.length > 1" class="runs"><button v-for="(r, i) in res.runs" :key="i" :class="{ on: runIdx === i, bad: !r.ok }" @click="runIdx = i">run {{ r.run }} {{ r.skipped ? "·skip" : r.ok ? "✓" : "✗" }}</button></div>
      <p v-if="run?.skipped" class="mute">{{ run.skipped }}</p>
      <template v-else-if="run">
        <div class="got">
          <b>GOT</b>
          <p v-if="run.looked" class="mute small">looked first: {{ run.looked }} — the results were handed back, this is the turn where it decided</p>
          <p v-if="!run.calls.length" class="mute">no tool call</p>
          <div v-for="(x, i) in run.calls" :key="i" class="call"><span class="tool mono">{{ callLine(x).tool }}</span><span v-if="callLine(x).role" class="role">{{ callLine(x).role }}</span><span class="turn mute mono" :title="'assistant turn ' + x.turn">#{{ [...new Set(run.calls.map((k) => k.turn))].indexOf(x.turn) + 1 }}</span><pre>{{ callLine(x).text }}</pre></div>
          <div v-if="run.text" class="said"><b>said</b><pre>{{ run.text }}</pre></div>
        </div>
        <p v-if="run.calls.some((k) => /report_bug|report_issue_to_admin/.test(JSON.stringify(k.input)))" class="adm">⚑ this agent reported an issue to the admin (see admin reports)</p>
        <ul v-if="run.failures.length" class="bad"><li v-for="f in run.failures" :key="f">✗ {{ f }}</li></ul>
        <p v-else class="okline">✓ every expectation holds</p>
      </template>
    </template>
    <h4>What is sent <small class="mute">single call; history = the parents' real behaviour</small></h4>
    <details v-if="hist.length" class="fold"><summary>History: {{ hist.map((h) => h.id).join(" → ") }}</summary><ol><li v-for="h in hist" :key="h.id"><b class="mono">{{ h.id }}</b>: "{{ h.user_message }}"</li></ol></details>
    <details v-if="c.messages.length" class="fold"><summary>Scripted earlier turns ({{ c.messages.length }})</summary><p v-for="(m, i) in c.messages" :key="i"><b>{{ m.role === "user" ? "person" : "agent" }}</b> {{ m.text }}</p></details>
    <details v-if="c.stuff.length" class="fold" open><summary>Context it already has ({{ c.stuff.length }})</summary><div v-for="s in c.stuff" :key="s.title" class="stuff"><b>{{ s.title }}</b><pre>{{ s.text }}</pre></div></details>
    <div class="msg"><b>{{ c.agent === "lead" ? "The person says" : "The hand-over" }}</b><pre>{{ c.user_message }}</pre></div>

  </aside>
  <aside v-else class="detail mute">Pick a case on the left.</aside>
</template>
<style scoped>
.detail { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; overflow: auto; display: grid; gap: 8px; align-content: start; }
.top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } h3 { margin: 0; font-size: 14px; } h4 { margin: 10px 0 2px; font-size: 13px; } small { font-weight: 400; font-size: 12px; } .mute { color: var(--mute); }
.go { margin-left: auto; border-color: var(--accent); } .about { margin: 0; font-weight: 600; } .why, .look { margin: 0; font-size: 13px; } .why b, .look b { color: var(--mute); font-weight: 600; margin-right: 6px; }
.pill { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); } .pill.pass { color: var(--pass); border-color: var(--pass); } .pill.fail { color: var(--fail); border-color: var(--fail); } .pill.never, .pill.skip { color: var(--mute); }
.tag { font-size: 11px; padding: 0 7px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 14%, transparent); } .tag.cost { background: color-mix(in srgb, #f79009 22%, transparent); } .tag.loop { background: color-mix(in srgb, #a855f7 20%, transparent); }
.exp { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 3px; font-size: 13px; } .exp li { padding-left: 18px; position: relative; } .exp li::before { content: "•"; position: absolute; left: 4px; color: var(--mute); } .exp li.yes::before { content: "+"; color: var(--pass); font-weight: 700; } .exp li.no::before { content: "−"; color: var(--fail); font-weight: 700; }
pre { margin: 2px 0 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.45 ui-monospace, monospace; background: color-mix(in srgb, var(--line) 35%, transparent); padding: 6px 8px; border-radius: 6px; max-height: 240px; overflow: auto; }
.fold summary { cursor: pointer; color: var(--mute); font-size: 13px; } .fold { font-size: 13px; } .fold ol { margin: 4px 0; padding-left: 18px; } .stuff { margin: 4px 0; }
.msg b { color: var(--mute); font-size: 12px; }
.runs { display: flex; gap: 6px; flex-wrap: wrap; } .runs button.on { border-color: var(--accent); } .runs button.bad { color: var(--fail); }
.got { display: grid; gap: 6px; } .call { display: grid; grid-template-columns: auto auto 1fr; gap: 4px 8px; align-items: baseline; } .call pre { grid-column: 1 / -1; } .tool { font-weight: 700; } .role { color: var(--accent); } .said b { color: var(--mute); font-size: 12px; }
p.adm { margin: 0; color: #f79009; font-size: 13px; } ul.bad { margin: 0; padding-left: 0; list-style: none; color: var(--fail); font-size: 13px; display: grid; gap: 3px; } .okline { color: var(--pass); margin: 0; }
</style>
