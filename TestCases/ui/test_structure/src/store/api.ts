// The only file that talks to the server. Vite proxies /api to the Bun server (vite.config.ts).
import type { AgentInfo, CardOut, CaseDetail, CaseResult, CaseRuns, Health, ResponseRow, SessionRun, StateRun, StateRunLog, TryResult, Usage, WorkspaceSnap } from "@/types";
import type { AvailableAgent, ChatOut, SendIn, CaseResultOut, ExperimentOverview, LiveSession, RunInfo, RunLog } from "../../shared/experiment";
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
  runCase: (caseId: string, rerun: boolean) => call<StateRun>("/run", { case: caseId, rerun }),
  runLog: (id: string) => call<StateRunLog>(`/run/${id}`),
  runJudge: (id: string, again = false) => call<{ id: string; verdict: string }>("/run/judge", { id, again }),
  runStop: (id: string) => call<StateRun>("/run/stop", { id }),
  expOverview: () => call<ExperimentOverview>("/experiment"),
  expLive: () => call<LiveSession[]>("/experiment/live"),
  expRun: (b: { suite: string; cases: string[]; fake: boolean; rerun: boolean }) => call<RunInfo>("/experiment/run", b),
  expDelete: (task: string) => call<{ ok: boolean }>("/experiment/session/delete", { task }),
  expAgents: () => call<AvailableAgent[]>("/experiment/agents"),
  expSend: (b: SendIn) => call<{ task: string; queued: boolean }>("/experiment/send", b),
  expCancel: (task: string, id: string) => call<{ ok: boolean }>("/experiment/cancel", { task, id }),
  expChat: (task: string) => call<ChatOut>(`/experiment/chat/${task}`),
  expStop: (id: string) => call<RunInfo>("/experiment/stop", { id }),
  expLog: (id: string) => call<RunLog>(`/experiment/run/${id}`),
  expResult: (id: string) => call<CaseResultOut>(`/experiment/result/${id}`),
  ws: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace`),
  wsFile: (id: string, path: string, scratch: boolean) => call<{ text: string }>(`/case/${id}/workspace/file?path=${encodeURIComponent(path)}&scratch=${scratch ? 1 : 0}`),
  wsMutate: (id: string, ops: unknown[]) => call<WorkspaceSnap>(`/case/${id}/workspace/mutate`, { ops }),
  wsReset: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace/reset`, {}),
};
