/* Reads and writes the files the admin panel edits. Every change builds a new feed
   object and writes it in one rename, so a crash never leaves half a JSON file. */
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDS, validateDeal, checkFeed, isoDate, asinOf } from './lib/deals.mjs';
import { DEFAULT_SETTINGS, ON_REMOVE, mergeSettings } from './telegram/format.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEALS_DIR = path.join(ROOT, 'Clean Portfolio/deals');
export const DATA_DIR = path.join(ROOT, 'deals-admin/data');
const SETTINGS_FILE = path.join(DATA_DIR, 'telegram.json');
const LEDGER_FILE = path.join(DATA_DIR, 'posted.json');

/* Files a publish is allowed to commit, relative to the repo root */
export const PUBLISH_FILES = [
  ...Object.values(FEEDS).map((f) => `Clean Portfolio/deals/${f.file}`),
  'deals-admin/data/telegram.json',
];

export class InputError extends Error {}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1) + '\n');
  renameSync(tmp, file);
};

const feedName = (name) => {
  if (!Object.hasOwn(FEEDS, name)) throw new InputError(`Unknown list: ${name}`);
  return name;
};
const feedFile = (name) => path.join(DEALS_DIR, FEEDS[feedName(name)].file);
const readFeed = (name) => checkFeed(readJson(feedFile(name)), FEEDS[name].file);

/* Trending ranks follow the list order, so moving a card is all it takes to rerank */
const ranked = (name, deals) => (name === 'trending' ? deals.map((d, i) => ({ ...d, rank: i + 1 })) : deals);

const writeDeals = (name, body, deals) => {
  writeJson(feedFile(name), {
    ...body,
    data: { ...body.data, deals: ranked(name, deals), [FEEDS[name].stamp]: isoDate(Date.now()) },
  });
};

const readLedger = () => {
  try { return readJson(LEDGER_FILE); } catch (err) {
    if (err.code === 'ENOENT') return { posts: {} };
    throw err;
  }
};

export const readSettings = () => {
  try { return mergeSettings(readJson(SETTINGS_FILE)); } catch (err) {
    if (err.code === 'ENOENT') return mergeSettings({});
    throw err;
  }
};

export const readState = () => ({
  feeds: Object.fromEntries(Object.keys(FEEDS).map((name) => {
    const body = readFeed(name);
    return [name, { deals: body.data.deals, stamp: body.data[FEEDS[name].stamp] || null }];
  })),
  settings: readSettings(),
  ledger: readLedger().posts || {},
});

const duplicateOf = (deal, feeds, skip) => {
  const asin = asinOf(deal.buyUrl);
  for (const [name, body] of Object.entries(feeds)) {
    const hit = body.data.deals.find((d) => !(name === skip.feed && d.id === skip.id) && (d.id === deal.id || (asin && asinOf(d.buyUrl) === asin)));
    if (hit) return `${FEEDS[name].label} already has this product (${hit.id})`;
  }
  return null;
};

const loadFeeds = () => Object.fromEntries(Object.keys(FEEDS).map((n) => [n, readFeed(n)]));

/* Adds a deal, or replaces the one called originalId. New deals go to the top. */
export const saveDeal = ({ feed, deal, originalId }) => {
  const name = feedName(feed);
  const { deal: clean, errors } = validateDeal(deal, name);
  if (errors.length) throw new InputError(errors.join('. '));
  const feeds = loadFeeds();
  const list = feeds[name].data.deals;
  const at = originalId ? list.findIndex((d) => d.id === originalId) : -1;
  if (originalId && at < 0) throw new InputError(`No deal ${originalId} in ${FEEDS[name].label}`);
  /* only a new product is checked, so older repeats in the files stay editable */
  const isNewProduct = at < 0 || list[at].id !== clean.id || asinOf(list[at].buyUrl) !== asinOf(clean.buyUrl);
  const dup = isNewProduct && duplicateOf(clean, feeds, { feed: name, id: originalId });
  if (dup) throw new InputError(dup);
  const kept = at >= 0 ? { ...(list[at].rank ? { rank: list[at].rank } : {}) } : {};
  const next = at >= 0 ? list.map((d, i) => (i === at ? { ...clean, ...kept } : d)) : [clean, ...list];
  writeDeals(name, feeds[name], next);
  return clean;
};

