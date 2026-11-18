// HQ → Content Calendar and Reddit Radar (Nov 17, 2026). Talks to /api/admin/plan* (worker/plan.js).
import { S, api, esc, setSub, chips, onSeg, card, body, errBox, dlabel } from './core.js';
import { barList } from './charts.js';

const PLAT = ['facebook', 'instagram', 'threads', 'bluesky', 'pinterest', 'x', 'nextdoor'];
const PN = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads', bluesky: 'Bluesky', pinterest: 'Pinterest', x: 'X', nextdoor: 'Nextdoor' };
const AUTO = new Set(['facebook', 'instagram', 'threads', 'bluesky', 'pinterest']);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS = { planned: ['Planned', ''], posted: ['Posted', 'is-ok'], failed: ['Failed', 'is-bad'], skipped: ['Skipped', 'is-muted'], copied: ['Copied', 'is-ok'] };
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s || '')].length;
// X counts any link as 23 characters
const countFor = (p, t) => (p === 'x' ? graphemes(String(t || '').replace(/https?:\/\/\S+/g, 'x'.repeat(23))) : graphemes(t));
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  if (btn) { const o = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => (btn.textContent = o), 1400); }
}

/* ================================================================ CONTENT CALENDAR */
export async function calendar(root) {
  const view = S.sub.cv || 'week';
  root.innerHTML = `<div class="ax-sub">${chips('cv', [['week', 'Next 7 Days'], ['month', 'Month'], ['ideas', 'Write Next'], ['specs', 'Platform Specs']], view)}</div>
    <div data-pbar></div><div data-pview><div class="ax-skel tall"></div></div>`;
  onSeg(root, 'cv', (v) => { setSub('cv', v); calendar(root); });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  if (view === 'ideas') { postingBar(root, null); return ideas(root.querySelector('[data-pview]')); }
  if (view === 'specs') {
    const d = await api(`/api/admin/plan?from=${today}&to=${today}`);
    postingBar(root, d);
    return specs(root.querySelector('[data-pview]'), d.specs);
  }
  let from, to;
  if (view === 'month') { const m = S.sub.cm || today.slice(0, 7); from = `${m}-01`; const d = new Date(from + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); to = d.toISOString().slice(0, 10); }
  else { from = today; to = addDays(today, 6); }
  let data;
  try { data = await api(`/api/admin/plan?from=${from}&to=${to}`); } catch (e) { root.querySelector('[data-pview]').innerHTML = errBox(e.message); return; }
  postingBar(root, data);
  const days = byDay(data);
  if (view === 'month') monthGrid(root.querySelector('[data-pview]'), data, days, S.sub.cm || today.slice(0, 7), root);
  else root.querySelector('[data-pview]').innerHTML = `<div class="sp-days">${Object.keys(days).sort().map((d) => `<div data-day="${d}"></div>`).join('')}</div>`, Object.keys(days).sort().forEach((d) => dayCard(root.querySelector(`[data-day="${d}"]`), d, days[d], data, () => calendar(root)));
}
function byDay(data) { const out = {}; for (const r of data.rows) (out[r.date] ||= {})[r.platform] = r; return out; }

