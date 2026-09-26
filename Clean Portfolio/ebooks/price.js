// Ebook prices are set in rupees. Visitors outside India see an approximate
// price in their own currency; Dodo's checkout shows the exact amount.
// The country comes from Cloudflare's same-origin trace and the rates from
// rates.json, which the build writes, so the page's CSP needs no new hosts.
(() => {
  const EURO = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
  const CURRENCY = {
    US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', AE: 'AED', SA: 'SAR',
    QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', JP: 'JPY', CH: 'CHF', SE: 'SEK', NO: 'NOK',
    DK: 'DKK', PL: 'PLN', ZA: 'ZAR', NG: 'NGN', KE: 'KES', BR: 'BRL', MX: 'MXN', PH: 'PHP',
    MY: 'MYR', ID: 'IDR', TH: 'THB', VN: 'VND', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR',
    HK: 'HKD', KR: 'KRW', TR: 'TRY', EG: 'EGP', IL: 'ILS',
  };
  const TRACE_TIMEOUT_MS = 2500;

  const prices = document.querySelectorAll('[data-inr]');
  if (!prices.length) return;

  const withTimeout = (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TRACE_TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' }).finally(() => clearTimeout(timer));
  };

  const country = async () => {
    const text = await (await withTimeout('/cdn-cgi/trace')).text();
    return (text.match(/^loc=([A-Z]{2})$/m) || [])[1] || '';
  };

  const format = (amount, currency) => new Intl.NumberFormat(navigator.language || 'en', {
    style: 'currency', currency, maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);

  (async () => {
    try {
      const loc = await country();
      if (!loc || loc === 'IN') return;
      const currency = EURO.includes(loc) ? 'EUR' : CURRENCY[loc] || 'USD';
      const res = await withTimeout('/ebooks/rates.json');
      if (!res.ok) return;
      const rate = (await res.json()).rates?.[currency];
      if (!rate) return;
      prices.forEach((el) => {
        el.textContent = format(Number(el.dataset.inr) * rate, currency);
      });
      document.querySelectorAll('[data-price-note]').forEach((el) => { el.hidden = false; });
    } catch {
      // Keep the rupee prices already on the page.
    }
  })();
})();
