/* Rechecks every deal through the Amazon Creators API and saves the current price, MRP,
   main image and sales rank. Deals that are out of stock, or (on the main list) no longer
   at least 10% off, come off the site, and the Telegram sync marks their posts ended.
   A coupon or card price older than two days, or from before a price change, is dropped.

   node deals-admin/refresh-deals.mjs [--dry] [ASIN ...]

   With ASINs it checks only those products. A deal Amazon sends no data for keeps its
   old data. Exit code 3 means the API keys are not set up. While Amazon hasn't turned
   on access for the keys yet, it warns and changes nothing. */
import { readState, patchDeals, removeDeals } from './store.mjs';
import { asinOf } from './lib/deals.mjs';
import { commonTag, FALLBACK_TAG } from './lib/importer.mjs';
import { createClient, credentialsFromEnv, isNotEligible } from './lib/creators-api.mjs';
import { RESOURCES, refreshPlan } from './lib/catalog.mjs';

const EXIT_NO_KEYS = 3;
/* When this share of the checked deals would come off in one run, something is off
   with the data, so nothing is removed and the run says so */
const MAX_REMOVE_SHARE = 0.5;

const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

const savedDeals = (only) => Object.entries(readState().feeds)
  .flatMap(([feed, f]) => f.deals.map((deal) => ({ feed, deal, asin: asinOf(deal.buyUrl) })))
  .filter(({ asin }) => asin && (!only.size || only.has(asin)));

const plan = (deals, items) => {
  const patches = {}, removals = [];
  for (const { feed, deal, asin } of deals) {
    const { patch, remove, keep } = refreshPlan({ deal, feed, item: items.get(asin) });
    if (keep) console.log(`keep  ${asin}  (${keep})`);
    else if (remove) { removals.push({ id: deal.id, asin, remove }); console.log(`end   ${asin}  ${deal.name}  (${remove})`); }
    else {
      patches[deal.id] = patch;
      const moved = Number(deal.price) !== patch.price ? `, was ${rupees(deal.price)}` : '';
      console.log(`ok    ${asin}  ${rupees(patch.price)}${moved}${patch.best === null && deal.best ? ', old card price dropped' : ''}`);
    }
  }
  return { patches, removals };
};

const save = (patches, removals, checked) => {
  const { changed, failed } = patchDeals(patches);
  failed.forEach((f) => console.log(`kept  ${f.id}  (${f.errors.join('. ')})`));
  const tooMany = removals.length > checked * MAX_REMOVE_SHARE;
  if (tooMany) console.log(`::warning::${removals.length} of ${checked} deals look ended. That is too many at once, so none were removed.`);
  const removed = tooMany ? [] : removeDeals(removals.map((r) => r.id));
  console.log(`\n${checked} deals checked, ${changed.length} updated, ${removed.length} removed.`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const isDry = args.includes('--dry');
  const credentials = credentialsFromEnv();
  if (!credentials) {
    console.log('::warning::Creators API keys are not set (AMAZON_CREATORS_ID, AMAZON_CREATORS_SECRET). Nothing was checked.');
    process.exitCode = EXIT_NO_KEYS;
    return;
  }
  const deals = savedDeals(new Set(args.filter((a) => /^[A-Z0-9]{10}$/.test(a))));
  const partnerTag = process.env.AMAZON_PARTNER_TAG || commonTag(deals.map((d) => d.deal)) || FALLBACK_TAG;
  const client = createClient({ credentials, partnerTag });
  console.log(`Checking ${deals.length} deals through the Creators API\n`);
  const { items, failed } = await client.getAllItems([...new Set(deals.map((d) => d.asin))], RESOURCES);
  failed.forEach((f) => console.log(`miss  ${f.asins.join(' ') || '?'}  (${f.reason})`));
  const { patches, removals } = plan(deals, items);
  const checked = Object.keys(patches).length + removals.length;
  if (isDry) console.log(`\nDry run: ${checked} deals checked, ${removals.length} would be removed, nothing saved.`);
  else save(patches, removals, checked);
};

main().catch((err) => {
  if (isNotEligible(err)) {
    console.log(`::warning::${err.message} Nothing was changed.`);
    return;
  }
  console.error(`Refresh failed: ${err.message}`);
  process.exitCode = 1;
});
