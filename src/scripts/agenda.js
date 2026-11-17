// The /calendar/ page: a vertical "schedule" view of the lawn year (like a phone calendar's
// Schedule view). One function builds the HTML so the server render (for search engines)
// and the browser render (live: today line, statuses, effort filter, rolling 12 months) match.
import { TASKS, MONTHS, MONTHS_LONG, windowText } from '../data/tasks.js';

export const LEVELS = [
  { name: 'Couch Potato', note: 'The bare minimum' },
  { name: 'Good Enough Guy', note: 'A little effort' },
  { name: 'Curb Appeal Hunter', note: 'Nicest on the street' },
  { name: 'Lawn Psycho', note: 'Everything. All of it.' },
];

// what kind of job each task is (color + legend)
export const KINDS = {
  feed: { name: 'Feeding', short: 'Feed' },
  mow: { name: 'Mowing & Gear', short: 'Mow' },
  weed: { name: 'Weeds & Bugs', short: 'Weeds' },
  soil: { name: 'Soil, Seed & Cleanup', short: 'Soil' },
};
const KIND_OF = {
  blade: 'mow', raise: 'mow', summer: 'mow', 'last-mow': 'mow', winter: 'mow',
  crabgrass: 'weed', 'spot-weeds': 'weed', 'fall-weeds': 'weed', grubs: 'weed',
  cleanup: 'soil', 'soil-test': 'soil', aerate: 'soil', seed: 'soil', lime: 'soil', leaves: 'soil',
};
const kindOf = (t) => (t.holiday ? 'feed' : KIND_OF[t.id] || 'soil');

// "Read more" links on the open card (this page only; the homepage cards stay link-free)
const MORE = {
  blade: ['/blog/sharpen-your-mower-blade/', 'How to sharpen it'],
  raise: ['/blog/your-landscaper-is-scalping-your-lawn/', 'Why tall grass wins'],
  crabgrass: ['/blog/pre-emergent-vs-post-emergent/', 'Preventer vs. killer'],
  'spring-feed': ['/blog/holiday-lawn-fertilizer-schedule/', 'The holiday schedule'],
  'july4-feed': ['/blog/holiday-lawn-fertilizer-schedule/', 'The holiday schedule'],
  'fall-feed': ['/blog/holiday-lawn-fertilizer-schedule/', 'The holiday schedule'],
  'columbus-feed': ['/blog/halloween-is-the-lawn-super-bowl/', 'Why Halloween matters'],
  'thanksgiving-feed': ['/blog/holiday-lawn-fertilizer-schedule/', 'The holiday schedule'],
  'soil-test': ['/blog/lawn-soil-test/', 'How to do a soil test'],
  lime: ['/blog/lawn-soil-test/', 'Read your soil test'],
  seed: ['/lawn-101/#grass', 'Pick your grass seed'],
  'fall-weeds': ['/blog/fall-kill-weeds-or-plant-seed/', 'Weeds or seed first?'],
  'spot-weeds': ['/weeds/', 'Name that weed'],
  leaves: ['/blog/you-never-needed-a-leaf-blower/', 'Mulch, don’t blow'],
  summer: ['/resources/should-i-water-my-lawn/', 'Should I water?'],
  winter: ['/blog/lawn-mower-maintenance-diy/', 'Mower care'],
};

// nth weekday (0 = Sunday) of month m (0-based); n = -1 is the last one
function nth(y, m, dow, n) {
  if (n < 0) {
    const d = new Date(y, m + 1, 0);
    while (d.getDay() !== dow) d.setDate(d.getDate() - 1);
    return d;
  }
  const d = new Date(y, m, 1);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return d;
}
// Holiday markers: small "all-day" chips on the real date (Claude's copy; Mike to review)
function holidays(y) {
  return [
    { id: 'tax', date: new Date(y, 3, 15), name: 'Tax Day', note: 'Crabgrass preventer down yet?', level: 1 },
    { id: 'memorial', date: nth(y, 4, 1, -1), name: 'Memorial Day', note: 'Feeding weekend.', level: 2 },
    { id: 'july4', date: new Date(y, 6, 4), name: 'July 4th', note: 'Half dose, only if you water.', level: 3 },
    { id: 'labor', date: nth(y, 8, 1, 1), name: 'Labor Day', note: 'The big feed. Don’t skip it.', level: 0 },
    { id: 'columbus', date: nth(y, 9, 1, 2), name: 'Columbus Day', note: 'Pre-game feed for Halloween.', level: 1 },
    { id: 'halloween', date: new Date(y, 9, 31), name: 'Halloween', note: 'Game day. Your lawn peaks tonight.', level: 0 },
    { id: 'thanks', date: nth(y, 10, 4, 4), name: 'Thanksgiving', note: 'Last call before the freeze.', level: 3 },
  ];
}

