// Runs of the f1 runner (the same command as the CLI and the Experiment page). The panel and the Run button always follow the SELECTED node: its chain, which steps already ran, and only the runs that touch that chain.
// One run at a time (two runs share a session store), so the button is disabled while ANY run goes, but "running" is shown only on the chain it belongs to.
import { computed, reactive, watch } from "vue";
import type { CaseRuns, SessionRun, StateRun } from "@/types";
import { api } from "./api";
import { loadCards, state } from "./dashboard";

export const runState = reactive({
  run: null as StateRun | null, log: "", error: "",
  caseRuns: null as CaseRuns | null,   // the selected case: its chain, step states, result and the runs that touched the chain
  all: [] as SessionRun[],             // latest runs (the CLI's and the UI's)
  caseId: "" as string,
});
let timer: ReturnType<typeof setInterval> | undefined;
const touches = (r: { cases: string[] }, chain: string[]) => r.cases.some((c) => chain.includes(c));
const chainNow = () => runState.caseRuns?.chain ?? [];

export async function loadCaseRuns(caseId: string) { runState.caseId = caseId; try { const x = await api.caseRuns(caseId); if (runState.caseId === caseId) runState.caseRuns = x; } catch (e) { runState.error = (e as Error).message; } }
export async function loadAllRuns() { try { runState.all = await api.runs(); } catch (e) { runState.error = (e as Error).message; } }
const refreshLists = async () => { await Promise.all([loadCards(), loadAllRuns(), runState.caseId ? loadCaseRuns(runState.caseId) : Promise.resolve()]); };

/** While any run goes: refresh the lists and the open run's log every 1.5 s; when the last one ends reload the cards (status of every node). */
const tick = async () => {
  try {
    await loadAllRuns();
    if (runState.caseId) await loadCaseRuns(runState.caseId);
    if (runState.run) { const x = await api.runLog(runState.run.id); runState.run = x.run; runState.log = x.log; }
    if (!runState.all.some((r) => r.status === "running")) { clearInterval(timer); timer = undefined; await refreshLists(); }
  } catch (e) { runState.error = (e as Error).message; clearInterval(timer); timer = undefined; }
};
const follow = () => { if (!timer) timer = setInterval(tick, 1500); void tick(); };

/** Pick up a run that is already going (page reload, or a run started from the CLI). */
export async function resumeRuns() { try { await loadAllRuns(); if (runState.all.some((r) => r.status === "running")) follow(); } catch { /* the API may be down */ } }

export async function runCase(caseId: string) {
  runState.error = ""; runState.log = "";
  try { runState.run = await api.runCase(caseId); await loadAllRuns(); follow(); } catch (e) { runState.error = (e as Error).message; }
}
/** Show a finished (or running) run's log. */
export async function viewRun(id: string) {
  runState.error = "";
  try { const x = await api.runLog(id); runState.run = x.run; runState.log = x.log; if (x.run.status === "running") follow(); } catch (e) { runState.error = (e as Error).message; }
}
export async function stopRun() { const r = runState.run ?? runHere.value; if (r) { try { runState.run = await api.runStop(r.id); await refreshLists(); } catch (e) { runState.error = (e as Error).message; } } }

/** Another node was picked: nothing of the previous one stays (log, details, "running"). A run that touches the new chain is picked up again once its chain is known. */
watch(() => state.selectedCaseId, (id) => {
  runState.run = null; runState.log = ""; runState.error = ""; runState.caseRuns = null; runState.caseId = id ?? "";
  if (id) void loadCaseRuns(id).then(() => { const r = runState.all.find((x) => x.status === "running" && touches(x, chainNow())); if (r) void viewRun(r.id); });
});

const running = computed(() => runState.all.find((r) => r.status === "running"));
const runHere = computed(() => runState.all.find((r) => r.status === "running" && touches(r, chainNow())));
/** a run goes somewhere (the button is disabled: one run at a time) */
export const isRunning = computed(() => !!running.value);
/** the running run belongs to the selected chain */
export const runsHere = computed(() => !!runHere.value);
export const busyElsewhere = computed(() => !!running.value && !runHere.value);
export const runsCase = (caseId: string) => runState.all.some((r) => r.status === "running" && r.cases.includes(caseId));
/** what pressing ▶ does for the selected chain: nothing ran = run all (first missing step first); a step that ran = its prompts are sent again into its session */
export const chainPlan = computed(() => {
  const st = runState.caseRuns?.steps ?? [], n = st.length, done = st.filter((s) => s.state !== "not_run").length;
  return { n, done, mode: !n || done === 0 ? "all" : "run" } as { n: number; done: number; mode: "all" | "run" };
});
