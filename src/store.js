/* Wardrobe — storage. Everything lives in this browser's IndexedDB: small records (items, outfits,
   days) are kept in memory and written through; photos are stored as blobs and loaded on demand. */
(function (L) {
  'use strict';
  const U = L.util;
  const D = (L.data = {});
  const DB = 'wardrobe';
  const COLLS = ['items', 'outfits', 'days'];
  const state = { db: null, mode: 'memory', colls: {}, prefs: {}, urls: new Map(), listeners: [] };
  for (const c of COLLS) state.colls[c] = new Map();

  const req = (r) =>
    new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Database error'));
    });
  const done = (tx) =>
    new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Database error'));
      tx.onabort = () => reject(tx.error || new Error('Database write was abandoned'));
    });

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('No IndexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const c of COLLS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Could not open the database'));
      r.onblocked = () => reject(new Error('The database is open in another tab'));
    });
  }

  D.open = async () => {
    try {
      state.db = await openDb();
      state.mode = 'local';
      const tx = state.db.transaction([...COLLS, 'meta'], 'readonly');
      for (const c of COLLS) {
        const all = await req(tx.objectStore(c).getAll());
        for (const rec of all) state.colls[c].set(rec.id, rec);
      }
      const prefs = await req(tx.objectStore('meta').get('prefs'));
      state.prefs = (prefs && prefs.value) || {};
      state.db.onversionchange = () => state.db.close();
    } catch (e) {
      console.warn('Wardrobe: using memory only', e);
      state.db = null;
      state.mode = 'memory';
    }
    return state.mode;
  };
  D.mode = () => state.mode;
  D.on = (fn) => state.listeners.push(fn);
  function emit(what, rec) {
    for (const fn of state.listeners) {
      try {
        fn(what, rec);
      } catch (e) {
        console.error(e);
      }
    }
  }

  /* ---------- records ---------- */
  D.list = (coll) => [...state.colls[coll].values()].map((r) => U.clone(r));
  D.get = (coll, id) => (state.colls[coll].has(id) ? U.clone(state.colls[coll].get(id)) : null);
  D.count = (coll) => state.colls[coll].size;
  D.put = async (coll, rec, opts) => {
    opts = opts || {};
    const copy = U.clone(rec);
    if (!copy.id) copy.id = U.uid();
    if (!copy.created) copy.created = U.nowIso();
    copy.updated = U.nowIso();
    state.colls[coll].set(copy.id, copy);
    if (state.db) {
      const tx = state.db.transaction(coll, 'readwrite');
      tx.objectStore(coll).put(copy);
      await done(tx);
    }
    if (!opts.silent) emit(coll, copy);
    return U.clone(copy);
  };
  D.remove = async (coll, id) => {
    state.colls[coll].delete(id);
    if (state.db) {
      const tx = state.db.transaction(coll, 'readwrite');
      tx.objectStore(coll).delete(id);
      await done(tx);
    }
    emit(coll, null);
  };

  /* ---------- preferences ---------- */
  D.prefs = () => U.clone(state.prefs);
  D.setPrefs = async (patch) => {
    Object.assign(state.prefs, patch);
    if (state.db) {
      const tx = state.db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key: 'prefs', value: U.clone(state.prefs) });
      await done(tx);
    }
    emit('prefs');
  };

  /* ---------- photos ---------- */
  const memImages = new Map();
  D.putImage = async (id, blob) => {
    id = id || U.uid();
    if (state.db) {
      const tx = state.db.transaction('images', 'readwrite');
      tx.objectStore('images').put({ id, blob, type: blob.type, size: blob.size });
      await done(tx);
    } else memImages.set(id, blob);
    const old = state.urls.get(id);
    if (old) {
      URL.revokeObjectURL(old);
      state.urls.delete(id);
    }
    return id;
  };
  D.getImage = async (id) => {
    if (!id) return null;
    if (!state.db) return memImages.get(id) || null;
    const tx = state.db.transaction('images', 'readonly');
    const rec = await req(tx.objectStore('images').get(id));
    return rec ? rec.blob : null;
  };
  /* An object URL for a photo, cached for the life of the page. */
  D.imageUrl = async (id) => {
    if (!id) return null;
    if (state.urls.has(id)) return state.urls.get(id);
    const blob = await D.getImage(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    state.urls.set(id, url);
    return url;
  };
  D.removeImage = async (id) => {
    if (!id) return;
    const url = state.urls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      state.urls.delete(id);
    }
    if (state.db) {
      const tx = state.db.transaction('images', 'readwrite');
      tx.objectStore('images').delete(id);
      await done(tx);
    } else memImages.delete(id);
  };
  D.imageIds = async () => {
    if (!state.db) return [...memImages.keys()];
    const tx = state.db.transaction('images', 'readonly');
    return req(tx.objectStore('images').getAllKeys());
  };
  D.usage = async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        return { used: e.usage || 0, quota: e.quota || 0 };
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  };
  D.persist = async () => {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (e) {
      /* ignore */
    }
    return false;
  };

  /* ---------- backup ---------- */
  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  const dataUrlToBlob = async (s) => (await fetch(s)).blob();

  D.exportAll = async (onProgress) => {
    const out = { app: 'wardrobe', format: 1, exported: U.nowIso(), prefs: D.prefs(), images: [] };
    for (const c of COLLS) out[c] = D.list(c);
    const used = new Set();
    for (const it of out.items) for (const k of ['image', 'thumb', 'original']) if (it[k]) used.add(it[k]);
    for (const o of out.outfits) if (o.thumb) used.add(o.thumb);
    let n = 0;
    for (const id of used) {
      const blob = await D.getImage(id);
      if (blob) out.images.push({ id, data: await blobToDataUrl(blob) });
      if (onProgress) onProgress(++n, used.size);
    }
    return out;
  };
  D.importAll = async (data, mode, onProgress) => {
    if (!data || data.app !== 'wardrobe' || !Array.isArray(data.items)) throw new Error('That file isn’t a Wardrobe backup.');
    if (mode === 'replace') {
      for (const c of COLLS) state.colls[c].clear();
      if (state.db) {
        const tx = state.db.transaction([...COLLS, 'images'], 'readwrite');
        for (const c of COLLS) tx.objectStore(c).clear();
        tx.objectStore('images').clear();
        await done(tx);
      } else memImages.clear();
      for (const url of state.urls.values()) URL.revokeObjectURL(url);
      state.urls.clear();
    }
    let n = 0;
    const images = data.images || [];
    for (const im of images) {
      if (im && im.id && typeof im.data === 'string' && im.data.startsWith('data:image/')) await D.putImage(im.id, await dataUrlToBlob(im.data));
      if (onProgress) onProgress(++n, images.length);
    }
    const counts = {};
    for (const c of COLLS) {
      counts[c] = 0;
      for (const rec of data[c] || []) {
        if (!rec || !rec.id) continue;
        const cur = state.colls[c].get(rec.id);
        if (mode !== 'replace' && cur && (cur.updated || '') >= (rec.updated || '')) continue;
        await D.put(c, rec, { silent: true });
        counts[c]++;
      }
    }
    if (data.prefs && typeof data.prefs === 'object') await D.setPrefs(data.prefs);
    emit('import');
    return counts;
  };
  D.wipe = async () => {
    for (const c of COLLS) state.colls[c].clear();
    state.prefs = {};
    for (const url of state.urls.values()) URL.revokeObjectURL(url);
    state.urls.clear();
    memImages.clear();
    if (state.db) {
      const tx = state.db.transaction([...COLLS, 'images', 'meta'], 'readwrite');
      for (const c of [...COLLS, 'images', 'meta']) tx.objectStore(c).clear();
      await done(tx);
    }
    emit('wipe');
  };
})((window.Wardrobe = window.Wardrobe || {}));
