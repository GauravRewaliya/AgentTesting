<script setup lang="ts">
// Top bar: the head branches (root of each session tree). Pick one to see only it and everything connected below it.
import { computed } from "vue";
import { activeHead, heads, openResponse, selectHead, state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
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
    <div class="heads">
      <button :class="{ on: activeHead === null }" @click="selectHead(null)">All heads</button>
      <button v-for="h in heads" :key="h.card.id" class="h" :class="{ on: activeHead === h.card.id }" :title="h.card.cases.map((c) => c.caseId).join(' → ')" @click="selectHead(h.card.id)">
        <b>{{ h.card.kind === "chain" ? h.card.cases[0]!.caseId : h.card.title }}</b>
        <span class="muted mono"> {{ h.card.kind === "chain" ? `${h.cases} tests · ${h.tree.length > 1 ? h.tree.length - 1 + " sub" : "no branch"}` : `${h.cases} standalone` }}</span>
      </button>
    </div>
    <div v-if="fixtures.length" class="fx">
      <span class="muted">fixtures this view depends on:</span>
      <button v-for="f in fixtures" :key="f.id" class="mono" :title="f.shared ? 'also expected by cases outside this view' : 'only used inside this view'" @click="openResponse(f.id)">{{ f.id }}<span v-if="f.shared" style="color:var(--warn)"> ⚠ shared</span></button>
    </div>
  </DebugFrame>
</template>
<style scoped>.heads { display:flex; gap:6px; flex-wrap:wrap; padding:6px 12px; border-bottom:1px solid var(--line); background:var(--card); } .on { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, transparent); } .h { text-align:left; } .fx { display:flex; gap:4px; flex-wrap:wrap; align-items:center; padding:4px 12px; background:var(--card); border-bottom:1px solid var(--line); font-size:12px; } .fx button { padding:0 6px; }</style>
