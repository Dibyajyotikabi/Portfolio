/* Turns Creators API products into deal updates and import candidates. Pure functions
   only, so the refresh, the sourcing and the tests all read Amazon's data the same way.
   The API has no coupons, bank offers or cashback, so a saved lowest price is kept only
   while it is fresh and the Amazon price hasn't moved. */
import { templateNotes, repriceNotes, shortName, categoryFor } from './amazon.mjs';
import { POPULAR } from './deals.mjs';

/* What each refresh and search asks for. No reviews or ratings: the API doesn't share them. */
export const RESOURCES = Object.freeze([
  'images.primary.large',
  'itemInfo.title',
  'itemInfo.features',
  'browseNodeInfo.browseNodes.salesRank',
  'offersV2.listings.price',
  'offersV2.listings.availability',
  'offersV2.listings.condition',
  'offersV2.listings.dealDetails',
  'offersV2.listings.isBuyBoxWinner',
]);

/* A card or coupon price was worked out from the product page. Past this, or once the
   Amazon price changes, it may be wrong, so it comes off the deal. */
export const OFFERS_TTL_MS = 48 * 60 * 60 * 1000;
const GONE = new Set(['OUT_OF_STOCK', 'UNAVAILABLE']);
const MAX_NOTES = 4;
const IMAGE_HOST = /^https:\/\/m\.media-amazon\.com\/images\//;
const IMAGE_SIZE = '._SL1500_.';

/* Searches to rotate through, with the category their products usually fit */
export const SEARCHES = Object.freeze([
  { searchIndex: 'Electronics', keywords: 'smartphone', category: 'Phones & Tablets' },
  { searchIndex: 'Electronics', keywords: 'wireless earbuds', category: 'Audio' },
  { searchIndex: 'Computers', keywords: 'laptop', category: 'Laptops & Computers' },
  { searchIndex: 'Electronics', keywords: 'smartwatch', category: 'Wearables' },
  { searchIndex: 'HomeAndKitchen', keywords: 'kitchen appliance', category: 'Home & Kitchen' },
  { searchIndex: 'Electronics', keywords: 'smart tv', category: 'TVs & Projectors' },
  { searchIndex: 'Electronics', keywords: 'power bank', category: 'Accessories & Storage' },
  { searchIndex: 'Computers', keywords: 'monitor', category: 'Monitors & Gaming' },
  { searchIndex: 'Electronics', keywords: 'bluetooth speaker', category: 'Audio' },
  { searchIndex: 'Electronics', keywords: 'tablet', category: 'Phones & Tablets' },
  { searchIndex: 'Computers', keywords: 'ssd', category: 'Accessories & Storage' },
  { searchIndex: 'Electronics', keywords: 'headphones', category: 'Audio' },
]);

/* Rotates by day, so every search comes up every couple of days */
export const searchesFor = (day, count) => Array.from({ length: Math.min(count, SEARCHES.length) }, (_, i) => SEARCHES[(day * count + i) % SEARCHES.length]);

/* Only deals worth posting: a real discount, good ratings and Prime delivery */
export const searchParams = (search) => ({
  keywords: search.keywords,
  searchIndex: search.searchIndex,
  itemCount: 10,
  sortBy: 'Featured',
  minSavingPercent: 15,
  minReviewsRating: 4,
  deliveryFlags: ['Prime'],
  condition: 'New',
});

/* Amazon gives the original image. A size tag makes it 1500px, and the site and Telegram
   swap that tag for the size they need. */
export const bigImage = (url) => {
  const u = String(url || '');
  if (!IMAGE_HOST.test(u)) return null;
  return /\._[^/.]+_\.(jpe?g|png|webp|gif)$/i.test(u)
    ? u.replace(/\._[^/.]+_\.(jpe?g|png|webp|gif)$/i, `${IMAGE_SIZE}$1`)
    : u.replace(/\.(jpe?g|png|webp|gif)$/i, `${IMAGE_SIZE}$1`);
};

const buyBox = (item) => {
  const listings = Array.isArray(item?.offersV2?.listings) ? item.offersV2.listings : [];
  return listings.find((l) => l?.isBuyBoxWinner) || listings[0] || null;
};

/* The product's best sales rank, in the narrowest category Amazon ranks it in */
const topRank = (item) => (item?.browseNodeInfo?.browseNodes || [])
  .filter((n) => Number.isInteger(n?.salesRank) && n.salesRank > 0 && n.displayName)
  .sort((a, b) => a.salesRank - b.salesRank)[0] || null;

