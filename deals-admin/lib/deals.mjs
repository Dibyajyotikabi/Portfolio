/* One place that decides what a valid deal looks like. The admin server checks every
   save with it, the browser uses it for instant feedback and the Telegram sync uses
   liveDeals() so the channel only ever gets the deals the site really shows. */
export const FEEDS = Object.freeze({
  main: { file: 'deals.json', stamp: 'syncedAt', label: 'Deals' },
  trending: { file: 'trending.json', stamp: 'checkedAt', label: 'Trending' },
});

const BUY_HOSTS = ['amazon.in', 'amzn.to'];
const IMAGE_HOSTS = ['media-amazon.com', 'ssl-images-amazon.com'];
const MAX_NOTES = 4;
export const BADGES = Object.freeze(["Amazon's Choice", '#1 Best Seller']);
/* What makes a deal worth posting: proof people buy it, a real discount and no weak rating */
export const POPULAR = Object.freeze({ bought: 100, reviews: 100, rating: 4, minRating: 3.8, discount: 10 });
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const hostOk = (value, hosts) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h)) ? url.href : null;
  } catch { return null; }
};

export const asinOf = (url) => (String(url || '').match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i) || [])[1]?.toUpperCase() || null;

/* Any Amazon product link becomes the clean affiliate link the site uses */
export const affiliateUrl = (link, tag) => {
  const asin = asinOf(link);
  return asin ? `https://www.amazon.in/dp/${asin}?tag=${encodeURIComponent(tag)}` : null;
};

export const tagOf = (url) => {
  try { return new URL(url).searchParams.get('tag') || ''; } catch { return ''; }
};

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const isoDate = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, '+00:00');
const num = (v) => (v === null || v === '' || v === undefined ? null : Number(v));
const count = (n) => Number(n).toLocaleString('en-IN');

/* Returns { ok, signals, misses }. One demand signal is enough (sales last month, enough
   good reviews, an Amazon badge or the hand-picked trending list), but the discount
   has to be real and a low rating rules a deal out. */
export const popularity = (deal) => {
  const d = deal || {};
  const bought = Number(d.bought) || 0, reviews = Number(d.reviews) || 0, rating = Number(d.rating) || 0;
  const price = Number(d.price), mrp = Number(d.mrp);
  const pct = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const signals = [
    bought >= POPULAR.bought ? `${count(bought)}+ bought last month` : null,
    rating >= POPULAR.rating && reviews >= POPULAR.reviews ? `Rated ${rating} by ${count(reviews)} buyers` : null,
    BADGES.includes(d.badge) ? d.badge : null,
    d.trending === true ? 'On the trending list' : null,
  ].filter(Boolean);
  const misses = [
    signals.length ? null : `needs ${POPULAR.bought}+ bought, ${POPULAR.reviews}+ reviews at ${POPULAR.rating}+, a badge or trending`,
    pct >= POPULAR.discount ? null : `discount is under ${POPULAR.discount}%`,
    rating && rating < POPULAR.minRating ? `rating is under ${POPULAR.minRating}` : null,
  ].filter(Boolean);
  return { ok: !misses.length, signals, misses };
};

/* How the best price is reached: a coupon and at most one card offer */
const OFFER_TYPES = ['coupon', 'bank', 'cashback'];
const MAX_OFFERS = 3;
const cleanOffers = (list) => (Array.isArray(list) ? list : []).slice(0, MAX_OFFERS)
  .map((o) => ({ type: String(o?.type || ''), save: num(o?.save), card: text(o?.card, 60) }))
  .filter((o) => OFFER_TYPES.includes(o.type) && Number.isInteger(o.save) && o.save > 0 && (o.type === 'coupon' || o.card))
  .map((o) => (o.type === 'coupon' ? { type: o.type, save: o.save } : o));

/* The price for buyers without Prime, kept only when it sits between the lowest price and the
   Amazon price. The card offer they'd use is optional. */
const cleanNonPrime = (np, best, price) => {
  const npBest = num(np?.best);
  if (!(best > 0 && Number.isInteger(npBest) && npBest > best && npBest <= price)) return null;
  const [card] = cleanOffers(np.type ? [np] : []).filter((o) => o.type !== 'coupon');
  return { best: npBest, ...(card || {}) };
};

