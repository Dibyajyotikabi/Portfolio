# Dibyajyoti Kabi — Clean Portfolio

A lightweight portfolio in HTML, CSS, and JavaScript, with a small Python server for the shared visitor count. It has no third-party dependencies or build step.

Run the website and visitor counter with:

```sh
python3 server.py
```

Then visit http://127.0.0.1:4173.

Production is published to `https://dibyajyotikabi.com/` by the parent repository's GitHub Pages workflow. Run `npm run build` from the parent directory: it packages these public files at the site root and builds the original React portfolio at `/old-themes/`, linked from every footer. `robots.txt`, `sitemap.xml`, canonical URLs, social metadata, and structured data are included. The build excludes the Python server, private blog editor, and development files. The live visitor total and latest writing load from the existing blog server at `https://blogs.dibyajyotikabi.com`. Writing links point to individual blog articles; the previous portfolio article URLs redirect there.

- `index.html` — introduction and selected projects
- `projects.html` — all 13 projects, including SamUpdater, AI Update Notes, and Cricket Scoreboard
- `about.html` — biography, experience, education and training, certifications, services, tools, and press mentions
- `writing.html` and `writing/` — the three articles from the existing portfolio
- `contact.html` — email, booking, and social links
- `styles.css` — layout, fonts, colors, and responsive styles
- `site.js` — saved Day, Dark, and Read modes, live public GitHub contribution totals, year progress, and the email-draft subscription form
- `sw.js` — service worker that keeps the shared shell on the device, answers repeat navigations from the cache, and stores the pages a visitor is about to open
- `server.py` — static file server and persistent visitor counter, starting at 12,000
- `feed.xml` — RSS feed for all three articles
- `assets/` — `avatar.jpg` (117×117 header portrait on every page), `portrait.jpg` (1600×983 JPEG fallback and social preview), `portrait.webp` and `portrait-800.webp` (responsive About photo), and `favicon.svg`
- `blog/` — independent Markdown blog, private editor, and an AI-facing API and MCP server for Coolify/Hetzner; see its README for development, storage, and deployment, and `blog/AGENT-API.md` for writing with any AI model

Edit the HTML files to change the content. The color variables are at the top of `styles.css`. Each page contains its own navigation and footer, so update those across all pages when changing shared links. The footer's article and project totals and RSS feed reflect the current content.

Keep the assets small. A first visit now transfers roughly 20 KB: about 4 KB of HTML, 4 KB of CSS, 4 KB of JavaScript, a 5 KB header avatar, and — on the About page only — a 15 KB or 47 KB WebP portrait depending on screen width. `assets/portrait.jpg` stays as the 1600×983 JPEG fallback and social preview, so keep it a real JPEG under ~150 KB and regenerate the WebP files and square avatar (`cwebp`, `sips`) instead of adding an unoptimised original. The `styles.css` and `site.js` links carry a `?v=` number; bump it on every page after editing either file so the ten-minute GitHub Pages browser cache picks the change up.

The initial theme follows the device's light/dark setting. One icon cycles through Light → Dark → Read; a shared cookie synchronizes manual choices across the portfolio, blog, articles, and open windows. Read uses warm paper colors and larger serif text with more line spacing. GitHub's public yearly contribution total loads dynamically and falls back to a GitHub activity link if it is unavailable. There is no mailing-list provider yet, so the subscribe form clearly opens a subscription request in the visitor's email app; it does not claim to add an address to a list.

Pages are saved before they are opened. `sw.js` caches the shared shell on install and then serves each navigation from that cache while quietly checking for a newer copy, so repeat visits paint immediately and work offline. That check uses the browser's own freshness rules, so a copy it already holds — including one a prefetch stored — is reused rather than fetched again.

`site.js` warms the links a visitor is most likely to use. The story list or article links are saved as soon as the page is ready, at the browser's lowest priority, so they are on the device before the click; the navigation and footer wait for idle time; and any link that is hovered, tapped, or focused is saved right away. The three newest stories linked from the homepage and the writing page point at the blog, which is a different origin: those are handed to the browser's own prefetcher instead of this site's cache. Twelve pages are saved per page view, and requests to unrelated hosts, live visitor and contribution endpoints, and `no-store` replies are never intercepted or stored. A blocked or unsupported service worker merely means every link loads normally.

Because `sw.js` lives at the site root it must stay in the build's copy list in `scripts/build-site.mjs`; its `CACHE_VERSION` only needs a bump when the shell list or caching behaviour itself changes.

The visitor total starts with a user-specified baseline of 12,000 and increases once per visit. An anonymous cookie prevents page navigation or refreshes from counting again until 30 minutes of inactivity. SQLite stores the shared total at `~/.local/share/clean-portfolio/visitors.sqlite3`, outside the public directory; set `PORTFOLIO_VISITOR_DB` to another persistent path if needed. No visitor identities or IP addresses are stored in the database. The standard HTTP server logs requests to the terminal.

The production blog stores the shared visitor total in its persistent SQLite volume. A signed, anonymous cookie counts a new visit after 30 minutes of inactivity across the portfolio and blog. The client retains the last known total with a `+` if an update fails, so the number stays visible. Local previews continue to use the Python endpoint. Keep both databases when restarting or redeploying to preserve their respective totals.
