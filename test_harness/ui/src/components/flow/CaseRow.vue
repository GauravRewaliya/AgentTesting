<script setup lang="ts">
import { useRouter } from "vue-router";
import type { CaseOut } from "@/types";
import { agentOfLabel, openAgent, openResponse, selectCase, state } from "@/store/dashboard";
import { isRunning, runCase, runsCase } from "@/store/runs";
import DebugFrame from "@/components/common/DebugFrame.vue";
import ProfileBadges from "@/components/common/ProfileBadges.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
const props = defineProps<{ row: CaseOut }>();
const router = useRouter();
const open = () => router.push({ name: "test", params: { caseId: props.row.caseId } });
const agentOf = (e: string) => (e.startsWith("session:") ? agentOfLabel(e.slice(8)) : null);
</script>
<template>
  <DebugFrame name="CaseRow" :hint="row.caseId">
    <div class="case nodrag" :class="{ sel: state.selectedCaseId === row.caseId }" @click="selectCase(row.caseId)">
      <div class="head">
        <strong class="ell">{{ row.title.replace(/^\[[^\]]+\]\s*/, "") }}</strong>
        <StatusBadge :status="row.status" />
        <button class="go" :disabled="isRunning" :title="runsCase(row.caseId) ? 'running…' : 'run all steps of this chain (same runner as the CLI)'" @click.stop="runCase(row.caseId, row.ran)">{{ runsCase(row.caseId) ? "…" : "▶" }}</button>
        <button class="go" title="open test page" @click.stop="open">↗</button>
      </div>
      <div class="meta mono muted ell">
        <ProfileBadges :p="row.profile" /> {{ row.caseId }}<span v-if="row.relation && row.relation !== 'root'"> · {{ row.relation === "same_session" ? "resumes parent session" : "cloned session" }}</span>
        <span v-if="row.at"> · {{ row.at.slice(5, 16).replace("T", " ") }}</span>
      </div>
      <div v-if="row.sessionId" class="meta mono muted ell">session {{ row.sessionId }}</div>
      <div v-for="(t, i) in row.turns" :key="i" class="sub">
        <span class="tree">└</span>
        <span class="t ell" :title="t.user">{{ t.user }}</span>
        <span v-if="t.match === true" style="color:var(--pass)">✓</span><span v-else-if="t.match === false" style="color:var(--fail)">✗</span>
        <span class="exp">
          <template v-for="e in t.expectedAgents" :key="e">
            <button v-if="agentOf(e)" class="chip" @click.stop="openAgent(agentOf(e)!)">{{ e }}</button>
            <button v-else-if="state.usage[e]" class="chip fx" title="open this fixture and who depends on it" @click.stop="openResponse(e)">{{ e }}</button>
            <code v-else class="chip plain">{{ e }}</code>
          </template>
        </span>
      </div>
      <div v-if="row.subSessions.length" class="subs">
        <button v-for="s in row.subSessions" :key="s.id" class="chip" :class="{ inh: s.inherited }" :title="`${s.id}${s.fixture ? ' · answered by ' + s.fixture : ''}${s.inherited ? ' · created in ' + s.ownerCase : ''}`" @click.stop="s.fixture && state.usage[s.fixture] ? openResponse(s.fixture) : openAgent(agentOfLabel(s.label))">{{ s.inherited ? "↩ " : "" }}{{ s.label }}</button>
      </div>
    </div>
  </DebugFrame>
</template>
<style scoped>
.case { padding:6px 8px; cursor:pointer; overflow:hidden; } .case:hover { background:color-mix(in srgb, var(--accent) 6%, transparent); }
.sel { background:color-mix(in srgb, var(--accent) 12%, transparent); }
.ell { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.head { display:flex; gap:6px; align-items:center; height:24px; } .head .ell { flex:1; } .go { padding:0 6px; flex-shrink:0; }
.meta { font-size:11px; line-height:16px; height:16px; }
.sub { display:flex; gap:6px; align-items:center; height:22px; padding-left:8px; font-size:12px; white-space:nowrap; } .sub .t { flex:1; color:var(--mute); } .tree { color:var(--mute); flex-shrink:0; }
.exp { display:inline-flex; gap:4px; flex-shrink:0; max-width:55%; overflow:hidden; }
.subs { display:flex; gap:4px; height:26px; padding:4px 0 0 8px; overflow:hidden; white-space:nowrap; }
.chip { font:11px/16px ui-monospace,monospace; padding:0 6px; border-radius:4px; white-space:nowrap; } .inh { opacity:.55; } .fx { border-color:var(--accent); } .plain { border:1px dashed var(--line); color:var(--mute); }
</style>
