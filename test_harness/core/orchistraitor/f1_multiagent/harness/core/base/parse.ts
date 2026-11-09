// Pulls the one JSON line an agent was told to end with (`REPORT:`, `VERDICT:`, `TRIAGE:`).
export function lastJson<T = unknown>(reply: string, marker: string): T | null {
  const i = reply.lastIndexOf(marker);
  if (i < 0) return null;
  const rest = reply.slice(i + marker.length);
  const start = rest.search(/[{[]/);
  if (start < 0) return null;
  const open = rest[start]!, close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < rest.length; k++) {
    const c = rest[k]!;
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) { try { return JSON.parse(rest.slice(start, k + 1)) as T; } catch { return null; } }
  }
  return null;
}
const STOP = new Set(["the", "a", "an", "is", "are", "was", "were", "of", "to", "in", "on", "it", "its", "this", "that", "here", "there", "not", "no", "be", "been", "and", "or", "for", "with", "has", "have", "still", "yet", "now", "but"]);
const toks = (s: string) => new Set(norm(s).split(" ").filter((w) => w && !STOP.has(w)));
/** Same complaint in other words: at least 2 shared meaningful words and 80% of the shorter one inside the longer one. */
export function similar(a: string, b: string): boolean {
  const x = toks(a), y = toks(b); if (!x.size || !y.size) return false;
  const inter = [...x].filter((w) => y.has(w)).length;
  return inter >= 2 && inter / Math.min(x.size, y.size) >= 0.8;
}
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
