// HQ Analytics sections. Each view writes its grid of cards, then fills each card from the shared blocks in core.js.
import {
  S, Q, api, period, timeline, seriesOf, GAPPY, one, card, body, errBox, chips, onSeg, setSub, kpis, trend, stackTrend, bars, table, openDrill,
  esc, fmt, dlabel, col, mLabel, mKind, dLabel, delta, cmpLabel, clearCache, go, SESS_DIMS, addFilter,
} from './core.js';
import { lineChart, barList, heatmap, funnel, stackedBars } from './charts.js';

const SITE = 'https://mowittall.com';
const LEVELS = ['Couch Potato', 'Good Enough Guy', 'Curb Appeal Hunter', 'Lawn Psycho'];
const pageLink = (p) => (p && p.startsWith('/') ? SITE + p : null);
const PLATFORMS = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['threads', 'Threads'], ['x', 'X'], ['pinterest', 'Pinterest'], ['bluesky', 'Bluesky'], ['reddit', 'Reddit'], ['nextdoor', 'Nextdoor'], ['tiktok', 'TikTok']];
const PNAME = Object.fromEntries(PLATFORMS);
const spotName = (v) => ({ quiz: 'Quiz results', nudge: '“Email me my plan” bar', measure: 'Measure Your Yard' }[v] || v);
const grid = (html) => `<div class="ax-grid">${html}</div>`;
const run = (...ps) => Promise.allSettled(ps);

/* ---------------------------------------------------------------- setup notes for sources that aren't connected */
const SECRET = 'Cloudflare → Workers &amp; Pages → mowittall → Settings → Variables and Secrets → Add (type: Secret)';
export function setupHTML(src) {
  const st = S.status?.sources || {};
  const steps = {
    search: `<ol><li>Search Console: in Google Cloud, make a service account, download its JSON key, and add its email as a user in Search Console (Restricted is enough).</li>
      <li>Save the whole JSON as the secret <code>GSC_SERVICE_ACCOUNT</code> (${SECRET}).</li><li>Bing: Bing Webmaster Tools → Settings → API Access → API Key → save it as <code>BING_API_KEY</code>.</li>
      <li>The hourly job backfills 16 months of Google data on its own. Or hit <b>Pull Now</b> on Sources.</li></ol>`,
    ga4: `<ol><li>GA4 → Admin → Property details: copy the <b>Property ID</b> (numbers only). Save it as the secret <code>GA4_PROPERTY_ID</code>.</li>
      <li>GA4 → Admin → Property access management → <b>+</b> → add <code>${esc(st.ga4?.account || 'the Search Console service account email')}</code> as a <b>Viewer</b>.</li>
      <li>${st.search?.google ? 'The service account is already set up for Search Console, so that’s it.' : 'This uses the same service account as Search Console, so set that up first (<code>GSC_SERVICE_ACCOUNT</code>).'}</li>
      <li>Within an hour HQ pulls the last 90 days, then refreshes daily. Free: the GA4 Data API has no charge.</li></ol>`,
    clarity: `<ol><li>Clarity → your project → <b>Settings → Data Export → Generate new API token</b> (you need to be the project admin).</li>
      <li>Save it as the secret <code>CLARITY_TOKEN</code>.</li><li>HQ pulls once a day (about 6am UTC): the overall numbers plus breakdowns by page, device, channel and source. Clarity only allows 10 calls a day and only hands out the last 1–3 days, so history builds up from the day you connect it and is kept forever here.</li></ol>`,
    meta: `<ol><li>Instagram must be a <b>professional</b> account (Business or Creator) linked to the Mow It Tall Facebook Page (Instagram → Settings → Account type and tools, then link the Page).</li>
      <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → <b>Create App</b> (type Business, or “Other”). Use your own account as admin; no app review is needed for your own Page.</li>
      <li>Open <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener">Graph API Explorer</a> → pick the app → <b>Get User Access Token</b> with <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>read_insights</code>, <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>business_management</code>. (Add the Facebook Login for Business and Instagram products to the app if Explorer doesn’t offer them.)</li>
      <li>Make it long-lived: Access Token Debugger → <b>Extend Access Token</b>. Paste the long-lived token back into Explorer and run <code>me/accounts</code>. The <code>access_token</code> next to the Mow It Tall Page <b>never expires</b>.</li>
      <li>Save that Page token as the secret <code>META_PAGE_TOKEN</code>. Every day HQ pulls followers, daily reach/views/engagement and each post’s stats for both.</li></ol>`,
    threads: `<ol><li>At <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> create an app with the <b>Access the Threads API</b> use case (it can be the same Meta app). Add your Threads account as a <b>Threads Tester</b> (App roles), then accept it in Threads → Settings → Account → Website permissions.</li>
      <li>Use the app’s Threads token generator (Use cases → Threads API → Settings, or Graph API Explorer on graph.threads.net) with <code>threads_basic</code> and <code>threads_manage_insights</code>, then exchange it for a <b>long-lived</b> token (60 days).</li>
      <li>Save it as the secret <code>THREADS_TOKEN</code>. HQ refreshes it every week on its own, so it never runs out as long as the pulls keep running.</li></ol>`,
    bluesky: `<p>Nothing to set up: Bluesky’s API is public. Followers and every post’s likes, reposts and replies come in daily. (Bluesky doesn’t count views.) Using a different handle than mowittall.com? Set <code>BLUESKY_HANDLE</code>.</p>`,
    pinterest: `<ol><li>Pinterest must be a <b>business account</b> (free switch in settings).</li>
      <li>At <a href="https://developers.pinterest.com/apps/" target="_blank" rel="noopener">developers.pinterest.com/apps</a> → Connect app. New apps get <b>Trial access</b> right away, which is enough for your own account.</li>
      <li>On the app page, generate an access token with <code>user_accounts:read</code> and <code>pins:read</code> (and <code>boards:read</code>). Save it as <code>PINTEREST_TOKEN</code>.</li>
      <li>So it never expires: also save the refresh token as <code>PINTEREST_REFRESH</code>, and the app’s ID and secret as <code>PINTEREST_APP_ID</code> and <code>PINTEREST_APP_SECRET</code>. HQ then renews it itself.</li>
      <li>You get daily impressions, saves, pin clicks and outbound clicks, plus 90-day stats for every pin.</li></ol>`,
    reddit: `<ol><li>HQ first tries Reddit’s public data (karma, profile followers, every post’s score and comments). Reddit often blocks that from Cloudflare.</li>
      <li>If it fails: <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener">reddit.com/prefs/apps</a> → <b>create another app</b> → type <b>script</b> (redirect URI can be http://localhost). Reddit may ask you to request API access first.</li>
      <li>Save <code>REDDIT_CLIENT_ID</code> (under the app name), <code>REDDIT_CLIENT_SECRET</code>, <code>REDDIT_USERNAME</code> (MowItTALL) and <code>REDDIT_PASSWORD</code>. Free for personal use.</li></ol>`,
    x: `<ol><li>X charges for most API reads now, and the free tier (if your account still has one) allows very few. HQ only reads once a week: your follower count and your last 20 posts with impressions, likes, replies, reposts and bookmarks.</li>
      <li>At <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener">developer.x.com</a> → your project → app → Keys and tokens → <b>Bearer Token</b>. Save it as <code>X_BEARER_TOKEN</code>.</li>
      <li>If X says your plan doesn’t allow it, keep typing the follower count in on the Social page instead.</li></ol>`,
    youtube: `<ol><li>Google Cloud (same project as the service account) → APIs &amp; Services → Library → enable <b>YouTube Data API v3</b>.</li><li>Credentials → Create credentials → API key. Restrict it to the YouTube Data API.</li><li>Save it as the secret <code>YT_API_KEY</code>. Subscribers, views and video count get logged daily.</li></ol>`,
  };
  return `<div class="ax-setup"><h4>How to Connect It (Free, About 5 Minutes)</h4>${steps[src] || ''}</div>`;
}

