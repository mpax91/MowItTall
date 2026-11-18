// Game leaderboards (Nov 17, 2026). One board per game, initials only (1-3 letters/numbers), no accounts.
// Scores are worked out in the browser, so this can't stop a determined cheater; it just keeps the boards
// sane: per-game score caps, a daily cap per phone, and a short blocklist for rude initials.
// Table lives in the Hall database (binding DB), created in index.js init().

export const GAMES = {
  hero_stripe: { name: 'Stripe This Lawn', max: 100 },
  stripe_game: { name: 'Stripe It Straight', max: 1000 },
  whack_a_weed: { name: 'Whack-a-Weed', max: 2000 },
};
const LEVELS = new Set(['starter', 'victorian', 'backyard', 'ballpark', 'club', 'halloween', 'thanksgiving', 'christmas']);
const MAX_SAVES_PER_DAY = 40;
const TOP = 25;
// Rude three-letter combos people love to put on arcade boards. Blocked ones get a polite error.
const BLOCK = new Set(['ASS', 'FUK', 'FUC', 'FCK', 'FKU', 'SHT', 'CUM', 'COK', 'KKK', 'NIG', 'NGR', 'FAG', 'DIK', 'DIC', 'TIT', 'SEX', 'POO', 'PEE', 'WTF', 'STD', 'GAY', 'JEW', 'NAZ', 'HOE', 'CNT', 'KUM', 'XXX', 'PUS', 'VAG', 'DCK', 'JIZ', 'GOD', 'HIV', 'SUK', 'SUX', 'BCH', 'FAP', 'PRN', 'NUT', 'KYS', 'LSD', 'THC', 'ISIS', 'ISI']);

export const SCORES_TABLE = `CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, level TEXT, initials TEXT NOT NULL,
  score INTEGER NOT NULL, device TEXT, created INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0)`;
export const SCORES_INDEX = `CREATE INDEX IF NOT EXISTS scores_board ON scores (game, hidden, score DESC, created)`;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const isDevice = (d) => typeof d === 'string' && /^[a-z0-9-]{8,64}$/i.test(d);
const pub = (r, rank) => ({ id: r.id, initials: r.initials, score: r.score, level: r.level || null, created: r.created, rank });

// Rank = 1 + number of visible scores strictly higher; ties share a rank, earlier score listed first.
async function rankOf(env, game, score) {
  const r = await env.DB.prepare('SELECT COUNT(*) n FROM scores WHERE game = ? AND hidden = 0 AND score > ?').bind(game, score).first();
  return (r?.n || 0) + 1;
}

export async function scoresList(env, url) {
  const game = url.searchParams.get('game') || '';
  if (!GAMES[game]) return bad('No such game.', 404);
  const { results } = await env.DB.prepare('SELECT id, initials, score, level, created FROM scores WHERE game = ? AND hidden = 0 ORDER BY score DESC, created ASC LIMIT ?').bind(game, TOP).all();
  const rows = [];
  let prevScore = null, prevRank = 0;
  (results || []).forEach((r, i) => { const rank = r.score === prevScore ? prevRank : i + 1; prevScore = r.score; prevRank = rank; rows.push(pub(r, rank)); });
  const total = (await env.DB.prepare('SELECT COUNT(*) n FROM scores WHERE game = ? AND hidden = 0').bind(game).first())?.n || 0;
  let mine = null;
  const id = parseInt(url.searchParams.get('id'), 10);
  if (id) {
    const r = await env.DB.prepare('SELECT id, initials, score, level, created FROM scores WHERE id = ? AND game = ? AND hidden = 0').bind(id, game).first();
    if (r) mine = pub(r, await rankOf(env, game, r.score));
  }
  return json({ game, name: GAMES[game].name, total, rows, mine }, 200, id ? {} : { 'cache-control': 'public, max-age=15' });
}

export async function scoresSave(env, req) {
  const body = await req.json().catch(() => ({}));
  const game = String(body.game || '');
  const g = GAMES[game];
  if (!g) return bad('No such game.', 404);
  if (!isDevice(body.device)) return bad('Missing device.');
  const initials = String(body.initials || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (!initials) return bad('Add your initials (up to 3 letters).');
  if (BLOCK.has(initials)) return bad('Let’s keep the board family-friendly. Try different initials.');
  const score = Math.round(Number(body.score));
  if (!Number.isFinite(score) || score < 0 || score > g.max) return bad('That score doesn’t look right.');
  const level = game === 'stripe_game' && LEVELS.has(body.level) ? body.level : null;
  const dayAgo = Date.now() - 86400000;
  const recent = await env.DB.prepare('SELECT COUNT(*) n FROM scores WHERE device = ? AND created > ?').bind(body.device, dayAgo).first();
  if ((recent?.n || 0) >= MAX_SAVES_PER_DAY) return bad('That’s a lot of saved scores for one day. Try again tomorrow.', 429);
  const r = await env.DB.prepare('INSERT INTO scores (game, level, initials, score, device, created) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(game, level, initials, score, body.device, Date.now()).run();
  const id = r.meta.last_row_id;
  return json({ ok: true, id, rank: await rankOf(env, game, score) });
}

// HQ: hide or unhide a score (rude initials that slip through, obvious cheats). POST { id, hidden: 1|0 }.
export async function scoresAdmin(env, req) {
  if (req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, game, level, initials, score, created, hidden FROM scores ORDER BY created DESC LIMIT 200').all();
    return json({ rows: results || [] });
  }
  const { id, hidden } = await req.json().catch(() => ({}));
  await env.DB.prepare('UPDATE scores SET hidden = ? WHERE id = ?').bind(hidden ? 1 : 0, parseInt(id, 10) || 0).run();
  return json({ ok: true });
}
