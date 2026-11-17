// Share cards (Open Graph images). Every page listed here gets a 1200x630 PNG at /og/<slug>.png,
// drawn at build time by src/pages/og/[slug].png.js. Base.astro uses it automatically when one exists.
// Blog posts, guides and blog topics are added automatically; static pages are listed by hand below.
import { TOPICS } from './topics.js';
import { WEED_PAGES } from './weedPages.js';
import { MONTH_PAGES } from './monthPages.js';
import { TOWNS } from './towns.js';

export const OG_PAGES = {
  '/': { title: 'A Better Lawn, Without Becoming a Lawn Guy', kicker: 'Free Lawn Plan', layout: 'home', v: 2 },
  '/plan/': { title: 'Get Your Free Lawn Plan in a Minute', kicker: 'The Quiz' },
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
  '/privacy/': { title: 'Privacy: What Mow It Tall Collects (Not Much)', kicker: 'Privacy' },
  '/contact/': { title: 'Got a Lawn Question? Email Mike.', kicker: 'Contact' },
  '/merch/': { title: 'Merch for People Who Mow Tall', kicker: 'Coming Soon' },
  '/lawn-care/': { title: 'Lawn Care by Town: Same Grass, Different Clocks', kicker: 'Local' },
  '/resources/should-i-water-my-lawn/': { title: 'Should I Water My Lawn? A Straight Answer for Your ZIP', kicker: 'Free Tool' },
  '/resources/can-i-seed-now/': { title: 'Can I Plant Grass Seed Now? Live Yes or No', kicker: 'Free Tool' },
  '/resources/lawn-calculator/': { title: 'How Much Seed, Fertilizer and Lime Do I Need?', kicker: 'Free Tool' },
  '/resources/whats-wrong-with-my-lawn/': { title: 'What’s Wrong With My Lawn? Tap What You See', kicker: 'Free Tool' },
  '/resources/lawn-soil-temperature/': { title: 'Lawn Soil Temperature, Right Now', kicker: 'Free Tool' },
  '/resources/spreader-settings/': { title: 'Spreader Settings Without the Stripes', kicker: 'Free Tool' },
};

const slugOf = (k) => k.split('/').pop().replace(/\.md$/, '');
const fm = (glob, base, kicker) =>
  Object.fromEntries(Object.entries(glob).map(([k, f]) => [`${base}${slugOf(k)}/`, { title: f.title, kicker: kicker || f.tag || 'Mow It Tall' }]));

export function allOgPages() {
  const posts = import.meta.glob('../pages/blog/[a-z]*.md', { eager: true, import: 'frontmatter' });
  const guides = import.meta.glob('../pages/guides/[a-z]*.md', { eager: true, import: 'frontmatter' });
  const topics = Object.fromEntries(TOPICS.map((t) => [`/blog/topic/${t.slug}/`, { title: `${t.name}: Lawn Care Posts`, kicker: 'The Blog' }]));
  const weeds = Object.fromEntries(Object.entries(WEED_PAGES).map(([id, p]) => [`/weeds/${id}/`, { title: p.h1, kicker: 'Weed Guide' }]));
  const months = Object.fromEntries(MONTH_PAGES.map((m) => [`/calendar/${m.slug}/`, { title: `Lawn Care in ${m.slug[0].toUpperCase() + m.slug.slice(1)}: What to Do and What to Skip`, kicker: 'Lawn Calendar' }]));
  const towns = Object.fromEntries(TOWNS.map((t) => [`/lawn-care/${t.slug}/`, { title: `Lawn Care in ${t.name}, ${t.state}`, kicker: 'Local Lawn Guide' }]));
  return { ...OG_PAGES, ...topics, ...weeds, ...months, ...towns, ...fm(posts, '/blog/'), ...fm(guides, '/guides/', 'Guide') };
}

// '/blog/lawn-soil-test/' -> 'blog-lawn-soil-test'; '/' -> 'home'
export const ogSlug = (path) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-'));
