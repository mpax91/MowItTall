// Runs at build time on a post's or guide's rendered HTML (see Post.astro / Guide.astro):
// 1. Counts words (for an honest read time).
// 2. Auto internal links: links the first mention of key phrases (src/data/autolinks.js) to the page
//    that covers them. Only in paragraphs, list items and table cells; never inside links, headings,
//    code, widgets or buttons. One link per target, never to the page itself or to a page the article
//    already links to, at most MAX_AUTO per page. Set `autolink: false` in frontmatter to turn it off.
import { parseHTML } from 'linkedom';
import { LINKS, MAX_AUTO } from '../data/autolinks.js';

const NO = new Set(['A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'BUTTON', 'SUMMARY', 'STRONG', 'B', 'LABEL']);
const OK = new Set(['P', 'LI', 'TD']);
const norm = (u) => {
  const p = String(u).split('#')[0].split('?')[0];
  return p && !p.endsWith('/') && !/\.\w+$/.test(p) ? p + '/' : p;
};

export function processArticle(html, self, { autolink = true } = {}) {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`);
  const root = document.getElementById('r');
  const words = (root.textContent || '').split(/\s+/).filter(Boolean).length;
  if (!autolink) return { html, words, links: [] };
  const linked = new Set([...root.querySelectorAll('a[href]')].map((a) => norm(a.getAttribute('href'))));
  const rules = LINKS.filter((r) => norm(r.to) !== self && !linked.has(norm(r.to)) && !(r.not || []).includes(self))
    .map((r) => ({ ...r, rx: new RegExp(`(^|[^\\w/-])(${r.re})(?![\\w-])`, 'i') }));
  const added = [];

  const allowed = (node) => {
    let ok = false;
    for (let el = node.parentNode; el && el !== root; el = el.parentNode) {
      if (NO.has(el.tagName) || el.classList?.contains('post-widget') || el.hasAttribute?.('data-widget-slot')) return false;
      if (OK.has(el.tagName)) ok = true;
    }
    return ok;
  };

  const texts = [];
  (function walk(n) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) texts.push(c);
      else if (c.nodeType === 1 && !NO.has(c.tagName)) walk(c);
    }
  })(root);

  for (const t of texts) {
    if (added.length >= MAX_AUTO) break;
    if (!allowed(t)) continue;
    let node = t;
    for (const r of rules) {
      if (added.length >= MAX_AUTO) break;
      if (added.some((a) => a.to === r.to)) continue;
      const v = node.nodeValue;
      const m = v.match(r.rx);
      if (!m) continue;
      const start = m.index + m[1].length, end = start + m[2].length;
      const a = document.createElement('a');
      a.setAttribute('href', r.to);
      a.setAttribute('data-auto', '');
      a.textContent = v.slice(start, end);
      const after = document.createTextNode(v.slice(end));
      node.nodeValue = v.slice(0, start);
      node.parentNode.insertBefore(after, node.nextSibling);
      node.parentNode.insertBefore(a, after);
      added.push({ to: r.to, text: a.textContent });
      // Earlier text (node) may still match other rules; keep scanning `node`, then `after` on later passes.
      texts.splice(texts.indexOf(t) + 1, 0, after);
    }
  }
  return { html: added.length ? root.innerHTML : html, words, links: added };
}
