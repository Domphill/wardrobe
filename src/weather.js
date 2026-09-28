/* Wardrobe — the day's weather, from Open-Meteo (a free, open weather service with no account).
   Only the chosen town's map position is sent; nothing about the person or their clothes. */
(function (L) {
  'use strict';
  const U = L.util;
  const D = L.data;
  const W = (L.weather = {});
  const CACHE = 'wardrobe.weather';

  const CODES = {
    0: ['Clear', 'sun'],
    1: ['Mostly clear', 'sun'],
    2: ['Partly cloudy', 'cloud'],
    3: ['Overcast', 'cloud'],
    45: ['Fog', 'cloud'],
    48: ['Fog', 'cloud'],
    51: ['Light drizzle', 'rain'],
    53: ['Drizzle', 'rain'],
    55: ['Heavy drizzle', 'rain'],
    56: ['Freezing drizzle', 'rain'],
    57: ['Freezing drizzle', 'rain'],
    61: ['Light rain', 'rain'],
    63: ['Rain', 'rain'],
    65: ['Heavy rain', 'rain'],
    66: ['Freezing rain', 'rain'],
    67: ['Freezing rain', 'rain'],
    71: ['Light snow', 'snow'],
    73: ['Snow', 'snow'],
    75: ['Heavy snow', 'snow'],
    77: ['Snow grains', 'snow'],
    80: ['Rain showers', 'rain'],
    81: ['Rain showers', 'rain'],
    82: ['Heavy showers', 'rain'],
    85: ['Snow showers', 'snow'],
    86: ['Snow showers', 'snow'],
    95: ['Thunderstorms', 'rain'],
    96: ['Thunderstorms', 'rain'],
    99: ['Thunderstorms', 'rain']
  };
  W.describe = (code) => CODES[code] || ['Changeable', 'cloud'];
  W.seasonOf = (d) => {
    const m = U.toDate(d).getMonth();
    return m >= 2 && m <= 4 ? 'Spring' : m >= 5 && m <= 7 ? 'Summer' : m >= 8 && m <= 10 ? 'Autumn' : 'Winter';
  };
  /* How the day feels, weighted towards the afternoon high. */
  W.band = (tmax, tmin) => {
    const t = tmax * 0.7 + tmin * 0.3;
    return t >= 23 ? 'hot' : t >= 17 ? 'warm' : t >= 11 ? 'mild' : t >= 5 ? 'cool' : 'cold';
  };
  W.BAND_WORDS = { hot: 'Hot', warm: 'Warm', mild: 'Mild', cool: 'Cool', cold: 'Cold' };
  W.fmtTemp = (c) => ((D.prefs().tempUnit || 'C') === 'F' ? Math.round((c * 9) / 5 + 32) + '°F' : Math.round(c) + '°C');

  W.geocode = async (name) => {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name.trim()) + '&count=6&language=en&format=json');
    if (!r.ok) throw new Error('The town search didn’t answer (error ' + r.status + ').');
    const j = await r.json();
    return (j.results || []).map((x) => ({ name: x.name, region: [x.admin1, x.country].filter(Boolean).join(', '), lat: Math.round(x.latitude * 100) / 100, lon: Math.round(x.longitude * 100) / 100 }));
  };

  const readCache = () => {
    try {
      return JSON.parse(localStorage.getItem(CACHE) || 'null');
    } catch (e) {
      return null;
    }
  };
  W.clearCache = () => {
    try {
      localStorage.removeItem(CACHE);
    } catch (e) {
      /* ignore */
    }
  };
  /* The next ten days' forecast for a place, kept for three hours so pages open instantly. */
  W.forecast = async (place, force) => {
    if (!place || place.lat == null) return null;
    const key = U.todayKey() + '|' + place.lat + ',' + place.lon;
    const c = readCache();
    if (!force && c && c.key === key && Date.now() - c.at < 3 * 3600 * 1000) return c.days;
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      place.lat +
      '&longitude=' +
      place.lon +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=10';
    const r = await fetch(url);
    if (!r.ok) throw new Error('The weather service didn’t answer (error ' + r.status + ').');
    const j = await r.json();
    const d = j.daily || {};
    const days = (d.time || []).map((day, i) => ({
      day,
      code: (d.weather_code || d.weathercode || [])[i],
      tmax: (d.temperature_2m_max || [])[i],
      tmin: (d.temperature_2m_min || [])[i],
      rain: (d.precipitation_probability_max || [])[i],
      wind: (d.wind_speed_10m_max || [])[i]
    }));
    if (!days.length || days[0].tmax == null) throw new Error('No forecast came back for that town.');
    try {
      localStorage.setItem(CACHE, JSON.stringify({ key, at: Date.now(), days }));
    } catch (e) {
      /* ignore */
    }
    return days;
  };
  /* One line about a forecast day: "14°C, light rain". */
  W.line = (fx) => {
    const [text] = W.describe(fx.code);
    return W.fmtTemp(fx.tmax) + ', ' + text.toLowerCase() + (fx.rain >= 45 && !/rain|drizzle|shower|snow|thunder/i.test(text) ? ', ' + fx.rain + '% chance of rain' : '');
  };
})((window.Wardrobe = window.Wardrobe || {}));
