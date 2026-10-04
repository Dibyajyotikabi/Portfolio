// Meta pixel events for the ebook pages, sent as plain requests to
// facebook.com/tr so no third-party script runs here. The CSP allows
// www.facebook.com in img-src and connect-src for this.
// Load before order.js: it strips the Dodo return query this file reads.
(() => {
  const PIXEL_ID = '2402424140581163';
  const CURRENCY = 'INR';
  // Buy links without data-value are the ₹99 Blog to Paycheck book.
  const DEFAULT_VALUE = '99';
  const CHECKOUT_KEY = 'ebook-checkout';
  const FBC_KEY = 'ebook-fbc';
  const FBC_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  // The ad click lands here with ?fbclid=. Keep it so the purchase on the
  // thank-you page can be matched back to the ad.
  const clickId = () => {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    try {
      if (fbclid) {
        const fbc = `fb.1.${Date.now()}.${fbclid}`;
        localStorage.setItem(FBC_KEY, fbc);
        return fbc;
      }
      const saved = localStorage.getItem(FBC_KEY) || '';
      const age = Date.now() - Number(saved.split('.')[2]);
      return age < FBC_MAX_AGE_MS ? saved : '';
    } catch {
      return fbclid ? `fb.1.${Date.now()}.${fbclid}` : '';
    }
  };
  const fbc = clickId();

  const track = (event, custom = {}, eventId = '') => {
    const params = new URLSearchParams({
      id: PIXEL_ID,
      ev: event,
      // Path only: Dodo puts the buyer's email in the return URL.
      dl: window.location.origin + window.location.pathname,
      ts: String(Date.now()),
    });
    if (fbc) params.set('fbc', fbc);
    if (eventId) params.set('eid', eventId);
    Object.entries(custom).forEach(([key, value]) => params.set(`cd[${key}]`, value));
    fetch(`https://www.facebook.com/tr?${params}`, { mode: 'no-cors', keepalive: true })
      .catch(() => {});
  };

  // Each buy link carries its rupee price in data-value. The thank-you page
  // has no buy links, so the last clicked value is kept for the Purchase.
  const priceOf = (value) => ({
    value: /^\d+(\.\d+)?$/.test(value || '') ? value : DEFAULT_VALUE,
    currency: CURRENCY,
  });
  const savedValue = () => {
    try {
      return sessionStorage.getItem(CHECKOUT_KEY) || '';
    } catch {
      return '';
    }
  };
  const saveValue = (value) => {
    try {
      sessionStorage.setItem(CHECKOUT_KEY, value);
    } catch {
      // Private mode: the Purchase falls back to the default price.
    }
  };

  track('PageView');

  document.querySelectorAll('a[data-buy]').forEach((link) => {
    link.addEventListener('click', () => {
      const price = priceOf(link.dataset.value);
      saveValue(price.value);
      track('InitiateCheckout', price);
    });
  });

  const query = new URLSearchParams(window.location.search);
  if (document.querySelector('[data-order-heading]') &&
      (query.get('status') || '').toLowerCase() === 'succeeded') {
    // The payment id stops a double count if Meta sees the same sale twice.
    track('Purchase', priceOf(savedValue()), query.get('payment_id') || '');
  }
})();
