/* Wardrobe — photo handling: loading and shrinking photos, cutting the background out, colours.
   The cut-out works best on a photo taken against a plain background: everything joined to the
   edges of the photo that looks like the background colour is removed, and a tap fixes the rest. */
(function (L) {
  'use strict';
  const C = (L.cutout = {});
  const MAX = 1000; /* longest side of a stored cut-out, in pixels */

  /* ---------- loading ---------- */
  C.load = async (file, max) => {
    max = max || MAX;
    let bitmap = null;
    /* An <img> is turned the right way up by every modern browser; createImageBitmap is the fallback. */
    try {
      bitmap = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('That photo couldn\u2019t be opened. If it is a HEIC photo, choose JPEG in the camera settings (Formats, Most Compatible).'));
        };
        img.src = url;
      });
      if (bitmap.decode) await bitmap.decode().catch(() => {});
    } catch (e) {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
        throw e;
      });
    }
    const w = bitmap.width || bitmap.naturalWidth;
    const h = bitmap.height || bitmap.naturalHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    return canvas;
  };
  C.toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type || 'image/png', quality));

  /* ---------- the mask ----------
     A mask is one byte per pixel: 1 keeps the pixel, 0 makes it transparent. */
  const dist = (d, i, r, g, b) => {
    const dr = d[i] - r;
    const dg = d[i + 1] - g;
    const db = d[i + 2] - b;
    return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
  };
  /* Tolerance 0..100 becomes a colour distance; 35 suits most plain backgrounds without eating
     dark clothes photographed on a mid-grey wall. */
  const threshold = (t) => 30 + 3.4 * Math.min(100, Math.max(0, t));

  /* Grows a region from the given seeds over connected pixels that are within the tolerance of the
     reference colour and currently have the value `from` in the mask; sets them to `to`. */
  function grow(img, mask, seeds, ref, tol, from, to) {
    const { width: w, height: h, data: d } = img;
    const th = threshold(tol);
    const stack = [];
    const seen = new Uint8Array(w * h);
    for (const s of seeds) {
      const p = s.y * w + s.x;
      if (mask[p] === from && !seen[p] && dist(d, p * 4, ref[0], ref[1], ref[2]) <= th) {
        seen[p] = 1;
        stack.push(p);
      }
    }
    let changed = 0;
    while (stack.length) {
      const p = stack.pop();
      mask[p] = to;
      changed++;
      const x = p % w;
      const y = (p - x) / w;
      const next = [];
      if (x > 0) next.push(p - 1);
      if (x < w - 1) next.push(p + 1);
      if (y > 0) next.push(p - w);
      if (y < h - 1) next.push(p + w);
      for (const q of next) {
        if (seen[q] || mask[q] !== from) continue;
        seen[q] = 1;
        if (dist(d, q * 4, ref[0], ref[1], ref[2]) <= th) stack.push(q);
      }
    }
    return changed;
  }
  /* The typical colour of the photo's edges: the median of a sample of border pixels. */
  function borderColour(img) {
    const { width: w, height: h, data: d } = img;
    const rs = [];
    const gs = [];
    const bs = [];
    const take = (x, y) => {
      const i = (y * w + x) * 4;
      rs.push(d[i]);
      gs.push(d[i + 1]);
      bs.push(d[i + 2]);
    };
    const step = Math.max(1, Math.round(Math.max(w, h) / 120));
    for (let x = 0; x < w; x += step) {
      take(x, 0);
      take(x, h - 1);
    }
    for (let y = 0; y < h; y += step) {
      take(0, y);
      take(w - 1, y);
    }
    const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
    return [med(rs), med(gs), med(bs)];
  }
  /* Everything joined to the edge of the photo that matches the edge colour becomes background.
     Seeds run right round the border, so a background that darkens towards one corner still goes. */
  C.autoFlood = (img, tol) => {
    const { width: w, height: h } = img;
    const mask = new Uint8Array(w * h).fill(1);
    const ref = borderColour(img);
    const seeds = [];
    const step = Math.max(1, Math.round(Math.max(w, h) / 60));
    for (let x = 0; x < w; x += step) seeds.push({ x, y: 0 }, { x, y: h - 1 });
    for (let y = 0; y < h; y += step) seeds.push({ x: 0, y }, { x: w - 1, y });
    grow(img, mask, seeds, ref, tol, 1, 0);
    /* A second pass from every border pixel that is still kept, matched against its own colour,
       catches a background that is a different shade along one edge. */
    const more = [];
    for (let x = 0; x < w; x += step) for (const y of [0, h - 1]) if (mask[y * w + x]) more.push({ x, y });
    for (let y = 0; y < h; y += step) for (const x of [0, w - 1]) if (mask[y * w + x]) more.push({ x, y });
    for (const s of more) {
      const i = (s.y * w + s.x) * 4;
      grow(img, mask, [s], [img.data[i], img.data[i + 1], img.data[i + 2]], Math.max(0, tol - 10), 1, 0);
    }
    C.tidy(mask, w, h);
    return mask;
  };
  /* A tap: remove the area around a point, or bring it back. */
  C.tap = (img, mask, x, y, tol, remove) => {
    x = Math.min(img.width - 1, Math.max(0, Math.round(x)));
    y = Math.min(img.height - 1, Math.max(0, Math.round(y)));
    const i = (y * img.width + x) * 4;
    const ref = [img.data[i], img.data[i + 1], img.data[i + 2]];
    return grow(img, mask, [{ x, y }], ref, tol, remove ? 1 : 0, remove ? 0 : 1);
  };
  /* Drops specks smaller than a small fraction of the picture, keeping the biggest pieces. */
  C.tidy = (mask, w, h) => {
    const label = new Int32Array(w * h).fill(-1);
    const sizes = [];
    const stack = [];
    for (let p = 0; p < w * h; p++) {
      if (!mask[p] || label[p] >= 0) continue;
      const id = sizes.length;
      sizes.push(0);
      label[p] = id;
      stack.push(p);
      while (stack.length) {
        const q = stack.pop();
        sizes[id]++;
        const x = q % w;
        const y = (q - x) / w;
        const around = [];
        if (x > 0) around.push(q - 1);
        if (x < w - 1) around.push(q + 1);
        if (y > 0) around.push(q - w);
        if (y < h - 1) around.push(q + w);
        for (const n of around) {
          if (mask[n] && label[n] < 0) {
            label[n] = id;
            stack.push(n);
          }
        }
      }
    }
    if (!sizes.length) return mask;
    const biggest = Math.max(...sizes);
    const min = Math.max(64, Math.round(w * h * 0.004));
    for (let p = 0; p < w * h; p++) {
      const id = label[p];
      if (id >= 0 && sizes[id] < min && sizes[id] !== biggest) mask[p] = 0;
    }
    return mask;
  };
  C.coverage = (mask) => {
    let n = 0;
    for (let i = 0; i < mask.length; i++) n += mask[i];
    return n / mask.length;
  };

  /* ---------- applying the mask ---------- */
  /* Alpha from the mask, softened by one pixel so edges aren't jagged, and shrunk a touch so no
     rim of background colour is left round the item. */
  C.apply = (canvas, mask, opts) => {
    opts = opts || {};
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const a = new Uint8ClampedArray(w * h);
    /* The outermost ring of kept pixels is blended with the background colour, so it goes; the
       ring inside it is half strength, and the blur below smooths the rest. */
    const ring = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      if (!mask[p]) continue;
      const x = p % w;
      const y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[p - 1] || !mask[p + 1] || !mask[p - w] || !mask[p + w]) ring[p] = 1;
    }
    for (let p = 0; p < w * h; p++) {
      if (!mask[p]) continue;
      if (ring[p]) {
        a[p] = 0;
        continue;
      }
      const x = p % w;
      const y = (p - x) / w;
      const near = ring[p - 1] || ring[p + 1] || ring[p - w] || ring[p + w];
      a[p] = near ? (opts.hardEdges ? 0 : 140) : 255;
    }
    /* 3x3 blur of the alpha */
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += a[yy * w + xx];
            n++;
          }
        }
        out[y * w + x] = Math.round(sum / n);
      }
    }
    const res = document.createElement('canvas');
    res.width = w;
    res.height = h;
    const rc = res.getContext('2d');
    const o = rc.createImageData(w, h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      o.data[i] = d[i];
      o.data[i + 1] = d[i + 1];
      o.data[i + 2] = d[i + 2];
      o.data[i + 3] = mask[p] && !ring[p] ? out[p] : 0;
    }
    rc.putImageData(o, 0, 0);
    return res;
  };
  /* Trims transparent margins, leaving a little air round the item. */
  C.crop = (canvas, pad) => {
    pad = pad == null ? 0.04 : pad;
    const w = canvas.width;
    const h = canvas.height;
    const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return canvas;
    const px = Math.round((x1 - x0 + 1) * pad);
    const py = Math.round((y1 - y0 + 1) * pad);
    x0 = Math.max(0, x0 - px);
    y0 = Math.max(0, y0 - py);
    x1 = Math.min(w - 1, x1 + px);
    y1 = Math.min(h - 1, y1 + py);
    const res = document.createElement('canvas');
    res.width = x1 - x0 + 1;
    res.height = y1 - y0 + 1;
    res.getContext('2d').drawImage(canvas, x0, y0, res.width, res.height, 0, 0, res.width, res.height);
    return res;
  };
  /* A smaller copy that fits in a square of the given size. */
  C.thumb = (canvas, size) => {
    const k = Math.min(1, size / Math.max(canvas.width, canvas.height));
    const res = document.createElement('canvas');
    res.width = Math.max(1, Math.round(canvas.width * k));
    res.height = Math.max(1, Math.round(canvas.height * k));
    res.getContext('2d').drawImage(canvas, 0, 0, res.width, res.height);
    return res;
  };
  /* The transparent pixels of a cut-out drawn as a checkerboard, for showing on screen. */
  let checkerBg = null;
  C.checker = (canvas) => {
    const res = document.createElement('canvas');
    res.width = canvas.width;
    res.height = canvas.height;
    const ctx = res.getContext('2d');
    if (!checkerBg || checkerBg.width !== res.width || checkerBg.height !== res.height) {
      checkerBg = document.createElement('canvas');
      checkerBg.width = res.width;
      checkerBg.height = res.height;
      const c2 = checkerBg.getContext('2d');
      const s = 16;
      for (let y = 0; y < res.height; y += s) {
        for (let x = 0; x < res.width; x += s) {
          c2.fillStyle = ((x / s + y / s) & 1) === 0 ? '#e9e6e0' : '#f7f5f1';
          c2.fillRect(x, y, s, s);
        }
      }
    }
    ctx.drawImage(checkerBg, 0, 0);
    ctx.drawImage(canvas, 0, 0);
    return res;
  };

  /* The photo's background colour, for correcting the lighting when naming colours. */
  C.background = (img) => borderColour(img);

  /* ---------- the automatic cut-out ----------
     Learns what the background looks like from the edges of the photo (several shades, so folds,
     shadows and a lighting gradient all count as background), what the garment looks like from the
     middle, and then sorts every pixel by which it is closer to. Falls back to the simpler edge
     flood when the middle of the photo looks like the background. */
  function kmeans(lab, idx, k, iters) {
    const pick = (i) => [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
    const d2 = (i, c) => {
      const dl = (lab[i * 3] - c[0]) * 0.6;
      const da = lab[i * 3 + 1] - c[1];
      const db = lab[i * 3 + 2] - c[2];
      return dl * dl + da * da + db * db;
    };
    const mean = [0, 0, 0];
    for (const i of idx) {
      mean[0] += lab[i * 3] / idx.length;
      mean[1] += lab[i * 3 + 1] / idx.length;
      mean[2] += lab[i * 3 + 2] / idx.length;
    }
    const centres = [mean];
    const step = Math.max(1, Math.floor(idx.length / 3000));
    while (centres.length < k) {
      let best = -1;
      let bd = -1;
      for (let j = 0; j < idx.length; j += step) {
        let nd = Infinity;
        for (const c of centres) nd = Math.min(nd, d2(idx[j], c));
        if (nd > bd) {
          bd = nd;
          best = idx[j];
        }
      }
      if (best < 0 || bd < 1e-6) break;
      centres.push(pick(best));
    }
    for (let it = 0; it < (iters || 6); it++) {
      const sums = centres.map(() => [0, 0, 0, 0]);
      for (const i of idx) {
        let bi = 0;
        let bd = Infinity;
        for (let c = 0; c < centres.length; c++) {
          const dd = d2(i, centres[c]);
          if (dd < bd) {
            bd = dd;
            bi = c;
          }
        }
        const s = sums[bi];
        s[0] += lab[i * 3];
        s[1] += lab[i * 3 + 1];
        s[2] += lab[i * 3 + 2];
        s[3]++;
      }
      for (let c = 0; c < centres.length; c++) if (sums[c][3]) centres[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    }
    return centres;
  }
  /* Connected pieces of the mask with the given value; returns labels and sizes. */
  function components(mask, w, h, value) {
    const label = new Int32Array(w * h).fill(-1);
    const sizes = [];
    const border = [];
    const stack = [];
    for (let p = 0; p < w * h; p++) {
      if (mask[p] !== value || label[p] >= 0) continue;
      const id = sizes.length;
      sizes.push(0);
      border.push(false);
      label[p] = id;
      stack.push(p);
      while (stack.length) {
        const q = stack.pop();
        sizes[id]++;
        const x = q % w;
        const y = (q - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border[id] = true;
        const around = [];
        if (x > 0) around.push(q - 1);
        if (x < w - 1) around.push(q + 1);
        if (y > 0) around.push(q - w);
        if (y < h - 1) around.push(q + w);
        for (const nb of around) {
          if (mask[nb] === value && label[nb] < 0) {
            label[nb] = id;
            stack.push(nb);
          }
        }
      }
    }
    return { label, sizes, border };
  }
  /* Drops kept specks smaller than a share of the picture (the biggest piece always stays). */
  C.dropSpecks = (mask, w, h, share) => {
    const { label, sizes } = components(mask, w, h, 1);
    if (!sizes.length) return mask;
    const biggest = sizes.indexOf(Math.max(...sizes));
    const min = Math.max(16, Math.round(w * h * share));
    for (let p = 0; p < w * h; p++) {
      const id = label[p];
      if (id >= 0 && id !== biggest && sizes[id] < min) mask[p] = 0;
    }
    return mask;
  };
  /* Fills holes inside the garment (a print the colour of the wall) up to a share of the picture. */
  C.fillHoles = (mask, w, h, share) => {
    const { label, sizes, border } = components(mask, w, h, 0);
    const max = Math.round(w * h * share);
    for (let p = 0; p < w * h; p++) {
      const id = label[p];
      if (id >= 0 && !border[id] && sizes[id] <= max) mask[p] = 1;
    }
    return mask;
  };
  /* Smooths the mask's edge: each pixel goes with the majority of its neighbours. */
  C.smooth = (mask, w, h) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        let t = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            n += mask[yy * w + xx];
            t++;
          }
        }
        out[y * w + x] = n * 2 > t ? 1 : 0;
      }
    }
    mask.set(out);
    return mask;
  };
  C.segment = (img) => {
    const K = L.colour;
    if (!K) return null;
    const W = img.width;
    const H = img.height;
    const d = img.data;
    const k = Math.min(1, 380 / Math.max(W, H));
    const w = Math.max(8, Math.round(W * k));
    const h = Math.max(8, Math.round(H * k));
    const n = w * h;
    const lab = new Float32Array(n * 3);
    for (let y = 0; y < h; y++) {
      const sy = Math.min(H - 1, Math.round(y / k));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(W - 1, Math.round(x / k));
        const i = (sy * W + sx) * 4;
        const l = K.rgbToLab(d[i], d[i + 1], d[i + 2]);
        const o = (y * w + x) * 3;
        lab[o] = l[0];
        lab[o + 1] = l[1];
        lab[o + 2] = l[2];
      }
    }
    const dist = (p, c) => {
      const dl = (lab[p * 3] - c[0]) * 0.6;
      const da = lab[p * 3 + 1] - c[1];
      const db = lab[p * 3 + 2] - c[2];
      return Math.sqrt(dl * dl + da * da + db * db);
    };
    const nearest = (p, cs) => {
      let best = Infinity;
      for (const c of cs) best = Math.min(best, dist(p, c));
      return best;
    };
    const band = Math.max(2, Math.round(Math.min(w, h) * 0.06));
    const bgIdx = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < band || y < band || x >= w - band || y >= h - band) bgIdx.push(y * w + x);
    const bg = kmeans(lab, bgIdx, 4, 6);
    const fgIdx = [];
    for (let y = Math.floor(h * 0.22); y < h * 0.78; y++) for (let x = Math.floor(w * 0.22); x < w * 0.78; x++) if (nearest(y * w + x, bg) > 0.11) fgIdx.push(y * w + x);
    if (fgIdx.length < Math.max(40, n * 0.004)) return null;
    const fg = kmeans(lab, fgIdx, 4, 6);
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) mask[p] = nearest(p, fg) < nearest(p, bg) ? 1 : 0;
    C.dropSpecks(mask, w, h, 0.003);
    C.fillHoles(mask, w, h, 0.04);
    C.smooth(mask, w, h);
    C.smooth(mask, w, h);
    if (C.coverage(mask) < 0.01 || C.coverage(mask) > 0.97) return null;
    const full = new Uint8Array(W * H);
    for (let Y = 0; Y < H; Y++) {
      const y = Math.min(h - 1, Math.floor(Y * k));
      for (let X = 0; X < W; X++) full[Y * W + X] = mask[y * w + Math.min(w - 1, Math.floor(X * k))];
    }
    C.smooth(full, W, H);
    return full;
  };
  C.auto = (img, tol) => C.segment(img) || C.autoFlood(img, tol);

  /* A quick preview: the mask straight onto the alpha, no edge work. */
  C.applyFast = (canvas, mask) => {
    const w = canvas.width;
    const h = canvas.height;
    const img = canvas.getContext('2d').getImageData(0, 0, w, h);
    const d = img.data;
    for (let p = 0, i = 3; p < w * h; p++, i += 4) d[i] = mask[p] ? 255 : 0;
    const res = document.createElement('canvas');
    res.width = w;
    res.height = h;
    res.getContext('2d').putImageData(img, 0, 0);
    return res;
  };
  /* Turns the photo and its mask by any angle. The corners that open up take the background colour. */
  C.rotate = (canvas, mask, deg, bg) => {
    const rad = (deg * Math.PI) / 180;
    const W = canvas.width;
    const H = canvas.height;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const nw = Math.max(1, Math.round(W * cos + H * sin));
    const nh = Math.max(1, Math.round(W * sin + H * cos));
    const out = document.createElement('canvas');
    out.width = nw;
    out.height = nh;
    const ctx = out.getContext('2d');
    ctx.fillStyle = bg ? 'rgb(' + bg.map((v) => Math.round(v)).join(',') + ')' : '#ffffff';
    ctx.fillRect(0, 0, nw, nh);
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(rad);
    ctx.drawImage(canvas, -W / 2, -H / 2);
    const mc = document.createElement('canvas');
    mc.width = W;
    mc.height = H;
    const mctx = mc.getContext('2d');
    const mid = mctx.createImageData(W, H);
    for (let p = 0, i = 3; p < W * H; p++, i += 4) mid.data[i] = mask[p] ? 255 : 0;
    mctx.putImageData(mid, 0, 0);
    const mo = document.createElement('canvas');
    mo.width = nw;
    mo.height = nh;
    const moc = mo.getContext('2d');
    moc.translate(nw / 2, nh / 2);
    moc.rotate(rad);
    moc.drawImage(mc, -W / 2, -H / 2);
    const md = moc.getImageData(0, 0, nw, nh).data;
    const nm = new Uint8Array(nw * nh);
    for (let p = 0, i = 3; p < nw * nh; p++, i += 4) nm[p] = md[i] > 127 ? 1 : 0;
    return { canvas: out, img: ctx.getImageData(0, 0, nw, nh), mask: nm };
  };
  C.mirror = (canvas, mask) => {
    const W = canvas.width;
    const H = canvas.height;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
    const nm = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) nm[y * W + x] = mask[y * W + (W - 1 - x)];
    return { canvas: out, img: ctx.getImageData(0, 0, W, H), mask: nm };
  };

  /* ---------- brushes, cropping, skin ---------- */
  /* Paints a round spot of `val` into the mask. Returns how many pixels changed. */
  C.paint = (mask, w, h, cx, cy, r, val) => {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const p = y * w + x;
        if (mask[p] !== val) {
          mask[p] = val;
          n++;
        }
      }
    }
    return n;
  };
  /* Keeps only a rectangle of the photo and its mask. */
  C.cropRect = (canvas, mask, r) => {
    const x0 = Math.max(0, Math.round(Math.min(r.x0, r.x1)));
    const y0 = Math.max(0, Math.round(Math.min(r.y0, r.y1)));
    const x1 = Math.min(canvas.width, Math.round(Math.max(r.x0, r.x1)));
    const y1 = Math.min(canvas.height, Math.round(Math.max(r.y0, r.y1)));
    const w = Math.max(1, x1 - x0);
    const h = Math.max(1, y1 - y0);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) m.set(mask.subarray((y0 + y) * canvas.width + x0, (y0 + y) * canvas.width + x0 + w), y * w);
    return { canvas: out, img: out.getContext('2d').getImageData(0, 0, w, h), mask: m };
  };
  /* Removes skin-coloured pixels from the mask (a model's face, arms, legs). Returns how many. */
  C.skin = (img, mask) => {
    const d = img.data;
    let n = 0;
    for (let p = 0; p < mask.length; p++) {
      if (!mask[p]) continue;
      const i = p * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15) {
        mask[p] = 0;
        n++;
      }
    }
    return n;
  };
  /* Selects the pixels near a point that look like it: the stroke snaps to the garment's edges.
     Only kept pixels within `reach` of the point are considered. Returns how many were added. */
  C.smartSelect = (img, mask, sel, cx, cy, reach, tol) => {
    const w = img.width;
    const h = img.height;
    const d = img.data;
    const x = Math.round(cx);
    const y = Math.round(cy);
    if (x < 0 || y < 0 || x >= w || y >= h || !mask[y * w + x]) return 0;
    const i0 = (y * w + x) * 4;
    const ref = [d[i0], d[i0 + 1], d[i0 + 2]];
    const th = threshold(tol);
    const r2 = reach * reach;
    const seen = new Uint8Array(w * h);
    const stack = [y * w + x];
    seen[y * w + x] = 1;
    let n = 0;
    while (stack.length) {
      const p = stack.pop();
      if (!sel[p]) {
        sel[p] = 1;
        n++;
      }
      const px = p % w;
      const py = (p - px) / w;
      const next = [];
      if (px > 0) next.push(p - 1);
      if (px < w - 1) next.push(p + 1);
      if (py > 0) next.push(p - w);
      if (py < h - 1) next.push(p + w);
      for (const q of next) {
        if (seen[q] || !mask[q]) continue;
        seen[q] = 1;
        const qx = q % w;
        const qy = (q - qx) / w;
        if ((qx - cx) * (qx - cx) + (qy - cy) * (qy - cy) > r2) continue;
        if (dist(d, q * 4, ref[0], ref[1], ref[2]) <= th) stack.push(q);
      }
    }
    return n;
  };
  /* Paints colour onto the kept part of the photo. 'shade' works like dye: the fabric's own light
     and shadow stay and only the colour changes; 'solid' paints flat colour. */
  C.paintColour = (img, mask, cx, cy, r, rgb, blend) => {
    const K = L.colour;
    const w = img.width;
    const h = img.height;
    const d = img.data;
    const target = K.rgbToLab(rgb[0], rgb[1], rgb[2]);
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const p = y * w + x;
        if (!mask[p]) continue;
        const i = p * 4;
        if (blend === 'solid') {
          d[i] = rgb[0];
          d[i + 1] = rgb[1];
          d[i + 2] = rgb[2];
        } else {
          const lab = K.rgbToLab(d[i], d[i + 1], d[i + 2]);
          const out = K.labToRgb(0.65 * lab[0] + 0.35 * target[0], target[1], target[2]);
          d[i] = out[0];
          d[i + 1] = out[1];
          d[i + 2] = out[2];
        }
        n++;
      }
    }
    return n;
  };
  /* The average colour of a small square of the photo. */
  C.sample = (img, x, y, half) => {
    const w = img.width;
    const h = img.height;
    const d = img.data;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let yy = Math.max(0, Math.round(y) - half); yy <= Math.min(h - 1, Math.round(y) + half); yy++) {
      for (let xx = Math.max(0, Math.round(x) - half); xx <= Math.min(w - 1, Math.round(x) + half); xx++) {
        const i = (yy * w + xx) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    }
    return n ? [r / n, g / n, b / n] : [0, 0, 0];
  };
})((window.Wardrobe = window.Wardrobe || {}));
