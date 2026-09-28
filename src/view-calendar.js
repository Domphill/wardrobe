/* Wardrobe — the calendar: what was worn each day, and what is planned. */
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

  const monthOf = (key) => key.slice(0, 7);
  const firstOf = (ym) => U.parseDay(ym + '-01');
  const shiftMonth = (ym, n) => {
    const d = firstOf(ym);
    d.setMonth(d.getMonth() + n);
    return U.dayKey(d).slice(0, 7);
  };

  V.calendar = {
    render(root, arg) {
      const today = U.todayKey();
      const st = drafts.cal || (drafts.cal = { month: monthOf(today) });
      if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
        st.month = monthOf(arg);
        st.open = arg;
        R.current.arg = null;
      }
      const days = new Map(D.list('days').map((d) => [d.id, d]));
      const first = firstOf(st.month);
      const startPad = (first.getDay() + 6) % 7; /* Monday first */
      const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push(null);
      for (let d = 1; d <= daysIn; d++) cells.push(st.month + '-' + U.pad2(d));
      while (cells.length % 7) cells.push(null);

      UI.append(root, 
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
            return h(
              'button.cal-cell' + (key === today ? '.today' : '') + (key > today ? '.future' : '') + (n ? '.has' : ''),
              { type: 'button', 'aria-label': U.fmtLongYear(U.parseDay(key)) + (n ? ', ' + U.plural(n, 'thing') + (key > today ? ' planned' : ' worn') : ''), onclick: () => daySheet(key) },
              h('span.cal-num', String(Number(key.slice(8)))),
              pic ? UI.pic(pic, '', 'cal-pic') : n ? h('span.cal-dot') : null,
              n > 1 ? h('span.cal-more', '+' + (n - 1)) : null
            );
          })
        ),
        h('p.hint', 'Tap a day to log what you wore, or to plan an outfit for it.')
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
      UI.append(body, 
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
          UI.btn('Add an outfit', () => pickOutfit(rec, paint), { icon: 'hanger', kind: 'primary', small: true, id: 'day-add-outfit' }),
          UI.btn('Add pieces', () => pickItems(rec, paint), { icon: 'shirt', small: true, id: 'day-add-items' })
        ),
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
    s.wrap.addEventListener('transitionend', () => {}, { once: true });
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
