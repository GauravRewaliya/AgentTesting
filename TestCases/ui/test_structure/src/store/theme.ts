// Light / dark. "auto" follows the OS until the person picks one; the pick is remembered (localStorage may be blocked: then it only lasts for this visit).
import { ref, watch } from "vue";
export type Theme = "light" | "dark";
const KEY = "ta3.theme";
const read = (): Theme => {
  try { const v = localStorage.getItem(KEY); if (v === "light" || v === "dark") return v; } catch { /* blocked */ }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
export const theme = ref<Theme>(read());
watch(theme, (v) => { document.documentElement.dataset.theme = v; try { localStorage.setItem(KEY, v); } catch { /* blocked */ } }, { immediate: true });
export const toggleTheme = () => (theme.value = theme.value === "dark" ? "light" : "dark");
