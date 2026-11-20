// Shapes shared by the Settings API (server/settings.ts, server/usage.ts) and the Settings pages.
export interface SettingsAgent { name: string; description: string; role: string; model: string; origin: "default" | "user"; locked: boolean; disabled: boolean; callees: string[]; parent: string | null; callers?: string[]; tools: string[]; writes: boolean; x?: number; y?: number; prompt?: string; cloned_from?: string }
export interface SettingsIntegration { id: string; label: string; about: string; fields: { key: "site" | "email" | "token"; label: string; secret?: boolean; placeholder?: string }[]; enabled: boolean; agents: string[]; site: string; email: string; has_token: boolean; last4?: string }
export interface SettingsPlugin { name: string; version: string; scope: string; supported: boolean; agents: string[]; servers: { name: string; agents: string[] }[] }
export interface SettingsConnector { name: string; url: string; status: string; supported: false }
export interface SettingsRules { noForcePush: boolean; noDeleteBranch: boolean; noMerge: boolean; noPushProtected: boolean; protectedBranches: string[]; noPush: boolean; jiraReadOnly: boolean }
export interface SettingsState { rules: SettingsRules; defaults: SettingsRules; home: string; plugins: SettingsPlugin[]; connectors: SettingsConnector[]; agents: SettingsAgent[]; integrations: SettingsIntegration[]; skills: string[]; ok?: boolean; reason?: string }
export interface UsageRow { date: string; model: string; input: number; output: number; cache_read: number; cache_create: number }
export interface UsageState { days: number; rows: UsageRow[]; sessions: number; totals: { input: number; output: number; cache_read: number; cache_create: number }; link: string; profiles: string[] }
