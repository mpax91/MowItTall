// HQ Analytics core: state (in the URL hash, so every view is bookmarkable), the data layer (one batched POST
// per view to /api/admin/ax/q), and the shared building blocks: KPI tiles, trend cards, drill-down tables, the
// detail drawer and the global filter bar.

import { esc, fmt, dlabel, col, lineChart, spark, barList, stackedBars, showTip, hideTip } from './charts.js';
export { esc, fmt, dlabel, col };

/* ================================================================ labels */
export const DIM = {
  date: 'Date', week: 'Week', month: 'Month', channel: 'Channel', source: 'Source', medium: 'Medium', source_medium: 'Source / Medium', campaign: 'Campaign',
  landing: 'Landing Page', country: 'Country', region: 'State / Region', city: 'City', device: 'Device', os: 'Operating System', browser: 'Browser',
  user_type: 'New vs Returning', hour: 'Hour of Day', dow: 'Day of Week', engaged: 'Engaged?', converted: 'Converted?', path: 'Page', section: 'Site Section', event: 'Event',
  engine: 'Search Engine', query: 'Search Term', page: 'Page', pos_bucket: 'Position', email: 'Email', kind: 'Email Type', variant: 'Variant', test: 'A/B Test',
  mode: 'Send Mode', status: 'Status', subject: 'Subject', level: 'Effort Level', measured: 'Measured Yard?', zip3: 'ZIP (first 3)', contact_type: 'Real or Test',
  platform: 'Platform', value: 'Breakdown Value',
};
export const MET = {
  sessions: ['Sessions', 'num'], users: ['Users', 'num'], new_users: ['New Users', 'num'], views: ['Page Views', 'num'], engaged: ['Engaged Sessions', 'num'],
  engaged_rate: ['Engaged Rate', 'pct'], bounce_rate: ['Bounce Rate', 'pct', true], views_per_session: ['Pages / Session', 'dec'], avg_eng_sec: ['Avg Engagement', 'sec'],
  eng_sec: ['Total Engagement', 'sec'], key_events: ['Key Events', 'num'], conv_sessions: ['Converting Sessions', 'num'], conv_rate: ['Conversion Rate', 'pct'],
  quiz_starts: ['Quiz Starts', 'num'], quiz_done: ['Quiz Completions', 'num'], quiz_rate: ['Quiz Completion Rate', 'pct'], leads: ['Email Leads', 'num'], lead_rate: ['Lead Rate', 'pct'],
  entrances: ['Entrances', 'num'], avg_sec: ['Avg Time on Page', 'sec'], count: ['Event Count', 'num'], per_user: ['Events / User', 'dec'],
  clicks: ['Clicks', 'num'], impressions: ['Impressions', 'num'], ctr: ['CTR', 'pct'], position: ['Avg Position', 'pos', true], queries: ['Search Terms', 'num'], pages: ['Pages', 'num'],
  sent: ['Sent', 'num'], delivered: ['Delivered', 'num'], opened: ['Opened', 'num'], clicked: ['Clicked', 'num'], unsubs: ['Unsubscribes', 'num', true], bounced: ['Bounced', 'num', true],
  failed: ['Failed', 'num', true], open_rate: ['Open Rate', 'pct'], click_rate: ['Click Rate', 'pct'], ctor: ['Click-to-Open', 'pct'], unsub_rate: ['Unsub Rate', 'pct', true],
  total_clicks: ['Total Clicks', 'num'], total_opens: ['Total Opens', 'num'], signups: ['Sign-Ups', 'num'], active: ['Still Subscribed', 'num'], unsubscribed: ['Unsubscribed', 'num', true],
  clickers: ['Ever Clicked', 'num'], openers: ['Ever Opened', 'num'], measured: ['Measured Their Yard', 'num'], with_quiz: ['Took the Quiz', 'num'],
  followers: ['Followers', 'num'], posts: ['Posts', 'num'],
};
export const mLabel = (m) => MET[m]?.[0] || m;
export const mKind = (m) => MET[m]?.[1] || 'num';
export const mInvert = (m) => !!MET[m]?.[2];
export const dLabel = (d) => DIM[d] || (d.startsWith('p.') ? `Param: ${d.slice(2)}` : d);
// Dimensions that can filter site traffic everywhere (the global filter bar).
export const SESS_DIMS = ['channel', 'source', 'medium', 'source_medium', 'campaign', 'landing', 'country', 'region', 'city', 'device', 'os', 'browser', 'user_type', 'dow', 'hour', 'engaged', 'converted'];
export const SITE_SRC = new Set(['web', 'pages', 'events']);

/* ================================================================ state */
const ET = 'America/New_York';
export const etToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

