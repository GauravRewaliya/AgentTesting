// Fail fast: watch the store file while a run is in flight and stop everything at the FIRST broken rule, not at the end.
// `abort` writes a flag that denies every new call; `killAll` stops the claude processes this process started.
import { Store } from "./store.ts";
import type { Ev, Runner } from "./types.ts";

export interface Watchdog { stop(): void; first(): Ev | null }
export function startWatchdog(file: string, o: { runners?: Runner[]; ms?: number; onViolation?: (e: Ev) => void; failOn?: string[] } = {}): Watchdog {
  const view = new Store(file), seen = new Set<string>(), failOn = new Set(o.failOn ?? ["invariant.violation"]);
  let hit: Ev | null = null;
  const tick = () => {
    if (hit) return;
    view.reload();
    for (const e of view.events) {
      if (!failOn.has(e.kind)) continue;
      const key = `${e.t}:${e.kind}:${e.agent_id}`;
      if (seen.has(key)) continue;
      seen.add(key); hit = e;
      view.abort(`${e.kind}: ${JSON.stringify(e.data ?? {}).slice(0, 200)}`);
      for (const r of o.runners ?? []) r.killAll?.();
      o.onViolation?.(e);
      return;
    }
  };
  const timer = setInterval(tick, o.ms ?? 400);
  return { stop: () => clearInterval(timer), first: () => hit };
}
