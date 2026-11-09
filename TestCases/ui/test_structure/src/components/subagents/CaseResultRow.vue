<script setup lang="ts">
// One +/- case: what was sent, what was expected, what the real code did.
import type { CaseResult } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
defineProps<{ c: CaseResult }>();
</script>
<template>
  <DebugFrame name="CaseResultRow">
    <div class="cr" :class="c.pass ? 'ok' : 'bad'">
      <div class="top">
        <span class="kind" :class="c.kind">{{ c.kind === "positive" ? "+" : "−" }}</span>
        <strong>{{ c.name }}</strong>
        <span class="res">{{ c.pass ? "PASS" : "FAIL" }}</span>
      </div>
      <div class="mono muted q">“{{ c.query.length > 160 ? c.query.slice(0, 160) + "…" : c.query }}”</div>
      <div class="mono">expected <b>{{ c.expect }}</b> · got <b>{{ c.actual }}</b><span v-if="c.files?.length"> · wrote {{ c.files.join(", ") }}</span></div>
    </div>
  </DebugFrame>
</template>
<style scoped>
.cr { border-left:3px solid; padding:4px 8px; margin-bottom:6px; background:var(--card); border-radius:0 6px 6px 0; } .ok { border-color:var(--pass); } .bad { border-color:var(--fail); }
.top { display:flex; gap:8px; align-items:center; } .res { margin-left:auto; font-size:11px; font-weight:600; } .ok .res { color:var(--pass); } .bad .res { color:var(--fail); }
.kind { width:18px; text-align:center; border-radius:4px; color:#fff; font-weight:700; } .positive { background:var(--pass); } .negative { background:var(--fail); } .q { word-break:break-word; }
</style>
