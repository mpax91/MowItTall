// Social pulls for HQ Analytics (Nov 17, 2026): followers, daily reach/views/engagement, and per-post stats
// from every platform that offers it for free. Each platform is its own daily job (one failing never blocks
// the rest) and logs to ax_state 'runs' as social:<platform>.
//
// Tables (analytics database, EV):
//   social_snap        followers / posts / total views per platform per day (also typed in by hand on HQ → Social)
//   social_day         daily account metrics, long format: (date, platform, metric) → value (reach, views, …)
//   social_posts       one row per post with its latest stats (refreshed daily for 60 days after posting)
//
// Secrets (all optional; Cloudflare → Workers & Pages → mowittall → Settings → Variables and Secrets):
//   META_PAGE_TOKEN    never-expiring Facebook Page token from your own Meta app → Facebook + linked Instagram
//   THREADS_TOKEN      long-lived Threads token (60 days). HQ refreshes it weekly and keeps the fresh one in D1.
//   YT_API_KEY         YouTube Data API v3 key (YT_HANDLE default @MowItTALL)
//   BLUESKY_HANDLE     default mowittall.com (no key needed)
//   PINTEREST_TOKEN    Pinterest API v5 access token; with PINTEREST_REFRESH + PINTEREST_APP_ID + PINTEREST_APP_SECRET,
//                      HQ refreshes it itself (kept in D1)
//   REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USERNAME / REDDIT_PASSWORD   a Reddit "script" app; without
//                      them HQ tries Reddit's public JSON (often blocked from Cloudflare)
//   X_BEARER_TOKEN     X API bearer token. X charges for most reads now, so this runs once a week and only reads
//                      the profile + last 20 posts.

const TZ = 'America/New_York';
const DAY = 86400000;
const etParts = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
};
const etDate = (ms = Date.now()) => etParts(ms).date;
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const POST_DAYS = 60;
const isoSec = (d) => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ''); return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 9999; };