function postingBar(root, data) {
  const el = root.querySelector('[data-pbar]');
  if (!data) { el.innerHTML = ''; return; }
  const s = data.settings, c = data.connected;
  el.innerHTML = `<section class="ax-card sp-bar ${s.live ? 'is-live' : ''}">
    <div class="sp-live"><label class="sp-switch"><input type="checkbox" data-live ${s.live ? 'checked' : ''}><span></span></label>
      <div><b>${s.live ? 'Auto-posting is ON' : 'Auto-posting is OFF'}</b><small>${s.live ? 'Planned posts go out on their own at the time below. Skip anything you don’t want.' : 'Nothing posts until you turn this on. Review the week, then flip it.'}</small></div></div>
    <div class="sp-plats">${[...AUTO].map((p) => `<label class="sp-plat ${c[p] ? '' : 'is-off'}" title="${c[p] ? 'Connected' : 'Not connected: add its token (HQ Analytics → Sources)'}"><input type="checkbox" data-plat="${p}" ${s.platforms[p] ? 'checked' : ''} ${c[p] ? '' : 'disabled'}> ${PN[p]}${c[p] ? '' : ' <i>not connected</i>'}</label>`).join('')}
      <span class="sp-plat is-copy" title="Copy-and-paste cards">X · Nextdoor: copy cards</span></div>
    <details class="sp-times"><summary>Posting times (Eastern)</summary><div class="sp-time-grid">${DOW.map((d, i) => `<label>${d}<input type="time" step="3600" value="${s.times[i]}" data-time="${i}"></label>`).join('')}</div>
      <p class="ax-fine">Posts go out on the hour (10:00 means 10:00–10:05). Want to test times? Set a different hour per weekday for a month, then check Social → Best Time to Post.</p></details>
    <details class="sp-times"><summary>How to connect posting</summary><ol class="ax-fine sp-how">
      <li><b>Facebook + Instagram:</b> same Meta token as the analytics (HQ Analytics → Sources), with <code>pages_manage_posts</code> and <code>instagram_content_publish</code> added when you generate it. Your own app and your own Page: no app review.</li>
      <li><b>Threads:</b> add <code>threads_content_publish</code> to the Threads token.</li>
      <li><b>Bluesky:</b> Bluesky → Settings → Privacy and security → App passwords → Add. Save it as the secret <code>BLUESKY_APP_PASSWORD</code>.</li>
      <li><b>Pinterest:</b> add <code>pins:write</code> + <code>boards:read</code> to the token. Until Pinterest approves Standard access (they want a short screen recording of the app), pins it creates are only visible to you.</li>
      <li>Then turn on Auto-posting. Posts go out at the time set for each weekday; anything you Skip stays home.</li></ol></details>
    <button type="button" class="ax-btn is-ghost" data-replan title="Drops planned rows you haven’t edited and plans them again (picks up new posts)">Re-Plan From Today</button>
  </section>`;
  const save = async (patch) => { await api('/api/admin/plan/settings', { method: 'POST', body: JSON.stringify(patch) }); };
  el.querySelector('[data-live]').addEventListener('change', async (e) => {
    if (e.target.checked && !confirm('Turn on auto-posting? Planned posts will go out to the connected platforms at the set time each day.')) { e.target.checked = false; return; }
    await save({ live: e.target.checked }); calendar(root);
  });
  el.querySelectorAll('[data-plat]').forEach((i) => i.addEventListener('change', () => save({ platforms: { [i.dataset.plat]: i.checked } })));
  el.querySelectorAll('[data-time]').forEach((i) => i.addEventListener('change', () => save({ times: { [i.dataset.time]: i.value } })));
  el.querySelector('[data-replan]').addEventListener('click', async () => {
    if (!confirm('Re-plan every future day you haven’t edited? Posted and edited days stay as they are.')) return;
    const r = await api('/api/admin/plan/replan', { method: 'POST', body: '{}' }); calendar(root); void r;
  });
}

