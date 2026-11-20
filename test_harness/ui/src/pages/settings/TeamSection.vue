<script setup lang="ts">
// Team: how the agents are connected and what each one has. Three tabs.
//  Agents  the tree of who may call whom; per agent the buttons Prompt (what the model really gets), Tools, Branches (who it can call / who calls it), Skills.
//  Skills  the skill library, where each skill is mounted, and add / mount your own (your layer under <home>/team, the repo's core/agents/skills.json is never written).
//  Mod     the a3 mod: its hooks (read from the source), when each piece of context is added (startup / every turn / on a tool call ...), and the plugin features (done / off / to do).
// Every load is one request on a click; nothing here polls (live data would go over the socket).
import DebugFrame from "@/components/common/DebugFrame.vue";
import { api } from "@/store/api";
import { computed, onMounted, reactive, ref } from "vue";
import type { TeamAgent, TeamMod, TeamOverview, TeamTools } from "../../../shared/team";

const tab = ref<"agents" | "skills" | "mod">("agents"), data = ref<TeamOverview | null>(null), mod = ref<TeamMod | null>(null), err = ref(""), busy = ref(false);
const sel = ref("lead"), view = ref<"" | "prompt" | "tools" | "branches" | "skills">("branches");
const prompt = ref<{ text: string; chars: number; note: string } | null>(null), tools = ref<TeamTools | null>(null);
const nf = reactive({ name: "", description: "", body: "" }), mountTo = reactive<Record<string, string>>({}), when = reactive<Record<string, string>>({});

const agents = computed(() => data.value?.agents ?? []), cur = computed<TeamAgent | undefined>(() => agents.value.find((a) => a.name === sel.value));
// the tree: an agent several others may call is drawn once under each caller (a loop is not drawn again)
type Row = { name: string; depth: number };
const rows = computed<Row[]>(() => {
  const by = new Map(agents.value.map((a) => [a.name, a])), out: Row[] = [], seen = new Set<string>();
  const walk = (n: string, depth: number, path: string[]) => { out.push({ name: n, depth }); seen.add(n); for (const c of by.get(n)?.branches ?? []) if (by.has(c) && !path.includes(c)) walk(c, depth + 1, [...path, c]); };
  if (by.has("lead")) walk("lead", 0, ["lead"]);
  for (const a of agents.value) if (!seen.has(a.name)) walk(a.name, 0, [a.name]);   // agents nobody calls (the test stand-ins) stand alone
  return out;
});

async function load() { try { data.value = await api.team(); err.value = ""; } catch (e) { err.value = String(e instanceof Error ? e.message : e); } }
async function pick(n: string) { sel.value = n; prompt.value = null; tools.value = null; await show(view.value); }
async function show(v: typeof view.value) {
  view.value = v; err.value = "";
  try { if (v === "prompt" && !prompt.value) prompt.value = await api.teamPrompt(sel.value); if (v === "tools" && !tools.value) tools.value = await api.teamTools(sel.value); } catch (e) { err.value = String(e instanceof Error ? e.message : e); }
}
async function openMod() { tab.value = "mod"; if (!mod.value) try { mod.value = await api.teamMod(); } catch (e) { err.value = String(e instanceof Error ? e.message : e); } }
async function act(fn: () => Promise<TeamOverview>) { busy.value = true; err.value = ""; try { data.value = await fn(); } catch (e) { err.value = String(e instanceof Error ? e.message : e); } busy.value = false; }
const addSkill = () => act(async () => { const r = await api.teamSkillNew({ ...nf }); Object.assign(nf, { name: "", description: "", body: "" }); return r; });
const mount = (skill: string) => mountTo[skill] ? act(() => api.teamSkillMount({ skill, agents: [mountTo[skill]!], ...(when[skill] ? { when: when[skill] } : {}) })) : undefined;
const unmount = (skill: string, agent: string) => act(() => api.teamSkillUnmount({ skill, agent }));
const mountedBy = (agent: string) => (data.value?.mounts ?? []).filter((m) => m.agents.includes(agent));
const byWhen = computed(() => { const g = new Map<string, TeamMod["context"]>(); for (const c of mod.value?.context ?? []) g.set(c.when, [...(g.get(c.when) ?? []), c]); return [...g]; });
onMounted(load);
</script>