/* Applies { [id]: fields } to the deals in every list. A deal whose result fails the
   checks keeps its old data. Returns the ids that changed and the ones that failed. */
export const patchDeals = (patches) => {
  const changed = [], failed = [];
  for (const [name, body] of Object.entries(loadFeeds())) {
    let touched = false;
    const next = body.data.deals.map((d) => {
      if (!Object.hasOwn(patches, d.id)) return d;
      const { deal: clean, errors } = validateDeal({ ...d, ...patches[d.id] }, name);
      if (errors.length) { failed.push({ id: d.id, errors }); return d; }
      const merged = { ...clean, ...(d.rank ? { rank: d.rank } : {}) };
      if (JSON.stringify(merged) === JSON.stringify(d)) return d;
      touched = true;
      changed.push(d.id);
      return merged;
    });
    if (touched) writeDeals(name, body, next);
  }
  return { changed, failed };
};

export const deleteDeal = ({ feed, id }) => {
  const body = readFeed(feedName(feed));
  const next = body.data.deals.filter((d) => d.id !== id);
  if (next.length === body.data.deals.length) throw new InputError(`No deal ${id}`);
  writeDeals(feed, body, next);
};

export const reorder = ({ feed, ids }) => {
  const body = readFeed(feedName(feed));
  const byId = new Map(body.data.deals.map((d) => [d.id, d]));
  const isPermutation = Array.isArray(ids) && ids.length === byId.size && new Set(ids).size === ids.length && ids.every((id) => byId.has(id));
  if (!isPermutation) throw new InputError('The list changed while you were sorting. Reload and try again.');
  writeDeals(feed, body, ids.map((id) => byId.get(id)));
};

/* Moves a deal between Deals and Trending without losing its Telegram post */
export const moveDeal = ({ from, to, id }) => {
  const source = readFeed(feedName(from)), target = readFeed(feedName(to));
  if (from === to) throw new InputError('Pick the other list');
  const deal = source.data.deals.find((d) => d.id === id);
  if (!deal) throw new InputError(`No deal ${id}`);
  const { rank, trending, ...rest } = deal;
  const { deal: clean, errors } = validateDeal(rest, to);
  if (errors.length) throw new InputError(errors.join('. '));
  writeDeals(to, target, [clean, ...target.data.deals.filter((d) => d.id !== id)]);
  writeDeals(from, source, source.data.deals.filter((d) => d.id !== id));
};

const CHAT_RE = /^(@[A-Za-z][A-Za-z0-9_]{4,31}|-?\d{5,20})?$/;

export const saveSettings = (input) => {
  const s = { ...DEFAULT_SETTINGS, ...readSettings(), ...(input || {}) };
  const errors = [];
  const chatId = String(s.chatId || '').trim();
  if (!CHAT_RE.test(chatId)) errors.push('Chat must be @channelname or a numeric id like -1001234567890');
  if (!ON_REMOVE.includes(s.onRemove)) errors.push('Pick what happens when a deal leaves the site');
  if (s.postSince && !Date.parse(s.postSince)) errors.push('The "post deals from" date is not valid');
  const max = Number(s.maxPerRun);
  if (!(Number.isInteger(max) && max >= 1 && max <= 50)) errors.push('Posts per deploy must be 1 to 50');
  const every = Number(s.postEveryMinutes || 0);
  if (!(Number.isInteger(every) && every >= 0 && every <= 1440)) errors.push('Post every must be 0 to 1440 minutes');
  if (errors.length) throw new InputError(errors.join('. '));
  const clean = {
    enabled: s.enabled === true, chatId,
    postSince: s.postSince ? isoDate(Date.parse(s.postSince)) : '',
    withPhoto: s.withPhoto !== false, silent: s.silent === true, editOnChange: s.editOnChange !== false,
    onRemove: s.onRemove, skipTelegramSourced: s.skipTelegramSourced !== false, popularOnly: s.popularOnly !== false, maxPerRun: max,
    postEveryMinutes: every,
    buttonText: String(s.buttonText || DEFAULT_SETTINGS.buttonText).trim().slice(0, 40),
    footer: String(s.footer ?? '').trim().slice(0, 200),
  };
  writeJson(SETTINGS_FILE, clean);
  return clean;
};
