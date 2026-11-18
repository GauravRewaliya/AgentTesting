<script setup lang="ts">
// MIDDLE: new-session setup, the conversation with the master (messages + the master's own thoughts and tool groups, in time order), and the composer
import { computed, nextTick, reactive, ref, watch } from "vue";
import { api } from "@/store/api";
import { useLive } from "@/store/live";
import ActivityBlock from "./ActivityBlock.vue";
import DebugFrame from "@/components/common/DebugFrame.vue";
import { hm } from "./fmt";
import type { AvailableAgent, ChatOut, ExperimentOverview, LiveSession, Transcript, TranscriptStep } from "../../../shared/experiment";

// agentId: show THAT sub-agent instead of the master (same panel; `chat` then holds its brief and report); readonly hides the composer; active overrides "the master is working"
const props = defineProps<{ session: LiveSession | null; creating: boolean; chat: ChatOut | null; avail: AvailableAgent[]; ov: ExperimentOverview | null; agentId?: string; readonly?: boolean; active?: boolean }>();
const emit = defineEmits<{ sent: [task: string]; say: [msg: string]; stop: []; openAgent: [id: string]; kick: [] }>();

const picked = reactive(new Set<string>()), fake = ref(false), caseId = ref(""), text = ref(""), sending = ref(false), showTools = ref(true);
for (const a of props.avail) if (a.byDefault) picked.add(a.name);
watch(() => props.avail, (l) => { if (!picked.size) for (const a of l) if (a.byDefault) picked.add(a.name); });
const allCases = computed(() => (props.ov?.suites ?? []).flatMap((s) => s.cases.map((c) => ({ ...c, suite: s.suite }))));
const caseOf = (id?: string) => allCases.value.find((c) => c.id === id);
const activeCase = computed(() => caseOf(props.creating ? caseId.value : props.session?.case));
const nextPrompt = computed(() => { const c = activeCase.value; if (!c) return ""; const n = props.creating ? 0 : (props.chat?.nextTurn ?? 0); return c.prompts[n] ?? ""; });
watch(caseId, (id) => { const c = caseOf(id); if (!c) return; text.value = c.prompts[0] ?? ""; picked.clear(); for (const a of c.agents.concat(c.distractors)) if (props.avail.some((x) => x.name === a)) picked.add(a); });

// the shown agent's own transcript (thoughts + tool groups), pushed over the websocket (the page tells the hub which agent to watch)
const live = useLive();
const tr = computed<Transcript | null>(() => { const t = live.transcript.value; return t && !("error" in t) ? t : null; });
const talk = computed(() => tr.value?.talk), agentFake = computed(() => !!tr.value?.fake);
const working = computed(() => props.active ?? props.session?.state === "working");

type Block = { key: string; msg?: ChatOut["messages"][number]; steps?: TranscriptStep[]; reply?: TranscriptStep };
const blocks = computed<Block[]>(() => {
  const marks = (tr.value?.marks ?? []).map((m) => ({ id: "mk" + m.t, from: "user" as const, text: "⏹ " + m.text, t: m.t, auto: true }));   // e.g. "Interrupted by user"
  const msgs = [...(props.chat?.messages ?? []), ...marks].sort((a, b) => a.t - b.t), steps = showTools.value ? (tr.value?.steps ?? []).filter((s) => s.kind !== "user") : [];
  const out: Block[] = []; let from = -Infinity;
  // work between two messages = ONE block (thoughts + tools); the master's closing words of that turn are a normal reply right under it, not hidden inside the block
  const seg = (to: number, k: string) => {
    const said = (s: TranscriptStep) => msgs.some((m) => m.from === "lead" && m.text.trim().slice(0, 60) === s.text.trim().slice(0, 60));   // the same words already arrived as a chat message
    const part = steps.filter((s) => s.t >= from && s.t < to && !(s.kind === "text" && said(s))); let end = part.length;
    while (end > 0 && part[end - 1]!.kind === "text") end--;
    if (end) out.push({ key: k, steps: part.slice(0, end) });
    part.slice(end).forEach((s, i) => out.push({ key: k + "r" + i, reply: s }));
  };
  for (const m of msgs) { seg(m.t, "s" + m.id); out.push({ key: "m" + m.id, msg: m }); from = m.t; }
  seg(Infinity, "tail");
  return out;
});

