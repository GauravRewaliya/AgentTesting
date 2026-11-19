// Parallel writers get a git worktree each and return a patch (plan sections 22-23). Bash writes cannot be locked, so a worktree is the real isolation.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { covers } from "./locks.ts";

const git = (cwd: string, args: string[]) => execFileSync("git", ["-C", cwd, "-c", "user.name=h", "-c", "user.email=h@h", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

export function addWorktree(repo: string, label: string): { dir: string; branch: string; base: string } {
  const base = git(repo, ["rev-parse", "HEAD"]).trim();
  const dir = mkdtempSync(join(tmpdir(), `lfwt-${label.replace(/\W/g, "")}-`));
  const branch = `wt/${label.replace(/\W/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
  git(repo, ["worktree", "add", "-q", "-b", branch, dir, "HEAD"]);
  return { dir, branch, base };
}
export function changedFiles(dir: string): string[] {
  return git(dir, ["status", "--porcelain", "--untracked-files=all"]).split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, ""));
}
/** The detective control for Bash writes: any changed file outside the declared writes is a violation. */
export const auditWrites = (dir: string, declared: string[]) => changedFiles(dir).filter((f) => !declared.some((g) => covers(g, f)));
export function patchOf(dir: string, base: string): { text: string; files: string[] } {
  git(dir, ["add", "-A"]);
  return { text: git(dir, ["diff", "--cached", "--binary", base]), files: git(dir, ["diff", "--cached", "--name-only", base]).split("\n").filter(Boolean) };
}
/** `git apply --check` first; the tree is untouched when the patch does not fit. */
export function applyPatch(repo: string, text: string): { ok: boolean; error?: string } {
  if (!text.trim()) return { ok: true };
  const d = mkdtempSync(join(tmpdir(), "lfp-")), f = join(d, "p.patch");
  writeFileSync(f, text);
  try {
    const c = spawnSync("git", ["-C", repo, "apply", "--check", "--whitespace=nowarn", f], { encoding: "utf8" });
    if (c.status !== 0) return { ok: false, error: (c.stderr || c.stdout).trim().slice(0, 300) };
    const a = spawnSync("git", ["-C", repo, "apply", "--whitespace=nowarn", f], { encoding: "utf8" });
    return a.status === 0 ? { ok: true } : { ok: false, error: (a.stderr || a.stdout).trim().slice(0, 300) };
  } finally { rmSync(d, { recursive: true, force: true }); }
}
export function removeWorktree(repo: string, dir: string, branch: string) {
  try { git(repo, ["worktree", "remove", "--force", dir]); } catch { rmSync(dir, { recursive: true, force: true }); }
  try { git(repo, ["branch", "-D", branch]); } catch { /* already gone */ }
}

/** The QA agent's THROWAWAY copy: exactly what is on disk now in run_test/ (committed or not), without node_modules, builds, git and QA output. A plain copy, not a worktree: a worktree starts from the last commit and misses uncommitted work. Deleted after the call. */
export function scratchCopy(repo: string, label: string): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), `lfqa-${label.replace(/\W/g, "")}-`)), src = join(repo, "run_test");
  if (existsSync(src)) cpSync(src, join(dir, "run_test"), { recursive: true, filter: (p) => !/(^|\/)(node_modules|\.git|dist|_shots|_qa|\.vite|\.expo)(\/|$)/.test(p.slice(src.length)) });
  // what changed, as the real `git diff` (the copy has no .git): CHANGES.diff next to run_test/ (tracked files; new files are listed), capped, so QA can review the code too
  try {
    const d = spawnSync("git", ["-C", repo, "diff", "HEAD", "--", "run_test"], { encoding: "utf8", maxBuffer: 20_000_000 }), u = spawnSync("git", ["-C", repo, "ls-files", "--others", "--exclude-standard", "--", "run_test"], { encoding: "utf8" });
    const text = (d.stdout || "").replace(/^diff --git[^\n]*node_modules[^\n]*\n(?:(?!diff --git).*\n?)*/gm, "").slice(0, 200_000), fresh = (u.stdout || "").split("\n").filter((x) => x && !/node_modules|(^|\/)(dist|_shots|_qa)\//.test(x)).slice(0, 200);
    if (text.trim() || fresh.length) writeFileSync(join(dir, "CHANGES.diff"), text + (fresh.length ? `\n# NEW FILES (not in git yet, read them in run_test/):\n${fresh.join("\n")}\n` : ""));
  } catch { /* no git here: no diff, QA reads the files */ }
  return { dir };
}
export const removeScratch = (dir: string) => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } };
