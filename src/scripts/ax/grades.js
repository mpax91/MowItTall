// HQ → Social → Grades (Nov 19, 2026). Every post, every calendar drop and every content item graded A–F, plus
// What Works (which kinds of posts land) and Bring It Back (what to resurface or rest). Data: GET /api/admin/ax/grades
// (worker/grades.js). Ported from the Bedford Bee's post grades in MikeCOS.
import { S, api, card, body, errBox, chips, onSeg, setSub, esc, fmt, dlabel } from './core.js';

const LETTERS = ['A', 'B', 'C', 'D', 'F'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND = { post: 'Blog Post', guide: 'Guide', tool: 'Tool', weed: 'Weed', tip: 'Tip', job: 'Lawn Job', month: 'Month Page', moment: 'Moment', engage: 'Question', intro: 'Intro' };
const grid = (html) => `<div class="ax-grid">${html}</div>`;
const ageText = (h) => (h < 1 ? 'under an hour' : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)} days`);

/** Letter chip: "…" too early, "–" not graded (learning), else the letter with a trend arrow. */
export function chip(g, { big = false } = {}) {
  if (!g) return '';
  const cls = `gr-chip${big ? ' is-big' : ''}`;
  if (g.tooEarly) return `<span class="${cls} is-new" title="Too early to grade (${ageText(g.ageHours)} old)">…</span>`;
  if (!g.letter) return `<span class="${cls} is-new" title="${esc(g.note || 'Not graded yet')}">–</span>`;
  const title = [`Grade ${g.letter}${g.rank != null ? ` · better than ${Math.min(99, Math.round(g.rank))}% of recent posts` : ''}`,
    g.provisional ? `Provisional: ${ageText(g.ageHours || 0)} old, can still move` : null, g.trend && g.prevLetter ? `Was ${g.prevLetter}` : null].filter(Boolean).join('\n');
  return `<span class="gr-wrap" title="${esc(title)}"><span class="${cls} is-${g.letter.toLowerCase()}${g.provisional ? ' is-prov' : ''}">${g.letter}</span>${g.trend === 'up' ? '<i class="gr-tr is-up">↑</i>' : g.trend === 'down' ? '<i class="gr-tr is-down">↓</i>' : ''}</span>`;
}
const why = (g) => (!g?.letter ? (g?.tooEarly ? 'Too early' : '') : g.letter === 'D' || g.letter === 'F' ? g.worst || g.best : g.best || g.worst) || '';

let D = null;
export async function grades(root) {
  root.innerHTML = '<div class="ax-skel tall"></div>';
  try { D = await api('/api/admin/ax/grades'); } catch (e) { root.innerHTML = errBox(e.message); return; }
  const anyGraded = D.posts.some((p) => p.grade.letter);
  root.innerHTML = grid(`
    ${card('status', 'Grading Status', { span: 12, sub: 'Each post is graded against that platform’s own recent posts (A = top 10%, B = next 20%, C = middle, D and F = bottom 35%). Young posts get a provisional grade that settles after 3 days (Pinterest 30, YouTube 14).' })}
    ${card('works', 'What Works', { span: 12, sub: 'Average grade (as a percentile, 50 = typical) of settled posts, grouped. A group needs 3+ graded posts before it counts as a takeaway.' })}
    ${card('back', 'Bring It Back', { span: 12, sub: 'The Content Calendar already uses these: A-grade items come back after 75 days, B-grade items get a boost when they’re in season, and items that got a D or F twice in a row rest. Favorite or Rest anything by hand.' })}
    ${card('drops', 'Each Day’s Post, All Platforms', { span: 12, sub: 'One calendar item across every platform it went to, graded together (Facebook and Instagram count most). Copy-paste posts are matched to the calendar by platform and day.' })}
    ${card('posts', 'Every Post, Graded', { span: 12, sub: 'Click a post to see what drove its grade.' })}
    ${card('set', 'Grade Settings', { span: 12, sub: 'How much each number counts. Changes apply to every grade right away.' })}`);
  status(body(root, 'status'));
  works(body(root, 'works'), anyGraded);
  back(body(root, 'back'), root);
  drops(body(root, 'drops'));
  posts(body(root, 'posts'));
  settings(body(root, 'set'), root);
}

function status(el) {
  const L = Object.entries(D.learning);
  if (!L.length) { el.innerHTML = '<p class="ax-empty">No posts pulled yet. Grades start as soon as HQ has stats for your posts (Sources &amp; Export).</p>'; return; }
  const mix = Object.fromEntries([...LETTERS, 'pending'].map((l) => [l, 0]));
  for (const p of D.posts) { if (p.grade.letter) mix[p.grade.letter]++; else mix.pending++; }
  el.innerHTML = `<div class="gr-status">${L.map(([pl, l]) => {
    const on = l.graded > 0, pct = Math.min(100, Math.round((l.settled / l.need) * 100));
    return `<div class="gr-plat"><b>${esc(D.platforms[pl] || pl)}</b>${on ? `<span class="gr-on">Grading on</span><small>${l.graded} graded · ${l.posts} posts</small>`
      : `<span class="gr-learn">Learning</span><div class="gr-prog"><i style="width:${pct}%"></i></div><small>${l.settled} of ${l.need} settled posts needed</small>`}</div>`;
  }).join('')}</div>
  <div class="gr-mix">${LETTERS.map((l) => `<span>${chip({ letter: l })} ${mix[l]}</span>`).join('')}<span>${chip({ letter: null, note: 'Not graded yet' })} ${mix.pending} not graded yet</span></div>
  ${L.every(([, l]) => !l.graded) ? `<p class="ax-hint gr-note">The account is brand new, so there’s nothing to compare against yet. HQ is already saving each post’s numbers every few hours while it’s young, so the first grades will be right once ${D.config.minPosts} posts per platform have settled (about two weeks of daily posting). Posts from before then stay ungraded: they went out to almost nobody.</p>` : ''}`;
}

function works(el, anyGraded) {
  const W = D.works;
  if (!W.gradedDrops && !W.gradedPosts) {
    el.innerHTML = `<p class="ax-empty">${anyGraded ? 'Waiting for graded posts to settle.' : 'Shows up once posts are graded.'} You’ll see which types of content, topics, hooks, days and formats beat your average, plus a short “More Of / Less Of” list.</p>`;
    return;
  }
  let dim = S.sub.gdim || 'kind';
  const takeaway = (xs, good) => (xs.length ? `<ul class="gr-take ${good ? 'is-good' : 'is-bad'}">${xs.map((x) => `<li><b>${esc(x.label)}</b> <span>${esc(x.dim)} · avg ${Math.round(x.avg)} vs ${Math.round(W.overall)} overall · ${x.n} posts</span></li>`).join('')}</ul>`
    : `<p class="ax-hint">Nothing stands out yet${good ? '' : ' (good)'}.</p>`);
  const draw = () => {
    const d = W.dims.find((x) => x.id === dim) || W.dims[0];
    el.innerHTML = `<div class="gr-cols"><div><h4>More Of</h4>${takeaway(W.more, true)}</div><div><h4>Less Of</h4>${takeaway(W.less, false)}</div></div>
      <div class="ax-sub">${chips('gdim', W.dims.map((x) => [x.id, x.title]), dim)}</div>
      ${d.rows.length ? `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th class="is-dim">${esc(d.title)}</th><th>Posts</th><th class="is-dim">Average Grade (percentile)</th><th>Got A or B</th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr class="${r.n < 3 ? 'gr-thin' : ''}"><td class="is-dim">${esc(r.label)}${r.n < 3 ? ' <span class="ax-hint">(too few)</span>' : ''}</td><td>${r.n}</td>
        <td class="is-dim"><div class="gr-bar"><i style="width:${Math.max(2, r.avg)}%" class="${r.avg >= 70 ? 'is-good' : r.avg < 35 ? 'is-bad' : ''}"></i><span>${Math.round(r.avg)}</span></div></td><td>${r.good}%</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="ax-empty">No graded posts in this group yet.</p>'}`;
    onSeg(el, 'gdim', (v) => { dim = v; setSub('gdim', v); draw(); });
  };
  draw();
}

