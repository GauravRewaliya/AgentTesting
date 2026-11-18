/* Plan walkthrough player. Reads <plan folder>/walkthrough.json (schema: ../WALKTHROUGH_SPEC.md).
   Static: serve the repo root (python3 -m http.server) and open /docs/dev_exp/walkthrough/ */
(() => {
const $app = document.getElementById('app');
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', securityLevel: 'loose', flowchart: { htmlLabels: true } });

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const md = (s) => marked.parse(String(s ?? ''), { breaks: false });
const mdi = (s) => marked.parseInline(String(s ?? ''));
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

const S = { registry: [], id: null, plan: null, base: '', view: 'plan', step: 0, dev: store.get('wt-dev', '0') === '1', dir: 'fwd' };

async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' -> ' + r.status); return r.json(); }
async function getText(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' -> ' + r.status); return r.text(); }

/* ---------- routing: #<planId>/<view>/<step> ---------- */
function readHash() { const [id, view, step] = location.hash.slice(1).split('/'); return { id, view: view === 'work' ? 'work' : 'plan', step: Math.max(0, parseInt(step || '0', 10) || 0) }; }
function writeHash() { history.replaceState(null, '', `#${S.id}/${S.view}/${S.step}`); }
async function route() {
  const { id, view, step } = readHash();
  if (!id) { S.id = null; return renderHome(); }
  const meta = S.registry.find((p) => p.id === id);
  if (!meta) { location.hash = ''; return; }
  if (S.id !== id) {
    S.base = new URL(meta.base, new URL('plans.json', location.href)).href;
    try { S.plan = await getJSON(new URL('walkthrough.json', S.base).href); }
    catch (e) { $app.replaceChildren(h('div', { class: 'home' }, h('h1', {}, 'Cannot load this plan'), h('p', { class: 'lead' }, String(e)), h('a', { href: '#' }, 'back'))); return; }
    S.id = id;
  }
  S.view = view; S.step = Math.min(step, stepsOf().length - 1); renderPlan();
}
const stepsOf = () => (S.plan[S.view] || S.plan.plan).steps;

/* ---------- home ---------- */
function renderHome() {
  document.title = 'Plan walkthrough';
  $app.replaceChildren(h('div', { class: 'home' },
    h('h1', {}, 'Plan walkthroughs'),
    h('p', { class: 'lead' }, 'Click through each plan: what you get, how it looks, how it flows. The Phases & tasks page is separate, so the plan stays short.'),
    h('div', { class: 'grid' }, S.registry.map((p, i) => h('a', { class: 'pcard', href: `#${p.id}/plan/0`, style: `--i:${i}` },
      h('h3', {}, p.title), h('p', {}, p.tagline), h('span', { class: 'chip' }, p.status))))));
}

