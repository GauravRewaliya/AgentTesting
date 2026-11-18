// Override lookup: the first existing file wins.
//   1. approaches/custom/<approach>/<rel>   this approach only
//   2. approaches/custom/_all/<rel>         every approach
//   3. approaches/<approach>/<rel>          the approach's own default
//   4. <base>/<rel>                         the shared default (harness/)
// A file in custom/ MUST carry `CUSTOM: overrides <general path>` in its first 3 lines (`// CUSTOM: ...` in .ts, `<!-- CUSTOM: ... -->` in .md) so a reader can find the general one (overrides() reads it).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const F3 = join(import.meta.dir, "..");

export function resolve(rel: string, approach: string, base = join(F3, "harness")): { path: string; layer: "custom" | "custom_all" | "approach" | "shared" } {
  for (const [layer, root] of [["custom", join(F3, "approaches", "custom", approach)], ["custom_all", join(F3, "approaches", "custom", "_all")], ["approach", join(F3, "approaches", approach)], ["shared", base]] as const) {
    const p = join(root, rel);
    if (existsSync(p)) return { path: p, layer };
  }
  throw new Error(`resolve: "${rel}" not found for approach ${approach}`);
}

/** Every file under approaches/custom/<approach> and custom/_all: what is overridden right now (print it at startup so a changed behaviour is never silent). */
export function overrides(approach: string): { file: string; general: string | null }[] {
  const out: { file: string; general: string | null }[] = [];
  const walk = (d: string) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (!/README\.md$/.test(p)) out.push({ file: relative(F3, p), general: /CUSTOM: overrides (.+?)(?:\s*-->)?\s*$/m.exec(readFileSync(p, "utf8").split("\n").slice(0, 3).join("\n"))?.[1] ?? null }); } };
  walk(join(F3, "approaches", "custom", approach)); walk(join(F3, "approaches", "custom", "_all"));
  return out;
}
