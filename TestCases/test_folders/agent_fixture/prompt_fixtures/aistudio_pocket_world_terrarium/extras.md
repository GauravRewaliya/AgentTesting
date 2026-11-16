---
audience: dev
title: Pocket World Terrarium: tour script and mock story
status: phase 1 of 4 · planned
---
# Tour script and mock story
> Part of [the plan](README.md). The tour is real (read from the reference source); the mock story is a new design, all guessed.

## 30 s tour
0-2 s morning shot; 2-7 full turn; 7-8 settle; 8-10.5 cottages; 10.5-13 sheep and bees; 13-15 lighthouse and pier; 15-23 four simulated clicks (windmill and cottage; second lighthouse and sailboat; villagers, sheep, campfire, lantern; weather and balloon); 23-26.5 sunset to night; 26.5-28.5 shooting star; 28.5-30 pull back to the orb view.

Camera at start of tour: position (-0.85, 0.65, 4.15), look-at (0, -0.10, 0), time of day 0.22, planet turned to its start angle. At the end the view returns to Orb. A simulated cursor ring (`#fff8d6`) moves and 'clicks' during acts 15-23 s. Objects the tour adds are removed when it ends.

## Mock story (phase 4)
- No AI for now. One seam file `src/ai/provider.ts` exports `mockProvider`, with the same call and reply shape a real provider would have: `generateStory({ counts: WorldState.objectCounts, dayCount: number }) -> Promise<{ name: string, story: string }>` (name up to 3 words, story up to 60 words).
- Seeded: seed = a hash of the sorted `counts` and `dayCount`; a small seeded generator (mulberry32) picks one name from a bundled list of about 12 names and one story from a bundled list of about 8 stories. Same input, same output; no network, no key.
- Fallback name 'Little Meadow', story 'A small green world where windmills turn, sheep graze and the villagers light the lanterns at dusk.' is one entry of the lists.
- The UI imports only `provider.ts`; later a real provider can replace it behind the same shape.

<!-- dev -->
### Reference prompts for a later real provider (not used now)
Route `POST /api/story` body `{ "counts": WorldState.objectCounts, "dayCount": number }`; reply `{ "name": string, "story": string }`. Prompt: 'You name tiny planets. Given these counts of things on a cosy miniature planet, reply with JSON only: {"name": a warm 1 to 3 word planet name, "story": at most 60 words, gentle, no violence}. Counts: <JSON>.'
<!-- /dev -->
