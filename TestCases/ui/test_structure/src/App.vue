<script setup lang="ts">
import { debug } from "@/store/debug";
</script>
<template>
  <header class="top">
    <strong>Test_agent_3</strong>
    <router-link to="/">Flow</router-link><router-link to="/subagents">Sub-agents</router-link>
    <label class="dbgsw"><input v-model="debug" type="checkbox" /> Debug (D)</label>
  </header>
  <router-view />
</template>
<style scoped>
.top { display:flex; gap:14px; align-items:center; height:48px; padding:0 14px; background:var(--card); border-bottom:1px solid var(--line); }
.dbgsw { margin-left:auto; display:flex; gap:6px; align-items:center; } .dbgsw input { width:auto; }
</style>
