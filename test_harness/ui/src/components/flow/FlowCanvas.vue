<script setup lang="ts">
// Draws layout(): strict levels top to bottom (see layout.ts). vue-flow gives pan, zoom and drag.
import { computed, ref } from "vue";
import { VueFlow, type Edge, type Node } from "@vue-flow/core";
import { state, visibleCards } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
import RunsSidebar from "@/components/detail/RunsSidebar.vue";
import CaseNode from "./CaseNode.vue";
import LabelNode from "./LabelNode.vue";
import { layout } from "./layout.js";

const graph = computed(() => {
  const l = layout(visibleCards.value);
  const nodes: Node[] = [
    ...l.captions.map((c) => ({ id: c.id, type: "label", position: { x: c.x, y: c.y }, selectable: false, draggable: false, data: { title: c.title, width: c.width } })),
    ...l.boxes.map((b) => ({ id: b.id, type: "case", position: { x: b.x, y: b.y }, data: b.data })),
  ];
  const edges: Edge[] = l.edges.map((e) => ({ ...e, sourceHandle: "b", targetHandle: "t", type: "smoothstep", animated: true }));
  return { nodes, edges };
});
const runsOpen = ref(true);
// fit the graph with less padding than the default (0.1) = a bit zoomed in
const onReady = (i: { fitView: (o: { padding: number }) => void }) => i.fitView({ padding: 0.02 });
</script>
<template>
  <DebugFrame name="FlowCanvas" hint="vue-flow, strict levels">
    <div class="canvas">
      <aside class="runs" :class="{ closed: !runsOpen }">
        <button class="tgl" :title="runsOpen ? 'collapse runs' : 'show the runs of the selected node'" @click="runsOpen = !runsOpen">{{ runsOpen ? "‹ runs" : "› runs" }}</button>
        <div v-show="runsOpen" class="body"><RunsSidebar :case-id="state.selectedCaseId ?? undefined" /></div>
      </aside>
      <VueFlow :nodes="graph.nodes" :edges="graph.edges" :min-zoom="0.15" :max-zoom="1.5"
        @pane-ready="onReady">
        <template #node-case="p"><CaseNode :data="p.data" /></template>
        <template #node-label="p"><LabelNode :data="p.data" /></template>
      </VueFlow>
    </div>
  </DebugFrame>
</template>
<style scoped>
.canvas { height:calc(100vh - 140px); display:flex; flex-direction:row; }
.canvas > :deep(.vue-flow) { flex:1; min-width:0; }
.runs { width:420px; overflow:auto; background:var(--bg); border-right:1px solid var(--line); z-index:5; }
.runs.closed { width:auto; overflow:visible; }
.tgl { position:sticky; top:0; width:100%; text-align:left; }
.body { padding:0 10px 10px; }
</style>
