import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { postText, postPayload, eligibility, planSync, fingerprint, messageLink, endedText, DEFAULT_SETTINGS } from '../deals-admin/telegram/format.mjs';
import { validateDeal, liveDeals, affiliateUrl, asinOf, checkFeed, popularity } from '../deals-admin/lib/deals.mjs';

const ON = { ...DEFAULT_SETTINGS, enabled: true, postSince: '2026-10-01T00:00:00+00:00' };
const deal = (over = {}) => ({
  id: 'a-B0C8MTWMK2', name: 'Samsung 24-inch Monitor', fullName: 'Samsung 24-inch FHD Monitor',
  image: 'https://m.media-amazon.com/images/I/71Sqk+ry2oL._SL1500_.jpg', price: 1651, mrp: 17000, pct: 90, best: null,
  notes: ['At its tracked low on Amazon right now'], rating: 4.4, bought: 500, category: 'Monitors & Gaming',
  buyUrl: 'https://www.amazon.in/dp/B0C8MTWMK2?tag=wwwbestdeal0d-21', date: '2026-10-15T13:45:22+00:00', ...over,
});
const feed = (deals) => ({ success: true, data: { deals } });

test('post text escapes HTML from deal fields and shows the price block', () => {
  const text = postText(deal({ fullName: 'Cable <USB-C> & charger', notes: ['Fits <b>all</b> phones'] }), ON);
  assert.match(text, /<b>Cable &lt;USB-C&gt; &amp; charger<\/b>/);
  assert.match(text, /• Fits &lt;b&gt;all&lt;\/b&gt; phones/);
  assert.match(text, /<blockquote>💰 <b>₹1,651<\/b> <s>₹17,000<\/s> · 90% off<\/blockquote>/);
  assert.match(text, /⭐ 4.4 on Amazon/);
});

test('the discount comes from the price and MRP, not a stale saved percent', () => {
  assert.match(postText(deal({ pct: 12 }), ON), /· 90% off/);
});

test('custom Telegram text replaces the notes', () => {
  const text = postText(deal({ telegramText: 'Grab it before the sale ends' }), ON);
  assert.match(text, /Grab it before the sale ends/);
  assert.doesNotMatch(text, /tracked low/);
});

test('photo captions stay under the 1024 limit with room for the ended line, without broken tags', () => {
  const long = deal({ telegramText: '<&>'.repeat(233) });
  const text = postText(long, ON);
  assert.ok(endedText(text).length <= 1024, `caption is ${endedText(text).length} characters`);
  assert.doesNotMatch(text.replace(/&(amp|lt|gt);/g, ''), /&/);
  assert.match(text, /<\/blockquote>/);
  const notes = deal({ notes: Array(4).fill('x'.repeat(200)), fullName: 'y'.repeat(300), name: 'z'.repeat(120) });
  assert.ok(postText(notes, ON).length <= 1024);
});

test('payload uses a bigger photo and the buy button', () => {
  const p = postPayload(deal(), ON);
  assert.equal(p.photo, 'https://m.media-amazon.com/images/I/71Sqk+ry2oL._SL1000_.jpg');
  assert.deepEqual(p.button, { text: 'Buy on Amazon', url: deal().buyUrl });
  assert.equal(postPayload(deal(), { ...ON, withPhoto: false }).photo, null);
});

test('eligibility follows the settings and the per-deal switch', () => {
  assert.equal(eligibility(deal(), { ...ON, enabled: false }).ok, false);
  assert.equal(eligibility(deal(), ON).ok, true);
  assert.equal(eligibility(deal({ telegram: false }), ON).ok, false);
  assert.equal(eligibility(deal({ date: '2026-09-01T00:00:00+00:00' }), ON).ok, false);
  assert.equal(eligibility(deal({ date: '2026-09-01T00:00:00+00:00', telegram: true }), ON).ok, true);
  assert.equal(eligibility(deal({ post: 'https://t.me/dealsupdateralert/1' }), ON).ok, false);
  assert.equal(eligibility(deal({ post: 'https://t.me/dealsupdateralert/1' }), { ...ON, skipTelegramSourced: false }).ok, true);
});

test('a deal is popular with one demand signal, a real discount and no weak rating', () => {
  const plain = { ...deal(), bought: undefined };
  assert.equal(popularity(plain).ok, false);
  assert.deepEqual(popularity(deal()).signals, ['500+ bought last month']);
  assert.equal(popularity({ ...plain, reviews: 2400 }).signals[0], 'Rated 4.4 by 2,400 buyers');
  assert.equal(popularity({ ...plain, reviews: 2400, rating: 3.9 }).ok, false, 'a 3.9 rating is not a review signal');
  assert.equal(popularity({ ...plain, badge: "Amazon's Choice" }).ok, true);
  assert.equal(popularity({ ...plain, trending: true }).ok, true);
  assert.match(popularity(deal({ mrp: 1700 })).misses.join(), /discount is under 10%/);
  assert.match(popularity(deal({ rating: 3.5 })).misses.join(), /rating is under 3.8/);
});

test('only popular deals are posted, even when a deal is switched on', () => {
  const plain = deal({ bought: 40, telegram: true });
  assert.match(eligibility(plain, ON).reason, /Not popular enough/);
  assert.equal(eligibility(plain, { ...ON, popularOnly: false }).ok, true);
  assert.deepEqual(planSync([plain], {}, ON), []);
});

