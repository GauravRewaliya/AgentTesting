<script setup lang="ts">
// The checks that run before run(): listed, editable (value), removable. A query failing any rule is rejected.
import type { BeforeRunRule } from "@/types";
import DebugFrame from "@/components/common/DebugFrame.vue";
const props = defineProps<{ rules: BeforeRunRule[] }>();
const remove = (id: string) => props.rules.splice(props.rules.findIndex((r) => r.id === id), 1);
const add = () => props.rules.push({ id: `r${Date.now()}`, kind: "must_contain", value: "", message: "new rule" });
</script>
<template>
  <DebugFrame name="BeforeRunRules">
    <div class="rules">
      <div v-for="r in rules" :key="r.id" class="rule">
        <select v-model="r.kind"><option>must_contain</option><option>must_not_contain</option><option>min_chars</option><option>max_chars</option></select>
        <input v-model="r.value" /><input v-model="r.message" class="msg" /><button @click="remove(r.id)">×</button>
      </div>
      <button @click="add">+ rule</button>
    </div>
  </DebugFrame>
</template>
<style scoped>.rule { display:grid; grid-template-columns:120px 1fr 1.4fr auto; gap:4px; margin-bottom:4px; } select { font:inherit; color:inherit; background:var(--card); border:1px solid var(--line); border-radius:6px; }</style>
