// Runs the test_artifact suite FOR REAL: a haiku lead (headless `claude -p`) with the REAL Artifact tool. Nothing is mocked.
//   bun testrun/artifact_run.ts [case ids]        (cost: ~ $0.01-0.05 per case; artifacts are created PRIVATE in the account of the logged-in user)
// Why this exists: headless `claude -p` only gets the Artifact tools when CLAUDE_CODE_ENTRYPOINT=cli-interactive (probed 2026-11-13, CLI 2.1.323).
// PASS needs ALL of: (1) the lead really called the Artifact tool and it succeeded, (2) the reply contains that exact claude.ai/artifact link,
// (3) the reply has no other artifact link (an invented one). A case that gets no link fails, unless the lead says plainly it cannot (art_3_figma) and invents nothing.
// Exit code 1 on any FAIL, so a broken artifact flow can never pass silently again.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSuites } from "./cases.ts";

const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const suites = await loadSuites();
const cases = suites.filter((c: any) => c.suite === "test_artifact").filter((c: any) => !ids.length || ids.includes(c.id));
if (!cases.length) { console.error("no test_artifact cases found (loadSuites shape changed?)"); process.exit(1); }
const OUT = join(import.meta.dir, "..", "..", "..", "..", ".state", "artifact_runs"); mkdirSync(OUT, { recursive: true });
const LINK = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9-]+/g;
const allowedTools = "Artifact ArtifactComments Write Read Skill";
let failed = 0;
for (const c of cases) {
  const ws = join(OUT, c.id); mkdirSync(ws, { recursive: true });
  const prompt = c.turns[0].user + `\nWrite your page file under ${ws}.`;
  const p = Bun.spawn(["claude", "-p", prompt, "--model", "haiku", "--output-format", "stream-json", "--verbose", "--setting-sources", "", "--strict-mcp-config",
    "--tools", "Artifact,ArtifactComments,Write,Read,Skill", "--permission-mode", "dontAsk", "--allowedTools", ...allowedTools.split(" ")],
    { cwd: ws, stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "cli-interactive", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" } });
  const timer = setTimeout(() => p.kill(9), 600_000);
  const raw = (await new Response(p.stdout).text()).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  await p.exited; clearTimeout(timer);
  const tools = raw.filter((e: any) => e.type === "assistant").flatMap((e: any) => e.message.content.filter((b: any) => b.type === "tool_use"));
  const artUse = tools.filter((t: any) => t.name === "Artifact" && (t.input?.action ?? "publish") === "publish");
  const results = raw.filter((e: any) => e.type === "user").flatMap((e: any) => Array.isArray(e.message.content) ? e.message.content : []).filter((b: any) => b.type === "tool_result" && artUse.some((t: any) => t.id === b.tool_use_id));
  const real = new Set(results.flatMap((r: any) => (JSON.stringify(r.content).match(LINK) ?? []).map((u) => u.replace(/\\.*/, ""))));
  const res = raw.find((e: any) => e.type === "result") ?? {}, reply: string = res.result ?? "", cost: number = res.total_cost_usd ?? 0;
  const links = reply.match(LINK) ?? [], invented = links.filter((l) => !real.has(l));
  const problems: string[] = [];
  if (!tools.length && !reply) problems.push("the lead produced nothing (claude failed or timed out)");
  if (real.size === 0) { if (!(c.id === "art_3_figma" && !links.length && reply)) problems.push("no Artifact publish succeeded (no real link was created)"); }
  else if (!links.some((l) => real.has(l))) problems.push("reply does not contain the real artifact link");
  if (invented.length) problems.push(`reply has an INVENTED link: ${invented.join(", ")}`);
  const status = problems.length ? "FAIL" : "PASS"; if (problems.length) failed++;
  console.log(`${status}  ${c.id}  $${cost.toFixed(3)}  tools: ${[...new Set(tools.map((t: any) => t.name))].join(",") || "-"}  ${[...real].join(" ") || ""}${problems.length ? "\n      - " + problems.join("\n      - ") : ""}`);
  writeFileSync(join(OUT, c.id + ".json"), JSON.stringify({ at: new Date().toISOString(), status, problems, cost, real: [...real], reply, tools: tools.map((t: any) => ({ name: t.name, input: JSON.stringify(t.input).slice(0, 300) })) }, null, 1));
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
