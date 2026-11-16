---
audience: both
title: Stacked toast (Clerk style)
status: phase 1 of 4 · planned
---
# Stacked toast (Clerk style) · phase 1 of 4 · planned
> Pop-up messages for a phone app that stack, collapse and expand with springy motion, on iOS and Android.

> **This plan is ready to build.** File and folder names below are the layout of the new app; nothing here depends on any other project's files. Build from this plan alone.

| who reads | what | where |
|---|---|---|
| **Audience (users)** | App builders who want a polished toast for Expo / React Native, and want it stable (the original needed 3 fix commits for feel). | this page: What is it, What you get, Look, Motion |
| **Stakeholders** | decide scope, answer questions | Decisions and open questions, Phases at a glance |
| **Builders (dev)** | stack: Expo / React Native, react-native-reanimated, react-native-worklets, pressto, expo-haptics; pnpm only | `PHASES.md` and the build inputs in this folder |

## Build recipe
1. **Where:** build in `run_test/clerk_toast` as an Expo / React Native TypeScript module (**pnpm only**: `pnpm create expo-app clerk_toast --template blank-typescript`, then `pnpm add react-native-reanimated react-native-worklets pressto expo-haptics expo-blur`). Pin every version in `package.json` (no `^`) and list the API surface used in `stacked-toast-manager/API.md`.
2. **Files and owners (no file owned twice):** builder A = `stacked-toast-manager/{constants.ts,context.ts,stacked-toast-provider.tsx,hooks.ts,index.ts,stacked-toast.tsx}`; builder B = `stacked-toast-manager/backdrop/{index.tsx,index.android.tsx,use-gradient-height.ts}` and `components/pressable-scale.tsx`; `hooks/use-toast.tsx` goes to builder A after both are done. The lead owns `package.json` and `App.tsx` (a demo screen with buttons: add 1 / 3 / 5 toasts, 20 rapid calls).
3. **Order:** Core, then Interaction, Stability, Maintenance (PHASES.md). Springs only (`withSpring`), never timing curves.
4. **Verify (the lead, no device here):** `pnpm install`, `pnpm exec tsc --noEmit` and `pnpm exec expo export --platform android` pass. Say plainly that haptics, the look of the springs and the 20-call video were NOT checked. Colours and sizes in `constants.ts` are not captured from the reference: choose them and say so.


## What is it
When your app calls `toast()`, a small message slides in. More messages stack behind it. Tap the stack and it expands to show them all; tap again and it collapses. A soft blurred gradient sits behind the stack, and the phone gives a small vibration when you press. It must not jump when many toasts arrive at once.

**For:** App builders who want a polished toast for Expo / React Native, and want it stable (the original needed 3 fix commits for feel).

## What you get (feature catalog)
| id | feature | what you see or do | phase | status |
|---|---|---|---|---|
| F1 | Show a toast | `toast()` from a hook; 1, 3 or 5 toasts stack with set offsets | [1. Core](PHASES.md) | planned |
| F2 | Stack, expand, collapse | tap to expand, tap again to collapse, spring motion only (no timing curves) | [2. Interaction](PHASES.md) | planned |
| F3 | Blurred gradient backdrop | different native code for iOS and Android | [1. Core](PHASES.md) | planned |
| F4 | Haptics | one vibration per press, never two | [2. Interaction](PHASES.md) | planned |
| F5 | Stable under load | 20 quick `toast()` calls: no jump, no overlap | [3. Stability](PHASES.md) | planned |
| F6 | Status bar | stays visible on both platforms | [3. Stability](PHASES.md) | planned |
| F7 | Library upgrades | a version bump is one task, not a hunt | [4. Maintenance](PHASES.md) | planned |

## Parts and how they connect
```mermaid
flowchart LR
  H[use-toast hook] --> C[context + provider]
  C --> ST[stacked-toast]
  ST --> PR[pressable-scale: press + haptics]
  ST --> BD[backdrop: iOS / Android]
  K[constants] --> ST
```

## Look and feel
- Stacked toast cards over a **blurred gradient backdrop** (separate iOS and Android code), soft layered shadows (the real project polished the shadows in its last commit), pressable scale on tap. Exact colours and sizes live in `constants.ts` (not captured in this plan: open question to record them from the app).

## Motion and animation
| what | how | rule |
|---|---|---|
| show / stack | toasts offset and scale behind the newest | positions follow the layout table |
| expand / collapse | **spring** animation (the real project moved from timing curves to springs) | no timing curves |
| press | scale + one haptic | one vibration per press, never two |
| many calls | 20 quick `toast()` calls | no jump, no overlap |

- **Captured / invented:** what comes from the reference project is marked *real*; everything else (names, colours, sizes, wording) is *invented* by this plan or by you. Never present an invented value as taken from the reference.

## Team: who does what
| who | does | tasks |
|---|---|---|
| builder | writes the code of its own files only (no file is owned twice) | T01, T02, T03, T04, T05, T08 |
| qa-reviewer | checks every phase in a real browser or build; writes pass/fail, never builds | T06, T07 |

You (the owner) answer the open questions and judge each phase; Claude edits this plan when you ask (see Share and change).

## Quality bar (what 'professional' means here)
- 20 rapid calls recorded on video: no jump or overlap
- Haptic fires once per press
- Status bar stays visible on iOS and Android
- Versions pinned; a library bump is one task and the checks are re-run

## Real or guessed
Reverse-planned from a real project that lived 15 months (9 commits). The plan lines are my reading of what would have prevented the later fixes; I did not read the two big fix diffs, so why 'unstable animations' happened is not established.

## Research
research: none (reverse-planned from the git history of a real project (`enzomanuelmangano/demos`, `src/animations/clerk-toast`, 9 commits); the file list and pinned library surface are read from it, no other product was needed)

## Decisions and open questions
| id | what | answer / default | state |
|---|---|---|---|
| D-01 | Platform split | separate `index.tsx` and `index.android.tsx` for the backdrop from day 1 | agreed |
| D-02 | Pin library versions | yes; list the API surface used (reanimated, worklets, pressto, expo-haptics) | agreed |
| Q1 | Do you need web too? | no, phones only (check with `tsc --noEmit`; no device here) | agreed |

## Phases at a glance
**1. Core** (planned), **2. Interaction** (planned), **3. Stability** (planned), **4. Maintenance** (planned) → [full phase page](PHASES.md)

## Share and change
- **Share:** press *Copy link* in the plan viewer; one link = one page.
- **Change something:** press *Ask Claude* on the page and write your wish. Claude edits THIS file (and the phase page if scope moves), so `git diff docs/` shows what the plan changed.
- Status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done.

<!-- dev -->
## Files (plan)
`stacked-toast-manager/{provider,context,hooks,constants,stacked-toast}.tsx|ts`, `backdrop/{index.tsx,index.android.tsx,use-gradient-height.ts}`, `hooks/use-toast.tsx`, `components/pressable-scale.tsx`.
Pinned API surface: react-native-reanimated (`SharedValue`, springs), react-native-worklets (`scheduleOnRN`, `scheduleOnUI`), pressto (press + haptics), expo-haptics.

<!-- /dev -->
