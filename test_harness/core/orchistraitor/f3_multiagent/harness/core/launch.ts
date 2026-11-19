// What `launch` builds for one agent (plan sections 19, 20, 21): its tools (the delegate tool is REMOVED at the last level),
// its run-time sub-agent declarations (from agent.json agents[]; .claude/agents stays empty), and the native-backend equivalents.
import { groupsOf } from "./help.ts";
import { delegateDocs as a1DelegateDocs } from "../../approaches/a1_team_cli/delegate_docs.ts";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { permitsTeamCli, usesTeamCommands } from "./base/agents.ts";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { HARD_MAX_DEPTH } from "./agent_call.ts";
import type { AgentDef } from "./base.ts";

export const DELEGATE_ENTRY = "tools.ts delegate";
/** Can this agent call others at this level? Needs declared sub-agents AND room below it. */
export const canCall = (def: AgentDef, level: number, agentMaxDepth: number) => def.agents.length > 0 && level < Math.min(agentMaxDepth, HARD_MAX_DEPTH);

export function launchTools(def: AgentDef, level: number, agentMaxDepth: number): { allow: string[]; tools: string[]; delegate: boolean } {
  const delegate = canCall(def, level, agentMaxDepth);
  const allow = def.allow.filter((a) => delegate || !(a.includes(DELEGATE_ENTRY) || /\bteam (delegate|agent)\b/.test(a)));
  return { allow, tools: [...new Set(allow.map((a) => a.replace(/\(.*$/, "")))], delegate };
}
/** The declarations the model sees: name + one line, built at run time from the callee's own agent.json. */
export function declarations(def: AgentDef, defs: Map<string, AgentDef>): string {
  return def.agents.map((n) => defs.get(n)).filter((d): d is AgentDef => !!d)
    .map((d) => `- ${d.name} (${d.writes ? "can write; must declare --writes" : "read-only"}; ${d.tools.some((t) => /^Web/.test(t)) ? "has web access" : "NO web access"}; tools: ${d.tools.join(", ")}): ${d.description}`).join("\n");
}
/** A launch-time copy of the definition: filtered tools, and a prompt file = CLAUDE.md + the declarations. */
/** `delegateDocs`: how the approach tells a caller to start sub-agents (default: approach 1, the `team` shell commands). */
export function launchDef(def: AgentDef, defs: Map<string, AgentDef>, level: number, agentMaxDepth: number, tmpDir: string, teamCmd?: string, delegateDocs: (teamCmd: string) => string = a1DelegateDocs): AgentDef {
  const t = launchTools(def, level, agentMaxDepth);
  mkdirSync(tmpDir, { recursive: true });
  const decl = t.delegate ? declarations(def, defs) + (teamCmd ? delegateDocs(teamCmd) : "") : "";
  const shared = teamCmd && usesTeamCommands(def) && permitsTeamCli(def.allow) ? `\n\n# Team commands: run them in your shell as: team <command> (every command prints one line of JSON; anyone on the team may use them; scripts run on the host, recorded with status + log)
  ${teamCmd} browser tab|shot|rec|status|connect ...   a real Chrome: shot = one look; tab = your own tab, run a whole script of steps (click, fill, shot ...); rec = named video clips ({"rec":"name"} ... {"rec":"stop"} inside a script). Cheat sheets: browser --help, browser tab --help, browser rec --help
  ${teamCmd} ref capture|compare, site build|audit ...   website-CLONE pipeline (ref capture = real snapshot of a site, site build = run the clone). Syntax: ref --help
  ${teamCmd} proto init|check ...   the NO-BUILD prototype kit (CLONE / APP routes). Syntax: proto --help
  ${teamCmd} bg list|start|log|use|stop|restart|url ...   background tasks (dev server, build, preview). Run bg list first: ONE server per thing, reuse it; start your own only with --separate "<why>". Syntax: bg --help
  ${teamCmd} proc list | proc stop --pid <pid>               stray host processes inside this workspace. Stop only what you started or what is clearly stuck; say what you stopped.` : "";
  try { const cut = Date.now() - 86_400_000; for (const f of readdirSync(tmpDir)) { const p = join(tmpDir, f); if (f.endsWith(".md") && statSync(p).mtimeMs < cut) rmSync(p, { force: true }); } } catch { /* best effort: launch files older than a day are never needed again */ }
  const bugBlock = teamCmd && permitsTeamCli(def.allow) ? `\n\n# Reporting a bug (free, one command)\nWhen a tool fails through no fault of yours, a brief contradicts itself, you are blocked, or an agent misbehaves, record it and carry on:\n  ${teamCmd} bug --kind <bug|tool_error|plan_defect|blocked|slow|hung|stalled|lazy|bad_output> --severity <low|medium|high> --text "<what happened, what you expected, what you did>" [--agent <id>]\nYour session id is attached. One report per problem; it never stops your work. No secrets.` : "";
  const sharedOut = filterShared(shared, def.team_commands, teamCmd) + bugBlock;
  const file = join(tmpDir, `${def.name}.L${level}.${randomUUID().slice(0, 8)}.md`);   // unique: two launches of one agent can run at once
  const base = (def.prompts?.length ? def.prompts : ["CLAUDE.md"]).map((f) => readFileSync(join(dirname(def.prompt_file), f), "utf8").trimEnd()).join("\n\n");   // agent.json "prompts": the static layers, in order
  writeFileSync(file, base + (decl ? `\n\n# Sub-agents you may call (roles for --role)\n${decl}\n` : "")  + sharedOut);
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

/** Keep only the shared-tool lines of the commands in `only` (agent.json "team_commands"); no list = everything. A builder does not need the docs of site_build or bg_start in its context on every turn. */
export function filterShared(block: string, only: string[] | undefined, teamCmd?: string): string {
  if (!block || !only || !teamCmd) return block;
  const keep = new Set([...only, ...groupsOf(only)]), pre = "  " + teamCmd + " ";
  const lines = block.split("\n").filter((l) => !l.startsWith(pre) || keep.has(l.slice(pre.length).split(/[\s|]/)[0]!));
  return lines.some((l) => l.startsWith(pre)) ? lines.join("\n") : "";
}
