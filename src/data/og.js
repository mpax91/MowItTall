// Share cards (Open Graph images). Every page listed here gets a 1200x630 PNG at /og/<slug>.png,
// drawn at build time by src/pages/og/[slug].png.js. Base.astro uses it automatically when one exists.
// Blog posts, guides and blog topics are added automatically; static pages are listed by hand below.
import { TOPICS } from './topics.js';

export const OG_PAGES = {
  '/': { title: 'A Better Lawn, Without Becoming a Lawn Guy', kicker: 'Free Lawn Plan' },
  '/plan/': { title: 'Get Your Free Lawn Plan in 2 Minutes', kicker: 'The Quiz' },
  '/lawn-101/': { title: 'Lawn Care 101: Six Small Habits That Fix Most Lawns', kicker: 'Start Here' },
  '/resources/': { title: 'Free Lawn Tools That Do the Thinking for You', kicker: 'Free Tools' },
  '/calendar/': { title: 'The Lawn Calendar: What to Do Each Month', kicker: 'Free Tool' },
  '/measure/': { title: 'How Big Is My Lawn? Measure It on a Map', kicker: 'Free Tool' },
  '/weeds/': { title: 'What’s That Weed? Northeast Lawn Weeds With Photos', kicker: 'Weed Guide' },
  '/yards/': { title: 'Real Stripes. No Filters. Bedford, NY.', kicker: 'Photos' },
  '/hall/': { title: 'The Lawn Hall of Fame (and Hall of Shame)', kicker: 'Vote Now' },
  '/games/': { title: 'Mow Perfect Stripes. Whack the Weeds. Spare the Bees.', kicker: 'Lawn Games' },
  '/blog/': { title: 'Lawn Takes. Some Hot. All Short.', kicker: 'The Blog' },
  '/guides/': { title: 'Straight Answers to Lawn Questions', kicker: 'Lawn Guides' },
  '/neighbor/': { title: 'Send a Neighbor a Free Lawn Plan', kicker: 'Anonymous Option' },
  '/merch/': { title: 'Merch for People Who Mow Tall', kicker: 'Coming Soon' },
};

const slugOf = (k) => k.split('/').pop().replace(/\.md$/, '');
const fm = (glob, base, kicker) =>
  Object.fromEntries(Object.entries(glob).map(([k, f]) => [`${base}${slugOf(k)}/`, { title: f.title, kicker: kicker || f.tag || 'Mow It Tall' }]));

export function allOgPages() {
  const posts = import.meta.glob('../pages/blog/[a-z]*.md', { eager: true, import: 'frontmatter' });
  const guides = import.meta.glob('../pages/guides/[a-z]*.md', { eager: true, import: 'frontmatter' });
  const topics = Object.fromEntries(TOPICS.map((t) => [`/blog/topic/${t.slug}/`, { title: `${t.name}: Lawn Care Posts`, kicker: 'The Blog' }]));
  return { ...OG_PAGES, ...topics, ...fm(posts, '/blog/'), ...fm(guides, '/guides/', 'Guide') };
}

// '/blog/lawn-soil-test/' -> 'blog-lawn-soil-test'; '/' -> 'home'
export const ogSlug = (path) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-'));
