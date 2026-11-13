<script setup lang="ts">
// Same idea as the f1 console: master sessions on the left (＋ New session, ⋮ delete); the chosen session shows the chat with its master and the sub-agent tree.
// ＋ New session: tick the sub-agents the master may call, write a message, Send. Picking a test case is optional: it only pre-fills the message and the agents, and lets the verdict judge the calls.
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/store/api";
import { useLive } from "@/store/live";
import DebugFrame from "@/components/common/DebugFrame.vue";
import type { AvailableAgent, CaseState, LiveAgent, LiveSession } from "../../shared/experiment";

const route = useRoute();
let wantCase = typeof route.query.case === "string" ? route.query.case : "";   // from a Runs link: open that case's session
// everything that changes comes over ONE WebSocket (store/live.ts); this page only sends actions and tells the server what it looks at
const live = useLive(), { ov, sessions, chat, result, bg } = live;
const avail = ref<AvailableAgent[]>([]), err = ref(""), notice = ref("");
const sel = ref<string | null>(null), creating = ref(true), menu = ref<string | null>(null), navOpen = ref(false);
const picked = reactive(new Set<string>()), fake = ref(false), caseId = ref(""), text = ref(""), sending = ref(false);
const showResult = ref(true);
const resultErr = computed(() => (session.value?.case && !result.value ? "this case has not run yet" : ""));