export const S = { section: 'inbox', range: '28d', from: '', to: '', cmp: 'prev', grain: 'auto', filters: [], status: null, sub: {} };
export const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 Days'], ['28d', 'Last 28 Days'], ['90d', 'Last 90 Days'], ['365d', 'Last 12 Months'],
  ['mtd', 'This Month'], ['lastmonth', 'Last Month'], ['ytd', 'This Year'], ['all', 'All Time'], ['custom', 'Custom…']];

export function firstDay() {
  const sp = S.status?.sources || {};
  const ds = [sp.web?.span?.a, sp.search?.span?.a, sp.search?.bingSpan?.a, sp.ga4?.span?.a].filter(Boolean).sort();
  return ds[0] || addDays(etToday(), -27);
}
export function period() {
  const t = etToday();
  let from, to = t;
  switch (S.range) {
    case 'today': from = t; break;
    case 'yesterday': from = to = addDays(t, -1); break;
    case '7d': from = addDays(t, -6); break;
    case '90d': from = addDays(t, -89); break;
    case '365d': from = addDays(t, -364); break;
    case 'mtd': from = t.slice(0, 8) + '01'; break;
    case 'lastmonth': { const d = new Date(t.slice(0, 8) + '01T12:00:00Z'); d.setUTCDate(0); to = d.toISOString().slice(0, 10); from = to.slice(0, 8) + '01'; break; }
    case 'ytd': from = t.slice(0, 4) + '-01-01'; break;
    case 'all': from = firstDay(); break;
    case 'custom': from = S.from || addDays(t, -27); to = S.to || t; break;
    default: from = addDays(t, -27);
  }
  if (from > to) [from, to] = [to, from];
  const len = daysBetween(from, to);
  let prev = null;
  if (S.cmp === 'prev') prev = { from: addDays(from, -len), to: addDays(from, -1) };
  if (S.cmp === 'year') prev = { from: addDays(from, -364), to: addDays(to, -364) };
  const grain = S.grain !== 'auto' ? S.grain : len <= 62 ? 'date' : len <= 270 ? 'week' : 'month';
  return { from, to, len, prev, grain };
}

