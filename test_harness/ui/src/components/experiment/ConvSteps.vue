<script setup lang="ts">
// One agent's activity as a timeline: narration, "Thought" rows, and TOOL GROUPS (consecutive tool calls folded into one expandable block;
// each call inside expands again to its request and response). A call that hands work to a sub-agent is highlighted and can be opened.
import { computed, ref } from "vue";
import type { TranscriptStep } from "../../../shared/experiment";
import { dur, hm } from "./fmt";

const props = defineProps<{ steps: TranscriptStep[]; agentName: string; showPrompt?: boolean; active?: boolean }>()   // active: the agent is still working, so a call without a response yet is really running;
const emit = defineEmits<{ openAgent: [id: string] }>();

type Item = { kind: "text" | "user" | "thinking"; key: string; s: TranscriptStep } | { kind: "group"; key: string; tools: { s: TranscriptStep; key: string }[] };
const items = computed<Item[]>(() => {
  const out: Item[] = [];
  props.steps.forEach((s, i) => {
    if (s.kind === "user" && !props.showPrompt) return;
    if (s.kind !== "tool") { out.push({ kind: s.kind, key: "i" + s.kind + s.t + "_" + i, s }); return; }
    const last = out[out.length - 1];
    const tk = "t" + (s.id ?? s.t + "_" + i);
    if (last?.kind === "group") last.tools.push({ s, key: tk }); else out.push({ kind: "group", key: "g" + (s.id ?? s.t + "_" + i), tools: [{ s, key: tk }] });
  });
  return out;
});

const open = ref(new Set<string>());
const isOpen = (k: string) => open.value.has(k);
const toggle = (k: string) => { const n = new Set(open.value); n.has(k) ? n.delete(k) : n.add(k); open.value = n; };
const allKeys = computed(() => items.value.flatMap((it) => (it.kind === "group" ? [it.key, ...it.tools.map((t) => t.key)] : it.kind === "thinking" && it.s.text ? [it.key] : [])));
const allOpen = computed(() => allKeys.value.length > 0 && allKeys.value.every((k) => open.value.has(k)));
const toggleAll = () => { open.value = allOpen.value ? new Set() : new Set(allKeys.value); };
defineExpose({ toggleAll, allOpen, count: computed(() => allKeys.value.length) });

type St = "running" | "done" | "failed";
const stOf = (s: TranscriptStep): St => (s.isError ? "failed" : s.result !== undefined || s.end ? "done" : props.active ? "running" : "done");
const groupSt = (tools: { s: TranscriptStep }[]): St => (tools.some((t) => stOf(t.s) === "failed") ? "failed" : tools.some((t) => stOf(t.s) === "running") ? "running" : "done");
const names = (tools: { s: TranscriptStep }[]) => { const c = new Map<string, number>(); for (const t of tools) { const n = isCall(t.s) ? "sub-agent call" : t.s.tool ?? "tool"; c.set(n, (c.get(n) ?? 0) + 1); } return [...c].map(([n, k]) => (k > 1 ? `${k} ${n}` : n)).join(", "); };
const isCall = (s: TranscriptStep) => (!!s.calls && s.calls !== "?") || !!s.spawned?.length;
const subCalls = (tools: { s: TranscriptStep }[]) => tools.reduce((n, t) => n + (t.s.spawned?.length ?? (t.s.calls && t.s.calls !== "?" ? 1 : 0)), 0);
const head = (s: TranscriptStep) => (s.input ?? "").replace(/^.*tools\.ts\s+/, "").split("\n")[0]!.slice(0, 160);
const took = (s: TranscriptStep) => (s.end ? dur(s.end - s.t) : "");
const pretty = (v?: string) => { if (!v) return ""; try { const j = JSON.parse(v); return typeof j === "object" ? JSON.stringify(j, null, 2) : v; } catch { return v; } };
const copied = ref("");
async function copy(key: string, text?: string) { try { await navigator.clipboard.writeText(text ?? ""); copied.value = key; setTimeout(() => { if (copied.value === key) copied.value = ""; }, 1400); } catch { /* clipboard blocked */ } }
</script>

