/* Wardrobe — what to wear: outfit ideas that fit the weather and the season, favouring pieces that
   haven't had an outing lately. */
(function (L) {
  'use strict';
  const U = L.util;
  const D = L.data;
  const M = L.model;
  const W = L.weather;
  const S = (L.suggest = {});

  const WARM = /jumper|hoodie|sweatshirt|cardigan|fleece|coat|parka|puffer|boots|scarf|gloves|beanie|knit|wool|thermal/i;
  const HEAVY = /coat|parka|puffer|wool|thermal/i;
  const HOT_ONLY = /shorts|sandals|vest|sliders|swim|playsuit|flip[- ]?flop|sun ?dress|strappy/i;
  const LAYER = /jacket|blazer|overshirt|gilet|raincoat|mac\b|trench|shacket/i;
  const RAIN_OK = /raincoat|mac\b|trench|parka|puffer|boots|wellies|waterproof|anorak/i;
  const RAIN_BAD = /sandals|sliders|canvas|suede|flip[- ]?flop|espadrille/i;

  /* Everything the ideas are based on for a day. Without a forecast, the season stands in. */
  S.context = (fx, date) => {
    const season = W.seasonOf(date || new Date());
    if (!fx) return { season, band: { Winter: 'cold', Autumn: 'cool', Spring: 'mild', Summer: 'warm' }[season], rain: false, fx: null };
    const [text] = W.describe(fx.code);
    return { season, band: W.band(fx.tmax, fx.tmin), rain: fx.rain >= 45 || /rain|drizzle|shower|thunder/i.test(text), snow: /snow/i.test(text), fx };
  };

  /* How well one piece suits the day: higher is better, null means leave it in the wardrobe. */
  S.fit = (item, ctx, wears) => {
    const text = [item.type, item.name, item.notes].filter(Boolean).join(' ');
    const seasons = item.seasons || [];
    let s = 0;
    if (seasons.length) s += seasons.includes(ctx.season) ? 2 : -1.5;
    const warm = WARM.test(text);
    const hot = HOT_ONLY.test(text);
    const layer = LAYER.test(text);
    if (ctx.band === 'hot') {
      if (warm) return null;
      if (hot) s += 1.5;
      if (layer) s -= 1;
    } else if (ctx.band === 'warm') {
      if (HEAVY.test(text)) return null;
      if (warm) s -= 1.5;
      if (hot) s += 0.5;
    } else if (ctx.band === 'mild') {
      if (warm) s += 0.5;
      if (hot) s -= 1.5;
      if (layer) s += 0.5;
    } else if (ctx.band === 'cool') {
      if (hot) return null;
      if (warm) s += 1.5;
      if (layer) s += 0.5;
    } else {
      if (hot) return null;
      if (warm) s += 2;
      if (HEAVY.test(text)) s += 1;
    }
    if (ctx.rain || ctx.snow) {
      if (RAIN_BAD.test(text)) return null;
      if (RAIN_OK.test(text)) s += 1.5;
    }
    if (item.favourite) s += 0.5;
    const w = wears ? wears.get(item.id) : null;
    if (!w) s += 0.4;
    else {
      const since = M.daysSince(w.last);
      if (since <= 2) s -= 1.5;
      else if (since >= 30) s += 0.8;
    }
    return s;
  };

  S.reason = (ctx) => {
    const band = W.BAND_WORDS[ctx.band];
    const temp = ctx.fx ? ', ' + W.fmtTemp(ctx.fx.tmax) : '';
    const wet = ctx.snow ? ' and snowy' : ctx.rain ? ' and wet' : ' and dry';
    const advice = { hot: 'as little as you like', warm: 'light layers', mild: 'a top and a light layer', cool: 'something warm on top', cold: 'wrap up' }[ctx.band];
    return band + wet + temp + ': ' + advice + (ctx.rain || ctx.snow ? ', with a coat that can take it' : '') + '.';
  };

  /* Saved outfits that suit the day, best first. */
  S.outfits = (ctx) => {
    const wears = M.wearMap();
    const out = [];
    for (const o of D.list('outfits')) {
      const items = M.outfitItems(o).map((x) => x.item);
      if (!items.length) continue;
      const fits = items.map((it) => S.fit(it, ctx, wears));
      if (fits.some((f) => f == null)) continue;
      let score = fits.reduce((a, b) => a + b, 0) / fits.length;
      const hasOuter = items.some((it) => it.category === 'outerwear');
      const needsOuter = ctx.band === 'cool' || ctx.band === 'cold' || ctx.rain || ctx.snow;
      if (needsOuter) score += hasOuter ? 1 : -1.5;
      if ((o.seasons || []).length) score += o.seasons.includes(ctx.season) ? 1 : -1;
      const ow = M.outfitWears(o.id);
      if (ow.last && M.daysSince(ow.last) <= 2) score -= 1.5;
      if (o.favourite) score += 0.5;
      if (score > 0) out.push({ outfit: o, score });
    }
    return out.sort((a, b) => b.score - a.score);
  };

  /* Puts a fresh combination together from the closet. With `shuffle`, the choice is looser, so
     tapping again gives a different idea. */
  S.compose = (ctx, shuffle) => {
    const wears = M.wearMap();
    const items = D.list('items').filter((i) => i.status !== 'archived');
    const scored = items.map((it) => ({ it, s: S.fit(it, ctx, wears) })).filter((x) => x.s != null);
    const pool = (test) => scored.filter((x) => test(x.it)).sort((a, b) => b.s - a.s);
    const pick = (list) => {
      if (!list.length) return null;
      if (!shuffle) return list[0].it;
      const top = list.slice(0, Math.min(4, list.length));
      return top[Math.floor(Math.random() * top.length)].it;
    };
    const text = (it) => [it.type, it.name].filter(Boolean).join(' ');
    const chosen = [];
    const dresses = pool((it) => it.category === 'dresses');
    const tops = pool((it) => it.category === 'tops');
    const bottoms = pool((it) => it.category === 'bottoms');
    const wantDress = dresses.length && (!tops.length || !bottoms.length || (shuffle && Math.random() < 0.35));
    if (wantDress) chosen.push(pick(dresses));
    else {
      const t = pick(tops);
      const b = pick(bottoms);
      if (t) chosen.push(t);
      if (b) chosen.push(b);
      if (!t && !b && dresses.length) chosen.push(pick(dresses));
    }
    const needsOuter = ctx.band === 'cool' || ctx.band === 'cold' || ctx.rain || ctx.snow;
    const outer = pool((it) => it.category === 'outerwear');
    if (outer.length && (needsOuter || (ctx.band === 'mild' && (!shuffle || Math.random() < 0.6)))) {
      const best = ctx.rain || ctx.snow ? outer.filter((x) => RAIN_OK.test(text(x.it))).concat(outer.filter((x) => !RAIN_OK.test(text(x.it)))) : outer;
      chosen.push(shuffle ? pick(best.slice(0, 3)) : best[0].it);
    }
    const shoes = pool((it) => it.category === 'shoes');
    if (shoes.length) chosen.push(pick(shoes));
    if (ctx.band === 'cold') {
      const extras = pool((it) => it.category === 'accessories' && /scarf|hat|beanie|gloves/i.test(text(it)));
      if (extras.length) chosen.push(pick(extras));
    } else if (ctx.band === 'hot' && ctx.fx && /Clear|Mostly clear/.test(W.describe(ctx.fx.code)[0])) {
      const shades = pool((it) => /sunglasses|cap|sun ?hat/i.test(text(it)));
      if (shades.length) chosen.push(pick(shades));
    }
    return chosen.filter(Boolean);
  };
})((window.Wardrobe = window.Wardrobe || {}));