export function readHash() {
  const [sec, qs] = location.hash.replace(/^#\/?/, '').split('?');
  if (sec) S.section = sec;
  const p = new URLSearchParams(qs || '');
  S.range = p.get('r') || S.range; S.from = p.get('from') || ''; S.to = p.get('to') || '';
  S.cmp = p.get('c') || S.cmp; S.grain = p.get('g') || S.grain;
  S.filters = (p.get('f') || '').split('|').filter(Boolean).map((x) => { const [d, op, ...v] = x.split('~'); return { d, op, v: decodeURIComponent(v.join('~')) }; }).filter((f) => SESS_DIMS.includes(f.d));
  S.sub = Object.fromEntries([...p.entries()].filter(([k]) => k.startsWith('x.')).map(([k, v]) => [k.slice(2), v]));
}
export function writeHash() {
  const p = new URLSearchParams();
  if (S.range !== '28d') p.set('r', S.range);
  if (S.range === 'custom') { p.set('from', S.from); p.set('to', S.to); }
  if (S.cmp !== 'prev') p.set('c', S.cmp);
  if (S.grain !== 'auto') p.set('g', S.grain);
  if (S.filters.length) p.set('f', S.filters.map((f) => `${f.d}~${f.op}~${encodeURIComponent(f.v)}`).join('|'));
  for (const [k, v] of Object.entries(S.sub)) if (v != null && v !== '') p.set(`x.${k}`, v);
  const qs = p.toString();
  history.replaceState(null, '', `#${S.section}${qs ? '?' + qs : ''}`);
}
export const setSub = (k, v) => { S.sub[k] = v; writeHash(); };

/* ================================================================ data */
let KEY = '';
try { KEY = localStorage.getItem('mit-admin') || ''; } catch { /* private mode */ }
export const setKey = (k) => { KEY = k; try { localStorage.setItem('mit-admin', k); } catch { /* */ } };
export const hasKey = () => !!KEY;
export async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'x-admin-key': KEY, 'content-type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({ error: 'Something broke.' }));
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
  return j;
}
const cache = new Map();
export const clearCache = () => cache.clear();
// Run a batch of queries. Site-traffic queries get the global filters unless q.nofilter.
export async function Q(list) {
  const shaped = list.map((q) => {
    const p = period();
    const range = q.prev ? p.prev : p;
    const filters = [...(q.filters || []), ...(SITE_SRC.has(q.src) && !q.nofilter ? S.filters : [])];
    const out = { src: q.src, dims: q.dims || [], metrics: q.metrics, filters, from: q.from || range?.from, to: q.to || range?.to, sort: q.sort, limit: q.limit, breakdown: q.breakdown };
    if (q.prev && !p.prev) return null;
    return out;
  });
  const need = shaped.map((q, i) => [q, i]).filter(([q]) => q && !cache.has(JSON.stringify(q)));
  if (need.length) {
    const { results } = await api('/api/admin/ax/q', { method: 'POST', body: JSON.stringify({ qs: need.map(([q]) => q) }) });
    need.forEach(([q], j) => { if (!results[j].error) cache.set(JSON.stringify(q), results[j]); else cache.set(JSON.stringify(q) + '#err', results[j]); });
    need.forEach(([q], j) => { if (results[j].error) results[j].__err = true; });
    return shaped.map((q) => (q ? cache.get(JSON.stringify(q)) || cache.get(JSON.stringify(q) + '#err') : null));
  }
  return shaped.map((q) => (q ? cache.get(JSON.stringify(q)) || cache.get(JSON.stringify(q) + '#err') : null));
}
// Row lookup helpers
export const one = (res, m) => (res?.rows?.[0] ? res.rows[0][res.cols.indexOf(m)] : null);
export function timeline(from, to, grain) {
  const out = [];
  if (grain === 'month') { let m = from.slice(0, 7); while (m <= to.slice(0, 7)) { out.push(m); const [y, mm] = m.split('-').map(Number); m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`; } return out; }
  if (grain === 'week') { const d = new Date(from + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); let w = d.toISOString().slice(0, 10); while (w <= to) { out.push(w); w = addDays(w, 7); } return out; }
  let x = from; while (x <= to) { out.push(x); x = addDays(x, 1); } return out;
}
// gaps: days with no data are blank (not 0) — for sources that arrive late (search lags 2–3 days, GA4, Clarity).
export const GAPPY = new Set(['search', 'ga4', 'clarity', 'social']);
export function seriesOf(res, metric, keys, { dimIdx = 0, filterIdx = null, filterVal = null, gaps = false } = {}) {
  const m = new Map();
  if (res?.rows) { const mi = res.cols.indexOf(metric); for (const r of res.rows) { if (filterIdx != null && r[filterIdx] !== filterVal) continue; m.set(r[dimIdx], (m.get(r[dimIdx]) || 0) + (r[mi] || 0)); } }
  return keys.map((k) => (m.has(k) ? m.get(k) : gaps ? null : 0));
}

/* ================================================================ layout helpers */
export function card(id, title, { sub = '', tools = '', span = 12, cls = '' } = {}) {
  return `<section class="ax-card ${cls}" style="--span:${span}" data-card="${id}">
    <header class="ax-card-h"><div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div><div class="ax-card-tools">${tools}</div></header>
    <div class="ax-card-b" data-body="${id}"><div class="ax-skel"></div></div></section>`;
}
export const body = (root, id) => root.querySelector(`[data-body="${id}"]`);
export const errBox = (msg) => `<p class="ax-empty is-err">${esc(msg)}</p>`;
export function chips(name, opts, cur) {
  return `<div class="ax-seg" role="group" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;
}
export function onSeg(root, name, fn) {
  root.querySelector(`[data-seg="${name}"]`)?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fn(b.dataset.v);
  });
}
export function delta(cur, prev, invert = false) {
  if (prev == null || cur == null || S.cmp === 'none') return '';
  if (!prev) return cur ? '<span class="ax-delta is-new">new</span>' : '';
  const d = (cur - prev) / Math.abs(prev);
  if (Math.abs(d) < 0.005) return '<span class="ax-delta">0%</span>';
  const good = invert ? d < 0 : d > 0;
  return `<span class="ax-delta ${good ? 'is-up' : 'is-down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d) >= 10 ? `${Math.round(d)}×` : fmt(Math.abs(d), 'pct')}</span>`;
}
export const cmpLabel = () => (S.cmp === 'year' ? 'vs last year' : S.cmp === 'prev' ? 'vs previous period' : '');

/* ================================================================ KPI row */
// items: [{ src, metric, label?, filters?, kind?, invert?, extra? }]
export async function kpis(el, items) {
  const p = period();
  const keys = timeline(p.from, p.to, p.grain);
  const qs = [];
  for (const it of items) {
    const base = { src: it.src, metrics: [it.metric], filters: it.filters, breakdown: it.breakdown };
    qs.push({ ...base }, { ...base, prev: true }, { ...base, dims: [p.grain] });
  }
  el.innerHTML = `<div class="ax-kpis">${items.map(() => '<div class="ax-kpi"><div class="ax-skel sm"></div></div>').join('')}</div>`;
  let res;
  try { res = await Q(qs); } catch (e) { el.innerHTML = errBox(e.message); return; }
  el.innerHTML = `<div class="ax-kpis">${items.map((it, i) => {
    const [c, pv, ts] = res.slice(i * 3, i * 3 + 3);
    if (c?.error) return `<div class="ax-kpi is-off"><span class="ax-kpi-l">${esc(it.label || mLabel(it.metric))}</span><b>—</b><small>${esc(it.offMsg || 'Not connected')}</small></div>`;
    const v = one(c, it.metric), pvv = pv ? one(pv, it.metric) : null;
    const kind = it.kind || mKind(it.metric), inv = it.invert ?? mInvert(it.metric);
    const sp = ts && !ts.error ? seriesOf(ts, it.metric, keys, { gaps: GAPPY.has(it.src) }).filter((x, j, a) => x != null || a.slice(j).some((y) => y != null)) : [];
    return `<div class="ax-kpi${it.go ? ' is-link' : ''}" ${it.go ? `data-go="${it.go}"` : ''} title="${esc(it.help || '')}">
      <span class="ax-kpi-l">${esc(it.label || mLabel(it.metric))}</span>
      <b>${fmt(v, kind)}</b>
      <div class="ax-kpi-f">${delta(v, pvv, inv)}${pvv != null && S.cmp !== 'none' ? `<small>${fmt(pvv, kind)} before</small>` : ''}</div>
      ${keys.length > 1 && !['pct', 'pos', 'sec', 'dec'].includes(kind) && !['queries', 'pages'].includes(it.metric) ? spark(sp, { color: 'var(--s1)' }) : ''}</div>`;
  }).join('')}</div>`;
  el.querySelectorAll('[data-go]').forEach((k) => k.addEventListener('click', () => go(k.dataset.go)));
}

