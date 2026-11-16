import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';

// lastmod for the sitemap: each post/guide's `updated:` or `date:` frontmatter; other pages get the build date.
const lastmod = {};
for (const dir of ['blog', 'guides']) {
  const d = `./src/pages/${dir}`;
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((f) => /^[a-z].*\.md$/.test(f))) {
    const txt = fs.readFileSync(`${d}/${f}`, 'utf8');
    const m = txt.match(/^updated:\s*["']?(\d{4}-\d{2}-\d{2})/m) || txt.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m);
    if (m) lastmod[`https://mowittall.com/${dir}/${f.replace(/\.md$/, '')}/`] = m[1];
  }
}

export default defineConfig({
  site: 'https://mowittall.com',
  trailingSlash: 'ignore',
  integrations: [sitemap({
    filter: (page) => !/\/(404|clippings|admin|search|og|links|thanks)(\/|$)/.test(page),
    serialize: (item) => (lastmod[item.url] ? { ...item, lastmod: lastmod[item.url] } : item),
  })],
  // Old blog address (it used to be called Clippings)
  redirects: {
    '/toolshed': '/resources/',
    '/hall/admin': '/admin/',
    '/clippings': '/blog/',
    '/clippings/power-ranking-every-excuse-for-a-bad-lawn': '/blog/power-ranking-every-excuse-for-a-bad-lawn/',
    '/clippings/stop-bagging-your-clippings': '/blog/stop-bagging-your-clippings/',
    '/clippings/you-never-needed-a-leaf-blower': '/blog/you-never-needed-a-leaf-blower/',
    '/clippings/your-landscaper-is-scalping-your-lawn': '/blog/your-landscaper-is-scalping-your-lawn/',
  },
});
