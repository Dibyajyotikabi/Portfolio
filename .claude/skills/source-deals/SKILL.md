---
name: source-deals
description: Find 10 to 15 popular Amazon.in deals, confirm each on its product page, add them to the deals page with deals-admin/import-deals.mjs and publish. Use for the daily deal run or when asked to add new deals.
---

# Daily deal sourcing

Goal: 10 to 15 new deals a day on dibyajyotikabi.com/deals/. The site shows them as soon as the push deploys, and the Telegram job posts one every 30 minutes, oldest first.

Never buy anything, add to cart, sign in or type into Amazon forms. Read pages only.

## 1. Get ready

```bash
git pull --rebase origin main
```

Stop if `git status` shows changes to `Clean Portfolio/deals/*.json` that aren't yours. Ask first.

List what's already on the page so you don't hunt for repeats:

```bash
jq -r '.data.deals[] | .buyUrl' "Clean Portfolio/deals/deals.json" "Clean Portfolio/deals/trending.json" | grep -o 'dp/[A-Z0-9]\{10\}' | sort -u
```

## 2. Search Amazon in Chrome

Use the codex-cu MCP (`mcp__codex-cu__js`, load with ToolSearch "codex"). Start with `await cua.getState();`, then use an amazon.in tab. The user is signed in, which shows the real delivery prices.

Search with the 10% off filter, one query at a time, and spread the picks across the categories:

```
https://www.amazon.in/s?k=<query>&rh=p_n_pct-off-with-tax%3A2665400031
```

Queries that work well: earbuds, neckband, bluetooth speaker, smartwatch, power bank, charger, usb c cable, pendrive, ssd, memory card, monitor, gaming mouse, keyboard, wifi router, smart plug, trimmer, air fryer, mixer grinder, smartphone, tablet, laptop, smart tv, projector.

The site already has a lot of Audio and Accessories deals. Favor Phones & Tablets, Laptops & Computers, TVs & Projectors, Home & Kitchen and Wearables.

Read each results page in one call:

```js
const rows = await tab.playwright.evaluate(() => [...document.querySelectorAll('div[data-component-type="s-search-result"]')].map((el) => {
  const t = (s) => el.querySelector(s)?.textContent?.trim() || '';
  return {
    asin: el.dataset.asin, name: t('h2').slice(0, 80),
    price: t('.a-price:not(.a-text-price) .a-offscreen'), mrp: t('.a-text-price .a-offscreen'),
    rating: t('.a-icon-alt').slice(0, 3),
    reviews: el.querySelector('[aria-label*="ratings"]')?.getAttribute('aria-label') || '',
    bought: (el.innerText.match(/[\d.]+K?\+ bought in past month/) || [''])[0],
    badge: t('.a-badge-text'), sponsored: /Sponsored/.test(el.innerText),
  };
}));
```

Skip sponsored rows and anything already listed. Shortlist rows that look popular (see the rules below).

## 3. Confirm each pick on its product page

Open `https://www.amazon.in/dp/<ASIN>` and read the real numbers:

```js
const p = await tab.playwright.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent?.trim() || '';
  return {
    title: t('#productTitle'),
    price: t('#corePriceDisplay_desktop_feature_div .a-price-whole'),
    mrp: t('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen'),
    pct: t('#corePriceDisplay_desktop_feature_div .savingsPercentage'),
    rating: t('#acrPopover .a-icon-alt'), reviews: t('#acrCustomerReviewText'),
    bought: t('#social-proofing-faceout-title-tk_bought'),
    image: document.querySelector('#landingImage')?.dataset.oldHires || '',
    bullets: [...document.querySelectorAll('#feature-bullets li')].map((li) => li.textContent.trim()).slice(0, 5),
  };
});
```

Only keep it when the page agrees with the search row. The image must be an `m.media-amazon.com` link. Set `checked: true` only after this step.

## The popularity rules

These live in `deals-admin/lib/deals.mjs` (`POPULAR`). The import script enforces them, but pick with them in mind:

- At least 10% off the MRP.
- Rating 3.8 or higher, when it has one.
- At least one demand signal: 100+ bought last month, or rating 4.0+ with 100+ reviews, or an Amazon's Choice or #1 Best Seller badge.

## 4. Write the notes

Each deal gets 2 to 4 short notes. They show on the site and in Telegram exactly as written, so they have to sound like me.

- First note: why the price is good right now (sale name, how far below the list price).
- Second note: one real reason to buy it, from the bullets. Say what it does for you. "Has a built-in USB-C cable, so you never forget it at home."
- Then the proof: "10K+ bought on Amazon in the past month" and "Rated 4.2 by 2,518 buyers on Amazon".

Plain and short. No em dashes, en dashes, arrows or ellipsis characters (the script rejects them). No hype words like "unbeatable", "must-have", "seamless" or "elevate". American spelling.

## 5. Import

Write the picks to a file in the scratchpad, best deal first:

```json
[
  {
    "asin": "B0DSC4YJRD",
    "name": "Ambrane 20000mAh Pocket Power Bank",
    "fullName": "Ambrane 20000mAh Pocket Power Bank with Built-in Type C Cable",
    "image": "https://m.media-amazon.com/images/I/61Xh55+Wm0L._SL1000_.jpg",
    "price": "1,399", "mrp": "₹3,800", "rating": "4.2", "reviews": "2,518",
    "bought": "10K+ bought in past month", "badge": "Amazon's Choice",
    "category": "Accessories & Storage",
    "notes": ["...", "...", "...", "..."],
    "checked": true
  }
]
```

`name` is the short card title (under 60 characters works best). `category` is one of: Audio, Accessories & Storage, Home & Kitchen, Laptops & Computers, Monitors & Gaming, More gadgets, Phones & Tablets, TVs & Projectors, Wearables. Leave `badge` out unless it's Amazon's Choice or #1 Best Seller.

Dry run first, fix anything it skips, then add:

```bash
node deals-admin/import-deals.mjs <file> --dry
node deals-admin/import-deals.mjs <file>
```

The script adds the affiliate tag, skips products already listed and anything that fails the rules, and stops at 15.

## 6. Check and publish

```bash
npm test
npm run build
node deals-admin/telegram/sync.mjs --dry
```

The dry sync should list the new deals as waiting to post. Then commit only the deal file, as me, and push:

```bash
git add "Clean Portfolio/deals/deals.json"
git commit -m "feat: add <n> new deals" --author="Dibyajyoti Kabi <166307538+Dibyajyotikabi@users.noreply.github.com>"
git pull --rebase origin main
git push origin HEAD:main
```

The commit must not mention Claude or carry a Co-Authored-By line. Check with `git log -1 --format='%an <%ae> %cn%n%B'` before pushing.

Finish with a short report: how many deals went in, their names and prices, and anything you skipped and why.
