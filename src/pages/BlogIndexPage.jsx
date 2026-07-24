import { Link } from 'react-router-dom';
import { ArrowUpRight, Calendar } from 'lucide-react';
import Seo from '../components/Seo.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { formatPostDate, getAllPosts } from '../lib/posts.js';
import { blogIndexJsonLd, blogIndexSeo } from '../lib/seo.js';

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <>
      <Seo {...blogIndexSeo()} jsonLd={blogIndexJsonLd()} />
      <main className="page" id="main-content">
        <section className="section-shell blog-hero reveal is-visible">
          <Link className="blog-back-link" to="/">
            ← Back to portfolio
          </Link>
          <h1>Blog</h1>
          <p className="section-lede">
            Notes on agent workflows, WordPress at scale, technical SEO, and publishing operations.
          </p>
        </section>

        <section className="section-shell reveal is-visible">
          <div className="blog-list">
            {posts.map((post) => (
              <article className="blog-card" key={post.slug}>
                <div>
                  <h2>
                    <Link className="blog-card-title-link" to={`/blogs/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h2>
                  <p>{post.description}</p>
                  <span className="blog-date">
                    <Calendar size={12} />
                    {formatPostDate(post.date)}
                  </span>
                </div>
                <Link className="blog-read-link" to={`/blogs/${post.slug}`}>
                  Read
                  <ArrowUpRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
