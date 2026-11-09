// bun core/build_index.ts  -> agent_fixture/index.json : find a recorded result (and what it copies) without opening it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IndexRow, ResultModule } from "./types.ts";
const ROOT = join(import.meta.dir, ".."), DIR = join(ROOT, "agent_fixture/results");
const rows: IndexRow[] = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".ts")).sort()) {
  const m = (await import(join(DIR, f))).default as ResultModule;
  const copies = [...readFileSync(join(DIR, f), "utf8").matchAll(/req\.cp\("([^"]+)"/g)].map((x) => "store/" + x[1]);
  rows.push({ id: m.id, file: "results/" + f, title: m.title, agent: m.match?.agent, keywords: m.match?.keywords, text: m.expected_input.text, ...(copies.length ? { copies } : {}) });
}
writeFileSync(join(ROOT, "agent_fixture/index.json"), JSON.stringify(rows, null, 1) + "\n");
console.log(rows.length, "results indexed");