/* ================================================================ trend card */
// metrics: list of metric keys; the chip row switches. Compare period drawn dashed.
export function trend(root, id, { src, metrics, filters, height = 260, breakdown, area = true }) {
  const el = body(root, id);
  const host = root.querySelector(`[data-card="${id}"] .ax-card-tools`);
  let m = S.sub[`${id}.m`] && metrics.includes(S.sub[`${id}.m`]) ? S.sub[`${id}.m`] : metrics[0];
  if (metrics.length > 1) { host.insertAdjacentHTML('afterbegin', chips(`${id}-m`, metrics.map((k) => [k, mLabel(k)]), m)); onSeg(root, `${id}-m`, (v) => { m = v; setSub(`${id}.m`, v); draw(); }); }
  async function draw() {
    const p = period(); const keys = timeline(p.from, p.to, p.grain);
    el.innerHTML = '<div class="ax-skel tall"></div>';
    const [c, pv] = await Q([{ src, dims: [p.grain], metrics: [m], filters, breakdown, limit: 5000 }, { src, dims: [p.grain], metrics: [m], filters, breakdown, prev: true, limit: 5000 }]);
    if (c?.error) { el.innerHTML = errBox(c.error); return; }
    const gaps = GAPPY.has(src) || mKind(m) !== 'num';
    const series = [{ name: `${mLabel(m)}`, values: seriesOf(c, m, keys, { gaps }), color: 'var(--s1)' }];
    if (pv && !pv.error) {
      const pkeys = timeline(p.prev.from, p.prev.to, p.grain);
      const pvals = seriesOf(pv, m, pkeys, { gaps });
      series.push({ name: S.cmp === 'year' ? 'Last year' : 'Previous period', values: keys.map((_, i) => (i < pvals.length ? pvals[i] : null)), color: 'var(--ink-3)', dash: true, labelAt: (i) => `${pkeys[i] ? dlabel(pkeys[i], p.grain) : ''} (before)` });
    }
    if (!c.rows.length) { el.innerHTML = `<p class="ax-empty">No ${esc(mLabel(m).toLowerCase())} in this date range yet.</p>`; return; }
    lineChart(el, { x: keys, grain: p.grain, series, kind: mKind(m), height, area, label: `${mLabel(m)} over time` });
  }
  return draw();
}

/* ================================================================ stacked breakdown over time */
export async function stackTrend(root, id, { src, dim, metric, filters, top = 6 }) {
  const el = body(root, id);
  const p = period(); const keys = timeline(p.from, p.to, p.grain);
  const [tot, rows] = await Q([{ src, dims: [dim], metrics: [metric], filters, sort: `-${metric}`, limit: 50 }, { src, dims: [p.grain, dim], metrics: [metric], filters, limit: 5000 }]);
  if (tot?.error) { el.innerHTML = errBox(tot.error); return; }
  if (!tot.rows.length) { el.innerHTML = '<p class="ax-empty">No data in this date range yet.</p>'; return; }
  const names = tot.rows.slice(0, top).map((r) => r[0]);
  const series = names.map((n) => ({ name: n ?? '(not set)', values: seriesOf(rows, metric, keys, { dimIdx: 0, filterIdx: 1, filterVal: n }) }));
  if (tot.rows.length > top) {
    const allV = seriesOf(rows, metric, keys);
    series.push({ name: 'Other', values: allV.map((v, i) => Math.max(0, v - series.reduce((a, s) => a + s.values[i], 0))) });
  }
  el.innerHTML = `<div class="ax-legend">${series.map((s, i) => `<span><i style="background:${col(i)}"></i>${esc(s.name)}</span>`).join('')}</div><div data-plot></div>`;
  stackedBars(el.querySelector('[data-plot]'), { x: keys, grain: p.grain, series, kind: mKind(metric), height: 240, label: `${mLabel(metric)} by ${dLabel(dim)}` });
}