const msgsEl = ref<HTMLElement>();
// follow new content only while the reader is already at the bottom; scrolled up = leave the view alone. Opening a session and sending a message always jump down.
let stick = true;
const onScroll = () => { const el = msgsEl.value; if (el) stick = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
const scrollDown = (force = false) => void nextTick(() => { const el = msgsEl.value; if (el && (force === true || stick)) el.scrollTop = el.scrollHeight; });
watch(() => [props.chat?.messages.length, tr.value?.steps.length], () => scrollDown());
watch(() => props.session?.task, () => { stick = true; scrollDown(true); });

async function send() {
  const t = text.value.trim(); if (!t || sending.value) return;
  sending.value = true;
  try {
    const c = activeCase.value, usesCase = !!c && t === nextPrompt.value.trim();   // the case is only judged when the message IS the case's prompt
    if (props.agentId) {   // a sub-agent: the message goes to THAT agent (a note while it works, a resume call when it is idle)
      const r = await api.expTalk({ task: props.session!.task, agent: props.agentId, text: t });
      if (!r.ok) { emit("say", "not sent: " + (r.reason ?? "refused")); return; }
      text.value = ""; emit("say", r.mode === "note" ? `${props.agentId} is working: your message was left as a note it reads at its next step` : `sent to ${props.agentId}; its answer appears here`); emit("kick"); scrollDown(true); return;
    }
    const r = await api.expSend(props.creating || !props.session
      ? { text: t, agents: [...picked], fake: fake.value, ...(usesCase ? { caseId: c!.id, suite: (c as { suite?: string }).suite } : {}) }
      : { task: props.session.task, text: t, agents: [], fake: false });
    text.value = ""; if (props.creating) caseId.value = ""; emit("sent", r.task); scrollDown(true);
  } catch (e) { emit("say", "send failed: " + (e as Error).message); } finally { sending.value = false; }
}
const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); } };
async function cancel(id: string) { if (props.session) { await api.expCancel(props.session.task, id); emit("kick"); } }
</script>