function back(el, root) {
  const R = D.resurface;
  const tabs = [['ready', `Ready Now (${R.ready.length})`], ['lastYear', `This Time Last Year (${R.lastYear.length})`], ['soon', `Coming Up (${R.soon.length})`], ['resting', `Resting (${R.resting.length})`], ['favorites', `Favorites (${R.favorites.length})`]];
  let tab = S.sub.gback || 'ready';
  const EMPTY = {
    ready: 'Nothing yet. Items land here when they got an A or B, are in season, and enough time has passed since they last ran (75 days for an A, a year for most B posts).',
    lastYear: 'Items that got an A or B within a month of this date last year. Starts filling next fall.',
    soon: 'A- and B-grade items still waiting out their break, with the day each one is free to come back.',
    resting: 'Nothing resting. Items rest when their last two runs got a D or F, or when you mark them Rest.',
    favorites: 'Mark an item Favorite and the calendar treats it like an A: it can come back after 75 days.',
  };
  const draw = () => {
    const list = R[tab] || [];
    el.innerHTML = `<div class="ax-sub">${chips('gback', tabs, tab)}</div>${list.length ? `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th class="is-dim">Item</th><th class="is-dim">Type</th><th>Best</th><th class="is-dim">Runs</th><th class="is-dim">${tab === 'soon' ? 'Free Again' : tab === 'lastYear' ? 'Last Year' : 'Last Ran'}</th><th class="is-dim">Why</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td class="is-dim">${x.url ? `<a class="ax-link" href="https://mowittall.com${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>` : esc(x.title)}</td><td class="is-dim">${esc(KIND[x.kind] || x.kind || '')}</td>
        <td>${x.best ? chip({ letter: x.best.letter, rank: x.best.rank }) : '–'}</td><td class="is-dim">${x.runs.map((r) => chip({ letter: r.letter, rank: r.rank, provisional: r.provisional, note: 'Not graded' })).join(' ')}</td>
        <td class="is-dim">${tab === 'soon' ? dlabel(x.readyOn, 'date', true) : tab === 'lastYear' ? dlabel(x.run.date, 'date', true) : x.lastRun ? dlabel(x.lastRun, 'date', true) : '–'}</td>
        <td class="is-dim">${esc(x.why || (tab === 'lastYear' ? `Got ${x.run.letter} around this date` : ''))}</td>
        <td class="gr-acts"><button type="button" class="ax-btn is-ghost" data-mark="${esc(x.item)}" data-to="${x.mark === 'favorite' ? '' : 'favorite'}">${x.mark === 'favorite' ? 'Unfavorite' : 'Favorite'}</button>
          <button type="button" class="ax-btn is-ghost" data-mark="${esc(x.item)}" data-to="${x.mark === 'rest' ? '' : 'rest'}">${x.mark === 'rest' ? 'Unrest' : 'Rest'}</button></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="ax-empty">${EMPTY[tab]}</p>`}`;
    onSeg(el, 'gback', (v) => { tab = v; setSub('gback', v); draw(); });
    el.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api('/api/admin/ax/grades/mark', { method: 'POST', body: JSON.stringify({ item: b.dataset.mark, mark: b.dataset.to || null }) }); await grades(root); }
      catch (e) { b.disabled = false; alertBox(el, e.message); }
    }));
  };
  draw();
}
const alertBox = (el, msg) => el.insertAdjacentHTML('afterbegin', errBox(msg));

