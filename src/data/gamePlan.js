// The game plan: turns quiz answers into a lawn personality, the jobs for the year, and the three things
// to do next. Pure functions (no DOM), shared by the quiz results page (src/scripts/quiz.js) and the
// email drip (worker/drip.js), so the page and the emails always say the same thing.
import { TASKS, planFor, statusOf, windowText } from './tasks.js';
import { placeOf, taskCost, money } from '../scripts/agenda.js';
import { RESULTS as GRASS, pick as pickGrass } from './grassPicker.js';
import { CREW_TASKS } from './crew.js';

export const PROFILES = [
  { name: 'The Bare Minimum Hero', blurb: 'You want a better lawn without becoming a lawn person. Respect. Here are the few things that actually move the needle.' },
  { name: 'The Saturday Striper', blurb: 'A little effort, a lot of curb appeal. Coffee in one hand, spreader in the other.' },
  { name: 'The Curb Appeal Contender', blurb: 'You want people to slow down when they drive by. This gets you there.' },
  { name: 'The Stripe Lord', blurb: 'You already named the mower. This is the full program. Godspeed.' },
];
export const LEVEL_NAMES = ['Couch Potato', 'Good Enough Guy', 'Curb Appeal Hunter', 'Lawn Psycho'];

// Lawn size answer → square feet (a measured lawn from /measure/ wins over the guess).
export const SIZES = { tiny: 2000, normal: 5000, quarter: 10000, big: 22000 };

// Every job points at the one page that helps you do it (results page, emails).
export const TASK_LINKS = {
  blade: ['/blog/sharpen-your-mower-blade/', 'Is my blade dull?'],
  raise: ['/blog/one-third-rule-mowing/', 'The one-third rule'],
  cleanup: ['/guides/spring-lawn-cleanup-checklist/', 'Spring cleanup checklist'],
  crabgrass: ['/blog/pre-emergent-vs-post-emergent/', 'The bouncer and the hitman'],
  'spring-feed': ['/blog/how-to-read-a-fertilizer-bag/', 'Which bag to buy'],
  'spot-weeds': ['/weeds/', 'What’s that weed?'],
  grubs: ['/guides/grubs-in-lawn/', 'Is it really grubs?'],
  'july4-feed': ['/resources/should-i-water-my-lawn/', 'Should I water?'],
  summer: ['/blog/lawn-heat-wave-rules/', 'The heat wave rules'],
  'soil-test': ['/blog/lawn-soil-test/', 'How to do a soil test'],
  aerate: ['/guides/should-i-aerate-my-lawn/', 'Should I aerate?'],
  seed: ['/guides/how-to-overseed-lawn/', 'How to overseed, step by step'],
  'fall-feed': ['/blog/holiday-lawn-fertilizer-schedule/', 'The holiday schedule'],
  'fall-weeds': ['/blog/fall-kill-weeds-or-plant-seed/', 'Weeds or seed? Pick one'],
  'columbus-feed': ['/blog/halloween-is-the-lawn-super-bowl/', 'Why it peaks for Halloween'],
  leaves: ['/blog/you-never-needed-a-leaf-blower/', 'Just mow them'],
  lime: ['/guides/does-my-lawn-need-lime/', 'Does my lawn need lime?'],
  'thanksgiving-feed': ['/blog/holiday-lawn-fertilizer-schedule/', 'The holiday schedule'],
  'last-mow': ['/guides/when-to-stop-mowing/', 'When to stop mowing'],
  winter: ['/blog/lawn-mower-maintenance-diy/', 'Mower tune-up checklist'],
};

const FEED = new Set(['crabgrass', 'spring-feed', 'fall-feed', 'columbus-feed', 'thanksgiving-feed', 'fall-weeds', 'grubs']);
const fmtN = (n) => Math.round(n).toLocaleString('en-US');
const r1 = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const bags = (a, cover) => { const n = a / cover; if (n < 0.95) return `${Math.max(10, Math.round(n * 10) * 10)}% of a bag`; const b = Math.ceil(n - 0.05); return `${b} bag${b === 1 ? '' : 's'}`; };

// "How much to buy" for one job, for this lawn. Empty string when there's nothing to buy.
export function amountFor(id, sqft, plan = {}) {
  if (!sqft || sqft < 100) return '';
  const k = sqft / 1000;
  const g = GRASS[plan.grassKey] || {};
  if (FEED.has(id)) return `${bags(sqft, 5000)} of the 5,000 sq ft size${sqft > 7000 ? `, or ${bags(sqft, 15000)} of the 15,000 size` : ''}`;
  if (id === 'july4-feed') return `half a dose: ${bags(sqft / 2, 5000)} of the 5,000 sq ft size`;
  if (id === 'seed' && g.rate) {
    const full = plan.look === 'dirt';
    const lo = full ? k * g.rate[0] : (k * g.rate[0]) / 2, hi = full ? k * g.rate[1] : (k * g.rate[1]) / 2;
    return `about ${r1(lo)}–${r1(hi)} lb of ${g.name.toLowerCase()} seed${full ? ' (new lawn)' : ' to overseed'}`;
  }
  if (id === 'lime') return `only if the test says so, and no more than ${fmtN(k * 50)} lb per round`;
  if (id === 'summer') return `one inch of water is about ${fmtN(sqft * 0.623)} gallons (rain counts)`;
  return '';
}

