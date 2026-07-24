import postsData from '../generated/posts.json';

export function getAllPosts({ includeDrafts = false } = {}) {
  return postsData
    .filter((post) => includeDrafts || !post.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug) {
  return getAllPosts({ includeDrafts: true }).find((post) => post.slug === slug) || null;
}

export function formatPostDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
