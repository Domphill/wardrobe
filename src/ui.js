/* Wardrobe — DOM helpers, icons, shared components and the router. */
(function (L) {
  'use strict';
  const U = L.util;
  const UI = (L.ui = {});

  /* ---------- environment ---------- */
  const env = (L.env = {
    artifact: false,
    standalone: !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true,
    ios: /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    downloads() {
      return Promise.resolve(null);
    }
  });

  /* ---------- element builder ---------- */
  function append(el, kids) {
    for (const k of kids) {
      if (k == null || k === false || k === true) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }
  function h(sel, props, ...kids) {
    let tag = 'div';
    let id = null;
    const classes = [];
    sel.replace(/([.#]?)([\w-]+)/g, (m, p, name) => {
      if (p === '.') classes.push(name);
      else if (p === '#') id = name;
      else tag = name;
      return m;
    });
    const el = document.createElement(tag);
    if (id) el.id = id;
    if (classes.length) el.className = classes.join(' ');
    if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
      kids.unshift(props);
      props = null;
    }
    let value;
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
        else if (k === 'style') {
          if (typeof v === 'string') el.setAttribute('style', v);
          else for (const s of Object.keys(v)) el.style.setProperty(s.startsWith('--') ? s : s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v[s]);
        } else if (k === 'text') el.textContent = v;
        else if (k === 'value') value = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple' || k === 'readOnly') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    append(el, kids);
    if (value !== undefined) el.value = value;
    return el;
  }
  UI.h = h;
  UI.clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };
  /* Appends like h() does: nulls, booleans and nested arrays are skipped, strings become text. */
  UI.append = (el, ...kids) => {
    append(el, kids);
    return el;
  };

  /* ---------- icons (24px grid, stroked) ---------- */
  const IC = {
    today: '<path d="M3.5 18.5h17"/><path d="M7 18.5a5 5 0 0 1 10 0"/><path d="M12 5.5v3"/><path d="m5.3 9.8 1.9 1.6"/><path d="m18.7 9.8-1.9 1.6"/><path d="M8.5 21.5h7"/>',
    journal: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5v17"/><path d="M12.5 8.5h3.5M12.5 12h3.5"/>',
    goals: '<path d="M5.5 21V4"/><path d="M5.5 4.5h12l-2.2 4 2.2 4h-12"/>',
    insights: '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 2.5 4.5-6"/>',
    toolkit: '<path d="M12 21v-8"/><path d="M12 13c0-4.5 3-7.6 8-8-.2 5-3.3 8-8 8z"/><path d="M12 15.5c-.4-3.3-2.8-5.6-7-6 .3 3.9 2.6 6 7 6z"/>',
    support: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="m6 6 3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    back: '<path d="m14.5 5-7 7 7 7"/>',
    chev: '<path d="m9.5 5 7 7-7 7"/>',
    down: '<path d="m5 9.5 7 7 7-7"/>',
    edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="m13 7 4 4"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.6"/>',
    download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
    upload: '<path d="M12 15.5v-11"/><path d="M7.5 9 12 4.5 16.5 9"/><path d="M5 19.5h14"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    phone: '<path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z"/>',
    message: '<path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    link: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h5"/>',
    wind: '<path d="M3.5 9h11a3 3 0 1 0-3-3"/><path d="M3.5 13.5h14a3 3 0 1 1-3 3"/><path d="M3.5 18h5"/>',
    anchor: '<circle cx="12" cy="5.5" r="2"/><path d="M12 7.5V20"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M8.5 11h7"/>',
    spark: '<path d="M12 3.5c.7 4.4 4.1 7.8 8.5 8.5-4.4.7-7.8 4.1-8.5 8.5-.7-4.4-4.1-7.8-8.5-8.5 4.4-.7 7.8-4.1 8.5-8.5z"/>',
    heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>',
    clipboard: '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5v-1h6v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6z"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    refresh: '<path d="M19.5 11A7.5 7.5 0 0 0 6.3 6.8"/><path d="M5.5 3.5v4h4"/><path d="M4.5 13a7.5 7.5 0 0 0 13.2 4.2"/><path d="M18.5 20.5v-4h-4"/>',
    archive: '<rect x="4" y="4.5" width="16" height="4.5" rx="1"/><path d="M5.5 9v10.5h13V9"/><path d="M10 13h4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.7 1.3A3.4 3.4 0 0 0 7 18.5z"/>',
    device: '<rect x="7" y="3.5" width="10" height="17" rx="2"/><path d="M11 17.5h2"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 10h16M4 14.5h16M10 10v9"/>',
    steps: '<path d="M4 19.5h4.5v-4.5H13v-4.5h4.5V6H20"/>',
    repeat: '<path d="M17 4.5 19.5 7 17 9.5"/><path d="M4.5 12V11a4 4 0 0 1 4-4h11"/><path d="M7 19.5 4.5 17 7 14.5"/><path d="M19.5 12v1a4 4 0 0 1-4 4h-11"/>',
    feather: '<path d="M19.5 4.5c-6 0-11.5 4.5-11.5 11v4"/><path d="M8 15.5c5 0 9.5-3 11.5-11"/><path d="M4.5 19.5 8 16"/>',
    plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
    dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 10a3.5 3.5 0 0 1 7 0"/><path d="m12 10 1.5-1.5"/>',
    barcode: '<path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/>',
    scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/>',
    flame: '<path d="M12 3.5c3.5 3.5 6 6.5 6 10a6 6 0 0 1-12 0c0-2.5 1.5-4.5 3-5.5 0 2 1 3 2 3 0-3 0-5 1-7.5z"/>',
    run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 20l3.5-5 3 2.5V21"/><path d="M6 11.5 9 8.5h4.5l2 4 3 1"/><path d="m11.5 15-1-4"/>',
    history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.5H8"/><path d="M12 8v4l2.5 2"/>',
    more: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
    drop: '<path d="M12 3.5c3.5 4.3 5.5 7.3 5.5 10a5.5 5.5 0 0 1-11 0c0-2.7 2-5.7 5.5-10z"/>',
    hanger: '<path d="M12 7.5a2 2 0 1 1 2-2"/><path d="M12 7.5v2.3"/><path d="M12 9.8 4 15.6a1.2 1.2 0 0 0 .7 2.2h14.6a1.2 1.2 0 0 0 .7-2.2z"/>',
    shirt: '<path d="M8.5 4.5 4 7l1.5 4 2.5-1v9.5h8V10l2.5 1L20 7l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/>',
    camera: '<path d="M4.5 8.5h3l1.5-2.5h6l1.5 2.5h3v10h-15z"/><circle cx="12" cy="13.5" r="3"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m4.5 16.5 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/><circle cx="15.5" cy="9.5" r="1.5"/>',
    wand: '<path d="m4.5 19.5 10-10"/><path d="m14.5 9.5 1.5 1.5"/><path d="M16 4v2M20 8h-2M18.5 5.5 17 7M14 4.5l.7 1.8"/>',
    undo: '<path d="M8.5 6.5 4.5 10.5l4 4"/><path d="M4.5 10.5h9a5 5 0 0 1 0 10H9"/>',
    star: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    'star-on': '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z" fill="currentColor"/>',
    tag: '<path d="M4.5 12.5v-8h8l7 7-8 8z"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>',
    layers: '<path d="m12 4.5 8 4-8 4-8-4z"/><path d="m4 12.5 8 4 8-4"/><path d="m4 16.5 8 4 8-4"/>',
    forward: '<rect x="4.5" y="4.5" width="10" height="10" rx="1.5"/><path d="M9.5 19.5h10v-10"/>',
    backward: '<rect x="9.5" y="9.5" width="10" height="10" rx="1.5"/><path d="M14.5 4.5h-10v10"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    palette: '<path d="M12 4a8 8 0 1 0 0 16h1.5a2 2 0 0 0 1.4-3.4 2 2 0 0 1 1.4-3.4H18a2 2 0 0 0 2-2A8 8 0 0 0 12 4z"/><circle cx="8.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/>',
    bag: '<path d="M5.5 9h13l-1 11h-11z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    sparkle: '<path d="M12 4.5c.5 3.3 3 5.8 6.3 6.3-3.3.5-5.8 3-6.3 6.3-.5-3.3-3-5.8-6.3-6.3 3.3-.5 5.8-3 6.3-6.3z"/><path d="M18.5 15.5c.2 1.3 1.2 2.3 2.5 2.5-1.3.2-2.3 1.2-2.5 2.5-.2-1.3-1.2-2.3-2.5-2.5 1.3-.2 2.3-1.2 2.5-2.5z"/>',
    eraser: '<path d="m4.5 15.5 8-8 6 6-5 5H8.5z"/><path d="M4.5 19.5h15"/>',
    restore: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.5H8"/>',
    rain: '<path d="M7 15.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.7 1.3A3.4 3.4 0 0 0 7 15.5z"/><path d="M9 18.5v2M12.5 18v2.5M16 18.5v2"/>',
    snow: '<path d="M7 14.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.7 1.3A3.4 3.4 0 0 0 7 14.5z"/><path d="M9 18v.1M12.5 19.5v.1M16 18v.1M10.7 20.5v.1M14.2 21.5v.1"/>',
    shuffle: '<path d="M4 7h3.5l7 10H20"/><path d="M4 17h3.5l2-2.9"/><path d="M13.5 9.9 14.5 7H20"/><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    select: '<circle cx="12" cy="12" r="7.5" stroke-dasharray="3.2 2.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
    brush: '<path d="M4.5 19.5c2.5 0 4-1.2 4.4-3.3.3-1.4 1.4-2.2 2.6-1.3l.7.7c.9 1.2.1 2.3-1.3 2.6-2.1.4-3.3 1.9-3.3 4.4"/><path d="m11.5 14.5 7-9.5 1.5 1.5-9 7.5z"/>',
    crop: '<path d="M7 3.5v13.5h13.5"/><path d="M3.5 7H17v13.5"/>',
    dropper: '<path d="m4.5 19.5 1-3.5 8-8 2.5 2.5-8 8z"/><path d="m12.5 7 4.5 4.5"/><path d="M15.5 4.5a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-2 2-4-4z"/>'
  };
  UI.icon = (name, cls) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = IC[name] || IC.info;
    return svg;
  };
  UI.logo = (size) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('class', 'logo-mark');
    svg.setAttribute('aria-hidden', 'true');
    if (size) {
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
    }
    svg.innerHTML =
      '<circle cx="16" cy="16" r="14" class="logo-glow"/>' +
      '<path d="M16 12.2a2.2 2.2 0 1 1 2.2-2.2" class="logo-line"/>' +
      '<path d="M16 12.2v2.4" class="logo-line"/>' +
      '<path d="M16 14.6 7 21a1.3 1.3 0 0 0 .8 2.4h16.4A1.3 1.3 0 0 0 25 21z" class="logo-solid"/>';
    return svg;
  };

  /* ---------- small components ---------- */
  UI.btn = (label, onclick, opts) => {
    opts = opts || {};
    const cls = 'button.btn' + (opts.kind ? '.' + opts.kind : '') + (opts.small ? '.small' : '') + (opts.block ? '.block' : '');
    return h(cls, { type: opts.type || 'button', onclick, disabled: opts.disabled, id: opts.id, 'aria-label': opts.aria }, opts.icon ? UI.icon(opts.icon) : null, label ? h('span', label) : null);
  };
  UI.iconBtn = (iconName, label, onclick, opts) => {
    opts = opts || {};
    return h('button.icon-btn' + (opts.cls ? '.' + opts.cls : ''), { type: 'button', 'aria-label': label, title: label, onclick, id: opts.id }, UI.icon(iconName));
  };
  UI.field = (label, control, help, opts) => {
    opts = opts || {};
    return h('label.field' + (opts.cls ? '.' + opts.cls : ''), label ? h('span.label', label) : null, help ? h('span.help', help) : null, control);
  };
  UI.autoGrow = (ta) => {
    const fit = () => {
      ta.style.height = 'auto';
      ta.style.height = Math.max(ta.scrollHeight, 0) + 2 + 'px';
    };
    ta.addEventListener('input', fit);
    requestAnimationFrame(fit);
    return ta;
  };
  /* A photo from storage; the src arrives once the blob has been read. */
  UI.pic = (id, alt, cls) => {
    const img = h('img' + (cls ? '.' + cls : ''), { alt: alt || '', decoding: 'async' });
    if (id) {
      L.data.imageUrl(id).then((u) => {
        if (u) img.src = u;
        else img.classList.add('missing');
      });
    } else img.classList.add('missing');
    return img;
  };
  /* Single-choice chips, like a radio group. */
  UI.pick = (opts) => {
    const { options, value, onChange, label } = opts;
    const wrap = h('div.chips', { role: 'radiogroup', 'aria-label': label });
    const mark = (v) => {
      for (const b of wrap.children) b.setAttribute('aria-checked', String(b.dataset.value === String(v)));
    };
    for (const o of options) {
      const opt = typeof o === 'string' ? { value: o, label: o } : o;
      wrap.appendChild(
        h(
          'button.chip',
          { type: 'button', role: 'radio', 'data-value': String(opt.value), 'aria-checked': String(opt.value === value), onclick: () => {
            mark(opt.value);
            onChange(opt.value);
          } },
          opt.swatch ? h('span.swatch', { style: { background: opt.swatch } }) : null,
          opt.label
        )
      );
    }
    return wrap;
  };
  /* A full-screen "working" notice for slow jobs like cutting a photo out. */
  UI.busy = (msg) => {
    const layer = document.getElementById('layer') || document.body;
    const text = h('p', msg);
    const el = h('div.busy', { role: 'status', 'aria-live': 'polite' }, h('div.busy-box', h('div.spinner', { 'aria-hidden': 'true' }), text));
    layer.appendChild(el);
    return {
      close: () => el.remove(),
      text: (t) => (text.textContent = t)
    };
  };

  UI.chips = (opts) => {
    const { options, selected, onToggle, label, custom } = opts;
    const wrap = h('div.chips', { role: 'group', 'aria-label': label });
    for (const opt of options) {
      wrap.appendChild(
        h(
          'button.chip',
          {
            type: 'button',
            'aria-pressed': String(selected.has(opt)),
            onclick: (e) => {
              const b = e.currentTarget;
              const now = b.getAttribute('aria-pressed') !== 'true';
              b.setAttribute('aria-pressed', String(now));
              onToggle(opt, now);
            }
          },
          opt
        )
      );
    }
    if (custom) {
      const add = h(
        'button.chip.chip-add',
        {
          type: 'button',
          onclick: () => {
            const input = h('input.chip-input', {
              type: 'text',
              maxlength: '32',
              'aria-label': custom.label || 'Add your own',
              placeholder: 'Type and press Enter',
              onkeydown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = input.value.trim().replace(/\s+/g, ' ');
                  if (v) custom.onAdd(v.charAt(0).toUpperCase() + v.slice(1));
                } else if (e.key === 'Escape') {
                  input.replaceWith(add);
                }
              },
              onblur: () => {
                const v = input.value.trim().replace(/\s+/g, ' ');
                if (v) custom.onAdd(v.charAt(0).toUpperCase() + v.slice(1));
                else if (input.isConnected) input.replaceWith(add);
              }
            });
            add.replaceWith(input);
            input.focus();
          }
        },
        UI.icon('plus'),
        h('span', custom.label || 'Add your own')
      );
      wrap.appendChild(add);
    }
    return wrap;
  };

  UI.segmented = (opts) => {
    const { options, value, onChange, label, id } = opts;
    const wrap = h('div.seg', { role: 'radiogroup', 'aria-label': label, id });
    const buttons = options.map((o) =>
      h(
        'button.seg-btn',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(o.value === value),
          tabindex: o.value === value ? '0' : '-1',
          onclick: () => select(o.value, true),
          onkeydown: (e) => {
            const i = options.indexOf(o);
            let j = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % options.length;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + options.length) % options.length;
            if (j >= 0) {
              e.preventDefault();
              select(options[j].value, true);
              buttons[j].focus();
            }
          }
        },
        o.label
      )
    );
    if (value == null && buttons[0]) buttons[0].setAttribute('tabindex', '0');
    function select(v, fire) {
      buttons.forEach((b, i) => {
        const on = options[i].value === v;
        b.setAttribute('aria-checked', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
      });
      if (fire) onChange(v);
    }
    buttons.forEach((b) => wrap.appendChild(b));
    return wrap;
  };

  UI.empty = (title, body, action) =>
    h('div.empty', h('div.empty-mark', UI.logo(44)), h('h3.empty-title', title), body ? h('p.empty-body', body) : null, action || null);
  /* A single-choice picker as a native select, for long lists. */
  UI.select = (opts) => {
    const sel = h('select.select', { 'aria-label': opts.label, id: opts.id, onchange: (e) => opts.onChange(e.target.value) });
    for (const o of opts.options) sel.appendChild(h('option', { value: o.value, selected: o.value === opts.value }, o.label));
    return sel;
  };

  UI.sectionHead = (title, extra, opts) => {
    opts = opts || {};
    return h('div.section-head', h(opts.level || 'h2', { class: 'section-title', id: opts.id }, title), extra || null);
  };

  /* ---------- dialogs ---------- */
  function focusables(root) {
    return [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }
  UI.sheet = (opts) => {
    const { title, body, actions, onClose, wide, dismissible = true, cls } = opts;
    const layer = document.getElementById('layer') || document.body;
    const prev = document.activeElement;
    const titleId = 'sheet-title-' + U.uid().slice(0, 6);
    const panel = h(
      'div.sheet' + (wide ? '.wide' : '') + (cls ? '.' + cls : ''),
      { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title ? titleId : null, 'aria-label': title ? null : opts.label || 'Dialog', tabindex: '-1' },
      h(
        'div.sheet-head',
        title ? h('h2.sheet-title', { id: titleId }, title) : h('span'),
        dismissible ? UI.iconBtn('x', 'Close', () => close()) : null
      ),
      h('div.sheet-body', body),
      actions && actions.length ? h('div.sheet-actions', actions) : null
    );
    const backdrop = h('div.sheet-backdrop', { onclick: () => dismissible && close() });
    const wrap = h('div.sheet-wrap', backdrop, panel);
    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 160);
      if (prev && prev.isConnected && prev.focus) {
        try {
          prev.focus({ preventScroll: true });
        } catch (e) {
          /* ignore */
        }
      }
      if (onClose) onClose(result);
    }
    function onKey(e) {
      if (!wrap.isConnected) return;
      /* When one sheet opens over another, only the top one answers the keyboard. */
      const open = layer.querySelectorAll('.sheet-wrap:not(.closing)');
      if (open[open.length - 1] !== wrap) return;
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab') {
        const f = focusables(panel);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
    layer.appendChild(wrap);
    requestAnimationFrame(() => {
      const f = panel.querySelector('[data-autofocus]');
      try {
        (f || panel).focus({ preventScroll: true });
      } catch (e) {
        /* ignore */
      }
    });
    return { close, panel, wrap };
  };

  UI.confirm = (opts) =>
    new Promise((resolve) => {
      const { title, body, confirm = 'Confirm', cancel = 'Cancel', danger, typed } = opts;
      let ok = false;
      let input = null;
      const okBtn = h(
        'button.btn' + (danger ? '.danger' : '.primary'),
        {
          type: 'button',
          onclick: () => {
            ok = true;
            s.close();
          }
        },
        confirm
      );
      if (typed) {
        okBtn.disabled = true;
        input = h('input.input', {
          type: 'text',
          autocomplete: 'off',
          autocapitalize: 'characters',
          spellcheck: 'false',
          'data-autofocus': '',
          oninput: () => {
            okBtn.disabled = input.value.trim().toUpperCase() !== typed;
          }
        });
      }
      const s = UI.sheet({
        title,
        body: [
          typeof body === 'string' ? h('p', body) : body,
          typed ? UI.field('Type ' + typed + ' to confirm', input) : null
        ],
        actions: [h('button.btn.ghost', { type: 'button', onclick: () => s.close() }, cancel), okBtn],
        onClose: () => resolve(ok)
      });
    });

  UI.toast = (msg, opts) => {
    opts = opts || {};
    const box = document.getElementById('toasts');
    if (!box) return;
    const ms = opts.ms || 4000;
    const t = h(
      'div.toast',
      h('span', msg),
      opts.action
        ? h(
            'button.toast-btn',
            {
              type: 'button',
              onclick: () => {
                t.remove();
                opts.action.run();
              }
            },
            opts.action.label
          )
        : null
    );
    box.appendChild(t);
    while (box.children.length > 2) box.removeChild(box.firstChild);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  };

  /* ---------- clipboard and files ---------- */
  UI.copy = async (text, what) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      const ta = h('textarea', { style: 'position:fixed;opacity:0;top:0;left:0', readonly: 'readonly' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      ta.remove();
    }
    UI.toast(ok ? (what || 'Copied') + ' to clipboard' : 'Couldn’t copy. Select the text and copy it yourself.');
    return ok;
  };

  UI.canDownload = async () => {
    if (!env.artifact) return true;
    return !!(await env.downloads());
  };

  UI.download = async (filename, text, mime) => {
    if (env.artifact) {
      const dl = await env.downloads();
      if (!dl) throw new Error('Saving files isn’t available in this view.');
      try {
        await dl.save({ filename, data: text });
        return 'saved';
      } catch (e) {
        if (e && e.code === 'declined') return 'declined';
        if (e && e.code === 'rate_limited') throw new Error('A save is already waiting for your answer.');
        throw new Error((e && e.message) || 'The file couldn’t be saved.');
      }
    }
    const blob = new Blob([text], { type: mime || 'application/octet-stream' });
    /* On iPhone, the share sheet ("Save to Files") is more reliable than a download link,
       especially for an app added to the home screen. */
    const touch = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (touch && navigator.canShare && window.File) {
      try {
        const file = new File([blob], filename, { type: mime || 'application/octet-stream' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return 'saved';
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return 'declined';
        /* fall back to a normal download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  };

  UI.pickFile = (accept) =>
    new Promise((resolve) => {
      const input = h('input', { type: 'file', accept, style: 'display:none' });
      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        input.remove();
        if (!f) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, text: String(r.result || '') });
        r.onerror = () => resolve(null);
        r.readAsText(f);
      });
      document.body.appendChild(input);
      input.click();
    });

  /* ---------- router ----------
     Keeps its own history so in-app back works everywhere; mirrors the route into location.hash
     when the page is allowed to. */
  const R = (L.router = {
    current: { name: 'closet', arg: null },
    stack: [],
    tabs: ['closet', 'outfits', 'calendar', 'stats', 'more'],
    parse(hash) {
      const s = String(hash || '').replace(/^#/, '');
      if (!s || !/^[A-Za-z0-9-]+$/.test(s)) return { name: 'closet', arg: null };
      const i = s.indexOf('-');
      return i < 0 ? { name: s, arg: null } : { name: s.slice(0, i), arg: s.slice(i + 1) };
    },
    hashOf(r) {
      return '#' + r.name + (r.arg ? '-' + r.arg : '');
    },
    go(name, arg, opts) {
      opts = opts || {};
      const next = { name, arg: arg || null };
      if (!opts.replace && !(R.current.name === next.name && R.current.arg === next.arg)) R.stack.push(R.current);
      if (R.tabs.includes(name) && !arg) R.stack = [];
      R.current = next;
      R._writeHash(next);
      if (L.app) L.app.render({ nav: true });
    },
    back(fallback) {
      const prev = R.stack.pop();
      R.current = prev || { name: fallback || 'closet', arg: null };
      R._writeHash(R.current);
      if (L.app) L.app.render({ nav: true });
    },
    _writeHash(r) {
      const want = R.hashOf(r);
      try {
        if (location.hash !== want) {
          R._ignore = want;
          location.hash = want;
        }
      } catch (e) {
        /* sandboxed frames may refuse; the in-app history still works */
      }
    },
    start() {
      R.current = R.parse(location.hash);
      window.addEventListener('hashchange', () => {
        const r = R.parse(location.hash);
        if (R._ignore && location.hash === R._ignore) {
          R._ignore = null;
          return;
        }
        R._ignore = null;
        if (r.name === R.current.name && r.arg === R.current.arg) return;
        const top = R.stack[R.stack.length - 1];
        if (top && top.name === r.name && top.arg === r.arg) R.stack.pop();
        else R.stack.push(R.current);
        R.current = r;
        if (L.app) L.app.render({ nav: true });
      });
    }
  });
})((window.Wardrobe = window.Wardrobe || {}));
