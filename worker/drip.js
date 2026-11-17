// The email drip: one year of lawn email, built from the site (Nov 17 2026).
//
// What goes out, in priority order, at most one email a day (8am Eastern):
//   1. Job reminders: every job in the person's plan (src/data/tasks.js, same levels as /calendar/), a few
//      days before it's due, with the amount for their lawn. Holiday jobs go out the Thursday-ish before.
//   2. Welcome series: day 0 game plan, day 2 free fix, day 4 measure, day 7 hello from Mike, day 10 extra.
//   3. Weekly content (Thursdays): a pinned seasonal email if one is due, else "your month" on the first
//      Thursday of the month, else the best unsent post/guide/tool from /crm/library.json (in season first,
//      then matching their problems). Every new post joins the pool automatically.
// Cadence rules: one email a day max, content needs 2 quiet days before it, "jobs only" people get only
// job reminders. Everything is a pure function of (contact, what they've been sent, today), so HQ can
// preview anyone's next email and simulate a whole year without sending anything.
//
// Copy is Claude's, in Mike's voice. Mike reviews it (HQ → Email → Year at a Glance shows every email).
import { buildPlan, amountFor, costFor, TASK_LINKS, LEVEL_NAMES, fmtDate } from '../src/data/gamePlan.js';
import { TASKS, statusOf, MONTHS_LONG } from '../src/data/tasks.js';
import { placeOf } from '../src/scripts/agenda.js';
import { MONTH_PAGES } from '../src/data/monthPages.js';
import { CREW_TASKS } from '../src/data/crew.js';
import { trackOf, slotItem, moreItems, weekOf, SKIP, scheduled } from './calendar.js';

const DAY = 86400000;
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const firstSentence = (s) => (strip(s).match(/^.*?[.!?](\s|$)/) || [strip(s)])[0].trim();

// Eastern calendar day of a timestamp, as a Date at noon (same convention as `today`).
const ET_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' });
export function etDay(ts) {
  const p = Object.fromEntries(ET_FMT.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), 12);
}