<template>
  <ol class="cs">
    <li v-for="it in items" :key="it.key" class="it" :class="it.kind">
      <template v-if="it.kind === 'user'"><div class="who">prompt <span class="muted">{{ hm(it.s.t) }}</span></div><pre class="txt">{{ it.s.text }}</pre></template>

      <template v-else-if="it.kind === 'text'"><div class="who">{{ agentName }} <span class="muted">{{ hm(it.s.t) }}</span></div><pre class="txt">{{ it.s.text }}</pre></template>

      <template v-else-if="it.kind === 'thinking'">
        <button v-if="it.s.text" class="hd soft" :aria-expanded="isOpen(it.key)" @click="toggle(it.key)"><span class="car">{{ isOpen(it.key) ? "▾" : "▸" }}</span><span class="ico">✦</span><span class="ttl">Thought</span><span class="muted small">{{ hm(it.s.t) }}</span></button>
        <div v-else class="hd soft static" title="the CLI saved the fact that it thought, but not the content"><span class="car" /><span class="ico">✦</span><span class="ttl">Thought</span><span class="muted small">content not recorded · {{ hm(it.s.t) }}</span></div>
        <pre v-if="it.s.text && isOpen(it.key)" class="think">{{ it.s.text }}</pre>
      </template>

      <template v-else-if="it.kind === 'group'">
        <button class="hd grp" :class="groupSt(it.tools)" :aria-expanded="isOpen(it.key)" @click="toggle(it.key)">
          <span class="car">{{ isOpen(it.key) ? "▾" : "▸" }}</span><span class="sdot" :class="groupSt(it.tools)" />
          <span class="ttl">Used {{ it.tools.length }} {{ it.tools.length === 1 ? "tool" : "tools" }}</span><span class="muted small ell">{{ names(it.tools) }}</span>
          <span v-if="subCalls(it.tools)" class="chip">{{ subCalls(it.tools) }} sub-agent call{{ subCalls(it.tools) > 1 ? "s" : "" }}</span><span class="stx" :class="groupSt(it.tools)">{{ groupSt(it.tools) }}</span>
        </button>
        <ul v-if="isOpen(it.key)" class="tools">
          <li v-for="t in it.tools" :key="t.key" class="tool" :class="{ call: isCall(t.s) }">
            <button class="hd" :aria-expanded="isOpen(t.key)" @click="toggle(t.key)">
              <span class="car">{{ isOpen(t.key) ? "▾" : "▸" }}</span><span class="sdot" :class="stOf(t.s)" />
              <span v-if="t.s.spawned?.length" class="tag call">started {{ t.s.spawned.length }} sub-agents</span><span v-else-if="t.s.calls && t.s.calls !== '?'" class="tag call">called {{ t.s.calls }}</span><span v-else class="tag">{{ t.s.tool }}</span>
              <span class="mono ell grow">{{ head(t.s) }}</span><span class="muted small nw">{{ took(t.s) || (stOf(t.s) === "running" ? "running…" : "") }}</span>
            </button>
            <div v-if="isOpen(t.key)" class="detail2">
              <div class="sec"><div class="lbl">Request <button class="cp" @click="copy(t.key + 'i', t.s.input)">{{ copied === t.key + "i" ? "copied" : "copy" }}</button></div><pre class="cmd">{{ pretty(t.s.input) }}</pre></div>
              <div class="sec"><div class="lbl">{{ stOf(t.s) === "failed" ? "Error" : "Response" }} <button v-if="t.s.result" class="cp" @click="copy(t.key + 'r', t.s.result)">{{ copied === t.key + "r" ? "copied" : "copy" }}</button></div><pre class="cmd" :class="{ bad: t.s.isError }">{{ t.s.result ? pretty(t.s.result) : stOf(t.s) === "running" ? "waiting for the response…" : "(no response recorded)" }}</pre></div>
              <div v-for="p in t.s.spawned ?? []" :key="p.id" class="sp">
                <div class="spt"><b>{{ p.id }}</b><span class="muted small">{{ p.role }} · {{ p.status }}</span><button class="cp" @click="emit('openAgent', p.id)">open conversation →</button></div>
                <div class="lbl">sent (brief)</div><pre class="cmd">{{ p.objective || "(not recorded)" }}</pre>
                <div class="lbl">received (report)</div><pre class="cmd">{{ p.answer || (p.status === "running" ? "still working…" : "(no report)") }}</pre>
              </div>
              <button v-if="t.s.calls && t.s.calls !== '?'" class="open" @click="emit('openAgent', t.s.calls!)">Open {{ t.s.calls }}'s conversation →</button>
            </div>
          </li>
        </ul>
      </template>
    </li>
  </ol>
</template>

<style scoped>
.cs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; } .it { min-width: 0; }
.who { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--mute); margin-bottom: 2px; }
.txt { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; font: inherit; line-height: 1.5; } .it.user .txt { padding: 8px 12px; border: 1px dashed var(--line); border-radius: 10px; }
.hd { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--card); cursor: pointer; min-width: 0; font-size: 13px; }
.hd:hover, .hd:focus-visible { border-color: var(--accent); } .hd.soft { background: transparent; border-style: dashed; color: var(--mute); } .hd.static { cursor: default; } .hd.static:hover { border-color: var(--line); }
.car { width: 12px; flex: none; color: var(--mute); font-size: 11px; } .ico { color: var(--mute); } .ttl { font-weight: 600; flex: none; }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; } .grow { flex: 1; } .nw { white-space: nowrap; margin-left: auto; flex: none; }
.small { font-size: 12px; } .muted { color: var(--mute); }
.sdot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--pass); } .sdot.running { background: var(--accent); animation: pulse 1.2s infinite; } .sdot.failed { background: var(--fail); }
@keyframes pulse { 50% { opacity: .3; } }
.grp .stx { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--pass); flex: none; } .grp .stx.running { color: var(--accent); } .grp .stx.failed { color: var(--fail); }
.chip { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--accent); color: #fff; flex: none; }
.tools { list-style: none; margin: 4px 0 2px 14px; padding: 0 0 0 10px; border-left: 2px solid var(--line); display: grid; gap: 4px; }
.tag { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 5px; background: color-mix(in srgb, var(--mute) 18%, transparent); flex: none; } .tag.call { background: var(--accent); color: #fff; }
.tool.call > .hd { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
.detail2 { margin: 4px 0 4px 18px; display: grid; gap: 6px; } .lbl { display: flex; gap: 8px; align-items: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--mute); margin-bottom: 2px; }
.cp { all: unset; cursor: pointer; font-size: 11px; text-transform: none; letter-spacing: 0; color: var(--accent); } .cp:hover { text-decoration: underline; }
.cmd { margin: 0; max-height: 320px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.45 ui-monospace, monospace; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: color-mix(in srgb, var(--ink) 4%, transparent); } .cmd.bad { border-color: var(--fail); }
.think { margin: 4px 0 0 18px; padding: 6px 10px; white-space: pre-wrap; overflow-wrap: anywhere; font: italic 13px/1.5 inherit; color: var(--mute); border-left: 2px solid var(--line); }
.sp { border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; display: grid; gap: 3px; } .spt { display: flex; gap: 10px; align-items: center; } .spt .cp { margin-left: auto; }
.open { all: unset; cursor: pointer; justify-self: start; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 99px; background: var(--accent); color: #fff; } .open:hover { filter: brightness(1.1); }
</style>
