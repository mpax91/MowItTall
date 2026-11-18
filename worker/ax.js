// HQ Analytics (Nov 17, 2026): one place for every number the site has. Served at /admin/analytics/.
//
// Sources, all free (no AI anywhere, only free API keys):
//   web      the site's own event log (worker/events.js): sessions sliced by any mix of source, place, device…
//   pages    page views from the event log, with the same session filters
//   events   every custom event (quiz steps, tools, games…) and its parameters
//   search   Google Search Console + Bing Webmaster Tools (pulled hourly by worker/seo.js)
//   ga4      Google Analytics 4 Data API, pulled daily here (same service account as Search Console)
//   clarity  Microsoft Clarity Data Export API, pulled daily here (CLARITY_TOKEN; Clarity allows 10 calls a day)
//   email    the CRM's sends / opens / clicks / unsubscribes (worker/crm.js)
//   list     the CRM's sign-ups (contacts) by source, level, status
//   social   follower snapshots: Bluesky + YouTube automatically, the rest typed in on the Social page
//
// One query endpoint (POST /api/admin/ax/q) takes { qs: [ { src, dims, metrics, filters, from, to, sort, limit } ] }.
// Every dimension and metric is a fixed SQL expression from the lists below (never user text), and every value
// is a bound parameter, so the browser can slice any way it likes without being able to write SQL.
//
// Secrets (Cloudflare → Workers & Pages → mowittall → Settings → Variables and Secrets), all optional:
//   GA4_PROPERTY_ID  the numeric GA4 property id (GA4 → Admin → Property details). The GSC service account's
//                    email must be added in GA4 → Admin → Property access management as a Viewer.
//   CLARITY_TOKEN    Clarity → Settings → Data Export → Generate new API token
//   YT_API_KEY       Google Cloud → APIs & Services → Credentials → API key (YouTube Data API v3 enabled)
//   BLUESKY_HANDLE   default mowittall.com (public API, no key)
//   YT_HANDLE        default @MowItTALL
//   META_PAGE_TOKEN  a Facebook Page access token (never expires) from Mike's own Meta app: Facebook Page
//                    followers + the linked Instagram professional account's followers and post count

import { evInit, etDate, rollup } from './events.js';
import { seoInit, googleToken, serviceAccount } from './seo.js';
import { socialInit, socialTick, socialStatus, SOCIAL_SOURCES } from './social.js';
import { inboxScan, inboxAdmin, inboxUnread } from './inbox.js';

const DAY = 86400000;
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^[a-z0-9_]{1,40}$/;

