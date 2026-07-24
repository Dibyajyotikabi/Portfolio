import { Helmet } from 'react-helmet-async';
import { profile } from '../config/site.js';

const DEFAULT_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

export default function Seo({
  title,
  description,
  url,
  image,
  imageAlt,
  type = 'website',
  publishedTime,
  modifiedTime,
  tags = [],
  jsonLd,
  robots = DEFAULT_ROBOTS,
}) {
  const safeTitle = title || profile.name;
  const safeDescription = description || '';
  const safeImage = image || '';
  const safeImageAlt = imageAlt || profile.imageAlt;
  const safeUrl = url || '';

  return (
    <Helmet>
      <title>{safeTitle}</title>
      {safeDescription ? <meta name="description" content={safeDescription} /> : null}
      <meta name="author" content={profile.name} />
      <meta name="robots" content={robots} />
      {safeUrl ? <link rel="canonical" href={safeUrl} /> : null}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={profile.name} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:title" content={safeTitle} />
      {safeDescription ? <meta property="og:description" content={safeDescription} /> : null}
      {safeUrl ? <meta property="og:url" content={safeUrl} /> : null}
      {safeImage ? <meta property="og:image" content={safeImage} /> : null}
      {safeImage ? <meta property="og:image:alt" content={safeImageAlt} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={safeTitle} />
      {safeDescription ? <meta name="twitter:description" content={safeDescription} /> : null}
      {safeImage ? <meta name="twitter:image" content={safeImage} /> : null}
      {safeImage ? <meta name="twitter:image:alt" content={safeImageAlt} /> : null}
      {type === 'article' && publishedTime ? (
        <meta property="article:published_time" content={publishedTime} />
      ) : null}
      {type === 'article' && modifiedTime ? (
        <meta property="article:modified_time" content={modifiedTime} />
      ) : null}
      {tags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>
      ) : null}
    </Helmet>
  );
}