/* ---------- plan shell ---------- */
function renderPlan() {
  const P = S.plan, steps = stepsOf(), st = steps[S.step];
  document.title = `${P.title} · ${st.title}`;
  const rail = h('aside', { class: 'rail' },
    h('a', { class: 'back', href: '#' }, '← all plans'),
    h('h2', {}, P.title), h('span', { class: 'chip' }, P.status),
    h('ol', { class: 'steps' }, steps.map((s, i) => h('li', { class: i === S.step ? 'on' : i < S.step ? 'done' : '' },
      h('button', { onclick: () => go(i) }, h('span', { class: 'n' }, i + 1), h('span', { class: 't' }, s.title))))));
  const tabs = h('div', { class: 'seg' }, [['plan', P.plan?.label || 'Plan'], ['work', P.work?.label || 'Phases & tasks']].filter(([k]) => P[k]).map(([k, l]) =>
    h('button', { class: S.view === k ? 'on' : '', onclick: () => { S.view = k; S.step = 0; S.dir = 'fwd'; writeHash(); renderPlan(); } }, l)));
  const dev = h('div', { class: 'seg', title: 'Builder mode also shows the build detail' }, [['0', 'Stakeholder'], ['1', 'Builder']].map(([v, l]) =>
    h('button', { class: (S.dev ? '1' : '0') === v ? 'on' : '', onclick: () => { S.dev = v === '1'; store.set('wt-dev', v); renderPlan(); } }, l)));
  const top = h('div', { class: 'top' }, tabs, h('span', { class: 'sp' }), dev,
    h('button', { class: 'btn', onclick: () => { navigator.clipboard?.writeText(location.href); } }, 'Copy link'));
  const bar = h('div', { class: 'bar' }, h('i', { style: `width:${((S.step + 1) / steps.length) * 100}%` }));
  const stage = h('div', { class: `stage ${S.dir}` });
  stage.append(h('div', { class: 'sh', style: '--i:0' }, h('div', { class: 'kick' }, `${S.view === 'work' ? 'Phases & tasks' : 'Plan'} · step ${S.step + 1} of ${steps.length}`),
    h('h1', {}, st.title), st.goal ? h('p', { class: 'goal', html: mdi(st.goal) }) : null));
  const mm = [];
  (st.blocks || []).forEach((b, i) => {
    if (b.dev && !S.dev) return;
    const el = h('section', { class: 'blk' + (b.dev ? ' devonly' : ''), style: `--i:${i + 1}` });
    if (b.title && b.type !== 'ref') el.append(h('h4', {}, b.title));
    (R[b.type] || R.unknown)(b, el, mm);
    stage.append(el);
  });
  const foot = h('div', { class: 'foot' },
    h('button', { class: 'btn', disabled: S.step === 0, onclick: () => go(S.step - 1) }, '← Back'),
    h('span', { class: 'sp' }, h('kbd', {}, '←'), ' ', h('kbd', {}, '→'), ' to move'),
    S.step < steps.length - 1 ? h('button', { class: 'btn pri', onclick: () => go(S.step + 1) }, `Next: ${steps[S.step + 1].title} →`)
      : S.view === 'plan' && P.work ? h('button', { class: 'btn pri', onclick: () => { S.view = 'work'; S.step = 0; S.dir = 'fwd'; writeHash(); renderPlan(); } }, 'Phases & tasks →')
      : h('a', { class: 'btn', href: '#', style: 'text-decoration:none' }, 'Done · all plans'));
  $app.replaceChildren(h('div', { class: 'shell' }, rail, h('div', { class: 'main' }, top, bar, stage, foot)));
  window.scrollTo(0, 0);
  if (mm.length) mermaid.run({ nodes: mm }).catch((e) => console.warn('mermaid', e));
}
function go(i) { const n = stepsOf().length; if (i < 0 || i >= n || i === S.step) return; S.dir = i > S.step ? 'fwd' : 'back'; S.step = i; writeHash(); renderPlan(); }
addEventListener('keydown', (e) => { if (!S.id || /INPUT|TEXTAREA|IFRAME/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return; if (e.key === 'ArrowRight') go(S.step + 1); if (e.key === 'ArrowLeft') go(S.step - 1); });
addEventListener('hashchange', route);

/* ---------- block renderers ---------- */
const chips = (files) => files?.length ? h('div', { class: 'files' }, files.map((f) => typeof f === 'string' ? h('span', { class: 'file' }, f) : h('span', { class: 'file' }, f.name, f.note ? h('small', {}, ' · ' + f.note) : null))) : null;
const table = (head, rows) => h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, c)))),
  h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { html: mdi(c) })))))));

