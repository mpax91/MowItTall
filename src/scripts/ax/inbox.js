// HQ Analytics → Inbox (Nov 18, 2026): everything worth knowing, in one list. Items come from worker/inbox.js
// (checked hourly). One action per item (Nov 19): "Done" takes it off the list (it goes to Cleared, where "Put Back"
// undoes it). Nothing clears itself just by being clicked or opened. "Open" jumps to the screen it's about.
import { S, api, esc, setSub, chips, onSeg, go } from './core.js';

const KINDS = [
  ['all', 'All'], ['signup', 'Sign-Ups & Email'], ['social', 'Followers & Social'], ['traffic', 'Traffic'],
  ['search', 'Search'], ['milestone', 'Milestones'], ['idea', 'Ideas & Recaps'], ['radar', 'Reddit'], ['problem', 'Problems'], ['dismissed', 'Cleared'],
];
const ICON = { signup: '✉️', social: '👥', traffic: '📈', search: '🔎', milestone: '🎉', idea: '💡', radar: '💬', problem: '⚠️' };
const GO_LABEL = { email: 'Email', social: 'Social', overview: 'Overview', acquisition: 'Traffic Sources', content: 'Content', conversions: 'Conversions', seo: 'SEO', radar: 'Reddit Radar', calendar: 'Calendar', sources: 'Sources', photos: 'Hall Photos', todo: 'To-Do', links: 'Short Links', money: 'Tips', build: 'Build Plan' };
const ET = 'America/New_York';
const dayOf = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: ET }).format(new Date(ms));
const timeOf = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
function dayLabel(d) {
  const t = dayOf(Date.now()), y = dayOf(Date.now() - 86400000);
  if (d === t) return 'Today';
  if (d === y) return 'Yesterday';
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };

// The sidebar badge = items still in the inbox (also used by index.astro after the status loads).
export function setBadge(n) {
  const b = document.querySelector('[data-inbox-badge]');
  if (b) { b.textContent = n > 99 ? '99+' : String(n || 0); b.hidden = !n; }
  document.title = document.title.replace(/^\(\d+\+?\)\s*/, '');
  if (n) document.title = `(${n > 99 ? '99+' : n}) ${document.title}`;
  if (S.status) S.status.inbox = { unread: n || 0 };
}

// Checklist items (e.g. "Ask Google to index these pages"): each link opens in a new tab and ticks itself off.
function checklist(it) {
  if (!Array.isArray(it.list) || !it.list.length) return '';
  const n = it.list.filter((e) => e.done).length;
  return `<ol class="ib-checks">${it.list.map((e, i) => `<li class="${e.done ? 'is-done' : ''}">
      <a href="${esc(e.href)}" target="_blank" rel="noopener" data-tick="${i}"><span class="ib-box" aria-hidden="true">${e.done ? '✓' : ''}</span><b>${esc(e.t)}</b></a>
      ${e.s ? `<span class="ib-note">${esc(e.s)}</span>` : ''}${e.done ? `<button type="button" class="ib-undo" data-untick="${i}" title="Not done yet">undo</button>` : ''}</li>`).join('')}</ol>
    <p class="ib-progress">${n} of ${it.list.length} done</p>`;
}

