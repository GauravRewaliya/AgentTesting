---
audience: both
title: NES MIDI Generator
status: phase 1 of 3 · planning
---
# NES MIDI Generator · phase 1 of 3 · planning
> Generate NES-style chiptune music and download it as a MIDI file.

> **This plan is ready to build.** File and folder names below are the layout of the new app; nothing here depends on any other project's files. Build from this plan alone.

| who reads | what | where |
|---|---|---|
| **Audience (users)** | Game makers and hobby musicians. | this page: What is it, What you get, Look, Motion |
| **Stakeholders** | decide scope, answer questions | Decisions and open questions, Phases at a glance |
| **Builders (dev)** | stack: not known (draft): Web Audio, no AI; pnpm only | `PHASES.md` and the grey DEV blocks (switch to Dev) |

## What is it
You pick a style or mood. The app makes four tracks from a seeded-random generator (same style and seed, same music) (2 pulse, 1 triangle, 1 noise), plays them in the browser, and exports a .mid file.

**For:** Game makers and hobby musicians.

## What you get (feature catalog)
| id | feature | what you see or do | phase | status |
|---|---|---|---|---|
| F1 | Style/mood picker | choose how it should sound | [2. Build](PHASES.md) | planning |
| F2 | 4 NES tracks | 2 pulse + triangle + noise | [2. Build](PHASES.md) | planning |
| F3 | Play in browser | Web Audio | [2. Build](PHASES.md) | planning |
| F4 | Export .mid | download the file | [2. Build](PHASES.md) | planning |

## Look and feel
- Not defined: this plan is a draft from the app name only (no reference). First step is to see the real app. Open question: record its look.

## Motion and animation
- Not defined (draft).

## Team: who does what
| who | does | tasks |
|---|---|---|
| planner | keeps this plan and its status up to date | T00 |
| builder | writes the code of its own files only (no file is owned twice) | T01 |
| qa-reviewer | checks every phase in a real browser or build; writes pass/fail, never builds | T02 |

You (the owner) answer the open questions and judge each phase; Claude edits this plan when you ask (see Share and change).

## Quality bar (what 'professional' means here)
- A recorded `qa` video shows every feature
- `pnpm build` and `tsc --noEmit` pass
- No AI and no key: the generator is seeded random

## Real or guessed
**Draft from the app name only.** The real app's code was not read, so the features below are my guess of the obvious ones. First step is to look at the real app (its Code tab in AI Studio, or you describe it) and correct this page.

## Decisions and open questions
| id | what | answer / default | state |
|---|---|---|---|
| Q1 | Is this guess of the app right? | look at the real app, then fix this page | open |
| D-01 | AI | no AI for now (seeded mock); LATER: a settings dialog where the user pastes an API key + base URL (+ model name) at runtime, works with any provider, not only Gemini; key stays in the user's browser | agreed |
| Q2 | How should the generator sound? | default: random melody on a scale chosen by the style, seeded; chords and drums by fixed patterns | open |

## Phases at a glance
**1. Learn the real app** (planning), **2. Build** (planning), **3. Verify** (planning) → [full phase page](PHASES.md)

## Share and change
- **Share:** press *Copy link* in the plan viewer; one link = one page.
- **Change something:** press *Ask Claude* on the page and write your wish. Claude edits THIS file (and the phase page if scope moves), so `git diff docs/` shows what the plan changed.
- Status words: planning = still being written or missing facts · planned = split into tasks, **nothing built yet** · in progress · review · done.

<!-- dev -->
Stack: Web Audio, no AI. One seam file `src/ai/provider.ts` (`mockProvider`: seeded-random melody on a scale, a bass line and a drum pattern; same seed and style, same notes; reply is the same track list a real call would return). TypeScript only. pnpm only (never npm). Non-goals: accounts, backend, mobile layout.

## Original build note
> Status: DRAFT from the app name only; real code not read yet. Enrich before building.

#### Goal
Generate NES-style chiptune MIDI.

#### Must have
- pick style/mood; generate 2 pulse + triangle + noise tracks; play in browser; export .mid

#### Stack
Web Audio, no AI (seeded-random generator behind `src/ai/provider.ts`). TypeScript only. pnpm only (never npm).

#### Done (checkable)
1. `pnpm install && pnpm build` passes; `tsc --noEmit` clean.
2. Opens in a browser with no console errors; every "Must have" item can be shown in a recorded `qa` video.
3. No AI and no key: same style and seed give the same notes.

#### Non-goals
Accounts, backend, mobile layout.
<!-- /dev -->
