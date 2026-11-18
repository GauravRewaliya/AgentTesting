// contains_none (found in real sakura sessions): a builder is never TOLD to record a video or run a browser; a negated limit ("no video, screenshots, server") is fine.
// (own file: test/harness.test.ts declares `rules` and `long` twice and does not load, a separate problem)
import { expect, test } from "bun:test";
import { checkHandover } from "../core/guard.ts";
const long = (s: string) => s.padEnd(300, " .");
const noRec = { builder: { contains_none: ["ffmpeg", "playwright", "webm", "mp4", "demo video", "screenshot", "record"] } };
test("guard contains_none: the lead's real boundary 'Only your files. Quick syntax check only; no video, screenshots, server.' passes", () => {
  expect(checkHandover({ rules: noRec as never, agent: "builder", done: [], prompt: long("You own js/sakura.js. CONTRACT: createSakura(scene). Only your files. Quick syntax check only; no video, screenshots, server. Do not record anything.") })).toEqual([]);
});
test("guard contains_none: an instruction to record, screenshot or convert is caught, with the word", () => {
  for (const bad of ["Also record a demo video of the page.", "Write record_demo.mjs with playwright and save demo.webm", "Take screenshots of it and convert with ffmpeg."]) {
    const why = checkHandover({ rules: noRec as never, agent: "builder", done: [], prompt: long("You own js/sakura.js. " + bad) });
    expect(why.some((w) => /not its job/.test(w))).toBe(true);
  }
});
test("guard contains_none: a role without the rule is not affected", () => {
  expect(checkHandover({ rules: { qa: {} } as never, agent: "qa", done: [], prompt: long("record a demo video") })).toEqual([]);
});
