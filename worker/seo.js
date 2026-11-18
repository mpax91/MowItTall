// SEO autopilot (Nov 16, 2026). Replaces the 15-minute "Monday SEO routine" with an hourly job.
//
// What it does, all free (Google and Bing APIs cost nothing; no AI anywhere):
//   1. Search Console search data: totals, queries and pages per day, pulled once a day (last 5 days, since
//      Google keeps finishing recent days) plus a one-time backfill of the 16 months Google keeps.
//      Stored forever in D1, so it outlives Google's 16-month window too.
//   2. Indexing: Google's URL Inspection API on every sitemap URL, once a day each, a slice per hour
//      (Google allows 2,000 a day; the site has ~80 pages). Changes are logged (e.g. "dropped out of index").
//   3. Sitemaps: Google's view of the submitted sitemaps (errors, last read), daily.
//   4. Bing: search terms and pages from Bing Webmaster Tools, daily (if BING_API_KEY is set).
//   5. The SEO checks ("agents"): run at build time by scripts/audit.mjs. This job picks up each new
//      deploy's report, works out what's new or fixed, and saves it for HQ.
//   6. PageSpeed (mobile) for the top 5 pages (home, /plan/, /weeds/, /measure/, the top blog post by Google
//      clicks), each re-checked weekly, one page per hourly run. Uses Google's free PageSpeed Insights API;
//      a free PSI_API_KEY secret is optional but avoids Google's shared keyless quota. Replaces the
//      "Run PageSpeed on the top 5 pages" to-do; anything under 90 lands in the HQ inbox.
//
// Secrets (Cloudflare → Workers & Pages → mowittall → Settings → Variables and Secrets):
//   GSC_SERVICE_ACCOUNT  the whole JSON key file of a Google Cloud service account that's a user on the
//                        Search Console property (read-only scope is all we ask for)
//   BING_API_KEY         Bing Webmaster Tools → Settings → API access → API key
//   PSI_API_KEY          optional: a free Google API key with the PageSpeed Insights API turned on
// Optional: GSC_SITE (default sc-domain:mowittall.com), SEO_API_BASE (local testing only: sends every
// Google/Bing call to a mock server).
//
// Free plan limits this is built around: ≤ ~40 outside requests per hourly run, inserts done as one
// statement per table (json_each), tables live in the analytics database (EV).

const TZ = 'America/New_York';
// One token covers Search Console and the GA4 Data API (HQ → Analytics pulls GA4 with the same service account).
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly';
const INSPECT_PER_RUN = 20;
const DAY = 86400000;
const BACKFILL_DAYS = 480; // Google keeps ~16 months
const CHUNK_DAYS = 90;

export const etDay = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
export const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

