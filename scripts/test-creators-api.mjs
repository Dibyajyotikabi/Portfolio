import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, credentialsFromEnv, isFatal, isNotEligible, ApiError } from '../deals-admin/lib/creators-api.mjs';
import {
  RESOURCES, SEARCHES, searchesFor, searchParams, bigImage, readItem, refreshNotes, refreshPlan, toApiCandidate, OFFERS_TTL_MS,
} from '../deals-admin/lib/catalog.mjs';
import { popularity, validateDeal } from '../deals-admin/lib/deals.mjs';
import { planImport } from '../deals-admin/lib/importer.mjs';

const NOW = Date.parse('2026-10-19T10:00:00Z');
const IMG = 'https://m.media-amazon.com/images/I/61+l5bzv9hL.jpg';

const apiItem = (over = {}) => ({
  asin: 'B0AAAAAAA1',
  itemInfo: {
    title: { displayValue: 'iQOO Z11 Lite 44W 5G (Solar Flame, 4GB RAM, 128GB Storage)' },
    features: { displayValues: ['BIG BATTERY: A 6000mAh battery lasts a full day of calls and videos. It charges fast too.'] },
  },
  images: { primary: { large: { url: IMG } } },
  browseNodeInfo: { browseNodes: [{ id: '1', displayName: 'Electronics', salesRank: 900 }, { id: '2', displayName: 'Smartphones', salesRank: 12 }] },
  offersV2: {
    listings: [{
      isBuyBoxWinner: true,
      price: { money: { amount: 17499 }, savingBasis: { savingBasisType: 'LIST_PRICE', money: { amount: 30999 } } },
      availability: { type: 'IN_STOCK' },
      condition: { value: 'New' },
      ...over.listing,
    }],
  },
  ...over.item,
});

const savedDeal = (over = {}) => ({
  id: 'a-B0AAAAAAA1', name: 'iQOO Z11 Lite 44W 5G', price: 17499, mrp: 30999, best: 15999, bestVia: 'HDFC card',
  offers: [{ type: 'bank', save: 1500, card: 'HDFC Bank credit card' }], offersAt: new Date(NOW - 3600e3).toISOString(),
  notes: ["You save ₹13,500 right now. That's 44% off the ₹30,999 list price.", 'A 6000mAh battery lasts a full day.'],
  buyUrl: 'https://www.amazon.in/dp/B0AAAAAAA1?tag=x-21', image: IMG, category: 'Phones & Tablets', ...over,
});

test('credentialsFromEnv needs both keys and a known version', () => {
  assert.equal(credentialsFromEnv({}), null);
  assert.equal(credentialsFromEnv({ AMAZON_CREATORS_ID: 'id' }), null);
  assert.deepEqual(credentialsFromEnv({ AMAZON_CREATORS_ID: ' id ', AMAZON_CREATORS_SECRET: 's' }), { id: 'id', secret: 's', version: '3.2' });
  assert.throws(() => credentialsFromEnv({ AMAZON_CREATORS_ID: 'id', AMAZON_CREATORS_SECRET: 's', AMAZON_CREATORS_VERSION: '9.9' }), /not known/);
});

test('bigImage asks for a 1500px Amazon image and refuses other hosts', () => {
  assert.equal(bigImage(IMG), 'https://m.media-amazon.com/images/I/61+l5bzv9hL._SL1500_.jpg');
  assert.equal(bigImage('https://m.media-amazon.com/images/I/61abc._AC_SX300_.jpg'), 'https://m.media-amazon.com/images/I/61abc._SL1500_.jpg');
  assert.equal(bigImage('https://evil.example/images/a.jpg'), null);
  assert.equal(bigImage(undefined), null);
});

test('readItem reads the buy box price, list price, stock and best sales rank', () => {
  const live = readItem(apiItem());
  assert.equal(live.price, 17499);
  assert.equal(live.mrp, 30999);
  assert.equal(live.inStock, true);
  assert.equal(live.primeDeal, false);
  assert.equal(live.salesRank, 12);
  assert.equal(live.rankIn, 'Smartphones');
  assert.match(live.image, /_SL1500_\.jpg$/);
});

test('readItem ignores a was-price as MRP and spots Prime-only and out-of-stock listings', () => {
  const was = readItem(apiItem({ listing: { price: { money: { amount: 999 }, savingBasis: { savingBasisType: 'WAS_PRICE', money: { amount: 1999 } } } } }));
  assert.equal(was.mrp, null);
  assert.equal(readItem(apiItem({ listing: { dealDetails: { accessType: 'PRIME_EXCLUSIVE' } } })).primeDeal, true);
  assert.equal(readItem(apiItem({ listing: { availability: { type: 'OUT_OF_STOCK' } } })).inStock, false);
  assert.equal(readItem({ asin: 'B0AAAAAAA1' }).inStock, false);
});

