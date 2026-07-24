import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');
const siteUrl = 'https://dibyajyotikabi.com';

function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);

  const robots = `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${siteUrl}/sitemap.xml
`;

  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);
  console.log('Generated sitemap with 1 URL.');
}

main();
