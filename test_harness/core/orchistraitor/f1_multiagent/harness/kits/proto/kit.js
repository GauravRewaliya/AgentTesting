/* PROTO KIT runtime: app shell (sidebar, topbar, breadcrumb), hash router, toast, modal, drawer, badge, icon. Needs Vue 3 (CDN) loaded first.
   Copied into every prototype by `proto_init`. DO NOT EDIT in a prototype. Screens: `Screens.Apps = { template: `...`, data() {...} }`.
   In a screen: this.$route.parts (['apps','42'] for #/apps/42), this.$route.query, this.$go('/apps/42'), this.$toast('Saved'). */
(function () {
  var V = Vue, pascal = function (s) { return String(s).replace(/(^|[-_ ])(\w)/g, function (_, a, c) { return c.toUpperCase(); }); };
  var ICONS = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
    key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    chart: 'M3 3v18h18M7 14l4-4 3 3 5-6', bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    play: 'M5 3l14 9-14 9z', link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', plus: 'M12 5v14M5 12h14', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', code: 'M16 18l6-6-6-6M8 6l-6 6 6 6', card: 'M2 5h20v14H2zM2 10h20', dot: 'M12 12h.01', x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5'
  };
  var parse = function () {
    var raw = location.hash.replace(/^#\/?/, ''), p = raw.split('?'), parts = p[0].split('/').filter(Boolean), q = {};
    new URLSearchParams(p[1] || '').forEach(function (v, k) { q[k] = v; });
    return { parts: parts, path: '/' + parts.join('/'), query: q };
  };
  var route = V.reactive(parse()), toasts = V.reactive([]);
  window.addEventListener('hashchange', function () { Object.assign(route, parse()); window.scrollTo(0, 0); });
  var Kit = window.Kit = {
    route: route,
    go: function (p) { location.hash = '#' + (p.charAt(0) === '/' ? p : '/' + p); },
    toast: function (msg, kind) { var t = { id: Math.random(), msg: msg, kind: kind || 'success' }; toasts.push(t); setTimeout(function () { var i = toasts.indexOf(t); if (i > -1) toasts.splice(i, 1); }, 2800); },
    mount: function (cfg) {
      var items = cfg.nav || [], home = cfg.home || (items[0] && items[0].id) || 'home', groups = [];
      items.forEach(function (i) { var g = groups.filter(function (x) { return x.name === (i.group || ''); })[0]; if (!g) groups.push(g = { name: i.group || '', items: [] }); g.items.push(i); });
      var app = V.createApp({
        data: function () { return { cfg: cfg, groups: groups, open: false, route: route, toasts: toasts, items: items }; },
        computed: {
          current: function () { var id = route.parts[0] || home; return this.items.filter(function (i) { return i.id === id; })[0] || { id: id, label: pascal(id) }; },
          view: function () { return window.Screens && window.Screens[pascal(this.current.id)] || { template: '<div class="card"><div class="empty-state"><h3>Screen not found</h3><p>No screen is defined for this route.</p></div></div>' }; }
        },
        watch: { 'route.path': function () { this.open = false; } },
        methods: { active: function (i) { return this.current.id === i.id; } },
        template: '<div class="app" :class="{\'nav-open\': open}">' +
          '<aside class="sidebar"><div class="brand"><span class="brand-mark">{{ cfg.mark || cfg.title.charAt(0) }}</span>{{ cfg.title }}</div><nav>' +
          '<template v-for="g in groups"><div class="nav-group" v-if="g.name">{{ g.name }}</div>' +
          '<a v-for="i in g.items" :key="i.id" class="nav-item" :class="{active: active(i)}" :href="\'#/\' + i.id"><ui-icon :name="i.icon || \'dot\'"></ui-icon>{{ i.label }}</a></template></nav>' +
          '<div class="sidebar-foot"><div class="avatar">{{ (cfg.user || \'Alex Morgan\').split(\' \').map(function (w) { return w[0]; }).join(\'\') }}</div><div>{{ cfg.user || \'Alex Morgan\' }}<br>{{ cfg.org || \'Workspace\' }}</div></div></aside>' +
          '<div class="main"><header class="topbar"><button class="btn btn-ghost menu-btn" @click="open = !open" aria-label="Menu"><ui-icon name="list"></ui-icon></button>' +
          '<div class="breadcrumb"><span>{{ cfg.title }}</span><span>/</span><b>{{ current.label }}</b><template v-if="route.parts[1]"><span>/</span><b>{{ route.parts[1] }}</b></template></div>' +
          '<input class="input search" placeholder="Search..." @keyup.enter="$toast(\'Search is not part of this prototype\', \'error\')"><div class="avatar">{{ (cfg.user || \'Alex Morgan\').split(\' \').map(function (w) { return w[0]; }).join(\'\') }}</div></header>' +
          '<main class="content"><component :is="view" :key="current.id"></component></main></div>' +
          '<div class="toast-stack"><div v-for="t in toasts" :key="t.id" class="toast" :class="\'toast-\' + t.kind">{{ t.msg }}</div></div></div>'
      });
      app.config.globalProperties.$route = route; app.config.globalProperties.$go = Kit.go; app.config.globalProperties.$toast = Kit.toast;
      app.component('ui-icon', { props: ['name'], computed: { d: function () { return ICONS[this.name] || ICONS.dot; } }, template: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="d"></path></svg>' });
      app.component('ui-badge', { props: ['status'], computed: { kind: function () { var s = String(this.status || '').toLowerCase(); return /^(active|success|ok|healthy|paid|done|connected|live|enabled|completed|200|2\d\d)$/.test(s) ? 'success' : /^(pending|warning|invited|trial|paused|queued|running|draft|4\d\d)$/.test(s) ? 'warning' : /^(failed|error|danger|expired|revoked|disabled|blocked|overdue|5\d\d)$/.test(s) ? 'danger' : /^(info|new|beta)$/.test(s) ? 'info' : 'neutral'; } }, template: '<span class="badge" :class="\'badge-\' + kind"><slot>{{ status }}</slot></span>' });
      app.component('ui-modal', { props: ['title'], emits: ['close'], template: '<div class="overlay" @click.self="$emit(\'close\')"><div class="modal" role="dialog"><div class="modal-header"><h2>{{ title }}</h2><button class="btn btn-ghost btn-sm" @click="$emit(\'close\')" aria-label="Close"><ui-icon name="x"></ui-icon></button></div><div class="modal-body"><slot></slot></div><div class="modal-footer"><slot name="footer"></slot></div></div></div>' });
      app.component('ui-drawer', { props: ['title'], emits: ['close'], template: '<div class="drawer-wrap" @click.self="$emit(\'close\')"><aside class="drawer"><div class="modal-header"><h2>{{ title }}</h2><button class="btn btn-ghost btn-sm" @click="$emit(\'close\')" aria-label="Close"><ui-icon name="x"></ui-icon></button></div><div class="modal-body"><slot></slot></div><div class="modal-footer"><slot name="footer"></slot></div></aside></div>' });
      app.component('ui-empty', { props: ['title', 'text'], template: '<div class="empty-state"><h3>{{ title }}</h3><p>{{ text }}</p><slot></slot></div>' });
      Object.keys(window.Components || {}).forEach(function (n) { app.component(n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(), window.Components[n]); });
      app.mount(cfg.el || '#app'); return app;
    }
  };
})();