/* ================================================================ OVERVIEW */
export async function overview(root) {
  const st = S.status.sources;
  root.innerHTML = grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('trend', 'Traffic Over Time', { span: 8, sub: cmpLabel() ? `Dashed line: ${cmpLabel().replace('vs ', '')}` : '' })}
    ${card('chan', 'Where Visitors Come From', { span: 4, sub: 'Sessions by channel. Click one to dig in.' })}
    ${card('mix', 'Channel Mix by Day', { span: 12 })}
    ${card('pages', 'Top Pages', { span: 6 })}
    ${card('queries', 'Top Search Terms', { span: 6, sub: 'Google + Bing' })}
    ${card('signups', 'Email Sign-Ups by Spot', { span: 4 })}
    ${card('dev', 'Devices', { span: 4 })}
    ${card('cities', 'Top Places', { span: 4 })}
    ${card('health', 'Data Sources', { span: 12, sub: 'Everything HQ pulls in, and how fresh it is.' })}`);
  await run(
    kpis(root.querySelector('[data-k]'), [
      { src: 'web', metric: 'sessions', go: 'acquisition' }, { src: 'web', metric: 'users', go: 'audience' }, { src: 'web', metric: 'engaged_rate', go: 'content' },
      { src: 'web', metric: 'avg_eng_sec', go: 'content' }, { src: 'web', metric: 'quiz_done', go: 'conversions' },
      { src: 'list', metric: 'signups', label: 'Email Sign-Ups', filters: [{ d: 'contact_type', op: 'eq', v: 'Real' }], go: 'email', offMsg: 'Email not set up' },
      { src: 'search', metric: 'clicks', label: 'Search Clicks', go: 'seo', offMsg: st.search.on ? 'No data yet' : 'Connect Search Console' },
      { src: 'search', metric: 'impressions', label: 'Search Impressions', go: 'seo', offMsg: st.search.on ? 'No data yet' : 'Connect Search Console' },
    ]),
    trend(root, 'trend', { src: 'web', metrics: ['sessions', 'users', 'views', 'engaged', 'conv_sessions', 'leads'] }),
    bars(root, 'chan', { src: 'web', dim: 'channel', metric: 'sessions' }),
    stackTrend(root, 'mix', { src: 'web', dim: 'channel', metric: 'sessions' }),
    table(root, 'pages', { src: 'pages', tabs: [['path', 'Pages'], ['section', 'Sections']], metrics: ['views', 'users', 'avg_sec'], limit: 8, rowLink: pageLink }),
    st.search.on ? table(root, 'queries', { src: 'search', tabs: [['query', 'Terms'], ['page', 'Pages']], metrics: ['clicks', 'impressions', 'position'], sort: 'impressions', limit: 8 })
      : (body(root, 'queries').innerHTML = `<p class="ax-empty">Search Console and Bing aren’t connected yet.</p>${setupHTML('search')}`),
    bars(root, 'signups', { src: 'list', dim: 'source', metric: 'signups', filters: [{ d: 'contact_type', op: 'eq', v: 'Real' }], labelFn: spotName }),
    bars(root, 'dev', { src: 'web', dim: 'device', metric: 'sessions' }),
    bars(root, 'cities', { src: 'web', dim: 'city', metric: 'sessions' }),
  );
  health(body(root, 'health'));
}

function health(el) {
  const st = S.status.sources;
  const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };
  const span = (s) => (s?.a ? `${dlabel(s.a, 'date', true)} → ${dlabel(s.b, 'date', true)}` : 'No data yet');
  const rows = [
    ['Site Event Log', true, span(st.web.span), 'Live, every visit', 'Our own first-party log in Cloudflare. Kept forever.'],
    ['Google Search Console', st.search.google, span(st.search.span), st.search.runs?.search ? `Pulled ${ago(st.search.runs.search.at)}` : '—', 'Clicks, impressions, positions by search term and page.'],
    ['Bing Webmaster Tools', st.search.bing, span(st.search.bingSpan), st.search.runs?.bing ? `Pulled ${ago(st.search.runs.bing.at)}` : '—', 'Bing + DuckDuckGo + Copilot search data.'],
    ['Google Analytics 4', st.ga4.on, span(st.ga4.span), st.ga4.run ? `${st.ga4.run.ok ? 'Pulled' : 'Failed'} ${ago(st.ga4.run.at)}` : '—', 'A second opinion on traffic (GA4 filters your home IP).'],
    ['Microsoft Clarity', st.clarity.on, span(st.clarity.span), st.clarity.run ? `${st.clarity.run.ok ? 'Pulled' : 'Failed'} ${ago(st.clarity.run.at)}` : '—', 'Rage clicks, dead clicks, scroll depth, quick backs.'],
    ['Email (CRM)', st.email.on, st.email.crm ? `${fmt(st.email.crm.contacts)} real sign-ups · ${fmt(st.email.crm.sends)} emails sent` : '—', st.email.crm?.live ? 'Sending is live' : 'Sending is off', 'Opens, clicks, unsubscribes, A/B tests.'],
    ['Social', true, span(st.social.span), (() => { const r = Object.values(st.social.runs || {}).filter((x) => x.at).sort((a, b) => b.at - a.at)[0]; return r ? `Pulled ${ago(r.at)}` : '—'; })(),
      `Automatic: ${Object.entries(st.social.runs || {}).filter(([k]) => (st.social.platforms || {})[k]).map(([, v]) => v.label).join(', ')}. The rest typed in on Social.`],
  ];
  el.innerHTML = `<div class="ax-health">${rows.map(([n, on, sp, fresh, what]) => `<div class="ax-hrow ${on ? '' : 'is-off'}">
    <span class="ax-dot ${on ? 'is-on' : ''}" aria-hidden="true"></span><b>${n}</b><span>${on ? 'Connected' : 'Not connected'}</span><span>${esc(sp)}</span><span>${esc(fresh)}</span><small>${what}</small></div>`).join('')}</div>
    <p class="ax-fine"><button type="button" class="ax-link" data-go2="sources">Set up or refresh sources →</button></p>`;
  el.querySelector('[data-go2]').addEventListener('click', () => go('sources'));
}

/* ================================================================ ACQUISITION */
export async function acquisition(root) {
  root.innerHTML = grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('mix', 'Sessions by Channel', { span: 8 })}
    ${card('chan', 'Channel Share', { span: 4 })}
    ${card('tbl', 'Traffic Sources', { span: 12, sub: 'Switch the breakdown up top. Click any row for its trend, landing pages, devices and places.' })}
    ${card('ai', 'AI Assistants', { span: 6, sub: 'Visits from ChatGPT, Perplexity, Claude, Gemini, Copilot. Your AEO scoreboard.' })}
    ${card('ref', 'Referring Sites', { span: 6, sub: 'Other websites that linked people here.' })}
    ${card('camp', 'Campaigns (UTM)', { span: 12, sub: 'Every link you tag with utm_campaign shows up here: weekly social posts, emails, QR codes.' })}`);
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'web', metric: 'sessions' }, { src: 'web', metric: 'new_users' }, { src: 'web', metric: 'engaged_rate' }, { src: 'web', metric: 'views_per_session' }, { src: 'web', metric: 'conv_rate' }, { src: 'web', metric: 'leads' }]),
    stackTrend(root, 'mix', { src: 'web', dim: 'channel', metric: 'sessions', top: 7 }),
    bars(root, 'chan', { src: 'web', dim: 'channel', metric: 'sessions' }),
    table(root, 'tbl', { src: 'web', tabs: [['channel', 'Channel'], ['source_medium', 'Source / Medium'], ['source', 'Source'], ['medium', 'Medium'], ['landing', 'Landing Page'], ['campaign', 'Campaign']],
      metrics: ['sessions', 'users', 'new_users', 'engaged_rate', 'avg_eng_sec', 'views_per_session', 'conv_rate', 'leads'], limit: 15 }),
    bars(root, 'ai', { src: 'web', dim: 'source', metric: 'sessions', filters: [{ d: 'channel', op: 'eq', v: 'AI Assistant' }] }),
    bars(root, 'ref', { src: 'web', dim: 'source', metric: 'sessions', filters: [{ d: 'channel', op: 'eq', v: 'Referral' }], limit: 10 }),
    table(root, 'camp', { src: 'web', tabs: [['campaign', 'Campaign']], metrics: ['sessions', 'engaged_rate', 'conv_rate', 'leads'], filters: [{ d: 'campaign', op: 'neq', v: '(not set)' }], limit: 10 }),
  );
}

/* ================================================================ CONTENT / ENGAGEMENT */
export async function content(root) {
  root.innerHTML = grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('trend', 'Engagement Over Time', { span: 12 })}
    ${card('pages', 'Pages', { span: 12, sub: 'Avg time on page counts only time the tab was visible. Click a page to see where its readers came from.' })}
    ${card('scroll', 'How Far People Scroll', { span: 4, sub: 'Readers reaching each depth on posts and guides' })}
    ${card('done', 'Articles Read to the End', { span: 8, sub: 'article_complete events by page' })}
    ${card('ev', 'Everything People Do', { span: 12, sub: 'Every event the site sends. Click one to break it down by its details (answers, tools, scores…).' })}
    ${card('out', 'Outbound Clicks', { span: 6, sub: 'Links people followed off the site' })}
    ${card('srch', 'On-Site Searches', { span: 6, sub: 'What people typed into search. “No results” is a content idea list.' })}`);
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'pages', metric: 'views' }, { src: 'web', metric: 'views_per_session' }, { src: 'web', metric: 'avg_eng_sec' }, { src: 'pages', metric: 'avg_sec' }, { src: 'web', metric: 'engaged_rate' }, { src: 'web', metric: 'bounce_rate' }]),
    trend(root, 'trend', { src: 'web', metrics: ['views', 'engaged_rate', 'avg_eng_sec', 'views_per_session', 'bounce_rate'] }),
    table(root, 'pages', { src: 'pages', tabs: [['path', 'Page'], ['section', 'Section'], ['landing', 'Landing Page (Session)']], metrics: ['views', 'users', 'sessions', 'entrances', 'avg_sec'], limit: 15, rowLink: pageLink }),
    scrollDepth(root),
    table(root, 'done', { src: 'events', tabs: [['path', 'Page']], metrics: ['count', 'users'], filters: [{ d: 'event', op: 'eq', v: 'article_complete' }], limit: 8, rowLink: pageLink }),
    table(root, 'ev', { src: 'events', tabs: [['event', 'Event'], ['path', 'Page']], metrics: ['count', 'users', 'sessions', 'per_user'], limit: 15 }),
    table(root, 'out', { src: 'events', tabs: [['p.link_domain', 'Domain'], ['path', 'From Page']], metrics: ['count', 'users'], filters: [{ d: 'event', op: 'eq', v: 'outbound_click' }], limit: 8 }),
    table(root, 'srch', { src: 'events', tabs: [['p.search_term', 'Term'], ['event', 'Result']], metrics: ['count', 'users'], filters: [{ d: 'event', op: 'contains', v: 'search' }], limit: 8 }),
  );
}
async function scrollDepth(root) {
  const el = body(root, 'scroll');
  const [r] = await Q([{ src: 'events', dims: ['p.percent'], metrics: ['users'], filters: [{ d: 'event', op: 'eq', v: 'scroll_depth' }], limit: 10 }]);
  if (r?.error) { el.innerHTML = errBox(r.error); return; }
  const rows = r.rows.filter((x) => x[0] != null).sort((a, b) => Number(a[0]) - Number(b[0]));
  funnel(el, rows.map((x) => ({ label: `${x[0]}% down the page`, value: x[1] })));
}

/* ================================================================ CONVERSIONS */
export async function conversions(root) {
  root.innerHTML = grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('funnel', 'Visitor → Subscriber Funnel', { span: 5, sub: 'Sessions that reached each step' })}
    ${card('quiz', 'Quiz Drop-Off by Question', { span: 7, sub: 'People who answered each question. Big drops = a question to fix.' })}
    ${card('trend', 'Conversions Over Time', { span: 12 })}
    ${card('by', 'What Converts', { span: 12, sub: 'Conversion = a key event (quiz finished, calendar download, Hall upload) or an email sign-up.' })}
    ${card('leads', 'Email Leads by Spot', { span: 4 })}
    ${card('level', 'Quiz Results: Effort Level', { span: 4 })}
    ${card('profile', 'Quiz Results: Lawn Profile', { span: 4 })}
    ${card('answers', 'Quiz Answers', { span: 12, sub: 'Pick a question to see how people answered.' })}`);
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'web', metric: 'quiz_starts' }, { src: 'web', metric: 'quiz_done' }, { src: 'web', metric: 'quiz_rate' }, { src: 'web', metric: 'leads' }, { src: 'web', metric: 'conv_sessions' }, { src: 'web', metric: 'conv_rate' }]),
    convFunnel(root), quizSteps(root),
    trend(root, 'trend', { src: 'web', metrics: ['conv_sessions', 'conv_rate', 'quiz_starts', 'quiz_done', 'leads', 'key_events'] }),
    table(root, 'by', { src: 'web', tabs: [['channel', 'Channel'], ['source_medium', 'Source / Medium'], ['landing', 'Landing Page'], ['device', 'Device'], ['city', 'City'], ['user_type', 'New vs Returning']],
      metrics: ['sessions', 'quiz_starts', 'quiz_done', 'quiz_rate', 'leads', 'conv_sessions', 'conv_rate'], limit: 12 }),
    bars(root, 'leads', { src: 'events', dim: 'p.method', metric: 'count', filters: [{ d: 'event', op: 'eq', v: 'generate_lead' }] }),
    bars(root, 'level', { src: 'events', dim: 'p.effort_level', metric: 'users', filters: [{ d: 'event', op: 'eq', v: 'quiz_complete' }], labelFn: (v) => (LEVELS[v] ? `${v} · ${LEVELS[v]}` : v ?? '(not set)') }),
    bars(root, 'profile', { src: 'events', dim: 'p.lawn_profile', metric: 'users', filters: [{ d: 'event', op: 'eq', v: 'quiz_complete' }] }),
    quizAnswers(root),
  );
}
async function convFunnel(root) {
  const el = body(root, 'funnel');
  const [a, b, c, q, ms] = await Q([{ src: 'web', metrics: ['sessions'] }, { src: 'web', metrics: ['sessions'], filters: [{ d: 'engaged', op: 'eq', v: 'Engaged' }] }, { src: 'web', metrics: ['quiz_starts', 'quiz_done'] },
    { src: 'events', metrics: ['sessions'], filters: [{ d: 'event', op: 'eq', v: 'generate_lead' }, { d: 'p.method', op: 'eq', v: 'quiz' }] },
    { src: 'events', metrics: ['sessions'], filters: [{ d: 'event', op: 'eq', v: 'generate_lead' }, { d: 'p.method', op: 'neq', v: 'quiz' }] }]);
  if (a?.error) { el.innerHTML = errBox(a.error); return; }
  funnel(el, [{ label: 'Visited', value: one(a, 'sessions') }, { label: 'Stuck around (engaged)', value: one(b, 'sessions') }, { label: 'Started the quiz', value: one(c, 'quiz_starts') }, { label: 'Finished the quiz', value: one(c, 'quiz_done') }, { label: 'Gave their email on the quiz', value: one(q, 'sessions') }]);
  if (one(ms, 'sessions')) el.insertAdjacentHTML('beforeend', `<p class="ax-fine ax-mt">Plus ${fmt(one(ms, 'sessions'))} email sign-up${one(ms, 'sessions') === 1 ? '' : 's'} from other spots (Measure Your Yard, the reminder bar).</p>`);
}
async function quizSteps(root) {
  const el = body(root, 'quiz');
  const [r, q] = await Q([{ src: 'events', dims: ['p.step_number'], metrics: ['users'], filters: [{ d: 'event', op: 'eq', v: 'quiz_step' }], limit: 40 },
    { src: 'events', dims: ['p.step_number', 'p.question_id'], metrics: ['users'], filters: [{ d: 'event', op: 'eq', v: 'quiz_step' }], limit: 200 }]);
  if (r?.error) { el.innerHTML = errBox(r.error); return; }
  const qid = new Map((q?.rows || []).map((x) => [x[0], x[1]]));
  const rows = r.rows.filter((x) => x[0] != null).sort((a, b) => Number(a[0]) - Number(b[0]));
  funnel(el, rows.map((x) => ({ label: `Q${x[0]}${qid.get(x[0]) ? ` · ${qid.get(x[0])}` : ''}`, value: x[1] })));
}
async function quizAnswers(root) {
  const el = body(root, 'answers');
  const [qs] = await Q([{ src: 'events', dims: ['p.question_id'], metrics: ['users'], filters: [{ d: 'event', op: 'eq', v: 'quiz_step' }], limit: 40 }]);
  if (qs?.error || !qs.rows.length) { el.innerHTML = qs?.error ? errBox(qs.error) : '<p class="ax-empty">No quiz answers in this date range yet.</p>'; return; }
  const ids = qs.rows.map((x) => x[0]).filter(Boolean);
  let cur = S.sub.qa && ids.includes(S.sub.qa) ? S.sub.qa : ids[0];
  el.innerHTML = `${chips('qa', ids.map((i) => [i, i]), cur)}<div data-qa class="ax-mt"></div>`;
  const draw = async () => {
    const [a] = await Q([{ src: 'events', dims: ['p.answer'], metrics: ['users'], filters: [{ d: 'event', op: 'eq', v: 'quiz_step' }, { d: 'p.question_id', op: 'eq', v: cur }], limit: 20 }]);
    barList(el.querySelector('[data-qa]'), (a?.rows || []).map((x) => ({ label: x[0] ?? '(blank)', value: x[1] })));
  };
  onSeg(el, 'qa', (v) => { cur = v; setSub('qa', v); draw(); });
  draw();
}