function drops(el) {
  if (!D.drops.length) { el.innerHTML = '<p class="ax-empty">No posts matched to the Content Calendar yet. Auto-posted days match on their own; copy-paste posts match when they go out on the day they were planned.</p>'; return; }
  let show = 15;
  const draw = () => {
    el.innerHTML = `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th>Grade</th><th class="is-dim">Day</th><th class="is-dim">Item</th><th class="is-dim">Slot</th><th class="is-dim">Hook</th><th class="is-dim">Platforms</th><th class="is-dim">Why</th></tr></thead><tbody>
      ${D.drops.slice(0, show).map((d) => `<tr><td>${chip(d)}</td><td class="is-dim">${DOWS[d.dow]} ${dlabel(d.date, 'date', true)}</td>
        <td class="is-dim"><span class="ax-cell-l">${esc(d.title)}</span> <span class="ax-hint">${esc(KIND[d.kind] || '')}</span></td><td class="is-dim">${esc((d.label || '').split(' · ')[0])}</td>
        <td class="is-dim" title="${esc(d.hookText || '')}">${(d.hook || 0) + 1}</td>
        <td class="is-dim gr-parts">${d.parts.map((p) => `<span title="${esc(D.platforms[p.platform])}">${esc((D.platforms[p.platform] || p.platform).slice(0, 2))} ${chip({ letter: p.letter, rank: p.rank, note: p.learning ? 'Learning' : 'Not graded' })}</span>`).join('')}</td>
        <td class="is-dim">${esc(why(d) || (d.learning ? 'Learning' : ''))}</td></tr>`).join('')}</tbody></table></div>
      <div class="ax-table-f"><span>${Math.min(show, D.drops.length)} of ${D.drops.length}</span>${D.drops.length > show ? '<button type="button" class="ax-link" data-more>Show more</button>' : ''}</div>`;
    el.querySelector('[data-more]')?.addEventListener('click', () => { show += 50; draw(); });
  };
  draw();
}

