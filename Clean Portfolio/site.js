(() => {
  "use strict";

  const root = document.documentElement;
  // v2 discards the older stored preference so the site opens on the light
  // palette that matches the reference design.
  const themeKey = "clean-portfolio-theme-v2";
  const themeColors = { light: "#f7faff", dark: "#121a28", read: "#fffcf0" };
  const themes = ["light", "dark", "read"];
  const themeLabels = { light: "Light", dark: "Dark", read: "Reading" };
  const scriptUrl = new URL(document.currentScript.src);
  const backendUrl = scriptUrl.hostname === "dibyajyotikabi.com"
    ? new URL("https://blogs.dibyajyotikabi.com/") : new URL("/", scriptUrl);
  const visitorsUrl = new URL("api/visitors", backendUrl);
  const validTheme = (value) => Object.hasOwn(themeColors, value);
  const sharedDomain = scriptUrl.hostname === "dibyajyotikabi.com" || scriptUrl.hostname.endsWith(".dibyajyotikabi.com");
  let temporaryTheme;

  function readTheme() {
    try {
      const shared = document.cookie.split(";").map(value => value.trim())
        .find(value => value.startsWith(`${themeKey}=`))?.slice(themeKey.length + 1);
      if (validTheme(shared)) return shared;
      const saved = localStorage.getItem(themeKey);
      if (validTheme(saved)) return saved;
    } catch { /* Device settings work even when browser storage is blocked. */ }
  }

  function saveTheme(theme) {
    try {
      document.cookie = `${themeKey}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${sharedDomain ? "; Domain=dibyajyotikabi.com" : ""}${scriptUrl.protocol === "https:" ? "; Secure" : ""}`;
    } catch { /* Keep the choice usable on this page if cookies are blocked. */ }
    try { localStorage.setItem(themeKey, theme); } catch { /* Cookies can still share the choice. */ }
    temporaryTheme = readTheme() === theme ? undefined : theme;
  }
  let preferredTheme = readTheme();
  // Migrate an existing manual choice to the cookie shared by both sites.
  if (preferredTheme) saveTheme(preferredTheme);

  function applyTheme(theme) {
    if (!validTheme(theme)) theme = "light";
    root.dataset.theme = theme;
    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      toggle.hidden = false;
      const next = themes[(themes.indexOf(theme) + 1) % themes.length];
      const label = `${themeLabels[theme]} mode. Switch to ${themeLabels[next].toLowerCase()} mode`;
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    }
    document.querySelectorAll("[data-theme-icon]").forEach((icon) => {
      icon.toggleAttribute("hidden", icon.dataset.themeIcon !== theme);
    });
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = themeColors[theme];
  }

  function syncTheme() {
    preferredTheme = temporaryTheme || readTheme();
    const theme = preferredTheme || "light";
    if (root.dataset.theme !== theme) applyTheme(theme);
  }
  syncTheme();
  window.addEventListener("focus", syncTheme);
  window.addEventListener("pageshow", syncTheme);
  window.addEventListener("storage", syncTheme);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncTheme(); });
  // Cookies are shared across subdomains; storage events are not. Also update
  // visible side-by-side windows when a choice changes on the other site.
  setInterval(() => { if (!document.hidden) syncTheme(); }, 1000);

  function updateYear() {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const percent = Math.max(0, Math.min(100, Math.floor(((now - start) / (end - start)) * 100)));
    document.querySelectorAll("[data-year]").forEach((element) => { element.textContent = year; });
    const progress = document.querySelector("[data-year-progress]");
    if (progress) {
      progress.value = percent;
      progress.setAttribute("aria-label", `${percent}% of ${year} has passed`);
    }
    const label = document.querySelector("[data-year-label]");
    if (label) label.textContent = `${percent}% of the year`;
    return year;
  }

  async function loadGithub(year) {
    const link = document.querySelector("[data-github-activity]");
    const terminal = document.querySelector("[data-github-terminal]");
    if (!link && !terminal) return;
    const key = `clean-portfolio-github-${year}`;

    // The API returns one entry per day. Everything shown in the terminal is
    // derived from that calendar: totals, active days, streaks, the busiest day
    // and a per-week sparkline. Future days come back as zero, so they are
    // dropped before any of the day counts are computed.
    const BLOCKS = "▁▂▃▄▅▆▇█";
    const DAY = 24 * 60 * 60 * 1000;
    function summarize(data) {
      const days = Array.isArray(data?.contributions) ? data.contributions : null;
      const reported = data?.total?.[String(year)];
      if (!days) return null;
      const now = new Date();
      const cutoff = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const elapsed = days
        .filter(day => typeof day?.date === "string" && Number.isFinite(day.count) && day.date <= cutoff)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (!elapsed.length) return null;
      const counted = elapsed.reduce((sum, day) => sum + day.count, 0);
      const total = Number.isSafeInteger(reported) && reported >= 0 ? reported : counted;
      const active = elapsed.filter(day => day.count > 0).length;
      let current = 0;
      for (let i = elapsed.length - 1; i >= 0 && elapsed[i].count > 0; i--) current++;
      let best = 0;
      let run = 0;
      for (const day of elapsed) {
        run = day.count > 0 ? run + 1 : 0;
        if (run > best) best = run;
      }
      const busiest = elapsed.reduce((max, day) => (day.count > max.count ? day : max), elapsed[0]);
      // One block per week, bucketed from Monday so the columns line up.
      const weeks = new Map();
      for (const day of elapsed) {
        const date = new Date(`${day.date}T00:00:00Z`);
        const offset = (date.getUTCDay() + 6) % 7;
        const monday = new Date(date.getTime() - offset * DAY).toISOString().slice(0, 10);
        weeks.set(monday, (weeks.get(monday) || 0) + day.count);
      }
      const peak = Math.max(...weeks.values(), 1);
      const spark = [...weeks.values()]
        .map(count => (count === 0 ? "▁" : BLOCKS[Math.min(7, Math.max(1, Math.round((count / peak) * 7)))]))
        .join("");
      const label = (iso) => new Date(`${iso}T00:00:00Z`)
        .toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
      return { year, total, active, elapsed: elapsed.length, current, best,
        busiestCount: busiest.count, busiestLabel: new Date(`${busiest.date}T00:00:00Z`)
          .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" }),
        spark, start: label(elapsed[0].date), end: label(elapsed[elapsed.length - 1].date) };
    }

    function renderFooter(total) {
      if (!link) return;
      const number = document.createElement("strong");
      number.textContent = total.toLocaleString();
      link.replaceChildren(number, document.createTextNode(` GitHub contributions in ${year}`));
      link.dataset.status = "ready";
    }

    function renderTerminal(summary) {
      if (!terminal) return;
      const set = (sel, value) => {
        const node = terminal.querySelector(sel);
        if (node) node.textContent = value;
      };
      set("[data-gh-year]", summary.year);
      set("[data-gh-total]", summary.total.toLocaleString());
      set("[data-gh-active]", `${summary.active}/${summary.elapsed} days`);
      set("[data-gh-streak]", summary.current.toLocaleString());
      set("[data-gh-best]", summary.best.toLocaleString());
      set("[data-gh-busiest]", `${summary.busiestCount} on ${summary.busiestLabel}`);
      set("[data-gh-spark]", summary.spark);
      set("[data-gh-axis-start]", summary.start);
      set("[data-gh-axis-end]", summary.end);
      terminal.hidden = false;
    }

    function render(summary) {
      renderFooter(summary.total);
      renderTerminal(summary);
    }

    // Only public contribution totals are cached; newsletter details are never stored.
    // A day-old total is shown immediately and refreshed in the background.
    let cached;
    let cachedAt = 0;
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (stored && stored.summary && Number.isSafeInteger(stored.summary.total) && stored.summary.total >= 0 &&
          Number.isFinite(stored.savedAt) && Date.now() - stored.savedAt >= 0) {
        cached = stored.summary;
        cachedAt = stored.savedAt;
      }
    } catch {
      // An unavailable or invalid cache does not prevent a fresh request.
    }
    if (cached) {
      render(cached);
      if (Date.now() - cachedAt < DAY) return;
    } else if (link) {
      link.dataset.status = "loading";
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://github-contributions-api.jogruber.de/v4/Dibyajyotikabi?y=${year}`, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error(`GitHub activity returned ${response.status}`);
      const data = await response.json();
      const summary = summarize(data);
      if (!summary) throw new Error("Invalid GitHub contribution data");
      render(summary);
      try {
        localStorage.setItem(key, JSON.stringify({ summary, savedAt: Date.now() }));
      } catch {
        // The live total remains visible if browser storage is unavailable.
      }
    } catch {
      if (!cached && link) {
        link.textContent = "View my GitHub activity ↗";
        link.title = "The live contribution count is temporarily unavailable.";
        link.dataset.status = "unavailable";
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadVisitors() {
    const count = document.querySelector("[data-visitor-count]");
    if (!count) return;
    let lastTotal = 12000;
    try {
      const cached = Number(localStorage.getItem("portfolio-visitor-total"));
      if (Number.isSafeInteger(cached) && cached >= 12000) lastTotal = cached;
    } catch { /* A blocked cache must not hide the total. */ }
    count.textContent = `${lastTotal.toLocaleString("en-US")}+`;
    count.title = "Last recorded total; checking for an update.";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(visitorsUrl, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: "{}", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Visitor count unavailable");
      const { total } = await response.json();
      if (!Number.isSafeInteger(total) || total < 12000) throw new Error("Invalid visitor count");
      count.textContent = total.toLocaleString("en-US");
      count.title = "Total visits, counting a returning visit after 30 minutes of inactivity.";
      count.dataset.status = "ready";
      try { localStorage.setItem("portfolio-visitor-total", String(total)); } catch { /* The live value is already visible. */ }
    } catch {
      count.title = "Last recorded total; the live update is temporarily unavailable.";
      count.dataset.status = "cached";
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadWriting() {
    const list = document.querySelector("[data-latest-writing]");
    if (!list) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(new URL("api/writing", backendUrl), { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("Writing unavailable");
      const data = await response.json();
      if (!Array.isArray(data.posts)) throw new Error("Invalid writing response");
      const shown = data.posts.slice(0, 3);
      const rows = shown.map((post, index) => {
        const url = new URL(post.url);
        const date = new Date(post.date);
        if (url.origin !== backendUrl.origin || typeof post.title !== "string" || !Number.isFinite(date.getTime())) throw new Error("Invalid story");
        const row = document.createElement("li"); row.className = "writing-row";
        const total = Number.isSafeInteger(data.total) && data.total > 0 ? data.total : shown.length;
        row.dataset.number = String(total - index);
        const link = document.createElement("a"); link.href = url.href;
        const title = document.createElement("span"); title.textContent = post.title;
        link.append(title);
        const meta = document.createElement("ul"); meta.className = "writing-meta";
        const metaItem = document.createElement("li");
        const kind = document.createElement("span");
        kind.className = "entry-kind entry-kind-blog"; kind.setAttribute("aria-hidden", "true");
        const time = document.createElement("time"); time.dateTime = date.toISOString();
        time.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        metaItem.append(kind, time); meta.append(metaItem);
        row.append(link, meta); return row;
      });
      if (rows.length) list.replaceChildren(...rows);
      if (Number.isSafeInteger(data.total) && data.total >= 0) {
        document.querySelectorAll("[data-post-count]").forEach(element => { element.textContent = data.total; });
      }
    } catch { /* Keep the published article links available if the blog cannot be reached. */ }
    finally { clearTimeout(timeout); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.theme);
    document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
      preferredTheme = themes[(themes.indexOf(root.dataset.theme) + 1) % themes.length];
      applyTheme(preferredTheme);
      saveTheme(preferredTheme);
    });

    const form = document.querySelector("[data-newsletter-form]");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const name = String(fields.get("name") || "").trim();
      const email = String(fields.get("email") || "").trim();
      const body = `Hi Dibyajyoti,\n\nI would like to receive your email updates.\n\nName: ${name || "Not provided"}\nEmail: ${email}\n\nPlease add me to your list when it is available. Thanks!`;
      const request = `mailto:dibyajyotikabi@gmail.com?subject=${encodeURIComponent("Newsletter subscription request")}&body=${encodeURIComponent(body)}`;
      const status = document.querySelector("[data-newsletter-status]");
      status.textContent = "Send the email draft to request a subscription. If your email app didn’t open, ";
      const fallback = document.createElement("a");
      fallback.href = request;
      fallback.textContent = "open the draft here";
      status.append(fallback, document.createTextNode("."));
      window.location.href = request;
    });

    loadGithub(updateYear());
    loadVisitors();
    loadWriting();
  });
})();
