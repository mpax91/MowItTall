// The auto social calendar + publisher + Reddit Radar (Nov 17, 2026). No AI anywhere: posts are assembled from
// the site's own copy (/crm/social-bank.json, built from social.js, socialHooks.js, guides, weeds, month pages,
// tasks) on a weekly rhythm with holidays, lawn history, lawn-job days and the Thursday email lined up.
//
// How a day gets its post:
//   1. A dated moment (holiday, lawn history, season marker) → that moment.
//   2. The 1st of the month → that month's page.
//   3. The first day of a lawn job's window (blade, crabgrass, seed, Labor Day feed…) → the job.
//   4. Otherwise the weekday slot (socialPlan.js WEEK): Sun guide, Mon tip, Tue post, Wed tool or weed,
//      Thu the same item as this week's email (worker/calendar.js), Fri question or fun post, Sat weekend job.
// Picks prefer in-season items, never reuse a post or guide within a year (tools ~2 months, tips/questions a year),
// avoid repeating a topic two days running, and rotate hooks so a repeat next year reads differently.
// Pinterest gets its own daily pin, chosen ~45 days ahead of the season (that's how people search Pinterest).
// Nextdoor gets a copy card on Saturdays only.
//
// Rows live in DB `sp_rows` (one per day per platform), created lazily up to a year ahead. Edited rows are kept
// when you re-plan. The hourly cron (plus a :00 cron just for this) posts today's rows once their time passes,
// only when Posting is set to Live in HQ and that platform is switched on.
//
// Posting secrets (same tokens as the analytics pulls, with posting permissions added):
//   META_PAGE_TOKEN       Facebook Page posts (pages_manage_posts) + Instagram (instagram_content_publish)
//   THREADS_TOKEN         threads_content_publish (refreshed by worker/social.js)
//   BLUESKY_APP_PASSWORD  Bluesky → Settings → Privacy and security → App passwords (handle: BLUESKY_HANDLE)
//   PINTEREST_TOKEN       pins:write + boards:read (Trial access: pins are only visible to you until Standard access)
import { momentsFor, WEEK, SPECS, AUTO_PLATFORMS, imagePrompt, LAUNCH, NEEDS_AUDIENCE, HOLD, PLAN_V } from '../src/data/socialPlan.js';
import { IDEAS } from '../src/data/socialHooks.js';
import { BASE_TAGS, TOPIC_TAGS } from '../src/data/social.js';
import { TASKS } from '../src/data/tasks.js';
import { placeOf } from '../src/scripts/agenda.js';
import { slotItem, moreItems, weekOf } from './calendar.js';
import { gradeAll, plannerSignals } from './grades.js';

const SITE = 'https://mowittall.com';
const DAY = 86400000;
const TZ = 'America/New_York';
const PLAN_PLATFORMS = ['facebook', 'instagram', 'threads', 'bluesky', 'pinterest', 'x', 'nextdoor'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const etNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
};
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
const firstSentence = (s) => (String(s || '').match(/^.*?[.!?](\s|$)/) || [String(s || '')])[0].trim();
const DEFAULTS = { live: false, platforms: { facebook: true, instagram: true, threads: true, bluesky: true, pinterest: true }, times: { 0: '10:00', 1: '10:00', 2: '10:00', 3: '10:00', 4: '10:00', 5: '10:00', 6: '10:00' } };

