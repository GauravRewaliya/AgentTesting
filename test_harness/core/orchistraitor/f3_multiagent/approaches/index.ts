// Picks the approach. The default is CONFIG.approach in config.ts; env APPROACH (or --approach=<name> in testrun/run.ts) overrides it for one run.
import { CONFIG } from "@core/config.ts";
import type { Approach } from "./approach_port.ts";
import { a1 } from "./a1_team_cli/adapter.ts";
import { a2, a2observe } from "./a2_native_hook/adapter.ts";
import { a3 } from "./a3_native_mod/adapter.ts";

const ALL: Record<string, Approach> = { a1_team_cli: a1, a2_native_hook: a2, a2_native_observe: a2observe, a3_native_mod: a3 };
// a2_native_hook = stock Agent tool answered by a PreToolUse hook (replaces the lost mod). a3_native does not exist yet (docs/06): only launch.ts nativeAgentsJson().

export const approachName = (): string => process.env.APPROACH ?? CONFIG.approach;
export function currentApproach(name = approachName()): Approach {
  const a = ALL[name];
  if (!a) throw new Error(`unknown approach "${name}". Built: ${Object.keys(ALL).join(", ")}`);
  return a;
}
export default currentApproach;
