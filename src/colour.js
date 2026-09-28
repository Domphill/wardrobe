/* Wardrobe — colours: what colour a garment is, and what it looks like from its outline.
   Works in OKLab, a colour space where distances match what the eye sees, corrects the photo's
   lighting using the background, groups shadows with the fabric they belong to, and names colours
   by hue, chroma and lightness rather than by nearest swatch. */
(function (L) {
  'use strict';
  const K = (L.colour = {});

  /* ---------- colour spaces ---------- */
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  K.toLinear = (r, g, b) => [lin(r / 255), lin(g / 255), lin(b / 255)];
  K.linearToLab = (r, g, b) => {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  K.rgbToLab = (r, g, b) => {
    const [lr, lg, lb] = K.toLinear(r, g, b);
    return K.linearToLab(lr, lg, lb);
  };
  K.labToRgb = (Lv, a, b) => {
    const l_ = Lv + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = Lv - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = Lv - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return [r, g, bb].map((c) => Math.round(255 * Math.min(1, Math.max(0, gam(c)))));
  };
  K.lch = (lab) => {
    const C = Math.hypot(lab[1], lab[2]);
    let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
    if (h < 0) h += 360;
    return { L: lab[0], C, h };
  };
  K.hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  K.parseHex = (s) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /* ---------- naming ---------- */
  const inHue = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);
  K.name = (rgb) => {
    const { L: Lv, C, h } = K.lch(K.rgbToLab(rgb[0], rgb[1], rgb[2]));
    const warm = inHue(h, 40, 125);
    /* Whites photograph as light greys in shade, so anything very light counts as white. */
    if (C < 0.016) return Lv > 0.88 ? 'White' : Lv > 0.72 ? 'Light grey' : Lv > 0.47 ? 'Grey' : Lv > 0.32 ? 'Charcoal' : 'Black';
    if (C < 0.045) {
      if (Lv < 0.32) return inHue(h, 228, 292) && C >= 0.025 ? 'Navy' : 'Black';
      if (Lv > 0.93) return warm && C >= 0.025 ? 'Cream' : 'White';
      if (Lv > 0.88) return warm ? 'Cream' : 'White';
      if (Lv > 0.75) return warm ? 'Beige' : 'Light grey';
      if (Lv > 0.5) return warm ? 'Khaki' : 'Grey';
      return warm ? 'Brown' : 'Charcoal';
    }
    if (inHue(h, 345, 40)) {
      if (Lv > 0.72) return 'Pink';
      if (C < 0.08 && Lv > 0.58) return 'Pink';
      if (Lv < 0.42) return 'Burgundy';
      return 'Red';
    }
    if (inHue(h, 40, 75)) {
      if (Lv < 0.45) return 'Brown';
      if (C < 0.09) return Lv > 0.75 ? 'Beige' : Lv > 0.55 ? 'Tan' : 'Brown';
      if (Lv > 0.82 && C < 0.13) return 'Beige';
      return 'Orange';
    }
    if (inHue(h, 75, 125)) {
      if (Lv < 0.45) return C < 0.07 ? 'Brown' : 'Olive';
      if (Lv < 0.6 && C < 0.1) return 'Olive';
      if (C < 0.075) return Lv > 0.86 ? 'Cream' : Lv > 0.74 ? 'Beige' : 'Khaki';
      return Lv < 0.78 ? 'Mustard' : 'Yellow';
    }
    if (inHue(h, 125, 185)) {
      if (C < 0.06) return Lv > 0.5 ? 'Sage' : 'Olive';
      if (Lv < 0.42 && h < 150) return 'Olive';
      return 'Green';
    }
    if (inHue(h, 185, 228)) return Lv > 0.75 && C < 0.09 ? 'Light blue' : 'Teal';
    if (inHue(h, 228, 292)) {
      if (Lv > 0.74) return 'Light blue';
      if (Lv < 0.4) return 'Navy';
      if (C < 0.095 && Lv < 0.68) return 'Denim';
      return 'Blue';
    }
    if (Lv > 0.74) return 'Lilac';
    if (h >= 330 && Lv > 0.55) return 'Pink';
    return 'Purple';
  };
  /* A swatch for each name, for the picker and the filter chips. */
  K.SWATCHES = {
    Black: '#1a1a1c',
    Charcoal: '#3c3e42',
    Grey: '#8a8c90',
    'Light grey': '#c8cacd',
    White: '#f5f5f2',
    Cream: '#f3ead4',
    Beige: '#d9c6a6',
    Tan: '#b8916a',
    Brown: '#6e4830',
    Khaki: '#9d9264',
    Olive: '#6c7040',
    Sage: '#9fb08e',
    Green: '#2f8a4a',
    Teal: '#1e8a8a',
    'Light blue': '#9cc3e8',
    Denim: '#4e6c96',
    Blue: '#2e62be',
    Navy: '#1f2b52',
    Lilac: '#bfa4dc',
    Purple: '#6f3fa0',
    Pink: '#eea0bf',
    Burgundy: '#78202f',
    Red: '#c8302c',
    Orange: '#e97a2a',
    Mustard: '#c9a02a',
    Yellow: '#f0d24a'
  };
  K.NAMES = Object.keys(K.SWATCHES);
  K.hexOfName = (name) => K.SWATCHES[name] || '#999999';

  /* One colour with the photo's lighting cast taken out, when the background is nearly neutral. */
  K.correct = (rgb, bg) => {
    const lr = K.toLinear(rgb[0], rgb[1], rgb[2]);
    let gain = [1, 1, 1];
    if (bg) {
      const bl = K.toLinear(bg[0], bg[1], bg[2]);
      const lch = K.lch(K.linearToLab(bl[0], bl[1], bl[2]));
      if (lch.C < 0.06 && lch.L > 0.45) {
        const avg = (bl[0] + bl[1] + bl[2]) / 3;
        gain = bl.map((c) => Math.min(1.45, Math.max(0.7, avg / Math.max(c, 0.001))));
      }
    }
    return [0, 1, 2].map((i) => Math.round(255 * gam(Math.min(1, lr[i] * gain[i]))));
  };

  /* ---------- finding a garment's colours ----------
     opts.bg: the photo's background colour [r, g, b], used to cancel a colour cast from the room's
     lighting when the background is something neutral like a sheet or a wall. */
  K.colours = (canvas, count, opts) => {
    count = count || 3;
    opts = opts || {};
    const w = canvas.width;
    const h = canvas.height;
    const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    /* white balance from the background, only when it is nearly neutral */
    let gain = [1, 1, 1];
    if (opts.bg) {
      const bl = K.toLinear(opts.bg[0], opts.bg[1], opts.bg[2]);
      const lch = K.lch(K.linearToLab(bl[0], bl[1], bl[2]));
      if (lch.C < 0.06 && lch.L > 0.45) {
        const avg = (bl[0] + bl[1] + bl[2]) / 3;
        gain = bl.map((c) => Math.min(1.45, Math.max(0.7, avg / Math.max(c, 0.001))));
      }
    }
    /* sample well inside the cut-out, away from its blended edges */
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 9000)));
    const m = 3;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= 250;
    const pts = [];
    for (let y = m; y < h - m; y += step) {
      for (let x = m; x < w - m; x += step) {
        if (!solid(x, y) || !solid(x - m, y) || !solid(x + m, y) || !solid(x, y - m) || !solid(x, y + m)) continue;
        const i = (y * w + x) * 4;
        const rl = Math.min(1, lin(d[i] / 255) * gain[0]);
        const gl = Math.min(1, lin(d[i + 1] / 255) * gain[1]);
        const bb = Math.min(1, lin(d[i + 2] / 255) * gain[2]);
        pts.push(K.linearToLab(rl, gl, bb));
      }
    }
    if (pts.length < 20) return [];
    /* k-means in OKLab, seeded by spreading the seeds out */
    const k = Math.min(6, Math.max(2, Math.floor(pts.length / 60)));
    const dist2 = (p, q) => {
      const dl = p[0] - q[0];
      const da = p[1] - q[1];
      const db = p[2] - q[2];
      return dl * dl + da * da + db * db;
    };
    const centres = [pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0])];
    while (centres.length < k) {
      let best = null;
      let bd = -1;
      for (const p of pts) {
        let nd = Infinity;
        for (const c of centres) nd = Math.min(nd, dist2(p, c));
        if (nd > bd) {
          bd = nd;
          best = p;
        }
      }
      centres.push(best.slice());
    }
    let labels = new Int16Array(pts.length);
    for (let iter = 0; iter < 12; iter++) {
      const sums = centres.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < pts.length; i++) {
        let bi = 0;
        let bd = Infinity;
        for (let c = 0; c < centres.length; c++) {
          const dd = dist2(pts[i], centres[c]);
          if (dd < bd) {
            bd = dd;
            bi = c;
          }
        }
        labels[i] = bi;
        const s = sums[bi];
        s[0] += pts[i][0];
        s[1] += pts[i][1];
        s[2] += pts[i][2];
        s[3]++;
      }
      for (let c = 0; c < centres.length; c++) if (sums[c][3]) centres[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    }
    let groups = centres.map((c, ci) => ({ lab: c, members: [] }));
    for (let i = 0; i < pts.length; i++) groups[labels[i]].members.push(pts[i]);
    groups = groups.filter((g) => g.members.length);
    /* shadows and highlights of one fabric: same hue and chroma, different lightness */
    const hueDiff = (a, b) => {
      const dd = Math.abs(a - b) % 360;
      return dd > 180 ? 360 - dd : dd;
    };
    const same = (g1, g2) => {
      const a = K.lch(g1.lab);
      const b = K.lch(g2.lab);
      if (a.C < 0.045 && b.C < 0.045) return Math.abs(a.L - b.L) < 0.22;
      if (a.C < 0.045 || b.C < 0.045) return Math.abs(a.C - b.C) < 0.03 && Math.abs(a.L - b.L) < 0.15;
      return hueDiff(a.h, b.h) < 20 && Math.abs(a.C - b.C) < 0.06 && Math.abs(a.L - b.L) < 0.4;
    };
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          if (!same(groups[i], groups[j])) continue;
          const all = groups[i].members.concat(groups[j].members);
          const lab = all.reduce((a, p) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length, a[2] + p[2] / all.length], [0, 0, 0]);
          groups.splice(j, 1);
          groups[i] = { lab, members: all };
          merged = true;
          break outer;
        }
      }
    }
    groups.sort((a, b) => b.members.length - a.members.length);
    const out = [];
    for (const g of groups) {
      const share = g.members.length / pts.length;
      if (share < 0.07 && out.length) continue;
      /* the swatch is the lit part of the fabric, not its shadows */
      const ls = g.members.map((p) => p[0]).sort((a, b) => a - b);
      const median = ls[Math.floor(ls.length / 2)];
      const lit = g.members.filter((p) => p[0] >= median);
      const lab = lit.reduce((a, p) => [a[0] + p[0] / lit.length, a[1] + p[1] / lit.length, a[2] + p[2] / lit.length], [0, 0, 0]);
      const rgb = K.labToRgb(lab[0], lab[1], lab[2]);
      out.push({ hex: K.hex(rgb), name: K.name(rgb), share: Math.round(share * 100) });
      if (out.length >= count) break;
    }
    /* two groups that end up with the same name are one colour */
    const seen = new Map();
    for (const c of out) {
      if (seen.has(c.name)) seen.get(c.name).share += c.share;
      else seen.set(c.name, c);
    }
    return [...seen.values()].sort((a, b) => b.share - a.share);
  };

  /* ---------- what is it? a guess from the outline ----------
     Looks at the shape of the cut-out: two legs mean trousers or shorts, shoulders wider than the
     waist mean a top, tall and flaring means a dress, wider than tall means shoes. */
  K.guessKind = (canvas, colours) => {
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return null;
    const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    const cols = 120;
    const sx = Math.max(1, Math.floor(W / cols));
    const sy = sx;
    const rows = [];
    let minX = Infinity;
    let maxX = -1;
    for (let y = 0; y < H; y += sy) {
      const segs = [];
      let start = -1;
      for (let x = 0; x <= W; x += sx) {
        const on = x < W && d[(y * W + x) * 4 + 3] > 128;
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          if (x - start >= W * 0.03) segs.push([start, x]);
          start = -1;
        }
      }
      if (!segs.length) {
        rows.push(null);
        continue;
      }
      const first = segs[0][0];
      const last = segs[segs.length - 1][1];
      minX = Math.min(minX, first);
      maxX = Math.max(maxX, last);
      segs.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
      let gap = 0;
      if (segs.length >= 2) {
        const a = segs[0];
        const b = segs[1];
        gap = Math.max(a[0], b[0]) - Math.min(a[1], b[1]);
      }
      rows.push({ width: (last - first) / W, gap: gap / W, segs: segs.length });
    }
    const filled = rows.filter(Boolean);
    if (filled.length < 8 || maxX <= minX) return null;
    const firstRow = rows.findIndex(Boolean);
    let lastRow = rows.length - 1;
    while (lastRow > 0 && !rows[lastRow]) lastRow--;
    const n = lastRow - firstRow + 1;
    const at = (f) => rows[Math.min(lastRow, firstRow + Math.floor(n * f))];
    const band = (a, b) => rows.slice(firstRow + Math.floor(n * a), firstRow + Math.ceil(n * b)).filter(Boolean);
    const mean = (list, key) => (list.length ? list.reduce((s, r) => s + r[key], 0) / list.length : 0);
    const r = (n * sy) / (maxX - minX);
    const legBand = band(0.55, 0.97);
    const legRows = legBand.filter((row) => row.segs >= 2 && row.gap >= 0.05).length;
    const legRatio = legBand.length ? legRows / legBand.length : 0;
    const topW = Math.max(...band(0.02, 0.32).map((row) => row.width), 0);
    const midW = mean(band(0.4, 0.62), 'width') || 0.001;
    const botW = mean(band(0.8, 0.96), 'width');
    const shoulders = topW / midW;
    const bottoms = (type) => ({ category: 'bottoms', type, confidence: 'high', why: 'two legs' });
    const denim = (colours || []).some((c) => /Denim|Navy|Light blue|Blue/.test(c.name));
    /* legs: split at the bottom but joined at the top (a pair of shoes is split all the way up) */
    const topBand = band(0.08, 0.45);
    const topSolid = topBand.length ? topBand.filter((row) => row.segs === 1).length / topBand.length : 0;
    if (legRatio > 0.45 && topSolid > 0.6) return r > 1.35 ? bottoms(denim ? 'Jeans' : 'Trousers') : bottoms('Shorts');
    if (r < 0.8) return { category: 'shoes', type: 'Trainers', confidence: 'medium', why: 'wider than it is tall' };
    if (shoulders > 1.25 && r < 1.65) return { category: 'tops', type: 'T-shirt', confidence: 'medium', why: 'shoulders wider than the body' };
    if (r > 1.5 && botW > midW * 1.1) return { category: 'dresses', type: 'Dress', confidence: 'medium', why: 'tall and flaring out' };
    if (r > 1.5) return { category: 'dresses', type: 'Dress', confidence: 'low', why: 'tall and narrow' };
    if (botW > midW * 1.15 && shoulders < 1.15) return { category: 'bottoms', type: 'Skirt', confidence: 'low', why: 'wider at the bottom' };
    return { category: 'tops', type: 'Top', confidence: 'low', why: 'the outline' };
  };
})((window.Wardrobe = window.Wardrobe || {}));
