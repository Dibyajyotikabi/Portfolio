// The sticky buy bar on phones only slides in once the hero's own buy button
// has scrolled away, so the first screen never shows two buttons. Without
// IntersectionObserver the bar simply stays visible, as before.
(() => {
  const bar = document.querySelector('[data-buy-bar]');
  const heroBuy = document.querySelector('[data-hero-buy]');
  if (!bar || !heroBuy || !('IntersectionObserver' in window)) return;
  bar.classList.add('is-hidden');
  new IntersectionObserver(([entry]) => {
    bar.classList.toggle('is-hidden', entry.isIntersecting || entry.boundingClientRect.top > 0);
  }).observe(heroBuy);
})();
