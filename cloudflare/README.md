# Edge security headers for dibyajyotikabi.com

The apex is served by GitHub Pages, which does not allow response headers to be
set. That is why `https://dibyajyotikabi.com/` sends none of:

    Strict-Transport-Security
    Content-Security-Policy
    X-Frame-Options
    X-Content-Type-Options
    Referrer-Policy
    Permissions-Policy

`https://blogs.dibyajyotikabi.com/` (the blog) already sends all of these, so
the two hosts of the same site disagree about their own security posture.

Putting the apex behind Cloudflare fixes it: Cloudflare terminates the
connection and can rewrite response headers on the way through, while GitHub
Pages stays the origin. No change to the site build is needed.

## What is already proven

The header values in `apply.mjs` were tested before being written down. A local
server served `dist/` with exactly these headers and every page was loaded in a
real browser, reporting zero CSP violations and no blocked resources:

| Page | CSP violations |
| --- | --- |
| `/` | 0 |
| `/projects.html` | 0 |
| `/about.html` | 0 |
| `/contact.html` | 0 |
| `/writing.html` | 0 |
| `/writing/<story>.html` | 0 |
| `/404.html` | 0 |
| `/old-themes/` (React archive) | 0 |

Two findings worth keeping:

- `link rel="prefetch"` is governed by `default-src`, not `script-src`. A CSP
  that omits the blog host from `default-src` silently re-breaks the
  cross-origin prefetch fix — the prefetches fail and console errors return.
- The archived React theme at `/old-themes/` loads the Cal.com embed, which
  injects `https://app.cal.com/embed/embed.js` at runtime, and Google Fonts. It
  needs a looser policy than the main site, which is why the ruleset is
  path-aware rather than one policy for the whole zone.

## Prerequisites

1. A Cloudflare account (free tier is enough).
2. `dibyajyotikabi.com` added to Cloudflare. DNS currently lives at Spaceship
   (`launch1/launch2.spaceship.net`), so this means replacing those two
   nameservers with the pair Cloudflare assigns. Everything else in the zone
   must be recreated first — see the next section.
3. An API token with **Zone → DNS → Edit** and **Zone → Config → Edit** for this
   zone. Export it as `CLOUDFLARE_API_TOKEN`.

## Records to recreate in Cloudflare

Read these from the current provider before switching nameservers, or the
subdomains will stop resolving.

| Name | Type | Value | Proxy |
| --- | --- | --- | --- |
| `dibyajyotikabi.com` | A | `185.199.108.153` | Proxied |
| `dibyajyotikabi.com` | A | `185.199.109.153` | Proxied |
| `dibyajyotikabi.com` | A | `185.199.110.153` | Proxied |
| `dibyajyotikabi.com` | A | `185.199.111.153` | Proxied |
| `www` | CNAME | `dibyajyotikabi.github.io` | Proxied |
| `blogs` | A | `91.99.233.178` | Proxied |
| `score` | A | `91.99.233.178` | Proxied |

Keep the existing TXT records — `google-site-verification` is
`R25KXNfx2XhnW04uJGD-Qs1luM791QX8slBx-IBmxo8` — or Search Console verification
lapses.

## Apply

```sh
export CLOUDFLARE_API_TOKEN=...
node cloudflare/apply.mjs            # prints the plan, changes nothing
node cloudflare/apply.mjs --execute  # makes the changes
```

Then set the SSL/TLS mode to **Full (strict)**, and turn **Rocket Loader** and
**Auto Minify** off. Both rewrite JavaScript and CSS in ways this site does not
expect, and Rocket Loader in particular would defeat the deferred script.

## Verify

```sh
curl -sD - -o /dev/null https://dibyajyotikabi.com/ | grep -iE \
  'strict-transport|content-security|x-frame|x-content-type|referrer|permissions'
```

Then re-run the browser check, because a CSP that is correct in theory can still
block a resource in practice:

```sh
python3 /tmp/jev_csp_check.py https://dibyajyotikabi.com/
```

Expect `cspViolations: []` and no blocked resources.

## Note on HSTS

`includeSubDomains` covers `blogs` and `score`, which are already HTTPS-only, so
it is safe. Do not add `preload` unless you intend to submit to the preload
list, which is effectively irreversible.
