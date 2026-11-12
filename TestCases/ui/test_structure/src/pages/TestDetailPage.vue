<script setup lang="ts">
// One test (case) session: header, session stack, log, and the workspace run().
import { ref, watchEffect } from "vue";
import { api } from "@/store/api";
import type { CaseDetail } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
import SessionHeader from "@/components/detail/SessionHeader.vue";
import SessionStack from "@/components/detail/SessionStack.vue";
import EventLog from "@/components/detail/EventLog.vue";
import WorkspacePanel from "@/components/detail/WorkspacePanel.vue";
import RunPanel from "@/components/detail/RunPanel.vue";
import RunsSidebar from "@/components/detail/RunsSidebar.vue";
const props = defineProps<{ caseId: string }>();
const s = ref<CaseDetail | null>(null), picked = ref<string | null>(null), err = ref("");
watchEffect(async () => { try { err.value = ""; s.value = await api.caseDetail(props.caseId); picked.value = null; } catch (e) { s.value = null; err.value = (e as Error).message; } });
</script>
<template>
  <DebugFrame name="TestDetailPage">
    <div class="page">
      <router-link to="/">← flow</router-link>
      <RunPanel :case-id="caseId" />
      <div class="cols">
        <div class="mainc">
          <template v-if="s">
            <SessionHeader :s="s" />
            <h3>Stack</h3><SessionStack :s="s" :selected="picked" @select="picked = $event" />
            <h3>Log</h3><EventLog :s="s" :session-id="picked" />
            <h3>Workspace · run()</h3><WorkspacePanel :key="s.caseId" :case-id="s.caseId" :lead-session-id="s.leadSessionId" />
          </template>
          <p v-else class="muted">{{ err || "no result yet: press ▶ Run above" }}</p>
        </div>
        <RunsSidebar :case-id="caseId" />
      </div>
    </div>
  </DebugFrame>
</template>
<style scoped>.page { max-width:1320px; margin:0 auto; padding:12px; display:grid; gap:8px; } .cols { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:16px; align-items:start; } .mainc { display:grid; gap:8px; min-width:0; } @media (max-width:900px) { .cols { grid-template-columns:1fr; } }</style>
