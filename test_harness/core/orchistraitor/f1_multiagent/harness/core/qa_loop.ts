// The QA repair loop of the master (tools.ts qa_check / qa_give_up), as plain functions so they can be tested without Docker.
//   A failed check = an ISSUE with a signature (stage + the error messages, line numbers and paths removed).
//   Same signature 3 times in a row (MAX_SAME) = the loop STOPS and the test is marked failed. A different signature starts counting again from 1: new problems are allowed.
//   The master may also GIVE UP at any time (it is never forced to keep going); that marks the test failed too, at once.
//   State lives in <session store folder>/qa_state.json; the judge (testrun/cases.ts judgeTurn) and the UI read it from there.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MAX_SAME = 3;
export interface QaCheckRow { t: number; ok: boolean; stage: string; sig: string; n: number; checkpoint?: string }
export interface QaState { status: "open" | "fixed" | "stopped" | "gave_up"; reason?: string; counts: Record<string, number>; history: QaCheckRow[] }
const file = (dir: string) => join(dir, "qa_state.json");
export const emptyState = (): QaState => ({ status: "open", counts: {}, history: [] });
export function readQa(dir: string): QaState { try { return JSON.parse(readFileSync(file(dir), "utf8")) as QaState; } catch { return emptyState(); } }
export function writeQa(dir: string, s: QaState) { mkdirSync(dir, { recursive: true }); writeFileSync(file(dir), JSON.stringify(s, null, 1) + "\n"); }
export const qaFailed = (s: QaState) => s.status === "stopped" || s.status === "gave_up";

/** The identity of an issue: the stage plus the SET of messages, without line/column numbers, absolute paths and quoted noise. */
export function signature(stage: string, reasons: string[]): string {
  const norm = (r: string) => r.replace(/\(\d+,\d+\)/g, "").replace(/\/pnpm\/[^\s'")]+/g, "<p>").replace(/\b\d+\b/g, "#").replace(/\s+/g, " ").trim().slice(0, 140);
  return stage + "|" + [...new Set(reasons.map(norm))].sort().slice(0, 8).join(" ;; ");
}
/** Record one finished check. Returns how many times THIS issue has now failed and whether the loop must stop. */
export function recordCheck(s: QaState, c: { ok: boolean; stage: string; reasons: string[]; checkpoint?: string }): { n: number; sig: string; stop: boolean } {
  const sig = signature(c.stage, c.reasons);
  if (c.ok) { s.status = "fixed"; s.history.push({ t: Date.now(), ok: true, stage: c.stage, sig: "", n: 0 }); return { n: 0, sig: "", stop: false }; }
  const last = [...s.history].reverse().find((h) => !h.ok), n = last && last.sig === sig ? (s.counts[sig] ?? 0) + 1 : 1;   // "the same issue 3 times" = IN A ROW: a different issue in between starts the count again
  s.counts = { ...s.counts, [sig]: n }; s.history.push({ t: Date.now(), ok: false, stage: c.stage, sig, n, checkpoint: c.checkpoint });
  const stop = n >= MAX_SAME; if (stop) { s.status = "stopped"; s.reason = `the same issue failed ${n} times in a row (${c.stage}): ${c.reasons[0]?.slice(0, 160) ?? ""}`; } else s.status = "open";
  return { n, sig, stop };
}
export function giveUp(s: QaState, why: string) { s.status = "gave_up"; s.reason = `the master gave up: ${why.slice(0, 300)}`; }
/** What the judge says about a session's QA loop; undefined = nothing to report. */
export const qaVerdict = (dir: string): string | undefined => { const s = readQa(dir); return qaFailed(s) ? `QA loop ended failed: ${s.reason}` : undefined; };