let ready = null;
export async function axInit(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS ax_state (k TEXT PRIMARY KEY, v TEXT, at INTEGER)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS ga4_days (date TEXT PRIMARY KEY, sessions INTEGER, users INTEGER, new_users INTEGER, views INTEGER,
        engaged INTEGER, eng_sec REAL, key_events REAL, events INTEGER)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ga4_dim (date TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL, sessions INTEGER, users INTEGER,
        views INTEGER, engaged INTEGER, key_events REAL, events INTEGER, PRIMARY KEY (date, dim, value))`),
      // Clarity, long format: (day, breakdown, its value, metric, field) → number. Keeps whatever fields Clarity sends.
      db.prepare(`CREATE TABLE IF NOT EXISTS clarity_m (date TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL, metric TEXT NOT NULL,
        field TEXT NOT NULL, v REAL, PRIMARY KEY (date, dim, value, metric, field))`),
      db.prepare('CREATE TABLE IF NOT EXISTS clarity_raw (date TEXT NOT NULL, dim TEXT NOT NULL, body TEXT, at INTEGER, PRIMARY KEY (date, dim))'),
      db.prepare(`CREATE TABLE IF NOT EXISTS social_snap (date TEXT NOT NULL, platform TEXT NOT NULL, followers INTEGER, posts INTEGER, views INTEGER,
        auto INTEGER DEFAULT 0, note TEXT, at INTEGER, PRIMARY KEY (date, platform))`),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
}
async function getState(db, k) { const r = await db.prepare('SELECT v FROM ax_state WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; }
async function setState(db, k, v) { await db.prepare('INSERT INTO ax_state (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now()).run(); }
async function logRun(db, task, ok, info) {
  const runs = (await getState(db, 'runs')) || {};
  runs[task] = { at: Date.now(), ok, info: String(info ?? '').slice(0, 300), lastOk: ok ? Date.now() : runs[task]?.lastOk || null };
  await setState(db, 'runs', runs);
}

/* ================================================================ dimensions + metrics */
// Session-level dimensions (ev_sess, alias s). Shared by web, pages and events.
const DOW = "CASE s.dow WHEN 0 THEN '7 Sun' WHEN 1 THEN '1 Mon' WHEN 2 THEN '2 Tue' WHEN 3 THEN '3 Wed' WHEN 4 THEN '4 Thu' WHEN 5 THEN '5 Fri' ELSE '6 Sat' END";
const grains = (col) => ({
  date: col,
  week: `date(${col}, '-6 days', 'weekday 1')`,
  month: `substr(${col}, 1, 7)`,
});
const SESS_DIMS = {
  channel: 's.channel', source: 's.source', medium: 's.medium', source_medium: "s.source || ' / ' || s.medium", campaign: 's.campaign',
  landing: 's.landing', country: 's.country', region: 's.region', city: "s.city || CASE WHEN s.region NOT IN ('', '(not set)') THEN ', ' || s.region ELSE '' END",
  device: 's.dev_type', os: 's.os', browser: 's.browser', user_type: "CASE s.nv WHEN 1 THEN 'New' ELSE 'Returning' END",
  hour: "printf('%02d', s.hour)", dow: DOW,
  engaged: "CASE s.engaged WHEN 1 THEN 'Engaged' ELSE 'Bounced' END",
  converted: "CASE WHEN s.key_events > 0 OR s.leads > 0 THEN 'Converted' ELSE 'No conversion' END",
};
const WEB = {
  from: 'ev_sess s', date: 's.date',
  dims: { ...grains('s.date'), ...SESS_DIMS },
  metrics: {
    sessions: 'COUNT(*)', users: 'COUNT(DISTINCT s.device)', new_users: 'COUNT(DISTINCT CASE WHEN s.nv = 1 THEN s.device END)',
    views: 'SUM(s.views)', engaged: 'SUM(s.engaged)', engaged_rate: 'SUM(s.engaged) * 1.0 / NULLIF(COUNT(*), 0)',
    bounce_rate: '1 - SUM(s.engaged) * 1.0 / NULLIF(COUNT(*), 0)', views_per_session: 'SUM(s.views) * 1.0 / NULLIF(COUNT(*), 0)',
    avg_eng_sec: 'SUM(s.eng_ms) / 1000.0 / NULLIF(COUNT(*), 0)', eng_sec: 'SUM(s.eng_ms) / 1000.0',
    key_events: 'SUM(s.key_events)', conv_sessions: 'SUM(s.key_events > 0 OR s.leads > 0)', conv_rate: 'SUM(s.key_events > 0 OR s.leads > 0) * 1.0 / NULLIF(COUNT(*), 0)',
    quiz_starts: 'SUM(s.quiz_start)', quiz_done: 'SUM(s.quiz_done)', quiz_rate: 'SUM(s.quiz_done) * 1.0 / NULLIF(SUM(s.quiz_start), 0)',
    leads: 'SUM(s.leads)', lead_rate: 'SUM(s.leads > 0) * 1.0 / NULLIF(COUNT(*), 0)',
  },
};
const RAWJOIN = 'ev_raw r LEFT JOIN ev_sess s ON s.date = r.date AND s.session = r.session';
const PAGES = {
  from: RAWJOIN, date: 'r.date', where: "r.name IN ('page_view', 'page_leave')",
  dims: { ...grains('r.date'), ...SESS_DIMS, hour: "printf('%02d', r.hour)", path: 'r.path', section: "CASE WHEN r.path = '/' THEN '/' ELSE '/' || substr(r.path, 2, instr(substr(r.path, 2) || '/', '/') - 1) || '/' END" },
  metrics: {
    views: "SUM(r.name = 'page_view')", users: "COUNT(DISTINCT CASE WHEN r.name = 'page_view' THEN r.device END)",
    sessions: "COUNT(DISTINCT CASE WHEN r.name = 'page_view' THEN r.session END)", entrances: "SUM(r.name = 'page_view' AND r.path = s.landing)",
    avg_sec: "SUM(r.eng_ms) / 1000.0 / NULLIF(SUM(r.name = 'page_view'), 0)", eng_sec: 'SUM(r.eng_ms) / 1000.0',
  },
};
const EVENTS = {
  from: RAWJOIN, date: 'r.date',
  dims: { ...grains('r.date'), ...SESS_DIMS, hour: "printf('%02d', r.hour)", event: 'r.name', path: 'r.path' },
  metrics: { count: 'COUNT(*)', users: 'COUNT(DISTINCT r.device)', sessions: 'COUNT(DISTINCT r.session)', per_user: 'COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT r.device), 0)' },
};
// "p.quiz_name" → that event parameter
const paramDim = (d) => (d.startsWith('p.') && KEY_RE.test(d.slice(2)) ? `CAST(json_extract(r.params, '$.${d.slice(2)}') AS TEXT)` : null);

const SEARCH_M = {
  clicks: 'SUM(clicks)', impressions: 'SUM(impressions)', ctr: 'SUM(clicks) * 1.0 / NULLIF(SUM(impressions), 0)',
  position: 'SUM(position * impressions) / NULLIF(SUM(CASE WHEN position > 0 THEN impressions END), 0)',
  queries: 'COUNT(DISTINCT query)', pages: 'COUNT(DISTINCT page)',
};
const POS_BUCKET = "CASE WHEN position <= 0 THEN '(none)' WHEN position <= 3 THEN '1–3' WHEN position <= 10 THEN '4–10' WHEN position <= 20 THEN '11–20' WHEN position <= 50 THEN '21–50' ELSE '51+' END";
const SEARCH_DIMS = { ...grains('date'), engine: 'engine', query: 'query', page: 'page', pos_bucket: POS_BUCKET };
function searchFrom(need) {
  // Pick the right table: query rows, page rows, or daily totals (Google's totals include anonymized searches).
  if (need.has('query') && need.has('page')) return "(SELECT 'Google' engine, NULL date, query, page, clicks, impressions, position FROM gsc_qp28)";
  if (need.has('query') || need.has('queries') || need.has('pos_bucket'))
    return "(SELECT 'Google' engine, date, query, NULL page, clicks, impressions, position FROM gsc_query UNION ALL SELECT 'Bing', date, query, NULL, clicks, impressions, position FROM bing_query)";
  if (need.has('page') || need.has('pages'))
    return "(SELECT 'Google' engine, date, NULL query, page, clicks, impressions, position FROM gsc_page UNION ALL SELECT 'Bing', date, NULL, page, clicks, impressions, position FROM bing_page)";
  return `(SELECT 'Google' engine, date, NULL query, NULL page, clicks, impressions, position FROM gsc_days
    UNION ALL SELECT 'Bing', date, NULL, NULL, SUM(clicks), SUM(impressions), SUM(position * impressions) / NULLIF(SUM(impressions), 0) FROM bing_query GROUP BY date)`;
}

const GA4_DIMS = ['channel', 'source_medium', 'landing', 'page', 'device', 'country', 'city', 'event'];
const GA4_M = {
  sessions: 'SUM(sessions)', users: 'SUM(users)', views: 'SUM(views)', engaged: 'SUM(engaged)', engaged_rate: 'SUM(engaged) * 1.0 / NULLIF(SUM(sessions), 0)',
  key_events: 'SUM(key_events)', events: 'SUM(events)',
};

// ms timestamps → US Eastern day (fixed offset; close enough for daily email stats)
const msDay = (col) => `date(${col} / 1000 - 5 * 3600, 'unixepoch')`;
const EMAIL = {
  from: 'sends e LEFT JOIN contacts c ON c.id = e.contact_id', date: msDay('e.sent_at'),
  where: "e.sent_at IS NOT NULL AND e.status NOT IN ('skipped', 'queued')",
  dims: { ...grains(msDay('e.sent_at')), email: 'e.key', kind: 'e.kind', variant: "COALESCE(NULLIF(e.variant, ''), 'a')", test: "COALESCE(NULLIF(e.test, ''), '(none)')",
    mode: 'e.mode', status: 'e.status', subject: 'e.subject', source: "COALESCE(c.source, '(unknown)')", level: "COALESCE(CAST(c.level AS TEXT), '(no quiz)')", contact_type: "CASE c.is_test WHEN 1 THEN 'Test' ELSE 'Real' END" },
  metrics: {
    sent: 'COUNT(*)', delivered: "SUM(e.delivered_at IS NOT NULL OR e.status IN ('delivered', 'sent'))", opened: 'SUM(e.opened_at IS NOT NULL)', clicked: 'SUM(e.clicked_at IS NOT NULL)',
    unsubs: 'SUM(e.unsub_at IS NOT NULL)', bounced: "SUM(e.status IN ('bounced', 'complained'))", failed: "SUM(e.status = 'failed')",
    open_rate: 'SUM(e.opened_at IS NOT NULL) * 1.0 / NULLIF(COUNT(*), 0)', click_rate: 'SUM(e.clicked_at IS NOT NULL) * 1.0 / NULLIF(COUNT(*), 0)',
    ctor: 'SUM(e.clicked_at IS NOT NULL) * 1.0 / NULLIF(SUM(e.opened_at IS NOT NULL), 0)', unsub_rate: 'SUM(e.unsub_at IS NOT NULL) * 1.0 / NULLIF(COUNT(*), 0)',
    total_clicks: 'SUM(e.clicks)', total_opens: 'SUM(e.opens)',
  },
};
const LIST = {
  from: 'contacts c', date: msDay('c.created'), where: 'c.created IS NOT NULL',
  dims: { ...grains(msDay('c.created')), source: "COALESCE(c.source, '(unknown)')", level: "COALESCE(CAST(c.level AS TEXT), '(no quiz)')", status: 'c.status',
    measured: "CASE c.measured WHEN 1 THEN 'Measured' ELSE 'Not measured' END", zip3: "COALESCE(substr(c.zip, 1, 3), '(none)')", contact_type: "CASE c.is_test WHEN 1 THEN 'Test' ELSE 'Real' END" },
  metrics: { signups: 'COUNT(*)', active: "SUM(c.status = 'active')", unsubscribed: "SUM(c.status != 'active')", clickers: 'SUM(c.clicks > 0)', openers: 'SUM(c.opens > 0)',
    measured: 'SUM(c.measured)', with_quiz: 'SUM(c.level IS NOT NULL)' },
};
const SOCIAL = {
  from: 'social_snap', date: 'date',
  dims: { ...grains('date'), platform: 'platform' },
  metrics: { followers: 'MAX(followers)', posts: 'MAX(posts)', views: 'MAX(views)' },
};

const ENG = '(COALESCE(likes, 0) + COALESCE(comments, 0) + COALESCE(shares, 0) + COALESCE(saves, 0))';
const POST_M = {
  posts: 'COUNT(*)', impressions: 'SUM(impressions)', reach: 'SUM(reach)', views: 'SUM(views)', likes: 'SUM(likes)', comments: 'SUM(comments)', shares: 'SUM(shares)',
  saves: 'SUM(saves)', clicks: 'SUM(clicks)', engagements: `SUM(${ENG})`, avg_engagements: `AVG(${ENG})`,
  eng_rate: `SUM(CASE WHEN COALESCE(reach, views, impressions) > 0 THEN ${ENG} END) * 1.0 / NULLIF(SUM(CASE WHEN COALESCE(reach, views, impressions) > 0 THEN COALESCE(reach, views, impressions) END), 0)`,
  avg_seen: 'AVG(COALESCE(reach, views, impressions))',
};

/* ================================================================ query builder */
const OPS = {
  eq: (x) => [`${x} = ?`, 1], neq: (x) => [`(${x} IS NULL OR ${x} != ?)`, 1],
  contains: (x) => [`instr(lower(${x}), lower(?)) > 0`, 1], not_contains: (x) => [`(${x} IS NULL OR instr(lower(${x}), lower(?)) = 0)`, 1],
  starts: (x) => [`${x} LIKE ? || '%'`, 1], gt: (x) => [`${x} > ?`, 1], lt: (x) => [`${x} < ?`, 1],
};
function dimExpr(src, d) {
  if (src.dims[d]) return src.dims[d];
  if (src === EVENTS || src === PAGES) return paramDim(d);
  return null;
}

async function runOne(env, q) {
  const srcName = String(q.src || 'web');
  const from = DATE_RE.test(q.from || '') ? q.from : addDays(etDate(), -27);
  const to = DATE_RE.test(q.to || '') ? q.to : etDate();
  const dims = (Array.isArray(q.dims) ? q.dims : []).slice(0, 3).map(String);
  const metrics = (Array.isArray(q.metrics) ? q.metrics : []).slice(0, 12).map(String);
  const filters = (Array.isArray(q.filters) ? q.filters : []).slice(0, 12);
  const limit = Math.min(Math.max(Number(q.limit) || 500, 1), 5000);

  let src, db, where = [], binds = [];
  if (srcName === 'web') { src = WEB; db = env.EV; }
  else if (srcName === 'pages') { src = PAGES; db = env.EV; }
  else if (srcName === 'events') { src = EVENTS; db = env.EV; }
  else if (srcName === 'email' || srcName === 'list') { src = srcName === 'email' ? EMAIL : LIST; db = env.CRM; if (!db) return { error: 'The email database isn’t set up.' }; }
  else if (srcName === 'social') { src = SOCIAL; db = env.EV; }
  else if (srcName === 'search') {
    const need = new Set([...dims, ...metrics, ...filters.map((f) => f.d)]);
    src = { from: searchFrom(need), date: 'date', dims: SEARCH_DIMS, metrics: SEARCH_M };
    db = env.EV;
    if (need.has('query') && need.has('page')) src = { ...src, date: null };
  } else if (srcName === 'ga4') {
    const extra = [...dims, ...filters.map((f) => f.d)].find((d) => GA4_DIMS.includes(d));
    src = extra
      ? { from: 'ga4_dim', date: 'date', where: 'dim = ?', whereBind: [extra], dims: { ...grains('date'), [extra]: 'value' }, metrics: GA4_M }
      : { from: 'ga4_days', date: 'date', dims: grains('date'), metrics: { ...GA4_M, new_users: 'SUM(new_users)', avg_eng_sec: 'SUM(eng_sec) / NULLIF(SUM(sessions), 0)' } };
    db = env.EV;
  } else if (srcName === 'clarity') {
    // dims: date/week/month + "breakdown" (the value of q.breakdown: none, URL, Device, Channel, Source). metrics: "Metric.field"
    const bd = ['URL', 'Device', 'Channel', 'Source'].includes(q.breakdown) ? q.breakdown : '(all)';
    const ms = metrics.filter((m) => /^[A-Za-z]{2,40}\.[A-Za-z]{2,60}$/.test(m));
    if (!ms.length) return { error: 'Pick a Clarity metric.' };
    const mx = Object.fromEntries(ms.map((m) => { const [a, b] = m.split('.'); return [m, `${b.endsWith('Percentage') || /average|avg/i.test(b) ? 'AVG' : 'SUM'}(CASE WHEN metric = '${a}' AND field = '${b}' THEN v END)`]; }));
    src = { from: 'clarity_m', date: 'date', where: 'dim = ?', whereBind: [bd], dims: { ...grains('date'), value: 'value' }, metrics: mx };
    db = env.EV;
  } else if (srcName === 'social_day') {
    const ms = metrics.filter((m) => /^[a-z_]{2,40}$/.test(m));
    if (!ms.length) return { error: 'Pick a metric.' };
    src = { from: 'social_day', date: 'date', dims: { ...grains('date'), platform: 'platform' }, metrics: Object.fromEntries(ms.map((m) => [m, `SUM(CASE WHEN metric = '${m}' THEN v END)`])) };
    db = env.EV;
  } else if (srcName === 'social_posts') {
    src = { from: 'social_posts', date: 'date', dims: { ...grains('date'), platform: 'platform', type: "COALESCE(type, '(none)')", dow: "CASE dow WHEN 0 THEN '7 Sun' WHEN 1 THEN '1 Mon' WHEN 2 THEN '2 Tue' WHEN 3 THEN '3 Wed' WHEN 4 THEN '4 Thu' WHEN 5 THEN '5 Fri' ELSE '6 Sat' END", hour: "printf('%02d', hour)" }, metrics: POST_M };
    db = env.EV;
  } else return { error: `Unknown source ${srcName}` };

  if (src.where) where.push(src.where);
  if (src.whereBind) binds.push(...src.whereBind);
  if (src.date) { where.push(`${src.date} BETWEEN ? AND ?`); binds.push(from, to); }
  for (const f of filters) {
    const x = dimExpr(src, String(f.d || '')); const op = OPS[f.op || 'eq'];
    if (!x || !op) continue;
    if (Array.isArray(f.v)) { // "is one of"
      const vs = f.v.slice(0, 50).map(String);
      if (!vs.length) continue;
      where.push(`${f.op === 'neq' ? 'NOT ' : ''}${x} IN (${vs.map(() => '?').join(',')})`); binds.push(...vs);
      continue;
    }
    const [sql] = op(x); where.push(sql); binds.push(String(f.v ?? ''));
  }
  const dx = dims.map((d) => { const e = dimExpr(src, d); if (!e) throw new Error(`Unknown dimension ${d}`); return e; });
  const mx = metrics.map((m) => { const e = src.metrics[m]; if (!e) throw new Error(`Unknown metric ${m}`); return e; });
  if (!mx.length) return { error: 'Pick at least one metric.' };
  const cols = [...dims, ...metrics];
  let sort = String(q.sort || '');
  const desc = sort.startsWith('-'); sort = sort.replace(/^-/, '');
  let order = '';
  const si = cols.indexOf(sort);
  if (si >= 0) order = `ORDER BY ${si + 1} ${desc ? 'DESC' : 'ASC'}`;
  else if (dims.length && ['date', 'week', 'month', 'hour', 'dow'].includes(dims[0])) order = 'ORDER BY 1';
  else if (dims.length) order = `ORDER BY ${dims.length + 1} DESC`;
  const sql = `SELECT ${[...dx.map((e, i) => `${e} AS d${i}`), ...mx.map((e, i) => `${e} AS m${i}`)].join(', ')} FROM ${src.from}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${dims.length ? `GROUP BY ${dims.map((_, i) => i + 1).join(', ')}` : ''} ${order} LIMIT ${limit}`;
  const { results } = await db.prepare(sql).bind(...binds).all();
  const rows = results.map((r) => [...dims.map((_, i) => r[`d${i}`]), ...metrics.map((_, i) => r[`m${i}`])]);
  // Totals row also has to be asked for separately (no dims) to be exact for distinct counts; the browser does that.
  return { cols, rows, from, to };
}

// Make sure every day in the event log has session rows (ev_sess is new; older days get built on first use).
async function ensureSess(env) {
  if (!env.EV) return;
  await evInit(env.EV);
  const today = etDate();
  const last = await getState(env.EV, 'sess_checked');
  if (last && Date.now() - last < 10 * 60000) return;
  await rollup(env.EV, today);
  await rollup(env.EV, addDays(today, -1));
  const { results } = await env.EV.prepare('SELECT date FROM ev_days EXCEPT SELECT DISTINCT date FROM ev_sess ORDER BY date DESC LIMIT 20').all();
  for (const r of results) await rollup(env.EV, r.date);
  await setState(env.EV, 'sess_checked', Date.now());
}

/* ================================================================ pulls: GA4, Clarity, social */
async function ga4Report(env, body) {
  const token = await googleToken(env);
  const base = env.SEO_API_BASE || 'https://analyticsdata.googleapis.com';
  const r = await fetch(`${base}/v1beta/properties/${encodeURIComponent(env.GA4_PROPERTY_ID)}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ limit: 10000, keepEmptyRows: false, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || r.status;
    if (r.status === 403) throw new Error(`GA4 says no access (${msg}). Add ${serviceAccount(env)?.client_email || 'the service account'} as a Viewer in GA4 → Admin → Property access management.`);
    throw new Error(`GA4 ${r.status}: ${msg}`);
  }
  return (j.rows || []).map((row) => [...(row.dimensionValues || []).map((d) => d.value), ...(row.metricValues || []).map((m) => Number(m.value) || 0)]);
}
const gaDate = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const GA_DIM_MAP = { channel: 'sessionDefaultChannelGroup', source_medium: 'sessionSourceMedium', landing: 'landingPage', page: 'pagePath', device: 'deviceCategory', country: 'country', city: 'city', event: 'eventName' };
async function pullGA4(env, from, to) {
  const db = env.EV;
  const range = [{ startDate: from, endDate: to }];
  const totals = await ga4Report(env, { dateRanges: range, dimensions: [{ name: 'date' }],
    metrics: ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'engagedSessions', 'userEngagementDuration', 'keyEvents', 'eventCount'].map((name) => ({ name })) });
  const stmts = [db.prepare('DELETE FROM ga4_days WHERE date BETWEEN ? AND ?').bind(from, to), db.prepare('DELETE FROM ga4_dim WHERE date BETWEEN ? AND ?').bind(from, to)];
  if (totals.length) stmts.push(db.prepare(`INSERT OR REPLACE INTO ga4_days SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5, j.value->>6, j.value->>7, j.value->>8 FROM json_each(?) j`)
    .bind(JSON.stringify(totals.map((r) => [gaDate(r[0]), ...r.slice(1)]))));
  let n = totals.length;
  for (const [dim, name] of Object.entries(GA_DIM_MAP)) {
    const isEvent = dim === 'event', isPage = dim === 'page';
    const mets = isEvent ? ['eventCount', 'totalUsers'] : isPage ? ['screenPageViews', 'totalUsers'] : ['sessions', 'totalUsers', 'screenPageViews', 'engagedSessions', 'keyEvents'];
    const rows = await ga4Report(env, { dateRanges: range, dimensions: [{ name: 'date' }, { name }], metrics: mets.map((m) => ({ name: m })) });
    const shaped = rows.map((r) => {
      const [d, v, ...m] = r;
      return isEvent ? [gaDate(d), dim, v, 0, m[1], 0, 0, 0, m[0]] : isPage ? [gaDate(d), dim, v, 0, m[1], m[0], 0, 0, 0] : [gaDate(d), dim, v, m[0], m[1], m[2], m[3], m[4], 0];
    });
    n += shaped.length;
    if (shaped.length) stmts.push(db.prepare(`INSERT OR REPLACE INTO ga4_dim SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5, j.value->>6, j.value->>7, j.value->>8 FROM json_each(?) j`).bind(JSON.stringify(shaped)));
  }
  await db.batch(stmts);
  return `${from} → ${to}: ${n} rows`;
}

