import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Tweet } from 'react-tweet';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    iframe: [...(defaultSchema.attributes?.iframe || []), 'src', 'title', 'allow', 'allowFullScreen', 'loading'],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'iframe'],
};

function getYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
    if (YOUTUBE_HOSTS.includes(parsed.hostname)) {
      return parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
    }
  } catch {
    return null;
  }
  return null;
}

function getTweetId(url) {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  return match?.[1] || null;
}

function YouTubeEmbed({ videoId }) {
  return (
    <div className="blog-embed blog-embed--video">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

function MarkdownLink({ href, children }) {
  if (!href) return <span>{children}</span>;

  const tweetId = getTweetId(href);
  if (tweetId) {
    return (
      <div className="blog-embed blog-embed--tweet">
        <Tweet id={tweetId} />
      </div>
    );
  }

  const external = href.startsWith('http');
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer noopener' : undefined}>
      {children}
    </a>
  );
}

function MarkdownParagraph({ children }) {
  if (typeof children?.[0] === 'string') {
    const text = children[0].trim();
    const youtubeId = getYouTubeId(text);
    if (youtubeId && children.length === 1) {
      return <YouTubeEmbed videoId={youtubeId} />;
    }
  }

  return <p>{children}</p>;
}

export default function BlogMarkdown({ content }) {
  return (
    <div className="blog-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          a: MarkdownLink,
          p: MarkdownParagraph,
          img: ({ src, alt }) => <img src={src} alt={alt || ''} loading="lazy" className="blog-image" />,
          h2: ({ children }) => <h2 id={slugify(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugify(children)}>{children}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function slugify(value) {
  const text = Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : '')).join('')
    : String(value ?? '');
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}