// one-line mood for each month header (Claude's copy; Mike to review)
const MOOD = ['Asleep', 'Still asleep', 'Waking up', 'Go time', 'Growing fast', 'Heating up', 'Survival mode', 'Hang in there', 'Prime time', 'Peak season', 'Winding down', 'Off season'];
// "Nothing new" line for a month with no new jobs at the chosen level (one per month so no two match).
// Nov–Feb lines are Mike's; the rest are Claude's copy, Mike to review.
const QUIET = [
  'Nothing new. Just try to stay off the frozen lawn.',
  'Nothing new. It’s sleeping, not dead. Admire it from a distance and don’t panic.',
  'Nothing new. Let it wake up on its own.',
  'Nothing new. Let it wake up, then mow with the deck up high.',
  'Nothing new. Mow tall and leave the clippings on the lawn.',
  'Nothing new. Mow tall, mow often, leave the clippings.',
  'Nothing new. Mow high and let it ride out the heat. Brown in a dry spell is just napping.',
  'Nothing new. Keep mowing tall. Labor Day is coming.',
  'Nothing new. Keep mowing tall while it grows like crazy.',
  'Nothing new. Keep the leaves off it. Halloween is game day.',
  'Nothing new. Just stay on top of the leaves and get ready for the last mow of the year.',
  'Nothing new. Just put the mower away right.',
];

