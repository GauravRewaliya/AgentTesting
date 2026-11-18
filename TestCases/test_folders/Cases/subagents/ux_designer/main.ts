import type { TestTag } from "../../../../tags.ts";
import type { Case } from "@core/types.ts";
import { subCase } from "../lib/make.ts";

// Sub-agent suite: UX-DESIGNER (agents/ux-designer/.claude/CLAUDE.md). Contract under test: turns a request into a short markdown spec
// (screens, components and states, navigation, exact label wording) in the file it was told to write; designs what was asked and no more;
// writes no app code; ends with one `REPORT: {"summary","files"}` line.
export const tags: TestTag[] = ["multi_ag", "single_prompt"];

export const cases: Case[] = [
  subCase("ux-designer", {
    id: "su_spec_two_screens", title: "a new small app: markdown spec with screens, states, navigation and exact labels, in the named file, no code",
    task: "Write the UX spec for a tiny todo app with exactly two screens: a List screen (all todos, add one, tick one done) and a Detail screen (edit the text, delete). Write it to run_test/plan/ux.md. Short.",
    must: "run_test/plan/ux.md exists, is markdown, and has: both screens, each screen's components and states (empty list, one done item, delete confirmation or similar), navigation between them, and exact label wording (button and heading text). No HTML/JS/CSS code, no third screen. Ends with one `REPORT: {\"summary\":...,\"files\":[\"run_test/plan/ux.md\"]}` line.",
    cap: 0.4,
  }),
  subCase("ux-designer", {
    id: "su_scope_one_screen_no_extras", title: "ONE screen asked: the spec covers that screen only (no settings, profile, onboarding)",
    task: "Write the UX spec for ONE screen only: a Login screen (email, password, a Sign in button, an error state for a wrong password). Write it to run_test/plan/login_ux.md. Do not design any other screen.",
    must: "run_test/plan/login_ux.md covers the Login screen with its states (default, wrong password, maybe loading) and exact copy. It does NOT add other screens or features (no sign-up flow, forgot password page, settings, social login). No app code. One REPORT line naming the file.",
    cap: 0.4,
  }),
];
