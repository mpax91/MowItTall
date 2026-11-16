// First-party event log (Nov 16, 2026). Mike's own copy of what visitors do, kept forever, free.
//
// Why: GA4 deletes event-level data after 14 months, and BigQuery only keeps it past 60 days with a card on
// file. This keeps every event in Cloudflare D1 (free plan, separate database `mowittall-events`, binding EV)
// so it never competes with the Hall photos for space.
//
// Shape (same layout as the Bedford Bee's GA4 tables in MikeCOS, worker/src/bee/ga.ts + migration
// 0101_bee_analytics.sql, so MikeCOS can pull Mow It Tall the same way later):
//   ev_raw      one row per event (the forever copy)
//   ev_days     site totals per day                 ≈ bee_ga_days
//   ev_landing  sessions by landing × source/medium ≈ bee_ga_landing
//   ev_pages    page views by host × path           ≈ bee_ga_pages
//   ev_geo      sessions by city                    ≈ bee_ga_geo
//   ev_dims     sessions by device/hour/os/...      ≈ bee_ga_dims
//   ev_clicks   outbound clicks by page × domain    ≈ bee_ga_clicks
//   ev_events   event counts by name × param value  (custom events; GA4 has no Bee equivalent)
// Daily tables are rebuilt from ev_raw: nightly cron (last 3 days, like the Bee's re-pull) and whenever
// HQ opens (today + yesterday). Dates and hours are US Eastern.
//
// Privacy: no IP address, no full user agent, no names or emails. Device = the random id the site already
// keeps for Hall votes (`mit-device`). City/region/country come from Cloudflare's request info.
// Browsers sending Global Privacy Control aren't logged (the snippet in Base.astro skips them).
//
// Free plan guardrails: one row written per event (rollups are a few hundred rows a night). If the database
// passes ~400 MB, the nightly job trims the oldest month of ev_raw; the daily tables are never trimmed.

const TZ = 'America/New_York';
const KEY_EVENTS = ['quiz_complete', 'calendar_download', 'hall_upload'];
const SKIP_PARAMS = new Set(['link_url', 'link_text', 'page_path', 'page_referrer', 'error_message', 'error_source', 'read_seconds']);
const MAX_EVENTS = 25;
const TRIM_AT = 400_000_000;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|monitor|curl|wget|python|axios/i;
const DAILY = ['ev_days', 'ev_landing', 'ev_pages', 'ev_geo', 'ev_dims', 'ev_clicks', 'ev_events'];

let ready = null;
export async function evInit(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_raw (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, date TEXT NOT NULL, hour INTEGER NOT NULL,
        name TEXT NOT NULL, path TEXT, title TEXT, device TEXT, session TEXT, nv INTEGER NOT NULL DEFAULT 0,
        eng_ms INTEGER NOT NULL DEFAULT 0, params TEXT,
        landing TEXT, source TEXT, medium TEXT, campaign TEXT, channel TEXT,
        country TEXT, region TEXT, city TEXT, dev_type TEXT, os TEXT, browser TEXT, eid TEXT)`),
      db.prepare('CREATE INDEX IF NOT EXISTS ev_raw_date ON ev_raw (date, session)'),
      // page_leave is sent twice on purpose (beacon now + re-sent from the next page); the id makes the copy a no-op.
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS ev_raw_eid ON ev_raw (eid) WHERE eid IS NOT NULL'),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_days (date TEXT PRIMARY KEY, sessions INTEGER NOT NULL, users INTEGER NOT NULL,
        new_users INTEGER NOT NULL, views INTEGER NOT NULL, engaged INTEGER NOT NULL, engagement_sec REAL NOT NULL,
        events INTEGER NOT NULL, key_events INTEGER NOT NULL)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_landing (date TEXT NOT NULL, landing TEXT NOT NULL, source TEXT NOT NULL, medium TEXT NOT NULL,
        channel TEXT, sessions INTEGER NOT NULL, engaged INTEGER NOT NULL, engagement_sec REAL NOT NULL, views INTEGER NOT NULL,
        PRIMARY KEY (date, landing, source, medium))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_pages (date TEXT NOT NULL, host TEXT NOT NULL, path TEXT NOT NULL, title TEXT,
        views INTEGER NOT NULL, engagement_sec REAL NOT NULL, PRIMARY KEY (date, host, path))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_geo (date TEXT NOT NULL, city TEXT NOT NULL, region TEXT NOT NULL, country TEXT,
        sessions INTEGER NOT NULL, PRIMARY KEY (date, city, region))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_dims (date TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL,
        sessions INTEGER NOT NULL, PRIMARY KEY (date, dim, value))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_clicks (date TEXT NOT NULL, path TEXT NOT NULL, domain TEXT NOT NULL,
        clicks INTEGER NOT NULL, PRIMARY KEY (date, path, domain))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ev_events (date TEXT NOT NULL, name TEXT NOT NULL, param TEXT NOT NULL, value TEXT NOT NULL,
        count INTEGER NOT NULL, users INTEGER NOT NULL, PRIMARY KEY (date, name, param, value))`),
      db.prepare('CREATE TABLE IF NOT EXISTS ev_meta (k TEXT PRIMARY KEY, v TEXT)'),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* ---------------------------------------------------------------- helpers */
