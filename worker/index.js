import { PLAYBOOK } from './playbook.js';
import { ingest, summary, exportRows, nightly, rollup, evInit, etDate } from './events.js';
// Mow It Tall API (Cloudflare Worker). Everything that isn't /api/* is served straight from ./dist.
// Lawn Hall of Fame / Hall of Shame: anyone can upload, Mike approves before anything shows,
// Reddit-style up/down votes, one vote per photo per phone (random device id, no spam check by Mike's call).
// Storage: one D1 database (binding DB). Photos are stored as BLOBs (resized in the browser to ~1600px JPEG,
// which also strips GPS/EXIF). Admin = the ADMIN_KEY secret set in the Cloudflare dashboard.

const SEED = [
  // Mike's own photos start the Hall of Fame (static files in /public/img).
  ['mike-front', 'fame', 'Front yard, late May. The rhododendrons help. So do the stripes.', 'Mike', 'Bedford', '/img/front-yard-may-1400.webp', 1400, 1050],
  ['mike-back', 'fame', 'Backyard, June. Regular push mower, mowed tall and straight.', 'Mike', 'Bedford', '/img/backyard-stripes-1400.webp', 1400, 1050],
  ['mike-spiral', 'fame', 'The spiral. One evening, zero useful skills. Neighbors still ask.', 'Mike', 'Bedford', '/img/spiral-pattern-1400.webp', 1400, 788],
  ['mike-frost', 'fame', 'November stripes. This lawn didn’t get the memo.', 'Mike', 'Bedford', '/img/frosty-stripes-november-1400.webp', 1400, 1050],
];
const MAX_BYTES = 1_900_000;          // D1 rows top out around 2 MB
const MAX_UPLOADS_PER_DAY = 10;       // per device, just to keep a runaway script from filling the database

let ready = null;
async function init(db) {
  if (!ready) {
    ready = (async () => {
      await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY, board TEXT NOT NULL, caption TEXT, name TEXT, town TEXT,
          status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, approved INTEGER,
          device TEXT, img_url TEXT, img BLOB, w INTEGER, h INTEGER, score INTEGER NOT NULL DEFAULT 0)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS votes (
          post_id TEXT NOT NULL, device TEXT NOT NULL, value INTEGER NOT NULL, at INTEGER NOT NULL,
          PRIMARY KEY (post_id, device))`),
        db.prepare(`CREATE INDEX IF NOT EXISTS posts_board ON posts (board, status)`),
        // dashboard: when each piece of social copy was last posted, per platform
        db.prepare(`CREATE TABLE IF NOT EXISTS social_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, platform TEXT NOT NULL, at INTEGER NOT NULL)`),
        // HQ to-do list: done state for the built-in items (playbook.js) + Mike's own items
        db.prepare(`CREATE TABLE IF NOT EXISTS todo_state (id TEXT PRIMARY KEY, done_at INTEGER, note TEXT)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS todo_custom (id TEXT PRIMARY KEY, grp TEXT, title TEXT NOT NULL, created INTEGER NOT NULL)`),
        // HQ settings and saved results (audit runs, Looker embed URL, profile links): small JSON blobs by key
        db.prepare(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, at INTEGER)`),
        // Search Console / Bing exports uploaded in HQ (rank tracker), one row per upload
        // Short links: mowittall.com/<slug> -> any page or outside URL, managed in HQ → Short Links
        db.prepare(`CREATE TABLE IF NOT EXISTS shortlinks (slug TEXT PRIMARY KEY, target TEXT NOT NULL, note TEXT, permanent INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, last_click INTEGER, created INTEGER NOT NULL, updated INTEGER NOT NULL)`),
        // Lawn Weed Bracket (blog post widget): one pick per pairing per phone. pair = the two weed ids sorted
        // and joined with "~", or "champ" for the final winner.
        db.prepare(`CREATE TABLE IF NOT EXISTS bracket_votes (bracket TEXT NOT NULL, pair TEXT NOT NULL, device TEXT NOT NULL, pick TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (bracket, pair, device))`),
        db.prepare(`CREATE TABLE IF NOT EXISTS seo_snap (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, label TEXT, kind TEXT, rows TEXT, at INTEGER)`),
      ]);
      const now = Date.now();
      await db.batch(SEED.map(([id, board, caption, name, town, url, w, h], i) =>
        db.prepare(`INSERT OR IGNORE INTO posts (id, board, caption, name, town, status, created, approved, img_url, w, h)
                    VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?)`).bind(id, board, caption, name, town, now - i * 60000, now - i * 60000, url, w, h)));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const isDevice = (d) => typeof d === 'string' && /^[a-z0-9-]{8,64}$/i.test(d);
