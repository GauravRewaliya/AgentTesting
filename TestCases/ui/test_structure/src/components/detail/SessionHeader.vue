<script setup lang="ts">
// [ Test: .. , at: .. , test_session_id: .. , harness_name: .. , workspace_id: .. ]
import type { CaseDetail } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
import SessionId from "@/components/common/SessionId.vue";
import ProfileBadges from "@/components/common/ProfileBadges.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
defineProps<{ s: CaseDetail }>();
</script>
<template>
  <DebugFrame name="SessionHeader">
    <div class="hd">
      <h2>{{ s.title }} <StatusBadge :status="s.status" /></h2>
      <dl>
        <dt>Test</dt><dd>{{ s.caseId }} <span class="muted">({{ s.suite }})</span></dd>
        <dt>kind</dt><dd><ProfileBadges :p="s.profile" /> {{ s.profile.kind }} <span v-if="s.profile.subAgents.length" class="muted">· sub-agents: {{ s.profile.subAgents.join(", ") }}</span></dd>
        <dt>at</dt><dd>{{ s.at ?? "never run" }}</dd>
        <dt>test_session_id</dt><dd><SessionId v-if="s.leadSessionId" :id="s.leadSessionId" /><span v-else class="muted">none yet</span></dd>
        <dt>harness_name</dt><dd>mod <span class="muted">(default; the run does not record which harness)</span></dd>
        <dt>workspace_id</dt><dd><SessionId :id="`${s.home ?? '(not run yet)'}/workspace`" /></dd>
        <dt>continues</dt><dd><router-link v-if="s.after" :to="{ name: 'test', params: { caseId: s.after } }">{{ s.after }}</router-link><span v-else class="muted">root</span> <span v-if="s.relation && s.relation !== 'root'" class="muted">· {{ s.relation === "same_session" ? "same lead session id as parent" : "different lead session id (cloned)" }}</span></dd>
      </dl>
      <div v-for="(t, i) in s.turns" :key="i" class="turn"><b>turn {{ i + 1 }}</b> {{ t.user }}<br /><span class="mono muted">expected {{ t.expectedAgents.join(", ") }} · actual {{ t.actualAgents.join(", ") || "–" }}</span> <span v-if="t.match === true" style="color:var(--pass)">✓</span><span v-else-if="t.match === false" style="color:var(--fail)">✗</span></div>
    </div>
  </DebugFrame>
</template>
<style scoped>.hd { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 14px; } h2 { margin:0 0 6px; } dl { display:grid; grid-template-columns:130px 1fr; gap:2px 8px; margin:0 0 8px; } dt { color:var(--mute); } dd { margin:0; } .turn { border-top:1px solid var(--line); padding:4px 0; }</style>
