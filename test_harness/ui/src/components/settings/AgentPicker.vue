<script setup lang="ts">
// "Who may use this": one small button that opens a checklist of agents (like the scope pickers in Claude's own plugin and connector lists).
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
const props = defineProps<{ modelValue: string[]; agents: { name: string; disabled?: boolean }[]; disabled?: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: string[]): void }>();
const open = ref(false), root = ref<HTMLElement | null>(null);
const label = computed(() => (!props.modelValue.length ? "No agents" : props.modelValue.length <= 2 ? props.modelValue.join(", ") : `${props.modelValue.length} agents`));
const toggle = (n: string, on: boolean) => emit("update:modelValue", on ? [...new Set([...props.modelValue, n])] : props.modelValue.filter((x) => x !== n));
const away = (e: MouseEvent) => { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false; };
const esc = (e: KeyboardEvent) => { if (e.key === "Escape") open.value = false; };
onMounted(() => { document.addEventListener("mousedown", away); document.addEventListener("keydown", esc); });
onBeforeUnmount(() => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); });
</script>
<template>
  <div ref="root" class="picker">
    <button class="trigger" :class="{ none: !modelValue.length }" :disabled="disabled" :aria-expanded="open" @click="open = !open">{{ label }} <span class="caret">▾</span></button>
    <div v-if="open" class="panel" role="menu">
      <label v-for="a in agents" :key="a.name" class="item" :class="{ dim: a.disabled }"><input type="checkbox" :checked="modelValue.includes(a.name)" @change="toggle(a.name, ($event.target as HTMLInputElement).checked)" /> {{ a.name }}</label>
    </div>
  </div>
</template>
<style scoped>
.picker { position: relative; display: inline-block; } .trigger { min-width: 112px; text-align: left; display: flex; justify-content: space-between; gap: 8px; } .trigger.none { color: var(--mute); } .caret { color: var(--mute); }
.panel { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 190px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 6px; box-shadow: 0 8px 24px rgba(0, 0, 0, .18); display: grid; }
.item { display: flex; gap: 8px; align-items: center; padding: 5px 8px; border-radius: 5px; cursor: pointer; } .item:hover { background: var(--bg); } .item input { width: auto; } .dim { opacity: .5; }
</style>