let ready = null;
export async function seoInit(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS seo_state (k TEXT PRIMARY KEY, v TEXT, at INTEGER)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS gsc_days (date TEXT PRIMARY KEY, clicks INTEGER, impressions INTEGER, ctr REAL, position REAL)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS gsc_query (date TEXT NOT NULL, query TEXT NOT NULL, clicks INTEGER, impressions INTEGER, position REAL, PRIMARY KEY (date, query))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS gsc_page (date TEXT NOT NULL, page TEXT NOT NULL, clicks INTEGER, impressions INTEGER, position REAL, PRIMARY KEY (date, page))`),
      // which page shows up for which search, last 28 days (replaced daily)
      db.prepare(`CREATE TABLE IF NOT EXISTS gsc_qp28 (query TEXT NOT NULL, page TEXT NOT NULL, clicks INTEGER, impressions INTEGER, position REAL, PRIMARY KEY (query, page))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS bing_query (date TEXT NOT NULL, query TEXT NOT NULL, clicks INTEGER, impressions INTEGER, position REAL, PRIMARY KEY (date, query))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS bing_page (date TEXT NOT NULL, page TEXT NOT NULL, clicks INTEGER, impressions INTEGER, position REAL, PRIMARY KEY (date, page))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS seo_inspect (path TEXT PRIMARY KEY, verdict TEXT, coverage TEXT, indexing TEXT, robots TEXT, fetch TEXT,
        last_crawl TEXT, google_canonical TEXT, user_canonical TEXT, crawled_as TEXT, rich TEXT, rich_items TEXT, error TEXT, checked_at INTEGER, changed_at INTEGER)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS seo_inspect_log (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, at INTEGER, field TEXT, before TEXT, after TEXT)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS seo_speed (path TEXT PRIMARY KEY, score INTEGER, lcp REAL, cls REAL, tbt REAL, fcp REAL, field TEXT, error TEXT, checked_at INTEGER)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS seo_speed_log (path TEXT NOT NULL, at INTEGER NOT NULL, score INTEGER, lcp REAL, cls REAL, tbt REAL, PRIMARY KEY (path, at))`),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* ---------------------------------------------------------------- small state store */
async function getState(db, k) { const r = await db.prepare('SELECT v FROM seo_state WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; }
async function setState(db, k, v) { await db.prepare('INSERT INTO seo_state (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now()).run(); }
async function logError(db, task, err) {
  const list = (await getState(db, 'errors')) || [];
  const msg = String(err?.message || err).slice(0, 300);
  // The same problem again just bumps its time and count, so one stuck step can't flood the list.
  const same = list.findIndex((e) => e.task === task && e.msg.replace(/\d+/g, '#') === msg.replace(/\d+/g, '#'));
  if (same >= 0) { const e = list.splice(same, 1)[0]; list.unshift({ ...e, msg, at: Date.now(), n: (e.n || 1) + 1 }); }
  else list.unshift({ task, msg, at: Date.now() });
  await setState(db, 'errors', list.slice(0, 15));
}

/* ---------------------------------------------------------------- Google auth (service account, RS256 JWT) */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));
export function serviceAccount(env) {
  if (!env.GSC_SERVICE_ACCOUNT) return null;
  try { const sa = JSON.parse(env.GSC_SERVICE_ACCOUNT); return sa.client_email && sa.private_key ? sa : null; } catch { return null; }
}
let tokenCache = null;
export async function googleToken(env) {
  if (tokenCache && tokenCache.exp > Date.now() + 120000) return tokenCache.token;
  const sa = serviceAccount(env);
  if (!sa) throw new Error('GSC_SERVICE_ACCOUNT is missing or isn’t a valid key file.');
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const aud = env.SEO_API_BASE ? `${env.SEO_API_BASE}/token` : (sa.token_uri || 'https://oauth2.googleapis.com/token');
  const unsigned = `${b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlStr(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud, iat: now, exp: now + 3600 }))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch(aud, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${b64url(sig)}` });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google sign-in failed: ${j.error_description || j.error || r.status}`);
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenCache.token;
}
const site = (env) => env.GSC_SITE || 'sc-domain:mowittall.com';
const origin = (env) => { const s = site(env); return s.startsWith('sc-domain:') ? `https://${s.slice(10)}` : s.replace(/\/$/, ''); };
const gBase = (env) => env.SEO_API_BASE || 'https://www.googleapis.com';
const scBase = (env) => env.SEO_API_BASE || 'https://searchconsole.googleapis.com';

async function gfetch(env, url, body) {
  const token = await googleToken(env);
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || r.statusText || r.status;
    if (r.status === 403) throw new Error(`Google says no access (${msg}). Is the service account added as a user in Search Console for ${site(env)}?`);
    throw new Error(`Google API ${r.status}: ${msg}`);
  }
  return j;
}

/* ---------------------------------------------------------------- 1. search data */
async function searchRows(env, from, to, dimensions) {
  const url = `${gBase(env)}/webmasters/v3/sites/${encodeURIComponent(site(env))}/searchAnalytics/query`;
  const out = [];
  for (let startRow = 0; startRow < 100000; startRow += 25000) {
    const j = await gfetch(env, url, { startDate: from, endDate: to, dimensions, rowLimit: 25000, startRow, type: 'web' });
    const rows = j.rows || [];
    out.push(...rows);
    if (rows.length < 25000) break;
  }
  return out;
}
const pathOf = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

async function pullSearch(env, from, to, withQp) {
  const db = env.EV;
  const [days, queries, pages] = [await searchRows(env, from, to, ['date']), await searchRows(env, from, to, ['date', 'query']), await searchRows(env, from, to, ['date', 'page'])];
  const T = (rows, keyFn) => JSON.stringify(rows.map((r) => [...keyFn(r.keys), r.clicks || 0, r.impressions || 0, r.position || 0]));
  const stmts = [
    db.prepare('DELETE FROM gsc_days WHERE date BETWEEN ? AND ?').bind(from, to),
    db.prepare('DELETE FROM gsc_query WHERE date BETWEEN ? AND ?').bind(from, to),
    db.prepare('DELETE FROM gsc_page WHERE date BETWEEN ? AND ?').bind(from, to),
    db.prepare(`INSERT OR REPLACE INTO gsc_days (date, clicks, impressions, ctr, position)
      SELECT j.value->>0, j.value->>1, j.value->>2, CASE WHEN j.value->>2 > 0 THEN (j.value->>1) * 1.0 / (j.value->>2) ELSE 0 END, j.value->>3 FROM json_each(?) j`).bind(T(days, (k) => [k[0]])),
    db.prepare(`INSERT OR REPLACE INTO gsc_query (date, query, clicks, impressions, position)
      SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4 FROM json_each(?) j`).bind(T(queries, (k) => [k[0], k[1]])),
    db.prepare(`INSERT OR REPLACE INTO gsc_page (date, page, clicks, impressions, position)
      SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4 FROM json_each(?) j`).bind(T(pages, (k) => [k[0], pathOf(k[1])])),
  ];
  if (withQp) {
    const qp = await searchRows(env, addDays(to, -27), to, ['query', 'page']);
    stmts.push(db.prepare('DELETE FROM gsc_qp28'),
      db.prepare(`INSERT OR REPLACE INTO gsc_qp28 (query, page, clicks, impressions, position)
        SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4 FROM json_each(?) j`).bind(T(qp, (k) => [k[0], pathOf(k[1])])));
  }
  await db.batch(stmts);
  return { days: days.length, queries: queries.length, pages: pages.length };
}

