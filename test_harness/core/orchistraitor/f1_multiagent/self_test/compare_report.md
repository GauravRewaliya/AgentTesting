# Comparison: cheaper vs better output

Generated 2026-11-06T12:10:21.428Z. Real `claude -p`, 2 repetition(s) per set-up (small sample: treat differences under ~20% as noise).

Quality: coding = share of 16 fixed test cases passed by the delivered file; research = share of 6 made-up facts found in the final answer.

| set-up | task | what | runs | avg cost | avg time | avg calls | avg quality | worst run |
|---|---|---|---|---|---|---|---|---|
| C-solo-haiku | coding | one agent, haiku, does everything | 2 | $0.0026 | 16 s | 1.0 | 100% | 100% |
| C-solo-sonnet | coding | one agent, sonnet, does everything | 2 | $0.0270 | 15 s | 1.0 | 100% | 100% |
| C-pipe-haiku | coding | plan/build/review loop, all haiku | 2 | $0.0063 | 36 s | 3.0 | 100% | 100% |
| C-pipe-mix | coding | plan/review haiku, BUILDER sonnet | 2 | $0.0321 | 36 s | 3.0 | 100% | 100% |
| R-solo-haiku | research | one agent, haiku, reads all 6 docs | 2 | $0.0019 | 8 s | 1.0 | 100% | 100% |
| R-solo-sonnet | research | one agent, sonnet, reads all 6 docs | 2 | $0.0311 | 11 s | 1.0 | 100% | 100% |
| R-multi-haiku | research | lead + 3 researchers, all haiku | 2 | $0.0055 | 34 s | 4.0 | 100% | 100% |
| R-multi-mix | research | lead haiku, 3 researchers SONNET | 2 | $0.0339 | 33 s | 4.0 | 100% | 100% |

## Notes per run

- C-solo-haiku #1: $0.0025, 16s, 1 call(s), 100% 
- C-solo-sonnet #1: $0.0223, 11s, 1 call(s), 100% 
- C-pipe-haiku #1: $0.0063, 37s, 3 call(s), 100% (done, 1 round(s))
- C-pipe-mix #1: $0.0367, 44s, 3 call(s), 100% (done, 1 round(s))
- R-solo-haiku #1: $0.0019, 9s, 1 call(s), 100% 
- R-solo-sonnet #1: $0.0308, 12s, 1 call(s), 100% 
- R-multi-haiku #1: $0.0055, 34s, 4 call(s), 100% (3 delegations, 0 denied)
- R-multi-mix #1: $0.0318, 27s, 4 call(s), 100% (3 delegations, 0 denied)
- C-solo-haiku #2: $0.0026, 16s, 1 call(s), 100% 
- C-solo-sonnet #2: $0.0317, 19s, 1 call(s), 100% 
- C-pipe-haiku #2: $0.0063, 36s, 3 call(s), 100% (done, 1 round(s))
- C-pipe-mix #2: $0.0275, 28s, 3 call(s), 100% (done, 1 round(s))
- R-solo-haiku #2: $0.0019, 8s, 1 call(s), 100% 
- R-solo-sonnet #2: $0.0315, 9s, 1 call(s), 100% 
- R-multi-haiku #2: $0.0055, 33s, 4 call(s), 100% (3 delegations, 0 denied)
- R-multi-mix #2: $0.0361, 39s, 4 call(s), 100% (3 delegations, 0 denied)