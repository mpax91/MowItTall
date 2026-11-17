// The lawn year: ONE weekly sequence for everyone, by week of the month (Mike, Nov 17 2026). New subscribers
// get the intro/profile series first, then join this calendar wherever the year is when they finish it.
// Year two repeats it (with any new posts swapped in here).
//
// Thursdays: week 1 (days 1–7) = "Your <Month> lawn" (its `more` list links extra posts/guides for the month),
// weeks 2–4 = one feature each, week 5 (days 29–31, about 4 times a year) = a bonus feature.
// Each slot is either one id for everyone, or per track: diy (I mow / a kid mows), crew (landscaper mows),
// robot (robot mows). Ids are /crm/library.json ids. If a slot's item was already sent this subscription
// year (or a track has no item), the drip falls back to the best unsent in-season item.
//
// Coverage rule: every blog post is a feature or a `more` link on the DIY track; landscaper posts only go to
// the crew track; mowing-technique posts are swapped out for crew. QA checks this (see the project doc).
export const TRACKS = ['diy', 'crew', 'robot'];
export const trackOf = (answers = {}) => (answers.mower === 'crew' ? 'crew' : answers.mower === 'robot' ? 'robot' : 'diy');

export const CALENDAR = {
  1: {
    more: { all: ['tool-games'], diy: ['blog/lawn-off-season-training'], robot: ['blog/lawn-off-season-training'] },
    2: 'blog/lawn-new-years-resolutions',
    3: 'blog/lawn-care-dad-jokes',
    4: 'blog/explain-lawn-hobby-to-your-spouse',
    5: 'tool-games',
  },
  2: {
    more: { all: ['tool-hall', 'blog/power-ranking-every-excuse-for-a-bad-lawn'], diy: ['blog/pay-a-guy-or-diy-lawn-jobs'], robot: ['blog/should-i-hire-a-lawn-service'] },
    2: { diy: 'blog/lawn-mower-maintenance-diy', crew: 'blog/lawn-treatment-program-explained', robot: 'blog/lawn-stuff-you-dont-need' },
    3: 'blog/power-ranking-every-excuse-for-a-bad-lawn',
    4: { diy: 'blog/should-i-hire-a-lawn-service', crew: 'blog/should-i-hire-a-lawn-service', robot: 'tool-hall' },
    5: 'tool-hall',
  },
  3: {
    more: { all: ['guides/spring-lawn-cleanup-checklist', 'guides/snow-mold-and-vole-damage'], diy: ['blog/walk-behind-vs-riding-vs-zero-turn-mower'] },
    2: 'blog/lawn-weed-bracket',
    3: 'blog/spring-seeding',
    4: { diy: 'blog/opening-day-first-mow', robot: 'blog/opening-day-first-mow', crew: 'blog/what-to-tell-your-landscaper' },
    5: { diy: 'blog/sharpen-your-mower-blade', crew: 'blog/pay-a-guy-or-diy-lawn-jobs', robot: 'guides/moss-in-lawn' },
  },
  4: {
    more: { all: ['guides/crabgrass-preventer-timing', 'guides/moss-in-lawn'], diy: ['blog/sharpen-your-mower-blade'], crew: ['blog/pay-a-guy-or-diy-lawn-jobs'] },
    2: 'blog/pre-emergent-vs-post-emergent',
    3: 'blog/how-to-read-a-fertilizer-bag',
    4: { diy: 'blog/one-third-rule-mowing', crew: 'blog/your-landscaper-is-scalping-your-lawn', robot: 'blog/robot-mower-judging-you' },
    5: { diy: 'blog/walk-behind-vs-riding-vs-zero-turn-mower', crew: 'blog/lawn-stuff-you-dont-need', robot: 'blog/lawn-stuff-you-dont-need' },
  },
  5: {
    more: { all: ['guides/get-rid-of-clover-in-lawn', 'guides/types-of-lawn-fertilizer'], diy: ['guides/how-high-to-mow-grass', 'blog/one-third-rule-mowing', 'blog/robot-mower-judging-you'], robot: ['blog/robot-mower-judging-you'] },
    2: { diy: 'blog/lawn-mowing-etiquette', robot: 'blog/lawn-mowing-etiquette', crew: 'blog/is-my-landscaper-doing-a-good-job' },
    3: { diy: 'blog/stop-bagging-your-clippings', crew: 'blog/granules-vs-spray', robot: 'blog/granules-vs-spray' },
    4: 'tool-weeds',
    5: 'blog/spreader-settings-half-rate-twice',
  },
  6: {
    more: { all: ['guides/how-often-to-water-lawn', 'blog/dog-pee-kids-bouncy-houses-lawn'], diy: ['guides/how-to-stripe-your-lawn', 'blog/mulching-vs-bagging'], crew: ['blog/your-landscaper-is-scalping-your-lawn'] },
    2: { diy: 'blog/lawn-mowing-playlist', crew: 'blog/kid-and-pet-safe-lawn-care', robot: 'blog/kid-and-pet-safe-lawn-care' },
    3: 'tool-rain',
    4: { diy: 'blog/lawn-stripe-patterns', robot: 'blog/lawn-stripe-patterns', crew: 'guides/how-often-to-water-lawn' },
    5: { diy: 'blog/mulching-vs-bagging', crew: 'blog/dog-pee-kids-bouncy-houses-lawn', robot: 'blog/dog-pee-kids-bouncy-houses-lawn' },
  },
  7: {
    more: { all: ['guides/grubs-in-lawn', 'blog/kid-and-pet-safe-lawn-care'], diy: ['blog/lawn-mowing-playlist'] },
    2: { diy: 'blog/mowing-the-lawn-is-a-workout', crew: 'blog/dog-pee-kids-bouncy-houses-lawn', robot: 'blog/dog-pee-kids-bouncy-houses-lawn' },
    3: 'blog/nitrogen-iron-lawn-before-party',
    4: 'blog/animals-in-your-lawn',
    5: 'guides/grubs-in-lawn',
  },
  8: {
    more: { all: ['guides/should-i-aerate-my-lawn', 'guides/fix-bare-spots-in-lawn', 'guides/when-to-overseed-lawn', 'guides/weed-killer-and-grass-seed', 'tool-seed-now'] },
    2: 'blog/lawn-soil-test',
    3: 'blog/grass-types-northeast',
    4: 'blog/fall-kill-weeds-or-plant-seed',
    5: 'guides/weed-killer-and-grass-seed',
  },
  9: {
    more: { all: ['tool-seedwatch', 'guides/when-to-fertilize-lawn', 'guides/how-long-to-wait-to-mow', 'blog/spreader-settings-half-rate-twice'] },
    2: 'blog/holiday-lawn-fertilizer-schedule',
    3: 'blog/is-my-grass-seed-growing',
    4: { diy: 'blog/granules-vs-spray', crew: 'blog/what-to-tell-your-landscaper', robot: 'tool-seedwatch' },
    5: 'guides/does-my-lawn-need-lime',
  },
  10: {
    more: { all: ['guides/should-i-mulch-leaves-into-lawn', 'guides/when-to-stop-mowing'], diy: ['blog/mulching-vs-bagging'] },
    2: 'blog/worst-trees-for-fall-leaves',
    3: 'blog/you-never-needed-a-leaf-blower',
    4: 'blog/halloween-is-the-lawn-super-bowl',
    5: 'guides/when-to-stop-mowing',
  },
  11: {
    more: { all: ['blog/lawn-stuff-you-dont-need'], diy: ['blog/lawn-mower-maintenance-diy'], crew: ['blog/lawn-treatment-program-explained'] },
    2: { diy: 'blog/lawn-off-season-training', robot: 'blog/lawn-off-season-training', crew: 'blog/pay-a-guy-or-diy-lawn-jobs' },
    3: 'blog/lawn-compliments',
    4: 'blog/lawn-gift-guide',
    5: 'tool-hall',
  },
  12: {
    more: { all: ['blog/lawn-care-dad-jokes', 'tool-hall'] },
    2: 'tool-games',
    3: { diy: 'blog/lawn-stuff-you-dont-need', crew: 'blog/lawn-stuff-you-dont-need', robot: 'blog/robot-mower-judging-you' },
    4: 'blog/power-ranking-every-excuse-for-a-bad-lawn',
    5: 'blog/explain-lawn-hobby-to-your-spouse',
  },
};

