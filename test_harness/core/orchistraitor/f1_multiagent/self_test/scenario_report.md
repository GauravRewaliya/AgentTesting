# Test 2: one task, three messages, both harnesses

Generated 2026-11-06T14:44:42.116Z. Real `claude -p` (haiku), real web fetches, no sandbox. One run each (treat small differences as noise).

Old reference (TASK_RUN_REPORT.md, the copy request only): 3 runs, 558 s (9 min 18 s), $1.81, and the requested file was deleted.

## Staged harness (plan/build/review, one persistent session per role) (run 1)

| message | time | cost | agent calls | result | what was checked |
|---|---|---|---|---|---|
| 1 | 12 s | $0.0021 | 2 | PASS | index2.html is an exact copy; index.html untouched |
| 2 | 73 s | $0.0210 | 6 | PASS | web1-3.html exist, are HTML and mention their site; index2.html still there; live web fetches: 10 (need >= 3) |
| 3 | 25 s | $0.0143 | 2 | PASS | web3_detail.md (2304 chars) has the sections and mentions GNU; earlier files all still there |
| total | 110 s | $0.0374 | 10 | ALL PASS | |

- message 1: done; 1 round(s); stages: builder 6.2s, reviewer 6.1s
- message 2: done; 2 round(s); stages: planner 4.4s, builder 27.1s, reviewer 12.2s, planner 5.1s, builder 17.9s, reviewer 5.9s
- message 3: done; 1 round(s); stages: builder 18.5s, reviewer 6.3s

```
builder#1 [build] L1 idle session=518f34 resumed=3x calls=4 1m10s $0.0246
reviewer#1 [review] L1 idle session=890415 resumed=3x calls=4 30.5s $0.0105
planner#1 [plan] L1 idle session=61187e resumed=1x calls=2 9.5s $0.0022
```

## Multi-agent harness (lead + parallel researchers + parallel builders in worktrees + patches) (run 1)

| message | time | cost | agent calls | result | what was checked |
|---|---|---|---|---|---|
| 1 | 51 s | $0.0074 | 3 | PASS | index2.html is an exact copy; index.html untouched |
| 2 | 84 s | $0.0214 | 9 | PASS | web1-3.html exist, are HTML and mention their site; index2.html still there; live web fetches: 18 (need >= 3) |
| 3 | 50 s | $0.0187 | 4 | PASS | web3_detail.md (943 chars) has the sections and mentions GNU; earlier files all still there |
| total | 185 s | $0.0475 | 16 | ALL PASS | |

