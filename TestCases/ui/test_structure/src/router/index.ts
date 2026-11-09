import { createRouter, createWebHistory } from "vue-router";
import FlowPage from "@/pages/FlowPage.vue";
import SubAgentsPage from "@/pages/SubAgentsPage.vue";
import TestDetailPage from "@/pages/TestDetailPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "flow", component: FlowPage },
    { path: "/subagents", name: "subagents", component: SubAgentsPage },
    { path: "/test/:caseId", name: "test", component: TestDetailPage, props: true },
  ],
});
