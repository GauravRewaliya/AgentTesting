<script setup lang="ts">
// How big is every agent's prompt? file = the CLAUDE.md the agent has; launch = what the model really receives (the harness appends the team-tool docs; the lead also its call syntax and the agent declarations). Limit line = the 6000-character rule.
import { computed } from "vue";
import { pt } from "@/store/promptTests";
const rows = computed(() => (pt.catalog?.launch ?? []).slice()), limit = computed(() => pt.catalog?.limit ?? 8000), max = computed(() => Math.max(limit.value * 2.2, ...rows.value.map((r) => r.launchChars)));
const w = (n: number) => Math.round((n / max.value) * 100) + "%";
const sizeOf = (agent: string) => pt.catalog?.sizes.find((s) => s.agent === agent && s.kind === "prompt");
</script>
<template>
  <section class="sizes card">
    <h3>Prompt sizes <small class="mute">characters; ~4 characters = 1 token; limit {{ limit }} for the file</small></h3>
    <div class="row head mute"><span>agent</span><span>file (CLAUDE.md) and launch (what the model gets)</span><span class="r">file / launch</span></div>
    <div v-for="r in rows" :key="r.agent" class="row">
      <b>{{ r.agent }}</b>
      <div class="bars" :title="`file ${r.staticChars}, launch ${r.launchChars}`">
        <i class="lim" :style="{ left: w(limit) }"></i>
        <i class="b launch" :style="{ width: w(r.launchChars) }"></i>
        <i class="b file" :class="{ over: r.staticChars > limit }" :style="{ width: w(r.staticChars) }"></i>
      </div>
      <span class="r mono">{{ r.staticChars }} / {{ r.launchChars }} <small class="mute">(~{{ Math.round(r.launchChars / 4) }} tok)</small></span>
    </div>
    <p class="mute small">The file is what we write; the launch prompt is what costs tokens every turn. The gap is the team-tool documentation the harness adds: to shrink an agent, shrink that block (give it only the commands it uses: agent.json <span class="mono">team_tools</span>) as well as the file. Lines in a file: {{ pt.catalog?.sizes.filter((s) => s.kind === "prompt").map((s) => s.agent + " " + s.lines).join(" · ") }}.</p>
  </section>
</template>
<style scoped>
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; } h3 { margin: 0; } small, .small { font-size: 12px; font-weight: 400; } .mute { color: var(--mute); }
.row { display: grid; grid-template-columns: 110px 1fr 190px; gap: 10px; align-items: center; } .row.head { font-size: 11px; } .r { text-align: right; }
.bars { position: relative; height: 14px; background: color-mix(in srgb, var(--line) 50%, transparent); border-radius: 4px; overflow: hidden; }
.b { position: absolute; left: 0; top: 0; height: 100%; display: block; } .b.launch { background: color-mix(in srgb, var(--accent) 38%, transparent); } .b.file { background: var(--accent); height: 55%; top: 22%; } .b.file.over { background: var(--fail); }
.lim { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--mute); opacity: .7; z-index: 2; }
</style>
