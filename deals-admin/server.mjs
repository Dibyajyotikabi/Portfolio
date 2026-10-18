/* The deals admin panel: npm run admin, then open http://127.0.0.1:4900
   It only listens on this computer. Requests must carry the panel's own Host and an
   X-Admin header, so other websites (and DNS rebinding) cannot reach the API. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, saveDeal, deleteDeal, reorder, moveDeal, saveSettings, InputError, ROOT, DEALS_DIR } from './store.mjs';
import { pending, publish, refresh, runs, triggerTelegram, secretNames } from './git.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(ROOT, 'Clean Portfolio');
const PORT = Number(process.env.ADMIN_PORT) || 4900;
const HOST = '127.0.0.1';
const MAX_BODY = 256 * 1024;
const ALLOWED_HOSTS = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const CSP = ["default-src 'self'", "img-src 'self' data: https://m.media-amazon.com https://images-na.ssl-images-amazon.com",
  "style-src 'self' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com", "connect-src 'self'",
  "frame-ancestors 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"].join('; ');

/* Panel files, plus the two shared modules the browser imports */
const STATIC = {
  '/': 'public/index.html', '/admin.css': 'public/admin.css', '/app.js': 'public/app.js', '/ui.js': 'public/ui.js',
  '/editor.js': 'public/editor.js', '/list.js': 'public/list.js', '/settings.js': 'public/settings.js', '/activity.js': 'public/activity.js', '/preview.js': 'public/preview.js',
  '/lib/format.mjs': 'telegram/format.mjs', '/lib/deals.mjs': 'lib/deals.mjs',
};

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CSP, 'Referrer-Policy': 'no-referrer' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const ok = (res, data) => send(res, 200, { success: true, data, error: null });
const fail = (res, status, error) => send(res, status, { success: false, data: null, error });

const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) { reject(new InputError('Request is too large')); req.destroy(); } else chunks.push(c);
  });
  req.on('end', () => {
    if (!size) return resolve({});
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new InputError('Request is not valid JSON')); }
  });
  req.on('error', reject);
});

/* A small page with the site's own CSS and sprite, so the card preview is the real card */
const previewPage = () => {
  const html = readFileSync(path.join(DEALS_DIR, 'index.html'), 'utf8');
  const sprite = (html.match(/<svg class="sprite"[\s\S]*?<\/defs>\s*<\/svg>/) || [''])[0];
  const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/) || [''])[0];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/site/styles.css">${fonts}<link rel="stylesheet" href="/site/deals/deals.css"><link rel="stylesheet" href="/preview.css">
</head><body><main class="dz">${sprite}<section class="deals-sec"><div class="wrap"><ol class="deals" id="deals"></ol></div></section></main></body></html>`;
};

/* Read-only files from the site folder, for the preview. No dot files, no escaping the folder. */
const siteFile = (urlPath) => {
  const rel = decodeURIComponent(urlPath.slice('/site/'.length));
  const file = path.resolve(SITE_DIR, rel);
  const isInside = file.startsWith(SITE_DIR + path.sep) && !rel.split('/').some((p) => p.startsWith('.'));
  if (!isInside || !TYPES[path.extname(file)] || path.extname(file) === '.html') return null;
  return file;
};

const serveFile = (res, file) => {
  try { send(res, 200, readFileSync(file), TYPES[path.extname(file)]); } catch (err) {
    if (err.code === 'ENOENT') return fail(res, 404, 'Not found');
    throw err;
  }
};

const state = async () => ({ ...readState(), pending: await pending() });

const API = {
  'GET /api/state': () => state(),
  'PUT /api/deal': async (b) => ({ deal: saveDeal(b), ...(await state()) }),
  'DELETE /api/deal': async (b) => { deleteDeal(b); return state(); },
  'PUT /api/order': async (b) => { reorder(b); return state(); },
  'POST /api/move': async (b) => { moveDeal(b); return state(); },
  'PUT /api/settings': async (b) => { saveSettings(b.settings); return state(); },
  'POST /api/publish': async (b) => ({ result: await publish(b.message), ...(await state()) }),
  'POST /api/refresh': async () => ({ result: await refresh(), ...(await state()) }),
  'GET /api/runs': () => runs(),
  'GET /api/secrets': () => secretNames(),
  'POST /api/telegram/run': async (b) => { await triggerTelegram(b.dry === true); return { started: true }; },
};

const handleApi = async (req, res, key) => {
  if (req.headers['x-admin'] !== '1') return fail(res, 403, 'Missing admin header');
  const isWrite = req.method !== 'GET';
  if (isWrite && !String(req.headers['content-type'] || '').startsWith('application/json')) return fail(res, 415, 'Send JSON');
  try {
    const body = isWrite ? await readBody(req) : {};
    ok(res, await API[key](body));
  } catch (err) {
    if (err instanceof InputError) return fail(res, 400, err.message);
    console.error(`${key} failed:`, err);
    fail(res, 500, err.message || 'Something went wrong');
  }
};

const handle = (req, res) => {
  if (!ALLOWED_HOSTS.has(req.headers.host || '')) return fail(res, 421, 'Open the panel at http://127.0.0.1:' + PORT);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = `${req.method} ${url.pathname}`;
  if (API[key]) return handleApi(req, res, key);
  if (req.method !== 'GET') return fail(res, 405, 'Method not allowed');
  if (url.pathname === '/preview.html') return send(res, 200, previewPage(), TYPES['.html']);
  if (url.pathname === '/preview.css') return serveFile(res, path.join(HERE, 'public/preview.css'));
  if (STATIC[url.pathname]) return serveFile(res, path.join(HERE, STATIC[url.pathname]));
  if (url.pathname.startsWith('/site/')) {
    const file = siteFile(url.pathname);
    return file ? serveFile(res, file) : fail(res, 404, 'Not found');
  }
  fail(res, 404, 'Not found');
};

createServer((req, res) => {
  try { handle(req, res); } catch (err) {
    console.error('Request failed:', err);
    if (!res.headersSent) fail(res, 500, 'Something went wrong');
  }
}).on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Run with ADMIN_PORT=4901 npm run admin` : err.message);
  process.exit(1);
}).listen(PORT, HOST, () => console.log(`Deals admin is running at http://${HOST}:${PORT}`));
