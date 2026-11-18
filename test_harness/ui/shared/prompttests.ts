// Shapes shared by the Prompt testing API (server/prompttests.ts) and the page (src/pages/PromptTestingPage.vue).
export interface PtCase { id: string; about: string; why?: string; after?: string; tags: string[]; agent: string; user_message: string; stuff: { title: string; text: string }[]; messages: { role: string; text: string }[]; expect: string[]; judge?: string; team?: string[] }
export interface PtSuite { name: string; agent: string; about: string; cases: PtCase[] }
export interface PtSize { agent: string; kind: string; file: string; chars: number; lines: number; over: boolean; tokens: number }
export interface PtLaunch { agent: string; staticChars: number; launchChars: number }
export interface PtCatalog { suites: PtSuite[]; sizes: PtSize[]; launch: PtLaunch[]; limit: number }
export interface PtCall { tool: string; input: Record<string, unknown>; turn: string }
export interface PtRun { ok: boolean; looked?: string; failures: string[]; text: string; calls: PtCall[]; cost: number; ms: number; run: number; skipped?: string }
export interface PtResult { id: string; stamp: string; runs: PtRun[]; pass: number; total: number; skipped: boolean; cost: number }
export interface PtRunRow { id: string; suite: string; ids: string[]; tag?: string; skipTag?: string; runs: number; startedAt: number; endedAt?: number; status: "running" | "done" | "failed"; pid?: number }
export interface PtAdmin { id: string; at: string; source: string; reporter: string; agent?: string; kind: string; severity: string; text: string }
export interface PtPMark { mark: "fixed" | "known"; at: string }
export interface PtLive { results: Record<string, PtResult>; runs: PtRunRow[]; marks: Record<string, string>; pmarks: Record<string, PtPMark>; admin: PtAdmin[] }
export const MARKS = ["test_ready", "to_scrap", "ready_to_start", "ready_to_build", "ready_to_plan", "ready_to_qa"] as const;
export const MARK_LABEL: Record<string, string> = { test_ready: "test ready", to_scrap: "to scrap", ready_to_start: "ready to start (one init prompt)", ready_to_build: "ready to build", ready_to_plan: "ready to plan", ready_to_qa: "ready to build + QA" };
