/* The Deals tab: numbers at a glance, filters, and every deal in site order.
   Drag rows to reorder a list; the site shows them in exactly this order. */
import { h, rupees, when, api, toast, debounce } from './ui.js';
import { liveDeals } from '/lib/deals.mjs';
import { eligibility, planSync } from '/lib/format.mjs';

const SORTS = { site: 'Site order', newest: 'Newest first', discount: 'Biggest discount', price: 'Lowest price' };
const TG_FILTERS = { all: 'Any Telegram state', posted: 'Posted', queued: 'Will post', off: 'Not posting', ended: 'Ended' };
const FEED_FILTERS = { all: 'All', trending: 'Trending', main: 'Deals' };
const BY = {
  site: () => 0,
  newest: (a, b) => (Date.parse(b.deal.date) || 0) - (Date.parse(a.deal.date) || 0),
  discount: (a, b) => (b.deal.pct || 0) - (a.deal.pct || 0),
  price: (a, b) => a.deal.price - b.deal.price,
};

const thumb = (url) => (url ? url.replace(/\._[A-Z]{2}\d+_\./, '._SL160_.') : '');
const wrapFeed = (deals) => ({ data: { deals } });
const liveIds = (model) => new Set(liveDeals(wrapFeed(model.feeds.main.deals), wrapFeed(model.feeds.trending.deals)).map((d) => d.id));

const tgStatus = (deal, model, isLive) => {
  const entry = model.ledger[deal.id];
  if (entry) {
    const label = { posted: 'Posted', ended: 'Ended', deleted: 'Deleted' }[entry.state] || entry.state;
    return { key: entry.state === 'posted' ? 'posted' : 'ended', label, url: entry.url, title: `Sent ${when(entry.postedAt)}` };
  }
  if (!isLive) return { key: 'off', label: 'Hidden', title: 'Trending has the same product, so the site and Telegram skip this one' };
  const why = eligibility(deal, model.settings);
  return why.ok ? { key: 'queued', label: 'Will post', title: why.reason } : { key: 'off', label: 'Off', title: why.reason };
};

export const buildRows = (model) => {
  const live = liveIds(model);
  return ['trending', 'main'].flatMap((feed) => model.feeds[feed].deals.map((deal, index) => ({
    deal, feed, index, tg: tgStatus(deal, model, live.has(deal.id)),
    text: [deal.name, deal.fullName, deal.category, deal.id, ...(deal.notes || [])].join(' ').toLowerCase(),
  })));
};

const matches = (row, f) => (f.feed === 'all' || row.feed === f.feed) && (!f.cat || row.deal.category === f.cat)
  && (f.tg === 'all' || row.tg.key === f.tg) && (!f.q || f.q.split(/\s+/).every((w) => row.text.includes(w)));

const stat = (value, label, kind = '') => h('div', { class: `stat ${kind}` }, [h('b', {}, [String(value)]), h('span', {}, [label])]);

const statsFor = (model, rows) => {
  const plan = planSync(rows.filter((r) => r.tg.label !== 'Hidden').map((r) => r.deal), model.ledger, model.settings);
  const count = (t) => plan.filter((a) => a.type === t).length;
  const next = model.settings.enabled
    ? [`${count('post')} new`, `${count('edit')} edits`, `${count('end') + count('delete')} removed`].join(', ')
    : 'Auto-post is off';
  return [
    stat(rows.filter((r) => r.tg.label !== 'Hidden').length, 'live on the site'),
    stat(model.feeds.trending.deals.length, 'trending'),
    stat(Object.values(model.ledger).filter((e) => e.state === 'posted').length, 'in the channel'),
    stat(next, 'after you publish', model.settings.enabled ? 'accent' : 'muted'),
  ];
};

const tgChip = (tg) => (tg.url
  ? h('a', { class: `chip tg-${tg.key}`, href: tg.url, target: '_blank', rel: 'noopener', title: tg.title, 'data-stop': '1' }, [tg.label])
  : h('span', { class: `chip tg-${tg.key}`, title: tg.title }, [tg.label]));

