/* Shared by the page (deals.js) and the build (scripts/prerender-deals.mjs), so the
   prerendered HTML and anything the browser builds later come from the same code.
   The caller passes h/s builders: real DOM nodes in the browser, escaped HTML in Node. */
export const STOCKS = ['butter', 'sky', 'mint', 'blush'];
export const rupees = (n) => Number(n).toLocaleString('en-IN');

const safeUrl = (value, hosts) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h)) ? url.href : null;
  } catch { return null; }
};

/* Amazon serves any size from the same image id, and 400px is plenty for a 240px card */
const small = (url) => url && url.replace(/\._[A-Z]{2}\d+_\./, '._SL400_.');
const asin = (url) => (url.match(/\/dp\/([A-Z0-9]{10})/) || [])[1] || url;

const clean = (d, i) => {
  const price = Number(d.price), mrp = Number(d.mrp), best = Number(d.best), rating = Number(d.rating);
  const buyUrl = safeUrl(d.buyUrl, ['amazon.in', 'amzn.to']);
  if (!d.name || !buyUrl || !(price > 0)) return null;
  return {
    name: String(d.name), fullName: String(d.fullName || d.name), buyUrl,
    image: small(safeUrl(d.image, ['media-amazon.com', 'ssl-images-amazon.com'])),
    trending: d.trending === true,
    price, mrp: mrp > price ? mrp : null, pct: Math.max(0, Math.round(Number(d.pct) || 0)),
    category: String(d.category || 'More gadgets'),
    atLow: Boolean(d.atLow), lowLabel: String(d.lowLabel || 'tracked low'),
    rank: Number(d.rank) || i + 1, rating: rating > 0 ? rating : null,
    notes: Array.isArray(d.notes) ? d.notes.map(String).slice(0, 4) : [],
    best: best > 0 ? best : null,
    time: Date.parse(d.date) || 0,
  };
};

/* checks one { success, data: { deals } } file and returns its clean, ranked deals */
export const parseFeed = (body, name) => {
  if (!body || !body.success || !Array.isArray(body.data?.deals)) throw new Error(`Bad deals file: ${name}`);
  return { list: body.data.deals.map(clean).filter(Boolean).sort((a, b) => a.rank - b.rank), data: body.data };
};

/* the hand-picked trending list sits on top, and the feed skips anything already in it */
export const mergeDeals = (main, top) => {
  const seen = new Set(top.list.map((d) => asin(d.buyUrl)));
  return [...top.list, ...main.list.filter((d) => !seen.has(asin(d.buyUrl)))];
};

export const categories = (deals) => {
  const counts = deals.reduce((m, d) => ({ ...m, [d.category]: (m[d.category] || 0) + 1 }), {});
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  return { cats, counts };
};

export const asofText = (t) => new Date(t).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
}) + ' IST';

const prevLine = (h, d) => {
  if (d.atLow) return h('p', { class: 'prev' }, ['At its ', h('b', {}, [d.lowLabel]), ' on Amazon']);
  if (d.mrp) return h('p', { class: 'prev' }, [h('b', {}, ['₹' + rupees(d.mrp - d.price) + ' below']), ' its list price']);
  return h('p', { class: 'prev' }, [d.rating ? 'Rated ' + d.rating + ' on Amazon' : 'Checked on Amazon']);
};

/* the feed rarely carries notes, so build plain ones from the numbers we do have */
const notesFor = (d) => {
  if (d.notes.length) return d.notes;
  const out = [];
  if (d.mrp) out.push(`List price is ₹${rupees(d.mrp)}, so you save ₹${rupees(d.mrp - d.price)} (${d.pct}% off).`);
  if (d.atLow) out.push(`The price is at its ${d.lowLabel} on Amazon right now.`);
  if (d.rating) out.push(`Rated ${d.rating} out of 5 on Amazon.`);
  out.push(`I checked this ${d.category.toLowerCase()} deal on Amazon before posting it.`);
  return out;
};

