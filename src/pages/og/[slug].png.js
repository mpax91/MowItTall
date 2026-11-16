// Draws the 1200x630 share card for every page in allOgPages() at build time (satori -> SVG -> sharp -> PNG).
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { allOgPages, ogSlug } from '../../data/og.js';

const font = (p) => fs.readFileSync(path.join(process.cwd(), 'node_modules', p));
let fonts;
const getFonts = () => (fonts ||= [
  { name: 'Bricolage', data: font('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Atkinson', data: font('@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff'), weight: 700, style: 'normal' },
]);

export function getStaticPaths() {
  return Object.entries(allOgPages()).map(([p, page]) => ({ params: { slug: ogSlug(p) }, props: page }));
}

const h = (type, style, children) => ({ type, props: { style, children } });

function card({ title, kicker }) {
  const len = title.length;
  const size = len <= 34 ? 84 : len <= 52 ? 72 : len <= 72 ? 62 : 54;
  // the mowed-lawn band along the bottom: alternating light/dark stripes
  const band = Array.from({ length: 19 }, (_, i) => h('div', { width: 60, height: 40, flexShrink: 0, background: i % 2 ? '#3f8a4f' : '#5fa860' }));
  return h('div', {
    width: 1200, height: 630, display: 'flex', padding: 30,
    backgroundColor: '#173d27',
    backgroundImage: 'repeating-linear-gradient(90deg, #173d27 0px, #173d27 80px, #1b452c 80px, #1b452c 160px)',
    fontFamily: 'Atkinson',
  }, [
    h('div', {
      display: 'flex', flexDirection: 'column', width: 1140, height: 570, boxSizing: 'border-box', borderRadius: 20, overflow: 'hidden',
      border: '6px solid #eef5e6', boxShadow: '0 0 0 5px #0a2414', backgroundImage: 'linear-gradient(180deg, #2f6e47, #143820)',
    }, [
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '44px 56px 30px' }, [
        h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
          h('div', { display: 'flex', alignItems: 'flex-end', fontFamily: 'Bricolage', fontSize: 46, color: '#eef5e6', letterSpacing: -1 }, [
            h('span', { marginRight: 12 }, 'Mow It'),
            h('span', { color: '#9fd36a', fontSize: 58, lineHeight: 1 }, 'TALL'),
          ]),
          h('div', { display: 'flex', background: '#f6c945', color: '#12301d', fontSize: 26, padding: '8px 18px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 1 }, kicker),
        ]),
        h('div', { display: 'flex', flexGrow: 1, alignItems: 'center', fontFamily: 'Bricolage', fontSize: size, lineHeight: 1.04, color: '#ffffff', letterSpacing: -2, paddingTop: 10 }, title),
        h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28, color: '#eef5e6' }, [
          h('span', {}, 'The easy guide to a better lawn'),
          h('span', { color: '#f6c945' }, 'mowittall.com'),
        ]),
      ]),
      h('div', { display: 'flex', borderTop: '4px solid #0a2414' }, band),
    ]),
  ]);
}

export async function GET({ props }) {
  const svg = await satori(card(props), { width: 1200, height: 630, fonts: getFonts() });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  return new Response(png, { headers: { 'content-type': 'image/png' } });
}
