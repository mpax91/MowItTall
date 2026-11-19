// Post Grades A–F for Mow It Tall (Nov 19, 2026). Ported from the Bedford Bee grader in MikeCOS
// (worker/src/bee/grades.ts, Oct 14 2026) and adapted for a brand-new account that posts the same item on many
// platforms every day. Rule-based, no AI. Grades are computed on read; only settings, history and marks are stored.
//
// How a post's grade is made (same recipe as the Bee):
//  1. Age-matched: a young post's counts are projected to where a typical post ends up, using how past posts grew
//     (snapshots in social_post_snaps vs their final numbers). Until a post is `matureHours` old its grade is
//     PROVISIONAL and can move; under `minAgeHours` it's "Too Early".
//  2. Rolling baseline: the same platform's EARLIER posts from the `baselineDays` before it, recent ones weighted more
//     (half-life `halfLifeDays`), so a growing account is judged against its recent self. Medians and percentiles,
//     never averages, so one viral post doesn't sink everything after it.
//  3. Weighted signals: each metric → weighted percentile vs the baseline; composite = weighted mean (weights editable
//     in HQ → Social → Grades → Settings).
//  4. Letter = where the composite ranks among the baseline posts' own composites:
//     A top 10% · B 70–90th · C 35–70th · D 15–35th · F below.
//  Mow It Tall differences:
//   - Learning period: no letters until a platform has `minPosts` settled earlier posts. Posts from before that stay
//     ungraded for good ("posted before grading started"), because they went out to an audience of almost nobody.
//   - Site visits and sign-ups count: sessions (and leads) from that platform on the post's day and the next, from
//     the site's own event log (ev_sess).
//   - Drops: one calendar day's item across every platform it went to (sp_rows) gets a combined grade, the same way
//     the Bee grades a "story" across Facebook, Instagram and Substack.
//   - Items: each content item (blog post, guide, tool, weed…) keeps a record of every drop and its grade. That's what
//     the Content Calendar uses to bring winners back (encores) and rest the duds, and what "What Works" groups by.

const DAY = 86400000, HOUR = 3600000;
const TZ = 'America/New_York';
const etDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
const r1 = (n) => Math.round(n * 10) / 10;

export const PLATFORMS = ['facebook', 'instagram', 'threads', 'bluesky', 'pinterest', 'x', 'youtube', 'reddit'];
export const PNAME = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads', bluesky: 'Bluesky', pinterest: 'Pinterest', x: 'X', youtube: 'YouTube', reddit: 'Reddit' };
export const METRIC_LABELS = {
  seen: 'Reach / Views', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves', clicks: 'Link Clicks',
  rate: 'Engagement Rate', visits: 'Site Visits', leads: 'Sign-Ups', follows: 'New Followers',
};
const SEEN_LABEL = { facebook: 'Reach', instagram: 'Reach', threads: 'Views', pinterest: 'Impressions', x: 'Impressions', youtube: 'Views', reddit: 'Views' };
export const labelFor = (plat, key) => (key === 'seen' ? SEEN_LABEL[plat] || 'Views' : METRIC_LABELS[key] || key);
const COUNTS = ['seen', 'likes', 'comments', 'shares', 'saves', 'clicks'];
const RATES = new Set(['rate']);
// Metrics measured per day rather than per post (credited to the post that went out that day).
const DAILY = new Set(['visits', 'leads', 'follows']);

export const DEFAULT_CONFIG = {
  baselineDays: 90,
  halfLifeDays: 30,
  minAgeHours: 3,
  minPosts: 10,
  cutoffs: { A: 90, B: 70, C: 35, D: 15 },
  weights: {
    facebook: { seen: 20, likes: 10, comments: 15, shares: 15, clicks: 10, rate: 10, visits: 10, follows: 5, leads: 5 },
    instagram: { seen: 20, likes: 10, comments: 15, shares: 15, saves: 15, rate: 10, follows: 10, visits: 5 },
    threads: { seen: 25, likes: 20, comments: 25, shares: 20, visits: 10 },
    bluesky: { likes: 30, comments: 25, shares: 30, visits: 15 },
    pinterest: { seen: 25, saves: 35, clicks: 40 },
    x: { seen: 25, likes: 20, comments: 20, shares: 20, saves: 15 },
    youtube: { seen: 50, likes: 25, comments: 25 },
    reddit: { likes: 50, comments: 50 },
  },
  // How much each platform counts in a drop's combined grade.
  dropWeights: { facebook: 25, instagram: 25, threads: 15, bluesky: 10, pinterest: 15, x: 10, youtube: 0, reddit: 0 },
};
// Pinterest pins grow for months and YouTube for weeks; everything else is done in about a week.
const SHAPE = {
  social: { mature: 72, horizon: 14 * 24, curve: [{ h: 24, f: 0.75 }, { h: 72, f: 0.92 }, { h: 168, f: 0.98 }] },
  pinterest: { mature: 720, horizon: 89 * 24, curve: [{ h: 24, f: 0.04 }, { h: 72, f: 0.1 }, { h: 168, f: 0.2 }, { h: 720, f: 0.6 }] },
  youtube: { mature: 336, horizon: 60 * 24, curve: [{ h: 24, f: 0.3 }, { h: 72, f: 0.5 }, { h: 168, f: 0.7 }, { h: 336, f: 0.85 }] },
};
const shapeOf = (plat) => SHAPE[plat] || SHAPE.social;
export const matureHoursFor = (plat) => shapeOf(plat).mature;