const headOf = (it) => (it && ['tip', 'engage', 'moment'].includes(it.kind) ? it.hooks?.[0] || it.title : it?.title || '');
const KIND_ICON = { post: '📰', guide: '✅', tool: '🧰', weed: '🌱', month: '📅', tip: '💡', moment: '🎉', engage: '💬', job: '🛠️' };
function dayCard(el, date, rows, data, refresh) {
  const fb = rows.facebook || Object.values(rows).find((r) => r.platform !== 'pinterest') || {};
  const it = data.items[fb.item] || {};
  const pin = rows.pinterest ? data.items[rows.pinterest.item] : null;
  const isToday = date === data.today;
  let cur = PLAT.find((p) => rows[p]) || 'facebook';
  const draw = () => {
    const r = rows[cur];
    const spec = data.specs[cur] || {};
    const st = STATUS[r?.status] || STATUS.planned;
    const n = r ? countFor(cur, r.text) : 0;
    const over = spec.limit && n > spec.limit;
    el.innerHTML = `<article class="ax-card sp-day ${isToday ? 'is-today' : ''}">
      <header class="sp-day-h"><div class="sp-date"><b>${DOW[dowOf(date)]}</b><span>${dlabel(date, 'date')}</span>${isToday ? '<i>Today</i>' : ''}</div>
        <div class="sp-what"><small>${esc(fb.label || '')}</small><h3>${KIND_ICON[it.kind] || ''} ${esc(headOf(it) || 'Nothing planned')}</h3>
          <div class="sp-meta">${it.label ? `<span class="ax-tag">${esc(it.label)}</span>` : ''}${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.url)}</a>` : ''}${fb.gap ? '<span class="sp-gap" title="Nothing in season was left for this slot. See Write Next.">Thin spot</span>' : ''}</div></div>
        <div class="sp-day-tools"><button type="button" class="ax-btn is-ghost" data-swap>Swap</button></div></header>
      <div class="sp-day-b">
        <div class="sp-img">${r?.image ? `<img src="${esc(r.image)}" alt="" loading="lazy">` : it.og ? `<img src="${esc(it.og)}" alt="" loading="lazy"><small class="ax-fine">${PN[cur]} builds this link preview itself</small>` : '<div class="sp-noimg">Text only</div>'}
          <div class="sp-img-tools">${r?.image ? `<a class="ax-link" href="${esc(r.image)}" download>Download</a>` : ''}<button type="button" class="ax-link" data-prompt>Copy image prompt</button></div></div>
        <div class="sp-copy">
          <div class="sp-tabs" role="tablist">${PLAT.filter((p) => rows[p]).map((p) => { const s2 = STATUS[rows[p].status] || STATUS.planned; return `<button type="button" role="tab" data-tab="${p}" aria-selected="${p === cur}"><span class="sp-dot ${s2[1]}"></span>${PN[p]}</button>`; }).join('')}</div>
          ${r ? `<div class="sp-row-h"><span class="sp-status ${st[1]}">${st[0]}${r.status === 'posted' && r.post_url ? ` · <a href="${esc(r.post_url)}" target="_blank" rel="noopener">view</a>` : ''}</span>
              ${cur === 'pinterest' ? `<span class="ax-fine">Pin: ${esc(r.title || '')} · ${esc(pin?.pin?.board || '')}</span>` : ''}
              <span class="sp-count ${over ? 'is-over' : ''}">${n}${spec.limit ? ` / ${spec.limit}` : ''}</span></div>
            <textarea data-text rows="${cur === 'instagram' || cur === 'facebook' ? 7 : 5}" ${r.status === 'posted' ? 'readonly' : ''}>${esc(r.text || '')}</textarea>
            ${r.error ? `<p class="ax-empty is-err">${esc(r.error)}</p>` : ''}
            <div class="sp-actions">
              <button type="button" class="ax-btn" data-copy>Copy</button>
              ${r.status !== 'posted' ? `<button type="button" class="ax-btn is-ghost" data-save hidden>Save Edit</button>
                ${AUTO.has(cur) ? `<button type="button" class="ax-btn is-ghost" data-now ${data.connected[cur] ? '' : 'disabled title="Not connected"'}>Post Now</button>` : `<button type="button" class="ax-btn is-ghost" data-mark>Mark Posted</button>`}
                <button type="button" class="ax-btn is-ghost" data-skip>${r.status === 'skipped' ? 'Unskip' : 'Skip'}</button>` : ''}
              <span class="ax-fine sp-tip">${esc(spec.best || '')}</span></div>` : '<p class="ax-empty">Nothing for this platform today.</p>'}
        </div></div></article>`;
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.tab; draw(); }));
    const ta = el.querySelector('[data-text]');
    ta?.addEventListener('input', () => { el.querySelector('[data-save]')?.removeAttribute('hidden'); const c = countFor(cur, ta.value); const cnt = el.querySelector('.sp-count'); cnt.textContent = `${c}${spec.limit ? ` / ${spec.limit}` : ''}`; cnt.classList.toggle('is-over', !!spec.limit && c > spec.limit); });
    el.querySelector('[data-copy]')?.addEventListener('click', (e) => copy(ta.value, e.target));
    el.querySelector('[data-prompt]')?.addEventListener('click', (e) => copy(it.prompt || '', e.target));
    const upd = async (patch) => { const j = await api('/api/admin/plan/row', { method: 'POST', body: JSON.stringify({ date, platform: cur, ...patch }) }); rows[cur] = j.row; draw(); };
    el.querySelector('[data-save]')?.addEventListener('click', () => upd({ text: ta.value }));
    el.querySelector('[data-skip]')?.addEventListener('click', () => upd({ status: rows[cur].status === 'skipped' ? 'planned' : 'skipped' }));
    el.querySelector('[data-mark]')?.addEventListener('click', () => upd({ status: 'copied' }));
    el.querySelector('[data-now]')?.addEventListener('click', async (e) => {
      if (!confirm(`Post this to ${PN[cur]} right now?`)) return;
      e.target.disabled = true; e.target.textContent = 'Posting…';
      if (ta && !ta.readOnly && ta.value !== rows[cur].text) await api('/api/admin/plan/row', { method: 'POST', body: JSON.stringify({ date, platform: cur, text: ta.value }) });
      const j = await api('/api/admin/plan/publish', { method: 'POST', body: JSON.stringify({ date, platform: cur }) });
      if (!j.ok) alert(`${PN[cur]} said: ${j.error}`);
      const d2 = await api(`/api/admin/plan?from=${date}&to=${date}`); Object.assign(rows, byDay(d2)[date] || {}); draw();
    });
    el.querySelector('[data-swap]').addEventListener('click', () => swapMenu(el, date, cur === 'pinterest', refresh));
  };
  draw();
}
async function swapMenu(el, date, pinterest, refresh) {
  const { options } = await api(`/api/admin/plan/options?date=${date}`);
  const list = options.filter((o) => (pinterest ? o.pin : true));
  const box = document.createElement('div');
  box.className = 'sp-swap';
  box.innerHTML = `<input type="search" placeholder="Search posts, guides, tools, tips…" data-q><div class="sp-swap-l" data-l></div>`;
  el.querySelector('.sp-day').appendChild(box);
  const draw = (q = '') => {
    box.querySelector('[data-l]').innerHTML = list.filter((o) => !q || `${o.title} ${o.label}`.toLowerCase().includes(q)).slice(0, 40).map((o) => `<button type="button" data-id="${esc(o.id)}"><span>${KIND_ICON[o.kind] || ''} ${esc(o.title)}</span><small>${esc(o.label || '')}${o.season === 2 ? ' · in season' : ''}${o.last ? ` · last ${dlabel(o.last, 'date', true)}` : ' · never posted'}</small></button>`).join('');
    box.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => { await api('/api/admin/plan/swap', { method: 'POST', body: JSON.stringify({ date, item: b.dataset.id, pinterest }) }); refresh(); }));
  };
  box.querySelector('[data-q]').addEventListener('input', (e) => draw(e.target.value.toLowerCase()));
  box.querySelector('[data-q]').focus();
  draw();
}

function monthGrid(el, data, days, ym, root) {
  const first = `${ym}-01`;
  const start = addDays(first, -dowOf(first));
  const [y, m] = ym.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const cells = []; for (let i = 0; i < 42; i++) { const d = addDays(start, i); if (i >= 35 && d.slice(0, 7) !== ym) break; cells.push(d); }
  el.innerHTML = `<section class="ax-card"><header class="ax-card-h"><div><h3>${dlabel(ym, 'month', true)}</h3><p>Click a day to review or change it. Dots: posted ● planned ○ failed ✕ skipped –</p></div>
    <div class="ax-card-tools"><button type="button" class="ax-icon-btn" data-m="${prev}" aria-label="Previous month">‹</button><button type="button" class="ax-icon-btn" data-m="${next}" aria-label="Next month">›</button></div></header>
    <div class="ax-card-b"><div class="sp-month">${DOW.map((d) => `<div class="sp-mh">${d}</div>`).join('')}
    ${cells.map((d) => {
      const rows = days[d] || {}; const fb = rows.facebook || Object.values(rows).find((r) => r.platform !== 'pinterest'); const it = fb ? data.items[fb.item] : null;
      const dots = PLAT.filter((p) => rows[p]).map((p) => { const s = rows[p].status; return `<i class="sp-mdot ${STATUS[s]?.[1] || ''}" title="${PN[p]}: ${STATUS[s]?.[0] || s}">${s === 'posted' ? '●' : s === 'failed' ? '✕' : s === 'skipped' ? '–' : '○'}</i>`; }).join('');
      return `<button type="button" class="sp-mc ${d.slice(0, 7) !== ym ? 'is-out' : ''} ${d === data.today ? 'is-today' : ''} ${d < data.today ? 'is-past' : ''}" data-d="${d}" ${it ? '' : 'disabled'}>
        <span class="sp-mn">${Number(d.slice(8))}</span>${it ? `<span class="sp-mk">${KIND_ICON[it.kind] || ''} ${esc(it.label || '')}</span><span class="sp-mt">${esc(headOf(it))}</span><span class="sp-mdots">${dots}</span>` : ''}</button>`;
    }).join('')}</div></div></section>`;
  el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { setSub('cm', b.dataset.m); calendar(root); }));
  el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.d;
    const dr = document.querySelector('[data-drawer]');
    dr.hidden = false; document.body.classList.add('has-drawer');
    dr.innerHTML = `<div class="ax-drawer-in sp-drawer"><header><div><small>${DOWL[dowOf(d)]}</small><h2>${dlabel(d, 'date', true)}</h2></div><button type="button" class="ax-icon-btn" data-close aria-label="Close">✕</button></header><div data-dd></div></div>`;
    const close = () => { dr.hidden = true; dr.innerHTML = ''; document.body.classList.remove('has-drawer'); };
    dr.querySelector('[data-close]').addEventListener('click', close);
    dayCard(dr.querySelector('[data-dd]'), d, days[d], data, () => { close(); calendar(root); });
  }));
}

async function ideas(el) {
  let d; try { d = await api('/api/admin/plan/ideas'); } catch (e) { el.innerHTML = errBox(e.message); return; }
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  el.innerHTML = `<div class="ax-grid">${card('ideas', 'What to Write Next', { span: 8, sub: 'Ranked by how soon the season comes, how thin that month is on the site, and how often the calendar ran out of fresh posts. Delete one from src/data/socialHooks.js once it’s written.' })}
    ${card('cov', 'Posts + Guides in Season, by Month', { span: 4, sub: 'Months with short bars are where the calendar repeats tips and tools most.' })}</div>`;
  body(el, 'ideas').innerHTML = `<ol class="sp-ideas">${d.ideas.map((i) => `<li><b>${esc(i.title)}</b><span class="ax-fine">${i.months.map((m) => M[m - 1]).join(', ')}${i.gaps ? ` · ${i.gaps} thin day${i.gaps === 1 ? '' : 's'} in the plan` : ''}</span><p>${esc(i.why)}</p></li>`).join('')}</ol>`;
  barList(body(el, 'cov'), M.map((m, i) => ({ label: m, value: d.coverage[i + 1] || 0 })), { kind: 'num', total: 0 });
}
function specs(el, sp) {
  el.innerHTML = `<section class="ax-card"><header class="ax-card-h"><div><h3>Platform Cheat Sheet</h3><p>What each platform wants. The calendar already writes to these limits and attaches the right image.</p></div></header>
    <div class="ax-card-b"><div class="ax-table-wrap"><table class="ax-table sp-specs"><thead><tr><th class="is-dim">Platform</th><th class="is-dim">Posting</th><th class="is-dim">Character limit</th><th class="is-dim">Image</th><th class="is-dim">Links</th><th class="is-dim">Hashtags</th><th class="is-dim">What works</th></tr></thead><tbody>
    ${Object.values(sp).map((s) => `<tr><td class="is-dim"><b>${esc(s.name)}</b></td><td class="is-dim">${s.auto ? 'Automatic' : 'Copy card'}</td><td class="is-dim">${s.limit}${s.titleLimit ? ` (title ${s.titleLimit})` : ''}${s.sweet ? ` · sweet spot ~${s.sweet}` : ''}</td><td class="is-dim">${esc(s.image)}</td><td class="is-dim">${esc(s.link)}</td><td class="is-dim">${esc(s.tags)}</td><td class="is-dim">${esc(s.best)}</td></tr>`).join('')}
    </tbody></table></div></div></section>`;
}

/* ================================================================ REDDIT RADAR */
export async function radar(root, refreshAll) {
  const st = S.sub.rs || 'new';
  root.innerHTML = `<div class="ax-sub">${chips('rs', [['new', 'To Answer'], ['done', 'Answered'], ['hidden', 'Hidden']], st)}<button type="button" class="ax-btn is-ghost" data-rr>Check Reddit Now</button>
    <span class="ax-hint">Fresh questions (last 3 days) from r/lawncare, r/landscaping, r/homeowners, r/Westchester and Northeast subs that the site already answers. You reply from your own account. Answer first; link only if it really helps.</span></div><div data-rl><div class="ax-skel tall"></div></div>`;
  onSeg(root, 'rs', (v) => { setSub('rs', v); radar(root); });
  const load = async (refresh) => {
    const el = root.querySelector('[data-rl]');
    let d; try { d = await api(`/api/admin/plan/radar?status=${st}${refresh ? '&refresh=1' : ''}`); } catch (e) { el.innerHTML = errBox(e.message); return; }
    const errs = d.last?.errors || [];
    const note = errs.length && !d.rows.length ? `<section class="ax-card"><div class="ax-card-b"><p class="ax-empty is-err">${esc(errs[0])}</p><div class="ax-setup"><h4>Connect Reddit (free)</h4><ol>
      <li><a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener">reddit.com/prefs/apps</a> → create another app → type <b>script</b> (redirect URI http://localhost). Reddit may ask you to request API access first.</li>
      <li>Save <code>REDDIT_CLIENT_ID</code>, <code>REDDIT_CLIENT_SECRET</code>, <code>REDDIT_USERNAME</code> and <code>REDDIT_PASSWORD</code> as Cloudflare secrets.</li>
      <li>The radar checks every 6 hours. It only reads; nothing is ever posted for you.</li></ol></div></div></section>` : '';
    el.innerHTML = note + (d.rows.length ? `<div class="rr-list">${d.rows.map((r) => {
      const ageH = Math.max(1, Math.round((Date.now() - r.created) / 3600000));
      return `<article class="ax-card rr" data-id="${esc(r.id)}"><header class="rr-h"><span class="ax-tag">r/${esc(r.sub)}</span><span class="ax-fine">${ageH < 24 ? `${ageH}h ago` : `${Math.round(ageH / 24)}d ago`} · ${r.comments} comment${r.comments === 1 ? '' : 's'} · ${r.score} points · fit ${Math.round(r.fit)}</span></header>
        <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></h3>
        ${r.body ? `<details><summary>Read the post</summary><p class="rr-body">${esc(r.body)}</p></details>` : ''}
        <p class="rr-m">Matches: ${r.matched.map((m) => `<a href="${esc(m.url || '#')}" target="_blank" rel="noopener">${esc(m.title)}</a>`).join(' · ')}</p>
        <textarea rows="5" data-draft>${esc(r.draft)}</textarea>
        <div class="sp-actions"><button type="button" class="ax-btn" data-copy>Copy Reply</button><a class="ax-btn is-ghost" href="${esc(r.url)}" target="_blank" rel="noopener">Open Thread</a>
          ${st !== 'done' ? '<button type="button" class="ax-btn is-ghost" data-st="done">Answered</button>' : ''}${st !== 'hidden' ? '<button type="button" class="ax-btn is-ghost" data-st="hidden">Hide</button>' : ''}${st !== 'new' ? '<button type="button" class="ax-btn is-ghost" data-st="new">Back to List</button>' : ''}</div></article>`;
    }).join('')}</div>` : note ? '' : `<p class="ax-empty">${st === 'new' ? `Nothing to answer right now.${d.last?.at ? ` Last check ${Math.round((Date.now() - d.last.at) / 60000)} min ago.` : ' Hit “Check Reddit Now”.'}` : 'Nothing here.'}</p>`);
    el.querySelectorAll('.rr').forEach((a) => {
      a.querySelector('[data-copy]').addEventListener('click', (e) => copy(a.querySelector('[data-draft]').value, e.target));
      a.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => { await api('/api/admin/plan/radar', { method: 'POST', body: JSON.stringify({ id: a.dataset.id, status: b.dataset.st }) }); a.remove(); }));
    });
  };
  root.querySelector('[data-rr]').addEventListener('click', async (e) => { e.target.disabled = true; e.target.textContent = 'Checking…'; await load(true); e.target.disabled = false; e.target.textContent = 'Check Reddit Now'; });
  load(false);
  void refreshAll;
}
