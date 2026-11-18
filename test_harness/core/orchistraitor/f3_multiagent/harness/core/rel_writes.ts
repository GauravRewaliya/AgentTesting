import { isAbsolute, relative } from "node:path";
/** `--writes` paths are WORKSPACE-RELATIVE ("run_test/sakura/index.html"). An ABSOLUTE path inside the workspace is turned into that: the lock was granted under the absolute path, the write guard compares the relative one,
 *  so a builder was refused its own file twice, stopped twice with NEEDS_PARENT and the lead replaced it (found in the real run tj_1_full_real: 97 s and $0.13 lost). */
export function relWrites(writes: string[] | undefined, roots: string[]): string[] | undefined {
  return writes?.map((w) => { const p = w.trim(); if (!isAbsolute(p)) return p.replace(/^\.\//, ""); for (const r of roots) { const rel = relative(r, p); if (rel && !rel.startsWith("..") && !isAbsolute(rel)) return rel; } return p; });
}

/** The workspace-relative form of a path, for COMPARING locks and edits: an absolute path keeps only what follows the workspace root (everything before "/run_test/"); "./" is dropped. A lock and an edit that
 *  name the same file in two spellings must be the same file (the real run tj_1_full_real: an absolute lock never matched the relative edit, and two spellings would never have been seen to overlap). */
export const wsRel = (p: string): string => (p.startsWith("/") && p.includes("/run_test/") ? p.slice(p.indexOf("/run_test/") + 1) : p.replace(/^\.\//, ""));
