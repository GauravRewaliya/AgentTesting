// REF: cases come from github.com/expo/examples (with-tailwindcss, with-storybook), expo.dev/demos (paul-nguyen, solarin-johnson),
// github.com/enzomanuelmangano/demos, github.com/SchroederNathan/linear-tab-bar. One file per source, each case a plain object (id, title, user, expected). Pinned shas: TestCases/test_folders/agent_fixture/store/expo_go/sources.json.
//
// expo_go: the lead calls the mocked sub-agent `expo-go` (planner + builder). Three kinds of case, all the same shape (see lib/shared.ts):
//   build    one message, the sub-agent builds a project / does a task                      (tailwind 01, storybook, solarin 01, toast 01, linear 01, folio)
//   change   a later message that continues the workspace of the case in `after`           (the other numbered cases; real commit diffs are the fixtures)
//   rework   the first answer is incomplete, the lead must notice and have it fixed         (rework.ts: bad fixture, then `_fix` fixture)
// How to judge a run (only the structure is asserted, see lib/check.ts; the run itself is judged by reading the report): the hand-over carries the context (a sub-agent call has no memory),
// PLAN.md comes before the code, changed files ~ the fixture's files, nothing from other cases, the REPORT line (skills, expo_go ok|needs_dev_build) is relayed honestly.
import type { Case } from "@core/types.ts";
import type { TestTag } from "../../tags.ts";
import { cases as tw } from "./examples/tailwind_reanimated.ts";
import { cases as sb } from "./examples/storybook.ts";
import { cases as solarin } from "./demos/solarin.ts";
import { cases as linear } from "./demos/linear_tab_bar.ts";
import { cases as toast } from "./demos/enzo_clerk_toast.ts";
import { cases as cherry } from "./demos/enzo_cherry.ts";
import { cases as folio, SOURCE as FOLIO } from "./demos/folio.ts";
import { cases as rework } from "./rework.ts";
import { assertValid } from "./lib/check.ts";

export const tags: TestTag[] = ["multi_ag", "coding", "split_task"];
export const cases: Case[] = [...tw, ...sb, ...solarin, ...linear, ...toast, ...cherry, ...folio, ...rework];
// Fails the import (so the harness cannot run a broken suite) when anything is out of line with lib/types.ts. See lib/check.ts.
assertValid({ cases, tags, otherSources: [FOLIO] });
