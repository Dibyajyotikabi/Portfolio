/* Finds popular Amazon.in deals through the Amazon Creators API, the official product
   feed for Associates. It never opens an Amazon page or logs in to an account. A few
   searches a day ask for Prime products at least 15% off and rated 4 or more, then the
   import rules pick the ones with a top sales rank. Feed the file to import-deals.mjs.

   node deals-admin/fetch-deals.mjs candidates.json

   Exit code 3 means the API keys are not set up. */
import { writeFileSync } from 'node:fs';
import { readState } from './store.mjs';
import { interleave } from './lib/amazon.mjs';
import { planImport, commonTag, existingAsins, DAILY } from './lib/importer.mjs';
import { createClient, credentialsFromEnv, isFatal } from './lib/creators-api.mjs';
import { RESOURCES, searchesFor, searchParams, toApiCandidate } from './lib/catalog.mjs';

const SEARCHES_PER_RUN = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXIT_NO_KEYS = 3;

/* Today's searches, one list of new candidates per search */
const searchQueues = async (client, listed) => {
  const queues = [];
  for (const search of searchesFor(Math.floor(Date.now() / DAY_MS), SEARCHES_PER_RUN)) {
    try {
      const found = (await client.searchItems(searchParams(search), RESOURCES))
        .map((item) => toApiCandidate(item, search.category))
        .filter((c) => c.asin && !listed.has(c.asin));
      console.log(`search "${search.keywords}": ${found.length} new products`);
      queues.push(found);
    } catch (err) {
      if (isFatal(err)) throw err;
      console.log(`search "${search.keywords}": ${err.message}`);
    }
  }
  return queues;
};

const main = async () => {
  const out = process.argv[2];
  if (!out) throw new Error('Usage: node deals-admin/fetch-deals.mjs candidates.json');
  const credentials = credentialsFromEnv();
  if (!credentials) {
    console.log('::warning::Creators API keys are not set (AMAZON_CREATORS_ID, AMAZON_CREATORS_SECRET). No deals were looked up.');
    process.exitCode = EXIT_NO_KEYS;
    return;
  }
  const all = Object.values(readState().feeds).flatMap((f) => f.deals);
  const listed = existingAsins(all);
  const tag = process.env.AMAZON_PARTNER_TAG || commonTag(all);
  const client = createClient({ credentials, partnerTag: tag });
  /* one from each search in turn, so a day doesn't fill up from a single category */
  const once = new Set();
  const queue = interleave(await searchQueues(client, listed)).filter((c) => !once.has(c.asin) && once.add(c.asin));
  const { accepted, skipped } = planImport({ candidates: queue, listed, tag, limit: DAILY.max });
  skipped.forEach((s) => console.log(`skip  ${s.asin}  ${s.name || '?'}  (${s.reason})`));
  const keep = new Set(accepted.map((d) => d.id.slice(2)));
  const picked = queue.filter((c) => keep.has(c.asin));
  picked.forEach((c) => console.log(`keep  ${c.asin}  ${c.name}`));
  writeFileSync(out, JSON.stringify(picked, null, 1) + '\n');
  console.log(`\n${picked.length} deals saved to ${out} from ${queue.length} products.`);
};

main().catch((err) => {
  console.error(`Fetch failed: ${err.message}`);
  process.exitCode = 1;
});
