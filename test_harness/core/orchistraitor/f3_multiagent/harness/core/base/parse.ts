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

/** The CLI marks a failed run with is_error but subtype "success"; the real reason (usage limit, auth, overload...) is in `result`. Turn it into a message the person can act on. */
export function cliErrorText(j: { result?: string; subtype?: string }): string {
  const raw = (j.result ?? "").replace(/\s+/g, " ").trim();
  const sub = j.subtype && j.subtype !== "success" ? j.subtype : "";
  if (/hit your limit|usage limit|limit reached|credit balance|out of credits|quota|insufficient (credit|balance)|rate.?limit|429/i.test(raw))
    return `Credits / usage limit exhausted on this Claude account: ${raw.slice(0, 240)}. Wait for the reset or switch account (CLAUDE_CONFIG_DIR=...).`;
  if (/invalid api key|authentication|not logged in|please run \/login|401|oauth/i.test(raw)) return `Not signed in or login expired for this Claude account: ${raw.slice(0, 240)}. Run \`claude\` with this CLAUDE_CONFIG_DIR and /login.`;
  if (/overloaded|529|503/i.test(raw)) return `Claude API overloaded: ${raw.slice(0, 200)}. Try again shortly.`;
  return raw ? `${sub ? sub + ": " : ""}${raw.slice(0, 300)}` : sub || "error";
}

/** Credits gone or login expired: every other call on this account will fail the same way, so there is no point in running or waiting for them. */
export const isAccountFatal = (msg?: string) => /^(Credits \/ usage limit exhausted|Not signed in)/.test(msg ?? "");