const clampNum = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
/** Merge stored/posted settings over the defaults, clamping every number. */
export function cleanConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_CONFIG;
  const cut = { ...d.cutoffs, ...(r.cutoffs || {}) };
  const cutoffs = { A: clampNum(cut.A, 1, 99, d.cutoffs.A), B: clampNum(cut.B, 1, 99, d.cutoffs.B), C: clampNum(cut.C, 1, 99, d.cutoffs.C), D: clampNum(cut.D, 0, 99, d.cutoffs.D) };
  if (!(cutoffs.A > cutoffs.B && cutoffs.B > cutoffs.C && cutoffs.C > cutoffs.D)) throw new Error('Grade cutoffs must go down from A to D (e.g. 90 / 70 / 35 / 15).');
  const weights = {};
  for (const p of PLATFORMS) {
    weights[p] = {};
    for (const m of Object.keys(d.weights[p])) weights[p][m] = clampNum(r.weights?.[p]?.[m], 0, 100, d.weights[p][m]);
    if (!Object.values(weights[p]).some((w) => w > 0)) throw new Error(`At least one ${PNAME[p]} weight must be above 0.`);
  }
  const dropWeights = {};
  for (const p of PLATFORMS) dropWeights[p] = clampNum(r.dropWeights?.[p], 0, 100, d.dropWeights[p]);
  if (!Object.values(dropWeights).some((w) => w > 0)) throw new Error('At least one platform must count toward drop grades.');
  return {
    baselineDays: Math.round(clampNum(r.baselineDays, 14, 730, d.baselineDays)),
    halfLifeDays: Math.round(clampNum(r.halfLifeDays, 7, 365, d.halfLifeDays)),
    minAgeHours: clampNum(r.minAgeHours, 0, 48, d.minAgeHours),
    minPosts: Math.round(clampNum(r.minPosts, 3, 60, d.minPosts)),
    cutoffs, weights, dropWeights,
  };
}