let ready = null;
export async function socialInit(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS social_day (date TEXT NOT NULL, platform TEXT NOT NULL, metric TEXT NOT NULL, v REAL, at INTEGER, PRIMARY KEY (date, platform, metric))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS social_posts (platform TEXT NOT NULL, id TEXT NOT NULL, created INTEGER, date TEXT, hour INTEGER, dow INTEGER,
        text TEXT, url TEXT, type TEXT, impressions REAL, reach REAL, views REAL, likes REAL, comments REAL, shares REAL, saves REAL, clicks REAL,
        extra TEXT, updated INTEGER, PRIMARY KEY (platform, id))`),
      db.prepare('CREATE INDEX IF NOT EXISTS social_posts_date ON social_posts (date)'),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* ---------------------------------------------------------------- storage helpers */
const snap = (db, date, platform, followers, posts = null, views = null) => db.prepare(`INSERT INTO social_snap (date, platform, followers, posts, views, auto, at) VALUES (?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT (date, platform) DO UPDATE SET followers = COALESCE(excluded.followers, followers), posts = COALESCE(excluded.posts, posts), views = COALESCE(excluded.views, views), auto = 1, at = excluded.at`)
  .bind(date, platform, num(followers), num(posts), num(views), Date.now()).run();
async function days(db, platform, rows) { // rows: [[date, metric, value]]
  const clean = rows.filter((r) => r[0] && r[1] && num(r[2]) != null).map((r) => [r[0], platform, r[1], num(r[2]), Date.now()]);
  if (!clean.length) return 0;
  await db.prepare(`INSERT OR REPLACE INTO social_day (date, platform, metric, v, at) SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4 FROM json_each(?) j`).bind(JSON.stringify(clean)).run();
  return clean.length;
}
async function posts(db, platform, list) {
  const rows = list.filter((p) => p.id && p.created).map((p) => {
    const t = etParts(p.created);
    return [platform, String(p.id), p.created, t.date, t.hour, t.dow, String(p.text || '').slice(0, 500), p.url || null, p.type || null,
      num(p.impressions), num(p.reach), num(p.views), num(p.likes), num(p.comments), num(p.shares), num(p.saves), num(p.clicks), p.extra ? JSON.stringify(p.extra) : null, Date.now()];
  });
  for (let i = 0; i < rows.length; i += 50) {
    await db.prepare(`INSERT OR REPLACE INTO social_posts (platform, id, created, date, hour, dow, text, url, type, impressions, reach, views, likes, comments, shares, saves, clicks, extra, updated)
      SELECT j.value->>0, j.value->>1, j.value->>2, j.value->>3, j.value->>4, j.value->>5, j.value->>6, j.value->>7, j.value->>8, j.value->>9, j.value->>10, j.value->>11,
      j.value->>12, j.value->>13, j.value->>14, j.value->>15, j.value->>16, j.value->>17, j.value->>18 FROM json_each(?) j`).bind(JSON.stringify(rows.slice(i, i + 50))).run();
  }
  return rows.length;
}
async function getS(db, k) { const r = await db.prepare('SELECT v FROM ax_state WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; }
async function setS(db, k, v) { await db.prepare('INSERT INTO ax_state (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), Date.now()).run(); }
async function getJSON(url, opts = {}) {
  const r = await fetch(url, opts);
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = null; }
  if (!r.ok || !j || j.error) {
    const msg = j?.error?.message || j?.message || j?.error_description || (typeof j?.error === 'string' ? j.error : '') || txt.slice(0, 160) || r.status;
    throw Object.assign(new Error(`${r.status}: ${msg}`), { status: r.status });
  }
  return j;
}
const base = (env, real, mock) => (env.SEO_API_BASE ? `${env.SEO_API_BASE}/${mock}` : real);
const firstRun = async (db, platform) => !(await db.prepare('SELECT 1 FROM social_day WHERE platform = ? LIMIT 1').bind(platform).first());

/* ---------------------------------------------------------------- Meta: Facebook Page + Instagram */
// Meta keeps renaming insight metrics, so each one is tried on its own the first time; the ones that work are
// remembered for a week (ax_state meta:ok:<scope>).
async function workingMetrics(db, scope, candidates, test) {
  const key = `meta:ok:${scope}`;
  const saved = await getS(db, key);
  if (saved && Date.now() - saved.at < 7 * DAY) return saved.list;
  const list = [];
  for (const m of candidates) { try { await test(m); list.push(m); } catch { /* not available */ } }
  await setS(db, key, { at: Date.now(), list });
  return list;
}
async function pullMeta(env, db) {
  const G = base(env, 'https://graph.facebook.com', 'meta');
  const tok = encodeURIComponent(env.META_PAGE_TOKEN);
  const me = await getJSON(`${G}/me?fields=id,name,followers_count,fan_count,instagram_business_account{id,username,followers_count,media_count}&access_token=${tok}`);
  const today = etDate();
  const out = [];
  await snap(db, today, 'facebook', me.followers_count ?? me.fan_count);
  out.push(`FB ${me.followers_count ?? me.fan_count} followers`);

  // Facebook daily insights
  const back = (await firstRun(db, 'facebook')) ? 28 : 3;
  const since = Math.floor((Date.now() - back * DAY) / 1000), until = Math.floor(Date.now() / 1000);
  const fbCand = ['page_impressions_unique', 'page_impressions', 'page_media_view', 'page_total_media_view_unique', 'page_post_engagements', 'page_views_total', 'page_follows', 'page_daily_follows_unique', 'page_video_views'];
  const fbOk = await workingMetrics(db, 'fb', fbCand, (m) => getJSON(`${G}/${me.id}/insights?metric=${m}&period=day&since=${since}&until=${until}&access_token=${tok}`));
  const NAME = { page_impressions_unique: 'reach', page_impressions: 'impressions', page_media_view: 'views', page_total_media_view_unique: 'viewers', page_post_engagements: 'engagements', page_views_total: 'profile_views', page_follows: 'follows', page_daily_follows_unique: 'new_follows', page_video_views: 'video_views' };
  if (fbOk.length) {
    const j = await getJSON(`${G}/${me.id}/insights?metric=${fbOk.join(',')}&period=day&since=${since}&until=${until}&access_token=${tok}`);
    const rows = [];
    for (const m of j.data || []) for (const v of m.values || []) rows.push([etDate(Date.parse(v.end_time) - DAY / 2), NAME[m.name] || m.name, typeof v.value === 'object' ? Object.values(v.value).reduce((a, b) => a + (Number(b) || 0), 0) : v.value]);
    out.push(`FB ${await days(db, 'facebook', rows)} daily values`);
  }
  // Facebook posts (last 60 days) with reactions/comments/shares + lifetime insights
  const fbPostCand = ['post_impressions_unique', 'post_impressions', 'post_media_view', 'post_total_media_view_unique', 'post_clicks'];
  const pj = await getJSON(`${G}/${me.id}/published_posts?fields=id,message,created_time,permalink_url,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&since=${Math.floor((Date.now() - POST_DAYS * DAY) / 1000)}&limit=50&access_token=${tok}`);
  const fbPosts = pj.data || [];
  let pOk = [];
  if (fbPosts.length) pOk = await workingMetrics(db, 'fbpost', fbPostCand, (m) => getJSON(`${G}/${fbPosts[0].id}/insights?metric=${m}&access_token=${tok}`));
  const PN = { post_impressions_unique: 'reach', post_impressions: 'impressions', post_media_view: 'views', post_total_media_view_unique: 'viewers', post_clicks: 'clicks' };
  const fbRows = [];
  for (const p of fbPosts) {
    const st = {};
    if (pOk.length) { try { const ins = await getJSON(`${G}/${p.id}/insights?metric=${pOk.join(',')}&access_token=${tok}`); for (const m of ins.data || []) st[PN[m.name]] = m.values?.[0]?.value; } catch { /* keep basics */ } }
    fbRows.push({ id: p.id, created: Date.parse(p.created_time), text: p.message, url: p.permalink_url, type: p.status_type, reach: st.reach, impressions: st.impressions, views: st.views, clicks: st.clicks,
      likes: p.reactions?.summary?.total_count, comments: p.comments?.summary?.total_count, shares: p.shares?.count || 0 });
  }
  out.push(`FB ${await posts(db, 'facebook', fbRows)} posts`);

  // Instagram (professional account linked to the Page)
  const ig = me.instagram_business_account;
  if (!ig) { out.push('Instagram: no professional account linked to the Page'); return out.join(' · '); }
  await snap(db, today, 'instagram', ig.followers_count, ig.media_count);
  out.push(`IG ${ig.followers_count} followers`);
  const igBack = (await firstRun(db, 'instagram')) ? 28 : 3;
  const igCand = ['reach', 'views', 'profile_views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'website_clicks', 'profile_links_taps', 'follows_and_unfollows'];
  const d0 = etDate();
  const range = (d) => ({ s: Math.floor(Date.parse(`${d}T05:00:00Z`) / 1000), u: Math.floor(Date.parse(`${addDays(d, 1)}T05:00:00Z`) / 1000) });
  const r1 = range(addDays(d0, -1));
  const igOk = await workingMetrics(db, 'ig', igCand, (m) => getJSON(`${G}/${ig.id}/insights?metric=${m}&period=day&metric_type=total_value&since=${r1.s}&until=${r1.u}&access_token=${tok}`));
  if (igOk.length) {
    const rows = [];
    for (let i = igBack; i >= 0; i--) {
      const d = addDays(d0, -i); const r = range(d);
      try {
        const j = await getJSON(`${G}/${ig.id}/insights?metric=${igOk.join(',')}&period=day&metric_type=total_value&since=${r.s}&until=${Math.min(r.u, Math.floor(Date.now() / 1000))}&access_token=${tok}`);
        for (const m of j.data || []) rows.push([d, m.name === 'profile_links_taps' ? 'link_clicks' : m.name === 'website_clicks' ? 'link_clicks' : m.name === 'total_interactions' ? 'engagements' : m.name, m.total_value?.value ?? m.values?.[0]?.value]);
      } catch { /* that day isn't ready */ }
    }
    out.push(`IG ${await days(db, 'instagram', rows)} daily values`);
  }
  // Instagram media
  const media = await getJSON(`${G}/${ig.id}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=50&access_token=${tok}`);
  const recent = (media.data || []).filter((m) => Date.now() - Date.parse(m.timestamp) < POST_DAYS * DAY || !m.timestamp);
  const igRows = [];
  for (const m of recent) {
    const st = {};
    for (const set of ['reach,views,likes,comments,shares,saved,total_interactions', 'reach,likes,comments,shares,saved', 'views']) {
      try { const ins = await getJSON(`${G}/${m.id}/insights?metric=${set}&access_token=${tok}`); for (const x of ins.data || []) st[x.name] = x.values?.[0]?.value ?? x.total_value?.value; break; } catch { /* try a smaller set */ }
    }
    igRows.push({ id: m.id, created: Date.parse(m.timestamp), text: m.caption, url: m.permalink, type: (m.media_product_type || m.media_type || '').toLowerCase(),
      reach: st.reach, views: st.views, likes: st.likes ?? m.like_count, comments: st.comments ?? m.comments_count, shares: st.shares, saves: st.saved });
  }
  // older posts keep their last stats; only basics refresh
  const older = (media.data || []).filter((m) => !recent.includes(m)).map((m) => ({ id: m.id, created: Date.parse(m.timestamp), text: m.caption, url: m.permalink, type: (m.media_product_type || m.media_type || '').toLowerCase(), likes: m.like_count, comments: m.comments_count }));
  const keep = new Set((await db.prepare("SELECT id FROM social_posts WHERE platform = 'instagram'").all()).results.map((r) => r.id));
  out.push(`IG ${await posts(db, 'instagram', [...igRows, ...older.filter((o) => !keep.has(o.id))])} posts`);
  return out.join(' · ');
}

/* ---------------------------------------------------------------- Threads */
async function threadsToken(env, db) {
  const saved = await getS(db, 'threads:token');
  let tok = saved?.token && saved.from === env.THREADS_TOKEN.slice(-12) ? saved.token : env.THREADS_TOKEN;
  // Long-lived tokens last 60 days; refresh weekly (allowed once the token is a day old).
  if (!saved || saved.from !== env.THREADS_TOKEN.slice(-12) || Date.now() - saved.at > 7 * DAY) {
    try {
      const j = await getJSON(`${base(env, 'https://graph.threads.net', 'threads')}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(tok)}`);
      if (j.access_token) { tok = j.access_token; await setS(db, 'threads:token', { token: tok, at: Date.now(), from: env.THREADS_TOKEN.slice(-12) }); }
    } catch { /* still good for now */ }
  }
  return tok;
}
async function pullThreads(env, db) {
  const T = `${base(env, 'https://graph.threads.net', 'threads')}/v1.0`;
  const tok = encodeURIComponent(await threadsToken(env, db));
  const today = etDate(), out = [];
  const back = (await firstRun(db, 'threads')) ? 28 : 3;
  const since = Math.floor((Date.now() - back * DAY) / 1000), until = Math.floor(Date.now() / 1000);
  const fc = await getJSON(`${T}/me/threads_insights?metric=followers_count&access_token=${tok}`);
  const fol = fc.data?.[0]?.total_value?.value;
  await snap(db, today, 'threads', fol); out.push(`${fol} followers`);
  const rows = [];
  const vj = await getJSON(`${T}/me/threads_insights?metric=views&since=${since}&until=${until}&access_token=${tok}`);
  for (const m of vj.data || []) for (const v of m.values || []) rows.push([etDate(Date.parse(v.end_time) - DAY / 2), 'views', v.value]);
  // likes / replies / reposts / quotes only come as totals, so ask one day at a time (yesterday and today)
  for (let i = Math.min(back, 7); i >= 0; i--) {
    const d = addDays(today, -i);
    const s0 = Math.floor(Date.parse(`${d}T05:00:00Z`) / 1000), u0 = Math.min(Math.floor(Date.parse(`${addDays(d, 1)}T05:00:00Z`) / 1000), until);
    try { const tj = await getJSON(`${T}/me/threads_insights?metric=likes,replies,reposts,quotes&since=${s0}&until=${u0}&access_token=${tok}`); for (const m of tj.data || []) rows.push([d, m.name, m.total_value?.value]); } catch { /* not ready */ }
  }
  out.push(`${await days(db, 'threads', rows)} daily values`);
  const list = await getJSON(`${T}/me/threads?fields=id,text,timestamp,permalink,media_type&since=${Math.floor((Date.now() - POST_DAYS * DAY) / 1000)}&limit=50&access_token=${tok}`);
  const pr = [];
  for (const p of list.data || []) {
    const st = {};
    try { const ins = await getJSON(`${T}/${p.id}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${tok}`); for (const x of ins.data || []) st[x.name] = x.values?.[0]?.value ?? x.total_value?.value; } catch { /* reposts of others have none */ }
    pr.push({ id: p.id, created: Date.parse(p.timestamp), text: p.text, url: p.permalink, type: (p.media_type || '').toLowerCase(), views: st.views, likes: st.likes, comments: st.replies, shares: (st.reposts || 0) + (st.quotes || 0) + (st.shares || 0) });
  }
  out.push(`${await posts(db, 'threads', pr)} posts`);
  return out.join(' · ');
}

/* ---------------------------------------------------------------- YouTube */
async function pullYouTube(env, db) {
  const Y = base(env, 'https://www.googleapis.com/youtube/v3', 'yt');
  const key = encodeURIComponent(env.YT_API_KEY);
  const ch = await getJSON(`${Y}/channels?part=statistics,contentDetails&forHandle=${encodeURIComponent(env.YT_HANDLE || '@MowItTALL')}&key=${key}`);
  const c = ch.items?.[0];
  if (!c) throw new Error('channel not found');
  const st = c.statistics, today = etDate();
  // daily views = change in the channel's lifetime view count since the last pull
  const prev = await db.prepare("SELECT date, views FROM social_snap WHERE platform = 'youtube' AND views IS NOT NULL AND date < ? ORDER BY date DESC LIMIT 1").bind(today).first();
  await snap(db, today, 'youtube', st.hiddenSubscriberCount ? null : st.subscriberCount, st.videoCount, st.viewCount);
  if (prev) await days(db, 'youtube', [[today, 'views', Math.max(0, Number(st.viewCount) - prev.views)]]);
  const up = c.contentDetails?.relatedPlaylists?.uploads;
  let n = 0;
  if (up) {
    // A brand-new channel's uploads playlist doesn't exist until the first upload (YouTube answers 404): that's 0 videos, not an error.
    const pl = await getJSON(`${Y}/playlistItems?part=contentDetails&playlistId=${up}&maxResults=50&key=${key}`)
      .catch((e) => { if (e.status === 404 && Number(st.videoCount || 0) === 0) return { items: [] }; throw e; });
    const ids = (pl.items || []).map((i) => i.contentDetails.videoId).filter(Boolean);
    if (ids.length) {
      const v = await getJSON(`${Y}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${key}`);
      n = await posts(db, 'youtube', (v.items || []).map((x) => ({ id: x.id, created: Date.parse(x.snippet.publishedAt), text: x.snippet.title, url: `https://www.youtube.com/watch?v=${x.id}`,
        type: isoSec(x.contentDetails?.duration) <= 180 ? 'short' : 'video',
        views: x.statistics.viewCount, likes: x.statistics.likeCount, comments: x.statistics.commentCount })));
    }
  }
  return `${st.subscriberCount} subscribers · ${n} videos`;
}

