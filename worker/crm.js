// Mow It Tall CRM: email sign-ups, the drip scheduler, open/click tracking, unsubscribes, inbound replies,
// bounce/complaint events and A/B tests (Nov 17 2026). Own D1 database (binding CRM, "mowittall-crm").
//
// Public routes:  POST /api/crm/subscribe · POST /api/crm/update · GET /api/m/o/<send>.gif (open)
//                 GET /api/m/c/<send>/<n> (click) · GET/POST /api/m/u (unsubscribe page + one-click)
// HQ routes:      /api/admin/crm/* (admin key checked in index.js)
// Also:           email() inbound replies (Email Routing → this worker), queue() delivery events,
//                 dripTick() from the hourly cron.
// Sending is OFF until Mike turns it on in HQ → Email (Off / Test contacts only / Live).
import PostalMime from 'postal-mime';
import { nextFor, build, testFor, TESTS, nameOf, baseKey, WELCOME } from './drip.js';
import { render, sendMail, SITE } from './mailer.js';
import { LEVEL_NAMES, buildPlan } from '../src/data/gamePlan.js';

const DAY = 86400000;
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const bad = (m, s = 400) => json({ error: m }, s);
const rid = (n = 14) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, zip TEXT,
    answers TEXT, level INTEGER, sqft INTEGER, measured INTEGER DEFAULT 0, grass TEXT, status TEXT DEFAULT 'active', pref TEXT DEFAULT 'all',
    token TEXT UNIQUE, source TEXT, utm TEXT, device TEXT, iph TEXT, is_test INTEGER DEFAULT 0, created INTEGER, updated INTEGER,
    last_eval TEXT, last_sent INTEGER, sent_n INTEGER DEFAULT 0, opens INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, last_open INTEGER,
    last_click INTEGER, unsub_at INTEGER, unsub_reason TEXT, pref_at INTEGER, replied_at INTEGER, note TEXT)`,
  'CREATE INDEX IF NOT EXISTS contacts_status ON contacts(status, last_eval)',
  `CREATE TABLE IF NOT EXISTS sends (id TEXT PRIMARY KEY, contact_id INTEGER, key TEXT, kind TEXT, test TEXT, variant TEXT, subject TEXT,
    links TEXT, mode TEXT, status TEXT, error TEXT, message_id TEXT, sent_at INTEGER, delivered_at INTEGER, opened_at INTEGER,
    opens INTEGER DEFAULT 0, clicked_at INTEGER, clicks INTEGER DEFAULT 0, unsub_at INTEGER)`,
  "CREATE UNIQUE INDEX IF NOT EXISTS sends_once ON sends(contact_id, key) WHERE mode = 'live'",
  'CREATE INDEX IF NOT EXISTS sends_at ON sends(sent_at)',
  'CREATE INDEX IF NOT EXISTS sends_msg ON sends(message_id)',
  'CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, send_id TEXT, n INTEGER, url TEXT, at INTEGER, bot INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS clicks_send ON clicks(send_id)',
  `CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER, dir TEXT, from_addr TEXT, from_name TEXT,
    to_addr TEXT, subject TEXT, text TEXT, html TEXT, message_id TEXT, in_reply_to TEXT, at INTEGER, read INTEGER DEFAULT 0, auto INTEGER DEFAULT 0)`,
  'CREATE INDEX IF NOT EXISTS msgs_at ON msgs(at)',
  'CREATE TABLE IF NOT EXISTS tests (id TEXT PRIMARY KEY, winner TEXT, status TEXT, at INTEGER)',
  'CREATE TABLE IF NOT EXISTS crm_kv (k TEXT PRIMARY KEY, v TEXT, at INTEGER)',
  'CREATE TABLE IF NOT EXISTS crm_events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, message_id TEXT, detail TEXT, at INTEGER)',
  // Sign-in: magic links (no passwords). logins = one-time codes (30 min), sessions = "remember me" on a device.
  'CREATE TABLE IF NOT EXISTS logins (code TEXT PRIMARY KEY, contact_id INTEGER, iph TEXT, created INTEGER, used INTEGER)',
  'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, contact_id INTEGER, created INTEGER, last INTEGER, device TEXT)',
  'CREATE INDEX IF NOT EXISTS sessions_contact ON sessions(contact_id)',
  // Nov 17 (funnel build): every device a person uses (the same `mit-device` id the event log uses, so their
  // site visits before and after signing up show in HQ), and a log of what they do (sign-up, profile answers,
  // sign-ins, visits, email settings).
  'CREATE TABLE IF NOT EXISTS contact_devices (contact_id INTEGER, device TEXT, first_at INTEGER, last_at INTEGER, visits INTEGER DEFAULT 0, PRIMARY KEY (contact_id, device))',
  'CREATE INDEX IF NOT EXISTS cd_device ON contact_devices(device)',
  'CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER, type TEXT, detail TEXT, at INTEGER)',
  'CREATE INDEX IF NOT EXISTS activity_contact ON activity(contact_id, at)',
  'CREATE INDEX IF NOT EXISTS activity_type ON activity(type, at)',
];
const DEVICE_RE = /^[a-z0-9-]{8,40}$/i;
// Statements to batch: log something a person did / remember a device of theirs.
const logAct = (env, cid, type, detail = '') => env.CRM.prepare('INSERT INTO activity (contact_id, type, detail, at) VALUES (?, ?, ?, ?)').bind(cid, type, String(detail ?? '').slice(0, 300), Date.now());
const linkDev = (env, cid, d) => (DEVICE_RE.test(String(d || ''))
  ? env.CRM.prepare('INSERT INTO contact_devices (contact_id, device, first_at, last_at, visits) VALUES (?, ?, ?, ?, 0) ON CONFLICT (contact_id, device) DO UPDATE SET last_at = excluded.last_at').bind(cid, String(d), Date.now(), Date.now())
  : null);
const forget = (env, id) => [
  env.CRM.prepare('DELETE FROM clicks WHERE send_id IN (SELECT id FROM sends WHERE contact_id = ?)').bind(id), env.CRM.prepare('DELETE FROM sends WHERE contact_id = ?').bind(id),
  env.CRM.prepare('DELETE FROM msgs WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM sessions WHERE contact_id = ?').bind(id),
  env.CRM.prepare('DELETE FROM logins WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM contact_devices WHERE contact_id = ?').bind(id),
  env.CRM.prepare('DELETE FROM activity WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM contacts WHERE id = ?').bind(id),
];
let ready = false;
export async function crmInit(env) {
  if (ready || !env.CRM) return !!env.CRM;
  await env.CRM.batch(SCHEMA.map((s) => env.CRM.prepare(s)));
  ready = true;
  return true;
}

/* ------------------------------------------------------------------ settings */
const DEFAULTS = { mode: 'off', test_to: '', from_name: 'Mike from Mow It Tall', from_addr: 'mike@mowittall.com', forward_to: '', auto_winner: '1', min_arm: '200' };
// The drip clock (Nov 17): sign-ups that come in while sending is off don't lose their welcome series.
// A person's emails count days from the later of their sign-up and the day sending first went Live.
// Before that (Off/Test), previews treat everyone as starting today. Test contacts (Mike) use their sign-up date.
let liveSince = 0;
async function settings(env) {
  const { results } = await env.CRM.prepare('SELECT k, v FROM crm_kv').all();
  const s = { ...DEFAULTS };
  for (const r of results) if (r.k in DEFAULTS) s[r.k] = r.v;
  liveSince = Number((results.find((r) => r.k === 'live_since') || {}).v) || 0;
  s.live_since = liveSince;
  return s;
}
const clockOf = (r) => (r.is_test ? r.created : Math.max(r.created || 0, liveSince || Date.now()));
const setKv = (env, k, v) => env.CRM.prepare('INSERT INTO crm_kv (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, String(v), Date.now()).run();

/* ------------------------------------------------------------------ time (Eastern) */
function et(ts = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour };
}
// "Today" as a Date at noon (worker-local = UTC), standing for the Eastern calendar date.
const etToday = (ts = Date.now()) => { const e = et(ts); return new Date(e.y, e.m - 1, e.d, 12); };
const ymd = (d) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ content library */
let LIB = null, libAt = 0;
async function lib(env) {
  if (LIB && Date.now() - libAt < 10 * 60000) return LIB;
  try {
    const r = await env.ASSETS.fetch(new Request(`${SITE}/crm/library.json`));
    if (r.ok) { LIB = (await r.json()).items || []; libAt = Date.now(); }
  } catch { /* keep the old copy */ }
  return LIB || [];
}

const contactOf = (r) => {
  let answers = {}; try { answers = JSON.parse(r.answers || '{}'); } catch { /* */ }
  return { id: r.id, email: r.email, name: r.name || '', created: clockOf(r), answers, sqft: r.sqft || 0, measured: !!r.measured, pref: r.pref || 'all', token: r.token, level: r.level, is_test: r.is_test };
};
async function sentMap(env, cid) {
  const { results } = await env.CRM.prepare("SELECT key, sent_at FROM sends WHERE contact_id = ? AND mode = 'live' AND status NOT IN ('failed', 'queued')").bind(cid).all();
  return new Map(results.map((r) => [r.key, r.sent_at]));
}

/* ------------------------------------------------------------------ A/B */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
async function testRows(env) {
  const { results } = await env.CRM.prepare('SELECT id, winner, status FROM tests').all();
  return Object.fromEntries(results.map((r) => [r.id, r]));
}
function variantFor(test, cid, rows) {
  if (!test) return '';
  const r = rows[test];
  if (r?.winner) return r.winner;
  if (r?.status === 'off') return 'a';
  return hash(`${test}:${cid}`) % 2 ? 'b' : 'a'; // sticky per person, so one person always sees one style
}
// Two-proportion z-test. Returns { p, z } (two-sided).
function ztest(x1, n1, x2, n2) {
  if (!n1 || !n2) return { p: 1, z: 0 };
  const p1 = x1 / n1, p2 = x2 / n2, pp = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
  if (!se) return { p: 1, z: 0 };
  const z = (p2 - p1) / se;
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return { p: Math.max(0, 1 - erf), z };
}

/* ------------------------------------------------------------------ sending */
class StopSending extends Error {}
// Sends one drip email to one contact. mode 'live' (counts, once per key) or 'preview' (HQ test sends).
async function sendOne(env, c, key, { today = etToday(), libItems, s, tests, to, mode = 'live', prefix = '' } = {}) {
  s = s || await settings(env);
  libItems = libItems || await lib(env);
  tests = tests || await testRows(env);
  const email = build(key, c, today, libItems);
  const id = rid(14), at = Date.now();
  const test = mode === 'live' ? testFor(key) : '';
  const variant = mode === 'live' ? variantFor(test, c.id, tests) : (to?.variant || 'a');
  if (!email) {
    if (mode === 'live') await env.CRM.prepare("INSERT OR IGNORE INTO sends (id, contact_id, key, kind, mode, status, sent_at) VALUES (?, ?, ?, ?, 'live', 'skipped', ?)").bind(id, c.id, key, key.split(':')[0], at).run();
    return { ok: false, skipped: true };
  }
  const subject = prefix + (email.subjects[variant] || email.subjects.a);
  const r0 = render({ ...email, subject }, { sendId: mode === 'live' ? id : '', key, variant, token: c.token, pref: c.pref });
  if (mode === 'live') {
    const ins = await env.CRM.prepare("INSERT OR IGNORE INTO sends (id, contact_id, key, kind, test, variant, subject, links, mode, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live', 'queued', ?)")
      .bind(id, c.id, key, key.startsWith('job:') || key.startsWith('prep:') ? 'job' : key.startsWith('lib:') ? 'content' : key.startsWith('month:') ? 'month' : 'welcome', test, variant, subject, JSON.stringify(r0.links), at).run();
    if (!ins.meta.changes) return { ok: false, dupe: true };
  }
  const r = await sendMail(env, { to: to?.email || c.email, from: { email: s.from_addr, name: s.from_name }, subject, html: r0.html, text: r0.text, unsub: mode === 'live' ? r0.unsub : '',
    headers: { 'X-MIT-Send': id, 'List-Id': 'Mow It Tall lawn emails <lawn.mowittall.com>' } });
  if (mode !== 'live') return r;
  if (r.ok) {
    await env.CRM.batch([
      env.CRM.prepare("UPDATE sends SET status = 'sent', message_id = ? WHERE id = ?").bind(r.messageId, id),
      env.CRM.prepare('UPDATE contacts SET last_sent = ?, sent_n = sent_n + 1 WHERE id = ?').bind(at, c.id),
    ]);
    return { ok: true, id };
  }
  if (['E_DAILY_LIMIT_EXCEEDED', 'E_RATE_LIMIT_EXCEEDED', 'E_NO_BINDING', 'E_SENDER_NOT_VERIFIED', 'E_SENDER_DOMAIN_NOT_AVAILABLE', 'E_ACCOUNT_SUSPENDED', 'E_INTERNAL_SERVER_ERROR'].includes(r.code)) {
    await env.CRM.prepare('DELETE FROM sends WHERE id = ?').bind(id).run(); // try again later
    await setKv(env, 'last_error', JSON.stringify({ code: r.code, error: r.error, at }));
    throw new StopSending(r.code);
  }
  await env.CRM.prepare("UPDATE sends SET status = 'failed', error = ? WHERE id = ?").bind(`${r.code}: ${r.error}`, id).run();
  if (r.code === 'E_RECIPIENT_SUPPRESSED' || r.code === 'E_RECIPIENT_NOT_ALLOWED') await env.CRM.prepare("UPDATE contacts SET status = 'bounced', updated = ? WHERE id = ?").bind(at, c.id).run();
  return r;
}

// Hourly from the cron. Sends between 8am and 7pm Eastern; each contact is checked once a day.
export async function dripTick(env, ts = Date.now()) {
  if (!(await crmInit(env))) return;
  const s = await settings(env);
  if (s.mode === 'off') return;
  const e = et(ts);
  if (e.h < 8 || e.h > 19) return;
  const today = etToday(ts), key = ymd(today);
  const [libItems, tests] = [await lib(env), await testRows(env)];
  if (e.h === 9) await autoWinners(env, s).catch(() => {});
  const { results } = await env.CRM.prepare(`SELECT * FROM contacts WHERE status = 'active' AND (last_eval IS NULL OR last_eval != ?) ${s.mode === 'test' ? 'AND is_test = 1' : ''} ORDER BY id LIMIT 120`).bind(key).all();
  for (const row of results) {
    const c = contactOf(row);
    try {
      const nx = nextFor(c, await sentMap(env, c.id), today, libItems);
      if (nx) await sendOne(env, c, nx.key, { today, libItems, s, tests });
      await env.CRM.prepare('UPDATE contacts SET last_eval = ? WHERE id = ?').bind(key, c.id).run();
    } catch (err) {
      if (err instanceof StopSending) return; // the provider said stop: pick up next hour
      console.log('drip', c.id, err?.message);
    }
  }
}

async function autoWinners(env, s) {
  if (s.auto_winner !== '1') return;
  const rows = await testRows(env);
  for (const t of await testStats(env, rows, Number(s.min_arm) || 200)) {
    if (!rows[t.id]?.winner && t.verdict === 'winner' && t.ready) {
      await env.CRM.prepare('INSERT INTO tests (id, winner, status, at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET winner = excluded.winner, status = excluded.status, at = excluded.at').bind(t.id, t.winner, 'auto', Date.now()).run();
    }
  }
}

/* ------------------------------------------------------------------ public routes */
const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));
const BOT_UA = /bot|crawl|spider|preview|scanner|safelinks|barracuda|proofpoint|mimecast|symantec|cisco|fireeye|trend ?micro|headless|python|curl|wget|go-http/i;

export async function crmPublic(req, env, ctx, url) {
  if (!(await crmInit(env))) return bad('Email isn’t set up yet.', 503);
  const p = url.pathname, now = Date.now();
  if (p === '/api/crm/subscribe' && req.method === 'POST') return subscribe(req, env, ctx);
  if (p === '/api/crm/update' && req.method === 'POST') return profileUpdate(req, env);
  if (p === '/api/crm/login' && req.method === 'POST') return login(req, env, ctx);
  if (p === '/api/crm/session' && req.method === 'POST') return session(req, env);
  if (p === '/api/crm/me') return me(req, env);
  if (p === '/api/crm/hello' && req.method === 'POST') return hello(req, env);
  let m = p.match(/^\/api\/m\/o\/([a-z0-9]{8,20})\.gif$/);
  if (m) {
    ctx.waitUntil((async () => {
      const r = await env.CRM.prepare('UPDATE sends SET opens = opens + 1, opened_at = COALESCE(opened_at, ?) WHERE id = ? RETURNING contact_id').bind(now, m[1]).first();
      if (r) await env.CRM.prepare('UPDATE contacts SET opens = opens + 1, last_open = ? WHERE id = ?').bind(now, r.contact_id).run();
    })().catch(() => {}));
    return new Response(GIF, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, max-age=0' } });
  }
  m = p.match(/^\/api\/m\/c\/([a-z0-9]{8,20})\/(\d{1,3})$/);
  if (m) {
    const row = await env.CRM.prepare('SELECT s.contact_id, s.links, s.sent_at, c.token FROM sends s LEFT JOIN contacts c ON c.id = s.contact_id WHERE s.id = ?').bind(m[1]).first();
    let target = SITE + '/';
    try { const L = JSON.parse(row?.links || '[]'); if (L[Number(m[2])]) target = L[Number(m[2])]; } catch { /* */ }
    if (!target.startsWith('https://')) target = SITE + '/';
    // Site links carry the subscriber's token so tools there save to their lawn profile (Base.astro strips it).
    if (row?.token && target.startsWith(SITE)) { const u = new URL(target); u.searchParams.set('mt', row.token); target = u.toString(); }
    if (row) {
      const ua = req.headers.get('user-agent') || '';
      const bot = BOT_UA.test(ua) || (now - row.sent_at < 8000) ? 1 : 0; // security scanners click within seconds
      ctx.waitUntil((async () => {
        await env.CRM.prepare('INSERT INTO clicks (send_id, n, url, at, bot) VALUES (?, ?, ?, ?, ?)').bind(m[1], Number(m[2]), target.slice(0, 500), now, bot).run();
        if (!bot) await env.CRM.batch([
          env.CRM.prepare('UPDATE sends SET clicks = clicks + 1, clicked_at = COALESCE(clicked_at, ?), opened_at = COALESCE(opened_at, ?) WHERE id = ?').bind(now, now, m[1]),
          env.CRM.prepare('UPDATE contacts SET clicks = clicks + 1, last_click = ? WHERE id = ?').bind(now, row.contact_id),
        ]);
      })().catch(() => {}));
    }
    return Response.redirect(target, 302);
  }
  if (p === '/api/m/u') return unsubscribe(req, env, url);
  return bad('Not found.', 404);
}

// Lawn profile answers saved from the site (measure tool, grass picker, soil translator, seed tracker, one-tap
// email questions via /saved/). Whitelisted fields and values only.
const PROFILE = {
  sqft: (v) => { const n = Math.round(Number(v)); return n >= 100 && n <= 2_000_000 ? n : null; },
  grass: (v) => (['kbg-rye', 'rye', 'tttf', 'sunshade', 'shade', 'deep'].includes(v) ? v : null),
  sun: (v) => (['full', 'part', 'mixed', 'shade'].includes(v) ? v : null),
  uses: (v) => (['kids', 'dogs', 'both', 'adults', 'looks'].includes(v) ? v : null),
  water: (v) => (['auto', 'hose', 'never'].includes(v) ? v : null),
  ph: (v) => { const n = Math.round(Number(v) * 10) / 10; return n >= 3.5 && n <= 9.5 ? n : null; },
  seeded: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) && Math.abs(Date.now() - Date.parse(v)) < 400 * DAY ? v : null),
  know: (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null; },
  effort: (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null; },
  mower: (v) => (['me', 'crew', 'kid', 'robot'].includes(v) ? v : null),
  spreader: (v) => (['yes', 'no'].includes(v) ? v : null),
};
// Quiz answers (taken or retaken after signing up) merge into the profile; the rest of the profile stays.
const QUIZ = {
  zip: (v) => (/^\d{5}$/.test(String(v)) ? String(v) : null),
  look: (v) => (['good', 'street', 'patchy', 'weedy', 'dirt'].includes(v) ? v : null),
  effort: PROFILE_NUM03, know: PROFILE_NUM03,
  problems: (v) => (Array.isArray(v) ? v.filter((x) => ['weeds', 'crabgrass', 'bare', 'brown', 'grubs', 'neighbor'].includes(x)).slice(0, 6) : null),
  height: (v) => (['unknown', 'low', 'mid', 'high'].includes(v) ? v : null),
  mower: (v) => (['me', 'crew', 'kid', 'robot'].includes(v) ? v : null),
};
function PROFILE_NUM03(v) { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null; }
async function quizUpdate(env, t, a) {
  const row = await env.CRM.prepare('SELECT id, answers, sqft FROM contacts WHERE token = ?').bind(t).first();
  if (!row) return bad('Not found.', 404);
  let ans = {}; try { ans = JSON.parse(row.answers || '{}'); } catch { /* */ }
  for (const [k, check] of Object.entries(QUIZ)) { const v = check(a[k]); if (v !== null && v !== undefined) ans[k] = v; }
  ans.quiz_at = Date.now();
  const plan = buildPlan(ans, { sqft: row.sqft || 0 });
  await env.CRM.batch([
    env.CRM.prepare('UPDATE contacts SET answers = ?, level = ?, zip = COALESCE(?, zip), updated = ? WHERE id = ?').bind(JSON.stringify(ans), plan.level, ans.zip || null, Date.now(), row.id),
    logAct(env, row.id, 'quiz', `${LEVEL_NAMES[plan.level]}${ans.mower ? ` · ${ans.mower}` : ''}`),
  ]);
  return json({ ok: true, saved: true });
}
async function profileUpdate(req, env) {
  const b = await req.json().catch(() => ({}));
  let t = clean(b.t, 40);
  let f = clean(b.f, 12), v = b.v;
  if (!t && b.s) { const r = await env.CRM.prepare('SELECT c.token FROM sessions s JOIN contacts c ON c.id = s.contact_id WHERE s.token = ?').bind(clean(b.s, 40)).first(); t = r?.token || ''; }
  if (t && b.answers && typeof b.answers === 'object') return quizUpdate(env, t, b.answers);
  if (!f && b.sqft) { f = 'sqft'; v = b.sqft; } // older measure-tool format
  const check = PROFILE[f];
  const val = check ? check(typeof v === 'string' ? clean(v, 20) : v) : null;
  if (!t || val === null) return bad('Bad request.');
  const now = Date.now();
  const extra = f === 'sqft' ? ', sqft = ?, measured = 1' : f === 'grass' ? ', grass = ?' : '';
  const args = [f, JSON.stringify(val), now, now];
  if (extra) args.push(val);
  args.push(t);
  const r = await env.CRM.prepare(`UPDATE contacts SET answers = json_set(json_set(COALESCE(answers, '{}'), '$.' || ?, json(?)), '$.profile_at', ?), updated = ?${extra} WHERE token = ?`).bind(...args).run();
  // Effort or who mows changed: that's a track change. Recompute the level the emails use.
  if (r.meta.changes && (f === 'effort' || f === 'mower')) {
    const row = await env.CRM.prepare('SELECT answers FROM contacts WHERE token = ?').bind(t).first();
    let a = {}; try { a = JSON.parse(row?.answers || '{}'); } catch { /* */ }
    await env.CRM.prepare('UPDATE contacts SET level = ? WHERE token = ?').bind(buildPlan(a).level, t).run();
  }
  if (r.meta.changes) {
    const c = await env.CRM.prepare('SELECT id FROM contacts WHERE token = ?').bind(t).first();
    if (c) await env.CRM.batch([logAct(env, c.id, 'profile', `${f}=${val}`), linkDev(env, c.id, clean(b.d, 60))].filter(Boolean));
  }
  return json({ ok: true, saved: r.meta.changes > 0 });
}

// Once per browser session for anyone on the list (Base.astro): ties this device to them and logs the visit,
// so HQ can show who's coming back to the site (and from which device), not just who opens emails.
async function hello(req, env) {
  const b = await req.json().catch(() => ({}));
  const d = clean(b.d, 60), now = Date.now();
  let c = null;
  if (b.s) c = await env.CRM.prepare('SELECT c.id FROM sessions s JOIN contacts c ON c.id = s.contact_id WHERE s.token = ?').bind(clean(b.s, 40)).first();
  if (!c && b.t) c = await env.CRM.prepare('SELECT id FROM contacts WHERE token = ?').bind(clean(b.t, 40)).first();
  if (!c) return json({ ok: false });
  const prev = DEVICE_RE.test(d) ? await env.CRM.prepare('SELECT last_at, visits FROM contact_devices WHERE contact_id = ? AND device = ?').bind(c.id, d).first() : null;
  const fresh = !prev || now - (prev.last_at || 0) > 30 * 60000 || !prev.visits;
  const stmts = [];
  if (DEVICE_RE.test(d)) stmts.push(env.CRM.prepare('INSERT INTO contact_devices (contact_id, device, first_at, last_at, visits) VALUES (?, ?, ?, ?, 1) ON CONFLICT (contact_id, device) DO UPDATE SET last_at = excluded.last_at, visits = visits + ?')
    .bind(c.id, d, now, now, fresh ? 1 : 0));
  if (fresh) stmts.push(logAct(env, c.id, 'visit', clean(b.p, 120)));
  if (stmts.length) await env.CRM.batch(stmts);
  return json({ ok: true });
}

// Where sign-ups can come from (each one is its own row in HQ → Email → Funnel).
const SOURCES = ['quiz', 'measure', 'nudge', 'account'];
async function subscribe(req, env, ctx) {
  const b = await req.json().catch(() => null);
  if (!b) return bad('Bad request.');
  if (b.website) return json({ ok: true }); // honeypot: pretend it worked
  const email = clean(b.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return bad('That email doesn’t look right.');
  const ip = req.headers.get('cf-connecting-ip') || '';
  const iph = ip ? (hash(`${ip}:${new Date().toISOString().slice(0, 10)}`) >>> 0).toString(36) : '';
  const hourAgo = Date.now() - 3600000;
  if (iph) {
    const n = await env.CRM.prepare('SELECT COUNT(*) n FROM contacts WHERE iph = ? AND created > ?').bind(iph, hourAgo).first();
    if (n.n >= 5) return bad('Too many sign-ups from here. Try again in an hour.', 429);
  }
  const a = b.answers && typeof b.answers === 'object' ? b.answers : {};
  const keep = {};
  for (const k of ['zip', 'look', 'size', 'effort', 'know', 'problems', 'height', 'sun', 'water', 'uses', 'mower', 'sqft', 'grass', 'spreader']) if (a[k] !== undefined) keep[k] = Array.isArray(a[k]) ? a[k].slice(0, 8).map((x) => clean(x, 20)) : typeof a[k] === 'number' ? a[k] : clean(a[k], 20);
  if (keep.effort !== undefined) keep.quiz_at = Date.now(); // they took the quiz (measure-only sign-ups haven't)
  const source = SOURCES.includes(b.source) ? b.source : 'quiz';
  const device = clean(b.device, 60);
  const sqftIn = PROFILE.sqft(b.sqft) || 0; // only a lawn measured on the map
  const now = Date.now();
  const name = clean(b.name, 40).replace(/[<>]/g, '');
  const utm = JSON.stringify({ src: clean(b.utm?.src, 60), med: clean(b.utm?.med, 30), camp: clean(b.utm?.camp, 60), land: clean(b.utm?.land, 120) });
  const s = await settings(env);
  const old = await env.CRM.prepare('SELECT * FROM contacts WHERE email = ?').bind(email).first();
  let row;
  if (old) {
    // Already on the list. Only someone signed in as this person (on this device) gets to change the profile
    // or gets a session back. Anyone else: we never hand out the account. Their emails restart if they had
    // unsubscribed (they typed their email into a sign-up box), and they get a sign-in link by email.
    const sess = clean(b.s || req.headers.get('x-crm-session'), 40);
    const mine = sess ? await env.CRM.prepare('SELECT 1 x FROM sessions WHERE token = ? AND contact_id = ?').bind(sess, old.id).first() : null;
    if (!mine) {
      const stmts = [logAct(env, old.id, 'resignup', `${source}, not signed in: sent a sign-in link`)];
      if (old.status === 'unsubscribed') {
        stmts.push(env.CRM.prepare("UPDATE contacts SET status = 'active', pref = 'all', unsub_at = NULL, updated = ? WHERE id = ?").bind(now, old.id));
        stmts.push(logAct(env, old.id, 'resub', source));
      }
      await env.CRM.batch(stmts);
      ctx.waitUntil(sendLoginLink(env, old, iph).catch((e) => console.log('relink', e?.message)));
      return json({ ok: true, existing: true });
    }
    let prev = {}; try { prev = JSON.parse(old.answers || '{}'); } catch { /* */ }
    const merged = { ...prev, ...keep };
    const sqft = sqftIn || (old.measured ? old.sqft : 0);
    const plan = buildPlan(merged, { sqft });
    row = await env.CRM.prepare(`UPDATE contacts SET name = COALESCE(NULLIF(?, ''), name), zip = COALESCE(NULLIF(?, ''), zip), answers = ?, level = ?, sqft = ?, measured = ?, grass = ?,
      status = CASE WHEN status IN ('bounced', 'complained') THEN status ELSE 'active' END, unsub_at = CASE WHEN status IN ('bounced', 'complained') THEN unsub_at ELSE NULL END, updated = ? WHERE id = ? RETURNING *`)
      .bind(name, merged.zip || '', JSON.stringify(merged), plan.level, sqft || null, sqft ? 1 : 0, merged.grass || plan.grassKey, now, old.id).first();
    await env.CRM.batch([logAct(env, row.id, 'resignup', source), linkDev(env, row.id, device)].filter(Boolean));
  } else {
    const plan = buildPlan(keep, { sqft: sqftIn });
    row = await env.CRM.prepare(`INSERT INTO contacts (email, name, zip, answers, level, sqft, measured, grass, status, pref, token, source, utm, device, iph, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'all', ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .bind(email, name, keep.zip || '', JSON.stringify(keep), plan.level, sqftIn || null, sqftIn ? 1 : 0, keep.grass || plan.grassKey, rid(24), source, utm, device, iph, now, now).first();
    await env.CRM.batch([logAct(env, row.id, 'signup', source), linkDev(env, row.id, device)].filter(Boolean));
  }
  // The welcome email goes out right away (if sending is on and they haven't had it).
  let sent = false;
  if (s.mode === 'live' || (s.mode === 'test' && row.is_test)) {
    const had = (await sentMap(env, row.id)).has('w0-plan');
    sent = !had;
    if (!had) ctx.waitUntil(sendOne(env, contactOf(row), 'w0-plan', { s }).catch((e) => console.log('w0', e?.message)));
  }
  // Signed in on this device right away (same as clicking a magic link).
  const sess = rid(32);
  await env.CRM.prepare('INSERT INTO sessions (token, contact_id, created, last, device) VALUES (?, ?, ?, ?, ?)').bind(sess, row.id, now, now, device).run();
  return json({ ok: true, t: row.token, s: sess, sent, live: s.mode === 'live', again: !!old });
}

