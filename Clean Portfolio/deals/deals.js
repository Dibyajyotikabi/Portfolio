/* /deals: the build prerenders every coupon and chip from deals.json and trending.json
   (scripts/prerender-deals.mjs), so this script only wires up search, sort, category and
   "show more". When the page is served without the build, it fetches the files and builds
   the same markup through render.js. DOM methods only, so feed text is never parsed as HTML. */
import { parseFeed, mergeDeals, views, asofText } from './render.js';

const SVG = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);

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

const scissors = () => s('svg', { viewBox: '0 0 46 32', 'aria-hidden': 'true' }, [
  s('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.1', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    s('circle', { cx: '7.5', cy: '8', r: '5.4' }),
    s('path', { d: 'M12.4 10.4C20 13.6 31 17.6 44.5 21.6C35 20.4 24 18.6 19 17.4' }),
    s('circle', { cx: '7.5', cy: '24', r: '5.4' }),
    s('path', { d: 'M12.4 21.6C20 18.4 31 14.4 44.5 10.4C35 11.6 24 13.4 19 14.6' }),
  ]),
  s('circle', { cx: '23', cy: '16', r: '1.7', fill: '#E6407A' }),
]);

const build = (deals, data) => {
  const { cats, chips, cards } = views(h, s).page(deals);
  $('chips').append(...chips);
  $('deals').append(...cards);
  const n = String(deals.length);
  document.querySelectorAll('.hp-num .riso-b, .hp-num .riso-p').forEach((el) => { el.textContent = n; });
  $('q').placeholder = `Search ${n} deals`;
  const t = Date.parse(data.syncedAt);
  if (t) {
    $('asof').setAttribute('datetime', new Date(t).toISOString());
    $('asof').textContent = asofText(t);
  }
  return cats;
};

/* the prerendered chips carry the category names, so search can match on them */
const prerendered = () => [...$('chips').children].slice(1).map((b) => b.firstChild.textContent.trim());

const stale = () => {
  const t = Date.parse($('asof').getAttribute('datetime'));
  const hrs = Math.floor((Date.now() - t) / 36e5);
  if (!t || hrs < 7) return;
  const st = $('stale');
  st.textContent = `Last checked ${hrs < 48 ? hrs + ' hours' : Math.floor(hrs / 24) + ' days'} ago.`;
  st.hidden = false;
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
  const dropImg = (img) => {
    const f = img.closest('.pic');
    if (f) f.classList.remove('has-img');
    img.remove();
  };
  list.addEventListener('error', (e) => { if (e.target?.tagName === 'IMG') dropImg(e.target); }, true);
  /* prerendered images can fail before this script runs, so their error event is already gone */
  list.querySelectorAll('img').forEach((img) => { if (img.complete && !img.naturalWidth) dropImg(img); });

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
  .then((body) => parseFeed(body, url));

const start = () => {
  if ($('deals').children.length) {
    stale();
    filters(prerendered());
    return;
  }
  /* trending.json is a hand-picked list that sits on top; the page still works without it */
  const trending = load('/deals/trending.json').catch((err) => {
    console.warn('Trending deals skipped:', err);
    return { list: [] };
  });
  Promise.all([load('/deals/deals.json'), trending])
    .then(([main, top]) => {
      const deals = mergeDeals(main, top);
      if (!deals.length) throw new Error('No deals in the file');
      const cats = build(deals, main.data);
      stale();
      filters(cats);
    })
    .catch((err) => {
      console.error('Deals failed to load:', err);
      failed('The deals could not load. Please reload the page.');
    });
};

start();
