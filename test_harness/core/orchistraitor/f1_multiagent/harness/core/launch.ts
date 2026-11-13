// What `launch` builds for one agent (plan sections 19, 20, 21): its tools (the delegate tool is REMOVED at the last level),
// its run-time sub-agent declarations (from agent.json agents[]; .claude/agents stays empty), and the native-backend equivalents.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { HARD_MAX_DEPTH } from "./agent_call.ts";
import type { AgentDef } from "./base.ts";

export const DELEGATE_ENTRY = "tools.ts delegate";
/** Can this agent call others at this level? Needs declared sub-agents AND room below it. */
export const canCall = (def: AgentDef, level: number, agentMaxDepth: number) => def.agents.length > 0 && level < Math.min(agentMaxDepth, HARD_MAX_DEPTH);

export function launchTools(def: AgentDef, level: number, agentMaxDepth: number): { allow: string[]; tools: string[]; delegate: boolean } {
  const delegate = canCall(def, level, agentMaxDepth);
  const allow = def.allow.filter((a) => delegate || !a.includes(DELEGATE_ENTRY));
  return { allow, tools: [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))], delegate };
}
/** The declarations the model sees: name + one line, built at run time from the callee's own agent.json. */
export function declarations(def: AgentDef, defs: Map<string, AgentDef>): string {
  return def.agents.map((n) => defs.get(n)).filter((d): d is AgentDef => !!d)
    .map((d) => `- ${d.name} (${d.writes ? "can write; must declare --writes" : "read-only"}; ${d.tools.some((t) => /^Web/.test(t)) ? "has web access" : "NO web access"}; tools: ${d.tools.join(", ")}): ${d.description}`).join("\n");
}
/** A launch-time copy of the definition: filtered tools, and a prompt file = CLAUDE.md + the declarations. */
export function launchDef(def: AgentDef, defs: Map<string, AgentDef>, level: number, agentMaxDepth: number, tmpDir: string, toolsCmd?: string): AgentDef {
  const t = launchTools(def, level, agentMaxDepth);
  mkdirSync(tmpDir, { recursive: true });
  const decl = t.delegate ? declarations(def, defs) + (toolsCmd ? `

# How to call them (one Bash command each; every command prints one line of JSON)
  ${toolsCmd} delegate --role <role> --session new|<agent_id>|fork:<agent_id> --objective "<what>" --output "<format>" --boundaries "<limits>" [--async] [--mode ask] [--writes a,b] [--title "<what this agent is for>"]
  ${toolsCmd} wait --agents <id>,<id> [--timeout 90]     (after --async calls: waits until they finish and returns their answers)
  ${toolsCmd} agents_list
To ask an agent that already worked on a topic for more, continue it with --session <its agent_id>: it remembers what it did.` : "") : "";
  const shared = toolsCmd && def.agents.length > 0 && def.allow.some((a) => a === "Bash" || a.includes("tools.ts preview")) ? `\n\n# Shared team tools (every command prints one line of JSON; anyone on the team may use them; scripts run on the host, recorded with status + log)
  ${toolsCmd} preview --dir <app folder in run_test/>       dev server as a background script -> public_url (give THIS to people), url (localhost)
  ${toolsCmd} proto_check --dir <prototype folder in run_test/>   NO-BUILD prototype (index.html + plain scripts + Vue CDN): files exist, scripts parse, every screen/component used is defined; under a second
  ${toolsCmd} bg_start --cmd "<shell command>" [--dir <folder, default run_test>] [--port] [--timeout <min, default 20, max 120>] [--user-asked]   any background script (keeps running; --port gives {port}/$PORT)
  ${toolsCmd} bg_list [--all]                                running scripts (--all: finished ones too: succeeded / failed / stopped / interrupted)
  ${toolsCmd} bg_log --id <id> [--tail 60]                   output of any script, finished or not
  ${toolsCmd} bg_stop --id <id> | preview_restart --id <id>
  ${toolsCmd} proc_list | proc_stop --pid <pid>               stray host processes inside this workspace. Stop only what you started or what is clearly stuck; say what you stopped.` : "";
  const file = join(tmpDir, `${def.name}.L${level}.${randomUUID().slice(0, 8)}.md`);   // unique: two launches of one agent can run at once
  writeFileSync(file, readFileSync(def.prompt_file, "utf8") + (decl ? `\n\n# Sub-agents you may call (roles for --role)\n${decl}\n` : "") + shared);
  return { ...def, allow: t.allow, tools: t.tools, prompt_file: file };
}
/** Backend N: the same declarations as a `--agents` file, plus the CLI's own depth walls as a second layer behind agent.call. */
export function nativeAgentsJson(def: AgentDef, defs: Map<string, AgentDef>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const n of def.agents) {
    const d = defs.get(n); if (!d) continue;
    o[n] = { description: d.description, prompt: readFileSync(d.prompt_file, "utf8"), tools: d.tools, model: d.model };
  }
  return o;
}
export const nativeEnv = (agentMaxDepth: number, maxConcurrent = 4) => ({
  CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: String(Math.max(0, Math.min(agentMaxDepth, HARD_MAX_DEPTH) - 1)),
  CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: String(maxConcurrent),
});
