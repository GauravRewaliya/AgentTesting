// What `launch` builds for one agent (plan sections 19, 20, 21): its tools (the delegate tool is REMOVED at the last level),
// its run-time sub-agent declarations (from agent.json agents[]; .claude/agents stays empty), and the native-backend equivalents.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
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
  ${toolsCmd} fork_all --from <agent_id> --role <role> --tasks '[{"title":"..","writes":["run_test/p/a.js"],"objective":".."},{...}]'   N tasks for N copies of one agent\'s memory, ALL STARTED AT ONCE (no --async to forget); then ONE wait
  ${toolsCmd} wait --agents <id>,<id> [--any] [--timeout 90]     (after --async calls: waits until they finish and returns their answers)
  ${toolsCmd} agents_list
To ask an agent that already worked on a topic for more, continue it with --session <its agent_id>: it remembers what it did.` : "") : "";
  const shared = toolsCmd && def.agents.length > 0 && def.allow.some((a) => a === "Bash" || a.includes("tools.ts preview")) ? `\n\n# Shared team tools (every command prints one line of JSON; anyone on the team may use them; scripts run on the host, recorded with status + log)
  ${toolsCmd} preview --dir <app folder in run_test/>       dev server as a background script -> public_url (give THIS to people), url (localhost)
  ${toolsCmd} browser_status | browser_connect [--url http://127.0.0.1:9222] | browser_launch [--port 9222] | browser_toggle [--on|--off] | browser_disconnect   the CONNECTED browser (a Chrome a person can see and has logged in to): its open tabs; browse / ref_capture / ref_compare use it when connected, browse --tab '<part of a tab url or title>' inspects a tab that is already open
  ${toolsCmd} browse --url <https://..>|--file run_test/<p>/index.html [--route /blog] [--scheme dark] [--mobile] [--shots <prefix>] [--steps '[{"scroll":900},{"click":"Features"},{"shot":"a.png"},{"outline":true}]']   a REAL browser: scroll, click, screenshots (open with Read), section outline with real computed styles
  ${toolsCmd} ref_assets --name <name used in ref_capture> [--max 30]   download the pictures the reference uses (logo, hero, icons, favicon, css backgrounds) into run_test/_ref/<name>/assets/ + assets.json, no model call
  ${toolsCmd} site_audit --dir run_test/<p> | --url <https://..> [--name <n>]   the real browser checks OUR OWN site (every page, desktop + phone) and lists what to improve: contrast, alt text, dead links, headings, tap targets, overflow, hidden content -> run_test/_audit/<n>/AUDIT.md + score
  ${toolsCmd} ref_store --name <name>   rebuild the store index STORE.md and the mind map MAP.md after layouts / briefs / assets were added
  ${toolsCmd} site_build --dir run_test/<p> --ref <store>[,<store2>] --request "<the person's words>"   THE PIPELINE of a website clone, run by the harness: a design worker + per screens file a brief worker and a builder that starts the moment ITS brief is done (4 at a time); returns a plan_id, follow with plan_status --plan <id> --wait 60
  ${toolsCmd} ref_compare --ref <name> --dir run_test/<p> [--route /]   does the clone match the captured reference? score + one line per gap (sections, card grids, CTAs, icons, animation, fonts, dark theme, dead links)
  ${toolsCmd} ref_capture --url <https://site> --name <short-name> [--more "<url>=<name>,<url>=<name>"]   REAL reference of a site for a clone, no model call: raw html, css tokens (colours, fonts, variables), screenshots light/dark/mobile you can LOOK at with Read, sections and links -> run_test/_ref/<name>/REF.md
  ${toolsCmd} proto_init --dir run_test/<project> --title "<name>" --nav "Overview, Apps, Build>Logs, Build>Playground, Settings" [--kind site --accent #10b981 --font "DM Sans" --bg-dark #0b0d10 --extra "Privacy, Terms"]   START of a prototype (kind app = admin dashboard; kind site = marketing / blog WEBSITE with light+dark themes, scroll animations, every page linked) in milliseconds (no model call): design kit + working shell + one stub screen per nav item + PROTO.md; "Group>Label" puts screens of one group in one file (one builder each)
  ${toolsCmd} proto_check --dir <prototype folder in run_test/>   NO-BUILD prototype (index.html + plain scripts + Vue CDN): files exist, scripts parse, every screen/component used is defined; under a second
  ${toolsCmd} bg_start --cmd "<shell command>" [--dir <folder, default run_test>] [--port] [--timeout <min, default 20, max 120>] [--user-asked]   any background script (keeps running; --port gives {port}/$PORT)
  ${toolsCmd} bg_list [--all]                                running scripts (--all: finished ones too: succeeded / failed / stopped / interrupted)
  ${toolsCmd} bg_log --id <id> [--tail 60]                   output of any script, finished or not
  ${toolsCmd} bg_stop --id <id> | preview_restart --id <id>
  ${toolsCmd} proc_list | proc_stop --pid <pid>               stray host processes inside this workspace. Stop only what you started or what is clearly stuck; say what you stopped.` : "";
  try { const cut = Date.now() - 86_400_000; for (const f of readdirSync(tmpDir)) { const p = join(tmpDir, f); if (f.endsWith(".md") && statSync(p).mtimeMs < cut) rmSync(p, { force: true }); } } catch { /* best effort: launch files older than a day are never needed again */ }
  const sharedOut = filterShared(shared, def.team_tools, toolsCmd);
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

/** Keep only the shared-tool lines of the commands in `only` (agent.json "team_tools"); no list = everything. A builder does not need the docs of site_build or bg_start in its context on every turn. */
export function filterShared(block: string, only: string[] | undefined, toolsCmd?: string): string {
  if (!block || !only || !toolsCmd) return block;
  const keep = new Set(only), pre = "  " + toolsCmd + " ";
  const lines = block.split("\n").filter((l) => !l.startsWith(pre) || keep.has(l.slice(pre.length).split(/[\s|]/)[0]!));
  return lines.some((l) => l.startsWith(pre)) ? lines.join("\n") : "";
}
