/* SITE KIT runtime: header (sticky, mobile menu, theme toggle), footer, hash router (multi-page, with sub-routes such as #/blog/<slug>), theme detection, scroll-reveal.
   Needs Vue 3 (CDN) first. DO NOT EDIT in a prototype. Pages: `Screens.Home = { template: `...` }`.
   In a page: this.$route.parts (['blog','my-post']), this.$go('/blog'), this.$theme.mode ('light'|'dark'), this.$toast('Saved'). Give elements class "reveal" (+ d1..d4) for a scroll animation. */
(function () {
  var V = Vue, pascal = function (s) { return String(s).replace(/(^|[-_ ])(\w)/g, function (_, a, c) { return c.toUpperCase(); }); };
  var ICONS = { arrow: 'M5 12h14M13 6l6 6-6 6', bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', bolt: 'M13 2L3 14h9l-1 8 10-12h-9z', chart: 'M3 3v18h18M7 14l4-4 3 3 5-6', check: 'M20 6L9 17l-5-5', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', code: 'M16 18l6-6-6-6M8 6l-6 6 6 6', cloud: 'M18 10a6 6 0 0 0-11.7-1.5A4.5 4.5 0 0 0 7 18h11a4 4 0 0 0 0-8z', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20', heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6', moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', play: 'M5 3l14 9-14 9z', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', star: 'M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z', sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4', users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8', menu: 'M3 6h18M3 12h18M3 18h18', x: 'M18 6L6 18M6 6l12 12', zap: 'M13 2L3 14h9l-1 8 10-12h-9z', layers: 'M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5', target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' };
  var parse = function () { var raw = location.hash.replace(/^#\/?/, ''), p = raw.split('?'), parts = p[0].split('/').filter(Boolean), q = {}; new URLSearchParams(p[1] || '').forEach(function (v, k) { q[k] = v; }); return { parts: parts, path: '/' + parts.join('/'), query: q }; };
  var route = V.reactive(parse()), toasts = V.reactive([]), saved = null;
  try { saved = localStorage.getItem('site-theme'); } catch (e) { saved = null; }
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var theme = V.reactive({ mode: saved || (mq && mq.matches ? 'dark' : 'light'), detected: mq && mq.matches ? 'dark' : 'light', chosen: !!saved });
  var applyTheme = function () { document.documentElement.setAttribute('data-theme', theme.mode); };
  applyTheme();
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { theme.detected = e.matches ? 'dark' : 'light'; if (!theme.chosen) { theme.mode = theme.detected; applyTheme(); } });
  var reveal = function () {
    var els = document.querySelectorAll('.reveal:not(.in)'); if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () { document.querySelectorAll('.reveal:not(.in)').forEach(function (e) { var r = e.getBoundingClientRect(); if (r.top < innerHeight * 1.2) e.classList.add('in'); }); }, 1800);   // never leave content invisible (print, screenshots, no scroll event)
  };
  window.addEventListener('hashchange', function () { Object.assign(route, parse()); window.scrollTo(0, 0); });
  var Site = window.Site = {
    route: route, theme: theme, go: function (p) { location.hash = '#' + (p.charAt(0) === '/' ? p : '/' + p); },
    toast: function (m) { var t = { id: Math.random(), msg: m }; toasts.push(t); setTimeout(function () { var i = toasts.indexOf(t); if (i > -1) toasts.splice(i, 1); }, 2600); },
    setTheme: function (m) { theme.mode = m; theme.chosen = true; try { localStorage.setItem('site-theme', m); } catch (e) { /* private mode */ } applyTheme(); },
    mount: function (cfg) {
      var nav = cfg.nav || [], ids = (cfg.routes || nav.map(function (n) { return n.id; })), home = cfg.home || ids[0] || 'home';
      var href = function (to) { return /^(https?:|mailto:|tel:)/.test(to) ? to : '#/' + to.replace(/^#?\/?/, ''); };
      (cfg.footer || []).forEach(function (c) { c.links.forEach(function (l) { if (!/^(https?:|mailto:|tel:)/.test(l.to) && ids.indexOf(l.to.replace(/^#?\/?/, '').split('/')[0]) < 0) console.error('Error: footer link "' + l.label + '" goes to unknown route ' + l.to); }); });
      var app = V.createApp({
        data: function () { return { cfg: cfg, nav: nav, route: route, theme: theme, toasts: toasts, open: false, scrolled: false, year: new Date().getFullYear() }; },
        computed: {
          current: function () { return this.route.parts[0] || home; },
          view: function () { return window.Screens && window.Screens[pascal(this.current)] || { template: '<section class="section"><div class="container center"><h1>Page not found</h1><p class="muted">There is no page for this address.</p><p><a class="btn btn-primary" href="#/">Back to home</a></p></div></section>' }; }
        },
        methods: { href: href, isActive: function (n) { return this.current === n.id; }, toggle: function () { Site.setTheme(theme.mode === 'dark' ? 'light' : 'dark'); } },
        watch: { 'route.path': function () { this.open = false; V.nextTick(reveal); } },
        mounted: function () { var self = this, on = function () { self.scrolled = window.scrollY > 8; }; window.addEventListener('scroll', on, { passive: true }); on(); V.nextTick(reveal); },
        template: '<div :class="{\'nav-open\': open}"><header class="site-header" :class="{scrolled: scrolled}"><div class="container header-inner">' +
          '<a class="brand" href="#/"><span class="brand-mark">{{ cfg.mark || cfg.title.charAt(0) }}</span>{{ cfg.title }}</a>' +
          '<nav class="nav" aria-label="Main"><a v-for="n in nav" :key="n.id" :href="\'#/\' + n.id" :class="{active: isActive(n)}">{{ n.label }}<span class="nav-badge" v-if="n.badge">{{ n.badge }}</span></a></nav>' +
          '<div class="header-actions"><button class="icon-btn" @click="toggle" :aria-label="\'Switch to \' + (theme.mode === \'dark\' ? \'light\' : \'dark\') + \' theme\'" :title="\'Theme: \' + theme.mode + (theme.chosen ? \'\' : \' (detected)\')"><ui-icon :name="theme.mode === \'dark\' ? \'sun\' : \'moon\'"></ui-icon></button>' +
          '<a v-if="cfg.cta" class="btn btn-primary btn-sm" :href="href(cfg.cta.to)">{{ cfg.cta.label }}</a><button class="icon-btn menu-btn" @click="open = !open" aria-label="Menu"><ui-icon :name="open ? \'x\' : \'menu\'"></ui-icon></button></div></div></header>' +
          '<main class="page" :key="route.path"><component :is="view"></component></main>' +
          '<footer class="site-footer"><div class="container"><div class="footer-cols"><div><a class="brand" href="#/"><span class="brand-mark">{{ cfg.mark || cfg.title.charAt(0) }}</span>{{ cfg.title }}</a><p class="muted" style="margin-top:12px;max-width:300px">{{ cfg.tagline }}</p></div>' +
          '<div v-for="c in cfg.footer" :key="c.title"><h4>{{ c.title }}</h4><a v-for="l in c.links" :key="l.label" :href="href(l.to)">{{ l.label }}</a></div></div>' +
          '<div class="footer-bottom"><span>&copy; {{ year }} {{ cfg.title }}. All rights reserved.</span><span>Theme: {{ theme.mode }}{{ theme.chosen ? "" : " (detected from your system)" }}</span></div></div></footer>' +
          '<div style="position:fixed;right:20px;bottom:20px;display:grid;gap:8px;z-index:60"><div v-for="t in toasts" :key="t.id" class="card" style="padding:12px 16px">{{ t.msg }}</div></div></div>'
      });
      app.config.globalProperties.$route = route; app.config.globalProperties.$go = Site.go; app.config.globalProperties.$toast = Site.toast; app.config.globalProperties.$theme = theme;
      app.component('ui-icon', { props: ['name'], computed: { d: function () { return ICONS[this.name] || ICONS.arrow; } }, template: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="d"></path></svg>' });
      Object.keys(window.Components || {}).forEach(function (n) { app.component(n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(), window.Components[n]); });
      app.mount(cfg.el || '#app'); return app;
    }
  };
})();
