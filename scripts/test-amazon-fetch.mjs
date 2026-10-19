import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interleave, isBlockPage, decode, parseProduct, shortName, categoryFor, featureNote, templateNotes,
} from '../deals-admin/lib/amazon.mjs';

const PRODUCT_HTML = `
<span id="productTitle" class="a-size-large">  iQOO Z11 Lite 44W 5G (Solar Flame, 4GB RAM, 128GB Storage)  </span>
<div id="acrPopover" title="4.1 out of 5 stars"></div>
<span id="acrCustomerReviewText" aria-label="2,518 Reviews">(2,518)</span>
<div id="social-proofing-faceout-title-tk_bought"><span>5K+ bought</span> in past month</div>
<div id="acBadge_feature_div"><span>Amazon&#39;s Choice</span></div>
<div id="corePriceDisplay_desktop_feature_div">
  <span class="a-price-whole">17,499</span>
  <span>M.R.P.: ₹30,999</span>
</div>
<img alt="" data-old-hires="https://m.media-amazon.com/images/I/61+l5bzv9hL._SL1200_.jpg" id="landingImage" src="x.jpg">
<div id="feature-bullets"><ul>
  <li><span class="a-list-item">Short.</span></li>
  <li><span class="a-list-item">BIG BATTERY: A 6000mAh battery lasts a full day of calls and videos. It charges fast too.</span></li>
</ul></div>`;

const BLOCK_HTML = '<html><script src="/bm-verify.js"></script>Checking your browser</html>';

test('isBlockPage spots the bot check and passes a real product page', () => {
  assert.equal(isBlockPage(BLOCK_HTML), true);
  assert.equal(isBlockPage('<form action="/errors/validateCaptcha">'), true);
  assert.equal(isBlockPage(PRODUCT_HTML), false);
});

test('decode handles named, decimal and hex entities', () => {
  assert.equal(decode('Tom &amp; Jerry &#39;s &#x27;x&#x27; &quot;q&quot;'), `Tom & Jerry 's 'x' "q"`);
});

test('parseProduct reads the numbers, badge, image and bullets', () => {
  const p = parseProduct(PRODUCT_HTML);
  assert.equal(p.title, 'iQOO Z11 Lite 44W 5G (Solar Flame, 4GB RAM, 128GB Storage)');
  assert.equal(p.price, '17,499');
  assert.equal(p.mrp, '₹30,999');
  assert.equal(p.rating, '4.1');
  assert.equal(p.reviews, '2,518');
  assert.equal(p.bought, '5K+ bought in past month');
  assert.equal(p.badge, "Amazon's Choice");
  assert.equal(p.image, 'https://m.media-amazon.com/images/I/61+l5bzv9hL._SL1200_.jpg');
  assert.equal(p.bullets.length, 2);
});

test('shortName keeps the model and drops the variant', () => {
  assert.equal(shortName('iQOO Z11 Lite 44W 5G (Solar Flame, 4GB RAM)'), 'iQOO Z11 Lite 44W 5G');
  assert.equal(shortName('boAt Airdopes 141 | 42H Playtime'), 'boAt Airdopes 141');
  assert.equal(shortName('Samsung 55 inch (138cm) Mini LED 4K Smart TV | 30W Speakers'), 'Samsung 55 inch Mini LED 4K Smart TV');
  assert.equal(shortName('Portronics Conch Theta C Wired Earphones with in Line HD Mic'), 'Portronics Conch Theta C Wired Earphones');
  const long = shortName('Some Brand Ultra Long Product Name That Keeps Going And Going Past Sixty Characters');
  assert.ok(long.length <= 60 && !long.endsWith(' '));
});

test('categoryFor prefers title words over the list category', () => {
  assert.equal(categoryFor('Noise Smart Watch with AMOLED', 'Phones & Tablets'), 'Wearables');
  assert.equal(categoryFor('Prestige Pressure Cooker', 'Home & Kitchen'), 'Home & Kitchen');
  assert.equal(categoryFor('Xiaomi Power Bank 4i 20000mAh | Works with earphones', 'Audio'), 'Accessories & Storage');
});

test('featureNote takes the first plain sentence and drops the label', () => {
  assert.equal(featureNote(['Short.', 'BIG BATTERY: A 6000mAh battery lasts a full day. More text.']), 'A 6000mAh battery lasts a full day.');
  assert.equal(featureNote(['tiny']), null);
  assert.equal(featureNote(['POWERFULLY REFINED - 25W Super Fast Charging with Type C support.']), '25W Super Fast Charging with Type C support.');
  assert.equal(featureNote(['[Longest battery ever]: A full charge gives up to 54 hours of music.']), 'A full charge gives up to 54 hours of music.');
  assert.equal(featureNote(['Get access to our smartest assistant yet, all day long.', '4K Ultra HD (3840 x 2160) | Refresh Rate: 50 Hertz.']), null);
});

test('templateNotes write the saving, a feature and the proof with no banned characters', () => {
  const notes = templateNotes(parseProduct(PRODUCT_HTML));
  assert.equal(notes[0], "You save ₹13,500 right now. That's 44% off the ₹30,999 list price.");
  assert.equal(notes[2], '5K+ bought on Amazon in the past month');
  assert.equal(notes[3], 'Rated 4.1 by 2,518 buyers on Amazon');
  assert.ok(notes.every((n) => !/[–—…→←]/.test(n)));
});

test('interleave takes one from each queue in turn', () => {
  assert.deepEqual(interleave([[1, 2, 3], ['a'], []]), [1, 'a', 2, 3]);
});
