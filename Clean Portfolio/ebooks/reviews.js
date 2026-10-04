// Reader reviews for the ebook pages. Reviews live in reviews.json, keyed by the
// book slug used in data-reviews. Add a review only after the buyer says yes:
//   { "name": "Asha K.", "rating": 5, "text": "...", "date": "2026-10-12",
//     "photo": "/assets/reviews/asha.jpg" }   (photo is optional, with consent)
// With no reviews the section shows a plain invite, no stars and no counts.
// Star ratings in the page's structured data appear only from 3 reviews up.
(() => {
  const host = document.querySelector('[data-reviews]');
  if (!host) return;
  const slug = host.dataset.reviews;
  const title = host.dataset.title || 'this ebook';
  const MIN_FOR_SCHEMA = 3;
  const mailto = 'mailto:dibyajyotikabi@gmail.com?subject=' + encodeURIComponent('Review: ' + title) +
    '&body=' + encodeURIComponent('Name (as I should show it):\nRating (1 to 5):\nYour review:\n\nI am happy for this to be published on the book page: yes / no\n');

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  const invite = () => {
    const p = el('p', 'reviews-invite');
    p.append('Read it? A short, honest review helps the next reader decide. ');
    const a = el('a', null, 'Send yours');
    a.href = mailto;
    p.append(a, '. I only publish reviews with your OK.');
    return p;
  };

  const card = (r) => {
    const item = el('li', 'review');
    if (r.photo) {
      const img = el('img', 'review-photo');
      img.src = r.photo;
      img.alt = r.name;
      img.width = 44;
      img.height = 44;
      img.loading = 'lazy';
      item.append(img);
    }
    const body = el('div', 'review-body');
    const rating = el('p', 'review-stars', stars(r.rating));
    rating.setAttribute('aria-label', r.rating + ' out of 5 stars');
    body.append(rating, el('p', 'review-text', r.text), el('p', 'review-by', r.name + (r.date ? ', ' + r.date : '')));
    item.append(body);
    return item;
  };

  const addSchema = (reviews, average) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: title,
      aggregateRating: { '@type': 'AggregateRating', ratingValue: average.toFixed(1), reviewCount: reviews.length, bestRating: 5 },
      review: reviews.map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.name },
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        reviewBody: r.text
      }))
    });
    document.head.append(script);
  };

  const render = (all) => {
    const reviews = all.filter((r) => r && r.name && r.text && r.rating >= 1 && r.rating <= 5);
    if (!reviews.length) {
      host.append(invite());
      return;
    }
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const summary = el('p', 'reviews-summary');
    summary.append(el('strong', null, average.toFixed(1) + ' out of 5'), ' from ' + reviews.length + (reviews.length === 1 ? ' reader review' : ' reader reviews'));
    const list = el('ul', 'reviews-list');
    reviews.forEach((r) => list.append(card(r)));
    host.append(summary, list, invite());
    if (reviews.length >= MIN_FOR_SCHEMA) addSchema(reviews, average);
  };

  fetch('reviews.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => render(Array.isArray(data[slug]) ? data[slug] : []))
    .catch(() => host.append(invite()));
})();
