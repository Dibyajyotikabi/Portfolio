import test from 'node:test';
import assert from 'node:assert/strict';
import { offerBoxes, parseCoupon, parseBankOffers, parseCashback, bestPrice, withoutOfferNotes, sheetPath } from '../deals-admin/lib/offers.mjs';
import { repriceNotes } from '../deals-admin/lib/amazon.mjs';

/* Cut down from the real Galaxy Buds4 Pro page and its offer sheets on Amazon.in */
const PRODUCT_HTML = `
<div id="itembox-NoCostEmi"></div><div id="itembox-InstantBankDiscount"></div><div id="itembox-GCCashback"></div>
<span id="couponTextpctch1" class="couponLabelText"> Apply ₹1000 coupon <span class="a-declarative">Terms</span></span>`;
const line = (text) => `<p class="a-spacing-mini a-size-base-plus">${text} <a href="#">See details</a></p>`;
const BANK_HTML = [
  '10% Instant Discount up to INR 1250 on SBI Credit Card Non-EMI Trxn. Min purchase value <money>INR 2490.00</money>',
  '10% Instant Discount up to INR 1250 on SBI Credit Card Non-EMI Trxn. Min purchase value <money>INR 2490.00</money>',
  'Additional flat INR 500 Instant Discount on SBI Credit Card Non-EMI Trxn. Min purchase value <money>INR 24990.00</money>',
  'Additional flat INR 1000 Instant Discount on SBI Credit Card Non-EMI Trxn. Min purchase value <money>INR 49990.00</money>',
  '10% Instant Discount up to INR 1500 on SBI Credit Card EMI Trxn. Min purchase value <money>INR 2490.00</money>',
  '10% Instant Discount up to INR 1250 on SBI Debit Card Non-EMI Trxn. Min purchase value <money>INR 2490.00</money>',
].map(line).join('\n');
const CASHBACK_HTML = '<h1 class="a-size-medium-plus"> Get 5% back with Amazon Pay ICICI Bank credit card for Prime members. 3% back for others. Not applicable on EMI orders. </h1>';

test('reads the coupon and the offer cards from a product page', () => {
  assert.deepEqual(parseCoupon(PRODUCT_HTML), { flat: 1000 });
  assert.deepEqual(parseCoupon('<span class="couponLabelText"> Apply 5% coupon </span>'), { pct: 5 });
  assert.equal(parseCoupon('<p>no coupon here</p>'), null);
  assert.deepEqual([...offerBoxes(PRODUCT_HTML)], ['NoCostEmi', 'InstantBankDiscount', 'GCCashback']);
});

test('reads each bank offer once with its card, EMI type, cap and minimum', () => {
  const offers = parseBankOffers(BANK_HTML);
  assert.equal(offers.length, 5);
  assert.deepEqual(offers[0], { card: 'SBI Credit Card', emi: false, pct: 10, cap: 1250, min: 2490, additional: false });
  assert.deepEqual(offers[1], { card: 'SBI Credit Card', emi: false, flat: 500, min: 24990, additional: true });
  assert.equal(offers[3].emi, true);
  assert.equal(parseBankOffers('<p class="a-spacing-mini a-size-base-plus">Flat INR 25 Instant Discount on ALL Banks Card Txn. Min purchase value INR 100</p>')[0].card, 'any bank card');
});

test('reads the Prime cashback rate', () => {
  assert.deepEqual(parseCashback(CASHBACK_HTML), { card: 'Amazon Pay ICICI card', pct: 5, prime: true, othersPct: 3 });
  assert.equal(parseCashback('<h1>No cashback</h1>'), null);
});

test('Buds4 Pro: the coupon plus the capped SBI discount gives 15,149', () => {
  const result = bestPrice({ price: 17399, coupon: { flat: 1000 }, bank: parseBankOffers(BANK_HTML), cashback: parseCashback(CASHBACK_HTML) });
  assert.deepEqual(result, {
    best: 15149,
    bestVia: 'coupon + SBI card',
    offers: [{ type: 'coupon', save: 1000 }, { type: 'bank', card: 'SBI Credit Card', save: 1250 }],
  });
});

test('adds the extra flat discount once the order is big enough, and picks cashback when it saves more', () => {
  const bank = parseBankOffers(BANK_HTML);
  /* 30,000: 1,250 + 500 beats 5% cashback (1,500) */
  assert.equal(bestPrice({ price: 30000, bank, cashback: parseCashback(CASHBACK_HTML) }).best, 28250);
  /* 60,000: 1,250 + 1,000 loses to 5% cashback (3,000) */
  const big = bestPrice({ price: 60000, bank, cashback: parseCashback(CASHBACK_HTML) });
  assert.equal(big.best, 57000);
  assert.deepEqual(big.offers, [{ type: 'cashback', card: 'Amazon Pay ICICI card (Prime)', save: 3000 }]);
  assert.equal(big.bestVia, 'Prime + Amazon Pay ICICI card');
  /* without Prime, 3% cashback (1,800) loses to SBI's 1,250 + 1,000 */
  assert.deepEqual(big.nonPrime, { best: 57750, type: 'bank', card: 'SBI Credit Card', save: 2250 });
});

test('without Prime the lower cashback rate is used, and the plain price when nothing else applies', () => {
  const cashback = parseCashback(CASHBACK_HTML);
  assert.deepEqual(bestPrice({ price: 10000, coupon: { flat: 500 }, cashback }).nonPrime,
    { best: 9215, type: 'cashback', card: 'Amazon Pay ICICI card', save: 285 });
  const primeOnly = { ...cashback, othersPct: 0 };
  assert.deepEqual(bestPrice({ price: 10000, cashback: primeOnly }).nonPrime, { best: 10000 });
  /* a bank discount that wins for everyone needs no Prime line */
  assert.equal(bestPrice({ price: 17399, bank: parseBankOffers(BANK_HTML), cashback }).nonPrime, undefined);
  assert.equal(bestPrice({ price: 10000, cashback: { card: 'X card', pct: 2, prime: false, othersPct: null } }).nonPrime, undefined);
});

test('no offers means no best price, and EMI-only offers are left out', () => {
  assert.equal(bestPrice({ price: 999 }), null);
  const emiOnly = parseBankOffers(BANK_HTML).filter((o) => o.emi);
  assert.equal(bestPrice({ price: 20000, bank: emiOnly }), null);
});

test('price notes follow the new price and old offer notes are dropped', () => {
  const notes = ['You save ₹12,600 right now. That\'s 42% off the ₹29,999 list price.', '86% below the list price of ₹6,999', '42% off Samsung earbuds', 'Has ANC'];
  assert.deepEqual(repriceNotes(notes, 15000, 30000), [
    'You save ₹15,000 right now. That\'s 50% off the ₹30,000 list price.', '50% below the list price of ₹30,000', '50% off Samsung earbuds', 'Has ANC',
  ]);
  assert.deepEqual(repriceNotes(notes, 30000, 30000), ['Has ANC']);
  assert.deepEqual(withoutOfferNotes(['₹54 cashback with Amazon Pay ICICI credit card', 'Has ANC']), ['Has ANC']);
});

test('offer sheet links ask for the right offer type', () => {
  assert.match(sheetPath('B0GMJLFCR7', 'GCCashback'), /asin=B0GMJLFCR7&.*offerType=GCCashback.*OfferType%3AGCCashback/);
});
