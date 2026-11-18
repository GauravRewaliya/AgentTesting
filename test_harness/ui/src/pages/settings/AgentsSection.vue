<script setup lang="ts">
// Agents: the tree (who may call whom). Defaults are read-only (lock): they can be cloned or disabled. Your agents (and clones) can be edited, moved and deleted.
// Free like Vue Flow: drag a node to place it, drag from the dot under an agent to the dot above another to let it call that agent (an agent may have several callers, no loop check), click a line to remove it.
// Lines are the person's own layer (settings.json edges); the defaults' files are never written, and the server still refuses every write to a default.
import { Handle, Position, VueFlow, type Connection, type Edge, type EdgeMouseEvent, type Node } from "@vue-flow/core";
import { api } from "@/store/api";
import { useLive } from "@/store/live";
import { computed, reactive, ref, watch } from "vue";
import type { SettingsAgent } from "../../../shared/settings";
const { settings } = useLive();
const sel = ref<string | null>("lead"), err = ref(""), busy = ref(false), mode = ref<"" | "new" | "clone">("");
const nf = reactive({ name: "", description: "", model: "sonnet", parent: "lead", prompt: "", writes: false });
const ed = reactive({ description: "", model: "sonnet", prompt: "", writes: false, for: "" });
const agents = computed(() => settings.value?.agents ?? []), cur = computed(() => agents.value.find((a) => a.name === sel.value) ?? null);
watch(cur, (a) => { if (a && ed.for !== a.name) Object.assign(ed, { description: a.description, model: a.model, prompt: a.prompt ?? "", writes: a.writes, for: a.name }); }, { immediate: true });

