// READ-ONLY view of the shared workspace (`<cwd>/run_test/`) for the LEAD: `tools.ts ls | read_file | grep`.
// Why: the lead has no file tools, so it could only check a sub-agent by asking the sub-agent to run commands (a mocked sub-agent cannot) and by trusting its words.
// Same names/shape as loopferry's agent tools (read_file with numbered lines + offset/limit). Never writes. Jailed to the workspace: no absolute paths, no `..`, no symlink escape, no node_modules/.git.
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const SKIP = new Set(["node_modules", ".git"]);
export const MAX_FILES = 300, MAX_LINES = 200, MAX_HITS = 100, MAX_BYTES = 400_000;

/** Resolve `rel` inside `root`, or an error string. */
export function jail(root: string, rel = "."): { abs: string } | { error: string } {
  if (!existsSync(root)) return { error: "the workspace run_test/ does not exist yet (nothing was written)" };
  if (rel.startsWith("/") || /(^|[\\/])\.\.([\\/]|$)/.test(rel)) return { error: `path "${rel}" must be relative and inside run_test/` };
  const abs = resolve(root, rel.replace(/^run_test[\\/]?/, ""));
  if (!existsSync(abs)) return { error: `no such path: ${rel}` };
  const real = realpathSync(abs), base = realpathSync(root);
  if (real !== base && !real.startsWith(base + sep)) return { error: `path "${rel}" leaves run_test/` };
  return { abs: real };
}
function walk(root: string, dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (lstatSync(p).isSymbolicLink()) continue;
    if (e.isDirectory()) walk(root, p, out); else out.push(relative(root, p));
  }
  return out;
}
export function wsLs(root: string, rel = ".") {
  const j = jail(root, rel); if ("error" in j) return { ok: false, reason: j.error };
  const base = realpathSync(root), files = lstatSync(j.abs).isDirectory() ? walk(base, j.abs) : [relative(base, j.abs)];
  return { ok: true, count: files.length, truncated: files.length > MAX_FILES, files: files.sort().slice(0, MAX_FILES).map((f) => ({ path: f, bytes: readFileSync(join(base, f)).length })) };
}
export function wsRead(root: string, rel: string, offset = 1, limit = MAX_LINES) {
  const j = jail(root, rel); if ("error" in j) return { ok: false, reason: j.error };
  if (lstatSync(j.abs).isDirectory()) return { ok: false, reason: `${rel} is a directory: use ls` };
  const buf = readFileSync(j.abs); if (buf.includes(0)) return { ok: false, reason: `${rel} is a binary file` };
  const lines = buf.toString("utf8").slice(0, MAX_BYTES).split("\n"), from = Math.max(1, offset), n = Math.min(MAX_LINES, Math.max(1, limit));
  return { ok: true, path: rel, total_lines: lines.length, from, to: Math.min(lines.length, from + n - 1), text: lines.slice(from - 1, from - 1 + n).map((l, i) => `${String(from + i).padStart(5)}  ${l}`).join("\n") };
}
export function wsGrep(root: string, pattern: string, rel = ".") {
  let re: RegExp; try { re = new RegExp(pattern, "i"); } catch (e) { return { ok: false, reason: `bad regex: ${String(e).slice(0, 80)}` }; }
  const j = jail(root, rel); if ("error" in j) return { ok: false, reason: j.error };
  const base = realpathSync(root), files = lstatSync(j.abs).isDirectory() ? walk(base, j.abs) : [relative(base, j.abs)], hits: string[] = [];
  for (const f of files.sort()) {
    const buf = readFileSync(join(base, f)); if (buf.length > MAX_BYTES || buf.includes(0)) continue;
    buf.toString("utf8").split("\n").forEach((l, i) => { if (hits.length < MAX_HITS && re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 200)}`); });
  }
  return { ok: true, pattern, matches: hits.length, truncated: hits.length >= MAX_HITS, hits };
}
