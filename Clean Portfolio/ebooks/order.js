// The return URL is informational; Dodo's receipt and file grants confirm a purchase.
// A query parameter must never grant access to the paid files.
(() => {
  const params = new URLSearchParams(window.location.search);
  const status = (params.get('status') || '').toLowerCase();
  if (window.location.search) {
    // Dodo appends the buyer's email and order details. Keep them out of copied URLs.
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }

  const heading = document.querySelector('[data-order-heading]');
  const message = document.querySelector('[data-order-message]');
  const steps = document.querySelector('[data-download-steps]');
  const retry = document.querySelector('[data-order-retry]');
  if (!heading || !message || !steps || !retry) return;

  if (['failed', 'cancelled', 'canceled'].includes(status)) {
    heading.textContent = 'Payment not completed';
    message.textContent = 'Your payment was not completed. Check your payment app or bank before trying again. If you were charged, contact support with your order details.';
    steps.hidden = true;
    retry.hidden = false;
  } else if (['pending', 'processing'].includes(status)) {
    heading.textContent = 'Payment is being processed';
    message.textContent = 'Wait for your confirmation from Dodo Payments before trying again. Download access is sent only after a successful payment.';
    steps.hidden = true;
  } else if (status === 'succeeded') {
    heading.textContent = 'Check your download email';
    message.textContent = 'Dodo Payments sends your receipt and access to Blog to Paycheck after confirming payment. Your receipt confirms your purchase.';
  }
  document.title = `${heading.textContent} | Blog to Paycheck`;
})();
