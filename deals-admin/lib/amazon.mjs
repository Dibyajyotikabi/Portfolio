/* Reads Amazon.in Best Sellers and product pages as plain HTML and turns a product into
   an import candidate with template notes. Pure functions only, so the parsing can be
   tested on saved snippets. The fetching lives in deals-admin/fetch-deals.mjs. */
import { parseCount } from './importer.mjs';

/* Best Sellers lists to rotate through, with the category their products usually fit */
export const LISTS = Object.freeze([
  { path: 'electronics/92071051031', category: 'Phones & Tablets' },
  { path: 'computers', category: 'Laptops & Computers' },
  { path: 'kitchen', category: 'Home & Kitchen' },
  { path: 'electronics/11599648031', category: 'Wearables' },
  { path: 'electronics/1389375031', category: 'TVs & Projectors' },
  { path: 'electronics/1388921031', category: 'Audio' },
  { path: 'electronics/1458204031', category: 'Laptops & Computers' },
  { path: 'electronics/1388867031', category: 'Accessories & Storage' },
]);

/* Rotates by day, so every list comes up every couple of days */
export const listsFor = (day, count) => Array.from({ length: Math.min(count, LISTS.length) }, (_, i) => LISTS[(day * count + i) % LISTS.length]);

/* One from each list in turn, so a run doesn't fill up from a single category */
export const interleave = (queues) => {
  const longest = Math.max(0, ...queues.map((q) => q.length));
  return Array.from({ length: longest }, (_, i) => queues.map((q) => q[i])).flat().filter(Boolean);
};

/* Title words that beat the list's own category, checked in order */
const CATEGORY_WORDS = [
  [/\b(monitor|gaming)\b/i, 'Monitors & Gaming'],
  [/\b(smart ?watch|fitness band|smart ring)\b/i, 'Wearables'],
  [/\b(projector|smart tv|led tv|qled|oled|television)\b/i, 'TVs & Projectors'],
  [/\b(earbuds|headphones?|neckband|speaker|soundbar|earphones?)\b/i, 'Audio'],
  [/\b(laptop|notebook|keyboard|mouse|printer|router|webcam)\b/i, 'Laptops & Computers'],
  [/\b(power ?bank|charger|cable|pen ?drive|memory card|ssd|hard drive|adapter)\b/i, 'Accessories & Storage'],
  [/\b(smartphone|5g|tablet|ipad)\b/i, 'Phones & Tablets'],
];

const NAME_MAX = 60;
const NOTE_MAX = 150;
const FEATURE_MIN = 25;
const MAX_NOTES = 4;
/* Below this many reviews the rating line is too thin to be worth a note */
const RATING_NOTE_MIN_REVIEWS = 50;