test('planSync posts new deals oldest first and respects the per-run cap', () => {
  const deals = [deal({ id: 'b', date: '2026-10-16T00:00:00Z' }), deal({ id: 'a', date: '2026-10-15T00:00:00Z' }), deal({ id: 'c', date: '2026-10-17T00:00:00Z' })];
  assert.deepEqual(planSync(deals, {}, ON).map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(planSync(deals, {}, { ...ON, maxPerRun: 2 }).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(planSync(deals, {}, { ...ON, enabled: false }), []);
});

test('planSync edits changed posts and ends or deletes removed ones', () => {
  const d = deal();
  const fp = fingerprint(postPayload(d, ON));
  const entry = { messageId: 5, kind: 'photo', fp, photo: postPayload(d, ON).photo, text: 'old', state: 'posted' };
  assert.deepEqual(planSync([d], { [d.id]: entry }, ON), []);
  const cheaper = deal({ price: 1499 });
  assert.deepEqual(planSync([cheaper], { [d.id]: entry }, ON).map((a) => a.type), ['edit']);
  assert.deepEqual(planSync([cheaper], { [d.id]: entry }, { ...ON, editOnChange: false }), []);
  const ended = planSync([], { [d.id]: entry }, ON);
  assert.equal(ended[0].type, 'end');
  assert.match(ended[0].text, /^❌ <b>Deal ended<\/b>/);
  assert.equal(planSync([], { [d.id]: entry }, { ...ON, onRemove: 'delete' })[0].type, 'delete');
  assert.deepEqual(planSync([], { [d.id]: entry }, { ...ON, onRemove: 'keep' }), []);
  assert.equal(planSync([deal({ telegram: false })], { [d.id]: entry }, ON)[0].type, 'end');
  assert.deepEqual(planSync([], { [d.id]: { ...entry, state: 'ended' } }, ON), []);
});

test('message links work for public and private channels', () => {
  assert.equal(messageLink({ username: 'dealsoperator', id: -100123 }, 9), 'https://t.me/dealsoperator/9');
  assert.equal(messageLink({ id: -1001234567890 }, 9), 'https://t.me/c/1234567890/9');
  assert.equal(messageLink({ id: 42 }, 9), '');
});

test('validateDeal cleans a good deal and computes the discount', () => {
  const { deal: clean, errors } = validateDeal({ ...deal(), price: '1500', mrp: '3000', notes: [' a ', '', 'b'], telegram: true }, 'trending');
  assert.deepEqual(errors, []);
  assert.equal(clean.pct, 50);
  assert.equal(clean.trending, true);
  assert.deepEqual(clean.notes, ['a', 'b']);
  assert.equal(clean.telegram, true);
  assert.equal(clean.date, '2026-10-15T13:45:22+00:00');
  assert.equal(clean.bought, 500);
  const extra = validateDeal({ ...deal(), reviews: '1200', badge: "Amazon's Choice" }, 'main').deal;
  assert.deepEqual([extra.reviews, extra.badge], [1200, "Amazon's Choice"]);
  assert.match(validateDeal({ ...deal(), badge: 'Hot' }, 'main').errors[0], /Badge/);
  assert.match(validateDeal({ ...deal(), bought: 1.5 }, 'main').errors[0], /whole number/);
});

test('validateDeal rejects unsafe links and bad values', () => {
  const { errors } = validateDeal({ id: 'bad id!', name: '', buyUrl: 'javascript:alert(1)', image: 'https://evil.example/x.jpg', price: 0, rating: 9 }, 'main');
  assert.equal(errors.length, 6);
  assert.match(validateDeal(deal({ buyUrl: 'http://www.amazon.in/dp/B0C8MTWMK2' }), 'main').errors[0], /https/);
  assert.match(validateDeal(deal({ buyUrl: 'https://amazon.in.evil.com/dp/B0C8MTWMK2' }), 'main').errors[0], /amazon/);
});

test('any Amazon product link becomes the clean affiliate link', () => {
  const link = 'https://www.amazon.in/Samsung-Monitor/dp/b0c8mtwmk2/ref=sr_1_3?keywords=monitor&th=1';
  assert.equal(asinOf(link), 'B0C8MTWMK2');
  assert.equal(affiliateUrl(link, 'wwwbestdeal0d-21'), 'https://www.amazon.in/dp/B0C8MTWMK2?tag=wwwbestdeal0d-21');
  assert.equal(affiliateUrl('https://amzn.to/abc', 'x'), null);
});

test('live deals put trending first and skip the same product in the main list', () => {
  const top = deal({ id: 't-B0C8MTWMK2' });
  const other = deal({ id: 'a-B07LB6K93N', buyUrl: 'https://www.amazon.in/dp/B07LB6K93N?tag=x' });
  const ids = liveDeals(feed([deal(), other, { id: 'broken', name: '' }]), feed([top])).map((d) => d.id);
  assert.deepEqual(ids, ['t-B0C8MTWMK2', 'a-B07LB6K93N']);
});

test('the real deal files pass the checks the admin and the Telegram sync use', () => {
  const read = (name) => checkFeed(JSON.parse(readFileSync(new URL(`../Clean Portfolio/deals/${name}`, import.meta.url), 'utf8')), name);
  const main = read('deals.json'), trending = read('trending.json');
  const ids = [...main.data.deals, ...trending.data.deals].map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'deal ids must be unique');
  assert.ok(liveDeals(main, trending).length > 0);
  const settings = JSON.parse(readFileSync(new URL('../deals-admin/data/telegram.json', import.meta.url), 'utf8'));
  assert.ok(Date.parse(settings.postSince), 'postSince must be set so old deals are not flooded into the channel');
});
