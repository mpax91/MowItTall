// 1080x1350 (4:5) social cards for Instagram and Threads, one per item in the social bank, drawn at build time
// (satori -> SVG -> sharp -> JPEG; Instagram's API only takes JPEG). Same colors and fonts as the share cards.
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { allPosts } from '../../data/posts.js';
import { allPins } from '../../data/pins.js';
import { bankItems, cardSlug } from '../../data/socialBank.js';

const font = (p) => fs.readFileSync(path.join(process.cwd(), 'node_modules', p));
let fonts;
const getFonts = () => (fonts ||= [
  { name: 'Bricolage', data: font('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Atkinson', data: font('@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff'), weight: 700, style: 'normal' },
]);

export function getStaticPaths() {
  const posts = allPosts(import.meta.glob('../blog/[a-z]*.md', { eager: true }));
  const guides = Object.entries(import.meta.glob('../guides/[a-z]*.md', { eager: true }));
  return bankItems({ posts, guides, pins: allPins() }).map((it) => ({ params: { slug: cardSlug(it.id) }, props: { hook: it.hooks[0], label: it.label, kind: it.kind, sub: it.kind === 'moment' || it.kind === 'engage' ? '' : it.take } }));
}

const h = (type, style, children) => ({ type, props: { style, children } });
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,;:]+\S*$/, '') + '…');
const W = 1080, H = 1350;

function card({ hook, label, sub }) {
  const text = clip(String(hook || ''), 170);
  const len = text.length;
  const size = len <= 40 ? 104 : len <= 70 ? 88 : len <= 110 ? 74 : 62;
  const subText = sub ? clip(String(sub), len > 90 ? 120 : 190) : '';
  const band = Array.from({ length: 18 }, (_, i) => h('div', { width: 60, height: 56, flexShrink: 0, background: i % 2 ? '#3f8a4f' : '#5fa860' }));
  return h('div', { width: W, height: H, display: 'flex', padding: 34, backgroundColor: '#173d27', backgroundImage: 'repeating-linear-gradient(90deg, #173d27 0px, #173d27 80px, #1b452c 80px, #1b452c 160px)', fontFamily: 'Atkinson' }, [
    h('div', { display: 'flex', flexDirection: 'column', width: W - 68, height: H - 68, boxSizing: 'border-box', borderRadius: 24, overflow: 'hidden', border: '7px solid #eef5e6', boxShadow: '0 0 0 6px #0a2414', backgroundImage: 'linear-gradient(180deg, #2f6e47, #143820)' }, [
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '56px 64px 40px' }, [
        h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
          h('div', { display: 'flex', alignItems: 'flex-end', fontFamily: 'Bricolage', fontSize: 52, color: '#eef5e6', letterSpacing: -1 }, [h('span', { marginRight: 12 }, 'Mow It'), h('span', { color: '#9fd36a', fontSize: 66, lineHeight: 1 }, 'TALL')]),
          h('div', { display: 'flex', background: '#f6c945', color: '#12301d', fontSize: 30, padding: '10px 22px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 1 }, label || 'Lawn Tip'),
        ]),
        h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, [
          h('div', { display: 'flex', fontFamily: 'Bricolage', fontSize: size, lineHeight: 1.06, color: '#ffffff', letterSpacing: -2 }, text),
          subText ? h('div', { display: 'flex', fontSize: 36, lineHeight: 1.35, color: '#d9ead0', marginTop: 34 }, subText) : h('div', { display: 'flex' }, ''),
        ]),
        h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 32, color: '#eef5e6' }, [h('span', {}, 'The easy guide to a better lawn'), h('span', { color: '#f6c945' }, 'mowittall.com')]),
      ]),
      h('div', { display: 'flex', borderTop: '5px solid #0a2414' }, band),
    ]),
  ]);
}

export async function GET({ props }) {
  const svg = await satori(card(props), { width: W, height: H, fonts: getFonts() });
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return new Response(jpg, { headers: { 'content-type': 'image/jpeg' } });
}
