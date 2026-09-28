/* Wardrobe — one item: its page, and adding or editing one from a photo. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const M = L.model;
  const C = L.cutout;
  const K = L.colour;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  /* The editor's tools, like a paint program's palette. */
  const TOOLS = [
    { id: 'wand', label: 'Wand', icon: 'wand', modes: ['remove', 'restore'] },
    { id: 'select', label: 'Select', icon: 'select', modes: ['select'] },
    { id: 'paint', label: 'Paint', icon: 'brush', modes: ['paint'] },
    { id: 'erase', label: 'Eraser', icon: 'eraser', modes: ['erase'] },
    { id: 'keep', label: 'Restore', icon: 'restore', modes: ['keep'] },
    { id: 'crop', label: 'Crop', icon: 'crop', modes: ['crop'] },
    { id: 'pick', label: 'Dropper', icon: 'dropper', modes: ['pick'] }
  ];
  const toolOf = (mode) => TOOLS.find((t) => t.modes.includes(mode)) || TOOLS[0];
  const BRUSHES = [
    { value: 'small', label: 'Small', k: 0.02 },
    { value: 'medium', label: 'Medium', k: 0.045 },
    { value: 'large', label: 'Large', k: 0.08 }
  ];
  const COLOUR_GROUPS = [
    ['Neutrals', ['Black', 'Charcoal', 'Grey', 'Light grey', 'White', 'Cream', 'Beige']],
    ['Earthy', ['Tan', 'Brown', 'Khaki', 'Olive', 'Sage']],
    ['Blues and greens', ['Green', 'Teal', 'Light blue', 'Denim', 'Blue', 'Navy']],
    ['Purples and pinks', ['Lilac', 'Purple', 'Pink', 'Burgundy']],
    ['Warm', ['Red', 'Orange', 'Mustard', 'Yellow']]
  ];

  const colourChip = (c, opts) => {
    opts = opts || {};
    const body = [h('span.swatch', { style: { background: c.hex } }), h('span', c.name)];
    return h(
      'span.colour-chip' + (opts.main ? '.main' : ''),
      opts.onMain ? h('button.chip-main', { type: 'button', title: opts.main ? 'Main colour' : 'Make this the main colour', 'aria-label': c.name + (opts.main ? ', main colour' : ', make main colour'), onclick: opts.onMain }, body) : h('span.chip-main', body),
      opts.onRemove ? h('button.chip-x', { type: 'button', 'aria-label': 'Remove ' + c.name, onclick: opts.onRemove }, UI.icon('x')) : null
    );
  };

  /* Logs an item, several items or an outfit as worn (or planned) on a day. */
  V.logWear = async (day, patch) => {
    const rec = D.get('days', day) || { id: day, day, outfits: [], items: [], note: '' };
    if (patch.item && !rec.items.includes(patch.item)) rec.items.push(patch.item);
    for (const id of patch.items || []) if (!rec.items.includes(id)) rec.items.push(id);
    if (patch.outfit && !rec.outfits.includes(patch.outfit)) rec.outfits.push(patch.outfit);
    await D.put('days', rec);
    const when = day === U.todayKey() ? 'today' : day > U.todayKey() ? 'for ' + U.fmtDayMonth(U.parseDay(day)) : 'on ' + U.fmtDayMonth(U.parseDay(day));
    UI.toast((patch.outfit ? 'Outfit' : patch.items ? 'Pieces' : 'Item') + (day > U.todayKey() ? ' planned ' : ' logged ') + when, { action: { label: 'See day', run: () => R.go('calendar', day) } });
  };
  V.pickDay = (title) =>
    new Promise((resolve) => {
      let day = U.todayKey();
      const input = h('input.input', { type: 'date', value: day, 'data-autofocus': '', onchange: (e) => (day = e.target.value || day) });
      const s = UI.sheet({
        title: title || 'Which day?',
        body: h('div.form', UI.field('Day', input), h('p.hint', 'Today or earlier counts as worn. A later day is a plan.')),
        actions: [UI.btn('Cancel', () => s.close(), { kind: 'ghost' }), UI.btn('Save', () => s.close(/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null), { kind: 'primary' })],
        onClose: (r) => resolve(r || null)
      });
    });

  /* ---------- the item page ---------- */
  V.item = {
    render(root, id) {
      const it = D.get('items', id);
      if (!it) {
        root.appendChild(UI.empty('That item is gone', 'It may have been deleted.', UI.btn('Back to closet', () => R.go('closet'))));
        return;
      }
      const w = M.wears(it.id);
      const cpw = M.costPerWear(it, w.count);
      const outfits = D.list('outfits').filter((o) => (o.items || []).some((x) => x.id === it.id));
      UI.append(
        root,
        h(
          'div.page-head.split',
          h('button.back-btn', { type: 'button', onclick: () => R.back('closet') }, UI.icon('back'), h('span', 'Closet')),
          h(
            'div.topbar-right',
            UI.iconBtn(it.favourite ? 'star-on' : 'star', it.favourite ? 'Remove from favourites' : 'Add to favourites', async () => {
              await D.put('items', Object.assign(it, { favourite: !it.favourite }));
            }, { id: 'item-fav' }),
            UI.iconBtn('edit', 'Edit', () => R.go('edit', it.id), { id: 'item-edit' })
          )
        ),
        h('div.item-hero', UI.pic(it.image, it.name)),
        h('h1.item-name', it.name),
        h('p.item-sub', [it.brand, it.type || M.cat(it.category).one, it.size ? 'size ' + it.size : null].filter(Boolean).join(' · ')),
        it.colours && it.colours.length ? h('div.colour-row', it.colours.map((c) => colourChip(c))) : null,
        (it.seasons || []).length || (it.occasions || []).length ? h('div.tags', (it.seasons || []).concat(it.occasions || []).map((t) => h('span.tag', t))) : null,
        h(
          'div.stats.three',
          h('div.stat', h('span.stat-value', String(w.count)), h('span.stat-label', w.count === 1 ? 'wear' : 'wears')),
          h('div.stat', h('span.stat-value', w.last ? U.relDay(U.parseDay(w.last)) : '–'), h('span.stat-label', 'last worn')),
          h('div.stat', h('span.stat-value', cpw != null ? M.money(Math.round(cpw * 100) / 100) : it.price ? M.money(it.price) : '–'), h('span.stat-label', cpw != null ? 'per wear' : 'price'))
        ),
        h(
          'div.actions',
          UI.btn('Wore it today', () => V.logWear(U.todayKey(), { item: it.id }), { kind: 'primary', icon: 'check', id: 'item-wear' }),
          UI.btn('Another day', async () => {
            const day = await V.pickDay('Worn or planned for');
            if (day) V.logWear(day, { item: it.id });
          }, { kind: 'ghost', icon: 'calendar' })
        ),
        it.price || it.bought ? h('p.muted', [it.price ? 'Paid ' + M.money(it.price) : null, it.bought ? 'bought ' + U.fmtDayMonthYear(U.parseDay(it.bought)) : null].filter(Boolean).join(', ')) : null,
        it.notes ? h('p.prose', it.notes) : null,
        outfits.length
          ? h('div.card', UI.sectionHead('In ' + U.plural(outfits.length, 'outfit')), h('div.outfit-strip', outfits.map((o) => h('button.outfit-mini', { type: 'button', onclick: () => R.go('outfit', o.id), 'aria-label': o.name || 'Outfit' }, UI.pic(o.thumb, ''), h('span', o.name || 'Outfit')))))
          : null,
        h(
          'div.danger-zone',
          UI.btn('Delete this item', async () => {
            const ok = await UI.confirm({ title: 'Delete ' + it.name + '?', body: 'It comes out of your closet, any outfits it is in, and the days it was worn. This can’t be undone.', confirm: 'Delete', danger: true });
            if (!ok) return;
            await V.deleteItem(it);
            R.go('closet');
          }, { kind: 'ghost.danger-text', icon: 'trash', id: 'item-delete' })
        )
      );
    }
  };
  V.deleteItem = async (it) => {
    for (const o of D.list('outfits')) {
      if ((o.items || []).some((x) => x.id === it.id)) {
        o.items = o.items.filter((x) => x.id !== it.id);
        await D.put('outfits', o, { silent: true });
      }
    }
    for (const d of D.list('days')) {
      if ((d.items || []).includes(it.id)) {
        d.items = d.items.filter((x) => x !== it.id);
        await D.put('days', d, { silent: true });
      }
    }
    for (const k of ['image', 'thumb', 'original']) if (it[k]) await D.removeImage(it[k]);
    await D.remove('items', it.id);
  };

  /* ---------- adding or editing ---------- */
  const blank = () => ({ name: '', category: 'tops', type: '', brand: '', size: '', price: '', bought: '', seasons: [], occasions: [], colours: [], notes: '', favourite: false });

  V.edit = {
    live: false,
    render(root, id) {
      const editing = id && id !== 'new' ? D.get('items', id) : null;
      if (id !== 'new' && !editing) {
        root.appendChild(UI.empty('That item is gone', null, UI.btn('Back to closet', () => R.go('closet'))));
        return;
      }
      const st =
        drafts.edit && drafts.edit.id === id
          ? drafts.edit
          : (drafts.edit = {
              id,
              tol: 35,
              mode: 'remove',
              brush: 'medium',
              smart: true,
              paintColour: '#1f2b52',
              paintBlend: 'shade',
              pickFor: 'item',
              history: [],
              canvas: null,
              img: null,
              mask: null,
              sel: null,
              bg: null,
              crop: null,
              guess: null,
              useOriginal: false,
              f: Object.assign(blank(), editing ? U.clone(editing) : {})
            });
      const f = st.f;
      const err = h('p.form-error', { role: 'alert' });
      const photoBox = h('div.photo-box');
      const form = h('div.form');
      let busy = null;
      let setMode = () => {};

      /* ----- photo ----- */
      const pickPhoto = (capture) => {
        const input = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
        if (capture) input.setAttribute('capture', 'environment');
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          input.remove();
          if (file) loadPhoto(file);
        });
        document.body.appendChild(input);
        input.click();
      };
      const cut = () => (st.useOriginal ? st.canvas : C.apply(st.canvas, st.mask));
      const detectColours = () => K.colours(C.crop(cut()), 3, { bg: st.useOriginal ? null : st.bg }).map((c) => ({ hex: c.hex, name: c.name }));
      async function loadPhoto(file) {
        busy = UI.busy('Cutting it out…');
        try {
          await U.sleep(30);
          st.canvas = await C.load(file);
          st.img = st.canvas.getContext('2d').getImageData(0, 0, st.canvas.width, st.canvas.height);
          st.bg = C.background(st.img);
          st.mask = C.auto(st.img, st.tol);
          st.history = [];
          st.crop = null;
          st.sel = null;
          st.mode = 'remove';
          st.useOriginal = C.coverage(st.mask) > 0.985 || C.coverage(st.mask) < 0.01;
          st.preview = null;
          const cutout = C.crop(C.apply(st.canvas, st.mask));
          f.colours = K.colours(cutout, 3, { bg: st.bg }).map((c) => ({ hex: c.hex, name: c.name }));
          st.guess = st.useOriginal ? null : K.guessKind(cutout, f.colours);
          if (st.guess && st.guess.confidence !== 'low' && !editing && !f.type) {
            f.category = st.guess.category;
            f.type = st.guess.type;
          }
        } catch (e) {
          UI.toast((e && e.message) || 'That photo couldn’t be opened.');
        } finally {
          busy.close();
          busy = null;
        }
        paintPhoto();
        paintForm();
      }
      V.edit.loadPhoto = loadPhoto;

      function paintPhoto() {
        UI.clear(photoBox);
        if (!st.canvas) {
          UI.append(
            photoBox,
            editing && editing.image ? h('div.photo-current', UI.pic(editing.image, editing.name)) : h('div.photo-tips', UI.icon('camera'), h('p', 'Lay the item flat on a plain background, like a bed sheet, a wall or the floor, with even light and no shadows across it.')),
            h('div.actions.center', UI.btn(editing ? 'New photo' : 'Take a photo', () => pickPhoto(true), { kind: 'primary', icon: 'camera', id: 'photo-camera' }), UI.btn('Choose a photo', () => pickPhoto(false), { icon: 'image', id: 'photo-pick' }))
          );
          return;
        }
        const view = h('canvas.cut-view', { 'aria-label': 'The cut-out. Use the tools below it.' });
        const over = h('canvas.cut-overlay', { 'aria-hidden': 'true' });
        const wrap = h('div.cut-wrap', view, over);
        const frame = h('div.cut-frame', wrap);
        /* Sizes the picture to fit the screen without letterboxing, so the canvas box is exactly the
           picture and a touch maps straight onto a pixel. */
        function fit() {
          if (!view.isConnected) {
            window.removeEventListener('resize', fit);
            return;
          }
          const availW = frame.clientWidth || photoBox.clientWidth || 360;
          const maxH = Math.max(240, Math.round(window.innerHeight * 0.62));
          const k = Math.min(availW / view.width, maxH / view.height);
          const cw = Math.max(1, Math.round(view.width * k));
          const ch = Math.max(1, Math.round(view.height * k));
          view.style.width = cw + 'px';
          view.style.height = ch + 'px';
          wrap.style.width = cw + 'px';
          wrap.style.height = ch + 'px';
        }
        window.addEventListener('resize', fit);
        const W = () => st.img.width;
        const H = () => st.img.height;
        const octx = () => over.getContext('2d');
        /* image pixels per screen pixel */
        const scale = () => {
          const rect = view.getBoundingClientRect();
          return rect.width ? view.width / rect.width : 1;
        };
        const toImg = (e) => {
          const rect = view.getBoundingClientRect();
          return { x: U.clamp(((e.clientX - rect.left) * view.width) / rect.width, 0, W() - 1), y: U.clamp(((e.clientY - rect.top) * view.height) / rect.height, 0, H() - 1) };
        };
        const corners = (r) => [
          [r.x0, r.y0],
          [r.x1, r.y0],
          [r.x1, r.y1],
          [r.x0, r.y1]
        ];
        let selLayer = null;
        function renderSelection() {
          if (!st.sel) {
            selLayer = null;
            return;
          }
          const w = W();
          const hh = H();
          selLayer = document.createElement('canvas');
          selLayer.width = w;
          selLayer.height = hh;
          const ctx = selLayer.getContext('2d');
          const im = ctx.createImageData(w, hh);
          for (let p = 0, i = 0; p < w * hh; p++, i += 4) {
            if (!st.sel[p]) continue;
            im.data[i] = 40;
            im.data[i + 1] = 120;
            im.data[i + 2] = 255;
            im.data[i + 3] = 120;
          }
          ctx.putImageData(im, 0, 0);
        }
        function drawOverlay() {
          const ctx = octx();
          ctx.clearRect(0, 0, over.width, over.height);
          if (st.useOriginal) return;
          if (st.mode === 'select' && selLayer) ctx.drawImage(selLayer, 0, 0);
          if (st.mode !== 'crop') return;
          const r = st.crop || (st.crop = { x0: 0, y0: 0, x1: W(), y1: H() });
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(0, 0, over.width, r.y0);
          ctx.fillRect(0, r.y1, over.width, over.height - r.y1);
          ctx.fillRect(0, r.y0, r.x0, r.y1 - r.y0);
          ctx.fillRect(r.x1, r.y0, over.width - r.x1, r.y1 - r.y0);
          const s = scale();
          ctx.lineWidth = 2 * s;
          ctx.strokeStyle = '#ffffff';
          ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1.5 * s;
          for (const [x, y] of corners(r)) {
            ctx.beginPath();
            ctx.arc(x, y, 13 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        function draw() {
          const res = cut();
          st.preview = res;
          const shown = C.checker(res);
          view.width = over.width = shown.width;
          view.height = over.height = shown.height;
          view.getContext('2d').drawImage(shown, 0, 0);
          fit();
          drawOverlay();
        }
        const trimHistory = () => {
          while (st.history.length > 8) st.history.shift();
        };
        /* what undo goes back to: the mask alone, or the photo's pixels too after painting */
        const pushHistory = (withPixels) => {
          st.history.push(withPixels ? { img: new ImageData(new Uint8ClampedArray(st.img.data), W(), H()), mask: st.mask.slice() } : st.mask.slice());
          trimHistory();
          undo.disabled = false;
        };
        const radius = () => Math.max(3, Math.round(Math.max(W(), H()) * (BRUSHES.find((b) => b.value === st.brush) || BRUSHES[1]).k));
        function strokeTo(p, first) {
          const r = radius();
          const from = first ? p : st.last;
          const dx = p.x - from.x;
          const dy = p.y - from.y;
          const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r / 2)));
          const mode = st.mode;
          if (mode === 'select' && !st.sel) st.sel = new Uint8Array(W() * H());
          const rgb = mode === 'paint' ? K.parseHex(st.paintColour) || [0, 0, 0] : null;
          for (let i = first ? 0 : 1; i <= n; i++) {
            const x = from.x + (dx * i) / n;
            const y = from.y + (dy * i) / n;
            if (mode === 'select') {
              C.paint(st.sel, W(), H(), x, y, r, 1);
              if (st.smart) C.smartSelect(st.img, st.mask, st.sel, x, y, r * 2.5, Math.max(10, st.tol - 10));
            } else if (mode === 'paint') C.paintColour(st.img, st.mask, x, y, r, rgb, st.paintBlend);
            else C.paint(st.mask, W(), H(), x, y, r, mode === 'keep' ? 1 : 0);
          }
          const ctx = octx();
          ctx.strokeStyle = mode === 'select' ? 'rgba(40, 120, 255, 0.5)' : mode === 'paint' ? st.paintColour : mode === 'keep' ? 'rgba(46, 190, 120, 0.55)' : 'rgba(230, 60, 60, 0.55)';
          ctx.globalAlpha = mode === 'paint' ? 0.85 : 1;
          ctx.lineWidth = r * 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
          st.last = p;
        }
        const BRUSH_MODES = ['erase', 'keep', 'select', 'paint'];
        over.addEventListener('pointerdown', (e) => {
          if (st.useOriginal || (e.button != null && e.button !== 0)) return;
          const p = toImg(e);
          st.down = { x: e.clientX, y: e.clientY };
          if (BRUSH_MODES.includes(st.mode)) {
            e.preventDefault();
            try {
              over.setPointerCapture(e.pointerId);
            } catch (err2) {
              /* synthetic events have no pointer to capture */
            }
            if (st.mode !== 'select') pushHistory(st.mode === 'paint');
            st.painting = true;
            strokeTo(p, true);
          } else if (st.mode === 'crop') {
            e.preventDefault();
            try {
              over.setPointerCapture(e.pointerId);
            } catch (err2) {
              /* ignore */
            }
            const r = st.crop || (st.crop = { x0: 0, y0: 0, x1: W(), y1: H() });
            const grab = 24 * scale();
            const c = corners(r).findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) <= grab);
            st.drag = c >= 0 ? { corner: c } : p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1 ? { move: true, start: p, rect: Object.assign({}, r) } : null;
          }
        });
        over.addEventListener('pointermove', (e) => {
          if (st.painting) strokeTo(toImg(e), false);
          else if (st.drag) {
            const p = toImg(e);
            const r = st.crop;
            if (st.drag.move) {
              const w = st.drag.rect.x1 - st.drag.rect.x0;
              const hh = st.drag.rect.y1 - st.drag.rect.y0;
              r.x0 = U.clamp(st.drag.rect.x0 + (p.x - st.drag.start.x), 0, W() - w);
              r.y0 = U.clamp(st.drag.rect.y0 + (p.y - st.drag.start.y), 0, H() - hh);
              r.x1 = r.x0 + w;
              r.y1 = r.y0 + hh;
            } else {
              const c = st.drag.corner;
              if (c === 0 || c === 3) r.x0 = Math.min(p.x, r.x1 - 20);
              else r.x1 = Math.max(p.x, r.x0 + 20);
              if (c === 0 || c === 1) r.y0 = Math.min(p.y, r.y1 - 20);
              else r.y1 = Math.max(p.y, r.y0 + 20);
            }
            drawOverlay();
          }
        });
        const finishStroke = () => {
          st.painting = false;
          if (st.mode === 'select') {
            renderSelection();
            drawOverlay();
            paintTools();
          } else {
            if (st.mode === 'paint') st.canvas.getContext('2d').putImageData(st.img, 0, 0);
            draw();
          }
        };
        const end = (e) => {
          if (st.painting) finishStroke();
          else if (st.drag) {
            st.drag = null;
            drawOverlay();
          } else if (st.down && (st.mode === 'remove' || st.mode === 'restore' || st.mode === 'pick')) {
            const moved = Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y);
            if (moved <= 8) {
              const p = toImg(e);
              if (st.mode === 'pick') pickAt(p.x, p.y);
              else V.edit.tapAt(p.x, p.y);
            }
          }
          st.down = null;
        };
        over.addEventListener('pointerup', end);
        over.addEventListener('pointercancel', end);

        V.edit.tapAt = (x, y) => {
          pushHistory();
          const changed = C.tap(st.img, st.mask, x, y, st.tol, st.mode === 'remove');
          if (!changed) {
            st.history.pop();
            undo.disabled = !st.history.length;
            UI.toast(st.mode === 'remove' ? 'Nothing to remove there. Tap on part of the item that should go.' : 'Nothing to bring back there.');
            return;
          }
          draw();
        };
        function pickAt(x, y) {
          const rgb = C.sample(st.img, x, y, 5);
          const fixed = K.correct(rgb, st.bg);
          const c = { hex: K.hex(fixed), name: K.name(fixed) };
          if (st.pickFor === 'paint') {
            st.paintColour = K.hex(rgb);
            UI.toast('Brush colour set to ' + c.name);
            setMode('paint');
            return;
          }
          f.colours = (f.colours || []).filter((o) => o.name !== c.name);
          if (f.colours.length >= 3) f.colours.pop();
          f.colours.push(c);
          UI.toast('Added ' + c.name);
          setMode(st.prevMode || 'remove');
          paintForm();
        }
        function useSelection(keepOnly) {
          if (!st.sel) return UI.toast('Brush over the area first.');
          pushHistory();
          const m = st.mask;
          const s = st.sel;
          for (let p = 0; p < m.length; p++) if (keepOnly ? !s[p] : s[p]) m[p] = 0;
          if (keepOnly) C.tidy(m, W(), H());
          st.sel = null;
          selLayer = null;
          draw();
          paintTools();
          UI.toast(keepOnly ? 'Kept just the selected part.' : 'Removed the selected part.');
        }
        function applyCrop() {
          const r = st.crop;
          if (!r || r.x1 - r.x0 < 20 || r.y1 - r.y0 < 20) return;
          st.history.push({ canvas: st.canvas, img: st.img, mask: st.mask });
          trimHistory();
          const res = C.cropRect(st.canvas, st.mask, r);
          st.canvas = res.canvas;
          st.img = res.img;
          st.mask = res.mask;
          st.crop = null;
          st.sel = null;
          st.mode = 'remove';
          paintPhoto();
        }
        const undo = UI.btn('Undo', () => {
          if (!st.history.length) return;
          const entry = st.history.pop();
          if (entry instanceof Uint8Array) {
            st.mask = entry;
            draw();
          } else if (entry.canvas) {
            st.canvas = entry.canvas;
            st.img = entry.img;
            st.mask = entry.mask;
            st.crop = null;
            st.sel = null;
            paintPhoto();
            return;
          } else {
            st.img = entry.img;
            st.mask = entry.mask;
            st.canvas.getContext('2d').putImageData(st.img, 0, 0);
            draw();
          }
          undo.disabled = !st.history.length;
        }, { small: true, icon: 'undo', kind: 'ghost', id: 'cut-undo' });
        undo.disabled = !st.history.length;

        /* ----- the tool palette ----- */
        const hint = h('p.hint');
        const toolsBox = h('div.tool-box');
        const bar = h('div.tool-bar', { role: 'radiogroup', 'aria-label': 'Tool', id: 'cut-tools-bar' });
        for (const t of TOOLS) {
          bar.appendChild(
            h('button.tool-btn', { type: 'button', role: 'radio', 'data-tool': t.id, 'aria-checked': 'false', onclick: () => {
              if (t.id === 'pick') st.pickFor = 'item';
              setMode(t.id === 'wand' ? (st.wand === 'restore' ? 'restore' : 'remove') : t.modes[0]);
            } }, UI.icon(t.icon), h('span', t.label))
          );
        }
        const markTool = () => {
          const active = toolOf(st.mode).id;
          for (const b of bar.children) b.setAttribute('aria-checked', String(b.dataset.tool === active));
        };
        setMode = (v) => {
          st.mode = v;
          if (v !== 'pick') st.prevMode = v;
          if (v === 'crop' && !st.crop) st.crop = { x0: Math.round(W() * 0.05), y0: Math.round(H() * 0.05), x1: Math.round(W() * 0.95), y1: Math.round(H() * 0.95) };
          wrap.style.touchAction = BRUSH_MODES.includes(v) || v === 'crop' ? 'none' : 'manipulation';
          wrap.style.cursor = v === 'pick' ? 'crosshair' : BRUSH_MODES.includes(v) ? 'cell' : v === 'crop' ? 'move' : 'pointer';
          markTool();
          drawOverlay();
          paintTools();
        };
        const brushSize = () => h('div.field', h('span.label', 'Brush size'), UI.pick({ label: 'Brush size', value: st.brush, options: BRUSHES, onChange: (v) => (st.brush = v) }));
        function paintTools() {
          UI.clear(toolsBox);
          const m = st.mode;
          hint.textContent =
            m === 'remove'
              ? 'Tap a part that should go, like leftover background or the rest of an outfit. Similar colours next to it go with it.'
              : m === 'restore'
                ? 'Tap a part of the item that went missing to bring it back.'
                : m === 'select'
                  ? 'Brush over an area to select it; the selection snaps to similar colours. Then keep just that, or remove it.'
                  : m === 'paint'
                    ? 'Brush colour onto the item. Keep shading colours it like dye, so the folds and texture stay.'
                    : m === 'erase'
                      ? 'Drag over anything that shouldn’t be there. It becomes transparent.'
                      : m === 'keep'
                        ? 'Drag over parts of the item that were erased, to bring them back.'
                        : m === 'crop'
                          ? 'Drag the corners round the item, or drag the box to move it, then apply.'
                          : st.pickFor === 'paint'
                            ? 'Tap the photo to pick the brush colour.'
                            : 'Tap the photo where the colour is, and it is added to the item’s colours.';
          if (m === 'remove' || m === 'restore') {
            const tol = h('input.range#cut-tol', { type: 'range', min: '5', max: '90', step: '5', value: String(st.tol), 'aria-label': 'How much a tap takes' });
            tol.addEventListener('change', () => {
              st.tol = Number(tol.value);
              if (!st.history.length) {
                st.mask = C.auto(st.img, st.tol);
                draw();
              } else UI.toast('The next tap will use the new setting.');
            });
            UI.append(
              toolsBox,
              UI.segmented({ label: 'What the wand does', value: m, options: [{ value: 'remove', label: 'Removes' }, { value: 'restore', label: 'Restores' }], onChange: (v) => {
                st.wand = v;
                setMode(v);
              } }),
              h('div.range-row', h('span.label', 'Less'), tol, h('span.label', 'More'))
            );
          } else if (m === 'erase' || m === 'keep') {
            toolsBox.appendChild(brushSize());
          } else if (m === 'select') {
            const has = !!st.sel;
            UI.append(
              toolsBox,
              brushSize(),
              h('label.check-row', h('input#sel-smart', { type: 'checkbox', checked: st.smart, onchange: (e) => (st.smart = e.target.checked) }), h('span', 'Snap to similar colours')),
              h(
                'div.actions',
                UI.btn('Keep only this', () => useSelection(true), { small: true, kind: 'primary', icon: 'check', id: 'sel-keep', disabled: !has }),
                UI.btn('Remove this', () => useSelection(false), { small: true, kind: 'ghost', icon: 'eraser', id: 'sel-remove', disabled: !has }),
                UI.btn('Clear', () => {
                  st.sel = null;
                  selLayer = null;
                  drawOverlay();
                  paintTools();
                }, { small: true, kind: 'ghost', id: 'sel-clear', disabled: !has })
              )
            );
          } else if (m === 'paint') {
            UI.append(
              toolsBox,
              h(
                'div.field',
                h('span.label', 'Brush colour'),
                h(
                  'div.colour-row',
                  h('button.colour-chip.chip-main#paint-colour', { type: 'button', 'aria-label': 'Change the brush colour', onclick: () => colourSheet((c) => {
                    st.paintColour = c.hex;
                    paintTools();
                  }) }, h('span.swatch', { style: { background: st.paintColour } }), h('span', K.name(K.parseHex(st.paintColour) || [0, 0, 0]))),
                  h('button.chip.chip-add#paint-pick', { type: 'button', onclick: () => {
                    st.pickFor = 'paint';
                    setMode('pick');
                  } }, UI.icon('dropper'), h('span', 'From the photo'))
                )
              ),
              brushSize(),
              h('div.field', h('span.label', 'Blend'), UI.segmented({ label: 'Blend', value: st.paintBlend, options: [{ value: 'shade', label: 'Keep shading' }, { value: 'solid', label: 'Solid' }], onChange: (v) => (st.paintBlend = v) }))
            );
          } else if (m === 'crop') {
            toolsBox.appendChild(h('div.actions', UI.btn('Apply crop', applyCrop, { small: true, kind: 'primary', icon: 'check', id: 'crop-apply' }), UI.btn('Reset', () => {
              st.crop = null;
              drawOverlay();
            }, { small: true, kind: 'ghost' })));
          }
        }
        const tools = h(
          'div.cut-tools',
          { hidden: st.useOriginal },
          bar,
          hint,
          toolsBox,
          h(
            'div.actions',
            undo,
            UI.btn('Remove skin', () => {
              pushHistory();
              const n = C.skin(st.img, st.mask);
              if (!n) {
                st.history.pop();
                undo.disabled = !st.history.length;
                UI.toast('No skin found in the cut-out.');
                return;
              }
              C.tidy(st.mask, W(), H());
              draw();
              UI.toast('Skin removed. Undo if it took too much.');
            }, { small: true, kind: 'ghost', icon: 'eraser', id: 'cut-skin' }),
            UI.btn('Detect colours again', () => {
              f.colours = detectColours();
              paintForm();
            }, { small: true, icon: 'palette', kind: 'ghost' })
          )
        );
        const original = h('label.check-row', h('input#cut-original', { type: 'checkbox', checked: st.useOriginal, onchange: (e) => {
          st.useOriginal = e.target.checked;
          tools.hidden = st.useOriginal;
          draw();
        } }), h('span', 'Keep the whole photo instead'));
        UI.append(photoBox, frame, tools, original, h('div.actions', UI.btn('Different photo', () => pickPhoto(false), { small: true, icon: 'image', kind: 'ghost' }), UI.btn('Retake', () => pickPhoto(true), { small: true, icon: 'camera', kind: 'ghost' })));
        renderSelection();
        draw();
        requestAnimationFrame(fit);
        setMode(st.mode === 'pick' ? st.prevMode || 'remove' : st.mode);
        /* for the tests */
        V.edit.tools = {
          stroke: (mode, pts) => {
            setMode(mode);
            if (mode !== 'select') pushHistory(mode === 'paint');
            pts.forEach((p, i) => strokeTo(p, i === 0));
            finishStroke();
          },
          keepSelected: () => useSelection(true),
          removeSelected: () => useSelection(false),
          crop: (r) => {
            st.crop = r;
            applyCrop();
          },
          skin: () => tools.querySelector('#cut-skin').click(),
          pick: (x, y) => pickAt(x, y),
          setMode,
          undo: () => undo.click(),
          overlay: over
        };
      }

      /* ----- details ----- */
      const suggestName = () => {
        const colour = f.colours && f.colours[0] ? f.colours[0].name : '';
        const what = f.type || M.cat(f.category).one;
        return (colour + ' ' + what).trim();
      };
      function paintForm() {
        UI.clear(form);
        const cat = M.cat(f.category);
        const nameIn = h('input.input#f-name', { type: 'text', maxlength: 60, value: f.name, placeholder: suggestName() || 'What is it?', oninput: (e) => (f.name = e.target.value) });
        const g = st.guess;
        const article = (t) => (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + (/^[A-Z]-/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
        UI.append(
          form,
          g && g.confidence !== 'low' && !editing ? h('p.hint.guess-note', { id: 'guess-note' }, 'Looks like ' + (g.type === 'Trainers' ? 'shoes' : g.type === 'Shorts' || g.type === 'Trousers' || g.type === 'Jeans' ? g.type.toLowerCase() : article(g.type)) + ', going by its ' + g.why + '. Change it below if that’s wrong.') : null,
          UI.field('Name', nameIn),
          h(
            'div.grid-2',
            UI.field(
              'Category',
              UI.select({
                label: 'Category',
                id: 'f-category',
                value: f.category,
                options: M.CATEGORIES.map((c) => ({ value: c.v, label: c.label })),
                onChange: (v) => {
                  f.category = v;
                  f.type = '';
                  paintForm();
                }
              })
            ),
            UI.field('Brand (optional)', h('input.input#f-brand', { type: 'text', maxlength: 40, value: f.brand, oninput: (e) => (f.brand = e.target.value) }))
          ),
          h(
            'div.field',
            h('span.label', 'Type'),
            UI.chips({
              label: 'Type',
              options: cat.types.concat(f.type && !cat.types.includes(f.type) ? [f.type] : []),
              selected: new Set(f.type ? [f.type] : []),
              onToggle: (t, on) => {
                f.type = on ? t : '';
                form.querySelectorAll('.chips[aria-label="Type"] .chip[aria-pressed="true"]').forEach((c) => {
                  if (c.textContent !== t) c.setAttribute('aria-pressed', 'false');
                });
                if (!nameIn.value) nameIn.placeholder = suggestName() || 'What is it?';
              },
              custom: {
                label: 'Something else',
                onAdd: (t) => {
                  f.type = t;
                  paintForm();
                }
              }
            })
          ),
          h(
            'div.field',
            h('span.label', 'Colours'),
            (f.colours || []).length > 1 ? h('span.help', 'The first one is the main colour. Tap another to make it the main one.') : null,
            h(
              'div.colour-row',
              (f.colours || []).map((c, i) =>
                colourChip(c, {
                  main: i === 0,
                  onMain: () => {
                    if (i === 0) return;
                    f.colours.splice(i, 1);
                    f.colours.unshift(c);
                    paintForm();
                  },
                  onRemove: () => {
                    f.colours.splice(i, 1);
                    paintForm();
                  }
                })
              ),
              (f.colours || []).length < 3
                ? h('button.chip.chip-add#colour-add', { type: 'button', onclick: () => colourSheet((c) => {
                  f.colours = (f.colours || []).filter((o) => o.name !== c.name).concat([c]);
                  paintForm();
                }) }, UI.icon('plus'), h('span', 'Choose a colour'))
                : null,
              st.canvas && !st.useOriginal
                ? h('button.chip.chip-add#colour-pick', { type: 'button', onclick: () => {
                  st.pickFor = 'item';
                  setMode('pick');
                  UI.toast('Tap the photo where the colour is.');
                  photoBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } }, UI.icon('dropper'), h('span', 'Pick from the photo'))
                : null
            )
          ),
          h(
            'div.grid-3',
            UI.field('Size', h('input.input#f-size', { type: 'text', maxlength: 12, value: f.size, placeholder: 'M, 10, 42…', oninput: (e) => (f.size = e.target.value) })),
            UI.field('Price', h('input.input#f-price', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: f.price, oninput: (e) => (f.price = e.target.value) })),
            UI.field('Bought', h('input.input#f-bought', { type: 'date', value: f.bought, onchange: (e) => (f.bought = e.target.value) }))
          ),
          h('div.field', h('span.label', 'Seasons'), UI.chips({ label: 'Seasons', options: M.SEASONS, selected: new Set(f.seasons || []), onToggle: (t, on) => toggleIn(f, 'seasons', t, on) })),
          h('div.field', h('span.label', 'Occasions'), UI.chips({ label: 'Occasions', options: M.OCCASIONS, selected: new Set(f.occasions || []), onToggle: (t, on) => toggleIn(f, 'occasions', t, on) })),
          UI.field('Notes (optional)', UI.autoGrow(h('textarea.input#f-notes', { rows: 2, maxlength: 500, value: f.notes, oninput: (e) => (f.notes = e.target.value) }))),
          h('label.check-row', h('input', { type: 'checkbox', checked: !!f.favourite, onchange: (e) => (f.favourite = e.target.checked) }), h('span', 'Favourite'))
        );
      }
      const toggleIn = (obj, key, t, on) => {
        const set = new Set(obj[key] || []);
        if (on) set.add(t);
        else set.delete(t);
        obj[key] = [...set];
      };

      /* ----- save ----- */
      async function save() {
        f.name = (f.name || '').trim() || suggestName();
        if (!f.name) return (err.textContent = 'Give it a name, or choose a type.');
        if (!st.canvas && !(editing && editing.image)) return (err.textContent = 'Add a photo first.');
        if (f.price !== '' && f.price != null && !(Number(f.price) >= 0)) return (err.textContent = 'The price should be a number.');
        busy = UI.busy('Saving…');
        try {
          await U.sleep(20);
          let image = editing ? editing.image : null;
          let thumb = editing ? editing.thumb : null;
          if (st.canvas) {
            const final = st.useOriginal ? st.canvas : C.crop(C.apply(st.canvas, st.mask));
            const blob = st.useOriginal ? await C.toBlob(final, 'image/jpeg', 0.86) : await C.toBlob(final, 'image/png');
            const tb = await C.toBlob(C.thumb(final, 360), st.useOriginal ? 'image/jpeg' : 'image/png', 0.86);
            const newImage = await D.putImage(null, blob);
            const newThumb = await D.putImage(null, tb);
            if (image) await D.removeImage(image);
            if (thumb) await D.removeImage(thumb);
            image = newImage;
            thumb = newThumb;
          }
          const rec = Object.assign({}, editing || {}, f, { image, thumb, price: f.price === '' || f.price == null ? null : Number(f.price), status: 'active' });
          const saved = await D.put('items', rec);
          drafts.edit = null;
          UI.toast(editing ? 'Saved' : 'Added to your closet');
          R.go('item', saved.id, { replace: true });
        } catch (e) {
          console.error(e);
          err.textContent = (e && e.message) || 'Saving failed.';
        } finally {
          if (busy) busy.close();
          busy = null;
        }
      }

      UI.append(
        root,
        h(
          'div.page-head.split',
          h('button.back-btn', { type: 'button', onclick: () => {
            drafts.edit = null;
            R.back('closet');
          } }, UI.icon('back'), h('span', 'Cancel')),
          h('h1.page-title.small', editing ? 'Edit item' : 'New item')
        ),
        photoBox,
        form,
        err,
        h('div.actions', UI.btn(editing ? 'Save changes' : 'Add to closet', save, { kind: 'primary', block: true, id: 'item-save' }))
      );
      paintPhoto();
      paintForm();
    }
  };

  function colourSheet(onPick) {
    const s = UI.sheet({
      title: 'Choose a colour',
      body: h(
        'div.colour-groups',
        COLOUR_GROUPS.map(([title, names]) =>
          h(
            'div.colour-group',
            h('h3.mini-title', title),
            h('div.colour-grid', names.map((n) => h('button.colour-opt', { type: 'button', onclick: () => {
              s.close();
              onPick({ hex: K.hexOfName(n), name: n });
            } }, h('span.swatch.big', { style: { background: K.hexOfName(n) } }), h('span', n))))
          )
        )
      )
    });
  }
})((window.Wardrobe = window.Wardrobe || {}));