// "I'm already on the list": a sign-in link instead of the account. Max 5 an hour per person.
async function sendLoginLink(env, c, iph = '') {
  const now = Date.now();
  const recent = await env.CRM.prepare('SELECT COUNT(*) n FROM logins WHERE contact_id = ? AND created > ?').bind(c.id, now - 3600000).first();
  if (recent.n >= 5) return;
  const code = rid(32);
  await env.CRM.prepare('INSERT INTO logins (code, contact_id, iph, created) VALUES (?, ?, ?, ?)').bind(code, c.id, iph, now).run();
  const s = await settings(env);
  const url = `${SITE}/account/?login=${code}`;
  const r0 = render({ subject: 'Your Mow It Tall sign-in link', pre: 'Tap to sign in. The link works once, for 30 minutes.', blocks: [
    ['p', c.name ? `Hey ${c.name},` : 'Hey,'], ['p', 'Here’s your sign-in link for your lawn profile. It works once, for the next 30 minutes, and keeps this device signed in.'],
    ['btn', 'Sign In', `/account/?login=${code}`], ['p', 'Didn’t ask for this? Ignore it. Nobody gets in without this email.<br>– Mike'],
  ] }, { sendId: '', key: 'login', variant: '', token: c.token });
  // Untracked, no utm (it's a key, not marketing). Sent even when the drip is switched off.
  const html = r0.html.replace(/https:\/\/mowittall\.com\/account\/\?login=[^"&]+[^"]*/g, url);
  const r = await sendMail(env, { to: c.email, from: { email: s.from_addr, name: s.from_name }, subject: 'Your Mow It Tall sign-in link', html, text: `Sign in to your lawn profile (works once, for 30 minutes):\n${url}\n\nDidn’t ask for this? Ignore it.` });
  if (!r.ok) console.log('login mail', r.code);
}

