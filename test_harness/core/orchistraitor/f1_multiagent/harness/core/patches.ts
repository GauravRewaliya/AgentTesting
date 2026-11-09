// agent_patches (plan 23.1): a writer's result is a patch the lead (or the pipeline) applies in queue order, never a silent merge.
import { applyPatch } from "./worktree.ts";
import type { MStore, PatchRow } from "./board.ts";

export function addPatch(store: MStore, p: Omit<PatchRow, "id" | "t" | "state"> & { state?: PatchRow["state"] }): PatchRow {
  // a newer patch from the same agent supersedes its older unapplied one
  for (const o of store.patches) if (o.task_id === p.task_id && o.agent_id === p.agent_id && (o.state === "ready" || o.state === "draft")) o.state = "superseded";
  const row: PatchRow = { id: store.uid("patch_"), t: Date.now(), state: "ready", ...p };
  store.patches.push(row); store.ev("patch.ready", p.task_id, p.agent_id, { files: p.files.length }); store.save(); return row;
}
/** Apply ready patches in creation order. A patch that no longer fits is rejected with the reason and reported; later ones still try. */
export function applyQueue(store: MStore, repo: string, task_id: string): { applied: string[]; rejected: { id: string; agent: string; error: string }[] } {
  const applied: string[] = [], rejected: { id: string; agent: string; error: string }[] = [];
  for (const p of store.patches.filter((x) => x.task_id === task_id && x.state === "ready")) {
    const r = applyPatch(repo, p.text);
    if (r.ok) { p.state = "applied"; applied.push(p.id); store.ev("patch.applied", task_id, p.agent_id, { id: p.id }); }
    else { p.state = "rejected"; p.error = r.error; rejected.push({ id: p.id, agent: p.agent_id, error: r.error ?? "" }); store.ev("patch.conflict", task_id, p.agent_id, { id: p.id, error: r.error }); }
  }
  store.save(); return { applied, rejected };
}
