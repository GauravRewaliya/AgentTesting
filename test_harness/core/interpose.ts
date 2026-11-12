// Two modes (used by core/claude.ts and core/run.ts):
//   bun core/interpose.ts hook          PreToolUse hook (stdin = hook JSON): trace the call, apply the guard, deny what must not run
//   bun core/interpose.ts mock <agent>  the thin sub-agent pipes its task here (stdin): recorded-result lookup, the recorded run(req) writes the files, the reply is printed
// Guard input = <session>/run/guard.json (GUARD_FILE, written by runClaude before each turn): { forbidden[], allowed[], turn_allowed[]|null, rules{role: Rule}, done[] }.
//   forbidden / not allowed this turn  -> hard stop            (GUARD: ...)
//   unknown agent type, or a rule broken (thin hand-over, missing fact, role order) -> the lead may retry, not counted (GUARD-RETRY: ...)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FIXTURES } from "./paths.ts";
import { checkHandover, type Rule } from "./orchistraitor/harness_own_custom/core/guard.ts";

const ROOT = join(import.meta.dir, "..");
const WS = process.env.TEST_WS ?? join(ROOT, "run_test");
// the runner sets all three (core/claude.ts): they live in the case's own run/ folder inside .state
const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(k + " is not set (run through core/run.ts)"); return v; };
const TRACE = need("TRACE_FILE");
const GUARD = need("GUARD_FILE");
const FORBIDDEN = (process.env.FORBIDDEN_AGENTS ?? "").split(",").filter(Boolean);
const stdin = await Bun.stdin.text();
const mode = process.argv[2];
const trace = (o: object) => { mkdirSync(dirname(TRACE), { recursive: true }); appendFileSync(TRACE, JSON.stringify({ t: Date.now(), ...o }) + "\n"); };
type GuardFile = { forbidden?: string[]; allowed?: string[]; turn_allowed?: string[] | null; rules?: Record<string, Rule>; done?: string[] };
const guardFile = (): GuardFile => { try { return JSON.parse(readFileSync(GUARD, "utf8")); } catch { return {}; } };
const servedRoles = (): string[] => !existsSync(TRACE) ? [] : readFileSync(TRACE, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }).filter((e) => e.kind === "mock").map((e) => e.agent as string);
const deny = (reason: string, stop = false) => console.log(JSON.stringify({ ...(stop ? { continue: false, stopReason: reason } : {}), hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));

if (mode === "hook") {
  const ev = JSON.parse(stdin || "{}"), input = ev.tool_input ?? {}, g = guardFile();
  const prompt = String(input.prompt ?? input.message ?? "");
  trace({ kind: "hook", tool: ev.tool_name, agent: input.subagent_type, to: input.to, prompt: prompt.slice(0, 400) });
  if ((ev.tool_name === "Agent" || ev.tool_name === "Task") && input.subagent_type) {
    const agent = String(input.subagent_type), forbidden = [...FORBIDDEN, ...(g.forbidden ?? [])];
    if (forbidden.includes(agent) || g.rules?.[agent]?.forbidden) { deny(`GUARD: forbidden agent ${agent}`, true); process.exit(0); }
    if (g.allowed && !g.allowed.includes(agent)) { deny(`GUARD-RETRY: unknown agent type '${agent}' (available: ${g.allowed.join(", ")})`); process.exit(0); }
    if (g.turn_allowed && !g.turn_allowed.includes(agent)) { deny(`GUARD: '${agent}' not allowed in this turn (allowed: ${g.turn_allowed.join(", ") || "none"})`, true); process.exit(0); }
    if (g.rules?.[agent]) {
      const why = checkHandover({ rules: g.rules, agent, prompt, done: [...(g.done ?? []), ...servedRoles()] });
      if (why.length) { trace({ kind: "guard", agent, why }); deny(`GUARD-RETRY: ${why.join("; ")}. Call again with a complete hand-over.`); }
    }
  }
  process.exit(0);
}

if (mode === "mock") {
  const { Harness, loadResults } = await import("./orchistraitor/harness_own_custom/main.ts");
  const agent = process.argv[3]!;
  const h = new Harness({ fixtures: [], results: await loadResults(join(FIXTURES, "results")), root: ROOT, ws: WS, log: need("HARNESS_LOG") });
  const r = h.spawn(agent, stdin);
  trace({ kind: "mock", agent, fixture: r.fixture ?? null, reply: r.reply.slice(0, 600) });
  console.log(r.reply.startsWith("NOTFOUND") ? "NOTFOUND: no recorded result for this task. Reply exactly: NOTFOUND" : r.reply);
}
