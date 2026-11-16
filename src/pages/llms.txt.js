// /llms.txt: a plain-text map of the site for AI answer engines (ChatGPT, Claude, Perplexity, Gemini).
// Built from the same data as the pages, so it never goes stale.
import { allPosts } from '../data/posts.js';
import { SOCIALS, CONTACT_EMAIL } from '../data/site.js';

const SITE = 'https://mowittall.com';
const TOOLS = [
  ['/plan/', 'Free lawn plan quiz', '9 questions; returns a personal lawn care plan with dates, amounts and phone calendar reminders.'],
  ['/calendar/', 'Lawn care calendar', 'What to do each month for cool-season lawns in Westchester, the Lower Hudson Valley and the Northeast.'],
  ['/measure/', 'Lawn square footage calculator', 'Draw your lawn on a satellite map to get square feet per area and a total.'],
  ['/weeds/', 'Lawn weed identification guide', 'Photos and fixes for 16 common Northeast lawn weeds, including crabgrass, nutsedge, clover and creeping Charlie.'],
  ['/resources/', 'Free lawn tools', 'Can I seed now, is my grass seed working, what is wrong with my lawn, lawn calculator, spreader settings, should I water, soil temperature.'],
  ['/lawn-101/', 'Lawn care 101', 'Six small habits that fix most lawns, plus a grass seed picker.'],
];

export function GET() {
  const posts = allPosts(import.meta.glob('./blog/[a-z]*.md', { eager: true }));
  const guides = allPosts(import.meta.glob('./guides/[a-z]*.md', { eager: true }));
  const line = (p) => `- [${p.seoTitle || p.title}](${SITE}${p.url}): ${p.seoDescription || p.description}`;
  const body = `# Mow It Tall

> The easy guide to a better lawn. Plain-English lawn care for beginner homeowners with cool-season grass (Kentucky bluegrass, perennial ryegrass, tall fescue, fine fescue) in Westchester County, the Lower Hudson Valley, Fairfield County CT and the wider Northeastern US. Written by Mike, a homeowner in Bedford, NY known locally for his striped lawn.

Key positions: mow tall (3.5 to 4 inches), leave the clippings, feed on three holidays (Memorial Day, Labor Day, Columbus Day; Labor Day matters most), seed in late August through September, test the soil every few years, water deeply about an inch a week only when rain falls short. Advice names product types, not brands.

## Guides (straight answers)
${guides.map(line).join('\n')}

## Free tools
${TOOLS.map(([u, t, d]) => `- [${t}](${SITE}${u}): ${d}`).join('\n')}

## Blog (short, funny, still accurate)
${posts.map(line).join('\n')}

## Official profiles
${SOCIALS.map(([, n, u, h]) => `- ${n}: ${u}`).join('\n')}
- Contact: ${SITE}/contact/ (${CONTACT_EMAIL})

## Optional
- [RSS feed](${SITE}/rss.xml)
- [Sitemap](${SITE}/sitemap-index.xml)
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
