/* Wardrobe — app shell: boot, tabs, welcome, offline support. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const V = (L.views = L.views || {});
  L.VERSION = '1.0.0';

  const TABS = [
    { name: 'closet', label: 'Closet', icon: 'hanger', also: ['item', 'edit'] },
    { name: 'outfits', label: 'Outfits', icon: 'layers', also: ['outfit'] },
    { name: 'plus', label: 'Add', icon: 'plus', plus: true },
    { name: 'calendar', label: 'Calendar', icon: 'calendar' },
    { name: 'stats', label: 'Stats', icon: 'insights', also: ['more'] }
  ];
  const App = (L.app = { started: false, els: {}, currentView: null });

  App.applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    try {
      localStorage.setItem('wardrobe.theme', theme || 'system');
    } catch (e) {
      /* optional */
    }
  };

  function buildShell() {
    const mount = document.getElementById('app');
    UI.clear(mount);
    const tabs = h(
      'nav.tabs',
      { 'aria-label': 'Main' },
      h('div.rail-brand', UI.logo(34), h('span.brand-name', 'Wardrobe')),
      TABS.map((t) =>
        t.plus
          ? h('button.tab.tab-plus', { type: 'button', 'aria-label': 'Add clothing, an outfit, or today’s look', onclick: () => V.plusMenu() }, h('span.plus-bubble', UI.icon('plus')))
          : h('button.tab', { type: 'button', 'data-tab': t.name, onclick: () => R.go(t.name) }, UI.icon(t.icon), h('span.tab-label', t.label))
      )
    );
    const main = h('main#main', { tabindex: '-1' });
    const shell = h(
      'div.shell',
      h('header.topbar', h('button.brand', { type: 'button', onclick: () => R.go('closet') }, UI.logo(28), h('span.brand-name', 'Wardrobe')), h('div.topbar-right', UI.iconBtn('settings', 'More', () => R.go('more'), { cls: 'topbar-btn' }))),
      tabs,
      main
    );
    mount.appendChild(shell);
    mount.appendChild(h('div#layer'));
    mount.appendChild(h('div#toasts', { 'aria-live': 'polite' }));
    App.els = { shell, tabs, main };
  }

  function updateTabs(name) {
    for (const b of App.els.tabs.querySelectorAll('[data-tab]')) {
      const t = TABS.find((x) => x.name === b.dataset.tab);
      if (b.dataset.tab === name || (t && t.also && t.also.includes(name))) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  }

  App.render = (opts) => {
    opts = opts || {};
    if (!App.started) return;
    const main = App.els.main;
    const isView = (n) => !!V[n] && typeof V[n].render === 'function';
    if (R.current.name === 'welcome' && D.prefs().onboarded) R.current = { name: 'closet', arg: null };
    if (!isView(R.current.name)) R.current = { name: 'closet', arg: null };
    const view = V[R.current.name];
    const active = document.activeElement;
    const keep = !opts.nav && active && active.id && main.contains(active) ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
    const y = window.scrollY;
    UI.clear(main);
    App.els.shell.classList.toggle('bare', R.current.name === 'welcome');
    if (D.mode() === 'memory') main.appendChild(h('div.banner.banner-warn', { role: 'alert' }, 'This browser won’t let Wardrobe save anything, so your items will be lost when you close it. Try Safari or Chrome.'));
    const c = h('div.view.view-' + R.current.name);
    main.appendChild(c);
    try {
      view.render(c, R.current.arg);
    } catch (e) {
      console.error(e);
      c.appendChild(h('div.card', h('h2.card-title', 'Something went wrong on this page.'), h('pre.error-text', String((e && e.message) || e)), UI.btn('Go to Closet', () => R.go('closet'))));
    }
    App.currentView = view;
    updateTabs(R.current.name);
    if (opts.nav) window.scrollTo(0, 0);
    else {
      window.scrollTo(0, y);
      if (keep) {
        const el = document.getElementById(keep.id);
        if (el) {
          el.focus({ preventScroll: true });
          try {
            if (keep.start != null) el.setSelectionRange(keep.start, keep.end);
          } catch (e) {
            /* not text */
          }
        }
      }
    }
  };
  App.scheduleRender = () => {
    if (App._raf) return;
    App._raf = requestAnimationFrame(() => {
      App._raf = null;
      App.render();
    });
  };

  V.welcome = {
    live: false,
    render(root) {
      root.appendChild(
        h(
          'div.welcome',
          h('div.welcome-mark', UI.logo(88)),
          h('h1.welcome-title', 'Wardrobe'),
          h('p.welcome-lead', 'Your clothes, photographed and cut out, so you can see everything you own, put outfits together and notice what you actually wear.'),
          h('ul.welcome-points', [
            ['camera', 'Photograph each piece on a plain background'],
            ['wand', 'The background is removed for you'],
            ['layers', 'Build outfits by moving the pieces about'],
            ['calendar', 'Log what you wore, and see cost per wear']
          ].map(([ic, t]) => h('li', UI.icon(ic), h('span', t)))),
          h('p.fineprint', 'Everything stays on your phone. Nothing is uploaded anywhere.'),
          h('div.actions.center', UI.btn('Open my wardrobe', async () => {
            await D.setPrefs({ onboarded: true });
            D.persist();
            R.go('closet', null, { replace: true });
          }, { kind: 'primary', id: 'onb-start' }))
        )
      );
    }
  };

  App.enter = () => {
    if (!D.prefs().onboarded) {
      R.current = { name: 'welcome', arg: null };
      R.stack = [];
    }
    App.render({ nav: true });
  };

  App.boot = async () => {
    let theme = 'system';
    try {
      theme = localStorage.getItem('wardrobe.theme') || 'system';
    } catch (e) {
      /* optional */
    }
    App.applyTheme(theme);
    buildShell();
    App.els.shell.classList.add('bare');
    App.els.main.appendChild(h('div.loading', h('div.loading-mark', UI.logo(64)), h('p', 'Opening your wardrobe…')));
    R.start();
    D.on((what) => {
      if (!App.started) return;
      if (App.currentView && App.currentView.live === false) return;
      if (document.querySelector('.sheet-wrap')) {
        App._pending = true;
        return;
      }
      App.scheduleRender();
    });
    try {
      await D.open();
      App.started = true;
      App.applyTheme(D.prefs().theme || theme);
      App.enter();
    } catch (e) {
      console.error(e);
      UI.clear(App.els.main);
      App.els.main.appendChild(h('div.loading', h('h1', 'Wardrobe couldn’t open'), h('pre.error-text', String((e && e.message) || e))));
      return;
    }
    new MutationObserver(() => {
      if (App._pending && !document.querySelector('.sheet-wrap')) {
        App._pending = false;
        App.scheduleRender();
      }
    }).observe(document.getElementById('layer'), { childList: true });
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
      const hadWorker = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Wardrobe: offline support unavailable', e));
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadWorker) UI.toast('Wardrobe has been updated. The new version is ready the next time you open it.');
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})((window.Wardrobe = window.Wardrobe || {}));
