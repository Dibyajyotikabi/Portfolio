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
- `server.py` — static file server and persistent visitor counter, starting at 12,000
- `feed.xml` — RSS feed for all three articles
- `assets/` — local portrait and favicon
- `blog/` — independent Markdown blog and private editor for Coolify/Hetzner; see its README for development, storage, and deployment

Edit the HTML files to change the content. The color variables are at the top of `styles.css`. Each page contains its own navigation and footer, so update those across all pages when changing shared links. The footer's article and project totals and RSS feed reflect the current content.

One icon cycles through Light → Dark → Read and remembers the visitor's choice across pages. Read uses warm paper colors and larger serif text with more line spacing. GitHub's public yearly contribution total loads dynamically and falls back to a GitHub activity link if it is unavailable. There is no mailing-list provider yet, so the subscribe form clearly opens a subscription request in the visitor's email app; it does not claim to add an address to a list.

The visitor total starts with a user-specified baseline of 12,000 and increases once per visit. An anonymous cookie prevents page navigation or refreshes from counting again until 30 minutes of inactivity. SQLite stores the shared total at `~/.local/share/clean-portfolio/visitors.sqlite3`, outside the public directory; set `PORTFOLIO_VISITOR_DB` to another persistent path if needed. No visitor identities or IP addresses are stored in the database. The standard HTTP server logs requests to the terminal.

The production blog stores the shared visitor total in its persistent SQLite volume. A signed, anonymous cookie counts a new visit after 30 minutes of inactivity across the portfolio and blog. The client retains the last known total with a `+` if an update fails, so the number stays visible. Local previews continue to use the Python endpoint. Keep both databases when restarting or redeploying to preserve their respective totals.
