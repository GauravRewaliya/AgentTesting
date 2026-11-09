// Two modes:
//   bun core/interpose.ts hook          PreToolUse hook (stdin = hook JSON): trace the call, deny forbidden agents
//   bun core/interpose.ts mock <agent>  mock sub-agent work (stdin = task): fixture lookup, writes files, prints reply
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const WS = process.env.TEST_WS ?? join(ROOT, "run_test");
const TRACE = process.env.TRACE_FILE ?? join(WS, "..", ".state", "trace.jsonl");
const FORBIDDEN = (process.env.FORBIDDEN_AGENTS ?? "").split(",").filter(Boolean);
const stdin = await Bun.stdin.text();
const mode = process.argv[2];

if (mode === "hook") {
  const ev = JSON.parse(stdin || "{}");
  const input = ev.tool_input ?? {};
  mkdirSync(dirname(TRACE), { recursive: true });
  appendFileSync(TRACE, JSON.stringify({ t: Date.now(), kind: "hook", tool: ev.tool_name, agent: input.subagent_type, to: input.to, prompt: String(input.prompt ?? input.message ?? "").slice(0, 400) }) + "\n");
  if (ev.tool_name === "Agent" && FORBIDDEN.includes(input.subagent_type)) {
    console.log(JSON.stringify({ continue: false, stopReason: `GUARD: forbidden agent ${input.subagent_type}`,
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "forbidden agent" } }));
  }
  process.exit(0);
}

if (mode === "mock") {
  // --real mode: the real thin sub-agent pipes its task here; the harness does the (mocked) work.
  const { Harness, loadResults } = await import("./harness_own_custom/main.ts");
  const agent = process.argv[3];
  const h = new Harness({ fixtures: [], results: await loadResults(join(ROOT, "agent_fixture/results")), root: ROOT, ws: WS });
  const r = h.spawn(agent, stdin);
  mkdirSync(dirname(TRACE), { recursive: true });
  appendFileSync(TRACE, JSON.stringify({ t: Date.now(), kind: "mock", agent, fixture: r.fixture ?? null }) + "\n");
  console.log(r.reply.startsWith("NOTFOUND") ? "NOTFOUND: no recorded result for this task. Reply exactly: NOTFOUND" : r.reply);
}
