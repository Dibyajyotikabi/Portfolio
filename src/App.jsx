import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { getCalApi } from '@calcom/embed-react';
import { profile } from './config/site.js';
import HeroAmbientField from './components/HeroAmbientField.jsx';
import Seo from './components/Seo.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { defaultSeo, homeJsonLd } from './lib/seo.js';
import {
  ArrowUpRight,
  Bot,
  Briefcase,
  Calendar,
  ChevronDown,
  Cpu,
  Globe,
  Mail,
  MapPin,
  Menu,
  Moon,
  Award,
  Sun,
  Terminal,
  X,
} from 'lucide-react';
import {
  siGithub,
  siJavascript,
  siLinux,
  siMysql,
  siPhp,
  siPython,
  siReact,
  siWordpress,
} from 'simple-icons';

const siLinkedin = {
  title: 'LinkedIn',
  path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
};

const highlights = [
  { label: '~$150K exit', detail: 'Built and sold RootMyGalaxy' },
  { label: 'Hatchnix', detail: 'Co-founder & Chief Developer' },
  { label: 'TheDroidGuru', detail: 'Operations department' },
];

const featuredIn = ['Forbes', 'TechCrunch', 'Beebom', 'GSM Arena', 'India Today'];

const stats = [
  { label: 'Years experience', value: 10, suffix: '+', note: 'WordPress · web · publishing ops' },
  { label: 'Projects shipped', value: 120, suffix: '+', note: 'Themes, plugins, audits, fixes' },
  { label: 'Exit value', value: 150, prefix: '$', suffix: 'K', note: 'RootMyGalaxy.net acquisition' },
  { label: 'Faster loads', value: 70, suffix: '%', note: 'Average across optimised sites' },
];

const services = [
  {
    number: '01',
    title: 'Hermes & OpenClaw Agent Systems',
    description:
      'Hermes runbooks, OpenClaw-style messaging gateways, subagent routing, cron jobs, approval gates, and production-safe editorial automation.',
  },
  {
    number: '02',
    title: 'AI Automation & MCP Workflows',
    description:
      'Custom MCP servers, skills, hooks, and orchestration for SEO QA, brand voice, publishing pipelines, and repeatable ops — not one-off chat prompts.',
  },
  {
    number: '03',
    title: 'Codex, Gemini & Cursor Setup',
    description:
      'Codex CLI, Gemini API, and Cursor harness wiring: rules, skills, model routing, MCP config, and local/cloud boundaries teams can maintain.',
  },
  {
    number: '04',
    title: 'WordPress Development',
    description:
      'Custom themes, GeneratePress builds, landing pages, reusable blocks, and publishing-platform architecture for content-heavy sites.',
  },
  {
    number: '05',
    title: 'Custom Plugin & Integration Work',
    description:
      'PHP plugins, admin tools, shortcodes, API integrations, database workflows, and custom features tied to real editorial or business logic.',
  },
  {
    number: '06',
    title: 'Technical SEO',
    description:
      'Lean technical SEO only: schema, crawl/index hygiene, Search Console fixes, and on-page structure — no generic content-marketing packages.',
  },
];

const skillBars = [
  { name: 'Agent Systems (Hermes / OpenClaw)', value: 92 },
  { name: 'AI Automation & MCP', value: 90 },
  { name: 'WordPress Architecture', value: 96 },
  { name: 'Codex / Gemini / Cursor Setup', value: 85 },
  { name: 'Custom Plugin Development', value: 84 },
  { name: 'Technical SEO', value: 88 },
  { name: 'Publishing Operations', value: 92 },
];

const techTags = [
  'Hermes Agent',
  'OpenClaw',
  'MCP',
  'Codex CLI',
  'Gemini API',
  'Cursor',
  'WordPress',
  'PHP',
  'GeneratePress',
  'Search Console',
  'Schema.org',
  'Cloudflare',
];

