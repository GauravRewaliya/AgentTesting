// API for the dashboard. Run: bun server/index.ts  (port 5189; Vite proxies /api here). Reads the real files; no database.
import { agentDefs, loadSuites } from "./data.ts";
import { branchWarnings } from "../../../TestCases/branch.ts";
import { buildCards, caseOut } from "./chains.ts";
import { buildModel } from "./model.ts";
import { casesForResponse, health, guardCases, listAgents, listResponses, tryCall } from "./subagents.ts";
import * as ws from "./workspace.ts";
import * as exp from "./experiment.ts";
import * as runs from "./runs.ts";
import * as pv from "./preview.ts";
import * as hub from "./hub.ts";
import * as br from "./browser.ts";
import * as st from "./settings.ts";
import * as pt from "./prompttests.ts";
import { usage } from "./usage.ts";
import { PROMPT_LIMIT, emphasisWarnings, promptWarnings } from "@core/agents/prompt_sizes.ts";
import { caseEvents } from "./data.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_VERSION, currentWorkspace, workspacePath } from "@core/paths.ts";
const workspaceDir = (): string => workspacePath(currentWorkspace());   // the workspace the pointer names right now

const send = (v: unknown, status = 200) => Response.json(v, { status });

Bun.serve({
  port: Number(process.env.API_PORT ?? 5189),
  hostname: "127.0.0.1",
  websocket: hub.websocket,
  async fetch(req, server) {
    const u = new URL(req.url), p = u.pathname.replace(/^\/api/, ""), m = req.method;
    try {
      if (p === "/ws") return server.upgrade(req, { data: hub.newClient() }) ? undefined : send({ error: "websocket upgrade failed" }, 400);
      if (p === "/cards") return send(buildCards(await buildModel()));
      let r: RegExpMatchArray | null;
      if ((r = p.match(/^\/case\/([\w-]+)$/))) {
        const model = await buildModel(), id = r[1]!;
        if (!model.cases.has(id)) return send({ error: "unknown case" }, 404);
        const c = caseOut(model, id), mine = new Set(c.subSessions.map((x) => x.id));
        // events come from .state: this case's session plus the sessions it continues (`after` chain); own = this case's
        const chain: string[] = []; for (let k: string | undefined = id; k && model.cases.has(k) && !chain.includes(k); k = model.cases.get(k)!.raw.after) chain.push(k);
        const events = chain.flatMap((k) => caseEvents(k).map((e) => ({ ...e, own: k === id })));
        return send({ ...c, home: exp.f1Home(id) ?? null, leadSessionId: model.ckpt.get(id)?.sessionId ?? null, last: model.last.get(id) ?? null, events });
      }
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace$/))) return send(ws.snapshot(r[1]!));
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/file$/))) return send({ text: ws.readFile(r[1]!, u.searchParams.get("path") ?? "", u.searchParams.get("scratch") === "1") });
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/mutate$/)) && m === "POST") return send(ws.apply(r[1]!, ((await req.json()) as { ops: ws.Op[] }).ops));
      if ((r = p.match(/^\/case\/([\w-]+)\/workspace\/reset$/)) && m === "POST") return send(ws.reset(r[1]!));
      if (p === "/runs") return send(runs.sessionRuns());
      if ((r = p.match(/^\/case\/([\w-]+)\/runs$/))) return send(await runs.caseRuns(r[1]!));
      if (p === "/run" && m === "POST") return send(await runs.startRun((await req.json()) as { case: string }));
      if (p === "/run/judge" && m === "POST") { const b = (await req.json()) as { id: string; again?: boolean }; return send(await runs.judgeRun(b.id, b.again)); }
      if (p === "/run/stop" && m === "POST") return send(runs.stopRun(((await req.json()) as { id: string }).id));
      if ((r = p.match(/^\/run\/([\w-]+)$/))) return send(runs.runLog(r[1]!));
      if (p === "/subagents") return send({ agents: await listAgents(), responses: listResponses() });
      if (p === "/subagents/usage") { const model = await buildModel(); return send(Object.fromEntries(model.fixtures.map((f) => [f.id, model.usage(f.id)]))); }
      if (p === "/subagents/health") return send(await health());
      if ((r = p.match(/^\/subagents\/response\/([\w-]+)\/cases$/))) return send(await casesForResponse(r[1]!));
      if ((r = p.match(/^\/subagents\/agent\/([\w-]+)\/guard-cases$/))) return send(await guardCases(r[1]!));
      if (p === "/subagents/try" && m === "POST") { const b = (await req.json()) as { agent: string; query: string; done?: string[] }; return send(await tryCall(b.agent, b.query, b.done ?? [])); }
      if ((r = p.match(/^\/experiment\/bg\/([\w.-]+)$/))) return send(pv.bgOf(r[1]!));
      if ((r = p.match(/^\/experiment\/evidence\/([\w.-]+)$/))) return send(pv.evidenceOf(r[1]!));   // a single load; the page gets it pushed over the socket
      if ((r = p.match(/^\/evidence\/([\w.-]+)\/(qa|shots|qa_rec)\/(.+)$/))) { const f = pv.evidenceFile(r[1]!, r[2]!, decodeURIComponent(r[3]!)); return f ? new Response(Bun.file(f), { headers: { "cache-control": "no-cache" } }) : send({ error: "no such evidence file" }, 404); }
      if (p === "/bg/restart" && m === "POST") { const b = (await req.json()) as { task: string; id: string }; return send(await pv.restartScript(b.task, b.id)); }
      if (p === "/proc/stop" && m === "POST") { const b = (await req.json()) as { task: string; pid: number }; return send(pv.stopProc(b.task, Number(b.pid))); }
      if (p === "/bg/stop" && m === "POST") { const b = (await req.json()) as { task: string; id: string }; return send(pv.stopScript(b.task, b.id)); }
      if (p === "/bg/log" ) return send(pv.scriptLog(u.searchParams.get("task") ?? "", u.searchParams.get("id") ?? "", Number(u.searchParams.get("tail") ?? 80)));
      if (p === "/prompt-tests" && m === "GET") return send(await pt.catalog());   // the catalog is one load; results and runs are pushed (topic prompttests)
      if (p === "/prompt-tests/run" && m === "POST") return send(pt.startRun((await req.json()) as never));
      if (p === "/prompt-tests/log") return send({ text: pt.runLog(u.searchParams.get("id") ?? "") });
      if (p === "/prompt-tests/mark" && m === "POST") { const b = (await req.json()) as { caseId: string; mark: string | null }; return send(pt.setPMark(b.caseId, b.mark)); }   // "fixed" / "known" on a failing prompt case (it stays FAILED until a re-run passes)
      if (p === "/case-marks" && m === "GET") return send(pt.marks());
      if (p === "/case-marks" && m === "POST") { const b = (await req.json()) as { caseId: string; mark: string | null }; return send(pt.setMark(b.caseId, b.mark)); }
      if (p === "/settings" && m === "GET") return send(st.state());
      if (p === "/usage") return send(usage());
      if (p === "/settings/agents" && m === "POST") { const b = (await req.json()) as { clone?: string; name: string; parent?: string; description: string; model?: string; prompt?: string; tools?: string[]; writes?: boolean }; return send(b.clone ? st.clone(b.clone, b.name, b.parent) : st.create(b)); }
      if ((r = p.match(/^\/settings\/agents\/([\w-]+)$/))) { const n = r[1]!; if (m === "PUT") return send(st.edit(n, (await req.json()) as never)); if (m === "DELETE") return send(st.remove(n)); }
      if ((r = p.match(/^\/settings\/agents\/([\w-]+)\/(enable|disable|move)$/)) && m === "POST") return send(r[2] === "move" ? st.move(r[1]!, (await req.json()) as never) : st.setDisabled(r[1]!, r[2] === "disable"));
      if (p === "/settings/agents/connect" && m === "POST") { const b = (await req.json()) as { from: string; to: string }; return send(st.connect(b.from, b.to)); }
      if (p === "/settings/agents/disconnect" && m === "POST") { const b = (await req.json()) as { from: string; to: string }; return send(st.disconnect(b.from, b.to)); }
      if (p === "/settings/agents/reset-lines" && m === "POST") return send(st.resetLines());
      if (p === "/settings/scan-connectors" && m === "POST") return send(await st.scanConnectors());
      if ((r = p.match(/^\/settings\/plugins\/([^/]+)$/)) && m === "PUT") return send(st.setPlugin(decodeURIComponent(r[1]!), ((await req.json()) as { agents?: string[] }).agents ?? []));
      if ((r = p.match(/^\/settings\/plugins\/([^/]+)$/)) && m === "PUT") return send(st.setPlugin(decodeURIComponent(r[1]!), ((await req.json()) as { agents: string[] }).agents ?? []));
      if ((r = p.match(/^\/settings\/integrations\/(\w+)$/)) && m === "PUT") return send(st.setIntegration(r[1]!, (await req.json()) as never));
      if ((r = p.match(/^\/settings\/integrations\/(\w+)\/test$/)) && m === "POST") return send(await st.testIntegration(r[1]!));
      if (p === "/browser") return send(await br.overview());
      if (p === "/browser/connect" && m === "POST") return send(await br.connect(((await req.json()) as { url: string }).url));
      if (p === "/browser/launch" && m === "POST") return send(await br.launch(Number(((await req.json()) as { port?: number }).port ?? 9222)));
      if (p === "/browser/disconnect" && m === "POST") return send(br.disconnect());
      if (p === "/browser/toggle" && m === "POST") return send(await br.toggle(!!((await req.json()) as { on: boolean }).on));
      if (p === "/browser/open" && m === "POST") return send(await br.open(((await req.json()) as { url: string }).url));
      if (p === "/browser/snapshot") return send(await br.snapshot(u.searchParams.get("tab") ?? ""));
      if (p === "/browser/try" && m === "POST") { const b = (await req.json()) as { url: string; scheme?: "light" | "dark" }; return send(await br.tryIt(b.url, b.scheme)); }
      if (p === "/experiment") return send(await exp.overview());
      if (p === "/experiment/live") return send(exp.live());
      if (p === "/experiment/session/delete" && m === "POST") return send(exp.deleteSession(((await req.json()) as { task: string }).task));
      if ((r = p.match(/^\/experiment\/agent\/([\w.-]+)\/([^/]+)$/))) return send(exp.agentDetail(r[1]!, decodeURIComponent(r[2]!)));
      if ((r = p.match(/^\/experiment\/transcript\/([\w-]+)\/([^/]+)$/))) return send(exp.transcript(r[1]!, decodeURIComponent(r[2]!)));
      if (p === "/experiment/agent/talk" && m === "POST") return send(exp.talkToAgent((await req.json()) as never));
      if (p === "/experiment/agents") return send(exp.availableAgents());
      if (p === "/experiment/send" && m === "POST") return send(exp.send((await req.json()) as never));
      if (p === "/experiment/session/stop" && m === "POST") return send(await exp.stopSession(((await req.json()) as { task: string }).task));
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
// at start: an agent prompt or chapter over the size limit (see core/agents/prompt_sizes.ts; `bun test_harness/scripts/check_prompts.ts` shows the table). Reported only.
try { const w = promptWarnings(); if (w.length) { console.warn(`\x1b[33mWARNING\x1b[0m ${w.length} agent prompt(s) over ${PROMPT_LIMIT} characters (they are sent on every turn; keep them short, move details into chapters/):`); for (const x of w) console.warn("  - " + x); } const adv = emphasisWarnings(); if (adv.length) console.warn(`\x1b[33mADVICE\x1b[0m ${adv.length} prompt file(s) shout (MUST / NEVER ...): plain wording works better with the newer models:`), adv.forEach((x) => console.warn("  - " + x)); } catch (e) { console.warn("prompt size check skipped:", (e as Error).message); }
