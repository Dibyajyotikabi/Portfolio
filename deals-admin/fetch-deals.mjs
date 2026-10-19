/* Finds popular Amazon.in deals without a browser, an Amazon account or any paid API.
   It reads a few Best Sellers lists, opens each product page with a pause between
   requests, writes template notes and saves the deals that pass the import rules.
   Feed the file to import-deals.mjs to add them to the site.

   node deals-admin/fetch-deals.mjs candidates.json

   When Amazon answers with a bot check, the run stops there. It never retries around
   it or goes through a proxy. Exit code 2 means Amazon blocked it before any deal. */
import { writeFileSync } from 'node:fs';
import { readState } from './store.mjs';
import { listsFor, interleave, parseBestSellers, parseProduct, toCandidate } from './lib/amazon.mjs';
import { BlockedError, get, pause } from './lib/amazon-http.mjs';
import { planImport, commonTag, existingAsins, DAILY } from './lib/importer.mjs';

const LISTS_PER_RUN = 4;
const MAX_PRODUCT_PAGES = 45;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXIT_BLOCKED = 2;

/* Today's lists, minus the products the site already has */
const readQueues = async (listed) => {
  const queues = [];
  for (const list of listsFor(Math.floor(Date.now() / DAY_MS), LISTS_PER_RUN)) {
    await pause();
    try {
      const asins = parseBestSellers(await get(`/gp/bestsellers/${list.path}`)).filter((a) => !listed.has(a));
      console.log(`list ${list.path}: ${asins.length} new products`);
      queues.push(asins.map((asin) => ({ asin, category: list.category })));
    } catch (err) {
      if (err instanceof BlockedError) throw err;
      console.log(`list ${list.path}: ${err.message}`);
    }
  }
  /* the same product often sits on two lists, so open its page once */
  const once = new Set();
  return interleave(queues).filter(({ asin }) => !once.has(asin) && once.add(asin));
};

/* Opens product pages until the daily cap, keeping only what the importer would accept */
const checkProducts = async (queue, { listed, tag }) => {
  const seen = new Set(listed), picked = [];
  let blocked = null;
  for (const { asin, category } of queue.slice(0, MAX_PRODUCT_PAGES)) {
    if (picked.length >= DAILY.max) break;
    await pause();
    try {
      const candidate = toCandidate(asin, parseProduct(await get(`/dp/${asin}`)), category);
      const { accepted, skipped } = planImport({ candidates: [candidate], listed: seen, tag });
      if (accepted.length) { picked.push(candidate); seen.add(asin); console.log(`keep  ${asin}  ${candidate.name}`); }
      else console.log(`skip  ${asin}  ${candidate.name || '?'}  (${skipped[0]?.reason})`);
    } catch (err) {
      if (!(err instanceof BlockedError)) { console.log(`skip  ${asin}  (${err.message})`); continue; }
      blocked = err;
      break;
    }
  }
  return { picked, blocked };
};

const main = async () => {
  const out = process.argv[2];
  if (!out) throw new Error('Usage: node deals-admin/fetch-deals.mjs candidates.json');
  const all = Object.values(readState().feeds).flatMap((f) => f.deals);
  const listed = existingAsins(all);
  const queue = await readQueues(listed);
  const { picked, blocked } = await checkProducts(queue, { listed, tag: commonTag(all) });
  writeFileSync(out, JSON.stringify(picked, null, 1) + '\n');
  console.log(`\n${picked.length} deals saved to ${out} from ${queue.length} products.`);
  if (blocked) {
    console.log(`BLOCKED: ${blocked.message}. Stopped here.`);
    if (!picked.length) process.exitCode = EXIT_BLOCKED;
  }
};

main().catch((err) => {
  console.error(err instanceof BlockedError ? `BLOCKED: ${err.message}. Stopped here.` : `Fetch failed: ${err.message}`);
  process.exitCode = err instanceof BlockedError ? EXIT_BLOCKED : 1;
});
