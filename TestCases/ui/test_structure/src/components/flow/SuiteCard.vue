<script setup lang="ts">
// Vue Flow custom node: one card per suite. data = SuiteGroup.
import { Handle, Position } from "@vue-flow/core";
import type { SuiteGroup } from "@/types";
import { isOpen, toggleGroup } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import CaseRow from "./CaseRow.vue";
defineProps<{ data: SuiteGroup }>();
</script>
<template>
  <DebugFrame name="SuiteCard (vue-flow node)" :hint="data.id">
    <div class="card">
      <Handle type="target" :position="Position.Left" />
      <div class="title nodrag" @click="toggleGroup(data.id)">
        <span>{{ isOpen(data.id) ? "▾" : "▸" }}</span><strong>{{ data.title }}</strong>
        <span class="muted mono">{{ data.cases.length }} cases</span>
        <span class="tags"><code v-for="t in data.tags" :key="t">{{ t }}</code></span>
      </div>
      <template v-if="isOpen(data.id)"><CaseRow v-for="c in data.cases" :key="c.caseId" :row="c" /></template>
      <Handle type="source" :position="Position.Right" />
    </div>
  </DebugFrame>
</template>
<style scoped>
.card { width:380px; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.title { display:flex; gap:8px; align-items:center; padding:8px 10px; cursor:pointer; background:color-mix(in srgb, var(--accent) 8%, var(--card)); }
.tags { margin-left:auto; display:flex; gap:4px; } .tags code { border:1px solid var(--line); border-radius:4px; padding:0 4px; }
</style>
