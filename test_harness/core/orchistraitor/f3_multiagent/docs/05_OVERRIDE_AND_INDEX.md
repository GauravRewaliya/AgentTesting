# 05 Choosing an approach and overriding defaults (pseudo code)

## One file selects the approach
```ts
// approaches/index.ts
import a1 from "./a1_team_cli/adapter.ts"
import a2 from "./a2_mod/adapter.ts"
import a3 from "./a3_native/adapter.ts"
const ALL = { a1_team_cli: a1, a2_mod: a2, a3_native: a3 }
export default ALL[process.env.APPROACH ?? "a1_team_cli"]   // `--approach=a2_mod` sets APPROACH
```
To try another approach: change the default string, or pass `--approach`.
// TODO: `testrun/run.ts` parses `--approach` next to `sayArg` (ref: f1_multiagent/testrun/run.ts:34); `runLead` gets an `approach` option (ref: f1_multiagent/harness/lead.ts:14, run.ts:145).

## Override layer: custom wins, then the approach, then core default
```ts
// core/resolve.ts
function resolve(rel: string, approach: string): string {
  for (const root of [
    `approaches/custom/${approach}`,   // 1. override for this approach only
    `approaches/custom/_all`,          // 2. override for every approach
    `approaches/${approach}`,          // 3. the approach's own default
    `core`,                            // 4. shared default
  ]) if (exists(join(root, rel))) return join(root, rel)   // first hit wins
  throw new Error(`missing ${rel}`)
}
// used for: prompt files, agent.json, rules (*_rules.json), hook scripts, chapters/*.md, adapters
```

Rules:
- Override = drop a file at the **same relative path** under `custom/<approach>/` (one approach) or `custom/_all/` (all).
- Never edit `core/` to tune one approach.
- Startup prints every override in effect, e.g. `[override] prompts/lead.md <- custom/a1_team_cli`, so a changed behaviour is never silent.

`// ImprovementsNeeded:` only whole files can be overridden (prompts, json, rules, adapters). A TypeScript module cannot be partially overridden. Say so in the README when built.

## Example
```
approaches/a1_team_cli/prompts/lead.md          default lead prompt for a1
approaches/custom/a1_team_cli/prompts/lead.md   wins for a1 only
approaches/custom/_all/rules/builder_rules.json wins for every approach
```
