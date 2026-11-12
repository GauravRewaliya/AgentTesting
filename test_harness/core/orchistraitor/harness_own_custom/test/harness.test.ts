
// Role-order guard (ported from Test_agent_2 g0_guard_offline): 6 good/bad hand-over payloads, no model
import { checkHandover } from "../core/guard.ts";
const rules = JSON.parse(await Bun.file(Bun.pathToFileURL(join(FIXTURES, "store/expo_rules.json"))).text());
const long = (s: string) => s.padEnd(300, " .");
test("guard: a good planner hand-over passes", () => {
  expect(checkHandover({ rules, agent: "planner", done: [], prompt: long("Plan an Expo app from expo/examples: drawer navigation and a zustand store in run_test") })).toEqual([]);
});
test("guard: planner hand-over without the examples is stopped", () => {
  expect(checkHandover({ rules, agent: "planner", done: [], prompt: long("Make me an app") })).toContain("hand-over lacks 'expo/examples'");
});
test("guard: ux-designer before the planner is stopped (role order)", () => {
  expect(checkHandover({ rules, agent: "ux-designer", done: [], prompt: long("plan.md wireframe drawer zustand run_test") })).toContain("needs 'planner' done first");
});
test("guard: builder needs planner and ux-designer first", () => {
  const why = checkHandover({ rules, agent: "builder", done: ["planner"], prompt: long("wireframe plan.md with-drawer-navigation with-zustand run_test") });
  expect(why).toEqual(["needs 'ux-designer' done first"]);
});
test("guard: a thin hand-over is stopped", () => {
  expect(checkHandover({ rules, agent: "qa-reviewer", done: ["builder"], prompt: "run_test" })[0]).toContain("too thin");
});
test("guard: a role not allowed in this turn, a forbidden role and an unknown role are stopped", () => {
  expect(checkHandover({ rules, agent: "builder", done: ["planner", "ux-designer"], allowed: ["planner"], prompt: long("wireframe plan.md with-drawer-navigation with-zustand run_test") })[0]).toContain("not allowed in this turn");
  expect(checkHandover({ rules, agent: "poet", done: [], prompt: "x" })).toContain("'poet' is a useless/forbidden role for these cases");
  expect(checkHandover({ rules, agent: "ghost", done: [], prompt: "x" })).toEqual(["unknown role 'ghost'"]);
});

// The Expo role results end to end through the harness (no model): planner -> ux-designer -> builder -> qa-reviewer
import { loadResults } from "../core/main.ts";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURES } from "@core/paths.ts";
test("expo chain through the harness: files land and QA reports the real gap", async () => {
  const ROOT = join(import.meta.dir, "../../..");
  const ws = mkdtempSync(join(tmpdir(), "expo-chain-"));
  const h = new Harness({ fixtures: [], results: await loadResults(join(FIXTURES, "results")), root: ROOT, ws });
  const p = h.spawn("planner", "Plan an Expo app from expo/examples: drawer navigation and a zustand store in run_test");
  expect(p.fixture).toBe("role-expo-planner"); expect(existsSync(join(ws, "notes-app/plan.md"))).toBe(true);
  expect(h.spawn("builder", "build with-drawer-navigation wireframe plan.md").reply).toContain("ERROR: no wireframe");   // role order is the guard's job; the mock also refuses
  const u = h.spawn("ux-designer", "wireframe for plan.md drawer zustand run_test");
  expect(u.fixture).toBe("role-expo-ux-designer"); expect(readFileSync(join(ws, "notes-app/App.js"), "utf8")).toContain("WIREFRAME");
  const b = h.spawn("builder", "replace the wireframe with with-drawer-navigation and with-zustand code, plan.md, run_test");
  expect(b.fixture).toBe("role-expo-builder"); expect(readFileSync(join(ws, "notes-app/App.js"), "utf8")).toContain("createDrawerNavigator");
  expect(JSON.parse(readFileSync(join(ws, "notes-app/package.json"), "utf8")).dependencies.zustand).toBeTruthy();
  const q = h.spawn("qa-reviewer", "check the build in run_test/notes-app");
  expect(q.fixture).toBe("role-expo-qa-reviewer"); expect(q.reply).toContain("PASS no WIREFRAME marker left"); expect(q.reply).toContain("FAIL App.js uses the store");
  const r = h.spawn("package-researcher", "is the zustand code in run_test/notes-app/store.js valid? syntax for create and shallow");
  expect(r.reply).toContain("3.6.7");
});