/* ================================================================ storage */
let ready = null;
export async function gradesInit(db) {
  if (!ready) {
    ready = db.batch([
      // Every pull, while a post is still growing (15 days; Pinterest 90, YouTube 61): how the numbers grow.
      db.prepare(`CREATE TABLE IF NOT EXISTS social_post_snaps (platform TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, age_h REAL,
        seen REAL, likes REAL, comments REAL, shares REAL, saves REAL, clicks REAL, PRIMARY KEY (platform, id, at))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS social_grade_hist (kind TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, letter TEXT, rank REAL, score REAL,
        PRIMARY KEY (kind, id, at))`),
      db.prepare('CREATE INDEX IF NOT EXISTS social_grade_hist_at ON social_grade_hist (at)'),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
}
async function getS(db, k) { const r = await db.prepare('SELECT v FROM ax_state WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; }
async function setS(db, k, v) { await db.prepare('INSERT INTO ax_state (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now()).run(); }

export async function loadConfig(db) {
  const raw = await getS(db, 'grades:config').catch(() => null);
  if (!raw) return { config: DEFAULT_CONFIG, custom: false };
  try { return { config: cleanConfig(raw), custom: true }; } catch { return { config: DEFAULT_CONFIG, custom: false }; }
}
export async function saveConfig(db, raw) {
  if (raw == null) await db.prepare("DELETE FROM ax_state WHERE k = 'grades:config'").run();
  else await setS(db, 'grades:config', cleanConfig(raw));
  return loadConfig(db);
}
// Mike's marks per content item: 'rest' (never bring it back) or 'favorite' (always fine to bring back early).
export async function loadMarks(db) { return (await getS(db, 'grades:marks').catch(() => null)) || {}; }
export async function setMark(db, item, mark) {
  const marks = await loadMarks(db);
  if (mark === 'rest' || mark === 'favorite') marks[item] = { mark, at: Date.now() }; else delete marks[item];
  await setS(db, 'grades:marks', marks);
  return marks;
}

/** Called by worker/social.js after each platform's post list is saved. */
export async function snapPosts(db, platform, rows) {
  const now = Date.now();
  const keepH = shapeOf(platform).horizon + 24;
  const young = rows.filter((p) => p.created && now - p.created < keepH * HOUR);
  if (!young.length) return 0;
  await gradesInit(db);
  const n = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const list = young.map((p) => [platform, String(p.id), now, r1((now - p.created) / HOUR), n(p.reach ?? p.views ?? p.impressions), n(p.likes), n(p.comments), n(p.shares), n(p.saves), n(p.clicks)]);
  for (let i = 0; i < list.length; i += 50) {
    await db.prepare(`INSERT OR REPLACE INTO social_post_snaps (platform, id, at, age_h, seen, likes, comments, shares, saves, clicks)
      SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5, j.value->>6, j.value->>7, j.value->>8, j.value->>9 FROM json_each(?) j`)
      .bind(JSON.stringify(list.slice(i, i + 50))).run();
  }
  return list.length;
}

/* ================================================================ core math (same as the Bee) */
export function weightedPct(x, vals) {
  let below = 0, tie = 0, tot = 0;
  for (const { v, w } of vals) { tot += w; if (v < x) below += w; else if (v === x) tie += w; }
  return tot > 0 ? (below + tie / 2) / tot : 0.5;
}
export function weightedMedian(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a.v - b.v);
  const tot = s.reduce((n, x) => n + x.w, 0);
  let acc = 0;
  for (const x of s) { acc += x.w; if (acc >= tot / 2) return x.v; }
  return s[s.length - 1].v;
}
export const letterFor = (rank, c) => (rank >= c.A ? 'A' : rank >= c.B ? 'B' : rank >= c.C ? 'C' : rank >= c.D ? 'D' : 'F');
const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const MIN_WINDOW = 15;
const MIN_METRIC_VALUES = 5;
/** Earlier settled posts of the same series: inside the window, else the last 30 earlier ones. Never later posts:
 * a brand-new account's first posts would otherwise be judged against an audience they never had. */
export function baselineFor(item, sorted, cfg, matureH) {
  const earlier = sorted.filter((b) => b.key !== item.key && b.ageH >= matureH && b.t < item.t);
  const inWindow = earlier.filter((b) => b.t >= item.t - cfg.baselineDays * DAY);
  if (inWindow.length >= MIN_WINDOW) return inWindow;
  return earlier.slice(-30);
}

const fmtRatio = (r) => (r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1)}×`);
function whyText(d, good) {
  if (d.key === 'leads' && good && (d.value ?? 0) > 0) return `${Math.round(d.value)} sign-up${Math.round(d.value) === 1 ? '' : 's'} that day`;
  if (d.ratio != null && d.typical) {
    if (good && d.ratio >= 1.3) return `${d.label} ${fmtRatio(d.ratio)} typical`;
    if (!good && d.ratio <= 0.75) return `${d.label} ${fmtRatio(d.ratio)} typical`;
  }
  return good ? `${d.label} top ${Math.max(1, Math.round(100 - d.pct))}%` : `${d.label} bottom ${Math.max(1, Math.round(d.pct))}%`;
}

/** Stage 1: weighted-percentile composite for every item. */
export function composites(items, defs, cfg, matureH) {
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const out = new Map();
  for (const it of sorted) {
    const base = baselineFor(it, sorted, cfg, matureH);
    const wOf = (b) => Math.pow(0.5, Math.max(0, it.t - b.t) / (cfg.halfLifeDays * DAY));
    const drivers = [];
    for (const def of defs) {
      if (def.weight <= 0) continue;
      const v = it.values[def.key];
      if (v == null || !Number.isFinite(v)) continue;
      const vals = base.map((b) => ({ v: b.values[def.key], w: wOf(b) })).filter((x) => x.v != null && Number.isFinite(x.v));
      if (vals.length < MIN_METRIC_VALUES) continue;
      const pct = weightedPct(v, vals);
      const typical = weightedMedian(vals);
      drivers.push({ key: def.key, label: def.label, weight: def.weight, pct: r1(pct * 100), value: it.raw?.[def.key] ?? v, typical, ratio: typical && typical > 0 ? v / typical : null });
    }
    const wsum = drivers.reduce((n, d) => n + d.weight, 0);
    const score = wsum > 0 ? r1(drivers.reduce((n, d) => n + d.pct * d.weight, 0) / wsum) : null;
    out.set(it.key, { score, drivers, baseN: base.length });
  }
  return out;
}

/** Stage 2: rank each composite among its baseline's composites → letter (only once the baseline is big enough). */
export function rankAndGrade(items, cfg, matureH) {
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const out = new Map();
  for (const it of sorted) {
    const tooEarly = it.ageH < cfg.minAgeHours;
    const provisional = it.ageH < matureH;
    const base = baselineFor(it, sorted, cfg, matureH).filter((b) => b.score != null);
    const learning = base.length < cfg.minPosts;
    const wOf = (b) => Math.pow(0.5, Math.max(0, it.t - b.t) / (cfg.halfLifeDays * DAY));
    let rank = null;
    if (it.score != null && !learning) rank = r1(weightedPct(it.score, base.map((b) => ({ v: b.score, w: wOf(b) }))) * 100);
    const letter = rank == null || tooEarly ? null : letterFor(rank, cfg.cutoffs);
    const frac = it.ageH / matureH;
    const confidence = base.length < MIN_WINDOW || frac < 0.34 ? 'low' : frac < 1 ? 'medium' : 'high';
    out.set(it.key, { rank, letter, baselineN: base.length, provisional, tooEarly, learning, confidence });
  }
  return out;
}

function buildGrades(items, defs, cfg, matureH) {
  const comp = composites(items, defs, cfg, matureH);
  const ranked = rankAndGrade(items.map((i) => ({ key: i.key, t: i.t, ageH: i.ageH, score: comp.get(i.key)?.score ?? null })), cfg, matureH);
  const out = new Map();
  for (const it of items) {
    const c = comp.get(it.key), r = ranked.get(it.key);
    const contrib = (d) => (d.pct - 50) * d.weight;
    const goods = c.drivers.filter((d) => d.pct >= 60).sort((a, b) => contrib(b) - contrib(a) || (b.ratio ?? 0) - (a.ratio ?? 0));
    const bads = c.drivers.filter((d) => d.pct <= 40).sort((a, b) => contrib(a) - contrib(b) || (a.ratio ?? 9) - (b.ratio ?? 9));
    out.set(it.key, {
      letter: r.letter, score: c.score, rank: r.rank, provisional: r.provisional, tooEarly: r.tooEarly, learning: r.learning,
      ageHours: r1(it.ageH), confidence: r.confidence, baselineN: r.baselineN, projected: !!it.projected,
      drivers: c.drivers.sort((a, b) => b.weight - a.weight),
      best: goods[0] ? whyText(goods[0], true) : null, worst: bads[0] ? whyText(bads[0], false) : null,
      trend: null, prevLetter: null,
    });
  }
  return out;
}

/* ================================================================ growth curves */
/** Fraction of the final number a post has typically reached at `ageH`. */
export function growthAt(ageH, pts, horizonH) {
  if (ageH <= 0) return 0.05;
  const curve = [...pts].sort((a, b) => a.h - b.h);
  const first = curve[0];
  if (ageH <= first.h) return Math.max(0.02, first.f * Math.sqrt(ageH / first.h));
  const all = [...curve, { h: horizonH, f: 1 }];
  for (let i = 1; i < all.length; i++) {
    if (ageH <= all[i].h) { const a = all[i - 1], b = all[i]; return a.f + ((b.f - a.f) * (ageH - a.h)) / (b.h - a.h); }
  }
  return 1;
}
/** A post's value at age h from its snapshots (linear between the two around h; none if h is outside them). */
export function valueAt(snaps, key, h) {
  const s = snaps.filter((x) => x[key] != null).sort((a, b) => a.age_h - b.age_h);
  if (!s.length) return null;
  for (let i = 0; i < s.length; i++) {
    if (Math.abs(s[i].age_h - h) <= h * 0.15) return s[i][key];
    if (i && s[i - 1].age_h < h && s[i].age_h > h) { const a = s[i - 1], b = s[i]; return a[key] + ((b[key] - a[key]) * (h - a.age_h)) / (b.age_h - a.age_h); }
  }
  return null;
}
function fitCurves(plat, posts, snapsBy, nowMs) {
  const sh = shapeOf(plat);
  const settled = posts.filter((p) => nowMs - p.created >= sh.horizon * HOUR);
  const curves = {};
  for (const m of COUNTS) {
    const pts = sh.curve.map(({ h, f }) => {
      const fr = [];
      for (const p of settled) {
        const fin = p.values0[m];
        const v = valueAt(snapsBy.get(p.id) || [], m, h);
        if (v != null && fin != null && fin > 0) fr.push(Math.min(1, v / fin));
      }
      return { h, f: fr.length >= 8 ? median(fr) : f, fitted: fr.length >= 8 };
    });
    for (let i = 1; i < pts.length; i++) pts[i].f = Math.max(pts[i].f, pts[i - 1].f);
    curves[m] = pts;
  }
  return curves;
}

/* ================================================================ matching posts to the calendar */
const words = (t) => new Set(String(t || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 40));
const overlap = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.min(a.size, b.size); };
const tailId = (id) => String(id || '').split('_').pop();
// HQ → Social's old copy queue logs items as "slug" / "guide-x" / "tool-x"; the calendar uses bank ids.
const logItem = (s) => (s.startsWith('tool-') ? s : s.startsWith('guide-') ? `guides/${s.slice(6)}` : `blog/${s}`);

/** For each post: which calendar row (date, item, hook…) it was. Auto-posted rows match by id; copy-paste posts match
 * by platform + day (the calendar posts once a day per platform), with the text as the tie-break. */
export function matchPosts(posts, rows, log = []) {
  const byPlat = {};
  for (const r of rows) (byPlat[r.platform] ||= []).push(r);
  const out = new Map();
  for (const p of posts) {
    const list = byPlat[p.platform] || [];
    let row = list.find((r) => r.post_id && (String(r.post_id) === String(p.id) || tailId(r.post_id) === tailId(p.id))) || list.find((r) => r.post_url && p.url && r.post_url === p.url);
    let how = row ? 'posted' : null;
    if (!row) {
      const near = list.filter((r) => r.item && (r.date === p.date || r.date === addDays(p.date, -1)) && r.status !== 'skipped');
      if (near.length) {
        const pw = words(p.text);
        const scored = near.map((r) => ({ r, s: overlap(pw, words(r.text || r.title)) + (r.date === p.date ? 0.2 : 0) + (r.status === 'posted' || r.status === 'copied' ? 0.1 : 0) })).sort((a, b) => b.s - a.s);
        if (scored[0].s >= 0.3 || (near.length === 1 && near[0].date === p.date)) { row = scored[0].r; how = 'matched'; }
      }
    }
    if (row) { out.set(`${p.platform}:${p.id}`, { date: row.date, item: row.item, hook: row.hook ?? 0, slot: row.slot, label: row.label, how }); continue; }
    const l = log.find((x) => x.platform === p.platform && Math.abs(dayDiff(etDate(x.at), p.date)) <= 1);
    if (l) out.set(`${p.platform}:${p.id}`, { date: p.date, item: logItem(l.item), hook: 0, slot: 'queue', label: 'Post Queue', how: 'queue' });
  }
  return out;
}

/* ================================================================ data → grades */
// utm/referrer names each platform shows up as in the site's own log
const WEBSRC = { facebook: ['facebook', 'fb', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com', 'facebook.com'], instagram: ['instagram', 'ig', 'l.instagram.com', 'instagram.com'],
  threads: ['threads', 'threads.net', 'threads.com', 'l.threads.com'], bluesky: ['bluesky', 'bsky', 'bsky.app'], pinterest: ['pinterest', 'pinterest.com', 'pin.it'],
  x: ['x', 'twitter', 't.co', 'x.com'], youtube: ['youtube', 'youtube.com', 'm.youtube.com'], reddit: ['reddit', 'reddit.com', 'old.reddit.com', 'out.reddit.com'] };
const SRC2P = Object.fromEntries(Object.entries(WEBSRC).flatMap(([p, xs]) => xs.map((x) => [x, p])));
const FOLLOW_METRICS = { facebook: ['new_follows', 'follows'], instagram: ['follows', 'follows_and_unfollows'] };

/** Grade every post, every calendar drop and every content item. B = the content pool (plan.js bank), optional. */
export async function gradeAll(env, { B = null, nowMs = Date.now() } = {}) {
  const ev = env.EV;
  await gradesInit(ev);
  const { config: cfg, custom } = await loadConfig(ev);
  const q = (db, sql, ...a) => (db ? db.prepare(sql).bind(...a).all().then((r) => r.results || []).catch(() => []) : Promise.resolve([]));
  const since = etDate(nowMs - 400 * DAY);
  const [posts, snaps, days, sess, rows, log, marks] = await Promise.all([
    q(ev, 'SELECT platform, id, created, date, hour, dow, text, url, type, impressions, reach, views, likes, comments, shares, saves, clicks FROM social_posts WHERE created IS NOT NULL'),
    q(ev, 'SELECT platform, id, age_h, seen, likes, comments, shares, saves, clicks FROM social_post_snaps'),
    q(ev, "SELECT date, platform, metric, v FROM social_day WHERE metric IN ('new_follows', 'follows', 'follows_and_unfollows')"),
    q(ev, "SELECT date, LOWER(source) source, COUNT(*) n, SUM(COALESCE(leads, 0)) leads FROM ev_sess WHERE date >= ? AND (channel = 'Organic Social' OR medium = 'social') GROUP BY date, LOWER(source)", since),
    q(env.DB, "SELECT date, platform, slot, label, item, hook, title, text, status, post_id, post_url FROM sp_rows WHERE item IS NOT NULL AND date <= ?", etDate(nowMs)),
    q(env.DB, 'SELECT item, platform, at FROM social_log'),
    loadMarks(ev),
  ]);

  // Per-day signals
  const daily = new Map(); // `${plat}|${metric}|${date}` → v
  for (const d of days) {
    const pref = FOLLOW_METRICS[d.platform] || [];
    const k = `${d.platform}|follows|${d.date}`;
    const rank = pref.indexOf(d.metric);
    if (rank < 0) continue;
    const cur = daily.get(k + '#r');
    if (cur == null || rank < cur) { daily.set(k, d.v); daily.set(k + '#r', rank); }
  }
  for (const s of sess) {
    const p = SRC2P[s.source];
    if (!p) continue;
    daily.set(`${p}|visits|${s.date}`, (daily.get(`${p}|visits|${s.date}`) || 0) + s.n);
    daily.set(`${p}|leads|${s.date}`, (daily.get(`${p}|leads|${s.date}`) || 0) + (s.leads || 0));
  }
  const haveDaily = (p, m) => { for (const k of daily.keys()) if (k.startsWith(`${p}|${m}|`) && !k.endsWith('#r')) return true; return false; };
  // Posts go out mid-morning: credit the post with its own day and the next (averaged), like the Bee's follows.
  const perPostDay = (plat, metric, date, ageH, postsThatDay) => {
    if (ageH < 24) return null;
    const vals = [date, addDays(date, 1)].map((d) => daily.get(`${plat}|${metric}|${d}`)).filter((v) => v != null);
    if (!vals.length) return metric === 'follows' ? null : 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length / Math.max(1, postsThatDay);
  };

  const snapBy = new Map();
  for (const s of snaps) { const k = `${s.platform}|${s.id}`; (snapBy.get(k) || snapBy.set(k, []).get(k)).push(s); }
  const match = matchPosts(posts, rows, log);
  const postGrades = new Map(), postInfo = new Map(), curves = {}, learning = {};

  for (const plat of PLATFORMS) {
    const list = posts.filter((p) => p.platform === plat).map((p) => ({
      ...p, values0: { seen: p.reach ?? p.views ?? p.impressions ?? null, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves, clicks: p.clicks },
    }));
    if (!list.length) continue;
    const sh = shapeOf(plat);
    const mySnaps = new Map(list.map((p) => [p.id, snapBy.get(`${plat}|${p.id}`) || []]));
    curves[plat] = fitCurves(plat, list, mySnaps, nowMs);
    const perDay = {};
    for (const p of list) perDay[p.date] = (perDay[p.date] || 0) + 1;
    const weights = cfg.weights[plat] || {};
    const items = list.map((p) => {
      const t = p.created, ageH = Math.max(0, (nowMs - t) / HOUR);
      const raw = {}, values = {};
      let projected = false;
      for (const m of COUNTS) {
        if (!(m in weights) && m !== 'seen') continue;
        const v = p.values0[m];
        raw[m] = v;
        const g = ageH < sh.horizon ? growthAt(ageH, curves[plat][m], sh.horizon) : 1;
        if (v != null && g < 0.999) projected = true;
        values[m] = v == null ? null : v / g;
      }
      const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
      const seen = p.values0.seen;
      values.rate = raw.rate = seen && seen > 0 ? eng / seen : null;
      for (const m of DAILY) {
        if (!(m in weights) || !haveDaily(plat, m)) continue;
        values[m] = raw[m] = perPostDay(plat, m, p.date, ageH, perDay[p.date]);
      }
      return { key: `${plat}:${p.id}`, t, ageH, values, raw, projected };
    });
    const defs = Object.entries(weights).map(([key, weight]) => ({ key, weight, label: labelFor(plat, key) }));
    const g = buildGrades(items, defs, cfg, sh.mature);
    const settledN = items.filter((i) => i.ageH >= sh.mature).length;
    learning[plat] = { posts: list.length, settled: settledN, need: cfg.minPosts, graded: [...g.values()].filter((x) => x.letter).length };
    for (const p of list) {
      const k = `${plat}:${p.id}`;
      const gr = g.get(k);
      if (gr.learning && !gr.tooEarly) gr.note = settledN >= cfg.minPosts ? 'Posted before grading started (too few earlier posts to compare with).' : `Learning: grades start once ${PNAME[plat]} has ${cfg.minPosts} settled posts (${settledN} so far).`;
      postGrades.set(k, gr);
      postInfo.set(k, { platform: plat, id: p.id, date: p.date, hour: p.hour, dow: p.dow, created: p.created, text: p.text, url: p.url, type: p.type, link: match.get(k) || null,
        stats: { ...p.values0, eng: (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0) } });
    }
  }

  // ---- Drops: a calendar day's item across platforms (only posts linked to the calendar)
  const dropParts = new Map();
  for (const [k, info] of postInfo) {
    if (!info.link?.item) continue;
    const dk = `${info.link.date}|${info.link.item}`;
    (dropParts.get(dk) || dropParts.set(dk, []).get(dk)).push(k);
  }
  const dropItems = [];
  for (const [dk, keys] of dropParts) {
    const [date, item] = dk.split('|');
    let wsum = 0, acc = 0, provisional = false, t = Infinity;
    const parts = [];
    for (const k of keys) {
      const gr = postGrades.get(k), info = postInfo.get(k), w = cfg.dropWeights[info.platform] || 0;
      t = Math.min(t, info.created);
      parts.push({ key: k, platform: info.platform, letter: gr.letter, rank: gr.rank, score: gr.score, learning: gr.learning });
      if (gr.score == null || w <= 0) continue;
      wsum += w; acc += gr.score * w; provisional = provisional || gr.provisional;
    }
    const first = postInfo.get(keys[0]).link;
    dropItems.push({ key: dk, date, item, hook: first.hook, slot: first.slot, label: first.label, t, ageH: Math.max(0, (nowMs - t) / HOUR), score: wsum > 0 ? r1(acc / wsum) : null, provisional, parts });
  }
  const dropRank = rankAndGrade(dropItems, cfg, SHAPE.social.mature);
  const drops = dropItems.map((d) => {
    const r = dropRank.get(d.key);
    const best = [...d.parts].filter((x) => x.score != null).sort((a, b) => b.score - a.score)[0];
    const worst = [...d.parts].filter((x) => x.score != null).sort((a, b) => a.score - b.score)[0];
    const it = B?.byId?.[d.item];
    return {
      key: d.key, date: d.date, item: d.item, title: it?.title || d.item, kind: it?.kind || null, topics: it?.topics || [], months: it?.months || [], url: it?.url || null,
      hook: d.hook, hookText: it?.hooks?.[d.hook % Math.max(1, it?.hooks?.length || 1)] || null, slot: d.slot, label: d.label,
      letter: r.letter, rank: r.rank, score: d.score, provisional: d.provisional || r.provisional, tooEarly: r.tooEarly, learning: r.learning, confidence: r.confidence, baselineN: r.baselineN,
      best: best && best.score >= 60 && d.parts.length > 1 ? `Strongest on ${PNAME[best.platform]}` : null,
      worst: worst && worst.score <= 40 && d.parts.length > 1 ? `Weakest on ${PNAME[worst.platform]}` : null,
      parts: d.parts, dow: new Date(d.date + 'T12:00:00Z').getUTCDay(), month: Number(d.date.slice(5, 7)),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  // ---- Items: every drop of each content item
  const items = {};
  for (const d of drops) {
    const x = (items[d.item] ||= { item: d.item, title: d.title, kind: d.kind, url: d.url, months: d.months, runs: [] });
    x.runs.push({ date: d.date, letter: d.letter, rank: d.rank, hook: d.hook, provisional: d.provisional });
  }
  for (const x of Object.values(items)) {
    x.runs.sort((a, b) => a.date.localeCompare(b.date));
    const settled = x.runs.filter((r) => r.letter && !r.provisional);
    x.latest = settled.at(-1) || null;
    x.best = [...settled].sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1))[0] || null;
    x.avgRank = settled.length ? r1(settled.reduce((n, r) => n + (r.rank ?? 0), 0) / settled.length) : null;
    const last2 = settled.slice(-2);
    x.autoRest = last2.length === 2 && last2.every((r) => r.letter === 'D' || r.letter === 'F');
    x.mark = marks[x.item]?.mark || null;
    x.lastRun = x.runs.at(-1).date;
  }
  for (const [id, m] of Object.entries(marks)) if (!items[id]) items[id] = { item: id, title: B?.byId?.[id]?.title || id, kind: B?.byId?.[id]?.kind || null, url: B?.byId?.[id]?.url || null, months: B?.byId?.[id]?.months || [], runs: [], latest: null, best: null, avgRank: null, autoRest: false, mark: m.mark, lastRun: null };

  await attachTrends(ev, postGrades, nowMs).catch(() => null);
  return { config: cfg, custom, posts: postGrades, info: postInfo, drops, items, curves, learning, marks };
}

/* ================================================================ calendar signals */
/** What the planner needs per item: letter of its latest settled drop, encore/rest flags, last-year winners. */
export function plannerSignals(all) {
  const sig = new Map();
  for (const x of Object.values(all.items)) {
    sig.set(x.item, {
      letter: x.latest?.letter || null, rank: x.latest?.rank ?? null,
      rest: x.mark === 'rest' || (x.autoRest && x.mark !== 'favorite'), favorite: x.mark === 'favorite',
      goodDates: x.runs.filter((r) => (r.letter === 'A' || r.letter === 'B') && !r.provisional).map((r) => r.date),
    });
  }
  return sig;
}

/* ================================================================ What Works + Resurface */
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const KIND = { post: 'Blog Posts', guide: 'Guides', tool: 'Tools', weed: 'Weed Spotlights', tip: 'Monthly Tips', job: 'Lawn Jobs', month: 'Month Pages', moment: 'Holidays & Moments', engage: 'Questions', intro: 'Intro Posts' };
const hourBand = (h) => (h < 9 ? 'Early (before 9am)' : h < 12 ? 'Morning (9–noon)' : h < 15 ? 'Midday (noon–3pm)' : h < 18 ? 'Afternoon (3–6pm)' : 'Evening (after 6pm)');
const prettyType = (t) => String(t || 'post').replace(/_/g, ' ').replace(/^(added|shared) /, '').replace(/ post$/, '').replace(/\b\w/g, (c) => c.toUpperCase());

/** Groups of graded, settled drops (and posts, for format and time) with their average rank. */
export function whatWorks(all) {
  const drops = all.drops.filter((d) => d.letter && !d.provisional);
  const posts = [...all.posts].filter(([, g]) => g.letter && !g.provisional).map(([k, g]) => ({ g, info: all.info.get(k) }));
  const group = (list, keyFn, rankOf, letterOf) => {
    const m = new Map();
    for (const x of list) for (const k of [].concat(keyFn(x) || [])) { if (!k) continue; (m.get(k) || m.set(k, []).get(k)).push(x); }
    return [...m].map(([label, xs]) => ({ label, n: xs.length, avg: r1(xs.reduce((s, x) => s + rankOf(x), 0) / xs.length), good: Math.round((xs.filter((x) => 'AB'.includes(letterOf(x))).length / xs.length) * 100) }))
      .sort((a, b) => b.avg - a.avg);
  };
  const dR = (d) => d.rank ?? 0, dL = (d) => d.letter;
  const pR = (p) => p.g.rank ?? 0, pL = (p) => p.g.letter;
  const dims = [
    { id: 'kind', title: 'Type of Content', rows: group(drops, (d) => KIND[d.kind] || d.kind, dR, dL) },
    { id: 'topic', title: 'Topic', rows: group(drops, (d) => d.topics, dR, dL) },
    { id: 'slot', title: 'Calendar Slot', rows: group(drops, (d) => d.label?.split(' · ')[0], dR, dL) },
    { id: 'hook', title: 'Hook Version', rows: group(drops, (d) => `Hook ${(d.hook || 0) + 1}`, dR, dL) },
    { id: 'dow', title: 'Day of the Week', rows: group(drops, (d) => DOW[d.dow], dR, dL) },
    { id: 'month', title: 'Month', rows: group(drops, (d) => MON[d.month], dR, dL) },
    { id: 'format', title: 'Post Format', rows: group(posts, (p) => `${PNAME[p.info.platform]} · ${prettyType(p.info.type)}`, pR, pL) },
    { id: 'hour', title: 'Time Posted', rows: group(posts, (p) => hourBand(p.info.hour ?? 10), pR, pL) },
  ];
  const overall = drops.length ? r1(drops.reduce((s, d) => s + dR(d), 0) / drops.length) : posts.length ? r1(posts.reduce((s, p) => s + pR(p), 0) / posts.length) : null;
  // Plain-English takeaways: groups with 3+ graded drops that sit well above or below the overall average.
  const more = [], less = [];
  if (overall != null) for (const d of dims) for (const r of d.rows) {
    if (r.n < 3) continue;
    if (r.avg >= overall + 12) more.push({ dim: d.title, ...r });
    if (r.avg <= overall - 12) less.push({ dim: d.title, ...r });
  }
  more.sort((a, b) => b.avg - a.avg); less.sort((a, b) => a.avg - b.avg);
  return { overall, gradedDrops: drops.length, gradedPosts: posts.length, dims, more: more.slice(0, 5), less: less.slice(0, 5) };
}

/** Lists for "bring it back" decisions. reuse = plan.js REUSE (days per kind), hotReuse = the encore window. */
export function resurface(all, { today, reuse = {}, hotReuse = 75 } = {}) {
  const m = Number(today.slice(5, 7)), next = m % 12 + 1;
  const inSeason = (x) => !x.months?.length || x.months.includes(m) || x.months.includes(next);
  const xs = Object.values(all.items);
  const winner = (x) => x.best && 'AB'.includes(x.best.letter);
  const wait = (x) => (x.mark === 'favorite' || x.best?.letter === 'A' ? hotReuse : reuse[x.kind] || 365);
  const ready = xs.filter((x) => winner(x) && x.mark !== 'rest' && x.kind !== 'intro' && x.lastRun && dayDiff(x.lastRun, today) >= wait(x) && inSeason(x))
    .sort((a, b) => (b.best.rank ?? 0) - (a.best.rank ?? 0)).slice(0, 25)
    .map((x) => ({ ...x, daysSince: dayDiff(x.lastRun, today), why: x.best.letter === 'A' ? 'Got an A: encore after 75 days' : `Got a B and it’s in season` }));
  const soon = xs.filter((x) => winner(x) && x.mark !== 'rest' && x.kind !== 'intro' && x.lastRun && dayDiff(x.lastRun, today) < wait(x))
    .map((x) => ({ ...x, readyOn: addDays(x.lastRun, wait(x)) })).sort((a, b) => a.readyOn.localeCompare(b.readyOn)).slice(0, 25);
  const lastYear = xs.flatMap((x) => x.runs.filter((r) => r.letter && 'AB'.includes(r.letter) && !r.provisional && Math.abs(dayDiff(r.date, addDays(today, -365))) <= 30)
    .map((r) => ({ ...x, run: r }))).filter((x) => x.mark !== 'rest').sort((a, b) => (b.run.rank ?? 0) - (a.run.rank ?? 0)).slice(0, 25);
  const resting = xs.filter((x) => x.mark === 'rest' || (x.autoRest && x.mark !== 'favorite'))
    .map((x) => ({ ...x, why: x.mark === 'rest' ? 'You marked it Rest' : 'Last two runs got a D or F' }));
  const favorites = xs.filter((x) => x.mark === 'favorite');
  return { ready, soon, lastYear, resting, favorites };
}

/* ================================================================ history */
const HISTORY_DAYS = 14, RECORD_EVERY_H = 3;
async function attachTrends(db, posts, nowMs) {
  const { results } = await db.prepare("SELECT id, at, letter, rank FROM social_grade_hist WHERE kind = 'post' AND at >= ? ORDER BY at").bind(nowMs - HISTORY_DAYS * DAY).all();
  const by = new Map();
  for (const h of results || []) (by.get(h.id) || by.set(h.id, []).get(h.id)).push(h);
  for (const [k, g] of posts) {
    const hist = by.get(k);
    if (!hist?.length) continue;
    const prev = [...hist].reverse().find((h) => h.at <= nowMs - 2 * HOUR);
    if (!prev || prev.rank == null || g.rank == null) continue;
    g.prevLetter = prev.letter;
    const diff = g.rank - prev.rank;
    g.trend = diff >= 5 ? 'up' : diff <= -5 ? 'down' : 'flat';
  }
}
/** Hourly: store each young post's grade when the letter changed or every 3 hours (for the ↑/↓ trend arrows). */
export async function recordHistory(env, all, nowMs = Date.now()) {
  const db = env.EV;
  const { results } = await db.prepare("SELECT id, MAX(at) at, letter FROM social_grade_hist WHERE kind = 'post' AND at >= ? GROUP BY id").bind(nowMs - HISTORY_DAYS * DAY).all();
  const last = new Map((results || []).map((r) => [r.id, r]));
  const stmts = [];
  for (const [k, g] of all.posts) {
    if (g.ageHours > HISTORY_DAYS * 24 || g.rank == null) continue;
    const prev = last.get(k);
    const stale = !prev || nowMs - prev.at >= RECORD_EVERY_H * HOUR;
    if (!stale && prev?.letter === g.letter) continue;
    stmts.push(db.prepare('INSERT OR REPLACE INTO social_grade_hist (kind, id, at, letter, rank, score) VALUES (?, ?, ?, ?, ?, ?)').bind('post', k, nowMs, g.letter, g.rank, g.score));
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  await db.prepare('DELETE FROM social_grade_hist WHERE at < ?').bind(nowMs - 60 * DAY).run();
  // Snapshots are only needed until a post settles and its curve points are fitted (Pinterest takes 90 days).
  await db.prepare('DELETE FROM social_post_snaps WHERE at < ?').bind(nowMs - 120 * DAY).run();
  return { recorded: stmts.length };
}

export function gradeMix(grades) {
  const mix = { A: 0, B: 0, C: 0, D: 0, F: 0, pending: 0 };
  for (const g of grades) { if (!g) continue; if (g.letter) mix[g.letter]++; else mix.pending++; }
  return mix;
}