/* ================================================================ AUDIENCE */
export async function audience(root) {
  root.innerHTML = grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('geo', 'Where They Are', { span: 7 })}
    ${card('nv', 'New vs Returning', { span: 5 })}
    ${card('heat', 'When They Visit', { span: 12, sub: 'Sessions by day of week and hour (Eastern). Good for timing social posts and emails.' })}
    ${card('dev', 'Device', { span: 4 })}
    ${card('os', 'Operating System', { span: 4 })}
    ${card('br', 'Browser', { span: 4 })}
    ${card('tech', 'Device Quality Check', { span: 12, sub: 'Is anything broken on one kind of phone? Low engaged rate on one browser is a bug smell.' })}`);
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'web', metric: 'users' }, { src: 'web', metric: 'new_users' }, { src: 'web', metric: 'sessions', label: 'Returning Sessions', filters: [{ d: 'user_type', op: 'eq', v: 'Returning' }] }, { src: 'web', metric: 'sessions', label: 'Local Sessions (NY)', filters: [{ d: 'region', op: 'eq', v: 'New York' }] }, { src: 'web', metric: 'sessions', label: 'Mobile Sessions', filters: [{ d: 'device', op: 'eq', v: 'mobile' }] }]),
    table(root, 'geo', { src: 'web', tabs: [['city', 'City'], ['region', 'State'], ['country', 'Country']], metrics: ['sessions', 'users', 'engaged_rate', 'conv_rate'], limit: 12 }),
    newRet(root), heat(root),
    bars(root, 'dev', { src: 'web', dim: 'device', metric: 'sessions' }), bars(root, 'os', { src: 'web', dim: 'os', metric: 'sessions' }), bars(root, 'br', { src: 'web', dim: 'browser', metric: 'sessions' }),
    table(root, 'tech', { src: 'web', tabs: [['browser', 'Browser'], ['os', 'OS'], ['device', 'Device']], metrics: ['sessions', 'engaged_rate', 'avg_eng_sec', 'views_per_session', 'conv_rate'], limit: 10 }),
  );
}
async function newRet(root) {
  const el = body(root, 'nv');
  const p = period(); const keys = timeline(p.from, p.to, p.grain);
  const [r] = await Q([{ src: 'web', dims: [p.grain, 'user_type'], metrics: ['sessions'], limit: 5000 }]);
  if (r?.error) { el.innerHTML = errBox(r.error); return; }
  const series = ['New', 'Returning'].map((n) => ({ name: n, values: seriesOf(r, 'sessions', keys, { filterIdx: 1, filterVal: n }) }));
  el.innerHTML = `<div class="ax-legend">${series.map((s, i) => `<span><i style="background:${col(i)}"></i>${s.name} · ${fmt(s.values.reduce((a, b) => a + b, 0))}</span>`).join('')}</div><div data-plot></div>`;
  stackedBars(el.querySelector('[data-plot]'), { x: keys, grain: p.grain, series, height: 220 });
}
async function heat(root) {
  const el = body(root, 'heat');
  const [r] = await Q([{ src: 'web', dims: ['dow', 'hour'], metrics: ['sessions'], limit: 500 }]);
  if (r?.error) { el.innerHTML = errBox(r.error); return; }
  const m = new Map(r.rows.map((x) => [`${x[0]}|${x[1]}`, x[2]]));
  const days = ['1 Mon', '2 Tue', '3 Wed', '4 Thu', '5 Fri', '6 Sat', '7 Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  heatmap(el, { rows: days, cols: hours, value: (d, h) => m.get(`${d}|${h}`), rowLabel: (d) => d.slice(2), colLabel: (h) => { const n = +h; return n === 0 ? '12a' : n < 12 ? `${n}a` : n === 12 ? '12p' : `${n - 12}p`; } });
}

/* ================================================================ SEO */
export async function seo(root) {
  const st = S.status.sources.search;
  if (!st.on) { root.innerHTML = grid(card('off', 'Search Console + Bing Aren’t Connected', { span: 12 })); body(root, 'off').innerHTML = setupHTML('search'); return; }
  const eng = S.sub.eng || 'all';
  const ef = eng === 'all' ? [] : [{ d: 'engine', op: 'eq', v: eng }];
  root.innerHTML = `<div class="ax-sub">${chips('eng', [['all', 'Google + Bing'], ['Google', 'Google'], ['Bing', 'Bing']], eng)}<span class="ax-hint">Search data lags 2–3 days. Bing reports weekly-ish.</span></div>` + grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('clk', 'Clicks', { span: 6 })}
    ${card('imp', 'Impressions', { span: 6 })}
    ${card('ctr', 'Click-Through Rate', { span: 6 })}
    ${card('pos', 'Average Position', { span: 6, sub: 'Higher on the chart = better (1 is the top)' })}
    ${card('q', 'Search Terms + Pages', { span: 12, sub: 'Click a term to see which pages rank for it; click a page for its terms.' })}
    ${card('strike', 'Striking Distance', { span: 6, sub: 'Terms on page 1’s edge or page 2 (positions 4–20). A small push moves these.' })}
    ${card('lowctr', 'Seen but Not Clicked', { span: 6, sub: 'Lots of impressions, CTR under 2%. Rewrite the title and description.' })}
    ${card('dist', 'Where You Rank', { span: 4, sub: 'Impressions by position' })}
    ${card('org', 'What Search Visitors Do Next', { span: 8, sub: 'From the site’s own log: organic landing pages and how those visits went' })}`);
  onSeg(root, 'eng', (v) => { setSub('eng', v); seo(root); });
  const sm = (id, m) => trend(root, id, { src: 'search', metrics: [m], filters: ef, height: 200 });
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'search', metric: 'clicks', filters: ef }, { src: 'search', metric: 'impressions', filters: ef }, { src: 'search', metric: 'ctr', filters: ef }, { src: 'search', metric: 'position', filters: ef }, { src: 'search', metric: 'queries', filters: ef }, { src: 'search', metric: 'pages', filters: ef }]),
    sm('clk', 'clicks'), sm('imp', 'impressions'), sm('ctr', 'ctr'), sm('pos', 'position'),
    table(root, 'q', { src: 'search', tabs: [['query', 'Search Terms'], ['page', 'Pages']], metrics: ['clicks', 'impressions', 'ctr', 'position'], sort: 'impressions', filters: ef, limit: 15, rowLink: (v) => (v.startsWith('/') ? pageLink(v) : null) }),
    oppTable(root, 'strike', ef, (r) => r.position >= 4 && r.position <= 20, (a, b) => b.impressions - a.impressions),
    oppTable(root, 'lowctr', ef, (r) => r.impressions >= 20 && r.ctr < 0.02, (a, b) => b.impressions - a.impressions),
    bars(root, 'dist', { src: 'search', dim: 'pos_bucket', metric: 'impressions', filters: ef, drill: false }),
    table(root, 'org', { src: 'web', tabs: [['landing', 'Landing Page'], ['source', 'Engine']], metrics: ['sessions', 'engaged_rate', 'avg_eng_sec', 'conv_rate'], filters: [{ d: 'channel', op: 'eq', v: 'Organic Search' }], limit: 8, rowLink: pageLink }),
  );
}
async function oppTable(root, id, ef, keep, sort) {
  const el = body(root, id);
  const [r] = await Q([{ src: 'search', dims: ['query'], metrics: ['impressions', 'clicks', 'ctr', 'position'], filters: ef, sort: '-impressions', limit: 1000 }]);
  if (r?.error) { el.innerHTML = errBox(r.error); return; }
  const rows = r.rows.map((x) => ({ q: x[0], impressions: x[1], clicks: x[2], ctr: x[3], position: x[4] })).filter(keep).sort(sort).slice(0, 12);
  el.innerHTML = rows.length ? `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th class="is-dim">Search Term</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>Position</th></tr></thead><tbody>
    ${rows.map((x) => `<tr tabindex="0" data-q="${esc(x.q)}"><td class="is-dim"><span class="ax-cell-l">${esc(x.q)}</span></td><td>${fmt(x.impressions)}</td><td>${fmt(x.clicks)}</td><td>${fmt(x.ctr, 'pct')}</td><td>${fmt(x.position, 'pos')}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="ax-empty">Nothing here right now. Good problem to have (or not enough data yet).</p>';
  el.querySelectorAll('[data-q]').forEach((tr) => tr.addEventListener('click', () => openDrill({ src: 'search', dim: 'query', value: tr.dataset.q, metric: 'impressions', metrics: ['clicks', 'impressions', 'ctr', 'position'], filters: ef })));
}

