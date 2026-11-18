// Picks the approach. The default is ENGINE.approach in ../../engine.ts; env APPROACH (or --approach=<name> in testrun/run.ts) overrides it for one run.
import { ENGINE } from "../../engine.ts";
import type { Approach } from "./approach_port.ts";
import { a1 } from "./a1_team_cli/adapter.ts";

const ALL: Record<string, Approach> = { a1_team_cli: a1 };
// NOT_POSSIBLE: a2_mod and a3_native do not exist yet (docs/06): a2 needs the interrupt mod back in the repo, a3 only has launch.ts nativeAgentsJson().

export const approachName = (): string => process.env.APPROACH ?? ENGINE.approach;
export function currentApproach(name = approachName()): Approach {
  const a = ALL[name];
  if (!a) throw new Error(`unknown approach "${name}". Built: ${Object.keys(ALL).join(", ")}`);
  return a;
}
export default currentApproach;