// A TREE of who may call whom. An agent several others may call (ux-designer: the lead and the planner) is drawn once under EACH caller: the same agent (data.name), a different node (id = its path, e.g. "lead>planner>ux-designer").
const nameOf = (nodeId: string) => nodeId.split(">").pop()!;
const graph = computed(() => {
  const by = new Map(agents.value.map((a) => [a.name, a]));
  type Inst = { id: string; name: string; parent: string | null; depth: number; kids: Inst[]; x: number };
  const insts: Inst[] = [], expand = (name: string, parent: Inst | null, path: string[]): Inst => {
    const i: Inst = { id: path.join(">"), name, parent: parent?.id ?? null, depth: path.length - 1, kids: [], x: 0 }; insts.push(i); parent?.kids.push(i);
    for (const c of by.get(name)?.callees ?? []) if (by.has(c) && !path.includes(c)) expand(c, i, [...path, c]);   // a loop is not drawn again
    return i;
  };
  const roots: Inst[] = [expand("lead", null, ["lead"])];
  for (const a of agents.value) if (!insts.some((i) => i.name === a.name)) roots.push(expand(a.name, null, [a.name]));   // disabled or unattached agents stand alone
  let leaf = 0; const place = (i: Inst): void => { if (!i.kids.length) i.x = leaf++ * 190; else { i.kids.forEach(place); i.x = (i.kids[0]!.x + i.kids.at(-1)!.x) / 2; } }; roots.forEach(place);
  const first = new Set<string>(), nodes: Node[] = [], edges: Edge[] = [];
  for (const i of insts) {
    const a = by.get(i.name)!, primary = !first.has(i.name); first.add(i.name);
    nodes.push({ id: i.id, type: "agent", position: { x: primary && a.x !== undefined ? a.x : i.x, y: primary && a.y !== undefined ? a.y : i.depth * 110 }, data: a });
    if (i.parent) edges.push({ id: i.parent + "=>" + i.id, source: i.parent, target: i.id, type: "smoothstep", animated: !a.disabled });
  }
  return { nodes, edges };
});
async function act(fn: () => Promise<{ ok?: boolean; reason?: string }>) { busy.value = true; err.value = ""; try { const r = await fn(); if (r.ok === false) err.value = r.reason ?? "refused"; return r.ok !== false; } catch (e) { err.value = (e as Error).message; return false; } finally { busy.value = false; } }
const onConnect = (c: Connection) => act(() => api.settingsAgentConnect(nameOf(c.source), nameOf(c.target)));
const dropLine = (from: string, to: string) => act(() => api.settingsAgentDisconnect(from, to));
const resetLines = () => act(() => api.settingsAgentResetLines());
const lineClick = (e: EdgeMouseEvent) => { const f = nameOf(e.edge.source), t = nameOf(e.edge.target); if (confirm(`Remove the line: ${f} can no longer call ${t}?`)) dropLine(f, t); };
const dragged = (e: { node: Node }) => act(() => api.settingsAgentMove(nameOf(e.node.id), { x: Math.round(e.node.position.x), y: Math.round(e.node.position.y) }));
const toggle = (a: SettingsAgent) => act(() => api.settingsAgentToggle(a.name, a.disabled));
const create = async () => { if (await act(() => api.settingsAgentNew({ ...nf }))) { sel.value = nf.name; mode.value = ""; Object.assign(nf, { name: "", description: "", prompt: "", writes: false }); } };
const cloneIt = async () => { if (!cur.value) return; const from = cur.value.name; if (await act(() => api.settingsAgentNew({ clone: from, name: nf.name, parent: nf.parent }))) { sel.value = nf.name; mode.value = ""; nf.name = ""; } };
const save = () => cur.value && act(() => api.settingsAgentEdit(cur.value!.name, { description: ed.description, model: ed.model, prompt: ed.prompt, writes: ed.writes }));
const del = async () => { if (cur.value && confirm(`Delete ${cur.value.name}?`)) { const n = cur.value.name; if (await act(() => api.settingsAgentDelete(n))) sel.value = "lead"; } };
const reparent = (p: string) => cur.value && act(() => api.settingsAgentMove(cur.value!.name, { parent: p }));
const startClone = () => { mode.value = "clone"; nf.name = (cur.value?.name ?? "agent") + "-copy"; nf.parent = cur.value?.parent ?? "lead"; };
const parents = computed(() => agents.value.filter((a) => !a.disabled && a.name !== cur.value?.name));
</script>
<template>
  <div class="ag">
    <h2>Agents <small class="mute">who the lead may call; 🔒 default agents are read-only</small>
      <button class="add" @click="mode = 'new'; nf.parent = 'lead'">+ New agent</button></h2>
    <p v-if="err" class="err">{{ err }}</p>
    <p v-if="!settings" class="mute">Loading…</p>
    <div v-else class="grid">
      <div class="tree">
        <VueFlow :nodes="graph.nodes" :edges="graph.edges" :min-zoom="0.3" :max-zoom="1.5" :fit-view-on-init="true" :nodes-connectable="true" :edges-updatable="false" @connect="onConnect" @edge-click="lineClick" @node-click="(e: { node: Node }) => (sel = nameOf(e.node.id))" @node-drag-stop="dragged">
          <template #node-agent="{ data }">
            <div class="node" :class="{ off: data.disabled, on: sel === data.name, mine: !data.locked }">
              <Handle type="target" :position="Position.Top" />
              <b>{{ data.locked ? "🔒 " : "✎ " }}{{ data.name }}</b>
              <small>{{ data.disabled ? "disabled" : data.model }}<template v-if="data.cloned_from"> · clone of {{ data.cloned_from }}</template></small>
              <Handle type="source" :position="Position.Bottom" />
            </div>
          </template>
        </VueFlow>
      </div>
      <aside class="panel">
        <template v-if="mode === 'new'">
          <h3>New agent</h3>
          <label>Name<input v-model="nf.name" placeholder="my-reviewer" /></label>
          <label>What it is for <small class="mute">the lead reads this to decide when to call it</small><textarea v-model="nf.description" rows="2"></textarea></label>
          <label>Under<select v-model="nf.parent"><option v-for="a in agents.filter((x) => !x.disabled)" :key="a.name">{{ a.name }}</option></select></label>
          <label>Model<select v-model="nf.model"><option>sonnet</option><option>haiku</option></select></label>
          <label>Instructions <small class="mute">optional</small><textarea v-model="nf.prompt" rows="5"></textarea></label>
          <label class="inl"><input v-model="nf.writes" type="checkbox" /> may write files</label>
          <div class="row"><button :disabled="busy" @click="create">Create</button><button @click="mode = ''">Cancel</button></div>
        </template>
        <template v-else-if="cur">
          <h3>{{ cur.name }} <span class="pill">{{ cur.locked ? "🔒 default" : cur.cloned_from ? "clone" : "yours" }}</span> <span v-if="cur.disabled" class="pill off">disabled</span></h3>
          <template v-if="mode === 'clone'">
            <label>Name of the copy<input v-model="nf.name" /></label>
            <label>Under<select v-model="nf.parent"><option v-for="a in agents.filter((x) => !x.disabled)" :key="a.name">{{ a.name }}</option></select></label>
            <div class="row"><button :disabled="busy" @click="cloneIt">Clone</button><button @click="mode = ''">Cancel</button></div>
          </template>
          <template v-else>
            <label>Description<textarea v-model="ed.description" rows="3" :readonly="cur.locked"></textarea></label>
            <div class="two"><label>Model<select v-model="ed.model" :disabled="cur.locked"><option>sonnet</option><option>haiku</option></select></label>
              <label>Under<select :value="cur.parent ?? ''" :disabled="cur.name === 'lead'" @change="reparent(($event.target as HTMLSelectElement).value)"><option v-if="!cur.parent" value="">(top)</option><option v-for="a in parents" :key="a.name">{{ a.name }}</option></select></label></div>
            <label class="inl"><input v-model="ed.writes" type="checkbox" :disabled="cur.locked" /> may write files</label>
            <p class="mute small">Tools: {{ cur.tools.join(", ") || "none" }}</p>
            <div class="lines">
              <b class="small">Can call</b>
              <span v-for="c in cur.callees" :key="c" class="pill">{{ c }} <a title="remove this line" @click="dropLine(cur.name, c)">×</a></span>
              <span v-if="!cur.callees.length" class="mute small">nobody</span>
              <select @change="(e) => { const v = (e.target as HTMLSelectElement).value; if (v) act(() => api.settingsAgentConnect(cur!.name, v)); (e.target as HTMLSelectElement).value = ''; }"><option value="">+ let it call…</option><option v-for="a in agents.filter((x) => x.name !== cur!.name && !cur!.callees.includes(x.name))" :key="a.name">{{ a.name }}</option></select>
              <b class="small">Called by</b>
              <span v-for="c in cur.callers ?? []" :key="c" class="pill">{{ c }} <a title="remove this line" @click="dropLine(c, cur.name)">×</a></span>
              <span v-if="!(cur.callers ?? []).length" class="mute small">nobody</span>
              <button class="small" :disabled="busy" @click="resetLines">Reset all lines to the defaults</button>
            </div>
            <details :open="!cur.locked"><summary>Instructions</summary><textarea v-model="ed.prompt" rows="10" :readonly="cur.locked" class="mono"></textarea></details>
            <div class="row">
              <button v-if="!cur.locked" :disabled="busy" @click="save">Save</button>
              <button v-if="cur.name !== 'lead'" :disabled="busy" @click="startClone">Clone</button>
              <button v-if="cur.name !== 'lead'" :disabled="busy" @click="toggle(cur)">{{ cur.disabled ? "Enable" : "Disable" }}</button>
              <button v-if="!cur.locked" class="danger" :disabled="busy" @click="del">Delete</button>
            </div>
            <p v-if="cur.locked" class="mute small">Default agents cannot be edited. Clone one to change it.</p>
          </template>
        </template>
      </aside>
    </div>
  </div>
