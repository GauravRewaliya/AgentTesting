// Pure layout, no Vue: the canvas draws it, server/check.ts verifies it on the real data.
// Rule: L0 = fresh tests (no `after`). A follow-up is exactly ONE level below the test it continues.
// Same level = side by side; a parent is centred over its follow-ups. Standalone suites wrap in rows below the tree.
import type { CardOut, CaseOut } from "../../../shared/types";
import { caseHeight, CARD_W } from "./size";

const SLOT = CARD_W + 40, GAP_Y = 60, LEFT = 150, PER_ROW = 4, SOLO_TITLE = 30;
export interface Box { id: string; x: number; y: number; w: number; h: number; level: number; data: CaseOut }
export interface Caption { id: string; x: number; y: number; title: string; width: number }
export interface Layout { boxes: Box[]; captions: Caption[]; edges: { id: string; source: string; target: string }[] }

export function layout(cards: CardOut[]): Layout {
  const all = cards.filter((c) => c.kind === "chain").flatMap((c) => c.cases);
  const byId = new Map(all.map((c) => [c.caseId, c]));
  const parentOf = (c: CaseOut) => (c.after && byId.has(c.after) ? c.after : undefined);
  const kids = new Map<string, CaseOut[]>();
  for (const c of all) if (parentOf(c)) kids.set(c.after!, [...(kids.get(c.after!) ?? []), c]);

  const width = (c: CaseOut): number => Math.max(SLOT, (kids.get(c.caseId) ?? []).reduce((s, k) => s + width(k), 0));
  const at = new Map<string, { x: number; level: number }>();
  const place = (c: CaseOut, left: number, level: number) => {
    at.set(c.caseId, { x: left + (width(c) - CARD_W) / 2, level });
    let l = left;
    for (const k of kids.get(c.caseId) ?? []) { place(k, l, level + 1); l += width(k); }
  };
  let left = LEFT;
  for (const r of all.filter((c) => !parentOf(c))) { place(r, left, 0); left += width(r); }

  const levelH: number[] = [];
  for (const [id, p] of at) levelH[p.level] = Math.max(levelH[p.level] ?? 0, caseHeight(byId.get(id)!));
  const levelY: number[] = []; let y = 0;
  levelH.forEach((h, l) => { levelY[l] = y; y += h + GAP_Y; });

  const boxes: Box[] = [...at].map(([id, p]) => ({ id, x: p.x, y: levelY[p.level]!, w: CARD_W, h: caseHeight(byId.get(id)!), level: p.level, data: byId.get(id)! }));
  const captions: Caption[] = levelH.map((_, l) => ({ id: `level:${l}`, x: 0, y: levelY[l]! + 8, title: l === 0 ? "L0 · fresh" : `L${l} · follow-up`, width: LEFT - 20 }));

  for (const c of cards.filter((k) => k.kind === "standalone")) {
    captions.push({ id: `label:${c.id}`, x: LEFT, y, title: `${c.title} · fresh`, width: PER_ROW * SLOT });
    y += SOLO_TITLE;
    for (let i = 0; i < c.cases.length; i += PER_ROW) {
      const row = c.cases.slice(i, i + PER_ROW), h = Math.max(...row.map(caseHeight));
      row.forEach((k, j) => boxes.push({ id: k.caseId, x: LEFT + j * SLOT, y, w: CARD_W, h: caseHeight(k), level: 0, data: k }));
      y += h + 24;
    }
    y += GAP_Y / 2;
  }
  const edges = all.filter(parentOf).map((c) => ({ id: `${c.after}>${c.caseId}`, source: c.after!, target: c.caseId }));
  return { boxes, captions, edges };
}
