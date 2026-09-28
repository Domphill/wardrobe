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
  const MIX_CATS = ['outerwear', 'tops', 'dresses', 'bottoms', 'shoes', 'bags', 'accessories', 'jewellery', 'other'];

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

  const transformOf = (p) => 'rotate(' + (p.rot || 0) + 'deg) scaleX(' + (p.flip ? -1 : 1) + ')';

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
              mix: false,
              dirty: false
            });
      const err = h('p.form-error', { role: 'alert' });
      const stage = h('div.stage', { role: 'group', 'aria-label': 'Outfit canvas. Drag pieces to move them.' });
      const tools = h('div.stage-tools');
      const mixer = h('div.mixer', { hidden: !st.mix, id: 'mixer' });
      let busy = null;
      const closet = () => D.list('items').filter((i) => i.status !== 'archived').sort(U.byDesc((i) => i.created || ''));

      /* ----- the canvas ----- */
      function paintStage() {
        UI.clear(stage);
        if (!st.placed.length) {
          stage.appendChild(h('div.stage-empty', UI.icon('hanger'), h('p', 'Add pieces from your closet to start, or try Mix and match.')));
        }
        st.placed
          .slice()
          .sort((a, b) => (a.z || 0) - (b.z || 0))
          .forEach((p) => {
            const el = h('div.piece' + (p === st.selected ? '.selected' : ''), { style: { left: p.x * 100 + '%', top: (p.y * 100) / ASPECT + '%', width: p.w * 100 + '%', zIndex: String(p.z || 0), transform: transformOf(p) }, 'data-id': p.id });
            el.appendChild(UI.pic(p.item.image, p.item.name, 'piece-img'));
            el.appendChild(h('span.piece-handle', { 'aria-hidden': 'true' }));
            el.addEventListener('pointerdown', (e) => startDrag(e, p, el));
            stage.appendChild(el);
          });
        paintTools();
      }
      const elOf = (p) => stage.querySelector('.piece[data-id="' + p.id + '"]');
      /* One finger drags a piece (or its corner to resize). Two fingers on it twist to turn it and
         pinch to resize it. */
      function startDrag(e, p, el) {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        select(p);
        const pts = el._pts || (el._pts = new Map());
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err2) {
          /* ignore */
        }
        const rect = stage.getBoundingClientRect();
        if (pts.size >= 2) {
          const [a, b] = [...pts.values()];
          el._gesture = { rot0: p.rot || 0, w0: p.w, a0: Math.atan2(b.y - a.y, b.x - a.x), d0: Math.hypot(b.x - a.x, b.y - a.y) || 1 };
          el._drag = null;
        } else {
          el._drag = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, pw: p.w, handle: e.target.classList.contains('piece-handle'), moved: false };
        }
        if (el._bound) return;
        el._bound = true;
        const move = (ev) => {
          const pt = pts.get(ev.pointerId);
          if (!pt) return;
          pt.x = ev.clientX;
          pt.y = ev.clientY;
          if (el._gesture && pts.size >= 2) {
            const [a, b] = [...pts.values()];
            const g = el._gesture;
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const dd = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            p.rot = wrapAngle(Math.round(g.rot0 + ((ang - g.a0) * 180) / Math.PI));
            p.w = U.clamp(g.w0 * (dd / g.d0), 0.12, 1);
            el.style.width = p.w * 100 + '%';
            el.style.transform = transformOf(p);
            st.dirty = true;
            syncAngle(p);
            return;
          }
          const dg = el._drag;
          if (!dg) return;
          const dx = (ev.clientX - dg.x) / rect.width;
          const dy = (ev.clientY - dg.y) / rect.width; /* y is in widths so pieces keep their shape */
          if (Math.abs(ev.clientX - dg.x) + Math.abs(ev.clientY - dg.y) > 3) dg.moved = true;
          if (dg.handle) p.w = U.clamp(dg.pw + dx, 0.12, 1);
          else {
            p.x = U.clamp(dg.px + dx, -p.w * 0.5, 1 - p.w * 0.5);
            p.y = U.clamp(dg.py + dy, -0.1, ASPECT - 0.1);
          }
          el.style.left = p.x * 100 + '%';
          el.style.top = (p.y * 100) / ASPECT + '%';
          el.style.width = p.w * 100 + '%';
        };
        const up = (ev) => {
          pts.delete(ev.pointerId);
          if (pts.size < 2) el._gesture = null;
          if (!pts.size) {
            if (el._drag && el._drag.moved) st.dirty = true;
            el._drag = null;
          }
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }
      const wrapAngle = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
      const syncAngle = (p) => {
        const slider = tools.querySelector('#piece-angle');
        const num = tools.querySelector('#piece-deg');
        if (slider) slider.value = String(p.rot || 0);
        if (num) num.value = String(p.rot || 0);
      };
      function select(p) {
        st.selected = p;
        for (const el of stage.querySelectorAll('.piece')) el.classList.toggle('selected', el.dataset.id === (p ? p.id : ''));
        paintTools();
      }
      stage.addEventListener('pointerdown', (e) => {
        if (e.target === stage) select(null);
      });
      const turn = (p, deg) => {
        p.rot = wrapAngle((p.rot || 0) + deg);
        st.dirty = true;
        const el = elOf(p);
        if (el) el.style.transform = transformOf(p);
        syncAngle(p);
      };
      const mirror = (p) => {
        p.flip = !p.flip;
        st.dirty = true;
        const el = elOf(p);
        if (el) el.style.transform = transformOf(p);
        const b = tools.querySelector('#piece-mirror');
        if (b) b.setAttribute('aria-pressed', String(!!p.flip));
      };
      function paintTools() {
        UI.clear(tools);
        const p = st.selected;
        if (!p) {
          tools.appendChild(h('p.hint', st.placed.length ? 'Tap a piece to tilt, mirror, bring it forward or back, resize it with the corner, or take it off.' : ''));
          return;
        }
        const zs = st.placed.map((x) => x.z || 0);
        UI.append(
          tools,
          h(
            'div.tool-row',
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
              paintMixer();
            }, { cls: 'danger-text' })
          ),
          h(
            'div.tool-row',
            UI.btn('Tilt left', () => turn(p, -15), { small: true, kind: 'ghost', icon: 'undo', id: 'piece-left' }),
            UI.btn('Tilt right', () => turn(p, 15), { small: true, kind: 'ghost', icon: 'redo', id: 'piece-right' }),
            h('button.btn.small.ghost#piece-mirror', { type: 'button', 'aria-pressed': String(!!p.flip), onclick: () => mirror(p) }, UI.icon('mirror'), h('span', 'Mirror'))
          ),
          h(
            'div.tool-row',
            h('input.range#piece-angle', { type: 'range', min: '-180', max: '180', step: '1', value: String(p.rot || 0), 'aria-label': 'Angle', oninput: (e) => turn(p, Number(e.target.value) - (p.rot || 0)) }),
            h('input.input.deg-input#piece-deg', { type: 'number', inputmode: 'numeric', min: '-180', max: '180', step: '1', value: String(p.rot || 0), 'aria-label': 'Angle in degrees', onchange: (e) => turn(p, (Number(e.target.value) || 0) - (p.rot || 0)) }),
            h('span.label', '\u00b0')
          ),
          h('p.fineprint', 'Or put two fingers on the piece and twist to turn it, pinch to resize it.')
        );
      }

      /* ----- mix and match: a revolver for each kind of piece ----- */
      const fresh = (it) => ({ id: it.id, item: it, x: 0.3, y: 0.3, w: 0.4, z: (st.placed.length ? Math.max(...st.placed.map((x) => x.z || 0)) : 0) + 1, rot: 0, flip: false });
      const placeNew = (piece, keep) => {
        const laid = M.arrange(st.placed.concat(piece));
        const pos = laid.find((x) => x.id === piece.id);
        if (keep) Object.assign(piece, { x: keep.x, y: keep.y, w: keep.w });
        else if (pos) Object.assign(piece, { x: pos.x, y: pos.y, w: pos.w });
        st.placed.push(piece);
      };
      function cycle(cat, dir) {
        const list = closet().filter((i) => i.category === cat);
        if (!list.length) return;
        const current = st.placed.find((p) => p.item.category === cat);
        const idx = current ? list.findIndex((i) => i.id === current.id) : list.length;
        let next = idx + dir;
        if (next > list.length) next = 0;
        if (next < 0) next = list.length;
        if (current) st.placed = st.placed.filter((p) => p !== current);
        if (next < list.length) placeNew(fresh(list[next]), current);
        st.selected = null;
        st.dirty = true;
        paintStage();
        paintMixer();
      }
      function shuffle() {
        const items = closet();
        const pick = (cat) => {
          const list = items.filter((i) => i.category === cat);
          return list.length ? list[Math.floor(Math.random() * list.length)] : null;
        };
        const chosen = [];
        const dress = pick('dresses');
        const top = pick('tops');
        const bottom = pick('bottoms');
        if (dress && (!top || !bottom || Math.random() < 0.3)) chosen.push(dress);
        else {
          if (top) chosen.push(top);
          if (bottom) chosen.push(bottom);
        }
        const outer = pick('outerwear');
        if (outer && Math.random() < 0.5) chosen.push(outer);
        const shoes = pick('shoes');
        if (shoes) chosen.push(shoes);
        for (const cat of ['bags', 'accessories']) {
          const extra = pick(cat);
          if (extra && Math.random() < 0.35) chosen.push(extra);
        }
        st.placed = M.arrange(chosen.map((it, i) => Object.assign(fresh(it), { z: i })));
        st.selected = null;
        st.dirty = true;
        paintStage();
        paintMixer();
      }
      function paintMixer() {
        UI.clear(mixer);
        mixer.hidden = !st.mix;
        if (!st.mix) return;
        const items = closet();
        const rows = MIX_CATS.filter((cat) => items.some((i) => i.category === cat));
        if (!rows.length) {
          mixer.appendChild(h('p.hint', 'Add some clothes to your closet first.'));
          return;
        }
        UI.append(
          mixer,
          h('p.hint', 'Flick through each kind of piece to try combinations. The canvas shows the current mix.'),
          rows.map((cat) => {
            const list = items.filter((i) => i.category === cat);
            const current = st.placed.find((p) => p.item.category === cat);
            return h(
              'div.mix-row',
              { 'data-cat': cat },
              UI.iconBtn('back', 'Previous ' + M.catLabel(cat).toLowerCase(), () => cycle(cat, -1), { cls: 'mix-prev' }),
              h(
                'button.mix-current',
                { type: 'button', onclick: () => current && select(current), 'aria-label': M.catLabel(cat) + ': ' + (current ? current.item.name : 'none') },
                current ? UI.pic(current.item.thumb || current.item.image, '', 'mix-pic') : h('span.mix-none', UI.icon('x')),
                h('span.mix-text', h('span.mix-cat', M.catLabel(cat)), h('span.mix-name', current ? current.item.name : 'None' + (list.length ? ' of ' + list.length : '')))
              ),
              UI.iconBtn('chev', 'Next ' + M.catLabel(cat).toLowerCase(), () => cycle(cat, 1), { cls: 'mix-next' })
            );
          }),
          h('div.actions', UI.btn('Shuffle', shuffle, { small: true, icon: 'shuffle', kind: 'ghost', id: 'mix-shuffle' }))
        );
      }

      /* ----- adding pieces ----- */
      function addPieces() {
        const items = closet();
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
          const news = [];
          for (const id of chosen) {
            if (st.placed.some((p) => p.id === id)) continue;
            news.push(fresh(D.get('items', id)));
          }
          if (news.length) {
            const laid = M.arrange(st.placed.concat(news));
            /* pieces already placed stay where they were; only the new ones take the suggested spots */
            st.placed = laid.map((p) => {
              const was = st.placed.find((x) => x.id === p.id);
              return was ? was : p;
            });
            st.dirty = true;
          }
          s.close();
          paintStage();
          paintMixer();
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
            ctx.save();
            ctx.translate(p.x * W + w / 2, p.y * W + hh / 2);
            ctx.rotate(((p.rot || 0) * Math.PI) / 180);
            ctx.scale(p.flip ? -1 : 1, 1);
            ctx.drawImage(bmp, -w / 2, -hh / 2, w, hh);
            ctx.restore();
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
            items: st.placed.map((p) => ({ id: p.id, x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, w: Math.round(p.w * 1000) / 1000, z: p.z || 0, rot: p.rot || 0, flip: !!p.flip })),
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
      const mixBtn = UI.btn('Mix and match', () => {
        st.mix = !st.mix;
        mixBtn.setAttribute('aria-pressed', String(st.mix));
        paintMixer();
      }, { icon: 'shuffle', kind: 'ghost', id: 'outfit-mix' });
      mixBtn.setAttribute('aria-pressed', String(st.mix));
      UI.append(
        root,
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
        h('div.actions', UI.btn('Add pieces', addPieces, { icon: 'plus', kind: 'primary', id: 'outfit-add-pieces' }), mixBtn, UI.btn('Tidy layout', () => {
          st.placed = M.arrange(st.placed);
          st.dirty = true;
          paintStage();
        }, { icon: 'grid', kind: 'ghost' })),
        mixer,
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
      paintMixer();
      /* for the tests */
      V.outfitTools = {
        state: () => st,
        select: (itemId) => select(st.placed.find((p) => p.id === itemId) || null),
        tilt: (deg) => st.selected && turn(st.selected, deg),
        mirror: () => st.selected && mirror(st.selected),
        cycle,
        shuffle,
        openMix: () => {
          if (!st.mix) mixBtn.click();
        }
      };
    }
  };
  const toggleIn = (arr, t, on) => {
    const set = new Set(arr || []);
    if (on) set.add(t);
    else set.delete(t);
    return [...set];
  };
})((window.Wardrobe = window.Wardrobe || {}));