<template>
  <DebugFrame name="ChatPanel" hint="experiment/ChatPanel.vue" fill>
    <section class="chatcol">
    <div v-if="creating || !session" class="setup">
      <h4>Sub-agents the master may call</h4>
      <div class="agents">
        <label v-for="a in avail" :key="a.name" class="ag" :class="{ on: picked.has(a.name) }" :title="a.description">
          <input type="checkbox" :checked="picked.has(a.name)" @change="picked.has(a.name) ? picked.delete(a.name) : picked.add(a.name)" />
          <span class="tag" :class="'t-' + a.name">{{ a.name }}</span><span v-if="a.writes" class="muted small">writes</span>
        </label>
      </div>
      <div class="muted small">{{ picked.size ? picked.size + " selected" : "none selected: the master works without sub-agents" }}</div>
      <div class="row">
        <label class="opt"><input v-model="fake" type="checkbox" /> fake runner <span class="muted small">no model calls</span></label>
        <select v-model="caseId" class="casesel"><option value="">Test case (optional)</option>
          <optgroup v-for="s in ov?.suites ?? []" :key="s.suite" :label="`${s.group} › ${s.suite}`" :title="s.about"><option v-for="c in s.cases" :key="c.id" :value="c.id" :disabled="!!c.unsupported">{{ c.id }}{{ c.unsupported ? " (not runnable here)" : "" }}</option></optgroup>
        </select>
      </div>
      <div v-if="activeCase" class="muted small casebox"><b>{{ activeCase.id }}</b> · {{ activeCase.title }}<br>{{ activeCase.turns }} turn(s) · agents {{ activeCase.agents.join(", ") }}<template v-if="activeCase.distractors.length"> · distractor {{ activeCase.distractors.join(", ") }}</template></div>
      <p v-else class="muted small">Write a message to the master below. It plans, calls the sub-agents above and reports back.</p>
    </div>

    <div v-else ref="msgsEl" class="msgs" @scroll.passive="onScroll">
      <label class="tgl small muted"><input v-model="showTools" type="checkbox" /> show the master's thoughts and tool calls</label>
      <p v-if="!chat?.messages.length && !chat?.queued.length && !blocks.length" class="muted small">No messages yet.</p>
      <template v-for="b in blocks" :key="b.key">
        <div v-if="b.msg?.auto" class="sys">⏱ {{ b.msg.text }} <span class="muted">{{ hm(b.msg.t) }}</span></div>
        <div v-else-if="b.reply" class="msg lead"><div class="bubble">{{ b.reply.text }}<div class="ts">master {{ hm(b.reply.t) }}</div></div></div>
        <div v-else-if="b.msg" class="msg" :class="b.msg.from"><div class="bubble">{{ b.msg.text }}<div class="ts">{{ b.msg.from === "user" ? "sent" : "received" }} {{ hm(b.msg.t) }}</div></div></div>
        <div v-else class="act"><ActivityBlock :active="working && b.key === 'tail'" :steps="b.steps!" :agent-name="agentId ?? 'master'" @open-agent="emit('openAgent', $event)" /></div>
      </template>
      <div v-if="readonly" />
      <div v-else-if="session.state === 'working'" class="strip"><span class="tag t-master">MASTER</span> {{ session.master?.activity || "working" }}…</div>
      <div v-else-if="session.state === 'stalled'" class="warn small note">The master process is gone but the session never finished its turn. Send a message to continue, or delete the session.</div>
      <div v-else-if="session.state === 'running'" class="muted small note">{{ session.agents.filter((a) => a.status === "running").length }} sub-agent(s) still working — the master is free, you can message it</div>
      <div v-for="m in chat?.queued ?? []" :key="m.id" class="msg user queued"><div class="bubble"><span class="lbl">queued · waits for the master <a href="#" @click.prevent="cancel(m.id)">cancel</a></span>{{ m.text }}</div></div>
      <div v-if="chat?.error" class="warn small">last turn failed: {{ chat.error }}</div>
    </div>

    <p v-if="talk?.error" class="warn small note ro">not answered: {{ talk.error }}</p>
    <p v-else-if="agentId && agentFake" class="muted small note ro">Fake runner: a message to this agent is answered from its recorded fixture session (no model call). With no recorded answer for it you get an error here.</p>
    <form class="composer" @submit.prevent="send">
      <div v-if="nextPrompt && text.trim() !== nextPrompt.trim()" class="try"><button type="button" @click="text = nextPrompt">use {{ activeCase?.id }} · turn {{ creating ? 1 : (chat?.nextTurn ?? 0) + 1 }} prompt</button></div>
      <div class="box"><textarea v-model="text" rows="2" :placeholder="agentId ? 'Message ' + agentId + '…' : creating || !session ? 'First message to the master agent…' : 'Message the master agent…'" @keydown="onKey" /><button v-if="!agentId && session && !creating && (session.state === 'working' || session.state === 'running')" class="stopbtn" type="button" aria-label="Stop" title="Stop the master and all its sub-agents (the chat is kept)" @click="emit('stop')">■</button><button class="go" type="submit" :disabled="!text.trim() || sending">{{ creating || !session ? "Start" : "Send" }}</button></div>
      <div v-if="!agentId && session && session.state === 'working'" class="muted small">The master is mid-turn: what you send goes into its inbox now and it reads it at its next step (a `wait` on sub-agents returns early for it). If the turn ends first, it becomes the next turn. The ■ button next to Send stops the master and all sub-agents now.</div>
    </form>
  </section>
  </DebugFrame>
</template>

<style scoped src="./exp.css"></style>
<style scoped>
.ro { margin: 8px 0 0; } .sys { text-align: center; font-size: 12px; color: var(--mute); margin: 0 0 10px; } .act { margin: 0 0 12px; } .tgl { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; } .tgl input { width: auto; }
</style>
