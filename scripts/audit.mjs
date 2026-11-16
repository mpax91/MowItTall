// SEO audit, run at the end of every build (npm run build). Nov 16, 2026.
//
// The same five checks HQ used to run in the browser (Page Check, Link Check, Sitemap Watch, Share Card
// Check, AEO Readiness), but on the built HTML in dist/, so they run by themselves on every deploy:
// the only time the results can change. No network, no API, no AI.
//
// Output: dist/_audit/report.json. The worker refuses /_audit/* to the public; the hourly job reads it
// through the ASSETS binding, compares it with the last run (new / fixed issues, sitemap added / removed)
// and saves it where HQ shows it (kv agent:<name>).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';

const DIST = 'dist';
const ORIGIN = 'https://mowittall.com';

const read = (p) => readFileSync(join(DIST, p), 'utf8');
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const localPath = (u) => {
  try {
    const x = new URL(u, ORIGIN);
    return /(^|\.)mowittall\.com$/.test(x.hostname) ? x.pathname + x.search : null;
  } catch { return null; }
};

// Where a path lives in dist/: "page" (an HTML page), "file", "slash" (works but redirects to add a
// trailing slash), "redirect" (an Astro redirect page) or null (no such thing: broken, or a short link).
function resolve(path) {
  const clean = decodeURIComponent(path.split('#')[0].split('?')[0]);
  if (clean === '/' || clean === '') return 'page';
  const p = join(DIST, clean);
  if (clean.endsWith('/')) {
    const f = join(p, 'index.html');
    if (!existsSync(f)) return null;
    return /http-equiv="refresh"/i.test(readFileSync(f, 'utf8').slice(0, 2000)) ? 'redirect' : 'page';
  }
  if (existsSync(p) && statSync(p).isFile()) return 'file';
  if (existsSync(join(p, 'index.html'))) return 'slash';
  if (existsSync(p + '.html')) return 'page';
  return null;
}

function pngSize(file) {
  try {
    const b = readFileSync(file);
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  } catch { return null; }
}

