// HQ Analytics → Inbox (Nov 18, 2026): one list of everything Mike should know about, so he doesn't have to dig
// through every screen. Checked every hour from the cron (axTick) and on "Check Now". No AI: every item comes
// from a plain rule below.
//
// What lands here:
//   signup    new email sign-ups (CRM contacts), replies to emails, unsubscribes
//   social    follower changes per platform, posts doing much better than usual
//   traffic   big jumps or drops in visits / users / engaged visits / leads, new traffic sources, pages taking off,
//             best day ever
//   search    new Google searches you showed up for, first Google click on a page, pages newly indexed or dropped,
//             and a daily checklist of up to 10 not-yet-indexed pages to request in Search Console (its daily limit)
//   milestone follower and sign-up milestones (10, 25, 50, 100…)
//   idea      weekly: "almost page 1" search terms, pages that show in Google but don't get clicked, the weekly recap
//   radar     new Reddit questions worth answering (Reddit Radar)
//   problem   a data pull that keeps failing, a scheduled social post that failed
//
// Items have fixed ids (e.g. "signup:42", "traffic:sessions:2026-11-18"), so a rule can fire every hour without
// making duplicates. State (what was already announced) lives in ax_state under "inbox:*".

import { etDate, rollup } from './events.js';
import { SOCIAL_SOURCES } from './social.js';

const HOUR = 3600000, DAY = 24 * HOUR;
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtN = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);
const PN = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads', youtube: 'YouTube', bluesky: 'Bluesky', pinterest: 'Pinterest', reddit: 'Reddit', x: 'X', nextdoor: 'Nextdoor', tiktok: 'TikTok' };
const pname = (p) => PN[p] || p;
const MILES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const SIGNUP_MILES = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const short = (s, n = 140) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

