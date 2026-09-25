import { profile } from '../config/site.js';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer reveal is-visible" aria-label="Site footer">
      <div className="site-footer-glow" aria-hidden="true" />
      <div className="site-footer-grid" aria-hidden="true" />
      <div className="site-footer-grain" aria-hidden="true" />
      <div className="site-footer-inner">
        <div className="site-footer-meta">
          <p className="site-footer-copy">
            © {year} {profile.name}. Built in Bhubaneswar.
            <br />
            Developed and maintained by <a href="https://hatchnix.com/">hatchnix.com</a> with ❤️
          </p>
          <nav className="site-footer-nav" aria-label="Footer">
            <a href="/">Current website</a>
            <a href={profile.github} rel="me noreferrer">
              GitHub
            </a>
            <a href={profile.linkedin} rel="me noreferrer">
              LinkedIn
            </a>
          </nav>
        </div>
        <div className="site-footer-mark-wrap">
          <p className="site-footer-mark" aria-hidden="true">
            {profile.footerMark}
          </p>
        </div>
      </div>
    </footer>
  );
}