const s = (v, n) => (v == null ? null : String(v).replace(/[\u0000-\u001f]/g, '').slice(0, n) || null);
const isId = (d) => typeof d === 'string' && /^[a-z0-9-]{8,64}$/i.test(d);
const etParts = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
export const etDate = (ms = Date.now()) => etParts(ms).date;
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function ua(str) {
  const u = str || '';
  const dev_type = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(u) ? 'tablet' : /Mobi|iPhone|iPod|Android/i.test(u) ? 'mobile' : 'desktop';
  const os = /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : 'Other';
  const browser = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /OPR\/|Opera/.test(u) ? 'Opera' : /Firefox|FxiOS/.test(u) ? 'Firefox'
    : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Other';
  return { dev_type, os, browser };
}

// GA-style default channel, plus "AI Assistant" so ChatGPT / Perplexity / Claude / Gemini visits stand out (AEO).
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|baidu|yandex|startpage|qwant|aol)\./;
const AI = /chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot|you\.com|phind|meta\.ai/;
const SOCIAL = /facebook|^fb$|instagram|^ig$|^t\.co$|twitter|^x\.com$|^x$|nextdoor|reddit|linkedin|lnkd|threads|pinterest|tiktok|youtube|snapchat/;
export function channelOf(source, medium) {
  const src = (source || '').toLowerCase(), med = (medium || '').toLowerCase();
  if (src === '(direct)') return 'Direct';
  if (/cpc|ppc|paid/.test(med)) return SOCIAL.test(src) ? 'Paid Social' : 'Paid Search';
  if (med === 'email' || /mail/.test(src)) return 'Email';
  if (AI.test(src)) return 'AI Assistant';
  if (med === 'organic' || SEARCH.test(src)) return 'Organic Search';
  if (med === 'social' || SOCIAL.test(src)) return 'Organic Social';
  if (med === 'qr' || med === 'print') return 'Offline';
  return 'Referral';
}

