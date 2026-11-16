// Mow It Tall HQ: To-Do, SEO & AEO (agents, rank tracker, AI answer log), Analytics, Social setup, Build Plan.
// Content comes from /api/admin/todos (worker/playbook.js), so none of it is in the public page.
// Agents run in the browser against the live pages: no AI, no API keys.

import qrcode from 'qrcode-generator';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'just now' : m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
const PRI = { now: 'Do first', soon: 'Soon', later: 'Later' };

export function initHQ({ root, api, show }) {
  const $ = (s) => root.querySelector(s);
  let PB = null, state = {}, custom = [];
  const kvGet = async (k) => (await api(`/api/admin/kv?k=${encodeURIComponent(k)}`)).v;
  const kvSet = (k, v) => api('/api/admin/kv', { method: 'POST', body: JSON.stringify({ k, v }) });

  /* ================================================================ TO-DO */
  let filter = 'open';
  function todoItems() {
    return [...PB.todos, ...custom.map((c) => ({ id: c.id, group: c.grp || 'mine', title: c.title, custom: true, pri: 'soon', who: 'You' }))];
  }
  const isDone = (t) => (state[t.id] ? !!state[t.id].done_at : !!t.done);
  function renderTodos() {
    const items = todoItems();
    const open = items.filter((t) => !isDone(t));
    const nowOpen = open.filter((t) => t.pri === 'now');
    $('[data-badge="todo"]').textContent = nowOpen.length ? `(${nowOpen.length})` : '';
    $('[data-todo-sum]').innerHTML = `<b>${open.length}</b> open · <b>${nowOpen.length}</b> marked “Do first” · <b>${items.length - open.length}</b> done`;
    const groups = [...PB.groups, { id: 'mine', title: 'My Own To-Dos', blurb: 'Things you added here.' }];
    const pass = (t) => filter === 'all' || (filter === 'open' && !isDone(t)) || (filter === 'now' && !isDone(t) && t.pri === 'now') || (filter === 'done' && isDone(t)) || (filter === 'claude' && !isDone(t) && /Claude|Both/.test(t.who || ''));
    $('[data-todo-list]').innerHTML = groups.map((g) => {
      const its = items.filter((t) => t.group === g.id && pass(t));
      if (!its.length) return '';
      const left = items.filter((t) => t.group === g.id && !isDone(t)).length;
      return `<section class="td-group"><h3>${esc(g.title)} <small>${left ? `${left} open` : 'all done'}</small></h3><p class="dash-fine">${esc(g.blurb)}</p>
        <ul class="td-list">${its.map((t) => `
          <li class="td${isDone(t) ? ' is-done' : ''}" data-td="${t.id}">
            <label class="td-check"><input type="checkbox" ${isDone(t) ? 'checked' : ''} data-td-done aria-label="Done: ${esc(t.title)}"></label>
            <details><summary><span class="td-title">${esc(t.title)}</span>
              <span class="td-chips">${t.pri && !isDone(t) ? `<span class="dash-pill td-${t.pri}">${PRI[t.pri]}</span>` : ''}${t.who ? `<span class="dash-pill td-who">${esc(t.who)}</span>` : ''}${t.time ? `<span class="td-time">${esc(t.time)}</span>` : ''}</span></summary>
              <div class="td-body">${t.body || ''}${t.link ? `<p><button type="button" class="linkish" data-go="${t.link}">Open the ${esc(t.link === 'build' ? 'Build Plan' : t.link.toUpperCase() === 'SEO' ? 'SEO & AEO' : t.link[0].toUpperCase() + t.link.slice(1))} tab →</button></p>` : ''}
              ${t.custom ? '<p><button type="button" class="linkish" data-td-remove>Delete this to-do</button></p>' : ''}${state[t.id]?.done_at ? `<p class="dash-fine">Done ${ago(state[t.id].done_at)}</p>` : ''}</div>
            </details>
          </li>`).join('')}</ul></section>`;
    }).join('') || '<p class="hall-msg">Nothing here. Go mow something.</p>';
    // also surface on This Week
    const wk = root.querySelector('[data-check]');
    if (wk && !wk.querySelector('[data-td-week]') && nowOpen.length) wk.insertAdjacentHTML('afterbegin', `<li data-td-week><button type="button" class="linkish" data-go="todo">${nowOpen.length} “Do first” to-dos on your list</button></li>`);
  }
  root.querySelector('[data-todo-filter]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f; root.querySelectorAll('[data-todo-filter] [data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderTodos();
  });
  $('[data-todo-list]').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-td-done]')) return;
    const id = e.target.closest('[data-td]').dataset.td, done = e.target.checked;
    state[id] = { ...(state[id] || {}), done_at: done ? Date.now() : null };
    renderTodos();
    try { await api('/api/admin/todos', { method: 'POST', body: JSON.stringify({ id, done }) }); } catch { e.target.checked = !done; }
  });
  $('[data-todo-list]').addEventListener('click', async (e) => {
    if (e.target.matches('[data-td-remove]')) {
      const id = e.target.closest('[data-td]').dataset.td;
      if (!confirm('Delete this to-do?')) return;
      await api('/api/admin/todos', { method: 'POST', body: JSON.stringify({ action: 'remove', id }) });
      custom = custom.filter((c) => c.id !== id); renderTodos();
    }
  });
  root.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g && g.closest('[data-panel]') && g.closest('[data-panel]').dataset.panel !== 'week') show(g.dataset.go); });
  $('[data-todo-add]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('[data-todo-new]'), title = inp.value.trim(); if (!title) return;
    const r = await api('/api/admin/todos', { method: 'POST', body: JSON.stringify({ action: 'add', title, grp: $('[data-todo-grp]').value }) });
    custom.push({ id: r.id, grp: $('[data-todo-grp]').value, title, created: Date.now() }); inp.value = ''; renderTodos();
  });

  /* ================================================================ AGENTS */
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  const local = (u) => { try { const x = new URL(u, location.origin); return /mowittall\.com$|workers\.dev$|localhost|127\.0\.0\.1/.test(x.hostname) ? x.pathname + x.search : null; } catch { return null; } };
  async function sitemapPaths() {
    const idx = await (await fetch('/sitemap-index.xml', { cache: 'no-store' })).text();
    const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => local(m[1]));
    const out = [];
    for (const m of maps) { const x = await (await fetch(m, { cache: 'no-store' })).text(); out.push(...[...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((mm) => ({ path: new URL(mm[1]).pathname, loc: mm[1] }))); }
    return out;
  }
  async function pool(items, n, fn, onTick) { let i = 0, done = 0; const res = []; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]).catch((err) => ({ error: String(err) })); onTick?.(++done, items.length); } })); return res; }
  const pageCache = new Map();
  async function getPage(path) {
    if (pageCache.has(path)) return pageCache.get(path);
    const r = await fetch(path, { cache: 'no-store' });
    const html = r.ok ? await r.text() : '';
    const v = { status: r.status, html, doc: html ? parse(html) : null };
    pageCache.set(path, v); return v;
  }
  const meta = (d, sel, attr = 'content') => d.querySelector(sel)?.getAttribute(attr) || '';
  const lds = (d) => [...d.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return { __bad: true }; } });
  const ldTypes = (arr) => arr.flatMap((j) => (j['@graph'] || [j]).map((n) => n['@type'])).flat().filter(Boolean);
  const words = (el) => (el?.textContent || '').trim().split(/\s+/).filter(Boolean).length;

  const AGENTS = {
    async page(tick) {
      const urls = await sitemapPaths(); const issues = []; const titles = {}, descs = {};
      await pool(urls, 4, async ({ path, loc }) => {
        const p = await getPage(path); const add = (sev, msg) => issues.push({ path, sev, msg });
        if (p.status !== 200) return add('error', `Page returns ${p.status}`);
        const d = p.doc, title = d.title.trim(), desc = meta(d, 'meta[name="description"]');
        (titles[title] ||= []).push(path); if (desc) (descs[desc] ||= []).push(path);
        if (!title) add('error', 'Missing title'); else if (title.length > 65) add('warn', `Title is ${title.length} characters (Google cuts off around 60)`); else if (title.length < 25) add('warn', `Title is short (${title.length} characters)`);
        if (!desc) add('error', 'Missing meta description'); else if (desc.length > 165) add('warn', `Description is ${desc.length} characters (aim for 120–160)`); else if (desc.length < 70) add('warn', `Description is short (${desc.length} characters)`);
        const h1 = d.querySelectorAll('h1').length; if (h1 !== 1) add(h1 ? 'warn' : 'error', `${h1} H1 headings (should be 1)`);
        const can = meta(d, 'link[rel="canonical"]', 'href'); if (!can) add('error', 'No canonical tag'); else if (can !== loc) add('error', `Canonical (${can}) doesn’t match the sitemap URL`);
        if (/noindex/.test(meta(d, 'meta[name="robots"]'))) add('error', 'In the sitemap but marked noindex');
        if (!meta(d, 'meta[property="og:image"]')) add('warn', 'No share image (og:image)');
        const L = lds(d); if (L.some((j) => j.__bad)) add('error', 'Structured data has a JSON error'); if (!L.length) add('warn', 'No structured data');
        const noAlt = [...d.querySelectorAll('main img')].filter((i) => !i.hasAttribute('alt')).length; if (noAlt) add('warn', `${noAlt} image${noAlt > 1 ? 's' : ''} with no alt text`);
        const main = d.querySelector('main');
        const article = /^\/(blog|guides)\/(?!topic\/)./.test(path);
        const wc = [...(main?.querySelectorAll('article, .guide-answer, .guide-faq, .post-widget') || [])].reduce((s, el) => s + words(el), 0);
        if (article && wc < 250) add('warn', `Only ${wc} words (article + tool + FAQ). Thin pages rank poorly; add a section or FAQ.`);
        const inLinks = [...(main?.querySelectorAll('article a[href^="/"], .page-head a[href^="/"], p a[href^="/"], li a[href^="/"]') || [])].filter((a) => !a.closest('.related, .crumbs, .post-topics')).length;
        if (inLinks < 3) add(article ? 'warn' : 'info', `Only ${inLinks} links to other pages inside the content`);
      }, tick);
      for (const [t, ps] of Object.entries(titles)) if (ps.length > 1) issues.push({ path: ps.join(', '), sev: 'warn', msg: `Same title on ${ps.length} pages: “${t}”` });
      for (const [t, ps] of Object.entries(descs)) if (ps.length > 1) issues.push({ path: ps.join(', '), sev: 'warn', msg: `Same description on ${ps.length} pages` });
      return { checked: urls.length, issues };
    },
    async links(tick) {
      const urls = await sitemapPaths(); const inbound = {}; const targets = new Map();
      await pool(urls, 4, async ({ path }) => {
        const p = await getPage(path); if (!p.doc) return;
        for (const a of p.doc.querySelectorAll('a[href]')) {
          const l = local(a.getAttribute('href')); if (!l || l.startsWith('/api/') || /^\/(admin|og)\//.test(l)) continue;
          const clean = l.split('#')[0].split('?')[0]; if (!clean) continue;
          if (!targets.has(clean)) targets.set(clean, new Set()); targets.get(clean).add(path);
          if (clean !== path) (inbound[clean] ||= new Set()).add(path);
        }
      }, (d, t) => tick(d, t * 2));
      const issues = []; const list = [...targets.keys()];
      await pool(list, 6, async (t) => {
        const r = await fetch(t, { redirect: 'manual', cache: 'no-store' });
        const from = [...targets.get(t)].slice(0, 3).join(', ');
        if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) issues.push({ path: t, sev: 'warn', msg: `Redirects. Linked from ${from}. Point those links at the final address.` });
        else if (r.status >= 400) issues.push({ path: t, sev: 'error', msg: `Broken (${r.status}). Linked from ${from}` });
      }, (d) => tick(urls.length + d, urls.length + list.length));
      for (const { path } of urls) if (path !== '/' && !inbound[path]) issues.push({ path, sev: 'warn', msg: 'Orphan: no other page links here' });
      for (const { path } of urls) if (path !== '/' && inbound[path] && inbound[path].size < 3 && /^\/(guides|blog)\/./.test(path)) issues.push({ path, sev: 'info', msg: `Only ${inbound[path].size} page${inbound[path].size > 1 ? 's link' : ' links'} here (aim for 3+)` });
      return { checked: list.length, issues, note: `${urls.length} pages scanned, ${list.length} unique internal links checked` };
    },
    async sitemap(tick) {
      const urls = await sitemapPaths(); tick(1, 3); const issues = [];
      const prev = (await kvGet('agent:sitemap-urls')) || [];
      const now = urls.map((u) => u.path);
      const added = now.filter((p) => !prev.includes(p)), removed = prev.filter((p) => !now.includes(p));
      if (prev.length) { added.forEach((p) => issues.push({ path: p, sev: 'info', msg: 'New in the sitemap since last run' })); removed.forEach((p) => issues.push({ path: p, sev: 'warn', msg: 'Removed from the sitemap since last run (redirect it if it had traffic)' })); }
      urls.filter((u) => !u.path.endsWith('/')).forEach((u) => issues.push({ path: u.path, sev: 'warn', msg: 'No trailing slash (will redirect)' }));
      const robots = await (await fetch('/robots.txt', { cache: 'no-store' })).text(); tick(2, 3);
      if (!/Sitemap:\s*https:\/\/mowittall\.com\/sitemap-index\.xml/i.test(robots)) issues.push({ path: '/robots.txt', sev: 'error', msg: 'Doesn’t point to the sitemap' });
      if (/^Disallow:\s*\/\s*$/m.test(robots)) issues.push({ path: '/robots.txt', sev: 'error', msg: 'Blocks the whole site (Disallow: /)' });
      if (/GPTBot|ClaudeBot|PerplexityBot|OAI-SearchBot|Google-Extended/i.test(robots)) issues.push({ path: '/robots.txt', sev: 'warn', msg: 'Mentions AI crawlers. Check you aren’t blocking AI search (Cloudflare AI Crawl Control can add these)' });
      const llms = await fetch('/llms.txt', { cache: 'no-store' }); if (!llms.ok) issues.push({ path: '/llms.txt', sev: 'warn', msg: 'Missing' });
      const sm = await (await fetch('/sitemap-0.xml', { cache: 'no-store' })).text(); tick(3, 3);
      const mods = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].slice(0, 10)).sort();
      await kvSet('agent:sitemap-urls', now);
      return { checked: urls.length, issues, note: `${urls.length} URLs in the sitemap${prev.length ? ` (${added.length} added, ${removed.length} removed since last run)` : ' (first run: saved as the baseline)'}${mods.length ? `. Newest lastmod: ${mods.at(-1)}` : ''}. In Search Console → Sitemaps, “Discovered pages” should be close to this number.` };
    },
    async share(tick) {
      const urls = await sitemapPaths(); const issues = [];
      await pool(urls, 4, async ({ path }) => {
        const p = await getPage(path); if (!p.doc) return; const d = p.doc; const add = (sev, msg) => issues.push({ path, sev, msg });
        const img = meta(d, 'meta[property="og:image"]'); if (!img) return add('error', 'No og:image');
        ['og:title', 'og:description', 'og:url'].forEach((k) => { if (!meta(d, `meta[property="${k}"]`)) add('warn', `No ${k}`); });
        if (!meta(d, 'meta[name="twitter:card"]')) add('warn', 'No twitter:card');
        const src = local(img) || img;
        const dims = await new Promise((res) => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res(null); im.src = src; });
        if (!dims) add('error', `Share image doesn’t load (${img})`);
        else if (dims[0] < 1200 || dims[1] < 600) add('warn', `Share image is ${dims[0]}×${dims[1]} (1200×630 looks best)`);
        else if (!/\.png$|\.jpe?g$/.test(img)) add('info', 'Share image is WebP; a few apps (older Outlook, some SMS) prefer PNG/JPG');
      }, tick);
      return { checked: urls.length, issues };
    },
    async aeo(tick) {
      const urls = (await sitemapPaths()).filter((u) => /^\/(blog|guides)\/[^/]+\/$/.test(u.path) && !u.path.startsWith('/blog/topic/')); const issues = [];
      await pool(urls, 4, async ({ path }) => {
        const p = await getPage(path); if (!p.doc) return; const d = p.doc; const add = (sev, msg) => issues.push({ path, sev, msg });
        const first = d.querySelector('article.prose > p'); const answerBox = d.querySelector('.guide-answer');
        if (!answerBox && !(first && first.querySelector('strong, b'))) add('warn', 'No answer-first opening (bold one-sentence answer at the top)');
        const L = lds(d), types = ldTypes(L);
        if (!types.includes('FAQPage')) add('warn', 'No FAQ structured data (add a faq: list to the frontmatter)');
        if (!types.some((t) => /Article|BlogPosting/.test(t))) add('error', 'No Article/BlogPosting structured data');
        const qs = [...d.querySelectorAll('article.prose h2')].filter((h) => /\?$/.test(h.textContent.trim())).length;
        if (!qs && path.startsWith('/guides/')) add('info', 'No question-style headings (“How often…?”)');
        if (!d.querySelector('article.prose table') && path.startsWith('/guides/')) add('info', 'No table (quick-fact tables get quoted a lot)');
        if (path.startsWith('/guides/') && !d.querySelector('.guide-sources')) add('info', 'No sources listed');
        if (!meta(d, 'meta[property="article:modified_time"]')) add('info', 'No modified date');
      }, tick);
      return { checked: urls.length, issues };
    },
  };
  const AGENT_NAMES = { page: 'Page Check', links: 'Link Check', sitemap: 'Sitemap Watch', share: 'Share Card Check', aeo: 'AEO Readiness' };
  function renderAgent(name, r) {
    const box = $(`[data-agent-out="${name}"]`); if (!r) { box.innerHTML = '<p class="dash-fine">Not run yet.</p>'; return; }
    const n = (s) => r.issues.filter((i) => i.sev === s).length;
    const sorted = [...r.issues].sort((a, b) => ['error', 'warn', 'info'].indexOf(a.sev) - ['error', 'warn', 'info'].indexOf(b.sev));
    const extra = name === 'page' ? '<p class="dash-fine">Speed: <a href="https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fmowittall.com%2F&form_factor=mobile" target="_blank" rel="noopener">PageSpeed for the homepage</a> (swap in any URL).</p>' : '';
    box.innerHTML = `<p class="ag-sum"><span class="ag-n ag-error">${n('error')} errors</span><span class="ag-n ag-warn">${n('warn')} warnings</span><span class="ag-n ag-info">${n('info')} notes</span> <small>${r.checked} checked · ${ago(r.at)}</small></p>
      ${r.note ? `<p class="dash-fine">${esc(r.note)}</p>` : ''}${extra}
      ${sorted.length ? `<ul class="ag-list">${sorted.slice(0, 300).map((i) => `<li class="ag-${i.sev}"><a href="${esc(i.path.split(',')[0])}" target="_blank" rel="noopener">${esc(i.path)}</a><span>${esc(i.msg)}</span></li>`).join('')}</ul>${sorted.length > 300 ? `<p class="dash-fine">…and ${sorted.length - 300} more.</p>` : ''}` : '<p class="hall-msg">All clear. Nice.</p>'}`;
  }
  root.querySelector('[data-agents]').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-run]'); if (!b) return;
    const name = b.dataset.run; b.disabled = true; const label = b.textContent; pageCache.clear();
    const out = $(`[data-agent-out="${name}"]`);
    try {
      const r = await AGENTS[name]((d, t) => { b.textContent = `Running… ${d}/${t}`; });
      r.at = Date.now(); renderAgent(name, r);
      await kvSet(`agent:${name}`, { ...r, issues: r.issues.slice(0, 1500) });
    } catch (err) { out.innerHTML = `<p class="hall-msg">Couldn’t run: ${esc(err.message || err)}. (Agents read the live site; run them on mowittall.com.)</p>`; }
    b.disabled = false; b.textContent = label;
  });

  /* ================================================================ RANK TRACKER */
  async function unzip(buf) {
    const v = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('That doesn’t look like a zip file.');
    const count = v.getUint16(e + 10, true); let off = v.getUint32(e + 16, true); const files = {};
    for (let k = 0; k < count; k++) {
      const method = v.getUint16(off + 10, true), csize = v.getUint32(off + 20, true), nlen = v.getUint16(off + 28, true), xlen = v.getUint16(off + 30, true), clen = v.getUint16(off + 32, true), lho = v.getUint32(off + 42, true);
      const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
      const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + csize);
      files[name] = method === 0 ? new TextDecoder().decode(data) : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      off += 46 + nlen + xlen + clen;
    }
    return files;
  }
  function csv(text) {
    const rows = []; let row = [], f = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const num = (s) => { const x = parseFloat(String(s).replace(/[,%\s]/g, '')); return Number.isFinite(x) ? x : 0; };
  function toRows(table) {
    const h = table[0].map((x) => x.toLowerCase());
    const col = (re) => h.findIndex((x) => re.test(x));
    const key = col(/quer|keyword|page|url/), cl = col(/click/), im = col(/impr/), ct = col(/ctr/), po = col(/position/);
    if (key < 0 || cl < 0) return null;
    const kind = /page|url/.test(h[key]) ? 'pages' : 'queries';
    const rows = table.slice(1).map((r) => {
      const k = kind === 'pages' ? (local(r[key]) || r[key]) : r[key].trim().toLowerCase();
      const c = num(r[cl]), i = im >= 0 ? num(r[im]) : 0;
      return { k, c, i, ctr: ct >= 0 ? num(r[ct]) / (String(r[ct]).includes('%') ? 100 : 1) : (i ? c / i : 0), p: po >= 0 ? num(r[po]) : 0 };
    }).filter((r) => r.k);
    return { kind, rows };
  }
  async function upload(file) {
    const msg = $('[data-rank-msg]'); msg.textContent = 'Reading…';
    try {
      let tables = [], label = file.name.replace(/\.(zip|csv)$/i, '');
      if (/\.zip$/i.test(file.name)) {
        const files = await unzip(await file.arrayBuffer());
        for (const [n, t] of Object.entries(files)) {
          if (/filters/i.test(n)) { const f = csv(t); const d = f.find((r) => /date/i.test(r[0])); if (d) label = `${d[1]} (exported ${new Date().toLocaleDateString()})`; }
          if (/quer|page/i.test(n)) tables.push(csv(t));
        }
      } else tables.push(csv(await file.text()));
      const source = /bing/i.test(file.name) || tables.some((t) => /keyword/i.test(t[0].join())) ? 'bing' : 'gsc';
      let saved = 0;
      for (const t of tables) { const r = toRows(t); if (!r || !r.rows.length) continue; await api('/api/admin/snaps', { method: 'POST', body: JSON.stringify({ source, label, kind: r.kind, rows: r.rows }) }); saved++; }
      msg.textContent = saved ? `Saved ${saved} table${saved > 1 ? 's' : ''}.` : 'Couldn’t find a Queries or Pages table in that file.';
      await loadRank();
    } catch (err) { msg.textContent = err.message || 'Couldn’t read that file.'; }
  }
  $('[data-rank-file]').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) upload(f); e.target.value = ''; });
  const EXPECT = (p) => (p <= 1.5 ? 0.25 : p <= 2.5 ? 0.14 : p <= 3.5 ? 0.09 : p <= 5 ? 0.06 : p <= 10 ? 0.03 : 0.01);
  const tbl = (rows, cols) => rows.length ? `<div class="rk-scroll"><table class="pb-table rk"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="dash-fine">None this time.</p>';
  const pos = (x) => (x ? x.toFixed(1) : '–'), pct = (x) => `${(x * 100).toFixed(1)}%`;
  const arrow = (d) => (d > 0 ? `<b class="rk-up">▲ ${d.toFixed(1)}</b>` : `<b class="rk-down">▼ ${(-d).toFixed(1)}</b>`);
  async function compare(kind, source) {
    const list = snaps.filter((s) => s.kind === kind && s.source === source);
    if (!list.length) return '';
    const [a, b] = await Promise.all(list.slice(0, 2).map((s) => api(`/api/admin/snaps?id=${s.id}`).then((r) => r.snap)));
    const now = new Map(a.rows.map((r) => [r.k, r])), was = b ? new Map(b.rows.map((r) => [r.k, r])) : new Map();
    const both = a.rows.filter((r) => was.has(r.k)).map((r) => ({ ...r, prev: was.get(r.k), d: was.get(r.k).p - r.p, dc: r.c - was.get(r.k).c }));
    const label = kind === 'pages' ? 'Page' : 'Search';
    const keyCell = (r) => (kind === 'pages' ? `<a href="${esc(r.k)}" target="_blank" rel="noopener">${esc(r.k)}</a>` : esc(r.k));
    const tot = (rs) => rs.reduce((s, r) => s + r.c, 0), totI = (rs) => rs.reduce((s, r) => s + r.i, 0);
    let html = `<h4>${source === 'bing' ? 'Bing' : 'Google'}: ${kind === 'pages' ? 'Pages' : 'Searches'}</h4>
      <p class="dash-fine">Latest: ${esc(a.label || '')} (${ago(a.at)}) · ${a.rows.length} rows · ${tot(a.rows)} clicks · ${totI(a.rows)} impressions${b ? ` · vs ${esc(b.label || '')}: ${tot(b.rows)} clicks, ${totI(b.rows)} impressions` : ' · upload another export next week to see changes'}</p>`;
    if (b) {
      const up = both.filter((r) => r.d >= 3 && r.i >= 10).sort((x, y) => y.d - x.d).slice(0, 15);
      const down = both.filter((r) => r.d <= -3 && r.i >= 10).sort((x, y) => x.d - y.d).slice(0, 15);
      const fresh = a.rows.filter((r) => !was.has(r.k) && r.i >= 5).sort((x, y) => y.i - x.i).slice(0, 15);
      const lost = b.rows.filter((r) => !now.has(r.k) && (r.c > 0 || r.i >= 20)).sort((x, y) => y.i - x.i).slice(0, 15);
      html += `<details class="dash-more" open><summary>Climbing (${up.length})</summary>${tbl(up, [[label, keyCell], ['Position', (r) => `${pos(r.p)} ${arrow(r.d)}`], ['Clicks', (r) => r.c], ['Impr.', (r) => r.i]])}</details>
        <details class="dash-more" ${down.length ? 'open' : ''}><summary>Slipping (${down.length})</summary>${tbl(down, [[label, keyCell], ['Position', (r) => `${pos(r.p)} ${arrow(r.d)}`], ['Clicks', (r) => r.c], ['Impr.', (r) => r.i]])}
          <p class="dash-fine">Fix: open the page, make sure the Short Answer still answers this exact search, freshen anything dated, add 2–3 links to it from related posts, and check Search Console → URL Inspection for problems.</p></details>
        <details class="dash-more"><summary>New (${fresh.length})</summary>${tbl(fresh, [[label, keyCell], ['Position', (r) => pos(r.p)], ['Impr.', (r) => r.i]])}</details>
        <details class="dash-more"><summary>Lost (${lost.length})</summary>${tbl(lost, [[label, keyCell], ['Was at', (r) => pos(r.p)], ['Impr. before', (r) => r.i]])}</details>`;
    }
    const striking = a.rows.filter((r) => r.p >= 5 && r.p <= 20 && r.i >= 15).sort((x, y) => y.i - x.i).slice(0, 15);
    const lowctr = a.rows.filter((r) => r.i >= 40 && r.p <= 10 && r.ctr < EXPECT(r.p) * 0.5).sort((x, y) => y.i - x.i).slice(0, 15);
    html += `<details class="dash-more" open><summary>Striking distance (${striking.length})</summary>${tbl(striking, [[label, keyCell], ['Position', (r) => pos(r.p)], ['Impr.', (r) => r.i], ['Clicks', (r) => r.c]])}
      <p class="dash-fine">${kind === 'pages' ? 'These pages sit just off page one. Add a section or FAQ for their top searches, link to them from 2–3 related posts and the guides, and freshen the Short Answer.' : 'You’re close on these. Make sure one page clearly answers each search (in a heading and the first lines), link to it from related posts, and add the exact question to its FAQ. No page for it yet? That’s your next guide.'}</p></details>
      <details class="dash-more"><summary>Low click rate (${lowctr.length})</summary>${tbl(lowctr, [[label, keyCell], ['Position', (r) => pos(r.p)], ['CTR', (r) => pct(r.ctr)], ['Expected', (r) => `~${pct(EXPECT(r.p))}`], ['Impr.', (r) => r.i]])}
      <p class="dash-fine">People see you but don’t click. Rewrite the page’s seoTitle (put the search words first, add a hook) and seoDescription (answer + reason to click). Send me the list and I’ll draft new ones.</p></details>`;
    if (kind === 'pages' && b) {
      const watch = both.filter((r) => (r.prev.c >= 5 && r.c <= r.prev.c * 0.7) || r.d <= -2).sort((x, y) => x.dc - y.dc).slice(0, 15);
      html += `<details class="dash-more" open><summary>Pages to watch (${watch.length})</summary>${tbl(watch, [['Page', keyCell], ['Clicks', (r) => `${r.c} <small>(was ${r.prev.c})</small>`], ['Position', (r) => `${pos(r.p)} ${arrow(r.d)}`]])}
        <p class="dash-fine">Losing clicks or position. Check it still loads fast and answers the search, and whether a newer page of yours is competing for the same search.</p></details>`;
    }
    return html;
  }
  let snaps = [];
  async function loadRank() {
    snaps = (await api('/api/admin/snaps')).snaps;
    const out = $('[data-rank-out]');
    if (!snaps.length) { out.innerHTML = '<p class="dash-fine">No uploads yet. Export from Search Console and drop the zip above.</p>'; return; }
    out.innerHTML = '<p class="dash-fine">Comparing…</p>';
    const parts = await Promise.all([['queries', 'gsc'], ['pages', 'gsc'], ['queries', 'bing'], ['pages', 'bing']].map(([k, s]) => compare(k, s)));
    out.innerHTML = parts.join('') + `<details class="dash-more"><summary>All uploads (${snaps.length})</summary><ul class="dash-log">${snaps.map((s) => `<li>${s.source === 'bing' ? 'Bing' : 'Google'} ${s.kind} · ${esc(s.label || '')} · ${ago(s.at)} <button type="button" class="linkish" data-snap-del="${s.id}">Delete</button></li>`).join('')}</ul></details>`;
  }
  $('[data-rank-out]').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-snap-del]'); if (!d || !confirm('Delete this upload?')) return;
    await api('/api/admin/snaps', { method: 'POST', body: JSON.stringify({ action: 'delete', id: d.dataset.snapDel }) }); loadRank();
  });

  /* ================================================================ AI ANSWER LOG */
  const ENGINES = [
    ['google', 'Google', (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`],
    ['chatgpt', 'ChatGPT', (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}&hints=search`],
    ['perplexity', 'Perplexity', (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`],
    ['copilot', 'Copilot', (q) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}`],
    ['claude', 'Claude', (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`],
  ];
  const month = () => new Date().toISOString().slice(0, 7);
  let aeoLog = {}, aeoQs = [], aeoPrev = null;
  async function loadAeo() {
    aeoQs = (await kvGet('aeo:questions')) || PB.guides.aeoQuestions;
    aeoLog = (await kvGet(`aeo:${month()}`)) || {};
    const d = new Date(); d.setMonth(d.getMonth() - 1); aeoPrev = await kvGet(`aeo:${d.toISOString().slice(0, 7)}`);
    renderAeo();
  }
  function renderAeo() {
    const cited = Object.values(aeoLog).flatMap((r) => Object.values(r)).filter((v) => v === 'yes').length;
    const prevC = aeoPrev ? Object.values(aeoPrev).flatMap((r) => Object.values(r)).filter((v) => v === 'yes').length : null;
    $('[data-aeo-sum]').innerHTML = `${month()}: cited <b>${cited}</b> times across ${aeoQs.length} questions × ${ENGINES.length} engines${prevC !== null ? ` (last month: ${prevC})` : ''}. Tap an engine to ask, then tap the mark: blank → ✓ cited → ✗ not cited.`;
    $('[data-aeo]').innerHTML = aeoQs.map((q, i) => `<li data-q="${i}"><p class="aeo-q">${esc(q)} <button type="button" class="linkish" data-aeo-del aria-label="Remove question">×</button></p>
      <p class="aeo-row">${ENGINES.map(([id, name, href]) => { const v = aeoLog[q]?.[id]; return `<span class="aeo-cell"><a href="${href(q)}" target="_blank" rel="noopener">${name}</a><button type="button" class="aeo-mark aeo-${v || 'none'}" data-aeo-mark="${id}" aria-label="${name}: ${v || 'not checked'}">${v === 'yes' ? '✓' : v === 'no' ? '✗' : '·'}</button></span>`; }).join('')}</p></li>`).join('');
  }
  $('[data-aeo]').addEventListener('click', async (e) => {
    const li = e.target.closest('[data-q]'); if (!li) return; const q = aeoQs[+li.dataset.q];
    const m = e.target.closest('[data-aeo-mark]');
    if (m) { const id = m.dataset.aeoMark, cur = aeoLog[q]?.[id]; (aeoLog[q] ||= {})[id] = cur === 'yes' ? 'no' : cur === 'no' ? undefined : 'yes'; renderAeo(); await kvSet(`aeo:${month()}`, aeoLog); }
    if (e.target.matches('[data-aeo-del]')) { aeoQs = aeoQs.filter((x) => x !== q); renderAeo(); await kvSet('aeo:questions', aeoQs); }
  });
  $('[data-aeo-add]').addEventListener('submit', async (e) => { e.preventDefault(); const i = $('[data-aeo-new]'); const v = i.value.trim(); if (!v) return; aeoQs.push(v); i.value = ''; renderAeo(); await kvSet('aeo:questions', aeoQs); });

  /* ================================================================ static guide sections */
  function renderGuides() {
    const G = PB.guides;
    $('[data-pb="seoRoutine"]').innerHTML = G.seoRoutine;
    $('[data-pb="seoLinks"]').innerHTML = `<ul class="pb-links">${G.seoLinks.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul><p class="dash-fine">${G.seoNote}</p>`;
    $('[data-pb="agents"]').innerHTML = G.agents;
    $('[data-pb="rankHow"]').innerHTML = G.rankHow;
    $('[data-pb="movePages"]').innerHTML = G.movePages;
    $('[data-pb="aeo"]').innerHTML = G.aeo;
    $('[data-pb="ga4Events"]').innerHTML = `<p class="dash-fine">${G.ga4Page}</p><div class="rk-scroll"><table class="pb-table"><thead><tr><th>Event</th><th>When it fires</th><th>Parameters</th></tr></thead><tbody>${G.ga4Events.map(([n, w, p]) => (!w ? `<tr class="pb-sec"><td colspan="3">${n.replace(/—/g, '').trim()}</td></tr>` : `<tr><td><code>${n}</code></td><td>${w}</td><td><code>${p}</code></td></tr>`)).join('')}</tbody></table></div>`;
    $('[data-pb="ga4Steps"]').innerHTML = G.ga4Steps.replace('{{PARAMS}}', G.ga4Params.join(', ')).replace('{{DIMS}}', G.ga4Dims.join(', ')).replace('{{METRICS}}', G.ga4Metrics.join(', '));
    $('[data-pb="utm"]').innerHTML = G.utm;
    $('[data-pb="looker"]').innerHTML = G.looker;
    $('[data-pb="socialSetup"]').innerHTML = G.socialSetup;
    $('[data-pb="app"]').innerHTML = G.app;
    $('[data-pb="products"]').innerHTML = G.products;
    // mini to-do lists on other tabs
    root.querySelectorAll('[data-mini]').forEach((el) => {
      const groups = el.dataset.mini.split(',');
      const its = todoItems().filter((t) => groups.includes(t.group));
      el.innerHTML = `<ul class="td-mini">${its.map((t) => `<li class="${isDone(t) ? 'is-done' : ''}">${isDone(t) ? '✓' : '○'} ${esc(t.title)}</li>`).join('')}</ul><p><button type="button" class="linkish" data-go="todo">Check these off on the To-Do tab →</button></p>`;
    });
  }

  /* ================================================================ GTM import file */
  function gtmFile(gid) {
    const T = (key, value) => ({ type: 'TEMPLATE', key, value });
    const names = ['page_type', 'content_group', 'post_tag', 'post_topics', 'published', ...PB.guides.ga4Params];
    let id = 10;
    const variable = [
      { accountId: '0', containerId: '0', variableId: String(id++), name: 'Const - GA4 Measurement ID', type: 'c', parameter: [T('value', gid)] },
      ...names.map((n) => ({ accountId: '0', containerId: '0', variableId: String(id++), name: `DLV - ${n}`, type: 'v', parameter: [{ type: 'INTEGER', key: 'dataLayerVersion', value: '2' }, { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' }, T('name', n)] })),
    ];
    const trigger = [{ accountId: '0', containerId: '0', triggerId: '2', name: 'CE - Mow It Tall events', type: 'CUSTOM_EVENT',
      customEventFilter: [{ type: 'MATCH_REGEX', parameter: [T('arg0', '{{_event}}'), T('arg1', '.*')] }],
      filter: [{ type: 'STARTS_WITH', parameter: [T('arg0', '{{Event}}'), T('arg1', 'gtm.'), { type: 'BOOLEAN', key: 'negate', value: 'true' }] }] }];
    const params = ['page_type', 'post_tag', 'post_topics', ...PB.guides.ga4Params];
    const tag = [{ accountId: '0', containerId: '0', tagId: '3', name: 'GA4 - Event - Mow It Tall (all site events)', type: 'gaawe',
      parameter: [{ type: 'BOOLEAN', key: 'sendEcommerceData', value: 'false' }, T('eventName', '{{Event}}'), T('measurementIdOverride', '{{Const - GA4 Measurement ID}}'),
        { type: 'LIST', key: 'eventSettingsTable', list: params.map((n) => ({ type: 'MAP', map: [T('parameter', n), T('parameterValue', `{{DLV - ${n}}}`)] })) }],
      firingTriggerId: ['2'], tagFiringOption: 'ONCE_PER_EVENT' }];
    // GTM's importer needs a full-looking export: real-style numeric ids, a container block with usageContext, and fingerprints.
    const A = '6000000000', C = '200000000', fp = String(Date.now());
    const fix = (o) => ({ ...o, accountId: A, containerId: C, fingerprint: fp });
    return { exportFormatVersion: 2, exportTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      containerVersion: { path: `accounts/${A}/containers/${C}/versions/0`, accountId: A, containerId: C, containerVersionId: '0', fingerprint: fp,
        container: { path: `accounts/${A}/containers/${C}`, accountId: A, containerId: C, name: 'Mow It Tall events', publicId: 'GTM-PTSGH8QX', usageContext: ['WEB'], fingerprint: fp, tagManagerUrl: 'https://tagmanager.google.com/' },
        tag: tag.map(fix), trigger: trigger.map(fix), variable: variable.map(fix),
        builtInVariable: [{ accountId: A, containerId: C, type: 'EVENT', name: 'Event' }] } };
  }
  $('[data-gtm-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const gid = $('[data-gtm-id]').value.trim().toUpperCase();
    const blob = new Blob([JSON.stringify(gtmFile(gid), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mowittall-gtm-ga4-events.json'; a.click();
  });

  /* ================================================================ settings: Looker + profile links */
  const PLATS = ['instagram', 'facebook', 'youtube', 'tiktok', 'x', 'threads', 'pinterest', 'reddit', 'nextdoor', 'bluesky', 'linkedin'];
  async function loadSettings() {
    const looker = await kvGet('looker-url');
    const inp = $('[data-looker-url]'); inp.value = looker || '';
    const paint = (u) => { $('[data-looker]').innerHTML = u ? `<iframe src="${esc(u)}" title="Looker Studio report" loading="lazy" allowfullscreen sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>` : '<p class="dash-fine">Paste your Looker Studio embed URL above (File → Embed report → Embed URL).</p>'; };
    paint(looker);
    $('[data-looker-form]').onsubmit = async (e) => { e.preventDefault(); const u = inp.value.trim(); if (u && !/^https:\/\/lookerstudio\.google\.com\/(embed\/)?reporting\//.test(u)) { alert('That should start with https://lookerstudio.google.com/embed/reporting/…'); return; } await kvSet('looker-url', u); paint(u); };
    const prof = (await kvGet('social-profiles')) || {};
    $('[data-profiles]').innerHTML = PLATS.map((p) => `<label class="hall-field"><span>${p[0].toUpperCase() + p.slice(1)}</span><input type="url" placeholder="https://…" value="${esc(prof[p] || '')}" data-prof="${p}"></label>`).join('');
    $('[data-profiles-form]').onsubmit = async (e) => {
      e.preventDefault(); const v = {}; root.querySelectorAll('[data-prof]').forEach((i) => { if (i.value.trim()) v[i.dataset.prof] = i.value.trim(); });
      await kvSet('social-profiles', v);
      const text = `Add my social profiles to the site:\n${Object.entries(v).map(([k, u]) => `${k}: ${u}`).join('\n')}`;
      try { await navigator.clipboard.writeText(text); $('[data-prof-msg]').textContent = 'Saved, and copied a message for Claude to your clipboard. Paste it into our chat.'; } catch { $('[data-prof-msg]').textContent = 'Saved. Send these links to Claude.'; }
    };
  }

  /* ================================================================ SHORT LINKS */
  const ORIGIN = 'https://mowittall.com';
  const STARTER = [
    ['quiz', '/plan/', 'The quiz'], ['water', '/resources/#water-h', 'Should I water?'], ['seed', '/resources/#seed', 'Can I seed now?'],
    ['calc', '/resources/#calc', 'Lawn calculator'], ['help', '/resources/#dx', 'What’s wrong with my lawn?'], ['weeds', '/weeds/', 'Weed ID'],
    ['bio', '/links/?utm_source=bio&utm_medium=social', 'Generic bio link'], ['door', '/plan/?utm_source=door_note&utm_medium=qr', 'Door-note QR code'],
    ['vote', '/hall/', 'Hall of Fame'], ['calendar', '/calendar/', 'Lawn calendar'],
  ];
  let links = [];
  const slForm = $('[data-sl-form]');
  function qrSvg(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
  function renderLinks() {
    $('[data-sl-list]').innerHTML = links.length ? links.map((l) => `<li class="sl-item" data-sl="${esc(l.slug)}">
      <p class="sl-short"><b>mowittall.com/${esc(l.slug)}</b>${l.permanent ? ' <span class="dash-pill">301</span>' : ''}</p>
      <p class="sl-to">→ <a href="${esc(l.target)}" target="_blank" rel="noopener">${esc(l.target)}</a></p>
      ${l.note ? `<p class="dash-fine">${esc(l.note)}</p>` : ''}
      <p class="dash-fine">${l.clicks} click${l.clicks === 1 ? '' : 's'}${l.last_click ? ` · last ${ago(l.last_click)}` : ''}</p>
      <p class="sl-btns"><button type="button" class="btn btn-small" data-sl-copy>Copy</button><button type="button" class="btn btn-small btn-quiet" data-sl-edit>Edit</button><button type="button" class="btn btn-small btn-quiet" data-sl-qr>QR Code</button><button type="button" class="btn btn-small btn-quiet" data-sl-del>Delete</button></p>
      <div class="sl-qr" hidden></div></li>`).join('') : '<li class="hall-msg">No short links yet. Make one above, or add the starter set.</li>';
  }
  async function loadLinks() { links = (await api('/api/admin/links')).links; renderLinks(); }
  function resetForm() { slForm.reset(); $('[data-sl-old]').value = ''; $('[data-sl-cancel]').hidden = true; $('[data-sl-save]').textContent = 'Save Short Link'; }
  slForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = $('[data-sl-msg]');
    const old = $('[data-sl-old]').value;
    try {
      await api('/api/admin/links', { method: 'POST', body: JSON.stringify({ action: old ? 'update' : 'create', oldSlug: old || undefined, slug: $('[data-sl-slug]').value, target: $('[data-sl-target]').value, note: $('[data-sl-note]').value, permanent: $('[data-sl-perm]').checked }) });
      msg.textContent = 'Saved. Live within a minute.'; resetForm(); loadLinks();
    } catch (err) { msg.textContent = err.message; }
  });
  $('[data-sl-cancel]').addEventListener('click', resetForm);
  $('[data-sl-starter]').addEventListener('click', async () => {
    const have = new Set(links.map((l) => l.slug)); let n = 0;
    for (const [slug, target, note] of STARTER) if (!have.has(slug)) { try { await api('/api/admin/links', { method: 'POST', body: JSON.stringify({ action: 'create', slug, target, note }) }); n++; } catch { /* skip */ } }
    $('[data-sl-msg]').textContent = n ? `Added ${n} short links.` : 'You already have them all.'; loadLinks();
  });
  $('[data-sl-list]').addEventListener('click', async (e) => {
    const li = e.target.closest('[data-sl]'); if (!li) return; const l = links.find((x) => x.slug === li.dataset.sl); const full = `${ORIGIN}/${l.slug}`;
    if (e.target.matches('[data-sl-copy]')) { try { await navigator.clipboard.writeText(full); e.target.textContent = 'Copied!'; setTimeout(() => (e.target.textContent = 'Copy'), 1500); } catch { prompt('Copy this:', full); } }
    if (e.target.matches('[data-sl-edit]')) {
      $('[data-sl-old]').value = l.slug; $('[data-sl-slug]').value = l.slug; $('[data-sl-target]').value = l.target; $('[data-sl-note]').value = l.note || ''; $('[data-sl-perm]').checked = !!l.permanent;
      $('[data-sl-cancel]').hidden = false; $('[data-sl-save]').textContent = 'Save Changes'; slForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (e.target.matches('[data-sl-del]') && confirm(`Delete mowittall.com/${l.slug}? Anyone using it will land on a 404.`)) { await api('/api/admin/links', { method: 'POST', body: JSON.stringify({ action: 'delete', slug: l.slug }) }); loadLinks(); }
    if (e.target.matches('[data-sl-qr]')) {
      const box = li.querySelector('.sl-qr'); box.hidden = !box.hidden;
      if (!box.hidden && !box.innerHTML) {
        const svg = qrSvg(full);
        box.innerHTML = `${svg}<p><a download="mowittall-${esc(l.slug)}-qr.svg" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">Download QR (SVG, prints sharp at any size)</a></p>`;
      }
    }
  });

  /* ================================================================ boot */
  (async () => {
    try {
      const r = await api('/api/admin/todos');
      PB = r.playbook; custom = r.custom; state = Object.fromEntries(r.state.map((s) => [s.id, s]));
      renderTodos(); renderGuides();
      for (const n of Object.keys(AGENT_NAMES)) kvGet(`agent:${n}`).then((v) => renderAgent(n, v)).catch(() => {});
      loadRank().catch(() => {}); loadLinks().catch(() => {}); loadAeo().catch(() => {}); loadSettings().catch(() => {});
    } catch (err) { $('[data-todo-list]').innerHTML = `<p class="hall-msg">Couldn’t load the playbook: ${esc(err.message)}</p>`; }
  })();
}
