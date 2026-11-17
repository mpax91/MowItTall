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
async function settings(env) {
  const { results } = await env.CRM.prepare('SELECT k, v FROM crm_kv').all();
  const s = { ...DEFAULTS };
  for (const r of results) if (r.k in DEFAULTS) s[r.k] = r.v;
  return s;
}
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
  return { id: r.id, email: r.email, name: r.name || '', created: r.created, answers, sqft: r.sqft || 0, measured: !!r.measured, pref: r.pref || 'all', token: r.token, level: r.level, is_test: r.is_test };
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
      .bind(id, c.id, key, key.startsWith('job:') ? 'job' : key.startsWith('lib:') ? 'content' : key.startsWith('month:') ? 'month' : 'welcome', test, variant, subject, JSON.stringify(r0.links), at).run();
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
};
async function profileUpdate(req, env) {
  const b = await req.json().catch(() => ({}));
  let t = clean(b.t, 40);
  let f = clean(b.f, 12), v = b.v;
  if (!t && b.s) { const r = await env.CRM.prepare('SELECT c.token FROM sessions s JOIN contacts c ON c.id = s.contact_id WHERE s.token = ?').bind(clean(b.s, 40)).first(); t = r?.token || ''; }
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
  return json({ ok: true, saved: r.meta.changes > 0 });
}

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
  for (const k of ['zip', 'look', 'size', 'effort', 'know', 'problems', 'height', 'sun', 'water', 'uses', 'mower', 'sqft']) if (a[k] !== undefined) keep[k] = Array.isArray(a[k]) ? a[k].slice(0, 8).map((x) => clean(x, 20)) : typeof a[k] === 'number' ? a[k] : clean(a[k], 20);
  const plan = buildPlan(keep, { sqft: b.sqft });
  const now = Date.now();
  const name = clean(b.name, 40).replace(/[<>]/g, '');
  const utm = JSON.stringify({ src: clean(b.utm?.src, 60), med: clean(b.utm?.med, 30), camp: clean(b.utm?.camp, 60), land: clean(b.utm?.land, 120) });
  const old = await env.CRM.prepare('SELECT * FROM contacts WHERE email = ?').bind(email).first();
  let row;
  if (old) {
    row = await env.CRM.prepare(`UPDATE contacts SET name = COALESCE(NULLIF(?, ''), name), zip = ?, answers = ?, level = ?, sqft = CASE WHEN measured = 1 THEN sqft ELSE ? END,
      grass = ?, status = 'active', pref = 'all', updated = ?, unsub_at = NULL WHERE id = ? RETURNING *`)
      .bind(name, keep.zip || '', JSON.stringify(keep), plan.level, Math.round(plan.sqft) || null, plan.grassKey, now, old.id).first();
  } else {
    row = await env.CRM.prepare(`INSERT INTO contacts (email, name, zip, answers, level, sqft, grass, status, pref, token, source, utm, device, iph, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'all', ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .bind(email, name, keep.zip || '', JSON.stringify(keep), plan.level, Math.round(plan.sqft) || null, plan.grassKey, rid(24), clean(b.source, 20) || 'quiz', utm, clean(b.device, 60), iph, now, now).first();
  }
  // The welcome email goes out right away (if sending is on and they haven't had it).
  const s = await settings(env);
  if (s.mode === 'live' || (s.mode === 'test' && row.is_test)) {
    ctx.waitUntil((async () => {
      const sent = await sentMap(env, row.id);
      if (!sent.has('w0-plan')) await sendOne(env, contactOf(row), 'w0-plan', { s }).catch((e) => console.log('w0', e?.message));
    })());
  }
  // Signed in on this device right away (same as clicking a magic link).
  const sess = rid(32);
  await env.CRM.prepare('INSERT INTO sessions (token, contact_id, created, last, device) VALUES (?, ?, ?, ?, ?)').bind(sess, row.id, now, now, clean(b.device, 60)).run();
  return json({ ok: true, t: row.token, s: sess });
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
      await env.CRM.prepare("UPDATE contacts SET status = 'active', pref = 'all', unsub_at = NULL, updated = ? WHERE id = ?").bind(now, c.id).run();
      return page('Welcome back', '<h1>You’re back in.</h1><p>Good call. The next email will show up on its regular schedule.</p>');
    }
    if (o === 'jobs' && !oneClick) {
      await env.CRM.prepare("UPDATE contacts SET pref = 'jobs', pref_at = ?, updated = ? WHERE id = ?").bind(now, now, c.id).run();
      return page('Job reminders only', '<h1>Done. Job reminders only.</h1><p>You’ll only hear from me a few days before a lawn job on your plan. That’s it.</p><form method="post"><input type="hidden" name="o" value="all"><button class="q">Actually, unsubscribe me from everything</button></form>');
    }
    await env.CRM.batch([
      env.CRM.prepare("UPDATE contacts SET status = 'unsubscribed', unsub_at = ?, unsub_reason = ?, updated = ? WHERE id = ?").bind(now, clean(form.why, 300) || (oneClick ? 'one-click' : ''), now, c.id),
      env.CRM.prepare('UPDATE sends SET unsub_at = COALESCE(unsub_at, ?) WHERE id = ? AND contact_id = ?').bind(now, sid, c.id),
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
  const recent = await env.CRM.prepare('SELECT COUNT(*) n FROM logins WHERE contact_id = ? AND created > ?').bind(c.id, now - 3600000).first();
  if (recent.n >= 5) return ok;
  const code = rid(32);
  await env.CRM.prepare('INSERT INTO logins (code, contact_id, iph, created) VALUES (?, ?, ?, ?)').bind(code, c.id, iph, now).run();
  const s = await settings(env);
  const url = `${SITE}/account/?login=${code}`;
  const r0 = render({ subject: 'Your Mow It Tall sign-in link', pre: 'Tap to sign in. The link works once, for 30 minutes.', blocks: [
    ['p', c.name ? `Hey ${c.name},` : 'Hey,'], ['p', 'Here’s your sign-in link for your lawn profile. It works once, for the next 30 minutes.'],
    ['btn', 'Sign In', `/account/?login=${code}`], ['p', 'Didn’t ask for this? Ignore it. Nobody gets in without this email.<br>– Mike'],
  ] }, { sendId: '', key: 'login', variant: '', token: c.token });
  // Untracked, no utm (it's a key, not marketing). Sent even when the drip is switched off.
  const html = r0.html.replace(/https:\/\/mowittall\.com\/account\/\?login=[^"&]+[^"]*/g, url);
  ctx.waitUntil(sendMail(env, { to: email, from: { email: s.from_addr, name: s.from_name }, subject: 'Your Mow It Tall sign-in link', html, text: `Sign in to your lawn profile (works once, for 30 minutes):\n${url}\n\nDidn’t ask for this? Ignore it.` }).then((r) => { if (!r.ok) console.log('login mail', r.code); }));
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
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (b.action === 'logout') { await env.CRM.prepare('DELETE FROM sessions WHERE token = ?').bind(tok).run(); return json({ ok: true }); }
    if (b.action === 'logout-all') { await env.CRM.prepare('DELETE FROM sessions WHERE contact_id = ?').bind(row.id).run(); return json({ ok: true }); }
    if (b.action === 'delete') {
      const id = row.id;
      await env.CRM.batch([env.CRM.prepare('DELETE FROM clicks WHERE send_id IN (SELECT id FROM sends WHERE contact_id = ?)').bind(id), env.CRM.prepare('DELETE FROM sends WHERE contact_id = ?').bind(id),
        env.CRM.prepare('DELETE FROM msgs WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM sessions WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM logins WHERE contact_id = ?').bind(id),
        env.CRM.prepare('DELETE FROM contacts WHERE id = ?').bind(id)]);
      return json({ ok: true, deleted: true });
    }
    if (b.action === 'pref') {
      const v = b.pref;
      if (v === 'all' || v === 'jobs') await env.CRM.prepare("UPDATE contacts SET pref = ?, pref_at = ?, status = 'active', unsub_at = NULL, updated = ? WHERE id = ?").bind(v, now, now, row.id).run();
      else if (v === 'unsub') await env.CRM.prepare("UPDATE contacts SET status = 'unsubscribed', unsub_at = ?, unsub_reason = 'account page', updated = ? WHERE id = ?").bind(now, now, row.id).run();
      else return bad('Bad choice.');
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
    } else await env.CRM.prepare('UPDATE contacts SET replied_at = ? WHERE id = ?').bind(now, c.id).run();
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

export async function crmAdmin(env, req, url, ctx) {
  if (!(await crmInit(env))) return bad('Add the CRM database binding first.', 503);
  const p = url.pathname.replace('/api/admin/crm/', ''), q = url.searchParams, now = Date.now();
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const libItems = await lib(env);

  if (p === 'settings') {
    if (req.method === 'POST') {
      for (const k of Object.keys(DEFAULTS)) if (body[k] !== undefined) {
        let v = clean(body[k], 120);
        if (k === 'mode' && !['off', 'test', 'live'].includes(v)) return bad('Mode is off, test or live.');
        if (['test_to', 'from_addr', 'forward_to'].includes(k) && v && !EMAIL_RE.test(v)) return bad(`${k} isn’t an email.`);
        await setKv(env, k, v);
      }
    }
    const s = await settings(env);
    const err = await env.CRM.prepare("SELECT v FROM crm_kv WHERE k = 'last_error'").first();
    const ev = await env.CRM.prepare('SELECT COUNT(*) n, MAX(at) last FROM crm_events').first();
    const inb = await env.CRM.prepare("SELECT MAX(at) last FROM msgs WHERE dir = 'in'").first();
    return json({ settings: s, binding: !!env.EMAIL, events: ev, lastInbound: inb?.last || null, lastError: err ? JSON.parse(err.v) : null, libCount: libItems.length });
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
    const prof = await S.prepare(`SELECT COUNT(*) n, SUM(measured = 1) sqft, SUM(json_extract(answers, '$.sun') IS NOT NULL) sun, SUM(json_extract(answers, '$.uses') IS NOT NULL) uses,
      SUM(json_extract(answers, '$.water') IS NOT NULL) water, SUM(json_extract(answers, '$.grass') IS NOT NULL) grass, SUM(json_extract(answers, '$.ph') IS NOT NULL) ph,
      SUM(json_extract(answers, '$.seeded') IS NOT NULL) seeded FROM contacts WHERE status = 'active'`).first();
    return json({
      days, status: st.results, newN: nw.results[0].n, newPrev: nwP.results[0].n, unsubN: un.results[0].n, unsubPrev: unP.results[0].n,
      sends: sd.results[0], sendsPrev: sdP.results[0], replies: rp.results[0].n, unread: unread.n, sources: src.results,
      levels: lv.results.map((r) => ({ ...r, name: LEVEL_NAMES[r.level] || '?' })), prefs: pref.results,
      daily: { signups: dayS.results, unsubs: dayU.results, sends: dayE.results }, profile: prof,
    });
  }

  if (p === 'emails') {
    const days = Math.max(0, Number(q.get('days')) || 0), since = days ? now - days * DAY : 0;
    const { results } = await env.CRM.prepare(`SELECT key, variant, COUNT(*) n, SUM(opened_at IS NOT NULL) o, SUM(clicked_at IS NOT NULL) k, SUM(unsub_at IS NOT NULL) u,
      SUM(status IN ('bounced','complained')) b, MAX(sent_at) last FROM sends WHERE mode = 'live' AND status NOT IN ('failed','queued','skipped') AND sent_at > ? GROUP BY key, variant`).bind(since).all();
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
    const term = clean(q.get('q'), 80).toLowerCase(), status = clean(q.get('status'), 20), off = Math.max(0, Number(q.get('offset')) || 0);
    const where = [], args = [];
    if (term) { where.push('(email LIKE ? OR name LIKE ? OR zip LIKE ?)'); args.push(`%${term}%`, `%${term}%`, `${term}%`); }
    if (status) { where.push('status = ?'); args.push(status); }
    const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows, cnt] = await env.CRM.batch([
      env.CRM.prepare(`SELECT id, email, name, zip, level, sqft, status, pref, is_test, source, created, sent_n, opens, clicks, last_open, last_click, replied_at FROM contacts ${W} ORDER BY created DESC LIMIT 50 OFFSET ?`).bind(...args, off),
      env.CRM.prepare(`SELECT COUNT(*) n FROM contacts ${W}`).bind(...args),
    ]);
    return json({ contacts: rows.results, total: cnt.results[0].n });
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
        await env.CRM.batch([env.CRM.prepare('DELETE FROM clicks WHERE send_id IN (SELECT id FROM sends WHERE contact_id = ?)').bind(id), env.CRM.prepare('DELETE FROM sends WHERE contact_id = ?').bind(id),
          env.CRM.prepare('DELETE FROM msgs WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM sessions WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM logins WHERE contact_id = ?').bind(id), env.CRM.prepare('DELETE FROM contacts WHERE id = ?').bind(id)]);
        return json({ ok: true, deleted: true });
      } else if (a === 'send-next') {
        const c = contactOf(row);
        const nx = nextFor(c, await sentMap(env, id), etToday(), libItems);
        if (!nx) return bad('Nothing is due for this person today.');
        try { const r = await sendOne(env, c, nx.key, { libItems }); if (!r.ok) return bad(r.error || 'Didn’t send.'); } catch (e) { return bad(`Sending stopped: ${e.message}`); }
      } else return bad('Unknown action.');
    }
    const fresh = await env.CRM.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
    const [sends, msgs] = await env.CRM.batch([
      env.CRM.prepare('SELECT id, key, variant, subject, status, error, sent_at, delivered_at, opened_at, opens, clicked_at, clicks, unsub_at FROM sends WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 400').bind(id),
      env.CRM.prepare('SELECT id, dir, subject, text, at, auto FROM msgs WHERE contact_id = ? ORDER BY at DESC LIMIT 100').bind(id),
    ]);
    const c = contactOf(fresh);
    const coming = fresh.status === 'active' ? simulate(c, await sentMap(env, id), 60, libItems).slice(0, 8).map((x) => ({ ...x, name: nameOf(x.key, libItems) })) : [];
    return json({ contact: { ...fresh, answers: c.answers, levelName: LEVEL_NAMES[fresh.level] }, sends: sends.results.map((s) => ({ ...s, name: nameOf(s.key, libItems) })), msgs: msgs.results, coming });
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