const isAdmin = (env, key) => !!env.ADMIN_KEY && typeof key === 'string' && key.length > 0 && key === env.ADMIN_KEY;

// Reddit's "hot": log of the net score, plus time, so new posts get a shot.
const hot = (score, created) => {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  return sign * order + (created / 1000 - 1_700_000_000) / 45000;
};

function publicPost(p, myVote) {
  return {
    id: p.id, board: p.board, caption: p.caption, name: p.name, town: p.town, score: p.score,
    created: p.created, w: p.w, h: p.h, vote: myVote || 0,
    img: p.img_url || `/api/hall/img/${p.id}`,
  };
}

async function list(env, url) {
  const board = url.searchParams.get('board') === 'shame' ? 'shame' : 'fame';
  const sort = ['hot', 'top', 'new'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'hot';
  const device = url.searchParams.get('device');
  const { results } = await env.DB.prepare(
    `SELECT id, board, caption, name, town, created, approved, img_url, w, h, score FROM posts
     WHERE board = ? AND status = 'approved' ORDER BY approved DESC LIMIT 300`).bind(board).all();
  let mine = {};
  if (isDevice(device) && results.length) {
    const v = await env.DB.prepare('SELECT post_id, value FROM votes WHERE device = ?').bind(device).all();
    mine = Object.fromEntries(v.results.map((r) => [r.post_id, r.value]));
  }
  const posts = results.map((p) => publicPost(p, mine[p.id]));
  if (sort === 'top') posts.sort((a, b) => b.score - a.score || b.created - a.created);
  else if (sort === 'new') posts.sort((a, b) => b.created - a.created);
  else posts.sort((a, b) => hot(b.score, b.created) - hot(a.score, a.created));
  const counts = await env.DB.prepare(`SELECT board, COUNT(*) n FROM posts WHERE status = 'approved' GROUP BY board`).all();
  return json({ board, sort, posts, counts: Object.fromEntries(counts.results.map((r) => [r.board, r.n])) });
}

async function vote(env, req) {
  const { id, device, value } = await req.json().catch(() => ({}));
  if (!isDevice(device)) return bad('Missing device.');
  const v = Number(value);
  if (![1, -1, 0].includes(v)) return bad('Bad vote.');
  const post = await env.DB.prepare(`SELECT id FROM posts WHERE id = ? AND status = 'approved'`).bind(String(id)).first();
  if (!post) return bad('No such photo.', 404);
  const stmts = [];
  if (v === 0) stmts.push(env.DB.prepare('DELETE FROM votes WHERE post_id = ? AND device = ?').bind(post.id, device));
  else stmts.push(env.DB.prepare(`INSERT INTO votes (post_id, device, value, at) VALUES (?, ?, ?, ?)
    ON CONFLICT (post_id, device) DO UPDATE SET value = excluded.value, at = excluded.at`).bind(post.id, device, v, Date.now()));
  stmts.push(env.DB.prepare('UPDATE posts SET score = (SELECT COALESCE(SUM(value), 0) FROM votes WHERE post_id = ?) WHERE id = ?').bind(post.id, post.id));
  await env.DB.batch(stmts);
  const row = await env.DB.prepare('SELECT score FROM posts WHERE id = ?').bind(post.id).first();
  return json({ id: post.id, score: row.score, vote: v });
}

async function submit(env, req) {
  const form = await req.formData().catch(() => null);
  if (!form) return bad('Send the photo as a form.');
  const device = form.get('device');
  if (!isDevice(device)) return bad('Missing device.');
  if (form.get('ok') !== 'yes') return bad('Please check the box first.');
  const file = form.get('photo');
  if (!file || typeof file === 'string') return bad('Pick a photo.');
  if (!/^image\/(jpeg|webp|png)$/.test(file.type)) return bad('That file type won’t work. Try a JPG.');
  if (file.size > MAX_BYTES) return bad('That photo is too big. Try a smaller one.');
  const dayAgo = Date.now() - 86400000;
  const recent = await env.DB.prepare('SELECT COUNT(*) n FROM posts WHERE device = ? AND created > ?').bind(device, dayAgo).first();
  if (recent.n >= MAX_UPLOADS_PER_DAY) return bad('That’s a lot of lawns for one day. Try again tomorrow.', 429);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const board = form.get('board') === 'shame' ? 'shame' : 'fame';
  const w = Math.min(4000, Math.max(1, parseInt(form.get('w'), 10) || 1200));
  const h = Math.min(4000, Math.max(1, parseInt(form.get('h'), 10) || 900));
  await env.DB.prepare(`INSERT INTO posts (id, board, caption, name, town, status, created, device, img, w, h)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`)
    .bind(id, board, clean(form.get('caption'), 140), clean(form.get('name'), 40), clean(form.get('town'), 40), Date.now(), device, await file.arrayBuffer(), w, h)
    .run();
  return json({ ok: true, id });
}

async function image(env, id, url) {
  const p = await env.DB.prepare('SELECT status, img, img_url FROM posts WHERE id = ?').bind(id).first();
  if (!p) return new Response('Not found', { status: 404 });
  const admin = isAdmin(env, url.searchParams.get('key'));
  if (p.status !== 'approved' && !admin) return new Response('Not found', { status: 404 });
  if (p.img_url) return Response.redirect(new URL(p.img_url, url).toString(), 302);
  const bytes = new Uint8Array(p.img);
  const type = bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x89 ? 'image/png' : 'image/webp';
  return new Response(bytes, { headers: { 'content-type': type, 'cache-control': admin && p.status !== 'approved' ? 'no-store' : 'public, max-age=31536000, immutable' } });
}

async function admin(env, req, url) {
  if (!env.ADMIN_KEY) return bad('Set the ADMIN_KEY secret in Cloudflare first.', 503);
  if (req.method === 'GET') {
    if (!isAdmin(env, url.searchParams.get('key'))) return bad('Wrong key.', 401);
    const status = ['pending', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
    const { results } = await env.DB.prepare(
      `SELECT id, board, caption, name, town, status, created, img_url, w, h, score FROM posts WHERE status = ? ORDER BY created DESC LIMIT 200`).bind(status).all();
    const counts = await env.DB.prepare('SELECT status, COUNT(*) n FROM posts GROUP BY status').all();
    return json({ posts: results.map((p) => ({ ...publicPost(p), status: p.status })), counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])) });
  }
  const { key, id, action, board } = await req.json().catch(() => ({}));
  if (!isAdmin(env, key)) return bad('Wrong key.', 401);
  const now = Date.now();
  if (action === 'approve') await env.DB.prepare(`UPDATE posts SET status = 'approved', approved = ? WHERE id = ?`).bind(now, id).run();
  else if (action === 'reject') await env.DB.prepare(`UPDATE posts SET status = 'rejected' WHERE id = ?`).bind(id).run();
  else if (action === 'move') await env.DB.prepare('UPDATE posts SET board = ? WHERE id = ?').bind(board === 'shame' ? 'shame' : 'fame', id).run();
  else if (action === 'delete') await env.DB.batch([
    env.DB.prepare('DELETE FROM votes WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id),
  ]);
  else return bad('Unknown action.');
  return json({ ok: true });
}

