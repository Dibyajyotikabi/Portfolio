/* /deals: reads the deals.json snapshot (from the Telegram channel, refreshed by publish_deals.py),
   builds the riso coupons and chips, then runs search, sort, category and "show more".
   Built with DOM methods only, so text from the feed is never parsed as HTML. */
(() => {
  'use strict';
  const STOCKS = ['butter', 'sky', 'mint', 'blush'];
  const SVG = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const rupees = (n) => Number(n).toLocaleString('en-IN');

  const safeUrl = (value, hosts) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && hosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h)) ? url.href : null;
    } catch { return null; }
  };

  /* Amazon serves any size from the same image id, and 400px is plenty for a 240px card */
  const small = (url) => url && url.replace(/\._[A-Z]{2}\d+_\./, '._SL400_.');
  const asin = (url) => (url.match(/\/dp\/([A-Z0-9]{10})/) || [])[1] || url;

  const clean = (d, i) => {
    const price = Number(d.price), mrp = Number(d.mrp), best = Number(d.best), rating = Number(d.rating);
    const buyUrl = safeUrl(d.buyUrl, ['amazon.in', 'amzn.to']);
    if (!d.name || !buyUrl || !(price > 0)) return null;
    return {
      name: String(d.name), fullName: String(d.fullName || d.name), buyUrl,
      image: small(safeUrl(d.image, ['media-amazon.com', 'ssl-images-amazon.com'])),
      trending: d.trending === true,
      price, mrp: mrp > price ? mrp : null, pct: Math.max(0, Math.round(Number(d.pct) || 0)),
      category: String(d.category || 'More gadgets'),
      atLow: Boolean(d.atLow), lowLabel: String(d.lowLabel || 'tracked low'),
      rank: Number(d.rank) || i + 1, rating: rating > 0 ? rating : null,
      notes: Array.isArray(d.notes) ? d.notes.map(String).slice(0, 4) : [],
      best: best > 0 ? best : null,
      time: Date.parse(d.date) || 0,
    };
  };

  /* h('p', {class: 'x'}, ['text', node]) with text set through text nodes only */
  const h = (tag, attrs, kids) => {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    (kids || []).filter((k) => k !== null && k !== '').forEach((k) => el.append(k));
    return el;
  };
  const s = (tag, attrs, kids) => {
    const el = document.createElementNS(SVG, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    (kids || []).forEach((k) => el.append(k));
    return el;
  };
  const riso = (text) => h('span', { class: 'riso' }, [h('span', { class: 'riso-b', 'aria-hidden': 'true' }, [text]), h('span', { class: 'riso-p' }, [text])]);

  const burst = (pct) => h('span', { class: 'burst', 'aria-hidden': 'true' }, [
    s('svg', { viewBox: '-50 -50 100 100' }, [
      s('use', { class: 'bp', href: '#burst-path' }),
      s('use', { class: 'bb', href: '#burst-path' }),
      s('text', { x: '2', y: '5.9' }, [s('tspan', { class: 'bn' }, [String(pct)]), s('tspan', { class: 'bpct', dy: '-10.9' }, ['%'])]),
      s('text', { class: 'bo', x: '2.8', y: '17.2' }, ['OFF']),
    ]),
  ]);

  const scissors = () => s('svg', { viewBox: '0 0 46 32', 'aria-hidden': 'true' }, [
    s('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.1', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      s('circle', { cx: '7.5', cy: '8', r: '5.4' }),
      s('path', { d: 'M12.4 10.4C20 13.6 31 17.6 44.5 21.6C35 20.4 24 18.6 19 17.4' }),
      s('circle', { cx: '7.5', cy: '24', r: '5.4' }),
      s('path', { d: 'M12.4 21.6C20 18.4 31 14.4 44.5 10.4C35 11.6 24 13.4 19 14.6' }),
    ]),
    s('circle', { cx: '23', cy: '16', r: '1.7', fill: '#E6407A' }),
  ]);

  const prevLine = (d) => {
    if (d.atLow) return h('p', { class: 'prev' }, ['At its ', h('b', {}, [d.lowLabel]), ' on Amazon']);
    if (d.mrp) return h('p', { class: 'prev' }, [h('b', {}, ['₹' + rupees(d.mrp - d.price) + ' below']), ' its list price']);
    return h('p', { class: 'prev' }, [d.rating ? 'Rated ' + d.rating + ' on Amazon' : 'Checked on Amazon']);
  };

  /* the feed rarely carries notes, so build plain ones from the numbers we do have */
  const notesFor = (d) => {
    if (d.notes.length) return d.notes;
    const out = [];
    if (d.mrp) out.push(`List price is ₹${rupees(d.mrp)}, so you save ₹${rupees(d.mrp - d.price)} (${d.pct}% off).`);
    if (d.atLow) out.push(`The price is at its ${d.lowLabel} on Amazon right now.`);
    if (d.rating) out.push(`Rated ${d.rating} out of 5 on Amazon.`);
    out.push(`I checked this ${d.category.toLowerCase()} deal on Amazon before posting it.`);
    return out;
  };

  const card = (d, i, cat) => {
    const nameId = 'n' + i;
    const pic = h('figure', { class: 'pic' + (d.image ? ' has-img' : '') }, d.image ? [h('img', {
      src: d.image, alt: '', decoding: 'async', loading: i < 8 ? 'eager' : 'lazy', width: '240', height: '240', referrerpolicy: 'no-referrer',
    })] : []);
    const body = h('div', { class: 'body' }, [
      h('div', { class: 'b-main' }, [
        h('div', { class: 'pic-wrap' }, [pic, h('span', { class: 'rank' }, [h('span', { class: 'vh' }, ['Rank ']), riso(String(i + 1))]), d.pct ? burst(d.pct) : null]),
        h('div', { class: 'b-txt' }, [d.trending ? h('p', { class: 'trend' }, ['Trending']) : null, h('h3', { class: 'name', id: nameId, title: d.fullName }, [d.name]), prevLine(d)]),
      ]),
      h('details', { class: 'why' }, [h('summary', {}, ['Why this deal']), h('ul', { class: 'notes' }, notesFor(d).map((n) => h('li', {}, [n])))]),
    ]);
    const amount = rupees(d.price);
    const stub = h('div', { class: 'stub' }, [
      d.mrp ? h('p', { class: 'usual' }, [h('span', { class: 'vh' }, ['Usually ']), h('span', { class: 'strike' }, [h('s', {}, ['₹' + rupees(d.mrp)]), h('i', { class: 'scrib', 'aria-hidden': 'true' })])]) : null,
      h('p', { class: 'price' + (amount.length > 7 ? ' long' : '') }, [h('span', { class: 'vh' }, ['Sale price ']), h('span', { class: 'cur' }, ['₹']), amount,
        d.pct ? h('span', { class: 'vh' }, [`, ${d.pct}% off`]) : null]),
      d.best ? h('p', { class: 'best' }, [h('span', { class: 'hl' }, ['Best buy ₹' + rupees(d.best)])]) : null,
      h('a', { class: 'cta', href: d.buyUrl, target: '_blank', rel: 'sponsored nofollow noopener' }, ['Buy on Amazon']),
    ]);
    const article = h('article', { class: 'cp', 'aria-labelledby': nameId }, [body,
      h('div', { class: 'perf-wrap', 'aria-hidden': 'true' }, [h('div', { class: 'perf' })]), stub]);
    return h('li', { class: 'coupon st-' + STOCKS[i % STOCKS.length], 'data-c': String(cat), 'data-r': String(i + 1),
      'data-p': String(d.pct), 'data-l': String(d.best || d.price) }, [article]);
  };

  const chip = (label, key, n, i, on) => h('button', {
    type: 'button', class: 'chip ticket st-' + STOCKS[i % STOCKS.length], 'data-cat': key, 'aria-pressed': String(on),
  }, [label + ' ', h('span', { class: 'n' }, [String(n)])]);

  const build = (deals, data) => {
    const counts = deals.reduce((m, d) => ({ ...m, [d.category]: (m[d.category] || 0) + 1 }), {});
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    $('chips').append(chip('All', 'all', deals.length, 0, true), ...cats.map((c, i) => chip(c, String(i), counts[c], i + 1, false)));
    $('deals').append(...deals.map((d, i) => card(d, i, cats.indexOf(d.category))));
    hero(deals, data);
    return cats;
  };

  const hero = (deals, data) => {
    const n = String(deals.length);
    document.querySelectorAll('.hp-num .riso-b, .hp-num .riso-p').forEach((el) => { el.textContent = n; });
    $('q').placeholder = `Search ${n} deals`;
    const t = Date.parse(data.syncedAt);
    if (!t) return;
    const asof = $('asof');
    asof.setAttribute('datetime', new Date(t).toISOString());
    asof.textContent = new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST';
    const hrs = Math.floor((Date.now() - t) / 36e5);
    if (hrs >= 7) {
      const st = $('stale');
      st.textContent = `Last checked ${hrs < 48 ? hrs + ' hours' : Math.floor(hrs / 24) + ' days'} ago.`;
      st.hidden = false;
    }
  };

  const failed = (message) => {
    const emptyEl = $('empty');
    emptyEl.querySelector('h3').textContent = 'Deals could not load';
    emptyEl.querySelector('p').textContent = message;
    $('clear').hidden = true;
    $('controls').hidden = true;
    emptyEl.hidden = false;
    $('count').textContent = '';
  };

  function filters(cats) {
    const list = $('deals'), countEl = $('count'), moreRow = $('more-row'), moreLeft = $('more-left'), emptyEl = $('empty');
    const chipsEl = $('chips'), chipsWrap = $('chips-wrap'), qEl = $('q'), sortEl = $('sort'), controls = $('controls');
    const chips = [...chipsEl.children];
    const deskMQ = matchMedia('(min-width:900px)'), reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
    const smooth = () => (reduceMQ.matches ? 'auto' : 'smooth');
    const SORTS = {
      rank: (a, b) => a.r - b.r,
      pct: (a, b) => b.p - a.p || a.r - b.r,
      low: (a, b) => a.l - b.l || a.r - b.r,
      high: (a, b) => b.l - a.l || a.r - b.r,
    };
    let items = [...list.children].map((el) => {
      const n = el.querySelector('.name');
      return { el, c: el.dataset.c, r: +el.dataset.r, p: +el.dataset.p, l: +el.dataset.l,
        hay: `${n.textContent} ${n.title} ${cats[+el.dataset.c] || ''}`.toLowerCase() };
    });
    const state = { q: '', cat: 'all', sort: 'rank' };
    let domSort = 'rank', current = [], shown = 0, page = 24;

    const pageSize = () => {
      const cols = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
      return Math.ceil(24 / cols) * cols;
    };

    const meta = () => {
      const n = current.length;
      const word = n === 1 ? 'deal' : 'deals';
      countEl.replaceChildren(...(n === 0 ? ['No deals match']
        : shown < n ? [`Showing ${shown} of `, h('b', {}, [String(n)]), ' deals'] : [h('b', {}, [String(n)]), ' ' + word]));
      emptyEl.hidden = n !== 0;
      const left = n - shown;
      moreRow.hidden = left <= 0;
      moreLeft.textContent = left > 0 ? `${Math.min(page, left)} of ${left} left` : '';
    };

    const paint = () => {
      list.querySelectorAll('.cut').forEach((x) => x.remove());
      const want = new Set(current.slice(0, shown));
      items.forEach((it) => { it.el.hidden = !want.has(it); });
      meta();
    };

    const keepListInView = () => {
      const top = list.getBoundingClientRect().top - (deskMQ.matches ? controls.offsetHeight : 0) - 8;
      if (top < 0) window.scrollTo(0, window.scrollY + top);
    };

    const apply = (user) => {
      const toks = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (state.sort !== domSort) {
        items = items.slice().sort(SORTS[state.sort]);
        list.append(...items.map((x) => x.el));
        domSort = state.sort;
      }
      const cc = { all: 0 };
      current = [];
      items.forEach((it) => {
        if (!toks.every((t) => it.hay.includes(t))) return;
        cc.all++;
        cc[it.c] = (cc[it.c] || 0) + 1;
        if (state.cat === 'all' || it.c === state.cat) current.push(it);
      });
      chips.forEach((b) => {
        const c = b.dataset.cat, n = cc[c] || 0;
        b.querySelector('.n').textContent = String(n);
        b.classList.toggle('zero', n === 0 && c !== state.cat);
      });
      page = pageSize();
      shown = Math.min(page, current.length);
      paint();
      list.classList.add('go');
      if (user) keepListInView();
    };

    const more = () => {
      page = pageSize();
      const from = shown, to = Math.min(current.length, from + page);
      const cut = h('li', { class: 'cut', 'aria-hidden': 'true' }, [
        h('span', { class: 'cut-line' }), h('span', { class: 'cut-sc' }, [scissors()]),
        h('span', { class: 'cut-txt' }, ['cut here', h('span', {}, [`deals ${from + 1} to ${to}`])]),
      ]);
      list.insertBefore(cut, current[from].el);
      current.slice(from, to).forEach((it) => { it.el.hidden = false; });
      shown = to;
      meta();
    };

    const pressCat = (key) => chips.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === key)));

    let qTimer = 0;
    qEl.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { state.q = qEl.value; apply(true); }, 120);
    });
    chipsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      state.cat = b.dataset.cat;
      pressCat(state.cat);
      apply(true);
    });
    sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(true); });
    $('more').addEventListener('click', more);
    $('clear').addEventListener('click', () => {
      state.q = ''; qEl.value = ''; state.cat = 'all';
      pressCat('all');
      apply(true);
      qEl.focus();
    });
    list.addEventListener('error', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      const f = img.closest('.pic');
      if (f) f.classList.remove('has-img');
      img.remove();
    }, true);

    let chipRaf = 0;
    const chipEnds = () => {
      chipRaf = 0;
      const atEnd = chipsEl.scrollLeft >= chipsEl.scrollWidth - chipsEl.clientWidth - 2, atStart = chipsEl.scrollLeft <= 2;
      chipsEl.classList.toggle('at-end', atEnd); chipsEl.classList.toggle('not-start', !atStart);
      chipsWrap.classList.toggle('can-next', !atEnd); chipsWrap.classList.toggle('can-prev', !atStart);
    };
    chipsEl.addEventListener('scroll', () => { if (!chipRaf) chipRaf = requestAnimationFrame(chipEnds); }, { passive: true });
    addEventListener('resize', chipEnds);
    $('chips-next').addEventListener('click', () => chipsEl.scrollBy({ left: chipsEl.clientWidth * 0.7, behavior: smooth() }));
    $('chips-prev').addEventListener('click', () => chipsEl.scrollBy({ left: -chipsEl.clientWidth * 0.7, behavior: smooth() }));

    if ('IntersectionObserver' in window) {
      let past = false;
      const stick = () => controls.classList.toggle('stuck', past && deskMQ.matches);
      new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; stick(); }).observe($('stick-sentinel'));
      deskMQ.addEventListener?.('change', stick);
      const jump = $('jump');
      new IntersectionObserver(([e]) => {
        jump.hidden = deskMQ.matches || e.isIntersecting || e.boundingClientRect.top > 0 || !items.length;
      }).observe(controls);
      jump.addEventListener('click', (e) => { e.preventDefault(); controls.scrollIntoView({ block: 'start', behavior: smooth() }); });
    }

    addEventListener('keydown', (e) => {
      const t = e.target.tagName;
      if (e.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t) || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      qEl.focus();
    });

    const q0 = new URLSearchParams(location.search).get('q');
    if (q0) { qEl.value = q0.trim().slice(0, 80); state.q = qEl.value; }
    apply(false);
    chipEnds();
    document.fonts?.ready.then(chipEnds);
  }

  const load = (url) => fetch(url, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); })
    .then((body) => {
      if (!body || !body.success || !Array.isArray(body.data?.deals)) throw new Error(`Bad deals file: ${url}`);
      return { list: body.data.deals.map(clean).filter(Boolean).sort((a, b) => a.rank - b.rank), data: body.data };
    });

  /* trending.json is a hand-picked list that sits on top; the page still works without it */
  const trending = load('/deals/trending.json').catch((err) => {
    console.warn('Trending deals skipped:', err);
    return { list: [] };
  });

  Promise.all([load('/deals/deals.json'), trending])
    .then(([main, top]) => {
      const seen = new Set(top.list.map((d) => asin(d.buyUrl)));
      const deals = [...top.list, ...main.list.filter((d) => !seen.has(asin(d.buyUrl)))];
      if (!deals.length) throw new Error('No deals in the file');
      filters(build(deals, main.data));
    })
    .catch((err) => {
      console.error('Deals failed to load:', err);
      failed('The deals could not load. Please reload the page.');
    });
})();