const certifications = [
  { issuer: 'Google Skillshop', title: 'Google Analytics Certification', focus: 'Analytics & measurement' },
  { issuer: 'HubSpot Academy', title: 'HubSpot SEO Certification', focus: 'Technical SEO' },
  { issuer: 'Yoast Academy', title: 'Yoast SEO Academy', focus: 'On-page SEO systems' },
  { issuer: 'WordPress.org', title: 'Learn WordPress', focus: 'CMS & publishing' },
  { issuer: 'Google web.dev', title: 'Learn Performance', focus: 'Core Web Vitals' },
  { issuer: 'Cloudflare', title: 'Cloudflare Learning Center', focus: 'CDN & edge delivery' },
  { issuer: 'Semrush / Ahrefs', title: 'SEO & Digital Marketing', focus: 'Search strategy' },
  { issuer: 'Microsoft / IBM', title: 'Web, Cloud & Digital Skills', focus: 'Cloud foundations' },
  { issuer: 'Cisco · Udemy', title: 'CCNA 200-301', focus: 'Networking', year: '2023' },
  { issuer: 'Great Learning', title: 'Computer Networking', focus: 'Network operations', year: '2022' },
  { issuer: 'Aptech', title: 'Web Designing & Development', focus: 'Design & development', year: '2024' },
];

const terminalBanner = [
  {
    kind: 'out',
    text: 'dibyajyotikabi@workstation:~/portfolio$ type help to begin',
  },
];

const terminalCommands = {
  help: [
    'available commands:',
    '  about         quick bio',
    '  skills        proficiency snapshot',
    '  projects      selected work',
    '  contact       say hi',
    '  socials       github / web / email',
    '  whoami        identity check',
    '  clear         reset the screen',
  ],
  about: [
    'co-founder & chief developer @ hatchnix (formerly rmg media india)',
    'wordpress + publishing operator based in bhubaneswar, odisha',
    'agent stacks: hermes patterns, openclaw gateways, mcp tooling',
    'sold rootmygalaxy.net for $150K',
  ],
  skills: skillBars.map((item) => `${item.name.toLowerCase()} · ${item.value}%`),
  projects: [
    '→ hermes editorial automation',
    '→ openclaw ops hub',
    '→ rootmygalaxy.net · sold (~$150K)',
    '→ hatchnix · co-founder & chief developer',
    '→ thedroidguru.com · operations',
    '→ sam updater · samsung release tracking',
  ],
  contact: [
    'email   · dibyajyotikabi@gmail.com',
    'website · dibyajyotikabi.com',
    'cal     · cal.com/dibyajyoti-kabi-5wxb99/15min',
  ],
  socials: [
    'github   · github.com/Dibyajyotikabi',
    'linkedin · linkedin.com/in/dibyajyotikabi',
    'website  · dibyajyotikabi.com',
  ],
  whoami: ['dibyajyoti kabi'],
};

const socials = [
  { label: 'LinkedIn', href: profile.linkedin, icon: siLinkedin },
  { label: 'GitHub', href: profile.github, icon: siGithub },
  { label: 'Website', href: profile.website, Lucide: Globe },
];

const infoRows = [
  { Icon: Briefcase, text: 'Co-founder & Chief Developer @ Hatchnix · Ops @ TheDroidGuru' },
  { Icon: MapPin, text: profile.location },
  { Icon: Mail, text: profile.email },
  { Icon: Bot, text: '10+ years building web apps · 3+ years in agent workflows' },
];

const skills = [
  { name: 'WordPress', icon: siWordpress },
  { name: 'Python', icon: siPython },
  { name: 'PHP', icon: siPhp },
  { name: 'JavaScript', icon: siJavascript },
  { name: 'React', icon: siReact },
  { name: 'MySQL', icon: siMysql },
  { name: 'Linux', icon: siLinux },
  { name: 'Hermes / MCP', Lucide: Bot },
];

const experience = [
  {
    company: 'Hatchnix',
    role: 'Co-founder & Chief Developer',
    period: 'Present',
    href: 'https://hatchnix.com/',
    detail:
      'At Hatchnix (formerly RMG Media India), I lead development across content systems, WordPress workflows, performance, SEO, and publishing infrastructure.',
  },
  {
    company: 'TheDroidGuru.com',
    role: 'Operations Lead',
    period: '2023 – Present',
    href: 'https://thedroidguru.com',
    detail:
      'Overseeing editorial workflows, Android firmware coverage, WordPress maintenance, uptime, and Core Web Vitals improvements for a high-traffic publication.',
  },
  {
    company: 'Independent Consulting',
    role: 'Agent Systems Architect & WordPress Engineer',
    period: '2018 – Present',
    href: `mailto:${profile.email}?subject=Project%20Inquiry`,
    detail:
      'Hermes and OpenClaw agent systems, custom themes and plugins, technical SEO audits, CWV fixes, and publishing-operations retainers for content-heavy teams.',
  },
  {
    company: 'RootMyGalaxy.net',
    role: 'Founder & Publisher (exited ~$150K)',
    period: '2018 – 2023',
    href: 'https://rootmygalaxy.net',
    detail:
      'Built and scaled a high-traffic Android technology site, improved WordPress performance, led content operations, and sold the property for $150,000.',
  },
];

