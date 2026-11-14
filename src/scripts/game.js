// Mow It Tall — the mowing game.
// Swipe to turn; the mower keeps rolling. Clean, alternating lanes score extra,
// bumping into things costs points, and the deck height you pick decides
// what the lawn looks like a week later.

/* ------------------------------------------------------------------ palette */
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const ramp = (...a) => a.map(hex);

const C = {
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
};

/* -------------------------------------------------------------------- noise */
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 974634911) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(x, y, cell, s) {
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 4x4 ordered dither for smooth shading in a limited palette
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dither = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

/* ------------------------------------------------------------------ sprites */
// Push mower, facing up. Deck centre is at (7, 8).
const MOWER_UP = [
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
const MOWER_COL = {
  K: C.ink, H: C.red[3], R: C.red[2], M: C.red[1], S: C.steel[2], L: C.steel[4], s: C.steel[1],
  T: C.tire[0], t: C.tire[2], G: C.steel[1], g: C.grip,
};
function rotate(map, q) {
  let m = map.map((r) => [...r]);
  for (let t = 0; t < q; t++) {
    const h = m.length, w = m[0].length;
    const o = Array.from({ length: w }, () => Array(h).fill('.'));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[x][h - 1 - y] = m[y][x];
    m = o;
  }
  return m;
}
const MOWER = [0, 1, 2, 3].map((q) => rotate(MOWER_UP, q)); // up, right, down, left
// where the deck centre lands inside each rotated sprite
const MOWER_ANCHOR = [[7, 8], [13, 7], [6, 13], [8, 6]];

const GNOME = [
  '...H...',
  '..HhH..',
  '..HhH..',
  '.HHhHH.',
  '.FsssF.',
  '.BbbbB.',
  'CBbbbBC',
  'CCBbBCC',
  '.CCCCC.',
  '.K...K.',
];
const GNOME_COL = { H: C.gnomeHat[1], h: C.gnomeHat[0], F: C.skin, s: C.skin, B: C.gnomeBeard[1], b: C.gnomeBeard[0], C: C.gnomeCoat[1], K: C.ink };

const BLOWER = [
  '.....KK...',
  '....KOOK..',
  'KKKKOOOOK.',
  'SSSKOoOOOK',
  'S..KOOOOK.',
  'S...KKKK..',
];
const BLOWER_COL = { K: C.ink, O: C.blower[1], o: C.blower[0], S: C.steel[1] };

/* ------------------------------------------------------------------- levels */
const LEVELS = [
  {
    name: 'The front yard',
    goal: 'Mow the whole lawn before time runs out. Straight lanes that alternate direction score the most.',
    mode: 'stripes', passes: 1, target: 0.9, obstacles: [],
  },
  {
    name: 'The backyard',
    goal: 'Same idea, but there’s stuff in the way. Every bump costs you points.',
    mode: 'stripes', passes: 1, target: 0.88,
    obstacles: [
      { kind: 'tree', fx: 0.3, fy: 0.34, r: 12 },
      { kind: 'tree', fx: 0.7, fy: 0.66, r: 13 },
      { kind: 'gnome', fx: 0.78, fy: 0.22, r: 5 },
      { kind: 'ball', fx: 0.24, fy: 0.78, r: 4 },
    ],
  },
  {
    name: 'The checkerboard',
    goal: 'The fancy one. Mow it all up and down, then mow it all again side to side.',
    mode: 'checker', passes: 2, target: 0.8, obstacles: [],
  },
];

const HEIGHTS = {
  2: { weeds: 45, scalp: true, line: (n) => `Mowed at 2 inches, ${n} weeds moved in. Short grass lets sun hit the soil, and that’s all weed seeds need. It also burns out first in July.` },
  3: { weeds: 15, scalp: false, line: (n) => `Mowed at 3 inches, ${n} weeds showed up. Not bad. One notch higher and most of those never sprout.` },
  4: { weeds: 3, scalp: false, line: (n) => `Mowed at 4 inches, only ${n} weeds. Tall grass shades the soil so weed seeds can’t get going. That’s the whole trick.` },
};

/* --------------------------------------------------------------------- game */
export function initGame(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const screen = root.querySelector('[data-screen]');
  const $ = (s) => root.querySelector(s);
  const ui = {
    level: $('[data-level]'), time: $('[data-time]'), pct: $('[data-pct]'), score: $('[data-score]'),
    menu: $('[data-menu]'), menuTitle: $('[data-menu-title]'), menuGoal: $('[data-menu-goal]'), start: $('[data-start]'),
    result: $('[data-result]'), resultTitle: $('[data-result-title]'), stars: $('[data-stars]'), rows: $('[data-rows]'),
    week: $('[data-week]'), lesson: $('[data-lesson]'), next: $('[data-next]'), retry: $('[data-retry]'),
    toast: $('[data-toast]'), brap: $('[data-brap]'), heights: root.querySelectorAll('[data-height]'),
  };
  const ticket = document.querySelector('[data-ticket]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, img, data, staticLayer, staticAlpha;
  let lawn; // {top,bottom,left,right}
  let mask, cutV, cutH, uncutTone, cutVar, grassTotal;
  let lane = 14;
  let obstacles = [];
  let blowerPos = { x: 0, y: 0 };
  let levelIndex = 0;
  let height = 3;
  let state = 'menu'; // menu | play | result | week
  let timeLeft = 0, timeLimit = 0, bumps = 0, stall = 0, bonk = 0;
  let particles = [];
  let shake = 0;
  let weekT = 0, weekWeeds = [], weekScalp = [], weekView = false;
  const mower = { x: 0, y: 0, dir: 0, snapX: null, snapY: null, uturn: null };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let lastWidth = 0;

  /* ------------------------------------------------------------ build */
  function build(keepState = false) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(2, Math.round(rect.width / 175));
    W = Math.max(120, Math.round(rect.width / scale));
    H = Math.max(160, Math.round(rect.height / scale));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    data = img.data;

    lawn = { top: 24, bottom: H - 12, left: 4, right: W - 4 };
    const n = W * H;
    mask = new Uint8Array(n);
    cutV = new Int8Array(n);
    cutH = new Int8Array(n);
    uncutTone = new Uint8Array(n);
    cutVar = new Uint8Array(n);

    const lvl = LEVELS[levelIndex];
    const lw = lawn.right - lawn.left, lh = lawn.bottom - lawn.top;
    obstacles = lvl.obstacles.map((o) => ({ ...o, x: Math.round(lawn.left + o.fx * lw), y: Math.round(lawn.top + o.fy * lh) }));

    grassTotal = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const inLawn = x >= lawn.left && x < lawn.right && y >= lawn.top && y < lawn.bottom;
        let blocked = false;
        for (const o of obstacles) if ((x - o.x) ** 2 + (y - o.y) ** 2 <= (o.r + 0.5) ** 2) blocked = true;
        if (inLawn && !blocked) { mask[i] = 1; grassTotal++; }
        // clumpy uncut grass: big soft clumps + blade streaks + pixel grain
        const clump = smooth(x, y, 5, 1);
        const streak = smooth(x * 3, y, 4, 2);
        const grain = hash(x, y, 3);
        let t = clump * 3.2 + streak * 2.2 + grain * 1.6 - 0.6;
        if (grain > 0.93) t += 1.5; // sunlit tips
        uncutTone[i] = Math.max(0, Math.min(6, Math.floor(t)));
        cutVar[i] = hash(x, y, 4) > 0.55 ? 1 : 0;
      }
    }
    // lanes line up with the lawn edges
    const lanes = Math.max(6, Math.round(lw / 14));
    lane = lw / lanes;

    blowerPos = { x: W - 22, y: 9 };
    buildStatic();
    resetMower();
    weekView = false;
    timeLimit = Math.ceil((lvl.passes * grassTotal) / (lane * 44) * 1.5 + 8);
    if (!keepState) timeLeft = timeLimit;
    hud();
  }

  function resetMower() {
    mower.x = lawn.left + lane / 2;
    mower.y = lawn.bottom - 7;
    mower.dir = 0;
    mower.snapX = mower.x; mower.snapY = null; mower.uturn = null;
  }

  // Beds, hedge, sidewalk and obstacles never change: draw them once.
  function buildStatic() {
    staticLayer = new Uint8ClampedArray(W * H * 3);
    staticAlpha = new Uint8Array(W * H);
    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      staticLayer[i * 3] = c[0]; staticLayer[i * 3 + 1] = c[1]; staticLayer[i * 3 + 2] = c[2];
      staticAlpha[i] = 1;
    };
    // mulch bed behind hedge, cobble edge, side beds
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = hash(x, y, 7), m = smooth(x, y, 3, 8);
        const mulch = C.mulch[Math.min(4, Math.floor(m * 3 + g * 2))];
        if (y < lawn.top - 4) put(x, y, mulch);
        else if (y < lawn.top) {
          const r = y - (lawn.top - 4);
          const seam = r === 3 || ((x + (r > 1 ? 2 : 0)) % 5 === 0);
          put(x, y, seam ? C.mulch[0] : C.cobble[r === 0 ? 3 : Math.min(2, Math.floor(g * 3))]);
        } else if (y >= lawn.bottom + 3) {
          const joint = (x % 28 === 0) || y === lawn.bottom + 3;
          const tone = joint ? 0 : 2 + Math.floor(g * 2.2 + (y === lawn.bottom + 4 ? 1 : 0));
          put(x, y, C.walk[Math.min(4, tone)]);
        } else if (y >= lawn.bottom) {
          put(x, y, y === lawn.bottom ? C.curb[0] : C.curb[1]);
        } else if (x < lawn.left || x >= lawn.right) {
          const edge = x === lawn.left - 1 || x === lawn.right;
          put(x, y, edge ? C.cobble[1 + (y % 3 === 0 ? 0 : 1)] : mulch);
        }
      }
    }
    // arborvitae row: lit from the upper left, dithered
    for (let x0 = -4; x0 < W + 6; x0 += 10) {
      const h = 15 + Math.floor(hash(x0, 1, 2) * 5);
      const cx = x0 + 5;
      for (let y = 0; y < h; y++) {
        const half = Math.round(((y + 3) / (h + 3)) * 5.5);
        for (let dx = -half; dx <= half; dx++) {
          const x = cx + dx;
          const light = 0.5 - dx / (half * 2 + 1) - (y / h) * 0.25 + (smooth(x, y, 2, 5) - 0.5) * 0.7;
          let t = Math.floor(light * 6 + dither(x, y) * 1.6 + 1.5);
          if (dx === -half || dx === half || y === h - 1) t = 0;
          put(x, y + 1, C.hedge[Math.max(0, Math.min(6, t))]);
        }
      }
    }
    // rhododendrons: leafy mounds dotted with flower trusses
    [0.14, 0.5, 0.84].forEach((fx, k) => {
      const cx = Math.round(W * fx), cy = 16;
      for (let y = -6; y <= 5; y++) {
        for (let x = -9; x <= 9; x++) {
          const d = (x * x) / 81 + (y * y) / 36;
          if (d > 1) continue;
          const n = smooth(cx + x, cy + y, 2, 30 + k);
          const lit = 0.6 - x / 18 - y / 12;
          let c;
          if (n > 0.55) c = C.rhodie[Math.max(0, Math.min(4, Math.floor(lit * 3 + n * 2 + dither(x, y))))];
          else c = C.hedge[Math.max(1, Math.min(5, Math.floor(lit * 4 + 2 + dither(x, y))))];
          if (d > 0.86) c = C.hedge[1];
          put(cx + x, cy + y, c);
        }
      }
    });
    stamp(put, BLOWER, BLOWER_COL, blowerPos.x, blowerPos.y);
  }

  function stamp(put, map, col, ox, oy) {
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.' && col[ch]) put(ox + x, oy + y, col[ch]);
    }
  }

  /* ----------------------------------------------------------- render */
  function px(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  function darken(x, y, k) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    data[o] *= k; data[o + 1] *= k; data[o + 2] *= k;
  }

  function grassColor(i, x, y) {
    const v = cutV[i], h = cutH[i];
    // a week later: grass grows back in and stripes soften
    if (weekView && (v || h)) {
      if (hash(x, y, 13) < weekT * 0.85) return C.uncut[uncutTone[i]];
    }
    if (!v && !h) return C.uncut[uncutTone[i]];
    // light when bent away from you (mowed upward / leftward), dark toward you
    let t = 2 - v * 2 + (h ? -h : 0);
    t = Math.max(0, Math.min(4, t));
    if (height === 2) return C.scalp[t];
    return (cutVar[i] ? C.cutAlt : C.cut)[t];
  }

  function draw(dt) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (staticAlpha[i]) {
          const o = i * 4, s = i * 3;
          data[o] = staticLayer[s]; data[o + 1] = staticLayer[s + 1]; data[o + 2] = staticLayer[s + 2]; data[o + 3] = 255;
        } else {
          px(x, y, grassColor(i, x, y));
        }
      }
    }
    // hedge casts a soft shadow onto the top of the lawn
    for (let y = lawn.top; y < lawn.top + 6; y++) {
      const k = 0.72 + (y - lawn.top) * 0.05;
      for (let x = lawn.left; x < lawn.right; x++) if (dither(x, y) < 0.9 - (y - lawn.top) * 0.12) darken(x, y, k);
    }
    if (weekView) drawWeek();
    drawObstacles();
    if (!weekView) drawMower();
    drawParticles(dt);
    ctx.putImageData(img, 0, 0);
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.kind === 'tree') {
        // drop shadow down-right, then a lit, dithered canopy
        for (let y = -o.r; y <= o.r; y++) for (let x = -o.r; x <= o.r; x++) {
          if (x * x + y * y <= o.r * o.r && dither(x, y) < 0.75) darken(o.x + x + 4, o.y + y + 5, 0.62);
        }
        for (let y = -o.r - 2; y <= o.r + 2; y++) for (let x = -o.r - 2; x <= o.r + 2; x++) {
          const wob = (smooth(o.x + x, o.y + y, 3, 40) - 0.5) * 4;
          const d = Math.hypot(x, y);
          if (d > o.r + wob * 0.6) continue;
          const lit = 0.55 - (x + y) / (o.r * 2.6) + (smooth(o.x + x, o.y + y, 2, 41) - 0.5) * 0.6;
          let t = Math.floor(lit * 6 + dither(x, y) * 1.4 + 0.8);
          if (d > o.r + wob * 0.6 - 1) t = 0;
          px(o.x + x, o.y + y, C.canopy[Math.max(0, Math.min(6, t))]);
        }
      } else if (o.kind === 'gnome') {
        for (let x = -3; x <= 4; x++) darken(o.x + x + 1, o.y + 5, 0.6);
        stampLive(GNOME, GNOME_COL, o.x - 3, o.y - 5);
      } else if (o.kind === 'ball') {
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
          if (x * x + y * y > 10) continue;
          if (x * x + y * y <= 10 && x * x + y * y > 6) darken(o.x + x + 2, o.y + y + 2, 0.65);
        }
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
          if (x * x + y * y > 9) continue;
          const band = Math.abs(x + y) <= 1 ? 1 : x + y < 0 ? 0 : 2;
          px(o.x + x, o.y + y, (x === -1 && y === -2) ? C.ball[1] : C.ball[band]);
        }
      }
    }
  }

  function stampLive(map, col, ox, oy) {
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.' && col[ch]) px(ox + x, oy + y, col[ch]);
    }
  }

  function drawMower() {
    const map = MOWER[mower.dir];
    const [ax, ay] = MOWER_ANCHOR[mower.dir];
    const ox = Math.round(mower.x) - ax, oy = Math.round(mower.y) - ay;
    // shadow
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] !== '.' && map[y][x] !== 'G' && map[y][x] !== 'g') darken(ox + x + 2, oy + y + 2, 0.6);
    }
    const jitter = state === 'play' && stall <= 0 && !reduceMotion && (performance.now() / 60 | 0) % 2 ? 1 : 0;
    stampLive(map, MOWER_COL, ox, oy + (mower.dir % 2 === 0 ? 0 : jitter));
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      px(Math.round(p.x), Math.round(p.y), p.c);
    }
  }

  function drawWeek() {
    const shown = Math.floor(weekWeeds.length * Math.min(1, weekT * 1.15));
    for (let k = 0; k < weekScalp.length; k++) {
      const s = weekScalp[k];
      if (weekT < s.t) continue;
      for (let y = -s.r; y <= s.r; y++) for (let x = -s.r; x <= s.r; x++) {
        if (x * x + y * y > s.r * s.r || dither(s.x + x, s.y + y) > 0.7) continue;
        const i = (s.y + y) * W + (s.x + x);
        if (mask[i]) px(s.x + x, s.y + y, C.brown[Math.floor(hash(s.x + x, s.y + y, 2) * 3)]);
      }
    }
    for (let k = 0; k < shown; k++) {
      const w = weekWeeds[k];
      if (w.type === 0) {
        // dandelion: rosette + flower
        px(w.x - 1, w.y + 1, C.stem); px(w.x + 2, w.y + 1, C.stem); px(w.x, w.y + 2, C.stem);
        px(w.x, w.y, C.dandelion[0]); px(w.x + 1, w.y, C.dandelion[0]);
        px(w.x, w.y - 1, C.dandelion[1]); px(w.x + 1, w.y - 1, C.dandelion[0]);
      } else {
        px(w.x, w.y, C.clover[0]); px(w.x + 1, w.y, C.clover[1]); px(w.x, w.y + 1, C.clover[1]);
      }
    }
  }

  /* ----------------------------------------------------------- update */
  function cut() {
    const [dx, dy] = DIRS[mower.dir];
    const r = Math.floor(lane / 2);
    const cx = Math.round(mower.x), cy = Math.round(mower.y);
    let fresh = 0;
    for (let y = cy - r; y < cy + r; y++) {
      for (let x = cx - r; x < cx + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!mask[i]) continue;
        if (dy) { if (!cutV[i] && !cutH[i]) fresh++; cutV[i] = dy; }
        else { if (!cutV[i] && !cutH[i]) fresh++; cutH[i] = dx; }
      }
    }
    if (fresh && !reduceMotion && particles.length < 140) {
      // side discharge to the mower's right
      const sx = -dy, sy = dx;
      for (let k = 0; k < 2; k++) {
        particles.push({
          x: cx + sx * (r + 1), y: cy + sy * (r + 1),
          vx: sx * (25 + Math.random() * 30) + (Math.random() - 0.5) * 14,
          vy: sy * (25 + Math.random() * 30) + (Math.random() - 0.5) * 14,
          life: 0.35 + Math.random() * 0.35, c: C.clip[k + (Math.random() > 0.5 ? 1 : 0)],
        });
      }
    }
  }

  function atWall() {
    const r = lane / 2;
    return [
      mower.y <= lawn.top + r + 0.6, mower.x >= lawn.right - r - 0.6,
      mower.y >= lawn.bottom - r - 0.6, mower.x <= lawn.left + r + 0.6,
    ][mower.dir];
  }

  function turn(dir, auto = false) {
    if (state !== 'play' || dir === mower.dir) return;
    // Swiping sideways at the end of a lane does a U-turn: shift one lane, head back.
    if (!auto && (dir - mower.dir + 4) % 2 === 1 && atWall()) {
      const [dx, dy] = DIRS[dir];
      mower.uturn = { tx: mower.x + dx * lane, ty: mower.y + dy * lane, then: (mower.dir + 2) % 4 };
    } else if (!auto) {
      mower.uturn = null;
    }
    mower.dir = dir;
    // snap onto the nearest lane so stripes line up cleanly
    if (dir % 2 === 0) {
      const k = Math.round((mower.x - lawn.left - lane / 2) / lane);
      mower.snapX = lawn.left + lane / 2 + Math.max(0, Math.min(Math.round((lawn.right - lawn.left) / lane) - 1, k)) * lane;
      mower.snapY = null;
    } else {
      const lanesY = Math.floor((lawn.bottom - lawn.top) / lane);
      const k = Math.round((mower.y - lawn.top - lane / 2) / lane);
      mower.snapY = lawn.top + lane / 2 + Math.max(0, Math.min(lanesY - 1, k)) * lane;
      mower.snapX = null;
    }
  }

  function update(dt) {
    if (state === 'week') {
      weekT = Math.min(1, weekT + dt / 2.6);
      ui.time.textContent = `Day ${1 + Math.floor(weekT * 6)}`;
      if (weekT >= 1) finishWeek();
      return;
    }
    if (state !== 'play') return;
    timeLeft -= dt;
    if (stall > 0) stall -= dt;
    else {
      const [dx, dy] = DIRS[mower.dir];
      const sp = 44;
      let nx = mower.x + dx * sp * dt, ny = mower.y + dy * sp * dt;
      if (mower.snapX != null) nx += (mower.snapX - nx) * Math.min(1, dt * 14);
      if (mower.snapY != null) ny += (mower.snapY - ny) * Math.min(1, dt * 14);
      const r = lane / 2;
      nx = Math.max(lawn.left + r, Math.min(lawn.right - r, nx));
      ny = Math.max(lawn.top + r, Math.min(lawn.bottom - r, ny));
      const hit = obstacles.find((o) => Math.hypot(nx - o.x, ny - o.y) < o.r + r - 1);
      if (hit) {
        bumps++; stall = 0.55; shake = reduceMotion ? 0 : 0.25;
        nx = mower.x - dx * 3; ny = mower.y - dy * 3;
        toast(hit.kind === 'gnome' ? 'Sorry, gnome. −50' : hit.kind === 'ball' ? 'Boing. −50' : 'Bonk. −50');
      }
      mower.x = nx; mower.y = ny;
      cut();
      const u = mower.uturn;
      if (u) {
        const done = mower.dir % 2 === 1 ? (dx > 0 ? nx >= u.tx - 0.5 : nx <= u.tx + 0.5) || atWall()
          : (dy > 0 ? ny >= u.ty - 0.5 : ny <= u.ty + 0.5) || atWall();
        if (done) { mower.uturn = null; turn(u.then, true); }
      }
    }
    const cov = coverage();
    hud(cov);
    if (cov >= 0.995 || timeLeft <= 0) endLevel();
  }

  function coverage() {
    const checker = LEVELS[levelIndex].mode === 'checker';
    let c = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      if (checker ? (cutV[i] && cutH[i]) : (cutV[i] || cutH[i])) c++;
    }
    return c / grassTotal;
  }

  // Share of lanes that are fully mowed in one direction, alternating with the neighbour.
  function stripeQuality() {
    const best = (vertical) => {
      const count = vertical ? Math.round((lawn.right - lawn.left) / lane) : Math.floor((lawn.bottom - lawn.top) / lane);
      let clean = 0, prev = 0;
      for (let k = 0; k < count; k++) {
        let tot = 0, pos = 0, neg = 0;
        const a = Math.round((vertical ? lawn.left : lawn.top) + k * lane), b = Math.round(a + lane);
        for (let p = a; p < b; p++) {
          for (let q = vertical ? lawn.top : lawn.left; q < (vertical ? lawn.bottom : lawn.right); q++) {
            const i = vertical ? q * W + p : p * W + q;
            if (!mask[i]) continue;
            tot++;
            const d = vertical ? cutV[i] : cutH[i];
            if (d > 0) pos++; else if (d < 0) neg++;
          }
        }
        const dom = pos >= neg ? 1 : -1;
        const share = Math.max(pos, neg) / Math.max(1, tot);
        if (share >= 0.82 && dom !== prev) { clean++; prev = dom; } else prev = 0;
      }
      return clean / count;
    };
    return Math.max(best(true), best(false));
  }

  function endLevel() {
    state = 'result';
    setTouch(false);
    const lvl = LEVELS[levelIndex];
    const cov = coverage();
    const met = cov >= lvl.target;
    const quality = lvl.mode === 'checker' ? cov : stripeQuality();
    const pts = {
      mowed: Math.round(cov * 1000),
      stripes: lvl.mode === 'checker' ? 0 : Math.round(quality * 500),
      time: met ? Math.max(0, Math.round(timeLeft)) * 10 : 0,
      bumps: -bumps * 50,
    };
    const total = Math.max(0, pts.mowed + pts.stripes + pts.time + pts.bumps);
    let stars = met ? 1 : 0;
    if (met && quality >= 0.6) stars++;
    if (met && quality >= 0.85 && bumps === 0) stars++;
    root.dataset.lastScore = total;

    ui.resultTitle.textContent = met ? (stars === 3 ? 'Perfect stripes.' : 'Nicely done.') : 'Out of time.';
    ui.stars.innerHTML = [0, 1, 2].map((k) => `<span class="star${k < stars ? ' is-on' : ''}" aria-hidden="true"></span>`).join('');
    ui.stars.setAttribute('aria-label', `${stars} of 3 stars`);
    const row = (label, v) => `<div><dt>${label}</dt><dd>${v > 0 && label !== 'Lawn mowed' ? '+' : ''}${v}</dd></div>`;
    ui.rows.innerHTML =
      row('Lawn mowed', pts.mowed) +
      (lvl.mode === 'checker' ? '' : row('Clean stripes', pts.stripes)) +
      row('Time left', pts.time) +
      (bumps ? row(`Bumps (${bumps})`, pts.bumps) : '') +
      `<div class="total"><dt>Score</dt><dd>${total}</dd></div>`;
    ui.next.textContent = levelIndex < LEVELS.length - 1 ? 'Next level' : 'Play again from level 1';
    ui.next.hidden = true;
    ui.week.hidden = false;
    ui.lesson.hidden = true;
    ui.retry.hidden = false;
    show(ui.result);
  }

  function startWeek() {
    hide(ui.result);
    state = 'week';
    weekView = true;
    weekT = 0;
    const cfg = HEIGHTS[height];
    const n = Math.max(1, Math.round((grassTotal / 30000) * cfg.weeds * (0.85 + Math.random() * 0.3)));
    weekWeeds = [];
    let tries = 0;
    while (weekWeeds.length < n && tries++ < n * 20) {
      const x = lawn.left + 2 + Math.floor(Math.random() * (lawn.right - lawn.left - 4));
      const y = lawn.top + 6 + Math.floor(Math.random() * (lawn.bottom - lawn.top - 9));
      if (mask[y * W + x]) weekWeeds.push({ x, y, type: Math.random() > 0.3 ? 0 : 1 });
    }
    weekScalp = cfg.scalp
      ? Array.from({ length: 5 }, (_, k) => ({
          x: lawn.left + 8 + Math.floor(Math.random() * (lawn.right - lawn.left - 16)),
          y: lawn.top + 10 + Math.floor(Math.random() * (lawn.bottom - lawn.top - 20)),
          r: 4 + Math.floor(Math.random() * 4), t: 0.3 + k * 0.12,
        }))
      : [];
    if (reduceMotion) weekT = 0.999;
  }

  function finishWeek() {
    state = 'result';
    ui.time.textContent = 'Day 7';
    ui.lesson.textContent = HEIGHTS[height].line(weekWeeds.length);
    ui.lesson.hidden = false;
    ui.week.hidden = true;
    ui.next.hidden = false;
    ui.rows.innerHTML = '';
    ui.stars.innerHTML = '';
    ui.resultTitle.textContent = 'One week later';
    show(ui.result);
  }

  /* ------------------------------------------------------------- flow */
  function openMenu() {
    state = 'menu';
    setTouch(false);
    const lvl = LEVELS[levelIndex];
    build();
    ui.menuTitle.textContent = `Level ${levelIndex + 1}: ${lvl.name}`;
    ui.menuGoal.textContent = lvl.goal;
    hide(ui.result);
    show(ui.menu);
  }

  function startLevel() {
    hide(ui.menu);
    bumps = 0; stall = 0;
    build();
    state = 'play';
    setTouch(true);
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }
  // Only grab touches while actually playing, so the page scrolls normally otherwise.
  function setTouch(on) { canvas.style.touchAction = on ? 'none' : 'pan-y'; screen.classList.toggle('is-playing', on); }

  function hud(cov = 0) {
    ui.level.textContent = `${levelIndex + 1}/${LEVELS.length}`;
    const t = Math.max(0, Math.ceil(state === 'play' ? timeLeft : timeLimit));
    ui.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    ui.pct.textContent = `${Math.floor(cov * 100)}%`;
  }

  let toastTimer;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), 900);
  }

  /* ------------------------------------------------------------ input */
  let swipe = null;
  const toLawn = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLawn(e);
    if (p.x >= blowerPos.x - 3 && p.x <= blowerPos.x + 13 && p.y >= blowerPos.y - 4 && p.y <= blowerPos.y + 10) {
      blowerPrank();
      return;
    }
    if (state !== 'play') return;
    swipe = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    swipe = { x: e.clientX, y: e.clientY }; // allow chained swipes without lifting
  });
  const endSwipe = () => { swipe = null; };
  canvas.addEventListener('pointerup', endSwipe);
  canvas.addEventListener('pointercancel', endSwipe);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, button')) return;
    const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
    if (d != null && state === 'play') { e.preventDefault(); turn(d); }
    if ((e.key === 'b' || e.key === 'B') && document.activeElement === canvas) blowerPrank();
  });

  ui.heights.forEach((b) => b.addEventListener('click', () => {
    height = Number(b.dataset.height);
    ui.heights.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  ui.start.addEventListener('click', startLevel);
  ui.week.addEventListener('click', startWeek);
  ui.retry.addEventListener('click', openMenu);
  ui.next.addEventListener('click', () => {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    openMenu();
  });

  // Pause when scrolled out of view.
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.25 }).observe(canvas);

  function blowerPrank() {
    if (!reduceMotion) {
      shake = 0.7;
      for (let k = 0; k < 44; k++) {
        particles.push({
          x: blowerPos.x, y: blowerPos.y + 3,
          vx: -40 - Math.random() * 100, vy: (Math.random() - 0.2) * 70,
          life: 0.8 + Math.random() * 0.9, c: C.leaf[k % 3],
        });
      }
    }
    ui.brap.classList.remove('is-on');
    void ui.brap.offsetWidth;
    ui.brap.classList.add('is-on');
    if (state === 'play') state = 'paused';
    setTimeout(() => ticket?.showModal?.(), reduceMotion ? 0 : 750);
  }
  ticket?.addEventListener('close', () => { if (state === 'paused') state = 'play'; });

  /* ------------------------------------------------------------- loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) {
      update(dt);
      draw(dt);
      if (shake > 0) {
        shake -= dt;
        const a = Math.round((Math.random() - 0.5) * 6);
        canvas.style.transform = shake > 0 ? `translate(${a}px, ${-a}px)` : '';
      }
    }
    requestAnimationFrame(frame);
  }

  new ResizeObserver(() => {
    const w = canvas.getBoundingClientRect().width;
    if (Math.abs(w - lastWidth) < 2) return;
    lastWidth = w;
    if (state === 'play') { build(true); } else build();
  }).observe(canvas);

  openMenu();
  requestAnimationFrame(frame);
}
