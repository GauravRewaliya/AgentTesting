import { join } from "node:path";
import type { AgentDef } from "@core/types.ts";
import { agentInfo } from "@core/agents/index.ts";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");   // test_harness
const INTERPOSE = join(import.meta.dir, "interpose.ts");
export type LeadCall = { denied?: boolean; tool: string; agent?: string; to?: string; prompt?: string; resultId?: string; useId: string };
export type Run = { sessionId: string; reply: string; leadCalls: LeadCall[]; cost: number; subTexts: string[]; served: string[]; forbiddenHit?: string; mockMiss: boolean; raw: any[]; turns: number };

const HARNESS = join(import.meta.dir, "..", "core");  // the harness owns the system prompts (system_prompt.md = the lead, agent_prompt.md = the thin sub-agent)
const LEAD_PROMPT = (await Bun.file(join(HARNESS, "system_prompt.md")).text()).trim();
const AGENT_PROMPT = await Bun.file(join(HARNESS, "agent_prompt.md")).text();

export async function loadAgent(name: string): Promise<AgentDef> {
  const a = agentInfo(name);
  if (!a) throw new Error(`unknown agent "${name}" (test_harness/core/agents/index.ts)`);
  return { name: a.name, description: a.description, role: a.role, ...(a.forbidden ? { forbidden: true } : {}) };
}

export function agentsJson(defs: AgentDef[]) {
  const o: Record<string, unknown> = {};
  for (const d of defs) o[d.name] = {
    description: d.description, tools: ["Bash"], model: "haiku",
    prompt: AGENT_PROMPT.replaceAll("{{name}}", d.name).replaceAll("{{interpose}}", INTERPOSE).trim(),
  };
  return o;
}

export async function runClaude(o: { prompt: string; resume?: string; defs: AgentDef[]; tools: string[]; ws: string; dir: string; forbidden: string[]; allowed?: string[]; mod?: boolean; lead?: string; router?: boolean; rules?: object; turnAllowed?: string[]; doneBefore?: string[] }): Promise<Run> {
  const settings = { hooks: { PreToolUse: [{ matcher: "Agent|SendMessage|Task", hooks: [{ type: "command", command: `bun ${INTERPOSE} hook` }] }] },
    permissions: { allow: [`Bash(bun *interpose.ts*)`] } };
  const args = ["-p", o.prompt, "--output-format", "stream-json", "--verbose", "--model", "haiku",
    "--setting-sources", "", "--strict-mcp-config", "--settings", JSON.stringify(settings),
    "--permission-mode", "acceptEdits", "--allowedTools", "Bash(bun *interpose.ts*)", "Agent", "SendMessage",
    "--tools", [...new Set([...o.tools, "Bash"])].join(","),
    "--agents", JSON.stringify(agentsJson(o.defs)), "--append-system-prompt", (o.router === false ? "" : LEAD_PROMPT) + (o.lead ? "\n\n" + o.lead : "") + (o.defs.length ? `\nAvailable agent types (use only these as subagent_type): ${o.defs.map((d) => d.name).join(", ")}.` : "")];
  // the guard reads this in the PreToolUse hook (test_harness/core/orchistraitor/harness_own_custom/runner/interpose.ts): who exists, who may be called THIS turn, the hand-over rules, who is already done
  await Bun.write(join(o.dir, "guard.json"), JSON.stringify({ forbidden: o.forbidden, allowed: o.defs.map((d) => d.name), turn_allowed: o.turnAllowed ?? null, rules: o.rules ?? {}, done: o.doneBefore ?? [] }));
  if (o.mod) {   // NOT available any more: the .claude/mods/interrupt plugin is not in the repo; run.ts always passes mod:false (hook + thin sub-agent)
    // mod mode: the interrupt mod answers Agent/SendMessage from harness_own_custom; no real sub-agent starts
    const i = args.indexOf("--settings"); args.splice(i, 2);
    args.push("--plugin-dir", join(HARNESS, ".claude/mods/interrupt"));
    Bun.write(join(o.dir, "mod.json"), JSON.stringify({ forbidden: o.forbidden, allowed: o.defs.map((d) => d.name), rules: o.rules, turn_allowed: o.turnAllowed ?? null, done_before: o.doneBefore ?? [] }));
  }
  if (o.resume) args.push("--resume", o.resume);
  const p = Bun.spawn(["claude", ...args], { cwd: o.ws, stdin: "ignore", stdout: "pipe", stderr: "pipe",
    env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", TEST_WS: o.ws, TRACE_FILE: join(o.dir, "trace.jsonl"), GUARD_FILE: join(o.dir, "guard.json"), HARNESS_LOG: join(o.dir, "harness.jsonl"), FORBIDDEN_AGENTS: o.forbidden.join(",") } });
  const out = await new Response(p.stdout).text(); await p.exited;
  const raw = out.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const run: Run = { sessionId: "", reply: "", leadCalls: [], subTexts: [], served: [], cost: 0, mockMiss: false, raw, turns: 0 };
  const texts: string[] = []; let last = "";
  for (const ev of raw) {
    if (ev.session_id && !run.sessionId) run.sessionId = ev.session_id;
    const blocks = Array.isArray(ev.message?.content) ? ev.message.content : [];
    if (ev.type === "assistant" && ev.parent_tool_use_id === undefined) {} 
    if (ev.type === "assistant" && ev.parent_tool_use_id) for (const b of blocks) if (b.type === "text") run.subTexts.push(b.text);
    if (ev.type === "assistant" && !ev.parent_tool_use_id) for (const b of blocks) {
      if (b.type === "text") texts.push(b.text);
      if (b.type === "tool_use") run.leadCalls.push({ tool: b.name === "Task" ? "Agent" : b.name, agent: b.input?.subagent_type, to: b.input?.to, prompt: b.input?.prompt ?? b.input?.message, useId: b.id });
    }
    if (ev.type === "user") for (const b of blocks) if (b.type === "tool_result") {
      const txt = typeof b.content === "string" ? b.content : (b.content ?? []).map((x: any) => x.text ?? "").join("\n");
      if (/NOTFOUND/.test(txt)) run.mockMiss = true;
      const c = run.leadCalls.find((x) => x.useId === b.tool_use_id);
      const m = txt.match(/agentId:\s*([\w-]+)/); if (c && m) c.resultId = m[1];
      if (/GUARD: forbidden/.test(txt)) run.forbiddenHit = txt.slice(0, 120);
      if (c && /GUARD-RETRY/.test(txt)) c.denied = true;
    }
    if (ev.type === "result") { run.cost = ev.total_cost_usd ?? 0; last = ev.result ?? ""; run.turns = ev.num_turns ?? 0; if (ev.subtype && ev.is_error) last += " [error " + ev.subtype + "]"; }
  }
  const stop = raw.find((e) => e.type === "system" && /GUARD/.test(JSON.stringify(e)));
  if (stop && !run.forbiddenHit) run.forbiddenHit = "GUARD in stream";
  run.leadCalls = run.leadCalls.filter((c) => !c.denied);   // refused calls (unknown agent type) never ran
  const lastText = texts[texts.length - 1] ?? "";
  run.reply = (last && last.trim() === lastText.trim() ? texts : [...texts, last]).join("\n");   // the final `result` repeats the last text block
  return run;
}
