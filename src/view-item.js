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
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  const colourChip = (c, onRemove) =>
    h('span.colour-chip', h('span.swatch', { style: { background: c.hex } }), h('span', c.name), onRemove ? h('button.chip-x', { type: 'button', 'aria-label': 'Remove ' + c.name, onclick: onRemove }, UI.icon('x')) : null);

  /* Logs an item or outfit as worn (or planned) on a day. */
  V.logWear = async (day, patch) => {
    const rec = D.get('days', day) || { id: day, day, outfits: [], items: [], note: '' };
    if (patch.item && !rec.items.includes(patch.item)) rec.items.push(patch.item);
    if (patch.outfit && !rec.outfits.includes(patch.outfit)) rec.outfits.push(patch.outfit);
    await D.put('days', rec);
    const when = day === U.todayKey() ? 'today' : day > U.todayKey() ? 'for ' + U.fmtDayMonth(U.parseDay(day)) : 'on ' + U.fmtDayMonth(U.parseDay(day));
    UI.toast((patch.outfit ? 'Outfit' : 'Item') + (day > U.todayKey() ? ' planned ' : ' logged ') + when, { action: { label: 'See day', run: () => R.go('calendar', day) } });
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
      UI.append(root, 
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
          : (drafts.edit = { id, tol: 35, mode: 'remove', history: [], canvas: null, img: null, mask: null, useOriginal: false, f: Object.assign(blank(), editing ? U.clone(editing) : {}) });
      const f = st.f;
      const err = h('p.form-error', { role: 'alert' });
      const photoBox = h('div.photo-box');
      const form = h('div.form');
      let busy = null;

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
      async function loadPhoto(file) {
        busy = UI.busy('Cutting it out…');
        try {
          await U.sleep(30);
          st.canvas = await C.load(file);
          st.img = st.canvas.getContext('2d').getImageData(0, 0, st.canvas.width, st.canvas.height);
          st.mask = C.auto(st.img, st.tol);
          st.history = [];
          st.useOriginal = C.coverage(st.mask) > 0.985 || C.coverage(st.mask) < 0.01;
          st.preview = null;
          f.colours = C.colours(C.apply(st.canvas, st.mask)).slice(0, 3).map((c) => ({ hex: c.hex, name: c.name }));
          if (!f.name && f.type) f.name = suggestName();
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
      const cut = () => (st.useOriginal ? st.canvas : C.apply(st.canvas, st.mask));
      function paintPhoto() {
        UI.clear(photoBox);
        if (!st.canvas) {
          UI.append(photoBox, 
            editing && editing.image ? h('div.photo-current', UI.pic(editing.image, editing.name)) : h('div.photo-tips', UI.icon('camera'), h('p', 'Lay the item flat on a plain background, like a bed sheet, a wall or the floor, with even light and no shadows across it.')),
            h('div.actions.center', UI.btn(editing ? 'New photo' : 'Take a photo', () => pickPhoto(true), { kind: 'primary', icon: 'camera', id: 'photo-camera' }), UI.btn('Choose a photo', () => pickPhoto(false), { icon: 'image', id: 'photo-pick' }))
          );
          return;
        }
        const view = h('canvas.cut-view', { 'aria-label': 'The cut-out. Tap to remove or bring back an area.' });
        const draw = () => {
          const res = cut();
          st.preview = res;
          const shown = C.checker(res);
          view.width = shown.width;
          view.height = shown.height;
          view.getContext('2d').drawImage(shown, 0, 0);
        };
        draw();
        let downAt = null;
        view.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
        view.addEventListener('pointerup', (e) => {
          if (!downAt || st.useOriginal) return;
          const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
          downAt = null;
          if (moved > 8) return;
          const rect = view.getBoundingClientRect();
          const x = ((e.clientX - rect.left) * view.width) / rect.width;
          const y = ((e.clientY - rect.top) * view.height) / rect.height;
          V.edit.tapAt(x, y);
        });
        V.edit.tapAt = (x, y) => {
          st.history.push(st.mask.slice());
          if (st.history.length > 8) st.history.shift();
          const changed = C.tap(st.img, st.mask, x, y, st.tol, st.mode === 'remove');
          if (!changed) {
            st.history.pop();
            UI.toast(st.mode === 'remove' ? 'Nothing to remove there. Tap on part of the item that should go.' : 'Nothing to bring back there.');
            return;
          }
          draw();
          undo.disabled = !st.history.length;
        };
        const undo = UI.btn('Undo', () => {
          if (!st.history.length) return;
          st.mask = st.history.pop();
          draw();
          undo.disabled = !st.history.length;
        }, { small: true, icon: 'undo', kind: 'ghost', id: 'cut-undo' });
        undo.disabled = !st.history.length;
        const tol = h('input.range#cut-tol', { type: 'range', min: '5', max: '90', step: '5', value: String(st.tol), 'aria-label': 'How much to remove' });
        tol.addEventListener('change', () => {
          st.tol = Number(tol.value);
          st.history = [];
          st.mask = C.auto(st.img, st.tol);
          draw();
          undo.disabled = true;
        });
        const modeSeg = UI.segmented({
          label: 'What a tap does',
          value: st.mode,
          options: [
            { value: 'remove', label: 'Tap removes' },
            { value: 'restore', label: 'Tap brings back' }
          ],
          onChange: (v) => (st.mode = v)
        });
        const original = h('label.check-row', h('input#cut-original', { type: 'checkbox', checked: st.useOriginal, onchange: (e) => {
          st.useOriginal = e.target.checked;
          draw();
          tools.hidden = st.useOriginal;
        } }), h('span', 'Keep the whole photo instead'));
        const tools = h(
          'div.cut-tools',
          { hidden: st.useOriginal },
          h('p.hint', 'The background has been removed. If some of it is left, tap it. If part of the item went missing, switch to bring back and tap it.'),
          modeSeg,
          h('div.range-row', h('span.label', 'Less'), tol, h('span.label', 'More')),
          h('div.actions', undo, UI.btn('Detect colours again', () => {
            f.colours = C.colours(cut()).slice(0, 3).map((c) => ({ hex: c.hex, name: c.name }));
            paintForm();
          }, { small: true, icon: 'palette', kind: 'ghost' }))
        );
        UI.append(photoBox, 
          h('div.cut-wrap', view),
          tools,
          original,
          h('div.actions', UI.btn('Different photo', () => pickPhoto(false), { small: true, icon: 'image', kind: 'ghost' }), UI.btn('Retake', () => pickPhoto(true), { small: true, icon: 'camera', kind: 'ghost' }))
        );
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
        UI.append(form, 
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
            h(
              'div.colour-row',
              (f.colours || []).map((c, i) =>
                colourChip(c, () => {
                  f.colours.splice(i, 1);
                  paintForm();
                })
              ),
              (f.colours || []).length < 3
                ? h('button.chip.chip-add', { type: 'button', onclick: () => colourSheet((c) => {
                  f.colours = (f.colours || []).concat([c]);
                  paintForm();
                }) }, UI.icon('plus'), h('span', 'Add a colour'))
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
        if (f.price !== '' && !(Number(f.price) >= 0)) return (err.textContent = 'The price should be a number.');
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
          const rec = Object.assign({}, editing || {}, f, { image, thumb, price: f.price === '' ? null : Number(f.price), status: 'active' });
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

      UI.append(root, 
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
      title: 'Add a colour',
      body: h('div.colour-grid', C.NAMES.map((n) => h('button.colour-opt', { type: 'button', onclick: () => {
        s.close();
        onPick({ hex: C.hexOfName(n[0]), name: n[0] });
      } }, h('span.swatch.big', { style: { background: C.hexOfName(n[0]) } }), h('span', n[0]))))
    });
  }
})((window.Wardrobe = window.Wardrobe || {}));