/* ------------------------------------------------------------------ job reminders */
// Subject lines for each job. A = the punchy one, B = plain "what and when" (the job-subject test).
export const JOB_SUBJECTS = {
  blade: 'Your mower blade is probably dull. 20-minute fix.',
  raise: 'The free lawn upgrade: one lever, ten seconds',
  cleanup: 'Time to wake the lawn up (one rake, one hour)',
  crabgrass: 'Tax Day is coming. So is the crabgrass.',
  'spring-feed': 'Memorial Day weekend: feed the lawn before the burgers',
  'spot-weeds': 'Weeds are growing. That’s actually good news.',
  grubs: 'Had grubs before? Stop them now.',
  'july4-feed': 'July 4th feeding: half a dose, and only if you water',
  summer: 'Summer mode: mow tall, water deep, don’t panic',
  'soil-test': 'Blood work for your lawn (it’s $25)',
  aerate: 'Aeration season. Hire it or rent it, then seed.',
  seed: 'It’s seed week. September is the whole game.',
  'fall-feed': 'Labor Day is Monday. Feed the lawn.',
  'fall-weeds': 'Fall weed control (skip anything you seeded)',
  'columbus-feed': 'Columbus Day: the pre-game feed for Halloween',
  leaves: 'Don’t rake. Mow the leaves.',
  lime: 'Did your soil test say lime? Now’s the time.',
  'thanksgiving-feed': 'The Thanksgiving winterizer (Lawn Psychos only)',
  'last-mow': 'The last mow of the year',
  winter: 'Put the mower to bed right (and it starts in April)',
};
// Robot track: the mowing jobs, rewritten for a robot (Claude's copy, Mike to review).
export const ROBOT_JOBS = {
  raise: { title: 'Set the robot to its highest cut', subject: 'Robot owners: one setting to change this week', short: 'Set the cutting height to the top, 3.5 inches or as close as it goes. It mows every day, so tall and often is perfect.', why: 'Tall grass shades out weeds and handles summer heat.', link: ['/blog/robot-mower-judging-you/', 'Your robot is judging you'] },
  blade: { title: 'Swap the robot’s blades', subject: 'Your robot’s blades are probably dull', short: 'Those little razor blades dull fast. Swap in a fresh set (your manual says how often).', why: 'Dull blades tear the tips, and the whole lawn looks a shade browner.', link: ['/blog/robot-mower-judging-you/', 'More robot rules'] },
  summer: { title: 'Summer mode for robot lawns', subject: 'Summer mode: tall cut, fewer runs, deep water', short: 'Keep the cut tall, and cut back how often it runs when the grass stops growing in the heat. If you water, go deep: about an inch a week, early morning.', why: 'A robot running every day in a drought just wears paths.', link: ['/resources/should-i-water-my-lawn/', 'Should I water? (live)'] },
  'last-mow': { title: 'The robot’s last runs', subject: 'Time to bring the robot in', short: 'Drop it a notch to about 3 inches for its last few runs, then bring it in once the grass stops growing.', why: 'A little shorter going into winter means less matted grass and snow mold.', link: ['/guides/when-to-stop-mowing/', 'When to stop mowing'] },
  winter: { title: 'Put the robot to bed', subject: 'Put the robot to bed for winter', short: 'Clean the deck and wheels, charge it, and store it inside for the winter. Check your manual about the charging station.', why: 'Cold is hard on the battery. Spring-you will thank fall-you.' },
  leaves: { title: 'Leaves vs. the robot', subject: 'Your robot hates leaf piles', short: 'Robots choke on heavy leaves. Pause it during big leaf drops, mulch them with a regular mower or rake them off, then let it back out.', why: 'A thick layer of leaves smothers the grass and invites snow mold.', link: ['/guides/should-i-mulch-leaves-into-lawn/', 'Should I mulch the leaves?'] },
};
// Landscaper track: jobs your guy does become "text your guy" emails (asks = ids in the text builder).
export const CREW_JOBS = {
  blade: { title: 'Sharp blades on your guy’s mower', subject: 'Text your guy: when were the blades sharpened?', asks: 'blades' },
  raise: { title: 'Ask for 3.5 inches this year', subject: 'Text your guy: 3.5 inches this year', asks: 'tall,clippings' },
  cleanup: { title: 'A gentle spring cleanup', subject: 'Text your guy: easy on the spring cleanup', asks: 'spring' },
  summer: { title: 'Summer mowing: high, and skip dry weeks', subject: 'Text your guy: mow high, skip the dry weeks', asks: 'drought,tall' },
  aerate: { title: 'Core aeration (hire it)', subject: 'Aeration: hire it, but you buy the seed', asks: 'seedtime' },
  leaves: { title: 'Mow the leaves in, don’t haul them', subject: 'Text your guy: mow the leaves in', asks: 'leaves' },
  'last-mow': { title: 'Last mow at about 3 inches', subject: 'Text your guy: last mow at 3 inches', asks: 'lastmow' },
};
export function jobTitle(t, track) {
  if (track === 'robot' && ROBOT_JOBS[t.id]) return ROBOT_JOBS[t.id].title;
  if (track === 'crew' && CREW_JOBS[t.id] && CREW_TASKS[t.id]?.who === 'guy') return CREW_JOBS[t.id].title;
  return t.title.replace(/\s*\([^)]*\)/g, '');
}
const HOLIDAY_LEAD = 4; // days before the holiday itself
const JOB_LEAD = 2;     // days before the window opens
// When the reminder goes out for this year's (or next year's) occurrence of a job.
function jobDates(t, today) {
  const s = statusOf(t, today);
  const y = s.state === 'past' ? today.getFullYear() + 1 : today.getFullYear();
  const on = placeOf(t, y);
  const hol = t.holiday || t.id === 'crabgrass'; // Tax Day counts as a holiday here
  let at = new Date(on.getTime() - (hol ? HOLIDAY_LEAD : JOB_LEAD) * DAY);
  if (!hol) { const dow = at.getDay(); if (dow === 6) at = new Date(at.getTime() - 2 * DAY); if (dow === 0) at = new Date(at.getTime() - 3 * DAY); }
  return { s, on, at, year: y };
}

/* ------------------------------------------------------------------ welcome series */
const isFam = (c) => ['kids', 'dogs', 'both'].includes(c.answers.uses);
export const WELCOME = [
  { key: 'w0-plan', day: 0 },
  { key: 'w1-fix', day: 2 },
  { key: 'w2-measure', day: 4, when: (c) => !c.measured },
  { key: 'w3-ask', day: 6, when: (c) => !c.answers.sun || !c.answers.uses },
  { key: 'w4-hello', day: 9 },
  { key: 'w5-crew', day: 12, when: (c) => c.answers.mower === 'crew' },
  { key: 'w5-family', day: 12, when: (c) => c.answers.mower !== 'crew' && isFam(c) },
  { key: 'w5-101', day: 12, when: (c) => c.answers.mower !== 'crew' && !isFam(c) && Number(c.answers.know ?? 1) <= 1 },
  { key: 'w6-grass', day: 15, when: (c) => !c.answers.grass },
];
const WELCOME_KEYS = new Set(WELCOME.map((w) => w.key));
export const libId = (key) => key.slice(4).replace(/:y\d+$/, '');

