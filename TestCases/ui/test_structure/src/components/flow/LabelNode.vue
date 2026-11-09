<script setup lang="ts">
// Caption: a level marker on the left (L0 fresh, L1 follow-up …) or a suite title above standalone tests.
import DebugFrame from "@/components/common/DebugFrame.vue";
defineProps<{ data: { title: string; width: number } }>();
</script>
<template>
  <DebugFrame name="LabelNode"><div class="lb" :style="{ width: data.width + 'px' }">{{ data.title }}</div></DebugFrame>
</template>
<style scoped>.lb { font:600 13px system-ui; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }</style>