let ready = null;
export async function inboxInit(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS ax_inbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, tone TEXT, title TEXT NOT NULL, detail TEXT,
        go TEXT, link TEXT, day TEXT, at INTEGER NOT NULL, read_at INTEGER, done_at INTEGER)`),
      db.prepare('CREATE INDEX IF NOT EXISTS ax_inbox_at ON ax_inbox (done_at, at)'),
    ]).then(() => db.prepare('ALTER TABLE ax_inbox ADD COLUMN list TEXT').run().catch(() => {})) // checklist items (JSON), added Nov 18
      .catch((e) => { ready = null; throw e; });
  }
  return ready;
}
async function getState(db, k) { const r = await db.prepare('SELECT v FROM ax_state WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; }
async function setState(db, k, v) { await db.prepare('INSERT INTO ax_state (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now()).run(); }

// item: { id, kind, tone?, title, detail?, go?, link?, list?, day?, at?, update? }  update = refresh the text while it's still unread
// list = a checklist: [{ t: label, s: note, href, done: ms|null }] (HQ ticks an entry when Mike opens its link).
function put(db, it) {
  const sql = `INSERT INTO ax_inbox (id, kind, tone, title, detail, go, link, list, day, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO ${it.update ? 'UPDATE SET title = excluded.title, detail = excluded.detail, at = excluded.at WHERE read_at IS NULL AND done_at IS NULL' : 'NOTHING'}`;
  return db.prepare(sql).bind(it.id, it.kind, it.tone || 'info', short(it.title, 200), it.detail ? short(it.detail, 600) : null, it.go || null, it.link || null,
    it.list ? JSON.stringify(it.list) : null, it.day || etDate(), it.at || Date.now());
}

/* ================================================================ rules */
// Each rule returns a list of items. `ctx` = { env, db (EV), now, today, first (true on the very first scan), st (state) }.

// New sign-ups, replies, unsubscribes (CRM).
async function crmRules({ env, now, st }) {
  if (!env.CRM) return [];
  const since = Math.max(st.crmSince || now - 3 * DAY, now - 14 * DAY);
  const out = [];
  let ok = false;
  try {
    const { results: subs } = await env.CRM.prepare(`SELECT id, email, name, zip, source, level, measured, sqft, created FROM contacts
      WHERE is_test = 0 AND created > ? ORDER BY created LIMIT 50`).bind(since).all();
    for (const c of subs) {
      const bits = [c.source && `from ${c.source}`, c.level != null && `quiz level ${c.level}`, c.measured ? `measured their yard${c.sqft ? ` (${fmtN(c.sqft)} sq ft)` : ''}` : null, c.zip && `ZIP ${c.zip}`].filter(Boolean);
      out.push({ id: `signup:${c.id}`, kind: 'signup', tone: 'good', title: `New sign-up: ${c.name ? `${c.name} (${c.email})` : c.email}`, detail: bits.join(' · '), go: 'email/crm', at: c.created, day: etDate(c.created) });
    }
    ok = true;
  } catch { /* contacts not set up yet */ }
  try {
    const { results: msgs } = await env.CRM.prepare(`SELECT id, from_addr, from_name, subject, text, at FROM msgs WHERE dir = 'in' AND auto = 0 AND at > ? ORDER BY at LIMIT 30`).bind(since).all();
    for (const m of msgs) out.push({ id: `reply:${m.id}`, kind: 'signup', tone: 'good', title: `Reply from ${m.from_name || m.from_addr}${m.subject ? `: ${m.subject}` : ''}`, detail: short(m.text, 220), go: 'email/crm', at: m.at, day: etDate(m.at) });
  } catch { /* no inbox yet */ }
  try {
    const { results: un } = await env.CRM.prepare(`SELECT id, email, unsub_reason, unsub_at FROM contacts WHERE is_test = 0 AND unsub_at > ? ORDER BY unsub_at LIMIT 30`).bind(since).all();
    for (const c of un) out.push({ id: `unsub:${c.id}:${c.unsub_at}`, kind: 'signup', tone: 'bad', title: `Unsubscribed: ${c.email}`, detail: c.unsub_reason ? `Reason: ${c.unsub_reason}` : '', go: 'email/crm', at: c.unsub_at, day: etDate(c.unsub_at) });
  } catch { /* */ }
  // Sign-up milestones
  try {
    const r = await env.CRM.prepare('SELECT COUNT(*) n FROM contacts WHERE is_test = 0').first();
    const n = r?.n || 0, last = st.signupMile ?? null;
    const hit = SIGNUP_MILES.filter((m) => n >= m && (last == null ? false : m > last));
    if (hit.length) out.push({ id: `milestone:signups:${hit.at(-1)}`, kind: 'milestone', tone: 'good', title: hit.at(-1) === 1 ? 'Your first email sign-up 🎉' : `${fmtN(hit.at(-1))} email sign-ups 🎉`, detail: `${fmtN(n)} people on the list so far.`, go: 'email' });
    st.signupMile = Math.max(last ?? 0, ...SIGNUP_MILES.filter((m) => n >= m), 0);
  } catch { /* */ }
  if (ok) st.crmSince = now; // only move on once the contacts table answered
  return out;
}

// Follower changes and milestones, per platform (latest snapshot vs the last number announced).
async function followerRules({ db, st }) {
  const { results } = await db.prepare(`SELECT s.platform, s.followers, s.date FROM social_snap s
    JOIN (SELECT platform, MAX(date) d FROM social_snap WHERE followers IS NOT NULL GROUP BY platform) m ON m.platform = s.platform AND m.d = s.date`).all();
  const seen = st.followers || {}, miles = st.followerMiles || {};
  const out = [];
  for (const r of results) {
    const n = Number(r.followers), before = seen[r.platform];
    if (before != null && n !== before) {
      const d = n - before;
      out.push({ id: `followers:${r.platform}:${r.date}:${n}`, kind: 'social', tone: d > 0 ? 'good' : 'bad',
        title: d > 0 ? `+${fmtN(d)} new follower${d === 1 ? '' : 's'} on ${pname(r.platform)}` : `${pname(r.platform)}: lost ${fmtN(-d)} follower${d === -1 ? '' : 's'}`,
        detail: `Now ${fmtN(n)} (was ${fmtN(before)}).`, go: 'social', day: r.date });
    }
    const hit = MILES.filter((m) => n >= m && m > (miles[r.platform] ?? (before == null ? Infinity : 0)));
    if (hit.length) out.push({ id: `milestone:${r.platform}:${hit.at(-1)}`, kind: 'milestone', tone: 'good', title: `${fmtN(hit.at(-1))} followers on ${pname(r.platform)} 🎉`, detail: `Now ${fmtN(n)}.`, go: 'social', day: r.date });
    miles[r.platform] = Math.max(miles[r.platform] || 0, ...MILES.filter((m) => n >= m), 0);
    seen[r.platform] = n;
  }
  st.followers = seen; st.followerMiles = miles;
  return out;
}

// Social posts doing much better than that platform's usual.
async function postRules({ db, now }) {
  const ENG = '(COALESCE(likes, 0) + COALESCE(comments, 0) + COALESCE(shares, 0) + COALESCE(saves, 0))';
  const { results } = await db.prepare(`SELECT platform, id, text, url, created, ${ENG} eng, COALESCE(reach, views, impressions) seen FROM social_posts WHERE created > ?`).bind(now - 90 * DAY).all();
  const by = {};
  for (const p of results) (by[p.platform] ||= []).push(p);
  const out = [];
  for (const [plat, list] of Object.entries(by)) {
    if (list.length < 4) continue;
    const sorted = list.map((p) => p.eng).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const p of list) {
      if (p.created < now - 14 * DAY) continue;
      if (p.eng >= 5 && p.eng >= Math.max(2 * median, median + 4))
        out.push({ id: `post:${plat}:${p.id}`, kind: 'social', tone: 'good', title: `Your ${pname(plat)} post is taking off: ${fmtN(p.eng)} likes, comments, shares and saves`,
          detail: `${p.text ? `“${short(p.text, 90)}” · ` : ''}Your usual post gets about ${fmtN(median)}.${p.seen ? ` Seen ${fmtN(p.seen)} times.` : ''}`, go: 'social', link: p.url || null, update: true });
    }
  }
  return out;
}

// Site traffic: yesterday vs the 14 days before it. Runs once a day (after midnight Eastern).
async function trafficRules({ db, today }) {
  const y = addDays(today, -1), from = addDays(y, -14), out = [];
  const { results: daysRows } = await db.prepare(`SELECT date, COUNT(*) sessions, COUNT(DISTINCT device) users, SUM(engaged) engaged, SUM(leads) leads, SUM(quiz_done) quiz
    FROM ev_sess WHERE date BETWEEN ? AND ? GROUP BY date`).bind(from, y).all();
  const yd = daysRows.find((r) => r.date === y);
  const base = daysRows.filter((r) => r.date !== y);
  const histDays = 14;
  const avg = (k) => base.reduce((a, r) => a + (r[k] || 0), 0) / histDays;
  if (yd && base.length >= 7) {
    // One item for visits (with visitors + engaged visits in the detail), separate ones for leads and quiz completions.
    const M = [['sessions', 'Visits'], ['leads', 'Email leads'], ['quiz', 'Quiz completions']];
    const jump = (v, a) => (a >= 1 ? `jumped ${pct(v, a)}%` : 'spiked');
    for (const [k, label] of M) {
      const v = yd[k] || 0, a = avg(k);
      const minUp = k === 'sessions' ? 10 : 3;
      if (v >= minUp && v >= Math.max(a * 1.6, a + (k === 'sessions' ? 8 : 2))) {
        let detail = `${fmtN(v)} yesterday vs ${a >= 1 ? `about ${fmtN(a)}` : 'almost none'} a day over the 2 weeks before.`;
        if (k === 'sessions') {
          detail += ` Visitors: ${fmtN(yd.users)} (usually ~${fmtN(avg('users'))}). Engaged visits: ${fmtN(yd.engaged)} (usually ~${fmtN(avg('engaged'))}).`;
          const { results: drv } = await db.prepare(`SELECT source || ' / ' || medium src, SUM(date = ?) y, SUM(date < ?) b FROM ev_sess WHERE date BETWEEN ? AND ? GROUP BY 1 ORDER BY (SUM(date = ?) - SUM(date < ?) / 14.0) DESC LIMIT 1`).bind(y, y, from, y, y, y).all();
          if (drv[0] && drv[0].y - drv[0].b / 14 >= 3) detail += ` Most of the extra came from ${drv[0].src} (${fmtN(drv[0].y)} visits).`;
        }
        out.push({ id: `traffic:${k}:${y}`, kind: 'traffic', tone: 'good', title: `${label} ${jump(v, a)} yesterday`, detail, go: k === 'sessions' ? 'overview' : 'conversions', day: y });
      } else if (k === 'sessions' && a >= 15 && v <= a * 0.5) {
        out.push({ id: `traffic:${k}:${y}`, kind: 'traffic', tone: 'bad', title: `${label} dropped ${Math.abs(pct(v, a))}% yesterday`, detail: `${fmtN(v)} yesterday vs about ${fmtN(a)} a day. Worth a look if it lasts more than a day or two.`, go: 'overview', day: y });
      }
    }
    // Best day ever
    const rec = await db.prepare('SELECT MAX(n) m FROM (SELECT COUNT(*) n FROM ev_sess WHERE date < ? GROUP BY date)').bind(y).first();
    if (rec?.m && yd.sessions >= 10 && yd.sessions > rec.m)
      out.push({ id: `record:sessions:${y}`, kind: 'milestone', tone: 'good', title: `Best day ever: ${fmtN(yd.sessions)} visits yesterday 🎉`, detail: `The old record was ${fmtN(rec.m)}.`, go: 'overview', day: y });
  }
  // New traffic sources (not seen in the 60 days before), and pages taking off
  const { results: news } = await db.prepare(`SELECT source, medium, COUNT(*) n FROM ev_sess WHERE date = ? AND source NOT IN ('(direct)', '', '(not set)')
    AND source NOT IN (SELECT DISTINCT source FROM ev_sess WHERE date BETWEEN ? AND ?) GROUP BY source, medium HAVING n >= 2 ORDER BY n DESC LIMIT 5`).bind(y, addDays(y, -60), addDays(y, -1)).all();
  if ((await db.prepare('SELECT COUNT(DISTINCT date) n FROM ev_sess WHERE date < ?').bind(y).first())?.n >= 7)
    for (const s of news) out.push({ id: `source:${s.source}:${y}`, kind: 'traffic', tone: 'good', title: `New traffic source: ${s.source} sent ${fmtN(s.n)} visits`, detail: `First time ${s.source} (${s.medium}) has sent anyone in at least 60 days.`, go: 'acquisition', day: y });
  const { results: pages } = await db.prepare(`SELECT landing, SUM(date = ?) y, SUM(date < ?) b FROM ev_sess WHERE date BETWEEN ? AND ? AND landing IS NOT NULL GROUP BY landing
    HAVING y >= 10 AND y >= 3 * MAX(1, b / 14.0) ORDER BY y DESC LIMIT 3`).bind(y, y, from, y).all();
  if (base.length >= 7) for (const p of pages)
    out.push({ id: `page:${p.landing}:${y}`, kind: 'traffic', tone: 'good', title: `A page took off: ${p.landing}`, detail: `${fmtN(p.y)} visits started there yesterday (${p.b / 14 >= 1 ? `usually about ${fmtN(p.b / 14)} a day` : 'it barely got any before'}).`, go: 'content', link: p.landing, day: y });
  return out;
}

// Search: new searches you showed up for, first clicks, indexing changes.
async function searchRules({ db, now, st }) {
  const out = [];
  try {
    const last = await db.prepare('SELECT MAX(date) d FROM gsc_query').first();
    if (last?.d && last.d !== st.searchDay) {
      const firstData = await db.prepare('SELECT MIN(date) d FROM gsc_query').first();
      if (firstData?.d && firstData.d < addDays(last.d, -6)) {
        const { results } = await db.prepare(`SELECT query, SUM(impressions) imp, SUM(clicks) clk, MIN(position) pos FROM gsc_query WHERE date > ?
          AND query NOT IN (SELECT DISTINCT query FROM gsc_query WHERE date <= ?) GROUP BY query HAVING imp >= 2 ORDER BY imp DESC LIMIT 50`).bind(st.searchDay || addDays(last.d, -1), st.searchDay || addDays(last.d, -1)).all();
        if (results.length) out.push({ id: `search:new:${last.d}`, kind: 'search', tone: 'good', title: `Google showed you for ${results.length} new search${results.length === 1 ? '' : 'es'}`,
          detail: results.slice(0, 6).map((r) => `“${r.query}” (#${Math.round(r.pos)})`).join(', ') + (results.length > 6 ? ` and ${results.length - 6} more` : ''), go: 'seo', day: last.d });
        const { results: fc } = await db.prepare(`SELECT page, SUM(clicks) c FROM gsc_page WHERE date > ? AND clicks > 0 AND page NOT IN (SELECT DISTINCT page FROM gsc_page WHERE date <= ? AND clicks > 0) GROUP BY page ORDER BY c DESC LIMIT 5`)
          .bind(st.searchDay || addDays(last.d, -1), st.searchDay || addDays(last.d, -1)).all();
        for (const p of fc) out.push({ id: `search:firstclick:${p.page}`, kind: 'search', tone: 'good', title: `First click from Google on ${p.page}`, detail: `${fmtN(p.c)} click${p.c === 1 ? '' : 's'} so far.`, go: 'seo', link: p.page, day: last.d });
      }
      st.searchDay = last.d;
    }
  } catch { /* search not connected */ }
  try {
    const since = st.indexSince || now - DAY;
    const { results } = await db.prepare(`SELECT path, field, before, after, at FROM seo_inspect_log WHERE at > ? AND field IN ('verdict', 'first') ORDER BY at`).bind(since).all();
    const added = results.filter((r) => (r.field === 'verdict' && r.after === 'PASS') || (r.field === 'first' && /indexed/i.test(r.after || '') && !/not indexed/i.test(r.after || '')));
    const dropped = results.filter((r) => r.field === 'verdict' && r.before === 'PASS' && r.after !== 'PASS');
    const day = etDate();
    if (added.length && st.indexSince) out.push({ id: `index:new:${day}`, kind: 'search', tone: 'good', title: `Google indexed ${added.length} more page${added.length === 1 ? '' : 's'}`, detail: added.slice(0, 8).map((r) => r.path).join(', '), go: 'seo', update: true });
    if (dropped.length) out.push({ id: `index:drop:${day}`, kind: 'problem', tone: 'bad', title: `${dropped.length} page${dropped.length === 1 ? '' : 's'} dropped out of Google`, detail: dropped.slice(0, 8).map((r) => r.path).join(', '), go: 'seo/index', update: true });
    st.indexSince = now;
  } catch { /* */ }
  try {
    // PageSpeed (worker/seo.js checks the top 5 pages weekly): flag a page the first time it's under 90 on mobile.
    const { results } = await db.prepare('SELECT path, score, checked_at FROM seo_speed WHERE score IS NOT NULL AND checked_at > ?').bind(st.speedSince || 0).all();
    const slow = results.filter((r) => r.score < 90);
    if (slow.length) out.push({ id: `speed:${etDate()}`, kind: 'problem', tone: 'bad', title: `PageSpeed under 90 on mobile: ${slow.map((r) => r.path).join(', ')}`,
      detail: slow.map((r) => `${r.path} scored ${r.score}`).join(' · ') + '. Tell Claude and it’ll speed it up.', go: 'seo/index', update: true });
    st.speedSince = now;
  } catch { /* table not created yet */ }
  return out;
}

