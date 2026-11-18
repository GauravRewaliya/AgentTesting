// A custom sub-agent: a role with no folder in agents/. The lead (agent.json "custom": true) can still call it by name and give it a title:
//   delegate --role market-researcher --title "compares three bundlers" --session new ...
// The harness builds a generic agent from custom_agent/CLAUDE.md, told its name and title, so it knows what it is. Nothing to define up front.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentDef } from "./base/types.ts";

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "..", "custom_agent", "CLAUDE.md");
export const isCustomName = (n: string) => /^[a-z][a-z0-9-]{1,31}$/.test(n);
const READ = ["Read", "Glob", "Grep", "WebFetch", "Bash(ls *)", "Bash(cat *)", "Bash(wc *)"], WRITE = ["Write", "Edit", "Bash(mkdir *)", "Bash(cp *)"];

/** Same name + title + writes always gives the same prompt file, so a detached `_run` process rebuilds exactly what the granting process made. */
export function customDef(name: string, title: string, writes: boolean): AgentDef {
  const dir = join(tmpdir(), "lf-custom"); mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.${writes ? "rw" : "ro"}.${Bun.hash(title).toString(36)}.md`);
  writeFileSync(file, readFileSync(TEMPLATE, "utf8").replaceAll("{{name}}", name).replaceAll("{{title}}", title.trim()).replaceAll("{{mode}}", writes ? "You may create and edit files, but only the files you were told you may write." : "You are read-only: you never change files."));
  const allow = writes ? [...READ, ...WRITE] : READ;
  return { name, role: name, description: title.trim(), model: "haiku", session: "persistent", writes, max_children: 0, agents: [], tiers: ["T1", "T2", "T3", "T4"],
    allow, tools: [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))], dir: dirname(file), prompt_file: file, ad_hoc: true };
}
