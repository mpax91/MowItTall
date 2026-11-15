import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mowittall.com',
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/clippings') })],
  // Old blog address (it used to be called Clippings)
  redirects: {
    '/toolshed': '/resources/',
    '/clippings': '/blog/',
    '/clippings/power-ranking-every-excuse-for-a-bad-lawn': '/blog/power-ranking-every-excuse-for-a-bad-lawn/',
    '/clippings/stop-bagging-your-clippings': '/blog/stop-bagging-your-clippings/',
    '/clippings/you-never-needed-a-leaf-blower': '/blog/you-never-needed-a-leaf-blower/',
    '/clippings/your-landscaper-is-scalping-your-lawn': '/blog/your-landscaper-is-scalping-your-lawn/',
  },
});
