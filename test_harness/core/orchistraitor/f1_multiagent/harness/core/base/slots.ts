// A machine-wide cap on heavy processes (default: 3 `claude` at once), shared by every process of every run through a few lock folders in /tmp.
// A slot whose owner died is reclaimed, so a killed run never blocks the next one.
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; } };
export async function acquireSlot(name: string, max: number, dir = join(tmpdir(), "lf-slots")): Promise<() => void> {
  mkdirSync(dir, { recursive: true });
  for (;;) {
    for (let i = 0; i < max; i++) {
      const p = join(dir, `${name}.${i}`);
      try { mkdirSync(p); writeFileSync(join(p, "pid"), String(process.pid)); return () => rmSync(p, { recursive: true, force: true }); }
      catch {
        try { if (!alive(Number(readFileSync(join(p, "pid"), "utf8")))) rmSync(p, { recursive: true, force: true }); }   // owner is gone
        catch { try { if (Date.now() - statSync(p).mtimeMs > 5000) rmSync(p, { recursive: true, force: true }); } catch { /* released meanwhile */ } }
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}
export const maxProcs = () => Math.max(1, Number(process.env.HARNESS_MAX_PROCS ?? 5));
