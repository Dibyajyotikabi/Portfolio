(() => {
  "use strict";

  const root = document.documentElement;
  const themeKey = "clean-portfolio-theme";
  const themeColors = { light: "#fafafa", dark: "#11151d", read: "#f7f1e6" };
  const themes = ["light", "dark", "read"];
  const themeLabels = { light: "Light", dark: "Dark", read: "Reading" };
  const scriptUrl = new URL(document.currentScript.src);
  const backendUrl = scriptUrl.hostname === "dibyajyotikabi.com"
    ? new URL("https://blogs.dibyajyotikabi.com/") : new URL("/", scriptUrl);
  const visitorsUrl = new URL("api/visitors", backendUrl);
  const validTheme = (value) => Object.hasOwn(themeColors, value);
  let preferredTheme;

  // Theme switching still works when browser privacy settings block storage.
  try {
    const saved = localStorage.getItem(themeKey);
    if (validTheme(saved)) preferredTheme = saved;
  } catch {
    preferredTheme = undefined;
  }

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

  // Start in day mode until a visitor chooses another display mode.
  applyTheme(preferredTheme || "light");
  window.addEventListener("storage", (event) => {
    if (event.key !== themeKey && event.key !== null) return;
    preferredTheme = validTheme(event.newValue) ? event.newValue : undefined;
    applyTheme(preferredTheme || "light");
  });

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
    if (!link) return;
    const key = `clean-portfolio-github-${year}`;
    function render(total) {
      const number = document.createElement("strong");
      number.textContent = total.toLocaleString();
      link.replaceChildren(number, document.createTextNode(` GitHub contributions in ${year}`));
      link.dataset.status = "ready";
    }

    // Only public contribution totals are cached; newsletter details are never stored.
    try {
      const cached = JSON.parse(sessionStorage.getItem(key));
      if (cached && Number.isSafeInteger(cached.total) && cached.total >= 0 &&
          Number.isFinite(cached.savedAt) && Date.now() - cached.savedAt >= 0 &&
          Date.now() - cached.savedAt < 60 * 60 * 1000) {
        render(cached.total);
        return;
      }
    } catch {
      // An unavailable or invalid cache does not prevent a fresh request.
    }

    link.dataset.status = "loading";
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
      const total = data.total?.[String(year)];
      if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid GitHub contribution count");
      render(total);
      try {
        sessionStorage.setItem(key, JSON.stringify({ total, savedAt: Date.now() }));
      } catch {
        // The live total remains visible if session storage is unavailable.
      }
    } catch {
      link.textContent = "View my GitHub activity ↗";
      link.title = "The live contribution count is temporarily unavailable.";
      link.dataset.status = "unavailable";
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
      const rows = data.posts.slice(0, 3).map(post => {
        const url = new URL(post.url);
        const date = new Date(post.date);
        if (url.origin !== backendUrl.origin || typeof post.title !== "string" || !Number.isFinite(date.getTime())) throw new Error("Invalid story");
        const row = document.createElement("li"); row.className = "writing-row";
        const link = document.createElement("a"); link.href = url.href;
        const title = document.createElement("span"); title.textContent = post.title;
        const time = document.createElement("time"); time.dateTime = date.toISOString();
        time.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        link.append(title, time); row.append(link); return row;
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
      try {
        localStorage.setItem(themeKey, preferredTheme);
      } catch {
        // The selected theme still applies for the current page.
      }
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
