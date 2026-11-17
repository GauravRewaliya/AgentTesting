<script setup lang="ts">
import DebugFrame from "@/components/common/DebugFrame.vue";
// MIDDLE, under the header: the admin bug tracker of this session. Agents and the harness file reports with `team report_bug`; they arrive over the WebSocket
// (topic "bugs", pushed only when the file changed). Each row has the session id (copy) and the agent's log file, so an admin does not have to dig.
import { computed, ref } from "vue";
import type { BugsOut } from "../../../shared/experiment";
import { hm } from "./fmt";

const props = defineProps<{ bugs: BugsOut | null }>();
const emit = defineEmits<{ "open-agent": [id: string] }>();
const open = ref(false), copied = ref(""), filter = ref<"all" | "high">("all");
const rows = computed(() => (props.bugs?.reports ?? []).filter((r) => filter.value === "all" || r.severity === "high"));
async function copy(id: string) { try { await navigator.clipboard.writeText(id); copied.value = id; setTimeout(() => (copied.value = ""), 1500); } catch { /* clipboard blocked */ } }
const short = (s: string | null) => (s ? s.slice(0, 8) : "-");
const logName = (f: string | null) => (f ? f.split("/").slice(-1)[0] : "");
</script>

<template>
  <DebugFrame name="BugTracker" hint="experiment/BugTracker.vue">
    <section class="bt" :class="{ has: bugs?.count, hot: bugs?.high }">
      <button type="button" class="bth" :aria-expanded="open" @click="open = !open">
        <span class="chev">{{ open ? "▾" : "▸" }}</span> Bug reports
        <span class="n" :class="{ zero: !bugs?.count }">{{ bugs?.count ?? 0 }}</span>
        <span v-if="bugs?.high" class="n high" title="high severity">{{ bugs.high }} high</span>
        <span class="muted small hint">filed by agents with <code>team report_bug</code>, session id attached</span>
      </button>
      <div v-show="open" class="btb">
        <div v-if="!bugs?.count" class="muted small">No reports in this session.</div>
        <template v-else>
          <div class="tools small"><button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">all</button><button type="button" :class="{ on: filter === 'high' }" @click="filter = 'high'">high only</button></div>
          <article v-for="r in rows" :key="r.id" class="rep" :class="r.severity">
            <header class="small"><span class="sev" :class="r.severity">{{ r.severity }}</span><b>{{ r.kind }}</b>
              <button v-if="r.agent" type="button" class="link" :title="'open ' + r.agent" @click="emit('open-agent', r.agent)">{{ r.agent }}<template v-if="r.role"> · {{ r.role }}</template></button>
              <span v-if="r.reporter && r.reporter !== r.agent" class="muted">reported by {{ r.reporter }}</span>
              <span class="muted when">{{ hm(r.t) }}</span></header>
            <p class="txt">{{ r.text }}</p>
            <footer class="small muted">
              <span>session <code>{{ short(r.session_id) }}</code></span>
              <button v-if="r.session_id" type="button" class="link" @click="copy(r.session_id!)">{{ copied === r.session_id ? "copied" : "copy id" }}</button>
              <span v-if="r.status">· {{ r.status }}<template v-if="r.running_s"> {{ Math.round(r.running_s / 60) }} min</template></span>
              <span v-if="r.log_file" class="log" :title="r.log_file">· log {{ logName(r.log_file) }}</span>
            </footer>
          </article>
        </template>
      </div>
    </section>
  </DebugFrame>
</template>

<style scoped>
.bt { border: 1px solid var(--line, #e3e3e3); border-radius: 8px; margin: 8px 0; background: var(--panel, #f6f6f6); }
.bt.hot { border-color: #d33; }
.bth { all: unset; display: flex; gap: 8px; align-items: center; padding: 6px 10px; cursor: pointer; width: calc(100% - 20px); font-weight: 600; }
.chev { width: 12px; color: var(--mut, #666); }
.n { background: var(--acc, #5753c6); color: #fff; border-radius: 9px; padding: 0 8px; font-size: 11px; }
.n.zero { background: var(--line, #ddd); color: var(--mut, #666); }
.n.high { background: #d33; }
.hint { margin-left: auto; font-weight: 400; }
.btb { padding: 4px 10px 10px; max-height: 320px; overflow: auto; }
.tools { display: flex; gap: 4px; margin-bottom: 6px; }
.tools button { border: 1px solid var(--line, #ddd); background: transparent; border-radius: 6px; padding: 1px 8px; cursor: pointer; color: inherit; }
.tools button.on { background: var(--acc, #5753c6); color: #fff; border-color: transparent; }
.rep { border-left: 3px solid var(--line, #ccc); padding: 4px 8px; margin: 6px 0; background: var(--bg, #fff); border-radius: 0 6px 6px 0; }
.rep.high { border-left-color: #d33; } .rep.medium { border-left-color: #d9a400; }
.rep header, .rep footer { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sev { text-transform: uppercase; font-size: 10px; border-radius: 4px; padding: 0 5px; background: var(--line, #ddd); }
.sev.high { background: #d33; color: #fff; } .sev.medium { background: #d9a400; color: #fff; }
.when { margin-left: auto; }
.txt { margin: 4px 0; white-space: pre-wrap; word-break: break-word; }
.link { all: unset; cursor: pointer; color: var(--acc, #5753c6); text-decoration: underline; }
.log { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
</style>
