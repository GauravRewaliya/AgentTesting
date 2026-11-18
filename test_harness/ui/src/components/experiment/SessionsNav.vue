<script setup lang="ts">
import DebugFrame from "@/components/common/DebugFrame.vue";
// LEFT: master sessions list (＋ New session, Experiment/Test filter, ⋮ delete)
import { onMounted, onUnmounted, ref } from "vue";
import type { LiveSession } from "../../../shared/experiment";
import { agoOf, dur } from "./fmt";

type Kind = "experiment" | "test";
defineProps<{ sessions: LiveSession[]; sel: string | null; creating: boolean; kind: Kind; counts: Record<Kind, number>; show: boolean; now: number }>();
const emit = defineEmits<{ new: []; open: [task: string]; del: [s: LiveSession]; kind: [k: Kind] }>();
const menu = ref<string | null>(null);
const close = () => (menu.value = null);
onMounted(() => document.addEventListener("click", close)); onUnmounted(() => document.removeEventListener("click", close));
</script>

<template>
  <DebugFrame name="SessionsNav" hint="experiment/SessionsNav.vue" fill>
    <nav class="nav" :class="{ show }">
    <button class="newbtn" :class="{ on: creating }" @click="emit('new')">＋ New session</button>
    <h4>Master sessions</h4>
    <div class="seg" role="tablist" aria-label="session kind">
      <button v-for="k in (['experiment', 'test'] as const)" :key="k" role="tab" :aria-selected="kind === k" :class="{ on: kind === k }" @click="emit('kind', k)">{{ k === "experiment" ? "Experiment" : "Test" }} <span class="n">{{ counts[k] }}</span></button>
    </div>
    <p v-if="!sessions.length" class="muted small">{{ kind === "experiment" ? "None yet. Use ＋ New session." : "No test runs yet (bun testrun/run.ts <suite>)." }}</p>
    <div v-for="s in sessions" :key="s.task" class="srw">
      <button class="srow" :class="{ on: s.task === sel && !creating }" @click="emit('open', s.task)">
        <div class="t1"><span class="dot" :class="s.state" /><span class="tt">{{ s.case ?? s.title }}</span></div>
        <div class="t2" :title="'last activity ' + agoOf(now, s.last)"><template v-if="s.activeMs !== undefined">active {{ dur(s.activeMs) }}<template v-if="s.state !== 'active'"> (working)</template> · </template>{{ s.agents.length }} sub-agent(s)<template v-if="s.fixtures"> · fixture ×{{ s.fixtures }}</template></div>
      </button>
      <button class="more" aria-label="session options" @click.stop="menu = menu === s.task ? null : s.task">⋮</button>
      <div v-if="menu === s.task" class="menu" @click.stop><button class="del" @click="close(); emit('del', s)">Delete session + sub-agents</button></div>
    </div>
  </nav>
  </DebugFrame>
</template>

<style scoped src="./exp.css"></style>
