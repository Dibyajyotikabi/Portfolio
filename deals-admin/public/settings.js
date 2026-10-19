/* The Telegram tab: auto-post settings, a live sample post, a setup checklist,
   manual sync buttons and every post the bot has made. */
import { h, api, toast, when } from './ui.js';
import { telegramPost } from './preview.js';
import { liveDeals } from '/lib/deals.mjs';

const REMOVE_OPTIONS = [
  ['mark', 'Mark it "Deal ended"', 'The post stays, with a "Deal ended" line on top and no buy button'],
  ['delete', 'Delete the post', 'Bots can only delete posts younger than 48 hours; older ones get marked instead'],
  ['keep', 'Leave it alone', 'The post stays exactly as it was'],
];

const toLocal = (iso) => {
  const ms = Date.parse(iso);
  return ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
};

const toggle = (name, label, hint) => h('label', { class: 'toggle' }, [
  h('input', { type: 'checkbox', name, role: 'switch' }), h('span', { class: 'track', 'aria-hidden': 'true' }),
  h('span', { class: 'tlabel' }, [h('b', {}, [label]), hint ? h('small', {}, [hint]) : null]),
]);
const field = (label, input, hint) => h('label', { class: 'field' }, [h('span', { class: 'lbl' }, [label]), input, hint ? h('span', { class: 'hint' }, [hint]) : null]);

const settingsForm = () => h('form', { class: 'card settings', novalidate: true }, [
  h('h4', {}, ['Auto-post']),
  toggle('enabled', 'Post new deals to the channel', 'Runs on GitHub right after each deploy of the site'),
  field('Channel', h('input', { name: 'chatId', placeholder: '@dealsoperator or -1001234567890', autocomplete: 'off', spellcheck: 'false' }),
    'Leave empty to use the TELEGRAM_CHAT_ID secret. The bot must be an admin of this channel.'),
  field('Post deals found after', h('input', { name: 'postSince', type: 'datetime-local' }), 'Older deals already on the site are skipped, so turning this on does not flood the channel.'),
  field('New posts per deploy', h('input', { name: 'maxPerRun', type: 'number', min: '1', max: '50', step: '1', inputmode: 'numeric' }), 'Extra deals wait for the next deploy.'),
  field('Post one deal every (minutes)', h('input', { name: 'postEveryMinutes', type: 'number', min: '0', max: '1440', step: '5', inputmode: 'numeric' }),
    'GitHub checks every 30 minutes and posts the oldest waiting deal. 0 posts them all right after a deploy.'),
  h('h4', {}, ['Post style']),
  toggle('withPhoto', 'Send with the product photo', 'Captions are limited to 1024 characters'),
  toggle('silent', 'Send silently', 'Subscribers get the post without a sound'),
  h('div', { class: 'grid2' }, [
    field('Button text', h('input', { name: 'buttonText', maxlength: '40' })),
    field('Footer line', h('input', { name: 'footer', maxlength: '200' }), 'Leave empty for no footer'),
  ]),
  h('h4', {}, ['Changes']),
  toggle('editOnChange', 'Edit posts when I change a deal', 'Price, notes or photo edits update the post that is already in the channel'),
  toggle('popularOnly', 'Only post popular deals', 'Needs proof people buy it (sales, reviews, a badge or trending), a real discount and a good rating'),
  toggle('skipTelegramSourced', 'Skip deals that came from a Telegram post', 'Deals copied from another channel are not posted again'),
  h('fieldset', { class: 'radios' }, [h('legend', {}, ['When a deal leaves the site']),
    ...REMOVE_OPTIONS.map(([v, label, hint]) => h('label', { class: 'radio' }, [h('input', { type: 'radio', name: 'onRemove', value: v }), h('span', {}, [h('b', {}, [label]), h('small', {}, [hint])])]))]),
  h('div', { class: 'row end' }, [h('span', { class: 'hint grow', id: 'settings-note' }), h('button', { class: 'btn primary', type: 'submit' }, ['Save settings'])]),
]);

const fill = (form, s) => {
  for (const el of form.elements) {
    if (!el.name || !(el.name in s)) continue;
    if (el.type === 'checkbox') el.checked = Boolean(s[el.name]);
    else if (el.type === 'radio') el.checked = el.value === s[el.name];
    else if (el.type === 'datetime-local') el.value = toLocal(s[el.name]);
    else el.value = s[el.name] ?? '';
  }
};

const read = (form, s) => {
  const e = form.elements;
  const since = e.postSince.value;
  return {
    ...s, enabled: e.enabled.checked, chatId: e.chatId.value.trim(), postSince: since ? new Date(since).toISOString() : '',
    maxPerRun: Number(e.maxPerRun.value), postEveryMinutes: Number(e.postEveryMinutes.value), withPhoto: e.withPhoto.checked, silent: e.silent.checked,
    buttonText: e.buttonText.value.trim(), footer: e.footer.value.trim(), editOnChange: e.editOnChange.checked,
    skipTelegramSourced: e.skipTelegramSourced.checked, popularOnly: e.popularOnly.checked, onRemove: e.onRemove.value,
  };
};