<template>
  <DebugFrame name="TeamSection">
    <div class="team">
      <h2>Team <small class="mute">approach <b class="mono">{{ data?.approach ?? "…" }}</b> · how the agents connect, what each has</small></h2>
      <p v-if="err" class="bad">{{ err }}</p>
      <div class="tabs"><button :class="{ on: tab === 'agents' }" @click="tab = 'agents'">Agents</button><button :class="{ on: tab === 'skills' }" @click="tab = 'skills'">Skills</button><button :class="{ on: tab === 'mod' }" @click="openMod">Mod: hooks &amp; context</button></div>

      <!-- AGENTS -->
      <div v-if="tab === 'agents'" class="grid">
        <aside class="tree card">
          <h3>Connections <small class="mute">who may call whom</small></h3>
          <button v-for="(r, i) in rows" :key="i" class="node" :class="{ on: r.name === sel }" :style="{ paddingLeft: 8 + r.depth * 18 + 'px' }" @click="pick(r.name)">
            <span class="mute">{{ r.depth ? "↳" : "" }}</span> {{ r.name }}<span v-if="agents.find((a) => a.name === r.name)?.kind === 'test'" class="chip">stand-in</span>
          </button>
        </aside>
        <section v-if="cur" class="card main">
          <header><h3>{{ cur.name }}</h3><span class="chip">{{ cur.role }}</span><span class="chip">{{ cur.model }}</span><span class="chip" :class="{ warn: cur.writes }">{{ cur.writes ? "writes files" : "read-only" }}</span><span v-if="cur.fixtures" class="chip">answered by fixtures</span></header>
          <p class="mute">{{ cur.description }}</p>
          <div class="btns">
            <button :class="{ on: view === 'prompt' }" @click="show('prompt')">Prompt</button><button :class="{ on: view === 'tools' }" @click="show('tools')">Tools</button>
            <button :class="{ on: view === 'branches' }" @click="show('branches')">Branches <span class="chip">{{ cur.branches.length }}</span></button><button :class="{ on: view === 'skills' }" @click="show('skills')">Skills <span class="chip">{{ cur.skills.length }}</span></button>
          </div>
          <div v-if="view === 'prompt'"><p v-if="!prompt" class="mute">Reading…</p><template v-else><p class="mute">{{ prompt.chars }} characters · {{ prompt.note }}</p><pre class="text">{{ prompt.text }}</pre></template></div>
          <div v-else-if="view === 'tools'"><p v-if="!tools" class="mute">Reading…</p><template v-else>
            <p class="mute">{{ tools.note }} · {{ tools.canCall ? "can call sub-agents" : "calls nobody" }}</p>
            <h4>Allowed</h4><div class="chips"><span v-for="a in tools.allow" :key="a" class="chip mono">{{ a }}</span><span v-if="!tools.allow.length" class="mute">nothing</span></div>
            <template v-if="tools.typed.length"><h4>Typed team tools <small class="mute">(the lead's commands, served by the mod)</small></h4><ul class="plain"><li v-for="t in tools.typed" :key="t.name"><span class="mono">{{ t.name }}</span> <span class="mute">{{ t.description }}</span></li></ul></template>
          </template></div>
          <div v-else-if="view === 'branches'">
            <h4>Can call</h4><div class="chips"><button v-for="b in cur.branches" :key="b" class="chip link" @click="pick(b)">{{ b }}</button><span v-if="!cur.branches.length" class="mute">nobody: it works alone and reports back</span></div>
            <h4>Called by</h4><div class="chips"><button v-for="b in cur.callers" :key="b" class="chip link" @click="pick(b)">{{ b }}</button><span v-if="!cur.callers.length" class="mute">nobody (the person talks to it)</span></div>
          </div>
          <div v-else>
            <h4>Skills mounted for {{ cur.name }}</h4>
            <div class="chips"><span v-for="s in cur.skills" :key="s" class="chip">{{ s }}</span><span v-if="!cur.skills.length" class="mute">none: its context stays small</span></div>
            <h4>Declared by</h4>
            <ul class="plain"><li v-for="(m, i) in mountedBy(cur.name)" :key="i"><span class="chip">{{ m.by === "repo" ? "repo" : "you" }}</span> <span class="mono">{{ m.skills.join(", ") }}</span> <span v-if="m.when" class="mute">only when the hand-over matches <span class="mono">/{{ m.when }}/i</span></span></li><li v-if="!mountedBy(cur.name).length" class="mute">no declaration for this agent</li></ul>
            <p class="mute" v-if="cur.ownSkills.length">Its own folder holds {{ cur.ownSkills.length }} skills (the library); only the declared ones are mounted.</p>
          </div>
        </section>
      </div>

      <!-- SKILLS -->
      <div v-else-if="tab === 'skills'" class="skills">
        <p class="mute">A skill is mounted only for the agents it is declared for (and, if set, only when the hand-over matches). Repo declarations: <span class="mono">core/agents/skills.json</span>. Yours are saved in <span class="mono">{{ data?.home }}</span>.</p>
        <table class="card">
          <thead><tr><th>Skill</th><th>What it is for</th><th>Mounted for</th><th>Mount for</th></tr></thead>
          <tbody>
            <tr v-for="s in data?.skills ?? []" :key="s.name">
              <td><b class="mono">{{ s.name }}</b><div class="mute small">{{ s.by === "you" ? "yours" : "from " + s.from }}</div></td>
              <td class="mute small">{{ s.description }}</td>
              <td><span v-for="a in [...new Set(s.mountedFor)]" :key="a" class="chip">{{ a }} <button class="x" title="remove (your mounts only)" @click="unmount(s.name, a)">×</button></span><span v-if="!s.mountedFor.length" class="mute">nobody</span></td>
              <td class="mount"><select v-model="mountTo[s.name]"><option value="">agent…</option><option v-for="a in agents" :key="a.name" :value="a.name">{{ a.name }}</option></select><input v-model="when[s.name]" placeholder="only when… (regex, optional)" /><button :disabled="busy || !mountTo[s.name]" @click="mount(s.name)">Mount</button></td>
            </tr>
          </tbody>
        </table>
        <form class="card newskill" @submit.prevent="addSkill">
          <h3>New skill</h3>
          <input v-model="nf.name" placeholder="name (a-z, 0-9, -)" /><input v-model="nf.description" placeholder="when should an agent use it? (one line)" />
          <textarea v-model="nf.body" rows="6" placeholder="What the agent must do (the body of SKILL.md)"></textarea>
          <button :disabled="busy || !nf.name || !nf.description || !nf.body">Add skill</button> <span class="mute">then mount it for an agent in the table</span>
        </form>
      </div>

      <!-- MOD -->
      <div v-else class="mod">
        <p v-if="!mod" class="mute">Reading the mod…</p>
        <template v-else>
          <p v-if="!mod.isMod" class="warn-box">The current approach is <b>{{ mod.approach }}</b>, not the mod: this is what a3_native_mod does when you switch to it (<span class="mono">test_harness/core/config.ts</span>).</p>
          <p class="mute">Source: <span class="mono">{{ mod.dir }}</span> · built into <span class="mono">core/.build/{{ mod.built ?? "(not built yet: it is built at the first launch)" }}</span></p>
          <h3>Hooks and functions</h3>
          <table class="card"><thead><tr><th>File</th><th>What it does</th><th>Events</th></tr></thead><tbody>
            <tr v-for="h in mod.hooks" :key="h.file"><td class="mono">{{ h.file }}</td><td class="small">{{ h.what }}</td>
              <td><span v-for="(e, i) in h.events" :key="i" class="chip mono">{{ e.event }}<template v-if="e.matcher"> · {{ e.matcher }}</template></span><span v-if="h.guarded" class="chip ok" title="a failed hook refuses the call">.catch gate</span><span v-if="!h.events.length" class="mute">helper</span></td></tr>
          </tbody></table>
          <h3>When context is added</h3>
          <div v-for="[w, list] in byWhen" :key="w" class="card when"><h4>{{ w }}</h4><ul class="plain"><li v-for="c in list" :key="c.file + c.what">{{ c.what }} <span class="mute mono small">{{ c.file }}</span></li></ul></div>
          <h3>Plugin features <small class="mute">what the mod runtime gives us, and what is left</small></h3>
          <table class="card"><tbody><tr v-for="f in mod.features" :key="f.name"><td><span class="chip" :class="f.status">{{ f.status === "done" ? "done" : f.status === "off" ? "off" : "to do" }}</span></td><td>{{ f.name }}</td><td class="mute small">{{ f.note }}</td></tr></tbody></table>
        </template>
      </div>
    </div>
  </DebugFrame>
</template>

<style scoped>
.team h2 { margin: 0 0 8px; } .team h3 { margin: 4px 0 8px; font-size: 15px; } .team h4 { margin: 12px 0 6px; font-size: 13px; } .mute { color: var(--mute); } .small { font-size: 12px; } .bad { color: #c0392b; }
.tabs { display: flex; gap: 6px; margin: 10px 0 14px; flex-wrap: wrap; } .tabs button, .btns button { border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 6px 12px; border-radius: 6px; cursor: pointer; }
.tabs button.on, .btns button.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
.grid { display: grid; grid-template-columns: 250px 1fr; gap: 14px; align-items: start; } .tree { display: grid; gap: 2px; } .main { min-width: 0; }
.node { text-align: left; background: none; border: 0; padding: 5px 8px; border-radius: 5px; color: var(--ink); cursor: pointer; } .node.on, .node:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } header h3 { margin: 0; }
.btns { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; } .chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.chip { display: inline-flex; gap: 4px; align-items: center; font-size: 11px; border: 1px solid var(--line); border-radius: 10px; padding: 1px 8px; background: color-mix(in srgb, var(--mute) 8%, transparent); margin: 1px 2px; }
.chip.warn, .chip.off { border-color: #d68910; color: #b9770e; } .chip.done, .chip.ok { border-color: #1e8449; color: #1e8449; } .chip.todo { border-color: var(--mute); }
.chip.link { cursor: pointer; background: none; color: var(--accent); } .x { border: 0; background: none; cursor: pointer; color: var(--mute); padding: 0 0 0 2px; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; } ul.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: 5px; }
pre.text { white-space: pre-wrap; word-break: break-word; max-height: 60vh; overflow: auto; background: color-mix(in srgb, var(--mute) 8%, transparent); padding: 10px; border-radius: 6px; font-size: 12px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; } th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; } th { font-size: 12px; color: var(--mute); }
.mount { display: flex; gap: 4px; flex-wrap: wrap; } .mount select, .mount input, .newskill input, .newskill textarea { background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 5px; padding: 4px 6px; }
.newskill { display: grid; gap: 8px; max-width: 640px; } .when { margin-bottom: 8px; } .warn-box { border: 1px solid #d68910; border-radius: 6px; padding: 8px 10px; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
</style>
