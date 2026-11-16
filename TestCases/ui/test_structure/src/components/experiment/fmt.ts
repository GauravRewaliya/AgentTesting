// small formatters shared by the Experiment components
export const hm = (t: number) => (t ? new Date(t).toTimeString().slice(0, 8) : "");
export const usd = (n: number) => "$" + n.toFixed(4);
export const dur = (ms: number) => { if (ms < 1000) return "0s"; const s = Math.round(ms / 1000); return s < 60 ? s + "s" : s < 3600 ? Math.floor(s / 60) + "m " + String(s % 60).padStart(2, "0") + "s" : Math.floor(s / 3600) + "h " + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + "m"; };
export const agoOf = (now: number, t?: number) => { if (!t) return "-"; const s = Math.max(0, Math.round((now - t) / 1000)); return s < 60 ? s + "s ago" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
