<script setup lang="ts">
// Vue Flow custom node: one card = one linear run of cases (a session chain), or a suite's standalone cases.
import { Handle, Position } from "@vue-flow/core";
import type { CardOut } from "@/types";
import { isOpen, toggleCard } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import CaseRow from "./CaseRow.vue";
const props = defineProps<{ data: CardOut }>();
const pass = () => props.data.cases.filter((c) => c.status === "pass").length;
</script>
<template>
  <DebugFrame :name="`ChainCard (${data.kind})`" :hint="data.id">
    <div class="card">
      <Handle type="target" :position="Position.Left" />
      <div class="title nodrag" @click="toggleCard(data)">
        <span>{{ isOpen(data) ? "▾" : "▸" }}</span>
        <strong>{{ data.title }}</strong>
        <code v-if="data.group" class="grp" :title="`group: ${data.group}`">{{ data.group }}</code>
        <span class="muted mono">{{ pass() }}/{{ data.cases.length }} pass</span>
      </div>
      <div v-if="data.branchedAt" class="branch mono nodrag">⑂ branches from <b>{{ data.branchedAt }}</b>'s session</div>
      <template v-if="isOpen(data)"><CaseRow v-for="c in data.cases" :key="c.caseId" :row="c" /></template>
      <Handle type="source" :position="Position.Right" />
    </div>
  </DebugFrame>
</template>
<style scoped>
.card { width:400px; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.title { display:flex; gap:8px; align-items:center; padding:8px 10px; cursor:pointer; background:color-mix(in srgb, var(--accent) 8%, var(--card)); } .title .muted { margin-left:auto; }
.grp { border:1px solid var(--line); border-radius:4px; padding:0 4px; font-size:11px; color:var(--muted); }
.branch { padding:2px 10px; font-size:11px; color:var(--warn); background:color-mix(in srgb, var(--warn) 10%, transparent); }
</style>