const CLARITY_DIMS = ['(all)', 'URL', 'Device', 'Channel', 'Source'];
async function pullClarity(env, date) {
  const db = env.EV;
  const out = [];
  for (const dim of CLARITY_DIMS) {
    const qs = new URLSearchParams({ numOfDays: '1' });
    if (dim !== '(all)') qs.set('dimension1', dim);
    const base = env.SEO_API_BASE ? `${env.SEO_API_BASE}/clarity` : 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
    const r = await fetch(`${base}?${qs}`, { headers: { authorization: `Bearer ${env.CLARITY_TOKEN}`, 'content-type': 'application/json' } });
    const txt = await r.text();
    if (!r.ok) throw new Error(`Clarity ${r.status}: ${txt.slice(0, 160)}`);
    let body; try { body = JSON.parse(txt); } catch { throw new Error('Clarity sent something that isn’t JSON.'); }
    const rows = [];
    for (const m of Array.isArray(body) ? body : []) {
      for (const info of m.information || []) {
        let value = '(all)';
        if (dim !== '(all)') value = String(info[dim] ?? info[dim.toLowerCase()] ?? info.Url ?? '(not set)').slice(0, 300);
        if (dim === 'URL') { try { value = new URL(value).pathname; } catch { /* keep it */ } }
        for (const [field, v] of Object.entries(info)) {
          const num = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null;
          if (num == null || field === dim) continue;
          rows.push([date, dim, value, String(m.metricName || '?').replace(/\s+/g, ''), field, num]);
        }
      }
    }
    await db.batch([
      db.prepare('INSERT OR REPLACE INTO clarity_raw (date, dim, body, at) VALUES (?, ?, ?, ?)').bind(date, dim, txt.slice(0, 900000), Date.now()),
      db.prepare('DELETE FROM clarity_m WHERE date = ? AND dim = ?').bind(date, dim),
      // URL rows can repeat after trimming query strings; sum the counts.
      db.prepare(`INSERT INTO clarity_m SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5 FROM json_each(?) j WHERE true
        ON CONFLICT (date, dim, value, metric, field) DO UPDATE SET v = v + excluded.v`).bind(JSON.stringify(rows)),
    ]);
    out.push(`${dim}: ${rows.length}`);
  }
  return out.join(', ');
}

