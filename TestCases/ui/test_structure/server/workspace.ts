// "Accidental change" scenarios. The case's saved workspace (.state/<id>/ws) is NEVER written.
// Changes go to a scratch copy in web/.scratch/<id>/; the diff is scratch vs the saved original.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { wsDir } from "./data.ts";

const SCRATCH = join(import.meta.dir, "../.scratch");
const files = (d: string): string[] => (existsSync(d) ? readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name).slice(d.length + 1)).sort() : []);
const safe = (root: string, p: string) => { const abs = normalize(join(root, p)); if (!abs.startsWith(root + "/")) throw new Error("path escapes the workspace"); return abs; };

export type Op = { op: "remove"; path: string } | { op: "add" | "edit"; path: string; content: string };

export function snapshot(id: string) {
  const orig = wsDir(id), scr = join(SCRATCH, id);
  const o = files(orig), s = existsSync(scr) ? files(scr) : o;
  const changed = s.filter((f) => o.includes(f) && existsSync(scr) && readFileSync(join(scr, f), "utf8") !== readFileSync(join(orig, f), "utf8"));
  return { hasScratch: existsSync(scr), original: o, current: s, removed: o.filter((f) => !s.includes(f)), added: s.filter((f) => !o.includes(f)), edited: changed };
}
export function apply(id: string, ops: Op[]) {
  const scr = join(SCRATCH, id);
  if (!existsSync(scr)) { mkdirSync(scr, { recursive: true }); cpSync(wsDir(id), scr, { recursive: true }); }
  for (const o of ops) {
    const abs = safe(scr, o.path);
    if (o.op === "remove") rmSync(abs, { force: true });
    else { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, o.content); }
  }
  return snapshot(id);
}
export const reset = (id: string) => (rmSync(join(SCRATCH, id), { recursive: true, force: true }), snapshot(id));
export const readFile = (id: string, p: string, scratch: boolean) => { const root = scratch && existsSync(join(SCRATCH, id)) ? join(SCRATCH, id) : wsDir(id); return readFileSync(safe(root, p), "utf8"); };