export async function inbox(root) {
  const f = KINDS.some(([k]) => k === S.sub.ik) ? S.sub.ik : 'all';
  root.innerHTML = `<div class="ib-bar">${chips('ik', KINDS, f)}
      <div class="ib-actions"><button type="button" class="ax-btn is-ghost" data-scan>Check Now</button></div></div>
    <p class="ax-fine ib-meta" data-meta></p><div class="ib-list" data-list><div class="ax-skel tall"></div></div>`;
  onSeg(root, 'ik', (v) => { setSub('ik', v); inbox(root); });
  const list = root.querySelector('[data-list]'), meta = root.querySelector('[data-meta]');
  let data;
  try { data = await api(`/api/admin/ax/inbox${f === 'dismissed' ? '?show=dismissed' : ''}`); }
  catch (e) { list.innerHTML = `<p class="ax-empty is-err">${esc(e.message)}</p>`; return; }
  setBadge(data.unread);
  meta.textContent = `${f === 'dismissed' ? 'Items you marked Done (kept 90 days) · ' : data.unread ? `${data.unread} to go · ` : ''}Checked ${data.lastScan ? ago(data.lastScan) : 'not yet'} · checks every hour on its own`;
  const items = data.items.filter((it) => (f === 'all' || f === 'dismissed' ? true : it.kind === f));
  if (!items.length) {
    list.innerHTML = `<div class="ib-empty"><b>${f === 'all' ? 'You’re all caught up.' : 'Nothing here.'}</b>
      <p>New sign-ups, followers, big jumps or drops in traffic, search wins, Reddit questions, weekly ideas and anything that breaks show up here.</p></div>`;
  } else {
    const groups = new Map();
    for (const it of items) { const d = dayOf(it.at); if (!groups.has(d)) groups.set(d, []); groups.get(d).push(it); }
    list.innerHTML = [...groups].map(([d, its]) => `<section class="ib-day"><h3>${esc(dayLabel(d))}</h3>${its.map((it) => `
      <article class="ib-item is-${esc(it.tone || 'info')}${f === 'dismissed' ? ' is-cleared' : ''}" data-id="${esc(it.id)}">
        <span class="ib-ico" aria-hidden="true">${ICON[it.kind] || '•'}</span>
        <div class="ib-txt"><h4>${esc(it.title)}</h4>${it.detail ? `<p>${esc(it.detail)}</p>` : ''}${checklist(it)}
          <small>${timeOf(it.at)}${it.go && GO_LABEL[it.go.split('/')[0]] ? ` · ${esc(GO_LABEL[it.go.split('/')[0]])}` : ''}</small></div>
        <div class="ib-btns">
          ${it.go && GO_LABEL[it.go.split('/')[0]] ? `<button type="button" class="ax-btn is-ghost" data-open>Open →</button>` : ''}
          ${it.link ? `<a class="ax-btn is-ghost" href="${esc(it.link)}" target="_blank" rel="noopener" data-ext>View ↗</a>` : ''}
          ${f === 'dismissed' ? '<button type="button" class="ax-btn is-ghost" data-restore title="Put it back in the Inbox">↩ Put Back</button>'
            : '<button type="button" class="ax-btn is-ghost ib-done" data-dismiss title="Handled: take it off the list">✓ Done</button>'}
        </div></article>`).join('')}</section>`).join('');
  }
  const act = async (action, ids) => { const r = await api('/api/admin/ax/inbox', { method: 'POST', body: JSON.stringify({ action, ids }) }); setBadge(r.unread); return r; };
  list.querySelectorAll('.ib-item').forEach((el) => {
    const id = el.dataset.id, it = items.find((x) => x.id === id);
    el.querySelector('[data-open]')?.addEventListener('click', () => go(it.go));
    el.querySelector('[data-dismiss]')?.addEventListener('click', async () => { el.classList.add('is-gone'); await act('dismiss', [id]); setTimeout(() => inbox(root), 180); });
    el.querySelector('[data-restore]')?.addEventListener('click', async () => { await act('restore', [id]); inbox(root); });
    const tick = async (i, done) => {
      const r = await api('/api/admin/ax/inbox', { method: 'POST', body: JSON.stringify({ action: 'tick', ids: [id], i, done }) });
      setBadge(r.unread); it.list = r.list;
      const box = el.querySelector('.ib-checks'), prog = el.querySelector('.ib-progress');
      const tmp = document.createElement('div'); tmp.innerHTML = checklist(it);
      box.replaceWith(tmp.querySelector('.ib-checks')); prog.replaceWith(tmp.querySelector('.ib-progress'));
    };
    // Delegated, since ticking re-renders the list.
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-tick]'), u = e.target.closest('[data-untick]');
      if (a && f !== 'dismissed') tick(Number(a.dataset.tick), true).catch(() => {}); // the link still opens normally
      if (u) { e.preventDefault(); tick(Number(u.dataset.untick), false).catch(() => {}); }
    });
  });
  root.querySelector('[data-scan]').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Checking…';
    try { const r = await api('/api/admin/ax/inbox/scan', { method: 'POST' }); setBadge(r.unread); meta.textContent = r.added ? `${r.added} new` : 'Nothing new.'; setTimeout(() => inbox(root), 600); }
    catch (err) { meta.textContent = err.message; e.target.disabled = false; e.target.textContent = 'Check Now'; }
  });
}