const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'up', 'as']);
export const tc = (x) => x.split(' ').map((w, i, a) => (i && i < a.length - 1 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-'))).join(' ');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = 86400000;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const tasksFor = (level) => TASKS.filter((t) => t.level <= level);
// "9 jobs · about 6 hours a year" for an effort level
export function levelSummary(level) {
  const list = tasksFor(level);
  const mins = list.reduce((s, t) => s + (t.minutes || 0), 0);
  const hrs = Math.round(mins / 60);
  return `${plural(list.length, 'job')} · +${plural(Math.max(1, hrs), 'hr')} a year`;
}

// status of a task's window in a given year, relative to today
function status(t, y, today) {
  const start = new Date(y, t.start[0] - 1, t.start[1]);
  const end = new Date(y, t.end[0] - 1, t.end[1], 23, 59);
  if (today < start) {
    const days = Math.ceil((start - today) / DAY);
    return days <= 45 ? { state: 'next', text: `Starts in ${plural(days, 'day')}` } : null;
  }
  if (today > end) return null;
  const left = Math.ceil((end - today) / DAY);
  return { state: 'now', text: `Do it now · ${plural(left, 'day')} left` };
}

function taskCard(t, y, today) {
  const k = kindOf(t);
  const s = today ? status(t, y, today) : null;
  const more = MORE[t.id];
  const mins = t.minutes ? ` · ${t.minutes >= 60 ? `${t.minutes / 60} hr` : `${t.minutes} min`}` : '';
  return `<details class="ag-ev is-${k}${s ? ` is-${s.state}` : ''}" id="t-${t.id}-${y}" data-task="${t.id}">
<summary><span class="ag-ev-top"><b class="ag-ev-title">${esc(tc(t.title))}</b><i class="ag-ev-plus" aria-hidden="true"></i></span>
<span class="ag-ev-meta">${windowText(t)}${mins}</span>${s ? `<span class="ag-ev-status">${s.text}</span>` : ''}</summary>
<div class="ag-ev-body"><p>${esc(t.short)}</p><p><b>How:</b> ${esc(t.why)}</p>${t.tip ? `<p><b>Tip:</b> ${esc(t.tip)}</p>` : ''}${more ? `<a class="ag-more" href="${more[0]}">${esc(more[1])} →</a>` : ''}</div>
</details>`;
}

function holidayChip(h) {
  return `<p class="ag-hol"><b>${esc(h.name)}</b> ${esc(h.note)}</p>`;
}

// months: [{y, m (1-12)}]. today: Date or null (server render). level: 0-3.
export function agendaHTML({ months, today = null, level = 3 }) {
  const list = tasksFor(level);
  const todayKey = today ? ymd(today) : null;
  let html = '';
  months.forEach(({ y, m }, idx) => {
    const isCur = today && today.getFullYear() === y && today.getMonth() + 1 === m;
    // rows keyed by date: task window starts + holiday markers
    const rows = new Map();
    const add = (d, kind, item) => {
      const key = ymd(d);
      if (!rows.has(key)) rows.set(key, { d, hol: [], ev: [] });
      rows.get(key)[kind].push(item);
    };
    for (const t of list) if (t.start[0] === m) add(new Date(y, m - 1, t.start[1]), 'ev', t);
    for (const h of holidays(y)) if (h.date.getMonth() + 1 === m && h.level <= level) add(h.date, 'hol', h);
    const sorted = [...rows.values()].sort((a, b) => a.d - b.d);
    const jobs = sorted.reduce((n, r) => n + r.ev.length, 0);
    const label = `${MONTHS_LONG[m - 1]}${idx === 0 || m === 1 ? ` ${y}` : ''}`;
    html += `<section class="ag-month${isCur ? ' is-current' : ''}" id="m-${y}-${m}" data-ym="${y}-${m}" aria-label="${MONTHS_LONG[m - 1]} ${y}">
<h2 class="ag-mhead"><span class="ag-mname">${label}</span><span class="ag-mood">${MOOD[m - 1]}${jobs ? ` · ${plural(jobs, 'job')}` : ''}</span></h2>`;
    if (!sorted.length) {
      html += `<p class="ag-empty">${QUIET[m - 1]}</p>`;
    }
    for (const r of sorted) {
      const isToday = todayKey === ymd(r.d);
      html += `<div class="ag-day${isToday ? ' is-today' : ''}"><p class="ag-date"><span>${DOW[r.d.getDay()]}</span><b>${r.d.getDate()}</b></p><div class="ag-items">${r.hol.map(holidayChip).join('')}${r.ev.map((t) => taskCard(t, y, today)).join('')}</div></div>`;
    }
    html += `<a class="ag-mlink" href="/calendar/${MONTHS_LONG[m - 1].toLowerCase()}/">More on ${MONTHS_LONG[m - 1]} lawn care →</a></section>`;
  });
  return html;
}

// the 12 calendar months of a year, or a rolling run of `count` months from a start month
export const yearMonths = (y) => Array.from({ length: 12 }, (_, i) => ({ y, m: i + 1 }));
export const rollingMonths = (y, m, count) => Array.from({ length: count }, (_, i) => {
  const k = m - 1 + i;
  return { y: y + Math.floor(k / 12), m: (k % 12) + 1 };
});

// a yearly-repeating phone calendar file: one all-day reminder on each window's start
export function icsFor(level, today = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const d8 = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const e = (s) => s.replace(/[\\;,]/g, (x) => `\\${x}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = tasksFor(level).map((t) => {
    let y = today.getFullYear();
    if (new Date(y, t.end[0] - 1, t.end[1], 23, 59) < today) y += 1;
    const d = new Date(y, t.start[0] - 1, t.start[1]);
    return ['BEGIN:VEVENT', `UID:${t.id}-yearly@mowittall.com`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d8(d)}`, `DTEND;VALUE=DATE:${d8(new Date(d.getTime() + DAY))}`, 'RRULE:FREQ=YEARLY',
      `SUMMARY:${e('Lawn: ' + tc(t.title))}`,
      `DESCRIPTION:${e(`${t.short} ${t.why}\nGood window: ${windowText(t)}.\nmowittall.com/calendar/`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', `DESCRIPTION:${e(tc(t.title))}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mow It Tall//Lawn calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Mow It Tall Lawn Calendar', ...events, 'END:VCALENDAR'].join('\r\n');
}
