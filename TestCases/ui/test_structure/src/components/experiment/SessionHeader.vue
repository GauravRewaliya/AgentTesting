<script setup lang="ts">
import DebugFrame from "@/components/common/DebugFrame.vue";
// MIDDLE top: state, title, cost, the "bg running" list (click to open) and Stop / Delete
import { onMounted, onUnmounted, ref, computed } from "vue";
import { api } from "@/store/api";
import type { LiveSession } from "../../../shared/experiment";
import type { BgInfo } from "@/store/live";
import { hm, usd } from "./fmt";

const props = defineProps<{ session: LiveSession; bg: BgInfo | null }>();
const emit = defineEmits<{ stop: []; del: []; error: [msg: string] }>();
const bgCount = computed(() => props.bg?.scripts.filter((x) => x.status === "running").length ?? 0), bgDone = computed(() => props.bg?.scripts.filter((x) => x.status !== "running").length ?? 0);
const bgOpen = ref(false), logId = ref(""), logText = ref("");
const closeBg = (e: Event) => { if (!(e.target as HTMLElement).closest?.(".bgb")) bgOpen.value = false; };
onMounted(() => document.addEventListener("click", closeBg)); onUnmounted(() => document.removeEventListener("click", closeBg));
async function showLog(id: string) { if (logId.value === id) { logId.value = ""; return; } logId.value = id; logText.value = ""; try { logText.value = (await api.bgLog(props.session.task, id)).log; } catch (e) { logText.value = String((e as Error).message); } }
async function act(fn: () => Promise<{ ok: boolean; reason?: string }>) { try { const r = await fn(); if (!r.ok) emit("error", r.reason ?? "failed"); } catch (e) { emit("error", (e as Error).message); } }
</script>

<template>
  <DebugFrame name="SessionHeader" hint="experiment/SessionHeader.vue">
  <div class="sh"><span class="pill" :class="session.state"><span class="dot" :class="session.state" />{{ session.state }}</span><b>{{ session.case ?? "Master session" }}</b><span class="muted small mono">{{ session.task }}<template v-if="session.suite"> · {{ session.suite }}</template> · {{ session.fake ? "fake" : "real" }} · {{ usd(session.cost) }}</span>
    <span class="bgb" :class="{ on: bgCount, open: bgOpen }"><button type="button" class="bgh" :aria-expanded="bgOpen" @click="bgOpen = !bgOpen"><span class="dot" :class="bgCount ? 'running' : ''" /> bg running {{ bgCount }}<span v-if="bgDone" class="muted"> · {{ bgDone }} finished</span> <span class="muted">{{ bgOpen ? "▴" : "▾" }}</span></button>
      <div v-show="bgOpen" class="pop">
        <div v-if="!bg?.scripts.length" class="muted small">no background scripts yet</div>
        <div v-for="x in bg?.scripts ?? []" :key="x.id" class="scr small" :class="x.status">
          <div class="row1"><span class="st" :class="x.status">{{ x.status }}</span><span class="ttl" :title="'kind of task: ' + x.title">{{ x.title }}</span><b>{{ x.label }}</b><span class="muted mono">{{ x.id }}</span>
            <button v-if="x.status === 'running'" class="link danger" @click="act(() => api.bgStop(session.task, x.id))">stop</button>
            <button v-else-if="x.cmd" class="link" @click="act(() => api.bgRestart(session.task, x.id))">restart</button>
            <button class="link" @click="showLog(x.id)">{{ logId === x.id ? "hide log" : "log" }}</button></div>
          <div class="mono muted">{{ x.cmd }}</div>
          <div v-if="x.public_url" class="mono"><a :href="x.public_url" target="_blank">{{ x.public_url }}</a></div>
          <div v-if="x.status !== 'running'" class="muted">{{ x.status }}<template v-if="x.exit_code !== undefined"> · exit {{ x.exit_code }}</template><template v-if="x.stopped_by"> · by {{ x.stopped_by }}</template><template v-if="x.ended_at"> · {{ hm(x.ended_at) }}</template></div>
          <pre v-if="logId === x.id" class="cmd">{{ logText || "(empty)" }}</pre>
        </div>
      </div></span><button class="danger" :disabled="session.state === 'active'" title="kills the master turn and its sub-agents; the chat is kept" @click="emit('stop')">Stop</button><button class="danger sp" @click="emit('del')">Delete</button></div>
  </DebugFrame>
</template>

<style scoped src="./exp.css"></style>
