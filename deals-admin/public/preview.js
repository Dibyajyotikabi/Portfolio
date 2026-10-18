/* Live previews in the editor: the real site card (built by the site's own render.js
   inside a frame that loads the site's CSS) and the Telegram post as the channel shows it. */
import { h, telegramNodes } from './ui.js';
import { postPayload, eligibility } from '/lib/format.mjs';

const SVG = 'http://www.w3.org/2000/svg';
let renderLib = null;
const loadRender = () => (renderLib ||= import('/site/deals/render.js'));

const builders = (doc) => {
  const make = (create) => (tag, attrs, kids) => {
    const el = create(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    (kids || []).filter((k) => k !== null && k !== '').forEach((k) => el.append(k));
    return el;
  };
  return { h: make((t) => doc.createElement(t)), s: make((t) => doc.createElementNS(SVG, t)) };
};

/* The frame loads once; later updates only swap the card */
export const siteCard = () => {
  const frame = h('iframe', { class: 'card-frame', src: '/preview.html', title: 'Site card preview', sandbox: 'allow-same-origin' });
  let ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  const update = async (deal, feed) => {
    await ready;
    const doc = frame.contentDocument;
    const list = doc && doc.getElementById('deals');
    if (!list) return;
    const { parseFeed, views } = await loadRender();
    const { list: clean } = parseFeed({ success: true, data: { deals: [{ ...deal, trending: feed === 'trending' }] } }, 'preview');
    if (!clean.length) {
      list.replaceChildren(doc.createTextNode('Add a name, a price and an Amazon link to see the card.'));
    } else {
      const { h: dh, s: ds } = builders(doc);
      list.replaceChildren(...views(dh, ds).page(clean).cards);
      list.querySelectorAll('a').forEach((a) => a.removeAttribute('href'));
    }
    requestAnimationFrame(() => { frame.style.height = Math.max(380, doc.documentElement.scrollHeight) + 'px'; });
  };
  const reset = () => { ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true })); };
  return { el: frame, update, reset };
};

const tgBubble = (payload) => h('div', { class: 'tg-msg' }, [
  payload.photo ? h('img', { class: 'tg-photo', src: payload.photo, alt: '', referrerpolicy: 'no-referrer' }) : null,
  h('div', { class: 'tg-text' }, telegramNodes(payload.text)),
  h('div', { class: 'tg-meta' }, [new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })]),
]);

export const telegramPost = () => {
  const el = h('div', { class: 'tg' });
  const update = (deal, settings, entry) => {
    const payload = postPayload(deal, settings);
    const why = eligibility(deal, settings);
    const status = entry
      ? h('p', { class: `tg-state ${entry.state}` }, [
        entry.state === 'posted' ? 'Posted ' : `Post ${entry.state} `,
        entry.url ? h('a', { href: entry.url, target: '_blank', rel: 'noopener' }, ['open in Telegram']) : null,
        entry.state === 'posted' && settings.editOnChange ? '. Saving and publishing edits this post.' : '',
      ])
      : h('p', { class: `tg-state ${why.ok ? 'queued' : 'off'}` }, [why.ok ? `Will post after you publish (${why.reason.toLowerCase()})` : `Not posting: ${why.reason}`]);
    const chars = payload.text.length;
    el.replaceChildren(status, h('div', { class: 'tg-chat' }, [
      tgBubble(payload),
      payload.button.url ? h('div', { class: 'tg-btn' }, [payload.button.text]) : null,
    ]), h('p', { class: 'hint' }, [`${chars} characters${payload.photo ? ' of 1024 caption limit' : ''}`]));
  };
  return { el, update };
};
