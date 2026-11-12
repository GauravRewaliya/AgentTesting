// branch_run: a case with `branch: "<parent>"` (TestCases/branch.ts) runs in a BRANCH of the parent's master session.
//   <parent home>/branches/branch_<hex>/   = the parent's session folder WITHOUT `branches/`: it has its workspace, and its store WITHOUT record/ (and without the index)
//   <parent home>/store/index_session.json = the MAIN session's index of its branches: [{ branch, alias, original_claude_id, status }]
//        alias = the case id; status starts `pending`.
// The Claude session of the lead is NOT cloned when the branch is made. When the branch RUNS, `cloneIfPending` looks at its row: still `pending` -> the lead is forked on the fly
// (claude --resume <original> --fork-session --session-id <new>; the CLI finds the original in any project folder), the row gets `original_claude_id` and status `cloned`.
import { randomBytes, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface BranchRow { branch: string; alias: string; original_claude_id: string | null; status: "pending" | "cloned"; created: string }
const indexFile = (parentDir: string) => join(parentDir, "store", "index_session.json");
export const readIndex = (parentDir: string): BranchRow[] => { try { return JSON.parse(readFileSync(indexFile(parentDir), "utf8")); } catch { return []; } };
const writeIndex = (parentDir: string, rows: BranchRow[]) => { mkdirSync(join(parentDir, "store"), { recursive: true }); writeFileSync(indexFile(parentDir), JSON.stringify(rows, null, 1) + "\n"); };

/** Make the branch folder (copy of the parent without `branches/`, store without record/ and index) and add its `pending` row to the MAIN session's index. Returns the branch folder name, relative to the state dir's key of the parent. */
export function branchRun(o: { parentDir: string; alias: string }): { branch: string; dir: string; row: BranchRow } {
  const branch = "branch_" + randomBytes(4).toString("hex"), dir = join(o.parentDir, "branches", branch);
  mkdirSync(dir, { recursive: true });   // copy entry by entry: a folder cannot be copied into a subfolder of itself
  for (const e of readdirSync(o.parentDir)) {
    if (e === "branches") continue;
    cpSync(join(o.parentDir, e), join(dir, e), { recursive: true, filter: (src) => { const r = relative(o.parentDir, src).split(sep).join("/"); return !(r === "store/record" || r === "store/index_session.json"); } });
  }
  const row: BranchRow = { branch, alias: o.alias, original_claude_id: null, status: "pending", created: new Date().toISOString() };
  writeIndex(o.parentDir, [...readIndex(o.parentDir), row]);
  return { branch, dir, row };
}
/** On the branch's run: still `pending` -> make the fork selection for the lead and mark the row `cloned`. Nothing to fork (the parent lead had no Claude session) = undefined. */
export function cloneIfPending(o: { parentDir: string; branch: string; parentClaudeId?: string | null }) {
  const rows = readIndex(o.parentDir), row = rows.find((r) => r.branch === o.branch);
  if (!row || row.status !== "pending") return undefined;
  if (!o.parentClaudeId) return undefined;
  row.original_claude_id = o.parentClaudeId; row.status = "cloned"; writeIndex(o.parentDir, rows);
  return { id: randomUUID(), resume: false, fork_from: o.parentClaudeId };
}
