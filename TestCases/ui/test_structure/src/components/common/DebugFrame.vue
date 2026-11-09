<script setup lang="ts">
// Wireframe wrapper. debug on: dashed frame + a label with the component name. debug off: renders the slot only.
import { debug } from "@/store/debug";
defineProps<{ name: string; hint?: string }>();
</script>
<template>
  <div v-if="debug" class="dbg">
    <span class="dbg-tag">{{ name }}<template v-if="hint"> · {{ hint }}</template></span>
    <slot />
  </div>
  <slot v-else />
</template>
<style scoped>
.dbg { position:relative; outline:1px dashed var(--dbg); outline-offset:1px; padding-top:14px; }
.dbg-tag { position:absolute; top:0; left:0; background:var(--dbg); color:#fff; font:10px/1 ui-monospace,monospace; padding:2px 5px; border-bottom-right-radius:4px; z-index:5; pointer-events:none; white-space:nowrap; }
</style>
