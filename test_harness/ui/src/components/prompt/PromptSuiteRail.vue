<script setup lang="ts">
// The suites (one file each): the master tests first, then one per agent. A small bar shows how many of its cases passed / failed / never ran.
import { pt, suiteStats } from "@/store/promptTests";
const pick = (name: string) => { pt.suite = name; pt.selected = null; pt.status = ""; pt.tag = ""; };
const group = (n: string) => (n.startsWith("master") ? "master" : "agents");
</script>
<template>
  <nav class="rail" v-if="pt.catalog">
    <template v-for="g in ['master', 'agents']" :key="g">
      <h4>{{ g === "master" ? "Master (the lead)" : "Agents" }}</h4>
      <button v-for="s in pt.catalog.suites.filter((x) => group(x.name) === g)" :key="s.name" class="s" :class="{ on: pt.suite === s.name }" :title="s.about" @click="pick(s.name)">
        <span class="n">{{ s.name.replace(/_test$/, "") }}<small v-if="/\d$/.test(s.name)" class="mute"> (flow)</small></span>
        <span class="c mono" :title="`${suiteStats(s).pass} pass | ${suiteStats(s).fail} failed | ${suiteStats(s).never} never run`">{{ suiteStats(s).pass + suiteStats(s).fail === 0 ? "- | -" : suiteStats(s).fail === 0 ? "ok" : suiteStats(s).pass + " | " + suiteStats(s).fail }}</span>
        <span class="bar" :title="`${suiteStats(s).pass} pass · ${suiteStats(s).fail} fail · ${suiteStats(s).never} never run`">
          <i class="p" :style="{ width: (suiteStats(s).pass / s.cases.length) * 100 + '%' }"></i><i class="f" :style="{ width: (suiteStats(s).fail / s.cases.length) * 100 + '%' }"></i>
        </span>
      </button>
    </template>
  </nav>
</template>
<style scoped>
.rail { display: grid; gap: 4px; align-content: start; } h4 { margin: 10px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--mute); } h4:first-child { margin-top: 0; } .mute { color: var(--mute); }
.s { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; padding: 6px 9px; border-radius: 8px; } .s.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--card)); }
.n { font-weight: 600; } .c { color: var(--mute); font-size: 12px; } .bar { grid-column: 1 / -1; height: 4px; border-radius: 3px; background: color-mix(in srgb, var(--line) 60%, transparent); display: flex; overflow: hidden; } .p { background: var(--pass); } .f { background: var(--fail); }
</style>