/* ---------------------------------------------------------------- Bluesky */
async function pullBluesky(env, db) {
  const B = base(env, 'https://public.api.bsky.app/xrpc', 'bsky');
  const h = env.BLUESKY_HANDLE || 'mowittall.com';
  const p = await getJSON(`${B}/app.bsky.actor.getProfile?actor=${encodeURIComponent(h)}`);
  await snap(db, etDate(), 'bluesky', p.followersCount, p.postsCount);
  const feed = await getJSON(`${B}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(h)}&limit=100&filter=posts_no_replies`);
  const list = (feed.feed || []).filter((f) => f.post?.author?.did === p.did && !f.reason).map((f) => ({
    id: f.post.uri, created: Date.parse(f.post.record?.createdAt || f.post.indexedAt), text: f.post.record?.text, url: `https://bsky.app/profile/${h}/post/${f.post.uri.split('/').pop()}`,
    type: f.post.embed?.$type?.includes('images') ? 'image' : f.post.embed?.$type?.includes('video') ? 'video' : f.post.embed?.$type?.includes('external') ? 'link' : 'text',
    likes: f.post.likeCount, comments: f.post.replyCount, shares: (f.post.repostCount || 0) + (f.post.quoteCount || 0) }));
  return `${p.followersCount} followers · ${await posts(db, 'bluesky', list)} posts`;
}

