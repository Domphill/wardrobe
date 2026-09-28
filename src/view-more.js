/* Wardrobe — More: backup and restore, appearance, storage, about. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const V = (L.views = L.views || {});

  const mb = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' MB' : Math.round(n / 1e3) + ' KB');

  V.plusMenu = () => {
    const s = UI.sheet({
      title: 'Add',
      body: h(
        'div.plus-menu',
        [
          ['camera', 'Add clothing', 'Photograph a piece and cut out the background', () => R.go('edit', 'new')],
          ['hanger', 'New outfit', 'Put pieces together and save the combination', () => R.go('outfit', 'new')],
          ['calendar', 'Log today', 'What you are wearing today', () => R.go('calendar', U.todayKey())]
        ].map(([ic, title, sub, go]) =>
          h('button.plus-item', { type: 'button', onclick: () => {
            s.close();
            go();
          } }, UI.icon(ic), h('span.plus-text', h('span.plus-title', title), h('span.plus-sub', sub)), UI.icon('chev'))
        )
      )
    });
  };

  function weatherCard(prefs) {
    const W = L.weather;
    const place = prefs.place;
    const results = h('div.town-results');
    const input = h('input.input#town-q', { type: 'search', placeholder: 'Town or city', 'aria-label': 'Town or city', autocomplete: 'off' });
    const find = async () => {
      const q = input.value.trim();
      if (q.length < 2) return;
      UI.clear(results);
      results.appendChild(h('p.hint', 'Searching…'));
      try {
        const found = await W.geocode(q);
        UI.clear(results);
        if (!found.length) results.appendChild(h('p.hint', 'No town by that name. Try the nearest bigger town.'));
        for (const p of found) {
          results.appendChild(
            h('button.town-opt', { type: 'button', onclick: async () => {
              await D.setPrefs({ place: p });
              W.clearCache();
              if (L.drafts.today) L.drafts.today = null;
              UI.toast('Weather set to ' + p.name);
            } }, UI.icon('pin'), h('span', h('strong', p.name), p.region ? h('span.muted', ' · ' + p.region) : null))
          );
        }
      } catch (e) {
        UI.clear(results);
        results.appendChild(h('p.hint', navigator.onLine === false ? 'You’re offline. Try again when you have a connection.' : (e && e.message) || 'The search failed.'));
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        find();
      }
    });
    return h(
      'div.card',
      UI.sectionHead('Weather'),
      h('p.muted', place ? 'Forecasts for ' + place.name + (place.region ? ', ' + place.region : '') + '. The Closet page suggests outfits for the day’s weather.' : 'Add your town and the Closet page suggests outfits for the day’s weather.'),
      h('div.inline-form', input, UI.btn('Find', find, { small: true, id: 'town-find' })),
      results,
      h('div.field', h('span.label', 'Temperatures'), UI.segmented({ label: 'Temperature unit', value: prefs.tempUnit || 'C', options: [{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }], onChange: (v) => D.setPrefs({ tempUnit: v }) })),
      place
        ? UI.btn('Stop using the weather', async () => {
            await D.setPrefs({ place: null });
            W.clearCache();
            L.drafts.today = null;
          }, { small: true, kind: 'ghost' })
        : null,
      h('p.fineprint', 'Forecasts come from Open-Meteo, a free weather service. Only the town’s map position is sent, and only when the Closet page opens; nothing about you or your clothes.')
    );
  }

  V.more = {
    render(root) {
      const prefs = D.prefs();
      root.appendChild(h('div.page-head', h('h1.page-title', 'More')));
      const usage = h('p.muted', 'Working out how much space your photos use…');
      D.usage().then((u) => {
        usage.textContent = u && u.used ? 'Wardrobe is using about ' + mb(u.used) + (u.quota ? ' of the ' + mb(u.quota) + ' this browser allows.' : '.') : 'Storage use isn’t reported by this browser.';
      });
      UI.append(root, 
        h(
          'div.card',
          UI.sectionHead('Backup'),
          h('p.muted', 'Everything is on this device only. A backup file holds all your items, photos, outfits and calendar, and can be restored on another phone or after a reset.'),
          h(
            'div.actions',
            UI.btn('Download a backup', async () => {
              const busy = UI.busy('Packing your wardrobe…');
              try {
                const data = await D.exportAll((n, t) => busy.text('Packing photos ' + n + ' of ' + t + '…'));
                busy.close();
                const r = await UI.download('wardrobe-backup-' + U.todayKey() + '.json', JSON.stringify(data), 'application/json');
                if (r === 'saved') UI.toast('Backup ready. Keep it somewhere safe, like Files or iCloud Drive.');
              } catch (e) {
                busy.close();
                UI.toast((e && e.message) || 'The backup failed.');
              }
            }, { kind: 'primary', icon: 'download', id: 'backup-save' }),
            UI.btn('Restore from a backup', async () => {
              const picked = await UI.pickFile('.json,application/json');
              if (!picked) return;
              let data;
              try {
                data = JSON.parse(picked.text);
              } catch (e) {
                UI.toast('That file isn’t a Wardrobe backup.');
                return;
              }
              const n = (data.items || []).length;
              const replace = D.count('items')
                ? await UI.confirm({ title: 'Restore ' + U.plural(n, 'item') + '?', body: 'Add them to what is already here, keeping the newest copy of anything that appears in both. To wipe this device first, choose Replace.', confirm: 'Replace everything', cancel: 'Add to mine', danger: true })
                : false;
              const busy = UI.busy('Restoring…');
              try {
                const counts = await D.importAll(data, replace ? 'replace' : 'merge', (i, t) => busy.text('Restoring photos ' + i + ' of ' + t + '…'));
                busy.close();
                UI.toast('Restored ' + U.plural(counts.items, 'item') + ', ' + U.plural(counts.outfits, 'outfit') + ' and ' + U.plural(counts.days, 'day') + '.');
                R.go('closet');
              } catch (e) {
                busy.close();
                UI.toast((e && e.message) || 'The restore failed.');
              }
            }, { icon: 'upload', id: 'backup-restore' })
          ),
          usage
        ),
        h(
          'div.card',
          UI.sectionHead('Keep your photos safe'),
          h('p.muted', L.env.ios && !L.env.standalone ? 'On an iPhone, Safari can clear a website’s saved data if it isn’t opened for a while. Adding Wardrobe to your Home Screen (Share, then Add to Home Screen) stops that, and a backup now and then covers everything else.' : L.env.standalone ? 'Wardrobe is installed, so the browser keeps its data. A backup now and then covers a lost or reset phone.' : 'Clearing this browser’s site data would erase your wardrobe. Add it to your home screen and take a backup now and then.')
        ),
        weatherCard(prefs),
        h(
          'div.card',
          UI.sectionHead('Appearance'),
          h('div.field', h('span.label', 'Theme'), UI.segmented({ label: 'Theme', value: prefs.theme || 'system', options: [{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], onChange: async (v) => {
            await D.setPrefs({ theme: v });
            L.app.applyTheme(v);
          } })),
          h('div.field', h('span.label', 'Currency'), UI.segmented({ label: 'Currency', value: prefs.currency || '£', options: ['£', '€', '$'].map((c) => ({ value: c, label: c })), onChange: (v) => D.setPrefs({ currency: v }) }))
        ),
        h(
          'div.card',
          UI.sectionHead('About'),
          h('p.muted', 'Wardrobe keeps your clothes, outfits and what you wore, all on this device. No account, no server, nothing sent anywhere. Version ' + L.VERSION + '.'),
          h('p.fineprint', 'Cut-outs work best on photos taken against a plain background. The colours it detects are a starting point; change them if they look wrong.')
        ),
        h(
          'div.danger-zone',
          UI.btn('Delete everything', async () => {
            const ok = await UI.confirm({ title: 'Delete your whole wardrobe?', body: 'Every item, photo, outfit and calendar day on this device. Take a backup first if there is any doubt.', confirm: 'Delete everything', danger: true, typed: 'DELETE' });
            if (!ok) return;
            await D.wipe();
            await D.setPrefs({ onboarded: true });
            UI.toast('Everything has been deleted.');
            R.go('closet');
          }, { kind: 'ghost.danger-text', icon: 'trash' })
        )
      );
    }
  };
})((window.Wardrobe = window.Wardrobe || {}));
