import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import BlogMarkdown from '../components/BlogMarkdown.jsx';
import Seo from '../components/Seo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { profile } from '../config/site.js';
import { formatPostDate, getPostBySlug } from '../lib/posts.js';
import { articleJsonLd, postSeo } from '../lib/seo.js';

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post || (post.draft && import.meta.env.PROD)) {
    return <Navigate to="/blogs" replace />;
  }

  const seo = postSeo(post);

  return (
    <>
      <Seo {...seo} jsonLd={articleJsonLd(post)} />
      <main className="page" id="main-content">
        <article className="section-shell blog-article reveal is-visible">
          <Link className="blog-back-link" to="/blogs">
            <ArrowLeft size={14} />
            All posts
          </Link>

          <header className="blog-article-head">
            <p className="blog-article-eyebrow">Article</p>
            <h1>{post.title}</h1>
            <p className="blog-article-description">{post.description}</p>
            <div className="blog-article-meta">
              <div className="blog-article-byline">
                <span className="blog-author">
                  By <Link to="/#about">{profile.name}</Link>
                </span>
                <span className="blog-date">
                  <Calendar size={12} />
                  {formatPostDate(post.date)}
                </span>
              </div>
              {post.tags.length ? (
                <ul className="blog-tag-list">
                  {post.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            {post.image ? (
              <img
                className="blog-hero-image"
                src={post.image}
                alt={`${post.title} cover`}
                loading="eager"
              />
            ) : null}
          </header>

          <BlogMarkdown content={post.content} />
        </article>

        <SiteFooter />
      </main>
    </>
  );
}