/* ---------- short links */
const RESERVED = new Set(['api', 'admin', 'og', 'img', 'icons', '_astro', 'pagefind', 'data', 'robots.txt', 'llms.txt', 'rss.xml', 'sitemap-index.xml', 'sitemap-0.xml', 'manifest.webmanifest', 'favicon.svg']);
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
let linkCache = { at: 0, map: null };
// ---------- Lawn Weed Bracket (keep in sync with src/data/bracket.js)
const BRACKET_IDS = { weeds: new Set(['dandelion', 'violet', 'creeping-charlie', 'clover', 'crabgrass', 'annual-bluegrass', 'nutsedge', 'rough-bluegrass',
  'plantain', 'deadnettle', 'oxalis', 'chickweed', 'stiltgrass', 'cannabis', 'nimblewill', 'moss']) };
async function bracketList(env, url) {
  const b = url.searchParams.get('b') || '';
  if (!BRACKET_IDS[b]) return bad('No such bracket.', 404);
  const { results } = await env.DB.prepare('SELECT pair, pick, COUNT(*) AS n FROM bracket_votes WHERE bracket = ? GROUP BY pair, pick').bind(b).all();
  const pairs = {}, champ = {};
  for (const r of results || []) { const t = r.pair === 'champ' ? champ : (pairs[r.pair] ||= {}); t[r.pick] = r.n; }
  const v = await env.DB.prepare('SELECT COUNT(DISTINCT device) AS n FROM bracket_votes WHERE bracket = ?').bind(b).first();
  return json({ pairs, champ, voters: v?.n || 0 }, 200, { 'cache-control': 'public, max-age=20' });
}
async function bracketVote(env, req) {
  const { b, pair, pick, device } = await req.json().catch(() => ({}));
  const ids = BRACKET_IDS[b];
  if (!ids) return bad('No such bracket.', 404);
  if (!isDevice(device)) return bad('Missing device.');
  if (!ids.has(pick)) return bad('Bad pick.');
  if (pair !== 'champ') {
    const parts = String(pair || '').split('~');
    if (parts.length !== 2 || parts[0] >= parts[1] || !parts.every((p) => ids.has(p)) || !parts.includes(pick)) return bad('Bad matchup.');
  }
  await env.DB.prepare(`INSERT INTO bracket_votes (bracket, pair, device, pick, at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (bracket, pair, device) DO UPDATE SET pick = excluded.pick, at = excluded.at`).bind(b, pair, device, pick, Date.now()).run();
  const { results } = await env.DB.prepare('SELECT pick, COUNT(*) AS n FROM bracket_votes WHERE bracket = ? AND pair = ? GROUP BY pick').bind(b, pair).all();
  return json({ pair, counts: Object.fromEntries((results || []).map((r) => [r.pick, r.n])) });
}