const R = {
  unknown: (b, el) => el.append(h('pre', {}, 'unknown block type: ' + b.type)),
  text: (b, el) => el.append(h('div', { class: 'prose', html: md(b.md) })),
  facts: (b, el) => el.append(h('div', { class: 'facts' }, b.items.map((f) => h('div', { class: 'fact' }, h('b', {}, f.k), h('span', { html: mdi(f.v) }))))),
  table: (b, el) => { el.append(table(b.head, b.rows)); if (b.caption) el.append(h('div', { class: 'cap' }, b.caption)); },
  files: (b, el) => el.append(chips(b.items)),
  checks: (b, el) => el.append(h('ul', { class: 'checks' }, b.items.map((t) => h('li', { onclick: (e) => e.currentTarget.classList.toggle('tick') }, h('span', { class: 'bx' }, '✓'), h('span', { html: mdi(t) }))))),
  cards: (b, el) => el.append(h('div', { class: 'cards' }, b.items.map((c) => {
    const d = h('details', { class: 'card' }, h('summary', {}, h('span', { class: 'ic' }, c.tag || '•'), h('span', {}, h('div', { class: 'ti' }, c.title), c.text ? h('div', { class: 'tx', html: mdi(c.text) }) : null), c.detail || c.files ? h('span', { class: 'more' }, '›') : null));
    if (c.detail || c.files) d.append(h('div', { class: 'body' }, c.detail ? h('div', { class: 'prose', html: md(c.detail) }) : null, chips(c.files)));
    else d.querySelector('summary').style.cursor = 'default';
    return d;
  }))),
  decisions: (b, el) => el.append(h('div', { class: 'dec' }, b.items.map((d) => h('details', {}, h('summary', {}, h('span', { class: 'id' }, d.id), h('span', { class: 'q', html: mdi(d.q) }), h('span', { class: 'chip ' + (d.state === 'open' ? 'warn' : 'ok') }, d.state)),
    h('div', { class: 'body' }, h('div', {}, h('b', {}, 'Our default: '), d.default), d.ifNo ? h('div', {}, h('b', {}, 'If you say no: '), d.ifNo) : null))))),
  tasks: (b, el) => el.append(...b.items.map((t) => h('details', { class: 'task' }, h('summary', {}, h('span', { class: 'id' }, t.id), h('span', { class: 'w', html: mdi(t.what) }), h('span', { class: 'avatar' }, t.owner || 'builder'), t.needs?.length ? h('span', { class: 'meta' }, 'needs ' + t.needs.join(', ')) : null),
    h('div', { class: 'body' }, t.detail ? h('div', { class: 'prose', html: md(t.detail) }) : null, chips(t.files), t.reads ? h('div', { class: 'meta' }, 'reads: ' + t.reads) : null)))),
  who: (b, el) => el.append(h('div', { class: 'who' }, b.items.map((w) => h('div', { class: 'fact' }, h('b', {}, w.name), h('span', { html: mdi(w.does) }), w.tasks ? h('div', { class: 'files' }, w.tasks.map((t) => h('span', { class: 'file' }, t))) : null)))),
  mermaid: (b, el, mm) => {
    const box = h('div', { class: 'mm' }); const div = h('div', { class: 'mermaid' }, b.code); const src = h('pre', { style: 'display:none' }, b.code);
    const tools = h('div', { class: 'tools' },
      h('button', { onclick: () => { const big = src.style.display === 'none'; src.style.display = big ? '' : 'none'; div.style.display = big ? 'none' : ''; } }, 'source'),
      h('button', { onclick: () => { const dlg = h('dialog', {}, h('button', { class: 'btn', onclick: () => dlg.close(), style: 'float:right' }, 'close'), div.cloneNode(true)); dlg.addEventListener('close', () => dlg.remove()); document.body.append(dlg); dlg.showModal(); } }, 'enlarge'));
    box.append(tools, div, src); el.append(box); if (b.caption) el.append(h('div', { class: 'cap' }, b.caption)); mm.push(div);
  },
  wireframe: (b, el) => {
    const url = new URL(b.src, S.base).href; const box = h('div', { class: 'wf' });
    const fr = h('iframe', { src: url, title: b.title || 'wireframe', style: b.height ? `height:${b.height}px` : '' });
    box.append(h('div', { class: 'bar2' }, h('b', {}, b.title || 'Wireframe'), h('span', { class: 'sp' }),
      h('button', { class: 'btn', onclick: (e) => { box.classList.toggle('phone'); e.target.textContent = box.classList.contains('phone') ? 'Desktop width' : 'Phone width (390)'; } }, 'Phone width (390)'),
      h('a', { href: url, target: '_blank', rel: 'noopener' }, 'open full')), h('div', { class: 'fr' }, fr));
    el.append(box); if (b.caption) el.append(h('div', { class: 'cap' }, b.caption));
  },
  flow: (b, el) => {
    let on = 0; const seen = new Set([0]);
    const ol = h('ol', {}), panel = h('div', { class: 'panel' }), ctl = h('div', { class: 'ctl' });
    const draw = (swap) => {
      ol.replaceChildren(...b.steps.map((s, i) => h('li', { class: i === on ? 'on' : seen.has(i) ? 'seen' : '' }, h('button', { onclick: () => { on = i; seen.add(i); draw(true); } }, h('span', { class: 'n' }, i + 1), s.title))));
      const s = b.steps[on]; panel.className = 'panel' + (swap ? ' swap' : ''); void panel.offsetWidth;
      ctl.replaceChildren(h('button', { class: 'btn', disabled: on === 0, onclick: () => { on--; draw(true); } }, '‹ Back'),
        h('button', { class: 'btn pri', disabled: on === b.steps.length - 1, onclick: () => { on++; seen.add(on); draw(true); } }, 'Next ›'), h('span', { class: 'pos' }, `${on + 1} / ${b.steps.length}`));
      panel.replaceChildren(h('h5', {}, s.title), h('div', { class: 'prose', html: md(s.text) }), s.see ? h('div', {}, h('b', {}, 'You see: '), s.see) : null, chips(s.files), ctl);
    };
    draw(false); el.append(h('div', { class: 'flow' }, ol, panel));
  },
  ref: (b, el) => {
    const d = h('details', { class: 'ref' }, h('summary', {}, h('b', {}, b.title || b.file), h('span', { class: 'src' }, b.file + (b.heading ? ' › ' + b.heading : '')), h('span', { class: 'more' }, '›')));
    let loaded = false;
    d.addEventListener('toggle', async () => {
      if (!d.open || loaded) return; loaded = true;
      const body = h('div', { class: 'body prose' }, 'loading…'); d.append(body);
      try { const raw = await getText(new URL(b.file, S.base).href); body.innerHTML = /\.json$/i.test(b.file) ? md('```json\n' + raw + '\n```') : md(slice(raw, b.heading, S.dev)); body.querySelectorAll('img').forEach((i) => i.remove()); }
      catch (e) { body.textContent = String(e); }
    });
    if (b.open) { d.open = true; }
    el.append(d);
  },
};
/* a section = from "## heading" to the next heading of the same or higher level; dev blocks only in Builder mode */
function slice(text, heading, dev) {
  text = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  text = dev ? text.replace(/<!--\s*\/?dev\s*-->/g, '') : text.replace(/<!--\s*dev\s*-->[\s\S]*?<!--\s*\/dev\s*-->/g, '');
  if (!heading) return text;
  const lines = text.split('\n'); let i = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim().toLowerCase().startsWith(heading.toLowerCase()));
  if (i < 0) return `*(section "${heading}" not found)*`;
  const lvl = lines[i].match(/^#+/)[0].length; let j = i + 1;
  while (j < lines.length && !(/^#{1,6}\s/.test(lines[j]) && lines[j].match(/^#+/)[0].length <= lvl)) j++;
  return lines.slice(i + 1, j).join('\n');
}

(async () => {
  try { S.registry = (await getJSON('plans.json')).plans; } catch (e) { $app.textContent = 'plans.json: ' + e; return; }
  route();
})();
})();
