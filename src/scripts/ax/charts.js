// HQ Analytics: tiny SVG chart kit (no libraries). Line (with compare + crosshair), stacked bars, sparkline,
// horizontal bar list, heatmap, funnel. Colors come from CSS variables on .ax (light/dark both validated).

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];
export const col = (i) => `var(${SERIES[i % SERIES.length]})`;

/* ---------------------------------------------------------------- formatting */
const nf = new Intl.NumberFormat('en-US');
export function fmt(v, kind = 'num') {
  if (v == null || Number.isNaN(v)) return '—';
  const n = Number(v);
  switch (kind) {
    case 'pct': return `${(n * 100).toFixed(n < 0.1 && n > 0 ? 1 : n >= 0.995 ? 0 : 1)}%`;
    case 'pct0': return `${Math.round(n)}%`;
    case 'sec': { if (n < 60) return `${Math.round(n)}s`; const m = Math.floor(n / 60), s = Math.round(n % 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${String(s).padStart(2, '0')}s`; }
    case 'pos': return n ? n.toFixed(1) : '—';
    case 'dec': return n.toFixed(n >= 10 ? 1 : 2);
    case 'compact': return Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : nf.format(Math.round(n));
    default: return Math.abs(n) >= 100000 ? fmt(n, 'compact') : nf.format(Math.round(n * 10) / 10 === Math.round(n) ? Math.round(n) : Math.round(n * 10) / 10);
  }
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dlabel(x, grain = 'date', long = false) {
  if (!x) return '';
  if (grain === 'month' || /^\d{4}-\d{2}$/.test(x)) { const [y, m] = x.split('-'); return `${MON[+m - 1]} ${long ? y : `’${y.slice(2)}`}`; }
  const [y, m, d] = x.split('-');
  return grain === 'week' ? `Wk of ${MON[+m - 1]} ${+d}` : `${MON[+m - 1]} ${+d}${long ? `, ${y}` : ''}`;
}

/* ---------------------------------------------------------------- tooltip (one shared element) */
let tipEl = null;
function tip() {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ax-tip'; tipEl.setAttribute('role', 'status'); document.body.appendChild(tipEl); }
  return tipEl;
}
export function showTip(html, x, y) {
  const t = tip(); t.innerHTML = html; t.style.display = 'block';
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  t.style.left = `${Math.max(8, left)}px`; t.style.top = `${Math.max(8, top)}px`;
}
export const hideTip = () => { if (tipEl) tipEl.style.display = 'none'; };

/* ---------------------------------------------------------------- scales */
function niceMax(v) {
  if (v <= 0) return 1;
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
// Round steps (1, 2, 2.5, 5 × 10^n) so small counts never show "1, 3, 4".
function niceStep(range) { const raw = range / 4; if (raw <= 0) return 1; const p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function ticks(max) { const step = niceStep(max); const n = Math.max(1, Math.round(max / step)); return Array.from({ length: n + 1 }, (_, i) => i * step); }
const W = (el) => Math.max(260, Math.floor(el.clientWidth || el.parentElement?.clientWidth || 600));

// Redraw on resize (charts are measured, not stretched, so text stays crisp).
const RO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
  for (const e of entries) { const fn = e.target.__axDraw; if (fn && Math.abs((e.target.__axW || 0) - e.contentRect.width) > 4) { e.target.__axW = e.contentRect.width; fn(); } }
}) : null;
function mount(el, draw) { el.__axDraw = draw; el.__axW = el.clientWidth; RO?.observe(el); draw(); }

/* ---------------------------------------------------------------- line chart */
// opts: { x: [labels], grain, series: [{ name, values, color?, dash?, muted? }], kind (fmt), height, area }
export function lineChart(el, opts) {
  mount(el, () => {
    const w = W(el), h = opts.height || 260, padL = 48, padR = 14, padT = 12, padB = 28;
    const n = opts.x.length;
    const all = opts.series.flatMap((s) => s.values).filter((v) => v != null);
    const rawMax = Math.max(0, ...all) * (opts.kind === 'pos' ? 1.05 : 1);
    const max = opts.kind === 'pct' || opts.kind === 'dec' ? Math.ceil(rawMax / niceStep(rawMax || 1)) * niceStep(rawMax || 1) || 1 : Math.ceil(rawMax / niceStep(rawMax || 1)) * niceStep(rawMax || 1) || 1;
    const min = opts.kind === 'pos' && all.length ? Math.max(0, Math.floor(Math.min(...all))) : 0;
    const innerW = w - padL - padR, innerH = h - padT - padB;
    const X = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    // Position: lower is better, so draw 1 at the top.
    const Y = (v) => (opts.kind === 'pos' ? padT + ((v - min) / (max - min || 1)) * innerH : padT + innerH - ((v - min) / (max - min || 1)) * innerH);
    const tk = ticks(max - min).map((t) => t + min).filter((t) => t <= max + 1e-9);
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 74))));
    let svg = `<svg class="ax-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opts.label || 'Trend chart')}">`;
    for (const t of tk) svg += `<line class="ax-gl" x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax-tick" x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${fmt(t, opts.kind === 'pct' ? 'pct' : opts.kind === 'sec' ? 'sec' : 'compact')}</text>`;
    for (let i = 0; i < n; i += every) svg += `<text class="ax-tick" x="${X(i)}" y="${h - 8}" text-anchor="middle">${esc(dlabel(opts.x[i], opts.grain))}</text>`;
    opts.series.forEach((s, si) => {
      const c = s.color || col(si);
      const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
      const d = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), '');
      if (opts.area && opts.kind !== 'pos' && si === 0 && !s.dash && pts.filter(Boolean).length > 1) {
        const first = pts.findIndex(Boolean), last = pts.length - 1 - [...pts].reverse().findIndex(Boolean);
        svg += `<path class="ax-area" d="${d}L${X(last)},${Y(min)}L${X(first)},${Y(min)}Z" style="fill:${c}"/>`;
      }
      svg += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4" opacity=".75"' : ''}/>`;
      if (n <= 40) pts.forEach((p) => { if (p && !s.dash) svg += `<circle cx="${p[0]}" cy="${p[1]}" r="${n <= 14 ? 3.5 : 2.5}" fill="${c}" stroke="var(--card)" stroke-width="2"/>`; });
    });
    svg += `<line class="ax-cross" x1="0" x2="0" y1="${padT}" y2="${padT + innerH}" style="display:none"/><rect class="ax-hit" x="${padL}" y="${padT}" width="${innerW}" height="${innerH}" fill="transparent"/></svg>`;
    el.innerHTML = svg;
    const hit = el.querySelector('.ax-hit'), cross = el.querySelector('.ax-cross');
    const move = (ev) => {
      const r = el.querySelector('svg').getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left - padL) / innerW) * (n - 1))));
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.style.display = '';
      const rows = opts.series.map((s, si) => `<div class="ax-tip-row"><i style="background:${s.color || col(si)}${s.dash ? ';opacity:.6' : ''}"></i><span>${esc(s.labelAt ? s.labelAt(i) : s.name)}</span><b>${fmt(s.values[i], opts.kind)}</b></div>`).join('');
      showTip(`<div class="ax-tip-h">${esc(dlabel(opts.x[i], opts.grain, true))}</div>${rows}`, ev.clientX, ev.clientY);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { cross.style.display = 'none'; hideTip(); });
  });
}

