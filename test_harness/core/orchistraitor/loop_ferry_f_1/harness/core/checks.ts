// Deterministic checks. The loop's "satisfied" includes them; a model's opinion alone is not enough.
import { spawnSync } from "node:child_process";
export function runChecks(cmd: string | undefined, cwd: string): { ok: boolean; out: string } {
  if (!cmd) return { ok: true, out: "" };
  const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8", timeout: 60_000 });
  const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim().split("\n").slice(-12).join("\n");
  return { ok: r.status === 0, out: `${r.status === 0 ? "PASS" : "FAIL"} (exit ${r.status})\n${out}`.trim() };
}
