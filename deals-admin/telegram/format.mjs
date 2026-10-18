/* Turns a deal into a Telegram post and works out what has to change in the channel.
   Pure functions only: the CI sync (sync.mjs), the admin panel preview and the tests
   all use this file, so a post looks the same everywhere it is shown. */
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  chatId: '',
  postSince: '',
  withPhoto: true,
  silent: false,
  editOnChange: true,
  onRemove: 'mark',
  skipTelegramSourced: true,
  maxPerRun: 10,
  buttonText: 'Buy on Amazon',
  footer: 'More checked deals: https://dibyajyotikabi.com/deals/',
});

export const ON_REMOVE = ['mark', 'delete', 'keep'];
const CAPTION_LIMIT = 1024;
const TEXT_LIMIT = 4096;
const TRIM_STEP = 40;
const ENDED_PREFIX = '❌ <b>Deal ended</b>\n\n';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

const EMOJI = [
  [/phone|mobile|smartphone/i, '📱'], [/audio|earbud|headphone|speaker|sound/i, '🎧'],
  [/monitor|gaming/i, '🖥️'], [/laptop|computer|tablet/i, '💻'], [/watch|wearable|fitness/i, '⌚'],
  [/power|charg|cable|battery/i, '🔋'], [/tv|television/i, '📺'], [/camera/i, '📷'],
  [/kitchen|home|appliance/i, '🏠'], [/beauty|grooming|personal/i, '🪒'],
];
const emojiFor = (category) => (EMOJI.find(([re]) => re.test(category || '')) || [null, '🛍️'])[1];

export const mergeSettings = (saved) => ({ ...DEFAULT_SETTINGS, ...(saved || {}) });

/* Bigger than the site's 400px card image, small enough to load fast in the app */
const photoUrl = (url) => (url ? String(url).replace(/\._[A-Z]{2}\d+_\./, '._SL1000_.') : null);

const priceBlock = (d) => {
  const mrp = Number(d.mrp), price = Number(d.price), best = Number(d.best);
  const drop = mrp > price ? ` <s>${rupees(mrp)}</s> · ${Math.round(((mrp - price) / mrp) * 100)}% off` : '';
  const bestLine = best > 0 && best < price ? `\n🔥 <b>${rupees(best)}</b> with bank and coupon offers` : '';
  return `<blockquote>💰 <b>${rupees(price)}</b>${drop}${bestLine}</blockquote>`;
};

/* A deal's own Telegram text (set in the admin panel) replaces the bullet notes */
const bodyLines = (d, notes) => {
  if (d.telegramText) return ['', esc(d.telegramText)];
  return [
    ...(notes.length ? ['', ...notes.map((n) => `• ${esc(n)}`)] : []),
    ...(d.rating && !notes.some((n) => /rated/i.test(n)) ? ['', `⭐ ${Number(d.rating)} on Amazon`] : []),
  ];
};

const assemble = (d, notes, footer) => [
  `${emojiFor(d.category)} <b>${esc(d.fullName && d.fullName.length <= 90 ? d.fullName : d.name)}</b>`,
  '',
  priceBlock(d),
  ...bodyLines(d, notes),
  ...(footer ? ['', esc(footer)] : []),
].join('\n');

/* The post body, trimmed note by note until it fits Telegram's caption or text limit
   (with room left for the "Deal ended" line that may be added later). */
export const postText = (deal, settings) => {
  const s = mergeSettings(settings);
  const limit = (s.withPhoto && deal.image ? CAPTION_LIMIT : TEXT_LIMIT) - ENDED_PREFIX.length;
  let notes = (Array.isArray(deal.notes) ? deal.notes : []).map(String).filter(Boolean).slice(0, 4);
  let text = assemble(deal, notes, s.footer);
  while (text.length > limit && notes.length) {
    notes = notes.slice(0, -1);
    text = assemble(deal, notes, s.footer);
  }
  /* only a very long custom text gets here; shorten the raw text, so tags and escapes stay whole */
  let custom = String(deal.telegramText || '');
  while (text.length > limit && custom) {
    custom = custom.slice(0, -TRIM_STEP).trimEnd();
    text = assemble({ ...deal, telegramText: custom ? `${custom}...` : '' }, [], s.footer);
  }
  return text;
};