const accents = {
  amber: 'oklch(75% 0.15 76)',
  forest: 'oklch(67% 0.16 148)',
  cobalt: 'oklch(58% 0.18 260)',
  plum: 'oklch(61% 0.2 310)',
  crimson: 'oklch(62% 0.2 18)',
};

const mailProject = (subject) =>
  `mailto:${profile.email}?subject=${encodeURIComponent(subject)}`;

const projects = [
  {
    title: 'Hermes Editorial Automation',
    label: 'Hermes Agent',
    status: 'Building',
    live: false,
    accent: accents.cobalt,
    image: '/project-images/hermes-agent-interface.jpg',
    imageAlt:
      'Hermes Agent desktop interface with sessions, tools, messaging, artifacts, and project files.',
    description:
      'Hermes-based automation for publishing teams: gateway to Slack/Telegram, scheduled jobs, MCP skills for SEO and brand voice, and isolated subagents for QA vs production.',
    stack: [siPython, siJavascript],
    href: mailProject('Portfolio: Hermes editorial work'),
  },
  {
    title: 'OpenClaw Ops Hub',
    label: 'OpenClaw',
    status: 'Live',
    live: true,
    accent: accents.forest,
    image: '/project-images/openclaw-ops-hub-logo-v2.jpg',
    imageAlt:
      'OpenClaw mascot inside a dark operations hub with routed channels and an approval gate.',
    description:
      'Multi-channel OpenClaw rollouts with MCP-backed skills, channel routing, and approval gates so newsroom operators can trust the loop.',
    stack: [siPython, siJavascript],
    href: mailProject('Portfolio: OpenClaw gateway work'),
  },
  {
    title: 'OpenClaw to Hermes Migration',
    label: 'Migration',
    status: 'Live',
    live: true,
    accent: accents.plum,
    image: '/project-images/openclaw-hermes-migration-logo-v2.jpg',
    imageAlt:
      'OpenClaw and Hermes Agent logos connected by a controlled data migration bridge.',
    description:
      'Stack migrations using the official import path: personas, memories, skills, gateway pairing, and allowlisted secrets without rewriting playbooks.',
    stack: [siPython, siJavascript],
    href: mailProject('Portfolio: Hermes/OpenClaw migration'),
  },
  {
    title: 'RootMyGalaxy Growth & Exit',
    label: 'Scale & Exit',
    status: 'Live',
    live: true,
    accent: accents.crimson,
    image: '/project-images/rootmygalaxy-growth-exit.jpg',
    imageAlt:
      'Editorial growth represented by smartphones, article stacks, an ascending chart, and an acquisition handoff.',
    description:
      'Built and scaled a high-traffic Android publication, improved WordPress performance, led editorial ops, and sold for $150,000.',
    stack: [siWordpress, siPhp],
    href: 'https://rootmygalaxy.net',
  },
  {
    title: 'Hatchnix',
    label: 'Publishing & Engineering',
    status: 'Live',
    live: true,
    accent: accents.amber,
    image: '/project-images/rmg-media-operations.jpg',
    imageAlt:
      'Tactile media operations studio coordinating three distinct publishing stations.',
    description:
      'Co-founded Hatchnix (formerly RMG Media India) and lead development of content systems, WordPress workflows, and publishing infrastructure.',
    stack: [siWordpress, siPhp],
    href: 'https://hatchnix.com/',
  },
  {
    title: 'TheDroidGuru Operations',
    label: 'Publishing Systems',
    status: 'Live',
    live: true,
    accent: accents.cobalt,
    image: '/project-images/thedroidguru-site-screenshot.jpg',
    imageAlt:
      'TheDroidGuru homepage showing its firmware, mobile news, and how-to publishing layout.',
    description:
      'Operational workflows for firmware updates, how-to guides, news coverage, uptime, and Core Web Vitals on a live Android publication.',
    stack: [siWordpress, siPhp],
    href: 'https://thedroidguru.com',
  },
  {
    title: 'CMDU Post Scheduler',
    label: 'WordPress Plugin',
    status: 'Live',
    live: true,
    accent: accents.forest,
    image: '/project-images/cmdu-post-scheduler.jpg',
    imageAlt:
      'Mechanical calendar and clockwork queue moving scheduled article cards into a publishing tray.',
    description:
      'Custom plugin for scheduled publishing, database workflows, and editorial update cadences built for newsroom re-publish cycles.',
    stack: [siWordpress, siPhp, siMysql],
    href: 'https://github.com/Dibyajyotikabi/cmdu-wordpress-plugin',
  },
  {
    title: 'Home Network Setup',
    label: 'Infrastructure',
    status: 'Docs',
    live: false,
    accent: accents.plum,
    image: '/project-images/home-network-setup.jpg',
    imageAlt:
      'Home router and network switch connecting computers, mobile devices, and wireless equipment.',
    description:
      'Router and switch configuration examples for stable multi-device networking, routing practice, and troubleshooting documentation.',
    stack: [siLinux],
    href: 'https://github.com/Dibyajyotikabi/home-network-setup',
  },
  {
    title: 'Sam Updater',
    label: 'SEO Automation',
    status: 'Live',
    live: true,
    accent: accents.cobalt,
    image: '/project-images/sam-updater-site-screenshot.jpg',
    imageAlt:
      'SamUpdater homepage showing firmware tools, security-update coverage, and Samsung guides.',
    description:
      'Samsung update tracking workflow with API integration and SEO-focused content freshness patterns for recurring Android update coverage.',
    stack: [siWordpress, siPhp],
    href: mailProject('Portfolio: Sam Updater'),
  },
  {
    title: 'Info-box Shortcode',
    label: 'Editorial Component',
    status: 'Live',
    live: true,
    accent: accents.amber,
    image: '/project-images/info-box-shortcode.jpg',
    imageAlt:
      'Modular article layout with a reusable information panel fitting into the editorial page.',
    description:
      'Lightweight WordPress shortcode plugin for styled information boxes inside articles, built for reusable editorial formatting.',
    stack: [siWordpress, siPhp],
    href: mailProject('Portfolio: Info-box shortcode'),
  },
  {
    title: 'Network Protocols & Troubleshooting',
    label: 'Network Docs',
    status: 'Docs',
    live: false,
    accent: accents.plum,
    image: '/project-images/network-protocols.jpg',
    imageAlt:
      'Physical network topology map with routed packets and a diagnostic tool inspecting one path.',
    description:
      'Practice configurations and step-by-step guides for common networking issues, RIP, OSPF, and related routing fundamentals.',
    stack: [siLinux],
    href: 'https://github.com/Dibyajyotikabi/Network_Protocols_Configurations',
  },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getInitialTheme() {
  const saved = localStorage.getItem('portfolio-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

function buildFallbackDays() {
  const days = [];
  const today = new Date();
  for (let i = 364; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const seed = (i * 7 + (i % 11) * 3 + (i % 5)) % 6;
    const level = seed > 4 ? 0 : seed;
    days.push({ date: date.toISOString().slice(0, 10), count: level, level });
  }
  return days;
}

function useGithubContributions(username) {
  const [state, setState] = useState({ status: 'loading', days: [], total: 0 });

  useEffect(() => {
    let alive = true;
    fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((json) => {
        if (!alive) return;
        const days = Array.isArray(json.contributions) ? json.contributions : [];
        if (!days.length) throw new Error('empty');
        const total = days.reduce((sum, day) => sum + (day.count || 0), 0);
        setState({ status: 'ready', days, total });
      })
      .catch(() => {
        if (!alive) return;
        setState({ status: 'fallback', days: buildFallbackDays(), total: 0 });
      });
    return () => {
      alive = false;
    };
  }, [username]);

  return state;
}

function BrandIcon({ icon, size = 16, title, className = '' }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-label={title || icon.title}
      className={className}
    >
      <path d={icon.path} />
    </svg>
  );
}

function SkillGlyph({ skill, size = 15 }) {
  if (skill.icon) return <BrandIcon icon={skill.icon} size={size} title={skill.name} />;
  const Lucide = skill.Lucide;
  return <Lucide size={size} />;
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);

  return null;
}

function useRevealOnRoute() {
  const { pathname } = useLocation();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    const bindReveals = () => {
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => {
        const rect = element.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
        if (inView) {
          element.classList.add('is-visible');
          return;
        }
        observer.observe(element);
      });
    };

    const immediate = window.requestAnimationFrame(bindReveals);
    const afterPaint = window.setTimeout(bindReveals, 0);
    const afterRoute = window.setTimeout(bindReveals, 120);

    return () => {
      window.cancelAnimationFrame(immediate);
      window.clearTimeout(afterPaint);
      window.clearTimeout(afterRoute);
      observer.disconnect();
    };
  }, [pathname]);
}

