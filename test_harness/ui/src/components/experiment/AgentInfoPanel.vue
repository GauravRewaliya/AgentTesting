<script setup lang="ts">
import DebugFrame from "@/components/common/DebugFrame.vue";
// LEFT of the agent page: back to the caller (the master or the parent agent), and who this agent is
import type { Transcript } from "../../../shared/experiment";
defineProps<{ agent: string; tr: Transcript | null; backLabel: string; task: string }>();
const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <DebugFrame name="AgentInfoPanel" hint="experiment/AgentInfoPanel.vue" fill>
    <nav class="nav show">
    <button class="newbtn" @click="emit('back')">← Back to {{ backLabel }}</button>
    <h4>This agent</h4>
    <div class="card" :class="'s-' + (tr?.status ?? 'idle')">
      <div class="top"><span class="dot" :class="tr?.status" /><span class="nm">{{ agent }}</span><span class="st">{{ tr?.status ?? "…" }}</span></div>
      <div class="muted small mono">session {{ task }}</div>
      <div v-if="tr?.caller" class="muted small">called by {{ tr.caller }}</div>
    </div>
    <template v-if="tr?.brief?.objective"><h4>Brief it was given</h4><div class="txt small">{{ tr.brief.objective }}</div></template>
  </nav>
  </DebugFrame>
</template>

<style scoped src="./exp.css"></style>
