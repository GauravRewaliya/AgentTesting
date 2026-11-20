// Runs of the f1 runner (the same command as the CLI and the Experiment page). The panel and the Run button always follow the SELECTED node: its chain, which steps already ran, and only the runs that touch that chain.
// One run at a time (two runs share a session store), so the button is disabled while ANY run goes, but "running" is shown only on the chain it belongs to.
import { computed, reactive, watch } from "vue";
import { useLive } from "./live";
import type { CaseRuns, SessionRun, StateRun } from "@/types";
import { api } from "./api";
import { loadCards, state } from "./dashboard";

export const runState = reactive({
  run: null as StateRun | null, log: "", error: "",
  caseRuns: null as CaseRuns | null,   // the selected case: its chain, step states, result and the runs that touched the chain
  all: [] as SessionRun[],             // latest runs (the CLI's and the UI's)
  caseId: "" as string,
});
const live = useLive();   // runs, their logs and the selected case's runs arrive over the ONE socket (topic `runs`): nothing here polls
let following = false;
const touches = (r: { cases: string[] }, chain: string[]) => r.cases.some((c) => chain.includes(c));
const chainNow = () => runState.caseRuns?.chain ?? [];

export async function loadCaseRuns(caseId: string) { runState.caseId = caseId; try { const x = await api.caseRuns(caseId); if (runState.caseId === caseId) runState.caseRuns = x; } catch (e) { runState.error = (e as Error).message; } }
export async function loadAllRuns() { try { runState.all = await api.runs(); } catch (e) { runState.error = (e as Error).message; } }
const refreshLists = async () => { await Promise.all([loadCards(), loadAllRuns(), runState.caseId ? loadCaseRuns(runState.caseId) : Promise.resolve()]); };

/** Tell the server what this page looks at (all runs; the open run's log; the selected case's runs). The server pushes when one of them changes. */
const rewatch = () => live.runsWatch({ runs: true, runLog: runState.run?.id, runCase: runState.caseId || undefined });
const follow = () => { if (!following) { following = true; live.start(); } rewatch(); };
/** The page is gone: close our use of the socket. */
export function pauseRuns() { if (following) { following = false; live.runsWatch({}); live.stop(); } }

let wasRunning = false;
watch(live.runs, (d) => {   // a push: take the lists, the open run and the selected case from it; when the last run ended reload the cards (the status of every node)
  if (!d) return;
  if (Array.isArray(d.all)) runState.all = d.all;
  if (d.log && "run" in d.log && runState.run && d.log.run.id === runState.run.id) { runState.run = d.log.run; runState.log = d.log.log; }
  if (d.caseRuns && runState.caseId && d.caseRuns.chain !== undefined) runState.caseRuns = d.caseRuns;
  const now = runState.all.some((r) => r.status === "running");
  if (wasRunning && !now) void loadCards();
  wasRunning = now;
});

/** Pick up a run that is already going (page reload, or a run started from the CLI). */
export async function resumeRuns() { follow(); try { await loadAllRuns(); } catch { /* the API may be down */ } }

export async function runCase(caseId: string) {
  runState.error = ""; runState.log = "";
  try { runState.run = await api.runCase(caseId); await loadAllRuns(); follow(); } catch (e) { runState.error = (e as Error).message; }
}
/** Show a finished (or running) run's log. */
export async function viewRun(id: string) {
  runState.error = "";
  try { const x = await api.runLog(id); runState.run = x.run; runState.log = x.log; follow(); } catch (e) { runState.error = (e as Error).message; }
}
export async function stopRun() { const r = runState.run ?? runHere.value; if (r) { try { runState.run = await api.runStop(r.id); await refreshLists(); } catch (e) { runState.error = (e as Error).message; } } }

/** Another node was picked: nothing of the previous one stays (log, details, "running"). A run that touches the new chain is picked up again once its chain is known. */
watch(() => state.selectedCaseId, (id) => {
  runState.run = null; runState.log = ""; runState.error = ""; runState.caseRuns = null; runState.caseId = id ?? ""; if (following) rewatch();
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
