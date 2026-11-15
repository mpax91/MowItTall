import rss from '@astrojs/rss';
import { allPosts } from '../data/posts.js';

export function GET(context) {
  const posts = allPosts(import.meta.glob('./blog/[a-z]*.md', { eager: true }));
  return rss({
    title: 'Mow It Tall',
    description: 'Short, funny lawn care takes from Bedford, NY. The easy guide to a better lawn.',
    site: context.site,
    items: posts.map((p) => ({ title: p.title, description: p.seoDescription || p.description, pubDate: new Date(String(p.date instanceof Date ? p.date.toISOString() : p.date).slice(0, 10) + 'T12:00:00'), link: p.url, categories: [p.tag] })),
    customData: '<language>en-us</language>',
  });
}
