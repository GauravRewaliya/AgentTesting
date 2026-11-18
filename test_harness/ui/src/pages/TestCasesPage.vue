<script setup lang="ts">
// TestCases: the three kinds of tests apart. Prompt testing (single calls of one agent, no session), Real cases (real use cases and the sub-agent suites; filter by readiness) and Core (the harness pitfalls).
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import DebugFrame from "@/components/common/DebugFrame.vue";
import FlowPage from "@/pages/FlowPage.vue";
import PromptTestingPage from "@/pages/PromptTestingPage.vue";
import { groupOf, loadCards, state } from "@/store/dashboard";
import { loadCatalog, pt } from "@/store/promptTests";
const route = useRoute(), router = useRouter();
const tab = computed<"prompt" | "real" | "core">(() => (["prompt", "real", "core"].includes(String(route.query.tab)) ? (route.query.tab as "prompt" | "real" | "core") : "real"));
const go = (t: string) => router.replace({ query: { ...route.query, tab: t } });
const count = (g: "real" | "core") => state.cards.filter((c) => groupOf(c.group) === g).reduce((n, c) => n + c.cases.length, 0);
onMounted(() => { void loadCards(); void loadCatalog(); });
const tabs = computed(() => [
  { id: "prompt", label: "PromptTesting", n: pt.catalog?.suites.reduce((n, s) => n + s.cases.length, 0) ?? "…", hint: "one short call of one agent; nothing runs" },
  { id: "real", label: "Real cases", n: count("real"), hint: "real use cases and the sub-agent suites" },
  { id: "core", label: "Core", n: count("core"), hint: "the harness pitfalls (ProgressAndFound.md)" },
]);
</script>
<template>
  <DebugFrame name="TestCasesPage">
    <nav class="tabs">
      <button v-for="t in tabs" :key="t.id" :class="{ on: tab === t.id }" :title="t.hint" @click="go(t.id)">{{ t.label }} <span class="n mono">{{ t.n }}</span></button>
    </nav>
    <PromptTestingPage v-if="tab === 'prompt'" />
    <FlowPage v-else :key="tab" :group="tab" />
  </DebugFrame>
</template>
<style scoped>
.tabs { display: flex; gap: 2px; padding: 8px 14px 0; border-bottom: 1px solid var(--line); background: var(--card); }
.tabs button { border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: transparent; padding: 8px 14px; font-weight: 600; } .tabs button.on { border-bottom-color: var(--accent); }
.n { font-size: 11px; color: var(--mute); margin-left: 4px; font-weight: 400; }
</style>