/* ---------------------------------------------------------------- Pinterest */
async function pinterestToken(env, db) {
  const saved = await getS(db, 'pinterest:token');
  const fresh = saved && saved.from === String(env.PINTEREST_TOKEN).slice(-12);
  let tok = fresh ? saved.token : env.PINTEREST_TOKEN;
  const refresh = fresh ? saved.refresh : env.PINTEREST_REFRESH;
  if (refresh && env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET && (!fresh || Date.now() > saved.exp - 5 * DAY)) {
    const j = await getJSON(`${base(env, 'https://api.pinterest.com', 'pin')}/v5/oauth/token`, { method: 'POST', headers: { authorization: `Basic ${btoa(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}` }).catch(() => null);
    if (j?.access_token) { tok = j.access_token; await setS(db, 'pinterest:token', { token: tok, refresh: j.refresh_token || refresh, exp: Date.now() + (j.expires_in || 2592000) * 1000, from: String(env.PINTEREST_TOKEN).slice(-12) }); }
  }
  return tok;
}
async function pullPinterest(env, db) {
  const P = `${base(env, 'https://api.pinterest.com', 'pin')}/v5`;
  const H = { headers: { authorization: `Bearer ${await pinterestToken(env, db)}` } };
  const today = etDate(), out = [];
  const acct = await getJSON(`${P}/user_account`, H);
  await snap(db, today, 'pinterest', acct.follower_count, acct.pin_count, acct.monthly_views);
  out.push(`${acct.follower_count} followers`);
  const back = (await firstRun(db, 'pinterest')) ? 89 : 5;
  const M = 'IMPRESSION,ENGAGEMENT,PIN_CLICK,OUTBOUND_CLICK,SAVE';
  const an = await getJSON(`${P}/user_account/analytics?start_date=${addDays(today, -back)}&end_date=${addDays(today, -1)}&metric_types=${M}`, H);
  const NAME = { IMPRESSION: 'impressions', ENGAGEMENT: 'engagements', PIN_CLICK: 'pin_clicks', OUTBOUND_CLICK: 'link_clicks', SAVE: 'saves' };
  const rows = [];
  for (const d of an.all?.daily_metrics || []) if (d.data_status === 'READY' || !d.data_status) for (const [k, v] of Object.entries(d.metrics || {})) rows.push([d.date, NAME[k] || k.toLowerCase(), v]);
  out.push(`${await days(db, 'pinterest', rows)} daily values`);
  // pins created in the last 90 days, with their 90-day totals
  const pins = await getJSON(`${P}/pins?page_size=100`, H);
  const recent = (pins.items || []).filter((p) => Date.now() - Date.parse(p.created_at + (p.created_at.endsWith('Z') ? '' : 'Z')) < 89 * DAY);
  const pr = [];
  for (const p of recent) {
    let s = {};
    try { const a = await getJSON(`${P}/pins/${p.id}/analytics?start_date=${addDays(today, -89)}&end_date=${addDays(today, -1)}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`, H); s = a.all?.summary_metrics || {}; } catch { /* too new */ }
    pr.push({ id: p.id, created: Date.parse(p.created_at + (p.created_at.endsWith('Z') ? '' : 'Z')), text: p.title || p.description, url: `https://www.pinterest.com/pin/${p.id}/`, type: p.media?.media_type || 'pin',
      impressions: s.IMPRESSION, saves: s.SAVE, clicks: (s.PIN_CLICK || 0) + (s.OUTBOUND_CLICK || 0), extra: { link: p.link, outbound: s.OUTBOUND_CLICK, pin_clicks: s.PIN_CLICK } });
  }
  out.push(`${await posts(db, 'pinterest', pr)} pins`);
  return out.join(' · ');
}

/* ---------------------------------------------------------------- Reddit */
async function pullReddit(env, db) {
  const user = env.REDDIT_USERNAME || 'MowItTALL';
  const UA = `cloudflare-worker:mowittall-hq:1.0 (by /u/${user})`;
  let R = 'https://www.reddit.com', H = { headers: { 'user-agent': UA } }, sfx = '.json';
  if (env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_PASSWORD) {
    const t = await getJSON(`${base(env, 'https://www.reddit.com', 'reddit')}/api/v1/access_token`, { method: 'POST', headers: { authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
      body: `grant_type=password&username=${encodeURIComponent(user)}&password=${encodeURIComponent(env.REDDIT_PASSWORD)}` });
    R = 'https://oauth.reddit.com'; H = { headers: { authorization: `Bearer ${t.access_token}`, 'user-agent': UA } }; sfx = '';
  }
  R = base(env, R, 'reddit');
  const about = (await getJSON(`${R}/user/${user}/about${sfx}`, H)).data || {};
  const today = etDate();
  await snap(db, today, 'reddit', about.subreddit?.subscribers ?? null, null, null);
  await days(db, 'reddit', [[today, 'karma', about.total_karma ?? (about.link_karma || 0) + (about.comment_karma || 0)]]);
  const sub = await getJSON(`${R}/user/${user}/submitted${sfx}?limit=100&sort=new`, H);
  const list = (sub.data?.children || []).map((c) => c.data).map((p) => ({ id: p.name, created: p.created_utc * 1000, text: `r/${p.subreddit}: ${p.title}`, url: `https://www.reddit.com${p.permalink}`,
    type: p.is_self ? 'text' : p.post_hint || 'link', views: p.view_count, likes: p.score, comments: p.num_comments, extra: { upvote_ratio: p.upvote_ratio, subreddit: p.subreddit } }));
  return `${about.total_karma ?? '?'} karma · ${await posts(db, 'reddit', list)} posts`;
}

/* ---------------------------------------------------------------- X */
async function pullX(env, db) {
  const X = base(env, 'https://api.x.com/2', 'x');
  const H = { headers: { authorization: `Bearer ${env.X_BEARER_TOKEN}` } };
  const u = (await getJSON(`${X}/users/by/username/${(env.X_HANDLE || 'MowItTALL').replace('@', '')}?user.fields=public_metrics`, H)).data;
  await snap(db, etDate(), 'x', u.public_metrics?.followers_count, u.public_metrics?.tweet_count);
  let n = 0;
  try {
    const t = await getJSON(`${X}/users/${u.id}/tweets?max_results=20&exclude=retweets,replies&tweet.fields=created_at,public_metrics`, H);
    n = await posts(db, 'x', (t.data || []).map((p) => ({ id: p.id, created: Date.parse(p.created_at), text: p.text, url: `https://x.com/i/status/${p.id}`, type: 'post',
      impressions: p.public_metrics?.impression_count, likes: p.public_metrics?.like_count, comments: p.public_metrics?.reply_count, shares: (p.public_metrics?.retweet_count || 0) + (p.public_metrics?.quote_count || 0), saves: p.public_metrics?.bookmark_count })));
  } catch (e) { return `${u.public_metrics?.followers_count} followers (posts: ${e.message})`; }
  return `${u.public_metrics?.followers_count} followers · ${n} posts`;
}

/* ---------------------------------------------------------------- schedule */
export const SOCIAL_SOURCES = [
  ['meta', 'Facebook + Instagram', (env) => !!env.META_PAGE_TOKEN, pullMeta, 20],
  ['threads', 'Threads', (env) => !!env.THREADS_TOKEN, pullThreads, 20],
  ['youtube', 'YouTube', (env) => !!env.YT_API_KEY, pullYouTube, 20],
  ['bluesky', 'Bluesky', () => true, pullBluesky, 20],
  ['pinterest', 'Pinterest', (env) => !!env.PINTEREST_TOKEN, pullPinterest, 20],
  // Reddit blocks Cloudflare's servers without an app login (and no longer hands out API keys), so only try with the REDDIT_* secrets.
  ['reddit', 'Reddit', (env) => !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_PASSWORD), pullReddit, 20],
  ['x', 'X', (env) => !!env.X_BEARER_TOKEN, pullX, 24 * 7 - 1],
];
// step(task, fn) and due(task, hours) come from ax.js so runs are logged in one place.
export async function socialTick(env, step, due) {
  await socialInit(env.EV);
  for (const [id, , on, fn, every] of SOCIAL_SOURCES) {
    if (!on(env) || !due(`social:${id}`, every)) continue;
    await step(`social:${id}`, () => fn(env, env.EV));
  }
}
export const socialStatus = (env) => Object.fromEntries(SOCIAL_SOURCES.map(([id, , on]) => [id, on(env)]));
