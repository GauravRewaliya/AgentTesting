// How big is every agent's prompt? ONE place for the numbers: the free check (`bun test_harness/scripts/check_prompts.ts`), the self-test and the UI server's start-up warning all use this.
// STATIC prompt = the files named in agent.json `prompts` (default CLAUDE.md): it is sent on every turn of every call, so it must stay short and crisp: role, how it works, how it answers. Details go into
// `chapters/<name>.md` (read once with `team chapter --name <name>`). Limit: PROMPT_LIMIT characters per static prompt and per chapter (and under 200 lines).
// NOTE (the project owner, 2026-11-19): PROMPT_LIMIT (8000) and LAUNCH_LIMIT are only OUR WARNING limits, to keep prompts crisp. Nothing is cut or discarded at 8000: the real limit is about 40k characters.
// So a prompt over 8000 still works in full; the warning is a nudge to move detail into a chapter, not a failure. Do not shorten a rule only to get under it when the rule matters.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PROMPT_LIMIT = Number(process.env.PROMPT_LIMIT ?? 8000), LINE_LIMIT = Number(process.env.PROMPT_LINE_LIMIT ?? 200);   // our own rule (Claude Code itself only recommends CLAUDE.md under ~200 lines and gives no character cap); raised 6000 -> 8000 on 2026-11-18
/** What the model really receives at LAUNCH (the file + the team-tool docs the harness appends; a2 lead: + call syntax and agent declarations). Over it: a console warning and an admin report (env PROMPT_LAUNCH_LIMIT). */
export const LAUNCH_LIMIT = Number(process.env.PROMPT_LAUNCH_LIMIT ?? 8000);
export interface PromptSize { agent: string; set: "main_flow" | "test"; file: string; chars: number; lines: number; kind: "prompt" | "chapter"; over: boolean }
const ROOT = import.meta.dir;

export function promptSizes(): PromptSize[] {
  const out: PromptSize[] = [];
  for (const set of ["main_flow", "test"] as const) {
    const root = join(ROOT, set === "main_flow" ? "main_flow_agents" : "test_agents");
    if (!existsSync(root)) continue;
    for (const agent of readdirSync(root).sort()) {
      const dir = join(root, agent), jf = join(dir, "agent.json");
      if (!existsSync(jf)) continue;
      const files: string[] = (JSON.parse(readFileSync(jf, "utf8")).prompts as string[] | undefined) ?? ["CLAUDE.md"];
      const texts = files.map((f) => join(dir, ".claude", f)).filter(existsSync).map((f) => readFileSync(f, "utf8"));
      const chars = texts.reduce((n, t) => n + t.length, 0), lines = texts.reduce((n, t) => n + t.split("\n").length, 0);
      out.push({ agent, set, file: files.join(" + "), chars, lines, kind: "prompt", over: chars > PROMPT_LIMIT || lines >= LINE_LIMIT });
      const ch = join(dir, "chapters");
      if (existsSync(ch)) for (const f of readdirSync(ch).filter((x) => x.endsWith(".md")).sort()) { const t = readFileSync(join(ch, f), "utf8"); out.push({ agent, set, file: "chapters/" + f, chars: t.length, lines: t.split("\n").length, kind: "chapter", over: t.length > PROMPT_LIMIT }); }
    }
  }
  return out;
}
/** One line per prompt or chapter over the limit (empty = all fine). */
export const promptWarnings = (): string[] => promptSizes().filter((p) => p.over).map((p) => `${p.agent} ${p.kind} ${p.file}: ${p.chars} chars, ${p.lines} lines (limit ${PROMPT_LIMIT} chars, ${LINE_LIMIT} lines): shorten it, move details into chapters/`);

/** Shouting emphasis (MUST, NEVER, ALWAYS, CRITICAL, IMPORTANT in capitals): the newer models follow plain wording and over-trigger on forcing language, so a prompt says it normally. Advice only (a warning, never a failure). */
const SHOUT = /\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT|DO NOT|FORBIDDEN|ABSOLUTELY)\b/g;
export function emphasisWarnings(): string[] {
  const out: string[] = [];
  for (const set of ["main_flow_agents", "test_agents"]) {
    const root = join(ROOT, set); if (!existsSync(root)) continue;
    for (const agent of readdirSync(root).sort()) {
      const files = [join(root, agent, ".claude", "CLAUDE.md"), ...(existsSync(join(root, agent, "chapters")) ? readdirSync(join(root, agent, "chapters")).map((f) => join(root, agent, "chapters", f)) : [])];
      for (const f of files) { if (!existsSync(f) || !f.endsWith(".md")) continue; const hits = [...readFileSync(f, "utf8").matchAll(SHOUT)].map((m) => m[1]!); if (hits.length) out.push(`${agent} ${f.split(agent + "/")[1]}: shouting emphasis x${hits.length} (${[...new Set(hits)].join(", ")}): say it in plain words`); }
    }
  }
  return out;
}
