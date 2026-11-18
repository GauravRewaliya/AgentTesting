import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result: a real QA verdict (shape of the PASS of session rs_sakura_page_mwm8na741, second pass). ONLY run(req). Never delete.
export default {
  id: "role-sakura-qa-pass",
  title: "qa-reviewer: PASS on the good sakura build, with one video and two shots, quality judged",
  description: "QA PASS: scene renders (pink blossoms, falling petals), auto-rotate moves the camera, the three buttons work, ONE demo video in QA's folder, two shots looked at",
  match: { agent: "qa-reviewer", keywords: ["sakura", "video"] },
  expected_input: { text: "Verify run_test/sakura (three.js sakura, #btn-rotate, #btn-time, #btn-petals) and record ONE demo video of rotate, day, sunset, petals off and on", guardrails_test: "hand-over names sakura and the video, no tool names (ffmpeg, playwright ...), after the builder" },
  run: () => `PASS\n\nThe scene renders in a real browser: a voxel cherry grove with pink blossom trees, stone lanterns and a pond, with pink petals falling. It reads as a sakura scene and looks tidy.\n\nCHECKED:\n- Load and render: window.__ready true, one canvas, no console errors. Picture qa/qa-reviewer-1/01_day.png (the main view, looked at).\n- Auto-rotate: the camera angle differs between the start and the later shot, so it is moving.\n- Buttons: #btn-rotate toggles its label, #btn-time switches day to sunset and back (picture 02_sunset.png: the look changes, so it was worth a picture), #btn-petals turns the falling petals off and on.\n- Demo video: ONE recording of rotate, sunset, petals off and on, about 40 s: qa/qa-reviewer-1/session.webm (report with the numbered steps: qa/qa-reviewer-1/index.html).\n\nNOT CHECKED:\n- Other browsers, a phone viewport, long-run performance.\n\nQuality: good for the brief. Two pictures only (the main view and the sunset look), no picture to prove motion: the video shows it.`,
} satisfies ResultModule;