function posts(el) {
  if (!D.posts.length) { el.innerHTML = '<p class="ax-empty">No posts yet.</p>'; return; }
  const plats = [...new Set(D.posts.map((p) => p.platform))];
  let plat = S.sub.gplat || 'all', letter = 'all', show = 20, open = null;
  const draw = () => {
    let rs = D.posts.filter((p) => (plat === 'all' || p.platform === plat) && (letter === 'all' || (letter === 'none' ? !p.grade.letter : p.grade.letter === letter)));
    el.innerHTML = `<div class="ax-sub">${chips('gplat', [['all', 'All Platforms'], ...plats.map((k) => [k, D.platforms[k] || k])], plat)} ${chips('glet', [['all', 'All Grades'], ...LETTERS.map((l) => [l, l]), ['none', 'Not Graded']], letter)}</div>
      <div class="ax-table-wrap"><table class="ax-table"><thead><tr><th>Grade</th><th class="is-dim">Why</th><th class="is-dim">Posted</th><th class="is-dim">Platform</th><th class="is-dim">Post</th><th class="is-dim">Calendar Item</th><th>Seen</th><th>Engagements</th></tr></thead><tbody>
      ${rs.slice(0, show).map((p) => `<tr data-k="${esc(p.key)}" tabindex="0" class="gr-row">
        <td>${chip(p.grade)}</td><td class="is-dim">${esc(why(p.grade) || p.grade.note || '')}</td><td class="is-dim">${dlabel(p.date, 'date', true)}</td><td class="is-dim">${esc(D.platforms[p.platform] || p.platform)}</td>
        <td class="is-dim"><span class="ax-cell-l ax-post-t" title="${esc(p.text || '')}">${esc(p.text || '(no text)')}</span></td>
        <td class="is-dim">${p.itemTitle ? esc(p.itemTitle) : '<span class="ax-hint">Not linked</span>'}</td><td>${fmt(p.stats.seen)}</td><td>${fmt(p.stats.eng)}</td></tr>
        ${open === p.key ? `<tr class="gr-detail"><td colspan="8">${detail(p)}</td></tr>` : ''}`).join('')}</tbody></table></div>
      <div class="ax-table-f"><span>${Math.min(show, rs.length)} of ${rs.length}</span>${rs.length > show ? '<button type="button" class="ax-link" data-more>Show more</button>' : ''}</div>`;
    onSeg(el, 'gplat', (v) => { plat = v; setSub('gplat', v); draw(); });
    onSeg(el, 'glet', (v) => { letter = v; draw(); });
    el.querySelector('[data-more]')?.addEventListener('click', () => { show += 50; draw(); });
    el.querySelectorAll('[data-k]').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('a')) return; open = open === tr.dataset.k ? null : tr.dataset.k; draw(); }));
  };
  draw();
}
function detail(p) {
  const g = p.grade;
  const head = `<div class="gr-dh">${chip(g, { big: true })}<div><b>${g.letter ? `Better than ${Math.min(99, Math.round(g.rank))}% of recent ${esc(D.platforms[p.platform])} posts` : esc(g.note || (g.tooEarly ? 'Too early to grade' : 'Not graded yet'))}</b>
    <small>${ageText(g.ageHours)} old${g.provisional ? ' · provisional, can still move' : ''}${g.projected ? ' · young numbers projected forward' : ''} · compared with ${g.baselineN} earlier posts · ${g.confidence} confidence</small></div>
    ${p.url ? `<a class="ax-btn is-ghost" href="${esc(p.url)}" target="_blank" rel="noopener">Open Post ↗</a>` : ''}</div>`;
  if (!g.drivers.length) return head + '<p class="ax-hint">Signals show up once there are at least 5 earlier posts with each number.</p>';
  const v = (d) => (d.key === 'rate' ? fmt(d.value, 'pct') : d.value == null ? '–' : fmt(Math.round(d.value * 10) / 10));
  const t = (d) => (d.typical == null ? '–' : d.key === 'rate' ? fmt(d.typical, 'pct') : fmt(Math.round(d.typical * 10) / 10));
  return head + `<table class="ax-table gr-dt"><thead><tr><th class="is-dim">Signal</th><th>Weight</th><th>This Post</th><th>Typical</th><th class="is-dim">Percentile</th></tr></thead><tbody>
    ${g.drivers.map((d) => `<tr><td class="is-dim">${esc(d.label)}</td><td>${d.weight}</td><td>${v(d)}</td><td>${t(d)}</td>
      <td class="is-dim"><div class="gr-bar"><i style="width:${Math.max(2, d.pct)}%" class="${d.pct >= 60 ? 'is-good' : d.pct <= 40 ? 'is-bad' : ''}"></i><span>${Math.round(d.pct)}</span></div></td></tr>`).join('')}</tbody></table>`;
}

