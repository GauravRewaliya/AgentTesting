// What is sent on a call (plan 5.3): a NEW or rolled session gets the whole brief; a resumed one gets only what is new.
import type { AgentRow, Finding, RequestRow } from "./types.ts";
import type { Store } from "./store.ts";

export interface BriefIn {
  store: Store; task_id: string; row: AgentRow; first: boolean;
  plan?: string; builderSummary?: string; checkCmd?: string; checkOut?: string; prevFindings?: Finding[];
}
const reqLines = (rs: RequestRow[]) => rs.map((r) => `${r.id}: ${r.text}`).join("\n");
const findLines = (fs: Finding[]) => fs.map((f) => `${f.id} [${f.severity}] ${f.text}`).join("\n");

const isOpen = (r: RequestRow) => (r.status ?? "open") === "open";
/** Requests this agent has not seen yet AND that still need doing. */
export function newRequests(i: BriefIn) { return i.store.requestsOf(i.task_id).filter((r) => isOpen(r) && (i.first || r.n > i.row.seen_requests)); }
/** Finished requests: given to a NEW session as context only, so it never redoes or undoes them (the index2.html incident). */
export function doneBefore(i: BriefIn) { return i.first ? i.store.requestsOf(i.task_id).filter((r) => !isOpen(r)) : []; }
export function newFindings(i: BriefIn, onlyValid: boolean) {
  return i.store.openFindings(i.task_id).filter((f) => (i.first || f.n > i.row.seen_findings) && (!onlyValid || f.triage === "valid"));
}
/** Called after a successful call so the next resume sends only what came after. */
export function markSeen(store: Store, task_id: string, row: AgentRow) {
  row.seen_requests = Math.max(0, ...store.requestsOf(task_id).map((r) => r.n));
  row.seen_findings = Math.max(0, ...store.findingsOf(task_id).map((f) => f.n));
}

export function brief(role: string, i: BriefIn): string {
  const rs = newRequests(i), dn = doneBefore(i);
  const done = dn.length ? `ALREADY DONE EARLIER (context only: do not redo it, undo it, or report it as missing; the work for it is in the directory):\n${reqLines(dn)}` : "";
  const head = `TASK ${i.task_id}${i.first ? "" : " (continuing your session)"}`;
  const reqs = [done, rs.length ? `${i.first ? (role === "review" ? "REQUESTS TO CHECK NOW" : "REQUESTS TO DO NOW") : "NEW REQUESTS"}:\n${reqLines(rs)}` : ""].filter(Boolean).join("\n\n");
  const chk = i.checkCmd ? `CHECK COMMAND: ${i.checkCmd}` : "";
  if (role === "plan") {
    const fs = newFindings(i, false);
    return [head, reqs, fs.length ? `FINDINGS TO TRIAGE:\n${findLines(fs)}` : "", i.first ? chk : "",
      "Write the plan now.", fs.length ? `End with: TRIAGE: [{"id":"<finding id>","triage":"valid|conflicts_with_request|out_of_scope|duplicate|needs_person"}] for every finding listed.` : ""]
      .filter(Boolean).join("\n\n");
  }
  if (role === "build") {
    const fs = newFindings(i, true);
    return [head, i.plan ? `PLAN:\n${i.plan}` : "", reqs, fs.length ? `FINDINGS TO FIX:\n${findLines(fs)}` : "", chk,
      `Implement now in the current directory. End with: REPORT: {"summary":"one sentence","files":["changed files"]}`].filter(Boolean).join("\n\n");
  }
  const prev = i.prevFindings?.length ? `YOU RAISED THESE BEFORE. Raise one again only if it is still wrong:\n${findLines(i.prevFindings)}` : "";
  return [head, reqs, i.builderSummary ? `BUILDER SAYS: ${i.builderSummary}` : "", chk, i.checkOut ? `CHECK RESULT:\n${i.checkOut}` : "", prev,
    `Review now. End with: VERDICT: {"pass":true|false,"findings":[{"text":"...","severity":"blocker|major|minor"}]}`].filter(Boolean).join("\n\n");
}