// Email names for HQ (anything not listed is named from the library or the job).
export const NAMES = {
  'w0-plan': 'Welcome: your game plan', 'w1-fix': 'Welcome: the free fix', 'w2-measure': 'Profile: measure your lawn',
  'w3-ask': 'Profile: sun + who uses it (one tap)', 'w4-hello': 'Welcome: hi, I’m Mike', 'w5-crew': 'Welcome: talk to your landscaper',
  'w5-family': 'Welcome: kids, dogs and lawns', 'w5-101': 'Welcome: lawn 101 in 3 minutes', 'w6-grass': 'Profile: pick your grass',
  'ask-water': 'Profile: do you water? (one tap, before summer)', 'y-review': 'One year in: pick your track for year two',
};
// A/B tests: which test an email belongs to. Arms are 'a' and 'b' unless HQ adds more.
export function testFor(key) {
  if (key === 'w0-plan') return 'welcome-subject';
  if (key.startsWith('job:')) return 'job-subject';
  if (key.startsWith('lib:')) return 'content-subject';
  if (key.startsWith('month:')) return 'month-subject';
  return '';
}
export const TESTS = {
  'welcome-subject': { name: 'Welcome subject: personality vs. name', arms: { a: 'Your lawn game plan, <profile>', b: '<Name>, here’s exactly what to do this week' } },
  'job-subject': { name: 'Job reminders: punchy vs. plain', arms: { a: 'Punchy line (e.g. “Labor Day is Monday. Feed the lawn.”)', b: 'Plain: “Lawn reminder: <job> (<date>)”' } },
  'content-subject': { name: 'Weekly emails: the hook vs. the post title', arms: { a: 'The hook (social copy)', b: 'The post title' } },
  'month-subject': { name: 'Monthly email: count vs. question', arms: { a: 'Your <Month> lawn: <N> things', b: 'What does the lawn need in <Month>?' } },
};

/* ------------------------------------------------------------------ the scheduler */
// c = { id, created, answers, sqft, measured, pref, level }, sent = Map(key → sent_at), today = Date at noon
// (UTC-local, representing the Eastern date). Returns { key, kind } or null. Pure: used for sending,
// HQ previews, "upcoming" counts and the Year at a Glance simulation.
export function nextFor(c, sent, today, lib = []) {
  // Gaps are counted in Eastern calendar days, not hours (a 2pm send and an 8am send two days later = 2 days).
  let last = 0, lastContent = 0;
  for (const [k, at] of sent) {
    const day = etDay(at).getTime();
    if (day > last) last = day;
    if (!k.startsWith('job:') && day > lastContent) lastContent = day;
  }
  if (last && last >= today.getTime()) return null; // already emailed today
  const created = new Date(c.created);
  const age = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())) / DAY);

  // 0. the welcome email first (unless they joined long before sending was turned on)
  if (!sent.has('w0-plan') && age <= 14 && c.pref !== 'jobs') return { key: 'w0-plan', kind: 'welcome' };

  // 1. job reminders
  const plan = buildPlan(c.answers, { today, sqft: c.sqft });
  const joined = new Date(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate(), 12);
  for (const t of plan.tasks) {
    const { on, at, year } = jobDates(t, today);
    const key = `job:${t.id}:${year}`;
    if (sent.has(key)) continue;
    // Their soil test is in (from the soil test translator): no need to nag, and no lime if pH is fine.
    if (t.id === 'soil-test' && c.answers.ph) continue;
    if (t.id === 'winter' && c.answers.mower === 'crew') continue; // their mower, their problem
    if (t.id === 'lime' && Number(c.answers.ph) >= 6) continue;
    // Already "this week" when they signed up (the welcome email covered it): skip until next year.
    if (statusOf(t, joined).state === 'now' && year === joined.getFullYear()) continue;
    if (today >= at && today <= new Date(on.getTime() + 2 * DAY) && joined < on) return { key, kind: 'job', task: t.id };
  }
  if (c.pref === 'jobs') return null;
  if (last && today - last < 2 * DAY) return null;

  // 2. rest of the welcome series
  if (age <= 30) {
    for (const w of WELCOME) {
      if (w.key === 'w0-plan' || sent.has(w.key)) continue;
      if (w.when && !w.when(c)) continue;
      if (age >= w.day) return { key: w.key, kind: 'welcome' };
      return null; // wait for it
    }
  }
  // 3. the lawn year (worker/calendar.js): Thursdays, with 5 quiet content days before
  if (today.getDay() !== 4 || (lastContent && today - lastContent < 5 * DAY) || age < 9) return null;
  const m = today.getMonth() + 1, y = today.getFullYear();
  const yr = Math.floor(age / 365) + 1; // subscription year: content repeats in year two
  // One year in: let them pick a track for year two.
  if (age >= 358 && !sent.has(`y-review:${yr}`) && !sent.has(`y-review:${yr - 1}`) && age - 358 < 60) return { key: `y-review:${yr}`, kind: 'content' };
  // Before summer, ask whether they water (changes grass picks and the summer advice).
  if (!c.answers.water && m >= 5 && m <= 7 && !sent.has('ask-water')) return { key: 'ask-water', kind: 'content' };
  const wk = weekOf(today);
  if (wk === 1) return sent.has(`month:${m}:${y}`) ? null : { key: `month:${m}:${y}`, kind: 'month' };
  const track = trackOf(c.answers);
  const id = slotItem(m, wk, track);
  if (id && lib.some((x) => x.id === id) && !sent.has(`lib:${id}:y${yr}`)) return { key: `lib:${id}:y${yr}`, kind: 'content' };
  const item = pickContent(c, sent, m, lib, yr);
  return item ? { key: `lib:${item.id}:y${yr}`, kind: 'content' } : null;
}

