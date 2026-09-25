import { SITE_URL, profile } from '../config/site.js';

const HOME_URL = `${SITE_URL}/`;
const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function absoluteUrl(path = '/') {
  if (!path) return SITE_URL;
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function defaultSeo() {
  return {
    title: `Co-founder & Chief Developer at Hatchnix | ${profile.name}`,
    description: profile.description,
    url: HOME_URL,
    image: absoluteUrl('/portrait.jpg'),
    imageAlt: profile.imageAlt,
    type: 'website',
  };
}

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: HOME_URL,
        name: profile.name,
        description: profile.description,
        inLanguage: 'en-IN',
      },
      {
        '@type': 'ProfilePage',
        '@id': `${SITE_URL}/#profile`,
        url: HOME_URL,
        name: `${profile.name} — ${profile.jobTitle}`,
        description: profile.description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: profile.name,
        url: HOME_URL,
        image: absoluteUrl(profile.photo),
        jobTitle: profile.jobTitle,
        worksFor: {
          '@type': 'Organization',
          name: 'Hatchnix',
          alternateName: 'RMG Media India',
          url: 'https://hatchnix.com/',
        },
        description: profile.description,
        address: {
          '@type': 'PostalAddress',
          addressLocality: profile.address.locality,
          addressRegion: profile.address.region,
          addressCountry: profile.address.country,
        },
        sameAs: [profile.github, profile.linkedin],
        knowsAbout: profile.knowsAbout,
      },
    ],
  };
}