- message 1: lead + 0 researcher call(s) + 2 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 36s vs wall 51s, starts spread 16.3s; lead said: I made the safety copy: `index2.html` now exists alongside `index.html`, with the same 9 lines. The builder read it back and reported an exact match.  Two things to know:  - The first attempt failed because the builder's Bash access was denied, so it couldn't 
- message 2: lead + 5 researcher call(s) + 3 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 75s vs wall 84s, starts spread 66.9s; lead said: All three pages are in the project: `web1.html` (example.com), `web2.html` (W3C) and `web3.html` (GNU). Each has a title, 3 to 5 bullet findings and the address, and was written as plain HTML with no scripts or external resources.  - **web1.html** (https://exa
- message 3: lead + 2 researcher call(s) + 1 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 28s vs wall 50s, starts spread 32.3s; lead said: I wrote `web3_detail.md`, but it is based on the GNU homepage only. I could not get the deeper detail you asked for.  The GNU site kept returning HTTP 429 (Too Many Requests) on every attempt to read its section pages, including one-at-a-time requests. The hom

Agent tree (task W):
```
lead#1 [lead] L1 idle session=1ae0e1 resumed=2x calls=3 3m05s $0.0221
├─ builder#1 [build] L2 idle session=55b128 resumed=0x calls=2 35.9s $0.0049
├─ researcher#1 [research] L2 idle session=26019b resumed=0x calls=1 9.1s $0.0012
├─ researcher#2 [research] L2 idle session=6b3091 resumed=0x calls=1 11.3s $0.0020
├─ researcher#3 [research] L2 idle session=7a3e41 resumed=0x calls=5 57.4s $0.0136
├─ builder#2 [build] L2 idle session=695370 resumed=0x calls=1 5.9s $0.0008
├─ builder#3 [build] L2 idle session=42d9fa resumed=0x calls=1 6.2s $0.0009
├─ builder#4 [build] L2 idle session=760163 resumed=0x calls=1 6.3s $0.0010
└─ builder#5 [build] L2 idle session=9eec76 resumed=0x calls=1 6.3s $0.0009
```

Who called whom:
```
lead#1 -> builder#1 role=builder L2 session=new done
lead#1 -> builder#1 role=builder L2 session=builder#1 done
lead#1 -> researcher#1 role=researcher L2 session=new done
lead#1 -> researcher#2 role=researcher L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=new done
lead#1 -> builder#2 role=builder L2 session=new done
lead#1 -> builder#3 role=builder L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> builder#4 role=builder L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> builder#5 role=builder L2 session=new done
```

Timeline (agent.* events):
```
+   0.0s  agent.start          lead#1        mode=new session=1ae0e1f2-405f-4415-9f7e-881a7780c8a0 prompt_chars=1316
+   4.9s  agent.call.granted   lead#1        callee=builder#1 level=2 kind=new
+   4.9s  agent.start          builder#1     mode=new session=fba2d01f-5711-406a-aa28-e917193c68cb prompt_chars=443
+  16.7s  agent.done           builder#1     mode=new took=11.8s
+  21.2s  agent.call.granted   lead#1        callee=builder#1 level=2 kind=resume
+  21.2s  agent.start          builder#1     mode=rolled session=55b1286e-ec1f-47e8-9519-b331ed5102dd prompt_chars=660
+  45.2s  agent.done           builder#1     mode=rolled took=24.0s
+  51.0s  agent.done           lead#1        mode=new took=51.0s
+  51.0s  agent.start          lead#1        mode=resumed session=1ae0e1f2-405f-4415-9f7e-881a7780c8a0 prompt_chars=1589
+  55.2s  agent.call.granted   lead#1        callee=researcher#1 level=2 kind=new
+  55.2s  agent.start          researcher#1  mode=new session=26019b3e-2d88-4e73-9c71-9fbde87628b6 prompt_chars=414
+  55.6s  agent.call.granted   lead#1        callee=researcher#2 level=2 kind=new
+  55.6s  agent.start          researcher#2  mode=new session=6b309149-c0c5-407d-8694-803065d1480e prompt_chars=389
+  56.3s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=new
+  56.4s  agent.start          researcher#3  mode=new session=dee5fbc5-6535-490f-8b99-2c0876fb99a4 prompt_chars=392
+  64.3s  agent.done           researcher#1  mode=new took=9.1s
+  66.9s  agent.done           researcher#2  mode=new took=11.3s
+  67.8s  agent.done           researcher#3  mode=new took=11.5s
+  74.4s  agent.call.granted   lead#1        callee=builder#2 level=2 kind=new
+  74.5s  agent.start          builder#2     mode=new session=6953706e-d425-49ca-b594-f507a0adb9af prompt_chars=921
+  80.3s  agent.done           builder#2     mode=new took=5.9s
+  80.4s  agent.call.granted   lead#1        callee=builder#3 level=2 kind=new
+  80.4s  agent.start          builder#3     mode=new session=42d9fa66-c26c-4591-946f-09d54cf0408f prompt_chars=1115
+  86.6s  agent.done           builder#3     mode=new took=6.2s
+  86.7s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+  86.7s  agent.start          researcher#3  mode=resumed session=dee5fbc5-6535-490f-8b99-2c0876fb99a4 prompt_chars=469
+  98.2s  agent.done           researcher#3  mode=resumed took=11.5s
+ 105.1s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+ 105.2s  agent.start          researcher#3  mode=resumed session=dee5fbc5-6535-490f-8b99-2c0876fb99a4 prompt_chars=372
+ 118.3s  agent.done           researcher#3  mode=resumed took=13.2s
+ 122.1s  agent.call.granted   lead#1        callee=builder#4 level=2 kind=new
+ 122.2s  agent.start          builder#4     mode=new session=76016350-6341-43cb-8823-47a075de8f01 prompt_chars=1012
+ 128.5s  agent.done           builder#4     mode=new took=6.3s
+ 134.7s  agent.done           lead#1        mode=resumed took=1m24s
+ 134.7s  agent.start          lead#1        mode=resumed session=1ae0e1f2-405f-4415-9f7e-881a7780c8a0 prompt_chars=1460
+ 140.1s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+ 140.1s  agent.start          researcher#3  mode=resumed session=dee5fbc5-6535-490f-8b99-2c0876fb99a4 prompt_chars=781
+ 153.6s  agent.done           researcher#3  mode=resumed took=13.5s
+ 158.1s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+ 158.1s  agent.start          researcher#3  mode=rolled session=7a3e4188-53e3-4e24-ad30-997e4a85eed3 prompt_chars=874
+ 166.0s  agent.done           researcher#3  mode=rolled took=7.8s
+ 172.4s  agent.call.granted   lead#1        callee=builder#5 level=2 kind=new
+ 172.4s  agent.start          builder#5     mode=new session=9eec7654-af0d-4ec5-b2f5-cd102fe0696f prompt_chars=1525
+ 178.7s  agent.done           builder#5     mode=new took=6.3s
+ 184.7s  agent.done           lead#1        mode=resumed took=50.0s
```

## Staged harness (plan/build/review, one persistent session per role) (run 2)

| message | time | cost | agent calls | result | what was checked |
|---|---|---|---|---|---|
| 1 | 18 s | $0.0032 | 3 | PASS | index2.html is an exact copy; index.html untouched |
| 2 | 38 s | $0.0093 | 3 | PASS | web1-3.html exist, are HTML and mention their site; index2.html still there; live web fetches: 6 (need >= 3) |
| 3 | 43 s | $0.0156 | 3 | PASS | web3_detail.md (2315 chars) has the sections and mentions GNU; earlier files all still there |
| total | 99 s | $0.0281 | 9 | ALL PASS | |

- message 1: done; 1 round(s); stages: planner 4.4s, builder 7.9s, reviewer 6.0s
- message 2: done; 1 round(s); stages: planner 5.1s, builder 23.8s, reviewer 9.0s
- message 3: done; 1 round(s); stages: planner 4.0s, builder 31.2s, reviewer 7.9s

```
planner#1 [plan] L1 idle session=00d13c resumed=2x calls=3 13.6s $0.0038
builder#1 [build] L1 idle session=31d4ba resumed=2x calls=3 1m03s $0.0179
reviewer#1 [review] L1 idle session=4f52d7 resumed=2x calls=3 22.9s $0.0064
```

## Multi-agent harness (lead + parallel researchers + parallel builders in worktrees + patches) (run 2)

| message | time | cost | agent calls | result | what was checked |
|---|---|---|---|---|---|
| 1 | 32 s | $0.0063 | 3 | PASS | index2.html is an exact copy; index.html untouched |
| 2 | 73 s | $0.0163 | 8 | **FAIL** | web1-3.html exist, are HTML and mention their site (bad: web3); index2.html still there; live web fetches: 18 (need >= 3) |
| 3 | 20 s | $0.0088 | 2 | **FAIL** | web3_detail.md (0 chars) has the sections and mentions GNU; earlier files all still there |
| total | 125 s | $0.0315 | 13 | **FAILURES** | |

- message 1: lead + 0 researcher call(s) + 2 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 19s vs wall 32s, starts spread 11.8s; lead said: I made the safety copy, `index2.html`, in the project. I did not verify it byte-for-byte.  - The first attempt used a shell `cp`, which was denied. The builder agent (`builder#1`) then re-created the file by reading `index.html` and writing the same content wi
- message 2: lead + 5 researcher call(s) + 2 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 68s vs wall 73s, starts spread 50.7s; lead said: I made `web1.html` and `web2.html`. I could not make `web3.html` because the GNU site would not load.  - **`web1.html`** (example.com): done. It has a title, three bullets (a placeholder page, no sections, aimed at documentation writers) and the address. - **`
- message 3: lead + 1 researcher call(s) + 0 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 11s vs wall 20s, starts spread 0.0s; lead said: I could not write `web3_detail.md`. The GNU site still returns HTTP 429 (Too Many Requests) with `Retry-After: 4`, so there is no page content to analyse.  - Four earlier attempts failed the same way, and one more this round (`researcher#5`). - The researchers

Agent tree (task W):
```
lead#1 [lead] L1 idle session=855914 resumed=2x calls=3 2m05s $0.0165
├─ builder#1 [build] L2 idle session=590433 resumed=1x calls=2 19.1s $0.0042
├─ researcher#1 [research] L2 idle session=5d47a3 resumed=0x calls=1 9.4s $0.0012
├─ researcher#2 [research] L2 idle session=7917af resumed=0x calls=1 12.4s $0.0022
├─ researcher#3 [research] L2 idle session=d44f9a resumed=1x calls=2 19.7s $0.0034
├─ builder#2 [build] L2 idle session=8dc7b8 resumed=0x calls=1 6.2s $0.0009
├─ builder#3 [build] L2 idle session=52488b resumed=0x calls=1 6.8s $0.0010
├─ researcher#4 [research] L2 idle session=e0429e resumed=0x calls=1 13.9s $0.0010
└─ researcher#5 [research] L2 idle session=3f1b0e resumed=0x calls=1 11.2s $0.0010
```

Who called whom:
```
lead#1 -> builder#1 role=builder L2 session=new done
lead#1 -> builder#1 role=builder L2 session=builder#1 done
lead#1 -> researcher#1 role=researcher L2 session=new done
lead#1 -> researcher#2 role=researcher L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=new done
lead#1 -> builder#2 role=builder L2 session=new done
lead#1 -> builder#3 role=builder L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#4 role=researcher L2 session=new done
lead#1 -> researcher#5 role=researcher L2 session=new done
```

Timeline (agent.* events):
```
+   0.0s  agent.start          lead#1        mode=new session=855914de-2ce8-4519-8eb1-1841d6b3fea6 prompt_chars=1316
+   4.2s  agent.call.granted   lead#1        callee=builder#1 level=2 kind=new
+   4.2s  agent.start          builder#1     mode=new session=590433a8-c197-4784-add8-c9ea12ff1cd7 prompt_chars=343
+  12.6s  agent.done           builder#1     mode=new took=8.4s
+  16.0s  agent.call.granted   lead#1        callee=builder#1 level=2 kind=resume
+  16.0s  agent.start          builder#1     mode=resumed session=590433a8-c197-4784-add8-c9ea12ff1cd7 prompt_chars=491
+  26.6s  agent.done           builder#1     mode=resumed took=10.7s
+  32.1s  agent.done           lead#1        mode=new took=32.1s
+  32.2s  agent.start          lead#1        mode=resumed session=855914de-2ce8-4519-8eb1-1841d6b3fea6 prompt_chars=1589
+  36.0s  agent.call.granted   lead#1        callee=researcher#1 level=2 kind=new
+  36.0s  agent.start          researcher#1  mode=new session=5d47a308-ce62-4ff4-95f5-27566fcc164c prompt_chars=369
+  36.3s  agent.call.granted   lead#1        callee=researcher#2 level=2 kind=new
+  36.3s  agent.start          researcher#2  mode=new session=7917aff6-37c2-4e45-b38d-7fa9e7eaa949 prompt_chars=369
+  36.9s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=new
+  36.9s  agent.start          researcher#3  mode=new session=d44f9a80-5dd3-4aff-9490-dcc38fc1c3d0 prompt_chars=370
+  45.4s  agent.done           researcher#1  mode=new took=9.4s
+  48.7s  agent.done           researcher#2  mode=new took=12.4s
+  49.1s  agent.done           researcher#3  mode=new took=12.1s
+  54.1s  agent.call.granted   lead#1        callee=builder#2 level=2 kind=new
+  54.2s  agent.start          builder#2     mode=new session=8dc7b85b-e54a-408f-a758-b3230af4e2d8 prompt_chars=852
+  60.3s  agent.done           builder#2     mode=new took=6.2s
+  60.4s  agent.call.granted   lead#1        callee=builder#3 level=2 kind=new
+  60.4s  agent.start          builder#3     mode=new session=52488ba0-9f9f-42c1-bbc9-d4fc5dcf5939 prompt_chars=1099
+  67.2s  agent.done           builder#3     mode=new took=6.8s
+  75.9s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+  75.9s  agent.start          researcher#3  mode=resumed session=d44f9a80-5dd3-4aff-9490-dcc38fc1c3d0 prompt_chars=677
+  83.5s  agent.done           researcher#3  mode=resumed took=7.6s
+  86.7s  agent.call.granted   lead#1        callee=researcher#4 level=2 kind=new
+  86.7s  agent.start          researcher#4  mode=new session=e0429e53-fbdb-4487-9448-01d3ad038857 prompt_chars=510
+ 100.5s  agent.done           researcher#4  mode=new took=13.9s
+ 104.8s  agent.done           lead#1        mode=resumed took=1m13s
+ 104.8s  agent.start          lead#1        mode=resumed session=855914de-2ce8-4519-8eb1-1841d6b3fea6 prompt_chars=1460
+ 109.6s  agent.call.granted   lead#1        callee=researcher#5 level=2 kind=new
+ 109.6s  agent.start          researcher#5  mode=new session=3f1b0ee3-b83c-498e-8c64-bb70ca17ed5b prompt_chars=861
+ 120.8s  agent.done           researcher#5  mode=new took=11.2s
+ 124.7s  agent.done           lead#1        mode=resumed took=19.9s
```

## Multi-agent harness (lead + parallel researchers + parallel builders in worktrees + patches) (run 3)

| message | time | cost | agent calls | result | what was checked |
|---|---|---|---|---|---|
| 1 | 17 s | $0.0033 | 2 | PASS | index2.html is an exact copy; index.html untouched; rule violations: 0; session files on disk: all present; registry: clean |
| 2 | 100 s | $0.0215 | 9 | **FAIL** | web1-3.html exist, are HTML and mention their site (bad: web3); index2.html still there; live web fetches: 18 (need >= 3); rule violations: 0; session files on disk: all present; registry: clean |
| 3 | 81 s | $0.0187 | 3 | PASS | web3_detail.md (1063 chars) has the sections and mentions GNU; earlier files all still there; rule violations: 0; session files on disk: all present; registry: clean |
| total | 198 s | $0.0434 | 14 | **FAILURES** | |

- message 1: lead + 0 researcher call(s) + 1 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 6s vs wall 17s, starts spread 0.0s; lead said: `index2.html` now exists in the project as a copy of `index.html`. The builder verified with `cmp` that the two files are byte-for-byte identical, and `index.html` was not changed.  One thing to be aware of: `apply_patches` reported `"committed": true`. I did 
- message 2: lead + 6 researcher call(s) + 2 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 89s vs wall 100s, starts spread 83.2s; lead said: SESSION CODE: W-13SPAM2  Two of the three pages are written. The GNU page is blocked.  **Done** - `web1.html`: example.com. Title "Example Domain", four bullets, and the address. All findings came from the researcher's read of the page. - `web2.html`: w3.org. 
- message 3: lead + 1 researcher call(s) + 1 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 55s vs wall 81s, starts spread 58.1s; lead said: SESSION CODE: W-13SPAM2  `web3_detail.md` is written, but only part of it comes from the site. The gnu.org pages kept returning HTTP 429 (rate limited), so I could not get the full detail you asked for.  **What the file contains** - **Purpose** (read from gnu.

Agent tree (task W):
```
lead#1 [lead] L1 idle session=24c658 resumed=2x calls=3 3m18s $0.0209
├─ builder#1 [build] L2 idle session=e52b89 resumed=0x calls=1 6.4s $0.0013
├─ researcher#1 [research] L2 idle session=4f58c0 resumed=0x calls=1 9.6s $0.0014
├─ researcher#2 [research] L2 idle session=56f877 resumed=1x calls=2 14.2s $0.0043
├─ researcher#3 [research] L2 idle session=05ed20 resumed=2x calls=3 45.2s $0.0056
├─ builder#2 [build] L2 idle session=ce2320 resumed=0x calls=1 7.5s $0.0010
├─ builder#3 [build] L2 idle session=cf4a5a resumed=0x calls=1 12.1s $0.0015
├─ researcher#4 [research] L2 idle session=2606ea resumed=0x calls=1 45.2s $0.0060
└─ builder#4 [build] L2 idle session=ed628f resumed=0x calls=1 9.7s $0.0014
```

Who called whom:
```
lead#1 -> builder#1 role=builder L2 session=new done
lead#1 -> researcher#1 role=researcher L2 session=new done
lead#1 -> researcher#2 role=researcher L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=new done
lead#1 -> researcher#2 role=researcher L2 session=researcher#2 done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> builder#2 role=builder L2 session=new done
lead#1 -> builder#3 role=builder L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#4 role=researcher L2 session=new done
lead#1 -> builder#4 role=builder L2 session=new done
```

Timeline (agent.* events):
```
+   0.0s  agent.start          lead#1        mode=new session=24c65841-2173-409f-9501-7f505d93042c prompt_chars=1698
+   4.8s  agent.call.granted   lead#1        callee=builder#1 level=2 kind=new
+   4.9s  agent.start          builder#1     mode=new session=e52b8952-b3ff-4ea9-855d-b029b4c63fd4 prompt_chars=604
+  11.2s  agent.done           builder#1     mode=new took=6.4s
+  17.0s  agent.done           lead#1        mode=new took=17.0s
+  17.0s  agent.start          lead#1        mode=resumed session=24c65841-2173-409f-9501-7f505d93042c prompt_chars=2020
+  21.2s  agent.call.granted   lead#1        callee=researcher#1 level=2 kind=new
+  21.3s  agent.start          researcher#1  mode=new session=4f58c01a-9adc-4705-8bd7-836f97a69a9d prompt_chars=453
+  21.4s  agent.call.granted   lead#1        callee=researcher#2 level=2 kind=new
+  21.4s  agent.start          researcher#2  mode=new session=56f877e5-42e7-48d5-ae6d-b48d343a053f prompt_chars=453
+  22.1s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=new
+  22.1s  agent.start          researcher#3  mode=new session=05ed200f-ea11-432d-8c59-f2e6a1f78b29 prompt_chars=455
+  30.9s  agent.done           researcher#1  mode=new took=9.6s
+  32.2s  agent.done           researcher#2  mode=new took=10.7s
+  44.5s  agent.done           researcher#3  mode=new took=22.4s
+  48.1s  agent.call.granted   lead#1        callee=researcher#2 level=2 kind=resume
+  48.1s  agent.start          researcher#2  mode=resumed session=56f877e5-42e7-48d5-ae6d-b48d343a053f prompt_chars=451
+  49.0s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+  49.1s  agent.start          researcher#3  mode=resumed session=05ed200f-ea11-432d-8c59-f2e6a1f78b29 prompt_chars=584
+  51.7s  agent.done           researcher#2  mode=resumed took=3.5s
+  64.1s  agent.done           researcher#3  mode=resumed took=15.0s
+  70.4s  agent.call.granted   lead#1        callee=builder#2 level=2 kind=new
+  70.4s  agent.start          builder#2     mode=new session=ce23200a-0861-46f3-8600-30ccc1f2d69a prompt_chars=1030
+  78.0s  agent.done           builder#2     mode=new took=7.5s
+  87.5s  agent.call.granted   lead#1        callee=builder#3 level=2 kind=new
+  87.5s  agent.start          builder#3     mode=new session=cf4a5a4a-a8cf-4ecc-9250-4f3dbef717fb prompt_chars=1078
+  99.6s  agent.done           builder#3     mode=new took=12.1s
+ 104.4s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+ 104.4s  agent.start          researcher#3  mode=resumed session=05ed200f-ea11-432d-8c59-f2e6a1f78b29 prompt_chars=459
+ 112.2s  agent.done           researcher#3  mode=resumed took=7.8s
+ 116.6s  agent.done           lead#1        mode=resumed took=1m40s
+ 116.7s  agent.start          lead#1        mode=resumed session=24c65841-2173-409f-9501-7f505d93042c prompt_chars=1891
+ 121.5s  agent.call.granted   lead#1        callee=researcher#4 level=2 kind=new
+ 121.5s  agent.start          researcher#4  mode=new session=2606eac0-27d0-4e59-a371-d2a85107932c prompt_chars=765
+ 166.7s  agent.done           researcher#4  mode=new took=45.2s
+ 179.6s  agent.call.granted   lead#1        callee=builder#4 level=2 kind=new
+ 179.6s  agent.start          builder#4     mode=new session=ed628f82-54e8-431a-ae65-01c01f27c6f5 prompt_chars=1529
+ 189.3s  agent.done           builder#4     mode=new took=9.7s
+ 198.0s  agent.done           lead#1        mode=resumed took=1m21s
```

## Multi-agent harness (lead + parallel researchers + parallel builders in worktrees + patches) (run 4)

| message | time | cost | agent calls | result | what was checked |
|---|---|---|---|---|---|
| 1 | 25 s | $0.0041 | 2 | **FAIL** | index2.html is an exact copy; index.html untouched; rule violations: 0; session files on disk: all present; registry: clean |
| 2 | 60 s | $0.0165 | 7 | **FAIL** | web1-3.html exist, are HTML and mention their site; index2.html still there; live web fetches: 6 (need >= 3); rule violations: 0; session files on disk: all present; registry: clean |
| 3 | 72 s | $0.0463 | 5 | **FAIL** | web3_detail.md (0 chars) has the sections and mentions site 3; earlier files all still there; rule violations: 0; session files on disk: all present; registry: clean |
| total | 157 s | $0.0670 | 14 | **FAILURES** | |

- message 1: lead + 0 researcher call(s) + 1 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 14s vs wall 25s, starts spread 0.0s; lead said: I couldn't make the copy. The builder agent's Bash tool was denied ("don't ask mode"), so it could not run `cp`. Nothing has been changed.  - **Source found:** `index.html` at `/tmp/lfwt-builder1-nhhCFB/index.html`. There is exactly one, so there's no ambiguit
- message 2: lead + 5 researcher call(s) + 1 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 66s vs wall 60s, starts spread 38.0s; lead said: SESSION CODE: W-13SPAM2  The three pages are written and applied to the project: `web1.html`, `web2.html` and `web3.html`. Each has a title, 3 to 5 bullet findings and the site address as a link.  - **web1.html**: Example Domain (https://example.com). A placeh
- message 3: lead + 4 researcher call(s) + 0 builder call(s); 0 denied; nested calls (level>=3): 0; sub-agent time 51s vs wall 72s, starts spread 39.7s; lead said: SESSION CODE: W-13SPAM2  I couldn't write `web3_detail.md` yet. The Bash tool was denied ("don't ask mode"), so I can't run the builder command that writes the file. I haven't tried to route around the denial.  The research is complete, so only the write is le

Agent tree (task W):
```
lead#1 [lead] L1 idle session=45cef3 resumed=2x calls=3 2m37s $0.0186
├─ builder#1 [build] L2 idle session=3d116e resumed=0x calls=1 13.7s $0.0021  << ASKS ITS PARENT: "The Bash tool was denied ("don't ask mode"), so I could not run the byte-for-byte `cp` or "
├─ researcher#1 [research] L2 idle session=a666ab resumed=0x calls=1 10.1s $0.0012
├─ researcher#2 [research] L2 idle session=253265 resumed=1x calls=2 20.1s $0.0050
├─ researcher#3 [research] L2 idle session=e646c1 resumed=0x calls=5 1m11s $0.0264
├─ builder#2 [build] L2 idle session=d8808d resumed=0x calls=1 10.9s $0.0019
└─ researcher#4 [research] L2 idle session=976bbf resumed=0x calls=1 4.7s $0.0118 fork-of=researcher#3
```

Who called whom:
```
lead#1 -> builder#1 role=builder L2 session=new done
lead#1 -> researcher#1 role=researcher L2 session=new done
lead#1 -> researcher#2 role=researcher L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=new done
lead#1 -> researcher#2 role=researcher L2 session=researcher#2 done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> builder#2 role=builder L2 session=new done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#3 role=researcher L2 session=researcher#3 done
lead#1 -> researcher#4 role=researcher L2 session=fork:researcher#3 done
```

Timeline (agent.* events):
```
+   0.0s  agent.start          lead#1        mode=new session=45cef3cf-b3d6-4461-b9c3-7ad3793792a7 prompt_chars=1698
+   4.9s  agent.call.granted   lead#1        callee=builder#1 level=2 kind=new
+   4.9s  agent.start          builder#1     mode=new session=3d116e49-340b-4079-8dba-e86001413c05 prompt_chars=717
+  18.6s  agent.done           builder#1     mode=new took=13.7s
+  18.6s  agent.needs_parent   builder#1     
+  24.8s  agent.done           lead#1        mode=new took=24.8s
+  24.8s  agent.start          lead#1        mode=resumed session=45cef3cf-b3d6-4461-b9c3-7ad3793792a7 prompt_chars=2021
+  29.1s  agent.call.granted   lead#1        callee=researcher#1 level=2 kind=new
+  29.1s  agent.start          researcher#1  mode=new session=a666ab52-43d5-4863-90da-767019148725 prompt_chars=370
+  29.2s  agent.call.granted   lead#1        callee=researcher#2 level=2 kind=new
+  29.2s  agent.start          researcher#2  mode=new session=253265fd-9c00-4930-9224-e76c34ecf5c1 prompt_chars=370
+  29.8s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=new
+  29.8s  agent.start          researcher#3  mode=new session=703da207-018c-4879-bcac-8ac1f19df771 prompt_chars=374
+  39.2s  agent.done           researcher#1  mode=new took=10.1s
+  44.8s  agent.done           researcher#2  mode=new took=15.6s
+  50.4s  agent.done           researcher#3  mode=new took=20.6s
+  55.1s  agent.call.granted   lead#1        callee=researcher#2 level=2 kind=resume
+  55.1s  agent.start          researcher#2  mode=resumed session=253265fd-9c00-4930-9224-e76c34ecf5c1 prompt_chars=496
+  55.7s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+  55.7s  agent.start          researcher#3  mode=resumed session=703da207-018c-4879-bcac-8ac1f19df771 prompt_chars=498
+  59.6s  agent.done           researcher#2  mode=resumed took=4.5s
+  60.2s  agent.done           researcher#3  mode=resumed took=4.5s
+  67.1s  agent.call.granted   lead#1        callee=builder#2 level=2 kind=new
+  67.1s  agent.start          builder#2     mode=new session=d8808dbb-8a4e-4957-b564-88fefd432695 prompt_chars=2423
+  77.9s  agent.done           builder#2     mode=new took=10.9s
+  84.8s  agent.done           lead#1        mode=resumed took=60.0s
+  84.8s  agent.start          lead#1        mode=resumed session=45cef3cf-b3d6-4461-b9c3-7ad3793792a7 prompt_chars=1892
+  90.2s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+  90.2s  agent.start          researcher#3  mode=resumed session=703da207-018c-4879-bcac-8ac1f19df771 prompt_chars=835
+ 113.1s  agent.done           researcher#3  mode=resumed took=22.9s
+ 117.4s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+ 117.4s  agent.start          researcher#3  mode=resumed session=703da207-018c-4879-bcac-8ac1f19df771 prompt_chars=608
+ 123.4s  agent.done           researcher#3  mode=resumed took=5.9s
+ 129.2s  agent.call.granted   lead#1        callee=researcher#3 level=2 kind=resume
+ 129.2s  agent.start          researcher#3  mode=rolled session=e646c1d4-004b-43b0-aad4-997f59dfe9b0 prompt_chars=2057
+ 129.8s  agent.call.granted   lead#1        callee=researcher#4 level=2 kind=fork
+ 129.9s  agent.start          researcher#4  mode=forked session=976bbf0c-fabe-4c6d-b633-d9c923dc8f64 prompt_chars=409
+ 134.6s  agent.done           researcher#4  mode=forked took=4.7s
+ 146.5s  agent.done           researcher#3  mode=rolled took=17.4s
+ 156.7s  agent.done           lead#1        mode=resumed took=1m12s
```
