/* Wardrobe — the closet: every item, searchable and filterable. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const M = L.model;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  V.itemCard = (it, onclick) =>
    h(
      'button.item-card',
      { type: 'button', onclick: onclick || (() => R.go('item', it.id)), 'aria-label': it.name },
      h('div.item-pic', UI.pic(it.thumb || it.image, ''), it.favourite ? h('span.item-fav', UI.icon('star-on')) : null),
      h('div.item-card-name', it.name)
    );

  V.closet = {
    render(root) {
      const st = drafts.closet || (drafts.closet = { q: '', cat: 'all', sort: 'newest', colour: '', season: '', occasion: '', favourites: false, unworn: false, never: false });
      const all = D.list('items').filter((i) => i.status !== 'archived');
      const shown = M.filter(M.search(all, st.q), st);
      const active = M.activeFilters(st);
      const counts = {};
      for (const it of all) counts[it.category] = (counts[it.category] || 0) + 1;

      root.appendChild(
        h(
          'div.page-head',
          h('h1.page-title', 'Closet'),
          h('span.list-count', U.plural(all.length, 'item'))
        )
      );
      if (!all.length) {
        root.appendChild(
          UI.empty(
            'Your closet is empty',
            'Photograph each piece against a plain background, like a bed sheet or a wall, and Wardrobe cuts it out for you.',
            UI.btn('Add your first item', () => R.go('edit', 'new'), { kind: 'primary', icon: 'camera', id: 'closet-first' })
          )
        );
        return;
      }
      const input = h('input.input.search-input#closet-q', {
        type: 'search',
        placeholder: 'Search by name, brand, colour…',
        'aria-label': 'Search your closet',
        value: st.q,
        autocomplete: 'off',
        oninput: U.debounce((e) => {
          st.q = e.target.value;
          L.app.render();
        }, 120)
      });
      root.appendChild(h('div.search-box', UI.icon('search', 'search-ic'), input));
      root.appendChild(
        h(
          'div.cat-row',
          { role: 'radiogroup', 'aria-label': 'Category' },
          [{ v: 'all', label: 'All', n: all.length }].concat(M.CATEGORIES.map((c) => ({ v: c.v, label: c.label, n: counts[c.v] || 0 })))
            .filter((c) => c.v === 'all' || c.n > 0)
            .map((c) =>
              h(
                'button.chip',
                { type: 'button', role: 'radio', 'aria-checked': String(st.cat === c.v), onclick: () => {
                  st.cat = c.v;
                  L.app.render();
                } },
                c.label,
                h('span.chip-n', String(c.n))
              )
            )
        )
      );
      root.appendChild(
        h(
          'div.list-tools',
          UI.select({
            label: 'Sort',
            value: st.sort,
            options: [
              { value: 'newest', label: 'Newest first' },
              { value: 'name', label: 'Name' },
              { value: 'most', label: 'Most worn' },
              { value: 'least', label: 'Least worn' },
              { value: 'price', label: 'Price, high to low' }
            ],
            onChange: (v) => {
              st.sort = v;
              L.app.render();
            }
          }),
          UI.btn(active ? 'Filters (' + active + ')' : 'Filters', () => filterSheet(st, all), { small: true, icon: 'filter', kind: active ? 'primary' : 'ghost', id: 'closet-filter' })
        )
      );
      if (!shown.length) {
        root.appendChild(h('p.hint', 'Nothing matches. Try fewer words or clear the filters.'));
        return;
      }
      root.appendChild(h('div.item-grid', shown.map((it) => V.itemCard(it))));
    }
  };

  function filterSheet(st, all) {
    const colours = M.colourNames(all);
    const body = h('div.form');
    const s = UI.sheet({
      title: 'Filters',
      body,
      actions: [
        UI.btn('Clear', () => {
          Object.assign(st, { colour: '', season: '', occasion: '', favourites: false, unworn: false, never: false });
          s.close();
          L.app.render();
        }, { kind: 'ghost' }),
        UI.btn('Show items', () => {
          s.close();
          L.app.render();
        }, { kind: 'primary' })
      ]
    });
    const anyChip = (label, key, options, swatches) =>
      h(
        'div.field',
        h('span.label', label),
        UI.pick({
          label,
          value: st[key] || '',
          options: [{ value: '', label: 'Any' }].concat(options.map((o) => ({ value: o, label: o, swatch: swatches ? L.cutout.hexOfName(o) : null }))),
          onChange: (v) => (st[key] = v)
        })
      );
    const toggle = (label, key) =>
      h('label.check-row', h('input', { type: 'checkbox', checked: !!st[key], onchange: (e) => (st[key] = e.target.checked) }), h('span', label));
    UI.append(body, 
      colours.length ? anyChip('Colour', 'colour', colours, true) : null,
      anyChip('Season', 'season', M.SEASONS),
      anyChip('Occasion', 'occasion', M.OCCASIONS),
      h('div.field', h('span.label', 'Only show'), toggle('Favourites', 'favourites'), toggle('Not worn in the last 90 days', 'unworn'), toggle('Never worn', 'never'))
    );
  }
})((window.Wardrobe = window.Wardrobe || {}));
