// API for the dashboard. Run: bun server/index.ts  (port 5189; Vite proxies /api here). Reads the real files; no database.
import { agentDefs } from "./data.ts";
import { buildCards, caseOut } from "./chains.ts";
import { buildModel } from "./model.ts";
import { casesForResponse, health, guardCases, listAgents, listResponses, tryCall } from "./subagents.ts";
import * as ws from "./workspace.ts";

const send = (v: unknown, status = 200) => Response.json(v, { status });

Bun.serve({
  port: Number(process.env.API_PORT ?? 5189),
  hostname: "127.0.0.1",
  async fetch(req) {
    const u = new URL(req.url), p = u.pathname.replace(/^\/api/, ""), m = req.method;
    try {
      if (p === "/cards") return send(buildCards(await buildModel()));
      let r: RegExpMatchArray | null;
      if ((r = p.match(/^\/case\/([\w-]+)$/))) {
        const model = await buildModel(), id = r[1]!;
        if (!model.cases.has(id)) return send({ error: "unknown case" }, 404);
        const c = caseOut(model, id), mine = new Set(c.subSessions.map((x) => x.id));
        const events = model.events.filter((e) => e.id && mine.has(e.id)).map((e) => ({ ...e, own: model.owner.get(e.id!) === id }));
        return send({ ...c, leadSessionId: model.ckpt.get(id)?.sessionId ?? null, last: model.last.get(id) ?? null, events });
      }
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace$/))) return send(ws.snapshot(r[1]!));
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/file$/))) return send({ text: ws.readFile(r[1]!, u.searchParams.get("path") ?? "", u.searchParams.get("scratch") === "1") });
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/mutate$/)) && m === "POST") return send(ws.apply(r[1]!, ((await req.json()) as { ops: ws.Op[] }).ops));
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/reset$/)) && m === "POST") return send(ws.reset(r[1]!));
      if (p === "/subagents") return send({ agents: await listAgents(), responses: listResponses() });
      if (p === "/subagents/usage") { const model = await buildModel(); return send(Object.fromEntries(model.fixtures.map((f) => [f.id, model.usage(f.id)]))); }
      if (p === "/subagents/health") return send(await health());
      if ((r = p.match(/^\/subagents\/response\/([\w-]+)\/cases$/))) return send(await casesForResponse(r[1]!));
      if ((r = p.match(/^\/subagents\/agent\/([\w-]+)\/guard-cases$/))) return send(await guardCases(r[1]!));
      if (p === "/subagents/try" && m === "POST") { const b = (await req.json()) as { agent: string; query: string; done?: string[] }; return send(await tryCall(b.agent, b.query, b.done ?? [])); }
      if (p === "/health") return send({ ok: true, agents: (await agentDefs()).length });
      return send({ error: "not found" }, 404);
    } catch (e) { return send({ error: String((e as Error).message) }, 500); }
  },
});
console.log("api on http://127.0.0.1:" + (process.env.API_PORT ?? 5189));
