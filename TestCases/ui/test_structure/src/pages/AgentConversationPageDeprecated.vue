<script setup lang="ts">
// DEPRECATED: the single-column conversation view. The agent page is now AgentPage.vue (same three panels as the master). Kept only at /experiment/agent-old until it is removed.
// One agent's full conversation: /experiment/agent?session=<master session>&agent=<agent id>
// Every tool call is a collapsed row (click to expand input + result). A call that hands work to a sub-agent has an "open" link to that agent's own page, which is built the same way (sub-agents can call sub-agents).
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "@/store/api";
import DebugFrame from "@/components/common/DebugFrame.vue";
import ConvSteps from "@/components/experiment/ConvSteps.vue";
import type { Transcript } from "../../shared/experiment";

const route = useRoute(), router = useRouter();
const task = computed(() => String(route.query.session ?? "")), agent = computed(() => String(route.query.agent ?? ""));
const data = ref<Transcript | null>(null), err = ref(""), loading = ref(true);
const timeline = ref<InstanceType<typeof ConvSteps>>();

async function load(first = false) {
  if (first) loading.value = true;
  try {
    const r = await api.expTranscript(task.value, agent.value);
    if ("error" in r) { err.value = r.error; data.value = null; } else { err.value = ""; data.value = r; }
  } catch (e) { err.value = (e as Error).message; }
  loading.value = false;
}
watch([task, agent], () => { data.value = null; load(true); });
onMounted(() => load(true));   // deprecated page: loads once, no polling

const goBack = () => { if (window.history.state?.back) router.back(); else router.push({ path: "/experiment" }); };
const openAgent = (id: string) => router.push({ path: "/experiment/agent-old", query: { session: task.value, agent: id } });
</script>

<template>
  <DebugFrame name="AgentConversationPageDeprecated">
    <div class="dep">Deprecated view. <a href="#" @click.prevent="router.push({ path: '/experiment/agent', query: route.query })">Open the new agent page →</a></div>
    <div class="conv">
      <header class="bar">
        <button class="back" @click="goBack">← Back</button>
        <div class="ttl"><b>{{ agent }}</b> <span v-if="data" class="pill" :class="data.status">{{ data.status }}</span>
          <div class="muted small mono">session {{ task }}<template v-if="data?.caller"> · called by <a href="#" @click.prevent="openAgent(data.caller!)">{{ data.caller }}</a></template></div></div>
        <button v-if="timeline?.count" class="link" @click="timeline?.toggleAll()">{{ timeline?.allOpen ? "collapse all" : "expand all" }}</button>
      </header>

      <p v-if="loading" class="muted">Loading…</p>
      <p v-else-if="err" class="warn">{{ err }}</p>
      <template v-else-if="data">
        <section v-if="data.brief" class="box">
          <div class="lbl">brief it was given</div>
          <div class="txt">{{ data.brief.objective }}</div>
          <div v-if="data.brief.output" class="muted small">expected output: {{ data.brief.output }}</div>
        </section>

        <p v-if="data.source === 'recorded'" class="muted note">No transcript file for this agent (it was answered from a recorded fixture, or has not started). Showing the brief, the calls it made and its report.</p>
        <p v-else-if="!data.steps.length" class="muted">The transcript is empty so far.</p>

        <ConvSteps ref="timeline" :active="data.status === 'running'" :steps="data.steps" :agent-name="data.name" show-prompt @open-agent="openAgent" />

        <section v-if="data.children.length" class="box">
          <div class="lbl">sub-agents this agent called ({{ data.children.length }})</div>
          <div v-for="(c, i) in data.children" :key="c.id + i" class="child">
            <div class="row2"><b>{{ c.id }}</b> <span class="muted small">{{ c.role }} · {{ c.status }}</span><button class="link" @click="openAgent(c.id)">open →</button></div>
            <div class="muted small clip">{{ c.objective }}</div>
          </div>
        </section>

        <section v-if="data.answer" class="box"><div class="lbl">final answer / report</div><pre class="txt">{{ data.answer }}</pre></section>
      </template>
    </div>
  </DebugFrame>
</template>

<style scoped>
.dep { padding: 6px 14px; background: color-mix(in srgb, var(--warn, #d97706) 18%, var(--card)); border-bottom: 2px solid var(--warn, #d97706); font-size: 13px; }
.conv { max-width: 980px; margin: 0 auto; padding: 16px; display: grid; gap: 12px; }
.bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 14px; padding: 10px 0; background: var(--bg, var(--card)); border-bottom: 1px solid var(--line); }
.ttl { flex: 1; min-width: 0; } .back { flex-shrink: 0; cursor: pointer; }
.pill { font-size: 11px; padding: 1px 8px; border: 1px solid var(--line); border-radius: 99px; color: var(--mute); } .pill.running { color: var(--accent); border-color: var(--accent); }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.step.text, .step.user { padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); } .step.user { border-style: dashed; }
.who { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--mute); margin-bottom: 2px; }
.txt { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; font: inherit; }
.row { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; background: var(--card); min-width: 0; }
.row:hover, .row:focus-visible { border-color: var(--accent); } .row .hd { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.car { width: 12px; color: var(--mute); } .tag { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--line); flex-shrink: 0; } .tag.call { background: var(--accent); color: #fff; }
.body { margin: 4px 0 0 18px; padding: 8px 10px; border-left: 2px solid var(--line); display: grid; gap: 4px; } .step.err .row { border-color: var(--fail); }
.cmd { margin: 0; max-height: 360px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; padding: 6px 8px; background: var(--bg, transparent); border: 1px solid var(--line); border-radius: 6px; }
.box { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); } .lbl { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--mute); margin: 4px 0 2px; }
.child { padding: 6px 0; border-top: 1px solid var(--line); } .row2 { display: flex; gap: 10px; align-items: center; } .row2 .link { margin-left: auto; } .clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note { margin: 0; } .primary { justify-self: start; cursor: pointer; }
</style>