// Pages Google hasn't indexed yet → a daily checklist of up to 10 (Search Console's "Request Indexing" allows about 10 a day).
// Only statuses where asking actually helps. A page Mike opened from a checklist rests 7 days before it can come back
// (Google can take a while to act); pages he didn't get to carry over to the next day's list. One list a day, after ~7am Eastern.
const ASKABLE = [[/unknown to google/i, 'Google hasn’t found it yet'], [/discovered/i, 'Found but not crawled yet'], [/crawled/i, 'Crawled but not indexed']];
const INDEX_PER_DAY = 10, REST = 7 * DAY;
async function indexTodoRules({ env, db, now, today }) {
  const etHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)));
  const id = `index:todo:${today}`;
  if (etHour < 7 || (await db.prepare('SELECT 1 FROM ax_inbox WHERE id = ?').bind(id).first())) return [];
  let rows;
  try { ({ results: rows } = await db.prepare("SELECT path, coverage FROM seo_inspect WHERE verdict IS NOT NULL AND verdict != 'PASS'").all()); } catch { return []; }
  const cand = rows.map((r) => ({ ...r, rank: ASKABLE.findIndex(([re]) => re.test(r.coverage || '')) })).filter((r) => r.rank >= 0);
  // Close out older lists (unticked pages simply come back today) and note what was asked for recently.
  const { results: old } = await db.prepare("SELECT id, list, done_at FROM ax_inbox WHERE id LIKE 'index:todo:%' AND at > ?").bind(now - REST - DAY).all();
  const asked = new Set();
  for (const o of old) for (const e of JSON.parse(o.list || '[]')) if (e.done && now - e.done < REST) asked.add(e.t);
  await db.prepare("UPDATE ax_inbox SET done_at = ?, read_at = COALESCE(read_at, ?) WHERE id LIKE 'index:todo:%' AND done_at IS NULL").bind(now, now).run();
  // Hubs and tools before deep pages; "unknown" first since Google has never seen those at all.
  const pick = cand.filter((r) => !asked.has(r.path))
    .sort((a, b) => a.rank - b.rank || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path)).slice(0, INDEX_PER_DAY);
  if (!pick.length) return [];
  const site = env.GSC_SITE || 'sc-domain:mowittall.com';
  const origin = site.startsWith('sc-domain:') ? `https://${site.slice(10)}` : site.replace(/\/$/, '');
  const resting = cand.length - pick.length;
  return [{ id, kind: 'search', tone: 'info', title: `Ask Google to index ${pick.length === 1 ? 'this page' : `these ${pick.length} pages`}`,
    detail: `${cand.length} page${cand.length === 1 ? ' isn’t' : 's aren’t'} in Google yet. Tap each one, wait for the check, then hit “Request Indexing.” Search Console allows about 10 a day.`
      + (resting > 0 ? ` ${resting} more ${resting === 1 ? 'comes' : 'come'} up on later days.` : ''),
    go: 'seo/index', list: pick.map((r) => ({ t: r.path, s: ASKABLE[r.rank][1], href: `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site)}&id=${encodeURIComponent(origin + r.path)}`, done: null })) }];
}

