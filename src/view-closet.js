/* Wardrobe — the closet: every item, searchable and filterable. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const M = L.model;
  const W = L.weather;
  const S = L.suggest;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  /* ---------- today: the weather and what to wear ---------- */
  const strip = (items, onPick) =>
    h('div.outfit-strip', items.map((it) => h('button.outfit-mini', { type: 'button', onclick: () => (onPick ? onPick(it) : R.go('item', it.id)), 'aria-label': it.name }, UI.pic(it.thumb || it.image, ''), h('span', it.name))));
  V.todayCard = () => {
    const td = drafts.today || (drafts.today = { fx: null, error: null, pick: null, forDay: null });
    const card = h('div.card.today-card', { id: 'today-card' });
    const place = D.prefs().place;
    const paint = () => {
      UI.clear(card);
      const ctx = S.context(td.fx, new Date());
      const head = h('div.today-head');
      if (place && td.fx) {
        const [text, icon] = W.describe(td.fx.code);
        head.append(UI.icon(icon, 'today-ic'), h('div.today-text', h('strong', W.fmtTemp(td.fx.tmax) + ' · ' + text), h('span.muted', place.name + ' · low ' + W.fmtTemp(td.fx.tmin) + (td.fx.rain >= 30 ? ' · ' + td.fx.rain + '% chance of rain' : ''))));
      } else if (place && td.error) {
        head.append(UI.icon('cloud', 'today-ic'), h('div.today-text', h('strong', 'No forecast right now'), h('span.muted', td.error)));
      } else if (place) {
        head.append(UI.icon('cloud', 'today-ic'), h('div.today-text', h('strong', 'Checking the weather…'), h('span.muted', place.name)));
      } else {
        head.append(UI.icon('sun', 'today-ic'), h('div.today-text', h('strong', ctx.season + ' day'), h('button.link-btn.inline', { type: 'button', onclick: () => R.go('more') }, 'Add your town for the weather')));
      }
      card.appendChild(head);
      card.appendChild(h('p.today-reason', S.reason(ctx)));
      const saved = S.outfits(ctx).slice(0, 3);
      if (saved.length) {
        card.appendChild(h('h3.mini-title', 'Outfits that suit today'));
        card.appendChild(h('div.outfit-strip', saved.map((x) => h('button.outfit-mini', { type: 'button', onclick: () => R.go('outfit', x.outfit.id), 'aria-label': x.outfit.name || 'Outfit' }, UI.pic(x.outfit.thumb, ''), h('span', x.outfit.name || 'Outfit')))));
      }
      const key = ctx.band + '|' + ctx.rain + '|' + U.todayKey();
      if (!td.pick || td.forDay !== key) {
        td.pick = S.compose(ctx, false).map((it) => it.id);
        td.forDay = key;
      }
      const pieces = td.pick.map((id) => D.get('items', id)).filter(Boolean);
      if (pieces.length) {
        card.appendChild(h('h3.mini-title', saved.length ? 'Or put together' : 'An idea from your closet'));
        card.appendChild(strip(pieces));
        card.appendChild(
          h(
            'div.actions',
            UI.btn('Wear this today', () => V.logWear(U.todayKey(), { items: pieces.map((p) => p.id) }), { kind: 'primary', small: true, icon: 'check', id: 'today-wear' }),
            UI.btn('Another idea', () => {
              td.pick = S.compose(ctx, true).map((it) => it.id);
              paint();
            }, { small: true, kind: 'ghost', icon: 'shuffle', id: 'today-shuffle' }),
            UI.btn('Save as outfit', () => {
              drafts.outfit = { id: 'new', name: '', seasons: [ctx.season], occasions: [], favourite: false, placed: M.arrange(pieces.map((it, i) => ({ id: it.id, item: it, x: 0.3, y: 0.3, w: 0.4, z: i }))), selected: null, dirty: true };
              R.go('outfit', 'new');
            }, { small: true, kind: 'ghost', icon: 'layers', id: 'today-save' })
          )
        );
      } else card.appendChild(h('p.hint', 'Nothing in your closet suits this weather yet. Add a few more pieces and tag their seasons.'));
    };
    paint();
    /* one try per visit; after a failure, wait five minutes before asking again */
    if (place && !td.fx && (!td.tried || Date.now() - td.tried > 300000)) {
      td.tried = Date.now();
      W.forecast(place)
        .then((days) => {
          td.fx = days[0];
          td.error = null;
          td.pick = null;
          if (card.isConnected) paint();
        })
        .catch((e) => {
          td.error = navigator.onLine === false ? 'You’re offline, so today’s ideas go by the season instead.' : (e && e.message) || 'The weather service didn’t answer.';
          if (card.isConnected) paint();
        });
    }
    return card;
  };

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
      root.appendChild(V.todayCard());
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
          options: [{ value: '', label: 'Any' }].concat(options.map((o) => ({ value: o, label: o, swatch: swatches ? L.colour.hexOfName(o) : null }))),
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
