<script setup lang="ts">
// The CONNECTED BROWSER: the Chrome that agents use to look at websites (a person can see it and has logged in to it). Connect, launch, list the open tabs, see a tab, and try a page the way an agent does.
import DebugFrame from "@/components/common/DebugFrame.vue";
import { api, type BrowserOverview, type BrowserTry } from "@/store/api";
import { onBeforeUnmount, onMounted, ref } from "vue";

const o = ref<BrowserOverview | null>(null), err = ref(""), busy = ref(""), endpoint = ref("http://127.0.0.1:9222");
const snap = ref<{ title: string; image: string | null; tab: string } | null>(null);
const tryUrl = ref("https://upwatchr.io/blog"), tryScheme = ref<"light" | "dark">("light"), tryOut = ref<BrowserTry | null>(null);
const openUrl = ref("");
let timer: ReturnType<typeof setInterval> | undefined;

async function load() { try { o.value = await api.browser(); err.value = ""; } catch (e) { err.value = (e as Error).message; } }
async function act<T>(label: string, f: () => Promise<T>) { busy.value = label; err.value = ""; try { const r = await f() as { ok?: boolean; reason?: string }; if (r && r.ok === false) err.value = r.reason ?? "failed"; } catch (e) { err.value = (e as Error).message; } busy.value = ""; await load(); }
const connect = () => act("connect", () => api.browserConnect(endpoint.value));
const launch = () => act("launch", () => api.browserLaunch());
const disconnect = () => act("disconnect", () => api.browserDisconnect());
const toggle = (on: boolean) => act("toggle", () => api.browserToggle(on));
const openTab = () => act("open", async () => { const r = await api.browserOpen(openUrl.value); openUrl.value = ""; return r; });
async function seeTab(t: { id: string; title: string }) { busy.value = "snapshot"; try { const r = await api.browserSnapshot(t.id); snap.value = { title: r.title || t.title, image: r.image, tab: t.id }; if (!r.ok) err.value = r.reason ?? "no picture"; } catch (e) { err.value = (e as Error).message; } busy.value = ""; }
async function runTry() { busy.value = "try"; tryOut.value = null; err.value = ""; try { tryOut.value = await api.browserTry(tryUrl.value, tryScheme.value); } catch (e) { err.value = (e as Error).message; } busy.value = ""; }
onMounted(() => { load(); timer = setInterval(load, 5000); });
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <DebugFrame name="BrowserPage">
    <main class="wrap">
      <h2>Browser <small class="mute">the Chrome agents use to look at websites</small></h2>
      <p v-if="err" class="err">{{ err }}</p>

      <section class="card" v-if="o">
        <div class="row">
          <span class="pill" :class="o.mode === 'attached' && o.reachable ? 'ok' : o.mode === 'attached' ? 'bad' : 'mute'">{{ o.mode === "attached" ? (o.reachable ? "● connected" : "● not answering") : "○ not connected (private headless Chrome)" }}</span>
          <span v-if="o.browser" class="mono">{{ o.browser }}</span><span v-if="o.endpoint" class="mono mute">{{ o.endpoint }}</span><span v-if="o.since" class="mute">since {{ new Date(o.since).toLocaleString() }}</span>
        </div>
        <p class="mute">{{ o.note }}</p>
        <div class="row">
          <input v-model="endpoint" class="mono grow" placeholder="http://127.0.0.1:9222" @keyup.enter="connect" />
          <button :disabled="!!busy" @click="connect">Connect</button>
          <button :disabled="!!busy || !o.chrome || !o.display" :title="o.display ? 'Starts a visible Chrome with its own profile (logins stay)' : 'This machine has no display'" @click="launch">Launch Chrome</button>
          <button :disabled="!!busy || o.mode !== 'attached'" @click="disconnect">Disconnect</button>
          <label v-if="o.saved" class="switch" title="Agents use the connected browser only while this is ON (the connection is kept)"><input type="checkbox" :checked="o.mode === 'attached'" :disabled="!!busy" @change="toggle(($event.target as HTMLInputElement).checked)" /> agents use it</label>
        </div>
        <p v-if="!o.chrome" class="err">No Chrome / Chromium found on this machine.</p>
        <p v-else-if="!o.display" class="mute">No display here: “Launch Chrome” is off. Start Chrome on your desktop and connect (see below).</p>
        <details><summary>How to connect</summary><ul><li v-for="h in o.howto" :key="h">{{ h }}</li></ul><p v-if="o.profile" class="mute mono">profile folder: {{ o.profile }}</p></details>
      </section>

      <section class="card" v-if="o && o.mode === 'attached' && o.reachable">
        <h3>Open tabs ({{ o.tabs?.length ?? 0 }})</h3>
        <table class="tbl"><thead><tr><th>Title</th><th>Address</th><th></th></tr></thead>
          <tbody><tr v-for="t in o.tabs" :key="t.id"><td>{{ t.title || "(untitled)" }}</td><td class="mono mute url">{{ t.url }}</td><td><button :disabled="!!busy" @click="seeTab(t)">See</button></td></tr></tbody></table>
        <div class="row"><input v-model="openUrl" class="grow" placeholder="https://… open in a new tab" @keyup.enter="openTab" /><button :disabled="!!busy || !openUrl" @click="openTab">Open tab</button></div>
        <div v-if="snap" class="snap"><p><b>{{ snap.title }}</b></p><img v-if="snap.image" :src="snap.image" alt="tab picture" /><p v-else class="mute">No picture.</p></div>
        <p class="mute">Agents can inspect a tab that is already open: <span class="mono">browse --tab "&lt;part of its address or title&gt;"</span></p>
      </section>

      <section class="card">
        <h3>Try it <small class="mute">what an agent sees when it opens a page</small></h3>
        <div class="row"><input v-model="tryUrl" class="grow" placeholder="https://…" @keyup.enter="runTry" />
          <select v-model="tryScheme"><option value="light">light theme</option><option value="dark">dark theme</option></select>
          <button :disabled="!!busy || !tryUrl" @click="runTry">{{ busy === "try" ? "Looking…" : "Look" }}</button></div>
        <template v-if="tryOut">
          <p v-if="!tryOut.ok" class="err">{{ tryOut.reason }}</p>
          <template v-else>
            <p class="mute">{{ tryOut.title }} · {{ tryOut.ms }} ms · via {{ tryOut.via === "attached" ? "the connected browser" : "the private headless Chrome" }} · font {{ tryOut.theme?.font }} · background {{ tryOut.theme?.bg }}</p>
            <p v-if="tryOut.console?.length" class="err">{{ tryOut.console.join(" | ") }}</p>
            <table class="tbl" v-if="tryOut.sections?.length"><thead><tr><th>#</th><th>Section</th><th>Components</th><th>Motion</th></tr></thead>
              <tbody><tr v-for="s in tryOut.sections" :key="s.i"><td>{{ s.i }}</td><td>{{ s.heading || s.tag }}</td><td>{{ s.cards ? s.cards + " cards · " : "" }}{{ s.buttons }} buttons · {{ s.images }} icons/images</td><td>{{ s.animated ? "animated" : "—" }}</td></tr></tbody></table>
            <img v-if="tryOut.image" class="full" :src="tryOut.image" alt="the page" />
          </template>
        </template>
      </section>
    </main>
  </DebugFrame>
</template>

<style scoped>
.wrap { max-width: 1100px; margin: 0 auto; padding: 18px 14px 60px; display: grid; gap: 14px; }
h2 { margin: 0; } h3 { margin: 0 0 8px; } small { font-weight: 400; font-size: 13px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: grid; gap: 10px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .grow { flex: 1; min-width: 220px; }
.switch { display: flex; gap: 6px; align-items: center; font-weight: 600; } .switch input { width: auto; }
.pill { padding: 2px 10px; border-radius: 999px; font-weight: 600; font-size: 13px; border: 1px solid var(--line); }
.pill.ok { color: #12b76a; border-color: #12b76a; } .pill.bad { color: #f04438; border-color: #f04438; } .mute { color: var(--mute); } .err { color: #f04438; margin: 0; }
.tbl { width: 100%; border-collapse: collapse; } .tbl th { text-align: left; font-size: 12px; color: var(--mute); padding: 6px 8px; border-bottom: 1px solid var(--line); } .tbl td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.url { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snap img, .full { max-width: 100%; border: 1px solid var(--line); border-radius: 8px; } .full { max-height: 760px; object-fit: contain; object-position: top; }
details ul { margin: 6px 0; padding-left: 18px; display: grid; gap: 4px; }
</style>
