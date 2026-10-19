/* Works out the lowest price a buyer can pay on Amazon.in: the coupon on the product page,
   then the single best card offer (an instant bank discount or card cashback). Only one card
   pays for an order, so card offers never stack with each other. EMI offers are left out,
   since EMI adds a processing fee and is not what most buyers pick.
   Pure functions only, so the refresher and the tests share them. */
import { stripTags } from './amazon.mjs';

/* The side sheet Amazon opens from the "Bank Offer" and "Cashback" cards */
export const sheetPath = (asin, type) => `/gp/product/ajax/vsxOffersSecondaryView?asin=${asin}&deviceType=web&offerType=${type}`
  + `&buyingOptionIndex=0&experienceId=vsxOffersSecondaryView&showFeatures=vsxoffers&featureParams=OfferType%3A${type}%2CDeviceType%3Aweb`;

const amount = (s) => Math.round(Number(String(s || '').replace(/,/g, '')) || 0);

/* The offer cards a product page shows, like InstantBankDiscount and GCCashback */
export const offerBoxes = (html) => new Set([...String(html).matchAll(/id="itembox-([A-Za-z]+)"/g)].map((m) => m[1]));

/* "Apply ₹1000 coupon" or "Apply 5% coupon" from the product page */
export const parseCoupon = (html) => {
  const label = stripTags((String(html).match(/class="couponLabelText"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
  const flat = label.match(/Apply\s*₹\s*([\d,]+)\s*coupon/i);
  if (flat) return { flat: amount(flat[1]) };
  const pct = label.match(/Apply\s*(\d+(?:\.\d+)?)%\s*coupon/i);
  return pct ? { pct: Number(pct[1]) } : null;
};

export const couponSaving = (coupon, price) => {
  if (!coupon) return 0;
  return Math.min(price, coupon.flat || Math.round((price * (coupon.pct || 0)) / 100));
};

/* "SBI Credit Card Non-EMI Trxn" becomes { card: 'SBI Credit Card', emi: false } */
const cardOf = (where) => {
  const emi = /\bEMI\b/i.test(where) && !/\bNon[\s-]?EMI\b/i.test(where);
  const card = where.replace(/\b(Non[\s-]?)?EMI\b/gi, '').replace(/\b(Trxn|Txn|Transactions?)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
  /* "ALL Banks Card" means any bank's card works */
  return { card: /^all banks?\b/i.test(card) ? 'any bank card' : card, emi };
};

/* One offer per line of the Bank Offer sheet. Each line appears twice in the page, so
   the list is deduplicated by its text. */
export const parseBankOffers = (html) => {
  const lines = [...String(html).matchAll(/<p class="a-spacing-mini a-size-base-plus">([\s\S]*?)<\/p>/g)]
    .map((m) => stripTags(m[1]).replace(/\s*See details\s*$/i, ''));
  return [...new Set(lines)].map((line) => {
    const pct = line.match(/(\d+(?:\.\d+)?)% Instant Discount up to INR ([\d,]+) on (.+?)\.\s*Min/i)
      || line.match(/(\d+(?:\.\d+)?)% Instant Discount up to INR ([\d,]+) on (.+?)\.?$/i);
    const flat = line.match(/(Additional )?flat INR ([\d,]+) Instant Discount on (.+?)\.\s*Min/i)
      || line.match(/(Additional )?flat INR ([\d,]+) Instant Discount on (.+?)\.?$/i);
    const min = amount((line.match(/Min purchase value INR ([\d,.]+)/i) || [])[1]);
    if (pct) return { ...cardOf(pct[3]), pct: Number(pct[1]), cap: amount(pct[2]), min, additional: false };
    if (flat) return { ...cardOf(flat[3]), flat: amount(flat[2]), min, additional: Boolean(flat[1]) };
    return null;
  }).filter(Boolean);
};

/* "Get 5% back with Amazon Pay ICICI Bank credit card for Prime members. 3% back for others."
   othersPct is the rate for buyers without Prime, or null when everyone gets the same rate */
export const parseCashback = (html) => {
  const text = stripTags(html);
  const m = text.match(/Get (\d+(?:\.\d+)?)% back with (.+?)(?: for Prime members)?\.\s*(?:(\d+(?:\.\d+)?)% back for others)?/i);
  if (!m) return null;
  const card = m[2].replace(/\bBank\b/gi, '').replace(/\bcredit card\b/i, 'card').replace(/\s+/g, ' ').trim();
  const othersPct = m[3] ? Number(m[3]) : null;
  return { card, pct: Number(m[1]), prime: othersPct !== null, othersPct };
};

/* The best saving per card: the best base offer plus the best "additional flat" one,
   each only when the order is big enough. */
const bankSavings = (offers, total) => {
  const byCard = new Map();
  for (const o of offers) {
    if (o.emi || total < o.min) continue;
    const save = o.pct ? Math.min(o.cap, Math.round((total * o.pct) / 100)) : o.flat;
    const slot = byCard.get(o.card) || { base: 0, extra: 0 };
    byCard.set(o.card, o.additional ? { ...slot, extra: Math.max(slot.extra, save) } : { ...slot, base: Math.max(slot.base, save) });
  }
  return [...byCard].map(([card, s]) => ({ type: 'bank', card, save: s.base + s.extra }));
};

const shortCard = (card) => card.replace(/\s+(Credit|Debit)\s+Card.*$/i, '').replace(/\s+card$/i, '') + ' card';

/* The single card that saves the most at this cashback rate. The first card wins a tie,
   and instant discounts come first. */
const bestCard = (bank, cashback, pct, card, total) => [
  ...bankSavings(bank, total),
  ...(cashback ? [{ type: 'cashback', card, save: Math.round((total * pct) / 100) }] : []),
].filter((c) => c.save > 0).reduce((top, c) => (c.save > (top?.save || 0) ? c : top), null);

/* What a buyer without Prime pays, when the Prime cashback rate is what makes the lowest price.
   It can be the plain Amazon price when no other offer applies. */
const withoutPrime = ({ total, bank, cashback, best }) => {
  const card = bestCard(bank, cashback, cashback.othersPct, cashback.card, total);
  const nonPrime = total - (card?.save || 0);
  return nonPrime > best ? { best: nonPrime, ...(card || {}) } : null;
};

/* { best, bestVia, offers, nonPrime? } for a deal, or null when no offer brings the price down.
   nonPrime is { best, type?, card?, save? }: the price and card for buyers without Prime. */
export const bestPrice = ({ price, coupon, bank = [], cashback = null }) => {
  const off = couponSaving(coupon, price);
  const total = price - off;
  const primeCard = cashback?.prime ? `${cashback.card} (Prime)` : cashback?.card;
  const card = bestCard(bank, cashback, cashback?.pct, primeCard, total);
  const offers = [
    ...(off > 0 ? [{ type: 'coupon', save: off }] : []),
    ...(card ? [card] : []),
  ];
  if (!offers.length) return null;
  const best = price - offers.reduce((sum, o) => sum + o.save, 0);
  const isPrimeOnly = card?.type === 'cashback' && cashback.prime;
  const via = [off > 0 ? 'coupon' : '', card ? shortCard(card.card.replace(/\s*\(Prime\)$/, '')) : ''].filter(Boolean).join(' + ');
  const nonPrime = isPrimeOnly ? withoutPrime({ total, bank, cashback, best }) : null;
  return { best, bestVia: (isPrimeOnly ? `Prime + ${via}` : via).slice(0, 40), offers, ...(nonPrime ? { nonPrime } : {}) };
};

/* Old notes about cashback, coupons or card offers go stale once the offers are worked out */
const OFFER_NOTE = /\b(cashback|coupon|instant discount|bank offer|credit card|debit card)\b/i;
export const withoutOfferNotes = (notes) => notes.filter((n) => !OFFER_NOTE.test(n));
