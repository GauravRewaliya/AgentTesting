// Free check for a plan folder: every relative markdown link `[x](path)` must point to an existing file.
// Use after a planner (or agent) moved/renamed plan files:  bun test_harness/core/check_plan_links.ts docs/planning/<project> [more dirs]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const mdFiles = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? mdFiles(p) : p.endsWith(".md") ? [p] : []; });
const bad: string[] = [];
for (const root of process.argv.slice(2)) {
  if (!existsSync(root)) { console.error(`no such folder: ${root}`); process.exit(2); }
  for (const f of mdFiles(root)) {
    const text = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "");   // links inside code blocks are examples
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1]!.split("#")[0]!;
      if (!target || /^[a-z]+:/i.test(target)) continue;   // anchors and http(s)/mailto
      if (!existsSync(resolve(dirname(f), target))) bad.push(`${f}: broken link -> ${m[1]}`);
    }
  }
}
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("plan links ok");