/* ---------------------------------------------------------------- stacked bars (by date) */
// opts: { x, grain, series: [{ name, values }], kind, height }
export function stackedBars(el, opts) {
  mount(el, () => {
    const w = W(el), h = opts.height || 240, padL = 48, padR = 10, padT = 10, padB = 28;
    const n = opts.x.length, innerW = w - padL - padR, innerH = h - padT - padB;
    const totals = opts.x.map((_, i) => opts.series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const mx0 = Math.max(1, ...totals); const max = Math.ceil(mx0 / niceStep(mx0)) * niceStep(mx0);
    const bw = Math.max(2, Math.min(36, innerW / n - 2));
    const X = (i) => padL + (i + 0.5) * (innerW / n);
    const Y = (v) => padT + innerH - (v / max) * innerH;
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 74))));
    let svg = `<svg class="ax-svg" width="${w}" height="${h}" role="img" aria-label="${esc(opts.label || 'Stacked bars')}">`;
    for (const t of ticks(max)) svg += `<line class="ax-gl" x1="${padL}" x2="${w - padR}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax-tick" x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${fmt(t, 'compact')}</text>`;
    for (let i = 0; i < n; i += every) svg += `<text class="ax-tick" x="${X(i)}" y="${h - 8}" text-anchor="middle">${esc(dlabel(opts.x[i], opts.grain))}</text>`;
    for (let i = 0; i < n; i++) {
      let acc = 0;
      opts.series.forEach((s, si) => {
        const v = s.values[i] || 0; if (!v) return;
        const y0 = Y(acc), y1 = Y(acc + v); acc += v;
        const top = acc === totals[i];
        const hh = Math.max(1, y0 - y1 - 2);
        svg += top && hh > 4
          ? `<path d="M${X(i) - bw / 2},${y0 - 2}V${y1 + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${y0 - 2}Z" fill="${col(si)}"/>`
          : `<rect x="${X(i) - bw / 2}" y="${y1}" width="${bw}" height="${hh}" fill="${col(si)}"/>`;
      });
      svg += `<rect class="ax-hitbar" data-i="${i}" x="${X(i) - innerW / n / 2}" y="${padT}" width="${innerW / n}" height="${innerH}" fill="transparent"/>`;
    }
    el.innerHTML = svg + '</svg>';
    el.querySelectorAll('.ax-hitbar').forEach((r) => {
      r.addEventListener('pointermove', (ev) => {
        const i = +r.dataset.i;
        const rows = opts.series.map((s, si) => [s, si]).filter(([s]) => s.values[i]).reverse()
          .map(([s, si]) => `<div class="ax-tip-row"><i style="background:${col(si)}"></i><span>${esc(s.name)}</span><b>${fmt(s.values[i], opts.kind)}</b></div>`).join('');
        showTip(`<div class="ax-tip-h">${esc(dlabel(opts.x[i], opts.grain, true))} · ${fmt(totals[i], opts.kind)}</div>${rows || '<div class="ax-tip-row">Nothing</div>'}`, ev.clientX, ev.clientY);
      });
      r.addEventListener('pointerleave', hideTip);
    });
  });
}

