<script setup lang="ts">
import DebugFrame from "@/components/common/DebugFrame.vue";
// MIDDLE, under the bug reports: the PROOF agents made in this session: screenshots and videos (QA agent, `browse`, the test runner's --video). They arrive over the WebSocket (topic "evidence",
// pushed only when the list changed); the files are served by GET /api/evidence/<task>/<root>/<path>. Nothing here polls.
import { computed, ref } from "vue";
import type { EvidenceItem, EvidenceOut } from "../../../shared/experiment";
import { hm } from "./fmt";

const props = defineProps<{ evidence: EvidenceOut | null }>();
const open = ref(false), pick = ref<"all" | "image" | "video">("all");
const items = computed(() => (props.evidence?.items ?? []).filter((x) => pick.value === "all" || x.kind === pick.value));
const where = (x: EvidenceItem) => (x.root === "qa" ? "test run" : x.root === "shots" ? "browser" : "QA agent");
const size = (n: number) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " kB" : (n / 1048576).toFixed(1) + " MB");
</script>

<template>
  <DebugFrame name="Evidence" hint="experiment/Evidence.vue">
    <section class="ev" :class="{ has: evidence?.count }">
      <button type="button" class="evh" :aria-expanded="open" @click="open = !open">
        <span class="chev">{{ open ? "▾" : "▸" }}</span> Evidence
        <span class="n" :class="{ zero: !evidence?.count }">{{ evidence?.count ?? 0 }}</span>
        <span v-if="evidence?.count" class="muted small">{{ evidence.images }} images · {{ evidence.videos }} videos</span>
        <span class="muted small hint">screenshots and videos agents made in this session</span>
      </button>
      <div v-show="open" class="evb">
        <div v-if="!evidence?.count" class="muted small">Nothing yet. Screenshots appear when an agent uses <code>browse</code>; videos with <code>browse --video</code> or the test runner's <code>--video</code>.</div>
        <template v-else>
          <div class="tools small"><button v-for="k in (['all', 'image', 'video'] as const)" :key="k" type="button" :class="{ on: pick === k }" @click="pick = k">{{ k === "all" ? "all" : k + "s" }}</button></div>
          <div class="grid">
            <figure v-for="x in items" :key="x.root + x.rel" class="card">
              <a v-if="x.kind === 'image'" :href="x.url" target="_blank" rel="noopener"><img :src="x.url" :alt="x.name" loading="lazy" /></a>
              <video v-else-if="x.kind === 'video'" :src="x.url" controls preload="metadata" />
              <a v-else :href="x.url" target="_blank" rel="noopener" class="txt">{{ x.name }}</a>
              <figcaption class="small"><b :title="x.name">{{ x.name.split("/").slice(-2).join("/") }}</b><span class="muted">{{ where(x) }} · {{ hm(x.t) }} · {{ size(x.size) }}</span></figcaption>
            </figure>
          </div>
        </template>
      </div>
    </section>
  </DebugFrame>
</template>

<style scoped>
.ev { border: 1px solid var(--line, #e3e3e3); border-radius: 8px; margin: 8px 0; background: var(--panel, #f6f6f6); }
.evh { all: unset; display: flex; gap: 8px; align-items: center; padding: 6px 10px; cursor: pointer; width: calc(100% - 20px); font-weight: 600; }
.chev { width: 12px; color: var(--mut, #666); }
.n { background: var(--acc, #5753c6); color: #fff; border-radius: 9px; padding: 0 8px; font-size: 11px; }
.n.zero { background: var(--line, #ddd); color: var(--mut, #666); }
.hint { margin-left: auto; font-weight: 400; }
.evb { padding: 4px 10px 10px; max-height: 420px; overflow: auto; }
.tools { display: flex; gap: 4px; margin-bottom: 6px; }
.tools button { border: 1px solid var(--line, #ddd); background: transparent; border-radius: 6px; padding: 1px 8px; cursor: pointer; color: inherit; }
.tools button.on { background: var(--acc, #5753c6); color: #fff; border-color: transparent; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.card { margin: 0; border: 1px solid var(--line, #ddd); border-radius: 6px; background: var(--bg, #fff); overflow: hidden; }
.card img, .card video { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #000; }
.card .txt { display: block; padding: 10px; word-break: break-all; }
.card figcaption { display: flex; flex-direction: column; padding: 4px 6px; gap: 1px; }
.card figcaption b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
</style>