/* ---------------------------------------------------------------- ingest: POST /api/e */
// Body (text/plain JSON, sent with sendBeacon/fetch keepalive from Base.astro):
// { d: device, s: session, nv: 1 if the device id was just created, a: { src, med, camp, land },
//   e: [ { n: name, p: path, ti: title, ms: engaged ms (page_leave), k: unique id (page_leave), t: when (re-sent page_leave), x: { params } } ] }
export async function ingest(req, env, ctx) {
  const ok = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!env.EV) return ok;
  const agent = req.headers.get('user-agent') || '';
  if (!agent || BOT_RE.test(agent)) return ok;
  const txt = await req.text().catch(() => '');
  if (!txt || txt.length > 32_000) return ok;
  let b; try { b = JSON.parse(txt); } catch { return ok; }
  if (!isId(b.d) || !isId(b.s) || !Array.isArray(b.e) || !b.e.length) return ok;
  const a = b.a || {};
  const source = s(a.src, 100) || '(direct)', medium = s(a.med, 60) || '(none)';
  const cf = req.cf || {};
  const dev = ua(agent);
  const now = Date.now();
  await evInit(env.EV);
  const stmt = env.EV.prepare(`INSERT OR IGNORE INTO ev_raw (at, date, hour, name, path, title, device, session, nv, eng_ms, params, landing, source, medium, campaign, channel,
    country, region, city, dev_type, os, browser, eid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const rows = [];
  for (const e of b.e.slice(0, MAX_EVENTS)) {
    const name = s(e?.n, 40);
    if (!name || !/^[a-z0-9_]+$/.test(name)) continue;
    let params = null;
    if (e.x && typeof e.x === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(e.x).slice(0, 25)) {
        if (!/^[a-z0-9_]{1,40}$/.test(k) || v == null || v === '') continue;
        out[k] = typeof v === 'number' || typeof v === 'boolean' ? v : String(v).slice(0, 200);
      }
      if (Object.keys(out).length) params = JSON.stringify(out);
    }
    // A re-sent page_leave keeps its original time (up to a week back) so it lands on the right day.
    const t = Number(e.t);
    const at = t && t <= now + 60000 && now - t < 7 * 86400000 ? Math.min(t, now) : now;
    const { date, hour } = etParts(at);
    rows.push(stmt.bind(at, date, hour, name, s(e.p, 300), s(e.ti, 160), b.d, b.s, b.nv ? 1 : 0,
      Math.max(0, Math.min(Number(e.ms) || 0, 30 * 60000)), params,
      s(a.land, 300), source, medium, s(a.camp, 100), channelOf(source, medium),
      s(cf.country, 2), s(cf.region, 60), s(cf.city, 60), dev.dev_type, dev.os, dev.browser, isId(e.k) ? e.k : null));
  }
  if (rows.length) ctx.waitUntil(env.EV.batch(rows).catch(() => {}));
  return ok;
}

/* ---------------------------------------------------------------- daily rollups */
const SESS = `SELECT session, MIN(device) device, MAX(nv) nv, SUM(name = 'page_view') views, SUM(eng_ms) eng,
  MAX(name IN (${KEY_EVENTS.map(() => '?').join(',')})) k FROM ev_raw WHERE date = ? GROUP BY session`;
const ENGAGED = '(eng >= 10000 OR views >= 2 OR k = 1)';
// The first event of each session carries its landing page, source and place.
const FIRST = `SELECT * FROM (SELECT session, landing, source, medium, channel, city, region, country, dev_type, os, browser, hour,
  ROW_NUMBER() OVER (PARTITION BY session ORDER BY id) rn FROM ev_raw WHERE date = ?) WHERE rn = 1`;

export async function rollup(db, date) {
  const K = [...KEY_EVENTS, date];
  const del = DAILY.map((t) => db.prepare(`DELETE FROM ${t} WHERE date = ?`).bind(date));
  await db.batch([
    ...del,
    db.prepare(`INSERT INTO ev_days SELECT ?, COUNT(*), COUNT(DISTINCT device), COUNT(DISTINCT CASE WHEN nv = 1 THEN device END),
      COALESCE(SUM(views), 0), COALESCE(SUM(${ENGAGED}), 0), COALESCE(SUM(eng), 0) / 1000.0,
      (SELECT COUNT(*) FROM ev_raw WHERE date = ?), (SELECT COUNT(*) FROM ev_raw WHERE date = ? AND name IN (${KEY_EVENTS.map(() => '?').join(',')}))
      FROM (${SESS}) HAVING COUNT(*) > 0`).bind(date, date, date, ...KEY_EVENTS, ...K),
    db.prepare(`INSERT INTO ev_landing SELECT ?, COALESCE(f.landing, '(not set)'), COALESCE(f.source, '(direct)'), COALESCE(f.medium, '(none)'), MAX(f.channel),
      COUNT(*), SUM(${ENGAGED}), SUM(x.eng) / 1000.0, SUM(x.views)
      FROM (${SESS}) x JOIN (${FIRST}) f ON f.session = x.session GROUP BY 2, 3, 4`).bind(date, ...K, date),
    db.prepare(`INSERT INTO ev_pages SELECT ?, 'mowittall.com', path, MAX(title), SUM(name = 'page_view'), SUM(eng_ms) / 1000.0
      FROM ev_raw WHERE date = ? AND path IS NOT NULL AND name IN ('page_view', 'page_leave') GROUP BY path HAVING SUM(name = 'page_view') > 0`).bind(date, date),
    db.prepare(`INSERT INTO ev_geo SELECT ?, COALESCE(city, '(not set)'), COALESCE(region, ''), MAX(country), COUNT(*) FROM (${FIRST}) GROUP BY 2, 3`).bind(date, date),
    ...['dev_type', 'os', 'browser', 'country', 'hour', 'channel'].map((c) =>
      db.prepare(`INSERT INTO ev_dims SELECT ?, ?, COALESCE(CAST(${c} AS TEXT), '(not set)'), COUNT(*) FROM (${FIRST}) GROUP BY 3`).bind(date, c === 'dev_type' ? 'device' : c, date)),
    db.prepare(`INSERT INTO ev_clicks SELECT ?, COALESCE(path, ''), json_extract(params, '$.link_domain'), COUNT(*) FROM ev_raw
      WHERE date = ? AND name = 'outbound_click' AND json_extract(params, '$.link_domain') IS NOT NULL GROUP BY 2, 3`).bind(date, date),
    db.prepare(`INSERT INTO ev_events SELECT ?, name, '', '', COUNT(*), COUNT(DISTINCT device) FROM ev_raw WHERE date = ? GROUP BY name`).bind(date, date),
    db.prepare(`INSERT INTO ev_events SELECT ?, r.name, j.key, CAST(j.value AS TEXT), COUNT(*), COUNT(DISTINCT r.device)
      FROM ev_raw r, json_each(r.params) j WHERE r.date = ? AND r.params IS NOT NULL AND j.key NOT IN (${[...SKIP_PARAMS].map(() => '?').join(',')})
      AND length(CAST(j.value AS TEXT)) <= 80 GROUP BY r.name, j.key, CAST(j.value AS TEXT)`).bind(date, date, ...SKIP_PARAMS),
  ]);
}

// Nightly (cron): rebuild the last 3 days, then trim the oldest raw month if the database is getting big.
export async function nightly(env) {
  if (!env.EV) return;
  await evInit(env.EV);
  const today = etDate();
  for (let i = 0; i < 3; i++) await rollup(env.EV, addDays(today, -i));
  const size = await dbSize(env.EV);
  if (size > TRIM_AT) {
    const first = await env.EV.prepare('SELECT MIN(date) d FROM ev_raw').first();
    if (first?.d && first.d < addDays(today, -60)) {
      await env.EV.prepare('DELETE FROM ev_raw WHERE substr(date, 1, 7) = ?').bind(first.d.slice(0, 7)).run();
      await env.EV.prepare(`INSERT INTO ev_meta (k, v) VALUES ('trimmed', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v`).bind(`${first.d.slice(0, 7)} (${today})`).run();
    }
  }
}

async function dbSize(db) {
  try { const r = await db.prepare('SELECT 1').run(); return Number(r.meta?.size_after) || 0; } catch { return 0; }
}

/* ---------------------------------------------------------------- HQ + export */
const TABLES = new Set(['ev_raw', ...DAILY]);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const csvCell = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// GET /api/admin/events/export?table=ev_days&from=2026-11-01&to=2026-11-30[&after=<id>][&format=csv]
// For MikeCOS (or a spreadsheet). ev_raw pages 5,000 rows at a time: pass `after` = the last id you got.
export async function exportRows(env, url) {
  if (!env.EV) return json({ error: 'The events database isn’t set up yet. It appears after the next deploy.' }, 503);
  await evInit(env.EV);
  const table = url.searchParams.get('table') || 'ev_days';
  if (!TABLES.has(table)) return json({ error: `Pick one of: ${[...TABLES].join(', ')}` }, 400);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = re.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : '2000-01-01';
  const to = re.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : '2999-12-31';
  if (to >= etDate(Date.now() - 86400000)) { await rollup(env.EV, etDate()); await rollup(env.EV, etDate(Date.now() - 86400000)); }
  let q, binds;
  if (table === 'ev_raw') {
    q = 'SELECT * FROM ev_raw WHERE date BETWEEN ? AND ? AND id > ? ORDER BY id LIMIT 5000';
    binds = [from, to, Number(url.searchParams.get('after')) || 0];
  } else {
    q = `SELECT * FROM ${table} WHERE date BETWEEN ? AND ? ORDER BY date LIMIT 50000`;
    binds = [from, to];
  }
  const { results } = await env.EV.prepare(q).bind(...binds).all();
  if (url.searchParams.get('format') === 'csv') {
    const cols = results.length ? Object.keys(results[0]) : [];
    const body = [cols.join(','), ...results.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
    return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="mowittall-${table}-${from}-to-${to}.csv"`, 'cache-control': 'no-store' } });
  }
  const last = table === 'ev_raw' && results.length ? results[results.length - 1].id : null;
  return json({ table, from, to, rows: results, next: table === 'ev_raw' && results.length === 5000 ? last : null });
}