export function costFor(t, sqft) { const c = taskCost(t, sqft || 5000); return c && c[1] > 0 ? money(c) : ''; }

// Answers → everything the page and the emails need.
export function buildPlan(answers = {}, opts = {}) {
  const today = opts.today || new Date();
  const problems = answers.problems || [];
  let level = Math.max(0, Math.min(3, Number(answers.effort ?? 1)));
  const flags = [...problems];
  if (answers.look === 'patchy') flags.push('patchy');
  if (answers.look === 'dirt') flags.push('bare', 'patchy');
  if (answers.look === 'weedy') flags.push('weeds');
  const petty = problems.includes('neighbor') && level < 3;
  if (petty) level += 1;
  const tasks = planFor(level, flags);
  const sqft = Number(opts.sqft || answers.sqft || SIZES[answers.size] || 0) || 0;
  const sunMap = { full: 'full', part: 'part', mixed: 'mixed', shade: 'low' };
  const trafficMap = { kids: 'heavy', dogs: 'heavy', both: 'heavy', adults: 'normal', looks: 'light' };
  const goal = problems.includes('neighbor') || level >= 2 ? 'stripes' : level === 0 ? 'easy' : '';
  const grassKey = answers.grass && GRASS[answers.grass] ? answers.grass : pickGrass({ sun: sunMap[answers.sun] || 'full', traffic: trafficMap[answers.uses] || 'normal', water: answers.water || 'hose', goal });
  const crew = answers.mower === 'crew';
  const plan = { level, petty, flags, tasks, sqft, grassKey, crew, look: answers.look, profile: PROFILES[level], levelName: LEVEL_NAMES[level] };

  // Where each job stands today. Dates use the holiday date for holiday jobs (same as /calendar/).
  const dated = tasks.map((t) => {
    const s = statusOf(t, today);
    const y = s.state === 'next' ? today.getFullYear() : today.getFullYear() + 1;
    return { t, s, on: s.state === 'now' ? today : placeOf(t, s.state === 'next' ? today.getFullYear() : y) };
  });
  // Holiday jobs whose holiday already passed this year (but still inside their window) count as "next year".
  const now = dated.filter((x) => x.s.state === 'now').sort((a, b) => a.s.end - b.s.end);
  const upcoming = dated.filter((x) => x.s.state !== 'now').sort((a, b) => a.on - b.on);

  // Step 2: the one free habit that matters most for this person.
  let fix;
  if (crew) fix = { id: 'crew', title: 'Send your guy one text', short: 'Ask for 3.5 inches, clippings left on the lawn, and a sharp blade. It fixes more lawns than any product.', link: ['/blog/what-to-tell-your-landscaper/?asks=tall,clippings,blades#crewtext', 'Write the text for me'] };
  else if (answers.height === 'low' || answers.height === 'unknown') fix = { id: 'raise', title: 'Raise the mower to 3.5–4 inches', short: 'Free, ten seconds, and it fixes half your problems. Tall grass shades out weeds and handles the heat.', link: ['/guides/how-high-to-mow-grass/', 'How high to mow'] };
  else if (answers.mower === 'robot') fix = { id: 'robot', title: 'Set the robot to its highest setting', short: 'It mows a little every day, so tall and often is perfect. Trim the edges yourself on Saturday.', link: ['/blog/robot-mower-judging-you/', 'Your robot is judging you'] };
  else fix = { id: 'clippings', title: 'Leave the clippings on the lawn', short: 'They’re free fertilizer and they don’t cause thatch. Take the bag off and keep the mulch plug in.', link: ['/blog/stop-bagging-your-clippings/', 'Why I never bag'] };

  const jobStep = (x) => x && ({
    id: x.t.id, title: x.t.title, short: x.t.short, why: x.t.why, tip: x.t.tip || '', on: x.on, state: x.s.state,
    window: windowText(x.t), daysLeft: x.s.daysLeft, link: TASK_LINKS[x.t.id] || null,
    amount: amountFor(x.t.id, sqft, plan), cost: costFor(x.t, sqft),
    who: crew && CREW_TASKS[x.t.id] ? CREW_TASKS[x.t.id] : null,
  });
  plan.doNow = jobStep(now[0]);
  plan.alsoNow = now.slice(1).map(jobStep);
  plan.fix = fix;
  plan.next = jobStep(upcoming[0]);
  plan.upcoming = upcoming.map(jobStep);
  plan.hours = Math.max(1, Math.round(tasks.filter((t) => !crew || (CREW_TASKS[t.id] || {}).who !== 'guy').reduce((a, t) => a + (t.minutes || 0), 0) / 60));
  plan.grass = GRASS[grassKey];
  return plan;
}

export const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export { TASKS };