const page = (title, body) => new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Mow It Tall</title>
<style>body{margin:0;background:#173d27;color:#12301d;font:17px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif}main{max-width:460px;margin:0 auto;padding:28px 16px}
.w{color:#eef5e6;font-weight:800;font-size:24px;text-decoration:none}.w span{color:#9fd36a}.c{background:#f1f6ec;border-radius:14px;padding:22px 20px;margin-top:16px}h1{font-size:24px;margin:0 0 8px}
button{display:block;width:100%;border:0;border-radius:10px;padding:14px;font:800 17px/1.2 inherit;cursor:pointer;margin:10px 0 0}.r{background:#c8372d;color:#fff}.q{background:#e3eed9;color:#12301d}
label{display:block;margin:8px 0}textarea{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #9bb59a;padding:8px;font:inherit}a{color:#12301d;font-weight:700}small{color:#4a5d4b}</style></head>
<body><main><a class="w" href="${SITE}/">Mow It <span>TALL</span></a><div class="c">${body}</div></main></body></html>`, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } });

async function unsubscribe(req, env, url) {
  const t = clean(url.searchParams.get('t'), 40), sid = clean(url.searchParams.get('s'), 20);
  const c = t ? await env.CRM.prepare('SELECT id, email, status, pref FROM contacts WHERE token = ?').bind(t).first() : null;
  if (!c) return page('Unsubscribe', '<h1>Hmm.</h1><p>That link didn’t match anyone on the list. If emails keep coming, just reply to one with “unsubscribe” and I’ll take care of it.</p>');
  const now = Date.now();
  if (req.method === 'POST') {
    let form = {};
    try { if ((req.headers.get('content-type') || '').includes('form')) form = Object.fromEntries(await req.formData()); } catch { /* one-click bodies */ }
    const o = clean(form.o || url.searchParams.get('o') || 'all', 10);
    const oneClick = url.searchParams.get('oc') === '1' || form['List-Unsubscribe'] === 'One-Click';
    if (o === 'resub') {
      await env.CRM.batch([env.CRM.prepare("UPDATE contacts SET status = 'active', pref = 'all', unsub_at = NULL, updated = ? WHERE id = ?").bind(now, c.id), logAct(env, c.id, 'resub', 'unsubscribe page')]);
      return page('Welcome back', '<h1>You’re back in.</h1><p>Good call. The next email will show up on its regular schedule.</p>');
    }
    if (o === 'jobs' && !oneClick) {
      await env.CRM.batch([env.CRM.prepare("UPDATE contacts SET pref = 'jobs', pref_at = ?, updated = ? WHERE id = ?").bind(now, now, c.id), logAct(env, c.id, 'pref', 'jobs (unsubscribe page)')]);
      return page('Job reminders only', '<h1>Done. Job reminders only.</h1><p>You’ll only hear from me a few days before a lawn job on your plan. That’s it.</p><form method="post"><input type="hidden" name="o" value="all"><button class="q">Actually, unsubscribe me from everything</button></form>');
    }
    await env.CRM.batch([
      env.CRM.prepare("UPDATE contacts SET status = 'unsubscribed', unsub_at = ?, unsub_reason = ?, updated = ? WHERE id = ?").bind(now, clean(form.why, 300) || (oneClick ? 'one-click' : ''), now, c.id),
      env.CRM.prepare('UPDATE sends SET unsub_at = COALESCE(unsub_at, ?) WHERE id = ? AND contact_id = ?').bind(now, sid, c.id),
      logAct(env, c.id, 'unsub', clean(form.why, 300) || (oneClick ? 'one-click' : 'unsubscribe page')),
    ]);
    if (oneClick) return new Response('Unsubscribed', { status: 200 });
    return page('Unsubscribed', '<h1>You’re unsubscribed.</h1><p>No more emails. No hard feelings. Keep mowing it tall.</p><form method="post"><input type="hidden" name="o" value="resub"><button class="q">Oops, resubscribe me</button></form>');
  }
  const o = url.searchParams.get('o');
  if (c.status === 'unsubscribed') return page('Unsubscribed', '<h1>You’re already unsubscribed.</h1><form method="post"><input type="hidden" name="o" value="resub"><button class="q">Resubscribe me</button></form>');
  return page('Unsubscribe', `<h1>${o === 'jobs' ? 'Just the job reminders?' : 'Leaving already?'}</h1><p><small>${c.email}</small></p>
    <form method="post"><input type="hidden" name="o" value="jobs"><button class="${o === 'jobs' ? 'r' : 'q'}">Just send job reminders</button><small>A few days before each lawn job on your plan. Nothing else.</small></form>
    <form method="post"><input type="hidden" name="o" value="all"><label>Why? (optional)<textarea name="why" rows="2" maxlength="300"></textarea></label><button class="${o === 'jobs' ? 'q' : 'r'}">Unsubscribe from everything</button></form>`);
}


/* ------------------------------------------------------------------ sign-in (magic links) */
const ipHash = (req) => { const ip = req.headers.get('cf-connecting-ip') || ''; return ip ? (hash(`${ip}:${new Date().toISOString().slice(0, 10)}`) >>> 0).toString(36) : ''; };
async function login(req, env, ctx) {
  const b = await req.json().catch(() => ({}));
  const email = clean(b.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return bad('That email doesn’t look right.');
  const iph = ipHash(req), now = Date.now();
  if (iph) {
    const n = await env.CRM.prepare('SELECT COUNT(*) n FROM logins WHERE iph = ? AND created > ?').bind(iph, now - 3600000).first();
    if (n.n >= 8) return bad('Too many tries. Give it an hour.', 429);
  }
  const c = await env.CRM.prepare('SELECT id, name, token FROM contacts WHERE email = ?').bind(email).first();
  // Same answer either way, so nobody can use this to check who's on the list.
  const ok = json({ ok: true });
  if (!c) return ok;
  ctx.waitUntil(sendLoginLink(env, { ...c, email }, iph).catch((e) => console.log('login', e?.message)));
  return ok;
}
async function session(req, env) {
  const b = await req.json().catch(() => ({}));
  const code = clean(b.code, 40), now = Date.now();
  const l = code ? await env.CRM.prepare('SELECT * FROM logins WHERE code = ?').bind(code).first() : null;
  if (!l || l.used || now - l.created > 30 * 60000) return bad('That sign-in link expired or was already used. Get a new one below.', 410);
  const c = await env.CRM.prepare('SELECT id, token FROM contacts WHERE id = ?').bind(l.contact_id).first();
  if (!c) return bad('That account is gone.', 404);
  const sess = rid(32);
  await env.CRM.batch([
    env.CRM.prepare('UPDATE logins SET used = ? WHERE code = ?').bind(now, code),
    env.CRM.prepare('INSERT INTO sessions (token, contact_id, created, last, device) VALUES (?, ?, ?, ?, ?)').bind(sess, c.id, now, now, clean(b.device, 60)),
    logAct(env, c.id, 'login', 'email link'),
    ...[linkDev(env, c.id, clean(b.device, 60))].filter(Boolean),
  ]);
  return json({ ok: true, s: sess, t: c.token });
}
const EDITABLE = ['name', 'zip', 'effort', 'know', 'sqft', 'sun', 'uses', 'water', 'grass', 'ph', 'mower', 'height', 'look', 'problems'];
async function me(req, env) {
  const tok = clean(req.headers.get('x-crm-session'), 40);
  const ss = tok ? await env.CRM.prepare('SELECT contact_id FROM sessions WHERE token = ?').bind(tok).first() : null;
  if (!ss) return bad('Signed out.', 401);
  const now = Date.now();
  let row = await env.CRM.prepare('SELECT * FROM contacts WHERE id = ?').bind(ss.contact_id).first();
  if (!row) return bad('Signed out.', 401);
  await settings(env); // the drip clock, for "Coming up"
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (b.action === 'logout') { await env.CRM.prepare('DELETE FROM sessions WHERE token = ?').bind(tok).run(); return json({ ok: true }); }
    if (b.action === 'logout-all') { await env.CRM.prepare('DELETE FROM sessions WHERE contact_id = ?').bind(row.id).run(); return json({ ok: true }); }
    if (b.action === 'delete') {
      await env.CRM.batch(forget(env, row.id));
      return json({ ok: true, deleted: true });
    }
    if (b.action === 'pref') {
      const v = b.pref;
      if (v === 'all' || v === 'jobs') await env.CRM.prepare("UPDATE contacts SET pref = ?, pref_at = ?, status = 'active', unsub_at = NULL, updated = ? WHERE id = ?").bind(v, now, now, row.id).run();
      else if (v === 'unsub') await env.CRM.prepare("UPDATE contacts SET status = 'unsubscribed', unsub_at = ?, unsub_reason = 'account page', updated = ? WHERE id = ?").bind(now, now, row.id).run();
      else return bad('Bad choice.');
      await logAct(env, row.id, v === 'unsub' ? 'unsub' : 'pref', v === 'unsub' ? 'account page' : v).run();
    }
    if (b.action === 'save' && b.fields && typeof b.fields === 'object') {
      let answers = {}; try { answers = JSON.parse(row.answers || '{}'); } catch { /* */ }
      const f = b.fields;
      const pick = (k, list) => (list.includes(f[k]) ? f[k] : undefined);
      const set = {
        sun: f.sun === '' ? null : PROFILE.sun(f.sun), uses: f.uses === '' ? null : PROFILE.uses(f.uses), water: f.water === '' ? null : PROFILE.water(f.water),
        grass: f.grass === '' ? null : PROFILE.grass(f.grass), ph: f.ph === '' || f.ph == null ? null : PROFILE.ph(f.ph), know: PROFILE.know(Number(f.know)),
        effort: [0, 1, 2, 3].includes(Number(f.effort)) ? Number(f.effort) : undefined, mower: pick('mower', ['me', 'crew', 'kid', 'robot']),
        height: pick('height', ['unknown', 'low', 'mid', 'high']), look: pick('look', ['good', 'street', 'patchy', 'weedy', 'dirt']),
        problems: Array.isArray(f.problems) ? f.problems.filter((x) => ['weeds', 'crabgrass', 'bare', 'brown', 'grubs', 'neighbor'].includes(x)) : undefined,
      };
      for (const [k, v] of Object.entries(set)) { if (v === undefined) continue; if (v === null) delete answers[k]; else answers[k] = v; }
      const sqft = f.sqft === '' ? null : PROFILE.sqft(String(f.sqft).replace(/[^0-9.]/g, ''));
      const zip = /^\d{5}$/.test(String(f.zip || '')) ? String(f.zip) : row.zip;
      answers.zip = zip;
      if (sqft) answers.sqft = sqft; else if (f.sqft === '') delete answers.sqft;
      const plan = buildPlan(answers, { sqft: sqft || 0 });
      await env.CRM.prepare('UPDATE contacts SET name = ?, zip = ?, answers = ?, level = ?, sqft = ?, measured = ?, grass = ?, updated = ? WHERE id = ?')
        .bind(clean(f.name, 40).replace(/[<>]/g, ''), zip, JSON.stringify(answers), plan.level, sqft || null, sqft ? 1 : 0, answers.grass || plan.grassKey, now, row.id).run();
      await logAct(env, row.id, 'profile', 'edited on the account page').run();
    }
    row = await env.CRM.prepare('SELECT * FROM contacts WHERE id = ?').bind(row.id).first();
  }
  await env.CRM.prepare('UPDATE sessions SET last = ? WHERE token = ?').bind(now, tok).run();
  const c = contactOf(row);
  const libItems = await lib(env);
  const coming = row.status === 'active' ? simulate(c, await sentMap(env, row.id), 45, libItems).slice(0, 5).map((x) => {
    const e = build(x.key, c, new Date(`${x.date}T12:00:00`), libItems);
    return { date: x.date, kind: x.kind, subject: e?.subjects?.a || nameOf(x.key, libItems) };
  }) : [];
  const recent = await env.CRM.prepare("SELECT subject, sent_at FROM sends WHERE contact_id = ? AND mode = 'live' AND status NOT IN ('failed','queued','skipped') ORDER BY sent_at DESC LIMIT 5").bind(row.id).all();
  const plan = buildPlan(c.answers, { sqft: c.sqft });
  return json({ email: row.email, name: row.name || '', zip: row.zip || '', status: row.status, pref: row.pref, sqft: row.sqft || null, measured: !!row.measured, answers: c.answers,
    level: plan.level, levelName: LEVEL_NAMES[plan.level], profile: plan.profile.name, grassName: plan.grass?.name || '', jobs: plan.tasks.length, coming, recent: recent.results, t: row.token });
}

/* ------------------------------------------------------------------ inbound replies */
export async function crmInbound(message, env, ctx) {
  if (!(await crmInit(env))) return;
  const raw = await new Response(message.raw).arrayBuffer();
  let mail = {};
  try { mail = await PostalMime.parse(raw); } catch { /* keep going with the envelope */ }
  const from = String(mail.from?.address || message.from || '').toLowerCase();
  const subject = clean(mail.subject || '', 300);
  const head = (n) => (mail.headers || []).find((h) => h.key === n)?.value || '';
  const auto = /mailer-daemon|postmaster|no-?reply/i.test(from) || (head('auto-submitted') && head('auto-submitted') !== 'no') || /^(auto(matic)? ?reply|out of (the )?office|undeliverable|delivery status)/i.test(subject) ? 1 : 0;
  const c = await env.CRM.prepare('SELECT id FROM contacts WHERE email = ?').bind(from).first();
  const now = Date.now();
  await env.CRM.prepare('INSERT INTO msgs (contact_id, dir, from_addr, from_name, to_addr, subject, text, html, message_id, in_reply_to, at, auto) VALUES (?, \'in\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(c?.id || null, from, clean(mail.from?.name, 80), clean(message.to, 120), subject, String(mail.text || '').slice(0, 20000), String(mail.html || '').slice(0, 100000), clean(mail.messageId, 300), clean(mail.inReplyTo, 300), now, auto).run();
  if (c && !auto) {
    // "unsubscribe" replies (and the List-Unsubscribe mailto) are honored right away.
    if (/^\s*(unsubscribe|stop|remove me)\b/i.test(subject) || /^\s*(unsubscribe|stop|remove me)\s*$/i.test(String(mail.text || '').split('\n')[0] || '')) {
      await env.CRM.prepare("UPDATE contacts SET status = 'unsubscribed', unsub_at = ?, unsub_reason = 'replied unsubscribe', updated = ? WHERE id = ?").bind(now, now, c.id).run();
      await logAct(env, c.id, 'unsub', 'replied unsubscribe').run();
    } else await env.CRM.batch([env.CRM.prepare('UPDATE contacts SET replied_at = ? WHERE id = ?').bind(now, c.id), logAct(env, c.id, 'reply', subject)]);
  }
  const s = await settings(env);
  if (s.forward_to) { try { await message.forward(s.forward_to); } catch (e) { console.log('forward', e?.message); } }
}

/* ------------------------------------------------------------------ delivery events (Queue) */
export async function crmEvents(batch, env) {
  if (!(await crmInit(env))) return;
  const now = Date.now();
  for (const msg of batch.messages) {
    try {
      const ev = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
      const type = String(ev?.type || '').split('.').pop();
      const mid = ev?.payload?.messageId || '';
      const stmts = [env.CRM.prepare('INSERT INTO crm_events (type, message_id, detail, at) VALUES (?, ?, ?, ?)').bind(type, mid, JSON.stringify(ev?.payload || {}).slice(0, 2000), now)];
      if (type === 'delivered') stmts.push(env.CRM.prepare("UPDATE sends SET status = 'delivered', delivered_at = ? WHERE message_id = ? AND status = 'sent'").bind(now, mid));
      if (type === 'bounced' || type === 'complained' || type === 'rejected') {
        const hard = type !== 'bounced' || ev?.payload?.bounce?.type !== 'soft' || ev?.payload?.terminal;
        stmts.push(env.CRM.prepare('UPDATE sends SET status = ? WHERE message_id = ?').bind(type, mid));
        if (hard) stmts.push(env.CRM.prepare("UPDATE contacts SET status = ?, updated = ? WHERE id = (SELECT contact_id FROM sends WHERE message_id = ?) AND status = 'active'").bind(type === 'complained' ? 'complained' : 'bounced', now, mid));
      }
      await env.CRM.batch(stmts);
      msg.ack();
    } catch (e) { console.log('event', e?.message); msg.retry(); }
  }
}

/* ------------------------------------------------------------------ HQ */
// Sample new subscribers for previews: quiz answers only (sun, uses, water, size come later, by email).
const SAMPLES = [0, 1, 2, 3].map((lv) => ({ zip: '10506', look: ['street', 'patchy', 'weedy', 'good'][lv], effort: lv, know: [0, 1, 2, 3][lv], problems: [['weeds'], ['bare', 'crabgrass'], ['weeds', 'brown'], ['neighbor']][lv], height: ['unknown', 'mid', 'low', 'high'][lv], mower: 'me' }));
const sample = (lv = 1, extra = {}) => ({ id: 0, email: 'you@example.com', name: 'Mike', created: Date.now(), answers: { ...SAMPLES[lv], ...extra }, sqft: 0, measured: false, pref: 'all', token: 'preview' });

// Walk forward day by day with nextFor to see what someone would get. No sending.
function simulate(c, sentIn, days, libItems, startTs = Date.now()) {
  const sent = new Map(sentIn);
  const out = [];
  const t0 = etToday(startTs);
  for (let i = 0; i < days; i++) {
    const today = new Date(t0.getTime() + i * DAY);
    const nx = nextFor(c, sent, today, libItems);
    if (!nx) continue;
    sent.set(nx.key, today.getTime());
    out.push({ date: ymd(today), key: nx.key, kind: nx.kind });
  }
  return out;
}

async function testStats(env, rows, minArm = 200) {
  const { results } = await env.CRM.prepare(`SELECT test, variant, COUNT(*) n, SUM(opened_at IS NOT NULL) o, SUM(clicked_at IS NOT NULL) k, SUM(unsub_at IS NOT NULL) u
    FROM sends WHERE mode = 'live' AND test != '' AND status IN ('sent', 'delivered', 'bounced', 'complained') GROUP BY test, variant`).all();
  return Object.entries(TESTS).map(([id, def]) => {
    const arm = (v) => { const r = results.find((x) => x.test === id && x.variant === v) || { n: 0, o: 0, k: 0, u: 0 }; return { v, n: r.n, opens: r.o, clicks: r.k, unsubs: r.u, openRate: r.n ? r.o / r.n : 0, clickRate: r.n ? r.k / r.n : 0, unsubRate: r.n ? r.u / r.n : 0 }; };
    const a = arm('a'), b = arm('b');
    const zc = ztest(a.clicks, a.n, b.clicks, b.n), zo = ztest(a.opens, a.n, b.opens, b.n);
    const enough = a.n >= 100 && b.n >= 100;
    let verdict = 'collecting', winner = '';
    if (enough && zc.p < 0.05) { verdict = 'winner'; winner = b.clickRate > a.clickRate ? 'b' : 'a'; }
    else if (enough && a.n + b.n > 2000) verdict = 'tie';
    else if (enough) verdict = 'too-close';
    const lo = winner === 'a' ? b : a, hi = winner === 'a' ? a : b;
    return {
      id, name: def.name, arms: [{ ...a, label: def.arms.a }, { ...b, label: def.arms.b }], verdict, winner, ready: a.n >= minArm && b.n >= minArm,
      lift: winner && lo.clickRate ? (hi.clickRate - lo.clickRate) / lo.clickRate : 0, confidence: 1 - zc.p, openConfidence: 1 - zo.p,
      openLeader: b.openRate > a.openRate ? 'b' : 'a', chosen: rows[id]?.winner || '', status: rows[id]?.status || 'on',
    };
  });
}

/* ------------------------------------------------------------------ engagement (stages + score) */
// One SQL view of every contact with its stage, score and track. ?1 = 14 days ago, ?2 = 30, ?3 = 60.
// Stages: New (first 14 days) · Engaged (clicked, replied, visited the site, signed in or answered something
// in the last 30 days) · Cooling (that in 30–60 days, or only opens lately) · Dormant (quiet 60+ days) · Gone.
// Opens count for little: Apple Mail opens every email on its own.
// Score (0–100): clicks ×8 (max 40) + replied 15 + profile answers ×4 (max 28) + site visits in 30 days ×3 (max 15) + opens (max 10).
const STAGED = `WITH x AS (
    SELECT c.*,
      (SELECT MAX(last_at) FROM contact_devices d WHERE d.contact_id = c.id) seen_at,
      (SELECT COUNT(*) FROM activity a WHERE a.contact_id = c.id AND a.type = 'visit' AND a.at > ?2) visits30,
      (SELECT MAX(at) FROM activity a WHERE a.contact_id = c.id AND a.type IN ('profile', 'quiz', 'login', 'visit')) act_at,
      ((c.measured = 1) + (json_extract(c.answers, '$.sun') IS NOT NULL) + (json_extract(c.answers, '$.uses') IS NOT NULL) + (json_extract(c.answers, '$.water') IS NOT NULL)
        + (json_extract(c.answers, '$.grass') IS NOT NULL) + (json_extract(c.answers, '$.ph') IS NOT NULL) + (json_extract(c.answers, '$.spreader') IS NOT NULL)) fields,
      CASE json_extract(c.answers, '$.mower') WHEN 'crew' THEN 'crew' WHEN 'robot' THEN 'robot' ELSE 'diy' END track
    FROM contacts c),
  y AS (SELECT *, MAX(COALESCE(last_click, 0), COALESCE(replied_at, 0), COALESCE(seen_at, 0), COALESCE(act_at, 0)) eng_at FROM x)
  SELECT *,
    CASE WHEN status != 'active' THEN 'gone' WHEN created > ?1 THEN 'new' WHEN eng_at > ?2 THEN 'engaged'
      WHEN eng_at > ?3 OR COALESCE(last_open, 0) > ?2 THEN 'cooling' ELSE 'dormant' END stage,
    MIN(100, MIN(clicks * 8, 40) + (replied_at IS NOT NULL) * 15 + MIN(fields * 4, 28) + MIN(visits30 * 3, 15) + MIN(opens, 10)) score
  FROM y`;
const stageArgs = (now) => [now - 14 * DAY, now - 30 * DAY, now - 60 * DAY];
const PROFILE_FIELDS = 7;

// What someone did on the site, from the event log (separate database, joined by device id).
async function siteEvents(env, devices, { before = 0, limit = 300 } = {}) {
  if (!env.EV || !devices.length) return [];
  try {
    const { results } = await env.EV.prepare(`SELECT at, name, path, title, params, source, medium, landing, session FROM ev_raw
      WHERE device IN (SELECT value FROM json_each(?)) ${before ? 'AND at < ?' : ''} AND name != 'page_leave' ORDER BY at DESC LIMIT ${Number(limit) || 300}`)
      .bind(JSON.stringify(devices), ...(before ? [before] : [])).all();
    return results;
  } catch (e) { console.log('ev', e?.message); return []; }
}
async function devicesOf(env, id, row) {
  const { results } = await env.CRM.prepare('SELECT device FROM contact_devices WHERE contact_id = ?').bind(id).all();
  const set = new Set(results.map((r) => r.device));
  if (row?.device && DEVICE_RE.test(row.device)) set.add(row.device);
  return [...set];
}
// Before they signed up: first visit, how they found the site, sessions and pages.
async function journeyBefore(env, row, devices) {
  if (!env.EV || !devices.length) return null;
  try {
    const [agg, first] = await env.EV.batch([
      env.EV.prepare(`SELECT MIN(at) first_at, COUNT(DISTINCT session) sessions, SUM(name = 'page_view') pages FROM ev_raw WHERE device IN (SELECT value FROM json_each(?)) AND at < ?`).bind(JSON.stringify(devices), row.created + 60000),
      env.EV.prepare(`SELECT landing, source, medium, campaign FROM ev_raw WHERE device IN (SELECT value FROM json_each(?)) ORDER BY at LIMIT 1`).bind(JSON.stringify(devices)),
    ]);
    const a = agg.results[0] || {};
    return a.first_at ? { firstAt: a.first_at, sessions: a.sessions, pages: a.pages, ...(first.results[0] || {}) } : null;
  } catch (e) { console.log('ev', e?.message); return null; }
}

export async function crmAdmin(env, req, url, ctx) {
  if (!(await crmInit(env))) return bad('Add the CRM database binding first.', 503);
  const p = url.pathname.replace('/api/admin/crm/', ''), q = url.searchParams, now = Date.now();
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const libItems = await lib(env);
  await settings(env); // loads the drip clock (clockOf) for everything below

  if (p === 'settings') {
    if (req.method === 'POST') {
      for (const k of Object.keys(DEFAULTS)) if (body[k] !== undefined) {
        let v = clean(body[k], 120);
        if (k === 'mode' && !['off', 'test', 'live'].includes(v)) return bad('Mode is off, test or live.');
        if (['test_to', 'from_addr', 'forward_to'].includes(k) && v && !EMAIL_RE.test(v)) return bad(`${k} isn’t an email.`);
        await setKv(env, k, v);
        // First time going Live starts everyone's drip clock (see clockOf). Never moves after that.
        if (k === 'mode' && v === 'live' && !(await settings(env)).live_since) await setKv(env, 'live_since', Date.now());
      }
    }
    const s = await settings(env);
    const err = await env.CRM.prepare("SELECT v FROM crm_kv WHERE k = 'last_error'").first();
    const ev = await env.CRM.prepare('SELECT COUNT(*) n, MAX(at) last FROM crm_events').first();
    const inb = await env.CRM.prepare("SELECT MAX(at) last FROM msgs WHERE dir = 'in'").first();
    return json({ settings: s, binding: !!env.EMAIL, events: ev, lastInbound: inb?.last || null, lastError: err ? JSON.parse(err.v) : null, libCount: libItems.length });
  }

  // New sign-ups: the box at the top of HQ → This Week. "New" = since Mike last hit "Mark all seen".
  if (p === 'signups') {
    if (req.method === 'POST' && body.action === 'seen') { await setKv(env, 'signups_seen_at', now); return json({ ok: true, seenAt: now }); }
    const seenAt = Number((await env.CRM.prepare("SELECT v FROM crm_kv WHERE k = 'signups_seen_at'").first())?.v) || 0;
    const days = Math.max(1, Math.min(90, Number(q.get('days')) || 7));
    const from = Math.min(seenAt || now, now - days * DAY);
    const [cnt, list] = await env.CRM.batch([
      env.CRM.prepare(`SELECT SUM(created > ?) unseen, SUM(created > ?) today, SUM(created > ?) week, COUNT(*) total FROM contacts WHERE is_test = 0`)
        .bind(seenAt, etToday(now).getTime() - 12 * 3600000 + 5 * 3600000, now - 7 * DAY),
      env.CRM.prepare(`SELECT id, email, name, zip, source, utm, created, level, sqft, measured, status, is_test, device, answers FROM contacts WHERE created > ? ORDER BY created DESC LIMIT 50`).bind(from),
    ]);
    const people = await Promise.all(list.results.map(async (r) => {
      let a = {}, utm = {}; try { a = JSON.parse(r.answers || '{}'); utm = JSON.parse(r.utm || '{}'); } catch { /* */ }
      const before = await journeyBefore(env, r, await devicesOf(env, r.id, r));
      return { id: r.id, email: r.email, name: r.name, zip: r.zip, source: r.source, created: r.created, level: LEVEL_NAMES[r.level] || '', track: a.mower === 'crew' ? 'Landscaper' : a.mower === 'robot' ? 'Robot' : 'DIY',
        tookQuiz: a.effort !== undefined, sqft: r.measured ? r.sqft : 0, status: r.status, test: !!r.is_test, isNew: r.created > seenAt,
        from: utm.src || before?.source || '(direct)', medium: utm.med || before?.medium || '', landed: utm.land || before?.landing || '', before };
    }));
    const c = cnt.results[0] || {};
    return json({ seenAt, unseen: c.unseen || 0, today: c.today || 0, week: c.week || 0, total: c.total || 0, people });
  }

  // Funnel + cohorts (HQ → Email → Funnel).
  if (p === 'funnel') {
    const days = Math.max(0, Math.min(3650, Number(q.get('days')) || 28)), since = days ? now - days * DAY : 0;
    let site = null;
    if (env.EV) {
      try {
        site = await env.EV.prepare(`SELECT COUNT(DISTINCT device) visitors,
          COUNT(DISTINCT CASE WHEN name = 'quiz_start' THEN device END) quiz_start, COUNT(DISTINCT CASE WHEN name = 'quiz_complete' THEN device END) quiz_done,
          COUNT(DISTINCT CASE WHEN name = 'page_view' AND path = '/measure/' THEN device END) measure_view, COUNT(DISTINCT CASE WHEN name = 'yard_measured' THEN device END) measure_done
          FROM ev_raw WHERE date >= ?`).bind(since ? ymd(etToday(since)) : '0000').first();
      } catch (e) { console.log('ev funnel', e?.message); }
    }
    const PEOPLE = `SELECT c.id, c.source, c.status, c.created, c.unsub_at, c.measured, c.answers,
      (SELECT opened_at FROM sends s WHERE s.contact_id = c.id AND s.key = 'w0-plan' AND s.mode = 'live' LIMIT 1) w0_open,
      (SELECT COUNT(*) FROM sends s WHERE s.contact_id = c.id AND s.mode = 'live' AND s.status NOT IN ('failed', 'queued', 'skipped')) sent,
      (SELECT MIN(k.at) FROM clicks k JOIN sends s ON s.id = k.send_id WHERE s.contact_id = c.id AND k.bot = 0) first_click,
      (SELECT COUNT(*) FROM activity a WHERE a.contact_id = c.id AND a.type = 'login') logins,
      (SELECT COUNT(*) FROM activity a WHERE a.contact_id = c.id AND a.type = 'visit') visits
      FROM contacts c WHERE c.is_test = 0 AND c.created > ?`;
    const fieldsOf = (r) => { let a = {}; try { a = JSON.parse(r.answers || '{}'); } catch { /* */ } return (r.measured ? 1 : 0) + ['sun', 'uses', 'water', 'grass', 'ph', 'spreader'].filter((k) => a[k] != null).length; };
    const { results: ppl } = await env.CRM.prepare(PEOPLE).bind(since).all();
    const steps = (rows) => {
      const old = rows.filter((r) => now - r.created > 90 * DAY);
      return {
        signups: rows.length, emailed: rows.filter((r) => r.sent > 0).length, opened: rows.filter((r) => r.w0_open).length, clicked: rows.filter((r) => r.first_click).length,
        profile: rows.filter((r) => fieldsOf(r) >= 4).length, returned: rows.filter((r) => r.visits > 0).length, signedIn: rows.filter((r) => r.logins > 0).length,
        unsub: rows.filter((r) => r.status !== 'active').length, old90: old.length, active90: old.filter((r) => r.status === 'active').length,
      };
    };
    const bySource = {};
    for (const r of ppl) (bySource[r.source || 'quiz'] = bySource[r.source || 'quiz'] || []).push(r);
    // Cohorts: last 12 sign-up weeks (weeks start Monday). Share still subscribed / ever clicked at the end of each week since sign-up.
    const { results: co } = await env.CRM.prepare(PEOPLE).bind(now - 12 * 7 * DAY - 7 * DAY).all();
    const wk = (t) => { const d = new Date(t - 5 * 3600000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
    const groups = {};
    for (const r of co) (groups[wk(r.created)] = groups[wk(r.created)] || []).push(r);
    const cohorts = Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12).map(([week, rows]) => ({
      week, n: rows.length,
      cells: Array.from({ length: 12 }, (_, k) => {
        const done = rows.filter((r) => r.created + (k + 1) * 7 * DAY <= now);
        if (!done.length) return null;
        const end = (r) => r.created + (k + 1) * 7 * DAY;
        return { n: done.length, kept: done.filter((r) => !r.unsub_at || r.unsub_at > end(r)).length, clicked: done.filter((r) => r.first_click && r.first_click <= end(r)).length };
      }),
    }));
    const { results: stages } = await env.CRM.prepare(`SELECT stage, COUNT(*) n, ROUND(AVG(score)) avg FROM (${STAGED}) WHERE is_test = 0 GROUP BY stage`).bind(...stageArgs(now)).all();
    const s = await settings(env);
    return json({ days, mode: s.mode, site, all: steps(ppl), sources: Object.entries(bySource).map(([k, v]) => ({ source: k, ...steps(v) })).sort((a, b) => b.signups - a.signups), cohorts, stages });
  }

  if (p === 'overview') {
    const days = Math.max(0, Math.min(3650, Number(q.get('days')) || 28));
    const since = days ? now - days * DAY : 0, prev = days ? now - 2 * days * DAY : 0;
    const S = env.CRM;
    const [st, nw, nwP, un, unP, sd, sdP, rp, src, lv, dayS, dayU, dayE, pref] = await S.batch([
      S.prepare('SELECT status, COUNT(*) n FROM contacts GROUP BY status'),
      S.prepare('SELECT COUNT(*) n FROM contacts WHERE created > ?').bind(since),
      S.prepare('SELECT COUNT(*) n FROM contacts WHERE created > ? AND created <= ?').bind(prev, since),
      S.prepare("SELECT COUNT(*) n FROM contacts WHERE unsub_at > ?").bind(since),
      S.prepare("SELECT COUNT(*) n FROM contacts WHERE unsub_at > ? AND unsub_at <= ?").bind(prev, since),
      S.prepare("SELECT COUNT(*) n, SUM(opened_at IS NOT NULL) o, SUM(clicked_at IS NOT NULL) k, SUM(unsub_at IS NOT NULL) u, SUM(status IN ('bounced','complained')) b, SUM(status = 'complained') sp FROM sends WHERE mode = 'live' AND status NOT IN ('failed','queued','skipped') AND sent_at > ?").bind(since),
      S.prepare("SELECT COUNT(*) n, SUM(opened_at IS NOT NULL) o, SUM(clicked_at IS NOT NULL) k, SUM(unsub_at IS NOT NULL) u FROM sends WHERE mode = 'live' AND status NOT IN ('failed','queued','skipped') AND sent_at > ? AND sent_at <= ?").bind(prev, since),
      S.prepare("SELECT COUNT(*) n FROM msgs WHERE dir = 'in' AND auto = 0 AND at > ?").bind(since),
      S.prepare("SELECT COALESCE(NULLIF(json_extract(utm, '$.src'), ''), '(direct)') src, source, COUNT(*) n FROM contacts WHERE created > ? GROUP BY 1, 2 ORDER BY n DESC LIMIT 12").bind(since),
      S.prepare("SELECT level, COUNT(*) n FROM contacts WHERE status = 'active' GROUP BY level"),
      S.prepare("SELECT date(created / 1000, 'unixepoch', '-5 hours') d, COUNT(*) n FROM contacts WHERE created > ? GROUP BY d").bind(now - 90 * DAY),
      S.prepare("SELECT date(unsub_at / 1000, 'unixepoch', '-5 hours') d, COUNT(*) n FROM contacts WHERE unsub_at > ? GROUP BY d").bind(now - 90 * DAY),
      S.prepare("SELECT date(sent_at / 1000, 'unixepoch', '-5 hours') d, COUNT(*) n, SUM(opened_at IS NOT NULL) o, SUM(clicked_at IS NOT NULL) k FROM sends WHERE mode = 'live' AND status NOT IN ('failed','queued','skipped') AND sent_at > ? GROUP BY d").bind(now - 90 * DAY),
      S.prepare("SELECT pref, COUNT(*) n FROM contacts WHERE status = 'active' GROUP BY pref"),
    ]);
    const unread = await S.prepare("SELECT COUNT(*) n FROM msgs WHERE dir = 'in' AND read = 0 AND auto = 0").first();
    const stg = await S.prepare(`SELECT stage, COUNT(*) n FROM (${STAGED}) WHERE is_test = 0 GROUP BY stage`).bind(...stageArgs(now)).all();
    const prof = await S.prepare(`SELECT COUNT(*) n, SUM(measured = 1) sqft, SUM(json_extract(answers, '$.sun') IS NOT NULL) sun, SUM(json_extract(answers, '$.uses') IS NOT NULL) uses,
      SUM(json_extract(answers, '$.water') IS NOT NULL) water, SUM(json_extract(answers, '$.grass') IS NOT NULL) grass, SUM(json_extract(answers, '$.ph') IS NOT NULL) ph,
      SUM(json_extract(answers, '$.seeded') IS NOT NULL) seeded FROM contacts WHERE status = 'active'`).first();
    return json({
      days, status: st.results, newN: nw.results[0].n, newPrev: nwP.results[0].n, unsubN: un.results[0].n, unsubPrev: unP.results[0].n,
      sends: sd.results[0], sendsPrev: sdP.results[0], replies: rp.results[0].n, unread: unread.n, sources: src.results,
      levels: lv.results.map((r) => ({ ...r, name: LEVEL_NAMES[r.level] || '?' })), prefs: pref.results,
      daily: { signups: dayS.results, unsubs: dayU.results, sends: dayE.results }, profile: prof, stages: stg.results,
    });
  }

  if (p === 'emails') {
    const days = Math.max(0, Number(q.get('days')) || 0), since = days ? now - days * DAY : 0;
    // Optional ?track=diy|crew|robot: how each email does with one kind of subscriber.
    const tr = ['diy', 'crew', 'robot'].includes(q.get('track')) ? q.get('track') : '';
    const trackSql = tr ? `AND contact_id IN (SELECT id FROM contacts WHERE ${tr === 'diy' ? "COALESCE(json_extract(answers, '$.mower'), 'me') NOT IN ('crew', 'robot')" : `json_extract(answers, '$.mower') = '${tr}'`})` : '';
    const { results } = await env.CRM.prepare(`SELECT key, variant, COUNT(*) n, SUM(opened_at IS NOT NULL) o, SUM(clicked_at IS NOT NULL) k, SUM(unsub_at IS NOT NULL) u,
      SUM(status IN ('bounced','complained')) b, MAX(sent_at) last FROM sends WHERE mode = 'live' AND status NOT IN ('failed','queued','skipped') AND sent_at > ? ${trackSql} GROUP BY key, variant`).bind(since).all();
    const by = {};
    for (const r of results) {
      const k = baseKey(r.key);
      const e = by[k] || (by[k] = { key: k, name: nameOf(r.key, libItems).replace(/: \d{4}$/, ''), kind: k.split(':')[0], n: 0, o: 0, k: 0, u: 0, b: 0, last: 0, variants: {} });
      e.n += r.n; e.o += r.o; e.k += r.k; e.u += r.u; e.b += r.b; e.last = Math.max(e.last, r.last);
      const v = e.variants[r.variant || '-'] || (e.variants[r.variant || '-'] = { n: 0, o: 0, k: 0, u: 0 });
      v.n += r.n; v.o += r.o; v.k += r.k; v.u += r.u;
    }
    const top = await env.CRM.prepare(`SELECT c.url, COUNT(*) n FROM clicks c WHERE c.bot = 0 AND c.at > ? GROUP BY c.url ORDER BY n DESC LIMIT 20`).bind(since).all();
    return json({ emails: Object.values(by).sort((a, b) => b.last - a.last), topLinks: top.results });
  }

  if (p === 'tests') {
    if (req.method === 'POST') {
      const id = clean(body.id, 40);
      if (!TESTS[id]) return bad('Unknown test.');
      if (body.action === 'reset') await env.CRM.prepare('DELETE FROM tests WHERE id = ?').bind(id).run();
      else if (body.action === 'winner' && ['a', 'b'].includes(body.variant)) await env.CRM.prepare('INSERT INTO tests (id, winner, status, at) VALUES (?, ?, \'picked\', ?) ON CONFLICT (id) DO UPDATE SET winner = excluded.winner, status = excluded.status, at = excluded.at').bind(id, body.variant, now).run();
      else if (body.action === 'pause') await env.CRM.prepare('INSERT INTO tests (id, winner, status, at) VALUES (?, NULL, \'off\', ?) ON CONFLICT (id) DO UPDATE SET winner = NULL, status = \'off\', at = excluded.at').bind(id, now).run();
    }
    const s = await settings(env);
    return json({ tests: await testStats(env, await testRows(env), Number(s.min_arm) || 200), autoWinner: s.auto_winner === '1', minArm: Number(s.min_arm) || 200 });
  }

  if (p === 'contacts') {
    const term = clean(q.get('q'), 80).toLowerCase(), off = Math.max(0, Number(q.get('offset')) || 0);
    const where = [], args = stageArgs(now);
    const add = (sql, ...v) => { let out = sql; for (const x of v) { args.push(x); out = out.replace('?', `?${args.length}`); } where.push(out); };
    if (term) add('(email LIKE ? OR name LIKE ? OR zip LIKE ?)', `%${term}%`, `%${term}%`, `${term}%`);
    for (const k of ['status', 'stage', 'track', 'source']) { const v = clean(q.get(k), 20); if (v) add(`${k} = ?`, v); }
    if (q.get('level') !== null && q.get('level') !== '') add('level = ?', Number(q.get('level')));
    if (q.get('profile') === 'thin') where.push('fields < 2'); else if (q.get('profile') === 'half') where.push('fields >= 4');
    if (q.get('test') === '0') where.push('is_test = 0');
    const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const order = { score: 'score DESC, created DESC', active: 'eng_at DESC', old: 'created ASC' }[q.get('sort')] || 'created DESC';
    args.push(off);
    const [rows, cnt] = await env.CRM.batch([
      env.CRM.prepare(`SELECT id, email, name, zip, level, sqft, status, pref, is_test, source, created, sent_n, opens, clicks, last_open, last_click, replied_at, stage, score, track, fields, eng_at, seen_at
        FROM (${STAGED}) ${W} ORDER BY ${order} LIMIT 50 OFFSET ?${args.length}`).bind(...args),
      env.CRM.prepare(`SELECT COUNT(*) n FROM (${STAGED}) ${W}`).bind(...args.slice(0, -1)),
    ]);
    return json({ contacts: rows.results, total: cnt.results[0].n, fieldsMax: PROFILE_FIELDS });
  }
  if (p === 'contacts.csv') {
    const { results } = await env.CRM.prepare('SELECT id, email, name, zip, level, sqft, status, pref, source, utm, created, sent_n, opens, clicks, last_open, last_click, unsub_at, unsub_reason FROM contacts ORDER BY created').all();
    const cols = Object.keys(results[0] || { id: 1 });
    const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out = [cols.join(','), ...results.map((r) => cols.map((c) => cell(/created|_at|last_/.test(c) && r[c] ? new Date(r[c]).toISOString() : r[c])).join(','))].join('\n');
    return new Response(out, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="mowittall-contacts.csv"' } });
  }
  if (p === 'contact') {
    const id = Number(q.get('id') || body.id);
    const row = await env.CRM.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
    if (!row) return bad('Not found.', 404);
    if (req.method === 'POST') {
      const a = body.action;
      if (a === 'unsub') await env.CRM.prepare("UPDATE contacts SET status = 'unsubscribed', unsub_at = ?, unsub_reason = 'removed in HQ', updated = ? WHERE id = ?").bind(now, now, id).run();
      else if (a === 'resub') await env.CRM.prepare("UPDATE contacts SET status = 'active', pref = 'all', unsub_at = NULL, updated = ? WHERE id = ?").bind(now, id).run();
      else if (a === 'jobs' || a === 'all') await env.CRM.prepare('UPDATE contacts SET pref = ?, pref_at = ? WHERE id = ?').bind(a, now, id).run();
      else if (a === 'test-on' || a === 'test-off') await env.CRM.prepare('UPDATE contacts SET is_test = ? WHERE id = ?').bind(a === 'test-on' ? 1 : 0, id).run();
      else if (a === 'note') await env.CRM.prepare('UPDATE contacts SET note = ? WHERE id = ?').bind(clean(body.note, 1000), id).run();
      else if (a === 'delete') {
        await env.CRM.batch(forget(env, id));
        return json({ ok: true, deleted: true });
      } else if (a === 'send-next') {
        const c = contactOf(row);
        const nx = nextFor(c, await sentMap(env, id), etToday(), libItems);
        if (!nx) return bad('Nothing is due for this person today.');
        try { const r = await sendOne(env, c, nx.key, { libItems }); if (!r.ok) return bad(r.error || 'Didn’t send.'); } catch (e) { return bad(`Sending stopped: ${e.message}`); }
      } else return bad('Unknown action.');
      if (!['note', 'delete'].includes(a)) await logAct(env, id, 'hq', a).run();
    }
    const fresh = await env.CRM.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
    const [sends, msgs] = await env.CRM.batch([
      env.CRM.prepare('SELECT id, key, variant, subject, status, error, sent_at, delivered_at, opened_at, opens, clicked_at, clicks, unsub_at FROM sends WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 400').bind(id),
      env.CRM.prepare('SELECT id, dir, subject, text, at, auto FROM msgs WHERE contact_id = ? ORDER BY at DESC LIMIT 100').bind(id),
    ]);
    const c = contactOf(fresh);
    const coming = fresh.status === 'active' ? simulate(c, await sentMap(env, id), 60, libItems).slice(0, 8).map((x) => ({ ...x, name: nameOf(x.key, libItems) })) : [];
    // Engagement + one timeline: site visits and tool use (event log, by device), emails, clicks, profile answers, sign-ins, replies.
    const eng = await env.CRM.prepare(`SELECT stage, score, fields, visits30, eng_at, seen_at, track FROM (${STAGED}) WHERE id = ?4`).bind(...stageArgs(now), id).first();
    const devices = await devicesOf(env, id, fresh);
    const [acts, clk, devRows] = await env.CRM.batch([
      env.CRM.prepare('SELECT type, detail, at FROM activity WHERE contact_id = ? ORDER BY at DESC LIMIT 300').bind(id),
      env.CRM.prepare('SELECT k.at, k.url, s.subject FROM clicks k JOIN sends s ON s.id = k.send_id WHERE s.contact_id = ? AND k.bot = 0 ORDER BY k.at DESC LIMIT 200').bind(id),
      env.CRM.prepare('SELECT device, first_at, last_at, visits FROM contact_devices WHERE contact_id = ? ORDER BY last_at DESC').bind(id),
    ]);
    const site = await siteEvents(env, devices, { limit: 400 });
    const before = await journeyBefore(env, fresh, devices);
    const ACT = { signup: 'Signed up', resignup: 'Signed up again', resub: 'Resubscribed', unsub: 'Unsubscribed', pref: 'Email setting', profile: 'Profile', quiz: 'Took the quiz', login: 'Signed in', visit: 'Came back to the site', reply: 'Replied', hq: 'You (HQ)' };
    const timeline = [
      ...site.map((e) => ({ at: e.at, kind: 'site', text: e.name === 'page_view' ? `Viewed ${e.title || e.path}` : `${e.name.replace(/_/g, ' ')}`, path: e.path, session: e.session })),
      ...sends.results.flatMap((x) => [
        x.sent_at ? { at: x.sent_at, kind: 'email', text: `Emailed: ${x.subject || x.name || x.key}`, status: x.status } : null,
        x.opened_at ? { at: x.opened_at, kind: 'open', text: `Opened: ${x.subject || x.key}` } : null,
      ]).filter(Boolean),
      ...clk.results.map((k) => ({ at: k.at, kind: 'click', text: `Clicked ${k.url.replace(/^https:\/\/mowittall\.com/, '').replace(/\?.*$/, '') || '/'} in “${k.subject || ''}”` })),
      ...acts.results.filter((x) => x.type !== 'visit').map((x) => ({ at: x.at, kind: x.type === 'signup' ? 'signup' : 'act', text: `${ACT[x.type] || x.type}${x.detail ? `: ${x.detail}` : ''}` })),
      ...msgs.results.filter((m) => m.dir === 'out').map((m) => ({ at: m.at, kind: 'act', text: `You replied: ${m.subject || ''}` })),
    ].sort((a, b) => b.at - a.at).slice(0, 500);
    return json({ contact: { ...fresh, answers: c.answers, levelName: LEVEL_NAMES[fresh.level] }, sends: sends.results.map((s) => ({ ...s, name: nameOf(s.key, libItems) })), msgs: msgs.results, coming,
      eng, devices: devRows.results, before, timeline, fieldsMax: PROFILE_FIELDS, hasEvents: !!env.EV });
  }

  if (p === 'inbox') {
    if (req.method === 'POST' && body.action === 'read') { await env.CRM.prepare('UPDATE msgs SET read = 1 WHERE id = ?').bind(Number(body.id)).run(); return json({ ok: true }); }
    const filter = q.get('all') ? '' : 'AND m.auto = 0';
    const { results } = await env.CRM.prepare(`SELECT m.*, c.email c_email, c.name c_name, c.level c_level FROM msgs m LEFT JOIN contacts c ON c.id = m.contact_id WHERE 1 = 1 ${filter} ORDER BY m.at DESC LIMIT 150`).all();
    return json({ msgs: results.map((m) => ({ ...m, html: undefined })) });
  }
  if (p === 'reply' && req.method === 'POST') {
    const m = await env.CRM.prepare('SELECT * FROM msgs WHERE id = ?').bind(Number(body.id)).first();
    if (!m) return bad('Message not found.', 404);
    const text = clean(body.text, 20000);
    if (text.length < 2) return bad('Write something first.');
    const s = await settings(env);
    const subject = /^re:/i.test(m.subject || '') ? m.subject : `Re: ${m.subject || 'your lawn'}`;
    const htmlBody = `<div style="font:16px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#12301d">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div>`
      + `<br><div style="font:13px/1.5 Arial,sans-serif;color:#667">On ${new Date(m.at).toLocaleString('en-US', { timeZone: 'America/New_York' })}, ${m.from_addr} wrote:</div><blockquote style="margin:4px 0 0 0;padding-left:10px;border-left:3px solid #ccc;color:#667">${String(m.text || '').slice(0, 4000).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</blockquote>`;
    const headers = m.message_id ? { 'In-Reply-To': m.message_id, References: m.message_id } : {};
    const r = await sendMail(env, { to: m.from_addr, from: { email: s.from_addr, name: s.from_name }, subject, html: htmlBody, text: `${text}\n\nOn ${new Date(m.at).toISOString()}, ${m.from_addr} wrote:\n> ${String(m.text || '').slice(0, 4000).replace(/\n/g, '\n> ')}`, headers });
    if (!r.ok) return bad(`Didn’t send: ${r.code} ${r.error}`);
    await env.CRM.batch([
      env.CRM.prepare('INSERT INTO msgs (contact_id, dir, from_addr, to_addr, subject, text, message_id, in_reply_to, at, read) VALUES (?, \'out\', ?, ?, ?, ?, ?, ?, ?, 1)').bind(m.contact_id, s.from_addr, m.from_addr, subject, text, r.messageId, m.message_id, now),
      env.CRM.prepare('UPDATE msgs SET read = 1 WHERE id = ?').bind(m.id),
    ]);
    return json({ ok: true });
  }

  if (p === 'preview' || p === 'test-send') {
    const cid = Number(q.get('contact') || body.contact || 0);
    let c;
    if (cid) { const row = await env.CRM.prepare('SELECT * FROM contacts WHERE id = ?').bind(cid).first(); if (row) c = contactOf(row); }
    const tr = q.get('track') || body.track || ((body.crew || q.get('crew')) ? 'crew' : 'diy');
    if (!c) c = sample(Math.max(0, Math.min(3, Number(q.get('level') ?? body.level ?? 1))), { mower: tr === 'crew' ? 'crew' : tr === 'robot' ? 'robot' : 'me' });
    const key = clean(q.get('key') || body.key, 120);
    const date = q.get('date') || body.date;
    const today = date ? new Date(`${date}T12:00:00`) : etToday();
    const email = build(key, c, today, libItems);
    if (!email) return bad('That email has nothing to say for this person (yet).');
    const variant = (q.get('variant') || body.variant) === 'b' ? 'b' : 'a';
    if (p === 'preview') {
      const r0 = render({ ...email, subject: email.subjects[variant] }, { sendId: '', key, variant, token: c.token, pref: c.pref });
      return json({ subjects: email.subjects, pre: email.pre, html: r0.html, text: r0.text, name: nameOf(key, libItems) });
    }
    const s = await settings(env);
    const to = clean(body.to, 120) || s.test_to;
    if (!EMAIL_RE.test(to)) return bad('Set your test email address first.');
    const r = await sendOne(env, c, key, { today, libItems, s, to: { email: to, variant }, mode: 'preview', prefix: '[Test] ' }).catch((e) => ({ ok: false, error: e.message }));
    return r.ok ? json({ ok: true }) : bad(`Didn’t send: ${r.code || ''} ${r.error || ''}`);
  }

  if (p === 'year') {
    const lv = Math.max(0, Math.min(3, Number(q.get('level') ?? 1)));
    const tr = q.get('track') || (q.get('crew') ? 'crew' : 'diy');
    const c = sample(lv, { mower: tr === 'crew' ? 'crew' : tr === 'robot' ? 'robot' : 'me' });
    const items = simulate(c, new Map(), 365, libItems).map((x) => {
      const e = build(x.key, c, new Date(`${x.date}T12:00:00`), libItems);
      return { ...x, name: nameOf(x.key, libItems), subject: e?.subjects?.a || '', subjectB: e?.subjects?.b || '' };
    });
    return json({ level: lv, levelName: LEVEL_NAMES[lv], items, poolSize: libItems.length });
  }

  if (p === 'upcoming') {
    const days = Math.min(21, Number(q.get('days')) || 14);
    const { results } = await env.CRM.prepare("SELECT * FROM contacts WHERE status = 'active' ORDER BY id LIMIT 1500").all();
    const byDay = {}, byKey = {};
    for (const row of results) {
      const c = contactOf(row);
      for (const x of simulate(c, await sentMap(env, c.id), days, libItems)) {
        byDay[x.date] = (byDay[x.date] || 0) + 1;
        const k = baseKey(x.key);
        byKey[k] = byKey[k] || { key: k, name: nameOf(x.key, libItems).replace(/: \d{4}$/, ''), n: 0 };
        byKey[k].n++;
      }
    }
    return json({ days, byDay, byKey: Object.values(byKey).sort((a, b) => b.n - a.n), contacts: results.length });
  }
  return bad('Not found.', 404);
}

export { WELCOME };