</template>
<style scoped>
.ag { display: grid; gap: 12px; } h2 { margin: 0; display: flex; align-items: baseline; gap: 10px; } h3 { margin: 0 0 6px; } small { font-weight: 400; font-size: 12px; } .mute { color: var(--mute); } .small { margin: 0; }
.add { margin-left: auto; } .err { color: #f04438; margin: 0; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 14px; } .tree { height: 560px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
.node { padding: 7px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); display: grid; min-width: 130px; cursor: pointer; } .node.mine { border-style: dashed; } .node.on { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); } .node.off { opacity: .45; }
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 10px; align-content: start; max-height: 620px; overflow: auto; }
.panel label { display: grid; gap: 3px; font-size: 12px; color: var(--mute); } .panel textarea, .panel select { font: inherit; width: 100%; box-sizing: border-box; } .inl { display: flex !important; align-items: center; gap: 6px; } .inl input { width: auto; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .row { display: flex; gap: 8px; flex-wrap: wrap; } .danger { color: #f04438; border-color: #f04438; }
.lines { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; } .lines b { flex-basis: 100%; } .lines a { cursor: pointer; color: #f04438; margin-left: 4px; } .lines select { font-size: 11px; }
.pill { font-size: 11px; padding: 1px 8px; border: 1px solid var(--line); border-radius: 999px; font-weight: 400; } .pill.off { color: #f79009; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
