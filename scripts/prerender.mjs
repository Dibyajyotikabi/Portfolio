import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const defaultImage = 'https://dibyajyotikabi.com/portrait.jpg';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildNoindexMeta({ title, description }) {
  return `
    <title data-rh="true">${escapeHtml(title)}</title>
    <meta data-rh="true" name="description" content="${escapeHtml(description)}" />
    <meta data-rh="true" name="author" content="Dibyajyoti Kabi" />
    <meta data-rh="true" name="robots" content="noindex, nofollow" />
    <meta data-rh="true" property="og:type" content="website" />
    <meta data-rh="true" property="og:site_name" content="Dibyajyoti Kabi" />
    <meta data-rh="true" property="og:locale" content="en_IN" />
    <meta data-rh="true" property="og:title" content="${escapeHtml(title)}" />
    <meta data-rh="true" property="og:description" content="${escapeHtml(description)}" />
    <meta data-rh="true" property="og:image" content="${defaultImage}" />
    <meta data-rh="true" property="og:image:alt" content="Portrait of Dibyajyoti Kabi" />
    <meta data-rh="true" name="twitter:card" content="summary_large_image" />
    <meta data-rh="true" name="twitter:title" content="${escapeHtml(title)}" />
    <meta data-rh="true" name="twitter:description" content="${escapeHtml(description)}" />
    <meta data-rh="true" name="twitter:image" content="${defaultImage}" />
    <meta data-rh="true" name="twitter:image:alt" content="Portrait of Dibyajyoti Kabi" />
  `;
}

function injectMeta(html, metaBlock) {
  const seoRegion = /<!--\s*seo:start\s*-->[\s\S]*?<!--\s*seo:end\s*-->/;
  if (!seoRegion.test(html)) {
    throw new Error('SEO marker region was not found in dist/index.html.');
  }

  return html.replace(
    seoRegion,
    `<!-- seo:start -->${metaBlock}    <!-- seo:end -->`,
  );
}

function main() {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('dist/index.html not found. Run vite build first.');
  }

  const baseHtml = fs.readFileSync(indexPath, 'utf8');
  const notFoundHtml = injectMeta(
    baseHtml,
    buildNoindexMeta({
      title: 'Page not found | Dibyajyoti Kabi',
      description: 'The requested page could not be found.',
    }),
  );

  fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml);
  console.log('Generated the noindex 404 page.');
}

main();
