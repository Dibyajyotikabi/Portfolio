/* /deals: reads the deals.json snapshot and renders a filterable list.
   The snapshot comes from the Telegram channel, refreshed by publish_deals.py.
   Built with DOM methods only, so text from the feed is never parsed as HTML. */
(() => {
  const grid = document.querySelector('[data-deal-grid]');
  const cats = document.querySelector('[data-deal-cats]');
  const meta = document.querySelector('[data-deal-meta]');
  const search = document.querySelector('[data-deal-search]');
  const sort = document.querySelector('[data-deal-sort]');
  if (!grid || !cats || !meta || !search || !sort) return;

  const ALL = 'All';
  const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const state = { deals: [], cat: ALL, query: '', sort: 'new', synced: null };

  const safeUrl = (value, hosts) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && hosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h)) ? url.href : null;
    } catch { return null; }
  };

  const clean = (d) => {
    const price = Number(d.price), mrp = Number(d.mrp);
    const buyUrl = safeUrl(d.buyUrl, ['amazon.in', 'amzn.to']);
    if (!d.name || !buyUrl || !(price > 0)) return null;
    return {
      name: String(d.name), fullName: String(d.fullName || d.name), buyUrl,
      image: safeUrl(d.image, ['media-amazon.com', 'ssl-images-amazon.com']),
      price, mrp: mrp > price ? mrp : null, pct: Number(d.pct) || 0,
      category: String(d.category || 'More gadgets'),
      atLow: Boolean(d.atLow), lowLabel: String(d.lowLabel || 'tracked low'),
      time: Date.parse(d.date) || 0,
    };
  };

  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids.filter(Boolean));
    return node;
  };

  const card = (d) => {
    const img = d.image ? el('img', { src: d.image, alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' }) : null;
    const link = el('a', { href: d.buyUrl, textContent: d.name, title: d.fullName, target: '_blank', rel: 'sponsored nofollow noopener' });
    const price = el('p', { className: 'deal-price' }, el('strong', { textContent: rupees.format(d.price) }),
      d.mrp && el('s', { textContent: rupees.format(d.mrp) }),
      d.pct > 0 && el('span', { className: 'deal-off', textContent: `${d.pct}% off` }));
    return el('li', { className: 'deal-card' },
      el('div', { className: 'deal-img' }, img),
      el('div', { className: 'deal-body' },
        el('p', { className: 'deal-cat', textContent: d.category }),
        el('h2', {}, link),
        d.atLow && el('p', { className: 'deal-note', textContent: `At its ${d.lowLabel} on Amazon` }),
        price,
        el('span', { className: 'deal-go', textContent: 'View on Amazon', ariaHidden: 'true' })));
  };

  const sorters = {
    new: (a, b) => b.time - a.time,
    pct: (a, b) => b.pct - a.pct,
    low: (a, b) => a.price - b.price,
  };

  const visible = () => {
    const q = state.query.toLowerCase();
    return state.deals
      .filter((d) => state.cat === ALL || d.category === state.cat)
      .filter((d) => !q || d.fullName.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
      .sort(sorters[state.sort] || sorters.new);
  };

  const renderCats = () => {
    const counts = state.deals.reduce((m, d) => m.set(d.category, (m.get(d.category) || 0) + 1), new Map());
    const list = [[ALL, state.deals.length], ...[...counts].sort((a, b) => b[1] - a[1])];
    cats.replaceChildren(...list.map(([name, n]) => {
      const btn = el('button', { type: 'button', textContent: name }, el('span', { textContent: n }));
      btn.setAttribute('aria-pressed', String(name === state.cat));
      btn.addEventListener('click', () => { state.cat = name; renderCats(); render(); });
      return btn;
    }));
  };

  const render = () => {
    const items = visible();
    grid.replaceChildren(...(items.length ? items.map(card) : [el('li', { className: 'deal-empty', textContent: 'No deals match that. Try another word or category.' })]));
    const updated = state.synced ? ` · Updated ${day.format(state.synced)}` : '';
    meta.textContent = `${items.length} ${items.length === 1 ? 'deal' : 'deals'}${updated}`;
  };

  search.addEventListener('input', () => { state.query = search.value.trim(); render(); });
  sort.addEventListener('change', () => { state.sort = sort.value; render(); });

  fetch('/deals/deals.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((body) => {
      if (!body || !body.success || !Array.isArray(body.data?.deals)) throw new Error('Bad deals file');
      state.deals = body.data.deals.map(clean).filter(Boolean);
      const synced = Date.parse(body.data.syncedAt);
      state.synced = Number.isNaN(synced) ? null : new Date(synced);
      renderCats();
      render();
    })
    .catch((err) => {
      console.error('Deals failed to load:', err);
      meta.textContent = 'The deals could not load. Please reload the page.';
    });
})();
