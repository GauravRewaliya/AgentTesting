// Exact card height. CaseRow renders every line on ONE line (ellipsis), so height is a sum, not a guess.
// Layout (FlowCanvas) and the card (CaseNode) both use this, so cards can never overlap.
import type { CaseOut } from "@/types";
export const CARD_W = 340;
export const caseHeight = (c: CaseOut) => 12 + 24 + 16 + (c.sessionId ? 16 : 0) + c.turns.length * 22 + (c.subSessions.length ? 26 : 0) + 6;