/* ---------------------------------------------------------------- sparkline */
export function spark(values, { color = 'var(--s1)', w = 200, h = 28, prev = null } = {}) {
  const vs = values.map((v) => v ?? 0);
  if (vs.length < 2) return '';
  const max = Math.max(1e-9, ...vs, ...(prev || []).map((v) => v ?? 0));
  const P = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${((i / (arr.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v ?? 0) / max) * (h - 6)).toFixed(1)}`).join('');
  return `<svg class="ax-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${prev ? `<path d="${P(prev.slice(0, vs.length))}" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}<path d="${P(vs)}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ---------------------------------------------------------------- horizontal bar list (HTML) */
// rows: [{ label, value, sub?, key? }]  → clickable if onPick
export function barList(el, rows, { kind = 'num', onPick = null, color = 'var(--s1)', total = null, empty = 'No data yet.' } = {}) {
  if (!rows.length) { el.innerHTML = `<p class="ax-empty">${esc(empty)}</p>`; return; }
  const max = Math.max(...rows.map((r) => r.value || 0), 1e-9);
  const sum = total ?? rows.reduce((a, r) => a + (r.value || 0), 0);
  el.innerHTML = `<ul class="ax-bars">${rows.map((r, i) => `<li${onPick ? ` tabindex="0" data-i="${i}" class="is-pick"` : ''}>
    <span class="ax-bars-l" title="${esc(r.label)}">${esc(r.label)}</span>
    <span class="ax-bars-track"><span style="width:${Math.max(1.5, ((r.value || 0) / max) * 100)}%;background:${r.color || color}"></span></span>
    <b>${fmt(r.value, kind)}</b><small>${r.sub ?? (kind === 'num' && sum ? fmt((r.value || 0) / sum, 'pct') : '')}</small></li>`).join('')}</ul>`;
  if (onPick) el.querySelectorAll('[data-i]').forEach((li) => { const go = () => onPick(rows[+li.dataset.i]); li.addEventListener('click', go); li.addEventListener('keydown', (e) => e.key === 'Enter' && go()); });
}

/* ---------------------------------------------------------------- heatmap (rows × cols) */
export function heatmap(el, { rows, cols, value, kind = 'num', rowLabel = (r) => r, colLabel = (c) => c }) {
  let max = 0; for (const r of rows) for (const c of cols) max = Math.max(max, value(r, c) || 0);
  el.innerHTML = `<div class="ax-heat" style="grid-template-columns:44px repeat(${cols.length}, minmax(0, 1fr))">
    <span></span>${cols.map((c, i) => `<span class="ax-heat-c">${i % 3 === 0 ? esc(colLabel(c)) : ''}</span>`).join('')}
    ${rows.map((r) => `<span class="ax-heat-r">${esc(rowLabel(r))}</span>${cols.map((c) => { const v = value(r, c) || 0; const t = max ? v / max : 0;
      return `<span class="ax-heat-cell" data-tip="${esc(`${rowLabel(r)} ${colLabel(c)}: ${fmt(v, kind)}`)}" style="background:${v ? `color-mix(in oklab, var(--seq-hi) ${Math.round(12 + t * 88)}%, var(--seq-lo))` : 'var(--bg-2)'}"></span>`; }).join('')}`).join('')}
  </div><div class="ax-heat-key"><span>Less</span><i></i><span>More</span></div>`;
  el.querySelectorAll('[data-tip]').forEach((c) => { c.addEventListener('pointermove', (e) => showTip(esc(c.dataset.tip), e.clientX, e.clientY)); c.addEventListener('pointerleave', hideTip); });
}

/* ---------------------------------------------------------------- funnel */
// steps: [{ label, value }]
export function funnel(el, steps, { kind = 'num' } = {}) {
  if (!steps.length || !steps[0].value) { el.innerHTML = '<p class="ax-empty">Nobody’s gone through this yet in this date range.</p>'; return; }
  const top = steps[0].value;
  el.innerHTML = `<ol class="ax-funnel">${steps.map((s, i) => {
    const prev = i ? steps[i - 1].value : null;
    const keep = prev ? s.value / prev : 1;
    return `<li><div class="ax-funnel-h"><span>${esc(s.label)}</span><b>${fmt(s.value, kind)}</b><small>${fmt(s.value / top, 'pct')} of start</small></div>
      <div class="ax-funnel-bar"><span style="width:${Math.max(1, (s.value / top) * 100)}%"></span></div>
      ${i ? `<div class="ax-funnel-drop ${keep < 0.5 ? 'is-bad' : ''}">${fmt(keep, 'pct')} kept · ${fmt(prev - s.value)} dropped</div>` : ''}</li>`;
  }).join('')}</ol>`;
}