// click on the master or a sub-agent card: show what it ran (commands), its briefs, its answer, and the live previews (public_url)
const detailId = ref(""), actErr = ref("");
const detail = computed(() => { const d = live.detail.value; return d && !("error" in d) ? d : null; });
const detailErr = computed(() => actErr.value || (live.detail.value && "error" in live.detail.value ? live.detail.value.error : ""));
const openDetail = (id: string) => { detailId.value = detailId.value === id ? "" : id; };
async function act(fn: () => Promise<{ ok: boolean; reason?: string }>) { actErr.value = ""; try { const r = await fn(); if (!r.ok) actErr.value = r.reason ?? "failed"; } catch (e) { actErr.value = String(e); } live.kick(); }
// "bg running" in the header: previews + host processes of this session; the list shows on hover
const bgCount = computed(() => bg.value?.scripts.filter((x) => x.status === "running").length ?? 0), bgDone = computed(() => bg.value?.scripts.filter((x) => x.status !== "running").length ?? 0);
const logId = ref(""), logText = ref("");
async function showLog(id: string) { if (logId.value === id) { logId.value = ""; return; } logId.value = id; logText.value = ""; try { logText.value = (await api.bgLog(sel.value!, id)).log; } catch (e) { logText.value = String(e); } }
const now = ref(Date.now());   // "5s ago" labels move on a local clock: no request
const clock = setInterval(() => (now.value = Date.now()), 15_000);
// tell the server what this page looks at (the session and the open agent card); it pushes exactly that
watch([sel, creating, detailId], () => live.watch({ task: creating.value ? undefined : sel.value ?? undefined, detail: detailId.value || undefined }));
watch(sel, () => { detailId.value = ""; logId.value = ""; text.value = ""; scrollDown(); });
const session = computed(() => sessions.value.find((s) => s.task === sel.value) ?? null);
const allCases = computed(() => (ov.value?.suites ?? []).flatMap((s) => s.cases.map((c) => ({ ...c, suite: s.suite }))));
const caseOf = (id?: string) => allCases.value.find((c) => c.id === id);
const color: Record<CaseState, string> = { pass: "var(--pass)", fail: "var(--fail)", partial: "var(--warn)", running: "var(--accent)", skipped: "var(--mute)", never_run: "var(--mute)" };
const ago = (t?: number) => { if (!t) return "-"; const s = Math.max(0, Math.round((now.value - t) / 1000)); return s < 60 ? s + "s ago" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
const dur = (ms?: number) => { if (!ms || ms < 1000) return "0s"; const s = Math.round(ms / 1000); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m " + String(s % 60).padStart(2, "0") + "s" : Math.floor(s / 3600) + "h " + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + "m"; };
const hm = (t: number) => new Date(t).toTimeString().slice(0, 8);
const usd = (n: number) => "$" + n.toFixed(4);
const say = (m: string) => { notice.value = m; setTimeout(() => { if (notice.value === m) notice.value = ""; }, 8000); };

// the case that goes with the composer: the chosen one (new session) or the one this session belongs to
const activeCase = computed(() => caseOf(creating.value ? caseId.value : session.value?.case));
const nextPrompt = computed(() => { const c = activeCase.value; if (!c) return ""; const n = creating.value ? 0 : (chat.value?.nextTurn ?? 0); return c.prompts[n] ?? ""; });

// the page reacts to what the server pushes
const seen = new Set<string>();   // a session that was listed and is gone now was deleted elsewhere; one not listed yet is just new
watch(sessions, (list) => {
  list.forEach((x) => seen.add(x.task));
  if (wantCase) {
    const w = list.filter((x) => x.case === wantCase).sort((a, b) => (b.last ?? 0) - (a.last ?? 0))[0];
    if (w) { open(w.task); say(`opened session of ${wantCase}`); } else say(`no Experiment session exists for ${wantCase} yet (the UI run does not create one): pick it in ＋ New session > Test case`);
    wantCase = "";
  }
  if (sel.value && seen.has(sel.value) && !list.some((s) => s.task === sel.value)) { sel.value = null; creating.value = true; }
});
watch(() => chat.value?.messages.length, scrollDown);
const msgsEl = ref<HTMLElement>();
// sidebar filter: sessions made on this page (experiment) or by a test run (test); the choice is remembered per browser
type Kind = "experiment" | "test";
const kind = ref<Kind>((() => { try { return localStorage.getItem("exp_kind") === "test" ? "test" : "experiment"; } catch { return "experiment"; } })());
const setKind = (k: Kind) => { kind.value = k; try { localStorage.setItem("exp_kind", k); } catch { /* private mode */ } };
const countOf = (k: Kind) => sessions.value.filter((s) => s.kind === k).length;
const shown = computed(() => sessions.value.filter((s) => s.kind === kind.value));
function scrollDown() { void nextTick(() => { const el = msgsEl.value; if (el) el.scrollTop = el.scrollHeight; }); }
const closeMenu = () => (menu.value = null);
onMounted(async () => { live.start(); document.addEventListener("click", closeMenu); try { avail.value = await api.expAgents(); for (const a of avail.value) if (a.byDefault) picked.add(a.name); } catch (e) { err.value = (e as Error).message; } });
onUnmounted(() => { live.stop(); clearInterval(clock); document.removeEventListener("click", closeMenu); });
watch(caseId, (id) => {   // optional: a test case fills the message and ticks the agents it needs
  const c = caseOf(id); if (!c) return;
  text.value = c.prompts[0] ?? ""; picked.clear(); for (const a of c.agents.concat(c.distractors)) if (avail.value.some((x) => x.name === a)) picked.add(a);
});

const open = (t: string) => { sel.value = t; creating.value = false; navOpen.value = false; };
const newSession = () => { sel.value = null; creating.value = true; setKind("experiment"); navOpen.value = false; };
async function del(s: LiveSession) {
  menu.value = null;
  if (!confirm(`Delete session "${s.case ?? s.task}" (${s.task})?\n\nThis stops it and permanently removes the master, all ${s.agents.length} sub-agent(s), chat, reports, archived logs and the Claude transcripts. It cannot be undone.`)) return;
  try { await api.expDelete(s.task); if (sel.value === s.task) { sel.value = null; creating.value = true; } say(`session ${s.task} deleted`); live.kick(); }
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
    text.value = ""; if (creating.value) { caseId.value = ""; open(r.task); } live.kick();
    scrollDown();
  } catch (e) { say("send failed: " + (e as Error).message); } finally { sending.value = false; }
}
const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
async function stopSession() {
  if (!sel.value || !confirm("Stop this session? The master's turn and all its sub-agents are killed and queued messages are dropped. The chat is kept; send a message to continue.")) return;
  await act(async () => { const r = await api.expStopSession(sel.value!); notice.value = `stopped: ${r.killed} process(es) killed, ${r.dropped} queued message(s) dropped`; return { ok: r.ok }; });
}
async function cancel(id: string) { if (sel.value) { await api.expCancel(sel.value, id); live.kick(); } }

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
      <button class="navtgl" @click="navOpen = !navOpen">☰ Sessions ({{ shown.length }})</button>
      <!-- master sessions -->
      <nav class="nav" :class="{ show: navOpen }">
        <button class="newbtn" :class="{ on: creating }" @click="newSession">＋ New session</button>
        <h4>Master sessions</h4>
        <div class="seg" role="tablist" aria-label="session kind">
          <button v-for="k in (['experiment', 'test'] as const)" :key="k" role="tab" :aria-selected="kind === k" :class="{ on: kind === k }" @click="setKind(k)">{{ k === "experiment" ? "Experiment" : "Test" }} <span class="n">{{ countOf(k) }}</span></button>
        </div>
        <p v-if="!shown.length" class="muted small">{{ kind === "experiment" ? "None yet. Use ＋ New session." : "No test runs yet (bun testrun/run.ts <suite>)." }}</p>
        <div v-for="s in shown" :key="s.task" class="srw">
          <button class="srow" :class="{ on: s.task === sel && !creating }" @click="open(s.task)">
            <div class="t1"><span class="dot" :class="s.state" /><span class="tt">{{ s.case ?? s.title }}</span></div>
            <div class="t2" :title="'last activity ' + ago(s.last)">active {{ dur(s.activeMs) }}<template v-if="s.state !== 'active'"> (working)</template> · {{ s.agents.length }} sub-agent(s)<template v-if="s.fixtures"> · fixture ×{{ s.fixtures }}</template></div>
          </button>
          <button class="more" aria-label="session options" @click.stop="menu = menu === s.task ? null : s.task">⋮</button>
          <div v-if="menu === s.task" class="menu" @click.stop><button class="del" @click="del(s)">Delete session + sub-agents</button></div>
        </div>
      </nav>

      <main class="main">
        <h3 v-if="creating || !session">New session</h3>
        <div v-else class="sh"><span class="pill" :class="session.state"><span class="dot" :class="session.state" />{{ session.state }}</span><b>{{ session.case ?? "Master session" }}</b><span class="muted small mono">{{ session.task }}<template v-if="session.suite"> · {{ session.suite }}</template> · {{ session.fake ? "fake" : "real" }} · {{ usd(session.cost) }}</span>
          <span class="bgb" :class="{ on: bgCount }" tabindex="0"><span class="dot" :class="bgCount ? 'running' : ''" /> bg running {{ bgCount }}<span v-if="bgDone" class="muted"> · {{ bgDone }} finished</span>
            <div class="pop">
              <div v-if="!bg?.scripts.length" class="muted small">no background scripts yet</div>
              <div v-for="x in bg?.scripts ?? []" :key="x.id" class="scr small" :class="x.status">
                <div class="row1"><span class="st" :class="x.status">{{ x.status }}</span><b>{{ x.label }}</b><span v-if="x.user_requested" class="st" title="you asked for it: the master will not stop it on its own">asked by you</span><span class="muted mono">{{ x.id }}</span>
                  <button v-if="x.status === 'running'" class="link danger" @click="act(() => api.bgStop(session!.task, x.id))">stop</button>
                  <button v-else-if="x.kind === 'preview' || x.cmd" class="link" @click="act(() => api.bgRestart(session!.task, x.id))">restart</button>
                  <button class="link" @click="showLog(x.id)">{{ logId === x.id ? "hide log" : "log" }}</button></div>
                <div class="mono muted">{{ x.cmd }}</div>
                <div v-if="x.public_url" class="mono"><a :href="x.public_url" target="_blank">{{ x.public_url }}</a></div>
                <div v-if="x.status === 'running' && x.expires_at" class="muted">closes itself at {{ hm(x.expires_at) }} (20 min default, max 120)</div>
                <div v-if="x.status !== 'running'" class="muted">{{ x.status }}<template v-if="x.exit_code !== undefined"> · exit {{ x.exit_code }}</template><template v-if="x.stopped_by"> · by {{ x.stopped_by }}</template><template v-if="x.ended_at"> · {{ hm(x.ended_at) }}</template></div>
                <pre v-if="logId === x.id" class="cmd">{{ logText || "(empty)" }}</pre>
              </div>
            </div></span><button class="danger" :disabled="session.state === 'active'" title="kills the master turn and its sub-agents; the chat is kept" @click="stopSession">Stop</button><button class="danger sp" @click="del(session)">Delete</button></div>

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
              <div class="box"><textarea v-model="text" rows="2" :placeholder="creating || !session ? 'First message to the master agent…' : 'Message the master agent…'" @keydown="onKey" /><button v-if="session && !creating && (session.state === 'working' || session.state === 'running')" class="stopbtn" type="button" aria-label="Stop" title="Stop the master and all its sub-agents (the chat is kept)" @click="stopSession">■</button><button class="go" type="submit" :disabled="!text.trim() || sending">{{ creating || !session ? "Start" : "Send" }}</button></div>
              <div v-if="session && session.state === 'working'" class="muted small">The master is mid-turn: what you send goes into its inbox now and it reads it at its next step (a `wait` on sub-agents returns early for it). If the turn ends first, it becomes the next turn. The ■ button next to Send stops the master and all sub-agents now.</div>
            </form>
          </section>

          <!-- right: master + sub-agents -->
          <aside v-if="session && !creating" class="side">
            <h4>Master agent</h4>
            <div v-if="session.master" class="card clk" :class="'s-' + session.master.status" title="click: commands, briefs, answer, previews" @click="openDetail(session.master.id)">
              <div class="top"><span class="tag t-master">MASTER</span><span class="nm">{{ session.master.id }}</span><span class="st">{{ session.master.status }}</span></div>
              <div class="muted small">{{ session.master.activity || "idle" }}</div>
              <div class="muted small mono">{{ session.master.runs }} turn(s) · {{ usd(session.master.cost) }} incl. sub-agents · {{ ago(session.master.lastEventAt) }}</div>
            </div>
            <p v-else class="muted small">The master has not started yet.</p>
            <div class="muted small">may call: {{ session.agentsAllowed.join(", ") || "nobody" }}</div>

            <h4>Sub-agent sessions <span class="muted small">{{ session.agents.length }}</span></h4>
            <p v-if="!session.agents.length" class="muted small">No sub-agents yet. The master starts them when the task needs them.</p>
            <div v-for="{ a, d } in tree(session)" :key="a.id" class="card sub clk" title="click: commands, briefs, answer" @click="openDetail(a.id)" :class="'s-' + (a.needsParent ? 'stalled' : a.status)" :style="{ marginLeft: Math.min(d, 3) * 14 + 'px' }">
              <div class="top"><span class="dot" :class="a.needsParent ? 'stalled' : a.status" /><span class="tag" :class="'t-' + a.name">{{ a.name.toUpperCase() }}</span><span v-if="a.fixture" class="tag" title="answer served from agent_fixture, no model ran">FIXTURE</span><span class="nm">{{ a.title }}</span><span class="st">{{ a.needsParent ? "waiting for parent" : a.status }}</span></div>
              <div v-if="a.activity" class="muted small mono">▸ {{ a.activity }}</div>
              <div v-if="a.needsParent" class="warn small">asked: {{ a.needsParent.split("\n")[0] }}</div>
              <div class="muted small mono">{{ a.id }} · L{{ a.level }} · {{ a.runs }} run(s) · {{ usd(a.cost) }} · {{ ago(a.lastEventAt) }}</div>
            </div>

            <section v-if="detailId" class="detail">
              <h4>{{ detailId }} <span class="muted small">{{ detail?.status }}</span> <button class="link" @click="openDetail(detailId)">close</button></h4>
              <p v-if="detailErr" class="warn small">{{ detailErr }}</p>
              <template v-if="detail">
                <div v-if="detail.scripts.length" class="lbl">background scripts of this session (hover the bg badge in the header for logs)</div>
                <div v-for="x in detail.scripts" :key="x.id" class="small"><span class="st" :class="x.status">{{ x.status }}</span> <span class="mono">{{ x.label }}</span> <a v-if="x.public_url" :href="x.public_url" target="_blank" class="mono">{{ x.public_url }}</a></div>
                <div v-if="detail.processes.length" class="lbl">bash sessions / processes running in this workspace (the master and the team can list and stop them too: proc_list, proc_stop)</div>
                <div v-for="x in detail.processes" :key="x.pid" class="mono small">{{ x.pid }} · {{ x.elapsed }} · {{ x.cmd }} <button class="link danger" @click="act(() => api.procStop(sel!, x.pid))">stop</button></div>
                <div class="lbl">commands / tool calls ({{ detail.tools.length }})</div>
                <p v-if="!detail.tools.length" class="muted small">none recorded for this agent</p>
                <pre v-for="(x, i) in detail.tools" :key="i" class="cmd"><b>{{ x.tool }}</b> <span class="muted">{{ hm(x.t) }}</span>
{{ x.text }}</pre>
                <div v-if="detail.briefs.length" class="lbl">briefs (calls)</div>
                <div v-for="b in detail.briefs" :key="b.id" class="brief small"><span class="mono">{{ b.from }} → {{ b.to }} · {{ b.role }} · {{ b.status }}</span><div class="txt">{{ b.objective }}</div><div v-if="b.output" class="muted">output: {{ b.output }}</div><div v-if="b.boundaries" class="muted">boundaries: {{ b.boundaries }}</div></div>
                <div class="lbl">last answer</div><pre class="cmd">{{ detail.answer || "(none yet)" }}</pre>
              </template>
            </section>

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
.shell { display: grid; grid-template-columns: 260px minmax(0, 1fr); height: calc(100vh - 49px); overflow: hidden; }
.navtgl { display: none; margin: 8px 12px; }
@media (max-width: 800px) { .shell { grid-template-columns: 1fr; height: auto; overflow: visible; } .main, .work, .chatcol, .side { overflow: visible; } .msgs { max-height: 56vh; } .navtgl { display: inline-block; justify-self: start; } .nav { display: none; border-right: 0; border-bottom: 1px solid var(--line); } .nav.show { display: block; } }
.nav { border-right: 1px solid var(--line); background: var(--card); padding: 10px; overflow: auto; }
.seg { display: flex; gap: 4px; margin: 0 0 8px; } .seg button { flex: 1; font-size: 12px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 7px; background: none; color: var(--mute); } .seg button.on { color: var(--text, inherit); border-color: var(--text, #888); font-weight: 600; } .seg .n { opacity: .6; font-weight: 400; }
.newbtn { width: 100%; font-weight: 600; padding: 7px; margin-bottom: 6px; } .newbtn.on { border-color: var(--accent); }
h3 { margin: 0 0 10px; font-size: 15px; } h4 { margin: 18px 0 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--mute); } .nav h4 { margin-top: 12px; } .clk { cursor: pointer; }
.small { font-size: 12px; } .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.srw { position: relative; } .srow { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 7px 28px 7px 10px; border-radius: 10px; margin-bottom: 2px; }
.srow:hover, .srow.on { background: color-mix(in srgb, var(--ink) 7%, transparent); } .srow.on { box-shadow: inset 3px 0 0 var(--ink); }
.t1 { display: flex; align-items: center; gap: 7px; justify-content: flex-start; } .tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: 13px; min-width: 0; }
.t2 { color: var(--mute); font-size: 11px; margin: 2px 0 0 15px; }
.more { position: absolute; top: 5px; right: 4px; border: 0; background: none; color: var(--mute); font-size: 16px; line-height: 1; padding: 4px 7px; opacity: 0; } .srw:hover .more, .more:focus { opacity: 1; } @media (hover: none) { .more { opacity: 1; } }
.menu { position: absolute; top: 30px; right: 4px; z-index: 5; background: var(--card); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 0, 0, .25); padding: 3px; } .del { border: 0; background: none; color: var(--fail); white-space: nowrap; padding: 6px 12px; }
.main { padding: 14px 16px; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
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
.work { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: stretch; margin-top: 8px; flex: 1; min-height: 0; overflow: hidden; } @media (max-width: 1000px) { .work { grid-template-columns: 1fr; } }
.chatcol { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; } .setup { display: grid; gap: 8px; margin-bottom: 10px; max-height: 45%; overflow-y: auto; flex: none; }
.agents { display: flex; flex-wrap: wrap; gap: 6px; } .ag { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 99px; padding: 3px 10px 3px 8px; cursor: pointer; background: var(--card); } .ag.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--card)); } .ag input { width: auto; }
.casesel { max-width: 260px; } .casebox { border: 1px dashed var(--line); border-radius: 8px; padding: 6px 10px; }
.msgs { flex: 1 1 auto; min-height: 120px; overflow-y: auto; padding: 4px 2px; }
.msg { display: flex; margin: 0 0 12px; } .msg.user { justify-content: flex-end; } .bubble { max-width: 88%; padding: 8px 12px; border-radius: 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.user .bubble { background: var(--ink); color: var(--bg); border-bottom-right-radius: 4px; } .msg.lead .bubble { background: color-mix(in srgb, var(--ink) 8%, var(--card)); border-bottom-left-radius: 4px; }
.ts { font-size: 11px; opacity: .65; margin-top: 3px; } .queued .bubble { background: transparent !important; color: var(--ink) !important; border: 1px dashed var(--mute); } .queued .lbl a { color: var(--fail); margin-left: 6px; }
.strip { display: flex; gap: 8px; align-items: center; color: var(--mute); font-size: 13px; margin-bottom: 10px; } .note { text-align: center; margin-bottom: 10px; }
.stopbtn { width: 34px; height: 34px; flex: none; border: 0; color: #fff; background: var(--fail); border-radius: 50%; font-size: 14px; line-height: 1; cursor: pointer; } .stopbtn:hover { filter: brightness(1.1); } 
.composer { margin-top: 8px; display: grid; gap: 6px; } .try button { border-radius: 99px; font-size: 12px; color: var(--mute); }
.box { display: flex; gap: 8px; align-items: flex-end; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 8px 8px 8px 12px; } .box textarea { border: 0; outline: 0; background: transparent; resize: none; padding: 4px 0; }
.side { min-width: 0; min-height: 0; overflow-y: auto; } .side h4:first-child { margin-top: 0; }
.clk { cursor: pointer; } .card.clk:hover { border-color: var(--accent); }
.detail { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; margin: 8px 0; background: var(--card); display: grid; gap: 4px; }
.cmd { margin: 0; font: 11px/1.4 ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; max-height: 160px; overflow: auto; background: color-mix(in srgb, var(--ink) 5%, transparent); border-radius: 6px; padding: 5px 7px; }
.brief { border-left: 3px solid var(--mute); padding-left: 8px; margin-bottom: 4px; }
.sh { position: relative; } .bgb { position: relative; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 2px 10px; border: 1px solid var(--line); border-radius: 99px; color: var(--mute); cursor: default; } .bgb.on { color: var(--ink); border-color: var(--accent); }
.bgb .pop { display: none; position: absolute; top: 100%; left: 0; z-index: 20; min-width: 360px; max-width: 70vw; max-height: 50vh; overflow: auto; padding: 8px 10px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 6px 18px rgba(0,0,0,.3); font-weight: 400; color: var(--ink); } .bgb:hover .pop, .bgb:focus-within .pop { display: block; }
.st { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 5px; text-transform: uppercase; background: color-mix(in srgb, var(--mute) 20%, transparent); } .st.running { color: var(--accent); } .st.succeeded { color: var(--pass); } .st.failed, .st.interrupted { color: var(--fail); }
.scr { border-top: 1px solid var(--line); padding: 5px 0; display: grid; gap: 2px; } .scr .row1 { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
</style>