// Hourly from the cron. Each pull decides whether it's due.
export async function axTick(env, { force = false } = {}) {
  if (!env.EV) return {};
  await evInit(env.EV); await seoInit(env.EV); await axInit(env.EV); await socialInit(env.EV);
  const runs = (await getState(env.EV, 'runs')) || {};
  const hour = new Date().getUTCHours();
  const due = (task, everyHours, atHour = null) => force || !runs[task]?.lastOk || (Date.now() - runs[task].lastOk > everyHours * 3600000 && (atHour == null || hour >= atHour))
    && (!runs[task] || runs[task].ok || Date.now() - runs[task].at > 3 * 3600000);
  const did = {};
  const step = async (task, fn) => { try { const info = await fn(); await logRun(env.EV, task, true, info); did[task] = info; } catch (e) { await logRun(env.EV, task, false, e.message); did[task] = 'error: ' + e.message; } };
  const today = etDate();
  if (env.GA4_PROPERTY_ID && serviceAccount(env) && due('ga4', 20)) {
    await step('ga4', async () => {
      const back = await getState(env.EV, 'ga4_backfill');
      if (!back) { const r = await pullGA4(env, addDays(today, -90), today); await setState(env.EV, 'ga4_backfill', Date.now()); return 'backfill ' + r; }
      return pullGA4(env, addDays(today, -3), today);
    });
  }
  // Clarity: once a day, early morning UTC (≈ "the last 24 hours" = yesterday). Max 5 of Clarity's 10 daily calls.
  if (env.CLARITY_TOKEN && (force || !runs.clarity?.lastOk || etDate(runs.clarity.lastOk) !== today) && (force || hour >= 6) && (!runs.clarity || runs.clarity.ok || Date.now() - runs.clarity.at > 6 * 3600000))
    await step('clarity', () => pullClarity(env, addDays(today, -1)));
  await socialTick(env, step, due);
  // Inbox: turn whatever just changed into notifications (worker/inbox.js).
  try { const r = await inboxScan(env); if (r.added) did.inbox = `${r.added} new`; } catch (e) { did.inbox = 'error: ' + e.message; }
  return did;
}