async function shortlinks(env) {
  if (!linkCache.map || Date.now() - linkCache.at > 60000) {
    const { results } = await env.DB.prepare('SELECT slug, target, permanent FROM shortlinks').all();
    linkCache = { at: Date.now(), map: Object.fromEntries(results.map((r) => [r.slug, r])) };
  }
  return linkCache.map;
}
async function shortRedirect(req, env, ctx, url) {
  // Short links are typed without a trailing slash (mowittall.com/water); /water/ would be a real page.
  if (url.pathname.endsWith('/')) return null;
  let slug = ''; try { slug = decodeURIComponent(url.pathname).replace(/^\/+/, '').toLowerCase(); } catch { return null; }
  if (!SLUG_RE.test(slug)) return null;
  const link = (await shortlinks(env))[slug];
  if (!link) return null;
  const to = new URL(link.target, url.origin);
  if (url.search && !to.search) to.search = url.search;   // pass utm tags etc. through
  ctx.waitUntil(env.DB.prepare('UPDATE shortlinks SET clicks = clicks + 1, last_click = ? WHERE slug = ?').bind(Date.now(), slug).run());
  return new Response(null, { status: link.permanent ? 301 : 302, headers: { location: to.toString(), 'cache-control': link.permanent ? 'public, max-age=3600' : 'no-store', 'x-robots-tag': 'noindex' } });
}

