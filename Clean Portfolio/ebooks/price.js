// Ebooks have two set prices, matching the Dodo product: rupees for India
// (data-inr) and US dollars for everyone else (data-usd). Other currencies are
// converted from the dollar price, as Dodo does, and marked approximate.
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

  const prices = document.querySelectorAll('[data-inr][data-usd]');
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

  // Whole prices read as "$19", converted ones keep their cents ("£14.37").
  const format = (amount, currency) => {
    const digits = Number.isInteger(amount) || amount >= 100 ? 0 : 2;
    return new Intl.NumberFormat(navigator.language || 'en', {
      style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(amount);
  };

  const showNote = () => document.querySelectorAll('[data-price-note]').forEach((el) => { el.hidden = false; });
  const showDollars = () => {
    prices.forEach((el) => { el.textContent = format(Number(el.dataset.usd), 'USD'); });
  };

  (async () => {
    try {
      const loc = await country();
      if (!loc || loc === 'IN') return;
      const currency = EURO.includes(loc) ? 'EUR' : CURRENCY[loc] || 'USD';
      let perDollar = 1;
      if (currency !== 'USD') {
        const res = await withTimeout('/ebooks/rates.json');
        const rates = res.ok ? (await res.json()).rates : null;
        if (!rates?.[currency] || !rates.USD) return showDollars();
        perDollar = rates[currency] / rates.USD;
      }
      prices.forEach((el) => {
        el.textContent = format(Number(el.dataset.usd) * perDollar, currency);
      });
      if (currency !== 'USD') showNote();
    } catch {
      // Keep the rupee prices already on the page.
    }
  })();
})();
