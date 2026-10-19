/* Turns a batch of sourced Amazon deals into feed deals. Pure functions only, so the
   daily import can be tested without touching the deal files. A candidate only gets in
   when it passes the same checks as the admin editor and the popularity rules. */
import { validateDeal, popularity, affiliateUrl, asinOf } from './deals.mjs';

/* The daily goal, and the hard cap on one batch */
export const DAILY = Object.freeze({ min: 10, max: 15 });
export const FALLBACK_TAG = 'wwwbestdeal0d-21';
const MIN_NOTES = 2;
const STEP_MS = 60 * 1000;
const ASIN_RE = /^[A-Z0-9]{10}$/;
/* Notes go on the site and Telegram as written, so they must read like a person wrote them */
const BANNED_CHARS = /[–—…→←]/;

/* "₹1,399.00", "2,518", "10K+ bought in past month" and 4.2 all become plain numbers */
export const parseCount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = String(value ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KkMm]?)/);
  if (!m) return null;
  const scale = { k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1;
  return Math.round(Number(m[1]) * scale * 100) / 100;
};

/* The affiliate tag most deals already use, so new links match the rest of the site */
export const commonTag = (deals) => {
  const counts = new Map();
  for (const d of deals) {
    const tag = (String(d.buyUrl).match(/[?&]tag=([^&]+)/) || [])[1];
    if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || FALLBACK_TAG;
};

export const existingAsins = (deals) => new Set(deals.map((d) => asinOf(d.buyUrl)).filter(Boolean));

const candidateAsin = (c) => String(c?.asin || asinOf(c?.buyUrl) || '').toUpperCase();

export const toDeal = (c, { tag, date }) => {
  const asin = candidateAsin(c);
  const bought = parseCount(c.bought), reviews = parseCount(c.reviews);
  return {
    id: `a-${asin}`,
    name: c.name,
    fullName: c.fullName || c.name,
    image: c.image,
    price: parseCount(c.price),
    mrp: parseCount(c.mrp),
    rating: parseCount(c.rating),
    ...(parseCount(c.best) ? { best: parseCount(c.best) } : {}),
    ...(c.bestVia ? { bestVia: String(c.bestVia) } : {}),
    ...(bought ? { bought: Math.round(bought) } : {}),
    ...(reviews ? { reviews: Math.round(reviews) } : {}),
    ...(c.badge ? { badge: c.badge } : {}),
    ...(parseCount(c.salesRank) ? { salesRank: Math.round(parseCount(c.salesRank)), rankIn: c.rankIn } : {}),
    category: c.category,
    notes: Array.isArray(c.notes) ? c.notes : [],
    buyUrl: affiliateUrl(`https://www.amazon.in/dp/${asin}`, tag),
    store: 'amazon',
    confirmed: true,
    date,
  };
};

/* Why a candidate can't go in, or null when it can */
const rejection = (c, seen) => {
  const asin = candidateAsin(c);
  if (!ASIN_RE.test(asin)) return 'no valid ASIN';
  if (seen.has(asin)) return 'already listed';
  if (c.checked !== true) return 'not confirmed on Amazon';
  if (!c.image) return 'no product image';
  if (!c.category) return 'no category';
  const notes = Array.isArray(c.notes) ? c.notes : [];
  if (notes.length < MIN_NOTES) return `needs at least ${MIN_NOTES} notes`;
  if (notes.some((n) => BANNED_CHARS.test(n))) return 'notes use dashes, arrows or ellipsis characters';
  return null;
};

/* Picks the deals to add, newest date first, and says why every other one was skipped */
export const planImport = ({ candidates, listed, tag, now = Date.now(), limit = DAILY.max }) => {
  const seen = new Set(listed);
  const accepted = [], skipped = [];
  for (const c of candidates) {
    const asin = candidateAsin(c) || '?';
    const skip = (reason) => skipped.push({ asin, name: c?.name || '', reason });
    const why = rejection(c, seen);
    if (why) { skip(why); continue; }
    const { deal, errors } = validateDeal(toDeal(c, { tag, date: new Date(now - accepted.length * STEP_MS).toISOString() }), 'main');
    if (errors.length) { skip(errors.join('; ')); continue; }
    const pop = popularity(deal);
    if (!pop.ok) { skip(`not popular: ${pop.misses.join('; ')}`); continue; }
    if (accepted.length >= limit) { skip(`over the limit of ${limit}`); continue; }
    seen.add(asin);
    accepted.push(deal);
  }
  return { accepted, skipped };
};
