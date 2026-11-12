// Runs of the fixture-mock runner (second kind of run; the first is ExperimentRun). One run at a time. While one is going we poll its log; when it ends the cards and the case's run list are reloaded.
import { computed, reactive } from "vue";
import type { CaseRuns, SessionRun, StateRun } from "@/types";
import { api } from "./api";
import { loadCards } from "./dashboard";

export const runState = reactive({
  run: null as StateRun | null, log: "", error: "",
  caseRuns: null as CaseRuns | null,   // the current result, the archived ones and the session runs of the case on the page
  all: [] as SessionRun[],             // every session run (Flow page, right tab "runs")
  caseId: "" as string,
});
let timer: ReturnType<typeof setInterval> | undefined;

export async function loadCaseRuns(caseId: string) { runState.caseId = caseId; try { runState.caseRuns = await api.caseRuns(caseId); } catch (e) { runState.error = (e as Error).message; } }
export async function loadAllRuns() { try { runState.all = await api.runs(); } catch (e) { runState.error = (e as Error).message; } }
const refreshLists = async () => { await Promise.all([loadCards(), loadAllRuns(), runState.caseId ? loadCaseRuns(runState.caseId) : Promise.resolve()]); };

const poll = async () => {
  const r = runState.run; if (!r) return;
  try {
    const x = await api.runLog(r.id); runState.run = x.run; runState.log = x.log;
    if (x.run.status !== "running") { clearInterval(timer); timer = undefined; await refreshLists(); }
  } catch (e) { runState.error = (e as Error).message; clearInterval(timer); timer = undefined; }
};
const follow = () => { clearInterval(timer); timer = setInterval(poll, 1500); void poll(); };

/** Pick up a run that is already going (page reload). */
export async function resumeRuns() {
  try { await loadAllRuns(); const r = runState.all.find((x) => x.status === "running"); if (r && runState.run?.id !== r.id) { runState.run = r; follow(); } } catch { /* the API may be down */ }
}
export async function runCase(caseId: string, rerun = false) {
  runState.error = ""; runState.log = "";
  try { runState.run = await api.runCase(caseId, rerun); await loadAllRuns(); follow(); } catch (e) { runState.error = (e as Error).message; }
}
/** Show a finished (or running) session run's log. */
export async function viewRun(id: string) {
  runState.error = "";
  try { const x = await api.runLog(id); runState.run = x.run; runState.log = x.log; if (x.run.status === "running") follow(); } catch (e) { runState.error = (e as Error).message; }
}
export async function stopRun() { if (runState.run) { try { runState.run = await api.runStop(runState.run.id); await refreshLists(); } catch (e) { runState.error = (e as Error).message; } } }
export const isRunning = computed(() => runState.run?.status === "running");
export const runsCase = (caseId: string) => !!runState.run && runState.run.status === "running" && runState.run.cases.includes(caseId);