// Role-order guard (ported from Test_agent_2 g0_guard_offline): 6 good/bad hand-over payloads, no model
import { checkHandover } from "../core/guard.ts";
const rules = JSON.parse(await Bun.file(Bun.pathToFileURL(join(FIXTURES, "store/expo_rules.json"))).text());
const long = (s: string) => s.padEnd(300, " .");
test("guard: a good planner hand-over passes", () => {
  expect(checkHandover({ rules, agent: "planner", done: [], prompt: long("Plan an Expo app from expo/examples: drawer navigation and a zustand store in run_test") })).toEqual([]);
});
test("guard: planner hand-over without the examples is stopped", () => {
  expect(checkHandover({ rules, agent: "planner", done: [], prompt: long("Make me an app") })).toContain("hand-over lacks 'expo/examples'");
});
test("guard: ux-designer before the planner is stopped (role order)", () => {
  expect(checkHandover({ rules, agent: "ux-designer", done: [], prompt: long("plan.md wireframe drawer zustand run_test") })).toContain("needs 'planner' done first");
});
test("guard: builder needs planner and ux-designer first", () => {
  const why = checkHandover({ rules, agent: "builder", done: ["planner"], prompt: long("wireframe plan.md with-drawer-navigation with-zustand run_test") });
  expect(why).toEqual(["needs 'ux-designer' done first"]);
});
test("guard: a thin hand-over is stopped", () => {
  expect(checkHandover({ rules, agent: "qa-reviewer", done: ["builder"], prompt: "run_test" })[0]).toContain("too thin");
});
test("guard: a role not allowed in this turn, a forbidden role and an unknown role are stopped", () => {
  expect(checkHandover({ rules, agent: "builder", done: ["planner", "ux-designer"], allowed: ["planner"], prompt: long("wireframe plan.md with-drawer-navigation with-zustand run_test") })[0]).toContain("not allowed in this turn");
  expect(checkHandover({ rules, agent: "poet", done: [], prompt: "x" })).toContain("'poet' is a useless/forbidden role for these cases");
  expect(checkHandover({ rules, agent: "ghost", done: [], prompt: "x" })).toEqual(["unknown role 'ghost'"]);
});

// The Expo role results end to end through the harness (no model): planner -> ux-designer -> builder -> qa-reviewer
import { loadResults } from "../core/main.ts";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("expo chain through the harness: files land and QA reports the real gap", async () => {
  const ROOT = join(import.meta.dir, "../../..");
  const ws = mkdtempSync(join(tmpdir(), "expo-chain-"));
  const h = new Harness({ fixtures: [], results: await loadResults(join(FIXTURES, "results")), root: ROOT, ws });
  const p = h.spawn("planner", "Plan an Expo app from expo/examples: drawer navigation and a zustand store in run_test");
  expect(p.fixture).toBe("role-expo-planner"); expect(existsSync(join(ws, "notes-app/plan.md"))).toBe(true);
  expect(h.spawn("builder", "build with-drawer-navigation wireframe plan.md").reply).toContain("ERROR: no wireframe");   // role order is the guard's job; the mock also refuses
  const u = h.spawn("ux-designer", "wireframe for plan.md drawer zustand run_test");
  expect(u.fixture).toBe("role-expo-ux-designer"); expect(readFileSync(join(ws, "notes-app/App.js"), "utf8")).toContain("WIREFRAME");
  const b = h.spawn("builder", "replace the wireframe with with-drawer-navigation and with-zustand code, plan.md, run_test");
  expect(b.fixture).toBe("role-expo-builder"); expect(readFileSync(join(ws, "notes-app/App.js"), "utf8")).toContain("createDrawerNavigator");
  expect(JSON.parse(readFileSync(join(ws, "notes-app/package.json"), "utf8")).dependencies.zustand).toBeTruthy();
  const q = h.spawn("qa-reviewer", "check the build in run_test/notes-app");
  expect(q.fixture).toBe("role-expo-qa-reviewer"); expect(q.reply).toContain("PASS no WIREFRAME marker left"); expect(q.reply).toContain("FAIL App.js uses the store");
  const r = h.spawn("package-researcher", "is the zustand code in run_test/notes-app/store.js valid? syntax for create and shallow");
  expect(r.reply).toContain("3.6.7");
});