/* ================================================================ HQ endpoints */
export async function axAdmin(env, req, url) {
  const p = url.pathname;
  if (!env.EV) return json({ error: 'The events database isn’t set up yet.' }, 503);
  await evInit(env.EV); await seoInit(env.EV); await axInit(env.EV); await socialInit(env.EV);

  if (p === '/api/admin/ax/q' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const qs = (Array.isArray(b.qs) ? b.qs : []).slice(0, 24);
    if (qs.some((q) => ['web', 'pages', 'events'].includes(q.src))) await ensureSess(env);
    const results = await Promise.all(qs.map((q) => runOne(env, q).catch((e) => ({ error: String(e.message || e).slice(0, 300) }))));
    return json({ results });
  }

  if (p === '/api/admin/ax/status' && req.method === 'GET') {
    const db = env.EV;
    const one = async (sql) => { try { return await db.prepare(sql).first(); } catch { return null; } };
    const [ev, gsc, bing, ga4, cl, so, evs, params] = await Promise.all([
      one('SELECT MIN(date) a, MAX(date) b, COUNT(*) n FROM ev_days'), one('SELECT MIN(date) a, MAX(date) b, COUNT(*) n FROM gsc_days'),
      one('SELECT MIN(date) a, MAX(date) b, COUNT(*) n FROM bing_query'), one('SELECT MIN(date) a, MAX(date) b, COUNT(*) n FROM ga4_days'),
      one('SELECT MIN(date) a, MAX(date) b, COUNT(DISTINCT date) n FROM clarity_m'), one('SELECT MIN(date) a, MAX(date) b, COUNT(*) n FROM social_snap'),
      db.prepare(`SELECT name, SUM(count) n FROM ev_events WHERE param = '' GROUP BY name ORDER BY n DESC`).all().then((r) => r.results).catch(() => []),
      db.prepare(`SELECT name, param, COUNT(DISTINCT value) vals, SUM(count) n FROM ev_events WHERE param != '' GROUP BY name, param ORDER BY name, n DESC`).all().then((r) => r.results).catch(() => []),
    ]);
    const socialMetrics = await db.prepare('SELECT platform, metric, COUNT(*) n FROM social_day GROUP BY platform, metric ORDER BY platform, metric').all().then((r) => r.results).catch(() => []);
    const socialPosts = await db.prepare('SELECT platform, COUNT(*) n, MAX(updated) at FROM social_posts GROUP BY platform').all().then((r) => r.results).catch(() => []);
    const clarityFields = await db.prepare(`SELECT metric, field, COUNT(*) n FROM clarity_m WHERE dim = '(all)' GROUP BY metric, field ORDER BY metric, field`).all().then((r) => r.results).catch(() => []);
    let crm = null;
    if (env.CRM) { try { crm = await env.CRM.prepare("SELECT COUNT(*) contacts, SUM(status = 'active') active, (SELECT COUNT(*) FROM sends WHERE sent_at IS NOT NULL) sends, (SELECT v FROM crm_kv WHERE k = 'live_since') live FROM contacts WHERE is_test = 0").first(); } catch { /* not set up */ } }
    const runs = (await getState(db, 'runs')) || {};
    const seoRuns = await db.prepare("SELECT v FROM seo_state WHERE k = 'runs'").first().then((r) => (r ? JSON.parse(r.v) : {})).catch(() => ({}));
    const sa = serviceAccount(env);
    return json({
      today: etDate(),
      sources: {
        web: { on: true, span: ev },
        search: { on: !!sa || !!env.BING_API_KEY, google: !!sa, bing: !!env.BING_API_KEY, span: gsc, bingSpan: bing, runs: seoRuns },
        ga4: { on: !!(env.GA4_PROPERTY_ID && sa), property: env.GA4_PROPERTY_ID || null, account: sa?.client_email || null, span: ga4, run: runs.ga4 || null },
        clarity: { on: !!env.CLARITY_TOKEN, span: cl, run: runs.clarity || null, fields: clarityFields },
        email: { on: !!env.CRM, crm },
        social: { on: true, youtube: !!env.YT_API_KEY, meta: !!env.META_PAGE_TOKEN, span: so, platforms: socialStatus(env), metrics: socialMetrics, posts: socialPosts,
          runs: Object.fromEntries(SOCIAL_SOURCES.map(([id, label]) => [id, { label, ...(runs[`social:${id}`] || {}) }])) },
      },
      events: evs, params,
      inbox: { unread: await inboxUnread(db) },
    });
  }

  if (p === '/api/admin/ax/run' && req.method === 'POST') return json({ ok: true, did: await axTick(env, { force: true }) });

  // Social: snapshots by platform + manual entry + the posts logged in HQ → Social.
  if (p === '/api/admin/ax/social' && req.method === 'GET') {
    const { results: snaps } = await env.EV.prepare('SELECT date, platform, followers, posts, views, auto, note FROM social_snap ORDER BY date').all();
    let posts = [];
    try { posts = (await env.DB.prepare('SELECT item, platform, at FROM social_log ORDER BY at DESC LIMIT 300').all()).results; } catch { /* none yet */ }
    return json({ snaps, posts });
  }
  if (p === '/api/admin/ax/social' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const platform = String(b.platform || '').toLowerCase();
    if (!/^[a-z]{1,20}$/.test(platform)) return json({ error: 'Pick a platform.' }, 400);
    const date = DATE_RE.test(b.date || '') ? b.date : etDate();
    if (b.delete) { await env.EV.prepare('DELETE FROM social_snap WHERE date = ? AND platform = ?').bind(date, platform).run(); return json({ ok: true }); }
    const n = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
    await env.EV.prepare(`INSERT INTO social_snap (date, platform, followers, posts, views, auto, note, at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT (date, platform) DO UPDATE SET followers = excluded.followers, posts = COALESCE(excluded.posts, posts), views = COALESCE(excluded.views, views), auto = 0, note = excluded.note, at = excluded.at`)
      .bind(date, platform, n(b.followers), n(b.posts), n(b.views), String(b.note || '').slice(0, 200) || null, Date.now()).run();
    return json({ ok: true });
  }

  // Every post (any platform) in a date range, for the Social page's post table.
  if (p === '/api/admin/ax/posts' && req.method === 'GET') {
    const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : '2000-01-01';
    const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : '2999-12-31';
    const plat = url.searchParams.get('platform');
    const { results } = await env.EV.prepare(`SELECT platform, id, created, date, hour, dow, text, url, type, impressions, reach, views, likes, comments, shares, saves, clicks, extra, updated
      FROM social_posts WHERE date BETWEEN ? AND ? ${plat && /^[a-z]{1,20}$/.test(plat) ? 'AND platform = ?' : ''} ORDER BY created DESC LIMIT 1000`).bind(from, to, ...(plat && /^[a-z]{1,20}$/.test(plat) ? [plat] : [])).all();
    return json({ posts: results });
  }

  if (p.startsWith('/api/admin/ax/inbox')) return inboxAdmin(env, req, url);

  // Saved views (Explore): small JSON list in ax_state.
  if (p === '/api/admin/ax/views' && req.method === 'GET') return json({ views: (await getState(env.EV, 'views')) || [] });
  if (p === '/api/admin/ax/views' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const views = Array.isArray(b.views) ? b.views.slice(0, 100) : [];
    if (JSON.stringify(views).length > 200000) return json({ error: 'Too big.' }, 400);
    await setState(env.EV, 'views', views);
    return json({ ok: true });
  }
  return json({ error: 'Not found.' }, 404);
}

export const AX_DAY = DAY;
