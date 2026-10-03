// Visitors from the Hindi ad (or with Hindi as their browser language) see a
// short Hindi summary right under the hero, so they don't land on a page that
// is only in English. Everyone else never sees it.
(() => {
  const KEY = 'b2p-hindi';
  const content = new URLSearchParams(location.search).get('utm_content') || '';
  const fromAd = /hindi|india/i.test(content);
  const prefersHindi = (navigator.languages || [navigator.language || ''])
    .some((lang) => /^hi\b/i.test(lang));
  let remembered = false;
  try { remembered = sessionStorage.getItem(KEY) === '1'; } catch {}
  if (!fromAd && !prefersHindi && !remembered) return;
  try { sessionStorage.setItem(KEY, '1'); } catch {}
  document.querySelector('[data-hindi]')?.removeAttribute('hidden');
})();
