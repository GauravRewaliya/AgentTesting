<script setup lang="ts">
// Vue Flow custom node: ONE test case. A follow-up always hangs below it: in at the top, out at the bottom.
import { Handle, Position } from "@vue-flow/core";
import type { CaseOut } from "@/types";
import { caseHeight, CARD_W } from "./size";
import DebugFrame from "@/components/common/DebugFrame.vue";
import CaseRow from "./CaseRow.vue";
defineProps<{ data: CaseOut }>();
</script>
<template>
  <DebugFrame name="CaseNode" :hint="data.caseId">
    <div class="node" :style="{ width: CARD_W + 'px', height: caseHeight(data) + 'px' }">
      <Handle id="t" type="target" :position="Position.Top" />
      <CaseRow :row="data" />
      <Handle id="b" type="source" :position="Position.Bottom" />
    </div>
  </DebugFrame>
</template>
<style scoped>.node { background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }</style>
