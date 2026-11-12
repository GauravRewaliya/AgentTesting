// REF: https://github.com/SchroederNathan/linear-tab-bar (20 commits of 2026-03-23/24; 10 key ones replayed in order, pinned history in phases.json). Start state = parent of 4da28ef (empty Expo app).
// Expo Go: all packages (blur, haptics, linear-gradient, svg, reanimated, gesture-handler, keyboard-controller, masked-view) are in Expo Go for SDK 55 -> ok.
// Plain cases (one object each, no generator). Fixtures: agent_fixture/results/test_expo_go/role-expo-go-<id>.ts. Cases with `after` continue in the workspace the earlier case left.
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

export const cases: Case[] = [
  {
    ...expoGo,
    id: "eg_lintab_01_4da28ef",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 1/10 · commit 4da28ef (2026-03-23) \"Initial commit. Linear style tab bar\"",
    turns: [{
      user: "Starting point: fixture linear-tab-bar (the state the developer started this step from; it is set up in run_test/linear for you). Phase 1 of 10. Build a Linear-style floating tab bar: a pill with 4 icon tabs and a round search button next to it, glass-looking background (GlassMaterial), notification dot, 4 placeholder screens, wired in App.tsx. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 1/10 = real commit 4da28ef \"Initial commit. Linear style tab bar\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 1 of 10\", the task and the fixture linear-tab-bar. Recorded result role-expo-go-eg_lintab_01_4da28ef applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/01_4da28ef.patch (files: App.tsx, app.json, babel.config.js, src/components/Screens/PlaceholderScreen.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/NotificationDot.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.js, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/constants/theme.ts, src/hooks/useKeyboardAnimation.ts, src/hooks/useTabBarAnimation.js, src/hooks/useTabBarAnimation.ts, tsconfig.json, package.json). Work required: 18 files: App.tsx, app.json, babel.config.js, package.json, Screens/PlaceholderScreen.tsx, TabBar/{GlassMaterial,NotificationDot,SearchButton,TabBar,TabBarPill,TabIcon,...}. Expo-Go-safe packages only. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_01_4da28ef"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_02_4072c98",
    after: "eg_lintab_01_4da28ef",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 2/10 · commit 4072c98 (2026-03-23) \"Created custom drag stretch and glow implementation\"",
    turns: [{
      user: "Phase 2 of 10. Make the pill draggable: dragging across it stretches it and moves a glow under the finger; extract gesture hooks (usePillGestures, useSearchGestures) and a theme constants file. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 2/10 = real commit 4072c98 \"Created custom drag stretch and glow implementation\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 2 of 10\", the task and what phases 1-1 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_02_4072c98 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/02_4072c98.patch (files: App.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/theme.ts, src/hooks/usePillGestures.ts, src/hooks/useSearchGestures.ts). Work required: 8 files: hooks usePillGestures.ts, useSearchGestures.ts, constants/theme.ts new; TabBar, TabBarPill, SearchButton, TabIcon, App.tsx changed. Gesture-handler + reanimated shared values. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_02_4072c98"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_03_66e5453",
    after: "eg_lintab_02_4072c98",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 3/10 · commit 66e5453 (2026-03-23) \"Created serch input animation with closing button\"",
    turns: [{
      user: "Phase 3 of 10. Add the search interaction: tapping the search button expands it into a search input that takes over the bar (animated), with a close button. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 3/10 = real commit 66e5453 \"Created serch input animation with closing button\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 3 of 10\", the task and what phases 1-2 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_03_66e5453 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/03_66e5453.patch (files: App.tsx, src/components/TabBar/CloseSearchButton.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/constants/theme.ts, src/hooks/useTabBarAnimation.ts). Work required: 10 files: CloseSearchButton.tsx, constants/layout.ts, hooks/useTabBarAnimation.ts new; GlassMaterial, SearchButton, TabBar, TabBarPill, TabIcon, theme.ts, App.tsx changed. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_03_66e5453"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_04_0d61032",
    after: "eg_lintab_03_66e5453",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 4/10 · commit 0d61032 (2026-03-23) \"Fixed hold glow on glass material\"",
    turns: [{
      user: "Phase 4 of 10. Fix: the glow stays visible while the pill is held; it must fade correctly. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 4/10 = real commit 0d61032 \"Fixed hold glow on glass material\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 4 of 10\", the task and what phases 1-3 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_04_0d61032 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/04_0d61032.patch (files: src/hooks/usePillGestures.ts). Work required: ONE file, small: hooks/usePillGestures.ts. Anything more is scope creep. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_04_0d61032"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_05_a044717",
    after: "eg_lintab_04_0d61032",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 5/10 · commit a044717 (2026-03-24) \"Created custom popup menu animation\"",
    turns: [{
      user: "Phase 5 of 10. Add a popup menu that opens above the bar with an animated panel (MenuPanel) and menu items. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 5/10 = real commit a044717 \"Created custom popup menu animation\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 5 of 10\", the task and what phases 1-4 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_05_a044717 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/05_a044717.patch (files: App.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/MenuPanel.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/constants/theme.ts, src/hooks/useTabBarAnimation.ts). Work required: 10 files: TabBar/MenuPanel.tsx new; GlassMaterial, SearchButton, TabBar, TabBarPill, TabIcon, layout.ts, theme.ts, useTabBarAnimation.ts, App.tsx changed. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_05_a044717"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_06_9e692f9",
    after: "eg_lintab_05_a044717",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 6/10 · commit 9e692f9 (2026-03-24) \"Dragging the pill now doesnt change the routed tab until letting go\"",
    turns: [{
      user: "Phase 6 of 10. Dragging the pill must not change the routed tab until the finger is released; show the hovered tab while dragging. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 6/10 = real commit 9e692f9 \"Dragging the pill now doesnt change the routed tab until letting go\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 6 of 10\", the task and what phases 1-5 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_06_9e692f9 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/06_9e692f9.patch (files: App.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/hooks/usePillGestures.ts). Work required: 5 files: hoveredTab shared value threaded through App.tsx, TabBar, TabBarPill, TabIcon and usePillGestures (detectTab worklet, tab zones). NOTE: the patch is the net diff since the previous replayed phase, so it also folds 3 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_06_9e692f9"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_07_c5a53ac",
    after: "eg_lintab_06_9e692f9",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 7/10 · commit c5a53ac (2026-03-24) \"when dragging the pill up, the menu triggers\"",
    turns: [{
      user: "Phase 7 of 10. Dragging the pill upward past a threshold (-50 px) opens the menu. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 7/10 = real commit c5a53ac \"when dragging the pill up, the menu triggers\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 7 of 10\", the task and what phases 1-6 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_07_c5a53ac applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/07_c5a53ac.patch (files: App.tsx, src/hooks/usePillGestures.ts). Work required: 2 files: usePillGestures.ts (MENU_DRAG_THRESHOLD, menuTriggeredByDrag, menuProgress passed in) and App.tsx. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_07_c5a53ac"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_08_8e22f6b",
    after: "eg_lintab_07_c5a53ac",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 8/10 · commit 8e22f6b (2026-03-24) \"Added proper linear gradient masked border for fake glass effect\"",
    turns: [{
      user: "Phase 8 of 10. Give the glass background a real border: a linear-gradient border drawn through a masked view, replacing the plain View border sheen. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 8/10 = real commit 8e22f6b \"Added proper linear gradient masked border for fake glass effect\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 8 of 10\", the task and what phases 1-7 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_08_8e22f6b applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/08_8e22f6b.patch (files: src/components/TabBar/GlassMaterial.tsx, src/constants/theme.ts). Work required: 2 files: GlassMaterial.tsx (MaskedView + LinearGradient, BORDER_GRADIENT_START/END, animatedBorderMask) and theme.ts. Needs @react-native-masked-view/masked-view and expo-linear-gradient (both in Expo Go). Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_08_8e22f6b"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_09_3c78584",
    after: "eg_lintab_08_8e22f6b",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 9/10 · commit 3c78584 (2026-03-24) \"Optimize animation performance: remove dead worklets, deduplicate liqu\"",
    turns: [{
      user: "Phase 9 of 10. Performance pass: remove dead worklets, share one liquid-glass implementation (utils/liquidGlass.ts), memoize gestures. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 9/10 = real commit 3c78584 \"Optimize animation performance: remove dead worklets, deduplicate liquid glass, memoize gestures\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 9 of 10\", the task and what phases 1-8 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_09_3c78584 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/09_3c78584.patch (files: App.tsx, src/components/TabBar/CloseSearchButton.tsx, src/components/TabBar/MenuPanel.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/hooks/usePillGestures.ts, src/hooks/useTabBarAnimation.ts, src/utils/liquidGlass.ts). Work required: 9 files incl. new utils/liquidGlass.ts; no behaviour change. Judge that the agent did NOT change visuals or add features. NOTE: the patch is the net diff since the previous replayed phase, so it also folds 1 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_09_3c78584"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_lintab_10_655c4e0",
    after: "eg_lintab_09_3c78584",
    title: "[ref github SchroederNathan/linear-tab-bar] phase 10/10 · commit 655c4e0 (2026-03-24) \"Simplified file structure and deleted unused keyboard animation file\"",
    turns: [{
      user: "Phase 10 of 10. Simplify the file structure: move to src/components/TabBar/{index,constants,SearchBar,MenuPanel,...}, delete the unused keyboard animation file, update imports. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/linear.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 10/10 = real commit 655c4e0 \"Simplified file structure and deleted unused keyboard animation file\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/linear, PLAN.md, \"Phase 10 of 10\", the task and what phases 1-9 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_lintab_10_655c4e0 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/linear-tab-bar/10_655c4e0.patch (files: App.tsx, app.json, src/components/Screens/PlaceholderScreen.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/MenuPanel.tsx, src/components/TabBar/SearchBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/components/TabBar/constants.ts, src/components/TabBar/index.tsx). Work required: 9 files: TabBar/index.tsx + constants.ts + SearchBar.tsx new, old TabBar.tsx and hook files removed, imports fixed in App.tsx, PlaceholderScreen, GlassMaterial, MenuPanel, TabBarPill, TabIcon. Final tree should equal the fixture's final state (see sources.json linear-tab-bar). NOTE: the patch is the net diff since the previous replayed phase, so it also folds 2 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/linear must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_lintab_10_655c4e0"],
      },
    }],
  },
];
