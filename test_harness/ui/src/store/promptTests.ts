// State of the Prompt testing page: the catalog (one load), the selection and the filters. Results, runs and marks come over the socket (topic `prompttests`, see live.ts).
import { computed, reactive } from "vue";
import { api } from "./api";
import { useLive } from "./live";
import type { PtCase, PtSuite } from "../../shared/prompttests";

export const pt = reactive({ catalog: null as import("../../shared/prompttests").PtCatalog | null, suite: "master_test", selected: null as string | null, tag: "" as string, status: "" as "" | "pass" | "fail" | "never", query: "", error: "", sizes: false, log: "", logId: "", busy: false });
const live = useLive();
export const results = computed(() => live.prompttests.value?.results ?? {});
export const runs = computed(() => live.prompttests.value?.runs ?? []);
export const pmarks = computed(() => live.prompttests.value?.pmarks ?? {});
export const admin = computed(() => live.prompttests.value?.admin ?? []);
export const setPMark = async (id: string, mark: "fixed" | "known" | null) => { try { await api.promptMark(id, mark); live.kick(); } catch (e) { pt.error = (e as Error).message; } };
/** the score of the CURRENT catalog: cases with a result now (a result of a renamed or removed case does not count); `-|-` when nothing ran, `ok` when nothing failed */
export const score = computed(() => { let pass = 0, failed = 0, never = 0, marked = 0; for (const s of pt.catalog?.suites ?? []) for (const c of s.cases) { const v = verdictOf(c.id); if (v === "pass") pass++; else if (v === "fail") { failed++; if (pmarks.value[c.id]) marked++; } else if (v === "never") never++; } return { pass, failed, never, marked, ok: failed === 0 && pass > 0, none: pass + failed === 0 }; });
export const running = computed(() => runs.value.find((r) => r.status === "running") ?? null);
export const loadCatalog = async () => { try { pt.catalog = await api.promptCatalog(); pt.error = ""; } catch (e) { pt.error = (e as Error).message; } };
export const suite = computed<PtSuite | null>(() => pt.catalog?.suites.find((s) => s.name === pt.suite) ?? null);
export const selectedCase = computed<PtCase | null>(() => suite.value?.cases.find((c) => c.id === pt.selected) ?? null);
export type Verdict = "pass" | "fail" | "skip" | "never";
export const verdictOf = (id: string): Verdict => { const r = results.value[id]; return !r ? "never" : r.skipped ? "skip" : r.pass === r.total ? "pass" : "fail"; };
/** the chain of a case: its ancestors from the root, then itself (the history its call is given) */
export const ancestors = (s: PtSuite, c: PtCase): PtCase[] => { const by = new Map(s.cases.map((x) => [x.id, x])), a: PtCase[] = []; for (let p = c.after ? by.get(c.after) : undefined; p; p = p.after ? by.get(p.after) : undefined) a.unshift(p); return a; };
export const depthOf = (s: PtSuite, c: PtCase): number => ancestors(s, c).length;
/** the cases of the suite with the filters applied, in file order; a chained case keeps its parents visible only through the indent */
export const visibleCases = computed(() => {
  const s = suite.value; if (!s) return [];
  const q = pt.query.toLowerCase();
  return s.cases.filter((c) => (!pt.tag || (pt.tag === "no_cost" ? !c.tags.includes("cost") : c.tags.includes(pt.tag))) && (!pt.status || verdictOf(c.id) === pt.status) && (!q || `${c.id} ${c.about} ${c.user_message}`.toLowerCase().includes(q)));
});
export const branchOf = (s: PtSuite, c: PtCase): string => { if (!c.after) return ""; const sibs = s.cases.filter((x) => x.after === c.after); return sibs.length > 1 && sibs[0]!.id !== c.id ? "branch" : ""; };
export const suiteStats = (s: PtSuite) => { let pass = 0, fail = 0, never = 0; for (const c of s.cases) { const v = verdictOf(c.id); if (v === "pass") pass++; else if (v === "fail") fail++; else if (v === "never") never++; } return { pass, fail, never, total: s.cases.length }; };
export async function runSelection(ids: string[], o: { tag?: string; skipTag?: string; runs?: number } = {}) {
  pt.busy = true; pt.error = "";
  try { const r = await api.promptRun({ suite: pt.suite, ids, ...o }); if ("error" in r) pt.error = r.error; else { pt.logId = r.id; pt.log = ""; } live.kick(); } catch (e) { pt.error = (e as Error).message; }
  pt.busy = false;
}
export async function loadLog() { if (!pt.logId) return; try { pt.log = (await api.promptLog(pt.logId)).text; } catch { /* ignore */ } }
