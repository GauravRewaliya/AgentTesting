# 10 Open decisions (none answered here)

1. **A2 source.** Rebuild the mod from the recovered copy, keep the hook + thin-agent path as a sub-mode, or both? The evidence in `06` conflicts: the mod is described as the latest approach, but `claude.ts:36` and `run.ts` say it is not available and force `mod:false`.
2. **f1 handling.** New folder beside f1 with f1 untouched, or `git mv`? It affects the ~15 outside importers in `08`.
3. **A3 scope.** In scope now, or only a documented placeholder?
4. **Lookup/guard home.** `core/fixtures/` (what the coupling data suggests) or a neutral shared folder?
5. **Override granularity.** Whole files only (prompts, json, rules, adapters), or also per-function hooks?
6. **Follow-up semantics.** Template over history (A2) or session table with `fix` results (A1) as the reference?
7. **Legacy stage loop.** Keep it out of f3 entirely?
8. **Decision record.** No written reason exists in f1's docs for choosing its own CLI over native subagents; the only one is the Loopferry plan (`06`). Copy it into f3 docs?
