// Wireframe flag. On: every component shows a dashed frame with its name (and file). Off: a normal page.
// Turn on with ?debug=1, the "Debug" switch in the header, or the D key. Remembered in localStorage.
import { ref, watch } from "vue";

const KEY = "ta3.debug";
const read = (): boolean => {
  try {
    const q = new URLSearchParams(location.search).get("debug");
    if (q !== null) return q !== "0";
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const debug = ref(read());
watch(debug, (v) => {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
});

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement | null;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (e.key === "d" && !e.metaKey && !e.ctrlKey) debug.value = !debug.value;
  });
}
