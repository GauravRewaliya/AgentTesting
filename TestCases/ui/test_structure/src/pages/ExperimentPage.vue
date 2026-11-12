<script setup lang="ts">
// Same idea as the f1 console: master sessions on the left (＋ New session, ⋮ delete); the chosen session shows the chat with its master and the sub-agent tree.
// ＋ New session: tick the sub-agents the master may call, write a message, Send. Picking a test case is optional: it only pre-fills the message and the agents, and lets the verdict judge the calls.
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/store/api";
import DebugFrame from "@/components/common/DebugFrame.vue";
import type { AvailableAgent, CaseResultOut, CaseState, ChatOut, ExpCase, ExperimentOverview, LiveAgent, LiveSession } from "../../shared/experiment";

const route = useRoute();
let wantCase = typeof route.query.case === "string" ? route.query.case : "";   // from a Runs link: open that case's session
const ov = ref<ExperimentOverview | null>(null), sessions = ref<LiveSession[]>([]), avail = ref<AvailableAgent[]>([]), err = ref(""), notice = ref("");
const sel = ref<string | null>(null), creating = ref(true), menu = ref<string | null>(null), navOpen = ref(false);
const picked = reactive(new Set<string>()), fake = ref(false), caseId = ref(""), text = ref(""), sending = ref(false);
const chat = ref<ChatOut | null>(null), result = ref<CaseResultOut | null>(null), resultErr = ref("");
const showResult = ref(true), expanded = reactive(new Set<string>());

