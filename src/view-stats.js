/* Wardrobe — stats: what gets worn, what doesn't, and what it all cost. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const M = L.model;
  const K = L.colour;
  const V = (L.views = L.views || {});

  const bar = (label, n, max, extra, swatch) =>
    h(
      'div.wbar-row',
      h('span.wbar-label', swatch ? h('span.swatch', { style: { background: swatch } }) : null, label),
      h('span.wbar-track', h('span.wbar-fill', { style: { width: (max ? Math.round((100 * n) / max) : 0) + '%' } })),
      h('span.wbar-val', extra != null ? extra : String(n))
    );
  const row = (it, right) => h('button.stat-row', { type: 'button', onclick: () => R.go('item', it.id) }, UI.pic(it.thumb || it.image, '', 'day-pic'), h('span.day-name', it.name), h('span.stat-right', right));

  V.stats = {
    render(root) {
      const items = D.list('items').filter((i) => i.status !== 'archived');
      const outfits = D.list('outfits');
      const wears = M.wearMap();
      const today = U.todayKey();
      const month = today.slice(0, 7);
      const daysThisMonth = D.list('days').filter((d) => d.id.startsWith(month) && d.id <= today && ((d.items || []).length || (d.outfits || []).length)).length;
      const value = items.reduce((a, it) => a + (Number(it.price) || 0), 0);
      root.appendChild(h('div.page-head', h('h1.page-title', 'Stats')));
      if (!items.length) {
        root.appendChild(UI.empty('Nothing to count yet', 'Once you have added clothes and logged a few days, this page shows what you really wear.', UI.btn('Add an item', () => R.go('edit', 'new'), { kind: 'primary', icon: 'camera' })));
        return;
      }
      root.appendChild(
        h(
          'div.stats.four',
          h('div.stat', h('span.stat-value', String(items.length)), h('span.stat-label', 'items')),
          h('div.stat', h('span.stat-value', String(outfits.length)), h('span.stat-label', 'outfits')),
          h('div.stat', h('span.stat-value', value ? M.money(Math.round(value)) : '–'), h('span.stat-label', 'closet value')),
          h('div.stat', h('span.stat-value', String(daysThisMonth)), h('span.stat-label', 'days logged this month'))
        )
      );

      const worn = items.map((it) => ({ it, w: wears.get(it.id) || { count: 0, last: null } }));
      const most = worn.filter((x) => x.w.count > 0).sort((a, b) => b.w.count - a.w.count).slice(0, 5);
      if (most.length) root.appendChild(h('div.card', UI.sectionHead('Most worn'), h('div.stat-list', most.map((x) => row(x.it, U.plural(x.w.count, 'wear'))))));

      const forgotten = worn.filter((x) => !x.w.last || M.daysSince(x.w.last) >= 90).sort((a, b) => (a.w.last || '') < (b.w.last || '') ? -1 : 1);
      root.appendChild(
        h(
          'div.card',
          UI.sectionHead('Not worn in 90 days', h('span.list-count', String(forgotten.length))),
          forgotten.length
            ? h('div.stat-list', forgotten.slice(0, 6).map((x) => row(x.it, x.w.last ? U.relDay(U.parseDay(x.w.last)) : 'never')))
            : h('p.muted', 'Everything has had an outing recently.'),
          forgotten.length > 6
            ? UI.btn('See all ' + forgotten.length, () => {
                Object.assign(L.drafts.closet || (L.drafts.closet = {}), { q: '', cat: 'all', sort: 'least', unworn: true, never: false, colour: '', season: '', occasion: '', favourites: false });
                R.go('closet');
              }, { small: true, kind: 'ghost' })
            : null
        )
      );

      const priced = worn.filter((x) => Number(x.it.price) > 0).map((x) => Object.assign(x, { cpw: M.costPerWear(x.it, x.w.count) }));
      if (priced.length) {
        const best = priced.slice().sort((a, b) => a.cpw - b.cpw).slice(0, 3);
        const worst = priced
          .slice()
          .sort((a, b) => b.cpw - a.cpw)
          .filter((x) => !best.includes(x))
          .slice(0, 3);
        root.appendChild(
          h(
            'div.card',
            UI.sectionHead('Cost per wear'),
            h('p.muted', 'Price divided by the number of times worn. Unworn items count as one wear.'),
            h('h3.mini-title', 'Best value'),
            h('div.stat-list', best.map((x) => row(x.it, M.money(Math.round(x.cpw * 100) / 100) + ' · ' + U.plural(x.w.count, 'wear')))),
            worst.length ? h('h3.mini-title', 'Yet to earn their keep') : null,
            worst.length ? h('div.stat-list', worst.map((x) => row(x.it, M.money(Math.round(x.cpw * 100) / 100) + ' · ' + U.plural(x.w.count, 'wear')))) : null
          )
        );
      }

      const byCat = M.CATEGORIES.map((c) => ({ c, n: items.filter((i) => i.category === c.v).length })).filter((x) => x.n);
      const maxCat = Math.max(...byCat.map((x) => x.n));
      root.appendChild(h('div.card', UI.sectionHead('By category'), h('div.wbars', byCat.map((x) => bar(x.c.label, x.n, maxCat)))));

      const colours = new Map();
      for (const it of items) for (const c of (it.colours || []).slice(0, 1)) colours.set(c.name, (colours.get(c.name) || 0) + 1);
      const byColour = [...colours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (byColour.length) root.appendChild(h('div.card', UI.sectionHead('Main colours'), h('div.wbars', byColour.map(([name, n]) => bar(name, n, byColour[0][1], null, K.hexOfName(name))))));
    }
  };
})((window.Wardrobe = window.Wardrobe || {}));
