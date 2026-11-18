// The auto social calendar's fixed data (Nov 17, 2026): platform specs, dated moments, the weekly rhythm,
// and the image-prompt builder. The calendar engine is worker/plan.js; the content pool is /crm/social-bank.json.
// No AI at runtime: copy comes from social.js, socialHooks.js and the site's own pages. Mike reviews all copy.

// What each platform wants. `auto` = HQ can post it for you (with that platform's token); else a copy card.
export const SPECS = {
  facebook: { name: 'Facebook', auto: true, limit: 2000, sweet: 250, image: '1200×630 link card (automatic) or 1080×1350 photo', link: 'Link in the post; Facebook builds the preview card', tags: '0–2 hashtags at most', best: 'Link posts with a short hook; Reels for reach' },
  instagram: { name: 'Instagram', auto: true, limit: 2200, sweet: 300, image: '1080×1350 (4:5 portrait) — required', link: 'Links don’t work in captions: “Link in bio” (point your bio at mowittall.com/links)', tags: '3–5 specific hashtags', best: 'Portrait images and Reels; hook in the first line' },
  threads: { name: 'Threads', auto: true, limit: 500, sweet: 280, image: 'Optional; 1080×1350 works', link: 'One link per post (shows a preview)', tags: 'One topic tag at most', best: 'Hot takes and questions' },
  bluesky: { name: 'Bluesky', auto: true, limit: 300, sweet: 250, image: 'Link card with the 1200×630 image (automatic)', link: 'Link card under the post (doesn’t eat characters)', tags: 'Optional', best: 'Short, conversational; replies matter' },
  pinterest: { name: 'Pinterest', auto: true, limit: 500, titleLimit: 100, sweet: 300, image: '1000×1500 (2:3 tall pin) — every post and guide has one', link: 'Every pin links to the page', tags: 'Keywords, not hashtags', best: 'How-to and seasonal searches, posted ~45 days ahead of the season' },
  x: { name: 'X', auto: false, limit: 280, sweet: 200, image: 'Optional; 1600×900 or the 1200×630 card', link: 'Links count as 23 characters', tags: '0–1 hashtag', best: 'Copy card only (X charges per post)' },
  nextdoor: { name: 'Nextdoor', auto: false, limit: 1500, sweet: 400, image: 'Optional photo', link: 'Link at the end, neighborly', tags: 'None', best: 'Once a week at most; helpful first, link second' },
  reddit: { name: 'Reddit', auto: false, limit: 300, sweet: 0, image: 'None', link: 'Only when it’s the best answer; answer in the comment first', tags: 'None', best: 'Answer questions (HQ → Reddit Radar); never drop links cold' },
  youtube: { name: 'YouTube', auto: false, limit: 100, sweet: 60, image: '1080×1920 Short or 1280×720 thumbnail', link: 'In the description', tags: '3 hashtags in the description', best: 'A Short a week: one tip, 30 seconds, captions on' },
};
export const AUTO_PLATFORMS = ['facebook', 'instagram', 'threads', 'bluesky', 'pinterest'];

// The weekly rhythm (0 = Sunday). Holidays, history, the 1st of the month and lawn-job days override it.
export const WEEK = {
  0: { slot: 'guide', label: 'Sunday Straight Answer' },
  1: { slot: 'tip', label: 'Monday Tip' },
  2: { slot: 'post', label: 'Tuesday Post' },
  3: { slot: 'tool', label: 'Wednesday Tool or Weed' },
  4: { slot: 'email', label: 'Thursday: This Week’s Email' },
  5: { slot: 'fun', label: 'Friday Fun' },
  6: { slot: 'weekend', label: 'Saturday Weekend Job' },
};

