import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const source = path.join(root, 'Clean Portfolio');

// Keep the original React portfolio available as a fully working old theme.
rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, [
  path.join(root, 'node_modules/vite/bin/vite.js'),
  'build', '--outDir', 'dist/old-themes',
], { cwd: root, stdio: 'inherit' });

// Only public portfolio files belong in the Pages artifact.
for (const entry of [
  'index.html', 'projects.html', 'about.html', 'writing.html', 'contact.html', 'ebooks',
  'terms.html', 'privacy.html', 'refund-policy.html',
  'styles.css', 'site.js', 'sw.js', 'assets', 'writing', 'feed.xml', 'robots.txt', 'sitemap.xml',
  'favicon.ico', 'site.webmanifest',
  '827e7df31e49331a435d8b7a0f6416fb.txt',
]) {
  cpSync(path.join(source, entry), path.join(dist, entry), { recursive: true });
}
cpSync(path.join(root, 'public/CNAME'), path.join(dist, 'CNAME'));
writeFileSync(path.join(dist, '.nojekyll'), '');

// Preserve the old public portrait URL used by existing social previews.
cpSync(path.join(root, 'public/portrait.jpg'), path.join(dist, 'portrait.jpg'));

// GitHub Pages serves this document with a real 404 status for unknown paths.
writeFileSync(path.join(dist, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Page not found — Dibyajyoti Kabi</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="icon" href="/assets/favicon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/styles.css">
</head><body><main class="shell hero"><h1>Page not found</h1>
<p>That page isn’t here. <a href="/">Return to my website</a> or <a href="/old-themes/">visit the old theme</a>.</p>
</main></body></html>\n`);

// The theme archive is a duplicate of the main portfolio, so keep its canonical
// pointed at the main site. Do not publish the old sitemap or editor config.
for (const entry of ['CNAME', 'robots.txt', 'admin']) {
  rmSync(path.join(dist, 'old-themes', entry), { recursive: true, force: true });
}

// A ?v= stamp has to change whenever the file it names changes. Hand-edited
// numbers had drifted: site.js was fixed while every page still asked for
// ?v=34, so browsers and the service worker kept serving the old script and the
// fix reached nobody. Deriving the stamp from the file removes that failure for
// good — the URL changes exactly when, and only when, the bytes do.
const stamp = (file) =>
  createHash('sha256').update(readFileSync(path.join(dist, file))).digest('hex').slice(0, 10);
const versions = { 'site.js': stamp('site.js'), 'styles.css': stamp('styles.css') };
for (const page of [
  'index.html', 'projects.html', 'about.html', 'writing.html', 'contact.html',
  'writing/core-web-vitals-on-live-newsrooms.html',
  'writing/hermes-runbooks-for-editorial-teams.html',
  'writing/scaling-wordpress-past-10m-pageviews.html',
  'ebooks/index.html', 'ebooks/blog-to-paycheck.html', 'ebooks/thank-you.html',
  'terms.html', 'privacy.html', 'refund-policy.html',
]) {
  const file = path.join(dist, page);
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replace(/\b(site\.js|styles\.css)\?v=[\w.-]+/g,
    (_, name) => `${name}?v=${versions[name]}`));
}
// Ebook prices are in rupees. price.js shows visitors abroad an approximate
// local price from these rates, fetched once per deploy so the page never
// calls a third-party host. If the fetch fails, pages simply stay in rupees.
try {
  const res = await fetch('https://open.er-api.com/v6/latest/INR', { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (data.result !== 'success') throw new Error(data['error-type'] || 'no rates');
  writeFileSync(path.join(dist, 'ebooks/rates.json'),
    JSON.stringify({ base: 'INR', updated: data.time_last_update_utc, rates: data.rates }));
  console.log(`Saved INR exchange rates from ${data.time_last_update_utc}.`);
} catch (error) {
  console.warn(`Skipped exchange rates (${error.message}); ebook prices will show in rupees only.`);
}

// A store page must never ship a Buy button that goes nowhere.
for (const page of ['ebooks/index.html', 'ebooks/blog-to-paycheck.html']) {
  if (readFileSync(path.join(dist, page), 'utf8').includes('REPLACE_WITH_CHECKOUT_URL')) {
    throw new Error(`${page} still has the placeholder checkout link. Paste the real Dodo (or other) checkout URL first.`);
  }
}
console.log(`Stamped site.js?v=${versions['site.js']} styles.css?v=${versions['styles.css']}.`);

const archiveIndex = path.join(dist, 'old-themes/index.html');
let archiveHtml = readFileSync(archiveIndex, 'utf8');
if (!/rel="canonical" href="https:\/\/dibyajyotikabi\.com\/"/.test(archiveHtml)) {
  throw new Error('The archived theme is missing its main-site canonical.');
}
// The archive is a keepsake, not a destination. Without this, search engines
// keep offering the old design for the name that the current site should win.
archiveHtml = archiveHtml.replace(/<meta\s[^>]*name="robots"[^>]*>/i, (tag) =>
  tag.replace(/content="[^"]*"/i, 'content="noindex, follow"'));
if (!/name="robots"\s+content="noindex, follow"/.test(archiveHtml) &&
    !/content="noindex, follow"\s+name="robots"/.test(archiveHtml)) {
  throw new Error('The archived theme could not be marked noindex.');
}
writeFileSync(archiveIndex, archiveHtml);
console.log('Built the clean portfolio at / and the original theme at /old-themes/.');
