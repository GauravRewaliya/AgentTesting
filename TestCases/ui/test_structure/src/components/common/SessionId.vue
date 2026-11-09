<script setup lang="ts">
// A session id you can read short and copy whole.
import { computed, ref } from "vue";
const props = defineProps<{ id: string; label?: string }>();
const short = computed(() => (props.id.length > 14 ? `${props.id.slice(0, 8)}…${props.id.slice(-4)}` : props.id));
const copied = ref(false);
async function copy() {
  try { await navigator.clipboard.writeText(props.id); copied.value = true; setTimeout(() => (copied.value = false), 900); } catch {}
}
</script>
<template>
  <span class="sid"><span v-if="label" class="muted">{{ label }} </span><code :title="id">{{ short }}</code>
    <button class="cp" @click.stop="copy">{{ copied ? "✓" : "copy" }}</button></span>
</template>
<style scoped>.sid { display:inline-flex; gap:4px; align-items:center; } .cp { padding:0 5px; font-size:10px; }</style>