function settings(el, root) {
  const c = D.config;
  const num = (name, val, min, max, step = 1) => `<input type="number" class="ax-search gr-num" data-f="${name}" value="${val}" min="${min}" max="${max}" step="${step}">`;
  el.innerHTML = `<details class="gr-set"><summary>${D.custom ? 'Custom settings in use' : 'Using the default settings'} · Edit</summary>
    <div class="gr-set-g">
      <label>A starts at percentile ${num('cutoffs.A', c.cutoffs.A, 1, 99)}</label><label>B ${num('cutoffs.B', c.cutoffs.B, 1, 99)}</label><label>C ${num('cutoffs.C', c.cutoffs.C, 1, 99)}</label><label>D ${num('cutoffs.D', c.cutoffs.D, 0, 99)}</label>
      <label>Posts needed before grading ${num('minPosts', c.minPosts, 3, 60)}</label><label>Compare with the last (days) ${num('baselineDays', c.baselineDays, 14, 730)}</label>
      <label>Recent posts count double after (days) ${num('halfLifeDays', c.halfLifeDays, 7, 365)}</label><label>Too early under (hours) ${num('minAgeHours', c.minAgeHours, 0, 48)}</label>
    </div>
    <h4>Signal Weights</h4><div class="gr-set-w">${Object.entries(c.weights).map(([pl, ws]) => `<fieldset><legend>${esc(D.platforms[pl] || pl)}</legend>
      ${Object.entries(ws).map(([m, w]) => `<label>${esc(D.labels[pl]?.[m] || m)} ${num(`weights.${pl}.${m}`, w, 0, 100)}</label>`).join('')}</fieldset>`).join('')}
      <fieldset><legend>Daily Drop Grade</legend>${Object.entries(c.dropWeights).map(([pl, w]) => `<label>${esc(D.platforms[pl] || pl)} ${num(`dropWeights.${pl}`, w, 0, 100)}</label>`).join('')}</fieldset></div>
    <div class="gr-set-a"><button type="button" class="ax-btn" data-save>Save</button> <button type="button" class="ax-btn is-ghost" data-reset>Back to Defaults</button> <span class="ax-hint" data-msg></span></div></details>`;
  const msg = el.querySelector('[data-msg]');
  el.querySelector('[data-save]').addEventListener('click', async () => {
    const cfg = JSON.parse(JSON.stringify(c));
    el.querySelectorAll('[data-f]').forEach((i) => { const path = i.dataset.f.split('.'); let o = cfg; while (path.length > 1) o = o[path.shift()]; o[path[0]] = Number(i.value); });
    try { await api('/api/admin/ax/grades/settings', { method: 'PUT', body: JSON.stringify({ config: cfg }) }); await grades(root); } catch (e) { msg.textContent = e.message; }
  });
  el.querySelector('[data-reset]').addEventListener('click', async () => {
    try { await api('/api/admin/ax/grades/settings', { method: 'PUT', body: JSON.stringify({ reset: true }) }); await grades(root); } catch (e) { msg.textContent = e.message; }
  });
}