// GET /api/admin/events/summary?days=28 (or days=all) — what HQ → Analytics shows. Current period vs the one before.
export async function summary(env, url) {
  if (!env.EV) return json({ ready: false });
  await evInit(env.EV);
  const today = etDate();
  await rollup(env.EV, today);
  await rollup(env.EV, addDays(today, -1));
  const span = await env.EV.prepare('SELECT MIN(date) a, MAX(date) b FROM ev_days').first();
  const raw = await env.EV.prepare('SELECT COUNT(*) n, MIN(date) a FROM ev_raw').first();
  const meta = Object.fromEntries((await env.EV.prepare('SELECT k, v FROM ev_meta').all()).results.map((r) => [r.k, r.v]));
  const base = { ready: true, today, storage: { bytes: await dbSize(env.EV), rawRows: raw?.n || 0, rawSince: raw?.a || null, trimmed: meta.trimmed || null }, firstDay: span?.a || null };
  if (!span?.b) return json({ ...base, empty: true });
  const d = url.searchParams.get('days');
  const len = d === 'all' ? Math.max(1, Math.round((Date.parse(today) - Date.parse(span.a)) / 86400000) + 1) : Math.min(Math.max(Number(d) || 28, 1), 3650);
  const cur = { from: addDays(today, -(len - 1)), to: today };
  const prev = { from: addDays(cur.from, -len), to: addDays(cur.from, -1) };
  const db = env.EV;
  const B = [cur.from, cur.to];
  const tot = (r) => db.prepare(`SELECT COALESCE(SUM(sessions),0) sessions, COALESCE(SUM(views),0) views, COALESCE(SUM(engaged),0) engaged,
    COALESCE(SUM(engagement_sec),0) engagement_sec, COALESCE(SUM(events),0) events, COALESCE(SUM(key_events),0) key_events, COALESCE(SUM(new_users),0) new_users,
    (SELECT COUNT(DISTINCT device) FROM ev_raw WHERE date BETWEEN ?1 AND ?2) users FROM ev_days WHERE date BETWEEN ?1 AND ?2`).bind(r.from, r.to);
  const top = (sql, n = 15) => db.prepare(sql + ` LIMIT ${n}`).bind(...B);
  const res = await db.batch([
    tot(cur), tot(prev),
    db.prepare('SELECT date, sessions, users, views, engaged FROM ev_days WHERE date BETWEEN ? AND ? ORDER BY date').bind(...B),
    top('SELECT channel, source, medium, SUM(sessions) sessions, SUM(engaged) engaged, SUM(views) views FROM ev_landing WHERE date BETWEEN ? AND ? GROUP BY channel, source, medium ORDER BY sessions DESC', 25),
    top('SELECT path, MAX(title) title, SUM(views) views, SUM(engagement_sec) sec FROM ev_pages WHERE date BETWEEN ? AND ? GROUP BY path ORDER BY views DESC', 25),
    top('SELECT landing, SUM(sessions) sessions, SUM(engaged) engaged FROM ev_landing WHERE date BETWEEN ? AND ? GROUP BY landing ORDER BY sessions DESC'),
    top(`SELECT name, SUM(count) count, SUM(users) users FROM ev_events WHERE date BETWEEN ? AND ? AND param = '' GROUP BY name ORDER BY count DESC`, 60),
    top(`SELECT name, param, value, SUM(count) count FROM ev_events WHERE date BETWEEN ? AND ? AND param != '' GROUP BY name, param, value ORDER BY count DESC`, 300),
    top('SELECT dim, value, SUM(sessions) sessions FROM ev_dims WHERE date BETWEEN ? AND ? GROUP BY dim, value ORDER BY sessions DESC', 200),
    top('SELECT city, region, country, SUM(sessions) sessions FROM ev_geo WHERE date BETWEEN ? AND ? GROUP BY city, region ORDER BY sessions DESC'),
    top('SELECT domain, SUM(clicks) clicks FROM ev_clicks WHERE date BETWEEN ? AND ? GROUP BY domain ORDER BY clicks DESC'),
    db.prepare(`SELECT at, name, path, params, city, region, dev_type, source FROM ev_raw ORDER BY id DESC LIMIT 25`),
  ]);
  const [c, p, daily, sources, pages, landing, events, params, dims, geo, clicks, recent] = res.map((r) => r.results);
  return json({ ...base, cur, prev, days: len, totals: c[0], prevTotals: p[0], daily, sources, pages, landing, events, params, dims, geo, clicks, recent, keyEvents: KEY_EVENTS });
}
