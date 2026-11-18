<script setup lang="ts">
// Usage like `/usage`, first cut: tokens per day (last 30 days) stacked by model, from the local session transcripts. More tabs (sessions ...) later. No chart library: inline SVG.
import { useLive } from "@/store/live";
import { computed } from "vue";
const { usage } = useLive();
const PAL = ["#3b6df0", "#12b76a", "#f79009", "#a855f7", "#06b6d4", "#ef4444"];
const short = (m: string) => m.replace(/^claude-/, "").replace(/-\d{8}$/, "");
const fmt = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n));
const total = (r: { input: number; output: number; cache_create: number }) => r.input + r.output + r.cache_create;   // cache reads are shown separately: they are re-reads of the same prefix and would hide everything else
const model = computed(() => {
  const u = usage.value; if (!u) return null;
  const models = [...new Set(u.rows.map((r) => r.model))].sort(), dates: string[] = [];
  for (let i = u.days - 1; i >= 0; i--) dates.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const by = new Map(u.rows.map((r) => [r.date + "|" + r.model, r])), max = Math.max(1, ...dates.map((d) => models.reduce((s, m) => s + (by.get(d + "|" + m) ? total(by.get(d + "|" + m)!) : 0), 0)));
  const W = 900, H = 220, bw = W / dates.length;
  const bars = dates.flatMap((d, i) => { let y = H; return models.map((m, k) => { const r = by.get(d + "|" + m), v = r ? total(r) : 0, h = (v / max) * (H - 10); y -= h; return { x: i * bw + 2, y, w: bw - 4, h, c: PAL[k % PAL.length]!, tip: `${d} · ${short(m)} · ${fmt(v)} tokens` }; }); }).filter((b) => b.h > 0);
  return { models, dates, bars, W, H, max, legend: models.map((m, k) => ({ m: short(m), c: PAL[k % PAL.length]!, v: u.rows.filter((r) => r.model === m).reduce((s, r) => s + total(r), 0) })) };
});
</script>
<template>
  <div class="usage">
    <h2>Usage <small class="mute">last 30 days, from your Claude sessions on this machine</small></h2>
    <p v-if="!usage" class="mute">Reading the session logs…</p>
    <template v-else>
      <div class="cards">
        <div class="card"><b>{{ usage.sessions }}</b><span>sessions</span></div>
        <div class="card"><b>{{ fmt(usage.totals.input + usage.totals.output) }}</b><span>input + output tokens</span></div>
        <div class="card"><b>{{ fmt(usage.totals.cache_create) }}</b><span>cache written</span></div>
        <div class="card"><b>{{ fmt(usage.totals.cache_read) }}</b><span>cache read</span></div>
      </div>
      <div class="card chart" v-if="model && model.bars.length">
        <h3>Tokens per day <small class="mute">input + output + cache written, by model</small></h3>
        <svg :viewBox="`0 0 ${model.W} ${model.H + 24}`" role="img" aria-label="tokens per day by model">
          <line :x1="0" :x2="model.W" :y1="model.H" :y2="model.H" stroke="var(--line)" />
          <rect v-for="(b, i) in model.bars" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.c" rx="2"><title>{{ b.tip }}</title></rect>
          <text :x="0" :y="model.H + 16" class="ax">{{ model.dates[0] }}</text><text :x="model.W" :y="model.H + 16" class="ax" text-anchor="end">{{ model.dates[model.dates.length - 1] }}</text>
          <text :x="model.W" :y="12" class="ax" text-anchor="end">max {{ fmt(model.max) }} / day</text>
        </svg>
        <div class="legend"><span v-for="l in model.legend" :key="l.m"><i :style="{ background: l.c }"></i>{{ l.m }} · {{ fmt(l.v) }}</span></div>
      </div>
      <p v-else class="mute">No usage in the last {{ usage.days }} days in {{ usage.profiles.join(", ") || "any Claude profile" }}.</p>
    </template>
    <p class="mute later">Sessions and other views come later.</p>
    <aside class="banner">
      <span>Plan limits (the 5-hour and weekly percentages) are not part of this page.</span>
      <a :href="usage?.link ?? 'https://claude.ai/settings/usage'" target="_blank" rel="noopener">See your plan usage on claude.ai ↗</a>
    </aside>
  </div>
</template>
<style scoped>
.usage { display: grid; gap: 14px; max-width: 980px; } h2, h3 { margin: 0; } small { font-weight: 400; font-size: 13px; } .mute { color: var(--mute); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 2px; } .cards .card b { font-size: 22px; } .cards .card span { color: var(--mute); font-size: 12px; }
.chart svg { width: 100%; height: auto; } .ax { font-size: 11px; fill: var(--mute); }
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; }
.later { font-size: 12px; margin: 0; }
.banner { margin-top: 20px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; padding: 12px 16px; border: 1px dashed var(--line); border-radius: 10px; background: color-mix(in srgb, var(--accent) 7%, var(--card)); }
</style>
