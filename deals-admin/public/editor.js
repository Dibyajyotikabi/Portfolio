/* The deal editor: a drawer with every field, live checks and both previews.
   Saving writes the file right away; nothing reaches the site or Telegram until Publish. */
import { $, h, api, toast, ask, debounce } from './ui.js';
import { validateDeal, popularity, asinOf, affiliateUrl, tagOf, FEEDS, BADGES, POPULAR } from '/lib/deals.mjs';
import { siteCard, telegramPost } from './preview.js';

const NOTE_SLOTS = 4;
const toLocal = (iso) => {
  const ms = Date.parse(iso) || Date.now();
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const field = (label, input, hint) => h('label', { class: 'field' }, [h('span', { class: 'lbl' }, [label]), input, hint ? h('span', { class: 'hint' }, [hint]) : null]);
const input = (name, value, attrs = {}) => h('input', { name, value: value ?? '', autocomplete: 'off', spellcheck: 'false', ...attrs });

const segmented = (name, options, value) => h('div', { class: 'seg', role: 'radiogroup' }, options.map(([v, label]) => h('label', {}, [
  h('input', { type: 'radio', name, value: v, checked: v === value }), h('span', {}, [label]),
])));

const telegramMode = (d) => (d.telegram === true ? 'on' : d.telegram === false ? 'off' : 'auto');

const productSection = (d, ctx) => h('section', { class: 'card' }, [
  h('h4', {}, ['Product']),
  field('Amazon link', input('link', d.buyUrl, { placeholder: 'Paste any amazon.in product link', inputmode: 'url' }),
    `Any amazon.in link works. It becomes amazon.in/dp/ASIN?tag=${ctx.defaultTag}`),
  h('div', { class: 'grid2' }, [
    field('Short name', input('name', d.name, { maxlength: '120', placeholder: 'Samsung 24-inch Monitor', spellcheck: 'true' })),
    field('Category', input('category', d.category, { list: 'cats', placeholder: 'Monitors & Gaming' })),
  ]),
  field('Full Amazon title', h('textarea', { name: 'fullName', rows: '2', maxlength: '300', spellcheck: 'true' }, [d.fullName || ''])),
  h('div', { class: 'img-row' }, [
    h('img', { class: 'thumb', alt: '', referrerpolicy: 'no-referrer', src: d.image || '' }),
    field('Image link', input('image', d.image, { placeholder: 'https://m.media-amazon.com/images/I/....jpg', inputmode: 'url' })),
  ]),
]);

const priceSection = (d) => h('section', { class: 'card' }, [
  h('h4', {}, ['Price']),
  h('div', { class: 'grid4' }, [
    field('Deal price ₹', input('price', d.price, { type: 'number', min: '1', step: '1', inputmode: 'numeric' })),
    field('MRP ₹', input('mrp', d.mrp, { type: 'number', min: '0', step: '1', inputmode: 'numeric' })),
    field('Best buy ₹', input('best', d.best, { type: 'number', min: '0', step: '1', inputmode: 'numeric' }), 'With bank or coupon'),
    field('Rating', input('rating', d.rating, { type: 'number', min: '0', max: '5', step: '0.1', inputmode: 'decimal' })),
  ]),
  field('Best buy offer', input('bestVia', d.bestVia, { maxlength: '40', placeholder: 'coupon + SBI card' }), 'Shown as "With coupon + SBI card"'),
  h('div', { class: 'row wrap' }, [
    h('label', { class: 'check' }, [h('input', { type: 'checkbox', name: 'atLow', checked: d.atLow }), 'At its lowest price']),
    input('lowLabel', d.lowLabel || 'tracked low', { class: 'small', maxlength: '40', 'aria-label': 'Low price label' }),
    h('span', { class: 'pill pct', id: 'pct' }),
  ]),
]);

const popularSection = (d) => h('section', { class: 'card' }, [
  h('h4', {}, ['Is it popular?']),
  h('div', { class: 'grid4' }, [
    field('Bought last month', input('bought', d.bought, { type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: '300' }), 'From "300+ bought in past month"'),
    field('Reviews', input('reviews', d.reviews, { type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: '1200' }), 'Number of ratings'),
    field('Amazon badge', h('select', { name: 'badge' }, [h('option', { value: '' }, ['None']),
      ...BADGES.map((b) => h('option', { value: b, selected: d.badge === b }, [b]))])),
  ]),
  h('p', { class: 'pop', id: 'pop', 'aria-live': 'polite' }),
  h('p', { class: 'hint' }, [`Posted only with ${POPULAR.bought}+ bought, ${POPULAR.reviews}+ reviews at ${POPULAR.rating}+, a badge or trending, plus ${POPULAR.discount}%+ off and no rating under ${POPULAR.minRating}.`]),
]);

const notesSection = (d) => h('section', { class: 'card' }, [
  h('h4', {}, ['Why this deal']),
  ...Array.from({ length: NOTE_SLOTS }, (_, i) => input(`note${i}`, (d.notes || [])[i], { maxlength: '200', spellcheck: 'true', placeholder: i ? '' : 'At its tracked low on Amazon right now' })),
  h('p', { class: 'hint' }, ['Shown under "Why this deal" on the site and as bullets in the Telegram post.']),
]);

const telegramSection = (d) => h('section', { class: 'card' }, [
  h('h4', {}, ['Telegram']),
  segmented('telegram', [['auto', 'Auto'], ['on', 'Always post'], ['off', 'Never post']], telegramMode(d)),
  field('Custom post text', h('textarea', { name: 'telegramText', rows: '3', maxlength: '700', spellcheck: 'true',
    placeholder: 'Leave empty to use the notes above' }, [d.telegramText || '']), 'Replaces the bullet notes in the Telegram post only.'),
]);

const advancedSection = (d, isNew) => h('details', { class: 'card adv', open: isNew }, [
  h('summary', {}, ['More options']),
  h('div', { class: 'grid2' }, [
    field('Deal ID', input('id', d.id, { maxlength: '64', pattern: '[A-Za-z0-9_-]+' }), isNew ? 'Made from the ASIN' : 'Changing it posts a new Telegram message'),
    field('Date found', input('date', toLocal(d.date), { type: 'datetime-local' })),
  ]),
  field('Source post', input('post', d.post, { placeholder: 'https://t.me/...', inputmode: 'url' }), 'Deals with a t.me source are not posted again when that option is on'),
  h('label', { class: 'check' }, [h('input', { type: 'checkbox', name: 'confirmed', checked: d.confirmed !== false }), 'Price checked on Amazon']),
]);

/* Form values to a deal object, on top of the deal being edited */
const readForm = (form, base, ctx) => {
  const v = (n) => form.elements[n]?.value.trim() ?? '';
  const link = v('link');
  const buyUrl = asinOf(link) ? affiliateUrl(link, tagOf(link) || ctx.defaultTag) : link;
  const mode = form.elements.telegram.value;
  const price = Number(v('price')), mrp = Number(v('mrp'));
  const { telegram, telegramText, ...rest } = base;
  return {
    ...rest,
    id: v('id'), name: v('name'), fullName: v('fullName'), category: v('category'), image: v('image') || null, buyUrl,
    price: v('price'), mrp: v('mrp'), best: v('best'), bestVia: v('bestVia'), rating: v('rating'),
    /* the saved offer steps add up to the old best price, so a hand-typed one drops them */
    ...(Number(v('best')) !== Number(base.best) ? { offers: [], nonPrime: null, offersAt: new Date().toISOString() } : {}),
    bought: v('bought'), reviews: v('reviews'), badge: v('badge'),
    pct: mrp > price && price > 0 ? Math.round((1 - price / mrp) * 100) : 0,
    atLow: form.elements.atLow.checked, lowLabel: v('lowLabel'),
    notes: Array.from({ length: NOTE_SLOTS }, (_, i) => v(`note${i}`)).filter(Boolean),
    date: v('date') ? new Date(v('date')).toISOString() : base.date, post: v('post') || undefined,
    confirmed: form.elements.confirmed.checked,
    ...(mode === 'auto' ? {} : { telegram: mode === 'on' }),
    ...(v('telegramText') ? { telegramText: v('telegramText') } : {}),
  };
};

const actionsBar = (isNew, feed) => h('footer', { class: 'drawer-foot' }, [
  isNew ? null : h('button', { type: 'button', class: 'btn ghost danger-text', 'data-act': 'delete' }, ['Delete']),
  isNew ? null : h('button', { type: 'button', class: 'btn ghost', 'data-act': 'duplicate' }, ['Duplicate']),
  isNew ? null : h('button', { type: 'button', class: 'btn ghost', 'data-act': 'move' }, [`Move to ${feed === 'trending' ? 'Deals' : 'Trending'}`]),
  h('span', { class: 'grow' }),
  h('button', { type: 'button', class: 'btn ghost', 'data-act': 'close' }, ['Cancel']),
  h('button', { type: 'submit', class: 'btn primary', id: 'save' }, [isNew ? 'Add deal' : 'Save', h('kbd', {}, ['⌘S'])]),
]);

/* Keeps the ID and % off in step with what is typed */
const syncDerived = (form, deal, isNew, feed) => {
  const asin = asinOf(deal.buyUrl);
  if (isNew && asin && !form.dataset.idTouched) form.elements.id.value = `${feed === 'trending' ? 't' : 'a'}-${asin}`;
  $('#pct', form).textContent = deal.pct ? `${deal.pct}% off` : 'No discount';
  $('.thumb', form).src = deal.image || '';
  form.elements.lowLabel.hidden = !deal.atLow;
  const pop = popularity({ ...deal, trending: feed === 'trending' });
  const popEl = $('#pop', form);
  popEl.className = `pop ${pop.ok ? 'ok' : 'no'}`;
  popEl.textContent = pop.ok ? `Popular: ${pop.signals.join(', ')}` : `Not posted to Telegram: ${pop.misses.join('; ')}`;
};

export const openEditor = ({ deal, feed: startFeed, isNew }, ctx) => {
  let feed = startFeed;
  const base = { ...deal };
  const card = siteCard(), tg = telegramPost();
  const errorsEl = h('div', { class: 'errors', role: 'alert' });
  const feedPick = isNew ? segmented('feed', Object.entries(FEEDS).map(([k, f]) => [k, f.label]), feed) : h('span', { class: `pill feed ${feed}` }, [FEEDS[feed].label]);
  const form = h('form', { class: 'drawer', novalidate: true }, [
    h('header', { class: 'drawer-head' }, [h('h3', {}, [isNew ? 'New deal' : 'Edit deal']), feedPick,
      h('button', { type: 'button', class: 'icon-btn', 'data-act': 'close', 'aria-label': 'Close' }, ['✕'])]),
    h('div', { class: 'drawer-body' }, [
      h('div', { class: 'col form-col' }, [errorsEl, productSection(deal, ctx), priceSection(deal), popularSection(deal), notesSection(deal), telegramSection(deal), advancedSection(deal, isNew)]),
      h('div', { class: 'col preview-col' }, [h('h4', {}, ['On the site']), card.el, h('h4', {}, ['In the Telegram channel']), tg.el]),
    ]),
    actionsBar(isNew, feed),
  ]);
  const shade = h('div', { class: 'shade' }, [form]);
  let saved = JSON.stringify(readForm(form, base, ctx));

  const current = () => readForm(form, base, ctx);
  const refresh = () => {
    const d = current();
    const { errors } = validateDeal(d, feed);
    errorsEl.replaceChildren(...errors.map((e) => h('p', {}, [e])));
    errorsEl.hidden = !errors.length || !form.dataset.tried;
    syncDerived(form, d, isNew, feed);
    card.update(d, feed);
    tg.update(d, ctx.settings, isNew ? null : ctx.ledger[base.id]);
  };
  const close = async (force) => {
    if (!force && JSON.stringify(current()) !== saved && !(await ask('Discard changes?', 'Your edits to this deal are not saved.', 'Discard', true))) return;
    shade.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => shade.remove(), 180);
  };
  const save = async () => {
    form.dataset.tried = '1';
    const d = current();
    const { errors } = validateDeal(d, feed);
    if (errors.length) { refresh(); return toast(errors[0], 'error'); }
    $('#save', form).disabled = true;
    try {
      const state = await api('PUT', '/api/deal', { feed, deal: d, originalId: isNew ? undefined : base.id });
      saved = JSON.stringify(current());
      toast(isNew ? 'Deal added. Publish to put it live.' : 'Saved. Publish to put it live.');
      ctx.onChange(state);
      close(true);
    } catch (err) { toast(err.message, 'error'); } finally { $('#save', form).disabled = false; }
  };
  const act = async (name) => {
    if (name === 'close') return close();
    if (name === 'duplicate') { await close(true); return ctx.onDuplicate({ ...current(), id: '' }, feed); }
    if (name === 'delete') {
      const posted = ctx.ledger[base.id]?.state === 'posted';
      if (!(await ask('Delete this deal?', `${base.name} leaves the site on the next publish.${posted ? ' Its Telegram post is handled as set in Telegram settings.' : ''}`, 'Delete', true))) return;
      try { ctx.onChange(await api('DELETE', '/api/deal', { feed, id: base.id })); toast('Deleted. Publish to remove it from the site.'); close(true); } catch (err) { toast(err.message, 'error'); }
    }
    if (name === 'move') {
      const to = feed === 'trending' ? 'main' : 'trending';
      try { ctx.onChange(await api('POST', '/api/move', { from: feed, to, id: base.id })); toast(`Moved to ${FEEDS[to].label}.`); close(true); } catch (err) { toast(err.message, 'error'); }
    }
  };
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); close(); }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
  form.addEventListener('input', debounce((e) => {
    if (e.target.name === 'id') form.dataset.idTouched = '1';
    if (e.target.name === 'feed') feed = e.target.value;
    refresh();
  }, 90));
  shade.addEventListener('mousedown', (e) => { if (e.target === shade) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(shade);
  refresh();
  (isNew ? form.elements.link : form.elements.name).focus();
};