/* ---------------------------------------------------------------- 2. indexing (URL Inspection) */
async function sitemapPaths(env) {
  try {
    const r = await env.ASSETS.fetch(new Request(`${origin(env)}/_audit/report.json`));
    if (r.ok) { const j = await r.json(); if (j.paths?.length) return j.paths; }
  } catch { /* fall back to the sitemap */ }
  const idx = await (await env.ASSETS.fetch(new Request(`${origin(env)}/sitemap-index.xml`))).text();
  const out = [];
  for (const m of idx.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const x = await (await env.ASSETS.fetch(new Request(m[1]))).text();
    out.push(...[...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((mm) => new URL(mm[1]).pathname));
  }
  return out;
}

const FIELDS = ['verdict', 'coverage', 'indexing', 'robots', 'fetch', 'google_canonical'];
async function inspectOne(env, path) {
  const j = await gfetch(env, `${scBase(env)}/v1/urlInspection/index:inspect`, { inspectionUrl: origin(env) + path, siteUrl: site(env), languageCode: 'en-US' });
  const s = j.inspectionResult?.indexStatusResult || {};
  const rr = j.inspectionResult?.richResultsResult;
  return {
    verdict: s.verdict || null, coverage: s.coverageState || null, indexing: s.indexingState || null, robots: s.robotsTxtState || null,
    fetch: s.pageFetchState || null, last_crawl: s.lastCrawlTime || null, google_canonical: s.googleCanonical ? pathOf(s.googleCanonical) : null,
    user_canonical: s.userCanonical ? pathOf(s.userCanonical) : null, crawled_as: s.crawledAs || null,
    rich: rr?.verdict || null, rich_items: rr?.detectedItems ? rr.detectedItems.map((d) => d.richResultType).join(', ') : null,
  };
}

async function inspectBatch(env, budget) {
  const db = env.EV;
  const paths = await sitemapPaths(env);
  const { results } = await db.prepare('SELECT * FROM seo_inspect').all();
  const known = new Map(results.map((r) => [r.path, r]));
  const cutoff = Date.now() - 20 * 3600000;
  const due = paths.filter((p) => !known.has(p) || (known.get(p).checked_at || 0) < cutoff)
    .sort((a, b) => (known.get(a)?.checked_at || 0) - (known.get(b)?.checked_at || 0)).slice(0, budget);
  const stmts = [];
  let done = 0, failed = 0;
  for (let i = 0; i < due.length; i += 5) {
    const part = due.slice(i, i + 5);
    const res = await Promise.all(part.map((p) => inspectOne(env, p).then((v) => ({ p, v }), (e) => ({ p, e }))));
    for (const { p, v, e } of res) {
      const now = Date.now(), old = known.get(p);
      if (e) {
        failed++;
        if (/quota|rate/i.test(e.message)) throw e;
        stmts.push(db.prepare('INSERT INTO seo_inspect (path, error, checked_at) VALUES (?, ?, ?) ON CONFLICT (path) DO UPDATE SET error = excluded.error, checked_at = excluded.checked_at').bind(p, e.message.slice(0, 300), now));
        continue;
      }
      done++;
      const changed = old && old.verdict ? FIELDS.filter((f) => (old[f] || null) !== (v[f] || null)) : [];
      for (const f of changed) stmts.push(db.prepare('INSERT INTO seo_inspect_log (path, at, field, before, after) VALUES (?, ?, ?, ?, ?)').bind(p, now, f, old[f], v[f]));
      if (!old || !old.verdict) stmts.push(db.prepare('INSERT INTO seo_inspect_log (path, at, field, before, after) VALUES (?, ?, ?, ?, ?)').bind(p, now, 'first', null, v.coverage));
      stmts.push(db.prepare(`INSERT INTO seo_inspect (path, verdict, coverage, indexing, robots, fetch, last_crawl, google_canonical, user_canonical, crawled_as, rich, rich_items, error, checked_at, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?) ON CONFLICT (path) DO UPDATE SET verdict = excluded.verdict, coverage = excluded.coverage, indexing = excluded.indexing,
        robots = excluded.robots, fetch = excluded.fetch, last_crawl = excluded.last_crawl, google_canonical = excluded.google_canonical, user_canonical = excluded.user_canonical,
        crawled_as = excluded.crawled_as, rich = excluded.rich, rich_items = excluded.rich_items, error = NULL, checked_at = excluded.checked_at,
        changed_at = CASE WHEN excluded.changed_at IS NULL THEN seo_inspect.changed_at ELSE excluded.changed_at END`)
        .bind(p, v.verdict, v.coverage, v.indexing, v.robots, v.fetch, v.last_crawl, v.google_canonical, v.user_canonical, v.crawled_as, v.rich, v.rich_items, now, changed.length || !old?.verdict ? now : null));
    }
  }
  // Pages that left the sitemap: forget them (their history stays in the log).
  const gone = [...known.keys()].filter((p) => !paths.includes(p));
  if (gone.length) stmts.push(db.prepare('DELETE FROM seo_inspect WHERE path IN (SELECT value FROM json_each(?))').bind(JSON.stringify(gone)));
  if (stmts.length) await db.batch(stmts);
  return { done, failed, due: due.length, total: paths.length };
}

/* ---------------------------------------------------------------- 3. sitemaps */
async function pullSitemaps(env) {
  const j = await gfetch(env, `${gBase(env)}/webmasters/v3/sites/${encodeURIComponent(site(env))}/sitemaps`);
  const list = (j.sitemap || []).map((s) => ({ path: s.path, lastSubmitted: s.lastSubmitted, lastDownloaded: s.lastDownloaded, pending: !!s.isPending, errors: Number(s.errors) || 0, warnings: Number(s.warnings) || 0,
    submitted: (s.contents || []).reduce((n, c) => n + (Number(c.submitted) || 0), 0) }));
  await setState(env.EV, 'sitemaps', list);
  return list.length;
}

/* ---------------------------------------------------------------- 4. Bing */
// Bing often refuses requests from Cloudflare's shared Worker addresses ("ThrottleIP", or a bare 400). So there
// are two ways in: the worker tries itself (below), and a free daily GitHub Actions job (.github/workflows/bing.yml)
// calls Bing from GitHub's machines and posts the answers to POST /api/seo/bing-ingest (see bingIngest).
const bingDate = (s) => { const m = /\((\d+)/.exec(String(s)); return m ? etDay(Number(m[1])) : null; };
async function storeBing(env, qs, ps) {
  const T = (rows, keyFn) => JSON.stringify(rows.map((r) => [bingDate(r.Date), keyFn(r.Query), r.Clicks || 0, r.Impressions || 0, r.AvgImpressionPosition > 0 ? r.AvgImpressionPosition : 0]).filter((r) => r[0] && r[1]));
  await env.EV.batch([
    env.EV.prepare(`INSERT OR REPLACE INTO bing_query (date, query, clicks, impressions, position) SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4 FROM json_each(?) j`).bind(T(qs, (k) => String(k || '').toLowerCase())),
    env.EV.prepare(`INSERT OR REPLACE INTO bing_page (date, page, clicks, impressions, position) SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4 FROM json_each(?) j`).bind(T(ps, pathOf)),
  ]);
  return { queries: qs.length, pages: ps.length };
}
async function pullBing(env) {
  const bases = env.SEO_API_BASE ? [`${env.SEO_API_BASE}/bing`] : ['https://ssl.bing.com/webmaster/api.svc/json', 'https://www.bing.com/webmaster/api.svc/json', 'https://api.bing.com/webmaster/api.svc/json'];
  const q = async (m) => {
    const tried = [];
    for (const base of bases) {
      const r = await fetch(`${base}/${m}?siteUrl=${encodeURIComponent(origin(env) + '/')}&apikey=${encodeURIComponent(env.BING_API_KEY)}`, { headers: { accept: 'application/json', 'user-agent': 'MowItTall-SEO/1.0 (+https://mowittall.com)' } }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
      const body = await r.text().catch(() => '');
      let j = null; try { j = JSON.parse(body); } catch {}
      // Only a real answer counts: a JSON body with a "d" list. Anything else (HTML, empty, an error) is a miss.
      if (r.ok && j && !j.ErrorCode && Array.isArray(j.d)) return j.d;
      tried.push(`${new URL(base).host} ${r.status}${j?.Message ? ' ' + j.Message : body ? ' ' + body.replace(/\s+/g, ' ').slice(0, 80) : ''}`);
      // A wrong key or site is the same on every host, so stop; throttling/blocks (400/403/429/5xx) try the next host.
      if (r.status === 401 || /InvalidApiKey|NotAuthorized/i.test(body)) break;
    }
    throw new Error(`Bing ${m}: ${tried.join(' | ')}`);
  };
  const qs = await q('GetQueryStats');
  const ps = await q('GetPageStats');
  return storeBing(env, qs, ps);
}

// POST /api/seo/bing-ingest  (from the GitHub Actions job). Auth: header x-bing-key = the BING_API_KEY secret,
// so there's no extra secret to manage. Body: { queries: <GetQueryStats JSON>, pages: <GetPageStats JSON> }.
export async function bingIngest(env, req) {
  // Trim both sides: a pasted secret often carries a stray space or newline.
  const key = (req.headers.get('x-bing-key') || '').trim(), want = String(env.BING_API_KEY || '').trim();
  if (!want || !env.EV || key.length < 8 || key !== want) return json({ error: 'Not allowed.' }, 403);
  const b = await req.json().catch(() => null);
  const list = (x) => (Array.isArray(x) ? x : Array.isArray(x?.d) ? x.d : null);
  const qs = list(b?.queries), ps = list(b?.pages);
  if (!qs || !ps) return json({ error: 'Expected { queries, pages } from Bing.' }, 400);
  await seoInit(env.EV);
  const r = await storeBing(env, qs, ps);
  const runs = (await getState(env.EV, 'runs')) || {};
  runs.bing = runs['bing:ok'] = Date.now(); runs['bing:via'] = 'github';
  await setState(env.EV, 'runs', runs);
  const errs = (await getState(env.EV, 'errors')) || [];
  if (errs.some((e) => e.task === 'bing')) await setState(env.EV, 'errors', errs.filter((e) => e.task !== 'bing'));
  return json({ ok: true, ...r });
}

/* ---------------------------------------------------------------- 5. build-time audit → HQ */
const AGENTS = ['page', 'links', 'sitemap', 'share', 'aeo'];
const ikey = (i) => `${i.path}|${i.msg.replace(/\d+/g, '#')}`;
export async function syncAudit(env) {
  const r = await env.ASSETS.fetch(new Request(`${origin(env)}/_audit/report.json`));
  if (!r.ok) return { skipped: 'no report in this build' };
  const rep = await r.json();
  const kvGet = async (k) => { const x = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first(); return x ? JSON.parse(x.v) : null; };
  const kvSet = (k, v) => env.DB.prepare('INSERT INTO kv (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now());
  const seen = await kvGet('agent:build');
  if (seen === rep.build) return { skipped: 'already synced' };
  // A "broken" link that's really a short link (mowittall.com/water) only redirects.
  const { results: links } = await env.DB.prepare('SELECT slug FROM shortlinks').all();
  const slugs = new Set(links.map((l) => '/' + l.slug));
  const stmts = [];
  const summary = {};
  for (const name of AGENTS) {
    const a = rep.agents[name]; if (!a) continue;
    let issues = a.issues.map((i) => (i.code === 'missing' && slugs.has(i.path) ? { ...i, sev: 'warn', code: undefined, msg: i.msg.replace(/^Broken \(no such page\)\./, 'Short link (redirects).') + ' Point those links at the final page.' } : i));
    const prev = await kvGet(`agent:${name}`);
    const before = new Set((prev?.issues || []).map(ikey));
    const nowSet = new Set(issues.map(ikey));
    issues = issues.map((i) => (prev && !before.has(ikey(i)) ? { ...i, fresh: true } : i));
    const fixed = prev ? (prev.issues || []).filter((i) => !nowSet.has(ikey(i))).length : 0;
    let note = a.note || '';
    if (name === 'sitemap') {
      const prevPaths = (await kvGet('agent:sitemap-urls')) || [];
      if (prevPaths.length) {
        const added = rep.paths.filter((p) => !prevPaths.includes(p)), removed = prevPaths.filter((p) => !rep.paths.includes(p));
        added.forEach((p) => issues.push({ path: p, sev: 'info', msg: 'New in the sitemap since the last deploy', fresh: true }));
        removed.forEach((p) => issues.push({ path: p, sev: 'warn', msg: 'Removed from the sitemap since the last deploy (redirect it if it had traffic)', fresh: true }));
        note += ` ${added.length} added, ${removed.length} removed since the last deploy.`;
      }
      stmts.push(kvSet('agent:sitemap-urls', rep.paths));
    }
    const out = { checked: a.checked, issues: issues.slice(0, 1500), note: note.trim(), at: rep.at, build: rep.build, auto: true, newCount: issues.filter((i) => i.fresh).length, fixed };
    stmts.push(kvSet(`agent:${name}`, out));
    summary[name] = { errors: issues.filter((i) => i.sev === 'error').length, warnings: issues.filter((i) => i.sev === 'warn').length, fresh: out.newCount, fixed };
  }
  stmts.push(kvSet('agent:build', rep.build));
  await env.DB.batch(stmts);
  return { synced: rep.build, summary };
}

/* ---------------------------------------------------------------- 6. PageSpeed (mobile, top 5 pages) */
const SPEED_FIXED = ['/', '/plan/', '/weeds/', '/measure/'];
const SPEED_EVERY = 7 * DAY;
export async function speedPages(db) {
  const top = await db.prepare(`SELECT page FROM gsc_page WHERE page LIKE '/blog/%' AND page NOT LIKE '/blog/topic/%' AND page != '/blog/' AND date > ?
    GROUP BY page ORDER BY SUM(clicks) DESC, SUM(impressions) DESC LIMIT 1`).bind(addDays(etDay(), -28)).first().catch(() => null);
  return [...SPEED_FIXED, ...(top?.page ? [top.page.split('?')[0]] : [])];
}
async function speedOne(env, path) {
  const q = new URLSearchParams({ url: origin(env) + path, strategy: 'mobile', category: 'performance' });
  if (env.PSI_API_KEY) q.set('key', env.PSI_API_KEY);
  // No `fields` filter: Google rejected the old one ("Request contains an invalid argument"). The full report is a few MB,
  // read once and thrown away; only the numbers below are kept.
  const base = env.SEO_API_BASE || 'https://www.googleapis.com';
  const r = await fetch(`${base}/pagespeedonline/v5/runPagespeed?${q}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || r.status;
    if (r.status === 429 || /quota/i.test(String(msg))) throw Object.assign(new Error(env.PSI_API_KEY ? `PageSpeed daily quota used up for your key (${msg}).` : `PageSpeed quota hit (${msg}). Add a free PSI_API_KEY secret to fix it.`), { quota: true });
    throw new Error(`PageSpeed ${r.status}: ${msg}`);
  }
  const lh = j.lighthouseResult || {}, a = lh.audits || {}, v = (k) => a[k]?.numericValue ?? null;
  return { score: lh.categories?.performance?.score != null ? Math.round(lh.categories.performance.score * 100) : null,
    lcp: v('largest-contentful-paint'), cls: v('cumulative-layout-shift'), tbt: v('total-blocking-time'), fcp: v('first-contentful-paint'), field: j.loadingExperience?.overall_category || null };
}
async function speedTick(env) {
  const db = env.EV;
  const pages = await speedPages(db);
  const { results } = await db.prepare('SELECT path, checked_at FROM seo_speed').all();
  const at = Object.fromEntries(results.map((x) => [x.path, x.checked_at || 0]));
  const next = pages.filter((p) => Date.now() - (at[p] || 0) > SPEED_EVERY).sort((x, y) => (at[x] || 0) - (at[y] || 0))[0];
  if (!next) return { skipped: 'all fresh' };
  const now = Date.now();
  try {
    const m = await speedOne(env, next);
    await db.batch([
      db.prepare(`INSERT INTO seo_speed (path, score, lcp, cls, tbt, fcp, field, error, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON CONFLICT (path) DO UPDATE SET score = excluded.score, lcp = excluded.lcp, cls = excluded.cls, tbt = excluded.tbt, fcp = excluded.fcp, field = excluded.field, error = NULL, checked_at = excluded.checked_at`)
        .bind(next, m.score, m.lcp, m.cls, m.tbt, m.fcp, m.field, now),
      db.prepare('INSERT OR REPLACE INTO seo_speed_log (path, at, score, lcp, cls, tbt) VALUES (?, ?, ?, ?, ?, ?)').bind(next, now, m.score, m.lcp, m.cls, m.tbt),
    ]);
    return { path: next, ...m };
  } catch (e) {
    // Remember the failure on the page (so HQ shows it) but retry next hour: checked_at stays as it was.
    await db.prepare(`INSERT INTO seo_speed (path, error, checked_at) VALUES (?, ?, ?) ON CONFLICT (path) DO UPDATE SET error = excluded.error`).bind(next, String(e.message || e).slice(0, 300), at[next] || 0).run();
    throw e;
  }
}

/* ---------------------------------------------------------------- the hourly job */
export async function seoTick(env, { force = false } = {}) {
  if (!env.EV) return { skipped: 'no EV database' };
  await seoInit(env.EV);
  const db = env.EV;
  const runs = (await getState(db, 'runs')) || {};
  const due = (k, hours) => force || !runs[k] || Date.now() - runs[k] > hours * 3600000;
  const did = {};
  const step = async (k, fn) => {
    try {
      did[k] = await fn(); runs[k] = Date.now(); runs[`${k}:ok`] = Date.now();
      const errs = (await getState(db, 'errors')) || [];
      if (errs.some((e) => e.task === k)) await setState(db, 'errors', errs.filter((e) => e.task !== k));
    }
    // A failed step tries again next hour (runs[k] only moves on success).
    catch (e) { did[k] = { error: String(e.message || e) }; runs[`${k}:fail`] = Date.now(); await logError(db, k, e); }
  };
  await step('audit', () => syncAudit(env));
  if (serviceAccount(env)) {
    let budget = 30;
    const today = etDay();
    if (due('search', 20)) { await step('search', () => pullSearch(env, addDays(today, -5), addDays(today, -1), true)); budget -= 5; }
    else {
      const bf = (await getState(db, 'backfill')) || { until: addDays(today, -6) };
      const floor = addDays(today, -BACKFILL_DAYS);
      if (!bf.done) {
        const to = bf.until, from = addDays(to, -(CHUNK_DAYS - 1)) < floor ? floor : addDays(to, -(CHUNK_DAYS - 1));
        await step('backfill', async () => {
          const r = await pullSearch(env, from, to, false);
          const next = addDays(from, -1);
          // Stop at Google's limit, or after two empty chunks in a row (the site didn't exist yet).
          const empty = r.days === 0 ? (bf.empty || 0) + 1 : 0;
          await setState(db, 'backfill', { until: next, empty, done: next < floor || empty >= 2, from });
          return { from, to, ...r };
        });
        budget -= 4;
      }
    }
    if (due('sitemaps', 20)) { await step('sitemaps', () => pullSitemaps(env)); budget -= 1; }
    await step('inspect', () => inspectBatch(env, Math.min(INSPECT_PER_RUN, Math.max(budget - 2, 0))));
  }
  // Google's PageSpeed quota resets at midnight Pacific; after a quota error, wait for that instead of failing every hour.
  if (due('speed', 1) && (force || !(runs['speed:wait'] > Date.now()))) {
    let quota = false;
    await step('speed', () => speedTick(env).catch((e) => { quota = !!e.quota; throw e; }));
    if (quota) { const d = new Date(); d.setUTCHours(8, 30, 0, 0); if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1); runs['speed:wait'] = d.getTime(); }
    else if (!did.speed?.error) delete runs['speed:wait'];
  }
  // Once the GitHub job is delivering Bing data, the worker only steps in if that job has missed a day.
  // "Check now" doesn't force it while GitHub is delivering: Cloudflare's route is blocked by Bing anyway.
  const bingFresh = runs['bing:via'] === 'github' && Date.now() - (runs.bing || 0) < 30 * 3600000;
  if (env.BING_API_KEY && !(force && bingFresh) && due('bing', runs['bing:via'] === 'github' ? 30 : 20)) await step('bing', async () => { const r = await pullBing(env); runs['bing:via'] = 'worker'; return r; });
  await setState(db, 'runs', runs);
  return did;
}

/* ---------------------------------------------------------------- HQ API */
const wpos = (rows) => { const i = rows.reduce((s, r) => s + r.impressions, 0); return i ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / i : 0; };
async function snapshot(db, table, keyCol, from, to) {
  const { results } = await db.prepare(`SELECT ${keyCol} k, SUM(clicks) c, SUM(impressions) i, SUM(position * impressions) pw FROM ${table} WHERE date BETWEEN ? AND ? GROUP BY ${keyCol} ORDER BY i DESC LIMIT 5000`).bind(from, to).all();
  return results.map((r) => ({ k: r.k, c: r.c, i: r.i, ctr: r.i ? r.c / r.i : 0, p: r.i ? r.pw / r.i : 0 }));
}
const fmt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// GET /api/admin/seo?days=7
export async function seoReport(env, url) {
  if (!env.EV) return json({ ready: false });
  await seoInit(env.EV);
  const db = env.EV;
  const sa = serviceAccount(env);
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 7, 1), 90);
  const [runs, errors, backfill, sitemaps] = await Promise.all(['runs', 'errors', 'backfill', 'sitemaps'].map((k) => getState(db, k)));
  const status = { google: !!sa, account: sa?.client_email || null, site: site(env), bing: !!env.BING_API_KEY, runs: runs || {}, errors: errors || [], backfill, sitemaps: sitemaps || [] };

  const out = { ready: true, status, days };
  const span = await db.prepare('SELECT MIN(date) a, MAX(date) b FROM gsc_days').first();
  if (span?.b) {
    const cur = { from: addDays(span.b, -(days - 1)), to: span.b }, prev = { from: addDays(cur.from, -days), to: addDays(cur.from, -1) };
    const tot = async (r) => { const { results } = await db.prepare('SELECT clicks, impressions, position FROM gsc_days WHERE date BETWEEN ? AND ?').bind(r.from, r.to).all();
      const c = results.reduce((s, x) => s + x.clicks, 0), i = results.reduce((s, x) => s + x.impressions, 0);
      return { clicks: c, impressions: i, ctr: i ? c / i : 0, position: wpos(results), days: results.length }; };
    const label = (r) => `${fmt(r.from)} – ${fmt(r.to)}`;
    const [tc, tp, daily, qa, qb, pa, pb] = await Promise.all([
      tot(cur), tot(prev),
      db.prepare('SELECT date, clicks, impressions, position FROM gsc_days WHERE date > ? ORDER BY date').bind(addDays(span.b, -90)).all().then((r) => r.results),
      snapshot(db, 'gsc_query', 'query', cur.from, cur.to), snapshot(db, 'gsc_query', 'query', prev.from, prev.to),
      snapshot(db, 'gsc_page', 'page', cur.from, cur.to), snapshot(db, 'gsc_page', 'page', prev.from, prev.to),
    ]);
    const { results: qp } = await db.prepare('SELECT query, page, clicks, impressions, position FROM gsc_qp28 ORDER BY impressions DESC LIMIT 2000').all();
    out.google = { firstDay: span.a, lastDay: span.b, cur, prev, totals: tc, prevTotals: tp, daily,
      snaps: { queries: { a: { label: label(cur), rows: qa }, b: qb.length ? { label: label(prev), rows: qb } : null }, pages: { a: { label: label(cur), rows: pa }, b: pb.length ? { label: label(prev), rows: pb } : null } },
      qp };
  }
  const bspan = await db.prepare('SELECT MAX(date) b FROM bing_query').first();
  if (bspan?.b) {
    // Bing's numbers come in weekly-ish buckets, so compare the last 4 weeks with the 4 before.
    const cur = { from: addDays(bspan.b, -27), to: bspan.b }, prev = { from: addDays(bspan.b, -55), to: addDays(bspan.b, -28) };
    const [qa, qb, pa, pb] = await Promise.all([snapshot(db, 'bing_query', 'query', cur.from, cur.to), snapshot(db, 'bing_query', 'query', prev.from, prev.to), snapshot(db, 'bing_page', 'page', cur.from, cur.to), snapshot(db, 'bing_page', 'page', prev.from, prev.to)]);
    const label = (r) => `${fmt(r.from)} – ${fmt(r.to)}`;
    out.bing = { lastDay: bspan.b, snaps: { queries: { a: { label: label(cur), rows: qa }, b: qb.length ? { label: label(prev), rows: qb } : null }, pages: { a: { label: label(cur), rows: pa }, b: pb.length ? { label: label(prev), rows: pb } : null } } };
  }
  const { results: pages } = await db.prepare('SELECT * FROM seo_inspect ORDER BY path').all();
  const { results: log } = await db.prepare('SELECT * FROM seo_inspect_log WHERE at > ? ORDER BY at DESC LIMIT 200').bind(Date.now() - 30 * DAY).all();
  let total = 0; try { total = (await sitemapPaths(env)).length; } catch { /* ignore */ }
  out.index = { total, pages, log };
  const speedList = await speedPages(db);
  const { results: speedRows } = await db.prepare('SELECT * FROM seo_speed').all();
  const { results: speedHist } = await db.prepare('SELECT path, at, score FROM seo_speed_log WHERE at > ? ORDER BY at').bind(Date.now() - 120 * DAY).all();
  out.speed = { pages: speedList.map((p) => ({ path: p, ...(speedRows.find((x) => x.path === p) || {}), hist: speedHist.filter((h) => h.path === p).map((h) => h.score) })), keyed: !!env.PSI_API_KEY };
  return json(out);
}
