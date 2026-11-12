// The session rule (plan 5.5). One persistent session per agent row; resume sends a delta; a full or lost session rolls to a new one, visibly.
import { randomUUID } from "node:crypto";
import type { AgentRow } from "./types.ts";

export interface Selection { id: string; resume: boolean; rolled?: "full" | "missing"; fork_from?: string }

export function chooseSession(row: AgentRow, cap: number, transcriptExists: (id: string) => boolean = () => true): Selection {
  if (!row.session_id) return { id: randomUUID(), resume: false };
  if (row.resume_count >= cap) return { id: randomUUID(), resume: false, rolled: "full" };
  if (!transcriptExists(row.session_id)) return { id: randomUUID(), resume: false, rolled: "missing" };
  return { id: row.session_id, resume: true };
}
export function afterRun(row: AgentRow, sel: Selection) {
  row.session_id = sel.id;
  row.resume_count = sel.resume && !sel.fork_from ? row.resume_count + 1 : 0;
}