const session = computed(() => sessions.value.find((s) => s.task === sel.value) ?? null);
const allCases = computed(() => (ov.value?.suites ?? []).flatMap((s) => s.cases.map((c) => ({ ...c, suite: s.suite }))));
const caseOf = (id?: string) => allCases.value.find((c) => c.id === id);
const color: Record<CaseState, string> = { pass: "var(--pass)", fail: "var(--fail)", partial: "var(--warn)", running: "var(--accent)", skipped: "var(--mute)", never_run: "var(--mute)" };
const ago = (t?: number) => { if (!t) return "-"; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + "s ago" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
const hm = (t: number) => new Date(t).toTimeString().slice(0, 8);
const usd = (n: number) => "$" + n.toFixed(4);
const say = (m: string) => { notice.value = m; setTimeout(() => { if (notice.value === m) notice.value = ""; }, 8000); };

// the case that goes with the composer: the chosen one (new session) or the one this session belongs to
const activeCase = computed(() => caseOf(creating.value ? caseId.value : session.value?.case));
const nextPrompt = computed(() => { const c = activeCase.value; if (!c) return ""; const n = creating.value ? 0 : (chat.value?.nextTurn ?? 0); return c.prompts[n] ?? ""; });

async function refresh() {
  try {
    err.value = ""; ov.value = await api.expOverview(); sessions.value = await api.expLive();
    if (wantCase) {
      const w = sessions.value.filter((x) => x.case === wantCase).sort((a, b) => (b.last ?? 0) - (a.last ?? 0))[0];
      if (w) { open(w.task); say(`opened session of ${wantCase}`); } else say(`no Experiment session exists for ${wantCase} yet (the UI run does not create one): pick it in ＋ New session > Test case`);
      wantCase = "";
    }
    if (!avail.value.length) { avail.value = await api.expAgents(); for (const a of avail.value) if (a.byDefault) picked.add(a.name); }
    if (sel.value && !sessions.value.some((s) => s.task === sel.value)) { sel.value = null; creating.value = true; chat.value = null; }
    if (sel.value) { const was = chat.value?.messages.length ?? 0; chat.value = await api.expChat(sel.value); if ((chat.value?.messages.length ?? 0) !== was) scrollDown(); }
    await loadResult();
  } catch (e) { err.value = (e as Error).message; }
}
async function loadResult() {
  const c = session.value?.case; if (!c) { result.value = null; resultErr.value = ""; return; }
  try { result.value = await api.expResult(c); resultErr.value = ""; } catch (e) { result.value = null; resultErr.value = (e as Error).message; }
}
const msgsEl = ref<HTMLElement>();
const scrollDown = () => nextTick(() => { const el = msgsEl.value; if (el) el.scrollTop = el.scrollHeight; });
let timer: ReturnType<typeof setInterval>;
const closeMenu = () => (menu.value = null);
onMounted(() => { refresh(); timer = setInterval(refresh, 1500); document.addEventListener("click", closeMenu); });
onUnmounted(() => { clearInterval(timer); document.removeEventListener("click", closeMenu); });
watch(sel, () => { chat.value = null; result.value = null; resultErr.value = ""; text.value = ""; refresh(); scrollDown(); });
watch(caseId, (id) => {   // optional: a test case fills the message and ticks the agents it needs
  const c = caseOf(id); if (!c) return;
  text.value = c.prompts[0] ?? ""; picked.clear(); for (const a of c.agents.concat(c.distractors)) if (avail.value.some((x) => x.name === a)) picked.add(a);
});

const open = (t: string) => { sel.value = t; creating.value = false; navOpen.value = false; };
const newSession = () => { sel.value = null; creating.value = true; navOpen.value = false; };
async function del(s: LiveSession) {
  menu.value = null;
  if (!confirm(`Delete session "${s.case ?? s.task}" (${s.task})?\n\nThis stops it and permanently removes the master, all ${s.agents.length} sub-agent(s), chat, reports, archived logs and the Claude transcripts. It cannot be undone.`)) return;
  try { await api.expDelete(s.task); if (sel.value === s.task) { sel.value = null; creating.value = true; } say(`session ${s.task} deleted`); await refresh(); }
  catch (e) { say("delete failed: " + (e as Error).message); }
}

async function send() {
  const t = text.value.trim(); if (!t || sending.value) return;
  sending.value = true;
  try {
    const c = activeCase.value, usesCase = !!c && t === nextPrompt.value.trim();   // the case is only judged when the message IS the case's prompt
    const r = await api.expSend(creating.value
      ? { text: t, agents: [...picked], fake: fake.value, ...(usesCase ? { caseId: c!.id, suite: (c as { suite?: string }).suite } : {}) }
      : { task: sel.value!, text: t, agents: [], fake: false });
    text.value = ""; if (creating.value) { caseId.value = ""; await refresh(); open(r.task); } else await refresh();
    scrollDown();
  } catch (e) { say("send failed: " + (e as Error).message); } finally { sending.value = false; }
}
const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
async function cancel(id: string) { if (sel.value) { await api.expCancel(sel.value, id); await refresh(); } }

type Node = { a: LiveAgent; d: number };
const tree = (s: LiveSession): Node[] => {
  const by = new Map<string, LiveAgent[]>(); for (const a of s.agents) by.set(a.caller ?? "", [...(by.get(a.caller ?? "") ?? []), a]);
  const ids = new Set(s.agents.map((a) => a.id)), out: Node[] = [];
  const walk = (a: LiveAgent, d: number) => { out.push({ a, d }); (by.get(a.id) ?? []).forEach((c) => walk(c, d + 1)); };
  s.agents.filter((a) => !a.caller || !ids.has(a.caller) || a.caller.startsWith("lead")).forEach((a) => walk(a, 0));
  return out;
};
</script>

<template>
  <DebugFrame name="ExperimentPage">
    <div v-if="err" class="alert">API: {{ err }}</div>
    <div v-if="notice" class="alert info">{{ notice }}</div>
    <div class="shell">
      <button class="navtgl" @click="navOpen = !navOpen">☰ Sessions ({{ sessions.length }})</button>
      <!-- master sessions -->
      <nav class="nav" :class="{ show: navOpen }">
        <button class="newbtn" :class="{ on: creating }" @click="newSession">＋ New session</button>
        <h4>Master sessions</h4>
        <p v-if="!sessions.length" class="muted small">None yet. Use ＋ New session to run a case.</p>
        <div v-for="s in sessions" :key="s.task" class="srw">
          <button class="srow" :class="{ on: s.task === sel && !creating }" @click="open(s.task)">
            <div class="t1"><span class="dot" :class="s.state" /><span class="tt">{{ s.case ?? s.title }}</span></div>
            <div class="t2">{{ ago(s.last) }} · {{ s.agents.length }} sub-agent(s)</div>
          </button>
          <button class="more" aria-label="session options" @click.stop="menu = menu === s.task ? null : s.task">⋮</button>
          <div v-if="menu === s.task" class="menu" @click.stop><button class="del" @click="del(s)">Delete session + sub-agents</button></div>
        </div>
      </nav>

      <main class="main">
        <h3 v-if="creating || !session">New session</h3>
        <div v-else class="sh"><span class="pill" :class="session.state"><span class="dot" :class="session.state" />{{ session.state }}</span><b>{{ session.case ?? "Master session" }}</b><span class="muted small mono">{{ session.task }}<template v-if="session.suite"> · {{ session.suite }}</template> · {{ session.fake ? "fake" : "real" }} · {{ usd(session.cost) }}</span><button class="danger sp" @click="del(session)">Delete</button></div>

        <div class="work">
          <!-- left of the work area: who is allowed, chat -->
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
                  <optgroup v-for="s in ov?.suites ?? []" :key="s.suite" :label="s.suite"><option v-for="c in s.cases" :key="c.id" :value="c.id" :disabled="!!c.unsupported">{{ c.id }}{{ c.unsupported ? " (not runnable here)" : "" }}</option></optgroup>
                </select>
              </div>
              <div v-if="activeCase" class="muted small casebox"><b>{{ activeCase.id }}</b> · {{ activeCase.title }}<br>{{ activeCase.turns }} turn(s) · agents {{ activeCase.agents.join(", ") }}<template v-if="activeCase.distractors.length"> · distractor {{ activeCase.distractors.join(", ") }}</template></div>
              <p v-else class="muted small">Write a message to the master below. It plans, calls the sub-agents above and reports back.</p>
            </div>

            <div v-else ref="msgsEl" class="msgs">
              <p v-if="!chat?.messages.length && !chat?.queued.length" class="muted small">No messages yet.</p>
              <div v-for="m in chat?.messages ?? []" :key="m.id" class="msg" :class="m.from"><div class="bubble">{{ m.text }}<div class="ts">{{ m.from === "user" ? "sent" : "received" }} {{ hm(m.t) }}</div></div></div>
              <div v-if="session.state === 'working'" class="strip"><span class="tag t-master">MASTER</span> {{ session.master?.activity || "working" }}…</div>
              <div v-else-if="session.state === 'stalled'" class="warn small note">The master process is gone but the session never finished its turn. Send a message to continue, or delete the session.</div>
              <div v-else-if="session.state === 'running'" class="muted small note">{{ session.agents.filter((a) => a.status === "running").length }} sub-agent(s) still working — the master is free, you can message it</div>
              <div v-for="m in chat?.queued ?? []" :key="m.id" class="msg user queued"><div class="bubble"><span class="lbl">queued · waits for the master <a href="#" @click.prevent="cancel(m.id)">cancel</a></span>{{ m.text }}</div></div>
              <div v-if="chat?.error" class="warn small">last turn failed: {{ chat.error }}</div>
            </div>

            <form class="composer" @submit.prevent="send">
              <div v-if="nextPrompt && text.trim() !== nextPrompt.trim()" class="try"><button type="button" @click="text = nextPrompt">use {{ activeCase?.id }} · turn {{ creating ? 1 : (chat?.nextTurn ?? 0) + 1 }} prompt</button></div>
              <div class="box"><textarea v-model="text" rows="2" :placeholder="creating || !session ? 'First message to the master agent…' : 'Message the master agent…'" @keydown="onKey" /><button class="go" type="submit" :disabled="!text.trim() || sending">{{ creating || !session ? "Start" : "Send" }}</button></div>
              <div v-if="session && session.state === 'working'" class="muted small">The master is busy: what you send waits in the queue and is read when it finishes.</div>
            </form>
          </section>

          <!-- right: master + sub-agents -->
          <aside v-if="session && !creating" class="side">
            <h4>Master agent</h4>
            <div v-if="session.master" class="card" :class="'s-' + session.master.status">
              <div class="top"><span class="tag t-master">MASTER</span><span class="nm">{{ session.master.id }}</span><span class="st">{{ session.master.status }}</span></div>
              <div class="muted small">{{ session.master.activity || "idle" }}</div>
              <div class="muted small mono">{{ session.master.runs }} turn(s) · {{ usd(session.master.cost) }} incl. sub-agents · {{ ago(session.master.lastEventAt) }}</div>
            </div>
            <p v-else class="muted small">The master has not started yet.</p>
            <div class="muted small">may call: {{ session.agentsAllowed.join(", ") || "nobody" }}</div>

            <h4>Sub-agent sessions <span class="muted small">{{ session.agents.length }}</span></h4>
            <p v-if="!session.agents.length" class="muted small">No sub-agents yet. The master starts them when the task needs them.</p>
            <div v-for="{ a, d } in tree(session)" :key="a.id" class="card sub" :class="'s-' + (a.needsParent ? 'stalled' : a.status)" :style="{ marginLeft: Math.min(d, 3) * 14 + 'px' }">
              <div class="top"><span class="dot" :class="a.needsParent ? 'stalled' : a.status" /><span class="tag" :class="'t-' + a.name">{{ a.name.toUpperCase() }}</span><span v-if="a.fixture" class="tag" title="answer served from agent_fixture, no model ran">FIXTURE</span><span class="nm">{{ a.title }}</span><span class="st">{{ a.needsParent ? "waiting for parent" : a.status }}</span></div>
              <div v-if="a.activity" class="muted small mono">▸ {{ a.activity }}</div>
              <div v-if="a.needsParent" class="warn small">asked: {{ a.needsParent.split("\n")[0] }}</div>
              <div class="muted small mono">{{ a.id }} · L{{ a.level }} · {{ a.runs }} run(s) · {{ usd(a.cost) }} · {{ ago(a.lastEventAt) }}</div>
            </div>

            <template v-if="session.case">
              <h4 class="clk" @click="showResult = !showResult">{{ showResult ? "▾" : "▸" }} Verdict · {{ session.case }}<span v-if="result" :style="{ color: color[result.state] }"> · {{ result.state }} · {{ result.done }}/{{ result.total }}</span></h4>
              <template v-if="showResult">
                <p v-if="resultErr" class="muted small">{{ resultErr }}</p>
                <div v-for="t in result?.turns ?? []" :key="t.turn" class="turn" :class="{ bad: !t.match || t.guard }">
                  <div class="th"><b>Turn {{ t.turn }}</b><span :style="{ color: t.match && !t.guard ? 'var(--pass)' : 'var(--fail)' }">{{ t.match && !t.guard ? "MATCH" : "DIFFERS" }}</span><span v-if="t.guard" class="warn small">a distractor was called</span></div>
                  <div class="lbl">expected calls</div><div class="mono small">{{ t.expected.map((e) => e.kind + ":" + e.role).join(", ") || "(none: the lead must not delegate)" }}</div>
                  <div class="lbl">expected context</div><div class="txt muted small">{{ t.expectedContext }}</div>
                  <div class="lbl">actual calls</div>
                  <div v-if="!t.calls.length" class="mono small">(none)</div>
                  <div v-for="c in t.calls" :key="c.id" class="call"><span class="mono small">{{ c.kind }}:{{ c.role }}<template v-if="c.custom"> (custom: {{ c.title }})</template> → {{ c.agent }}</span> <span class="muted small">{{ c.status }}</span></div>
                  <div v-for="c in t.denied" :key="c.id" class="warn small">REFUSED {{ c.role }}: {{ c.reason }}</div>
                </div>
              </template>
            </template>
          </aside>
        </div>
      </main>
    </div>
  </DebugFrame>
</template>

<style scoped>
.shell { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: calc(100vh - 49px); }
.navtgl { display: none; margin: 8px 12px; }
@media (max-width: 800px) { .shell { grid-template-columns: 1fr; } .navtgl { display: inline-block; justify-self: start; } .nav { display: none; border-right: 0; border-bottom: 1px solid var(--line); } .nav.show { display: block; } }
.nav { border-right: 1px solid var(--line); background: var(--card); padding: 10px; overflow: auto; }
.newbtn { width: 100%; font-weight: 600; padding: 7px; margin-bottom: 6px; } .newbtn.on { border-color: var(--accent); }
h3 { margin: 0 0 10px; font-size: 15px; } h4 { margin: 18px 0 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--mute); } .nav h4 { margin-top: 12px; } .clk { cursor: pointer; }
.small { font-size: 12px; } .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.srw { position: relative; } .srow { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 7px 28px 7px 10px; border-radius: 10px; margin-bottom: 2px; }
.srow:hover, .srow.on { background: color-mix(in srgb, var(--ink) 7%, transparent); } .srow.on { box-shadow: inset 3px 0 0 var(--ink); }
.t1 { display: flex; align-items: center; gap: 7px; justify-content: flex-start; } .tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: 13px; min-width: 0; }
.t2 { color: var(--mute); font-size: 11px; margin: 2px 0 0 15px; }
.more { position: absolute; top: 5px; right: 4px; border: 0; background: none; color: var(--mute); font-size: 16px; line-height: 1; padding: 4px 7px; opacity: 0; } .srw:hover .more, .more:focus { opacity: 1; } @media (hover: none) { .more { opacity: 1; } }
.menu { position: absolute; top: 30px; right: 4px; z-index: 5; background: var(--card); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 0, 0, .25); padding: 3px; } .del { border: 0; background: none; color: var(--fail); white-space: nowrap; padding: 6px 12px; }
.main { padding: 14px 16px; min-width: 0; }
select { font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; }
.nm { font-weight: 600; overflow-wrap: anywhere; } .st { font-size: 12px; font-weight: 600; white-space: nowrap; margin-left: auto; color: var(--mute); }
.opt { display: flex; gap: 6px; align-items: center; } .opt input { width: auto; }
.go { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; padding: 6px 14px; } .go:disabled { opacity: .45; cursor: default; }
.danger { color: var(--fail); } .warn { color: var(--fail); } .link { border: 0; background: none; color: var(--accent); padding: 0; text-align: left; }
.alert { background: color-mix(in srgb, var(--fail) 14%, var(--card)); border-bottom: 2px solid var(--fail); padding: 6px 14px; color: var(--fail); } .alert.info { background: color-mix(in srgb, var(--accent) 12%, var(--card)); border-color: var(--accent); color: var(--ink); }
.runs { display: flex; gap: 6px; flex-wrap: wrap; } .runs .on { border-color: var(--accent); }
.xlog { margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px; height: 62vh; overflow: auto; font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--mute); flex: none; }
.dot.running, .dot.working { background: var(--accent); animation: p 1.2s infinite; } .dot.active { background: var(--pass); } .dot.failed, .dot.stalled { background: var(--fail); } .dot.idle { background: var(--mute); }
@keyframes p { 50% { opacity: .35; } }
.sh { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .sp { margin-left: auto; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; background: color-mix(in srgb, var(--ink) 8%, transparent); }
.prompt { margin: 6px 0 0; white-space: pre-wrap; }
.card { border: 1px solid var(--line); border-left: 3px solid var(--mute); border-radius: 10px; padding: 8px 12px; margin-bottom: 7px; background: var(--card); display: grid; gap: 3px; }
.card.s-running { border-left-color: var(--accent); } .card.s-idle { border-left-color: var(--pass); } .card.s-failed, .card.s-stalled { border-left-color: var(--fail); }
.top { display: flex; align-items: center; gap: 8px; }
.tag { font-size: 10px; font-weight: 700; letter-spacing: .06em; padding: 1px 7px; border-radius: 5px; color: var(--c, var(--mute)); background: color-mix(in srgb, var(--c, var(--mute)) 15%, transparent); }
.t-master { --c: #7c3aed; } .t-builder, .t-writer { --c: #d97706; } .t-researcher, .t-package-researcher { --c: #2563eb; } .t-planner, .t-ux-designer { --c: #0d9488; } .t-reviewer, .t-qa-reviewer { --c: #db2777; }
.turn { border: 1px solid var(--line); border-left: 3px solid var(--pass); border-radius: 8px; padding: 8px 10px; display: grid; gap: 2px; margin-bottom: 8px; background: var(--card); } .turn.bad { border-left-color: var(--fail); }
.th { display: flex; gap: 10px; align-items: baseline; } .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--mute); margin-top: 6px; }
.txt { white-space: pre-wrap; overflow-wrap: anywhere; } .txt.clip { max-height: 6.5em; overflow: hidden; cursor: pointer; } .call { margin-left: 8px; }
.work { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; margin-top: 8px; } @media (max-width: 1000px) { .work { grid-template-columns: 1fr; } }
.chatcol { display: flex; flex-direction: column; min-width: 0; } .setup { display: grid; gap: 8px; margin-bottom: 10px; }
.agents { display: flex; flex-wrap: wrap; gap: 6px; } .ag { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 99px; padding: 3px 10px 3px 8px; cursor: pointer; background: var(--card); } .ag.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--card)); } .ag input { width: auto; }
.casesel { max-width: 260px; } .casebox { border: 1px dashed var(--line); border-radius: 8px; padding: 6px 10px; }
.msgs { max-height: 56vh; min-height: 120px; overflow: auto; padding: 4px 2px; }
.msg { display: flex; margin: 0 0 12px; } .msg.user { justify-content: flex-end; } .bubble { max-width: 88%; padding: 8px 12px; border-radius: 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.user .bubble { background: var(--ink); color: var(--bg); border-bottom-right-radius: 4px; } .msg.lead .bubble { background: color-mix(in srgb, var(--ink) 8%, var(--card)); border-bottom-left-radius: 4px; }
.ts { font-size: 11px; opacity: .65; margin-top: 3px; } .queued .bubble { background: transparent !important; color: var(--ink) !important; border: 1px dashed var(--mute); } .queued .lbl a { color: var(--fail); margin-left: 6px; }
.strip { display: flex; gap: 8px; align-items: center; color: var(--mute); font-size: 13px; margin-bottom: 10px; } .note { text-align: center; margin-bottom: 10px; }
.composer { margin-top: 8px; display: grid; gap: 6px; } .try button { border-radius: 99px; font-size: 12px; color: var(--mute); }
.box { display: flex; gap: 8px; align-items: flex-end; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 8px 8px 8px 12px; } .box textarea { border: 0; outline: 0; background: transparent; resize: none; padding: 4px 0; }
.side { min-width: 0; } .side h4:first-child { margin-top: 0; }
</style>
