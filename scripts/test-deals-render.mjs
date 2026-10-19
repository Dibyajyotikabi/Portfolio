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