const step = (isDone, title, detail) => h('li', { class: isDone === null ? 'manual' : isDone ? 'done' : '' }, [h('span', { class: 'tick', 'aria-hidden': 'true' }), h('div', {}, [h('b', {}, [title]), h('small', {}, detail)])]);

const checklist = (model, secrets) => {
  const has = (n) => secrets && secrets.includes(n);
  const s = model.settings;
  return h('ol', { class: 'steps' }, [
    step(has('TELEGRAM_BOT_TOKEN'), 'Bot token saved on GitHub', ['In this terminal run ', h('code', {}, ['! gh secret set TELEGRAM_BOT_TOKEN']), ' and paste the token from @BotFather.']),
    step(Boolean(s.chatId) || has('TELEGRAM_CHAT_ID'), 'Channel picked', ['Type the channel above, or run ', h('code', {}, ['! gh secret set TELEGRAM_CHAT_ID']), '.']),
    step(null, 'Bot is a channel admin', ['In the channel: Manage channel > Administrators > Add admin, pick the bot, allow Post, Edit and Delete messages.']),
    step(s.enabled && !model.pending.length, 'Auto-post on and published', [s.enabled ? 'On. ' : 'Switch it on above, ', 'then press Publish.']),
  ]);
};

const ledgerList = (ledger) => {
  const entries = Object.entries(ledger).sort((a, b) => Date.parse(b[1].postedAt) - Date.parse(a[1].postedAt));
  if (!entries.length) return h('p', { class: 'hint' }, ['Nothing posted yet. Posts show up here after the first Telegram run.']);
  return h('ol', { class: 'ledger' }, entries.slice(0, 60).map(([id, e]) => h('li', {}, [
    h('span', { class: `chip tg-${e.state === 'posted' ? 'posted' : 'ended'}` }, [e.state]),
    h('span', { class: 'grow mono' }, [id]),
    h('small', {}, [when(e.updatedAt || e.postedAt)]),
    e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener' }, ['Open']) : null,
  ])));
};

export const createTelegramTab = ({ onChange }) => {
  let model = null, secrets = null, isDirty = false;
  const form = settingsForm();
  const sample = telegramPost();
  const stepsBox = h('div'), ledgerBox = h('div');
  const runBtn = (label, isDry) => h('button', { class: `btn ${isDry ? 'ghost' : ''}`, type: 'button', onclick: (e) => run(e.currentTarget, isDry) }, [label]);
  const el = h('section', { class: 'tab-telegram' }, [
    h('div', { class: 'col' }, [form]),
    h('div', { class: 'col side' }, [
      h('section', { class: 'card' }, [h('h4', {}, ['Setup']), stepsBox]),
      h('section', { class: 'card' }, [h('h4', {}, ['How a post looks']), sample.el]),
      h('section', { class: 'card' }, [h('h4', {}, ['Run now']),
        h('p', { class: 'hint' }, ['Uses what is live on GitHub. A dry run only lists what it would do; see the result in Activity.']),
        h('div', { class: 'row' }, [runBtn('Sync Telegram now', false), runBtn('Dry run', true)])]),
      h('section', { class: 'card' }, [h('h4', {}, ['Posts in the channel']), ledgerBox]),
    ]),
  ]);

  const showSample = () => {
    if (!model) return;
    const deals = liveDeals({ data: { deals: model.feeds.main.deals } }, { data: { deals: model.feeds.trending.deals } });
    if (deals[0]) sample.update(deals[0], read(form, model.settings), null);
  };
  const run = async (btn, isDry) => {
    btn.disabled = true;
    try { await api('POST', '/api/telegram/run', { dry: isDry }); toast(isDry ? 'Dry run started on GitHub.' : 'Telegram sync started on GitHub.'); } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
  };
  form.addEventListener('input', () => { isDirty = true; form.querySelector('#settings-note').textContent = 'Unsaved changes'; showSample(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const state = await api('PUT', '/api/settings', { settings: read(form, model.settings) });
      isDirty = false;
      toast('Settings saved. Publish to use them on the next run.');
      onChange(state);
    } catch (err) { toast(err.message, 'error'); }
  });

  const update = (next) => {
    model = next;
    if (!isDirty) { fill(form, model.settings); form.querySelector('#settings-note').textContent = ''; }
    stepsBox.replaceChildren(checklist(model, secrets));
    ledgerBox.replaceChildren(ledgerList(model.ledger));
    showSample();
  };
  const show = async () => {
    if (secrets) return;
    secrets = await api('GET', '/api/secrets').catch((err) => { toast(`Could not check GitHub secrets: ${err.message}`, 'error'); return []; });
    if (model) stepsBox.replaceChildren(checklist(model, secrets));
  };
  return { el, update, show, isDirty: () => isDirty };
};
