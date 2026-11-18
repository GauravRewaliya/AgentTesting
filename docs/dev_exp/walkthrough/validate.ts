// Free check (no model calls): every plans.json entry has a walkthrough.json whose block types, ref files,
// ref headings, wireframes and file chips exist. Run: bun docs/dev_exp/walkthrough/validate.ts
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const here = dirname(new URL(import.meta.url).pathname)
const TYPES = new Set(['text', 'facts', 'table', 'files', 'checks', 'cards', 'decisions', 'tasks', 'who', 'mermaid', 'wireframe', 'flow', 'ref'])
const errs: string[] = []
const bad = (m: string) => errs.push(m)

const plans = JSON.parse(readFileSync(join(here, 'plans.json'), 'utf8')).plans as { id: string; base: string }[]
for (const p of plans) {
  const base = resolve(here, p.base), file = join(base, 'walkthrough.json')
  if (!existsSync(file)) { bad(`${p.id}: missing ${file}`); continue }
  const w = JSON.parse(readFileSync(file, 'utf8'))
  for (const view of ['plan', 'work']) {
    const steps = w[view]?.steps
    if (!steps?.length) { bad(`${p.id}.${view}: no steps`); continue }
    const ids = new Set<string>()
    steps.forEach((s: any, i: number) => {
      const at = `${p.id}.${view}[${i}] ${s.title ?? '?'}`
      if (!s.title || !s.goal) bad(`${at}: needs title and goal`)
      if (ids.has(s.id)) bad(`${at}: duplicate id ${s.id}`); ids.add(s.id)
      for (const b of s.blocks ?? []) {
        if (!TYPES.has(b.type)) { bad(`${at}: unknown block type ${b.type}`); continue }
        if (b.type === 'ref') {
          const f = join(base, b.file)
          if (!existsSync(f)) { bad(`${at}: ref file ${b.file} missing`); continue }
          if (b.heading && !readFileSync(f, 'utf8').split('\n').some((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim().toLowerCase().startsWith(b.heading.toLowerCase()))) bad(`${at}: heading "${b.heading}" not in ${b.file}`)
        }
        if (b.type === 'wireframe' && !existsSync(join(base, b.src))) bad(`${at}: wireframe ${b.src} missing`)
        if (b.type === 'cards') for (const c of b.items) for (const f of c.files ?? []) if (/\.(md|html|json)$/.test(f) && !existsSync(join(base, f))) bad(`${at}: card file ${f} missing`)
        if (b.type === 'mermaid' && !/^(flowchart|sequenceDiagram|stateDiagram|erDiagram|gantt|classDiagram|graph)/.test(b.code.trim())) bad(`${at}: mermaid code does not start with a diagram keyword`)
      }
    })
  }
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1) }
console.log(`walkthroughs ok: ${plans.length} plans`)
