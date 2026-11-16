# AgentDeck: prototype contract
No build, no npm. Vue 3 from a CDN. `index.html` is DONE: do not edit it, `css/kit.css` or `js/kit.js`.

## Screens (one file each; the owner edits ONLY its file and its `css/pages-<file>.css`)
| route | screen | file | owner |
|---|---|---|---|
| #/home | Screens.Home | js/screens/part-N.js | main |
| #/toolkits | Screens.Toolkits | js/screens/part-N.js | main |
| #/auth-configs | Screens.AuthConfigs | js/screens/part-N.js | main |
| #/connected-accounts | Screens.ConnectedAccounts | js/screens/part-N.js | main |
| #/triggers | Screens.Triggers | js/screens/part-N.js | main |
| #/playground | Screens.Playground | js/screens/part-N.js | build |
| #/logs | Screens.Logs | js/screens/part-N.js | build |
| #/settings | Screens.Settings | js/screens/part-N.js | main |
| #/api-keys | Screens.ApiKeys | js/screens/part-N.js | main |
| #/docs | Screens.Docs | js/screens/part-N.js | main |

Replace every stub (it says "TODO"). Detail views live in the SAME screen: route `#/apps/42` shows `Screens.Apps` with `this.$route.parts = ['apps','42']`; branch on it in the template (`v-if="$route.parts[1]"`). Link with `<a href="#/apps/42">` or `$go('/apps/42')`; `$toast('Saved')` shows a toast.

## Rules for every screen (a corporate, finished look)
- A screen: `Screens.Name = { template: `...`, data() { return {...} }, computed, methods }`. Mock data goes INSIDE your file (believable names, numbers, dates, statuses; 8-15 rows; never lorem ipsum, never "TODO" or "coming soon").
- Start with `<div class="page-header"><div><h1>Title</h1><p>One line of purpose</p></div><div class="page-actions">buttons</div></div>`. Then a `.toolbar` (search, filters), then the content. Every list: a search or filter that really filters, an empty state, a row that opens the detail view. Every button does something (opens `ui-modal`/`ui-drawer`, toasts, navigates). Forms validate (`.field-error`).
- Only kit classes below; no inline `style=`; a class you need beyond the kit goes in YOUR `css/pages-<file>.css`. `proto_check` lists classes defined nowhere.

## Design kit (classes)
layout `.page-header .page-actions .toolbar .filter-bar .spacer .stack .row .right .grid-2 .grid-3 .grid-4 .card-grid .divider` · surfaces `.card .card-header .card-body .card-footer .stat(.label .value .delta.up|.down) (a complete card by itself: never wrap it in .card)` · table `.table-wrap > table.table` (`th.num td.num`, `tr.row-link`) `.pagination` · buttons `.btn .btn-primary .btn-ghost .btn-danger .btn-sm` · forms `.form .form-field(label, .input|.select|.textarea) .form-hint .field-error .form-actions .switch` · `.badge .badge-success|warning|danger|info|neutral` · `.tabs > button.tab(.active)` · `.kv` (dl: dt/dd) · `.code` · `.chip` · `.bars > i` (set `:style="{height: n+'%'}"`, the only inline style allowed) · `.steps > .step(.active|.done)` · `.skeleton` · `.muted .mono .num`.
Components: `<ui-badge status="Active">` (colour from the word), `<ui-modal title="..." @close="open=false">body<template #footer>buttons</template></ui-modal>`, `<ui-drawer ...>` (same), `<ui-empty title text><button class="btn">Action</button></ui-empty>`, `<ui-icon name="plus">` (home grid list users key settings chart bell mail play link shield file plus search box code card x check).
Example table: `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Status</th><th class="num">Calls</th></tr></thead><tbody><tr v-for="r in rows" :key="r.id" class="row-link" @click="$go('/apps/'+r.id)"><td>{{ r.name }}</td><td><ui-badge :status="r.status"></ui-badge></td><td class="num">{{ r.calls }}</td></tr></tbody></table></div>`
