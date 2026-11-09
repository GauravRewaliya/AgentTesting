// Offline check of the harness rules (no Claude, no tokens): bun test core/harness_own_custom
import { expect, test } from "bun:test";
import { Harness } from "./main.ts";
const fx = [{ id: "a", agent: "writer", keywords: ["hi.md"], response: "wrote hi.md", files: {} }, { id: "b", agent: "reviewer", keywords: ["hi.md"], response: "hi.md ok" }];
const mk = () => new Harness({ fixtures: fx, ws: "/tmp/h_ws_test" });
test("spawn makes a new session each time, even for the same agent", () => {
  const h = mk(); const a = h.spawn("writer", "write hi.md"), b = h.spawn("writer", "write hi.md");
  expect(a.id).not.toBe(b.id);
});
test("send continues the same session and remembers its work", () => {
  const h = mk(); const a = h.spawn("writer", "write hi.md"); const r = h.send(a.id, "done?");
  expect(r.id).toBe(a.id); expect(r.reply).toContain("wrote hi.md");
});
test("sessions are isolated", () => {
  const h = mk(); const a = h.spawn("writer", "write hi.md"); const b = h.spawn("reviewer", "check hi.md");
  expect(h.send(b.id, "what did you do?").reply).not.toContain("wrote hi.md");
  expect(h.sessions.get(a.id)!.history.length).toBe(2);
});
test("unknown session id is an error", () => { expect(() => mk().send("nope", "hi")).toThrow(); });
test("no fixture -> NOTFOUND + miss event", () => {
  const ev: string[] = []; const h = new Harness({ fixtures: fx, ws: "/tmp/h_ws_test", onEvent: (e) => ev.push(e.kind) });
  expect(h.spawn("poet", "poem").reply).toContain("NOTFOUND"); expect(ev).toContain("miss");
});

// Interference points
test("onSpawn can respond instead of the lookup", () => {
  const h = new Harness({ fixtures: fx, ws: "/tmp/h_ws_test", interceptor: { onSpawn: () => ({ respond: "custom" }) } });
  const a = h.spawn("writer", "write hi.md"); expect(a.reply).toBe("custom"); expect(a.fixture).toBe("interceptor");
});
test("onSpawn script runs and its text is the reply", () => {
  let ran = 0; const h = new Harness({ fixtures: fx, ws: "/tmp/h_ws_test", interceptor: { onSpawn: () => ({ script: () => (ran++, "copied") }) } });
  expect(h.spawn("writer", "x").reply).toBe("copied"); expect(ran).toBe(1);
});
test("onSpawn deny throws and logs an error event", () => {
  const ev: string[] = []; const h = new Harness({ fixtures: fx, ws: "/tmp/h_ws_test", interceptor: { onSpawn: () => ({ deny: "no" }), onEvent: (e) => ev.push(e.kind) } });
  expect(() => h.spawn("poet", "x")).toThrow("no"); expect(ev).toContain("error");
});
test("onSend sees the session history and may respond", () => {
  let seen = 0; const h = new Harness({ fixtures: fx, ws: "/tmp/h_ws_test", interceptor: { onSend: (c) => (seen = c.session.history.length, { respond: "ok" }) } });
  const a = h.spawn("writer", "write hi.md"); expect(h.send(a.id, "?").reply).toBe("ok"); expect(seen).toBe(3); // task, reply, and the new follow-up
});
test("no interceptor = default lookup", () => { expect(mk().spawn("writer", "write hi.md").fixture).toBe("a"); });