test('refreshNotes updates the saving, adds the rank and puts the Prime line first', () => {
  const notes = refreshNotes(["You save ₹13,500 right now. That's 44% off the ₹30,999 list price.", 'A feature.'],
    { price: 15999, mrp: 30999, primeDeal: true, salesRank: 5, rankIn: 'Smartphones' });
  assert.equal(notes[0], 'This is a Prime-only deal, so you need Prime to get this price.');
  assert.equal(notes[1], "You save ₹15,000 right now. That's 48% off the ₹30,999 list price.");
  assert.equal(notes.at(-1), "It's #5 in Smartphones on Amazon.in right now.");
  const dropped = refreshNotes(notes, { price: 15999, mrp: 30999, primeDeal: false, salesRank: 500, rankIn: 'Smartphones' });
  assert.ok(!dropped.some((n) => /Prime-only|#\d+ in/.test(n)));
});

test('refreshPlan keeps a fresh lowest price while the Amazon price holds', () => {
  const { patch } = refreshPlan({ deal: savedDeal(), feed: 'main', item: apiItem(), now: NOW });
  assert.equal(patch.price, 17499);
  assert.equal(patch.best, undefined);
  assert.equal(patch.salesRank, 12);
  const { deal, errors } = validateDeal({ ...savedDeal(), ...patch }, 'main');
  assert.deepEqual(errors, []);
  assert.equal(deal.best, 15999);
  assert.ok(deal.offersAt);
});

test('refreshPlan drops the lowest price after a price change or two days', () => {
  const moved = refreshPlan({ deal: savedDeal({ price: 18999 }), feed: 'main', item: apiItem(), now: NOW }).patch;
  assert.equal(moved.best, null);
  assert.deepEqual(moved.offers, []);
  const old = refreshPlan({ deal: savedDeal({ offersAt: new Date(NOW - OFFERS_TTL_MS - 1).toISOString() }), feed: 'main', item: apiItem(), now: NOW }).patch;
  assert.equal(old.best, null);
  const never = refreshPlan({ deal: savedDeal({ offersAt: undefined }), feed: 'main', item: apiItem(), now: NOW }).patch;
  assert.equal(never.best, null);
  const { deal } = validateDeal({ ...savedDeal(), ...moved }, 'main');
  assert.equal(deal.best, null);
  assert.equal(deal.offers, undefined);
  assert.equal(deal.offersAt, undefined);
});

test('refreshPlan ends deals that are out of stock or no longer 10% off, and keeps unknown ones', () => {
  assert.match(refreshPlan({ deal: savedDeal(), feed: 'main', item: apiItem({ listing: { availability: { type: 'OUT_OF_STOCK' } } }) }).remove, /out of stock/);
  const small = apiItem({ listing: { price: { money: { amount: 29999 }, savingBasis: { savingBasisType: 'LIST_PRICE', money: { amount: 30999 } } } } });
  assert.match(refreshPlan({ deal: savedDeal(), feed: 'main', item: small }).remove, /under 10%/);
  assert.ok(refreshPlan({ deal: savedDeal(), feed: 'trending', item: small }).patch, 'trending picks stay without a big discount');
  assert.ok(refreshPlan({ deal: savedDeal(), feed: 'main', item: undefined }).keep);
});

test('refreshPlan keeps the saved MRP when Amazon sends no list price', () => {
  const noBasis = apiItem({ listing: { price: { money: { amount: 17499 } } } });
  assert.equal(refreshPlan({ deal: savedDeal(), feed: 'main', item: noBasis, now: NOW }).patch.mrp, 30999);
});

test('toApiCandidate passes the importer with a top sales rank, and popularity counts the rank', () => {
  const c = toApiCandidate(apiItem(), 'Phones & Tablets');
  assert.equal(c.checked, true);
  assert.equal(c.name, 'iQOO Z11 Lite 44W 5G');
  assert.ok(c.notes.length >= 2);
  const { accepted } = planImport({ candidates: [c], listed: new Set(), tag: 'x-21', now: NOW });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].salesRank, 12);
  assert.ok(popularity(accepted[0]).signals.includes('#12 in Smartphones'));
  const unranked = toApiCandidate(apiItem({ item: { browseNodeInfo: { browseNodes: [{ displayName: 'Electronics', salesRank: 4000 }] } } }), 'Audio');
  assert.equal(planImport({ candidates: [unranked], listed: new Set(), tag: 'x-21', now: NOW }).accepted.length, 0);
  assert.equal(toApiCandidate(apiItem({ item: { images: {} } }), 'Audio').checked, false);
});

