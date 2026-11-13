// The only file that talks to the server. Vite proxies /api to the Bun server (vite.config.ts).
import type { AgentInfo, CardOut, CaseDetail, CaseResult, CaseRuns, Health, ResponseRow, SessionRun, StateRun, StateRunLog, TryResult, Usage, WorkspaceSnap } from "@/types";
import type { AvailableAgent, ChatOut, SendIn, AgentDetail, CaseResultOut, ExperimentOverview, LiveSession, RunInfo, RunLog } from "../../shared/experiment";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j as T;
}

export const api = {
  cards: () => call<CardOut[]>("/cards"),
  caseDetail: (id: string) => call<CaseDetail>(`/case/${id}`),
  subagents: () => call<{ agents: AgentInfo[]; responses: ResponseRow[] }>("/subagents"),
  usage: () => call<Record<string, Usage>>("/subagents/usage"),
  health: () => call<Health>("/subagents/health"),
  responseCases: (id: string) => call<CaseResult[]>(`/subagents/response/${id}/cases`),
  guardCases: (agent: string) => call<CaseResult[]>(`/subagents/agent/${agent}/guard-cases`),
  tryCall: (agent: string, query: string, done: string[]) => call<TryResult>("/subagents/try", { agent, query, done }),
  runs: () => call<SessionRun[]>("/runs"),
  caseRuns: (id: string) => call<CaseRuns>(`/case/${id}/runs`),
  runCase: (caseId: string) => call<StateRun>("/run", { case: caseId }),
  runLog: (id: string) => call<StateRunLog>(`/run/${id}`),
  runJudge: (id: string, again = false) => call<{ id: string; verdict: string }>("/run/judge", { id, again }),
  runStop: (id: string) => call<StateRun>("/run/stop", { id }),
  bgRestart: (task: string, id: string) => call<{ ok: boolean; reason?: string }>("/bg/restart", { task, id }),
  bgStop: (task: string, id: string) => call<{ ok: boolean; reason?: string }>("/bg/stop", { task, id }),
  bgLog: (task: string, id: string, tail = 80) => call<{ ok: boolean; log: string }>(`/bg/log?task=${task}&id=${id}&tail=${tail}`),
  procStop: (task: string, pid: number) => call<{ ok: boolean; reason?: string; stopped?: number[] }>("/proc/stop", { task, pid }),
  expRun: (b: { suite: string; cases: string[]; fake: boolean; rerun: boolean }) => call<RunInfo>("/experiment/run", b),
  expDelete: (task: string) => call<{ ok: boolean }>("/experiment/session/delete", { task }),
  expAgents: () => call<AvailableAgent[]>("/experiment/agents"),
  expSend: (b: SendIn) => call<{ task: string; queued: boolean }>("/experiment/send", b),
  expCancel: (task: string, id: string) => call<{ ok: boolean }>("/experiment/cancel", { task, id }),
  expStop: (id: string) => call<RunInfo>("/experiment/stop", { id }),
  expLog: (id: string) => call<RunLog>(`/experiment/run/${id}`),
  ws: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace`),
  wsFile: (id: string, path: string, scratch: boolean) => call<{ text: string }>(`/case/${id}/workspace/file?path=${encodeURIComponent(path)}&scratch=${scratch ? 1 : 0}`),
  wsMutate: (id: string, ops: unknown[]) => call<WorkspaceSnap>(`/case/${id}/workspace/mutate`, { ops }),
  wsReset: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace/reset`, {}),
};
