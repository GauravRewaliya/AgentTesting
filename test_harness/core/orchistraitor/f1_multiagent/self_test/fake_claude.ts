#!/usr/bin/env bun
// A stand-in for `claude -p` that keeps the SESSION rules of the real CLI (probed on 2.1.319) and nothing else, so persistence can be tested exactly and for free:
//   - a transcript lives at $HOME/.claude/projects/<cwd with every non-alphanumeric char as "-">/<session id>.jsonl
//   - --session-id X   creates it (exit 1 "already in use" if it exists in ANY folder)
//   - --resume X       finds it in ANY folder, appends, answers under the same id; exit 1 "No conversation found with session ID: X" when it is gone
//   - --resume X --fork-session [--session-id N]   copies it under a new id
//   - the "model" knows only what is in the transcript: it can recite the last "SESSION CODE: W-xxxx" it was told. FAKE_CLAUDE_FORGET=1 simulates a silent reset.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const a = process.argv.slice(2), val = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
const prompt = a[a.indexOf("-p") + 1] ?? "", sid = val("--session-id"), res = val("--resume"), fork = a.includes("--fork-session");
const root = join(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME ?? "/tmp", ".claude"), "projects"),   // like the real CLI: CLAUDE_CONFIG_DIR wins, else ~/.claude (a hard-coded ~/.claude made every session test fail on a machine that sets CLAUDE_CONFIG_DIR)
  here = join(root, process.cwd().replace(/[^a-zA-Z0-9]/g, "-"));
const find = (id: string) => { try { for (const d of readdirSync(root)) { const f = join(root, d, id + ".jsonl"); if (existsSync(f)) return f; } } catch { /* no projects yet */ } return null; };
const die = (m: string) => { process.stderr.write(m + "\n"); process.exit(1); };
mkdirSync(here, { recursive: true });
let id: string, file: string;
if (res) {
  const src = find(res); if (!src) die(`No conversation found with session ID: ${res}`);
  if (fork) { id = sid ?? randomUUID(); file = join(here, id + ".jsonl"); copyFileSync(src!, file); } else { id = res; file = src!; }
} else if (sid) { if (find(sid)) die(`Session ID ${sid} is already in use.`); id = sid; file = join(here, id + ".jsonl"); writeFileSync(file, ""); }
else { id = randomUUID(); file = join(here, id + ".jsonl"); writeFileSync(file, ""); }
const before = readFileSync(file, "utf8");
appendFileSync(file, JSON.stringify({ role: "user", text: prompt }) + "\n");
const codes = [...(before + prompt).matchAll(/SESSION CODE: (W-\w+)/g)].map((m) => m[1]!);
const asked = /Begin your reply with your SESSION CODE/.test(prompt);
const reply = asked ? (process.env.FAKE_CLAUDE_FORGET === "1" || !codes.length ? "I do not remember a code." : `${codes[codes.length - 1]} done`) : "ok";
appendFileSync(file, JSON.stringify({ role: "assistant", text: reply }) + "\n");
await new Promise((r) => setTimeout(r, Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 0)));   // a call that takes time
console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: reply, session_id: id, total_cost_usd: 0.001, num_turns: 1 }));