// Dated moments. on: 'MM-DD', or rule: ['nth', month, weekday, n] | ['last', month, weekday] | ['after', id, days].
// History dates are checked against sources (Nov 17, 2026):
//   Budding: British patent granted Aug 31, 1830 (Wikipedia "Lawn mower"; Country Life; Old Lawnmower Club patent index)
//   Hills: US patent No. 73,807 dated Jan 28, 1868 (the patent itself on Google Patents; ConnecticutHistory.org)
//   Burr: US patent 624,749 granted May 9, 1899 (Interesting Engineering)
//   National Lawn Care Month: April, promoted by NALP (formerly PLCAA) since 1992
export const MOMENTS = [
  { id: 'new-year', on: '01-01', kind: 'holiday', title: 'New Year’s Day', text: 'New year, same lawn. The one resolution you’ll actually keep: mow a little higher.', link: 'blog/lawn-new-years-resolutions' },
  { id: 'hills-patent', on: '01-28', kind: 'history', title: 'First US lawn mower patent (1868)', text: 'On this day in 1868, Amariah Hills of Hockanum, Connecticut got the first US patent for a reel lawn mower. The Northeast has been obsessed with lawns ever since.', link: 'blog/walk-behind-vs-riding-vs-zero-turn-mower' },
  { id: 'groundhog', on: '02-02', kind: 'holiday', title: 'Groundhog Day', text: 'Phil says six more weeks of winter. Your mower says that’s fine, it needs a tune-up anyway.', link: 'blog/lawn-mower-maintenance-diy' },
  { id: 'super-bowl', rule: ['nth', 2, 0, 2], kind: 'holiday', title: 'Super Bowl Sunday', text: 'Enjoy the game. But the real Super Bowl of lawns is Halloween, and I will die on this hill.', link: 'blog/halloween-is-the-lawn-super-bowl' },
  { id: 'valentines', on: '02-14', kind: 'holiday', title: 'Valentine’s Day', text: 'Happy Valentine’s Day to everyone whose partner tolerates the three spreaders in the garage.', link: 'blog/explain-lawn-hobby-to-your-spouse' },
  { id: 'presidents-day', rule: ['nth', 2, 1, 3], kind: 'holiday', title: 'Presidents’ Day sales', text: 'Presidents’ Day mower sales are out. Before you buy, here’s how to pick the right size for your yard.', link: 'guides/what-size-lawn-mower-do-i-need' },
  { id: 'dst-start', rule: ['nth', 3, 0, 2], kind: 'season', title: 'Clocks spring forward', text: 'Clocks went forward. Evening mowing is coming back. Get the mower ready now and skip the April rush at the shop.', link: 'blog/lawn-mower-maintenance-diy' },
  { id: 'st-patricks', on: '03-17', kind: 'holiday', title: 'St. Patrick’s Day', text: 'The only green you should be adding today is in a glass. Hold off on fertilizer until the lawn is actually growing.', link: 'guides/spring-lawn-cleanup-checklist' },
  { id: 'spring', on: '03-20', kind: 'season', title: 'First day of spring', text: 'First day of spring. The lawn is waking up. Don’t touch it until the ground is firm: here’s the checklist for when it is.', link: 'guides/spring-lawn-cleanup-checklist' },
  { id: 'lawn-care-month', on: '04-01', kind: 'lawn', title: 'National Lawn Care Month', text: 'April is National Lawn Care Month. Celebrate by doing less: mow high, leave the clippings, and get a free plan for your yard.', link: 'tool-plan' },
  { id: 'tax-day', on: '04-15', kind: 'lawn', title: 'Tax Day = crabgrass day', text: 'Paid the IRS? Now stop the crabgrass. Tax Day is your reminder: preventer goes down when the forsythia blooms.', link: 'guides/crabgrass-preventer-timing' },
  { id: 'earth-day', on: '04-22', kind: 'holiday', title: 'Earth Day', text: 'Earth Day lawn tip: leave the clippings. Free fertilizer, less plastic, less work.', link: 'blog/stop-bagging-your-clippings' },
  { id: 'arbor-day', rule: ['last', 4, 5], kind: 'holiday', title: 'Arbor Day', text: 'Happy Arbor Day. Love your trees. Just know which ones are going to bury your lawn in October.', link: 'blog/worst-trees-for-fall-leaves' },
  { id: 'derby', rule: ['nth', 5, 6, 1], kind: 'holiday', title: 'Kentucky Derby', text: 'Derby day. Fun fact: Kentucky bluegrass is the varsity captain of Northeast lawns. Here’s how it stacks up.', link: 'blog/grass-types-northeast' },
  { id: 'burr-patent', on: '05-09', kind: 'history', title: 'John Albert Burr’s mower patent (1899)', text: 'On this day in 1899, inventor John Albert Burr got US patent 624,749 for an improved mower that clogged less. Keep your blade sharp in his honor.', link: 'blog/sharpen-your-mower-blade' },
  { id: 'mothers-day', rule: ['nth', 5, 0, 2], kind: 'holiday', title: 'Mother’s Day', text: 'Happy Mother’s Day. Best gift: a freshly mowed lawn, and nobody asking where the rake is.', link: 'tool-hall' },
  { id: 'memorial-day', rule: ['last', 5, 1], kind: 'holiday', title: 'Memorial Day', text: 'Remembering those who served this Memorial Day. If you’re feeding the lawn this weekend, keep it light.', link: 'blog/holiday-lawn-fertilizer-schedule' },
  { id: 'fathers-day', rule: ['nth', 6, 0, 3], kind: 'holiday', title: 'Father’s Day', text: 'Happy Father’s Day to every dad who has ever said “who’s been driving on my lawn.” Here’s your mowing playlist.', link: 'blog/lawn-mowing-playlist' },
  { id: 'summer', on: '06-21', kind: 'season', title: 'First day of summer', text: 'Summer is here. Rule one: mow high. Rule two: brown is not dead.', link: 'blog/lawn-heat-wave-rules' },
  { id: 'july-4', on: '07-04', kind: 'holiday', title: 'Fourth of July', text: 'Happy Fourth. The lawn’s only job today: hold the cornhole boards. Let the kids and the dog have it.', link: 'blog/dog-pee-kids-bouncy-houses-lawn' },
  { id: 'budding-patent', on: '08-31', kind: 'history', title: 'The lawn mower turns another year older (1830)', text: 'On this day in 1830, Edwin Budding of Stroud, England got the patent for the first lawn mower. Before that: scythes, and sheep.', link: 'blog/walk-behind-vs-riding-vs-zero-turn-mower' },
  { id: 'labor-day', rule: ['nth', 9, 1, 1], kind: 'holiday', title: 'Labor Day', text: 'Labor Day: the one feeding every lawn needs. If you only fertilize once a year, today’s the day.', link: 'blog/holiday-lawn-fertilizer-schedule' },
  { id: 'fall', on: '09-22', kind: 'season', title: 'First day of fall', text: 'First day of fall, best time of year for Northeast lawns. Seeding? You’re right on time.', link: 'guides/how-to-overseed-lawn' },
  { id: 'columbus-day', rule: ['nth', 10, 1, 2], kind: 'holiday', title: 'Columbus Day', text: 'Columbus Day: the pre-game feeding for Halloween. Lawn Psychos, this is your day.', link: 'guides/when-to-fertilize-lawn' },
  { id: 'halloween', on: '10-31', kind: 'holiday', title: 'Halloween', text: 'It’s here. The Super Bowl of lawns. Mowed yesterday, edged today, stripes facing the street.', link: 'blog/halloween-is-the-lawn-super-bowl' },
  { id: 'dst-end', rule: ['nth', 11, 0, 1], kind: 'season', title: 'Clocks fall back', text: 'Clocks fell back. Fewer evenings to mow, and the grass is slowing down. Here’s when to call it for the year.', link: 'guides/when-to-stop-mowing' },
  { id: 'veterans-day', on: '11-11', kind: 'holiday', title: 'Veterans Day', text: 'Thank you to every veteran today. No lawn tips. Just thanks.', link: null },
  { id: 'thanksgiving', rule: ['nth', 11, 4, 4], kind: 'holiday', title: 'Thanksgiving', text: 'Grateful for rain on the right days, sharp blades, and a lawn that made it through another season. Happy Thanksgiving from Mow It Tall.', link: 'guides/when-to-stop-mowing' },
  { id: 'black-friday', rule: ['after', 'thanksgiving', 1], kind: 'holiday', title: 'Black Friday', text: 'Shopping for a lawn person? Skip the gimmicks. Small, useful gifts they’ll use every week.', link: 'blog/lawn-gift-guide' },
  { id: 'winter', on: '12-21', kind: 'season', title: 'First day of winter', text: 'Shortest day of the year. From here, every day gets a little longer. Opening Day is coming.', link: 'blog/lawn-off-season-training' },
  { id: 'christmas', on: '12-25', kind: 'holiday', title: 'Christmas', text: 'Merry Christmas. Lawn’s asleep. If you need a fix, there’s a snowy Christmas yard to mow in the games.', link: 'tool-games' },
  { id: 'nye', on: '12-31', kind: 'holiday', title: 'New Year’s Eve', text: 'Last day of the year. Want next year’s lawn plan ready by morning? Seven questions.', link: 'tool-plan' },
];

