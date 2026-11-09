// Deterministic protection for files that exist: a build that deleted a tracked file no open request asks to delete gets it restored (the index2.html incident).
// It does not depend on any model's judgement; the planner and reviewer still see it as a finding.
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

export function restoreDeleted(cwd: string, openRequestTexts: string[]): string[] {
  const st = spawnSync("git", ["-C", cwd, "status", "--porcelain"], { encoding: "utf8" });
  if (st.status !== 0) return [];   // not a git repo: nothing to restore from
  const asked = openRequestTexts.join("\n").toLowerCase(), restored: string[] = [];
  for (const line of st.stdout.split("\n")) {
    if (!/^( D|D |AD|MD)/.test(line)) continue;
    const file = line.slice(3).trim().replace(/^"|"$/g, "");
    if (asked.includes(basename(file).toLowerCase())) continue;   // a request names this file: leave it to the builder
    const r = spawnSync("git", ["-C", cwd, "restore", "--source=HEAD", "--staged", "--worktree", "--", file], { encoding: "utf8" });
    if (r.status === 0) restored.push(file);
  }
  return restored;
}
