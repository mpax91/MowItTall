// Content library for the email drip (worker/drip.js). Built with the site, so every new post, guide and
// tool joins the drip automatically. The worker reads it through ASSETS and returns 404 for /crm/* to the
// public. Social copy (src/data/social.js) supplies the hook/take, which double as the email subject + body.
import { allPosts } from '../../data/posts.js';
import { SOCIAL } from '../../data/social.js';
import { PIN_TOOLS } from '../../data/pins.js';

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
const first = (s) => (strip(s).match(/^.*?[.!?](\s|$)/) || [strip(s)])[0].trim();

// Guides have no social copy or seasons, so they get months here (when people search for them).
const GUIDE_MONTHS = {
  'how-high-to-mow-grass': [4, 5, 6], 'when-to-overseed-lawn': [8, 9], 'crabgrass-preventer-timing': [3, 4],
  'how-often-to-water-lawn': [6, 7, 8], 'when-to-fertilize-lawn': [5, 8, 9], 'grubs-in-lawn': [7, 8, 9],
  'should-i-aerate-my-lawn': [8, 9], 'when-to-stop-mowing': [10, 11], 'fix-bare-spots-in-lawn': [8, 9],
  'moss-in-lawn': [3, 4, 10], 'should-i-mulch-leaves-into-lawn': [10, 11], 'does-my-lawn-need-lime': [3, 9, 10],
  'spring-lawn-cleanup-checklist': [3, 4], 'snow-mold-and-vole-damage': [3], 'get-rid-of-clover-in-lawn': [5, 6, 9, 10],
  'how-long-to-wait-to-mow': [4, 9], 'how-to-stripe-your-lawn': [5, 6], 'weed-killer-and-grass-seed': [8, 9],
  'types-of-lawn-fertilizer': [4, 5, 8],
};
const SKIP_GUIDES = new Set(['lawn-care-cost-westchester']); // local prices: not for a Northeast-wide list
const SKIP_TOOLS = new Set(['tool-plan', 'tool-neighbor', 'tool-calendar']); // the drip already is the plan

export async function GET() {
  const posts = allPosts(import.meta.glob('../blog/[a-z]*.md', { eager: true }));
  const guides = Object.entries(import.meta.glob('../guides/[a-z]*.md', { eager: true }));
  const items = [];
  for (const p of posts) {
    const slug = p.url.split('/').filter(Boolean).pop();
    const so = SOCIAL[slug] || {};
    items.push({
      id: `blog/${slug}`, kind: 'post', url: p.url, title: p.title, seo: p.seoTitle || p.title,
      hook: so.hook || p.seoTitle || p.title, take: so.take || strip(p.summary || p.description),
      months: so.months || [], topics: p.topics || [], tag: p.tag || '', tool: p.widget ? PIN_TOOLS[p.widget] || '' : '', date: p.date,
    });
  }
  for (const [k, g] of guides) {
    const slug = k.split('/').pop().replace(/\.md$/, '');
    if (SKIP_GUIDES.has(slug)) continue;
    const fm = g.frontmatter;
    items.push({
      id: `guides/${slug}`, kind: 'guide', url: `/guides/${slug}/`, title: fm.title, seo: fm.title,
      hook: fm.title, take: strip(fm.answer).slice(0, 420).replace(/\s+\S*$/, (m) => (strip(fm.answer).length > 420 ? '…' : m)) || strip(fm.description), short: first(fm.answer), months: GUIDE_MONTHS[slug] || [], topics: fm.topics || [], tag: 'Straight Answer', tool: '',
    });
  }
  for (const [k, so] of Object.entries(SOCIAL)) {
    if (!k.startsWith('tool-') || SKIP_TOOLS.has(k)) continue;
    items.push({ id: k, kind: 'tool', url: so.path, title: so.title, seo: so.title, hook: so.hook, take: so.take, months: so.months || [], topics: [], tag: 'Free Tool', tool: so.title });
  }
  return new Response(JSON.stringify({ built: new Date().toISOString(), items }), { headers: { 'content-type': 'application/json' } });
}
