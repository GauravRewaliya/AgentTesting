<script setup lang="ts">
// A sub-agent seen exactly like the master: LEFT back + who it is | MIDDLE its conversation (brief, thoughts, tool groups, report) | RIGHT the sub-agents it called.
// /experiment/agent?session=<master session>&agent=<agent id>. Clicking a sub-agent on the right (or "Open ..." on a call) opens that one the same way.
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useLive } from "@/store/live";
import DebugFrame from "@/components/common/DebugFrame.vue";
import AgentInfoPanel from "@/components/experiment/AgentInfoPanel.vue";
import ChatPanel from "@/components/experiment/ChatPanel.vue";
import AgentSidePanel from "@/components/experiment/AgentSidePanel.vue";
import type { ChatOut, Transcript } from "../../shared/experiment";

const route = useRoute(), router = useRouter(), live = useLive(), { sessions, ov } = live;
const task = computed(() => String(route.query.session ?? "")), agent = computed(() => String(route.query.agent ?? ""));
const session = computed(() => sessions.value.find((s) => s.task === task.value) ?? null);
const tr = computed<Transcript | null>(() => { const t = live.transcript.value; return t && !("error" in t) ? t : null; });
const err = computed(() => { const t = live.transcript.value; return t && "error" in t ? t.error : ""; });
const now = ref(Date.now()), clock = setInterval(() => (now.value = Date.now()), 15_000);
// everything arrives over the websocket: tell the hub which session and agent this page shows
watch([task, agent], () => live.watch({ task: task.value, transcript: agent.value }), { immediate: true });
onMounted(() => live.start());
onUnmounted(() => { live.stop(); clearInterval(clock); });

// the middle panel's "chat": what the caller asked (brief) and what this agent answered (report); its thoughts and tool groups come from its transcript
const chat = computed<ChatOut>(() => {
  const t = tr.value, messages: ChatOut["messages"] = [];
  for (const [i, m] of (t?.inbox ?? []).entries()) {
    messages.push({ id: "in" + i, from: "user", text: m.note ? `You (note):\n\n${m.text}` : `From ${m.from}:\n\n${m.text}`, t: m.t });
    if (m.answer) messages.push({ id: "out" + i, from: "lead", text: m.answer, t: t!.inbox[i + 1] ? t!.inbox[i + 1]!.t - 1 : Math.max(m.t + 1, t!.steps[t!.steps.length - 1]?.t ?? 0) + 1 });
  }
  return { task: task.value, messages, queued: [], busy: false, error: "", nextTurn: null };
});

const isMasterCaller = computed(() => !tr.value?.caller || tr.value.caller.startsWith("lead"));
const backLabel = computed(() => (isMasterCaller.value ? "master" : tr.value!.caller!));
const back = () => router.push(isMasterCaller.value ? { path: "/experiment", query: { session: task.value } } : { path: "/experiment/agent", query: { session: task.value, agent: tr.value!.caller! } });
const openAgent = (id: string) => router.push({ path: "/experiment/agent", query: { session: task.value, agent: id } });
</script>

<template>
  <DebugFrame name="AgentPage">
    <div v-if="err" class="alert">API: {{ err }}</div>
    <div class="shell">
      <AgentInfoPanel :agent="agent" :tr="tr" :back-label="backLabel" :task="task" @back="back" />
      <main class="main">
        <h3>{{ agent }} <span class="muted small">{{ tr?.status }}</span></h3>
        <div class="work">
          <ChatPanel :session="session" :creating="false" :chat="chat" :avail="[]" :ov="ov" :agent-id="agent" :active="tr?.status === 'running'" @open-agent="openAgent" />
          <AgentSidePanel v-if="session" :session="session" :result="null" :processes="[]" :now="now" :focus="agent" @open-agent="openAgent" />
        </div>
      </main>
    </div>
  </DebugFrame>
</template>

<style scoped src="@/components/experiment/exp.css"></style>