test('searchesFor rotates through every search and searchParams asks for real deals', () => {
  const seen = new Set([0, 1].flatMap((day) => searchesFor(day, 6).map((s) => s.keywords)));
  assert.equal(seen.size, SEARCHES.length);
  const params = searchParams(SEARCHES[0]);
  assert.equal(params.minSavingPercent, 15);
  assert.deepEqual(params.deliveryFlags, ['Prime']);
});

/* A fake fetch that answers from a list of [status, body] replies and records each call */
const fakeFetch = (replies) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: init.body.startsWith('{') ? JSON.parse(init.body) : init.body });
    const [status, body] = replies.shift() || [500, { message: 'no reply left' }];
    return { ok: status < 400, status, text: async () => JSON.stringify(body) };
  };
  return { fetchImpl, calls };
};
const TOKEN = [200, { access_token: 'tok', expires_in: 3600 }];
const CREDS = { id: 'id', secret: 'sec', version: '3.2' };
const clientWith = (replies) => {
  const { fetchImpl, calls } = fakeFetch(replies);
  const waits = [];
  let clock = NOW;
  const client = createClient({ credentials: CREDS, partnerTag: 'x-21', fetchImpl, sleep: async (ms) => { waits.push(ms); clock += ms; }, now: () => clock });
  return { client, calls, waits };
};

test('the client gets a token once and sends the marketplace, tag and resources', async () => {
  const { client, calls } = clientWith([TOKEN, [200, { itemResults: { items: [apiItem()] } }], [200, { searchResult: { items: [] } }]]);
  const { items } = await client.getItems(['B0AAAAAAA1'], RESOURCES);
  await client.searchItems(searchParams(SEARCHES[0]), RESOURCES);
  assert.equal(items.length, 1);
  assert.equal(calls[0].url, 'https://api.amazon.co.uk/auth/o2/token');
  assert.equal(calls[0].body.scope, 'creatorsapi::default');
  assert.equal(calls.filter((c) => /token/.test(c.url)).length, 1);
  const api = calls[1];
  assert.equal(api.url, 'https://creatorsapi.amazon/catalog/v1/getItems');
  assert.equal(api.init.headers.Authorization, 'Bearer tok');
  assert.equal(api.init.headers['x-marketplace'], 'www.amazon.in');
  assert.deepEqual(api.body.itemIds, ['B0AAAAAAA1']);
  assert.equal(api.body.partnerTag, 'x-21');
  assert.equal(api.body.marketplace, 'www.amazon.in');
  assert.deepEqual(api.body.resources, RESOURCES);
});

test('getAllItems asks 10 at a time, spaces the calls and retries a 429', async () => {
  const asins = Array.from({ length: 12 }, (_, i) => `B0AAAAAA${String(i).padStart(2, '0')}`);
  const { client, calls, waits } = clientWith([
    TOKEN,
    [200, { itemResults: { items: asins.slice(0, 10).map((asin) => ({ asin })) } }],
    [429, { errors: [{ code: 'TooManyRequests', message: 'slow down' }] }],
    [200, { itemResults: { items: [{ asin: asins[10] }] }, errors: [{ code: 'ItemNotAccessible', message: `${asins[11]} is not accessible` }] }],
  ]);
  const { items, failed } = await client.getAllItems(asins, RESOURCES);
  assert.equal(items.size, 11);
  assert.deepEqual(failed[0].asins, [asins[11]]);
  assert.equal(calls.filter((c) => /getItems/.test(c.url))[0].body.itemIds.length, 10);
  assert.ok(waits.includes(2000), 'backs off after a 429');
  assert.ok(waits.some((ms) => ms > 1000 && ms <= 1100), 'keeps a gap between calls');
});

test('a 403 stops the run, and errors never repeat the secret', async () => {
  const { client } = clientWith([TOKEN, [403, { errors: [{ code: 'AccessDenied', message: 'no access' }] }]]);
  const err = await client.getAllItems(['B0AAAAAAA1'], RESOURCES).catch((e) => e);
  assert.ok(err instanceof ApiError);
  assert.equal(isFatal(err), true);
  assert.match(err.message, /qualified sales/);
  assert.ok(!err.message.includes('sec'));
  assert.equal(isFatal(new ApiError('bad', { status: 400 })), false);
});

test('only a 403 counts as not eligible yet, bad keys still fail', () => {
  assert.equal(isNotEligible(new ApiError('no access', { status: 403 })), true);
  assert.equal(isNotEligible(new ApiError('bad keys', { status: 401 })), false);
  assert.equal(isNotEligible(new Error('network')), false);
});

test('a 401 gets one new token before it gives up', async () => {
  const { client, calls } = clientWith([TOKEN, [401, { message: 'expired' }], TOKEN, [200, { itemResults: { items: [] } }]]);
  await client.getItems(['B0AAAAAAA1'], RESOURCES);
  assert.equal(calls.filter((c) => /token/.test(c.url)).length, 2);
});