// Weekly ideas + recap (Monday or later in the week, once per week).
async function weeklyRules({ db, env, today, st }) {
  const d = new Date(today + 'T12:00:00Z');
  const monday = addDays(today, -((d.getUTCDay() + 6) % 7));
  if (st.week === monday) return [];
  const out = [];
  // Recap of last week (Mon–Sun)
  const ws = addDays(monday, -7), we = addDays(monday, -1), ps = addDays(ws, -7), pe = addDays(ws, -1);
  const wk = async (a, b) => db.prepare('SELECT COUNT(*) s, COUNT(DISTINCT device) u, SUM(leads) l FROM ev_sess WHERE date BETWEEN ? AND ?').bind(a, b).first();
  const [cur, prev] = [await wk(ws, we), await wk(ps, pe)];
  if (cur?.s) {
    const top = await db.prepare('SELECT landing, COUNT(*) n FROM ev_sess WHERE date BETWEEN ? AND ? GROUP BY landing ORDER BY n DESC LIMIT 1').bind(ws, we).first();
    const src = await db.prepare("SELECT source, COUNT(*) n FROM ev_sess WHERE date BETWEEN ? AND ? AND source NOT IN ('(direct)', '') GROUP BY source ORDER BY n DESC LIMIT 1").bind(ws, we).first();
    let subs = null;
    if (env.CRM) { try { subs = (await env.CRM.prepare('SELECT COUNT(*) n FROM contacts WHERE is_test = 0 AND created BETWEEN ? AND ?').bind(Date.parse(ws + 'T05:00:00Z'), Date.parse(monday + 'T05:00:00Z')).first())?.n; } catch { /* */ } }
    const fol = await db.prepare(`SELECT SUM(b.followers - a.followers) n FROM social_snap a JOIN social_snap b ON a.platform = b.platform
      WHERE a.date = (SELECT MAX(date) FROM social_snap WHERE platform = a.platform AND date < ? AND followers IS NOT NULL) AND b.date = (SELECT MAX(date) FROM social_snap WHERE platform = b.platform AND date <= ? AND followers IS NOT NULL)`).bind(ws, we).first().catch(() => null);
    const parts = [
      `${fmtN(cur.s)} visits${prev?.s ? ` (${pct(cur.s, prev.s) >= 0 ? '▲' : '▼'} ${Math.abs(pct(cur.s, prev.s))}% vs the week before)` : ''}`,
      `${fmtN(cur.u)} visitors`,
      subs != null ? `${fmtN(subs)} new sign-up${subs === 1 ? '' : 's'}` : null,
      fol?.n ? `${fol.n > 0 ? '+' : ''}${fmtN(fol.n)} followers` : null,
      top?.landing ? `top page ${top.landing}` : null,
      src?.source ? `top source ${src.source}` : null,
    ].filter(Boolean);
    out.push({ id: `week:${monday}`, kind: 'idea', tone: 'info', title: 'Your week in numbers', detail: parts.join(' · '), go: 'overview' });
    st.week = monday; // done for this week (if last week had no visits at all, try again next scan)
  }
  // Ideas from search (28 days of Google data)
  try {
    const { results: almost } = await db.prepare(`SELECT query, SUM(impressions) imp, SUM(position * impressions) / NULLIF(SUM(impressions), 0) pos FROM gsc_query
      WHERE date > ? GROUP BY query HAVING imp >= 20 AND pos BETWEEN 8 AND 20 ORDER BY imp DESC LIMIT 5`).bind(addDays(today, -28)).all();
    if (almost.length) out.push({ id: `idea:almost:${monday}`, kind: 'idea', tone: 'info', title: `${almost.length} search${almost.length === 1 ? ' is' : 'es are'} almost on page 1 of Google`,
      detail: `${almost.map((r) => `“${r.query}” (#${Math.round(r.pos)}, ${fmtN(r.imp)} views)`).join(', ')}. A little more on those pages (a FAQ answer, a better title, links from other posts) could push them up.`, go: 'seo' });
    const { results: lowctr } = await db.prepare(`SELECT page, SUM(impressions) imp, SUM(clicks) clk, SUM(position * impressions) / NULLIF(SUM(impressions), 0) pos FROM gsc_page
      WHERE date > ? GROUP BY page HAVING imp >= 100 AND clk * 1.0 / imp < 0.015 AND pos <= 12 ORDER BY imp DESC LIMIT 3`).bind(addDays(today, -28)).all();
    if (lowctr.length) out.push({ id: `idea:ctr:${monday}`, kind: 'idea', tone: 'info', title: `${lowctr.length} page${lowctr.length === 1 ? ' shows' : 's show'} up in Google but rarely get${lowctr.length === 1 ? 's' : ''} clicked`,
      detail: `${lowctr.map((r) => `${r.page} (${fmtN(r.imp)} views, ${fmtN(r.clk)} clicks)`).join(', ')}. Try a punchier seoTitle and seoDescription.`, go: 'seo' });
  } catch { /* */ }
  return out;
}

// Reddit Radar: new questions worth answering (one item per day, count kept fresh while unread).
async function radarRules({ env, today }) {
  if (!env.DB) return [];
  try {
    const { results } = await env.DB.prepare("SELECT title, sub FROM reddit_radar WHERE status = 'new' AND seen_at > ? ORDER BY fit DESC LIMIT 50").bind(Date.parse(today + 'T05:00:00Z')).all();
    if (!results.length) return [];
    return [{ id: `radar:${today}`, kind: 'radar', tone: 'info', title: `${results.length} new Reddit question${results.length === 1 ? '' : 's'} you could answer`,
      detail: results.slice(0, 3).map((r) => `r/${r.sub}: ${short(r.title, 80)}`).join(' · '), go: 'radar', update: true }];
  } catch { return []; }
}

// Hall photos waiting for approval (one item a day while any are waiting; it closes itself once the queue is empty).
async function photoRules({ env, db, now, today }) {
  if (!env.DB) return [];
  let n = 0;
  try { n = (await env.DB.prepare("SELECT COUNT(*) n FROM posts WHERE status = 'pending'").first())?.n || 0; } catch { return []; }
  if (!n) { await db.prepare("UPDATE ax_inbox SET done_at = ?, read_at = COALESCE(read_at, ?) WHERE id LIKE 'photos:pending:%' AND done_at IS NULL").bind(now, now).run(); return []; }
  return [{ id: `photos:pending:${today}`, kind: 'signup', tone: 'info', title: `${n} photo${n === 1 ? '' : 's'} waiting for the Hall`, detail: 'Approve, reject or move them between Fame and Shame.', go: 'photos', update: true }];
}

// Problems: pulls that keep failing, scheduled posts that failed.
const KNOWN = { 'social:youtube': [/playlist/i, 'Normal until the channel’s first upload; it clears on its own.'], 'social:reddit': [/403|blocked/i, 'Reddit blocks Cloudflare and no longer gives out API keys. Safe to ignore.'] };
async function problemRules({ env, db, now }) {
  const out = [];
  const runs = (await getState(db, 'runs')) || {};
  // SEO autopilot keeps its own error list (cleared when a step succeeds again); 3+ repeats = stuck.
  const seoErrs = await db.prepare("SELECT v FROM seo_state WHERE k = 'errors'").first().then((r) => (r ? JSON.parse(r.v) : [])).catch(() => []);
  for (const e of seoErrs) {
    if ((e.n || 1) < 3) continue;
    if (e.task === 'speed' && /quota/i.test(e.msg) && !env.PSI_API_KEY) {
      // Google's free keyless PageSpeed quota is shared by everyone on Cloudflare, so it runs dry. A free key of our own fixes it.
      out.push({ id: 'problem:seo:speed:nokey', kind: 'problem', tone: 'bad', title: 'PageSpeed checks need a free Google key (2 minutes)',
        detail: 'Google’s shared keyless quota keeps running out, so phone speed scores aren’t updating. In Google Cloud (project mow-it-tall-analytics): turn on the PageSpeed Insights API, then Credentials → Create credentials → API key. Paste it into Cloudflare → the mowittall worker → Settings → Variables and Secrets as a secret named PSI_API_KEY. Free; it then checks itself within the hour.',
        go: 'seo/index', link: 'https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com?project=mow-it-tall-analytics' });
      continue;
    }
    const bing = /bing/i.test(e.task) || /ThrottleIP/i.test(e.msg);
    out.push({ id: `problem:seo:${e.task}:${hash(String(e.msg).replace(/\d+/g, '#').slice(0, 80))}`, kind: 'problem', tone: bing && /Throttle/i.test(e.msg) ? 'info' : 'bad',
      title: `Search autopilot: ${e.task} keeps failing`, detail: `${bing && /Throttle/i.test(e.msg) ? 'Bing limits Cloudflare’s shared servers; it retries every hour. ' : ''}Error: ${short(e.msg, 220)}`, go: 'seo/index' });
  }
  const all = Object.entries(runs);
  const LABEL = { ga4: 'Google Analytics', clarity: 'Clarity', 'social:meta': 'Facebook + Instagram', 'social:threads': 'Threads', 'social:youtube': 'YouTube', 'social:bluesky': 'Bluesky', 'social:pinterest': 'Pinterest', 'social:reddit': 'Reddit', 'social:x': 'X' };
  const off = new Set(SOCIAL_SOURCES.filter(([, , on]) => !on(env)).map(([id]) => `social:${id}`));
  for (const [task, r] of all) {
    if (!r || r.ok !== false || off.has(task)) continue; // a switched-off source isn't broken
    const failingFor = now - (r.lastOk || r.at || now);
    if (r.lastOk && failingFor < 6 * HOUR) continue; // one blip isn't news
    const known = KNOWN[task] && KNOWN[task][0].test(r.info || '') ? KNOWN[task][1] : '';
    out.push({ id: `problem:${task}:${hash(String(r.info || '').replace(/\d+/g, '#').slice(0, 80))}`, kind: 'problem', tone: known ? 'info' : 'bad',
      title: `${LABEL[task] || task.replace(/^seo:/, 'Search: ')} isn’t updating`, detail: `${known ? known + ' ' : ''}Error: ${short(r.info, 220)}`, go: 'sources' });
  }
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare("SELECT date, platform, error, updated FROM sp_rows WHERE status = 'failed' AND updated > ? ORDER BY updated LIMIT 20").bind(now - 3 * DAY).all();
      for (const p of results) out.push({ id: `problem:post:${p.date}:${p.platform}`, kind: 'problem', tone: 'bad', title: `Scheduled ${pname(p.platform)} post for ${p.date} failed`, detail: short(p.error, 220), go: 'calendar', day: p.date });
    } catch { /* calendar not set up */ }
  }
  return out;
}

/* ================================================================ scan */
// force: run the once-a-day rules again too.
export async function inboxScan(env, { force = false } = {}) {
  const db = env.EV;
  if (!db) return { added: 0 };
  await inboxInit(db);
  const now = Date.now(), today = etDate();
  const st = (await getState(db, 'inbox:state')) || {};
  const first = !st.started;
  const ctx = { env, db, now, today, st, first };
  const rules = [['crm', crmRules], ['followers', followerRules], ['posts', postRules], ['search', searchRules], ['indexTodo', indexTodoRules], ['photos', photoRules], ['radar', radarRules], ['problems', problemRules], ['weekly', weeklyRules]];
  // Traffic once a day, after ~1am Eastern (yesterday is complete).
  if (force || (st.trafficDay !== today && new Date().getUTCHours() >= 6)) {
    rules.push(['traffic', async (c) => {
      // Rebuild yesterday's sessions from the raw log first (it's idempotent), so late-night visits count.
      try { if (await db.prepare('SELECT 1 FROM ev_raw WHERE date = ? LIMIT 1').bind(addDays(today, -1)).first()) await rollup(db, addDays(today, -1)); } catch { /* */ }
      const r = await trafficRules(c); st.trafficDay = today; return r; }]);
  }
  const items = [], errors = {};
  let current = null; // ids of problems that are still happening right now
  for (const [name, fn] of rules) {
    try { const got = await fn(ctx); items.push(...got); if (name === 'problems') current = got.map((it) => it.id); } catch (e) { errors[name] = String(e.message || e).slice(0, 200); }
  }
  // Problems that fixed themselves (a pull that works again, a source switched off) leave the inbox on their own.
  // Failed scheduled posts stay until Mike dismisses them.
  if (current) await db.prepare(`UPDATE ax_inbox SET done_at = ?, read_at = COALESCE(read_at, ?) WHERE done_at IS NULL AND id LIKE 'problem:%' AND id NOT LIKE 'problem:post:%'
    AND id NOT IN (SELECT value FROM json_each(?))`).bind(now, now, JSON.stringify(current)).run();
  // First scan: don't flood the inbox with old news; follower/milestone baselines were just recorded silently.
  let added = 0;
  if (items.length) {
    const before = (await db.prepare('SELECT COUNT(*) n FROM ax_inbox').first())?.n || 0;
    for (let i = 0; i < items.length; i += 50) await db.batch(items.slice(i, i + 50).map((it) => put(db, it)));
    added = ((await db.prepare('SELECT COUNT(*) n FROM ax_inbox').first())?.n || 0) - before;
  }
  if (first) await db.prepare(`INSERT OR IGNORE INTO ax_inbox (id, kind, tone, title, detail, go, day, at) VALUES ('welcome', 'idea', 'info', ?, ?, 'inbox', ?, ?)`)
    .bind('Your Inbox is on', 'New sign-ups, followers, big traffic jumps or drops, search wins, Reddit questions, weekly ideas and anything that breaks will show up here. It checks every hour.', today, now).run();
  st.started = st.started || now; st.lastScan = now; st.errors = errors;
  await setState(db, 'inbox:state', st);
  // Keep it tidy: dismissed items older than 90 days and read items older than 180 days go away.
  await db.prepare('DELETE FROM ax_inbox WHERE (done_at IS NOT NULL AND done_at < ?) OR (read_at IS NOT NULL AND at < ?)').bind(now - 90 * DAY, now - 180 * DAY).run();
  return { added, errors };
}

/* ================================================================ HQ endpoints (called from axAdmin) */
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function inboxUnread(db) {
  try { await inboxInit(db); return (await db.prepare('SELECT COUNT(*) n FROM ax_inbox WHERE read_at IS NULL AND done_at IS NULL').first())?.n || 0; } catch { return 0; }
}
export async function inboxAdmin(env, req, url) {
  const db = env.EV;
  await inboxInit(db);
  const p = url.pathname;
  if (p === '/api/admin/ax/inbox' && req.method === 'GET') {
    const show = url.searchParams.get('show') || 'open';
    const where = show === 'dismissed' ? 'done_at IS NOT NULL' : 'done_at IS NULL';
    const { results } = await db.prepare(`SELECT id, kind, tone, title, detail, go, link, list, day, at, read_at, done_at FROM ax_inbox WHERE ${where} ORDER BY at DESC LIMIT 300`).all();
    for (const r of results) r.list = r.list ? JSON.parse(r.list) : null;
    const st = (await getState(db, 'inbox:state')) || {};
    return json({ items: results, unread: await inboxUnread(db), lastScan: st.lastScan || null });
  }
  if (p === '/api/admin/ax/inbox' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 300).map(String);
    const now = Date.now();
    const sets = { read: 'read_at = COALESCE(read_at, ?)', unread: 'read_at = NULL', dismiss: 'done_at = ?, read_at = COALESCE(read_at, ?)', restore: 'done_at = NULL' };
    if (b.action === 'tick') {
      // Tick one checklist entry (HQ does this when Mike opens its link). b.ids = [item id], b.i = entry index, b.done = false to untick.
      const row = await db.prepare('SELECT list FROM ax_inbox WHERE id = ?').bind(ids[0] || '').first();
      const list = row?.list ? JSON.parse(row.list) : null, i = Number(b.i);
      if (!list || !list[i]) return json({ error: 'No such item.' }, 404);
      list[i].done = b.done === false ? null : now;
      await db.prepare('UPDATE ax_inbox SET list = ?, read_at = COALESCE(read_at, ?) WHERE id = ?').bind(JSON.stringify(list), now, ids[0]).run();
      return json({ ok: true, list, unread: await inboxUnread(db) });
    }
    if (b.action === 'readall') await db.prepare('UPDATE ax_inbox SET read_at = ? WHERE read_at IS NULL AND done_at IS NULL').bind(now).run();
    else if (sets[b.action] && ids.length) {
      const nBind = (sets[b.action].match(/\?/g) || []).length;
      await db.prepare(`UPDATE ax_inbox SET ${sets[b.action]} WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...Array(nBind).fill(now), ...ids).run();
    } else return json({ error: 'Nothing to do.' }, 400);
    return json({ ok: true, unread: await inboxUnread(db) });
  }
  if (p === '/api/admin/ax/inbox/scan' && req.method === 'POST') {
    const r = await inboxScan(env, { force: true });
    return json({ ok: true, ...r, unread: await inboxUnread(db) });
  }
  return json({ error: 'Not found.' }, 404);
}
