(function () {
  'use strict';
  // Hides a "price ends on" note once its real end date has passed.
  document.querySelectorAll('[data-offer-ends]').forEach(function (el) {
    var ends = Date.parse(el.getAttribute('data-offer-ends'));
    if (!isNaN(ends) && Date.now() > ends) el.hidden = true;
  });
})();
