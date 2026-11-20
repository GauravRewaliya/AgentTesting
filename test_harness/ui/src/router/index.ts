import { createRouter, createWebHistory } from "vue-router";
import TestCasesPage from "@/pages/TestCasesPage.vue";
import SubAgentsPage from "@/pages/SubAgentsPage.vue";
import ExperimentPage from "@/pages/ExperimentPage.vue";
import AgentPage from "@/pages/AgentPage.vue";
import AgentConversationPageDeprecated from "@/pages/AgentConversationPageDeprecated.vue";
import BrowserPage from "@/pages/BrowserPage.vue";
import SettingsPage from "@/pages/SettingsPage.vue";
import TestDetailPage from "@/pages/TestDetailPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "flow", component: TestCasesPage },   // TestCases: PromptTesting | Real cases | Core (?tab=prompt|real|core)
    { path: "/subagents", name: "subagents", component: SubAgentsPage },
    { path: "/experiment", name: "experiment", component: ExperimentPage },
    { path: "/experiment/agent", name: "agent", component: AgentPage },   // ?session=<master session>&agent=<agent id>: same three panels as the master
    { path: "/experiment/agent-old", name: "agent-old", component: AgentConversationPageDeprecated },   // DEPRECATED
    { path: "/browser", redirect: "/settings/browser" },   // moved into Settings
    { path: "/settings", name: "settings", component: SettingsPage, redirect: "/settings/agents", children: [
      { path: "agents", component: () => import("@/pages/settings/AgentsSection.vue") },
      { path: "team", component: () => import("@/pages/settings/TeamSection.vue") },
      { path: "integrations", component: () => import("@/pages/settings/IntegrationsSection.vue") },
      { path: "browser", component: BrowserPage },
      { path: "usage", component: () => import("@/pages/settings/UsageSection.vue") },
    ] },
    { path: "/test/:caseId", name: "test", component: TestDetailPage, props: true },
  ],
});
