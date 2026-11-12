// Our own copy of every agent's session log. Claude keeps a session at ~/.claude/projects/<folder>/<session>.jsonl, but a writer runs in a temporary git
// worktree and that copy was seen to be GONE afterwards (two builders: session id on record, no file anywhere). So after every run the harness copies the
// log next to the registry: <registry folder>/logs/<task>/<agent>.<session>.jsonl. If Claude's copy is missing when the agent is continued, it is put back.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { projectDirFor, projectsRoot } from "./runner.ts";

export const archiveFile = (storeFile: string, task: string, agent: string, sid: string) => join(dirname(storeFile), "logs", task, `${agent.replace(/[^A-Za-z0-9_-]/g, "_")}.${sid}.jsonl`);
/** Claude's own copy of a session: in the folder of `cwd` first, then in any project folder (the CLI itself looks everywhere on --resume). */
export function findTranscript(sid: string, cwd?: string): string | null {
  if (cwd) { const f = join(projectDirFor(cwd), sid + ".jsonl"); if (existsSync(f)) return f; }
  try { for (const d of readdirSync(projectsRoot())) { const f = join(projectsRoot(), d, sid + ".jsonl"); if (existsSync(f)) return f; } } catch { /* no projects folder */ }
  return null;
}
/** Find a copy by session id alone (any task, any agent): for readers that only know the session. */
export function findArchive(storeFile: string, sid: string): string | null {
  try { const root = join(dirname(storeFile), "logs"); for (const t of readdirSync(root)) for (const f of readdirSync(join(root, t))) if (f.endsWith(`.${sid}.jsonl`)) return join(root, t, f); } catch { /* none yet */ }
  return null;
}
/** Copy Claude's log into the archive. Returns the archive path, or null when Claude has no log for this session. */
export function archiveTranscript(storeFile: string, task: string, agent: string, sid: string, cwd?: string): string | null {
  const src = findTranscript(sid, cwd); if (!src) return null;
  const dst = archiveFile(storeFile, task, agent, sid);
  mkdirSync(dirname(dst), { recursive: true }); copyFileSync(src, dst); return dst;
}
/** Claude's copy is gone but ours exists: put it back where the CLI looks (the folder the session was created in). */
export function restoreFromArchive(storeFile: string, task: string, agent: string, sid: string, cwd: string): boolean {
  if (findTranscript(sid)) return false;
  const a = archiveFile(storeFile, task, agent, sid); if (!existsSync(a)) return false;
  const dst = join(projectDirFor(cwd), sid + ".jsonl");
  mkdirSync(dirname(dst), { recursive: true }); copyFileSync(a, dst); return true;
}
