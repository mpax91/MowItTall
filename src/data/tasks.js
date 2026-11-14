// The lawn year for Bedford, Westchester and most of the Northeast (cool-season grass).
// Windows are typical. Soil temperature is the real trigger, so the site shows both.
//
// level: the lowest effort level that gets this task (0 couch, 1 weekend, 2 overachiever, 3 psycho)
// when: optional quiz answers that pull the task in regardless of level

export const TASKS = [
  {
    id: 'blade',
    title: 'Sharpen your mower blade',
    short: 'A sharp blade cuts clean. A dull one tears and leaves brown tips.',
    why: 'Takes 20 minutes with a file, or drop it at a hardware store for a few bucks.',
    start: [3, 1], end: [4, 10], level: 0, minutes: 20,
  },
  {
    id: 'raise',
    title: 'Raise your mower to 3.5–4 inches',
    short: 'The single easiest upgrade. Tall grass shades out weeds and handles heat.',
    why: 'Set it once in spring and leave it there all season.',
    start: [3, 25], end: [4, 20], level: 0, minutes: 1,
  },
  {
    id: 'cleanup',
    title: 'Rake out dead patches',
    short: 'A quick, firm rake wakes the lawn up and shows you where it’s thin.',
    why: 'Wait until the ground is dry enough that you don’t leave footprints.',
    start: [3, 20], end: [4, 15], level: 2, minutes: 45,
  },
  {
    id: 'crabgrass',
    title: 'Put down crabgrass preventer',
    short: 'Stops crabgrass seeds before they sprout. Timing is everything.',
    why: 'Go when soil hits about 55°F, usually when the forsythia is blooming.',
    start: [4, 1], end: [4, 30], level: 1, minutes: 30, when: ['crabgrass'],
  },
  {
    id: 'spring-feed',
    title: 'Light spring feeding',
    short: 'A small dose of slow-release fertilizer as the lawn greens up.',
    why: 'Go light. Too much spring fertilizer means more mowing and more disease.',
    start: [5, 1], end: [5, 31], level: 2, minutes: 30,
  },
  {
    id: 'spot-weeds',
    title: 'Spot-spray weeds',
    short: 'Hit dandelions and clover while they’re actively growing.',
    why: 'Spray on a calm day that’s not too hot, and only where you see weeds.',
    start: [5, 15], end: [6, 15], level: 1, minutes: 20, when: ['weeds'],
  },
  {
    id: 'grubs',
    title: 'Grub prevention',
    short: 'Grubs eat roots in late summer. A preventer now stops them.',
    why: 'Only worth it if you’ve had grub damage before, or you’re going all in.',
    start: [6, 1], end: [7, 15], level: 3, minutes: 30, when: ['grubs'],
  },
  {
    id: 'summer',
    title: 'Mow tall, water deep',
    short: 'Summer survival mode. Keep it tall and water once or twice a week.',
    why: 'About an inch of water a week, early morning. Skip fertilizer in the heat.',
    start: [6, 20], end: [8, 31], level: 0, minutes: 0,
  },
  {
    id: 'soil-test',
    title: 'Get a soil test',
    short: 'Tells you exactly what your lawn is missing, so you stop guessing.',
    why: 'Mail-in kits are cheap. Do it before fall projects so you buy the right stuff.',
    start: [8, 1], end: [9, 10], level: 2, minutes: 15, when: ['brown', 'bare'],
  },
  {
    id: 'aerate',
    title: 'Core aerate',
    short: 'Pulls plugs of soil so air, water and seed can get to the roots.',
    why: 'Rent a machine with a neighbor and split the cost. Seed right after.',
    start: [8, 25], end: [9, 25], level: 3, minutes: 120,
  },
  {
    id: 'seed',
    title: 'Seed thin spots',
    short: 'The best time all year to grow new grass around here.',
    why: 'Rake the bare spots, spread seed, keep it damp for two to three weeks.',
    start: [8, 25], end: [9, 30], level: 2, minutes: 60, when: ['bare', 'patchy'],
  },
  {
    id: 'fall-feed',
    title: 'Fall feeding',
    short: 'If you only fertilize once a year, this is the one.',
    why: 'Feeds the roots going into winter so the lawn comes back thick in spring.',
    start: [9, 1], end: [10, 10], level: 0, minutes: 30,
  },
  {
    id: 'fall-weeds',
    title: 'Fall weed control',
    short: 'Weeds pull spray down to their roots in fall. It works better now than spring.',
    why: 'One pass on a mild day takes out most of what bugged you all summer.',
    start: [9, 20], end: [10, 20], level: 2, minutes: 30, when: ['weeds'],
  },
  {
    id: 'leaves',
    title: 'Mow over your leaves',
    short: 'No raking, no blower. Chopped leaves feed the lawn for free.',
    why: 'Mow when they’re dry, a few times through fall. Rake only if they pile up deep.',
    start: [10, 15], end: [11, 30], level: 0, minutes: 0,
  },
  {
    id: 'lime',
    title: 'Add lime if your soil test said so',
    short: 'Lots of Northeast soil is acidic. Lime fixes it slowly over winter.',
    why: 'Only if your test shows low pH. Spread it any time the ground isn’t frozen.',
    start: [10, 15], end: [11, 30], level: 3, minutes: 30,
  },
  {
    id: 'last-mow',
    title: 'Last mow of the year',
    short: 'Drop the deck one notch to about 3 inches for the final cut.',
    why: 'Shorter grass going into winter is less likely to mat down and get moldy.',
    start: [11, 1], end: [11, 30], level: 1, minutes: 45,
  },
  {
    id: 'winter',
    title: 'Put the mower away right',
    short: 'Run it out of gas or add stabilizer. Clean the deck. You’re done.',
    why: 'Spring-you will thank fall-you when it starts on the first pull.',
    start: [12, 1], end: [12, 31], level: 1, minutes: 20,
  },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmt([m, d]) {
  return `${MONTHS[m - 1]} ${d}`;
}

export function windowText(t) {
  return `${fmt(t.start)} – ${fmt(t.end)}`;
}

// Tasks for a given effort level plus anything their answers pull in.
export function planFor(level, flags = []) {
  return TASKS.filter((t) => t.level <= level || (t.when || []).some((f) => flags.includes(f)));
}

// Where each task stands relative to `today`.
export function statusOf(t, today = new Date()) {
  const y = today.getFullYear();
  const start = new Date(y, t.start[0] - 1, t.start[1]);
  const end = new Date(y, t.end[0] - 1, t.end[1], 23, 59);
  const day = 86400000;
  if (today < start) return { state: 'next', days: Math.ceil((start - today) / day), start, end };
  if (today > end) {
    // already passed this year: next chance is next year
    const nextStart = new Date(y + 1, t.start[0] - 1, t.start[1]);
    return { state: 'past', days: Math.ceil((nextStart - today) / day), ago: Math.floor((today - end) / day), start, end };
  }
  return { state: 'now', daysLeft: Math.ceil((end - today) / day), start, end };
}

// Last finished, happening now, and next up, wrapping around the new year.
export function snapshot(list, today = new Date()) {
  const withStatus = list.map((t) => ({ t, s: statusOf(t, today) }));
  const now = withStatus.filter((x) => x.s.state === 'now');
  const past = withStatus.filter((x) => x.s.state === 'past').sort((a, b) => a.s.ago - b.s.ago);
  const next = withStatus
    .filter((x) => x.s.state !== 'now')
    .sort((a, b) => a.s.days - b.s.days);
  return { now, last: past[0] || null, next: next[0] || null };
}
