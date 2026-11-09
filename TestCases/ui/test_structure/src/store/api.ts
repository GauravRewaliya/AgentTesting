// The only file that talks to the server. Vite proxies /api to the Bun server (vite.config.ts).
import type { AgentInfo, CardOut, CaseDetail, CaseResult, Health, ResponseRow, TryResult, Usage, WorkspaceSnap } from "@/types";
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
  ws: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace`),
  wsFile: (id: string, path: string, scratch: boolean) => call<{ text: string }>(`/case/${id}/workspace/file?path=${encodeURIComponent(path)}&scratch=${scratch ? 1 : 0}`),
  wsMutate: (id: string, ops: unknown[]) => call<WorkspaceSnap>(`/case/${id}/workspace/mutate`, { ops }),
  wsReset: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace/reset`, {}),
};