/* Returns { deal, errors }. The deal is a new, normalized object; the input is untouched. */
export const validateDeal = (input, feed) => {
  const d = input && typeof input === 'object' ? input : {};
  const errors = [];
  const price = num(d.price), mrp = num(d.mrp), best = num(d.best), rating = num(d.rating);
  const bought = num(d.bought), reviews = num(d.reviews), badge = text(d.badge, 40);
  const buyUrl = hostOk(d.buyUrl, BUY_HOSTS);
  const image = d.image ? hostOk(d.image, IMAGE_HOSTS) : null;
  if (!ID_RE.test(String(d.id || ''))) errors.push('ID can only use letters, numbers, - and _');
  if (!text(d.name, 120)) errors.push('Short name is required');
  if (!buyUrl) errors.push('Buy link must be an https amazon.in or amzn.to link');
  if (d.image && !image) errors.push('Image must be an https Amazon image (m.media-amazon.com)');
  if (!(price > 0)) errors.push('Price must be more than 0');
  if (mrp !== null && !(mrp >= 0)) errors.push('MRP must be a number');
  if (best !== null && !(best >= 0)) errors.push('Best price must be a number');
  if (best > 0 && price > 0 && best >= price) errors.push('Best buy price must be lower than the deal price');
  if (rating !== null && !(rating >= 0 && rating <= 5)) errors.push('Rating must be between 0 and 5');
  if (bought !== null && !(Number.isInteger(bought) && bought >= 0)) errors.push('Bought last month must be a whole number');
  if (reviews !== null && !(Number.isInteger(reviews) && reviews >= 0)) errors.push('Reviews must be a whole number');
  if (badge && !BADGES.includes(badge)) errors.push(`Badge must be one of: ${BADGES.join(', ')}`);
  if (d.date && !Date.parse(d.date)) errors.push('Date is not valid');
  if (![undefined, null, true, false].includes(d.telegram)) errors.push('Telegram must be auto, on or off');
  const notes = (Array.isArray(d.notes) ? d.notes : []).map((n) => text(n, 200)).filter(Boolean);
  if (notes.length > MAX_NOTES) errors.push(`Use at most ${MAX_NOTES} notes`);
  const pct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const deal = {
    id: String(d.id || ''),
    name: text(d.name, 120),
    fullName: text(d.fullName, 300) || text(d.name, 120),
    image,
    price,
    mrp: mrp > 0 ? mrp : null,
    pct,
    best: best > 0 ? best : null,
    ...(best > 0 && text(d.bestVia, 40) ? { bestVia: text(d.bestVia, 40) } : {}),
    ...(best > 0 && cleanOffers(d.offers).length ? { offers: cleanOffers(d.offers) } : {}),
    ...(cleanNonPrime(d.nonPrime, best, price) ? { nonPrime: cleanNonPrime(d.nonPrime, best, price) } : {}),
    atLow: Boolean(d.atLow),
    ...(d.atLow ? { lowLabel: text(d.lowLabel, 40) || 'tracked low' } : {}),
    ...(feed === 'trending' ? { trending: true } : {}),
    notes: notes.slice(0, MAX_NOTES),
    rating: rating > 0 ? Math.round(rating * 10) / 10 : null,
    ...(bought > 0 ? { bought } : {}),
    ...(reviews > 0 ? { reviews } : {}),
    ...(badge ? { badge } : {}),
    buyUrl,
    store: 'amazon',
    category: text(d.category, 60) || 'More gadgets',
    confirmed: d.confirmed !== false,
    date: isoDate(Date.parse(d.date) || Date.now()),
    ...(d.post ? { post: String(d.post) } : {}),
    ...(typeof d.telegram === 'boolean' ? { telegram: d.telegram } : {}),
    ...(text(d.telegramText, 700) ? { telegramText: String(d.telegramText).trim().slice(0, 700) } : {}),
  };
  return { deal, errors };
};

export const checkFeed = (body, name) => {
  if (!body || body.success !== true || !Array.isArray(body.data?.deals)) throw new Error(`Bad deals file: ${name}`);
  return body;
};

/* The same list the page renders: trending first, then the feed without repeats,
   keeping only deals the page would accept. */
export const liveDeals = (main, trending) => {
  const usable = (d) => d && d.name && hostOk(d.buyUrl, BUY_HOSTS) && Number(d.price) > 0;
  const top = trending.data.deals.filter(usable);
  const seen = new Set(top.map((d) => asinOf(d.buyUrl) || d.buyUrl));
  return [...top, ...main.data.deals.filter(usable).filter((d) => !seen.has(asinOf(d.buyUrl) || d.buyUrl))];
};
