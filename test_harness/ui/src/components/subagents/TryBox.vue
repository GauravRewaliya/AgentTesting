<script setup lang="ts">
// Send any text to an agent: the guard runs first (real rules), then the real fixture lookup.
import { ref } from "vue";
import { api } from "@/store/api";
import type { TryResult } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ agent: string; seed?: string }>();
const query = ref(props.seed ?? ""), done = ref(""), res = ref<TryResult | null>(null), err = ref("");
const samples = ["hi", "search the web for vue flow docs", "Create a markdown file a.md that contains the word Alpha", "What is the weather on Mars?"];
async function send() {
  try { err.value = ""; res.value = await api.tryCall(props.agent, query.value, done.value.split(",").map((s) => s.trim()).filter(Boolean)); } catch (e) { err.value = (e as Error).message; }
}
const random = () => { query.value = samples[Math.floor(Math.random() * samples.length)]!; send(); };
</script>
<template>
  <DebugFrame name="TryBox" :hint="agent">
    <textarea v-model="query" rows="3" :placeholder="`query to send to ${agent}`" />
    <input v-model="done" class="done" placeholder="roles already done (comma), for requires_done" />
    <div class="row"><button @click="send">Send</button><button @click="random">Random</button></div>
    <p v-if="err" style="color:var(--fail)">{{ err }}</p>
    <div v-if="res" class="res" :class="res.accepted ? 'ok' : 'no'">
      <strong>{{ res.accepted ? "accepted → lookup" : "rejected before run" }}</strong>
      <ul v-if="res.rejections.length"><li v-for="r in res.rejections" :key="r">{{ r }}</li></ul>
      <template v-if="res.accepted"><div class="mono muted">fixture: {{ res.fixture ?? "none" }}<span v-if="res.files?.length"> · wrote {{ res.files.join(", ") }}</span></div><div>{{ res.reply }}</div></template>
    </div>
  </DebugFrame>
</template>
<style scoped>.row { display:flex; gap:6px; margin:6px 0; } .done { margin-top:4px; } .res { border-left:3px solid; padding:4px 8px; } .ok { border-color:var(--pass); } .no { border-color:var(--fail); } ul { margin:4px 0; padding-left:18px; }</style>
