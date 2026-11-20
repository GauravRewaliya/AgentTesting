<script setup lang="ts">
// A real terminal (xterm.js) wired to `claude` on the server (server/term.ts): type /mcp, /plugin, /login ... like in your own terminal. Start it, stop it; leaving the page ends it.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { nextTick, onBeforeUnmount, ref } from "vue";
const host = ref<HTMLElement | null>(null), running = ref(false), note = ref(""), kind = ref<"claude" | "shell">("claude");
let term: Terminal | null = null, fit: FitAddon | null = null, ws: WebSocket | null = null, ro: ResizeObserver | null = null;
const dark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
async function start() {
  stop(); running.value = true; note.value = ""; await nextTick();
  term = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", theme: dark() ? { background: "#12151c" } : { background: "#ffffff", foreground: "#1c2230", cursor: "#1c2230", selectionBackground: "#bcd0ff" } });
  fit = new FitAddon(); term.loadAddon(fit); term.open(host.value!); fit.fit();
  const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/term?kind=${kind.value}&cols=${term.cols}&rows=${term.rows}`;
  ws = new WebSocket(url); ws.binaryType = "arraybuffer";
  ws.onmessage = (e) => term?.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer));
  ws.onopen = () => term?.focus();
  ws.onclose = () => { running.value = false; note.value = "The terminal ended."; };
  ws.onerror = () => { note.value = "Could not open the terminal (is the API running?)."; };
  term.onData((d) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: "i", d })));
  term.onResize(({ cols, rows }) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: "r", cols, rows })));
  ro = new ResizeObserver(() => fit?.fit()); ro.observe(host.value!);
}
function stop() { ro?.disconnect(); ro = null; ws?.close(); ws = null; term?.dispose(); term = null; running.value = false; }
onBeforeUnmount(stop);
</script>
<template>
  <div class="pane">
    <div class="bar">
      <span class="seg"><button :class="{ on: kind === 'claude' }" :disabled="running" @click="kind = 'claude'">Claude</button><button :class="{ on: kind === 'shell' }" :disabled="running" @click="kind = 'shell'">Shell</button></span>
      <button v-if="!running" class="primary" @click="start">Start {{ kind === "claude" ? "Claude" : "shell" }}</button><button v-else @click="stop">Stop</button>
      <span v-if="kind === 'claude'" class="mute small">Same profile as the agents. Try <span class="mono">/mcp</span>, <span class="mono">/plugin</span>, <span class="mono">/login</span>.</span>
      <span v-else class="mute small">bash in the project container: <span class="mono">gh</span>, git, jq, pnpm, bun, claude. Your home is kept between sessions.</span><span v-if="note" class="mute small">{{ note }}</span></div>
    <div v-show="running" ref="host" class="screen"></div>
  </div>
</template>
<style scoped>
.pane { display: grid; gap: 8px; } .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .mute { color: var(--mute); } .small { font-size: 12px; } .mono { font-family: ui-monospace, monospace; }
.screen { height: 460px; border: 1px solid var(--line); border-radius: 8px; padding: 6px; background: var(--card); overflow: hidden; } .seg { display: inline-flex; } .seg button { border-radius: 0; } .seg button:first-child { border-radius: 6px 0 0 6px; } .seg button:last-child { border-radius: 0 6px 6px 0; border-left: 0; } .seg button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
