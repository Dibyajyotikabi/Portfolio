// The sticky buy bar on phones starts tucked away below the screen (CSS), so it
// never flashes in while the page loads. It slides in once the hero's own buy
// button has scrolled away, and slides out again while the order card at the
// end is on screen, so a screen never shows two buttons. Without
// IntersectionObserver the bar simply stays visible.
(() => {
  const bar = document.querySelector('[data-buy-bar]');
  if (!bar) return;
  const heroBuy = document.querySelector('[data-hero-buy]');
  const order = document.querySelector('[data-order]');
  if (!heroBuy || !('IntersectionObserver' in window)) {
    bar.classList.add('is-shown');
    return;
  }
  let heroAhead = true;
  let orderInView = false;
  const update = () => bar.classList.toggle('is-shown', !heroAhead && !orderInView);
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