// Never sent to these tracks, even as a fallback (mowing technique for people who don't push a mower).
export const SKIP = {
  crew: new Set(['blog/one-third-rule-mowing', 'blog/sharpen-your-mower-blade', 'blog/lawn-mower-maintenance-diy', 'blog/walk-behind-vs-riding-vs-zero-turn-mower',
    'blog/lawn-mowing-etiquette', 'blog/mowing-the-lawn-is-a-workout', 'blog/lawn-mowing-playlist', 'blog/lawn-stripe-patterns', 'blog/stop-bagging-your-clippings',
    'blog/mulching-vs-bagging', 'blog/opening-day-first-mow', 'blog/lawn-off-season-training', 'blog/robot-mower-judging-you', 'guides/how-to-stripe-your-lawn', 'guides/how-high-to-mow-grass']),
  robot: new Set(['blog/sharpen-your-mower-blade', 'blog/lawn-mower-maintenance-diy', 'blog/walk-behind-vs-riding-vs-zero-turn-mower', 'blog/mowing-the-lawn-is-a-workout', 'blog/lawn-mowing-playlist']),
  diy: new Set(),
};
export const weekOf = (d) => Math.ceil(d.getDate() / 7); // 1–5
export function slotItem(month, week, track) {
  const s = CALENDAR[month]?.[week];
  if (!s) return '';
  return typeof s === 'string' ? s : s[track] || '';
}
export function moreItems(month, track) {
  const m = CALENDAR[month]?.more || {};
  return [...(m.all || []), ...(m[track] || [])];
}

// Every id the calendar schedules for a track (the fallback avoids using these up early).
const SCHEDULED = {};
export function scheduled(track) {
  if (SCHEDULED[track]) return SCHEDULED[track];
  const set = new Set();
  for (let m = 1; m <= 12; m++) for (let w = 2; w <= 5; w++) { const id = slotItem(m, w, track); if (id) set.add(id); }
  return (SCHEDULED[track] = set);
}