/* ================================================================ EMAIL */
export async function email(root) {
  if (!S.status.sources.email.on) { root.innerHTML = '<p class="ax-empty">The email database isn’t set up.</p>'; return; }
  const real = [{ d: 'contact_type', op: 'eq', v: 'Real' }];
  const mode = S.sub.mode || 'live';
  const mf = [...real, ...(mode === 'all' ? [] : [{ d: 'mode', op: 'eq', v: mode }])];
  const crm = S.status.sources.email.crm || {};
  root.innerHTML = `<div class="ax-sub">${chips('mode', [['live', 'Real Sends'], ['preview', 'Test Sends'], ['all', 'Everything']], mode)}
    <span class="ax-hint">${crm.live ? 'Sending is live.' : 'Sending is off, so sends below are tests until you flip it on in HQ → Email.'} Opens are unreliable (Apple Mail opens everything); trust clicks.</span></div>` + grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('grow', 'Sign-Ups Over Time', { span: 8 })}
    ${card('src', 'Where Sign-Ups Come From', { span: 4 })}
    ${card('perf', 'Email Performance Over Time', { span: 12 })}
    ${card('emails', 'Every Email', { span: 12, sub: 'Click one to see it by variant, sign-up spot and effort level.' })}
    ${card('ab', 'A/B Tests', { span: 6, sub: 'Variants side by side. Compare click rate, not open rate.' })}
    ${card('lvl', 'Subscribers by Effort Level', { span: 6 })}
    ${card('list', 'The List', { span: 12, sub: 'Everyone who signed up in this date range, by any breakdown.' })}`);
  onSeg(root, 'mode', (v) => { setSub('mode', v); email(root); });
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'list', metric: 'signups', filters: real }, { src: 'list', metric: 'active', filters: real, label: 'Still Subscribed (of Those)' }, { src: 'email', metric: 'sent', filters: mf }, { src: 'email', metric: 'open_rate', filters: mf }, { src: 'email', metric: 'click_rate', filters: mf }, { src: 'email', metric: 'unsub_rate', filters: mf }]),
    trend(root, 'grow', { src: 'list', metrics: ['signups', 'with_quiz', 'measured'], filters: real }),
    bars(root, 'src', { src: 'list', dim: 'source', metric: 'signups', filters: real, labelFn: spotName }),
    trend(root, 'perf', { src: 'email', metrics: ['sent', 'opened', 'clicked', 'open_rate', 'click_rate', 'unsubs'], filters: mf }),
    table(root, 'emails', { src: 'email', tabs: [['email', 'Email'], ['kind', 'Type'], ['subject', 'Subject Line']], metrics: ['sent', 'delivered', 'opened', 'open_rate', 'clicked', 'click_rate', 'ctor', 'unsubs'], filters: mf, limit: 20 }),
    table(root, 'ab', { src: 'email', tabs: [['test', 'Test']], extraDims: ['variant'], metrics: ['sent', 'open_rate', 'click_rate', 'unsubs'], filters: [...mf, { d: 'test', op: 'neq', v: '(none)' }], limit: 20, drill: false, compare: false, labelFn: (v) => v }),
    bars(root, 'lvl', { src: 'list', dim: 'level', metric: 'signups', filters: real, labelFn: (v) => (LEVELS[v] ? `${v} · ${LEVELS[v]}` : v) }),
    table(root, 'list', { src: 'list', tabs: [['source', 'Sign-Up Spot'], ['level', 'Effort Level'], ['status', 'Status'], ['zip3', 'ZIP Area'], ['measured', 'Measured?']], metrics: ['signups', 'active', 'openers', 'clickers', 'with_quiz', 'measured'], filters: real, limit: 10 }),
  );
}

/* ================================================================ SOCIAL */
export async function social(root) {
  const st = S.status.sources.social;
  const auto = st.platforms || {};
  let plat = S.sub.plat || 'all';
  const pf = plat === 'all' ? [] : [{ d: 'platform', op: 'eq', v: plat }];
  const p = period();
  let data, postsAll;
  root.innerHTML = '<div class="ax-skel tall"></div>';
  try { [data, postsAll] = await Promise.all([api('/api/admin/ax/social'), api(`/api/admin/ax/posts?from=${p.from}&to=${p.to}`).then((r) => r.posts)]); }
  catch (e) { root.innerHTML = errBox(e.message); return; }
  const have = new Set([...data.snaps.map((s) => s.platform), ...postsAll.map((x) => x.platform), ...(st.metrics || []).map((m) => m.platform)]);
  const plats = PLATFORMS.filter(([k]) => have.has(k) || ['facebook', 'instagram', 'threads', 'youtube', 'x', 'pinterest'].includes(k));
  const autoOn = (k) => (k === 'facebook' || k === 'instagram' ? auto.meta : auto[k]);
  root.innerHTML = `<div class="ax-sub">${chips('plat', [['all', 'All Platforms'], ...plats.map(([k, n]) => [k, n])], plat)}
    <span class="ax-hint">${plats.filter(([k]) => autoOn(k)).map(([, n]) => n).join(', ') || 'Bluesky'} update daily on their own. Connect the rest on Sources &amp; Export.</span></div>` + grid(`
    <div class="ax-span" style="--span:12" data-sk></div>
    ${plat === 'all' ? card('board', 'Platform Scoreboard', { span: 12, sub: 'Every platform side by side for this date range. “Seen” = reach (Facebook, Instagram), views (Threads, YouTube) or impressions (Pinterest, X). Click a row to focus on it.' }) : ''}
    ${card('fol', 'Follower Growth', { span: 6 })}
    ${card('seen', plat === 'all' ? 'Reach & Views by Platform' : 'Account Stats Over Time', { span: 6 })}
    ${card('posts', 'Every Post', { span: 12, sub: 'Stats refresh daily for 60 days after posting. Click a post to open it.' })}
    ${card('when', 'Best Time to Post', { span: 7, sub: 'Average engagements per post by the day and hour you posted (Eastern)' })}
    ${card('type', 'What Kind of Post Works', { span: 5, sub: 'Average engagements per post by format' })}
    ${card('traf', 'Visits from Social', { span: 8 })}
    ${card('plats', 'Site Visits by Platform', { span: 4 })}
    ${card('tbl', 'Social Traffic Quality', { span: 12, sub: 'Which platform sends people who stick around and sign up (from the utm tags HQ → Social adds to every link).' })}
    ${card('hq', 'What You Posted (from HQ → Social)', { span: 7, sub: 'Posts you marked “Posted”, with visits from that platform in the 3 days after.' })}
    ${card('add', 'Log Follower Counts', { span: 5, sub: 'For platforms with no free API (Nextdoor) or not connected yet.' })}`);
  onSeg(root, 'plat', (v) => { setSub('plat', v); social(root); });
  const posts = plat === 'all' ? postsAll : postsAll.filter((x) => x.platform === plat);
  const webf = plat === 'all' ? [{ d: 'channel', op: 'eq', v: 'Organic Social' }] : [{ d: 'source', op: 'eq', v: WEBSRC[plat] || [plat] }];
  socialKpis(root.querySelector('[data-sk]'), data, posts, plat, plats);
  if (plat === 'all') board(body(root, 'board'), data, postsAll, plats, (k) => { setSub('plat', k); social(root); });
  drawSocial(root, data, plat, plats);
  seenChart(root, plat, plats);
  postTable(body(root, 'posts'), posts);
  postHeat(body(root, 'when'), posts);
  barList(body(root, 'type'), Object.entries(posts.reduce((a, x) => { const k = `${PNAME[x.platform] || x.platform} · ${prettyType(x.type)}`; (a[k] ||= []).push(eng(x)); return a; }, {}))
    .map(([k, v]) => ({ label: k, value: v.reduce((s, y) => s + y, 0) / v.length, sub: `${v.length} post${v.length === 1 ? '' : 's'}` })).sort((a, b) => b.value - a.value).slice(0, 10), { kind: 'num', empty: 'No posts in this date range yet.' });
  addForm(root, data);
  await run(
    trend(root, 'traf', { src: 'web', metrics: ['sessions', 'engaged', 'leads'], filters: webf }),
    bars(root, 'plats', { src: 'web', dim: 'source', metric: 'sessions', filters: webf }),
    table(root, 'tbl', { src: 'web', tabs: [['source', 'Platform'], ['landing', 'Landing Page'], ['campaign', 'Campaign']], metrics: ['sessions', 'users', 'engaged_rate', 'avg_eng_sec', 'quiz_done', 'leads', 'conv_rate'], filters: webf, limit: 12 }),
    hqPosts(root, data.posts.filter((x) => plat === 'all' || x.platform === plat)),
  );
}
// utm/referrer names each platform shows up as in the site's own log
const WEBSRC = { facebook: ['facebook', 'fb', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com'], instagram: ['instagram', 'ig', 'l.instagram.com'], threads: ['threads', 'threads.net', 'threads.com', 'l.threads.com'],
  x: ['x', 't.co', 'twitter', 'x.com'], youtube: ['youtube', 'youtube.com', 'm.youtube.com'], pinterest: ['pinterest', 'pin.it', 'pinterest.com'], reddit: ['reddit', 'reddit.com', 'out.reddit.com'],
  bluesky: ['bluesky', 'bsky.app', 'bsky'], nextdoor: ['nextdoor', 'nextdoor.com'], tiktok: ['tiktok', 'tiktok.com'] };
const prettyType = (t) => String(t || 'post').replace(/_/g, ' ').replace(/^(added|shared) /, '').replace(/ post$/, '').replace(/\b\w/g, (c) => c.toUpperCase());
const SEEN = { facebook: 'reach', instagram: 'reach', threads: 'views', youtube: 'views', pinterest: 'impressions', x: 'impressions' };
const eng = (x) => (x.likes || 0) + (x.comments || 0) + (x.shares || 0) + (x.saves || 0);
const seenOf = (x) => x.reach ?? x.views ?? x.impressions ?? null;
function follow(data, k, p) {
  const list = data.snaps.filter((s) => s.platform === k && s.followers != null);
  const last = [...list].reverse().find((s) => s.date <= p.to);
  const before = [...list].reverse().find((s) => s.date < p.from) || list.find((s) => s.date >= p.from);
  return { last: last?.followers ?? null, before: before && before !== last ? before.followers : null, date: last?.date };
}
async function socialKpis(el, data, posts, plat, plats) {
  const p = period();
  const keys = plat === 'all' ? plats.map(([k]) => k) : [plat];
  let fNow = 0, fBefore = 0, anyF = false;
  for (const k of keys) { const f = follow(data, k, p); if (f.last != null) { anyF = true; fNow += f.last; fBefore += f.before ?? f.last; } }
  const seenPosts = posts.filter((x) => seenOf(x) != null);
  const rate = seenPosts.reduce((a, x) => a + (seenOf(x) || 0), 0) ? seenPosts.reduce((a, x) => a + eng(x), 0) / seenPosts.reduce((a, x) => a + (seenOf(x) || 0), 0) : null;
  const [sd, w] = await Q([{ src: 'social_day', dims: ['platform'], metrics: ['reach', 'views', 'impressions'], filters: plat === 'all' ? [] : [{ d: 'platform', op: 'eq', v: plat }] },
    { src: 'web', metrics: ['sessions', 'leads'], filters: plat === 'all' ? [{ d: 'channel', op: 'eq', v: 'Organic Social' }] : [{ d: 'source', op: 'eq', v: WEBSRC[plat] || [plat] }] }]);
  let seen = null;
  if (sd && !sd.error) for (const r of sd.rows) { const m = SEEN[r[0]] || 'views'; const v = r[sd.cols.indexOf(m)]; if (v != null) seen = (seen || 0) + v; }
  const tile = (l, v, kind, extra = '') => `<div class="ax-kpi"><span class="ax-kpi-l">${l}</span><b>${fmt(v, kind)}</b><div class="ax-kpi-f">${extra}</div></div>`;
  el.innerHTML = `<div class="ax-kpis">
    ${tile('Followers', anyF ? fNow : null, 'num', anyF && fBefore !== fNow ? delta(fNow, fBefore) : '<small>across platforms</small>')}
    ${tile('New Followers', anyF ? fNow - fBefore : null, 'num', '<small>in this date range</small>')}
    ${tile('Times Seen', seen, 'num', '<small>reach / views / impressions</small>')}
    ${tile('Posts', posts.length, 'num', '')}
    ${tile('Engagements', posts.reduce((a, x) => a + eng(x), 0), 'num', '<small>likes, comments, shares, saves</small>')}
    ${tile('Engagement Rate', rate, 'pct', '<small>engagements ÷ seen</small>')}
    ${tile('Site Visits', w ? one(w, 'sessions') : null, 'num', '<small>from social</small>')}
    ${tile('Email Leads', w ? one(w, 'leads') : null, 'num', '<small>from social</small>')}</div>`;
}
async function board(el, data, posts, plats, pick) {
  const p = period();
  const [sd, w] = await Q([{ src: 'social_day', dims: ['platform'], metrics: ['reach', 'views', 'impressions'] }, { src: 'web', dims: ['source'], metrics: ['sessions', 'leads'], filters: [{ d: 'channel', op: 'eq', v: 'Organic Social' }], limit: 200 }]);
  const seen = {}; if (sd && !sd.error) for (const r of sd.rows) seen[r[0]] = r[sd.cols.indexOf(SEEN[r[0]] || 'views')];
  const web = {}; if (w && !w.error) for (const r of w.rows) { const k = Object.keys(WEBSRC).find((x) => WEBSRC[x].includes(String(r[0]).toLowerCase())) || null; if (k) { web[k] ||= [0, 0]; web[k][0] += r[1]; web[k][1] += r[2] || 0; } }
  const rows = plats.map(([k, n]) => {
    const f = follow(data, k, p); const ps = posts.filter((x) => x.platform === k); const e = ps.reduce((a, x) => a + eng(x), 0);
    const sp = ps.filter((x) => seenOf(x) != null), sv = sp.reduce((a, x) => a + seenOf(x), 0);
    const s = seen[k] ?? (ps.length ? ps.reduce((a, x) => a + (seenOf(x) || 0), 0) || null : null);
    return { k, n, f: f.last, d: f.last != null && f.before != null ? f.last - f.before : null, posts: ps.length, seen: s, e, rate: sv ? sp.reduce((a, x) => a + eng(x), 0) / sv : null, visits: web[k]?.[0] || 0, leads: web[k]?.[1] || 0,
      auto: k === 'facebook' || k === 'instagram' ? S.status.sources.social.platforms?.meta : S.status.sources.social.platforms?.[k] };
  });
  el.innerHTML = `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th class="is-dim">Platform</th><th>Followers</th><th>Change</th><th>Posts</th><th>Seen</th><th>Engagements</th><th>Eng. Rate</th><th>Site Visits</th><th>Leads</th></tr></thead><tbody>
    ${rows.map((r) => `<tr tabindex="0" data-row="${r.k}"><td class="is-dim">${esc(r.n)}${r.auto ? ' <i class="ax-tag">auto</i>' : ''}</td><td>${fmt(r.f)}</td><td>${r.d == null ? '' : `<span class="ax-delta ${r.d > 0 ? 'is-up' : r.d < 0 ? 'is-down' : ''}">${r.d > 0 ? '+' : ''}${fmt(r.d)}</span>`}</td>
      <td>${fmt(r.posts)}</td><td>${fmt(r.seen)}</td><td>${fmt(r.e)}</td><td>${fmt(r.rate, 'pct')}</td><td>${fmt(r.visits)}</td><td>${fmt(r.leads)}</td></tr>`).join('')}</tbody></table></div>`;
  el.querySelectorAll('[data-row]').forEach((tr) => tr.addEventListener('click', () => pick(tr.dataset.row)));
}
async function seenChart(root, plat, plats) {
  const el = body(root, 'seen');
  const p = period(); const keys = timeline(p.from, p.to, p.grain);
  const mets = [...new Set((S.status.sources.social.metrics || []).filter((m) => plat === 'all' || m.platform === plat).map((m) => m.metric))];
  if (!mets.length) { el.innerHTML = '<p class="ax-empty">Daily reach and views show up here once Facebook, Instagram, Threads, YouTube or Pinterest is connected.</p>'; return; }
  if (plat === 'all') {
    const [r] = await Q([{ src: 'social_day', dims: [p.grain, 'platform'], metrics: ['reach', 'views', 'impressions'], limit: 5000 }]);
    if (r?.error) { el.innerHTML = errBox(r.error); return; }
    const ps = [...new Set(r.rows.map((x) => x[1]))].slice(0, 6);
    const series = ps.map((k) => { const m = SEEN[k] || 'views'; return { name: `${PNAME[k] || k} ${m}`, values: seriesOf(r, m, keys, { filterIdx: 1, filterVal: k, gaps: true }) }; });
    el.innerHTML = `<div class="ax-legend">${series.map((s, i) => `<span><i style="background:${col(i)}"></i>${esc(s.name)}</span>`).join('')}</div><div data-plot></div>`;
    lineChart(el.querySelector('[data-plot]'), { x: keys, grain: p.grain, series, height: 230 });
    return;
  }
  let m = S.sub.sm && mets.includes(S.sub.sm) ? S.sub.sm : (mets.includes(SEEN[plat]) ? SEEN[plat] : mets[0]);
  el.innerHTML = `${chips('sm', mets.map((x) => [x, x.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())]), m)}<div data-plot class="ax-mt"></div>`;
  const draw = async () => {
    const [r] = await Q([{ src: 'social_day', dims: [p.grain], metrics: [m], filters: [{ d: 'platform', op: 'eq', v: plat }], limit: 5000 }]);
    lineChart(el.querySelector('[data-plot]'), { x: keys, grain: p.grain, series: [{ name: m, values: seriesOf(r, m, keys, { gaps: true }) }], height: 210, area: true });
  };
  onSeg(el, 'sm', (v) => { m = v; setSub('sm', v); draw(); });
  draw();
}
function postTable(el, posts) {
  if (!posts.length) { el.innerHTML = '<p class="ax-empty">No posts in this date range yet (or no platforms connected).</p>'; return; }
  const COLS = [['date', 'Posted', 'd'], ['platform', 'Platform', 't'], ['text', 'Post', 't'], ['type', 'Type', 't'], ['seen', 'Seen', 'n'], ['likes', 'Likes', 'n'], ['comments', 'Comments', 'n'], ['shares', 'Shares', 'n'], ['saves', 'Saves', 'n'], ['clicks', 'Clicks', 'n'], ['eng', 'Engagements', 'n'], ['rate', 'Eng. Rate', 'p']];
  const rows = posts.map((x) => ({ ...x, seen: seenOf(x), eng: eng(x), rate: seenOf(x) ? eng(x) / seenOf(x) : null }));
  let sortK = 'date', desc = true, q = '', show = 15;
  const draw = () => {
    let rs = rows.filter((r) => !q || `${r.text} ${r.platform} ${r.type}`.toLowerCase().includes(q));
    rs = [...rs].sort((a, b) => { const x = sortK === 'date' ? a.created : a[sortK], y = sortK === 'date' ? b.created : b[sortK]; const c = typeof x === 'string' || typeof y === 'string' ? String(x ?? '').localeCompare(String(y ?? '')) : (x ?? -Infinity) - (y ?? -Infinity); return desc ? -c : c; });
    el.innerHTML = `<div class="ax-table-tools"><input class="ax-search" type="search" placeholder="Search posts…" value="${esc(q)}" data-pq></div>
      <div class="ax-table-wrap"><table class="ax-table"><thead><tr>${COLS.map(([k, l, t]) => `<th data-ps="${k}" class="${t === 't' || t === 'd' ? 'is-dim' : ''} ${k === sortK ? (desc ? 'is-desc' : 'is-asc') : ''}">${l}</th>`).join('')}</tr></thead><tbody>
      ${rs.slice(0, show).map((r) => `<tr data-url="${esc(r.url || '')}" tabindex="0"><td class="is-dim">${dlabel(r.date, 'date', true)}</td><td class="is-dim">${esc(PNAME[r.platform] || r.platform)}</td>
        <td class="is-dim"><span class="ax-cell-l ax-post-t" title="${esc(r.text)}">${esc(r.text || '(no text)')}</span></td><td class="is-dim">${esc(prettyType(r.type))}</td>
        ${['seen', 'likes', 'comments', 'shares', 'saves', 'clicks', 'eng'].map((k) => `<td>${fmt(r[k])}</td>`).join('')}<td>${fmt(r.rate, 'pct')}</td></tr>`).join('')}</tbody></table></div>
      <div class="ax-table-f"><span>${Math.min(show, rs.length)} of ${rs.length}</span>${rs.length > show ? '<button type="button" class="ax-link" data-pm>Show more</button>' : ''}</div>`;
    el.querySelectorAll('[data-ps]').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.ps; if (k === sortK) desc = !desc; else { sortK = k; desc = true; } draw(); }));
    el.querySelector('[data-pm]')?.addEventListener('click', () => { show += 50; draw(); });
    const inp = el.querySelector('[data-pq]'); inp.addEventListener('input', () => { q = inp.value.toLowerCase(); const pos = inp.selectionStart; draw(); const n = el.querySelector('[data-pq]'); n.focus(); n.setSelectionRange(pos, pos); });
    el.querySelectorAll('[data-url]').forEach((tr) => tr.addEventListener('click', () => tr.dataset.url && window.open(tr.dataset.url, '_blank', 'noopener')));
  };
  draw();
}
function postHeat(el, posts) {
  if (posts.length < 3) { el.innerHTML = '<p class="ax-empty">Needs a few more posts in this date range to spot a pattern.</p>'; return; }
  const m = new Map();
  for (const x of posts) { const k = `${x.dow}|${String(x.hour).padStart(2, '0')}`; const a = m.get(k) || [0, 0]; a[0] += eng(x); a[1]++; m.set(k, a); }
  const days = [1, 2, 3, 4, 5, 6, 0]; const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  heatmap(el, { rows: days, cols: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), kind: 'dec',
    value: (d, h) => { const a = m.get(`${d}|${h}`); return a ? a[0] / a[1] : 0; }, rowLabel: (d) => DN[d], colLabel: (h) => { const n = +h; return n === 0 ? '12a' : n < 12 ? `${n}a` : n === 12 ? '12p' : `${n - 12}p`; } });
}
function drawSocial(root, data, plat, plats) {
  const p = period();
  const el = body(root, 'fol');
  const by = {};
  for (const s of data.snaps) (by[s.platform] ||= []).push(s);
  const withData = (plat === 'all' ? plats : plats.filter(([k]) => k === plat)).filter(([k]) => (by[k] || []).some((s) => s.followers != null)).slice(0, 8);
  if (!withData.length) { el.innerHTML = '<p class="ax-empty">Follower counts show up here once a platform is connected or you log a number.</p>'; return; }
  const keys = timeline(p.from, p.to, 'date');
  const series = withData.map(([k, n]) => {
    const pts = (by[k] || []).filter((s) => s.followers != null);
    let lastV = null; let j = 0;
    while (j < pts.length && pts[j].date < keys[0]) lastV = pts[j++].followers;
    return { name: n, values: keys.map((d) => { while (j < pts.length && pts[j].date <= d) lastV = pts[j++].followers; return lastV; }) };
  });
  el.innerHTML = `${series.length > 1 ? `<div class="ax-legend">${series.map((s, i) => `<span><i style="background:${col(i)}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}<div data-plot></div>`;
  lineChart(el.querySelector('[data-plot]'), { x: keys, grain: 'date', series, height: 230, label: 'Followers by platform' });
}
function addForm(root, data) {
  const el = body(root, 'add');
  const today = new Date().toISOString().slice(0, 10);
  const st = S.status.sources.social.platforms || {};
  const manual = PLATFORMS.filter(([k]) => !(k === 'facebook' || k === 'instagram' ? st.meta : st[k]));
  const last = Object.fromEntries(PLATFORMS.map(([k]) => [k, [...data.snaps].reverse().find((s) => s.platform === k && s.followers != null)?.followers ?? '']));
  el.innerHTML = `<form class="ax-form" data-soc-form><label>Date<input type="date" name="date" value="${today}"></label>
    <div class="ax-form-grid">${manual.map(([k, n]) => `<label>${n}<input type="number" min="0" inputmode="numeric" name="${k}" placeholder="${last[k] === '' ? 'followers' : `last: ${last[k]}`}"></label>`).join('')}</div>
    <button class="ax-btn">Save Counts</button><span class="ax-fine" data-soc-msg></span></form>`;
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target); const date = f.get('date');
    const todo = manual.filter(([k]) => f.get(k) !== '' && f.get(k) != null);
    if (!todo.length) { el.querySelector('[data-soc-msg]').textContent = 'Type at least one number.'; return; }
    try {
      for (const [k] of todo) await api('/api/admin/ax/social', { method: 'POST', body: JSON.stringify({ platform: k, date, followers: f.get(k) }) });
      el.querySelector('[data-soc-msg]').textContent = `Saved ${todo.length}.`;
      social(root.closest('[data-view]') || root);
    } catch (err) { el.querySelector('[data-soc-msg]').textContent = err.message; }
  });
}
async function hqPosts(root, posts) {
  const el = body(root, 'hq');
  const p = period();
  const inRange = posts.filter((x) => { const d = new Date(x.at).toISOString().slice(0, 10); return d >= p.from && d <= p.to; });
  if (!inRange.length) { el.innerHTML = '<p class="ax-empty">No posts marked “Posted” in HQ → Social in this date range.</p>'; return; }
  const [r] = await Q([{ src: 'web', dims: ['date', 'source'], metrics: ['sessions'], filters: [{ d: 'channel', op: 'eq', v: 'Organic Social' }], limit: 5000 }]);
  const m = new Map((r?.rows || []).map((x) => [`${x[0]}|${String(x[1]).toLowerCase()}`, x[2]]));
  el.innerHTML = `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th class="is-dim">Posted</th><th class="is-dim">Item</th><th class="is-dim">Platform</th><th>Visits (3 days)</th></tr></thead><tbody>
    ${inRange.map((x) => { const d0 = new Date(x.at).toISOString().slice(0, 10); let v = 0; for (let i = 0; i < 3; i++) { const d = new Date(Date.parse(d0) + i * 86400000).toISOString().slice(0, 10); for (const s of WEBSRC[x.platform] || [x.platform]) v += m.get(`${d}|${s}`) || 0; }
      return `<tr><td class="is-dim">${dlabel(d0, 'date', true)}</td><td class="is-dim">${esc(x.item)}</td><td class="is-dim">${esc(PNAME[x.platform] || x.platform)}</td><td>${fmt(v)}</td></tr>`; }).join('')}</tbody></table></div>`;
}

