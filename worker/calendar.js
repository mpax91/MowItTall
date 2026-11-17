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
    more: { all: ['tool-games', 'guides/ice-melt-safe-for-lawn'], diy: ['blog/lawn-off-season-training'], robot: ['blog/lawn-off-season-training'] },
    2: 'blog/lawn-new-years-resolutions',
    3: 'blog/lawn-care-dad-jokes',
    4: 'blog/explain-lawn-hobby-to-your-spouse',
    5: 'tool-games',
  },
  2: {
    more: { all: ['tool-hall', 'blog/power-ranking-every-excuse-for-a-bad-lawn'], diy: ['blog/pay-a-guy-or-diy-lawn-jobs', 'blog/starter-lawn-kit', 'guides/what-size-lawn-mower-do-i-need'], crew: ['blog/starter-lawn-kit'], robot: ['blog/should-i-hire-a-lawn-service', 'blog/starter-lawn-kit'] },
    2: { diy: 'blog/lawn-mower-maintenance-diy', crew: 'blog/lawn-treatment-program-explained', robot: 'blog/robot-mower-problems' },
    3: 'blog/power-ranking-every-excuse-for-a-bad-lawn',
    4: { diy: 'blog/should-i-hire-a-lawn-service', crew: 'blog/should-i-hire-a-lawn-service', robot: 'blog/lawn-stuff-you-dont-need' },
    5: 'tool-hall',
  },
  3: {
    more: { all: ['guides/spring-lawn-cleanup-checklist', 'guides/snow-mold-and-vole-damage', 'guides/ice-melt-safe-for-lawn'], diy: ['blog/walk-behind-vs-riding-vs-zero-turn-mower', 'guides/self-propelled-vs-push-mower', 'blog/is-a-robot-mower-worth-it'], crew: ['blog/is-a-robot-mower-worth-it'], robot: ['blog/opening-day-first-mow'] },
    2: 'blog/lawn-weed-bracket',
    3: 'blog/spring-seeding',
    4: { diy: 'blog/opening-day-first-mow', robot: 'guides/robot-mower-settings-by-season', crew: 'blog/what-to-tell-your-landscaper' },
    5: { diy: 'blog/sharpen-your-mower-blade', crew: 'blog/pay-a-guy-or-diy-lawn-jobs', robot: 'guides/moss-in-lawn' },
  },
  4: {
    more: { all: ['guides/crabgrass-preventer-timing', 'blog/how-to-use-a-spreader', 'guides/moss-in-lawn'], diy: ['blog/sharpen-your-mower-blade', 'guides/zero-turn-vs-riding-mower'], crew: ['blog/pay-a-guy-or-diy-lawn-jobs'] },
    2: 'blog/pre-emergent-vs-post-emergent',
    3: 'blog/how-to-read-a-fertilizer-bag',
    4: { diy: 'blog/one-third-rule-mowing', crew: 'blog/your-landscaper-is-scalping-your-lawn', robot: 'blog/robot-mower-judging-you' },
    5: { diy: 'blog/walk-behind-vs-riding-vs-zero-turn-mower', crew: 'blog/how-to-use-a-spreader', robot: 'blog/how-to-use-a-spreader' },
  },
  5: {
    more: { all: ['guides/get-rid-of-clover-in-lawn', 'guides/types-of-lawn-fertilizer'], diy: ['guides/how-high-to-mow-grass', 'blog/one-third-rule-mowing', 'blog/robot-mower-judging-you'], robot: ['blog/robot-mower-judging-you'] },
    2: { diy: 'blog/lawn-mowing-etiquette', robot: 'blog/lawn-mowing-etiquette', crew: 'blog/is-my-landscaper-doing-a-good-job' },
    3: { diy: 'blog/stop-bagging-your-clippings', crew: 'blog/granules-vs-spray', robot: 'blog/granules-vs-spray' },
    4: 'tool-weeds',
    5: 'blog/spreader-settings-half-rate-twice',
  },
  6: {
    more: { all: ['guides/how-often-to-water-lawn', 'blog/dog-pee-kids-bouncy-houses-lawn', 'guides/mushrooms-in-lawn'], diy: ['guides/how-to-stripe-your-lawn', 'blog/mulching-vs-bagging'], crew: ['blog/your-landscaper-is-scalping-your-lawn'] },
    2: { diy: 'blog/lawn-mowing-playlist', crew: 'blog/kid-and-pet-safe-lawn-care', robot: 'blog/kid-and-pet-safe-lawn-care' },
    // Watering depends on their answer: sprinkler people get the settings guide, no-water people the no-water plan.
    3: { all: 'tool-rain', by: { water: { auto: 'guides/how-long-to-run-sprinklers', never: 'blog/lawn-care-without-watering' } } },
    4: { diy: 'blog/lawn-stripe-patterns', robot: 'blog/lawn-stripe-patterns', crew: 'guides/how-often-to-water-lawn' },
    5: { diy: 'blog/mulching-vs-bagging', crew: 'blog/dog-pee-kids-bouncy-houses-lawn', robot: 'blog/dog-pee-kids-bouncy-houses-lawn' },
  },
  7: {
    more: { all: ['guides/grubs-in-lawn', 'blog/nitrogen-iron-lawn-before-party', 'guides/how-long-to-run-sprinklers', 'blog/lawn-care-without-watering'], diy: ['blog/lawn-heat-wave-rules', 'blog/kid-and-pet-safe-lawn-care'], crew: ['blog/kid-and-pet-safe-lawn-care'], robot: ['blog/kid-and-pet-safe-lawn-care'] },
    2: { diy: 'blog/mowing-the-lawn-is-a-workout', crew: 'blog/lawn-heat-wave-rules', robot: 'blog/lawn-heat-wave-rules' },
    3: 'blog/crabgrass-already-up',
    4: 'blog/animals-in-your-lawn',
    5: 'guides/is-my-lawn-dead-or-dormant',
  },
  8: {
    more: { all: ['guides/how-to-overseed-lawn', 'guides/fix-bare-spots-in-lawn', 'guides/should-i-aerate-my-lawn', 'guides/weed-killer-and-grass-seed', 'guides/is-my-lawn-dead-or-dormant', 'tool-seed-now'] },
    2: 'blog/lawn-soil-test',
    // Shady lawns get the shade grass guide instead of the general grass ranking.
    3: { all: 'blog/grass-types-northeast', by: { sun: { shade: 'guides/grass-for-shade', mixed: 'guides/grass-for-shade' } } },
    4: 'blog/fall-kill-weeds-or-plant-seed',
    5: 'guides/fix-bare-spots-in-lawn',
  },
  9: {
    more: { all: ['tool-seedwatch', 'blog/holiday-lawn-fertilizer-schedule', 'guides/when-to-fertilize-lawn', 'guides/how-long-to-wait-to-mow', 'guides/grass-for-shade'] },
    2: 'guides/how-to-water-new-grass-seed',
    3: 'blog/is-my-grass-seed-growing',
    4: { diy: 'blog/granules-vs-spray', crew: 'blog/what-to-tell-your-landscaper', robot: 'tool-seedwatch' },
    5: 'guides/does-my-lawn-need-lime',
  },
  10: {
    more: { all: ['guides/should-i-mulch-leaves-into-lawn', 'guides/when-to-stop-mowing', 'guides/mushrooms-in-lawn'], diy: ['blog/mulching-vs-bagging'], robot: ['guides/robot-mower-settings-by-season'] },
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
    more: { all: ['guides/ice-melt-safe-for-lawn', 'blog/starter-lawn-kit', 'blog/lawn-care-dad-jokes'], robot: ['guides/robot-mower-settings-by-season'] },
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
    'blog/mulching-vs-bagging', 'blog/opening-day-first-mow', 'blog/lawn-off-season-training', 'blog/robot-mower-judging-you', 'guides/how-to-stripe-your-lawn', 'guides/how-high-to-mow-grass',
    'guides/self-propelled-vs-push-mower', 'guides/zero-turn-vs-riding-mower', 'guides/what-size-lawn-mower-do-i-need', 'blog/robot-mower-problems', 'guides/robot-mower-settings-by-season']),
  robot: new Set(['blog/sharpen-your-mower-blade', 'blog/lawn-mower-maintenance-diy', 'blog/walk-behind-vs-riding-vs-zero-turn-mower', 'blog/mowing-the-lawn-is-a-workout', 'blog/lawn-mowing-playlist',
    'guides/self-propelled-vs-push-mower', 'guides/zero-turn-vs-riding-mower', 'guides/what-size-lawn-mower-do-i-need', 'blog/is-a-robot-mower-worth-it']),
  diy: new Set(['blog/robot-mower-problems', 'guides/robot-mower-settings-by-season']),
};
export const weekOf = (d) => Math.ceil(d.getDate() / 7); // 1–5
export function slotItem(month, week, track, answers = {}) {
  const s = CALENDAR[month]?.[week];
  if (!s) return '';
  if (typeof s === 'string') return s;
  // Profile-based swaps: { by: { water: { auto: id } } } picks an item for people who answered that way.
  for (const [field, map] of Object.entries(s.by || {})) if (answers[field] && map[answers[field]]) return map[answers[field]];
  return s[track] || s.all || '';
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
  for (let m = 1; m <= 12; m++) for (let w = 2; w <= 5; w++) { const sp = CALENDAR[m]?.[w]; const id = slotItem(m, w, track); if (id) set.add(id); for (const map of Object.values(sp?.by || {})) for (const v of Object.values(map)) set.add(v); }
  return (SCHEDULED[track] = set);
}
