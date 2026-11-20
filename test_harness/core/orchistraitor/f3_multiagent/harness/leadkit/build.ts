// BUILD A .claude ON THE FLY: a plugin folder for one agent, made from a template and the agent's declarations, in test_harness/core/.build/ (git-ignored, rebuilt when its content changes).
// Claude Code loads it natively with `--plugin-dir`: hooks/ (a mod), skills/, agents/, commands/ are read by the engine, so we write files instead of code that wires them.
// Used for the lead's mod (approaches/a3_native_mod) AND for every sub-agent's skills (harness/core/skills.ts): one builder, one place (core/.build), so tools, skills and prompts stay apart and nothing is wired by hand.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { AGENTS_DIR } from "@core/config.ts";

export const BUILD_DIR = join(AGENTS_DIR, "..", "..", ".build");
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)).map((f) => join(e.name, f)) : [e.name]));

/** Copy `template` (a plugin folder) to .build/<name>.<hash>/, add `extra` files (path -> text, e.g. hooks/config.ts) and `copy` files (path -> source file). Returns the folder for --plugin-dir. */
export function buildPlugin(name: string, template: string | null, extra: Record<string, string>, copy: Record<string, string> = {}): string {
  const h = createHash("sha1");
  if (template) for (const f of files(template).sort()) h.update(f).update(readFileSync(join(template, f)));
  for (const [k, v] of Object.entries(extra).sort()) h.update(k).update(v);
  for (const [k, v] of Object.entries(copy).sort()) { h.update(k); if (statSync(v).isDirectory()) for (const f of files(v).sort()) h.update(f).update(readFileSync(join(v, f))); else h.update(readFileSync(v)); }
  const dir = join(BUILD_DIR, `${name}.${h.digest("hex").slice(0, 10)}`);
  if (existsSync(join(dir, ".claude-plugin", "plugin.json"))) return dir;   // built already: same content, same folder
  mkdirSync(dir, { recursive: true }); if (template) cpSync(template, dir, { recursive: true });
  for (const [k, v] of Object.entries(extra)) { mkdirSync(join(dir, k, ".."), { recursive: true }); writeFileSync(join(dir, k), v); }
  for (const [k, v] of Object.entries(copy)) { mkdirSync(join(dir, k, ".."), { recursive: true }); cpSync(v, join(dir, k), { recursive: true }); }
  return dir;
}
