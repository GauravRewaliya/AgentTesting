<script setup lang="ts">
// Draws layout(): strict levels top to bottom (see layout.ts). vue-flow gives pan, zoom and drag.
import { computed } from "vue";
import { VueFlow, type Edge, type Node } from "@vue-flow/core";
import { visibleCards } from "@/store/dashboard";
import DebugFrame from "@/components/common/DebugFrame.vue";
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
</script>
<template>
  <DebugFrame name="FlowCanvas" hint="vue-flow, strict levels">
    <div class="canvas">
      <VueFlow :nodes="graph.nodes" :edges="graph.edges" :min-zoom="0.15" :max-zoom="1.5" fit-view-on-init>
        <template #node-case="p"><CaseNode :data="p.data" /></template>
        <template #node-label="p"><LabelNode :data="p.data" /></template>
      </VueFlow>
    </div>
  </DebugFrame>
</template>
<style scoped>.canvas { height:calc(100vh - 140px); }</style>