// Best unsent library item: in season > matches their problems > newest. Landscaper posts only for people
// with a landscaper; kids/dogs posts get a boost for families.
export function pickContent(c, sent, month, lib, yr = 1) {
  const a = c.answers || {};
  const crew = a.mower === 'crew', fam = ['kids', 'dogs', 'both'].includes(a.uses);
  const probs = new Set(a.problems || []);
  const want = new Set();
  if (probs.has('weeds') || probs.has('crabgrass') || a.look === 'weedy') want.add('weeds');
  if (probs.has('bare') || a.look === 'patchy' || a.look === 'dirt') want.add('seeding');
  if (probs.has('brown')) { want.add('mowing'); want.add('soil'); }
  if (probs.has('grubs')) want.add('dogs-kids');
  // Variety: don't send the same kind (guide, post, tool) twice in a row.
  let lastKind = '', lastAt = 0;
  for (const [k, at] of sent) if (k.startsWith('lib:') && at > lastAt) { lastAt = at; lastKind = (lib.find((x) => libId(k) === x.id) || {}).kind || ''; }
  const track = trackOf(a);
  // Already covered by the welcome series (or already done on the site).
  const skip = new Set(['tool-measure', c.answers.grass ? 'tool-grass' : '']);
  let best = null, bestScore = -Infinity;
  for (const it of lib) {
    if (sent.has(`lib:${it.id}:y${yr}`) || skip.has(it.id) || SKIP[track].has(it.id)) continue;
    const topics = it.topics || [];
    if (topics.includes('got-a-guy') && !crew) continue;
    const months = it.months || [];
    if (months.length && !months.includes(month)) {
      // out of season: only evergreen items (no months) are allowed off-season
      continue;
    }
    let score = months.length ? 100 : 20;
    if (topics.some((t) => want.has(t))) score += 30;
    if (crew && topics.includes('got-a-guy')) score += 40;
    if (fam && topics.includes('dogs-kids')) score += 25;
    if (it.kind === 'tool') score += 10;
    if (it.kind === lastKind) score -= 25;
    if (scheduled(track).has(it.id)) score -= 60; // save it for its own week
    const know = Number(a.know ?? 1);
    if (it.kind === 'guide') score += know >= 2 ? -15 : know === 0 ? 10 : -5; // beginners get straight answers first
    score += (it.date ? new Date(it.date).getTime() / 1e12 : 0); // newer wins ties
    if (score > bestScore) { best = it; bestScore = score; }
  }
  return best;
}

/* ------------------------------------------------------------------ email builders */
// Each returns { subjects: { a, b }, pre, blocks } where blocks are rendered by worker/mailer.js:
//   ['p', html] ['h', text] ['steps', [{k, title, text, extra}]] ['btn', label, url] ['ps', html] ['hr']
const hi = (c) => (c.name ? `Hey ${c.name},` : 'Hey,');
// Subject lines over ~70 characters get cut off on phones: keep whole sentences that fit.
function shortSubject(s) {
  if (s.length <= 70) return s;
  const parts = s.match(/[^.?!]+[.?!]+/g) || [s];
  let out = '';
  for (const p of parts) { if ((out + p).trim().length > 70) break; out += p; }
  return out.trim() || s.slice(0, 68).replace(/\s+\S*$/, '') + '…';
}
const A = (url, text) => `<a href="${url}">${text}</a>`;

function jobBlock(j) {
  const extra = [];
  if (j.who) extra.push(`<b>${j.who.who === 'guy' ? 'Your guy' : 'You'}:</b> ${j.who.line}`);
  if (j.amount) extra.push(`<b>For your lawn:</b> ${j.amount}.`);
  return extra.join('<br>');
}

