/* Small DOM and API helpers shared by every panel script. Text always goes in through
   text nodes, so deal names and notes can never turn into HTML. */
export const $ = (sel, root = document) => root.querySelector(sel);

export const h = (tag, attrs = {}, kids = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of [].concat(kids)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
};

export const rupees = (n) => (Number(n) > 0 ? '₹' + Number(n).toLocaleString('en-IN') : '');

export const when = (t) => {
  const ms = Date.parse(t);
  if (!ms) return '';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  if (mins < 10080) return `${Math.round(mins / 1440)}d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/* Every call returns data or throws an Error carrying the server's message */
export const api = async (method, url, body) => {
  const res = await fetch(url, {
    method, headers: { 'X-Admin': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { throw new Error('The admin server is not running. Start it with npm run admin.'); });
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
};

const TOAST_MS = 3200;
export const toast = (message, kind = 'ok') => {
  const box = $('#toasts');
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, [message]);
  box.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, kind === 'error' ? TOAST_MS * 2 : TOAST_MS);
};

/* A promise-based confirm built on <dialog>, since browser confirm() blocks the page */
export const ask = (title, text, okLabel = 'Confirm', isDanger = false) => new Promise((resolve) => {
  const dlg = h('dialog', { class: 'ask' }, [
    h('h3', {}, [title]), h('p', {}, [text]),
    h('div', { class: 'row end' }, [
      h('button', { class: 'btn ghost', value: 'no', onclick: () => dlg.close('no') }, ['Cancel']),
      h('button', { class: `btn ${isDanger ? 'danger' : 'primary'}`, onclick: () => dlg.close('yes') }, [okLabel]),
    ]),
  ]);
  dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
  document.body.append(dlg);
  dlg.showModal();
});

/* Turns the small HTML set our Telegram posts use into nodes, dropping anything else */
const TG_TAGS = new Set(['B', 'S', 'I', 'BLOCKQUOTE']);
export const telegramNodes = (html) => {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const copy = (node) => {
    /* a quote is already a block, so the first line break after it would add an extra empty line */
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      if (node.previousSibling?.tagName === 'BLOCKQUOTE') text = text.replace(/^\n/, '');
      return document.createTextNode(text);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const kids = [...node.childNodes].map(copy).filter(Boolean);
    if (!TG_TAGS.has(node.tagName)) return kids;
    return h(node.tagName.toLowerCase(), {}, kids);
  };
  return [...doc.body.firstChild.childNodes].flatMap((n) => copy(n) || []);
};

export const debounce = (fn, ms) => {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
