<script setup lang="ts">
// The chain of one suite, in file order. Indent = how deep in the flow (each phase continues its parent); a second child of one parent is a branch. Dot = last verdict.
import { branchOf, depthOf, pmarks, pt, results, suite, verdictOf, visibleCases } from "@/store/promptTests";
const rate = (id: string) => { const r = results.value[id]; return r && r.total > 1 ? `${r.pass}/${r.total}` : ""; };
</script>
<template>
  <div class="list" v-if="suite">
    <p v-if="!visibleCases.length" class="mute">No case matches the filters.</p>
    <button v-for="c in visibleCases" :key="c.id" class="row" :class="[verdictOf(c.id), { sel: pt.selected === c.id }]" :style="{ paddingLeft: 10 + depthOf(suite, c) * 18 + 'px' }" @click="pt.selected = c.id">
      <i class="dot" :class="verdictOf(c.id)" :title="verdictOf(c.id)"></i>
      <span class="id mono">{{ c.id }}</span>
      <span v-if="branchOf(suite, c)" class="br" title="a branch: another child of the same parent">⑂</span>
      <span v-for="t in c.tags.filter((x) => x !== 'prompt_testing')" :key="t" class="tag" :class="t">{{ t }}</span>
      <span v-if="pmarks[c.id] && verdictOf(c.id) === 'fail'" class="pm" :title="'marked ' + pmarks[c.id]!.mark + ' by you; still FAILED until a re-run passes'">{{ pmarks[c.id]!.mark }}</span>
      <span v-if="rate(c.id)" class="rate mono">{{ rate(c.id) }}</span>
      <span class="about">{{ c.about }}</span>
    </button>
  </div>
</template>
<style scoped>
.list { display: grid; gap: 2px; align-content: start; overflow: auto; } .mute { color: var(--mute); }
.row { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; text-align: left; padding: 5px 10px; border-radius: 7px; border: 1px solid transparent; } .row:hover { border-color: var(--line); } .row.sel { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--card)); }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; background: var(--line); align-self: center; } .dot.pass { background: var(--pass); } .dot.fail { background: var(--fail); } .dot.skip { background: #f79009; }
.id { font-weight: 600; font-size: 12px; } .about { color: var(--mute); font-size: 13px; flex: 1 1 260px; } .br { color: var(--accent); } .pm { font-size: 10px; padding: 0 6px; border-radius: 999px; border: 1px dashed var(--fail); color: var(--fail); } .rate { font-size: 11px; color: var(--mute); }
.tag { font-size: 10px; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 14%, transparent); } .tag.cost { background: color-mix(in srgb, #f79009 22%, transparent); } .tag.loop { background: color-mix(in srgb, #a855f7 20%, transparent); }
</style>
