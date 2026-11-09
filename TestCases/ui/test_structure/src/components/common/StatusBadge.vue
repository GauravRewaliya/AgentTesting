<script setup lang="ts">
import type { Status } from "@/types";
defineProps<{ status: Status }>();
const color: Record<Status, string> = { pass: "var(--pass)", fail: "var(--fail)", skipped: "var(--warn)", never_run: "var(--mute)" };
</script>
<template><span class="b" :style="{ color: color[status], borderColor: color[status] }">{{ status.replace("_", " ") }}</span></template>
<style scoped>.b { border:1px solid; border-radius:99px; padding:0 7px; font-size:11px; white-space:nowrap; }</style>
