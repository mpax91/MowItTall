// Shared pixel-art kit: palette, noise, dithering and sprites for the lawn canvases.

/* ------------------------------------------------------------------ palette */
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const ramp = (...a) => a.map(hex);

export const C = {
  uncut: ramp('#1d4f27', '#25592b', '#2d6430', '#367036', '#407c3a', '#4f8b41', '#64a04a'),
  cut: ramp('#2b6b30', '#3b8036', '#539b41', '#71b54c', '#8fca5c'),
  cutAlt: ramp('#2e6f33', '#3f8439', '#57a044', '#76b950', '#94ce60'),
  scalp: ramp('#7f8a3c', '#949a45', '#a9a64f', '#bdb35c', '#cdbf69'),
  brown: ramp('#8c7a3e', '#a08b48', '#b49b55'),
  dandelion: ramp('#ffd83a', '#f0b41c'),
  stem: hex('#2f6a2c'),
  clover: ramp('#e7f2dc', '#c9e0b4'),
  mulch: ramp('#2c1b13', '#3a2519', '#47301f', '#553a25', '#634529'),
  cobble: ramp('#7c8286', '#999fa2', '#b5babc', '#d0d3d4'),
  hedge: ramp('#0f3119', '#16401f', '#1e5027', '#286031', '#36733a', '#4b8a44', '#66a24f'),
  rhodie: ramp('#8e2563', '#b8367f', '#d9559c', '#ee86bc', '#fbb9da'),
  walk: ramp('#a7a196', '#b8b2a6', '#c7c1b5', '#d4cfc4', '#e2ded5'),
  curb: ramp('#7d776c', '#948e82'),
  ink: hex('#1a120d'),
  red: ramp('#7c1d18', '#a3271f', '#c8372d', '#e05246', '#f2867b'),
  steel: ramp('#3f454a', '#5d646a', '#848b91', '#aeb4b9', '#d8dcdf'),
  tire: ramp('#141416', '#2a2a2e', '#4a4a50'),
  grip: hex('#202022'),
  canopy: ramp('#123c1d', '#1b4d25', '#25602d', '#327437', '#438a42', '#5ea24f', '#7fbb5f'),
  gnomeHat: ramp('#9e231c', '#d0392d'),
  gnomeBeard: ramp('#cfd4d6', '#f4f6f6'),
  gnomeCoat: ramp('#1f4f8f', '#2f6ab3'),
  skin: hex('#f0c09a'),
  ball: ramp('#c8372d', '#f4f2ea', '#2f6ab3'),
  blower: ramp('#a24a0c', '#d9661a', '#f08a3a'),
  leaf: ramp('#c4561f', '#d9822b', '#e8a93a'),
  clip: ramp('#8fca5c', '#a9d870', '#c4e48b'),
  roof: ramp('#3b3f46', '#4a4f57', '#5a6069'),
  siding: ramp('#2f3f74', '#3d4f8c', '#4a5d9e'),
  trim: ramp('#c9cfd6', '#f2f4f6'),
  pane: ramp('#8fb0cc', '#bcd3e6'),
  maple: ramp('#7a2412', '#a8361a', '#cf5a1f', '#e8862a', '#f4b03a', '#f8d26a'),
  leafLawn: ramp('#a8361a', '#cf5a1f', '#e8862a', '#d9a02c', '#8a4a1c'),
  chopped: ramp('#8a5a2a', '#a8743a'),
  pumpkin: ramp('#b4540f', '#e07a1f', '#2f6a2c'),
  rough: ramp('#244f2a', '#2c5c30', '#356a36', '#3f763c'),
  green: ramp('#5aa848', '#66b552', '#73c05c'),
  sand: ramp('#cdb98a', '#dccb9c', '#e9dcb2'),
  flag: ramp('#c8372d', '#f2f4f6'),
  barn: ramp('#6e2a26', '#8e3b36', '#a84a44'),
  glow: ramp('#f6d36a', '#ffe9a6'),
  rail: ramp('#6b5a48', '#8a7a66', '#a69580'),
  night: ramp('#07140c', '#0c1d12', '#12291a', '#1a3622'),
  dog: ramp('#5a3a22', '#8a5a34', '#b07a4a', '#1a120d'),
  dirt: ramp('#9a6a3e', '#a8774a', '#b58456', '#c49464'),
  chalk: ramp('#e8ece6', '#ffffff'),
  snow: ramp('#dfe8f0', '#eef3f8', '#ffffff', '#c9d6e3'),
  turkey: ramp('#5a3a22', '#7a4e2c', '#a86a3a', '#c8372d', '#f4b03a', '#2f2a26'),
  ghost: ramp('#dfe6ee', '#f6f8fb', '#1a120d'),
  stone: ramp('#6c7378', '#8a9196', '#a9afb3'),
  sky: ramp('#1c1430', '#2a1d45', '#3a2a5c'),
  moon: ramp('#f2e6b8', '#fff6d6'),
  smoke: ramp('#8a8f94', '#b4b9bd', '#d6d9dc'),
  wall: ramp('#173d27', '#1f4e31', '#2a5e3b'),
  lights: ramp('#e0463a', '#f6c945', '#4fb3e8', '#7fd65a'),
};

/* -------------------------------------------------------------------- noise */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 974634911) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function smooth(x, y, cell, s) {
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 4x4 ordered dither for smooth shading in a limited palette
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const dither = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

/* ------------------------------------------------------------------ sprites */
// Push mower, facing up. Deck centre is at (7, 8).
export const MOWER_UP = [
  '..TT......TT..',
  '.TtT......TtT.',
  '.KKKKKKKKKKKK.',
  'KHHHHHHHHHHHMK',
  'KHRRRRRRRRRRMK',
  'KHRRSSSSSSRRMK',
  'KHRSLLLLLLSRMK',
  'KHRSLsssssSRMK',
  'KHRSLsKKssSRMK',
  'KHRSLsKKssSRMK',
  'KHRSLsssssSRMK',
  'KHRSSSSSSSSRMK',
  'KRRRRRRRRRRRMK',
  'KMMMMMMMMMMMMK',
  '.KKKKKKKKKKKK.',
  '.TtT......TtT.',
  '..TT.G..G.TT..',
  '.....G..G.....',
  '.....G..G.....',
  '.....G..G.....',
  '....GGGGGG....',
  '....gggggg....',
];
export const MOWER_COL = {
  K: C.ink, H: C.red[3], R: C.red[2], M: C.red[1], S: C.steel[2], L: C.steel[4], s: C.steel[1],
  T: C.tire[0], t: C.tire[2], G: C.steel[1], g: C.grip,
};
export function rotate(map, q) {
  let m = map.map((r) => [...r]);
  for (let t = 0; t < q; t++) {
    const h = m.length, w = m[0].length;
    const o = Array.from({ length: w }, () => Array(h).fill('.'));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[x][h - 1 - y] = m[y][x];
    m = o;
  }
  return m;
}
export const MOWER = [0, 1, 2, 3].map((q) => rotate(MOWER_UP, q)); // up, right, down, left
// where the deck centre lands inside each rotated sprite
export const MOWER_ANCHOR = [[7, 8], [13, 7], [6, 13], [8, 6]];

export const BLOWER = [
  '.....KK...',
  '....KOOK..',
  'KKKKOOOOK.',
  'SSSKOoOOOK',
  'S..KOOOOK.',
  'S...KKKK..',
];
export const BLOWER_COL = { K: C.ink, O: C.blower[1], o: C.blower[0], S: C.steel[1] };

