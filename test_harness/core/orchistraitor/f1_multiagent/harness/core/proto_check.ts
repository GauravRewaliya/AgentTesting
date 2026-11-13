// Cheap, deterministic check of a NO-BUILD prototype (index.html + plain <script> files + Vue from a CDN): every referenced file exists, every script parses, every screen / component the code uses is defined,
// no build-only syntax (npm imports, TypeScript, .vue). Nothing is installed or started: it takes well under a second, so run it after every writer.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
export interface ProtoReport { ok: boolean; files: number; screens: string[]; components: string[]; problems: string[]; next: string }
const walk = (d: string, o: string[] = []): string[] => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === "node_modules" || e.name.startsWith(".")) continue; const p = join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
export function protoCheck(dir: string): ProtoReport {
  const problems: string[] = [];
  if (!existsSync(join(dir, "index.html"))) return { ok: false, files: 0, screens: [], components: [], problems: ["no index.html in the folder"], next: "Create index.html (the page that loads Vue from the CDN and every script)." };
  const all = walk(dir), html = readFileSync(join(dir, "index.html"), "utf8"), js = all.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/g)) { const u = m[1]!; if (/^(https?:)?\/\//.test(u) || u.startsWith("data:")) continue; if (!existsSync(join(dir, u.split("?")[0]!))) problems.push(`index.html loads ${u}, which does not exist`); }
  if (/vue(\.global|\.esm-browser)?(\.prod)?\.js/.test(html) === false && !/unpkg|jsdelivr|cdnjs/.test(html)) problems.push("index.html does not load Vue from a CDN");
  const defScreens = new Set<string>(), useScreens = new Set<string>(), defComps = new Set<string>(), tags = new Set<string>(), src: Record<string, string> = {};
  const tr = new Bun.Transpiler({ loader: "js" });
  for (const f of js) {
    const s = readFileSync(f, "utf8"), rel = relative(dir, f); src[rel] = s;
    try { tr.transformSync(s); } catch (e) { problems.push(`${rel}: syntax error: ${String((e as Error).message).split("\n")[0]!.slice(0, 140)}`); }
    if (/^\s*import\s[^'"]*from\s+['"][^./'"]/m.test(s) || /\brequire\(['"][^./]/.test(s)) problems.push(`${rel}: imports an npm package: a no-build prototype has none (use the CDN globals)`);
    for (const m of s.matchAll(/\bScreens\.(\w+)\s*=(?!=)/g)) defScreens.add(m[1]!);
    for (const m of s.matchAll(/\bScreens\.(\w+)\b(?!\s*=(?!=))/g)) useScreens.add(m[1]!);
    for (const m of s.matchAll(/\bComponents\.(\w+)\s*=(?!=)/g)) defComps.add(m[1]!);
    for (const m of s.matchAll(/<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[\s>/]/g)) tags.add(m[1]!);
  }
  for (const f of all) if (/\.(vue|ts|tsx)$/.test(f)) problems.push(`${relative(dir, f)}: .vue / TypeScript needs a build: write plain .js`);
  if (existsSync(join(dir, "package.json"))) problems.push("package.json present: a no-build prototype has none (it would be installed and built)");
  for (const u of useScreens) if (!defScreens.has(u)) problems.push(`Screens.${u} is used (route / template) but no file defines it (Screens.${u} = { ... })`);
  const known = new Set([...defComps].map(kebab)), ignore = new Set(["router-view", "router-link", "font-face", "color-profile", "missing-glyph", "annotation-xml"]);
  for (const t of tags) if (!known.has(t) && !ignore.has(t)) problems.push(`<${t}> is used in a template but Components.${t.replace(/(^|-)(\w)/g, (_, _a, c) => c.toUpperCase())} is not defined`);
  const ok = problems.length === 0;
  return { ok, files: all.length, screens: [...defScreens].sort(), components: [...defComps].sort(), problems: problems.slice(0, 25),
    next: ok ? "Healthy: now `preview --dir <folder>` and give the person the public_url." : "Give each problem to the agent that owns that file (continue the same agent), then run proto_check again." };
}
