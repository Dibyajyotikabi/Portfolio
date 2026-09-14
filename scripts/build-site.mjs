import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  'index.html', 'projects.html', 'about.html', 'writing.html', 'contact.html',
  'styles.css', 'site.js', 'assets', 'writing', 'feed.xml', 'robots.txt', 'sitemap.xml',
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
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head><body><main class="shell hero"><h1>Page not found</h1>
<p>That page isn’t here. <a href="/">Return to my website</a> or <a href="/old-themes/">visit the old theme</a>.</p>
</main></body></html>\n`);

// The theme archive is a duplicate of the main portfolio, so keep its canonical
// pointed at the main site. Do not publish the old sitemap or editor config.
for (const entry of ['CNAME', 'robots.txt', 'admin']) {
  rmSync(path.join(dist, 'old-themes', entry), { recursive: true, force: true });
}

const archiveIndex = path.join(dist, 'old-themes/index.html');
const archiveHtml = readFileSync(archiveIndex, 'utf8');
if (!/rel="canonical" href="https:\/\/dibyajyotikabi\.com\/"/.test(archiveHtml)) {
  throw new Error('The archived theme is missing its main-site canonical.');
}
console.log('Built the clean portfolio at / and the original theme at /old-themes/.');
