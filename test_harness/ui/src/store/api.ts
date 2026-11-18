// The only file that talks to the server. Vite proxies /api to the Bun server (vite.config.ts).
import type { AgentInfo, CardOut, CaseDetail, CaseResult, CaseRuns, Health, ResponseRow, SessionRun, StateRun, StateRunLog, TryResult, Usage, WorkspaceSnap } from "@/types";
import type { TalkIn, Transcript, AvailableAgent, ChatOut, SendIn, AgentDetail, CaseResultOut, ExperimentOverview, LiveSession, RunInfo, RunLog } from "../../shared/experiment";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j as T;
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText); return j as T;
}
type SR = import("../../shared/settings").SettingsState;

export interface BrowserTab { id: string; title: string; url: string }
export interface BrowserOverview { ok?: false; reason?: string; mode: "attached" | "headless"; saved?: string | null; endpoint?: string; browser?: string; reachable?: boolean; since?: string; tabs?: BrowserTab[]; note: string; chrome: boolean; display: boolean; profile: string | null; defaultPort: number; howto: string[] }
export interface BrowserTry { ok: boolean; reason?: string; ms?: number; via?: string; image?: string | null; title?: string; theme?: { scheme: string; bg: string; font: string; accent: string }; sections?: { i: number; tag: string; heading: string; cards: number; buttons: number; images: number; animated: boolean }[]; console?: string[] }
export const api = {
  cards: () => call<CardOut[]>("/cards"),
  settingsAgentNew: (b: Record<string, unknown>) => send<SR>("POST", "/settings/agents", b),
  settingsAgentEdit: (n: string, b: Record<string, unknown>) => send<SR>("PUT", `/settings/agents/${n}`, b),
  settingsAgentDelete: (n: string) => send<SR>("DELETE", `/settings/agents/${n}`),
  settingsAgentToggle: (n: string, on: boolean) => send<SR>("POST", `/settings/agents/${n}/${on ? "enable" : "disable"}`, {}),
  settingsAgentConnect: (from: string, to: string) => send<SR>("POST", `/settings/agents/connect`, { from, to }),
  settingsAgentDisconnect: (from: string, to: string) => send<SR>("POST", `/settings/agents/disconnect`, { from, to }),
  settingsAgentResetLines: () => send<SR>("POST", `/settings/agents/reset-lines`, {}),
  settingsAgentMove: (n: string, b: { parent?: string; x?: number; y?: number }) => send<SR>("POST", `/settings/agents/${n}/move`, b),
  settingsIntegration: (id: string, b: Record<string, unknown>) => send<SR>("PUT", `/settings/integrations/${id}`, b),
  settingsPlugin: (name: string, agents: string[]) => send<SR>("PUT", `/settings/plugins/${encodeURIComponent(name)}`, { agents }),
  promptCatalog: () => call<import("../../shared/prompttests").PtCatalog>("/prompt-tests"),
  promptRun: (b: { suite: string; ids?: string[]; tag?: string; skipTag?: string; runs?: number }) => call<import("../../shared/prompttests").PtRunRow | { error: string }>("/prompt-tests/run", b),
  promptLog: (id: string) => call<{ text: string }>(`/prompt-tests/log?id=${encodeURIComponent(id)}`),
  caseMarks: () => call<Record<string, string>>("/case-marks"),
  setCaseMark: (caseId: string, mark: string | null) => call<Record<string, string> | { error: string }>("/case-marks", { caseId, mark }),
  promptMark: (caseId: string, mark: string | null) => call<Record<string, unknown> | { error: string }>("/prompt-tests/mark", { caseId, mark }),
  settingsScanConnectors: () => send<SR>("POST", "/settings/scan-connectors", {}),
  settingsIntegrationTest: (id: string) => send<{ ok: boolean; reason?: string; who?: string }>("POST", `/settings/integrations/${id}/test`, {}),
  browser: () => call<BrowserOverview>("/browser"),
  browserConnect: (url: string) => call<BrowserOverview>("/browser/connect", { url }),
  browserLaunch: (port = 9222) => call<BrowserOverview>("/browser/launch", { port }),
  browserToggle: (on: boolean) => call<BrowserOverview>("/browser/toggle", { on }),
  browserDisconnect: () => call<{ ok: boolean; note: string }>("/browser/disconnect", {}),
  browserOpen: (url: string) => call<{ id?: string; ok?: false; reason?: string }>("/browser/open", { url }),
  browserSnapshot: (tab: string) => call<{ ok: boolean; reason?: string; title: string; image: string | null }>(`/browser/snapshot?tab=${encodeURIComponent(tab)}`),
  browserTry: (url: string, scheme: "light" | "dark") => call<BrowserTry>("/browser/try", { url, scheme }),
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
  expTranscript: (task: string, id: string) => call<Transcript | { error: string }>(`/experiment/transcript/${task}/${encodeURIComponent(id)}`),
  expTalk: (b: TalkIn) => call<{ ok: boolean; mode?: "note" | "call"; reason?: string }>("/experiment/agent/talk", b),
  expAgents: () => call<AvailableAgent[]>("/experiment/agents"),
  expSend: (b: SendIn) => call<{ task: string; queued: boolean }>("/experiment/send", b),
  expStopSession: (task: string) => call<{ ok: boolean; killed: number; dropped: number }>("/experiment/session/stop", { task }),
  expCancel: (task: string, id: string) => call<{ ok: boolean }>("/experiment/cancel", { task, id }),
  expStop: (id: string) => call<RunInfo>("/experiment/stop", { id }),
  expLog: (id: string) => call<RunLog>(`/experiment/run/${id}`),
  ws: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace`),
  wsFile: (id: string, path: string, scratch: boolean) => call<{ text: string }>(`/case/${id}/workspace/file?path=${encodeURIComponent(path)}&scratch=${scratch ? 1 : 0}`),
  wsMutate: (id: string, ops: unknown[]) => call<WorkspaceSnap>(`/case/${id}/workspace/mutate`, { ops }),
  wsReset: (id: string) => call<WorkspaceSnap>(`/case/${id}/workspace/reset`, {}),
};
