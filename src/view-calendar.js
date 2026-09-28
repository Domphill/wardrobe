/* Wardrobe — the calendar: what was worn each day, what is planned, and the days ahead with their
   weather and outfit ideas. */
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

  const monthOf = (key) => key.slice(0, 7);
  const firstOf = (ym) => U.parseDay(ym + '-01');
  const shiftMonth = (ym, n) => {
    const d = firstOf(ym);
    d.setMonth(d.getMonth() + n);
    return U.dayKey(d).slice(0, 7);
  };
  /* The forecast for the days ahead, by day, once it has arrived. */
  const forecastMap = () => new Map(((drafts.cal && drafts.cal.fx) || []).map((d) => [d.day, d]));
  function loadForecast(st) {
    const place = D.prefs().place;
    if (!place) {
      st.fx = null;
      st.fxKey = null;
      return;
    }
    const key = U.todayKey() + '|' + place.lat + ',' + place.lon;
    if (st.fxKey === key || st.fxLoading) return;
    st.fxLoading = true;
    W.forecast(place)
      .then((days) => {
        st.fx = days;
        st.fxKey = key;
        st.fxLoading = false;
        if (R.current.name === 'calendar') L.app.render();
      })
      .catch(() => {
        st.fx = null;
        st.fxKey = key;
        st.fxLoading = false;
      });
  }

  V.calendar = {
    render(root, arg) {
      const today = U.todayKey();
      const st = drafts.cal || (drafts.cal = { month: monthOf(today), fx: null, fxKey: null, fxLoading: false });
      if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
        st.month = monthOf(arg);
        st.open = arg;
        R.current.arg = null;
      }
      loadForecast(st);
      const fx = forecastMap();
      const days = new Map(D.list('days').map((d) => [d.id, d]));
      const first = firstOf(st.month);
      const startPad = (first.getDay() + 6) % 7; /* Monday first */
      const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push(null);
      for (let d = 1; d <= daysIn; d++) cells.push(st.month + '-' + U.pad2(d));
      while (cells.length % 7) cells.push(null);
      const place = D.prefs().place;

      UI.append(
        root,
        h(
          'div.page-head.split',
          h('h1.page-title', 'Calendar'),
          h('div.topbar-right', UI.btn('Today', () => {
            st.month = monthOf(today);
            L.app.render();
          }, { small: true, kind: 'ghost' }))
        ),
        h(
          'div.cal-nav',
          UI.iconBtn('back', 'Previous month', () => {
            st.month = shiftMonth(st.month, -1);
            L.app.render();
          }),
          h('h2.cal-month', U.fmtMonthYear(first)),
          UI.iconBtn('chev', 'Next month', () => {
            st.month = shiftMonth(st.month, 1);
            L.app.render();
          })
        ),
        h('div.cal-head', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => h('span', d))),
        h(
          'div.cal-days',
          cells.map((key) => {
            if (!key) return h('span.cal-blank');
            const rec = days.get(key);
            const outfit = rec && rec.outfits && rec.outfits.length ? D.get('outfits', rec.outfits[0]) : null;
            const items = rec ? [...M.dayItemIds(rec)] : [];
            const firstItem = !outfit && items.length ? D.get('items', items[0]) : null;
            const pic = outfit ? outfit.thumb : firstItem ? firstItem.thumb || firstItem.image : null;
            const n = (rec ? (rec.outfits || []).length : 0) + (rec ? (rec.items || []).length : 0);
            const wx = key >= today ? fx.get(key) : null;
            return h(
              'button.cal-cell' + (key === today ? '.today' : '') + (key > today ? '.future' : '') + (n ? '.has' : ''),
              { type: 'button', 'aria-label': U.fmtLongYear(U.parseDay(key)) + (n ? ', ' + U.plural(n, 'thing') + (key > today ? ' planned' : ' worn') : '') + (wx ? ', ' + W.line(wx) : ''), onclick: () => daySheet(key) },
              h('span.cal-num', String(Number(key.slice(8)))),
              pic ? UI.pic(pic, '', 'cal-pic') : n ? h('span.cal-dot') : null,
              n > 1 ? h('span.cal-more', '+' + (n - 1)) : null,
              wx ? h('span.cal-wx', UI.icon(W.describe(wx.code)[1]), h('span', Math.round(wx.tmax) + '°')) : null
            );
          })
        ),
        place
          ? h('p.hint', 'Tap a day to see the forecast and outfit ideas, log what you wore, or plan an outfit.')
          : h('p.hint', 'Tap a day to log what you wore, or to plan an outfit for it. ', h('button.link-btn.inline', { type: 'button', onclick: () => R.go('more') }, 'Add your town in More'), ' to see the forecast and ideas for the days ahead.')
      );
      if (st.open) {
        const key = st.open;
        st.open = null;
        setTimeout(() => daySheet(key), 50);
      }
    }
  };

  function daySheet(key) {
    const today = U.todayKey();
    const future = key > today;
    const wx = key >= today ? forecastMap().get(key) : null;
    const body = h('div.form');
    const s = UI.sheet({ title: U.relDay(U.parseDay(key)) + (future ? ' · planned' : ''), body, wide: true });
    function paint() {
      UI.clear(body);
      const rec = D.get('days', key) || { id: key, day: key, outfits: [], items: [], note: '' };
      const outfits = (rec.outfits || []).map((id) => D.get('outfits', id)).filter(Boolean);
      const items = (rec.items || []).map((id) => D.get('items', id)).filter(Boolean);
      const removeOutfit = async (id) => {
        rec.outfits = rec.outfits.filter((x) => x !== id);
        await D.put('days', rec, { silent: true });
        paint();
      };
      const removeItem = async (id) => {
        rec.items = rec.items.filter((x) => x !== id);
        await D.put('days', rec, { silent: true });
        paint();
      };
      const addOutfit = async (o) => {
        if (!rec.outfits.includes(o.id)) rec.outfits.push(o.id);
        await D.put('days', rec, { silent: true });
        UI.toast((future ? 'Planned ' : 'Logged ') + (o.name || 'outfit'));
        paint();
      };
      const addItems = async (ids) => {
        for (const id of ids) if (!rec.items.includes(id)) rec.items.push(id);
        await D.put('days', rec, { silent: true });
        UI.toast(future ? 'Pieces planned' : 'Pieces logged');
        paint();
      };
      /* ideas for today and the days ahead */
      let ideas = null;
      if (key >= today) {
        const ctx = S.context(wx || null, U.parseDay(key));
        const suited = S.outfits(ctx).slice(0, 3).filter((x) => !rec.outfits.includes(x.outfit.id));
        const pieces = S.compose(ctx, false);
        ideas = h(
          'div.ideas',
          { id: 'day-ideas' },
          wx ? h('div.today-head', UI.icon(W.describe(wx.code)[1], 'today-ic'), h('div.today-text', h('strong', W.fmtTemp(wx.tmax) + ' · ' + W.describe(wx.code)[0]), h('span.muted', 'low ' + W.fmtTemp(wx.tmin) + (wx.rain >= 30 ? ' · ' + wx.rain + '% chance of rain' : '')))) : null,
          h('h3.mini-title', future ? 'Ideas for this day' : 'Ideas for today'),
          h('p.muted', S.reason(ctx) + (suited.length ? ' Tap an outfit to ' + (future ? 'plan it.' : 'log it.') : '')),
          suited.length ? h('div.outfit-strip', suited.map((x) => h('button.outfit-mini', { type: 'button', onclick: () => addOutfit(x.outfit), 'aria-label': (future ? 'Plan ' : 'Log ') + (x.outfit.name || 'outfit') }, UI.pic(x.outfit.thumb, ''), h('span', x.outfit.name || 'Outfit')))) : null,
          pieces.length
            ? [
                h('div.outfit-strip', pieces.map((it) => h('span.outfit-mini', UI.pic(it.thumb || it.image, ''), h('span', it.name)))),
                h('div.actions', UI.btn(future ? 'Plan these pieces' : 'Wear these pieces', () => addItems(pieces.map((p) => p.id)), { small: true, kind: 'primary', icon: 'check', id: 'day-plan-pieces' }))
              ]
            : null
        );
      }
      UI.append(
        body,
        h('p.muted', U.fmtLongYear(U.parseDay(key))),
        outfits.length || items.length
          ? h(
              'div.day-list',
              outfits.map((o) => h('div.day-row', UI.pic(o.thumb, '', 'day-pic'), h('span.day-name', o.name || 'Outfit'), UI.iconBtn('chev', 'Open outfit', () => {
                s.close();
                R.go('outfit', o.id);
              }), UI.iconBtn('x', 'Remove from this day', () => removeOutfit(o.id)))),
              items.map((it) => h('div.day-row', UI.pic(it.thumb || it.image, '', 'day-pic'), h('span.day-name', it.name), UI.iconBtn('chev', 'Open item', () => {
                s.close();
                R.go('item', it.id);
              }), UI.iconBtn('x', 'Remove from this day', () => removeItem(it.id))))
            )
          : h('p.hint', future ? 'Nothing planned yet.' : 'Nothing logged for this day.'),
        h(
          'div.actions',
          UI.btn(future ? 'Plan an outfit' : 'Add an outfit', () => pickOutfit(rec, paint), { icon: 'hanger', kind: 'primary', small: true, id: 'day-add-outfit' }),
          UI.btn('Add pieces', () => pickItems(rec, paint), { icon: 'shirt', small: true, id: 'day-add-items' })
        ),
        ideas,
        UI.field(
          'Note (optional)',
          UI.autoGrow(
            h('textarea.input', { rows: 1, maxlength: 200, value: rec.note || '', placeholder: 'Where you went, how it felt…', onchange: async (e) => {
              rec.note = e.target.value;
              await D.put('days', rec, { silent: true });
            } })
          )
        )
      );
    }
    paint();
    const done = s.close;
    s.close = (r) => {
      done(r);
      L.app.render();
    };
  }

  function pickOutfit(rec, after) {
    const all = D.list('outfits').sort(U.byDesc((o) => o.updated || ''));
    if (!all.length) {
      UI.toast('No outfits yet. Make one from the Outfits tab.');
      return;
    }
    const s = UI.sheet({
      title: 'Which outfit?',
      wide: true,
      body: h('div.outfit-grid.small', all.map((o) => V.outfitCard(o, async () => {
        if (!rec.outfits.includes(o.id)) rec.outfits.push(o.id);
        await D.put('days', rec, { silent: true });
        s.close();
        after();
      })))
    });
  }
  function pickItems(rec, after) {
    const items = D.list('items').filter((i) => i.status !== 'archived');
    if (!items.length) {
      UI.toast('Your closet is empty.');
      return;
    }
    const chosen = new Set();
    let cat = 'all';
    const grid = h('div.item-grid.small');
    const fill = () => {
      UI.clear(grid);
      for (const it of M.filter(items, { cat, sort: 'newest' })) {
        const card = V.itemCard(it, () => {
          if (chosen.has(it.id)) chosen.delete(it.id);
          else chosen.add(it.id);
          card.classList.toggle('chosen', chosen.has(it.id));
          add.lastChild.textContent = chosen.size ? 'Add ' + chosen.size : 'Add';
        });
        if ((rec.items || []).includes(it.id)) card.classList.add('already');
        grid.appendChild(card);
      }
    };
    const add = UI.btn('Add', async () => {
      for (const id of chosen) if (!rec.items.includes(id)) rec.items.push(id);
      await D.put('days', rec, { silent: true });
      s.close();
      after();
    }, { kind: 'primary', id: 'day-pieces-add' });
    const s = UI.sheet({
      title: 'Which pieces?',
      wide: true,
      body: h('div.add-sheet', h('div.cat-row', UI.pick({ label: 'Category', value: 'all', options: [{ value: 'all', label: 'All' }].concat(M.CATEGORIES.filter((c) => items.some((i) => i.category === c.v)).map((c) => ({ value: c.v, label: c.label }))), onChange: (v) => {
        cat = v;
        fill();
      } })), grid),
      actions: [add]
    });
    fill();
  }
})((window.Wardrobe = window.Wardrobe || {}));