/* ================================================================ bar list card */
export async function bars(root, id, { src, dim, metric, filters, limit = 8, drill = true, kind, breakdown, labelFn }) {
  const el = body(root, id);
  const [r] = await Q([{ src, dims: [dim], metrics: [metric], filters, sort: `-${metric}`, limit, breakdown }]);
  if (r?.error) { el.innerHTML = errBox(r.error); return; }
  barList(el, r.rows.map((x) => ({ label: labelFn ? labelFn(x[0]) : x[0] ?? '(not set)', value: x[1], raw: x[0] })), {
    kind: kind || mKind(metric),
    onPick: drill ? (row) => openDrill({ src, dim, value: row.raw, metric, filters }) : null,
  });
}

/* ================================================================ drill-down table */
// opts: { src, tabs: [[dim, label]], metrics, sort, filters, limit, compare, rowLink, extraDims }
export function table(root, id, opts) {
  const el = body(root, id);
  const host = root.querySelector(`[data-card="${id}"] .ax-card-tools`);
  let dim = S.sub[`${id}.d`] && opts.tabs.some(([d]) => d === S.sub[`${id}.d`]) ? S.sub[`${id}.d`] : opts.tabs[0][0];
  let sortKey = opts.sort || opts.metrics[0], sortDesc = true, search = '', show = opts.limit || 10, data = null;
  host.insertAdjacentHTML('afterbegin', `${opts.tabs.length > 1 ? chips(`${id}-d`, opts.tabs, dim) : ''}
    <input class="ax-search" type="search" placeholder="Search…" aria-label="Search rows" data-tsearch>
    <button type="button" class="ax-icon-btn" data-csv title="Download CSV" aria-label="Download CSV">⤓</button>`);
  if (opts.tabs.length > 1) onSeg(root, `${id}-d`, (v) => { dim = v; setSub(`${id}.d`, v); load(); });
  host.querySelector('[data-tsearch]').addEventListener('input', (e) => { search = e.target.value.toLowerCase(); render(); });
  host.querySelector('[data-csv]').addEventListener('click', () => {
    if (!data) return;
    const cols = [dLabel(dim), ...opts.metrics.map(mLabel)];
    const csv = [cols, ...data.rows.map((r) => r)].map((r) => r.map((v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const p = period(); a.download = `mowittall-${id}-${dim}-${p.from}-to-${p.to}.csv`; a.click();
  });
  async function load() {
    el.innerHTML = '<div class="ax-skel tall"></div>';
    const base = { src: opts.src, dims: [dim, ...(opts.extraDims || [])], metrics: opts.metrics, filters: opts.filters, sort: `-${opts.sort || opts.metrics[0]}`, limit: opts.fetch || 500, breakdown: opts.breakdown };
    const [c, pv] = await Q([base, ...(opts.compare !== false ? [{ ...base, prev: true }] : [])]);
    if (c?.error) { el.innerHTML = errBox(c.error); return; }
    data = c;
    const nd = 1 + (opts.extraDims || []).length;
    const keyOf = (r) => r.slice(0, nd).map((v) => (v == null || v === '' ? '(not set)' : v)).join(' · ');
    data.rows = data.rows.map((r) => [keyOf(r), ...r.slice(nd)]); data.cols = [dim, ...data.cols.slice(nd)];
    data.prevMap = pv && !pv.error ? new Map(pv.rows.map((r) => [keyOf(r), [keyOf(r), ...r.slice(nd)]])) : null;
    render();
  }
  function render() {
    if (!data) return;
    const mi = opts.metrics.map((m) => data.cols.indexOf(m));
    const si = data.cols.indexOf(sortKey);
    let rows = data.rows.filter((r) => !search || String(r[0] ?? '').toLowerCase().includes(search));
    rows = [...rows].sort((a, b) => { const x = a[si], y = b[si]; const c = typeof x === 'string' || typeof y === 'string' ? String(x ?? '').localeCompare(String(y ?? '')) : (x ?? -Infinity) - (y ?? -Infinity); return sortDesc ? -c : c; });
    const max = Math.max(1e-9, ...rows.map((r) => r[mi[0]] || 0));
    const tot = opts.metrics.map((m, j) => (['num'].includes(mKind(m)) ? rows.reduce((a, r) => a + (r[mi[j]] || 0), 0) : null));
    const drillable = opts.drill !== false;
    el.innerHTML = rows.length ? `<div class="ax-table-wrap"><table class="ax-table">
      <thead><tr><th class="is-dim">${esc(dLabel(dim))}</th>${opts.metrics.map((m) => `<th data-sort="${m}" class="${m === sortKey ? (sortDesc ? 'is-desc' : 'is-asc') : ''}" aria-sort="${m === sortKey ? (sortDesc ? 'descending' : 'ascending') : 'none'}">${esc(mLabel(m))}</th>`).join('')}${data.prevMap ? '<th class="is-delta">Change</th>' : ''}</tr></thead>
      <tbody>${rows.slice(0, show).map((r) => {
        const p = data.prevMap?.get(r[0]);
        const label = r[0] == null || r[0] === '' ? '(not set)' : String(r[0]);
        const shown = opts.labelFn ? opts.labelFn(label) : label;
        return `<tr${drillable ? ` tabindex="0" data-row="${esc(label)}"` : ''}><td class="is-dim"><span class="ax-cell-l" title="${esc(label)}">${esc(shown)}</span>${opts.rowLink?.(label) ? `<a class="ax-ext" href="${esc(opts.rowLink(label))}" target="_blank" rel="noopener" title="Open page" data-stop>↗</a>` : ''}</td>
          ${opts.metrics.map((m, j) => `<td>${j === 0 ? `<span class="ax-cellbar" style="width:${((r[mi[j]] || 0) / max) * 100}%"></span>` : ''}${fmt(r[mi[j]], mKind(m))}</td>`).join('')}
          ${data.prevMap ? `<td class="is-delta">${p ? delta(r[mi[0]], p[mi[0]], mInvert(opts.metrics[0])) : r[mi[0]] ? '<span class="ax-delta is-new">new</span>' : ''}</td>` : ''}</tr>`;
      }).join('')}</tbody>
      ${rows.length > 1 && tot.some((t) => t != null) ? `<tfoot><tr><td class="is-dim">Total (${rows.length} rows)</td>${tot.map((t) => `<td>${t == null ? '' : fmt(t)}</td>`).join('')}${data.prevMap ? '<td></td>' : ''}</tr></tfoot>` : ''}
    </table></div>
    <div class="ax-table-f"><span>${Math.min(show, rows.length)} of ${rows.length}${data.rows.length >= (opts.fetch || 500) ? '+' : ''}</span>
      ${rows.length > show ? `<button type="button" class="ax-link" data-more>Show ${Math.min(rows.length - show, show < 25 ? 25 - show : 50)} more</button>` : ''}
      ${drillable ? '<span class="ax-hint">Click a row to dig in</span>' : ''}</div>`
      : `<p class="ax-empty">${search ? 'Nothing matches that search.' : 'No data in this date range yet.'}</p>`;
    el.querySelectorAll('[data-sort]').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.sort; if (sortKey === k) sortDesc = !sortDesc; else { sortKey = k; sortDesc = true; } render(); }));
    el.querySelector('[data-more]')?.addEventListener('click', () => { show = show < 25 ? 25 : show + 50; render(); });
    el.querySelectorAll('[data-stop]').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
    if (drillable) el.querySelectorAll('[data-row]').forEach((tr) => {
      const go2 = () => (opts.onRow ? opts.onRow(tr.dataset.row, dim) : openDrill({ src: opts.src, dim, value: tr.dataset.row === '(not set)' ? tr.dataset.row : tr.dataset.row, metric: opts.metrics[0], filters: opts.filters, metrics: opts.metrics, breakdown: opts.breakdown }));
      tr.addEventListener('click', go2); tr.addEventListener('keydown', (e) => e.key === 'Enter' && go2());
    });
  }
  return load();
}

