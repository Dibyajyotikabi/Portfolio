import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const orderSource = readFileSync(new URL('../Clean Portfolio/ebooks/order.js', import.meta.url), 'utf8');
const priceSource = readFileSync(new URL('../Clean Portfolio/ebooks/price.js', import.meta.url), 'utf8');

function order(search) {
  const elements = {
    '[data-order-heading]': { textContent: 'Your ebook order' },
    '[data-order-message]': { textContent: 'Your receipt confirms your purchase.' },
    '[data-download-steps]': { hidden: false },
    '[data-order-retry]': { hidden: true },
  };
  const replacements = [];
  const document = { title: '', querySelector: selector => elements[selector] };
  vm.runInNewContext(orderSource, {
    URLSearchParams, document,
    window: {
      location: { search, pathname: '/ebooks/thank-you.html', hash: '' },
      history: { replaceState: (...args) => replacements.push(args[2]) },
    },
  });
  return { elements, replacements, document };
}

test('declined and cancelled payments offer retry and never show download instructions', () => {
  for (const status of ['failed', 'cancelled', 'canceled']) {
    const { elements, replacements } = order(`?status=${status}&email=buyer%40example.com&payment_id=pay_test`);
    assert.equal(elements['[data-order-heading]'].textContent, 'Payment not completed');
    assert.equal(elements['[data-download-steps]'].hidden, true);
    assert.equal(elements['[data-order-retry]'].hidden, false);
    assert.deepEqual(replacements, ['/ebooks/thank-you.html']);
  }
});

test('pending payments do not encourage a duplicate payment', () => {
  const { elements } = order('?status=pending');
  assert.equal(elements['[data-download-steps]'].hidden, true);
  assert.equal(elements['[data-order-retry]'].hidden, true);
  assert.match(elements['[data-order-message]'].textContent, /before trying again/);
});

test('a success query only directs the buyer to Dodo confirmation', () => {
  const { elements } = order('?status=succeeded&license_key=private&email=buyer%40example.com');
  assert.equal(elements['[data-order-heading]'].textContent, 'Check your download email');
  assert.match(elements['[data-order-message]'].textContent, /after confirming payment/);
  assert.equal(elements['[data-order-retry]'].hidden, true);
  assert.equal(elements['[data-download-steps]'].hidden, false);
});

test('direct visits and unknown statuses never claim that payment succeeded', () => {
  for (const search of ['', '?status=unexpected', '?status=%3Cscript%3E']) {
    const { elements } = order(search);
    assert.equal(elements['[data-order-heading]'].textContent, 'Your ebook order');
    assert.equal(elements['[data-order-retry]'].hidden, true);
  }
});

async function price(country, rates, fail = false) {
  const prices = [{ dataset: { inr: '499', usd: '19' }, textContent: '₹499' }];
  const notes = [{ hidden: false, textContent: 'India: ₹499. Outside India: US$19.' }];
  vm.runInNewContext(priceSource, {
    Intl, AbortController, setTimeout, clearTimeout,
    navigator: { language: 'en-US' },
    document: { querySelectorAll: selector => selector === '[data-price-note]' ? notes : prices },
    fetch: async url => {
      if (fail) throw new Error('Offline');
      return url === '/cdn-cgi/trace'
        ? { text: async () => country ? `loc=${country}\n` : 'No country' }
        : { ok: true, json: async () => ({ rates }) };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { prices, notes };
}

test('India and US visitors see the actual discounted checkout prices', async () => {
  const india = await price('IN');
  const us = await price('US');
  assert.equal(india.prices[0].textContent, '₹499');
  assert.equal(us.prices[0].textContent, '$19');
  assert.equal(india.notes[0].hidden, true);
  assert.equal(us.notes[0].hidden, true);
});

test('missing geolocation or offline detection keeps both market prices explained', async () => {
  for (const result of [await price(''), await price('', null, true)]) {
    assert.equal(result.notes[0].hidden, false);
    assert.match(result.notes[0].textContent, /US\$19/);
  }
});

test('converted prices are approximate and invalid rates fall back to USD', async () => {
  const gb = await price('GB', { USD: 1, GBP: 0.75 });
  assert.equal(gb.prices[0].textContent, '£14.25');
  assert.match(gb.notes[0].textContent, /Approximate/);
  const invalid = await price('GB', { USD: 0, GBP: 0.75 });
  assert.equal(invalid.prices[0].textContent, '$19');
});

test('order return URLs bypass the service-worker cache', async () => {
  const handlers = {};
  const swSource = readFileSync(new URL('../Clean Portfolio/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(swSource, {
    URL, Request, Response,
    self: { location: { origin: 'https://dibyajyotikabi.com' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: { open: async () => { throw new Error('Order returns must not open a cache'); } },
  });
  for (const suffix of ['', '?status=failed&email=buyer%40example.com', '?status=succeeded']) {
    let intercepted = false;
    handlers.fetch({
      request: { url: `https://dibyajyotikabi.com/ebooks/thank-you.html${suffix}`, method: 'GET', headers: new Headers(), mode: 'navigate' },
      respondWith: () => { intercepted = true; },
    });
    assert.equal(intercepted, false);
  }
});
