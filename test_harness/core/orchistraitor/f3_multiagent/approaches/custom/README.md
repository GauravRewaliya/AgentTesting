# custom/ (overrides)

Drop a file at the SAME relative path to replace the default.
- `custom/<approach>/<path>`: only for that approach
- `custom/_all/<path>`: for every approach

Rules
- Every override says where the general file is, in its first 3 lines: `// CUSTOM: overrides <general file>` (.ts) or `<!-- CUSTOM: overrides <general file> -->` (.md).
- Never edit the shared file to tune one approach.
- Only whole files can be overridden (prompts, json, rules, adapters).
- `overrides(approach)` in `../resolve.ts` lists what is active.
