// /llms.txt: a plain-text map of the site for AI answer engines (ChatGPT, Claude, Perplexity, Gemini).
// Built from the same data as the pages, so it never goes stale.
import { allPosts } from '../data/posts.js';
import { SOCIALS, CONTACT_EMAIL } from '../data/site.js';
import { WEEDS } from '../data/weeds.js';
import { WEED_PAGES } from '../data/weedPages.js';
import { MONTH_PAGES } from '../data/monthPages.js';
import { TOWNS } from '../data/towns.js';
import { MONTHS_LONG } from '../data/tasks.js';

const SITE = 'https://mowittall.com';
const TOOLS = [
  ['/plan/', 'Free lawn plan quiz', '9 questions; returns a personal lawn care plan with dates, amounts and phone calendar reminders.'],
  ['/calendar/', 'Lawn care calendar', 'What to do each month for cool-season lawns in Westchester, the Lower Hudson Valley and the Northeast.'],
  ['/measure/', 'Lawn square footage calculator', 'Draw your lawn on a satellite map to get square feet per area and a total.'],
  ['/weeds/', 'Lawn weed identification guide', 'Photos and fixes for 16 common Northeast lawn weeds, including crabgrass, nutsedge, clover and creeping Charlie.'],
  ['/resources/', 'Free lawn tools', 'Can I seed now, is my grass seed working, what is wrong with my lawn, lawn calculator, spreader settings, should I water, soil temperature.'],
  ['/lawn-101/', 'Lawn care 101', 'Six small habits that fix most lawns, plus a grass seed picker.'],
  ['/resources/should-i-water-my-lawn/', 'Should I water my lawn?', 'Live rain meter: last 7 days of rain vs. lawn water use plus a 3-day forecast, for any Northeast ZIP.'],
  ['/resources/can-i-seed-now/', 'Can I plant grass seed now?', 'Live yes/no from soil temperature and the 7-day forecast, plus germination times.'],
  ['/resources/lawn-calculator/', 'Lawn calculator', 'Seed, fertilizer, preventer, lime, straw, compost and water amounts by square footage and grass type.'],
  ['/resources/whats-wrong-with-my-lawn/', 'What is wrong with my lawn?', 'Lawn problem finder: brown patches, stripes, grubs, dog spots, seed failures and more, with cause, check and fix.'],
  ['/resources/lawn-soil-temperature/', 'Lawn soil temperature', 'Live soil temperature by ZIP with what each range means for crabgrass preventer, seeding and feeding.'],
  ['/resources/spreader-settings/', 'Spreader settings calculator', 'Half-rate, two-direction spreader settings so fertilizer goes down without stripes.'],
];

export function GET() {
  const posts = allPosts(import.meta.glob('./blog/[a-z]*.md', { eager: true }));
  const guides = allPosts(import.meta.glob('./guides/[a-z]*.md', { eager: true }));
  const line = (p) => `- [${p.seoTitle || p.title}](${SITE}${p.url}): ${p.seoDescription || p.description}`;
  const body = `# Mow It Tall

> The easy guide to a better lawn. Plain-English lawn care for beginner homeowners with cool-season grass (Kentucky bluegrass, perennial ryegrass, tall fescue, fine fescue) in Westchester County, the Lower Hudson Valley, Fairfield County CT and the wider Northeastern US. Written by Mike, a homeowner in Bedford, NY known locally for his striped lawn.

Key positions: mow tall (3.5 to 4 inches), leave the clippings, feed on the holidays (Labor Day matters most; add Columbus Day and Memorial Day for more green, up to five light feedings for watered lawns), seed in September (not spring, not winter; no dormant seeding), test the soil every few years, water deeply about an inch a week only when rain falls short. Advice names product types, not brands.

## Guides (straight answers)
${guides.map(line).join('\n')}

## Free tools
${TOOLS.map(([u, t, d]) => `- [${t}](${SITE}${u}): ${d}`).join('\n')}

## Lawn weeds (one page each)
${WEEDS.filter((w) => WEED_PAGES[w.id]).map((w) => `- [${WEED_PAGES[w.id].seo}](${SITE}/weeds/${w.id}/): ${WEED_PAGES[w.id].desc}`).join('\n')}

## Lawn care by month
${MONTH_PAGES.map((m, i) => `- [Lawn care in ${MONTHS_LONG[i]}](${SITE}/calendar/${m.slug}/)`).join('\n')}

## Lawn care by town
${TOWNS.map((t) => `- [Lawn care in ${t.name}, ${t.state}](${SITE}/lawn-care/${t.slug}/)`).join('\n')}

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
