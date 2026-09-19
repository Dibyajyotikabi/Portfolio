#!/usr/bin/env node
/**
 * Put the apex behind Cloudflare and give it the security headers GitHub Pages
 * cannot set. Safe by default: prints the plan and changes nothing unless
 * --execute is passed.
 *
 *   CLOUDFLARE_API_TOKEN=... node cloudflare/apply.mjs
 *   CLOUDFLARE_API_TOKEN=... node cloudflare/apply.mjs --execute
 *
 * Requires a token with Zone:DNS:Edit and Zone:Config:Edit for this zone.
 */
const ZONE_NAME = 'dibyajyotikabi.com';
const EXECUTE = process.argv.includes('--execute');
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API = 'https://api.cloudflare.com/client/v4';

/** The blog's own CSP hash for the theme-boot script. The apex ships the same
 * source text, so the hash is identical — verified against the built HTML. */
const THEME_HASH = "'sha256-nuNF0hABcbtwsKwLa0TQpgu0zJO5RKXrPFdL4Oon/4E='";

/**
 * The main site loads nothing from a third party except the blog API and the
 * GitHub contributions feed. default-src lists the blog because link
 * rel=prefetch is checked against default-src, not script-src — leave it out
 * and the cross-origin prefetch starts failing again.
 */
const MAIN_CSP = [
  "default-src 'self' https://blogs.dibyajyotikabi.com",
  `script-src 'self' ${THEME_HASH}`,
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://blogs.dibyajyotikabi.com https://github-contributions-api.jogruber.de",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' mailto:",
  'upgrade-insecure-requests',
].join('; ');

/** /old-themes/ is the archived React build. It loads Google Fonts, sets inline
 * styles at runtime, and the Cal.com embed injects app.cal.com/embed/embed.js,
 * so it needs a looser policy than the main site. */
const ARCHIVE_CSP = [
  "default-src 'self'",
  "script-src 'self' https://app.cal.com https://cal.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://github-contributions-api.jogruber.de https://api.cal.com https://app.cal.com https://cal.com",
  "frame-src https://cal.com https://app.cal.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' mailto:",
  'upgrade-insecure-requests',
].join('; ');

const SITE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
};

const DESIRED_RULESET = {
  name: 'Site security headers',
  description: 'Headers GitHub Pages cannot set on the apex.',
  kind: 'zone',
  phase: 'http_response_headers_transform',
  rules: [
    {
      expression: '(http.host eq "dibyajyotikabi.com") and starts_with(http.request.uri.path, "/old-themes")',
      description: 'Archived React theme',
      action: 'rewrite',
      action_parameters: { headers: { 'Content-Security-Policy': { operation: 'set', value: ARCHIVE_CSP } } },
    },
    {
      expression: 'http.host eq "dibyajyotikabi.com"',
      description: 'Main site and everything else',
      action: 'rewrite',
      action_parameters: {
        headers: {
          'Content-Security-Policy': { operation: 'set', value: MAIN_CSP },
          ...Object.fromEntries(Object.entries(SITE_HEADERS).map(([name, value]) => [name, { operation: 'set', value }])),
        },
      },
    },
  ],
};

const DESIRED_DNS = [
  ...[108, 109, 110, 111].map((n) => ({ type: 'A', name: ZONE_NAME, content: `185.199.${n}.153`, proxied: true })),
  { type: 'CNAME', name: `www.${ZONE_NAME}`, content: 'dibyajyotikabi.github.io', proxied: true },
  { type: 'A', name: `blogs.${ZONE_NAME}`, content: '91.99.233.178', proxied: true },
  { type: 'A', name: `score.${ZONE_NAME}`, content: '91.99.233.178', proxied: true },
];

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (Zone:DNS:Edit, Zone:Config:Edit).');
  process.exit(1);
}

async function cf(path, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${response.status} ${JSON.stringify(body.errors || body)}`);
  }
  return body.result;
}

const plan = (line) => console.log(`${EXECUTE ? '  apply' : '  plan '}  ${line}`);

const zones = await cf(`/zones?name=${ZONE_NAME}`);
if (!zones.length) {
  console.error(`No Cloudflare zone for ${ZONE_NAME}. Add the site in the dashboard first,`);
  console.error('then point Spaceship at the nameservers Cloudflare assigns.');
  process.exit(1);
}
const zoneId = zones[0].id;
console.log(`Zone ${ZONE_NAME} -> ${zoneId}\n`);

console.log('DNS records:');
const existing = await cf(`/zones/${zoneId}/dns_records?per_page=200`);
for (const want of DESIRED_DNS) {
  const key = want.name === ZONE_NAME ? '@' : want.name.replace(`.${ZONE_NAME}`, '');
  const match = existing.find((r) => r.type === want.type && r.name === want.name);
  if (match && match.content === want.content && match.proxied === want.proxied) {
    plan(`keep    ${want.type.padEnd(5)} ${key.padEnd(6)} -> ${want.content}`);
    continue;
  }
  if (match) {
    plan(`update  ${want.type.padEnd(5)} ${key.padEnd(6)} -> ${want.content} (was ${match.content}, proxied=${match.proxied})`);
    if (EXECUTE) await cf(`/zones/${zoneId}/dns_records/${match.id}`, { method: 'PUT', body: JSON.stringify(want) });
  } else {
    plan(`create  ${want.type.padEnd(5)} ${key.padEnd(6)} -> ${want.content} proxied`);
    if (EXECUTE) await cf(`/zones/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify(want) });
  }
}

console.log('\nSecurity headers ruleset:');
const entrypoints = await cf(`/zones/${zoneId}/rulesets?phase=http_response_headers_transform`);
const current = entrypoints.find((r) => r.phase === 'http_response_headers_transform');
const count = DESIRED_RULESET.rules.length;
if (!current) {
  plan(`create ruleset "${DESIRED_RULESET.name}" with ${count} rules`);
  if (EXECUTE) await cf(`/zones/${zoneId}/rulesets`, { method: 'POST', body: JSON.stringify(DESIRED_RULESET) });
} else {
  plan(`replace ruleset "${current.name}" (${current.id}) with ${count} rules`);
  if (EXECUTE) await cf(`/zones/${zoneId}/rulesets/${current.id}`, { method: 'PUT', body: JSON.stringify(DESIRED_RULESET) });
}

console.log(`\n${EXECUTE ? 'Applied.' : 'Dry run. Re-run with --execute to apply.'}`);
if (EXECUTE) {
  console.log('\nNow set SSL/TLS to Full (strict), and turn Rocket Loader and Auto Minify off.');
  console.log('Then verify: curl -sD - -o /dev/null https://dibyajyotikabi.com/ | grep -i strict-transport');
}
