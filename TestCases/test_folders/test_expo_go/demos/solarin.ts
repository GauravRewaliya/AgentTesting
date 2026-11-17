// REF: https://expo.dev/demos/solarin-johnson -> github.com/Solarin-Johnson/my-app (branch with the 3D rotate card). 3 real commits replayed, 754eb25 -> 7371b88 -> 08b0cce ("add signature").
// Start state = parent of 754eb25 (an Expo Router app with ThemedText, PressableBounce, lucide icons, reanimated). Caveat for the judge: the app imports @expo/ui/swift-ui (iOS-only) and has expo-dev-client in deps, so the agent must be careful with "runs in Expo Go".
// Plain cases (one object each, no generator). Fixtures: agent_fixture/results/test_expo_go/role-expo-go-<id>.ts. Cases with `after` continue in the workspace the earlier case left.
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

// QA video: NOT possible on web yet, and now we know why (2026-11-12, dev server in a container, 166 s, screenshot + video taken): the page crashes with
//   ReferenceError: Cannot access 'abandonBoundaryMeasurement' before initialization   in react-native-screen-transitions@3.13.0 (lib/module/.../coordinator.js:167)
// a circular import inside that THIRD-PARTY package that works on native (Hermes) and throws on web. The screenshot shows Expo's red error overlay, not the app. (The earlier "Couldn't find a drawer" error only came from the minified production export.)
// Recipe to switch on once the package works on web (or is stubbed on web): { enabled: true, kind: "expo-web", app: "my-app", route: "/", viewport: "390x844" }. Working example of the same flow: examples/tailwind_reanimated.ts (eg_tw_01).
// WORKING SET-UP (2026-11-13). The recorded app has ~60 type errors from the start (Expo 58 preview + React Native 0.88 rc typings) and a web crash (T-14), so `qa_check` is OFF here (`no_qa_check`): these cases test the DELEGATION.
// before_node_run writes NOTES.md into the app (how to run it: the project memory of this app); the LAST phase's after_node_run applies store/expo_go/fixes/solarin-my-app/typecheck_fix.patch (a real `git diff`, verified to apply after the 3 commits)
// and ONLY when the phase passed. The patch fixes 53 of the 54 type errors (see NOTES.md); the web crash and one node_modules type error are still open (TODO T-14/T-19). A negative case (qa on, the master asks for the fix, the fixture fixes) can be added later.
import { join } from "node:path";
import type { NodeRunCtx } from "@core/types.ts";
const FIXDIR = join(import.meta.dir, "../../agent_fixture/store/expo_go/fixes/solarin-my-app");
const notes = (ctx: NodeRunCtx) => { if (ctx.read("my-app/NOTES.md")) return; ctx.write("my-app/NOTES.md", `# my-app notes (written by the test harness, before_node_run)
Run it (pnpm only, never npm/npx/yarn):
  cd run_test/my-app && corepack pnpm install
  corepack pnpm exec tsc --noEmit            # type check
  corepack pnpm exec expo start --web        # dev server (web)
Check like the harness: tools.ts qa_check --dir my-app  (type check + dev server + page errors; about a minute)
Known issues of this recorded app (they are in the upstream commit, not caused by your change):
  - ~60 type errors from the Expo 58 preview / React Native 0.88 rc typings (Drawer props, absoluteFillObject, @expo/ui, TextInput refs).
  - react-native-screen-transitions 3.13.0 crashes on web (circular import: abandonBoundaryMeasurement) - TODO T-14.
  - auto_run (after the last phase) applies 3 fix commits from fixes/solarin-my-app/: (1) types silenced, (2) undeclared @react-navigation packages declared, (3) ../ imports changed to the @/ alias. The web crash stays (needs another package version).
  - Imports: use the @/ alias (@/components/..., @/hooks/...), never ../ relative paths.
`); ctx.log("NOTES.md written into run_test/my-app"); };
const knownBroken = {
  before_node_run: notes,
};
const FOUND = [
  "typecheck: 54 tsc errors (Drawer props TS2322, absoluteFillObject TS2551, @expo/ui exports TS2305, TextInput refs TS2339, two package sources in node_modules)",
  "dev server: Metro cannot resolve @react-navigation/core and @react-navigation/routers (used by the app, not declared in package.json); @react-navigation/elements is imported and not declared either",
  "style: 34 imports use ../ relative paths; the tsconfig alias @/ exists and 35 files already use it",
];
// AUTO RUN (no model call): after the LAST phase passed, the harness mimics what the master would do next: apply the 3 fix commits in order (types, deps, @/ imports), commit each in the workspace, and record what it found (store/auto_run.json).
const lastPhase = {
  after_node_run: (ctx: NodeRunCtx) => { const r = ctx.auto_run({ dir: "my-app", fixDir: FIXDIR, found: FOUND }); ctx.log(r.error ? "auto_run FAILED: " + r.error : `auto_run: ${r.commits.length} fix commits applied and committed: ` + r.commits.map((c) => `${c.sha} ${c.subject}`).join(" | ")); },
};
const solarinQa: Case["qa"] = () => ({ enabled: false, why: "web crash in react-native-screen-transitions@3.13.0 (circular import, ReferenceError ... before initialization); docs/QA_ISSUES.md #12, TODO T-14" });
export const cases: Case[] = [
  {
    ...expoGo,
    qa: solarinQa,
    ...knownBroken,
    id: "eg_solarin_01_754eb25",
    title: "[ref expo.dev/demos/solarin-johnson -> Solarin-Johnson/my-app] phase 1/3 · commit 754eb25 (2025-10-11) \"feat: add 3D Rotate feature; implement Rotate3d component with flip an\"",
    turns: [{
      user: "Starting point: fixture solarin-my-app (the state the developer started this step from; it is set up in run_test/my-app for you). Phase 1 of 3. Add a '3D Rotate' screen: a route app/3d-rotate (own _layout with a Slot, index with a SafeAreaView) showing a reusable Rotate3d component (components/3dRotate.tsx) that flips between a front and a back with a Reanimated rotateY animation, and register the route in app/_layout.tsx. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/my-app.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 1/3 = real commit 754eb25 \"feat: add 3D Rotate feature; implement Rotate3d component with flip animation and integrate into navigation\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/my-app, PLAN.md, \"Phase 1 of 3\", the task and the fixture solarin-my-app. Recorded result role-expo-go-eg_solarin_01_754eb25 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/solarin-my-app/01_754eb25.patch (files: app/3d-rotate/_layout.tsx, app/3d-rotate/index.tsx, app/_layout.tsx, components/3dRotate.tsx). Work required: 4 files: app/3d-rotate/_layout.tsx (<Slot/>), app/3d-rotate/index.tsx (renders <Rotate3d/> in SafeAreaView), app/_layout.tsx (+6 lines: Stack.Screen for 3d-rotate), components/3dRotate.tsx (99 lines: flip animation). Use the expo-router and expo-animation skills. package.json uses the repo's LATEST versions; kept at the commit's version because the latest no longer lists them: @react-navigation/bottom-tabs, @react-navigation/drawer. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/my-app must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_solarin_01_754eb25"],
      },
    }],
  },
  {
    ...expoGo,
    qa: solarinQa,
    ...knownBroken,
    id: "eg_solarin_02_7371b88",
    after: "eg_solarin_01_754eb25",
    title: "[ref expo.dev/demos/solarin-johnson -> Solarin-Johnson/my-app] phase 2/3 · commit 7371b88 (2025-10-12) \"feat: enhance Rotate3d component; add support for dynamic front and ba\"",
    turns: [{
      user: "Phase 2 of 3. Make Rotate3d usable: it takes dynamic front and back content, exposes an imperative handle (flip, flipTo('front'|'back')), uses animated styles for the flip. Then build the screen on top of it: a 'Flip Card' front with a forward button and a back with a back button, themed text, bounce-pressable buttons, a form-like layout (inputs, a slider). Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/my-app.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 2/3 = real commit 7371b88 \"feat: enhance Rotate3d component; add support for dynamic front and back content, improve flipping logic, and integrate animated styles\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/my-app, PLAN.md, \"Phase 2 of 3\", the task and what phases 1-1 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_solarin_02_7371b88 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/solarin-my-app/02_7371b88.patch (files: app/3d-rotate/index.tsx, components/3dRotate.tsx). Work required: 2 files only: components/3dRotate.tsx rewritten (Rotate3dHandle with flip/flipTo, front/back props) and app/3d-rotate/index.tsx grows by ~225 lines (FrontContent, BackContent, ThemedText, PressableBounce, lucide icons, @expo/ui swift-ui Slider, TextInput fields). No new route, no package change except what is imported. package.json uses the repo's LATEST versions; kept at the commit's version because the latest no longer lists them: @react-navigation/bottom-tabs, @react-navigation/drawer. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/my-app must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_solarin_02_7371b88"],
      },
    }],
  },
  {
    ...expoGo,
    qa: solarinQa,
    ...knownBroken,
    ...lastPhase,
    id: "eg_solarin_03_08b0cce",
    after: "eg_solarin_02_7371b88",
    title: "[ref expo.dev/demos/solarin-johnson -> Solarin-Johnson/my-app] phase 3/3 · commit 08b0cce (2025-10-12) \"feat: integrate DrawPad component for signature capture in BackContent\"",
    turns: [{
      user: "Phase 3 of 3. Make the back of the card a signature screen: add a drawing pad (the expo-drawpad package), let the reset icon clear it, and give soft haptic feedback when the card flips. Keep the 'Received by' field as it is. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/my-app.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 3/3 = real commit 08b0cce \"feat: integrate DrawPad component for signature capture in BackContent; enhance user interaction with feedback on flip actions\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/my-app, PLAN.md, \"Phase 3 of 3\", the task and what phases 1-2 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_solarin_03_08b0cce applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/solarin-my-app/03_08b0cce.patch (files: app/3d-rotate/index.tsx, components/3dRotate.tsx, package.json). Work required: Real commit 08b0cce: app/3d-rotate/index.tsx (BackContent becomes a component with a DrawPad ref, pathLength useSharedValue, clearPad -> padRef.current?.erase(), reset icon wrapped in PressableBounce, DrawPad rendered; Feedback.soft() from @/functions on flip; unused imports removed), components/3dRotate.tsx (+3 lines), package.json (expo-drawpad ^0.1.3 added). Expo Go: drawpad is JS over skia/gesture-handler, but the REPORT must still mention @expo/ui/expo-dev-client in the app as a risk. package.json uses the repo's LATEST versions; kept at the commit's version because the latest no longer lists them: @react-navigation/bottom-tabs, @react-navigation/drawer. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/my-app must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_solarin_03_08b0cce"],
      },
    }],
  },
];
