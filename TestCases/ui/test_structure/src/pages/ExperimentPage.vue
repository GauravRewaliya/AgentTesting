<script setup lang="ts">
// Experiment page = three panels side by side, each its own component (src/components/experiment/):
//   LEFT   SessionsNav     master sessions list
//   MIDDLE SessionHeader + ChatPanel   state / bg running / stop, then the chat with the master (messages, thoughts, tool groups)
//   RIGHT  AgentSidePanel  master + sub-agent cards; a click opens that agent's conversation page (/experiment/agent)
// This file only holds what the panels share: the live data, the selected session (kept in ?session= so Back returns here) and the actions.
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "@/store/api";
import { useLive } from "@/store/live";
import DebugFrame from "@/components/common/DebugFrame.vue";
import SessionsNav from "@/components/experiment/SessionsNav.vue";
import SessionHeader from "@/components/experiment/SessionHeader.vue";
import ChatPanel from "@/components/experiment/ChatPanel.vue";
import BugTracker from "@/components/experiment/BugTracker.vue";
import Evidence from "@/components/experiment/Evidence.vue";
import AgentSidePanel from "@/components/experiment/AgentSidePanel.vue";
import type { AvailableAgent, LiveSession } from "../../shared/experiment";

const route = useRoute(), router = useRouter();
let wantCase = typeof route.query.case === "string" ? route.query.case : "";   // from a Runs link: open that case's session
const live = useLive(), { ov, sessions, chat, result, bg, bugs, evidence, detail } = live;
const avail = ref<AvailableAgent[]>([]), err = ref(""), notice = ref("");
const initial = typeof route.query.session === "string" ? route.query.session : null;
const sel = ref<string | null>(initial), creating = ref(!initial), navOpen = ref(false);
const say = (m: string) => { notice.value = m; setTimeout(() => { if (notice.value === m) notice.value = ""; }, 8000); };
const now = ref(Date.now()), clock = setInterval(() => (now.value = Date.now()), 15_000);

const session = computed(() => sessions.value.find((s) => s.task === sel.value) ?? null);
// tell the server what this page looks at: the session, and its master (for the process list)
watch([sel, creating, () => session.value?.master?.id], () => live.watch({ task: creating.value ? undefined : sel.value ?? undefined, detail: creating.value ? undefined : session.value?.master?.id, transcript: creating.value ? undefined : session.value?.master?.id }), { immediate: true });
const processes = computed(() => { const d = detail.value; return d && !("error" in d) ? d.processes : []; });
const setUrl = (t: string | null) => router.replace({ path: "/experiment", query: t ? { session: t } : {} });

type Kind = "experiment" | "test";
const kind = ref<Kind>((() => { try { return localStorage.getItem("exp_kind") === "test" ? "test" : "experiment"; } catch { return "experiment"; } })());
const setKind = (k: Kind) => { kind.value = k; try { localStorage.setItem("exp_kind", k); } catch { /* private mode */ } };
const counts = computed(() => ({ experiment: sessions.value.filter((s) => s.kind === "experiment").length, test: sessions.value.filter((s) => s.kind === "test").length }));
const shown = computed(() => sessions.value.filter((s) => s.kind === kind.value));

const seen = new Set<string>();   // a session that was listed and is gone now was deleted elsewhere; one not listed yet is just new
watch(sessions, (list) => {
  list.forEach((x) => seen.add(x.task));
  if (wantCase) {
    const w = list.filter((x) => x.case === wantCase).sort((a, b) => (b.last ?? 0) - (a.last ?? 0))[0];
    if (w) { open(w.task); say(`opened session of ${wantCase}`); } else say(`no Experiment session exists for ${wantCase} yet (the UI run does not create one): pick it in ＋ New session > Test case`);
    wantCase = "";
  }
  if (sel.value && seen.has(sel.value) && !list.some((s) => s.task === sel.value)) { sel.value = null; creating.value = true; setUrl(null); }
});
onMounted(async () => { live.start(); try { avail.value = await api.expAgents(); } catch (e) { err.value = (e as Error).message; } });
onUnmounted(() => { live.stop(); clearInterval(clock); });

const open = (t: string) => { sel.value = t; creating.value = false; navOpen.value = false; setUrl(t); };
const newSession = () => { sel.value = null; creating.value = true; setKind("experiment"); navOpen.value = false; setUrl(null); };
const openAgent = (id: string) => router.push({ path: "/experiment/agent", query: { session: sel.value!, agent: id } });
async function del(s: LiveSession) {
  if (!confirm(`Delete session "${s.case ?? s.task}" (${s.task})?\n\nThis stops it and permanently removes the master, all ${s.agents.length} sub-agent(s), chat, reports, archived logs and the Claude transcripts. It cannot be undone.`)) return;
  try { await api.expDelete(s.task); if (sel.value === s.task) newSession(); say(`session ${s.task} deleted`); live.kick(); }
  catch (e) { say("delete failed: " + (e as Error).message); }
}
async function stopSession() {
  if (!sel.value || !confirm("Stop this session? The master's turn and all its sub-agents are killed and queued messages are dropped. The chat is kept; send a message to continue.")) return;
  try { const r = await api.expStopSession(sel.value); say(`stopped: ${r.killed} process(es) killed, ${r.dropped} queued message(s) dropped`); } catch (e) { say("stop failed: " + (e as Error).message); }
}
async function stopProc(pid: number) { try { const r = await api.procStop(sel.value!, pid); if (!r.ok) say(r.reason ?? "failed"); } catch (e) { say((e as Error).message); } }
const sent = (task: string) => { if (creating.value) open(task); live.kick(); };
</script>

<template>
  <DebugFrame name="ExperimentPage">
    <div v-if="err" class="alert">API: {{ err }}</div>
    <div v-if="notice" class="alert info">{{ notice }}</div>
    <div class="shell">
      <button class="navtgl" @click="navOpen = !navOpen">☰ Sessions ({{ shown.length }})</button>
      <SessionsNav :sessions="shown" :sel="sel" :creating="creating" :kind="kind" :counts="counts" :show="navOpen" :now="now" @new="newSession" @open="open" @del="del" @kind="setKind" />
      <main class="main">
        <h3 v-if="creating || !session">New session</h3>
        <SessionHeader v-else :session="session" :bg="bg" @stop="stopSession" @del="del(session!)" @error="say" />
        <BugTracker v-if="session && !creating" :bugs="bugs" @open-agent="openAgent" />
        <Evidence v-if="session && !creating" :evidence="evidence" />
        <div class="work">
          <ChatPanel :session="session" :creating="creating" :chat="chat" :avail="avail" :ov="ov" @sent="sent" @say="say" @stop="stopSession" @open-agent="openAgent" @kick="live.kick" />
          <AgentSidePanel v-if="session && !creating" :session="session" :result="result" :processes="processes" :now="now" @open-agent="openAgent" @stop-proc="stopProc" />
        </div>
      </main>
    </div>
  </DebugFrame>
</template>

<style scoped src="@/components/experiment/exp.css"></style>
