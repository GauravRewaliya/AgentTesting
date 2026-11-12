// The one store. Components read `state` and call these actions; nothing else holds shared state.
import { computed, reactive } from "vue";
import type { AgentInfo, CardOut, CaseProfile, Health, ResponseRow, Status, Usage } from "@/types";
import { api } from "./api";

export const state = reactive({
  cards: [] as CardOut[],
  agents: [] as AgentInfo[],
  responses: [] as ResponseRow[],
  health: null as Health | null,
  usage: {} as Record<string, Usage>,
  error: "",
  statusFilter: new Set<Status>(),
  query: "",
  mode: "all" as "all" | "multi" | "solo",
  onlyMultiPrompt: false,
  onlyMultiSession: false,
  head: "__first" as string | null, // chosen head (root card id or standalone card id); null = all heads
  selectedCaseId: null as string | null,
  // sub-agent workbench (shared by the right panel and the full page)
  panelOpen: true,
  rightTab: "agents" as "agents" | "runs", // Flow page right side: the sub-agent workbench or the session runs
  agent: null as string | null, // sidebar selection; null = all
  responseId: null as string | null, // null = show the index, set = show that response's page
});

const guard = async <T>(f: () => Promise<T>) => { try { state.error = ""; return await f(); } catch (e) { state.error = (e as Error).message; } };
export const loadCards = () => guard(async () => (state.cards = await api.cards()));
export const loadSubagents = () => guard(async () => { const r = await api.subagents(); state.agents = r.agents; state.responses = r.responses; state.usage = await api.usage(); });
export const runHealth = () => guard(async () => (state.health = await api.health()));

export const selectCase = (id: string | null) => (state.selectedCaseId = id);
export const openAgent = (name: string | null) => { state.agent = name; state.responseId = null; state.panelOpen = true; };
export const openResponse = (id: string) => { state.responseId = id; state.panelOpen = true; };
export const backToIndex = () => (state.responseId = null);

const matches = (c: { caseId: string; title: string; status: Status; profile: CaseProfile }) =>
  (!state.statusFilter.size || state.statusFilter.has(c.status)) &&
  (state.mode === "all" || c.profile.agentMode === state.mode) &&
  (!state.onlyMultiPrompt || c.profile.multiPrompt) &&
  (!state.onlyMultiSession || c.profile.multiSession) && (!state.query || `${c.caseId} ${c.title}`.toLowerCase().includes(state.query.toLowerCase()));
/** A head = a root chain card (or a suite's standalone group) plus everything connected below it. */
export const heads = computed(() => {
  const kids = new Map<string, CardOut[]>();
  for (const c of state.cards) if (c.parentCard) kids.set(c.parentCard, [...(kids.get(c.parentCard) ?? []), c]);
  const tree = (c: CardOut): CardOut[] => [c, ...(kids.get(c.id) ?? []).flatMap(tree)];
  return state.cards.filter((c) => !c.parentCard).map((c) => ({ card: c, tree: tree(c), cases: tree(c).reduce((n, k) => n + k.cases.length, 0) }));
});
export const activeHead = computed(() => (state.head === "__first" ? heads.value.find((h) => h.card.kind === "chain")?.card.id ?? null : state.head));
export const selectHead = (id: string | null) => (state.head = id);
const inHead = computed(() => new Set(activeHead.value ? heads.value.find((h) => h.card.id === activeHead.value)?.tree.map((c) => c.id) : state.cards.map((c) => c.id)));
export const visibleCards = computed(() =>
  state.cards.filter((c) => inHead.value.has(c.id)).map((k) => ({ ...k, cases: k.cases.filter(matches) })).filter((k) => k.cases.length),
);
export const visibleResponses = computed(() => state.responses.filter((r) => !state.agent || r.agent === state.agent));
export const currentAgent = computed(() => state.agents.find((a) => a.name === state.agent) ?? null);
export const currentResponse = computed(() => state.responses.find((r) => r.id === state.responseId) ?? null);
export const agentOfLabel = (label: string) => label.split("#")[0]!;
