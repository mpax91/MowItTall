// Shared IndexNow helpers (no dependencies). Used by indexnow-manifest.mjs (after build) and deploy.mjs (deploy + submit).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const HOST = 'mowittall.com';
export const ORIGIN = `https://${HOST}`;
export const MANIFEST_PATH = 'indexnow/manifest.json';   // public list of page fingerprints, used to diff deploys
export const ENDPOINT = 'https://api.indexnow.org/indexnow';

// Never submitted, even if they ever end up in the sitemap.
const EXCLUDE = [/^\/admin(\/|$)/, /^\/api(\/|$)/, /^\/404(\/|$)/, /^\/clippings(\/|$)/, /^\/toolshed(\/|$)/, /^\/hall\/admin(\/|$)/, /^\/indexnow\//];

// The key is whatever public/<key>.txt contains its own name (IndexNow's verification file).
export function findKey(publicDir = 'public') {
  for (const f of readdirSync(publicDir)) {
    const m = f.match(/^([A-Za-z0-9-]{8,128})\.txt$/);
    if (m && readFileSync(join(publicDir, f), 'utf8').trim() === m[1]) return m[1];
  }
  return null;
}

// Fingerprint only what search engines care about: title, description, canonical, robots and the <main> content.
// Shared header/footer and hashed asset names are left out, so a footer tweak doesn't "change" every page.
export function fingerprint(html) {
  const pick = (re) => (html.match(re) || [''])[0];
  const parts = [
    pick(/<title>[\s\S]*?<\/title>/i),
    pick(/<meta name="description"[^>]*>/i),
    pick(/<link rel="canonical"[^>]*>/i),
    pick(/<meta name="robots"[^>]*>/i),
    pick(/<main[\s\S]*<\/main>/i),
  ].join('\n')
    .replace(/\/_astro\/[^"'\s)]+/g, '/_astro/*')
    .replace(/\sdata-astro-cid-[a-z0-9]+(="[^"]*")?/g, '')
    .replace(/\s+/g, ' ');
  return createHash('sha256').update(parts).digest('hex').slice(0, 16);
}

export function indexable(path, html) {
  if (EXCLUDE.some((re) => re.test(path))) return false;
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) return false;
  if (/<meta[^>]+http-equiv="refresh"/i.test(html)) return false;   // Astro redirect pages
  return true;
}

// Public URLs from the built sitemap(s) → { url: fingerprint }
export function buildUrlMap(dist = 'dist') {
  const files = readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  const urls = {};
  for (const f of files) {
    for (const [, loc] of readFileSync(join(dist, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = new URL(loc);
      if (u.host !== HOST) continue;
      const file = join(dist, u.pathname, u.pathname.endsWith('/') ? 'index.html' : '');
      const htmlFile = existsSync(file) && !file.endsWith('.html') ? join(file, 'index.html') : file;
      if (!existsSync(htmlFile)) continue;
      const html = readFileSync(htmlFile, 'utf8');
      if (!indexable(u.pathname, html)) continue;
      urls[`${ORIGIN}${u.pathname}`] = fingerprint(html);
    }
  }
  return urls;
}
