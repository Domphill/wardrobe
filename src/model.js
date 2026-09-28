/* Wardrobe — what the records mean: categories, wear counts, cost per wear, search and filters. */
(function (L) {
  'use strict';
  const U = L.util;
  const D = L.data;
  const M = (L.model = {});

  M.CATEGORIES = [
    { v: 'tops', label: 'Tops', one: 'Top', types: ['T-shirt', 'Shirt', 'Blouse', 'Jumper', 'Hoodie', 'Sweatshirt', 'Cardigan', 'Vest', 'Polo', 'Top'] },
    { v: 'bottoms', label: 'Bottoms', one: 'Bottoms', types: ['Jeans', 'Trousers', 'Shorts', 'Skirt', 'Joggers', 'Leggings', 'Chinos', 'Cargo trousers'] },
    { v: 'dresses', label: 'Dresses', one: 'Dress', types: ['Dress', 'Jumpsuit', 'Playsuit', 'Co-ord'] },
    { v: 'outerwear', label: 'Outerwear', one: 'Outerwear', types: ['Jacket', 'Coat', 'Blazer', 'Gilet', 'Raincoat', 'Puffer', 'Overshirt'] },
    { v: 'shoes', label: 'Shoes', one: 'Shoes', types: ['Trainers', 'Boots', 'Sandals', 'Heels', 'Flats', 'Loafers', 'Slippers', 'Sliders'] },
    { v: 'bags', label: 'Bags', one: 'Bag', types: ['Handbag', 'Backpack', 'Tote', 'Crossbody', 'Clutch', 'Holdall'] },
    { v: 'accessories', label: 'Accessories', one: 'Accessory', types: ['Hat', 'Cap', 'Scarf', 'Belt', 'Sunglasses', 'Gloves', 'Watch', 'Tie'] },
    { v: 'jewellery', label: 'Jewellery', one: 'Jewellery', types: ['Necklace', 'Earrings', 'Ring', 'Bracelet'] },
    { v: 'other', label: 'Other', one: 'Item', types: ['Underwear', 'Socks', 'Swimwear', 'Sportswear', 'Nightwear', 'Other'] }
  ];
  M.SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  M.OCCASIONS = ['Everyday', 'Work', 'Smart', 'Night out', 'Sport', 'Holiday', 'Home'];
  M.SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  M.cat = (v) => M.CATEGORIES.find((c) => c.v === v) || M.CATEGORIES[M.CATEGORIES.length - 1];
  M.catLabel = (v) => M.cat(v).label;

  M.money = (n) => {
    if (n == null || n === '' || isNaN(Number(n))) return '';
    const sym = (D.prefs().currency || '£').trim();
    const x = Number(n);
    const s = Number.isInteger(x) ? String(x) : x.toFixed(2);
    return sym + s;
  };

  /* ---------- what was worn ----------
     A day record lists outfits and single items worn (or planned) that day. */
  M.dayItemIds = (day) => {
    const ids = new Set();
    if (!day) return ids;
    for (const id of day.items || []) ids.add(id);
    for (const oid of day.outfits || []) {
      const o = D.get('outfits', oid);
      if (o) for (const x of o.items || []) ids.add(x.id);
    }
    return ids;
  };
  /* Per item: how often it has been worn up to today, and when last. */
  M.wearMap = () => {
    const today = U.todayKey();
    const map = new Map();
    const outfitMap = new Map();
    for (const day of D.list('days')) {
      if (day.id > today) continue;
      for (const id of M.dayItemIds(day)) {
        const w = map.get(id) || { count: 0, last: null };
        w.count++;
        if (!w.last || day.id > w.last) w.last = day.id;
        map.set(id, w);
      }
      for (const oid of day.outfits || []) {
        const w = outfitMap.get(oid) || { count: 0, last: null };
        w.count++;
        if (!w.last || day.id > w.last) w.last = day.id;
        outfitMap.set(oid, w);
      }
    }
    M._outfitWears = outfitMap;
    return map;
  };
  M.wears = (itemId) => M.wearMap().get(itemId) || { count: 0, last: null };
  M.outfitWears = (outfitId) => {
    M.wearMap();
    return M._outfitWears.get(outfitId) || { count: 0, last: null };
  };
  M.costPerWear = (item, wears) => {
    const price = Number(item.price);
    if (!(price > 0)) return null;
    return price / Math.max(1, wears);
  };
  M.daysSince = (dayKey) => (dayKey ? U.dayDiff(dayKey, U.todayKey()) : null);

  /* ---------- finding things ---------- */
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  M.search = (items, q) => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((it) => {
      const hay = norm([it.name, it.brand, it.type, M.catLabel(it.category), (it.colours || []).map((c) => c.name).join(' '), (it.occasions || []).join(' '), it.notes].join(' '));
      return words.every((w) => hay.includes(w));
    });
  };
  M.filter = (items, f) => {
    f = f || {};
    const wears = f.unworn || f.never || f.sort === 'most' || f.sort === 'least' ? M.wearMap() : null;
    let out = items.filter((it) => {
      if (f.cat && f.cat !== 'all' && it.category !== f.cat) return false;
      if (f.colour && !(it.colours || []).some((c) => c.name === f.colour)) return false;
      if (f.season && !(it.seasons || []).includes(f.season)) return false;
      if (f.occasion && !(it.occasions || []).includes(f.occasion)) return false;
      if (f.favourites && !it.favourite) return false;
      if (f.never && wears.has(it.id)) return false;
      if (f.unworn) {
        const w = wears.get(it.id);
        if (w && w.last && M.daysSince(w.last) < 90) return false;
      }
      return true;
    });
    const count = (it) => ((wears && wears.get(it.id)) || { count: 0 }).count;
    const sorters = {
      newest: U.byDesc((it) => it.created || ''),
      name: U.byAsc((it) => norm(it.name)),
      most: (a, b) => count(b) - count(a) || (a.name < b.name ? -1 : 1),
      least: (a, b) => count(a) - count(b) || (a.name < b.name ? -1 : 1),
      price: U.byDesc((it) => Number(it.price) || 0)
    };
    out = out.sort(sorters[f.sort] || sorters.newest);
    return out;
  };
  M.colourNames = (items) => {
    const seen = new Map();
    for (const it of items) for (const c of it.colours || []) seen.set(c.name, (seen.get(c.name) || 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  };
  M.activeFilters = (f) => ['colour', 'season', 'occasion', 'favourites', 'unworn', 'never'].filter((k) => f && f[k]).length;

  /* ---------- outfits ---------- */
  M.outfitItems = (o) => (o.items || []).map((x) => Object.assign({}, x, { item: D.get('items', x.id) })).filter((x) => x.item);
  /* A tidy starting layout: outerwear left, tops above bottoms in the middle, shoes at the foot,
     bags and the rest down the right. Positions are fractions of the canvas width and height. */
  M.arrange = (placed) => {
    const groups = { outerwear: [], tops: [], dresses: [], bottoms: [], shoes: [], side: [] };
    for (const p of placed) {
      const c = p.item.category;
      (groups[c] || groups.side).push(p);
    }
    const out = [];
    const put = (p, x, y, w) => out.push(Object.assign({}, p, { x, y, w }));
    const column = (list, x, y0, w, gap) => list.forEach((p, i) => put(p, x, y0 + i * gap, w));
    const mid = groups.tops.concat(groups.dresses);
    column(groups.outerwear, 0.02, 0.05, 0.42, 0.3);
    column(mid, groups.outerwear.length ? 0.3 : 0.2, 0.03, groups.dresses.length ? 0.5 : 0.44, 0.28);
    column(groups.bottoms, groups.outerwear.length ? 0.32 : 0.22, mid.length ? 0.42 : 0.1, 0.42, 0.3);
    groups.shoes.forEach((p, i) => put(p, 0.05 + i * 0.3, 0.74, 0.3));
    column(groups.side, 0.68, 0.06, 0.28, 0.24);
    return out;
  };
})((window.Wardrobe = window.Wardrobe || {}));
