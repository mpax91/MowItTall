// Draws the tall 1000x1500 Pinterest pin for every post and guide in allPins() at build time
// (satori -> SVG -> sharp -> JPEG, since it's mostly photo). Layout: Mike's photo on top (cropped differently per pin so no two
// look alike), then the searchable headline, a yellow line in Mike's voice, the "free tool inside"
// card, and the wordmark over a mowed-stripe band. Same colors and fonts as the site and share cards.
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { allPins, PIN_W, PIN_H } from '../../data/pins.js';

const font = (p) => fs.readFileSync(path.join(process.cwd(), 'node_modules', p));
let fonts;
const getFonts = () => (fonts ||= [
  { name: 'Bricolage', data: font('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Atkinson', data: font('@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff'), weight: 700, style: 'normal' },
]);

export function getStaticPaths() {
  return Object.values(allPins()).map((pin) => ({ params: { slug: pin.slug }, props: pin }));
}

const h = (type, style, children) => ({ type, props: { style, children } });

const INNER = PIN_W - 60 - 12; // panel width inside its border
const PHOTO_H = 690;
// Where each photo may be cropped from (fractions of the photo). The spiral shot keeps the patio furniture out.
const BOX = { 'spiral-pattern': [0.1, 0.17, 1, 0.66] };
const NO_ZOOM = ['spiral-pattern']; // already a tight crop

// Crop Mike's photo to the photo window. `variant` picks the zoom and the spot, so pins sharing a photo still differ.
async function photo(name, variant) {
  const file = path.join(process.cwd(), 'public/img', `${name}-1400.webp`);
  const img = sharp(file);
  const { width: W, height: H } = await img.metadata();
  const aspect = INNER / PHOTO_H;
  const [bx0, by0, bx1, by1] = (BOX[name] || [0, 0, 1, 1]).map((f, i) => f * (i % 2 ? H : W));
  const bw = bx1 - bx0, bh = by1 - by0;
  const zoom = NO_ZOOM.includes(name) ? 1 : [1, 1.18, 1.36][variant % 3];
  const cw = Math.min(bw, bh * aspect) / zoom;
  const ch = cw / aspect;
  const fx = [0.5, 0.25, 0.75][(variant >>> 3) % 3];
  const fy = [0.55, 0.35, 0.75][(variant >>> 6) % 3];
  const left = Math.round(Math.max(bx0, Math.min(bx1 - cw, bx0 + bw * fx - cw / 2)));
  const top = Math.round(Math.max(by0, Math.min(by1 - ch, by0 + bh * fy - ch / 2)));
  let pipe = img.extract({ left, top, width: Math.round(cw), height: Math.round(ch) }).resize(INNER, PHOTO_H);
  if ((variant >>> 9) & 1) pipe = pipe.flop(); // mirror half the pins: same lawn, different picture
  const buf = await pipe.modulate({ saturation: 1.08 }).jpeg({ quality: 84 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

function titleSize(t) {
  const n = t.length;
  return n <= 22 ? 112 : n <= 34 ? 102 : n <= 46 ? 92 : n <= 56 ? 82 : 72;
}

function pin(p, src) {
  const band = Array.from({ length: 16 }, (_, i) => h('div', { width: 60, height: 46, flexShrink: 0, background: i % 2 ? '#3f8a4f' : '#5fa860' }));
  const long = p.title.length > 56;
  const lineSize = (p.line.length <= 50 ? 44 : p.line.length <= 80 ? 40 : 36) - (long ? 4 : 0);
  return h('div', {
    width: PIN_W, height: PIN_H, display: 'flex', padding: 30, backgroundColor: '#173d27',
    backgroundImage: 'repeating-linear-gradient(90deg, #173d27 0px, #173d27 80px, #1b452c 80px, #1b452c 160px)', fontFamily: 'Atkinson',
  }, [
    h('div', {
      display: 'flex', flexDirection: 'column', width: PIN_W - 60, height: PIN_H - 60, boxSizing: 'border-box', borderRadius: 24, overflow: 'hidden',
      border: '6px solid #eef5e6', boxShadow: '0 0 0 5px #0a2414', backgroundImage: 'linear-gradient(180deg, #2f6e47, #143820)',
    }, [
      // photo window
      h('div', { display: 'flex', position: 'relative', width: INNER, height: PHOTO_H, borderBottom: '5px solid #0a2414', flexShrink: 0 }, [
        { type: 'img', props: { src, width: INNER, height: PHOTO_H, style: { position: 'absolute', top: 0, left: 0 } } },
        h('div', { display: 'flex', position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, backgroundImage: 'linear-gradient(180deg, rgba(10,36,20,0), rgba(10,36,20,.55))' }, []),
        h('div', {
          display: 'flex', position: 'absolute', top: 30, left: 30, background: '#f6c945', color: '#12301d', fontSize: 30, padding: '8px 20px',
          borderRadius: 10, border: '4px solid #0a2414', textTransform: 'uppercase', letterSpacing: 1.5, transform: 'rotate(-2deg)',
        }, p.label),
        h('div', { display: 'flex', position: 'absolute', bottom: 22, right: 28, alignItems: 'flex-end', fontFamily: 'Bricolage', fontSize: 40, color: '#ffffff', letterSpacing: -1 }, [
          h('span', { marginRight: 10 }, 'Mow It'), h('span', { color: '#9fd36a', fontSize: 52, lineHeight: 1 }, 'TALL'),
        ]),
      ]),
      // words
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '46px 52px 32px', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', flexDirection: 'column' }, [
          // one span per word so lines only break between words (satori would otherwise split "N-P-K" at a hyphen)
          h('div', { display: 'flex', flexWrap: 'wrap', fontFamily: 'Bricolage', fontSize: titleSize(p.title), lineHeight: 1.03, color: '#ffffff', letterSpacing: -2.5 },
            p.title.split(' ').map((w) => h('span', { whiteSpace: 'nowrap', marginRight: Math.round(titleSize(p.title) * 0.24) }, w))),
          p.line ? h('div', { display: 'flex', fontSize: lineSize, lineHeight: 1.25, color: '#f6c945', marginTop: 24 }, p.line) : null,
        ].filter(Boolean)),
        h('div', { display: 'flex', flexDirection: 'column' }, [
          h('div', { display: 'flex', alignItems: 'center', background: '#f1f6ec', borderRadius: 14, border: '4px solid #0a2414', boxShadow: '0 6px 0 #0a2414', padding: '16px 22px' }, [
            h('div', { display: 'flex', background: '#c8372d', color: '#ffffff', fontSize: 22, padding: '6px 12px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 1, marginRight: 18, flexShrink: 0 }, p.tool ? 'Free tool' : p.kind === 'guide' ? 'Quick answer' : 'Quick read'),
            h('div', { display: 'flex', fontFamily: 'Bricolage', fontSize: 32, color: '#12301d', lineHeight: 1.1, letterSpacing: -0.5 }, p.tool || (p.kind === 'guide' ? 'Straight answer + FAQ' : 'Short, funny, actually useful')),
          ]),
          h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28, color: '#eef5e6', marginTop: 30 }, [
            h('span', {}, 'The easy guide to a better lawn'),
            h('span', { color: '#f6c945' }, 'mowittall.com'),
          ]),
        ]),
      ]),
      h('div', { display: 'flex', borderTop: '4px solid #0a2414', flexShrink: 0 }, band),
    ]),
  ]);
}

export async function GET({ props }) {
  const src = await photo(props.photo, props.variant);
  const svg = await satori(pin(props, src), { width: PIN_W, height: PIN_H, fonts: getFonts() });
  const jpg = await sharp(Buffer.from(svg), { density: 72 }).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  return new Response(jpg, { headers: { 'content-type': 'image/jpeg' } });
}