export const views = (h, s) => {
  const riso = (text) => h('span', { class: 'riso' }, [h('span', { class: 'riso-b', 'aria-hidden': 'true' }, [text]), h('span', { class: 'riso-p' }, [text])]);

  const burst = (pct) => h('span', { class: 'burst', 'aria-hidden': 'true' }, [
    s('svg', { viewBox: '-50 -50 100 100' }, [
      s('use', { class: 'bp', href: '#burst-path' }),
      s('use', { class: 'bb', href: '#burst-path' }),
      s('text', { x: '2', y: '5.9' }, [s('tspan', { class: 'bn' }, [String(pct)]), s('tspan', { class: 'bpct', dy: '-10.9' }, ['%'])]),
      s('text', { class: 'bo', x: '2.8', y: '17.2' }, ['OFF']),
    ]),
  ]);

  const card = (d, i, cat) => {
    const nameId = 'n' + i;
    const pic = h('figure', { class: 'pic' + (d.image ? ' has-img' : '') }, d.image ? [h('img', {
      src: d.image, alt: '', decoding: 'async', loading: i < 8 ? 'eager' : 'lazy', width: '240', height: '240', referrerpolicy: 'no-referrer',
      ...(i < 2 ? { fetchpriority: 'high' } : {}),
    })] : []);
    const body = h('div', { class: 'body' }, [
      h('div', { class: 'b-main' }, [
        h('div', { class: 'pic-wrap' }, [pic, h('span', { class: 'rank' }, [h('span', { class: 'vh' }, ['Rank ']), riso(String(i + 1))]), d.pct ? burst(d.pct) : null]),
        h('div', { class: 'b-txt' }, [d.trending ? h('p', { class: 'trend' }, ['Trending']) : null, h('h3', { class: 'name', id: nameId, title: d.fullName }, [d.name]), prevLine(h, d)]),
      ]),
      h('details', { class: 'why' }, [h('summary', {}, ['Why this deal']), h('ul', { class: 'notes' }, notesFor(d).map((n) => h('li', {}, [n])))]),
    ]);
    const amount = rupees(d.price);
    const stub = h('div', { class: 'stub' }, [
      d.mrp ? h('p', { class: 'usual' }, [h('span', { class: 'vh' }, ['Usually ']), h('span', { class: 'strike' }, [h('s', {}, ['₹' + rupees(d.mrp)]), h('i', { class: 'scrib', 'aria-hidden': 'true' })])]) : null,
      h('p', { class: 'price' + (amount.length > 7 ? ' long' : '') }, [h('span', { class: 'vh' }, ['Sale price ']), h('span', { class: 'cur' }, ['₹']), amount,
        d.pct ? h('span', { class: 'vh' }, [`, ${d.pct}% off`]) : null]),
      d.best ? h('p', { class: 'best' }, [h('span', { class: 'hl' }, ['Best buy ₹' + rupees(d.best)])]) : null,
      h('a', { class: 'cta', href: d.buyUrl, target: '_blank', rel: 'sponsored nofollow noopener' }, ['Buy on Amazon']),
    ]);
    const article = h('article', { class: 'cp', 'aria-labelledby': nameId }, [body,
      h('div', { class: 'perf-wrap', 'aria-hidden': 'true' }, [h('div', { class: 'perf' })]), stub]);
    return h('li', { class: 'coupon st-' + STOCKS[i % STOCKS.length], 'data-c': String(cat), 'data-r': String(i + 1),
      'data-p': String(d.pct), 'data-l': String(d.best || d.price) }, [article]);
  };

  const chip = (label, key, n, i, on) => h('button', {
    type: 'button', class: 'chip ticket st-' + STOCKS[i % STOCKS.length], 'data-cat': key, 'aria-pressed': String(on),
  }, [label + ' ', h('span', { class: 'n' }, [String(n)])]);

  /* every chip and card for a merged list, in page order */
  const page = (deals) => {
    const { cats, counts } = categories(deals);
    return {
      cats,
      chips: [chip('All', 'all', deals.length, 0, true), ...cats.map((c, i) => chip(c, String(i), counts[c], i + 1, false))],
      cards: deals.map((d, i) => card(d, i, cats.indexOf(d.category))),
    };
  };

  return { page };
};