/* The page an automated reader gets instead of the real one. We stop when we see it. */
const BLOCK_MARKERS = ['bm-verify', 'validateCaptcha', 'Enter the characters you see below', 'api-services-support@amazon.com'];
export const isBlockPage = (html) => BLOCK_MARKERS.some((m) => String(html).includes(m));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s) => String(s ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

export const stripTags = (s) => decode(String(s).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/* The markup from an element's id to the next feature block, so lookups stay local */
const section = (html, id, size = 6000) => {
  const at = html.indexOf(`id="${id}"`);
  return at < 0 ? '' : html.slice(at, at + size);
};

const first = (s, re) => (s.match(re) || [])[1] || '';

/* Best Sellers pages carry the full ranked list as JSON in an attribute */
export const parseBestSellers = (html) => {
  const ids = [...decode(html).matchAll(/"id":"([A-Z0-9]{10})"/g)].map((m) => m[1]);
  const links = [...html.matchAll(/\/dp\/([A-Z0-9]{10})/g)].map((m) => m[1]);
  return [...new Set([...ids, ...links])];
};

export const parseProduct = (html) => {
  const price = section(html, 'corePriceDisplay_desktop_feature_div');
  /* the attributes sit before the id, so read the whole img tag */
  const image = first(html, /(<img[^>]*id="landingImage"[^>]*>)/);
  const bullets = section(html, 'feature-bullets', 20000);
  const reviews = section(html, 'acrCustomerReviewText', 300);
  return {
    title: stripTags(first(html, /id="productTitle"[^>]*>([\s\S]*?)<\/span>/)),
    price: first(price, /class="a-price-whole">([\d,]+)/),
    mrp: first(price, /M\.R\.P\.:\s*(₹[\d,.]+)/) || first(price, /basisPrice[\s\S]*?class="a-offscreen">(₹[\d,.]+)/),
    rating: first(section(html, 'acrPopover', 300), /title="([\d.]+) out of 5/),
    reviews: first(reviews, /aria-label="([\d,]+)/) || first(reviews, /\(([\d,]+)\)/),
    bought: stripTags(first(section(html, 'social-proofing-faceout-title-tk_bought', 600), />([\s\S]*?past month)/)),
    badge: /Amazon(&#39;|')s\s*Choice/.test(section(html, 'acBadge_feature_div', 3000)) ? "Amazon's Choice"
      : /#1 Best Seller/.test(section(html, 'zeitgeistBadge_feature_div', 3000)) ? '#1 Best Seller' : '',
    image: decode(first(image, /data-old-hires="([^"]+)"/) || first(decode(image), /"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/)),
    bullets: [...bullets.matchAll(/<span class="a-list-item">([\s\S]*?)<\/span>/g)].map((m) => stripTags(m[1])).filter(Boolean).slice(0, 5),
  };
};

/* Cuts at a word boundary, never mid-word and never with an ellipsis */
const clip = (s, max) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1).replace(/\s+\S*$/, '');
  return cut.replace(/[\s,;:&+-]+$/, '');
};

/* "iQOO Z11 Lite 44W 5G (Solar Flame, 4GB RAM)" becomes "iQOO Z11 Lite 44W 5G" and
   "Samsung 55 inch (138cm) Mini LED Smart TV | 30W" becomes "Samsung 55 inch Mini LED Smart TV" */
export const shortName = (title) => {
  const t = String(title).replace(/\([^)]*\)/g, ' ').replace(/\(.*$/, '').replace(/\s+/g, ' ').trim();
  const head = t.split(/\s[|–—-]\s|\s?[,[|]|\s(?:for|with)\s/)[0].trim();
  return clip(head.length >= 12 ? head : t, NAME_MAX);
};

/* The short name decides first, since long titles list every device a product works with */
export const categoryFor = (title, fallback) => {
  const match = (s) => CATEGORY_WORDS.find(([re]) => re.test(s))?.[1];
  return match(shortName(title)) || match(title) || fallback;
};

const clean = (s) => String(s).replace(/[–—]/g, '-').replace(/[…]/g, '.').replace(/[→←*]/g, '').replace(/\s+/g, ' ').trim();
const isShouting = (s) => s.replace(/[^A-Za-z]/g, '').length > 8 && s === s.toUpperCase();
const sentenceCase = (s) => (isShouting(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);

/* Bullets that read like an ad or a spec sheet, not like me */
const AD_WORDS = /\b(our|we|immerse|elevate|seamless|unleash|ultimate|unparalleled|revolutionary)\b|\|/i;

/* Drops the bullet's label: "[Long battery]: ", "BIG BATTERY: " or "3A Fast Charging - " */
const unlabel = (s) => s.replace(/^\[[^\]]*\]\s*:?\s*/, '').replace(/^[^:]{2,40}:\s*/, '').replace(/^[^.]{2,40}?\s-\s/, '');

/* The first bullet that reads as one plain sentence about what the product does */
export const featureNote = (bullets) => {
  for (const raw of bullets || []) {
    const body = unlabel(clean(raw));
    const sentence = sentenceCase(body.split(/(?<=[.!?])\s/)[0].replace(/[.!?;,\s]+$/, ''));
    if (AD_WORDS.test(sentence)) continue;
    if (sentence.length >= FEATURE_MIN && sentence.length <= NOTE_MAX) return `${sentence}.`;
  }
  return null;
};

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/* 2 to 4 short notes: the saving, one real feature, then the proof people buy it */
export const templateNotes = (p) => {
  const price = parseCount(p.price), mrp = parseCount(p.mrp), reviews = parseCount(p.reviews);
  const pct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const bought = first(p.bought || '', /([\d.]+K?\+)/i);
  return [
    pct ? `You save ${rupees(mrp - price)} right now. That's ${pct}% off the ${rupees(mrp)} list price.` : null,
    featureNote(p.bullets),
    bought ? `${bought} bought on Amazon in the past month` : null,
    p.rating && reviews >= RATING_NOTE_MIN_REVIEWS ? `Rated ${p.rating} by ${reviews.toLocaleString('en-IN')} buyers on Amazon` : null,
  ].filter(Boolean).slice(0, MAX_NOTES);
};

/* Rewrites the notes that quote a price or a discount after the price changes. A savings
   note is dropped when the product is no longer below its list price. */
export const repriceNotes = (notes, price, mrp) => {
  const pct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return notes.map((n) => {
    if (/^You save ₹[\d,]+ right now\. That's \d+% off the ₹[\d,]+ list price\.$/.test(n)) {
      return pct ? `You save ${rupees(mrp - price)} right now. That's ${pct}% off the ${rupees(mrp)} list price.` : null;
    }
    if (/^\d+% below the list price of ₹[\d,]+$/.test(n)) return pct ? `${pct}% below the list price of ${rupees(mrp)}` : null;
    if (/^\d+% off\b/.test(n)) return pct ? n.replace(/^\d+%/, `${pct}%`) : null;
    return n;
  }).filter(Boolean);
};

/* Everything the importer needs. checked is true only when the page gave a real price and image. */
export const toCandidate = (asin, product, listCategory) => ({
  asin,
  name: shortName(product.title),
  fullName: product.title,
  image: product.image,
  price: product.price,
  mrp: product.mrp,
  rating: product.rating,
  reviews: product.reviews,
  bought: product.bought,
  ...(product.badge ? { badge: product.badge } : {}),
  category: categoryFor(product.title, listCategory),
  notes: templateNotes(product),
  checked: Boolean(product.title && product.price && /^https:\/\/m\.media-amazon\.com\//.test(product.image)),
});