export function build(key, c, today, lib = []) {
  const plan = buildPlan(c.answers, { today, sqft: c.sqft });
  const name = c.name || '';
  const nextLine = () => {
    // Only when it's close enough to matter (a job three months out in every email gets stale fast).
    const n = plan.upcoming.find((x) => x.on > new Date(today.getTime() + 3 * DAY));
    return n && n.on - today < 21 * DAY ? `P.S. Coming up for you: <b>${n.title}</b>, around ${fmtDate(n.on)}. I’ll remind you a few days before.` : '';
  };

  if (key === 'w0-plan') {
    const steps = [];
    if (plan.doNow) steps.push({ k: 'This week', title: plan.doNow.title, text: plan.doNow.short + (plan.alsoNow.length ? ` Also good right now: ${plan.alsoNow.map((x) => x.title.replace(/\s*\([^)]*\)/g, '')).join(', ')}.` : ''), extra: jobBlock(plan.doNow), link: plan.doNow.link });
    else steps.push({ k: 'This week', title: 'Nothing. Enjoy it.', text: 'Your lawn doesn’t need anything right now. Leaving it alone is the plan.' });
    steps.push({ k: 'Your free fix', title: plan.fix.title, text: plan.fix.short, link: plan.fix.link });
    if (plan.next) steps.push({ k: `Next up · ${fmtDate(plan.next.on)}`, title: plan.next.title, text: plan.next.short, extra: jobBlock(plan.next) });
    return {
      subjects: { a: `Your lawn game plan, ${plan.profile.name.replace(/^The /, '')}`, b: `${name ? `${name}, here’s` : 'Here’s'} exactly what to do this week` },
      pre: 'Three steps, then I’ll take it from here.',
      blocks: [
        ['p', hi(c)],
        ['p', `You’re <b>${plan.profile.name}</b>. ${plan.profile.blurb}`],
        ['h', 'Your game plan'],
        ['steps', steps],
        ['p', `That’s it for now. Your full year is <b>${plural(plan.tasks.length, 'job')}</b>, about ${plural(plan.hours, 'hour')}${plan.crew ? ' of your time' : ' plus mowing'}.`],
        ['btn', 'See Your Whole Lawn Year', `/calendar/?level=${plan.level}`],
        ['h', 'What happens next'],
        ['p', 'Over the next two weeks I’ll walk you through the setup, one small step at a time: measuring your lawn (one minute, on a map), a couple of one-tap questions, and the right grass for your yard. Every answer makes the emails after it smarter.'],
        ['p', 'After that, I’ll email you a few days before each job, with exactly how much to buy for your lawn. In between, about once a week, one useful thing from the site: a tool, a hot take, a straight answer. Short. Funny-ish. Never a sales pitch.'],
        ['p', 'One favor: if this landed in Promotions, drag it to your Primary inbox. Otherwise the reminders get lost, and then what are we even doing.'],
        ['p', 'Questions? Just hit reply. It comes straight to me.<br>– Mike'],
      ],
    };
  }
  if (key === 'w1-fix') {
    const f = plan.fix;
    return {
      subjects: { a: 'The 10-second lawn fix that costs $0', b: 'Do this before you buy anything' },
      pre: f.title,
      blocks: [
        ['p', hi(c)],
        ['p', 'Before you buy a single bag of anything, do this one thing. It’s free, and it beats most products on the shelf.'],
        ['h', f.title],
        ['p', f.short],
        f.link ? ['btn', f.link[1], f.link[0]] : null,
        ['p', 'Small changes. Big stripes. That’s the whole idea.<br>– Mike'],
        ['ps', nextLine()],
      ].filter(Boolean),
    };
  }
  if (key === 'w2-measure') {
    return {
      subjects: { a: 'How big is your lawn, really?', b: 'Step 1: measure your lawn (60 seconds, no tape measure)' },
      pre: 'Do this once and every reminder does the math for you.',
      blocks: [
        ['p', hi(c)],
        ['p', 'Step one of making these emails actually useful: how big is your lawn?'],
        ['p', 'Every bag of seed or fertilizer says how many square feet it covers. Most people guess, buy two, and use one. Or buy one and stripe the lawn by running out halfway.'],
        ['p', 'So I built a tool. Tap the corners of your lawn on a satellite photo and it writes the square feet right inside each area. About a minute. Your address never leaves your phone.'],
        ['btn', 'Measure My Lawn', '/measure/'],
        ['box', '<b>Open it from this email</b> and your number saves to your lawn profile. From then on, every reminder says exactly how many bags to buy.'],
        ['p', '– Mike'],
        ['ps', nextLine()],
      ],
    };
  }
  if (key === 'w3-ask') {
    const blocks = [['p', hi(c)], ['p', 'Two quick questions. One tap each, no typing. Your answers change which grass I recommend and what I warn you about.']];
    if (!c.answers.sun) blocks.push(['ask', 'How much sun does the lawn get? (Think middle of a summer day.)', 'sun', [['full', 'Full sun'], ['part', 'Some shade'], ['mixed', 'Sunny front, shady back'], ['shade', 'Mostly shade']]]);
    if (!c.answers.uses) blocks.push(['ask', 'Who uses the lawn?', 'uses', [['kids', 'Kids'], ['dogs', 'Dogs'], ['both', 'Kids and dogs'], ['adults', 'Just grown-ups'], ['looks', 'Nobody. It’s for looks']]]);
    blocks.push(['p', 'That’s it. Tap and you’re done.<br>– Mike']);
    return { subjects: { a: 'Two quick questions (one tap each)', b: 'Is your lawn sunny or shady?' }, pre: 'No typing. Just tap.', blocks };
  }
  if (key === 'ask-water') {
    return {
      subjects: { a: 'Summer’s coming. Do you water?', b: 'One tap: do you water the lawn?' },
      pre: 'No wrong answer. It changes the summer advice.',
      blocks: [
        ['p', hi(c)],
        ['p', 'Summer is where lawns get separated from the pack. The advice is different depending on one thing:'],
        ['ask', 'Do you water the lawn?', 'water', [['auto', 'Sprinkler system'], ['hose', 'Hose, when it looks rough'], ['never', 'Nope. Rain or nothing.']]],
        ['p', 'No wrong answer. A brown August lawn is usually asleep, not dead.<br>– Mike'],
      ],
    };
  }
  if (key === 'w4-hello') {
    return {
      subjects: { a: 'Who is this guy?', b: 'Quick hello (and one question for you)' },
      pre: 'Hit reply. I read every one.',
      blocks: [
        ['p', hi(c)],
        ['p', 'Quick hello. I’m Mike. I live in Bedford, NY, and somewhere along the way I became “the lawn guy” because of the stripes in my yard. I’m not a landscaper and I don’t sell anything. I just figured out that a great lawn is mostly a few small habits, done at the right time.'],
        ['p', 'That’s what Mow It Tall is. And that’s what these emails are.'],
        ['h', 'One question'],
        ['p', '<b>What’s the one thing about your lawn that bugs you most?</b> Hit reply and tell me. One sentence is fine. I read every one, and the good questions become posts.'],
        ['btn', 'See My Lawn (Proof It Works)', '/yards/'],
        ['p', '– Mike'],
      ],
    };
  }
  if (key === 'w5-crew') {
    return {
      subjects: { a: 'Your landscaper isn’t ignoring you. Nobody asked.', b: 'One text to send your landscaper' },
      pre: 'Mow at 3.5 inches, leave the clippings, sharpen the blades.',
      blocks: [
        ['p', hi(c)],
        ['p', 'Most landscapers mow short so they can come back less often. It’s not personal. Nobody ever asked them to do it differently.'],
        ['p', 'One friendly text fixes most of it: mow at 3.5 inches, leave the clippings, keep the blades sharp. Tap what you want and I’ll write the text for you.'],
        ['btn', 'Write the Text for Me', '/blog/what-to-tell-your-landscaper/?asks=tall,clippings,blades#crewtext'],
        ['p', 'Then do the 15-minute jobs yourself (the feedings). That’s where the money is.<br>– Mike'],
        ['ps', nextLine()],
      ],
    };
  }
  if (key === 'w5-101') {
    return {
      subjects: { a: 'Everything you need to know about lawns (3 minutes)', b: 'Lawn 101: the six habits that fix most lawns' },
      pre: 'Six small habits. That’s most of it.',
      blocks: [
        ['p', hi(c)],
        ['p', 'You said you’re new to this. Good news: a great lawn is mostly six small habits. Raise the mower. Leave the clippings. Feed on a few holidays. Keep the blade sharp. Mow over the leaves. Seed in September.'],
        ['p', 'That’s it. No 12-step program, no mystery jugs from the store. I put them on six flip cards, one minute each.'],
        ['btn', 'Lawn 101 in 3 Minutes', '/lawn-101/'],
        ['p', 'I’ll remind you when each one matters, so you don’t have to remember any of it.<br>– Mike'],
        ['ps', nextLine()],
      ],
    };
  }
  if (key === 'w6-grass') {
    return {
      subjects: { a: 'Which grass should you actually buy?', b: 'Pick your grass in 4 taps' },
      pre: 'The picture on the bag is lying to you.',
      blocks: [
        ['p', hi(c)],
        ['p', 'When it’s time to seed (September, mostly), the seed aisle is a wall of bags with the same green picture on every one. The picture is lying. The right grass depends on your sun, your traffic and whether you water.'],
        ['p', 'Four taps and I’ll tell you the mix and how many pounds. Do it from this email and it saves to your profile, so your September seeding reminder names the exact seed.'],
        ['btn', 'Pick My Grass', '/lawn-101/#grass'],
        ['p', '– Mike'],
        ['ps', nextLine()],
      ],
    };
  }
  if (key === 'w5-family') {
    return {
      subjects: { a: 'Kids, dogs and lawn stuff: what’s actually safe', b: 'A lawn the kids and dog can actually use' },
      pre: 'Spot-treat, keep off until it dries, water in granules.',
      blocks: [
        ['p', hi(c)],
        ['p', 'A lawn that gets used is a good lawn. Let the dog pee. Rent the bouncy house.'],
        ['p', 'The safety part is simpler than the internet makes it: spot-treat weeds instead of spraying everything, keep everyone off until it dries, water in granules, and read the label. Most of a great lawn needs no chemicals at all.'],
        ['btn', 'The Kid and Pet Safe Playbook', '/blog/kid-and-pet-safe-lawn-care/'],
        ['p', '– Mike'],
        ['ps', nextLine()],
      ],
    };
  }
  if (key.startsWith('job:')) {
    const id = key.split(':')[1];
    const t = TASKS.find((x) => x.id === id);
    if (!t) return null;
    const { on } = jobDates(t, today);
    const amount = c.sqft ? amountFor(id, c.sqft, plan) : '', typical = c.sqft ? '' : amountFor(id, 5000, plan), cost = costFor(t, c.sqft);
    const link = TASK_LINKS[id];
    const j = plan.upcoming.concat(plan.doNow ? [plan.doNow] : [], plan.alsoNow).find((x) => x && x.id === id);
    const hol = t.holiday || id === 'crabgrass';
    const track = trackOf(c.answers);
    const title = jobTitle(t, track);
    const when = id === 'crabgrass' ? `${fmtDate(on)} (really: when the soil hits 55°F, around when the forsythia blooms)` : hol ? fmtDate(on) : `${fmtDate(on)} – ${fmtDate(new Date(on.getFullYear(), t.end[0] - 1, t.end[1]))}`;
    if (track === 'crew' && CREW_TASKS[id]?.who === 'guy' && CREW_JOBS[id]) {
      return {
        subjects: { a: CREW_JOBS[id].subject, b: `Lawn reminder: ${title} (${fmtDate(on)})` },
        pre: CREW_TASKS[id].line,
        blocks: [
          ['p', hi(c)],
          ['h', title],
          ['p', `<b>When:</b> ${when}`],
          ['p', 'This one’s on your landscaper. One friendly text does it:'],
          ['box', CREW_TASKS[id].line],
          ['btn', 'Write the Text for Me', `/blog/what-to-tell-your-landscaper/?asks=${CREW_JOBS[id].asks}#crewtext`],
          id === 'aerate' ? ['p', 'Then seed right after, with seed you picked. <a href="/lawn-101/#grass">Pick your grass</a>.'] : null,
          ['p', '– Mike'],
        ].filter(Boolean),
      };
    }
    const rb = track === 'robot' ? ROBOT_JOBS[id] : null;
    if (rb) {
      return {
        subjects: { a: rb.subject, b: `Lawn reminder: ${title} (${fmtDate(on)})` },
        pre: rb.short,
        blocks: [['p', hi(c)], ['h', title], ['p', `<b>When:</b> ${when}`], ['p', `${rb.short} ${rb.why}`], rb.link ? ['btn', rb.link[1], rb.link[0]] : null, ['p', '– Mike']].filter(Boolean),
      };
    }
    return {
      subjects: { a: JOB_SUBJECTS[id] || title, b: `Lawn reminder: ${title} (${fmtDate(on)})` },
      pre: t.short,
      blocks: [
        ['p', hi(c)],
        ['h', title],
        ['p', `<b>When:</b> ${when}${t.holiday ? ' (or that weekend)' : ''}`],
        ['p', `${t.short} ${t.why}`],
        j && j.who ? ['p', `<b>${j.who.who === 'guy' ? 'Your guy' : 'You'}:</b> ${j.who.line}`] : null,
        amount ? ['box', `<b>For your lawn (${Math.round(c.sqft).toLocaleString('en-US')} sq ft):</b> ${amount}.${cost ? `<br><b>Cost:</b> about ${cost}.` : ''}`]
          : typical ? ['box', `<b>For a typical 5,000 sq ft lawn:</b> ${typical}.${cost ? ` About ${cost}.` : ''}<br><a href="/measure/">Measure your lawn</a> (one minute) and I’ll do the exact math from now on.`]
          : cost ? ['box', `<b>Cost:</b> about ${cost}.`] : null,
        id === 'lime' && c.answers.ph ? ['p', `<b>Your soil test said pH ${c.answers.ph}.</b> That’s low, so yes: lime this fall.`] : null,
        id === 'seed' && plan.grass ? ['p', `<b>Your grass:</b> ${plan.grass.name}${plan.grass.mix ? ` (${plan.grass.mix})` : ''}.${c.answers.grass ? '' : ' <a href="/lawn-101/#grass">Not sure? Pick it in 4 taps.</a>'}`] : null,
        t.tip ? ['p', `<b>Heads up:</b> ${t.tip}`] : null,
        link ? ['btn', link[1], link[0]] : null,
        ['p', '– Mike'],
      ].filter(Boolean),
    };
  }
  if (key.startsWith('y-review:')) {
    const lv = plan.level, next = Math.min(3, lv + 1);
    const choices = [];
    if (lv < 3) choices.push([`Level up: ${LEVEL_NAMES[next]}`, `/track/?set=effort-${next}`]);
    choices.push(['Same plan again', '/track/?set=keep']);
    choices.push(['Just the job reminders', `/api/m/u?t=${c.token || ''}&o=jobs`]);
    choices.push(['I’m good, stop the emails', `/api/m/u?t=${c.token || ''}`]);
    return {
      subjects: { a: 'One year of lawn emails. What’s next?', b: 'Pick your track for year two' },
      pre: 'Level up, run it back, or just the reminders.',
      blocks: [
        ['p', hi(c)],
        ['p', `It’s been a year. That’s a full lap around the lawn calendar: ${plural(plan.tasks.length, 'job')} at the ${LEVEL_NAMES[lv]} level, plus a lot of opinions about leaf blowers.`],
        ['p', 'So, year two. Pick one (one tap):'],
        ['choices', choices],
        ['p', 'Do nothing and I’ll keep going on the same plan, with any new posts mixed in.<br>– Mike'],
      ],
    };
  }
  if (key.startsWith('month:')) {
    const m = Number(key.split(':')[1]);
    const mp = MONTH_PAGES[m - 1];
    const jobs = plan.tasks.filter((t) => { const { on } = jobDates(t, today); return on.getMonth() + 1 === m && !(t.id === 'winter' && c.answers.mower === 'crew') && !(t.id === 'lime' && Number(c.answers.ph) >= 6) && !(t.id === 'soil-test' && c.answers.ph); });
    const mn = MONTHS_LONG[m - 1];
    const tr = trackOf(c.answers);
    const more = moreItems(m, tr).filter((id) => !SKIP[tr].has(id)).map((id) => lib.find((x) => x.id === id)).filter(Boolean);
    return {
      subjects: { a: jobs.length ? `Your ${mn} lawn: ${plural(jobs.length, 'thing')} to do` : `Your ${mn} lawn: nothing on your list`, b: `What does the lawn need in ${mn}?` },
      pre: firstSentence(mp?.answer),
      blocks: [
        ['p', hi(c)],
        ['p', tr === 'crew' ? `Your landscaper has the mowing. Here’s what’s on you in ${mn}.` : tr === 'robot' ? `The robot has the mowing (keep it on its highest setting). Here’s the rest of ${mn}.` : strip(mp?.answer)],
        jobs.length ? ['h', `On your list this month (${LEVEL_NAMES[plan.level]})`] : null,
        jobs.length ? ['list', jobs.map((t) => `<b>${jobTitle(t, tr)}</b> · ${fmtDate(jobDates(t, today).on)}${tr === 'crew' && CREW_TASKS[t.id]?.who === 'guy' ? ' (text your guy)' : ''}`)] : ['p', 'Nothing on your list this month. Enjoy it. I’ll email you when it’s time.'],
        ['btn', `${mn} Lawn Care, Start to Finish`, `/calendar/${mp?.slug || ''}/`],
        more.length ? ['h', `Also Good in ${mn}`] : null,
        more.length ? ['list', more.map((it) => `<a href="${it.url}">${it.title}</a>${it.kind === 'tool' ? ' (free tool)' : ''}`)] : null,
        ['p', '– Mike'],
      ].filter(Boolean),
    };
  }
  if (key.startsWith('lib:')) {
    const it = lib.find((x) => x.id === libId(key));
    if (!it) return null;
    if (it.kind === 'guide') {
      const sub = it.short && it.short.length >= 25 ? shortSubject(it.short) : `Straight answer: ${it.title}`;
      return {
        subjects: { a: shortSubject(it.title), b: sub.length <= 75 ? sub : `Straight answer: ${shortSubject(it.title)}` },
        pre: it.short || firstSentence(it.take),
        blocks: [
          ['p', hi(c)],
          ['p', `You asked (well, a lot of people did): <b>${it.title.replace(/\s*\(.*\)\s*$/, '')}</b>`],
          ['box', `<b>Short answer:</b> ${it.take}`],
          ['p', 'The full version has the details, the exceptions, and a quick FAQ. One page, no scrolling through a life story first.'],
          ['btn', 'Get the Straight Answer', it.url],
          ['p', '– Mike'],
          ['ps', nextLine()],
        ],
      };
    }
    const label = it.kind === 'tool' ? 'Try It (Free)' : it.tool ? 'Read It + Try the Tool' : 'Read It';
    return {
      subjects: { a: shortSubject(it.hook), b: it.title },
      pre: firstSentence(it.take),
      blocks: [
        ['p', hi(c)],
        ['h', it.title],
        ['p', it.take],
        it.tool && it.kind !== 'tool' ? ['p', `There’s a free tool built in: <b>${it.tool}</b>.`] : null,
        ['btn', label, it.url],
        ['p', '– Mike'],
        ['ps', nextLine()],
      ].filter(Boolean),
    };
  }
  return null;
}

// HQ name for any key.
export function nameOf(key, lib = []) {
  if (NAMES[key]) return NAMES[key];
  if (key.startsWith('job:')) { const t = TASKS.find((x) => x.id === key.split(':')[1]); return `Job: ${t ? t.title : key}`; }
  if (key.startsWith('month:')) return `Monthly: ${MONTHS_LONG[Number(key.split(':')[1]) - 1]}`;
  if (key.startsWith('lib:')) { const it = lib.find((x) => x.id === libId(key)); return it ? `${it.kind === 'tool' ? 'Tool' : it.kind === 'guide' ? 'Guide' : 'Post'}: ${it.title}` : key; }
  return key;
}
// Group keys across years: job:fall-feed:2027 → job:fall-feed, month:9:2027 → month:9
export const baseKey = (key) => (key.startsWith('job:') || key.startsWith('month:') ? key.split(':').slice(0, 2).join(':') : key.startsWith('lib:') ? `lib:${libId(key)}` : key.startsWith('y-review:') ? 'y-review' : key);
export { WELCOME_KEYS };
