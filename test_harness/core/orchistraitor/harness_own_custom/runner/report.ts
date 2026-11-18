// Builds the run report for one turn. Nothing is asserted: the report puts what was EXPECTED (plain text) next to what
// HAPPENED, and a human / Claude judges it. Session labels (`writer#1`) are assigned here and saved in the checkpoint.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Run } from "./claude.ts";
import type { Expected } from "@core/types.ts";

const walk = (d: string, base = d): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name), base) : [join(d, e.name).slice(base.length + 1)]);

export type Summary = { lines: string[]; actual: string[]; expected: string[]; match: boolean; guard: boolean; notfound: boolean; other_tools: string[]; calls: number; cost: number };
export function report(exp: Expected, run: Run, ws: string, ids: Record<string, string>): Summary {
  const out: string[] = [];
  const labelOf = (id?: string) => Object.entries(ids).find(([, v]) => v === id)?.[0];
  const actual: string[] = []; let k = 0;
  const calls = run.leadCalls.filter((c) => c.tool === "Agent" || c.tool === "SendMessage");
  const lines: string[] = [];
  for (const c of calls) {
    if (c.tool === "Agent") {
      const agent = c.agent ?? "?"; const n = Object.keys(ids).filter((l) => l.startsWith(agent + "#")).length + 1;
      const label = `${agent}#${n}`; if (c.resultId) ids[label] = c.resultId;
      const res = run.served[k++] ?? "(no recorded result)"; actual.push(res);
      lines.push(`  Agent(${agent}) -> NEW session ${label} id=${c.resultId ?? "?"} served=${res}\n    hand-over: ${(c.prompt ?? "").replace(/\s+/g, " ").slice(0, 320)}`);
    } else {
      const lab = labelOf(c.to) ?? `unknown(${c.to})`; actual.push(`session:${lab}`);
      lines.push(`  SendMessage(to ${c.to}) -> SAME session ${lab}\n    message: ${(c.prompt ?? "").replace(/\s+/g, " ").slice(0, 240)}`);
    }
  }
  const other = run.leadCalls.filter((c) => c.tool !== "Agent" && c.tool !== "SendMessage").map((c) => c.tool);
  out.push("   EXPECTED context : " + exp.context);
  out.push("   EXPECTED responders: " + JSON.stringify(exp.expected_agents_res));
  out.push("   ACTUAL responders  : " + JSON.stringify(actual));
  out.push("   calls (" + calls.length + "):" + (lines.length ? "\n" + lines.join("\n") : " none"));
  out.push("   other lead tools : " + (other.length ? other.join(", ") : "none"));
  if (run.forbiddenHit) out.push("   GUARD stop       : " + run.forbiddenHit);
  if (run.mockMiss) out.push("   NOTFOUND         : a sub-agent had no recorded result");
  let files: string[] = []; try { files = walk(ws); } catch {}
  out.push("   files in run_test: " + (files.join(", ") || "none"));
  if (run.subTexts.length) out.push("   sub-agent said   : " + run.subTexts.map((s) => s.replace(/\s+/g, " ").slice(0, 200)).join("\n                      "));
  out.push("   lead reply       : " + run.reply.replace(/\s+/g, " ").slice(0, 400));
  const match = JSON.stringify(actual) === JSON.stringify(exp.expected_agents_res);
  return { lines: out, actual, expected: exp.expected_agents_res, match, guard: !!run.forbiddenHit, notfound: run.mockMiss, other_tools: other, calls: calls.length, cost: run.cost };
}
