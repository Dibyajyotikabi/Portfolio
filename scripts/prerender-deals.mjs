import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// /deals used to ship an empty list that JavaScript filled in, so search engines
// and link previews saw "Top 0 Deals" and no products. This writes every coupon,
// chip, the count and the structured data into dist/deals/index.html from the
// same render.js the page uses, so the HTML is complete before any script runs.
const SITE = 'https://dibyajyotikabi.com';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
class Html { constructor(html) { this.html = html; } }
const VOID = new Set(['img']);
const h = (tag, attrs, kids) => {
  const a = Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const inner = (kids || []).filter((k) => k !== null && k !== '').map((k) => (k instanceof Html ? k.html : esc(k))).join('');
  return new Html(VOID.has(tag) ? `<${tag}${a}>` : `<${tag}${a}>${inner}</${tag}>`);
};
const join = (nodes) => nodes.map((n) => n.html).join('');

// "</script>" inside a feed name must not be able to close the JSON-LD block.
const jsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

const structured = (deals, syncedAt) => [{
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  '@id': `${SITE}/deals/#page`, url: `${SITE}/deals/`, name: 'Deals I Checked on Amazon',
  inLanguage: 'en-IN', ...(syncedAt ? { dateModified: syncedAt } : {}),
  author: { '@type': 'Person', name: 'Dibyajyoti Kabi', url: `${SITE}/` },
  mainEntity: {
    '@type': 'ItemList', numberOfItems: deals.length, itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: deals.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.fullName, url: d.buyUrl })),
  },
}, {
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Deals', item: `${SITE}/deals/` },
  ],
}];

const swap = (html, from, to) => {
  if (!html.includes(from)) throw new Error(`deals/index.html no longer has ${from}; update scripts/prerender-deals.mjs.`);
  return html.replace(from, () => to);
};

export const prerenderDeals = async (dist) => {
  const dir = path.join(dist, 'deals');
  const { parseFeed, mergeDeals, views, asofText } = await import(pathToFileURL(path.join(dir, 'render.js')).href);
  const read = (name) => parseFeed(JSON.parse(readFileSync(path.join(dir, name), 'utf8')), name);
  const main = read('deals.json'), top = read('trending.json');
  const deals = mergeDeals(main, top);
  if (!deals.length) throw new Error('deals.json and trending.json have no usable deals.');

  const { chips, cards } = views(h, h).page(deals);
  const n = String(deals.length);
  const t = Date.parse(main.data.syncedAt);
  const iso = t ? new Date(t).toISOString() : '';
  const file = path.join(dir, 'index.html');
  let html = readFileSync(file, 'utf8');
  html = swap(html, '<span class="riso-b" aria-hidden="true">0</span><span class="riso-p">0</span>',
    `<span class="riso-b" aria-hidden="true">${n}</span><span class="riso-p">${n}</span>`);
  html = swap(html, 'placeholder="Search deals"', `placeholder="Search ${n} deals"`);
  html = swap(html, '>Loading deals</p>', `><b>${n}</b> deals</p>`);
  html = swap(html, '<div class="chips" id="chips" role="group" aria-label="Category"></div>',
    `<div class="chips" id="chips" role="group" aria-label="Category">${join(chips)}</div>`);
  html = swap(html, '<ol class="deals" id="deals"></ol>', `<ol class="deals" id="deals">${join(cards)}</ol>`);
  html = swap(html, '<time id="asof" datetime=""></time>', `<time id="asof" datetime="${iso}">${t ? esc(asofText(t)) : ''}</time>`);
  html = swap(html, '</head>', structured(deals, iso).map((d) => `  <script type="application/ld+json">${jsonLd(d)}</script>\n`).join('') + '</head>');
  writeFileSync(file, html);
  console.log(`Prerendered ${n} deals into deals/index.html.`);
};
