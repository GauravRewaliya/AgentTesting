---
audience: both
title: Eiffel Tower 3D experience
status: phase 1 of 3 · planned
---
# Experience · who uses it, what they see, how it looks
> Use this page to judge the **look and the visit**. If a screen below is wrong, say which one and what you want instead (*Ask Claude*). Back to the [overview](README.md).

## Who uses it
| who | wants | how we serve them |
|---|---|---|
| **The curious visitor** (desktop) | a calm, guided visit with real photos | one button, 12 stops, captions in serif, nothing to configure |
| **The visitor on a phone** | the same, with thumbs | 390 px layout, 40 px targets, photo card above the bar |
| **The French reader** | the same story in French | one toggle, every caption and label flips at once |
| **The reviewer / tester** (you) | proof the camera is smooth and nothing is faked | jump-free moves, a built-in audit, honest report of what was checked |

## The visit, step by step
| step | the visitor does | the visitor sees | feature |
|---|---|---|---|
| 1 | opens the page | a short veil: *Paris · Champ-de-Mars · 1887-1889*, then the tower in daylight | F1, F2 |
| 2 | presses **Explore** (or Enter) | camera glides to stop 1, Eiffel's design drawing | F3 |
| 3 | watches or presses Next (→) | stops 2 to 11: foundations, ironwork rising, each with its archival photo lined up with the 3D tower | F3, F5 |
| 4 | drags with the mouse or finger | the tour pauses, they look around, then it eases back to the route | F3 |
| 5 | reaches stop 12 | the complete tower turns slowly; they can orbit and use 4 detail views | F4 |
| 6 | presses **FR** at any time | every caption, label and button is French | F6 |

## Wireframes
Open the tabs to see the four key screens. Grey boxes are placeholders for real 3D and photos; the labels are the real wording.

![Landing, tour stop, final stop, phone](wireframes/screens.html)

*(If your viewer shows no frame, open `wireframes/screens.html` directly.)*

## Look and feel
| topic | decision | status |
|---|---|---|
| Mood | a gallery at rest: dark matte frame and plates, light paper cards, grey borders | real |
| UI colour | **neutral grey only**: no brown, no sepia anywhere in the interface | real (D-03) |
| Sky and fog | one warm light grey, the only warm tone | real |
| Type | serif for headlines and captions, plain sans for buttons, mono for the facts line; no web fonts | real |
| Shape | sharp or 2 px corners, soft shadows, no glass blur | real |
| Intro | veil text *Paris · Champ-de-Mars · 1887-1889* and *La Tour de 300 Mètres*; plaque top left | real, French subtitle guessed |

## Motion
| what | how it feels | time |
|---|---|---|
| Tour move | smooth curve around the piers, always looking at the tower, no jump at start or end | per stop; holds 2.6 s with a photo, 4.0 s at stop 12 |
| Drag to look | tour pauses, camera follows you, then eases back | about 0.6 s (guessed) |
| Photo card | cross-fades with the 3D view | 1.3 s |
| Intro veil | fades when the scene is ready | 0.45 s |
| Header line | a thin light line sweeps across the rule | 1.8 s, repeating |
| Stop 12 | slow turntable sway | ongoing |
| Reduced motion | nothing loops, moves are instant (tour behaviour guessed) | rule |

## Content
Twelve stops, each with a date, a headline, a caption and a facts line in **English and French**, supplied in full. Photo ids and wording are taken as given; nothing is rewritten by the builders. Stops 1 to 11 carry a photograph, stop 12 does not.

| stop | date and subject |
|---|---|
| 1 | 1884-1889 · Designing the Tower |
| 2 | 21 Apr 1887 · Foundation Caissons |
| 3 | 18 Jul 1887 · Base Shoes |
| 4 | 14 Jan 1888 · Central Timber Falsework |
| 5 | 26 Mar 1888 · First-Floor Belt |
| 6 | 15 May 1888 · Second-Stage Piers |
| 7 | 21 Aug 1888 · Second Platform |
| 8 | 23 Nov 1888 · Upper Shaft at 216 m |
| 9 | May 1889 · Exposition Opening |
| 10 | Summer 1889 · Lower Arch View |
| 11 | Summer 1889 · Basin and Piers |
| 12 | 1889 · Complete 3D Tower |

<!-- dev -->
## Builder notes
Tokens, light numbers, camera poses and breakpoints: `build_inputs/01_look.md`. Stop ids, photo ids, EN/FR strings: `build_inputs/02_stops_and_text.md`. The wireframe is a layout intent, not pixel spec; where it and `01_look.md` differ, `01_look.md` wins.
<!-- /dev -->
