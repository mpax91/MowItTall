// HQ → Email: the CRM for the lawn drip (worker/crm.js). Sub-tabs: Overview, Emails, A/B Tests, Inbox,
// People, Year at a Glance, Settings. All data from /api/admin/crm/*.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => Math.round(Number(n) || 0).toLocaleString();
const pct = (a, b, d = 0) => (b ? `${((100 * a) / b).toFixed(d)}%` : '–');
const when = (t) => (t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');
const day = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–');
const delta = (a, b) => { if (!b) return a ? '<em class="ev-up">new</em>' : ''; const d = Math.round(((a - b) / b) * 100); return `<em class="${d >= 0 ? 'ev-up' : 'ev-down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%</em>`; };
const tbl = (rows, cols) => rows.length ? `<div class="rk-scroll"><table class="pb-table rk"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="dash-fine">Nothing yet.</p>';
const STATUS = { active: 'Active', unsubscribed: 'Unsubscribed', bounced: 'Bounced', complained: 'Marked spam' };
const KIND = { welcome: 'Welcome', job: 'Job reminder', lib: 'Weekly', month: 'Monthly', content: 'Weekly' };
const LEVELS = ['Couch Potato', 'Good Enough Guy', 'Curb Appeal Hunter', 'Lawn Psycho'];
// Engagement stages (worker/crm.js STAGED): what each means, shown as hover text.
const STAGES = { new: ['New', 'Signed up in the last 14 days'], engaged: ['Engaged', 'Clicked, replied, visited the site, signed in or answered something in the last 30 days'],
  cooling: ['Cooling', 'Quiet 30–60 days, or only opening emails'], dormant: ['Dormant', 'Nothing for 60+ days'], gone: ['Gone', 'Unsubscribed, bounced or marked spam'] };
const TRACKS = { diy: 'DIY', crew: 'Landscaper', robot: 'Robot' };
const SOURCES = { quiz: 'Quiz', measure: 'Measure Your Yard', nudge: '“Email me my plan” reminder', account: 'Account page' };
const stagePill = (st) => (st ? `<span class="ml-stage ml-st-${st}" title="${esc(STAGES[st]?.[1] || '')}">${STAGES[st]?.[0] || st}</span>` : '');
const ago = (t) => { if (!t) return '–'; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 20160 ? `${Math.round(m / 1440)}d ago` : day(t); };

export function initMail({ root, api }) {
  const box = root.querySelector('[data-mail-root]');
  if (!box) return;
  let sub = 'overview', days = 28, loaded = false;
  let pq = '', pstatus = '', poff = 0, ylevel = 1, ytrack = 'diy', etrack = '';
  const pf = { stage: '', track: '', level: '', source: '', profile: '', sort: 'new' };
  const SUBS = [['overview', 'Overview'], ['funnel', 'Funnel'], ['emails', 'Emails'], ['tests', 'A/B Tests'], ['inbox', 'Inbox'], ['people', 'People'], ['year', 'Year at a Glance'], ['settings', 'Settings']];
  box.innerHTML = `
    <div class="ml-status" data-ml-status></div>
    <div class="dash-tabs ml-subs" role="tablist">${SUBS.map(([id, t]) => `<button type="button" class="cp-chip" data-ml-sub="${id}" aria-pressed="false">${t} <span data-ml-badge="${id}"></span></button>`).join('')}</div>
    <div data-ml-body><p class="hall-msg">Loading…</p></div>
    <dialog class="ml-dlg" data-ml-dlg><div class="ml-dlg-in"><button type="button" class="ml-x" data-ml-close aria-label="Close">✕</button><div data-ml-dlg-body></div></div></dialog>`;
  const body = box.querySelector('[data-ml-body]');
  const dlg = box.querySelector('[data-ml-dlg]');
  const dlgBody = box.querySelector('[data-ml-dlg-body]');
  box.querySelector('[data-ml-close]').addEventListener('click', () => dlg.close());
  document.body.appendChild(dlg); // so a person can open from any HQ tab (This Week → New Sign-Ups)
  const open = (html) => { dlgBody.innerHTML = html; dlg.showModal(); };
  const err = (e) => `<p class="hall-msg">Couldn’t load: ${esc(e.message)}</p>`;

  box.querySelector('.ml-subs').addEventListener('click', (e) => { const b = e.target.closest('[data-ml-sub]'); if (b) show(b.dataset.mlSub); });
  function show(s) {
    sub = s;
    box.querySelectorAll('[data-ml-sub]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mlSub === s)));
    ({ overview, funnel, emails, tests, inbox, people, year, settings })[s]();
  }
  // Called when the Email tab opens.
  const load = () => { if (!loaded) { loaded = true; status(); show('overview'); } };
  // openPreview: deep links from the review sheet, /admin/#mail=<key>&track=robot&level=2 (job/month/prep keys get this year).
  const openPreview = (k, o = {}) => {
    load();
    const y = new Date().getFullYear();
    if (/^(job|month|prep):[^:]+$/.test(k)) k = `${k}:${y}`;
    else if (/^lib:[^:]+$/.test(k)) k = `${k}:y1`;
    else if (k === 'y-review') k = `y-review:${y}`;
    preview(k, o);
  };
  // From This Week → New Sign-Ups (or anywhere): open one person.
  const openPerson = (id) => person(Number(id));
  // Jump to People with filters set (e.g. a stage tile).
  const openPeople = (f = {}) => { load(); Object.assign(pf, { stage: '', track: '', level: '', source: '', profile: '' }, f); pq = ''; pstatus = ''; poff = 0; show('people'); };
  return { load, openPreview, openPerson, openPeople };

  /* ---------------------------------------------------------------- status bar */
  async function status() {
    const el = box.querySelector('[data-ml-status]');
    try {
      const r = await api('/api/admin/crm/settings');
      const m = r.settings.mode;
      const label = { off: 'Sending is OFF. Sign-ups are being saved; nothing goes out.', test: 'TEST mode: only people marked “test” get emails.', live: 'LIVE: the drip is sending.' }[m];
      el.innerHTML = `<p class="ml-pill ml-${m}"><b>${label}</b> ${r.binding ? '' : '· The EMAIL binding is missing.'}${r.lastError ? ` · Last send error: <code>${esc(r.lastError.code)}</code> ${when(r.lastError.at)}` : ''} <button type="button" class="linkish" data-ml-go="settings">Change</button></p>`;
      el.querySelector('[data-ml-go]').addEventListener('click', () => show('settings'));
    } catch (e) { el.innerHTML = err(e); }
  }

  /* ---------------------------------------------------------------- overview */
  async function overview() {
    body.innerHTML = '<p class="hall-msg">Loading…</p>';
    let r; try { r = await api(`/api/admin/crm/overview?days=${days}`); } catch (e) { body.innerHTML = err(e); return; }
    const st = Object.fromEntries(r.status.map((x) => [x.status, x.n]));
    const s = r.sends, p = r.sendsPrev;
    box.querySelector('[data-ml-badge="inbox"]').textContent = r.unread ? `(${r.unread})` : '';
    const tile = (v, label, extra = '') => `<div><b>${v}</b><span>${label}</span>${extra}</div>`;
    // 90-day bars: sign-ups (up) vs unsubscribes
    const map = (rows) => Object.fromEntries(rows.map((x) => [x.d, x]));
    const S = map(r.daily.signups), U = map(r.daily.unsubs), E = map(r.daily.sends);
    const dates = []; for (let i = 89; i >= 0; i--) dates.push(new Date(Date.now() - i * 86400000 - 5 * 3600000).toISOString().slice(0, 10));
    const max = Math.max(1, ...dates.map((d) => S[d]?.n || 0));
    const maxE = Math.max(1, ...dates.map((d) => E[d]?.n || 0));
    body.innerHTML = `
      <div class="ml-range">${[[7, '7 days'], [28, '28 days'], [90, '90 days'], [0, 'All time']].map(([d, t]) => `<button type="button" class="cp-chip" data-days="${d}" aria-pressed="${d === days}">${t}</button>`).join('')}</div>
      <div class="dash-tiles ev-tiles">
        ${tile(num(st.active || 0), 'On the list', `<small>${num((r.prefs.find((x) => x.pref === 'jobs') || {}).n || 0)} jobs only</small>`)}
        ${tile(num(r.newN), 'New sign-ups', days ? delta(r.newN, r.newPrev) : '')}
        ${tile(num(r.unsubN), 'Unsubscribed', days ? delta(r.unsubN, r.unsubPrev) : '')}
        ${tile(num(s.n), 'Emails sent', days ? delta(s.n, p.n) : '')}
        ${tile(pct(s.o, s.n), 'Open rate', '<small>inflated by Apple Mail</small>')}
        ${tile(pct(s.k, s.n, 1), 'Click rate', days && p.n ? delta(s.k / (s.n || 1), p.k / p.n) : '')}
        ${tile(pct(s.u, s.n, 2), 'Unsubscribe rate', '<small>under 0.5% is healthy</small>')}
        ${tile(num(r.replies), 'Replies', r.unread ? `<small>${r.unread} unread</small>` : '')}
      </div>
      <p class="dash-fine">${num(st.bounced || 0)} bounced · ${num(st.complained || 0)} marked spam (both stop getting email automatically) · ${num(s.b || 0)} bounces/complaints in this period${s.n && s.sp / s.n > 0.001 ? ' · <b>Spam complaints are above 0.1%: slow down or check the copy.</b>' : ''}</p>
      <h3 class="dash-h">Where People Are</h3>
      <div class="ml-stages">${['new', 'engaged', 'cooling', 'dormant', 'gone'].map((k) => `<button type="button" class="ml-stg ml-st-${k}" data-stg="${k}" title="${esc(STAGES[k][1])}"><b>${num((r.stages || []).find((x) => x.stage === k)?.n || 0)}</b><span>${STAGES[k][0]}</span></button>`).join('')}</div>
      <p class="dash-fine">Tap one to see those people. Engaged = clicked, replied, came back to the site, signed in or answered something in the last 30 days.</p>
      <h3 class="dash-h">Lawn Profiles (Built Through the Emails)</h3>
      ${r.profile?.n ? `<div class="ml-prof">${[['sqft', 'Measured lawn'], ['sun', 'Sun'], ['uses', 'Who uses it'], ['grass', 'Grass picked'], ['water', 'Watering'], ['ph', 'Soil pH'], ['seeded', 'Seeding tracked']].map(([k, t]) => `<div><span>${t}</span><b>${pct(r.profile[k] || 0, r.profile.n)}</b><i style="width:${Math.round(100 * (r.profile[k] || 0) / r.profile.n)}%"></i></div>`).join('')}</div>` : '<p class="dash-fine">Shows up once people are on the list.</p>'}
      <h3 class="dash-h">Sign-ups per Day (90 days)</h3>
      <div class="ev-bars" role="img" aria-label="Sign-ups per day">${dates.map((d) => `<i style="height:${Math.max(3, Math.round(((S[d]?.n || 0) / max) * 100))}%" title="${d}: ${S[d]?.n || 0} sign-ups, ${U[d]?.n || 0} unsubscribes"></i>`).join('')}</div>
      <p class="dash-fine ev-axis"><span>${dates[0]}</span><span>Hover a bar for sign-ups and unsubscribes</span><span>${dates[89]}</span></p>
      <h3 class="dash-h">Emails Sent per Day</h3>
      <div class="ev-bars ml-bars-e" role="img" aria-label="Emails per day">${dates.map((d) => `<i style="height:${Math.max(3, Math.round(((E[d]?.n || 0) / maxE) * 100))}%" title="${d}: ${E[d]?.n || 0} sent, ${E[d]?.o || 0} opened, ${E[d]?.k || 0} clicked"></i>`).join('')}</div>
      <div class="ev-grid">
        <div><h3>Where Sign-Ups Come From</h3>${tbl(r.sources, [['Source', (x) => esc(x.src)], ['Form', (x) => esc(x.source)], ['People', (x) => num(x.n)]])}</div>
        <div><h3>Effort Levels on the List</h3>${tbl(r.levels, [['Level', (x) => esc(x.name)], ['People', (x) => num(x.n)]])}</div>
      </div>
      <details class="dash-more pb"><summary>Next 14 Days (What’s Queued)</summary><div data-ml-up><button type="button" class="btn btn-quiet" data-ml-up-btn>Work It Out</button></div></details>`;
    body.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { days = Number(b.dataset.days); overview(); }));
    body.querySelectorAll('[data-stg]').forEach((b) => b.addEventListener('click', () => openPeople({ stage: b.dataset.stg })));
    body.querySelector('[data-ml-up-btn]').addEventListener('click', async (e) => {
      const el = body.querySelector('[data-ml-up]'); e.target.disabled = true;
      try {
        const u = await api('/api/admin/crm/upcoming?days=14');
        el.innerHTML = `<p class="dash-fine">If sending is on: ${num(Object.values(u.byDay).reduce((a, b) => a + b, 0))} emails to ${num(u.contacts)} people over the next 14 days.</p>
          ${tbl(Object.entries(u.byDay).sort(), [['Day', (x) => esc(x[0])], ['Emails', (x) => num(x[1])]])}${tbl(u.byKey, [['Email', (x) => esc(x.name)], ['Sends', (x) => num(x.n)]])}`;
      } catch (er) { el.innerHTML = err(er); }
    });
  }

  /* ---------------------------------------------------------------- emails */
  async function emails() {
    body.innerHTML = '<p class="hall-msg">Loading…</p>';
    let r; try { r = await api(`/api/admin/crm/emails?days=${days}&track=${etrack}`); } catch (e) { body.innerHTML = err(e); return; }
    const kinds = ['welcome', 'job', 'month', 'lib'];
    const rows = (k) => r.emails.filter((e) => e.kind === k || (k === 'lib' && e.kind === 'lib'));
    const vs = (e) => { const v = e.variants; return v.a && v.b ? `A ${pct(v.a.k, v.a.n, 1)} · B ${pct(v.b.k, v.b.n, 1)}` : ''; };
    body.innerHTML = `
      <p class="dash-note">Every email that has gone out, grouped. <b>Click rate</b> is the number to watch (opens are padded by Apple Mail’s privacy feature). Tap a name to preview it.</p>
      <div class="ml-row">${[['', 'Everyone'], ['diy', 'DIY'], ['crew', 'Landscaper'], ['robot', 'Robot']].map(([k, t]) => `<button type="button" class="cp-chip" data-et="${k}" aria-pressed="${k === etrack}">${t}</button>`).join('')}</div>
      ${r.emails.length ? kinds.map((k) => rows(k).length ? `<h3 class="dash-h">${{ welcome: 'Welcome Series', job: 'Job Reminders', month: 'Monthly', lib: 'Weekly Content' }[k]}</h3>
        ${tbl(rows(k), [['Email', (e) => `<button type="button" class="linkish" data-prev="${esc(e.key)}">${esc(e.name)}</button>`], ['Sent', (e) => num(e.n)], ['Opened', (e) => pct(e.o, e.n)], ['Clicked', (e) => pct(e.k, e.n, 1)], ['Unsub', (e) => pct(e.u, e.n, 2)], ['A/B clicks', vs], ['Last', (e) => day(e.last)]])}` : '').join('') : '<p class="hall-msg">No emails sent yet. Turn sending on in Settings, or preview them in Year at a Glance.</p>'}
      <details class="dash-more pb"><summary>Most-Clicked Links</summary>${tbl(r.topLinks, [['Link', (x) => esc(String(x.url).replace(/^https:\/\/mowittall\.com/, '').replace(/\?.*$/, ''))], ['Clicks', (x) => num(x.n)]])}</details>`;
    body.querySelectorAll('[data-et]').forEach((b) => b.addEventListener('click', () => { etrack = b.dataset.et; emails(); }));
    body.querySelectorAll('[data-prev]').forEach((b) => b.addEventListener('click', () => preview(b.dataset.prev.replace(/^(job:[^:]+)$/, `$1:${new Date().getFullYear()}`).replace(/^(month:\d+)$/, `$1:${new Date().getFullYear()}`))));
  }

  async function preview(key, opts = {}) {
    const qs = new URLSearchParams({ key, level: String(opts.level ?? 1), variant: opts.variant || 'a' });
    if (opts.contact) qs.set('contact', opts.contact);
    if (opts.track) qs.set('track', opts.track);
    if (opts.date) qs.set('date', opts.date);
    open('<p class="hall-msg">Loading preview…</p>');
    try {
      const r = await api(`/api/admin/crm/preview?${qs}`);
      dlgBody.innerHTML = `<h3>${esc(r.name)}</h3>
        <p class="dash-fine"><b>A:</b> ${esc(r.subjects.a)}<br><b>B:</b> ${esc(r.subjects.b)}<br><b>Preview text:</b> ${esc(r.pre)}</p>
        <p class="ml-row"><button type="button" class="cp-chip" data-v="a" aria-pressed="${qs.get('variant') === 'a'}">Subject A</button><button type="button" class="cp-chip" data-v="b" aria-pressed="${qs.get('variant') === 'b'}">Subject B</button>
        <button type="button" class="btn btn-quiet" data-send>Send Me a Test</button></p><p class="dash-fine" data-sendmsg></p>
        <iframe class="ml-frame" title="Email preview" sandbox="allow-popups"></iframe>
        <p class="dash-fine">Shown for ${opts.contact ? 'this person' : `a sample ${LEVELS[opts.level ?? 1]}${opts.track && opts.track !== 'diy' ? ` (${opts.track === 'crew' ? 'landscaper' : 'robot'} track)` : ''}`}. Copy lives in worker/drip.js (ask Claude to change it).</p>`;
      dlgBody.querySelector('iframe').srcdoc = r.html;
      dlgBody.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => preview(key, { ...opts, variant: b.dataset.v })));
      dlgBody.querySelector('[data-send]').addEventListener('click', async (e) => {
        e.target.disabled = true;
        const m = dlgBody.querySelector('[data-sendmsg]');
        try { await api('/api/admin/crm/test-send', { method: 'POST', body: JSON.stringify({ key, level: opts.level ?? 1, contact: opts.contact, variant: qs.get('variant'), date: opts.date, track: opts.track }) }); m.textContent = 'Sent to your test address.'; }
        catch (er) { m.textContent = er.message; e.target.disabled = false; }
      });
    } catch (e) { dlgBody.innerHTML = err(e); }
  }

  /* ---------------------------------------------------------------- A/B tests */
  async function tests() {
    body.innerHTML = '<p class="hall-msg">Loading…</p>';
    let r; try { r = await api('/api/admin/crm/tests'); } catch (e) { body.innerHTML = err(e); return; }
    const V = { collecting: 'Collecting data', winner: 'Clear winner', 'too-close': 'Too close to call', tie: 'No real difference' };
    body.innerHTML = `
      <p class="dash-note">Each person is put in group A or B for each test (and stays there), so a test compares people, not just emails. The winner is decided on <b>click rate</b> with a standard significance test (95% confidence, at least 100 per group). ${r.autoWinner ? `Auto-pick is on: once both groups pass ${r.minArm} sends and there’s a clear winner, everyone gets the winner.` : 'Auto-pick is off (Settings).'}</p>
      ${r.tests.map((t) => {
        const [a, b] = t.arms;
        const arm = (x) => `<div class="ml-arm${t.winner === x.v ? ' is-win' : t.winner ? ' is-lose' : ''}"><p class="ml-arm-k">${x.v.toUpperCase()} ${t.winner === x.v ? '· Winner' : t.winner ? '· Loser' : ''}${t.chosen === x.v ? ' · In use' : ''}</p><p>${esc(x.label)}</p>
          <dl><div><dt>Sent</dt><dd>${num(x.n)}</dd></div><div><dt>Opened</dt><dd>${pct(x.opens, x.n)}</dd></div><div><dt>Clicked</dt><dd><b>${pct(x.clicks, x.n, 1)}</b></dd></div><div><dt>Unsub</dt><dd>${pct(x.unsubs, x.n, 2)}</dd></div></dl></div>`;
        return `<article class="dash-card ml-test"><h3>${esc(t.name)}</h3>
          <p><span class="dash-pill">${V[t.verdict]}</span>${t.winner ? ` <b>${t.winner.toUpperCase()}</b> gets ${Math.round(t.lift * 100)}% more clicks (${Math.round(t.confidence * 100)}% confidence).` : t.verdict === 'too-close' ? ` ${Math.round(t.confidence * 100)}% confidence so far. Needs more sends.` : ''}${t.chosen ? ` Everyone now gets <b>${t.chosen.toUpperCase()}</b> (${t.status === 'auto' ? 'auto-picked' : 'you picked'}).` : t.status === 'off' ? ' Paused: everyone gets A.' : ''}</p>
          <div class="ml-arms">${arm(a)}${arm(b)}</div>
          <p class="ml-row"><button type="button" class="linkish" data-t="${t.id}" data-a="winner" data-v="a">Use A for everyone</button><button type="button" class="linkish" data-t="${t.id}" data-a="winner" data-v="b">Use B for everyone</button><button type="button" class="linkish" data-t="${t.id}" data-a="pause">Pause</button><button type="button" class="linkish" data-t="${t.id}" data-a="reset">Restart the test</button></p></article>`;
      }).join('')}
      <p class="dash-fine">Want a new test (say, emoji subjects, or Tuesday vs. Thursday)? Ask Claude: tests are defined in worker/drip.js (TESTS) and get their stats here automatically.</p>`;
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('/api/admin/crm/tests', { method: 'POST', body: JSON.stringify({ id: b.dataset.t, action: b.dataset.a, variant: b.dataset.v }) }); tests(); } catch (e) { alert(e.message); }
    }));
  }

  /* ---------------------------------------------------------------- inbox */
  async function inbox(all = false) {
    body.innerHTML = '<p class="hall-msg">Loading…</p>';
    let r; try { r = await api(`/api/admin/crm/inbox${all ? '?all=1' : ''}`); } catch (e) { body.innerHTML = err(e); return; }
    const unread = r.msgs.filter((m) => m.dir === 'in' && !m.read).length;
    box.querySelector('[data-ml-badge="inbox"]').textContent = unread ? `(${unread})` : '';
    body.innerHTML = `
      <p class="dash-note">Replies to the lawn emails land here. Reply right from this page and it goes out from your Mow It Tall address, threaded. ${all ? '' : 'Auto-replies and bounces are hidden.'} <button type="button" class="linkish" data-all>${all ? 'Hide auto-replies' : 'Show everything'}</button></p>
      ${r.msgs.length ? `<ul class="ml-inbox">${r.msgs.map((m) => `<li class="${m.dir === 'in' && !m.read ? 'is-new' : ''} ml-${m.dir}" data-m="${m.id}">
        <p class="ml-meta"><b>${m.dir === 'out' ? `You → ${esc(m.to_addr)}` : esc(m.c_name || m.from_name || m.from_addr)}</b> ${m.dir === 'in' && m.c_email ? `<small>${esc(LEVELS[m.c_level] || '')}</small>` : m.dir === 'in' ? '<small>not on the list</small>' : ''} <small>${when(m.at)}</small>${m.auto ? ' <span class="dash-pill">auto</span>' : ''}</p>
        <p class="ml-subj">${esc(m.subject || '(no subject)')}</p>
        <p class="ml-text">${esc(String(m.text || '').split(/\n\s*On .+wrote:|\n-- \n/)[0].slice(0, 1200)).replace(/\n/g, '<br>')}</p>
        ${m.dir === 'in' ? `<details class="ml-reply"><summary>Reply</summary><textarea rows="5" placeholder="Hey ${esc((m.c_name || '').split(' ')[0] || 'there')}, …"></textarea><p class="ml-row"><button type="button" class="btn" data-send>Send Reply</button>${m.contact_id ? `<button type="button" class="linkish" data-person="${m.contact_id}">See their profile</button>` : ''}</p><p class="dash-fine" data-msg></p></details>` : ''}
      </li>`).join('')}</ul>` : '<p class="hall-msg">No replies yet. The day-7 “Who is this guy?” email asks people to hit reply, so they’ll come.</p>'}`;
    body.querySelector('[data-all]').addEventListener('click', () => inbox(!all));
    body.querySelectorAll('.ml-inbox li').forEach((li) => {
      const id = Number(li.dataset.m);
      li.querySelector('details')?.addEventListener('toggle', () => { if (li.classList.contains('is-new')) { li.classList.remove('is-new'); api('/api/admin/crm/inbox', { method: 'POST', body: JSON.stringify({ action: 'read', id }) }).catch(() => {}); } });
      li.querySelector('[data-send]')?.addEventListener('click', async (e) => {
        const text = li.querySelector('textarea').value, msg = li.querySelector('[data-msg]');
        e.target.disabled = true; msg.textContent = 'Sending…';
        try { await api('/api/admin/crm/reply', { method: 'POST', body: JSON.stringify({ id, text }) }); msg.textContent = 'Sent.'; setTimeout(() => inbox(all), 800); }
        catch (er) { msg.textContent = er.message; e.target.disabled = false; }
      });
      li.querySelector('[data-person]')?.addEventListener('click', (e) => person(Number(e.target.dataset.person)));
    });
  }

  /* ---------------------------------------------------------------- people */
  async function people() {
    const sel = (k, opts, label) => `<select class="hall-field" data-pf="${k}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, t]) => `<option value="${v}" ${String(pf[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    body.innerHTML = `
      <div class="ml-row"><input class="hall-field ml-search" type="search" placeholder="Search email, name or ZIP" value="${esc(pq)}" data-q>
        <select class="hall-field" data-st><option value="">Any status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${pstatus === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <a class="linkish" href="/api/admin/crm/contacts.csv" data-csv>Download CSV</a></div>
      <div class="ml-row ml-filters">
        ${sel('stage', Object.entries(STAGES).map(([k, v]) => [k, v[0]]), 'Any stage')}
        ${sel('track', Object.entries(TRACKS), 'Any track')}
        ${sel('level', LEVELS.map((n, i) => [i, n]), 'Any level')}
        ${sel('source', Object.entries(SOURCES), 'Any sign-up spot')}
        ${sel('profile', [['thin', 'Barely started (0–1 answers)'], ['half', 'Half done or more']], 'Any profile')}
        ${sel('sort', [['new', 'Newest first'], ['score', 'Most engaged'], ['active', 'Recently active'], ['old', 'Oldest first']], 'Sort')}
      </div>
      <div data-list><p class="hall-msg">Loading…</p></div>`;
    const q = body.querySelector('[data-q]'), st = body.querySelector('[data-st]');
    let timer; q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { pq = q.value; poff = 0; list(); }, 300); });
    st.addEventListener('change', () => { pstatus = st.value; poff = 0; list(); });
    body.querySelectorAll('[data-pf]').forEach((el) => el.addEventListener('change', () => { pf[el.dataset.pf] = el.value || (el.dataset.pf === 'sort' ? 'new' : ''); poff = 0; list(); }));
    body.querySelector('[data-csv]').addEventListener('click', async (e) => {
      e.preventDefault();
      const r = await fetch('/api/admin/crm/contacts.csv', { headers: { 'x-admin-key': localStorage.getItem('mit-admin') || '' } });
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'mowittall-contacts.csv'; a.click();
    });
    list();
  }
  async function list() {
    const el = body.querySelector('[data-list]');
    const qs = new URLSearchParams({ q: pq, status: pstatus, offset: String(poff), ...pf });
    let r; try { r = await api(`/api/admin/crm/contacts?${qs}`); } catch (e) { el.innerHTML = err(e); return; }
    el.innerHTML = `<p class="dash-fine">${num(r.total)} ${r.total === 1 ? 'person' : 'people'} · Score 0–100: clicks, replies, profile answers, site visits (opens count a little).</p>
      ${tbl(r.contacts, [['Who', (c) => `<button type="button" class="linkish" data-p="${c.id}">${esc(c.name ? `${c.name} · ` : '')}${esc(c.email)}</button>${c.is_test ? ' <span class="dash-pill">test</span>' : ''}`],
        ['Stage', (c) => stagePill(c.stage) + (c.pref === 'jobs' && c.status === 'active' ? '<br><small>jobs only</small>' : '')], ['Score', (c) => `<b>${num(c.score)}</b>`],
        ['Track', (c) => esc(TRACKS[c.track] || '')], ['Level', (c) => esc(LEVELS[c.level] || '–')], ['Profile', (c) => `${c.fields}/${r.fieldsMax}`],
        ['Joined', (c) => `${day(c.created)}<br><small>${esc(SOURCES[c.source] || c.source || '')}</small>`], ['Last active', (c) => ago(c.eng_at > c.created ? c.eng_at : 0)],
        ['Sent', (c) => num(c.sent_n)], ['Clicks', (c) => num(c.clicks)]])}
      <p class="ml-row">${poff ? '<button type="button" class="linkish" data-pg="-1">← Back</button>' : ''}${poff + 50 < r.total ? '<button type="button" class="linkish" data-pg="1">More →</button>' : ''}</p>`;
    el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => person(Number(b.dataset.p))));
    el.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => { poff = Math.max(0, poff + 50 * Number(b.dataset.pg)); list(); }));
  }
  async function person(id) {
    open('<p class="hall-msg">Loading…</p>');
    let r; try { r = await api(`/api/admin/crm/contact?id=${id}`); } catch (e) { dlgBody.innerHTML = err(e); return; }
    const c = r.contact, a = c.answers || {};
    let utm = {}; try { utm = JSON.parse(c.utm || '{}'); } catch { /* */ }
    dlgBody.innerHTML = `
      <h3>${esc(c.name || c.email)}</h3>
      <p class="dash-fine">${esc(c.email)} · ${STATUS[c.status] || c.status}${c.pref === 'jobs' ? ' (job reminders only)' : ''} · joined ${when(c.created)} via ${esc(SOURCES[c.source] || c.source || 'quiz')}</p>
      ${r.eng ? `<div class="dash-tiles ml-eng">
        <div><b>${stagePill(r.eng.stage)}</b><span>Stage</span></div>
        <div><b>${num(r.eng.score)}</b><span>Score (0–100)</span></div>
        <div><b>${r.eng.fields}/${r.fieldsMax}</b><span>Profile answers</span></div>
        <div><b>${ago(r.eng.eng_at > c.created ? r.eng.eng_at : 0)}</b><span>Last active</span></div>
      </div>` : ''}
      <p class="dash-fine"><b>How they found the site:</b> ${r.before ? `${esc(r.before.source || '(direct)')}${r.before.medium && r.before.medium !== '(none)' ? ` / ${esc(r.before.medium)}` : ''}, landed on ${esc(r.before.landing || '?')} · first visit ${when(r.before.firstAt)} · ${num(r.before.sessions)} visit${r.before.sessions === 1 ? '' : 's'} and ${num(r.before.pages)} page${r.before.pages === 1 ? '' : 's'} before signing up` : `${esc(utm.src || '(direct)')}${utm.land ? `, landed on ${esc(utm.land)}` : ''}${r.hasEvents ? ' (no site history on this device)' : ''}`}
        · <b>Devices:</b> ${num(r.devices.length || 1)}${r.devices.length ? ` (${r.devices.map((d) => `${num(d.visits)} visit${d.visits === 1 ? '' : 's'}, last ${ago(d.last_at)}`).join('; ')})` : ''}</p>
      <dl class="ml-facts">
        <div><dt>Level</dt><dd>${esc(c.levelName || '–')}</dd></div><div><dt>ZIP</dt><dd>${esc(c.zip || '–')}</dd></div><div><dt>Lawn</dt><dd>${c.sqft ? `${num(c.sqft)} sq ft${c.measured ? ' (measured)' : ''}` : '–'}</dd></div>
        <div><dt>Looks</dt><dd>${esc(a.look || '–')}</dd></div><div><dt>Problems</dt><dd>${esc((a.problems || []).join(', ') || 'none')}</dd></div><div><dt>Mows</dt><dd>${esc(a.mower || '–')}</dd></div>
        <div><dt>Height</dt><dd>${esc(a.height || '–')}</dd></div><div><dt>Knows</dt><dd>${esc(['beginner', 'basics', 'reads bags', 'lawn nerd'][a.know] || '–')}</dd></div><div><dt>Sun / water</dt><dd>${esc(a.sun || '?')} / ${esc(a.water || '?')}</dd></div>
        <div><dt>Uses</dt><dd>${esc(a.uses || '?')}</dd></div><div><dt>Grass</dt><dd>${esc(a.grass || '?')}</dd></div><div><dt>Soil pH</dt><dd>${esc(a.ph || '?')}</dd></div>${a.seeded ? `<div><dt>Seeded</dt><dd>${esc(a.seeded)}</dd></div>` : ''}
      </dl>
      <p class="ml-row">
        ${c.status === 'active' ? '<button type="button" class="linkish" data-a="unsub">Unsubscribe</button>' : '<button type="button" class="linkish" data-a="resub">Resubscribe</button>'}
        ${c.pref === 'jobs' ? '<button type="button" class="linkish" data-a="all">Send everything</button>' : '<button type="button" class="linkish" data-a="jobs">Jobs only</button>'}
        ${c.is_test ? '<button type="button" class="linkish" data-a="test-off">Unmark test</button>' : '<button type="button" class="linkish" data-a="test-on">Mark as test</button>'}
        <button type="button" class="linkish" data-a="send-next">Send today’s email now</button>
        <button type="button" class="linkish ml-danger" data-a="delete">Delete (forget them)</button></p>
      <p class="dash-fine" data-amsg></p>
      <label class="ml-note">Notes<textarea rows="2" data-note>${esc(c.note || '')}</textarea></label>
      ${r.coming.length ? `<h4>Coming Up</h4>${tbl(r.coming, [['Date', (x) => esc(x.date)], ['Email', (x) => `<button type="button" class="linkish" data-pk="${esc(x.key)}" data-pd="${x.date}">${esc(x.name)}</button>`]])}` : ''}
      <h4>Timeline</h4>
      <div class="ml-row" data-tlf>${[['all', 'Everything'], ['site', 'On the site'], ['email', 'Email'], ['act', 'Profile & account']].map(([k, t], i) => `<button type="button" class="cp-chip" data-tl="${k}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>
      <ol class="ml-tl" data-tl-list>${timelineHTML(r.timeline, c.created, 'all')}</ol>
      <details class="dash-more pb"><summary>Every Email Sent (${num(r.sends.length)})</summary>${''}
      ${tbl(r.sends, [['Email', (s) => `${esc(s.name)}<br><small>${esc(s.subject || '')}</small>`], ['Sent', (s) => when(s.sent_at)], ['Status', (s) => esc(s.status) + (s.error ? `<br><small>${esc(s.error)}</small>` : '')], ['Opened', (s) => (s.opened_at ? `✓ ${s.opens}×` : '')], ['Clicked', (s) => (s.clicked_at ? `✓ ${s.clicks}×` : '')], ['A/B', (s) => esc(s.variant || '')]])}</details>
      ${r.msgs.length ? `<h4>Messages</h4>${tbl(r.msgs, [['', (m) => (m.dir === 'in' ? 'Them' : 'You')], ['When', (m) => when(m.at)], ['Message', (m) => `<b>${esc(m.subject || '')}</b><br>${esc(String(m.text || '').slice(0, 300))}`]])}` : ''}`;
    dlgBody.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.a === 'delete' && !confirm('Delete this person and everything about them? This can’t be undone.')) return;
      const m = dlgBody.querySelector('[data-amsg]');
      try { const x = await api('/api/admin/crm/contact', { method: 'POST', body: JSON.stringify({ id, action: b.dataset.a }) }); if (x.deleted) { dlg.close(); if (sub === 'people') list(); return; } person(id); }
      catch (e) { m.textContent = e.message; }
    }));
    dlgBody.querySelector('[data-note]').addEventListener('change', (e) => api('/api/admin/crm/contact', { method: 'POST', body: JSON.stringify({ id, action: 'note', note: e.target.value }) }).catch(() => {}));
    dlgBody.querySelectorAll('[data-pk]').forEach((b) => b.addEventListener('click', () => preview(b.dataset.pk, { contact: id, date: b.dataset.pd })));
    dlgBody.querySelectorAll('[data-tl]').forEach((b) => b.addEventListener('click', () => {
      dlgBody.querySelectorAll('[data-tl]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      dlgBody.querySelector('[data-tl-list]').innerHTML = timelineHTML(r.timeline, c.created, b.dataset.tl);
    }));
  }

  // One person's history, newest first, grouped by day. Site page views in one visit collapse into one line.
  function timelineHTML(items, created, filter) {
    const group = { site: 'site', email: 'email', open: 'email', click: 'email', act: 'act', signup: 'act' };
    const icon = { site: '🌐', email: '✉️', open: '👀', click: '👆', act: '✏️', signup: '⭐' };
    const rows = (items || []).filter((x) => filter === 'all' || group[x.kind] === filter);
    if (!rows.length) return '<li class="dash-fine">Nothing yet.</li>';
    // Collapse page views from the same visit (session): "Viewed 4 pages: Home, Measure…"
    const out = [];
    for (const x of rows) {
      const prev = out[out.length - 1];
      if (x.kind === 'site' && x.session && prev && prev.kind === 'site' && prev.session === x.session && x.text.startsWith('Viewed') && prev.text.startsWith('Viewed')) {
        prev.pages.push(x.text.replace(/^Viewed /, '')); prev.at0 = x.at; continue;
      }
      out.push({ ...x, pages: x.kind === 'site' && x.text.startsWith('Viewed') ? [x.text.replace(/^Viewed /, '')] : null });
    }
    let lastDay = '', marked = false;
    return out.map((x) => {
      const d = new Date(x.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const head = d !== lastDay ? `<li class="ml-tl-day">${d}</li>` : ''; lastDay = d;
      const mark = !marked && x.at < created ? (marked = true, '<li class="ml-tl-mark">↑ After signing up · Before signing up ↓</li>') : '';
      const text = x.pages ? (x.pages.length > 1 ? `Visited ${x.pages.length} pages: ${x.pages.slice().reverse().map(esc).join(' → ')}` : `Viewed ${esc(x.pages[0])}`) : esc(x.text);
      return `${mark}${head}<li class="ml-tl-i ml-tl-${x.kind}"><span class="ml-tl-t">${new Date(x.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><span aria-hidden="true">${icon[x.kind] || '•'}</span><span>${text}</span></li>`;
    }).join('');
  }

  /* ---------------------------------------------------------------- funnel */
  async function funnel() {
    body.innerHTML = '<p class="hall-msg">Loading…</p>';
    let r; try { r = await api(`/api/admin/crm/funnel?days=${days}`); } catch (e) { body.innerHTML = err(e); return; }
    const a = r.all, site = r.site || {};
    const bar = (label, n, of, note = '') => `<li class="ml-fn"><span class="ml-fn-l">${label}</span><span class="ml-fn-b"><i style="width:${of ? Math.max(2, Math.round((100 * n) / of)) : 0}%"></i></span><b>${num(n)}</b><small>${of && n !== of ? pct(n, of) : ''}${note ? ` ${note}` : ''}</small></li>`;
    const top = site.visitors || 0;
    const off = r.mode !== 'live';
    const cell = (c, k) => (c ? `<td class="ml-co" style="--a:${(c[k] / c.n).toFixed(2)}" title="${c[k]} of ${c.n}">${pct(c[k], c.n)}</td>` : '<td></td>');
    body.innerHTML = `
      <div class="ml-range">${[[7, '7 days'], [28, '28 days'], [90, '90 days'], [0, 'All time']].map(([d, t]) => `<button type="button" class="cp-chip" data-days="${d}" aria-pressed="${d === days}">${t}</button>`).join('')}</div>
      <h3 class="dash-h">From Visitor to Subscriber</h3>
      ${r.site ? `<ol class="ml-funnel">
        ${bar('Visited the site', top, top)}
        ${bar('Started the quiz', site.quiz_start, top)}
        ${bar('Finished the quiz', site.quiz_done, top)}
        ${bar('Measured their lawn', site.measure_done, top, `<small>(of ${num(site.measure_view)} who opened Measure)</small>`)}
        ${bar('Signed up', a.signups, top)}
      </ol>
      <p class="dash-fine">Unique devices, from your own event log (you’re not counted). Quiz → sign-up rate: <b>${pct(a.signups, site.quiz_done, 1)}</b>.</p>` : '<p class="dash-fine">The event log isn’t connected, so only the email side shows.</p>'}
      <h3 class="dash-h">After Signing Up</h3>
      ${off ? '<p class="ml-pill ml-off"><b>Sending is off, so the email steps stay at zero until you go Live.</b></p>' : ''}
      <ol class="ml-funnel">
        ${bar('Signed up', a.signups, a.signups)}
        ${bar('Got an email', a.emailed, a.signups)}
        ${bar('Opened the welcome', a.opened, a.signups, '<small>(Apple Mail pads this)</small>')}
        ${bar('Clicked something', a.clicked, a.signups)}
        ${bar('Profile half done', a.profile, a.signups, '<small>(4+ of 7 answers)</small>')}
        ${bar('Came back to the site', a.returned, a.signups)}
        ${bar('Signed in', a.signedIn, a.signups)}
        ${a.old90 ? bar('Still subscribed at 90 days', a.active90, a.old90, `<small>(of ${num(a.old90)} who joined 90+ days ago)</small>`) : ''}
      </ol>
      <h3 class="dash-h">By Sign-Up Spot</h3>
      ${tbl(r.sources, [['Where', (x) => esc(SOURCES[x.source] || x.source)], ['Sign-ups', (x) => num(x.signups)], ['Clicked', (x) => pct(x.clicked, x.signups)], ['Profile half done', (x) => pct(x.profile, x.signups)],
        ['Came back', (x) => pct(x.returned, x.signups)], ['Left', (x) => pct(x.unsub, x.signups)]])}
      <h3 class="dash-h">Cohorts: Still Subscribed</h3>
      <p class="dash-fine">Each row is a sign-up week. Each column: weeks since they signed up. Darker = more people still on the list.</p>
      ${r.cohorts.length ? `<div class="rk-scroll"><table class="pb-table ml-cohort"><thead><tr><th>Week of</th><th>People</th>${Array.from({ length: 12 }, (_, k) => `<th>W${k + 1}</th>`).join('')}</tr></thead>
        <tbody>${r.cohorts.map((c) => `<tr><td>${esc(c.week)}</td><td>${num(c.n)}</td>${c.cells.map((x) => cell(x, 'kept')).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="dash-fine">Nothing yet.</p>'}
      <h3 class="dash-h">Cohorts: Ever Clicked</h3>
      ${r.cohorts.length ? `<div class="rk-scroll"><table class="pb-table ml-cohort"><thead><tr><th>Week of</th><th>People</th>${Array.from({ length: 12 }, (_, k) => `<th>W${k + 1}</th>`).join('')}</tr></thead>
        <tbody>${r.cohorts.map((c) => `<tr><td>${esc(c.week)}</td><td>${num(c.n)}</td>${c.cells.map((x) => cell(x, 'clicked')).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="dash-fine">Nothing yet.</p>'}
      <h3 class="dash-h">Stages</h3>
      ${tbl(['new', 'engaged', 'cooling', 'dormant', 'gone'].map((k) => ({ k, ...(r.stages.find((x) => x.stage === k) || { n: 0, avg: 0 }) })),
        [['Stage', (x) => `<button type="button" class="linkish" data-stg="${x.k}">${stagePill(x.k)}</button>`], ['What it means', (x) => esc(STAGES[x.k][1])], ['People', (x) => num(x.n)], ['Avg score', (x) => num(x.avg)]])}`;
    body.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { days = Number(b.dataset.days); funnel(); }));
    body.querySelectorAll('[data-stg]').forEach((b) => b.addEventListener('click', () => openPeople({ stage: b.dataset.stg })));
  }

  /* ---------------------------------------------------------------- year at a glance */
  async function year() {
    body.innerHTML = '<p class="hall-msg">Working out a year of email…</p>';
    let r; try { r = await api(`/api/admin/crm/year?level=${ylevel}&track=${ytrack}`); } catch (e) { body.innerHTML = err(e); return; }
    const kinds = r.items.reduce((m, x) => { m[x.kind] = (m[x.kind] || 0) + 1; return m; }, {});
    let lastM = '';
    body.innerHTML = `
      <p class="dash-note">Every email a new subscriber would get over the next 12 months if they signed up today, worked out by the same code that sends them. One calendar for everyone (worker/calendar.js); the track swaps mowing content for landscaper or robot versions. Tap one to preview it. Content comes from ${r.poolSize} posts, guides and tools, and every new post joins automatically.</p>
      <div class="ml-row">${LEVELS.map((n, i) => `<button type="button" class="cp-chip" data-yl="${i}" aria-pressed="${i === ylevel}">${n}</button>`).join('')}</div><div class="ml-row">${[['diy', 'I mow'], ['crew', 'Landscaper mows'], ['robot', 'Robot mows']].map(([k, t]) => `<button type="button" class="cp-chip" data-yt="${k}" aria-pressed="${k === ytrack}">${t}</button>`).join('')}</div>
      <p><b>${r.items.length} emails</b> in a year: ${kinds.welcome || 0} welcome, ${kinds.job || 0} job reminders, ${kinds.month || 0} monthly, ${kinds.content || 0} weekly.</p>
      <ol class="ml-year">${r.items.map((x) => {
        const m = new Date(`${x.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const head = m !== lastM ? `<li class="ml-ym">${m}</li>` : ''; lastM = m;
        return `${head}<li class="ml-yi ml-k-${x.kind}"><span class="ml-yd">${new Date(`${x.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <button type="button" class="linkish" data-yk="${esc(x.key)}" data-yd="${x.date}">${esc(x.subject)}</button><small>${KIND[x.kind] || x.kind} · ${esc(x.name)}</small></li>`;
      }).join('')}</ol>`;
    body.querySelectorAll('[data-yl]').forEach((b) => b.addEventListener('click', () => { ylevel = Number(b.dataset.yl); year(); }));
    body.querySelectorAll('[data-yt]').forEach((b) => b.addEventListener('click', () => { ytrack = b.dataset.yt; year(); }));
    body.querySelectorAll('[data-yk]').forEach((b) => b.addEventListener('click', () => preview(b.dataset.yk, { level: ylevel, date: b.dataset.yd, track: ytrack })));
  }

  /* ---------------------------------------------------------------- settings */
  async function settings() {
    body.innerHTML = '<p class="hall-msg">Loading…</p>';
    let r; try { r = await api('/api/admin/crm/settings'); } catch (e) { body.innerHTML = err(e); return; }
    const s = r.settings;
    body.innerHTML = `
      <article class="dash-card"><h3>Sending</h3>
        <div class="ml-row">${[['off', 'Off'], ['test', 'Test people only'], ['live', 'Live']].map(([k, t]) => `<button type="button" class="cp-chip" data-mode="${k}" aria-pressed="${s.mode === k}">${t}</button>`).join('')}</div>
        <p class="dash-fine"><b>Off:</b> sign-ups are saved, nothing sends. <b>Test:</b> only people you mark “test” in People get the real drip (sign up yourself from the quiz, then mark yourself). <b>Live:</b> everyone. New sign-ups from the last 14 days get their welcome email when you switch to Live.</p></article>
      <article class="dash-card"><h3>Addresses</h3>
        <label class="ml-field">Send from (name)<input class="hall-field" data-k="from_name" value="${esc(s.from_name)}"></label>
        <label class="ml-field">Send from (address on mowittall.com)<input class="hall-field" data-k="from_addr" value="${esc(s.from_addr)}"></label>
        <label class="ml-field">Your test address (gets “Send Me a Test”)<input class="hall-field" type="email" data-k="test_to" value="${esc(s.test_to)}" placeholder="you@gmail.com"></label>
        <label class="ml-field">Also forward replies to (optional, must be a verified address in Email Routing)<input class="hall-field" type="email" data-k="forward_to" value="${esc(s.forward_to)}"></label>
        <button type="button" class="btn" data-save>Save</button> <span class="dash-fine" data-smsg></span></article>
      <article class="dash-card"><h3>A/B Tests</h3>
        <label class="ml-check"><input type="checkbox" data-auto ${s.auto_winner === '1' ? 'checked' : ''}> Auto-pick winners once both groups have <input class="hall-field ml-num" type="number" min="100" step="50" data-min value="${esc(s.min_arm)}"> sends</label></article>
      <article class="dash-card"><h3>Health Check</h3><ul class="dash-check">
        <li>${r.binding ? '✅' : '❌'} Email Service binding (EMAIL)</li>
        <li>${r.libCount ? '✅' : '❌'} Content library: ${r.libCount} posts, guides and tools</li>
        <li>${r.lastInbound ? '✅' : '⏳'} Replies coming in ${r.lastInbound ? `(last ${when(r.lastInbound)})` : '(none yet: needs the Email Routing rule)'}</li>
        <li>${r.events?.n ? '✅' : '⏳'} Delivery events (bounces/complaints) ${r.events?.n ? `(${num(r.events.n)}, last ${when(r.events.last)})` : '(none yet: needs the queue)'}</li>
        ${r.lastError ? `<li>⚠️ Last send error: <code>${esc(r.lastError.code)}</code> ${esc(r.lastError.error)} (${when(r.lastError.at)})</li>` : ''}
      </ul></article>`;
    body.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.mode === 'live' && !confirm('Go live? The drip starts emailing everyone on the list (welcome emails first).')) return;
      try { await api('/api/admin/crm/settings', { method: 'POST', body: JSON.stringify({ mode: b.dataset.mode }) }); settings(); status(); } catch (e) { alert(e.message); }
    }));
    body.querySelector('[data-save]').addEventListener('click', async () => {
      const o = {}; body.querySelectorAll('[data-k]').forEach((i) => { o[i.dataset.k] = i.value.trim(); });
      const m = body.querySelector('[data-smsg]');
      try { await api('/api/admin/crm/settings', { method: 'POST', body: JSON.stringify(o) }); m.textContent = 'Saved.'; } catch (e) { m.textContent = e.message; }
    });
    const saveAb = () => api('/api/admin/crm/settings', { method: 'POST', body: JSON.stringify({ auto_winner: body.querySelector('[data-auto]').checked ? '1' : '0', min_arm: body.querySelector('[data-min]').value }) }).catch((e) => alert(e.message));
    body.querySelector('[data-auto]').addEventListener('change', saveAb);
    body.querySelector('[data-min]').addEventListener('change', saveAb);
  }
}
