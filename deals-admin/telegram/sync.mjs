/* Runs in GitHub Actions after each deploy (.github/workflows/telegram.yml).
   Posts new live deals to the Telegram channel, edits posts whose deal changed and
   ends or deletes posts whose deal left the site. Every result is saved to
   deals-admin/data/posted.json, so a deal is never posted twice.

   node deals-admin/telegram/sync.mjs          run it
   node deals-admin/telegram/sync.mjs --dry    print the plan, call nothing

   Needs TELEGRAM_BOT_TOKEN. TELEGRAM_CHAT_ID is used when settings have no chat. */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFeed, liveDeals, FEEDS } from '../lib/deals.mjs';
import { mergeSettings, planSync, messageLink, endedText } from './format.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEALS_DIR = path.join(ROOT, 'Clean Portfolio/deals');
const DATA_DIR = path.join(ROOT, 'deals-admin/data');
const LEDGER = path.join(DATA_DIR, 'posted.json');
const GAP_MS = 3000;
const MAX_RETRIES = 3;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const isDry = process.argv.includes('--dry');
const redact = (msg) => (TOKEN ? String(msg).split(TOKEN).join('***') : String(msg));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

class TelegramError extends Error {
  constructor(method, body) {
    super(`${method}: ${body.description || 'unknown error'}`);
    this.code = body.error_code;
  }
}

const call = async (method, params, attempt = 0) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    signal: AbortSignal.timeout(30000),
  }).catch((err) => { throw new Error(redact(`${method}: ${err.message}`)); });
  const body = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (body.ok) return body.result;
  const retryAfter = body.parameters?.retry_after;
  if (retryAfter && attempt < MAX_RETRIES) {
    console.log(`Telegram asked to slow down, waiting ${retryAfter}s.`);
    await wait((retryAfter + 1) * 1000);
    return call(method, params, attempt + 1);
  }
  if (/message is not modified/i.test(body.description || '')) return null;
  throw new TelegramError(method, body);
};

const keyboard = (button) => (button?.url ? { inline_keyboard: [[{ text: button.text, url: button.url }]] } : undefined);

/* sendPhoto first; when Telegram cannot fetch the Amazon image, fall back to a text post */
const send = async (chatId, payload, settings) => {
  const common = { chat_id: chatId, parse_mode: 'HTML', disable_notification: settings.silent, reply_markup: keyboard(payload.button) };
  if (payload.photo) {
    try {
      return { kind: 'photo', msg: await call('sendPhoto', { ...common, photo: payload.photo, caption: payload.text }) };
    } catch (err) {
      if (!/photo|file|URL|image/i.test(err.message)) throw err;
      console.log(`Photo failed (${redact(err.message)}), posting as text.`);
    }
  }
  const msg = await call('sendMessage', { ...common, text: payload.text, link_preview_options: { is_disabled: true } });
  return { kind: 'text', msg };
};

const edit = async (entry, action) => {
  const { payload } = action;
  const base = { chat_id: entry.chatId, message_id: entry.messageId, reply_markup: keyboard(payload.button) };
  if (entry.kind === 'photo' && action.media) {
    return call('editMessageMedia', { ...base, media: { type: 'photo', media: payload.photo, caption: payload.text, parse_mode: 'HTML' } });
  }
  if (entry.kind === 'photo') return call('editMessageCaption', { ...base, caption: payload.text, parse_mode: 'HTML' });
  return call('editMessageText', { ...base, text: payload.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
};

const end = (entry, text) => {
  const base = { chat_id: entry.chatId, message_id: entry.messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } };
  return entry.kind === 'photo' ? call('editMessageCaption', { ...base, caption: text }) : call('editMessageText', { ...base, text });
};

/* Runs one action and returns the new ledger entry for that deal */
const run = async (action, entry, chatId, settings) => {
  const now = new Date().toISOString();
  if (action.type === 'post') {
    const { kind, msg } = await send(chatId, action.payload, settings);
    return { messageId: msg.message_id, chatId: msg.chat.id, kind, fp: action.fp, photo: kind === 'photo' ? action.payload.photo : null,
      text: action.payload.text, url: messageLink(msg.chat, msg.message_id), postedAt: now, updatedAt: now, state: 'posted' };
  }
  if (action.type === 'edit') {
    await edit(entry, action);
    return { ...entry, fp: action.fp, text: action.payload.text, photo: action.media ? action.payload.photo : entry.photo, updatedAt: now };
  }
  if (action.type === 'end') {
    await end(entry, action.text);
    return { ...entry, text: action.text, updatedAt: now, state: 'ended' };
  }
  try {
    await call('deleteMessage', { chat_id: entry.chatId, message_id: entry.messageId });
    return { ...entry, updatedAt: now, state: 'deleted' };
  } catch (err) {
    /* Telegram only lets bots delete posts for 48 hours, so older ones are marked ended */
    if (!/can't be deleted/i.test(err.message)) throw err;
    const text = endedText(entry.text || '');
    await end(entry, text);
    return { ...entry, text, updatedAt: now, state: 'ended' };
  }
};

const loadLedger = () => {
  try { return readJson(LEDGER); } catch (err) {
    if (err.code === 'ENOENT') return { posts: {} };
    throw new Error(`posted.json is not valid JSON: ${err.message}`);
  }
};
const saveLedger = (ledger) => writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + '\n');

const describe = (a) => `${a.type.padEnd(6)} ${a.id}${a.payload ? '  ' + a.payload.text.split('\n')[0].replace(/<[^>]+>/g, '') : ''}`;

const main = async () => {
  const settings = mergeSettings(readJson(path.join(DATA_DIR, 'telegram.json')));
  const feed = (name) => checkFeed(readJson(path.join(DEALS_DIR, FEEDS[name].file)), FEEDS[name].file);
  const deals = liveDeals(feed('main'), feed('trending'));
  const chatId = settings.chatId || process.env.TELEGRAM_CHAT_ID || '';
  let ledger = loadLedger();
  const plan = planSync(deals, ledger.posts, settings);
  console.log(`${deals.length} live deals, ${Object.keys(ledger.posts).length} in the ledger, ${plan.length} Telegram changes.`);
  plan.forEach((a) => console.log('  ' + describe(a)));
  if (isDry || !plan.length) return 0;
  if (!settings.enabled) { console.log('Auto-post is off in deals-admin/data/telegram.json.'); return 0; }
  if (!TOKEN || !chatId) { console.warn('::warning::TELEGRAM_BOT_TOKEN or the chat id is missing, so nothing was sent.'); return 0; }

  let failed = 0;
  for (const action of plan) {
    try {
      const entry = await run(action, ledger.posts[action.id], chatId, settings);
      ledger = { ...ledger, posts: { ...ledger.posts, [action.id]: entry }, updatedAt: new Date().toISOString() };
      saveLedger(ledger);
      console.log(`done   ${action.type} ${action.id}${entry.url ? '  ' + entry.url : ''}`);
    } catch (err) {
      failed++;
      console.error(`::error::${action.type} ${action.id} failed: ${redact(err.message)}`);
      if (err.code === 401 || /chat not found|not enough rights|bot is not a member/i.test(err.message)) break;
    }
    await wait(GAP_MS);
  }
  return failed ? 1 : 0;
};

main().then((code) => { process.exitCode = code; }).catch((err) => {
  console.error(`::error::Telegram sync stopped: ${redact(err.message)}`);
  process.exitCode = 1;
});
