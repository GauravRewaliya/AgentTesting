<script setup lang="ts">
// MULTI / SOLO, plus P (more than one prompt) and S (more than one session). Hover for the reason.
import type { CaseProfile } from "@/types";
defineProps<{ p: CaseProfile }>();
</script>
<template>
  <span class="pb">
    <span class="m" :class="p.agentMode" :title="p.agentMode === 'multi' ? `lead hands work to: ${p.subAgents.join(', ')}` : p.noDelegate ? 'multi-agent setup, but this case expects NO delegation' : 'the lead works alone'">{{ p.agentMode === "multi" ? "MULTI" : "SOLO" }}<template v-if="p.agentMode === 'multi'"> {{ p.subAgents.length }}</template></span>
    <span v-if="p.multiPrompt" class="f" title="more than one user prompt">P</span>
    <span v-if="p.multiSession" class="f" title="continues a session, follows up a sub-agent, or opens 2+ sub-agent sessions">S</span>
  </span>
</template>
<style scoped>
.pb { display:inline-flex; gap:3px; vertical-align:middle; } .pb span { font:700 10px/14px ui-monospace,monospace; padding:0 4px; border-radius:3px; }
.multi { background:color-mix(in srgb, var(--accent) 22%, transparent); color:var(--accent); } .solo { background:color-mix(in srgb, var(--warn) 22%, transparent); color:var(--warn); }
.f { background:color-mix(in srgb, var(--mute) 25%, transparent); color:var(--ink); }
</style>
