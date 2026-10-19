/* Adds a batch of sourced Amazon deals to the main deal list in one go.
   The daily sourcing routine (.claude/skills/source-deals/SKILL.md) writes the
   candidates file; this script decides what goes in and saves it through the same
   store the admin panel uses, so validation and duplicate checks always run.

   node deals-admin/import-deals.mjs candidates.json          add the deals
   node deals-admin/import-deals.mjs candidates.json --dry    print the plan, write nothing

   candidates.json is an array (or { "deals": [...] }) of
   { asin, name, fullName, image, price, mrp, rating, reviews, bought, badge,
     category, notes: [2 to 4 lines], checked: true }
   The first candidate ends up at the top of the page. */
import { readFileSync } from 'node:fs';
import { readState, saveDeal } from './store.mjs';
import { planImport, commonTag, existingAsins, DAILY } from './lib/importer.mjs';

const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const file = args.find((a) => !a.startsWith('--'));

const readCandidates = (path) => {
  const body = JSON.parse(readFileSync(path, 'utf8'));
  const list = Array.isArray(body) ? body : body?.deals;
  if (!Array.isArray(list)) throw new Error(`${path} must hold an array of deals or { "deals": [...] }`);
  return list;
};

const report = ({ accepted, skipped }, saved) => {
  for (const d of accepted) console.log(`${isDry ? 'would add' : 'added'}  ${d.id}  ${d.pct}% off  ₹${d.price}  ${d.name}`);
  for (const s of skipped) console.log(`skipped  ${s.asin}  ${s.name.slice(0, 50)}  (${s.reason})`);
  const total = isDry ? accepted.length : saved;
  console.log(`\n${total} ${isDry ? 'to add' : 'added'}, ${skipped.length} skipped.`);
  if (total < DAILY.min) console.log(`Below the daily goal of ${DAILY.min}. Source a few more.`);
};

const main = () => {
  if (!file) throw new Error('Usage: node deals-admin/import-deals.mjs candidates.json [--dry]');
  const state = readState();
  const all = Object.values(state.feeds).flatMap((f) => f.deals);
  const plan = planImport({ candidates: readCandidates(file), listed: existingAsins(all), tag: commonTag(all) });
  /* saveDeal puts each new deal on top, so save the last one first */
  const saved = isDry ? 0 : [...plan.accepted].reverse().map((deal) => saveDeal({ feed: 'main', deal })).length;
  report(plan, saved);
};

try {
  main();
} catch (err) {
  console.error(`Import failed: ${err.message}`);
  process.exitCode = 1;
}
