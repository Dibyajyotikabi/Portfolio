/* The Activity tab: recent GitHub runs (deploys and Telegram syncs) and a pull button
   that brings the bot's post links back into this panel. */
import { h, api, toast, when } from './ui.js';

const POLL_MS = 8000;
const isActive = (r) => r.status !== 'completed';
const label = (r) => (isActive(r) ? (r.status === 'queued' ? 'Queued' : 'Running') : r.conclusion === 'success' ? 'Done' : r.conclusion || 'Failed');
const tone = (r) => (isActive(r) ? 'run' : r.conclusion === 'success' ? 'ok' : r.conclusion === 'skipped' || r.conclusion === 'cancelled' ? 'muted' : 'bad');

const runRow = (r) => h('li', { class: 'run-row' }, [
  h('span', { class: `status ${tone(r)}`, title: label(r) }),
  h('div', { class: 'grow' }, [h('b', {}, [r.workflowName]), h('small', {}, [r.displayTitle])]),
  h('span', { class: `chip ${tone(r)}` }, [label(r)]),
  h('small', { class: 'when' }, [when(r.createdAt)]),
  h('a', { href: r.url, target: '_blank', rel: 'noopener' }, ['Logs']),
]);

export const createActivityTab = ({ onChange, onRuns }) => {
  let timer = 0;
  const list = h('ol', { class: 'runs' }, [h('li', { class: 'hint' }, ['Loading runs'])]);
  const pullBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => pull() }, ['Pull latest from GitHub']);
  const el = h('section', { class: 'tab-activity' }, [
    h('section', { class: 'card' }, [
      h('div', { class: 'row' }, [h('h4', { class: 'grow' }, ['Recent runs']), pullBtn,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => load() }, ['Refresh'])]),
      h('p', { class: 'hint' }, ['Publishing starts "Deploy to GitHub Pages". When it finishes, "Telegram deals" posts to the channel and saves the post links back to the repo.']),
      list,
    ]),
  ]);

  const load = async () => {
    clearTimeout(timer);
    try {
      const runs = await api('GET', '/api/runs');
      list.replaceChildren(...(runs.length ? runs.map(runRow) : [h('li', { class: 'hint' }, ['No runs yet.'])]));
      onRuns(runs);
      if (runs.some(isActive)) timer = setTimeout(load, POLL_MS);
    } catch (err) {
      list.replaceChildren(h('li', { class: 'hint bad' }, [`Could not read GitHub runs: ${err.message}`]));
    }
  };
  const pull = async () => {
    pullBtn.disabled = true;
    try {
      const state = await api('POST', '/api/refresh');
      toast(state.result.pulled ? 'Up to date with GitHub.' : `Not pulled: ${state.result.reason}.`, state.result.pulled ? 'ok' : 'error');
      onChange(state);
    } catch (err) { toast(err.message, 'error'); } finally { pullBtn.disabled = false; }
  };
  return { el, load };
};