/* ================================================================ drill-down drawer */
const DRILL_BREAKS = {
  web: ['channel', 'source_medium', 'landing', 'device', 'city', 'user_type'],
  pages: ['channel', 'source', 'device', 'city', 'user_type'],
  events: ['path', 'channel', 'device', 'city'],
  search: ['engine', 'pos_bucket'],
  email: ['variant', 'source', 'level', 'status'],
  list: ['source', 'level', 'status', 'zip3'],
  ga4: [],
};
export async function openDrill({ src, dim, value, metric, filters = [], metrics, breakdown }) {
  const d = document.querySelector('[data-drawer]');
  const f = [...filters, { d: dim, op: 'eq', v: value }];
  const canFilter = SESS_DIMS.includes(dim) && SITE_SRC.has(src);
  let breaks = (DRILL_BREAKS[src] || []).filter((b) => b !== dim);
  if (src === 'search') breaks = dim === 'query' ? ['page', 'engine'] : dim === 'page' ? ['query', 'engine'] : ['query', 'page'];
  if (src === 'events' && dim === 'event') {
    const ps = (S.status?.params || []).filter((x) => x.name === value).slice(0, 6).map((x) => `p.${x.param}`);
    breaks = [...ps, 'path', 'channel', 'device'];
  }
  const ms = (metrics || [metric]).slice(0, 4);
  d.hidden = false; document.body.classList.add('has-drawer');
  d.innerHTML = `<div class="ax-drawer-in" role="dialog" aria-label="Details for ${esc(value)}">
    <header><div><small>${esc(dLabel(dim))}</small><h2>${esc(value)}</h2></div><button type="button" class="ax-icon-btn" data-close aria-label="Close">✕</button></header>
    <div class="ax-drawer-actions">${canFilter ? `<button type="button" class="ax-btn" data-filter>Filter Everything by This</button><button type="button" class="ax-btn is-ghost" data-exclude>Exclude This</button>` : ''}
      ${dim === 'path' || dim === 'landing' || (dim === 'page' && src === 'search') ? `<a class="ax-btn is-ghost" href="${esc(value)}" target="_blank" rel="noopener">Open Page ↗</a>` : ''}
      ${dim === 'path' || dim === 'landing' || (dim === 'page' && src === 'search') ? `<button type="button" class="ax-btn is-ghost" data-cross>See It Everywhere</button>` : ''}</div>
    <div class="ax-drawer-k" data-dk></div><div data-dt class="ax-drawer-chart"></div>
    ${breaks.map((b, i) => `<h4>By ${esc(dLabel(b))}</h4><div data-db="${i}"></div>`).join('')}</div>`;
  const close = () => { d.hidden = true; d.innerHTML = ''; document.body.classList.remove('has-drawer'); };
  d.querySelector('[data-close]').addEventListener('click', close);
  d.addEventListener('click', (e) => { if (e.target === d) close(); }, { once: true });
  d.querySelector('[data-filter]')?.addEventListener('click', () => { close(); addFilter({ d: dim, op: 'eq', v: value }); });
  d.querySelector('[data-exclude]')?.addEventListener('click', () => { close(); addFilter({ d: dim, op: 'neq', v: value }); });
  d.querySelector('[data-cross]')?.addEventListener('click', () => { close(); crossPage(value); });
  const p = period(); const keys = timeline(p.from, p.to, p.grain);
  try {
    const res = await Q([{ src, metrics: ms, filters: f, breakdown }, { src, metrics: ms, filters: f, prev: true, breakdown }, { src, dims: [p.grain], metrics: [metric], filters: f, limit: 5000, breakdown },
      ...breaks.map((b) => ({ src, dims: [b], metrics: [metric], filters: f, sort: `-${metric}`, limit: 8, breakdown }))]);
    const [c, pv, ts, ...bs] = res;
    d.querySelector('[data-dk]').innerHTML = c?.error ? errBox(c.error) : ms.map((m) => `<div><span>${esc(mLabel(m))}</span><b>${fmt(one(c, m), mKind(m))}</b>${pv ? delta(one(c, m), one(pv, m), mInvert(m)) : ''}</div>`).join('');
    if (ts && !ts.error && ts.rows.length) lineChart(d.querySelector('[data-dt]'), { x: keys, grain: p.grain, series: [{ name: mLabel(metric), values: seriesOf(ts, metric, keys, { gaps: GAPPY.has(src) || mKind(metric) !== 'num' }) }], kind: mKind(metric), height: 180, area: true });
    else d.querySelector('[data-dt]').innerHTML = src === 'search' && dim && keys.length ? '' : '';
    bs.forEach((b, i) => {
      const host = d.querySelector(`[data-db="${i}"]`);
      if (!host) return;
      if (b?.error) { host.innerHTML = errBox(b.error); return; }
      barList(host, b.rows.map((r) => ({ label: r[0] ?? '(not set)', value: r[1], raw: r[0] })), { kind: mKind(metric), onPick: (row) => openDrill({ src, dim: breaks[i], value: row.raw, metric, filters: f, metrics, breakdown }) });
    });
  } catch (e) { d.querySelector('[data-dk]').innerHTML = errBox(e.message); }
}
// One page across every source: traffic, search, Clarity.
async function crossPage(path) {
  const d = document.querySelector('[data-drawer]');
  d.hidden = false; document.body.classList.add('has-drawer');
  d.innerHTML = `<div class="ax-drawer-in"><header><div><small>Everything About</small><h2>${esc(path)}</h2></div><button type="button" class="ax-icon-btn" data-close aria-label="Close">✕</button></header><div data-x><div class="ax-skel tall"></div></div></div>`;
  d.querySelector('[data-close]').addEventListener('click', () => { d.hidden = true; document.body.classList.remove('has-drawer'); });
  const [pg, land, srch, srcs] = await Q([
    { src: 'pages', metrics: ['views', 'users', 'avg_sec', 'entrances'], filters: [{ d: 'path', op: 'eq', v: path }] },
    { src: 'web', metrics: ['sessions', 'engaged_rate', 'conv_rate', 'leads'], filters: [{ d: 'landing', op: 'eq', v: path }] },
    { src: 'search', metrics: ['clicks', 'impressions', 'ctr', 'position'], filters: [{ d: 'page', op: 'eq', v: path }] },
    { src: 'web', dims: ['channel'], metrics: ['sessions'], filters: [{ d: 'landing', op: 'eq', v: path }], sort: '-sessions', limit: 8 },
  ]);
  const block = (title, r, ms) => `<h4>${title}</h4><div class="ax-drawer-k">${r?.error ? errBox(r.error) : ms.map((m) => `<div><span>${mLabel(m)}</span><b>${fmt(one(r, m), mKind(m))}</b></div>`).join('')}</div>`;
  d.querySelector('[data-x]').innerHTML = block('On the Page', pg, ['views', 'users', 'avg_sec', 'entrances']) + block('As a Landing Page', land, ['sessions', 'engaged_rate', 'conv_rate', 'leads'])
    + block('In Search (Google + Bing)', srch, ['clicks', 'impressions', 'ctr', 'position']) + '<h4>How People Got Here</h4><div data-xc></div>';
  barList(d.querySelector('[data-xc]'), (srcs?.rows || []).map((r) => ({ label: r[0], value: r[1] })));
}