/* ================================================================ UX (CLARITY) */
const CL = [
  ['Traffic.totalSessionCount', 'Sessions', 'num'], ['Traffic.distinctUserCount', 'Users', 'num'], ['Traffic.distantUserCount', 'Users', 'num'], ['Traffic.PagesPerSessionPercentage', 'Pages / Session', 'dec'],
  ['ScrollDepth.averageScrollDepth', 'Avg Scroll Depth', 'pct0'], ['EngagementTime.activeTime', 'Active Time', 'sec'], ['EngagementTime.totalTime', 'Total Time', 'sec'],
  ['DeadClickCount.sessionsWithMetricPercentage', 'Dead Clicks (% of sessions)', 'pct0'], ['RageClickCount.sessionsWithMetricPercentage', 'Rage Clicks (% of sessions)', 'pct0'],
  ['QuickbackClick.sessionsWithMetricPercentage', 'Quick Backs (% of sessions)', 'pct0'], ['ExcessiveScroll.sessionsWithMetricPercentage', 'Excessive Scrolling (%)', 'pct0'],
  ['ScriptErrorCount.sessionsWithMetricPercentage', 'JS Errors (% of sessions)', 'pct0'], ['ErrorClickCount.sessionsWithMetricPercentage', 'Error Clicks (%)', 'pct0'],
  ['Traffic.totalBotSessionCount', 'Bot Sessions', 'num'],
];
export async function ux(root) {
  const st = S.status.sources.clarity;
  if (!st.on) { root.innerHTML = grid(card('off', 'Microsoft Clarity Isn’t Connected Yet', { span: 12, sub: 'Clarity’s session recordings and heatmaps stay in Clarity. Here you get the numbers, kept forever, next to everything else.' })); body(root, 'off').innerHTML = setupHTML('clarity'); return; }
  const have = new Set((st.fields || []).map((f) => `${f.metric}.${f.field}`));
  const known = CL.filter(([k]) => have.has(k));
  const extra = (st.fields || []).map((f) => `${f.metric}.${f.field}`).filter((k) => !CL.some(([c]) => c === k)).map((k) => [k, k.replace('.', ' · '), 'num']);
  const all = [...known, ...extra];
  if (!all.length) { root.innerHTML = grid(card('wait', 'Clarity Is Connected', { span: 12 })); body(root, 'wait').innerHTML = `<p class="ax-empty">Waiting for the first daily pull (about 6am UTC). ${st.run && !st.run.ok ? `Last try failed: ${esc(st.run.info)}` : ''}</p>`; return; }
  const P = Object.fromEntries(all.map(([k, l, kind]) => [k, [l, kind]]));
  root.innerHTML = `<div class="ax-sub"><span class="ax-hint">Clarity numbers are per day (each pull = the 24 hours before ~6am UTC). Recordings and heatmaps: open Clarity.</span><a class="ax-link" href="https://clarity.microsoft.com/" target="_blank" rel="noopener">Open Clarity ↗</a></div>` + grid(`
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('trend', 'Over Time', { span: 12 })}
    ${card('url', 'Frustration by Page', { span: 12, sub: 'Rage clicks = tapping the same spot over and over. Dead clicks = tapping something that does nothing. Quick backs = left right away.' })}
    ${card('dev', 'By Device', { span: 6 })}
    ${card('chan', 'By Channel', { span: 6 })}`);
  const pick = (ks) => ks.filter((k) => P[k]);
  const head = pick(['Traffic.totalSessionCount', 'ScrollDepth.averageScrollDepth', 'EngagementTime.activeTime', 'DeadClickCount.sessionsWithMetricPercentage', 'RageClickCount.sessionsWithMetricPercentage', 'QuickbackClick.sessionsWithMetricPercentage']);
  const kEl = root.querySelector('[data-k]');
  const [cur, prv] = await Q([{ src: 'clarity', metrics: head.length ? head : [all[0][0]] }, { src: 'clarity', metrics: head.length ? head : [all[0][0]], prev: true }]);
  kEl.innerHTML = cur?.error ? errBox(cur.error) : `<div class="ax-kpis">${(head.length ? head : [all[0][0]]).map((k) => `<div class="ax-kpi"><span class="ax-kpi-l">${esc(P[k][0])}</span><b>${fmt(one(cur, k), P[k][1])}</b><div class="ax-kpi-f">${prv ? delta(one(cur, k), one(prv, k), /Click|Quickback|Error/.test(k)) : ''}</div></div>`).join('')}</div>`;
  // trend with chips
  const tEl = body(root, 'trend'); const tools = root.querySelector('[data-card="trend"] .ax-card-tools');
  let m = S.sub.clm && P[S.sub.clm] ? S.sub.clm : all[0][0];
  tools.innerHTML = `<select class="ax-select" data-clm>${all.map(([k, l]) => `<option value="${esc(k)}" ${k === m ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const drawT = async () => {
    const p = period(); const keys = timeline(p.from, p.to, p.grain);
    const [r] = await Q([{ src: 'clarity', dims: [p.grain], metrics: [m], limit: 5000 }]);
    if (r?.error) { tEl.innerHTML = errBox(r.error); return; }
    lineChart(tEl, { x: keys, grain: p.grain, series: [{ name: P[m][0], values: seriesOf(r, m, keys, { gaps: true }) }], kind: P[m][1], height: 240, area: true });
  };
  tools.querySelector('[data-clm]').addEventListener('change', (e) => { m = e.target.value; setSub('clm', m); drawT(); });
  const frus = pick(['Traffic.totalSessionCount', 'ScrollDepth.averageScrollDepth', 'DeadClickCount.sessionsWithMetricPercentage', 'RageClickCount.sessionsWithMetricPercentage', 'QuickbackClick.sessionsWithMetricPercentage', 'ScriptErrorCount.sessionsWithMetricPercentage']);
  const clTable = async (id, bd) => {
    const el = body(root, id);
    const ms = frus.length ? frus : [all[0][0]];
    const [r] = await Q([{ src: 'clarity', breakdown: bd, dims: ['value'], metrics: ms, sort: `-${ms[0]}`, limit: 200 }]);
    if (r?.error) { el.innerHTML = errBox(r.error); return; }
    el.innerHTML = r.rows.length ? `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th class="is-dim">${bd === 'URL' ? 'Page' : bd}</th>${ms.map((k) => `<th>${esc(P[k][0])}</th>`).join('')}</tr></thead><tbody>
      ${r.rows.slice(0, 25).map((x) => `<tr><td class="is-dim"><span class="ax-cell-l" title="${esc(x[0])}">${esc(x[0])}</span></td>${ms.map((k, i) => { const v = x[i + 1]; const bad = /Click|Quickback|Error/.test(k) && v >= 10; return `<td class="${bad ? 'is-bad' : ''}">${fmt(v, P[k][1])}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<p class="ax-empty">No Clarity data for this date range.</p>';
  };
  await run(drawT(), clTable('url', 'URL'), clTable('dev', 'Device'), clTable('chan', 'Channel'));
}

/* ================================================================ GA4 */
export async function ga4(root) {
  const st = S.status.sources.ga4;
  if (!st.on) { root.innerHTML = grid(card('off', 'GA4 Isn’t Connected Yet', { span: 12, sub: 'The site’s own event log already covers everything GA4 does, and keeps it forever. GA4 here is a cross-check.' })); body(root, 'off').innerHTML = setupHTML('ga4'); return; }
  root.innerHTML = grid(`
    ${card('cmp', 'GA4 vs the Site’s Own Log', { span: 12, sub: 'They’ll never match exactly: GA4 skips ad-blockers and your home IP filter, our log skips browsers sending “do not track” and HQ devices. Within ~20% is healthy.' })}
    <div class="ax-span" style="--span:12" data-k></div>
    ${card('trend', 'GA4 Over Time', { span: 12 })}
    ${card('tbl', 'GA4 Reports', { span: 12 })}`);
  const p = period(); const keys = timeline(p.from, p.to, p.grain);
  const [g, w, gt, wt] = await Q([{ src: 'ga4', metrics: ['sessions', 'users', 'views', 'key_events'] }, { src: 'web', metrics: ['sessions', 'users', 'views', 'key_events'], nofilter: true },
    { src: 'ga4', dims: [p.grain], metrics: ['sessions'], limit: 5000 }, { src: 'web', dims: [p.grain], metrics: ['sessions'], limit: 5000, nofilter: true }]);
  const el = body(root, 'cmp');
  if (g?.error) el.innerHTML = errBox(g.error);
  else {
    el.innerHTML = `<div class="ax-vs">${['sessions', 'users', 'views', 'key_events'].map((m) => { const a = one(g, m), b = one(w, m); const d = a && b ? (b - a) / a : null;
      return `<div><span class="ax-kpi-l">${mLabel(m)}</span><div class="ax-vs-n"><span><small>GA4</small><b>${fmt(a)}</b></span><span><small>Our log</small><b>${fmt(b)}</b></span></div><small class="${d != null && Math.abs(d) > 0.3 ? 'is-bad' : ''}">${d == null ? '' : `Our log is ${d >= 0 ? '+' : ''}${fmt(d, 'pct')} vs GA4`}</small></div>`; }).join('')}</div><div data-plot></div>`;
    lineChart(el.querySelector('[data-plot]'), { x: keys, grain: p.grain, series: [{ name: 'GA4 sessions', values: seriesOf(gt, 'sessions', keys, { gaps: true }) }, { name: 'Our log sessions', values: seriesOf(wt, 'sessions', keys) }], height: 200 });
    el.querySelector('[data-plot]').insertAdjacentHTML('beforebegin', `<div class="ax-legend"><span><i style="background:${col(0)}"></i>GA4</span><span><i style="background:${col(1)}"></i>Our log</span></div>`);
  }
  await run(
    kpis(root.querySelector('[data-k]'), [{ src: 'ga4', metric: 'sessions' }, { src: 'ga4', metric: 'users' }, { src: 'ga4', metric: 'new_users' }, { src: 'ga4', metric: 'views' }, { src: 'ga4', metric: 'engaged_rate' }, { src: 'ga4', metric: 'key_events' }]),
    trend(root, 'trend', { src: 'ga4', metrics: ['sessions', 'users', 'views', 'engaged', 'key_events', 'events'] }),
    table(root, 'tbl', { src: 'ga4', tabs: [['channel', 'Channel'], ['source_medium', 'Source / Medium'], ['landing', 'Landing Page'], ['page', 'Page'], ['device', 'Device'], ['country', 'Country'], ['city', 'City'], ['event', 'Event']],
      metrics: ['sessions', 'users', 'views', 'engaged_rate', 'key_events', 'events'], limit: 15, drill: false }),
  );
}

/* ================================================================ EXPLORE */
const XSRC = {
  web: { label: 'Site Sessions', dims: ['date', 'week', 'month', ...SESS_DIMS], metrics: ['sessions', 'users', 'new_users', 'views', 'engaged', 'engaged_rate', 'bounce_rate', 'views_per_session', 'avg_eng_sec', 'key_events', 'conv_sessions', 'conv_rate', 'quiz_starts', 'quiz_done', 'quiz_rate', 'leads', 'lead_rate'] },
  pages: { label: 'Page Views', dims: ['date', 'week', 'month', 'path', 'section', ...SESS_DIMS], metrics: ['views', 'users', 'sessions', 'entrances', 'avg_sec', 'eng_sec'] },
  events: { label: 'Events', dims: ['date', 'week', 'month', 'event', 'path', ...SESS_DIMS], metrics: ['count', 'users', 'sessions', 'per_user'], params: true },
  search: { label: 'Search (GSC + Bing)', dims: ['date', 'week', 'month', 'engine', 'query', 'page', 'pos_bucket'], metrics: ['clicks', 'impressions', 'ctr', 'position', 'queries', 'pages'] },
  email: { label: 'Email Sends', dims: ['date', 'week', 'month', 'email', 'kind', 'variant', 'test', 'mode', 'status', 'subject', 'source', 'level', 'contact_type'], metrics: ['sent', 'delivered', 'opened', 'clicked', 'unsubs', 'bounced', 'open_rate', 'click_rate', 'ctor', 'unsub_rate', 'total_clicks'] },
  list: { label: 'Email Sign-Ups', dims: ['date', 'week', 'month', 'source', 'level', 'status', 'measured', 'zip3', 'contact_type'], metrics: ['signups', 'active', 'unsubscribed', 'openers', 'clickers', 'measured', 'with_quiz'] },
  ga4: { label: 'GA4', dims: ['date', 'week', 'month', 'channel', 'source_medium', 'landing', 'page', 'device', 'country', 'city', 'event'], metrics: ['sessions', 'users', 'views', 'engaged', 'engaged_rate', 'key_events', 'events'] },
  social: { label: 'Social Followers', dims: ['date', 'week', 'month', 'platform'], metrics: ['followers', 'posts', 'views'] },
};
const TIME = ['date', 'week', 'month'];
export async function explore(root) {
  const x = { src: 'web', d1: 'channel', d2: '', ms: ['sessions', 'engaged_rate'], f: [], viz: 'auto', ...(S.sub.xq ? safeJSON(S.sub.xq) : {}) };
  let saved = [];
  root.innerHTML = `<div class="ax-explore">
    <aside class="ax-x-side ax-card"><h3>Build a View</h3>
      <label>Data<select data-x="src">${Object.entries(XSRC).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
      <label>Rows (Dimension)<select data-x="d1"></select></label>
      <label>Split By (Optional)<select data-x="d2"></select></label>
      <fieldset><legend>Metrics</legend><div class="ax-x-ms" data-x="ms"></div></fieldset>
      <fieldset><legend>Filters</legend><div data-x="f"></div><button type="button" class="ax-link" data-x="addf">+ Add a filter</button></fieldset>
      <label>Chart<select data-x="viz"><option value="auto">Automatic</option><option value="line">Line</option><option value="bar">Bars</option><option value="table">Table only</option></select></label>
      <div class="ax-x-save"><button type="button" class="ax-btn" data-x="save">Save View</button></div>
      <h4>Saved Views</h4><ul class="ax-x-saved" data-x="saved"><li class="ax-fine">Loading…</li></ul>
    </aside>
    <div class="ax-x-main">
      <section class="ax-card"><header class="ax-card-h"><div><h3 data-x="title">Explore</h3><p>Uses the date range up top${S.filters.length ? ' and the site filters' : ''}.</p></div><div class="ax-card-tools"><button type="button" class="ax-icon-btn" data-x="csv" title="Download CSV">⤓</button></div></header>
        <div class="ax-card-b" data-x="chart"></div><div class="ax-card-b" data-x="table"></div></section>
    </div></div>`;
  const $ = (k) => root.querySelector(`[data-x="${k}"]`);
  const dimOpts = () => {
    const base = XSRC[x.src].dims.map((d) => [d, dLabel(d)]);
    if (XSRC[x.src].params) for (const p of S.status.params || []) if (!base.some(([d]) => d === `p.${p.param}`)) base.push([`p.${p.param}`, `Param: ${p.param}`]);
    return base;
  };
  function syncUI() {
    $('src').value = x.src;
    const opts = dimOpts();
    if (!opts.some(([d]) => d === x.d1)) x.d1 = opts[0][0];
    if (x.d2 && !opts.some(([d]) => d === x.d2)) x.d2 = '';
    x.ms = x.ms.filter((m) => XSRC[x.src].metrics.includes(m)); if (!x.ms.length) x.ms = [XSRC[x.src].metrics[0]];
    $('d1').innerHTML = opts.map(([d, l]) => `<option value="${esc(d)}" ${d === x.d1 ? 'selected' : ''}>${esc(l)}</option>`).join('');
    $('d2').innerHTML = `<option value="">— None —</option>${opts.filter(([d]) => d !== x.d1).map(([d, l]) => `<option value="${esc(d)}" ${d === x.d2 ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;
    $('ms').innerHTML = XSRC[x.src].metrics.map((m) => `<label class="ax-check"><input type="checkbox" value="${m}" ${x.ms.includes(m) ? 'checked' : ''}> ${esc(mLabel(m))}</label>`).join('');
    $('viz').value = x.viz;
    $('f').innerHTML = x.f.map((f, i) => `<div class="ax-x-f"><select data-fi="${i}" data-k="d">${opts.filter(([d]) => !TIME.includes(d)).map(([d, l]) => `<option value="${esc(d)}" ${d === f.d ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select data-fi="${i}" data-k="op">${[['eq', 'is'], ['neq', 'is not'], ['contains', 'contains'], ['not_contains', 'doesn’t contain'], ['gt', '>'], ['lt', '<']].map(([o, l]) => `<option value="${o}" ${o === f.op ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input data-fi="${i}" data-k="v" value="${esc(f.v)}" placeholder="value"><button type="button" class="ax-icon-btn" data-frm="${i}" aria-label="Remove">✕</button></div>`).join('');
  }
  const changed = () => { setSub('xq', JSON.stringify(x)); syncUI(); runX(); };
  $('src').addEventListener('change', (e) => { x.src = e.target.value; x.f = []; changed(); });
  $('d1').addEventListener('change', (e) => { x.d1 = e.target.value; changed(); });
  $('d2').addEventListener('change', (e) => { x.d2 = e.target.value; changed(); });
  $('viz').addEventListener('change', (e) => { x.viz = e.target.value; changed(); });
  $('ms').addEventListener('change', () => { x.ms = [...$('ms').querySelectorAll('input:checked')].map((i) => i.value).slice(0, 8); changed(); });
  $('addf').addEventListener('click', () => { x.f.push({ d: dimOpts().find(([d]) => !TIME.includes(d))[0], op: 'eq', v: '' }); syncUI(); });
  $('f').addEventListener('change', (e) => { const i = e.target.dataset.fi; if (i == null) return; x.f[+i][e.target.dataset.k] = e.target.value; if (x.f[+i].v !== '') changed(); });
  $('f').addEventListener('click', (e) => { const b = e.target.closest('[data-frm]'); if (b) { x.f.splice(+b.dataset.frm, 1); changed(); } });
  let last = null;
  async function runX() {
    const p = period();
    const dims = [x.d1, ...(x.d2 ? [x.d2] : [])];
    $('title').textContent = `${x.ms.map(mLabel).join(', ')} by ${dims.map(dLabel).join(' × ')}`;
    $('chart').innerHTML = '<div class="ax-skel tall"></div>'; $('table').innerHTML = '';
    const filt = x.f.filter((f) => f.v !== '');
    const [r] = await Q([{ src: x.src, dims, metrics: x.ms, filters: filt, sort: TIME.includes(x.d1) ? x.d1 : `-${x.ms[0]}`, limit: 3000 }]);
    if (r?.error) { $('chart').innerHTML = errBox(r.error); return; }
    last = { r, dims };
    if (!r.rows.length) { $('chart').innerHTML = '<p class="ax-empty">No rows for this combination in this date range.</p>'; return; }
    const viz = x.viz === 'auto' ? (TIME.includes(x.d1) ? 'line' : 'bar') : x.viz;
    const m0 = x.ms[0];
    if (viz === 'line' && TIME.includes(x.d1)) {
      const keys = timeline(p.from, p.to, x.d1);
      let series;
      if (x.d2) {
        const tot = new Map(); for (const row of r.rows) tot.set(row[1], (tot.get(row[1]) || 0) + (row[2] || 0));
        const top = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
        series = top.map((v) => ({ name: v ?? '(not set)', values: seriesOf(r, m0, keys, { filterIdx: 1, filterVal: v }) }));
      } else series = x.ms.filter((m) => mKind(m) === mKind(m0)).slice(0, 4).map((m) => ({ name: mLabel(m), values: seriesOf(r, m, keys) }));
      $('chart').innerHTML = `${series.length > 1 ? `<div class="ax-legend">${series.map((s, i) => `<span><i style="background:${col(i)}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}<div data-plot></div>`;
      lineChart($('chart').querySelector('[data-plot]'), { x: keys, grain: x.d1, series, kind: mKind(m0), height: 300, area: series.length === 1 });
    } else if (viz === 'bar' || (viz === 'line' && !TIME.includes(x.d1))) {
      if (x.d2) {
        const tot = new Map(); for (const row of r.rows) tot.set(row[0], (tot.get(row[0]) || 0) + (row[2] || 0));
        const rowsTop = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        $('chart').innerHTML = `<div data-plot></div>`;
        barList($('chart').querySelector('[data-plot]'), rowsTop.map(([k, v]) => ({ label: k ?? '(not set)', value: v })), { kind: mKind(m0) });
      } else {
        $('chart').innerHTML = '<div data-plot></div>';
        barList($('chart').querySelector('[data-plot]'), r.rows.slice(0, 20).map((row) => ({ label: row[0] ?? '(not set)', value: row[1] })), { kind: mKind(m0) });
      }
    } else $('chart').innerHTML = '';
    // pivot-ish table: flat rows, sortable
    let sortI = dims.length, desc = !TIME.includes(x.d1);
    const drawTable = () => {
      const rows = [...r.rows].sort((a, b) => { const u = a[sortI], v = b[sortI]; const c = typeof u === 'string' || typeof v === 'string' ? String(u ?? '').localeCompare(String(v ?? '')) : (u ?? -Infinity) - (v ?? -Infinity); return desc ? -c : c; });
      $('table').innerHTML = `<div class="ax-table-wrap is-tall"><table class="ax-table"><thead><tr>${r.cols.map((c, i) => `<th data-si="${i}" class="${i < dims.length ? 'is-dim' : ''} ${i === sortI ? (desc ? 'is-desc' : 'is-asc') : ''}">${esc(i < dims.length ? dLabel(c) : mLabel(c))}</th>`).join('')}</tr></thead>
        <tbody>${rows.slice(0, 500).map((row) => `<tr>${row.map((v, i) => (i < dims.length ? `<td class="is-dim"><span class="ax-cell-l" title="${esc(v)}">${esc(TIME.includes(dims[i]) ? dlabel(v, dims[i], true) : v ?? '(not set)')}</span></td>` : `<td>${fmt(v, mKind(r.cols[i]))}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="ax-table-f"><span>${Math.min(500, rows.length)} of ${rows.length} rows${rows.length > 500 ? ' (CSV has them all)' : ''}</span></div>`;
      $('table').querySelectorAll('[data-si]').forEach((th) => th.addEventListener('click', () => { const i = +th.dataset.si; if (i === sortI) desc = !desc; else { sortI = i; desc = i >= dims.length; } drawTable(); }));
    };
    drawTable();
  }
  $('csv').addEventListener('click', () => {
    if (!last) return;
    const csv = [last.r.cols, ...last.r.rows].map((row) => row.map((v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `mowittall-explore-${x.src}-${period().from}-to-${period().to}.csv`; a.click();
  });
  const drawSaved = () => {
    $('saved').innerHTML = saved.length ? saved.map((v, i) => `<li><button type="button" class="ax-link" data-load="${i}">${esc(v.name)}</button><button type="button" class="ax-icon-btn" data-del="${i}" aria-label="Delete">✕</button></li>`).join('') : '<li class="ax-fine">Nothing saved yet. Build something useful, then Save View.</li>';
    $('saved').querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => { Object.assign(x, saved[+b.dataset.load].q); changed(); }));
    $('saved').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { saved.splice(+b.dataset.del, 1); drawSaved(); await api('/api/admin/ax/views', { method: 'POST', body: JSON.stringify({ views: saved }) }); }));
  };
  $('save').addEventListener('click', async () => {
    const name = prompt('Name this view', $('title').textContent); if (!name) return;
    saved.unshift({ name: name.slice(0, 80), q: { ...x } }); drawSaved();
    try { await api('/api/admin/ax/views', { method: 'POST', body: JSON.stringify({ views: saved }) }); } catch (e) { alert(e.message); }
  });
  syncUI(); runX();
  try { saved = (await api('/api/admin/ax/views')).views; } catch { saved = []; }
  drawSaved();
}
const safeJSON = (s) => { try { return JSON.parse(s); } catch { return {}; } };

/* ================================================================ SOURCES */
export async function sources(root, refresh) {
  const st = S.status.sources;
  const blocks = [
    ['search', 'Google Search Console + Bing', st.search.on, `${st.search.google ? 'Google ✓' : 'Google ✗'} · ${st.search.bing ? 'Bing ✓' : 'Bing ✗'}`],
    ['ga4', 'Google Analytics 4', st.ga4.on, st.ga4.run ? `${st.ga4.run.ok ? 'Last pull OK' : 'Last pull failed'}: ${st.ga4.run.info}` : st.ga4.on ? 'Waiting for the first pull' : ''],
    ['clarity', 'Microsoft Clarity', st.clarity.on, st.clarity.run ? `${st.clarity.run.ok ? 'Last pull OK' : 'Last pull failed'}: ${st.clarity.run.info}` : st.clarity.on ? 'Waiting for the first daily pull' : ''],
    ...Object.entries(st.social.runs || {}).map(([k, r]) => [k, r.label, !!(st.social.platforms || {})[k], r.at ? `${r.ok ? 'Last pull OK' : 'Last pull failed'}: ${r.info}` : (st.social.platforms || {})[k] ? 'Waiting for the first pull' : '']),
  ];
  root.innerHTML = grid(`
    ${card('pull', 'Refresh', { span: 12, sub: 'Everything refreshes on its own every hour. This forces a pull now (GA4, Clarity, social). Clarity only allows 10 calls a day, so don’t mash it.' })}
    ${blocks.map(([id, t]) => card(id, t, { span: 6 })).join('')}
    ${card('exp', 'Export', { span: 12, sub: 'Raw downloads from the site’s own log (for spreadsheets or MikeCOS).' })}`);
  body(root, 'pull').innerHTML = `<button type="button" class="ax-btn" data-pull>Pull Now</button> <span class="ax-fine" data-pmsg></span>`;
  root.querySelector('[data-pull]').addEventListener('click', async (e) => {
    e.target.disabled = true; root.querySelector('[data-pmsg]').textContent = 'Pulling… (up to a minute)';
    try { const r = await api('/api/admin/ax/run', { method: 'POST' }); root.querySelector('[data-pmsg]').textContent = Object.entries(r.did).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Nothing to pull (no sources connected).'; clearCache(); await refresh(); }
    catch (err) { root.querySelector('[data-pmsg]').textContent = err.message; }
    e.target.disabled = false;
  });
  for (const [id, , on, info] of blocks) body(root, id).innerHTML = `<p><span class="ax-dot ${on ? 'is-on' : ''}"></span> <b>${on ? 'Connected' : 'Not connected'}</b>${info ? ` · <span class="ax-fine">${esc(info)}</span>` : ''}</p>${on && !String(info || '').startsWith('Last pull failed') ? '' : setupHTML(id)}`;
  const p = period();
  body(root, 'exp').innerHTML = `<p class="ax-fine">For ${dlabel(p.from, 'date', true)} → ${dlabel(p.to, 'date', true)} (change the date range up top):</p><div class="ax-exp">${['ev_days', 'ev_sess', 'ev_pages', 'ev_landing', 'ev_events', 'ev_geo', 'ev_raw']
    .map((t) => `<button type="button" class="ax-btn is-ghost" data-exp="${t}">${t}.csv</button>`).join('')}</div>`;
  root.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', async () => {
    const t = b.dataset.exp;
    if (t === 'ev_sess') { const [r] = await Q([{ src: 'web', dims: ['date', 'channel', 'source_medium', 'landing', 'device', 'city'], metrics: ['sessions', 'users', 'views', 'engaged', 'avg_eng_sec', 'quiz_done', 'leads'], limit: 5000 }]);
      const csv = [r.cols, ...r.rows].map((row) => row.map((v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `mowittall-sessions-${p.from}-to-${p.to}.csv`; a.click(); return; }
    const r = await fetch(`/api/admin/events/export?table=${t}&from=${p.from}&to=${p.to}&format=csv`, { headers: { 'x-admin-key': localStorage.getItem('mit-admin') || '' } });
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `mowittall-${t}-${p.from}-to-${p.to}.csv`; a.click();
  }));
}
