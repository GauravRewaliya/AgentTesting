// PostToolUse hook: live activity for the board, lease renewal (a working agent keeps its locks; an idle one loses them), and unread notes as context.
import { readFileSync } from "node:fs";
import { MStore, inbox, noteContext } from "../core/board.ts";
import { locksFromEnv } from "../core/lockapi.ts";

const input = JSON.parse(readFileSync(0, "utf8") || "{}") as { tool_name?: string; tool_input?: Record<string, unknown> };
const { HARNESS_STORE: file, HARNESS_TASK: task, HARNESS_AGENT: agent } = process.env;
if (!file || !task || !agent) process.exit(0);
const store = new MStore(file);
try { await locksFromEnv(store).renew(task, agent, 1_200_000); } catch { /* the guard fails closed; a missed renewal only shortens the lease */ }
const notes = store.tx(() => {
  const row = store.agent(task, agent);
  if (row) {
    row.activity = `${input.tool_name ?? "tool"} ${String(input.tool_input?.file_path ?? input.tool_input?.command ?? input.tool_input?.pattern ?? input.tool_input?.url ?? "").slice(0, 60)}`.trim();
    row.last_event_at = Date.now();
    store.ev("tool.used", task, agent, { tool: input.tool_name, activity: row.activity });
  }
  return inbox(store, task, agent);
});
const ctx = noteContext(notes);
if (ctx) console.log(ctx);