function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [time, setTime] = useState('');
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('portfolio-theme', theme);
  }, [theme]);

  useEffect(() => {
    getCalApi().catch(() => {});
  }, []);

  useEffect(() => {
    const formatTime = () => {
      setTime(
        new Intl.DateTimeFormat('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        }).format(new Date()),
      );
    };
    formatTime();
    const timer = window.setInterval(formatTime, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useRevealOnRoute();

  useEffect(() => {
    const handlePointerMove = (event) => {
      document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`);
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="ambient-backdrop" aria-hidden="true" />
      <ScrollToTop />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              theme={theme}
              onThemeToggle={toggleTheme}
              time={time}
            />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {showBackTop ? (
        <a className="back-top reveal is-visible" href="#top" aria-label="Back to top">
          <ArrowUpRight size={16} className="back-top-icon" />
        </a>
      ) : null}
    </div>
  );
}

function HomePage({ theme, onThemeToggle, time }) {
  return (
    <>
      <Seo {...defaultSeo()} jsonLd={homeJsonLd()} />
      <main className="page" id="main-content">
        <HeroBanner theme={theme} onThemeToggle={onThemeToggle} />
        <ProfileCard time={time} />
        <HighlightsStrip />
        <FeaturedInSection />
        <InfoRail />
        <AboutSection />
        <ServicesSection />
        <TerminalSection />
        <ExperienceSection />
        <ProjectsSection />
        <SkillsSection />
        <CertificationsSection />
        <ContactSection />
        <SiteFooter />
      </main>
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <Seo
        title={`Page not found | ${profile.name}`}
        description="The requested page could not be found."
        robots="noindex, nofollow"
      />
      <main className="page" id="main-content">
        <section className="section-shell not-found reveal is-visible">
          <p className="not-found-eyebrow">404</p>
          <h1>Page not found</h1>
          <p className="section-lede">The page may have moved or the address may be incorrect.</p>
          <Link className="text-link" to="/">
            Return to the portfolio
            <ArrowUpRight size={14} />
          </Link>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}

function HeroBanner({ theme, onThemeToggle }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);
  const menuToggleRef = useRef(null);
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  const navigationItems = [
    ['About', '#about'],
    ['Services', '#services'],
    ['Projects', '#work'],
    ['Certifications', '#certifications'],
    ['Contact', '#contact'],
  ];

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!navRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    };
    const closeOnDesktop = () => {
      if (window.innerWidth > 820) setMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktop);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <section className="hero-band reveal" aria-label="Intro">
      <Link to="/" className="hero-logo" aria-label="Home">
        <span className="hero-logo-monogram" aria-hidden="true">
          DK
        </span>
        <span className="hero-logo-name" aria-hidden="true">
          Dibyajyoti
          <br />
          Kabi
        </span>
      </Link>
      <nav
        className={`hero-nav${menuOpen ? ' is-menu-open' : ''}`}
        aria-label="Section navigation"
        ref={navRef}
      >
        <div className="hero-nav-links">
          {navigationItems.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </div>
        <div className="hero-nav-controls">
          <button type="button" aria-label="Toggle theme" onClick={onThemeToggle}>
            <ThemeIcon size={15} />
          </button>
          <button
            className="hero-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-controls="hero-mobile-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            ref={menuToggleRef}
          >
            {menuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
        <div
          className="hero-mobile-menu"
          id="hero-mobile-menu"
          hidden={!menuOpen}
        >
          <div className="hero-mobile-menu-heading" aria-hidden="true">
            <span>Navigate</span>
            <span>01—05</span>
          </div>
          {navigationItems.map(([label, href], index) => (
            <a href={href} key={href} onClick={closeMenu}>
              <span>{label}</span>
              <span className="hero-mobile-menu-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
            </a>
          ))}
        </div>
      </nav>
      <div className="hero-texture" aria-hidden="true" />
      <div className="hero-copy">
        <p className="hero-kicker">
          <span aria-hidden="true" />
          Co-founder &amp; Chief Developer at Hatchnix · India / worldwide
        </p>
        <h1 className="hero-headline">
          <span className="hero-headline-primary">{profile.tagline[0]}</span>
          <span className="hero-headline-accent">
            {profile.tagline[1]}
            <br />
            {profile.tagline[2]}
          </span>
        </h1>
        <p className="hero-summary">
          As co-founder and chief developer at Hatchnix, I build dependable agent
          workflows, publishing infrastructure, and WordPress systems for teams that
          need speed without chaos.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#work">
            <span>Explore selected work</span>
            <span className="button-icon" aria-hidden="true">
              <ArrowUpRight size={15} />
            </span>
          </a>
          <a className="hero-text-link" href="#services">
            See capabilities
          </a>
        </div>
        <div className="hero-proof" aria-label="Areas of expertise">
          <span>Hermes + MCP</span>
          <span>WordPress</span>
          <span>Publishing ops</span>
        </div>
      </div>
      <HeroAmbientField key="minimal-ambient-field-v2" />
    </section>
  );
}

const CAL_EMBED_TIMEOUT_MS = 5000;

async function openCalBooking(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();

  const openFallback = () => {
    window.open(profile.cal.url, '_blank', 'noopener,noreferrer');
  };

  try {
    const cal = await Promise.race([
      getCalApi(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('Cal embed timeout')), CAL_EMBED_TIMEOUT_MS);
      }),
    ]);
    const isDark = document.documentElement.dataset.theme === 'dark';
    cal('modal', {
      calLink: profile.cal.link,
      config: { layout: 'month_view', theme: isDark ? 'dark' : 'light' },
    });
  } catch {
    openFallback();
  }
}

function ProfileCard({ time }) {
  return (
    <section className="profile-card reveal" aria-label="Profile">
      <div className="profile-head">
        <div className="identity">
          <div className="avatar" aria-label={`${profile.name} portrait`}>
            <img src={profile.photo} alt={profile.name} width="86" height="86" loading="eager" />
            <div className="avatar-sweep" aria-hidden="true" />
            <div className="online-dot" aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">
              <span className="availability-dot" aria-hidden="true" />
              Available for select consulting engagements
            </span>
            <p className="profile-name">
              <span className="profile-name-text">{profile.name.toUpperCase()}</span>
            </p>
            <p className="profile-role">Co-founder &amp; Chief Developer at Hatchnix · Publishing infrastructure</p>
          </div>
        </div>
        <span className="time-pill">IST {time}</span>
      </div>

      <div className="action-row">
        <a className="button primary" href={`mailto:${profile.email}?subject=Project%20Inquiry`}>
          <Mail size={15} />
          Get in touch
        </a>
        <a
          className="button secondary"
          href={profile.cal.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openCalBooking}
        >
          <Calendar size={15} />
          Book a Meet
        </a>
        <div className="social-row" aria-label="Social links">
          {socials.map(({ label, href, icon, Lucide }) => (
            <a
              className="icon-button"
              href={href}
              key={label}
              aria-label={label}
              target="_blank"
              rel="noreferrer"
            >
              {icon ? (
                <BrandIcon icon={icon} size={16} title={label} />
              ) : Lucide ? (
                <Lucide size={16} />
              ) : null}
            </a>
          ))}
        </div>
      </div>

    </section>
  );
}

function HighlightsStrip() {
  return (
    <section className="section-shell highlights-strip reveal" aria-label="Career highlights">
      {highlights.map((item) => (
        <article className="highlight-card" key={item.label}>
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </article>
      ))}
    </section>
  );
}

function FeaturedInSection() {
  return (
    <section className="section-shell featured-strip reveal" aria-label="Featured in">
      <div className="featured-intro">
        <p className="featured-kicker">Selected press</p>
        <p className="featured-title">
          Featured <em>in</em>
        </p>
      </div>
      <ul className="featured-list">
        {featuredIn.map((name, index) => (
          <li key={name}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <strong>{name}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatCard({ label, value, prefix = '', suffix = '', note }) {
  const ref = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const start = performance.now();
        const duration = 1400;
        const tick = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - progress) ** 3;
          setDisplayValue(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return (
    <article className="stat-card" ref={ref}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">
        {prefix}
        {displayValue}
        <span>{suffix}</span>
      </p>
      <p className="stat-note">{note}</p>
    </article>
  );
}

function InfoRail() {
  return (
    <section className="section-shell info-rail reveal" aria-label="Quick facts">
      {infoRows.map(({ Icon, text }) => (
        <div className="info-row" key={text}>
          <span className="mini-icon">
            <Icon size={15} />
          </span>
          <p>{text}</p>
        </div>
      ))}
    </section>
  );
}

function AboutSection() {
  const { status, days, total } = useGithubContributions(profile.githubUser);

  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);

  const monthMarks = useMemo(() => {
    const marks = [];
    let lastMonth = -1;
    weeks.forEach((week, index) => {
      const first = week[0];
      if (!first) return;
      const month = new Date(first.date).getMonth();
      if (month !== lastMonth) {
        marks.push({ index, label: MONTH_LABELS[month] });
        lastMonth = month;
      }
    });
    return marks;
  }, [weeks]);

  return (
    <section className="section-shell reveal" id="about">
      <h2>About</h2>
      <h3 className="about-heading">{profile.aboutHeading}</h3>

      <div className="stats-grid" aria-label="Career metrics">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="contribution-card" aria-label="GitHub contribution activity">
        <div className="contribution-scroll">
          <div className="months" aria-hidden="true">
            {monthMarks.map(({ index, label }) => (
              <span key={`${label}-${index}`} style={{ gridColumn: index + 1 }}>
                {label}
              </span>
            ))}
          </div>
          <div className="contribution-grid">
            {weeks.map((week, weekIndex) =>
              week.map((day, dayIndex) => (
                <span
                  className={`cell level-${day.level}`}
                  key={`${weekIndex}-${dayIndex}`}
                  title={`${day.count} on ${day.date}`}
                  style={{ gridRow: dayIndex + 1, gridColumn: weekIndex + 1 }}
                />
              )),
            )}
          </div>
        </div>
        <div className="activity-foot">
          <span>
            {status === 'ready'
              ? `${total} contributions on @${profile.githubUser} this year`
              : status === 'fallback'
                ? 'GitHub graph (offline preview)'
                : 'Loading GitHub activity…'}
          </span>
          <span>
            Less
            <i className="sample level-1" />
            <i className="sample level-2" />
            <i className="sample level-3" />
            <i className="sample level-4" />
            More
          </span>
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section className="section-shell reveal" id="services">
      <h2>Services</h2>
      <p className="section-lede">
        Agent systems, AI automation, WordPress builds, and lean technical SEO for publishers and content-heavy teams.
      </p>
      <div className="services-grid">
        {services.map((service) => (
          <article className="service-card" key={service.number}>
            <div className="service-index">
              <span>{service.number}</span>
            </div>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TerminalSection() {
  const [lines, setLines] = useState(terminalBanner);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  const runCommand = (raw) => {
    const command = raw.trim().toLowerCase();
    const promptLine = { kind: 'prompt', text: raw };
    if (!command) {
      setLines((current) => [...current, promptLine]);
      return;
    }
    if (command === 'clear') {
      setLines(terminalBanner);
      return;
    }
    const output = terminalCommands[command];
    if (output) {
      setLines((current) => [
        ...current,
        promptLine,
        ...output.map((text) => ({ kind: 'out', text })),
      ]);
      return;
    }
    setLines((current) => [
      ...current,
      promptLine,
      { kind: 'warn', text: `command not found: ${command} — try help` },
    ]);
  };

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  return (
    <section className="section-shell reveal" id="terminal">
      <h2>Coding Box</h2>
      <p className="section-lede">Interactive terminal — try typing <code>help</code>.</p>
      <div
        className="terminal-shell"
        onClick={() => inputRef.current?.focus()}
        onKeyDown={() => inputRef.current?.focus()}
        role="presentation"
      >
        <div className="terminal-bar">
          <span />
          <span />
          <span />
          <p>terminal — interactive</p>
        </div>
        <div className="terminal-body" ref={bodyRef}>
          {lines.map((line, index) => (
            <p className={`terminal-line terminal-${line.kind}`} key={`${line.kind}-${index}`}>
              {line.kind === 'prompt' ? (
                <>
                  <span className="terminal-accent">dibyajyotikabi</span>
                  <span className="terminal-muted">:~$</span> {line.text}
                </>
              ) : (
                line.text
              )}
            </p>
          ))}
          <div className="terminal-input-row">
            <span className="terminal-accent">dibyajyotikabi</span>
            <span className="terminal-muted">:~$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runCommand(input);
                  setInput('');
                }
              }}
              aria-label="Terminal command input"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SkillsSection() {
  const sectionRef = useRef(null);
  const [animateBars, setAnimateBars] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimateBars(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section-shell reveal" id="skills" ref={sectionRef}>
      <h2>Skills &amp; Technologies</h2>
      <div className="skill-bars">
        {skillBars.map((skill) => (
          <div className="skill-bar-row" key={skill.name}>
            <div className="skill-bar-head">
              <span>{skill.name}</span>
              <strong>{skill.value}%</strong>
            </div>
            <div className="skill-bar-track">
              <span
                className={`skill-bar-fill${animateBars ? ' is-visible' : ''}`}
                style={{ '--skill-value': `${skill.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="skills-grid">
        {skills.map((skill) => (
          <div className="skill-chip" key={skill.name}>
            <span className="skill-icon">
              <SkillGlyph skill={skill} />
            </span>
            <span>{skill.name}</span>
          </div>
        ))}
      </div>
      <div className="tech-tags" aria-label="Tools and platforms">
        {techTags.map((tag) => (
          <span className="tech-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className="capability-strip" aria-label="Capability focus">
        {['WP', 'SEO', 'CWV', 'Ops', 'Agents'].map((item) => (
          <span className="capability-pill" key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function CertificationsSection() {
  return (
    <section className="section-shell reveal" id="certifications">
      <h2>Certifications</h2>
      <p className="section-lede">
        Professional credentials across analytics, SEO, WordPress, performance, cloud, and networking.
      </p>
      <div className="cert-showcase">
        {certifications.map((cert, index) => (
          <article className="cert-card" key={`${cert.issuer}-${cert.title}`}>
            <div className="cert-card-head">
              <span className="cert-index">
                <Award size={13} aria-hidden="true" />
                {String(index + 1).padStart(2, '0')}
              </span>
              {cert.year ? <span className="cert-year">{cert.year}</span> : null}
            </div>
            <p className="cert-issuer">{cert.issuer}</p>
            <h3>{cert.title}</h3>
            <p className="cert-focus">{cert.focus}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExperienceSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section-shell reveal" id="experience">
      <h2>Experience</h2>
      <div className="experience-list">
        {experience.map((item, index) => {
          const open = openIndex === index;
          return (
            <article className={`experience-item${open ? ' is-open' : ''}`} key={item.company}>
              <button
                type="button"
                className="experience-trigger"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? -1 : index)}
              >
                <span className="experience-logo">
                  <Briefcase size={18} />
                </span>
                <span className="experience-copy">
                  <strong>{item.company}</strong>
                  <small>
                    {item.role} · {item.period}
                  </small>
                </span>
                <ChevronDown size={16} className="experience-chevron" aria-hidden="true" />
              </button>
              <div className="experience-panel" hidden={!open}>
                <p>{item.detail}</p>
                <a href={item.href} target="_blank" rel="noreferrer">
                  View work
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProjectsSection() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? projects : projects.slice(0, 3);

  return (
    <section className="section-shell reveal" id="work">
      <h2>Projects</h2>
      <div className="project-list">
        {visible.map((project) => (
          <article
            className="project-card"
            key={project.title}
            style={{ '--accent-card': project.accent }}
          >
            <ProjectVisual project={project} />
            <div className="project-body">
              <div>
                <span className="project-label">{project.label}</span>
                <h3>{project.title}</h3>
              </div>
              <span className={`status-badge${project.live ? ' live' : ''}`}>
                {project.live ? <span className="pulse" aria-hidden="true" /> : null}
                {project.status}
              </span>
            </div>
            <p>{project.description}</p>
            <div className="project-foot">
              <div className="stack-icons" aria-label="Tech stack">
                {project.stack.map((icon) => (
                  <span key={icon.slug || icon.title}>
                    <BrandIcon icon={icon} size={13} title={icon.title} />
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!showAll && projects.length > 3 ? (
        <button type="button" className="button more-button" onClick={() => setShowAll(true)}>
          More
          <ArrowUpRight size={14} />
        </button>
      ) : null}
    </section>
  );
}

function ProjectVisual({ project }) {
  return (
    <div className="project-visual">
      <img
        src={`${import.meta.env.BASE_URL}${project.image.replace(/^\//, '')}`}
        alt={project.imageAlt}
        width="1200"
        height="800"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function ContactSection() {
  return (
    <>
      <div className="footer-divider" aria-hidden="true" />
      <section className="section-shell quote-panel reveal" id="contact">
        <span className="quote-mark" aria-hidden="true">
          “
        </span>
        <blockquote>Let's build something fast and safe.</blockquote>
        <cite>{profile.name}</cite>
        <div className="contact-actions">
          <a className="button primary" href={`mailto:${profile.email}?subject=Project%20Inquiry`}>
            <Mail size={15} />
            Start a conversation
          </a>
          <a className="button secondary" href={profile.github} target="_blank" rel="noreferrer">
            <BrandIcon icon={siGithub} size={15} title="GitHub" />
            See GitHub
          </a>
        </div>
      </section>
    </>
  );
}

export default App;
