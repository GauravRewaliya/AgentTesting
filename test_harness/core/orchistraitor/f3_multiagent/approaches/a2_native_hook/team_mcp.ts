// The lead's team commands as TYPED TOOLS (an MCP stdio server), instead of `Bash(team ...)` strings.
// Why: no shell quoting (the "don't ask mode" refusals of T-04 came from quoted JSON), typed flags the model cannot misspell, one allow rule (`mcp__team`),
// and `delegate` is simply NOT offered (the lead delegates with the native Agent / SendMessage tools, answered by hook.ts).
// Every tool is a thin call of the shared `harness/tools.ts <command> --flag value`; the server adds nothing else (same core, same rules as a1).
// Identity (HARNESS_STORE/TASK/AGENT/CWD ...) is passed in the MCP config `env` by adapter.ts (the CLI does not hand its own env to MCP servers).
// Protocol: newline-delimited JSON-RPC 2.0 on stdio (initialize, tools/list, tools/call, ping); no SDK needed.
// Free self-check: self_test/approach_a2.ts (initialize, tools/list, a real tools/call, `delegate` refused).
import { join } from "node:path";

const TOOLS_TS = join(import.meta.dir, "..", "..", "harness", "tools.ts");
import { TEAM_TOOLS, listed, toArgv } from "../../harness/leadkit/team_tools.ts";
export { TEAM_TOOLS, listed, toArgv };
export { CORE } from "../../harness/leadkit/team_tools.ts";

async function call(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const argv = toArgv(name, args);
  if ("error" in argv) return { text: JSON.stringify({ ok: false, reason: argv.error }), isError: true };
  const p = Bun.spawn(["bun", "--smol", TOOLS_TS, ...argv], { env: process.env, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]); await p.exited;
  const text = out.trim() || JSON.stringify({ ok: false, reason: "no output", stderr: err.slice(0, 300) });
  return { text, isError: !out.trim() };
}

const send = (o: unknown) => process.stdout.write(JSON.stringify(o) + "\n");
export async function handle(msg: { id?: number | string; method?: string; params?: any }) {
  const reply = (result: unknown) => msg.id !== undefined && send({ jsonrpc: "2.0", id: msg.id, result });
  switch (msg.method) {
    case "initialize": return reply({ protocolVersion: msg.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "team", version: "1.0.0" } });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: listed().map((t) => ({ name: t.name, description: t.description, inputSchema: { type: "object", properties: t.props, ...(t.required ? { required: t.required } : {}) } })) });
    case "tools/call": { const r = await call(msg.params?.name, msg.params?.arguments ?? {}); return reply({ content: [{ type: "text", text: r.text }], isError: r.isError }); }
    default: if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "method not found: " + msg.method } });
  }
}

if (import.meta.main) {
  let buf = "";
  const pending = new Set<Promise<unknown>>();
  for await (const chunk of Bun.stdin.stream()) {
    buf += new TextDecoder().decode(chunk);
    for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) { const pr = handle(JSON.parse(line)).finally(() => pending.delete(pr)); pending.add(pr); }   // calls run concurrently: a `wait` must not block a `ps`
    }
  }
  await Promise.all(pending);
}
