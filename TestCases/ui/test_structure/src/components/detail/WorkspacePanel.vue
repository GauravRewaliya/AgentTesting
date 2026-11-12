<script setup lang="ts">
// run(): break the saved workspace on purpose (on a scratch copy, never in .state), see what differs,
// and get the follow-up to send to the persisted session so the agent recreates it.
import { computed, onMounted, ref } from "vue";
import { api } from "@/store/api";
import type { WorkspaceSnap } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ caseId: string; leadSessionId: string | null }>();
const snap = ref<WorkspaceSnap | null>(null), err = ref(""), open = ref<{ path: string; text: string } | null>(null);
const newPath = ref(""), newText = ref("");
const guard = async (f: () => Promise<WorkspaceSnap>) => { try { err.value = ""; snap.value = await f(); } catch (e) { err.value = (e as Error).message; } };
onMounted(() => guard(() => api.ws(props.caseId)));
const remove = (path: string) => guard(() => api.wsMutate(props.caseId, [{ op: "remove", path }]));
const add = () => guard(() => api.wsMutate(props.caseId, [{ op: "add", path: newPath.value, content: newText.value }])).then(() => { newPath.value = ""; newText.value = ""; });
const view = async (path: string) => (open.value = { path, text: (await api.wsFile(props.caseId, path, true)).text });
const edit = () => open.value && guard(() => api.wsMutate(props.caseId, [{ op: "edit", path: open.value!.path, content: open.value!.text + "\n// accidental edit" }]));
const prompt = computed(() => {
  const s = snap.value; if (!s?.hasScratch) return "";
  const parts = [s.removed.length && `these files were deleted: ${s.removed.join(", ")}`, s.edited.length && `these files were changed by accident: ${s.edited.join(", ")}`, s.added.length && `these files appeared that you did not create: ${s.added.join(", ")}`].filter(Boolean);
  return parts.length ? `The workspace changed since you finished: ${parts.join("; ")}. Check the workspace and restore it to what you produced before. Tell me what you recreated.` : "";
});
</script>
<template>
  <DebugFrame name="WorkspacePanel">
    <div class="ws">
      <p class="muted">Saved workspace: <code>.state/…/sessions/fx_{{ caseId }}/workspace</code> (read-only). Changes below go to a scratch copy.</p>
      <p v-if="err" style="color:var(--fail)">{{ err }}</p>
      <template v-if="snap">
        <div v-for="f in snap.current" :key="f" class="f"><code :class="{ ed: snap.edited.includes(f), ad: snap.added.includes(f) }">{{ f }}</code>
          <button @click="view(f)">view</button><button @click="remove(f)">remove</button></div>
        <div v-for="f in snap.removed" :key="'r' + f" class="f"><code class="rm">{{ f }}</code> <span class="muted">removed</span></div>
        <div v-if="open" class="view"><b>{{ open.path }}</b><textarea v-model="open.text" rows="5" /><button @click="edit">save as accidental edit</button></div>
        <div class="add"><input v-model="newPath" placeholder="new file path, e.g. notes/extra.md" /><input v-model="newText" placeholder="content" /><button :disabled="!newPath" @click="add">add file</button></div>
        <button v-if="snap.hasScratch" @click="guard(() => api.wsReset(caseId))">reset scratch</button>
        <div v-if="prompt" class="pr"><b>Follow-up for the persisted session</b> <span class="muted">(--resume {{ leadSessionId?.slice(0, 8) }}…)</span><pre>{{ prompt }}</pre>
          <span class="muted">Sending it runs a real Claude session; this page only prepares it.</span></div>
      </template>
    </div>
  </DebugFrame>
</template>
<style scoped>.ws { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px; } .f { display:flex; gap:6px; align-items:center; margin:2px 0; } .f code { margin-right:auto; } .ed { color:var(--warn); } .ad { color:var(--pass); } .rm { color:var(--fail); text-decoration:line-through; } .add { display:flex; gap:4px; margin:8px 0; } .pr pre { white-space:pre-wrap; background:var(--bg); padding:6px; border-radius:6px; } .view { margin:6px 0; }</style>
