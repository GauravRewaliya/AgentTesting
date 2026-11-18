// The FINAL call check: when the launch prompt of an agent (what the model really receives: its CLAUDE.md plus the docs the harness appends) is over LAUNCH_LIMIT, say so ONCE per agent and task:
// a console warning (the process that runs the agent), a `prompt.big` event in the store, and a row in <run>/store/admin_issues.jsonl, so it shows in the dashboard (PromptTesting > admin reports).
import { appendFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { LAUNCH_LIMIT } from "@core/agents/prompt_sizes.ts";
import type { AgentDef } from "./types.ts";
import type { Store } from "./store.ts";

const seen = new Set<string>();
export function warnBigPrompt(store: Store, def: AgentDef, userPrompt: string, task: string, agent_id: string): string | null {
  let sys = 0; try { sys = statSync(def.prompt_file).size; } catch { return null; }
  if (sys <= LAUNCH_LIMIT) return null;
  const key = `${task}/${def.name}`; if (seen.has(key)) return null; seen.add(key);
  const msg = `launch prompt of ${def.name} is ${sys} chars (limit ${LAUNCH_LIMIT}, about ${Math.round(sys / 4)} tokens) plus ${userPrompt.length} chars of task text: shorten agents/${def.name}/.claude/CLAUDE.md, its team_tools list or its chapters`;
  console.warn(`\x1b[33m[prompt]\x1b[0m ${msg}`);
  try { store.tx(() => store.ev("prompt.big", task, agent_id, { chars: sys, user_chars: userPrompt.length, limit: LAUNCH_LIMIT })); } catch { /* a warning must never stop a call */ }
  const f = (store as unknown as { file?: string }).file;
  if (f) { try { appendFileSync(join(dirname(f), "admin_issues.jsonl"), JSON.stringify({ id: "iss_prompt_" + Date.now().toString(36), t: Date.now(), at: new Date().toISOString(), task, reporter: "harness", agent: agent_id, role: def.role, session_id: null, kind: "prompt_big", severity: "low", text: msg }) + "\n"); } catch { /* best effort */ } }
  return msg;
}
