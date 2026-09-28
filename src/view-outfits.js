/* Wardrobe — outfits: a list of them, and a canvas where cut-outs are arranged into one. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const M = L.model;
  const C = L.cutout;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});
  const ASPECT = 4 / 3; /* the canvas is 3 wide by 4 high */

  V.outfitCard = (o, onclick) =>
    h(
      'button.outfit-card',
      { type: 'button', onclick: onclick || (() => R.go('outfit', o.id)), 'aria-label': o.name || 'Outfit' },
      h('div.outfit-pic', UI.pic(o.thumb, ''), o.favourite ? h('span.item-fav', UI.icon('star-on')) : null),
      h('div.item-card-name', o.name || 'Outfit')
    );

  V.outfits = {
    render(root) {
      const all = D.list('outfits').sort(U.byDesc((o) => o.updated || ''));
      root.appendChild(h('div.page-head.split', h('h1.page-title', 'Outfits'), UI.btn('New outfit', () => R.go('outfit', 'new'), { kind: 'primary', small: true, icon: 'plus', id: 'outfit-new' })));
      if (!all.length) {
        root.appendChild(UI.empty('No outfits yet', 'Put pieces from your closet together, move them about, and save the combination. Then log it on the calendar when you wear it.', D.count('items') ? UI.btn('Make one', () => R.go('outfit', 'new'), { kind: 'primary', icon: 'plus' }) : UI.btn('Add clothes first', () => R.go('edit', 'new'), { kind: 'primary', icon: 'camera' })));
        return;
      }
      root.appendChild(h('div.outfit-grid', all.map((o) => V.outfitCard(o))));
    }
  };

  /* ---------- the builder ---------- */
  V.outfit = {
    live: false,
    render(root, id) {
      const existing = id && id !== 'new' ? D.get('outfits', id) : null;
      if (id !== 'new' && !existing) {
        root.appendChild(UI.empty('That outfit is gone', null, UI.btn('Back to outfits', () => R.go('outfits'))));
        return;
      }
      const st =
        drafts.outfit && drafts.outfit.id === id
          ? drafts.outfit
          : (drafts.outfit = {
              id,
              name: existing ? existing.name || '' : '',
              seasons: existing ? existing.seasons || [] : [],
              occasions: existing ? existing.occasions || [] : [],
              favourite: existing ? !!existing.favourite : false,
              placed: existing ? M.outfitItems(existing) : [],
              selected: null,
              dirty: false
            });
      const err = h('p.form-error', { role: 'alert' });
      const stage = h('div.stage', { role: 'group', 'aria-label': 'Outfit canvas. Drag pieces to move them.' });
      const tools = h('div.stage-tools');
      let busy = null;

      /* ----- the canvas ----- */
      function paintStage() {
        UI.clear(stage);
        if (!st.placed.length) {
          stage.appendChild(h('div.stage-empty', UI.icon('hanger'), h('p', 'Add pieces from your closet to start.')));
        }
        st.placed
          .slice()
          .sort((a, b) => (a.z || 0) - (b.z || 0))
          .forEach((p) => {
            const el = h('div.piece' + (p === st.selected ? '.selected' : ''), { style: { left: p.x * 100 + '%', top: (p.y * 100) / ASPECT + '%', width: p.w * 100 + '%', zIndex: String(p.z || 0) }, 'data-id': p.id });
            el.appendChild(UI.pic(p.item.image, p.item.name, 'piece-img'));
            el.appendChild(h('span.piece-handle', { 'aria-hidden': 'true' }));
            el.addEventListener('pointerdown', (e) => startDrag(e, p, el));
            stage.appendChild(el);
          });
        paintTools();
      }
      function startDrag(e, p, el) {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        select(p);
        const rect = stage.getBoundingClientRect();
        const handle = e.target.classList.contains('piece-handle');
        const start = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, pw: p.w };
        let moved = false;
        el.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const dx = (ev.clientX - start.x) / rect.width;
          const dy = (ev.clientY - start.y) / rect.width; /* y is in widths so pieces keep their shape */
          if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 3) moved = true;
          if (handle) p.w = U.clamp(start.pw + dx, 0.12, 1);
          else {
            p.x = U.clamp(start.px + dx, -p.w * 0.5, 1 - p.w * 0.5);
            p.y = U.clamp(start.py + dy, -0.1, ASPECT - 0.1);
          }
          el.style.left = p.x * 100 + '%';
          el.style.top = (p.y * 100) / ASPECT + '%';
          el.style.width = p.w * 100 + '%';
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          if (moved) st.dirty = true;
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }
      function select(p) {
        st.selected = p;
        for (const el of stage.querySelectorAll('.piece')) el.classList.toggle('selected', el.dataset.id === (p ? p.id : ''));
        paintTools();
      }
      stage.addEventListener('pointerdown', (e) => {
        if (e.target === stage) select(null);
      });
      function paintTools() {
        UI.clear(tools);
        const p = st.selected;
        if (!p) {
          tools.appendChild(h('p.hint', st.placed.length ? 'Tap a piece to move it to the front or back, resize it with the corner, or take it off.' : ''));
          return;
        }
        const zs = st.placed.map((x) => x.z || 0);
        UI.append(tools, 
          h('span.tool-name', p.item.name),
          UI.iconBtn('forward', 'Bring to front', () => {
            p.z = Math.max(...zs) + 1;
            st.dirty = true;
            paintStage();
            select(p);
          }),
          UI.iconBtn('backward', 'Send to back', () => {
            p.z = Math.min(...zs) - 1;
            st.dirty = true;
            paintStage();
            select(p);
          }),
          UI.iconBtn('trash', 'Take off', () => {
            st.placed = st.placed.filter((x) => x !== p);
            st.selected = null;
            st.dirty = true;
            paintStage();
          }, { cls: 'danger-text' })
        );
      }

      /* ----- adding pieces ----- */
      function addPieces() {
        const items = D.list('items').filter((i) => i.status !== 'archived');
        if (!items.length) {
          UI.toast('Add some clothes to your closet first.');
          return;
        }
        const chosen = new Set();
        let cat = 'all';
        let q = '';
        const grid = h('div.item-grid.small');
        const fill = () => {
          UI.clear(grid);
          const shown = M.filter(M.search(items, q), { cat, sort: 'newest' });
          if (!shown.length) grid.appendChild(h('p.hint', 'Nothing here.'));
          for (const it of shown) {
            const card = V.itemCard(it, () => {
              if (chosen.has(it.id)) chosen.delete(it.id);
              else chosen.add(it.id);
              card.classList.toggle('chosen', chosen.has(it.id));
              card.setAttribute('aria-pressed', String(chosen.has(it.id)));
              add.lastChild.textContent = chosen.size ? 'Add ' + chosen.size : 'Add';
            });
            card.setAttribute('aria-pressed', 'false');
            if (st.placed.some((p) => p.id === it.id)) card.classList.add('already');
            grid.appendChild(card);
          }
        };
        const add = UI.btn('Add', () => {
          const zTop = st.placed.length ? Math.max(...st.placed.map((x) => x.z || 0)) : 0;
          const fresh = [];
          for (const id of chosen) {
            if (st.placed.some((p) => p.id === id)) continue;
            fresh.push({ id, item: D.get('items', id), x: 0.3, y: 0.3, w: 0.4, z: zTop + 1 + fresh.length });
          }
          if (fresh.length) {
            const laid = M.arrange(st.placed.concat(fresh));
            /* keep pieces that were already placed where they were; only the new ones take the suggested spots */
            st.placed = laid.map((p) => {
              const was = st.placed.find((x) => x.id === p.id);
              return was ? was : p;
            });
            st.dirty = true;
          }
          s.close();
          paintStage();
        }, { kind: 'primary', id: 'pieces-add' });
        const s = UI.sheet({
          title: 'Add pieces',
          wide: true,
          body: h(
            'div.add-sheet',
            h('div.search-box', UI.icon('search', 'search-ic'), h('input.input.search-input#pieces-q', { type: 'search', placeholder: 'Search', 'aria-label': 'Search', oninput: U.debounce((e) => {
              q = e.target.value;
              fill();
            }, 120) })),
            h('div.cat-row', UI.pick({ label: 'Category', value: 'all', options: [{ value: 'all', label: 'All' }].concat(M.CATEGORIES.filter((c) => items.some((i) => i.category === c.v)).map((c) => ({ value: c.v, label: c.label }))), onChange: (v) => {
              cat = v;
              fill();
            } })),
            grid
          ),
          actions: [add]
        });
        fill();
      }

      /* ----- saving ----- */
      async function renderThumb() {
        const W = 600;
        const H = Math.round(W * ASPECT);
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        const ordered = st.placed.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
        for (const p of ordered) {
          const blob = await D.getImage(p.item.image);
          if (!blob) continue;
          try {
            const bmp = await createImageBitmap(blob);
            const w = p.w * W;
            const hh = (w * bmp.height) / bmp.width;
            ctx.drawImage(bmp, p.x * W, p.y * W, w, hh);
            if (bmp.close) bmp.close();
          } catch (e) {
            /* a broken image is skipped */
          }
        }
        return C.toBlob(C.crop(canvas, 0.03), 'image/png');
      }
      async function save() {
        if (!st.placed.length) return (err.textContent = 'Add at least one piece.');
        busy = UI.busy('Saving…');
        try {
          const thumbBlob = await renderThumb();
          const thumb = await D.putImage(null, thumbBlob);
          if (existing && existing.thumb) await D.removeImage(existing.thumb);
          const rec = Object.assign({}, existing || {}, {
            name: (st.name || '').trim() || suggestName(),
            seasons: st.seasons,
            occasions: st.occasions,
            favourite: st.favourite,
            items: st.placed.map((p) => ({ id: p.id, x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, w: Math.round(p.w * 1000) / 1000, z: p.z || 0 })),
            thumb
          });
          const saved = await D.put('outfits', rec);
          drafts.outfit = null;
          UI.toast(existing ? 'Outfit saved' : 'Outfit created');
          R.go('outfit', saved.id, { replace: true });
        } catch (e) {
          console.error(e);
          err.textContent = (e && e.message) || 'Saving failed.';
        } finally {
          busy.close();
          busy = null;
        }
      }
      const suggestName = () => {
        const names = st.placed.slice(0, 2).map((p) => p.item.name);
        return names.join(' + ') || 'Outfit';
      };

      /* ----- the page ----- */
      const w = existing ? M.outfitWears(existing.id) : null;
      UI.append(root, 
        h(
          'div.page-head.split',
          h('button.back-btn', { type: 'button', onclick: () => {
            drafts.outfit = null;
            R.back('outfits');
          } }, UI.icon('back'), h('span', 'Outfits')),
          existing
            ? h(
                'div.topbar-right',
                UI.iconBtn(st.favourite ? 'star-on' : 'star', st.favourite ? 'Remove from favourites' : 'Add to favourites', async (e) => {
                  st.favourite = !st.favourite;
                  await D.put('outfits', Object.assign(D.get('outfits', existing.id), { favourite: st.favourite }), { silent: true });
                  e.currentTarget.replaceWith(UI.icon(st.favourite ? 'star-on' : 'star'));
                  L.app.render();
                })
              )
            : null
        ),
        h('div.stage-wrap', stage),
        tools,
        h('div.actions', UI.btn('Add pieces', addPieces, { icon: 'plus', kind: 'primary', id: 'outfit-add-pieces' }), UI.btn('Tidy layout', () => {
          st.placed = M.arrange(st.placed);
          st.dirty = true;
          paintStage();
        }, { icon: 'grid', kind: 'ghost' })),
        h(
          'div.form',
          UI.field('Name', h('input.input#o-name', { type: 'text', maxlength: 60, value: st.name, placeholder: suggestName(), oninput: (e) => (st.name = e.target.value) })),
          h('div.field', h('span.label', 'Seasons'), UI.chips({ label: 'Seasons', options: M.SEASONS, selected: new Set(st.seasons), onToggle: (t, on) => (st.seasons = toggleIn(st.seasons, t, on)) })),
          h('div.field', h('span.label', 'Occasions'), UI.chips({ label: 'Occasions', options: M.OCCASIONS, selected: new Set(st.occasions), onToggle: (t, on) => (st.occasions = toggleIn(st.occasions, t, on)) }))
        ),
        err,
        h('div.actions', UI.btn(existing ? 'Save outfit' : 'Create outfit', save, { kind: 'primary', block: true, id: 'outfit-save' })),
        existing
          ? h(
              'div.card',
              UI.sectionHead('Wear it'),
              h('p.muted', w.count ? 'Worn ' + U.plural(w.count, 'time') + ', last ' + U.relDay(U.parseDay(w.last)).toLowerCase() + '.' : 'Not worn yet.'),
              h(
                'div.actions',
                UI.btn('Wore it today', () => V.logWear(U.todayKey(), { outfit: existing.id }), { kind: 'primary', icon: 'check', id: 'outfit-wear' }),
                UI.btn('Another day', async () => {
                  const day = await V.pickDay('Worn or planned for');
                  if (day) V.logWear(day, { outfit: existing.id });
                }, { kind: 'ghost', icon: 'calendar' })
              )
            )
          : null,
        existing
          ? h(
              'div.danger-zone',
              UI.btn('Delete this outfit', async () => {
                const ok = await UI.confirm({ title: 'Delete this outfit?', body: 'The clothes stay in your closet. Days it was worn keep the individual pieces.', confirm: 'Delete', danger: true });
                if (!ok) return;
                for (const d of D.list('days')) {
                  if ((d.outfits || []).includes(existing.id)) {
                    const ids = new Set(d.items || []);
                    for (const x of existing.items || []) ids.add(x.id);
                    d.outfits = d.outfits.filter((x) => x !== existing.id);
                    d.items = [...ids];
                    await D.put('days', d, { silent: true });
                  }
                }
                if (existing.thumb) await D.removeImage(existing.thumb);
                await D.remove('outfits', existing.id);
                drafts.outfit = null;
                R.go('outfits');
              }, { kind: 'ghost.danger-text', icon: 'trash' })
            )
          : null
      );
      paintStage();
    }
  };
  const toggleIn = (arr, t, on) => {
    const set = new Set(arr || []);
    if (on) set.add(t);
    else set.delete(t);
    return [...set];
  };
})((window.Wardrobe = window.Wardrobe || {}));
