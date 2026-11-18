<script setup lang="ts">
// Top bar: the head branches (root of each session tree). Pick one to see only it and everything connected below it.
import { computed, watch } from "vue";
import { activeHead, groupOf, heads, openResponse, selectHead, state } from "@/store/dashboard";
import { MARKS, MARK_LABEL } from "../../../shared/prompttests";
import DebugFrame from "@/components/common/DebugFrame.vue";
// the head list follows the filters: a head with no matching case is hidden; if the picked head loses all matches, show all heads
const shownHeads = computed(() => heads.value.filter((h) => h.shown > 0));
watch(shownHeads, (l) => { if (activeHead.value && !l.some((h) => h.card.id === activeHead.value)) selectHead(null); });
const props = defineProps<{ group: "real" | "core" }>();
const toggleReady = (m: string) => (state.readyFilter.has(m) ? state.readyFilter.delete(m) : state.readyFilter.add(m));
const readyCount = (m: string) => state.cards.filter((k) => groupOf(k.group) === state.group).flatMap((k) => k.cases).filter((c) => c.tags.includes(m)).length;
// fixtures this head depends on (ids in expected_agents_res that are recorded responses), with how many cases in the head use each
const fixtures = computed(() => {
  const sel = heads.value.filter((h) => activeHead.value === null || h.card.id === activeHead.value);
  const n = new Map<string, Set<string>>();
  for (const h of sel) for (const k of h.tree) for (const c of k.cases) for (const t of c.turns) for (const e of t.expectedAgents) if (state.usage[e]) n.set(e, (n.get(e) ?? new Set()).add(c.caseId));
  return [...n].map(([id, cs]) => ({ id, cases: cs.size, shared: (state.usage[id]?.expectedBy.length ?? 0) > cs.size }));
});
</script>
<template>
  <DebugFrame name="HeadPicker">
    <div v-if="props.group === 'real'" class="heads marks">
      <span class="muted small">readiness filter</span>
      <button v-for="m in MARKS" :key="m" :class="['mkc', m, { on: state.readyFilter.has(m) }]" :title="m === 'ready_to_start' ? 'needs one init prompt to start' : 'tag declared on the case in code'" @click="toggleReady(m)">{{ MARK_LABEL[m]!.replace(" (one init prompt)", "") }} <span class="mono muted">{{ readyCount(m) }}</span></button>
      <button class="clear" :disabled="!state.readyFilter.size" @click="state.readyFilter.clear()">✕ clear filter</button>
    </div>
    <div class="heads">
      <button :class="{ on: activeHead === null }" @click="selectHead(null)">All heads</button>
      <button v-for="h in shownHeads" :key="h.card.id" class="h" :class="{ on: activeHead === h.card.id }" :title="h.card.cases.map((c) => c.caseId).join(' → ')" @click="selectHead(h.card.id)">
        <b>{{ h.card.kind === "chain" ? h.card.cases[0]!.caseId : h.card.title }}</b>
        <span class="muted mono"> {{ h.card.kind === "chain" ? `${h.shown}/${h.cases} tests · ${h.tree.length > 1 ? h.tree.length - 1 + " sub" : "no branch"}` : `${h.shown}/${h.cases} standalone` }}</span>
      </button>
    </div>
    <div v-if="fixtures.length" class="fx">
      <span class="muted">fixtures this view depends on:</span>
      <button v-for="f in fixtures" :key="f.id" class="mono" :title="f.shared ? 'also expected by cases outside this view' : 'only used inside this view'" @click="openResponse(f.id)">{{ f.id }}<span v-if="f.shared" style="color:var(--warn)"> ⚠ shared</span></button>
    </div>
  </DebugFrame>
</template>
<style scoped>.heads { display:flex; gap:6px; flex-wrap:wrap; padding:6px 12px; border-bottom:1px solid var(--line); background:var(--card); } .on { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, transparent); } .h { text-align:left; } .fx { display:flex; gap:4px; flex-wrap:wrap; align-items:center; padding:4px 12px; background:var(--card); border-bottom:1px solid var(--line); font-size:12px; } .fx button { padding:0 6px; } .mkc.to_scrap.on { border-color:var(--fail); }</style>
