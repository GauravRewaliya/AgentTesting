// PreToolUse hook of the prompt tests: records the call (PROMPT_TEST_RECORD, one JSON line) and blocks it, so nothing is ever executed. Used only by prompt_test.ts.
import { appendFileSync, readFileSync } from "node:fs";
const ev = JSON.parse(readFileSync(0, "utf8") || "{}") as { tool_name?: string; tool_input?: unknown; tool_use_id?: string };
appendFileSync(process.env.PROMPT_TEST_RECORD!, JSON.stringify({ tool: ev.tool_name, input: ev.tool_input, id: ev.tool_use_id }) + "\n");
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "(prompt test: the call was recorded, nothing is executed)" } }));