export const postPayload = (deal, settings) => {
  const s = mergeSettings(settings);
  return {
    text: postText(deal, s),
    photo: s.withPhoto ? photoUrl(deal.image) : null,
    button: { text: s.buttonText || DEFAULT_SETTINGS.buttonText, url: deal.buyUrl },
  };
};

export const endedText = (text) => (text.startsWith(ENDED_PREFIX) ? text : ENDED_PREFIX + text);

/* FNV-1a over the payload, so an edit is sent only when the post would actually change */
export const fingerprint = (payload) => {
  let h = 0x811c9dc5;
  const str = JSON.stringify(payload);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

const isTelegramSourced = (d) => /^https:\/\/t\.me\//.test(String(d.post || ''));

/* Why a deal will or will not be posted. Shown in the admin panel next to each deal. */
export const eligibility = (deal, settings) => {
  const s = mergeSettings(settings);
  if (!s.enabled) return { ok: false, reason: 'Auto-post is off in settings' };
  if (deal.telegram === false) return { ok: false, reason: 'Turned off for this deal' };
  if (deal.telegram === true) return { ok: true, reason: 'Turned on for this deal' };
  if (s.skipTelegramSourced && isTelegramSourced(deal)) return { ok: false, reason: 'Already came from a Telegram post' };
  const since = Date.parse(s.postSince);
  if (since && !(Date.parse(deal.date) >= since)) return { ok: false, reason: 'Older than the "post deals from" date' };
  return { ok: true, reason: 'New deal' };
};

const editAction = (deal, entry, payload, fp) => ({
  type: 'edit', id: deal.id, payload, fp,
  media: entry.kind === 'photo' && payload.photo && payload.photo !== entry.photo,
});

const removeAction = (id, entry, mode) => (mode === 'delete'
  ? { type: 'delete', id }
  : { type: 'end', id, text: endedText(entry.text || '') });

/* Compares the deals on the site with what is already in the channel and returns the
   Telegram calls to make: post new deals, edit changed ones, end or delete removed ones. */
export const planSync = (deals, ledger, settings) => {
  const s = mergeSettings(settings);
  const posted = ledger || {};
  const live = new Set(deals.map((d) => d.id));
  const posts = [], edits = [], removals = [];
  for (const deal of deals) {
    const entry = posted[deal.id];
    const payload = postPayload(deal, s);
    const fp = fingerprint(payload);
    if (!entry) {
      if (eligibility(deal, s).ok) posts.push({ type: 'post', id: deal.id, payload, fp, date: Date.parse(deal.date) || 0 });
    } else if (entry.state === 'posted' && deal.telegram === false && s.onRemove !== 'keep') {
      removals.push(removeAction(deal.id, entry, s.onRemove));
    } else if (entry.state === 'posted' && s.editOnChange && entry.fp !== fp) {
      edits.push(editAction(deal, entry, payload, fp));
    }
  }
  for (const [id, entry] of Object.entries(posted)) {
    if (!live.has(id) && entry.state === 'posted' && s.onRemove !== 'keep') removals.push(removeAction(id, entry, s.onRemove));
  }
  const max = Math.max(1, Math.min(50, Number(s.maxPerRun) || DEFAULT_SETTINGS.maxPerRun));
  const queued = posts.sort((a, b) => a.date - b.date).slice(0, max);
  return [...queued, ...edits, ...removals];
};

/* Public link to a channel message, from the chat Telegram returns with each send */
export const messageLink = (chat, messageId) => {
  if (chat && chat.username) return `https://t.me/${chat.username}/${messageId}`;
  const id = String(chat && chat.id || '');
  return id.startsWith('-100') ? `https://t.me/c/${id.slice(4)}/${messageId}` : '';
};
