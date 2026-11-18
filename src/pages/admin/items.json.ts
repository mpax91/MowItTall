// Data for the dashboard's Post Queue (src/pages/admin/index.astro): every post, guide and tool with its social copy and pin.
// A separate file so the dashboard page doesn't bundle the blog layout's CSS. Public content only.
import { allPosts } from '../../data/posts.js';
import { SOCIAL, BASE_TAGS, TOPIC_TAGS } from '../../data/social.js';
import { allPins, pinUrl, PIN_BOARDS, PIN_BOARD_DEFAULT } from '../../data/pins.js';
const PINS: any = allPins();
const pinOf = (path: string) => { const p = PINS[path]; return p ? { img: pinUrl(p), title: p.pinterestTitle, desc: p.description, board: p.board, alt: p.alt } : null; };

const posts = allPosts(import.meta.glob('../blog/[a-z]*.md', { eager: true }));
const items = [
  ...posts.map((p: any) => {
    const slug = p.url.replace(/\/$/, '').split('/').pop();
    const s: any = (SOCIAL as any)[slug] || {};
    return {
      id: slug, kind: 'post', title: p.title, path: `/blog/${slug}/`, date: p.date, topics: p.topics || [],
      hook: s.hook || p.title, take: s.take || p.description, photo: s.photo || '', months: s.months || [],
      nd: s.nd === null ? null : s.nd || '', needsCopy: !s.hook, pin: pinOf(`/blog/${slug}/`),
    };
  }),
  // guides only go in the Pinterest queue (they're search answers, not social posts)
  ...allPosts(import.meta.glob('../guides/[a-z]*.md', { eager: true })).map((g: any) => {
    const slug = g.url.replace(/\/$/, '').split('/').pop();
    return { id: `guide-${slug}`, kind: 'guide', title: g.title, path: `/guides/${slug}/`, date: g.date, topics: g.topics || [], hook: g.title, take: g.description, photo: '', months: [], nd: null, needsCopy: false, pin: pinOf(`/guides/${slug}/`) };
  }),
  ...Object.entries(SOCIAL).filter(([k]) => k.startsWith('tool-')).map(([id, s]: any) => ({
    id, kind: 'tool', title: s.title, path: s.path, date: null, topics: [], hook: s.hook, take: s.take,
    photo: s.photo || '', months: s.months || [], nd: s.nd === null ? null : s.nd || '', needsCopy: false,
  })),
];
export const GET = () => new Response(JSON.stringify({ items, baseTags: BASE_TAGS, topicTags: TOPIC_TAGS, boards: [...new Set([PIN_BOARD_DEFAULT, ...Object.values(PIN_BOARDS)])] }), { headers: { 'content-type': 'application/json' } });
