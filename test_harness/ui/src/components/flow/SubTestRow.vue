<script setup lang="ts">
import type { SubTestRow } from "@/types";
import { openAgent } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
defineProps<{ row: SubTestRow }>();
// "session:writer#1" -> agent "writer"; a recorded result id has no agent name, so it is shown as plain text
const agentOf = (e: string) => (e.startsWith("session:") ? e.slice(8).split("#")[0] : null);
</script>
<template>
  <DebugFrame name="SubTestRow">
    <div class="sub nodrag">
      <span class="tree">└</span><span class="t">{{ row.title }}</span>
      <span v-if="row.match === true" style="color:var(--pass)">✓</span><span v-else-if="row.match === false" style="color:var(--fail)">✗</span>
      <span class="exp">
        <template v-for="e in row.expectedAgents" :key="e">
          <button v-if="agentOf(e)" class="chip" @click.stop="openAgent(agentOf(e)!)">{{ e }}</button>
          <code v-else class="chip plain">{{ e }}</code>
        </template>
      </span>
    </div>
  </DebugFrame>
</template>
<style scoped>
.sub { display:flex; gap:6px; align-items:center; padding:2px 0 2px 22px; font-size:12px; flex-wrap:wrap; }
.tree { color:var(--mute); } .t { color:var(--mute); }
.exp { display:inline-flex; gap:4px; margin-left:auto; }
.chip { font:11px ui-monospace,monospace; padding:0 6px; border-radius:4px; } .plain { border:1px dashed var(--line); color:var(--mute); }
</style>