/* ---------- admin dashboard (/admin/) */
const PLATFORMS = ['instagram', 'facebook', 'nextdoor', 'x'];
async function dash(env, req, url) {
  if (!env.ADMIN_KEY) return bad('Set the ADMIN_KEY secret in Cloudflare first.', 503);
  const key = req.headers.get('x-admin-key') || url.searchParams.get('key');
  if (!isAdmin(env, key)) return bad('Wrong key.', 401);
  const p = url.pathname;
  if (p === '/api/admin/overview') {
    const week = Date.now() - 7 * 86400000;
    const [posts, votes, uploads, posted] = await env.DB.batch([
      env.DB.prepare('SELECT status, board, COUNT(*) n FROM posts GROUP BY status, board'),
      env.DB.prepare('SELECT COUNT(*) n, COUNT(DISTINCT device) voters FROM votes'),
      env.DB.prepare('SELECT COUNT(*) n FROM posts WHERE created > ? AND device IS NOT NULL').bind(week),
      env.DB.prepare('SELECT COUNT(*) n FROM social_log WHERE at > ?').bind(week),
    ]);
    return json({
      photos: posts.results, votes: votes.results[0], uploadsThisWeek: uploads.results[0].n, postedThisWeek: posted.results[0].n,
      // which outside services are hooked up (secrets set in the Cloudflare dashboard)
      connected: {
        gsc: !!env.GSC_SERVICE_ACCOUNT, ga4: !!(env.GA4_PROPERTY_ID && env.GSC_SERVICE_ACCOUNT), bing: !!env.BING_API_KEY,
        stripe: !!env.STRIPE_KEY, email: !!env.EMAIL_API_KEY,
      },
    });
  }
  if (p === '/api/admin/social' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, item, platform, at FROM social_log ORDER BY at DESC LIMIT 2000').all();
    return json({ log: results });
  }
  if (p === '/api/admin/social' && req.method === 'POST') {
    const { item, platform, action, id } = await req.json().catch(() => ({}));
    if (action === 'undo') { await env.DB.prepare('DELETE FROM social_log WHERE id = ?').bind(Number(id)).run(); return json({ ok: true }); }
    if (!PLATFORMS.includes(platform) || typeof item !== 'string' || !item || item.length > 120) return bad('Bad item.');
    const at = Date.now();
    const r = await env.DB.prepare('INSERT INTO social_log (item, platform, at) VALUES (?, ?, ?)').bind(item, platform, at).run();
    return json({ ok: true, id: r.meta.last_row_id, at });
  }
  /* ----- to-do list */
  if (p === '/api/admin/todos' && req.method === 'GET') {
    const [st, cu] = await env.DB.batch([
      env.DB.prepare('SELECT id, done_at, note FROM todo_state'),
      env.DB.prepare('SELECT id, grp, title, created FROM todo_custom ORDER BY created'),
    ]);
    return json({ playbook: PLAYBOOK, state: st.results, custom: cu.results });
  }
  if (p === '/api/admin/todos' && req.method === 'POST') {
    const { action, id, done, note, title, grp } = await req.json().catch(() => ({}));
    if (action === 'add') {
      const t = clean(title, 200); if (!t) return bad('Type something.');
      const nid = 'c-' + crypto.randomUUID().slice(0, 8);
      await env.DB.prepare('INSERT INTO todo_custom (id, grp, title, created) VALUES (?, ?, ?, ?)').bind(nid, clean(grp, 40) || 'mine', t, Date.now()).run();
      return json({ ok: true, id: nid });
    }
    if (typeof id !== 'string' || id.length > 60) return bad('Bad id.');
    if (action === 'remove') { await env.DB.batch([env.DB.prepare('DELETE FROM todo_custom WHERE id = ?').bind(id), env.DB.prepare('DELETE FROM todo_state WHERE id = ?').bind(id)]); return json({ ok: true }); }
    await env.DB.prepare(`INSERT INTO todo_state (id, done_at, note) VALUES (?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET done_at = excluded.done_at, note = COALESCE(excluded.note, todo_state.note)`)
      .bind(id, done ? Date.now() : null, note === undefined ? null : clean(note, 500)).run();
    return json({ ok: true });
  }
  /* ----- short links */
  if (p === '/api/admin/links' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM shortlinks ORDER BY updated DESC').all();
    return json({ links: results });
  }
  if (p === '/api/admin/links' && req.method === 'POST') {
    const { action, slug: raw, oldSlug, target, note, permanent } = await req.json().catch(() => ({}));
    const slug = String(raw || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
    linkCache.map = null;
    if (action === 'delete') { await env.DB.prepare('DELETE FROM shortlinks WHERE slug = ?').bind(slug).run(); return json({ ok: true }); }
    if (!SLUG_RE.test(slug)) return bad('Use lowercase letters, numbers and dashes (up to 40), like "measure" or "fall-seed".');
    if (RESERVED.has(slug)) return bad('That one is reserved by the site.');
    const t = String(target || '').trim();
    if (!/^\/(?!\/)/.test(t) && !/^https:\/\//.test(t)) return bad('Point it at a page on the site (starting with /) or a full https:// address.');
    if (t.length > 1000) return bad('That address is too long.');
    if (t.replace(/[?#].*$/, '').toLowerCase() === '/' + slug) return bad('That would redirect to itself. Add a slash at the end (/' + slug + '/) if it’s a page.');
    const now = Date.now();
    if (oldSlug && oldSlug !== slug) {
      const taken = await env.DB.prepare('SELECT slug FROM shortlinks WHERE slug = ?').bind(slug).first();
      if (taken) return bad('That short link already exists.');
      await env.DB.prepare('UPDATE shortlinks SET slug = ?, target = ?, note = ?, permanent = ?, updated = ? WHERE slug = ?').bind(slug, t, clean(note, 200), permanent ? 1 : 0, now, String(oldSlug)).run();
    } else {
      if (action === 'create') { const taken = await env.DB.prepare('SELECT slug FROM shortlinks WHERE slug = ?').bind(slug).first(); if (taken) return bad('That short link already exists. Edit it instead.'); }
      await env.DB.prepare(`INSERT INTO shortlinks (slug, target, note, permanent, created, updated) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (slug) DO UPDATE SET target = excluded.target, note = excluded.note, permanent = excluded.permanent, updated = excluded.updated`)
        .bind(slug, t, clean(note, 200), permanent ? 1 : 0, now, now).run();
    }
    return json({ ok: true, slug });
  }
  /* ----- first-party event log (worker/events.js) */
  if (p === '/api/admin/events/summary' && req.method === 'GET') return await summary(env, url);
  if (p === '/api/admin/events/export' && req.method === 'GET') return await exportRows(env, url);
  if (p === '/api/admin/events/rollup' && req.method === 'POST') {
    if (!env.EV) return bad('The events database isn’t set up yet.', 503);
    const { days } = await req.json().catch(() => ({}));
    await evInit(env.EV);
    const n = Math.min(Math.max(Number(days) || 3, 1), 400);
    for (let i = 0; i < n; i++) await rollup(env.EV, etDate(Date.now() - i * 86400000));
    return json({ ok: true, days: n });
  }
  /* ----- small saved settings/results */
  if (p === '/api/admin/kv' && req.method === 'GET') {
    const k = url.searchParams.get('k');
    const row = await env.DB.prepare('SELECT v, at FROM kv WHERE k = ?').bind(String(k)).first();
    return json({ k, v: row ? JSON.parse(row.v) : null, at: row ? row.at : null });
  }
  if (p === '/api/admin/kv' && req.method === 'POST') {
    const { k, v } = await req.json().catch(() => ({}));
    if (typeof k !== 'string' || !/^[a-z0-9:_-]{1,60}$/.test(k)) return bad('Bad key.');
    const txt = JSON.stringify(v ?? null);
    if (txt.length > 900_000) return bad('Too big to save.');
    await env.DB.prepare('INSERT INTO kv (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, txt, Date.now()).run();
    return json({ ok: true });
  }
  /* ----- rank tracker snapshots */
  if (p === '/api/admin/snaps' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) { const r = await env.DB.prepare('SELECT * FROM seo_snap WHERE id = ?').bind(Number(id)).first(); return json({ snap: r ? { ...r, rows: JSON.parse(r.rows) } : null }); }
    const { results } = await env.DB.prepare('SELECT id, source, label, kind, at, length(rows) size FROM seo_snap ORDER BY at DESC LIMIT 200').all();
    return json({ snaps: results });
  }
  if (p === '/api/admin/snaps' && req.method === 'POST') {
    const { action, id, source, label, kind, rows } = await req.json().catch(() => ({}));
    if (action === 'delete') { await env.DB.prepare('DELETE FROM seo_snap WHERE id = ?').bind(Number(id)).run(); return json({ ok: true }); }
    if (!Array.isArray(rows) || !rows.length) return bad('No rows found in that file.');
    const txt = JSON.stringify(rows.slice(0, 5000));
    if (txt.length > 1_800_000) return bad('That export is too big. Try a shorter date range.');
    const r = await env.DB.prepare('INSERT INTO seo_snap (source, label, kind, rows, at) VALUES (?, ?, ?, ?, ?)')
      .bind(clean(source, 20) || 'gsc', clean(label, 80), kind === 'pages' ? 'pages' : 'queries', txt, Date.now()).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  return bad('Not found.', 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    // The old workers.dev preview address forwards to the real domain (same path + query), so old links
    // keep working and Google only sees one copy. Static files skip the worker, but they're not pages.
    if (url.hostname.endsWith('.workers.dev') && (req.method === 'GET' || req.method === 'HEAD')) {
      return Response.redirect(`https://mowittall.com${url.pathname}${url.search}`, 301);
    }
    if (!url.pathname.startsWith('/api/')) {
      if (req.method === 'GET' || req.method === 'HEAD') {
        try { await init(env.DB); const r = await shortRedirect(req, env, ctx, url); if (r) return r; } catch { /* fall through to the page */ }
      }
      return env.ASSETS.fetch(req);
    }
    // First-party event log: no Hall database needed, never errors back to the page.
    if (url.pathname === '/api/e') return req.method === 'POST' ? await ingest(req, env, ctx).catch(() => new Response(null, { status: 204 })) : bad('Not found.', 404);
    // Read-only export for MikeCOS: EXPORT_KEY (if set) works here as well as the admin password.
    if (url.pathname === '/api/admin/events/export' && env.EXPORT_KEY && req.headers.get('x-export-key') === env.EXPORT_KEY) {
      try { return await exportRows(env, url); } catch { return json({ error: 'Something broke on our end.' }, 500); }
    }
    try {
      await init(env.DB);
      const p = url.pathname;
      if (p === '/api/hall' && req.method === 'GET') return await list(env, url);
      if (p === '/api/hall/vote' && req.method === 'POST') return await vote(env, req);
      if (p === '/api/hall/submit' && req.method === 'POST') return await submit(env, req);
      if (p.startsWith('/api/hall/img/') && req.method === 'GET') return await image(env, p.split('/').pop(), url);
      if (p === '/api/hall/admin') return await admin(env, req, url);
      if (p === '/api/bracket' && req.method === 'GET') return await bracketList(env, url);
      if (p === '/api/bracket/vote' && req.method === 'POST') return await bracketVote(env, req);
      if (p.startsWith('/api/admin/')) return await dash(env, req, url);
      return bad('Not found.', 404);
    } catch (e) {
      return json({ error: 'Something broke on our end. Try again in a minute.' }, 500);
    }
  },
  // Nightly (see "triggers" in wrangler.jsonc): rebuild the event log's daily tables for the last 3 days.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(nightly(env));
  },
};