const nth = (y, m, wd, n) => { const d = new Date(Date.UTC(y, m - 1, 1)); const off = (wd - d.getUTCDay() + 7) % 7; return new Date(Date.UTC(y, m - 1, 1 + off + (n - 1) * 7)); };
const last = (y, m, wd) => { const d = new Date(Date.UTC(y, m, 0)); const off = (d.getUTCDay() - wd + 7) % 7; return new Date(Date.UTC(y, m - 1, d.getUTCDate() - off)); };
const iso = (d) => d.toISOString().slice(0, 10);
// Every moment's date in a given year: { 'YYYY-MM-DD': moment }
export function momentsFor(year) {
  const out = {}, byId = {};
  for (const m of MOMENTS) {
    let d = null;
    if (m.on) d = `${year}-${m.on}`;
    else if (m.rule[0] === 'nth') d = iso(nth(year, m.rule[1], m.rule[2], m.rule[3]));
    else if (m.rule[0] === 'last') d = iso(last(year, m.rule[1], m.rule[2]));
    if (d) { byId[m.id] = d; out[d] = m; }
  }
  for (const m of MOMENTS) if (m.rule?.[0] === 'after' && byId[m.rule[1]]) { const t = new Date(byId[m.rule[1]] + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + m.rule[2]); out[iso(t)] = m; }
  return out;
}

