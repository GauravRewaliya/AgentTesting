// API for the dashboard. Run: bun server/index.ts  (port 5189; Vite proxies /api here). Reads the real files; no database.
import { agentDefs, loadSuites } from "./data.ts";
import { branchWarnings } from "../../../branch.ts";
import { buildCards, caseOut } from "./chains.ts";
import { buildModel } from "./model.ts";
import { casesForResponse, health, guardCases, listAgents, listResponses, tryCall } from "./subagents.ts";
import * as ws from "./workspace.ts";
import * as exp from "./experiment.ts";
import * as runs from "./runs.ts";
import { caseEvents } from "./data.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_VERSION, currentWorkspace, workspaceDir } from "@core/paths.ts";

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
        // events come from .state: this case's session plus the sessions it continues (`after` chain); own = this case's
        const chain: string[] = []; for (let k: string | undefined = id; k && model.cases.has(k) && !chain.includes(k); k = model.cases.get(k)!.raw.after) chain.push(k);
        const events = chain.flatMap((k) => caseEvents(k).map((e) => ({ ...e, own: k === id })));
        return send({ ...c, leadSessionId: model.ckpt.get(id)?.sessionId ?? null, last: model.last.get(id) ?? null, events });
      }
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace$/))) return send(ws.snapshot(r[1]!));
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/file$/))) return send({ text: ws.readFile(r[1]!, u.searchParams.get("path") ?? "", u.searchParams.get("scratch") === "1") });
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/mutate$/)) && m === "POST") return send(ws.apply(r[1]!, ((await req.json()) as { ops: ws.Op[] }).ops));
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/reset$/)) && m === "POST") return send(ws.reset(r[1]!));
      if (p === "/state2" || p === "/state2/sync") { const sy = await import("./state2.ts"), st = await import("@core/state2/store.ts"); if (p.endsWith("sync")) await sy.syncAll(); return send(st.readIndex()); }
      if ((r = p.match(/^\/state2\/session\/([\w.-]+)\/([\w.-]+)$/))) { const x = (await import("@core/state2/store.ts")).readSession(r[1]!, r[2]!); return x ? send(x) : send({ error: "no such session" }, 404); }
      if (p === "/runs") return send(runs.sessionRuns());
      if ((r = p.match(/^\/case\/([\w-]+)\/runs$/))) return send(await runs.caseRuns(r[1]!));
      if (p === "/run" && m === "POST") return send(await runs.startRun((await req.json()) as { case: string; rerun?: boolean }));
      if (p === "/run/judge" && m === "POST") { const b = (await req.json()) as { id: string; again?: boolean }; return send(await runs.judgeRun(b.id, b.again)); }
      if (p === "/run/stop" && m === "POST") return send(runs.stopRun(((await req.json()) as { id: string }).id));
      if ((r = p.match(/^\/run\/([\w-]+)$/))) return send(runs.runLog(r[1]!));
      if (p === "/subagents") return send({ agents: await listAgents(), responses: listResponses() });
      if (p === "/subagents/usage") { const model = await buildModel(); return send(Object.fromEntries(model.fixtures.map((f) => [f.id, model.usage(f.id)]))); }
      if (p === "/subagents/health") return send(await health());
      if ((r = p.match(/^\/subagents\/response\/([\w-]+)\/cases$/))) return send(await casesForResponse(r[1]!));
      if ((r = p.match(/^\/subagents\/agent\/([\w-]+)\/guard-cases$/))) return send(await guardCases(r[1]!));
      if (p === "/subagents/try" && m === "POST") { const b = (await req.json()) as { agent: string; query: string; done?: string[] }; return send(await tryCall(b.agent, b.query, b.done ?? [])); }
      if (p === "/experiment") return send(await exp.overview());
      if (p === "/experiment/live") return send(exp.live());
      if (p === "/experiment/session/delete" && m === "POST") return send(exp.deleteSession(((await req.json()) as { task: string }).task));
      if (p === "/experiment/agents") return send(exp.availableAgents());
      if (p === "/experiment/send" && m === "POST") return send(exp.send((await req.json()) as never));
      if (p === "/experiment/cancel" && m === "POST") { const b = (await req.json()) as { task: string; id: string }; return send(exp.cancelQueued(b.task, b.id)); }
      if ((r = p.match(/^\/experiment\/chat\/([\w-]+)$/))) return send(exp.chat(r[1]!));
      if (p === "/experiment/run" && m === "POST") return send(exp.startRun((await req.json()) as never));
      if (p === "/experiment/stop" && m === "POST") return send(exp.stopRun(((await req.json()) as { id: string }).id));
      if ((r = p.match(/^\/experiment\/run\/([\w-]+)$/))) return send(exp.runLog(r[1]!));
      if ((r = p.match(/^\/experiment\/result\/([\w-]+)$/))) { const x = await exp.caseResult(r[1]!); return x ? send(x) : send({ error: "this case has not run yet" }, 404); }
      if (p === "/health") return send({ ok: true, agents: (await agentDefs()).length, workspace: { id: currentWorkspace(), version: STATE_VERSION, ...(() => { try { return JSON.parse(readFileSync(join(workspaceDir(), "workspace.json"), "utf8")); } catch { return {}; } })() } });
      return send({ error: "not found" }, 404);
    } catch (e) { return send({ error: String((e as Error).message) }, 500); }
  },
});
console.log("api on http://127.0.0.1:" + (process.env.API_PORT ?? 5189));
// at start (`bun run dev`): 2+ cases under one parent must use the branch syntax (TestCases/branch.ts)
try { for (const w of branchWarnings((await loadSuites()).flatMap((x) => x.cases.map((c) => ({ ...c, suite: x.suite }))))) console.warn("\x1b[33mWARNING\x1b[0m " + w); } catch (e) { console.warn("branch check skipped: " + String(e).slice(0, 100)); }
// at start: leftovers worth a look. Reported only; nothing is cleaned up automatically.
try { const hints = exp.cleanupHints(); if (hints.length) { console.warn(`\x1b[33mWARNING\x1b[0m ${hints.length} possible leftover(s) in .state (cleanup candidates, NOT cleaned automatically):`); for (const h of hints) console.warn("  - " + h); } } catch (e) { console.warn("cleanup scan skipped: " + String(e).slice(0, 100)); }