const rowEl = (row, canDrag) => {
  const { deal, feed } = row;
  return h('li', { class: 'deal-row', tabindex: '0', draggable: canDrag ? 'true' : null, 'data-id': deal.id, 'data-feed': feed }, [
    canDrag ? h('span', { class: 'grip', 'aria-hidden': 'true' }) : null,
    h('img', { class: 'rthumb', src: thumb(deal.image), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
    h('div', { class: 'rmain' }, [
      h('div', { class: 'rname' }, [deal.name]),
      h('div', { class: 'rsub' }, [deal.category || 'More gadgets', h('span', { class: 'dot' }), when(deal.date)]),
    ]),
    h('div', { class: 'rprice' }, [h('b', {}, [rupees(deal.price)]), deal.mrp > deal.price ? h('s', {}, [rupees(deal.mrp)]) : null]),
    h('span', { class: `pct ${deal.pct >= 40 ? 'hot' : ''}` }, [deal.pct ? `${deal.pct}%` : '']),
    h('span', { class: `chip feed-${feed}` }, [feed === 'trending' ? `Trending #${row.index + 1}` : 'Deals']),
    tgChip(row.tg),
  ]);
};

const select = (name, options, value, label) => h('select', { name, 'aria-label': label }, Object.entries(options).map(([v, text]) => h('option', { value: v, selected: v === value ? true : null }, [text])));

/* HTML5 drag and drop that moves rows live, then saves the new order once */
const enableDrag = (list, feed, onChange) => {
  let dragging = null, before = '';
  const order = () => [...list.children].map((li) => li.dataset.id);
  list.addEventListener('dragstart', (e) => {
    dragging = e.target.closest('.deal-row');
    before = order().join();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragging.dataset.id);
    requestAnimationFrame(() => dragging.classList.add('dragging'));
  });
  list.addEventListener('dragover', (e) => {
    const over = e.target.closest('.deal-row');
    if (!dragging || !over || over === dragging) return;
    e.preventDefault();
    const box = over.getBoundingClientRect();
    list.insertBefore(dragging, e.clientY > box.top + box.height / 2 ? over.nextSibling : over);
  });
  list.addEventListener('drop', (e) => e.preventDefault());
  list.addEventListener('dragend', async () => {
    dragging?.classList.remove('dragging');
    dragging = null;
    if (order().join() === before) return;
    try { onChange(await api('PUT', '/api/order', { feed, ids: order() })); toast('New order saved. Publish to put it live.'); } catch (err) { toast(err.message, 'error'); onChange(null); }
  });
};

export const createDealsTab = ({ onOpen, onNew, onChange }) => {
  const filters = { q: '', feed: 'all', cat: '', tg: 'all', sort: 'site' };
  let model = null, rows = [];
  const stats = h('div', { class: 'stats' });
  const search = h('input', { type: 'search', id: 'search', placeholder: 'Search deals', 'aria-label': 'Search deals', autocomplete: 'off' });
  const catSelect = h('select', { name: 'cat', 'aria-label': 'Category' });
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'List' }, Object.entries(FEED_FILTERS).map(([v, label]) => h('label', {}, [
    h('input', { type: 'radio', name: 'feed', value: v, checked: v === filters.feed }), h('span', {}, [label]),
  ])));
  const toolbar = h('div', { class: 'toolbar' }, [
    h('div', { class: 'search' }, [search, h('kbd', {}, ['/'])]), seg, catSelect,
    select('tg', TG_FILTERS, filters.tg, 'Telegram state'), select('sort', SORTS, filters.sort, 'Sort'),
    h('span', { class: 'grow' }),
    h('button', { class: 'btn primary', type: 'button', onclick: () => onNew(filters.feed === 'trending' ? 'trending' : 'main') }, ['New deal', h('kbd', {}, ['N'])]),
  ]);
  const meta = h('p', { class: 'list-meta' });
  const listBox = h('div', { class: 'list-box' });
  const el = h('section', { class: 'tab-deals' }, [stats, toolbar, meta, listBox]);

  const renderList = () => {
    const shown = rows.filter((r) => matches(r, filters)).sort(BY[filters.sort]);
    const canDrag = filters.sort === 'site' && filters.feed !== 'all' && !filters.q && !filters.cat && filters.tg === 'all';
    meta.replaceChildren(`Showing ${shown.length} of ${rows.length}. `, canDrag ? 'Drag rows to change the order on the site.' : 'Pick Trending or Deals with no other filters to drag and reorder.');
    if (!shown.length) {
      return listBox.replaceChildren(h('div', { class: 'empty' }, [h('p', {}, ['No deals match these filters.']),
        h('button', { class: 'btn ghost', type: 'button', onclick: clear }, ['Clear filters'])]));
    }
    const list = h('ol', { class: 'deal-list' }, shown.map((r) => rowEl(r, canDrag)));
    if (canDrag) enableDrag(list, filters.feed, onChange);
    listBox.replaceChildren(list);
  };
  const clear = () => {
    Object.assign(filters, { q: '', cat: '', tg: 'all', sort: 'site' });
    search.value = '';
    toolbar.querySelectorAll('select').forEach((s) => { s.value = filters[s.name] ?? ''; });
    renderList();
  };
  const update = (next) => {
    model = next;
    rows = buildRows(model);
    const cats = [...new Set(rows.map((r) => r.deal.category).filter(Boolean))].sort();
    if (filters.cat && !cats.includes(filters.cat)) filters.cat = '';
    catSelect.replaceChildren(h('option', { value: '' }, ['All categories']), ...cats.map((c) => h('option', { value: c, selected: c === filters.cat ? true : null }, [c])));
    stats.replaceChildren(...statsFor(model, rows));
    renderList();
  };

  search.addEventListener('input', debounce(() => { filters.q = search.value.trim().toLowerCase(); renderList(); }, 60));
  toolbar.addEventListener('change', (e) => {
    if (!(e.target.name in filters) || e.target === search) return;
    filters[e.target.name] = e.target.value;
    renderList();
  });
  const openFrom = (e) => {
    if (e.target.closest('[data-stop]')) return;
    const li = e.target.closest('.deal-row');
    const row = li && rows.find((r) => r.deal.id === li.dataset.id && r.feed === li.dataset.feed);
    if (row) onOpen(row);
  };
  listBox.addEventListener('click', openFrom);
  listBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') openFrom(e); });
  return { el, update, focusSearch: () => search.focus() };
};
