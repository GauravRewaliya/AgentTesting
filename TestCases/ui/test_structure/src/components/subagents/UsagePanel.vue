<script setup lang="ts">
// Who depends on this response: read before you remove or change it.
import { state } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ id: string }>();
const u = () => state.usage[props.id];
</script>
<template>
  <DebugFrame name="UsagePanel">
    <div v-if="u()" class="us">
      <div v-if="u()!.orphan" class="warn">No case lists this response and none was served by it: safe cleanup candidate.</div>
      <div v-else class="warn bad">Removing or changing this affects {{ new Set([...u()!.expectedBy.map((x) => x.caseId), ...u()!.servedIn.map((x) => x.caseId)]).size }} case(s).</div>
      <h5>Cases that expect it ({{ u()!.expectedBy.length }})</h5>
      <div v-for="x in u()!.expectedBy" :key="x.caseId + x.turn"><router-link :to="{ name: 'test', params: { caseId: x.caseId } }">{{ x.caseId }}</router-link> <span class="muted">turn {{ x.turn }} · {{ x.suite }}</span></div>
      <div v-if="!u()!.expectedBy.length" class="muted">none</div>
      <h5>Cases it really answered ({{ u()!.servedIn.length }})</h5>
      <div v-for="x in u()!.servedIn" :key="x.caseId"><router-link :to="{ name: 'test', params: { caseId: x.caseId } }">{{ x.caseId }}</router-link> <span class="muted">{{ x.times }}×, from .state sessions</span></div>
      <div v-if="!u()!.servedIn.length" class="muted">none recorded</div>
      <template v-if="u()!.sharedStore.length"><h5>Shares store files</h5>
        <div v-for="x in u()!.sharedStore" :key="x.store"><code>{{ x.store }}</code> <span class="muted">also copied by</span> {{ x.with.join(", ") }}</div></template>
      <template v-if="u()!.agentCases.length"><h5>Looser: cases that give work to this agent type ({{ u()!.agentCases.length }})</h5><div class="muted mono">{{ u()!.agentCases.join(", ") }}</div></template>
    </div>
  </DebugFrame>
</template>
<style scoped>.us { margin:10px 0; padding:8px; border:1px solid var(--line); border-radius:8px; background:var(--card); } h5 { margin:8px 0 2px; } .warn { color:var(--pass); font-weight:600; } .bad { color:var(--warn); }</style>