let ready = null;
export async function planInit(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS sp_rows (date TEXT NOT NULL, platform TEXT NOT NULL, slot TEXT, label TEXT, item TEXT, hook INTEGER, title TEXT, text TEXT,
        image TEXT, link TEXT, status TEXT NOT NULL DEFAULT 'planned', edited INTEGER NOT NULL DEFAULT 0, gap INTEGER NOT NULL DEFAULT 0, post_id TEXT, post_url TEXT, error TEXT,
        posted_at INTEGER, updated INTEGER, PRIMARY KEY (date, platform))`),
      db.prepare('CREATE INDEX IF NOT EXISTS sp_rows_item ON sp_rows (item, date)'),
      db.prepare('CREATE TABLE IF NOT EXISTS sp_kv (k TEXT PRIMARY KEY, v TEXT, at INTEGER)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS reddit_radar (id TEXT PRIMARY KEY, sub TEXT, title TEXT, body TEXT, url TEXT, author TEXT, created INTEGER, score INTEGER, comments INTEGER,
        matched TEXT, fit REAL, status TEXT NOT NULL DEFAULT 'new', seen_at INTEGER)`),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
}
async function kvGet(db, k, d = null) { const r = await db.prepare('SELECT v FROM sp_kv WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : d; }
async function kvSet(db, k, v) { await db.prepare('INSERT INTO sp_kv (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now()).run(); }
export async function settings(db) { const s = await kvGet(db, 'settings', {}); return { ...DEFAULTS, ...s, platforms: { ...DEFAULTS.platforms, ...(s.platforms || {}) }, times: { ...DEFAULTS.times, ...(s.times || {}) } }; }

/* ================================================================ the content pool */
let bankCache = null;
export async function bank(env) {
  if (bankCache && Date.now() - bankCache.at < 10 * 60000) return bankCache;
  const r = await env.ASSETS.fetch(new Request(`${SITE}/crm/social-bank.json`));
  if (!r.ok) throw new Error('The social content pool isn’t in this build yet (/crm/social-bank.json).');
  const { items, built } = await r.json();
  bankCache = { at: Date.now(), built, items, byId: Object.fromEntries(items.map((x) => [x.id, x])) };
  return bankCache;
}
export const REUSE = { post: 365, guide: 365, weed: 330, month: 330, tip: 330, job: 330, moment: 300, engage: 180, tool: 42, intro: 100000 };
// A post that did much better than usual (see hotItems) can come back after this many days, with its next hook.
export const HOT_REUSE = 75;
const launchDay = (date) => dayDiff(LAUNCH.start, date);
const HOLD_SET = new Set(HOLD), AUDIENCE_SET = new Set(NEEDS_AUDIENCE);
// Rules for a brand-new account and for held items (socialPlan.js LAUNCH / NEEDS_AUDIENCE / HOLD).
function allowed(it, date) {
  if (HOLD_SET.has(it.id)) return false;
  const ld = launchDay(date);
  if (ld < LAUNCH.audienceDays && AUDIENCE_SET.has(it.id)) return false;
  if (ld < LAUNCH.quietDays && it.kind === 'engage') return false;
  return true;
}

/* ================================================================ planning */
// History: when each item last went (or is planned to go) out, and how many times, from sp_rows + HQ → Social's log.
async function history(env) {
  const { results } = await env.DB.prepare("SELECT item, date, platform FROM sp_rows WHERE status != 'skipped' AND item IS NOT NULL").all();
  const byItem = {}, pinByItem = {}, byDate = {};
  for (const r of results) {
    if (r.platform === 'pinterest') (pinByItem[r.item] ||= []).push(r.date);
    else if (r.platform === 'facebook' || r.platform === 'instagram') { (byItem[r.item] ||= new Set()).add(r.date); byDate[r.date] = r.item; }
  }
  try {
    const { results: log } = await env.DB.prepare('SELECT item, platform, at FROM social_log').all();
    for (const l of log) {
      const id = l.item.startsWith('tool-') ? l.item : l.item.startsWith('guide-') ? `guides/${l.item.slice(6)}` : `blog/${l.item}`;
      const d = new Date(l.at).toISOString().slice(0, 10);
      if (l.platform === 'pinterest') (pinByItem[id] ||= []).push(d); else (byItem[id] ||= new Set()).add(d);
    }
  } catch { /* no HQ log yet */ }
  const hot = await hotItems(env);
  // Post grades (worker/grades.js, Nov 19): an item whose latest settled drop got an A, or that Mike marked Favorite,
  // is an encore; D/F nudge it down; "Rest" (Mike's mark, or two D/F runs in a row) keeps it off the calendar.
  let grades = new Map();
  try {
    grades = plannerSignals(await gradeAll(env, { B: await bank(env).catch(() => null) }));
    for (const [id, g] of grades) if ((g.letter === 'A' || g.favorite) && !g.rest) hot.set(id, Math.max(hot.get(id) || 0, 3));
  } catch { /* no grades yet */ }
  return { byItem: Object.fromEntries(Object.entries(byItem).map(([k, v]) => [k, [...v].sort()])), pinByItem, byDate, hot, grades };
}
// Hot items: a post whose likes + comments + shares + saves came in at 2× (or more) the platform's usual post,
// with at least 5. Matched from the calendar's posted rows to the stats HQ Analytics pulls (EV social_posts).
async function hotItems(env) {
  const hot = new Map();
  if (!env.EV) return hot;
  try {
    const { results: rows } = await env.DB.prepare("SELECT item, platform, post_id, post_url FROM sp_rows WHERE status = 'posted' AND item IS NOT NULL AND (post_id IS NOT NULL OR post_url IS NOT NULL)").all();
    if (!rows.length) return hot;
    const { results: stats } = await env.EV.prepare('SELECT platform, id, url, COALESCE(likes, 0) + COALESCE(comments, 0) + COALESCE(shares, 0) + COALESCE(saves, 0) eng FROM social_posts').all();
    const med = {}, byKey = new Map();
    const per = {}; for (const p of stats) (per[p.platform] ||= []).push(p.eng);
    for (const [k, v] of Object.entries(per)) { v.sort((a, b) => a - b); med[k] = v[Math.floor(v.length / 2)] || 0; }
    for (const p of stats) { byKey.set(`${p.platform}|${p.id}`, p); if (p.url) byKey.set(`${p.platform}|${p.url}`, p); }
    for (const r of rows) {
      const p = byKey.get(`${r.platform}|${r.post_id}`) || byKey.get(`${r.platform}|${r.post_url}`) || [...byKey.values()].find((x) => x.platform === r.platform && r.post_id && String(x.id).endsWith(String(r.post_id).split('_').pop()));
      if (!p || (per[r.platform] || []).length < 4) continue;
      const ratio = p.eng / Math.max(1, med[r.platform]);
      if (p.eng >= 5 && ratio >= 2) hot.set(r.item, Math.max(hot.get(r.item) || 0, ratio));
    }
  } catch { /* stats not there yet */ }
  return hot;
}
const recentWithin = (dates = [], date, days) => dates.some((d) => d !== date && Math.abs(dayDiff(d, date)) < days);
const timesBefore = (dates = [], date) => dates.filter((d) => d < date).length;

function pick(B, H, date, kinds, { month, avoidTopics = [], prefer = null, pinterest = false, allowOff = false } = {}) {
  const m = month || Number(date.slice(5, 7)), next = m % 12 + 1;
  let best = null, bestScore = -Infinity;
  for (const it of B.items) {
    if (!kinds.includes(it.kind)) continue;
    if (pinterest && !it.pin) continue;
    if (!allowed(it, date)) continue;
    const gr = H.grades?.get(it.id);
    if (gr?.rest) continue; // resting: Mike's mark, or its last two runs got a D or F
    const used = pinterest ? H.pinByItem[it.id] : H.byItem[it.id];
    const isHot = !pinterest && H.hot?.has(it.id) && it.kind !== 'tool';
    if (recentWithin(used, date, pinterest ? 365 : isHot ? HOT_REUSE : REUSE[it.kind] || 365)) continue;
    let s = !it.months.length ? 1.2 : it.months.includes(m) ? 3 : it.months.includes(next) ? 1.6 : -4;
    if (s < 0 && !allowOff) continue;
    if ((it.kind === 'tip' || it.kind === 'month') && !it.months.includes(m)) continue; // "October tip" only in October // never burn an out-of-season post early: it would be missing when its season comes
    if (it.topics?.some((t) => avoidTopics.includes(t))) s -= 1;
    if (prefer && prefer(it)) s += 1.5;
    if (isHot && used?.length) s += 1 + Math.min(1, (H.hot.get(it.id) - 2) / 4); // encore: it did great last time
    if (gr && !pinterest) {
      s += { B: 0.5, D: -0.8, F: -1.5 }[gr.letter] || 0;
      // This time last year it got an A or B: bring it back around the same date.
      if (gr.goodDates.some((d) => Math.abs(dayDiff(d, addDays(date, -365))) <= 21)) s += 0.7;
    }
    s += (hash(date + it.id) % 1000) / 2500; // stable tie-break, so a re-plan gives the same answer
    if (s > bestScore) { bestScore = s; best = it; }
  }
  return best ? { item: best, gap: bestScore < 0 } : null;
}

// Lawn-job days: the first day of each job's window (holiday jobs: 4 days before the holiday), levels 0–2.
function jobDays(year) {
  const out = {};
  for (const t of TASKS) {
    if (t.level > 2) continue;
    const on = placeOf(t, year);
    const d = new Date(Date.UTC(on.getFullYear(), on.getMonth(), on.getDate()));
    if (t.holiday || t.id === 'crabgrass') d.setUTCDate(d.getUTCDate() - 4);
    out[d.toISOString().slice(0, 10)] = `job-${t.id}`;
  }
  return out;
}

function planDay(B, H, date, cache) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), dnum = Number(date.slice(8, 10));
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const moments = (cache.m[y] ||= momentsFor(y));
  const jobs = (cache.j[y] ||= jobDays(y));
  const prevTopics = [B.byId[H.byDate[addDays(date, -1)]]?.topics || [], B.byId[H.byDate[addDays(date, -2)]]?.topics || []].flat();
  let slot, label, chosen = null;
  const mo = moments[date];
  const ld = launchDay(date);
  const intro = !mo && ld >= 0 ? LAUNCH.series.find(([d, id]) => d <= ld && B.byId[id] && !(H.byItem[id] || []).some((x) => x !== date)) : null;
  if (mo) { slot = 'moment'; label = mo.title; chosen = { item: B.byId[`moment-${mo.id}`] }; }
  else if (intro) { slot = 'launch'; label = 'Getting Started: Meet Mow It Tall'; chosen = { item: B.byId[intro[1]] }; }
  else if (dnum === 1 && B.byId[`month-${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][m - 1]}`]) {
    slot = 'month'; label = 'First of the Month'; chosen = { item: B.byId[`month-${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][m - 1]}`] };
  } else if (jobs[date] && B.byId[jobs[date]] && !recentWithin(H.byItem[jobs[date]], date, 300)) { slot = 'job'; label = 'Lawn Job Day'; chosen = { item: B.byId[jobs[date]] }; }
  else {
    ({ slot, label } = WEEK[dow]);
    const avoidTopics = prevTopics;
    if (slot === 'guide') chosen = pick(B, H, date, ['guide'], { avoidTopics });
    else if (slot === 'tip') chosen = pick(B, H, date, ['tip'], { avoidTopics }) || pick(B, H, date, ['guide'], { avoidTopics });
    else if (slot === 'post') chosen = pick(B, H, date, ['post'], { avoidTopics });
    else if (slot === 'tool') chosen = (weekOf(new Date(date + 'T12:00:00')) % 2 ? pick(B, H, date, ['tool'], { avoidTopics }) : pick(B, H, date, ['weed'], { avoidTopics })) || pick(B, H, date, ['tool', 'weed'], { avoidTopics });
    else if (slot === 'email') {
      const wk = weekOf(new Date(date + 'T12:00:00'));
      const ids = [wk > 1 ? slotItem(m, wk, 'diy') : '', ...moreItems(m, 'diy')].filter(Boolean);
      const id = ids.find((x) => B.byId[x] && !recentWithin(H.byItem[x], date, 300));
      chosen = id ? { item: B.byId[id] } : pick(B, H, date, ['post', 'guide'], { avoidTopics });
      if (id && wk > 1 && id === slotItem(m, wk, 'diy')) label = 'Thursday: Same as This Week’s Email';
    } else if (slot === 'fun') {
      chosen = pick(B, H, date, ['engage'], { avoidTopics }) || pick(B, H, date, ['post'], { prefer: (it) => it.topics?.includes('fun') });
      if (launchDay(date) < LAUNCH.quietDays) label = 'Friday Fun (no questions yet: building the audience first)';
    }
    else if (slot === 'weekend') {
      const open = TASKS.filter((t) => t.level <= 2 && inWindow(t, m, dnum)).map((t) => `job-${t.id}`);
      chosen = pick(B, H, date, ['job'], { prefer: (it) => open.includes(it.id), avoidTopics });
      if (!chosen || !open.includes(chosen.item.id)) chosen = pick(B, H, date, ['guide', 'post'], { avoidTopics });
    }
    if (!chosen) chosen = pick(B, H, date, ['post', 'guide', 'weed', 'tip', 'engage', 'tool'], { avoidTopics });
    if (!chosen) chosen = lru(B, H, date);
  }
  if (chosen?.item && H.hot?.has(chosen.item.id) && (H.byItem[chosen.item.id] || []).some((d) => d < date)) label = `${label} · Encore (did great last time)`;
  // Pinterest: its own pick, ~45 days ahead of the season
  const ahead = addDays(date, 45);
  const pin = pick(B, H, date, ['guide', 'post'], { month: Number(ahead.slice(5, 7)), pinterest: true });
  return { slot, label, item: chosen?.item || null, gap: !!chosen?.gap, pin: pin?.item || null };
}
// Last resort when everything fresh is used up: the evergreen item that went out longest ago (at least 3 weeks).
function lru(B, H, date) {
  const m = Number(date.slice(5, 7));
  let best = null, bestAge = -1;
  for (const it of B.items) {
    if (!['tool', 'engage'].includes(it.kind) || (it.months.length && !it.months.includes(m)) || !allowed(it, date)) continue; // posts and guides keep the once-a-year rule
    const used = (H.byItem[it.id] || []).filter((d) => d !== date);
    const near = used.reduce((a, d) => Math.min(a, Math.abs(dayDiff(d, date))), 9999);
    if (near < 21) continue;
    const age = near + (hash(date + it.id) % 100) / 1000;
    if (age > bestAge) { bestAge = age; best = it; }
  }
  return best ? { item: best, gap: true } : null;
}
const inWindow = (t, m, d) => { const v = m * 100 + d, s = t.start[0] * 100 + t.start[1], e = t.end[0] * 100 + t.end[1]; return s <= e ? v >= s && v <= e : v >= s || v <= e; };

/* ================================================================ copy per platform */
// Visible links stay clean (no utm tags in the copy). Links that sit behind a preview card (Facebook's link field,
// Bluesky's card, Pinterest) keep utm tags so HQ Analytics knows exactly which platform sent the visit.
const HIDDEN_LINK = new Set(['facebook', 'bluesky', 'pinterest']); // the link sits behind a card, so utm tags don't show
const cleanLink = (url) => (url ? `${SITE}${url}` : '');
const stripUtm = (u) => String(u || '').replace(/[?&]utm_[a-z]+=[^&#]*/g, '').replace(/^([^?#]*)&/, '$1?');
const linkFor = (url, platform) => (url ? `${SITE}${url.split('#')[0]}${url.includes('?') ? '&' : '?'}utm_source=${platform}&utm_medium=social&utm_campaign=daily${url.includes('#') ? '#' + url.split('#')[1] : ''}` : '');
const fit = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,;:]+\S*$/, '') + '…');
function hashtags(it) {
  const t = [...new Set([...BASE_TAGS, ...(it.topics || []).flatMap((x) => TOPIC_TAGS[x] || [])])];
  return t.slice(0, 5).join(' ');
}
export function buildText(it, platform, hookIdx = 0) {
  const hook = it.hooks[hookIdx % it.hooks.length];
  const take = it.take || '';
  const L = cleanLink(it.url);
  const plain = it.kind === 'moment' || it.kind === 'engage';
  switch (platform) {
    case 'facebook': return [hook, plain ? '' : take, L].filter(Boolean).join('\n\n');
    case 'instagram': return fit([hook, plain ? '' : take, it.url ? 'Link in bio (it’s the first one).' : '', hashtags(it)].filter(Boolean).join('\n\n'), 2200);
    case 'threads': { const body = plain ? hook : `${hook}\n\n${firstSentence(take)}`; return `${fit(body, 500 - (L ? L.length + 2 : 0))}${L ? `\n\n${L}` : ''}`; }
    case 'bluesky': { let t = plain ? hook : `${hook} ${firstSentence(take)}`; if (graphemes(t) > 300) t = hook; return graphemes(t) > 300 ? fit(t, 295) : t; }
    case 'x': return `${fit(hook, 280 - (L ? 24 : 0))}${L ? ` ${L}` : ''}`;
    case 'nextdoor': return `Hi neighbors! ${it.nd || `${hook} ${firstSentence(take)}`}${L ? `\n\nI wrote it all up here, free, no sign-up: ${L}` : ''}`;
    case 'pinterest': return it.pin ? it.pin.desc : fit(take, 500);
    default: return hook;
  }
}
function rowsFor(B, H, date, plan) {
  const out = [];
  const it = plan.item;
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  if (it) {
    const n = timesBefore(H.byItem[it.id], date);
    for (const p of ['facebook', 'instagram', 'threads', 'bluesky', 'x']) {
      out.push({ date, platform: p, slot: plan.slot, label: plan.label, item: it.id, hook: n, title: it.title, text: buildText(it, p, n),
        image: p === 'instagram' || p === 'threads' ? it.card : p === 'bluesky' || p === 'x' ? it.og : null, link: it.url ? (HIDDEN_LINK.has(p) ? linkFor(it.url, p) : cleanLink(it.url)) : null, gap: plan.gap ? 1 : 0 });
    }
    if (dow === 6 && it.nd !== null) out.push({ date, platform: 'nextdoor', slot: plan.slot, label: plan.label, item: it.id, hook: n, title: it.title, text: buildText(it, 'nextdoor', n), image: null, link: cleanLink(it.url), gap: 0 });
  }
  if (plan.pin) out.push({ date, platform: 'pinterest', slot: 'pin', label: 'Daily Pin (45 days ahead)', item: plan.pin.id, hook: 0, title: plan.pin.pin.title, text: plan.pin.pin.desc, image: plan.pin.pin.img, link: linkFor(plan.pin.url, 'pinterest'), gap: 0 });
  return out;
}
async function saveRows(db, rows) {
  if (!rows.length) return;
  const now = Date.now();
  for (let i = 0; i < rows.length; i += 40) {
    await db.prepare(`INSERT OR IGNORE INTO sp_rows (date, platform, slot, label, item, hook, title, text, image, link, gap, status, updated)
      SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5, j.value->>6, j.value->>7, j.value->>8, j.value->>9, j.value->>10, 'planned', j.value->>11 FROM json_each(?) j`)
      .bind(JSON.stringify(rows.slice(i, i + 40).map((r) => [r.date, r.platform, r.slot, r.label, r.item, r.hook, r.title, r.text, r.image, r.link, r.gap, now]))).run();
  }
}
// Make sure every day from..to (today or later) has rows. Days are planned in order so each pick sees the last.
export async function ensurePlanned(env, from, to) {
  const today = etNow().date;
  // New planning rules (PLAN_V): re-plan everything from tomorrow that you haven't edited or posted.
  if ((await kvGet(env.DB, 'planV', 1)) !== PLAN_V) {
    await env.DB.prepare("DELETE FROM sp_rows WHERE date > ? AND edited = 0 AND status = 'planned'").bind(today).run();
    await kvSet(env.DB, 'planV', PLAN_V);
    bankCache = null;
  }
  if (from < today) from = today;
  if (to < from) return 0;
  const { results } = await env.DB.prepare('SELECT DISTINCT date FROM sp_rows WHERE date BETWEEN ? AND ?').bind(from, to).all();
  const have = new Set(results.map((r) => r.date));
  const missing = []; for (let d = from; d <= to; d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
  if (!missing.length) return 0;
  const B = await bank(env);
  const H = await history(env);
  const cache = { m: {}, j: {} };
  const rows = [];
  for (const d of missing) {
    const plan = planDay(B, H, d, cache);
    const rs = rowsFor(B, H, d, plan);
    rows.push(...rs);
    for (const r of rs) { // so the next day's pick knows about this one
      if (r.platform === 'pinterest') (H.pinByItem[r.item] ||= []).push(d);
      else if (r.platform === 'facebook') { (H.byItem[r.item] ||= []).push(d); H.byDate[d] = r.item; }
    }
  }
  await saveRows(env.DB, rows);
  return missing.length;
}

/* ================================================================ publishing */
async function metaIds(env) {
  const r = await fetch(`https://graph.facebook.com/me?fields=id,instagram_business_account&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || r.status);
  return { page: j.id, ig: j.instagram_business_account?.id || null };
}
async function post(url, body, headers = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok || j.error) throw new Error(j.error?.message || j.message || (typeof j.error === 'string' ? j.error : '') || t.slice(0, 200) || r.status);
  return j;
}
async function threadsToken(env) { try { const r = await env.EV?.prepare("SELECT v FROM ax_state WHERE k = 'threads:token'").first(); const s = r ? JSON.parse(r.v) : null; if (s?.token && s.from === env.THREADS_TOKEN.slice(-12)) return s.token; } catch { /* */ } return env.THREADS_TOKEN; }
async function pinterestToken(env) { try { const r = await env.EV?.prepare("SELECT v FROM ax_state WHERE k = 'pinterest:token'").first(); const s = r ? JSON.parse(r.v) : null; if (s?.token && s.from === String(env.PINTEREST_TOKEN).slice(-12)) return s.token; } catch { /* */ } return env.PINTEREST_TOKEN; }
const abs = (u) => (u && u.startsWith('/') ? SITE + u : u);

const PUBLISHERS = {
  facebook: { on: (env) => !!env.META_PAGE_TOKEN, async go(env, row) {
    const { page } = await metaIds(env);
    const body = { message: row.text.replace(row.link || '\u0000', '').replace(stripUtm(row.link) || '\u0000', '').trim(), access_token: env.META_PAGE_TOKEN };
    if (row.link) body.link = row.link;
    const j = await post(`https://graph.facebook.com/${page}/feed`, body);
    return { id: j.id, url: `https://www.facebook.com/${j.id}` };
  } },
  instagram: { on: (env) => !!env.META_PAGE_TOKEN, async go(env, row) {
    const { ig } = await metaIds(env);
    if (!ig) throw new Error('No Instagram professional account is linked to the Facebook Page.');
    if (!row.image) throw new Error('Instagram needs an image.');
    const c = await post(`https://graph.facebook.com/${ig}/media`, { image_url: abs(row.image), caption: row.text, access_token: env.META_PAGE_TOKEN });
    // Instagram processes the image first; publishing right away usually works for images, retry once if not.
    let j; try { j = await post(`https://graph.facebook.com/${ig}/media_publish`, { creation_id: c.id, access_token: env.META_PAGE_TOKEN }); }
    catch { await new Promise((r) => setTimeout(r, 4000)); j = await post(`https://graph.facebook.com/${ig}/media_publish`, { creation_id: c.id, access_token: env.META_PAGE_TOKEN }); }
    let url = null; try { const p = await (await fetch(`https://graph.facebook.com/${j.id}?fields=permalink&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`)).json(); url = p.permalink || null; } catch { /* */ }
    return { id: j.id, url };
  } },
  threads: { on: (env) => !!env.THREADS_TOKEN, async go(env, row) {
    const tok = await threadsToken(env);
    const c = await post('https://graph.threads.net/v1.0/me/threads', { media_type: 'TEXT', text: row.text, access_token: tok });
    await new Promise((r) => setTimeout(r, 2000));
    const j = await post('https://graph.threads.net/v1.0/me/threads_publish', { creation_id: c.id, access_token: tok });
    let url = null; try { const p = await (await fetch(`https://graph.threads.net/v1.0/${j.id}?fields=permalink&access_token=${encodeURIComponent(tok)}`)).json(); url = p.permalink || null; } catch { /* */ }
    return { id: j.id, url };
  } },
  bluesky: { on: (env) => !!env.BLUESKY_APP_PASSWORD, async go(env, row) {
    const B = 'https://bsky.social/xrpc';
    const handle = env.BLUESKY_HANDLE || 'mowittall.com';
    const s = await post(`${B}/com.atproto.server.createSession`, { identifier: handle, password: env.BLUESKY_APP_PASSWORD });
    const auth = { authorization: `Bearer ${s.accessJwt}` };
    const record = { $type: 'app.bsky.feed.post', text: row.text, createdAt: new Date().toISOString(), langs: ['en'] };
    if (row.link) {
      const it = (await bank(env)).byId[row.item] || {};
      const external = { uri: row.link, title: it.linkTitle || it.title || 'Mow It Tall', description: (it.take || '').slice(0, 280) };
      if (row.image) {
        try {
          const img = await env.ASSETS.fetch(new Request(abs(row.image.split('?')[0])));
          if (img.ok) { const up = await fetch(`${B}/com.atproto.repo.uploadBlob`, { method: 'POST', headers: { ...auth, 'content-type': img.headers.get('content-type') || 'image/png' }, body: await img.arrayBuffer() }); const uj = await up.json(); if (uj.blob) external.thumb = uj.blob; }
        } catch { /* card without a picture */ }
      }
      record.embed = { $type: 'app.bsky.embed.external', external };
    }
    const j = await post(`${B}/com.atproto.repo.createRecord`, { repo: s.did, collection: 'app.bsky.feed.post', record }, auth);
    return { id: j.uri, url: `https://bsky.app/profile/${handle}/post/${j.uri.split('/').pop()}` };
  } },
  pinterest: { on: (env) => !!env.PINTEREST_TOKEN, async go(env, row) {
    const H = { authorization: `Bearer ${await pinterestToken(env)}` };
    const it = (await bank(env)).byId[row.item] || {};
    const boards = await (await fetch('https://api.pinterest.com/v5/boards?page_size=100', { headers: H })).json();
    const list = boards.items || [];
    const want = (it.pin?.board || '').toLowerCase();
    const board = list.find((b) => b.name.toLowerCase() === want) || list.find((b) => /beginner|lawn care/i.test(b.name)) || list[0];
    if (!board) throw new Error('No Pinterest boards found. Make the boards first (HQ → Social → Pinterest lists them).');
    const j = await post('https://api.pinterest.com/v5/pins', { board_id: board.id, title: (row.title || '').slice(0, 100), description: (row.text || '').slice(0, 500), link: row.link,
      alt_text: (it.pin?.alt || row.title || '').slice(0, 500), media_source: { source_type: 'image_url', url: abs(row.image) } }, H);
    return { id: j.id, url: `https://www.pinterest.com/pin/${j.id}/` };
  } },
};
async function publishRow(env, row) {
  const P = PUBLISHERS[row.platform];
  if (!P) return { ok: false, error: 'This platform is copy-and-paste only.' };
  if (!P.on(env)) return { ok: false, error: `${SPECS[row.platform].name} isn’t connected yet (add its token: HQ Analytics → Sources & Export).` };
  try {
    const r = await P.go(env, row);
    await env.DB.batch([
      env.DB.prepare("UPDATE sp_rows SET status = 'posted', post_id = ?, post_url = ?, error = NULL, posted_at = ?, updated = ? WHERE date = ? AND platform = ?").bind(r.id, r.url, Date.now(), Date.now(), row.date, row.platform),
      // so HQ → Social's "last posted" queue knows too
      env.DB.prepare('INSERT INTO social_log (item, platform, at) VALUES (?, ?, ?)').bind(row.item.startsWith('blog/') ? row.item.slice(5) : row.item.startsWith('guides/') ? `guide-${row.item.slice(7)}` : row.item, row.platform === 'threads' || row.platform === 'bluesky' ? 'x' : row.platform, Date.now()),
    ]);
    return { ok: true, ...r };
  } catch (e) {
    await env.DB.prepare("UPDATE sp_rows SET status = 'failed', error = ?, updated = ? WHERE date = ? AND platform = ?").bind(String(e.message || e).slice(0, 300), Date.now(), row.date, row.platform).run();
    return { ok: false, error: e.message };
  }
}
// Cron: plan two weeks ahead, then post anything due today.
export async function planTick(env) {
  if (!env.DB) return {};
  await planInit(env.DB);
  const { date, hm } = etNow();
  const did = {};
  try { did.planned = await ensurePlanned(env, date, addDays(date, 14)); } catch (e) { did.planError = e.message; }
  const s = await settings(env.DB);
  if (!s.live) return did;
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  if (hm < (s.times[dow] || '10:00')) return did;
  const { results } = await env.DB.prepare("SELECT * FROM sp_rows WHERE date = ? AND status = 'planned'").bind(date).all();
  for (const row of results) {
    if (!AUTO_PLATFORMS.includes(row.platform) || !s.platforms[row.platform]) continue;
    did[row.platform] = await publishRow(env, row);
  }
  return did;
}

/* ================================================================ Reddit Radar */
// Finds fresh questions on Reddit that the site already answers. Read-only: you reply yourself.
const SUBS = ['lawncare', 'landscaping', 'homeowners', 'Westchester', 'HomeImprovement', 'gardening', 'NewHampshire', 'Connecticut', 'newjersey', 'massachusetts'];
const LAWN_ONLY = new Set(['homeowners', 'Westchester', 'HomeImprovement', 'gardening', 'NewHampshire', 'Connecticut', 'newjersey', 'massachusetts']); // need a lawn word to count
const TOPICS = [
  [/crab ?grass/, ['guides/crabgrass-preventer-timing', 'blog/crabgrass-already-up']], [/pre-?emergent|prodiamine|dithiopyr/, ['blog/pre-emergent-vs-post-emergent']],
  [/overseed|over-seed|grass seed|seeding|bare spot|bare patch/, ['guides/how-to-overseed-lawn', 'guides/fix-bare-spots-in-lawn', 'guides/when-to-overseed-lawn']],
  [/grub/, ['guides/grubs-in-lawn']], [/moss/, ['guides/moss-in-lawn']], [/clover/, ['guides/get-rid-of-clover-in-lawn']], [/\blime\b|soil ph|acidic/, ['guides/does-my-lawn-need-lime', 'blog/lawn-soil-test']],
  [/aerat/, ['guides/should-i-aerate-my-lawn']], [/fertili[sz]/, ['guides/when-to-fertilize-lawn', 'blog/how-to-read-a-fertilizer-bag', 'guides/types-of-lawn-fertilizer']],
  [/how (high|short|tall) .*mow|mowing height|cut height/, ['guides/how-high-to-mow-grass']], [/mushroom/, ['guides/mushrooms-in-lawn']],
  [/dormant|brown (lawn|grass)|is my (lawn|grass) dead/, ['guides/is-my-lawn-dead-or-dormant', 'blog/lawn-heat-wave-rules']], [/water(ing)? (the )?(lawn|grass)|sprinkler|irrigation/, ['guides/how-often-to-water-lawn', 'guides/how-long-to-run-sprinklers']],
  [/leaves|leaf blower|mulch(ing)? leaves/, ['guides/should-i-mulch-leaves-into-lawn', 'blog/mulch-rake-or-blow-leaves']], [/salt|ice melt|plow/, ['guides/ice-melt-safe-for-lawn']],
  [/vole|snow mold/, ['guides/snow-mold-and-vole-damage']], [/shade/, ['guides/grass-for-shade']], [/robot mower|robotic mower/, ['blog/is-a-robot-mower-worth-it', 'blog/robot-mower-problems']],
  [/zero.?turn|riding mower|lawn tractor/, ['guides/zero-turn-vs-riding-mower']], [/self.?propelled/, ['guides/self-propelled-vs-push-mower']], [/spreader/, ['blog/how-to-use-a-spreader', 'blog/spreader-settings-half-rate-twice']],
  [/soil test/, ['blog/lawn-soil-test']], [/stripe|striping/, ['guides/how-to-stripe-your-lawn', 'blog/lawn-stripe-patterns']], [/clippings|bag(ging)? (the )?grass/, ['blog/stop-bagging-your-clippings', 'blog/mulching-vs-bagging']],
  [/dull blade|sharpen/, ['blog/sharpen-your-mower-blade']], [/landscaper|lawn service|lawn guy/, ['blog/what-to-tell-your-landscaper', 'blog/should-i-hire-a-lawn-service']],
  [/dog (pee|urine|spot)/, ['blog/dog-pee-kids-bouncy-houses-lawn']], [/weed killer.*seed|seed.*weed killer|tenacity|mesotrione/, ['guides/weed-killer-and-grass-seed']],
  [/new grass|new seed|germinat/, ['blog/is-my-grass-seed-growing', 'guides/how-to-water-new-grass-seed']], [/when (to|should i) (stop|last) mow/, ['guides/when-to-stop-mowing']],
  [/nutsedge|nut sedge/, ['weed-nutsedge']], [/dandelion/, ['weed-dandelion']], [/creeping charlie|ground ivy/, ['weed-creeping-charlie']], [/violet/, ['weed-wild-violet']],
  [/what (is this|kind of) weed|identify (this )?weed|weed id/, ['tool-weeds']], [/what (grass|seed) should|which (grass|seed)/, ['tool-grass', 'blog/grass-types-northeast']],
];
const LAWN_WORD = /lawn|grass|turf|yard|mow/;
const NE = /\b(ny|nj|ct|ma|nh|vt|me|ri|pa|new york|new jersey|connecticut|massachusetts|new england|northeast|westchester|long island|hudson valley|zone ?[67][ab]?|cool[- ]season)\b/;
async function redditGet(env, path) {
  const user = env.REDDIT_USERNAME || 'MowItTALL';
  const UA = `cloudflare-worker:mowittall-hq:1.0 (by /u/${user})`;
  if (env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_PASSWORD) {
    let tok = await kvGet(env.DB, 'reddit:tok');
    if (!tok || tok.exp < Date.now() + 60000) {
      const r = await fetch('https://www.reddit.com/api/v1/access_token', { method: 'POST', headers: { authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
        body: `grant_type=password&username=${encodeURIComponent(user)}&password=${encodeURIComponent(env.REDDIT_PASSWORD)}` });
      const j = await r.json();
      if (!j.access_token) throw new Error(`Reddit sign-in failed: ${j.error || r.status}`);
      tok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
      await kvSet(env.DB, 'reddit:tok', tok);
    }
    const r = await fetch(`https://oauth.reddit.com${path}`, { headers: { authorization: `Bearer ${tok.t}`, 'user-agent': UA } });
    if (!r.ok) throw new Error(`Reddit ${r.status}`);
    return r.json();
  }
  const r = await fetch(`https://www.reddit.com${path.replace(/(\?|$)/, '.json$1')}`, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`Reddit ${r.status} (Reddit often blocks Cloudflare without an app: add the REDDIT_* secrets)`);
  return r.json();
}
export async function radarTick(env, { force = false } = {}) {
  await planInit(env.DB);
  const last = await kvGet(env.DB, 'radar:last', 0);
  if (!force && Date.now() - last < 6 * 3600000) return { skipped: true };
  await kvSet(env.DB, 'radar:last', Date.now());
  const B = await bank(env).catch(() => ({ byId: {} }));
  let found = 0; const errors = [];
  for (const sub of SUBS) {
    let j; try { j = await redditGet(env, `/r/${sub}/new?limit=50`); } catch (e) { errors.push(`r/${sub}: ${e.message}`); if (/40[13]|blocks/.test(e.message)) break; continue; }
    const rows = [];
    for (const c of j.data?.children || []) {
      const p = c.data; if (!p || p.stickied || p.over_18 || p.locked) continue;
      const ageH = (Date.now() / 1000 - p.created_utc) / 3600; if (ageH > 72) continue;
      const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
      if (LAWN_ONLY.has(sub) && !LAWN_WORD.test(text)) continue;
      const matched = [...new Set(TOPICS.filter(([re]) => re.test(text)).flatMap(([, ids]) => ids).filter((id) => B.byId[id] || !Object.keys(B.byId).length))];
      if (!matched.length) continue;
      const question = /\?|how do|should i|what (is|do|should)|help|advice|anyone know/.test(text);
      const fitScore = matched.length * 2 + (question ? 2 : 0) + (NE.test(text) ? 3 : 0) + (p.num_comments < 5 ? 2 : p.num_comments < 15 ? 1 : 0) + (ageH < 12 ? 2 : ageH < 24 ? 1 : 0) + (sub === 'lawncare' ? 1 : 0);
      rows.push([`t3_${p.id}`, sub, p.title.slice(0, 300), (p.selftext || '').slice(0, 1200), `https://www.reddit.com${p.permalink}`, p.author, Math.round(p.created_utc * 1000), p.score, p.num_comments, JSON.stringify(matched.slice(0, 4)), fitScore, Date.now()]);
    }
    if (rows.length) {
      await env.DB.prepare(`INSERT INTO reddit_radar (id, sub, title, body, url, author, created, score, comments, matched, fit, seen_at)
        SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5, j.value->>6, j.value->>7, j.value->>8, j.value->>9, j.value->>10, j.value->>11 FROM json_each(?) j WHERE true
        ON CONFLICT (id) DO UPDATE SET score = excluded.score, comments = excluded.comments, fit = excluded.fit`).bind(JSON.stringify(rows)).run();
      found += rows.length;
    }
  }
  await env.DB.prepare("DELETE FROM reddit_radar WHERE created < ? AND status != 'done'").bind(Date.now() - 14 * DAY).run();
  await kvSet(env.DB, 'radar:result', { at: Date.now(), found, errors });
  return { found, errors };
}
// A reply draft from the matching article: the short answer, then an optional link.
function replyDraft(it) {
  if (!it) return '';
  const ans = it.short || firstSentence(it.take) || it.hooks?.[0] || '';
  return `${ans}\n\n${it.take && it.take !== ans ? it.take.replace(ans, '').trim() + '\n\n' : ''}I wrote up the details (free, no sign-up) here if it helps: ${cleanLink(it.url)}`.trim();
}

/* ================================================================ HQ endpoints */
export async function planAdmin(env, req, url) {
  await planInit(env.DB);
  const p = url.pathname;
  const B = await bank(env);
  if (p === '/api/admin/plan' && req.method === 'GET') {
    const today = etNow().date;
    const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : today;
    const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : addDays(from, 13);
    if (dayDiff(from, to) > 400) return json({ error: 'Pick a shorter range.' }, 400);
    await ensurePlanned(env, today, to); // plan in order from today, so every pick knows what came before
    const { results } = await env.DB.prepare('SELECT * FROM sp_rows WHERE date BETWEEN ? AND ? ORDER BY date').bind(from, to).all();
    const items = {};
    for (const r of results) if (r.item && B.byId[r.item] && !items[r.item]) { const it = B.byId[r.item]; items[r.item] = { id: it.id, kind: it.kind, label: it.label, title: it.title, url: it.url, card: it.card, og: it.og, pin: it.pin, hooks: it.hooks, take: it.take, months: it.months, prompt: imagePrompt({ ...it, title: it.linkTitle || it.title }) }; }
    const s = await settings(env.DB);
    const connected = Object.fromEntries(Object.entries(PUBLISHERS).map(([k, v]) => [k, v.on(env)]));
    return json({ today, from, to, rows: results, items, settings: s, connected, specs: SPECS, built: B.built });
  }
  if (p === '/api/admin/plan/row' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (!DATE_RE.test(b.date || '') || !PLAN_PLATFORMS.includes(b.platform)) return json({ error: 'Bad row.' }, 400);
    const row = await env.DB.prepare('SELECT * FROM sp_rows WHERE date = ? AND platform = ?').bind(b.date, b.platform).first();
    if (!row) return json({ error: 'No such row.' }, 404);
    if (row.status === 'posted' && !b.force) return json({ error: 'Already posted.' }, 400);
    if (typeof b.text === 'string') await env.DB.prepare('UPDATE sp_rows SET text = ?, edited = 1, updated = ? WHERE date = ? AND platform = ?').bind(b.text.slice(0, 5000), Date.now(), b.date, b.platform).run();
    if (b.status && ['planned', 'skipped', 'copied'].includes(b.status)) await env.DB.prepare('UPDATE sp_rows SET status = ?, error = NULL, updated = ? WHERE date = ? AND platform = ?').bind(b.status, Date.now(), b.date, b.platform).run();
    return json({ ok: true, row: await env.DB.prepare('SELECT * FROM sp_rows WHERE date = ? AND platform = ?').bind(b.date, b.platform).first() });
  }
  // Swap a day's item (every platform except Pinterest, or just Pinterest).
  if (p === '/api/admin/plan/swap' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const it = B.byId[b.item];
    if (!DATE_RE.test(b.date || '') || !it) return json({ error: 'Pick a day and an item.' }, 400);
    const H = await history(env);
    const n = timesBefore(H.byItem[it.id], b.date);
    if (b.pinterest) {
      if (!it.pin) return json({ error: 'That item has no pin.' }, 400);
      await env.DB.prepare(`INSERT OR REPLACE INTO sp_rows (date, platform, slot, label, item, hook, title, text, image, link, status, edited, updated) VALUES (?, 'pinterest', 'pin', 'Daily Pin', ?, 0, ?, ?, ?, ?, 'planned', 1, ?)`)
        .bind(b.date, it.id, it.pin.title, it.pin.desc, it.pin.img, linkFor(it.url, 'pinterest'), Date.now()).run();
    } else {
      const old = await env.DB.prepare("SELECT slot, label FROM sp_rows WHERE date = ? AND platform = 'facebook'").bind(b.date).first();
      const rows = rowsFor(B, H, b.date, { slot: old?.slot || 'custom', label: old?.label || 'Your Pick', item: it, gap: false, pin: null });
      await env.DB.prepare("DELETE FROM sp_rows WHERE date = ? AND platform != 'pinterest' AND status != 'posted'").bind(b.date).run();
      await saveRows(env.DB, rows);
      await env.DB.prepare("UPDATE sp_rows SET edited = 1 WHERE date = ? AND platform != 'pinterest'").bind(b.date).run();
      void n;
    }
    return json({ ok: true });
  }
  // Suggestions for a day's swap menu: best unused items for that date, by kind.
  if (p === '/api/admin/plan/options' && req.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!DATE_RE.test(date || '')) return json({ error: 'Pick a day.' }, 400);
    const H = await history(env);
    const m = Number(date.slice(5, 7));
    const opts = B.items.filter((it) => !['moment'].includes(it.kind)).map((it) => {
      const used = H.byItem[it.id] || [];
      const last = used.filter((d) => d !== date).sort().pop() || null;
      const season = !it.months.length ? 1 : it.months.includes(m) ? 2 : 0;
      return { id: it.id, kind: it.kind, label: it.label, title: it.title, season, last, pin: !!it.pin };
    }).sort((a, b) => b.season - a.season || (a.last || '').localeCompare(b.last || ''));
    return json({ options: opts });
  }
  if (p === '/api/admin/plan/publish' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const row = await env.DB.prepare('SELECT * FROM sp_rows WHERE date = ? AND platform = ?').bind(b.date, b.platform).first();
    if (!row) return json({ error: 'No such row.' }, 404);
    if (row.status === 'posted') return json({ error: 'Already posted.' }, 400);
    return json(await publishRow(env, row));
  }
  if (p === '/api/admin/plan/settings' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const s = await settings(env.DB);
    if (typeof b.live === 'boolean') s.live = b.live;
    if (b.platforms) for (const k of AUTO_PLATFORMS) if (typeof b.platforms[k] === 'boolean') s.platforms[k] = b.platforms[k];
    if (b.times) for (const [d, t] of Object.entries(b.times)) if (/^[0-6]$/.test(d) && /^\d{2}:\d{2}$/.test(t)) s.times[d] = t;
    await kvSet(env.DB, 'settings', s);
    return json({ ok: true, settings: s });
  }
  // Re-plan from a date: drops rows you haven't edited or posted and plans them again (new posts get picked up).
  if (p === '/api/admin/plan/replan' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const from = DATE_RE.test(b.from || '') ? b.from : etNow().date;
    const r = await env.DB.prepare("DELETE FROM sp_rows WHERE date >= ? AND edited = 0 AND status = 'planned'").bind(from).run();
    bankCache = null;
    return json({ ok: true, dropped: r.meta?.changes || 0 });
  }
  // Write next: idea list ranked by the months with the thinnest coverage in the plan.
  if (p === '/api/admin/plan/ideas' && req.method === 'GET') {
    const today = etNow().date;
    const { results } = await env.DB.prepare("SELECT substr(date, 6, 2) m, SUM(gap) gaps, COUNT(*) n FROM sp_rows WHERE platform = 'facebook' AND date >= ? GROUP BY m").bind(today).all();
    const gaps = Object.fromEntries(results.map((r) => [Number(r.m), r.gaps]));
    const perMonth = {}; for (const it of B.items) if (['post', 'guide'].includes(it.kind)) for (const mo of it.months) perMonth[mo] = (perMonth[mo] || 0) + 1;
    const cur = Number(today.slice(5, 7));
    const ideas = IDEAS.map((i) => {
      const soon = i.months.map((mo) => (mo - cur + 12) % 12).sort((a, b) => a - b)[0];
      const thin = Math.min(...i.months.map((mo) => perMonth[mo] || 0));
      return { ...i, gaps: i.months.reduce((a, mo) => a + (gaps[mo] || 0), 0), thin, soon, score: (6 - Math.min(soon, 6)) * 2 + Math.max(0, 8 - thin) + i.months.reduce((a, mo) => a + (gaps[mo] || 0), 0) };
    }).sort((a, b) => b.score - a.score);
    return json({ ideas, coverage: perMonth, gaps });
  }
  if (p === '/api/admin/plan/radar' && req.method === 'GET') {
    if (url.searchParams.get('refresh')) await radarTick(env, { force: true });
    const status = url.searchParams.get('status') || 'new';
    const { results } = await env.DB.prepare('SELECT * FROM reddit_radar WHERE status = ? ORDER BY fit DESC, created DESC LIMIT 60').bind(status).all();
    const rows = results.map((r) => { const m = JSON.parse(r.matched || '[]'); const it = B.byId[m[0]]; return { ...r, matched: m.map((id) => ({ id, title: B.byId[id]?.title || id, url: B.byId[id]?.url })), draft: replyDraft(it) }; });
    return json({ rows, last: await kvGet(env.DB, 'radar:result'), connected: !!(env.REDDIT_CLIENT_ID && env.REDDIT_PASSWORD) });
  }
  if (p === '/api/admin/plan/radar' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (!['new', 'done', 'hidden'].includes(b.status)) return json({ error: 'Bad status.' }, 400);
    await env.DB.prepare('UPDATE reddit_radar SET status = ? WHERE id = ?').bind(b.status, String(b.id || '')).run();
    return json({ ok: true });
  }
  return json({ error: 'Not found.' }, 404);
}

/* ================================================================ /links/ (link in bio), kept in step with the calendar */
// Instagram posts say "Link in bio (it’s the first one)". The bio points at mowittall.com/links/, so this page must
// always lead with the page the newest Instagram post promised, then the few before it (people scroll back).
// The worker adds them to the static page as it's served (no JavaScript needed), straight from sp_rows:
// posted or copied rows up to today, plus today's planned row once its posting time has passed (in case the
// publish is a minute late). Links are clean (the visit's source comes from the bio link itself).
const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function linksFeed(env, limit = 6) {
  await planInit(env.DB);
  const { date, hm } = etNow();
  const s = await settings(env.DB);
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const due = s.live && hm >= (s.times[dow] || '10:00');
  const { results } = await env.DB.prepare(`SELECT date, item, title, link, status FROM sp_rows WHERE platform = 'instagram' AND link IS NOT NULL AND date <= ?
    AND (status IN ('posted', 'copied') OR (date = ? AND status = 'planned' AND ?)) ORDER BY date DESC LIMIT 30`).bind(date, date, due ? 1 : 0).all();
  const seen = new Set(), out = [];
  for (const r of results) {
    const href = stripUtm(r.link).replace(SITE, '') || '/';
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ date: r.date, item: r.item, title: r.title, href, today: r.date === date });
    if (out.length >= limit) break;
  }
  return out;
}
export async function linksPage(env, req) {
  const res = await env.ASSETS.fetch(req);
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  let feed = [];
  try { feed = await linksFeed(env); } catch { return res; } // never break the page
  const headers = new Headers(res.headers); headers.set('cache-control', 'no-store');
  if (!feed.length) return new Response(res.body, { status: res.status, headers });
  const [top, ...rest] = feed;
  const li = (f, main) => `<li><a class="links-btn${main ? ' is-post' : ''}" href="${escH(f.href)}" data-track="link_page_click" data-track-target="post:${escH(f.item)}"><b>${main ? '📌 ' : ''}${escH(f.title)}</b><span>${main ? (f.today ? 'From today’s post' : 'From the latest post') : 'From a recent post'}</span></a></li>`;
  const html = li(top, true) + (rest.length ? `<li class="links-recent"><details><summary>More from recent posts</summary><ul>${rest.map((f) => li(f, false)).join('')}</ul></details></li>` : '');
  return new HTMLRewriter().on('ul.links-list', { element(el) { el.prepend(html, { html: true }); } })
    .transform(new Response(res.body, { status: res.status, headers }));
}
