// The contract of harness_own_custom: the MAIN FLOW and the INTERFERENCE POINTS. Nothing else is public.
//
// Main flow (what every sub-agent call goes through):
//
//   lead calls Agent / SendMessage
//        │  (mod: .claude/mods/interrupt, or the real tool in --real mode)
//        ▼
//   Harness.spawn(agent, task)  ── NEW session, fresh id, history = [task]
//   Harness.send(id, message)   ── SAME session only; unknown id = error
//        │
//        ▼
//   INTERFERENCE POINT  Interceptor.onSpawn / onSend      ◄── we step in here, before any work
//        │   decision: respond | script | deny | (none = default lookup)
//        ▼
//   default lookup: keyword fixture -> recorded result (similarity) -> NOTFOUND (event "miss")
//        │   a hit may run its script (copies mock files into the workspace)
//        ▼
//   reply returned to the lead + event appended to the log  ◄── Interceptor.onEvent sees every event
//
// Rules the harness keeps (tested offline in harness.test.ts):
//   R1 spawn always makes a new session, even for the same agent type and the same task
//   R2 send continues that session only, and answers from that session's own history
//   R3 sessions never see each other's history
//   R4 every step is an event (the log is also how sessions survive between one-shot CLI calls)

export type Role = "task" | "reply" | "followup";
export type Msg = { role: Role; text: string };
/** One sub-agent conversation. `id` is what the lead later passes to SendMessage. */
export type Session = { id: string; agent: string; history: Msg[] };

export type EventKind = "spawn" | "send" | "reply" | "miss" | "error";
export type Event = { t: number; kind: EventKind; id?: string; agent?: string; text?: string; fixture?: string | null };

/** What an interceptor decides for a call. Return nothing to let the default lookup answer. */
export type Decision =
  | { respond: string }                 // return this text as the sub-agent's reply, run nothing
  | { script: () => string }            // run this (e.g. copy mock files), return its text as the reply
  | { deny: string };                   // refuse: the call throws, an `error` event is logged

export type SpawnCall = { agent: string; task: string };
export type SendCall = { id: string; agent: string; message: string; session: Session };

/** The interference points. All optional; a harness with none behaves as the default fixture lookup. */
export interface Interceptor {
  /** Before a NEW session does its work. */
  onSpawn?(call: SpawnCall): Decision | void;
  /** Before a follow-up is answered. `session` is the existing session (read its history if you like). */
  onSend?(call: SendCall): Decision | void;
  /** After every event is appended (spawn, send, reply, miss, error). Use it to trace or stop a run. */
  onEvent?(e: Event): void;
}

/** The public surface. The mod and the CLI use only this. */
export interface IHarness {
  readonly sessions: ReadonlyMap<string, Session>;
  spawn(agent: string, task: string): { id: string; reply: string; fixture?: string | null };
  send(id: string, message: string): { id: string; reply: string };
}
