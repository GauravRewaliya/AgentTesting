<script setup lang="ts">
// The stack: test_session_id-workspace_id > lead > each sub-agent session. Click a row to filter the log to it.
import { agentOfLabel, openAgent, openResponse } from "@/store/dashboard";
import type { CaseDetail } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
import SessionId from "@/components/common/SessionId.vue";
defineProps<{ s: CaseDetail; selected: string | null }>();
const emit = defineEmits<{ select: [id: string | null] }>();
</script>
<template>
  <DebugFrame name="SessionStack">
    <div class="stack">
      <div class="row" :class="{ on: selected === null }" @click="emit('select', null)"><strong>{{ s.leadSessionId ?? s.caseId }}-{{ s.caseId }}</strong> <span class="muted">all events</span></div>
      <div v-if="s.leadSessionId" class="row" style="padding-left:24px">lead <SessionId :id="s.leadSessionId" /> <span class="muted">(Claude session; its own tool calls are in the Claude transcript, not .state)</span></div>
      <div v-for="x in s.subSessions" :key="x.id" class="row" :class="{ on: selected === x.id }" style="padding-left:44px" @click="emit('select', x.id)">
        └ <strong>{{ x.label }}</strong> <SessionId :id="x.id" />
        <span v-if="x.inherited" class="muted">↩ created in <router-link :to="{ name: 'test', params: { caseId: x.ownerCase } }" @click.stop>{{ x.ownerCase }}</router-link></span>
        <button v-if="x.fixture" @click.stop="openResponse(x.fixture)">fixture {{ x.fixture }} ›</button>
        <button @click.stop="openAgent(agentOfLabel(x.label))">agent ›</button>
      </div>
      <div v-if="!s.subSessions.length" class="row muted" style="padding-left:44px">no sub-agent sessions</div>
    </div>
  </DebugFrame>
</template>
<style scoped>.stack { background:var(--card); border:1px solid var(--line); border-radius:10px; } .row { padding:6px 10px; border-top:1px solid var(--line); cursor:pointer; } .row:first-child { border-top:0; } .on { background:color-mix(in srgb, var(--accent) 12%, transparent); }</style>
