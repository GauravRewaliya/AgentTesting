<script setup lang="ts">
// Shown above the index when an agent is picked: what it is, its real guard rules, and its guard + / − cases.
import { ref, watchEffect } from "vue";
import { api } from "@/store/api";
import { currentAgent } from "@/store/dashboard";
import type { CaseResult } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
import CaseResultRow from "./CaseResultRow.vue";
import TryBox from "./TryBox.vue";
const cases = ref<CaseResult[]>([]), show = ref(false);
watchEffect(async () => { const a = currentAgent.value; cases.value = a ? await api.guardCases(a.name) : []; });
</script>
<template>
  <DebugFrame name="AgentSummary">
    <div v-if="currentAgent" class="sum">
      <h3>{{ currentAgent.name }} <span class="muted">{{ currentAgent.category }}</span> <span v-if="currentAgent.forbidden">⛔ distractor</span></h3>
      <p class="muted">{{ currentAgent.description }}</p>
      <div v-for="g in currentAgent.guard" :key="g.file" class="mono rule">{{ g.file }}:
        <span v-if="g.rule.forbidden">forbidden</span>
        <template v-else>requires_done [{{ g.rule.requires_done?.join(", ") }}] · must contain [{{ g.rule.contains_all?.join(", ") }}] · min {{ g.rule.min_chars }} chars</template>
      </div>
      <div v-if="!currentAgent.guard.length" class="muted">no guard rules: only the fixture lookup decides</div>
      <button v-if="cases.length" @click="show = !show">{{ show ? "▾" : "▸" }} guard cases ({{ cases.filter((c) => c.pass).length }}/{{ cases.length }} pass)</button>
      <template v-if="show"><CaseResultRow v-for="c in cases" :key="c.id" :c="c" /></template>
      <h4>Try {{ currentAgent.name }}</h4><TryBox :key="currentAgent.name" :agent="currentAgent.name" />
    </div>
  </DebugFrame>
</template>
<style scoped>.sum { padding:8px; border-bottom:1px solid var(--line); } .rule { margin:2px 0; } h3,h4 { margin:6px 0; }</style>