const money = (m) => (Number(m?.amount) > 0 ? Math.round(Number(m.amount)) : null);

/* One API product as plain facts */
export const readItem = (item) => {
  const listing = buyBox(item);
  const price = money(listing?.price?.money);
  const basis = listing?.price?.savingBasis;
  const rank = topRank(item);
  return {
    asin: String(item?.asin || ''),
    title: String(item?.itemInfo?.title?.displayValue || '').replace(/\s+/g, ' ').trim(),
    features: Array.isArray(item?.itemInfo?.features?.displayValues) ? item.itemInfo.features.displayValues : [],
    image: bigImage(item?.images?.primary?.large?.url),
    price,
    mrp: basis?.savingBasisType === 'LIST_PRICE' ? money(basis.money) : null,
    inStock: Boolean(listing && price && !GONE.has(listing.availability?.type)),
    primeDeal: listing?.dealDetails?.accessType === 'PRIME_EXCLUSIVE',
    salesRank: rank ? rank.salesRank : null,
    rankIn: rank ? String(rank.displayName).slice(0, 60) : '',
  };
};

const PRIME_NOTE = 'This is a Prime-only deal, so you need Prime to get this price.';
const RANK_NOTE = /^It's #\d+ in .+ on Amazon\.in right now\.$/;
const rankNote = (rank, rankIn) => `It's #${rank} in ${rankIn} on Amazon.in right now.`;
const isPopularRank = (rank) => rank > 0 && rank <= POPULAR.salesRank;

/* The saved notes with today's numbers: the saving, the sales rank and the Prime-only line */
export const refreshNotes = (notes, { price, mrp, primeDeal, salesRank, rankIn }) => {
  const base = repriceNotes((notes || []).filter((n) => n !== PRIME_NOTE), price, mrp);
  const ranked = isPopularRank(salesRank) ? rankNote(salesRank, rankIn) : null;
  const withRank = base.some((n) => RANK_NOTE.test(n))
    ? base.map((n) => (RANK_NOTE.test(n) ? ranked : n)).filter(Boolean)
    : [...base, ...(ranked ? [ranked] : [])];
  return [...(primeDeal ? [PRIME_NOTE] : []), ...withRank].slice(0, MAX_NOTES);
};

const NO_OFFERS = Object.freeze({ best: null, bestVia: '', offers: [], nonPrime: null, offersAt: null });

/* What to do with one saved deal after reading it from the API:
   { patch } to update it, { remove } when the deal is over, { keep } when there's no answer */
export const refreshPlan = ({ deal, feed, item, now = Date.now() }) => {
  if (!item) return { keep: 'Amazon sent no data for it' };
  const live = readItem(item);
  if (!live.inStock) return { remove: 'out of stock or no seller on Amazon' };
  const price = live.price;
  const mrp = live.mrp || (Number(deal.mrp) > price ? Number(deal.mrp) : null);
  const pct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  if (feed === 'main' && pct < POPULAR.discount) return { remove: `discount is ${pct}%, under ${POPULAR.discount}%` };
  const isFresh = Number(deal.price) === price && Date.parse(deal.offersAt) > now - OFFERS_TTL_MS;
  return {
    patch: {
      price,
      mrp,
      ...(live.image ? { image: live.image } : {}),
      ...(live.salesRank ? { salesRank: live.salesRank, rankIn: live.rankIn } : {}),
      notes: refreshNotes(deal.notes, { ...live, mrp }),
      ...(isFresh ? {} : NO_OFFERS),
    },
  };
};

/* A search result as an import candidate (see import-deals.mjs for the fields) */
export const toApiCandidate = (item, fallbackCategory) => {
  const live = readItem(item);
  const notes = refreshNotes(templateNotes({ price: live.price, mrp: live.mrp, bullets: live.features }), live);
  return {
    asin: live.asin,
    name: shortName(live.title),
    fullName: live.title,
    image: live.image,
    price: live.price,
    mrp: live.mrp,
    ...(live.salesRank ? { salesRank: live.salesRank, rankIn: live.rankIn } : {}),
    category: categoryFor(live.title, fallbackCategory),
    notes,
    checked: Boolean(live.title && live.inStock && live.image),
  };
};
