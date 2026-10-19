/* Rechecks every deal on Amazon.in and saves its current price and the lowest price a buyer
   can pay with the coupon and the best card offer (bank instant discount or cashback).
   The site and the Telegram posts show that lowest price first, with how to get it.

   node deals-admin/refresh-offers.mjs [--dry] [ASIN ...]

   With ASINs it checks only those products. A deal keeps its old data when its page
   can't be read. When Amazon answers with a bot check, the run stops and saves what it
   has. Exit code 2 means Amazon blocked it before any deal was checked. */
import { readState, patchDeals } from './store.mjs';
import { asinOf } from './lib/deals.mjs';
import { parseProduct, repriceNotes } from './lib/amazon.mjs';
import { parseCount } from './lib/importer.mjs';
import { BlockedError, get, pause, sleep } from './lib/amazon-http.mjs';
import { sheetPath, offerBoxes, parseCoupon, parseBankOffers, parseCashback, bestPrice, withoutOfferNotes } from './lib/offers.mjs';

const SHEET_PAUSE_MS = 1500;
const SHEET_JITTER_MS = 1000;
const EXIT_BLOCKED = 2;
/* One 503 is often just Amazon slowing a burst down, so the run cools off once before it stops */
const COOL_OFF_MS = 90000;

const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

const sheet = async (asin, type) => {
  await pause(SHEET_PAUSE_MS, SHEET_JITTER_MS);
  return get(sheetPath(asin, type));
};

/* The fields to change on one deal, or a reason to leave it alone */
const checkDeal = async (deal, asin) => {
  const html = await get(`/dp/${asin}`);
  const product = parseProduct(html);
  const price = parseCount(product.price);
  if (!(price > 0)) return { skip: 'no price on the page (out of stock?)' };
  const boxes = offerBoxes(html);
  if (!boxes.size) return { skip: 'no offers section on the page' };
  const bank = boxes.has('InstantBankDiscount') ? parseBankOffers(await sheet(asin, 'InstantBankDiscount')) : [];
  const cashback = boxes.has('GCCashback') ? parseCashback(await sheet(asin, 'GCCashback')) : null;
  const result = bestPrice({ price, coupon: parseCoupon(html), bank, cashback });
  const mrp = parseCount(product.mrp) || deal.mrp;
  return {
    patch: {
      price,
      mrp,
      notes: withoutOfferNotes(repriceNotes(deal.notes || [], price, mrp)),
      best: result ? result.best : null,
      bestVia: result ? result.bestVia : '',
      offers: result ? result.offers : [],
      nonPrime: result?.nonPrime || null,
    },
  };
};

const describe = (asin, { price, best, bestVia, nonPrime }) => `ok    ${asin}  ${rupees(price)}`
  + `${best ? `, lowest ${rupees(best)} with ${bestVia}` : ', no extra offers'}${nonPrime ? `, ${rupees(nonPrime.best)} without Prime` : ''}`;

/* Checks a deal, and once per run waits and tries again when Amazon pushes back */
const checkWithCoolOff = async (deal, asin, state) => {
  try {
    return await checkDeal(deal, asin);
  } catch (err) {
    if (!(err instanceof BlockedError) || state.cooledOff) throw err;
    state.cooledOff = true;
    console.log(`wait  ${asin}  (Amazon slowed us down, trying again in ${COOL_OFF_MS / 1000}s)`);
    await sleep(COOL_OFF_MS);
    return checkDeal(deal, asin);
  }
};

const checkAll = async (deals) => {
  const patches = {};
  const state = { cooledOff: false };
  let blocked = null;
  for (const { deal, asin } of deals) {
    await pause();
    try {
      const { patch, skip } = await checkWithCoolOff(deal, asin, state);
      if (skip) { console.log(`skip  ${asin}  (${skip})`); continue; }
      patches[deal.id] = patch;
      console.log(describe(asin, patch));
    } catch (err) {
      if (!(err instanceof BlockedError)) { console.log(`skip  ${asin}  (${err.message})`); continue; }
      blocked = err;
      break;
    }
  }
  return { patches, blocked };
};

const main = async () => {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const only = new Set(args.filter((a) => /^[A-Z0-9]{10}$/.test(a)));
  const deals = Object.values(readState().feeds).flatMap((f) => f.deals)
    .map((deal) => ({ deal, asin: asinOf(deal.buyUrl) }))
    .filter(({ asin }) => asin && (!only.size || only.has(asin)));
  console.log(`Checking ${deals.length} deals on Amazon.in\n`);
  const { patches, blocked } = await checkAll(deals);
  const checked = Object.keys(patches).length;
  if (dry) console.log(`\nDry run: ${checked} deals checked, nothing saved.`);
  else {
    const { changed, failed } = patchDeals(patches);
    failed.forEach((f) => console.log(`kept  ${f.id}  (${f.errors.join('. ')})`));
    console.log(`\n${checked} deals checked, ${changed.length} updated.`);
  }
  if (blocked) {
    console.log(`BLOCKED: ${blocked.message}. Stopped here.`);
    if (!checked) process.exitCode = EXIT_BLOCKED;
  }
};

main().catch((err) => {
  console.error(`Refresh failed: ${err.message}`);
  process.exitCode = 1;
});
