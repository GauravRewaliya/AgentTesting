<script setup lang="ts">
// ONE collapsible block above a reply: everything the agent did before it (thoughts, tool calls, sub-agent calls).
// Collapsed it reads "Worked · 2 thoughts · 5 tools · 1 sub-agent call"; open it shows the timeline (ConvSteps), where each tool group and each call expands again.
import { computed, ref, watch } from "vue";
import DebugFrame from "@/components/common/DebugFrame.vue";
import ConvSteps from "./ConvSteps.vue";
import type { TranscriptStep } from "../../../shared/experiment";

const props = defineProps<{ steps: TranscriptStep[]; agentName: string; active?: boolean }>();
const emit = defineEmits<{ openAgent: [id: string] }>();
const thoughts = computed(() => props.steps.filter((s) => s.kind === "thinking").length);
const isCall = (s: TranscriptStep) => (!!s.calls && s.calls !== "?") || !!s.spawned?.length;
const tools = computed(() => props.steps.filter((s) => s.kind === "tool" && !isCall(s)).length);
const subs = computed(() => props.steps.reduce((n, s) => n + (s.kind !== "tool" ? 0 : s.spawned?.length ?? (s.calls && s.calls !== "?" ? 1 : 0)), 0));
const failed = computed(() => props.steps.some((s) => s.isError));
const running = computed(() => !!props.active && props.steps.some((s) => s.kind === "tool" && s.result === undefined));
const open = ref(false);
watch(running, (r) => { if (r) open.value = true; }, { immediate: true });   // follow what is happening now; a finished block stays as the reader left it
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
</script>

<template>
  <DebugFrame name="ActivityBlock" hint="experiment/ActivityBlock.vue">
    <div class="ab">
      <button class="hd" :aria-expanded="open" @click="open = !open">
        <span class="car">{{ open ? "▾" : "▸" }}</span><span class="sdot" :class="failed ? 'failed' : running ? 'running' : 'done'" />
        <span class="ttl">{{ running ? "Working" : "Worked" }}</span>
        <span class="muted small ell"><template v-if="thoughts">{{ plural(thoughts, "thought") }}</template><template v-if="thoughts && (tools || subs)"> · </template><template v-if="tools">{{ plural(tools, "tool") }}</template><template v-if="tools && subs"> · </template><template v-if="subs">{{ plural(subs, "sub-agent call") }}</template></span>
      </button>
      <div v-if="open" class="in"><ConvSteps :steps="steps" :agent-name="agentName" :active="active" @open-agent="emit('openAgent', $event)" /></div>
    </div>
  </DebugFrame>
</template>

<style scoped>
.hd { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border-radius: 9px; cursor: pointer; color: var(--mute); font-size: 13px; }
.hd:hover, .hd:focus-visible { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.car { width: 12px; font-size: 11px; } .ttl { font-weight: 600; color: var(--ink); } .small { font-size: 12px; } .ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.sdot { width: 8px; height: 8px; border-radius: 50%; background: var(--pass); flex: none; } .sdot.running { background: var(--accent); animation: pulse 1.2s infinite; } .sdot.failed { background: var(--fail); } @keyframes pulse { 50% { opacity: .3; } }
.in { margin: 4px 0 0 14px; padding-left: 10px; border-left: 2px solid var(--line); }
</style>