// ---------------------------------------------------------------- pages
const sitemapIndex = read('sitemap-index.xml');
const urls = [];
for (const m of locs(sitemapIndex)) {
  const lp = localPath(m);
  if (!lp) continue;
  for (const loc of locs(read(lp.replace(/^\//, '')))) urls.push({ path: new URL(loc).pathname, loc });
}

const pages = new Map();
for (const { path } of urls) {
  const f = path === '/' ? 'index.html' : join(path.replace(/^\//, ''), 'index.html');
  if (!existsSync(join(DIST, f))) { pages.set(path, null); continue; }
  const html = read(f);
  pages.set(path, parseHTML(html).document);
}

const meta = (d, sel, attr = 'content') => d.querySelector(sel)?.getAttribute(attr) || '';
const lds = (d) => [...d.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return { __bad: true }; } });
const ldTypes = (arr) => arr.flatMap((j) => (j['@graph'] || [j]).map((n) => n['@type'])).flat().filter(Boolean);
const words = (el) => (el?.textContent || '').trim().split(/\s+/).filter(Boolean).length;

function pageCheck() {
  const issues = [], titles = {}, descs = {};
  for (const { path, loc } of urls) {
    const d = pages.get(path); const add = (sev, msg) => issues.push({ path, sev, msg });
    if (!d) { add('error', 'In the sitemap but no page was built'); continue; }
    const title = (d.querySelector('title')?.textContent || '').trim(), desc = meta(d, 'meta[name="description"]');
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
  }
  for (const [t, ps] of Object.entries(titles)) if (ps.length > 1) issues.push({ path: ps.join(', '), sev: 'warn', msg: `Same title on ${ps.length} pages: “${t}”` });
  for (const [, ps] of Object.entries(descs)) if (ps.length > 1) issues.push({ path: ps.join(', '), sev: 'warn', msg: `Same description on ${ps.length} pages` });
  return { checked: urls.length, issues };
}

function linkCheck() {
  const inbound = {}, targets = new Map();
  for (const { path } of urls) {
    const d = pages.get(path); if (!d) continue;
    for (const a of d.querySelectorAll('a[href]')) {
      const l = localPath(a.getAttribute('href')); if (!l || l.startsWith('/api/') || /^\/(admin|og)\//.test(l)) continue;
      const clean = l.split('#')[0].split('?')[0]; if (!clean) continue;
      if (!targets.has(clean)) targets.set(clean, new Set()); targets.get(clean).add(path);
      if (clean !== path) (inbound[clean] ||= new Set()).add(path);
    }
  }
  const issues = [];
  for (const [t, from] of targets) {
    const r = resolve(t), f = [...from].slice(0, 3).join(', ');
    // code "missing": the worker re-checks these against the short links table (a short link isn't broken).
    if (r === null) issues.push({ path: t, sev: 'error', code: 'missing', msg: `Broken (no such page). Linked from ${f}` });
    else if (r === 'slash' || r === 'redirect') issues.push({ path: t, sev: 'warn', msg: `Redirects. Linked from ${f}. Point those links at the final address.` });
  }
  for (const { path } of urls) if (path !== '/' && !inbound[path]) issues.push({ path, sev: 'warn', msg: 'Orphan: no other page links here' });
  for (const { path } of urls) if (path !== '/' && inbound[path] && inbound[path].size < 3 && /^\/(guides|blog)\/./.test(path)) issues.push({ path, sev: 'info', msg: `Only ${inbound[path].size} page${inbound[path].size > 1 ? 's link' : ' links'} here (aim for 3+)` });
  return { checked: targets.size, issues, note: `${urls.length} pages scanned, ${targets.size} unique internal links checked` };
}

function sitemapCheck() {
  const issues = [];
  urls.filter((u) => !u.path.endsWith('/')).forEach((u) => issues.push({ path: u.path, sev: 'warn', msg: 'No trailing slash (will redirect)' }));
  const robots = existsSync(join(DIST, 'robots.txt')) ? read('robots.txt') : '';
  if (!/Sitemap:\s*https:\/\/mowittall\.com\/sitemap-index\.xml/i.test(robots)) issues.push({ path: '/robots.txt', sev: 'error', msg: 'Doesn’t point to the sitemap' });
  if (/^Disallow:\s*\/\s*$/m.test(robots)) issues.push({ path: '/robots.txt', sev: 'error', msg: 'Blocks the whole site (Disallow: /)' });
  if (/GPTBot|ClaudeBot|PerplexityBot|OAI-SearchBot|Google-Extended/i.test(robots)) issues.push({ path: '/robots.txt', sev: 'warn', msg: 'Mentions AI crawlers. Check you aren’t blocking AI search' });
  if (!existsSync(join(DIST, 'llms.txt'))) issues.push({ path: '/llms.txt', sev: 'warn', msg: 'Missing' });
  const mods = [...read('sitemap-0.xml').matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].slice(0, 10)).sort();
  // "added / removed since last run" is worked out by the worker against the previous deploy.
  return { checked: urls.length, issues, note: `${urls.length} URLs in the sitemap${mods.length ? `. Newest lastmod: ${mods.at(-1)}` : ''}.` };
}

function shareCheck() {
  const issues = [];
  for (const { path } of urls) {
    const d = pages.get(path); if (!d) continue; const add = (sev, msg) => issues.push({ path, sev, msg });
    const img = meta(d, 'meta[property="og:image"]'); if (!img) { add('error', 'No og:image'); continue; }
    ['og:title', 'og:description', 'og:url'].forEach((k) => { if (!meta(d, `meta[property="${k}"]`)) add('warn', `No ${k}`); });
    if (!meta(d, 'meta[name="twitter:card"]')) add('warn', 'No twitter:card');
    const lp = localPath(img);
    if (!lp) { add('info', `Share image is on another site (${img})`); continue; }
    const file = join(DIST, decodeURIComponent(lp.split('?')[0]));
    if (!existsSync(file)) { add('error', `Share image doesn’t exist (${img})`); continue; }
    const dims = pngSize(file);
    if (dims && (dims[0] < 1200 || dims[1] < 600)) add('warn', `Share image is ${dims[0]}×${dims[1]} (1200×630 looks best)`);
    else if (!dims && !/\.jpe?g$/i.test(file)) add('info', 'Share image is not PNG/JPG; a few apps (older Outlook, some SMS) prefer those');
  }
  return { checked: urls.length, issues };
}

function aeoCheck() {
  const list = urls.filter((u) => /^\/(blog|guides)\/[^/]+\/$/.test(u.path) && !u.path.startsWith('/blog/topic/'));
  const issues = [];
  for (const { path } of list) {
    const d = pages.get(path); if (!d) continue; const add = (sev, msg) => issues.push({ path, sev, msg });
    const first = d.querySelector('article.prose > p'); const answerBox = d.querySelector('.guide-answer');
    if (!answerBox && !(first && first.querySelector('strong, b'))) add('warn', 'No answer-first opening (bold one-sentence answer at the top)');
    const types = ldTypes(lds(d));
    if (!types.includes('FAQPage')) add('warn', 'No FAQ structured data (add a faq: list to the frontmatter)');
    if (!types.some((t) => /Article|BlogPosting/.test(t))) add('error', 'No Article/BlogPosting structured data');
    const qs = [...d.querySelectorAll('article.prose h2')].filter((h) => /\?$/.test(h.textContent.trim())).length;
    if (!qs && path.startsWith('/guides/')) add('info', 'No question-style headings (“How often…?”)');
    if (!d.querySelector('article.prose table') && path.startsWith('/guides/')) add('info', 'No table (quick-fact tables get quoted a lot)');
    if (path.startsWith('/guides/') && !d.querySelector('.guide-sources')) add('info', 'No sources listed');
    if (!meta(d, 'meta[property="article:modified_time"]')) add('info', 'No modified date');
  }
  return { checked: list.length, issues };
}

const t0 = Date.now();
const agents = { page: pageCheck(), links: linkCheck(), sitemap: sitemapCheck(), share: shareCheck(), aeo: aeoCheck() };
let build = String(Date.now());
try { build = JSON.parse(read('indexnow/manifest.json')).build || build; } catch { /* manifest name may differ */ }
const report = { build, at: Date.now(), paths: urls.map((u) => u.path), agents };
mkdirSync(join(DIST, '_audit'), { recursive: true });
writeFileSync(join(DIST, '_audit', 'report.json'), JSON.stringify(report));
const count = (s) => Object.values(agents).reduce((n, a) => n + a.issues.filter((i) => i.sev === s).length, 0);
console.log(`[audit] ${urls.length} pages · ${count('error')} errors, ${count('warn')} warnings, ${count('info')} notes · ${Date.now() - t0} ms`);
