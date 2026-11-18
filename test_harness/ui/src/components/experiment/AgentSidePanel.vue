<script setup lang="ts">
import DebugFrame from "@/components/common/DebugFrame.vue";
// RIGHT: the master and its sub-agents. Clicking a card opens that agent's own conversation page (thoughts, tool groups, replies); nothing opens below any more.
import { ref } from "vue";
import type { AgentDetail, CaseResultOut, CaseState, LiveAgent, LiveSession } from "../../../shared/experiment";
import { agoOf, usd } from "./fmt";

const props = defineProps<{ session: LiveSession; result: CaseResultOut | null; processes: AgentDetail["processes"]; now: number; focus?: string }>();   // focus: an agent id = show only the sub-agents below it
const emit = defineEmits<{ openAgent: [id: string]; stopProc: [pid: number] }>();
const showResult = ref(true), showProcs = ref(true);
const color: Record<CaseState, string> = { pass: "var(--pass)", fail: "var(--fail)", partial: "var(--warn)", running: "var(--accent)", skipped: "var(--mute)", never_run: "var(--mute)" };
type Node = { a: LiveAgent; d: number };
const rows = (s: LiveSession): Node[] => {
  if (!props.focus) return tree(s);
  const out: Node[] = [], walk = (id: string, d: number) => s.agents.filter((a) => a.caller === id).forEach((a) => { out.push({ a, d }); walk(a.id, d + 1); });
  walk(props.focus, 0); return out;
};
const tree = (s: LiveSession): Node[] => {
  const by = new Map<string, LiveAgent[]>(); for (const a of s.agents) by.set(a.caller ?? "", [...(by.get(a.caller ?? "") ?? []), a]);
  const ids = new Set(s.agents.map((a) => a.id)), out: Node[] = [];
  const walk = (a: LiveAgent, d: number) => { out.push({ a, d }); (by.get(a.id) ?? []).forEach((c) => walk(c, d + 1)); };
  s.agents.filter((a) => !a.caller || !ids.has(a.caller) || a.caller.startsWith("lead")).forEach((a) => walk(a, 0));
  return out;
};
</script>

<template>
  <DebugFrame name="AgentSidePanel" hint="experiment/AgentSidePanel.vue" fill>
    <aside class="side">
    <h4 v-if="!focus">Master agent</h4>
    <button v-if="!focus && session.master" class="card clk" :class="'s-' + session.master.status" title="open the master's full conversation" @click="emit('openAgent', session.master.id)">
      <div class="top"><span class="tag t-master">MASTER</span><span class="nm">{{ session.master.id }}</span><span class="st">{{ session.master.status }}</span></div>
      <div class="muted small">{{ session.master.activity || "idle" }}</div>
      <div class="muted small mono">{{ session.master.runs }} turn(s) · {{ usd(session.master.cost) }} incl. sub-agents · {{ agoOf(now, session.master.lastEventAt) }}</div>
      <div class="go2">open conversation →</div>
    </button>
    <p v-else-if="!focus" class="muted small">The master has not started yet.</p>
    <div v-if="!focus" class="muted small">may call: {{ session.agentsAllowed.join(", ") || "nobody" }}</div>

    <h4>{{ focus ? "Sub-agents of " + focus : "Sub-agent sessions" }} <span class="muted small">{{ rows(session).length }}</span></h4>
    <p v-if="!rows(session).length" class="muted small">{{ focus ? "This agent has not called any sub-agent." : "No sub-agents yet. The master starts them when the task needs them." }}</p>
    <button v-for="{ a, d } in rows(session)" :key="a.id" class="card sub clk" title="open this sub-agent's full conversation" :class="'s-' + (a.needsParent ? 'stalled' : a.status)" :style="{ marginLeft: Math.min(d, 3) * 14 + 'px' }" @click="emit('openAgent', a.id)">
      <div class="top"><span class="dot" :class="a.needsParent ? 'stalled' : a.status" /><span class="tag" :class="'t-' + a.name">{{ a.name.toUpperCase() }}</span><span v-if="a.fixture" class="tag" title="answer served from agent_fixture, no model ran">FIXTURE</span></div>
      <div v-if="a.activity" class="muted small mono">▸ {{ a.activity }}</div>
      <div v-if="a.needsParent" class="warn small">asked: {{ a.needsParent.split("\n")[0] }}</div>
      <div class="muted small mono">{{ a.id }} · L{{ a.level }} · {{ a.runs }} run(s) · {{ usd(a.cost) }} · {{ agoOf(now, a.lastEventAt) }}</div>
    </button>

    <template v-if="!focus && processes.length">
      <h4 class="clk" @click="showProcs = !showProcs">{{ showProcs ? "▾" : "▸" }} Processes <span class="muted small">{{ processes.length }}</span></h4>
      <div v-if="showProcs" class="detail">
        <div v-for="x in processes" :key="x.pid" class="mono small">{{ x.pid }} · {{ x.elapsed }} · {{ x.cmd }} <button class="link danger" @click="emit('stopProc', x.pid)">stop</button></div>
      </div>
    </template>

    <template v-if="!focus && session.case">
      <h4 class="clk" @click="showResult = !showResult">{{ showResult ? "▾" : "▸" }} Verdict · {{ session.case }}<span v-if="result" :style="{ color: color[result.state] }"> · {{ result.state }} · {{ result.done }}/{{ result.total }}</span></h4>
      <template v-if="showResult">
        <p v-if="!result" class="muted small">this case has not run yet</p>
        <div v-for="t in result?.turns ?? []" :key="t.turn" class="turn" :class="{ bad: !t.match || t.guard }">
          <div class="th"><b>Turn {{ t.turn }}</b><span :style="{ color: t.match && !t.guard ? 'var(--pass)' : 'var(--fail)' }">{{ t.match && !t.guard ? "MATCH" : "DIFFERS" }}</span><span v-if="t.guard" class="warn small">a distractor was called</span></div>
          <div class="lbl">expected calls</div><div class="mono small">{{ t.expected.map((e) => e.kind + ":" + e.role).join(", ") || "(none: the lead must not delegate)" }}</div>
          <div class="lbl">expected context</div><div class="txt muted small">{{ t.expectedContext }}</div>
          <div class="lbl">actual calls</div>
          <div v-if="!t.calls.length" class="mono small">(none)</div>
          <div v-for="c in t.calls" :key="c.id" class="call"><span class="mono small">{{ c.kind }}:{{ c.role }}<template v-if="c.custom"> (custom: {{ c.title }})</template> → {{ c.agent }}</span> <span class="muted small">{{ c.status }}</span></div>
          <div v-for="c in t.denied" :key="c.id" class="warn small">REFUSED {{ c.role }}: {{ c.reason }}</div>
        </div>
      </template>
    </template>
  </aside>
  </DebugFrame>
</template>

<style scoped src="./exp.css"></style>
<style scoped>
button.card { all: unset; box-sizing: border-box; display: grid; gap: 3px; width: 100%; text-align: left; cursor: pointer; border: 1px solid var(--line); border-left: 3px solid var(--mute); border-radius: 10px; padding: 8px 12px; margin-bottom: 7px; background: var(--card); }
button.card.s-running { border-left-color: var(--accent); } button.card.s-idle { border-left-color: var(--pass); } button.card.s-failed, button.card.s-stalled { border-left-color: var(--fail); }
button.card:hover, button.card:focus-visible { border-color: var(--accent); } .go2 { font-size: 11px; font-weight: 600; color: var(--accent); }
</style>
