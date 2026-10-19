import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, newestFirst, views } from '../Clean Portfolio/deals/render.js';

const deal = (rank, date) => ({ rank, date, name: `Deal ${rank}`, price: 999, buyUrl: `https://www.amazon.in/dp/B0AAAAAA${String(rank).padStart(2, '0')}` });
const feed = (deals) => parseFeed({ success: true, data: { deals } }, 'test').list;

/* plain objects stand in for DOM nodes */
const h = (tag, attrs, kids) => ({ tag, attrs: attrs || {}, kids: kids || [] });

test('newestFirst orders by date and keeps rank order for the same date', () => {
  const deals = feed([deal(1, '2026-10-01T00:00:00Z'), deal(2, '2026-10-19T00:00:00Z'), deal(3, '2026-10-19T00:00:00Z'), deal(4, undefined)]);
  assert.deepEqual(newestFirst(deals), [1, 2, 0, 3]);
});

test('page lays cards out newest first and keeps each card\'s rank and time', () => {
  const deals = feed([deal(1, '2026-10-01T00:00:00Z'), deal(2, '2026-10-19T00:00:00Z')]);
  const cards = views(h, h).page(deals).cards.map((li) => li.attrs);
  assert.deepEqual(cards.map((a) => a['data-r']), ['2', '1']);
  assert.deepEqual(cards.map((a) => a['data-t']), [String(Date.parse('2026-10-19T00:00:00Z')), String(Date.parse('2026-10-01T00:00:00Z'))]);
});

/* all the text inside a node, in order */
const textOf = (n) => (typeof n === 'string' ? n : n ? n.kids.map(textOf).join('') : '');
const find = (n, cls) => (typeof n !== 'object' || !n ? null
  : String(n.attrs.class || '').split(' ').includes(cls) ? n : n.kids.reduce((hit, k) => hit || find(k, cls), null));

test('a card with a card or coupon offer shows the effective price big and names the offer', () => {
  const deals = feed([{ ...deal(1), price: 17399, mrp: 29999, best: 15149, bestVia: 'coupon + SBI card' }]);
  const [card] = views(h, h).page(deals).cards;
  assert.equal(textOf(find(card, 'price')), 'Effective price ₹15,149');
  assert.equal(textOf(find(card, 'best')), 'With coupon + SBI card');
  assert.equal(textOf(find(card, 'prev')), '₹17,399 on Amazon before offers');
  assert.match(textOf(find(card, 'notes')), /Amazon lists it at ₹17,399\. With coupon \+ SBI card it comes to ₹15,149\./);
  assert.equal(card.attrs['data-l'], '15149');
});

test('the offer note spells out each step to the lowest price', () => {
  const offers = [{ type: 'coupon', save: 1000 }, { type: 'bank', card: 'SBI Credit Card', save: 1250 }];
  const [card] = views(h, h).page(feed([{ ...deal(1), price: 17399, mrp: 29999, best: 15149, bestVia: 'coupon + SBI card', offers }])).cards;
  assert.match(textOf(find(card, 'notes')), /Amazon lists it at ₹17,399\. Clip the ₹1,000 coupon, pay with your SBI Credit Card for ₹1,250 off and it comes to ₹15,149\./);
});

test('a Prime only price also gives the price without Prime', () => {
  const offers = [{ type: 'cashback', card: 'Amazon Pay ICICI card (Prime)', save: 3000 }];
  const nonPrime = { best: 57750, type: 'bank', card: 'SBI Credit Card', save: 2250 };
  const [card] = views(h, h).page(feed([{ ...deal(1), price: 60000, best: 57000, bestVia: 'Amazon Pay ICICI card (Prime)', offers, nonPrime }])).cards;
  assert.match(textOf(find(card, 'notes')), /Pay with your Amazon Pay ICICI card to get ₹3,000 back as a Prime member and it comes to ₹57,000\. Without Prime, pay with your SBI Credit Card for ₹2,250 off instead\. That comes to ₹57,750\./);
});

test('the price without Prime keeps the coupon and names the same card plainly', () => {
  const prime = { type: 'cashback', card: 'Amazon Pay ICICI card (Prime)', save: 1443 };
  const notesOf = (offers, nonPrime, best) => textOf(find(views(h, h).page(feed([{ ...deal(1), price: 29750, best, bestVia: 'Prime + coupon + Amazon Pay ICICI card', offers, nonPrime }])).cards[0], 'notes'));
  const coupon = { type: 'coupon', save: 900 };
  assert.match(notesOf([coupon, prime], { best: 27600, type: 'bank', card: 'SBI Credit Card', save: 1250 }, 27407), /Without Prime, keep the coupon and pay with your SBI Credit Card for ₹1,250 off instead\. That comes to ₹27,600\./);
  assert.match(notesOf([prime], { best: 28858, type: 'cashback', card: 'Amazon Pay ICICI card', save: 892 }, 28307), /Without Prime the same card gives ₹892 back, so you pay ₹28,858\./);
  assert.match(notesOf([coupon, prime], { best: 28850 }, 27407), /Without Prime you pay ₹28,850 with the coupon alone\./);
});

test('a best price that does not beat the Amazon price is ignored', () => {
  const [card] = views(h, h).page(feed([{ ...deal(1), price: 999, best: 999 }])).cards;
  assert.equal(textOf(find(card, 'price')), 'Sale price ₹999');
  assert.equal(find(card, 'best'), null);
});