// A ready-to-paste prompt for ChatGPT / Gemini when a post would do better with a real-looking photo.
export function imagePrompt(item, platform = 'instagram') {
  const size = platform === 'pinterest' ? 'tall 2:3 (1000×1500)' : platform === 'youtube' ? 'vertical 9:16 (1080×1920)' : platform === 'facebook' ? 'landscape 1.91:1 (1200×630)' : 'portrait 4:5 (1080×1350)';
  const scene = item.photo || `A suburban Northeast front lawn that illustrates: ${item.title}`;
  return `Photo-realistic image, ${size}. ${scene.replace(/\.$/, '')}. Setting: a real, slightly imperfect suburban yard in the Northeast US (Westchester, NY), ${item.season || 'in season'}, natural daylight, shot on a phone from about chest height. No people's faces, no house numbers, no brand logos, no text or lettering in the image. Leave clean space in the top third for a headline.`;
}

// ---------------------------------------------------------------- the first weeks of a brand-new account (Nov 18, 2026)
// Mike started posting on Nov 18, 2026 with zero followers. Early on, posts should say what Mow It Tall is and show
// off the free tools, not talk to an audience that doesn't exist yet ("how to handle your lawn compliments").
//   series       one intro post per listed day (day 0 = start). A day taken by a holiday pushes it to the next free day.
//   quietDays    no "Your turn" questions (a question to an empty room looks sad); Friday gets a fun post instead.
//   audienceDays items in NEEDS_AUDIENCE wait this long (they assume people already follow and have good lawns).
export const LAUNCH = {
  start: '2026-11-18',
  quietDays: 28,
  audienceDays: 75,
  series: [
    [1, 'intro-hello'], [2, 'tool-measure'], [3, 'intro-name'], [5, 'intro-free'], [7, 'tool-weeds'], [9, 'intro-stance'],
  ],
};
// Intro posts (used once, ever). Mike reviews all copy.
export const LAUNCH_POSTS = [
  { id: 'hello', url: '/', title: 'Meet Mow It Tall',
    hooks: ['Hi, I’m Mike. I mow my own lawn in Bedford, NY, and I got tired of lawn advice written for Florida.'],
    take: 'Mow It Tall is the easy guide to a better lawn for Northeast homeowners. Plain answers, a few jokes, free tools, no sales pitch. Follow along for one useful thing a day.' },
  { id: 'name', url: '/guides/how-high-to-mow-grass/', title: 'Why “Mow It Tall”?',
    hooks: ['Why “Mow It Tall”? Because the easiest upgrade for almost any lawn is raising the mower.'],
    take: 'Taller grass shades out weeds, holds on to water and grows deeper roots. Most lawns around here get cut too short. That’s the whole name.' },
  { id: 'free', url: '/plan/', title: 'Start Here: Your Free Lawn Plan',
    hooks: ['Everything on Mow It Tall is free, no sign-up needed. Here’s the best place to start.'],
    take: 'Answer a few quick questions and get a lawn plan for your yard: what to do each month, and what you can skip.' },
  { id: 'stance', url: '/guides/when-to-overseed-lawn/', title: 'Seed in September',
    hooks: ['Something you’ll hear from me a lot: seed in September. Not spring. Not on top of the snow.'],
    take: 'In the Northeast, fall is when new grass actually wins. Spring seed has to fight crabgrass and summer heat. I’ll keep saying it until it sticks.' },
];
// Wait until the account has an audience (LAUNCH.audienceDays).
export const NEEDS_AUDIENCE = ['blog/lawn-compliments', 'engage-q-hall', 'engage-q-seed', 'engage-q-game', 'tool-hall'];
// Never scheduled automatically (Mike can still pick them by hand). The leaf blower post is being rewritten (Nov 18).
export const HOLD = ['blog/you-never-needed-a-leaf-blower'];
// Bump when the planning rules change: planned rows you haven't edited get re-planned from tomorrow on.
export const PLAN_V = 2;
