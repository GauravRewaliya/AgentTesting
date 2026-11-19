// QA EVIDENCE helpers (pictures, clips, reports under <session>/store/qa/<agent>/): where it goes, archiving the old, the problems file, whether video is switched off.
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { videoOffReason } from "../core/loops_ai.ts";
import { file, realCwd, store } from "./ctx.ts";

/** Video is the one heavy thing a project can switch off: .loopsAI/config.json { "qa_check": false }. Screenshots and everything else stay available. */
/** Where evidence goes (pictures, videos, reports): <session>/store/qa/<name>/. The workspace holds the person's project only; nothing agents record is written into it. */
export const mediaRoot = join(dirname(file), "qa");
/** the pictures of a session folder, full paths, in the order taken: every `tab do` reply lists them, so an agent never hunts for a path (found: 3 extra calls to find them) */

/** QA evidence housekeeping (store/qa): nothing is lost, old stuff is MOVED to qa/_old/<stamp>/ and anyone can delete it with plain rm */
export const archiveEvidence = (dir: string | undefined, why: string): string | undefined => {
  if (!dir || !existsSync(dir)) return undefined; const keep = readdirSync(dir).filter((n) => !n.startsWith(".")); if (!keep.length) return undefined;
  const dest = join(mediaRoot, "_old", new Date().toISOString().replace(/[:.]/g, "-") + "_" + dir.split("/").pop()); mkdirSync(dest, { recursive: true });
  for (const n of keep) { try { renameSync(join(dir, n), join(dest, n)); } catch { /* best effort */ } }
  try { writeFileSync(join(dest, "WHY.txt"), why + "\n"); } catch { /* ok */ } return dest;
};
/** what a QA agent hit (failed requests, a missing video): kept in its folder as problems.json so the lead reads it BEFORE it shows anything to the person */
export const noteProblems = (dir: string, add: string[]) => { if (!add.length) return; const f = join(dir, "problems.json"); let cur: string[] = []; try { cur = JSON.parse(readFileSync(f, "utf8")); } catch { /* new */ } const all = [...new Set([...cur, ...add])].slice(-30); try { mkdirSync(dir, { recursive: true }); writeFileSync(f, JSON.stringify(all, null, 1)); } catch { /* ok */ } };
export const readProblems = (dir: string): string[] => { try { return JSON.parse(readFileSync(join(dir, "problems.json"), "utf8")); } catch { return []; } };
export const pictureFiles = (dir: string): string[] => { try { return readdirSync(dir).filter((f) => /^\d{2}_.+\.(png|jpe?g)$/.test(f)).sort().map((f) => join(dir, f)); } catch { return []; } };
export const mediaOut = (rel: string) => { const r = rel.replace(/^(run_test|store|qa)[\\/]/, "").replace(/^\/+/, ""); return r && !r.split(/[\\/]/).includes("..") ? join(mediaRoot, r) : undefined; };
export const videoOff = (): string | undefined => { const why = videoOffReason(join(realCwd, "run_test")); return why ? why + "; screenshots still work" : undefined; };