/* ================================================================ global filters */
let rerender = () => {};
export const onRerender = (fn) => { rerender = fn; };
export function addFilter(f) {
  S.filters = S.filters.filter((x) => !(x.d === f.d && x.op === f.op && x.v === f.v));
  S.filters.push(f); writeHash(); renderFilters(); rerender();
}
const OPN = { eq: 'is', neq: 'is not', contains: 'contains', not_contains: 'doesn’t contain' };
export function renderFilters() {
  const bar = document.querySelector('[data-filters]');
  bar.innerHTML = `${S.filters.map((f, i) => `<span class="ax-fchip"><b>${esc(dLabel(f.d))}</b> ${OPN[f.op] || f.op} <q>${esc(f.v)}</q><button type="button" data-rm="${i}" aria-label="Remove filter">✕</button></span>`).join('')}
    <button type="button" class="ax-addf" data-addf>+ Filter</button>${S.filters.length > 1 ? '<button type="button" class="ax-link" data-clearf>Clear all</button>' : ''}
    ${S.filters.length && !['overview', 'acquisition', 'content', 'conversions', 'audience', 'explore', 'social'].includes(S.section) ? '<span class="ax-hint">Filters apply to site traffic only</span>' : ''}`;
  bar.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { S.filters.splice(+b.dataset.rm, 1); writeHash(); renderFilters(); rerender(); }));
  bar.querySelector('[data-clearf]')?.addEventListener('click', () => { S.filters = []; writeHash(); renderFilters(); rerender(); });
  bar.querySelector('[data-addf]').addEventListener('click', (e) => filterPop(e.currentTarget));
}
function filterPop(anchor) {
  document.querySelector('.ax-pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'ax-pop';
  pop.innerHTML = `<form><label>Dimension<select data-fd>${SESS_DIMS.map((d) => `<option value="${d}">${esc(dLabel(d))}</option>`).join('')}</select></label>
    <label>Match<select data-fo>${Object.entries(OPN).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>Value<input data-fv list="ax-fvals" required autocomplete="off" placeholder="Start typing…"><datalist id="ax-fvals"></datalist></label>
    <div class="ax-pop-vals" data-fl></div>
    <div class="ax-pop-f"><button type="button" class="ax-btn is-ghost" data-fx>Cancel</button><button class="ax-btn">Apply</button></div></form>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6 + scrollY}px`; pop.style.left = `${Math.min(r.left, innerWidth - 330)}px`;
  const dSel = pop.querySelector('[data-fd]'), vIn = pop.querySelector('[data-fv]');
  const loadVals = async () => {
    const list = pop.querySelector('[data-fl]'); list.innerHTML = '<small>Loading values…</small>';
    try {
      const [res] = await Q([{ src: 'web', dims: [dSel.value], metrics: ['sessions'], sort: '-sessions', limit: 40, nofilter: true }]);
      pop.querySelector('datalist').innerHTML = res.rows.map((x) => `<option value="${esc(x[0])}">`).join('');
      list.innerHTML = res.rows.slice(0, 12).map((x) => `<button type="button" data-val="${esc(x[0])}">${esc(x[0])} <small>${fmt(x[1])}</small></button>`).join('') || '<small>No values yet.</small>';
      list.querySelectorAll('[data-val]').forEach((b) => b.addEventListener('click', () => { vIn.value = b.dataset.val; vIn.focus(); }));
    } catch { list.innerHTML = ''; }
  };
  dSel.addEventListener('change', loadVals); loadVals();
  pop.querySelector('[data-fx]').addEventListener('click', () => pop.remove());
  pop.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); pop.remove(); addFilter({ d: dSel.value, op: pop.querySelector('[data-fo]').value, v: vIn.value.trim() }); });
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', off); } }), 0);
  vIn.focus();
}

/* ================================================================ navigation */
let goFn = () => {};
export const onGo = (fn) => { goFn = fn; };
export const go = (s) => goFn(s);
export { showTip, hideTip };
