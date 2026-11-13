// Is the `Artifact` tool available to a HEADLESS `claude -p` lead? Four ways to find out (4 tiny haiku calls).
//   bun core/harness_own_custom/test/artifact_probe.ts        -> last_artifact_probe.json (read by the report; capabilities.ts artifact.publish)
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const cwd = mkdtempSync(join(tmpdir(), "art-probe-"));
const base = ["-p", "--setting-sources", "", "--strict-mcp-config", "--model", "haiku", "--output-format", "text"];
async function ask(label: string, prompt: string, extra: string[]) {
  const p = Bun.spawn(["claude", ...base, ...extra, prompt], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", CLAUDE_CODE_ENTRYPOINT: "cli-interactive" } });
  const out = (await new Response(p.stdout).text()).trim(); await p.exited;
  return { label, reply: out.slice(0, 160), has: /^yes\b/i.test(out) || (/\bartifact\b/i.test(out) && label === "tool list" && /(^|[ ,])Artifact([ ,]|$)/.test(out)) };
}
const rs = [
  await ask("tool list", "Reply with exactly the names of the tools you have access to, comma separated. Nothing else.", []),
  await ask("--tools Artifact", "Reply with exactly the names of the tools you have access to, comma separated. Nothing else.", ["--tools", "Artifact,Write,Read"]),
  await ask("--allowedTools Artifact", "Do you have a tool named Artifact? Answer only yes or no.", ["--allowedTools", "Artifact"]),
  await ask("ToolSearch", "Use the ToolSearch tool with query 'select:Artifact' and tell me in one line whether an Artifact tool exists. Start with Yes or No.", []),
];
const available = rs.some((r) => r.has);
for (const r of rs) console.log(`${r.has ? "YES" : "no "}  ${r.label}: ${r.reply.replace(/\s+/g, " ").slice(0, 110)}`);
console.log(available ? "\nAn Artifact tool IS available: the artifact cases can run." : "\nNo Artifact tool in headless claude -p: the artifact cases cannot work here.");
writeFileSync(join(import.meta.dir, "last_artifact_probe.json"), JSON.stringify({ at: new Date().toISOString(), cli: (await Bun.$`claude --version`.text()).trim(), available, results: rs }, null, 1));
