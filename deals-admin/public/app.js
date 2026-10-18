/* Wires the panel together: tabs, the publish flow, keyboard shortcuts and the editor. */
import { $, h, api, toast } from './ui.js';
import { createDealsTab } from './list.js';
import { createTelegramTab } from './settings.js';
import { createActivityTab } from './activity.js';
import { openEditor } from './editor.js';

const TABS = ['deals', 'telegram', 'activity'];
const TELEGRAM_WORKFLOW = 'Telegram deals';
const FALLBACK_TAG = 'wwwbestdeal0d-21';
const FILE_LABELS = { 'deals.json': 'Deals list', 'trending.json': 'Trending list', 'telegram.json': 'Telegram settings' };

let model = null;
const activeRuns = new Set();

/* The affiliate tag most deals already use, so new links match the rest of the site */
const defaultTag = () => {
  const counts = {};
  for (const f of Object.values(model.feeds)) for (const d of f.deals) {
    const tag = (String(d.buyUrl).match(/[?&]tag=([^&]+)/) || [])[1];
    if (tag) counts[tag] = (counts[tag] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || FALLBACK_TAG;
};

const editorCtx = () => ({
  settings: model.settings, ledger: model.ledger, defaultTag: defaultTag(),
  onChange: setState, onDuplicate: (deal, feed) => openEditor({ deal, feed, isNew: true }, editorCtx()),
});
const blankDeal = () => ({ id: '', name: '', notes: [], date: new Date().toISOString(), atLow: false, confirmed: true });

const deals = createDealsTab({
  onOpen: (row) => openEditor({ deal: row.deal, feed: row.feed, isNew: false }, editorCtx()),
  onNew: (feed) => openEditor({ deal: blankDeal(), feed, isNew: true }, editorCtx()),
  onChange: (state) => (state ? setState(state) : load()),
});
const telegram = createTelegramTab({ onChange: setState });
const activity = createActivityTab({ onChange: setState, onRuns: showRuns });
const panels = { deals, telegram, activity };

function setState(state) {
  model = state;
  const count = model.pending.length;
  $('#pending').textContent = count ? `${count} unpublished` : 'All live';
  $('#pending').className = `pill ${count ? 'warn' : 'ok'}`;
  $('#cats').replaceChildren(...[...new Set(Object.values(model.feeds).flatMap((f) => f.deals.map((d) => d.category)).filter(Boolean))].sort().map((c) => h('option', { value: c })));
  deals.update(model);
  telegram.update(model);
}

/* Shows deploy progress in the top bar and pulls the bot's post links once a Telegram run ends */
function showRuns(runs) {
  const running = runs.filter((r) => r.status !== 'completed');
  const pill = $('#deploy');
  pill.hidden = !running.length;
  pill.textContent = running.length ? `${running[0].workflowName}: ${running[0].status === 'queued' ? 'queued' : 'running'}` : '';
  const finished = runs.filter((r) => activeRuns.has(r.databaseId) && r.status === 'completed');
  activeRuns.clear();
  running.forEach((r) => activeRuns.add(r.databaseId));
  finished.forEach((r) => toast(`${r.workflowName} ${r.conclusion === 'success' ? 'finished' : `ended: ${r.conclusion}`}.`, r.conclusion === 'success' ? 'ok' : 'error'));
  const isTelegramDone = finished.some((r) => r.workflowName === TELEGRAM_WORKFLOW && r.conclusion === 'success');
  if (isTelegramDone && model && !model.pending.length) api('POST', '/api/refresh').then(setState).catch((err) => toast(err.message, 'error'));
}

const showTab = (name) => {
  const tab = TABS.includes(name) ? name : 'deals';
  for (const t of TABS) {
    panels[t].el.hidden = t !== tab;
    $(`[data-tab="${t}"]`).setAttribute('aria-selected', String(t === tab));
  }
  if (tab === 'telegram') telegram.show();
  if (tab === 'activity') activity.load();
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
};

const publishDialog = () => {
  const files = model.pending.map((p) => FILE_LABELS[p.split('/').pop()] || p);
  const msg = h('input', { name: 'message', value: 'Update deals', maxlength: '100', 'aria-label': 'What changed' });
  const go = h('button', { class: 'btn primary', type: 'submit' }, ['Publish']);
  const dlg = h('dialog', { class: 'ask publish' }, [h('form', { method: 'dialog' }, [
    h('h3', {}, ['Publish to dibyajyotikabi.com']),
    h('p', {}, ['These go live: ', files.join(', '), '.']),
    h('label', { class: 'field' }, [h('span', { class: 'lbl' }, ['What changed']), msg]),
    h('p', { class: 'hint' }, [model.settings.enabled
      ? 'The site updates in about a minute. New deals go to the Telegram channel right after.'
      : 'Auto-post is off, so nothing is sent to Telegram.']),
    h('div', { class: 'row end' }, [h('button', { class: 'btn ghost', type: 'button', onclick: () => dlg.close() }, ['Cancel']), go]),
  ])]);
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    go.disabled = true;
    go.textContent = 'Publishing';
    try {
      const state = await api('POST', '/api/publish', { message: msg.value });
      toast(`Published ${state.result.commit}. Deploy started.`);
      setState(state);
      dlg.close();
      setTimeout(() => activity.load(), 4000);
    } catch (err) { toast(err.message, 'error'); go.disabled = false; go.textContent = 'Publish'; }
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  msg.select();
};

const isTyping = (e) => e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.shade, dialog[open]');
const onKey = (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
  if (e.key === '/') { e.preventDefault(); showTab('deals'); deals.focusSearch(); }
  if (e.key === 'n') { e.preventDefault(); showTab('deals'); openEditor({ deal: blankDeal(), feed: 'main', isNew: true }, editorCtx()); }
  if (['1', '2', '3'].includes(e.key)) showTab(TABS[Number(e.key) - 1]);
};

async function load() {
  try { setState(await api('GET', '/api/state')); } catch (err) {
    toast(err.message, 'error');
    $('#view').replaceChildren(h('div', { class: 'empty' }, [h('p', {}, [`Could not load the deals: ${err.message}`])]));
  }
}

const start = async () => {
  $('#view').replaceChildren(...TABS.map((t) => panels[t].el));
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#publish').addEventListener('click', publishDialog);
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
  window.addEventListener('beforeunload', (e) => { if (document.querySelector('.shade') || telegram.isDirty()) e.preventDefault(); });
  document.addEventListener('keydown', onKey);
  await load();
  showTab(location.hash.slice(1));
  if (location.hash !== '#activity') activity.load();
};

start();
