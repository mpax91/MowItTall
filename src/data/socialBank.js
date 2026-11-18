// The content pool for the auto social calendar (Nov 17, 2026): every post, guide, tool, weed, month page,
// tip, moment and Friday question, with hooks, copy pieces and image paths. Built at build time by
// src/pages/crm/social-bank.json.js (read by worker/plan.js) and src/pages/social/[slug].jpg.js (the 4:5 cards).
import { SOCIAL } from './social.js';
import { ALT_HOOKS, ENGAGE } from './socialHooks.js';
import { MOMENTS, LAUNCH_POSTS } from './socialPlan.js';
import { MONTH_PAGES } from './monthPages.js';
import { TASKS } from './tasks.js';
import { TASK_LINKS } from './gamePlan.js';
import { WEEDS } from './weeds.js';
import { ogSlug } from './og.js';
import { pinUrl } from './pins.js';

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
const first = (s) => (strip(s).match(/^.*?[.!?](\s|$)/) || [strip(s)])[0].trim();
const clip = (s, n) => { s = strip(s); return s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,;:]+\S*$/, '') + '…'; };
export const cardSlug = (id) => id.replace(/\//g, '--');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_NAMES = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));
const GUIDE_MONTHS = {
  'how-high-to-mow-grass': [4, 5, 6], 'when-to-overseed-lawn': [8, 9], 'crabgrass-preventer-timing': [3, 4], 'how-often-to-water-lawn': [6, 7, 8], 'when-to-fertilize-lawn': [5, 8, 9],
  'grubs-in-lawn': [7, 8, 9], 'should-i-aerate-my-lawn': [8, 9], 'when-to-stop-mowing': [10, 11], 'fix-bare-spots-in-lawn': [8, 9], 'moss-in-lawn': [3, 4, 10],
  'should-i-mulch-leaves-into-lawn': [10, 11], 'does-my-lawn-need-lime': [3, 9, 10], 'spring-lawn-cleanup-checklist': [3, 4], 'snow-mold-and-vole-damage': [3],
  'get-rid-of-clover-in-lawn': [5, 6, 9, 10], 'how-long-to-wait-to-mow': [4, 9], 'how-to-stripe-your-lawn': [5, 6], 'weed-killer-and-grass-seed': [8, 9], 'types-of-lawn-fertilizer': [4, 5, 8],
  'robot-mower-settings-by-season': [3, 4, 5, 9, 10, 11], 'zero-turn-vs-riding-mower': [2, 3, 4], 'self-propelled-vs-push-mower': [2, 3, 4], 'what-size-lawn-mower-do-i-need': [2, 3, 4],
  'grass-for-shade': [8, 9], 'how-long-to-run-sprinklers': [6, 7, 8], 'is-my-lawn-dead-or-dormant': [7, 8], 'how-to-overseed-lawn': [8, 9], 'how-to-water-new-grass-seed': [9],
  'mushrooms-in-lawn': [6, 7, 9, 10], 'ice-melt-safe-for-lawn': [12, 1, 2, 3],
};
// Weeds: "Spring and fall" → months
function weedMonths(when) {
  const w = String(when || '').toLowerCase(), m = new Set();
  if (/spring/.test(w)) [4, 5].forEach((x) => m.add(x));
  if (/summer|july/.test(w)) [6, 7, 8].forEach((x) => m.add(x));
  if (/fall/.test(w)) [9, 10].forEach((x) => m.add(x));
  if (/all year/.test(w)) [4, 5, 6, 7, 8, 9, 10].forEach((x) => m.add(x));
  return [...m];
}
const KIND_LABEL = { intro: 'Meet Mow It Tall', post: 'From the Blog', guide: 'Straight Answer', tool: 'Free Tool', weed: 'Weed of the Week', month: 'This Month', tip: 'Quick Tip', moment: 'On This Day', engage: 'Your Turn', job: 'Lawn Job' };

// posts: allPosts(...) output; guides: [[path, module]] from import.meta.glob; pins: allPins() output
export function bankItems({ posts, guides, pins }) {
  const items = [];
  const add = (it) => { items.push({ card: `/social/${cardSlug(it.id)}.jpg`, label: KIND_LABEL[it.kind], ...it }); };
  const pinOf = (path) => { const p = pins[path]; return p ? { img: pinUrl(p), title: p.pinterestTitle, desc: p.description, board: p.board, alt: p.alt } : null; };
  for (const p of posts) {
    const slug = p.url.split('/').filter(Boolean).pop();
    const so = SOCIAL[slug] || {};
    const id = `blog/${slug}`;
    add({ id, kind: 'post', url: p.url, title: p.title, hooks: [so.hook || p.seoTitle || p.title, ...(ALT_HOOKS[id] || [])], take: so.take || strip(p.summary || p.description),
      nd: so.nd === null ? null : so.nd || '', photo: so.photo || '', months: so.months || [], topics: p.topics || [], og: `/og/${ogSlug(p.url)}.png`, pin: pinOf(p.url), date: p.date, funny: true });
  }
  for (const [k, g] of guides) {
    const slug = k.split('/').pop().replace(/\.md$/, '');
    if (slug === 'lawn-care-cost-westchester') continue;
    const fm = g.frontmatter, id = `guides/${slug}`, url = `/guides/${slug}/`;
    const alts = ALT_HOOKS[id] || [];
    add({ id, kind: 'guide', url, title: fm.title, hooks: alts.length ? [...alts, fm.title] : [fm.title], take: clip(fm.answer || fm.description, 300), short: first(fm.answer),
      nd: '', photo: '', months: GUIDE_MONTHS[slug] || [], topics: fm.topics || [], og: `/og/${ogSlug(url)}.png`, pin: pinOf(url) });
  }
  for (const [k, so] of Object.entries(SOCIAL)) {
    if (!k.startsWith('tool-') || k === 'tool-neighbor') continue;
    add({ id: k, kind: 'tool', url: so.path, title: so.title, hooks: [so.hook, ...(ALT_HOOKS[k] || [])], take: so.take, nd: so.nd === null ? null : so.nd || '', photo: so.photo || '',
      months: so.months || [], topics: [], og: `/og/${ogSlug(so.path)}.png`, pin: null });
  }
  for (const w of WEEDS) {
    if (w.group === 'joke' || !w.id) continue;
    const url = `/weeds/${w.id}/`;
    add({ id: `weed-${w.id}`, kind: 'weed', url, title: w.name, hooks: [`Weed of the week: ${w.name}.`, `Is this ${w.name.toLowerCase()} in your lawn? Here’s how to tell, and the easy fix.`],
      take: `${strip(w.looks)} The easy fix: ${strip(w.easy)}`.slice(0, 400), nd: '', photo: `Close-up of ${w.name.toLowerCase()} growing in a lawn.`, months: weedMonths(w.when), topics: ['weeds'], og: `/og/${ogSlug(url)}.png`, pin: null });
  }
  MONTH_PAGES.forEach((m, i) => {
    const url = `/calendar/${m.slug}/`;
    add({ id: `month-${m.slug}`, kind: 'month', url, title: `Your ${MONTH_NAMES[i]} Lawn`, hooks: [`Your ${MONTH_NAMES[i]} lawn, in one sentence:`, `What to do to your lawn in ${MONTH_NAMES[i]} (and what to skip).`],
      take: clip(m.answer, 280), nd: `${MONTH_NAMES[i]} lawn tip for the neighborhood: ${clip(m.answer, 220)}`, photo: '', months: [i + 1], topics: [], og: `/og/${ogSlug(url)}.png`, pin: null, month: i + 1 });
    // Tips: the month's "skip" and "extra" lines become Monday tips linking to the month page.
    (m.skip || []).forEach((t, j) => add({ id: `tip-${m.slug}-skip-${j}`, kind: 'tip', url, title: `${MONTH_NAMES[i]}: skip this`, hooks: [`${MONTH_NAMES[i]} lawn tip: skip this. ${first(t)}`], take: clip(strip(t).slice(first(t).length), 260), months: [i + 1], topics: [], og: `/og/${ogSlug(url)}.png`, pin: null, short: first(t) }));
    (m.extra || []).forEach((t, j) => add({ id: `tip-${m.slug}-extra-${j}`, kind: 'tip', url, title: `${MONTH_NAMES[i]} tip`, hooks: [`${MONTH_NAMES[i]} lawn tip: ${first(t)}`], take: clip(strip(t).slice(first(t).length), 260), months: [i + 1], topics: [], og: `/og/${ogSlug(url)}.png`, pin: null, short: first(t) }));
  });
  for (const t of TASKS) {
    const link = TASK_LINKS[t.id] || '/calendar/';
    const url = typeof link === 'string' ? link : link[0] || '/calendar/';
    const ms = []; for (let mo = t.start[0]; ; mo = mo % 12 + 1) { ms.push(mo); if (mo === t.end[0]) break; }
    add({ id: `job-${t.id}`, kind: 'job', url, title: t.title, hooks: [`Lawn job this week: ${t.title.replace(/\s*\([^)]*\)/g, '')}.`], take: `${strip(t.short)} ${strip(t.why)}`.slice(0, 300), months: ms, topics: [], og: `/og/${ogSlug(url.split('#')[0])}.png`, pin: null, task: t.id });
  }
  for (const m of MOMENTS) add({ id: `moment-${m.id}`, kind: 'moment', url: null, title: m.title, hooks: [m.text], take: '', months: [], topics: [], link: m.link, moment: m.id, og: null, pin: null });
  for (const l of LAUNCH_POSTS) add({ id: `intro-${l.id}`, kind: 'intro', url: l.url, title: l.title, hooks: l.hooks, take: l.take, nd: null, photo: '', months: [], topics: [], og: `/og/${ogSlug(l.url)}.png`, pin: null });
  for (const e of ENGAGE) add({ id: `engage-${e.id}`, kind: 'engage', url: null, title: 'Your turn', hooks: [e.text], take: '', months: e.months || [], topics: [], link: e.link, og: null, pin: null });
  // Moments and questions borrow the linked item's URL and share card.
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  for (const x of items) if (x.link && byId[x.link]) { x.url = byId[x.link].url; x.og = byId[x.link].og; x.linkTitle = byId[x.link].title; }
  return items;
}
