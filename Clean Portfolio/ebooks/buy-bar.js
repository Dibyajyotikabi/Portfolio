// The sticky buy bar on phones only slides in once the hero's own buy button
// has scrolled away, and slides out again while the order card at the end is
// on screen, so a screen never shows two buttons. Without IntersectionObserver
// the bar simply stays visible, as before.
(() => {
  const bar = document.querySelector('[data-buy-bar]');
  const heroBuy = document.querySelector('[data-hero-buy]');
  const order = document.querySelector('[data-order]');
  if (!bar || !heroBuy || !('IntersectionObserver' in window)) return;
  let heroAhead = true;
  let orderInView = false;
  const update = () => bar.classList.toggle('is-hidden', heroAhead || orderInView);
  update();
  new IntersectionObserver(([entry]) => {
    heroAhead = entry.isIntersecting || entry.boundingClientRect.top > 0;
    update();
  }).observe(heroBuy);
  if (!order) return;
  new IntersectionObserver(([entry]) => {
    orderInView = entry.isIntersecting;
    update();
  }).observe(order);
})();
