// Mow It Tall — the stripe game.
// Six yards, each with its own pattern: straight stripes, diagonals, obstacles, leaves,
// a checkerboard and a spiral. Hold to push, steer to keep every pass straight and snug.

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

const BLOWER = [
  '.....KK...',
  '....KOOK..',
  'KKKKOOOOK.',
  'SSSKOoOOOK',
  'S..KOOOOK.',
  'S...KKKK..',
];
const BLOWER_COL = { K: C.ink, O: C.blower[1], o: C.blower[0], S: C.steel[1] };

const DOG = [
  'k.........',
  'kk.....kk.',
  '.BBBBBBbk.',
  'BBBBBBBBBk',
  '.BbBBBBB..',
  '.k.k..k.k.',
];
const DOG_COL = { B: C.dog[2], b: C.dog[1], k: C.dog[3] };

/* ------------------------------------------------------------------- levels */
// pattern: vertical | diagonal | backyard | leaves | checker | spiral
// lawn: how much room the scenery takes (top band, side beds) in lawn pixels
const LEVELS = [
  {
    name: 'The starter home', pattern: 'vertical', scene: 'hedge',
    blurb: 'Flat, square, forgiving. Like a first apartment, but grass.',
    how: 'Straight up-and-down stripes. Keep each pass snug against the last one.',
    speed: 60, drift: 5, slope: 0, bumps: 0,
  },
  {
    name: 'The Victorian', pattern: 'diagonal', scene: 'victorian', top: 48,
    blurb: 'Diagonal stripes, because this house has standards.',
    how: 'Every pass runs corner to corner. Slide your thumb across the line to steer.',
    speed: 58, drift: 6, slope: 0, bumps: 0.3,
  },
  {
    name: 'The backyard', pattern: 'backyard', scene: 'shed',
    blurb: 'Two trees, a gnome, and the neighbor’s dog. None of them will move for you. Well, one will.',
    how: 'Swerve around the obstacles and get back on your line. Bumps cost points.',
    speed: 58, drift: 6, slope: 0, bumps: 0.4,
  },
  {
    name: 'Leaf season', pattern: 'leaves', scene: 'autumn', side: 22,
    blurb: 'No blower. This is Bedford. Mow the leaves right into the lawn.',
    how: 'Mow each lane twice, up and back, to chop the leaves into confetti.',
    speed: 72, drift: 6, slope: 0, bumps: 0.4,
  },
  {
    name: 'The country club', pattern: 'checker', scene: 'club', square: true,
    blurb: 'Up and down, then side to side. Very fancy. Very petty.',
    how: 'First mow every lane up and down. Then do it all again side to side.',
    speed: 62, drift: 7, slope: 0, bumps: 0.5,
  },
  {
    name: 'The spiral', pattern: 'spiral', scene: 'night', square: true,
    blurb: 'Mike’s signature move. Best done at dusk, for maximum neighbor confusion.',
    how: 'Go around in rings, outside in. Slide in and out to keep every ring even.',
    speed: 54, drift: 5, slope: 0, bumps: 0.3,
  },
];

const GRADES = [
  [95, 'Golf course material.'],
  [87, 'Neighborhood legend.'],
  [75, 'Respectable dad stripes.'],
  [60, 'The neighbors noticed. Not in a good way.'],
  [0, 'Did you mow this during a sneeze?'],
];

const TIPS = {
  vertical: 'Real-life tip: pick a target at the far end of the yard and keep your eyes on it, not the mower.',
  diagonal: 'Real-life tip: switch stripe direction every week, so the grass doesn’t lean one way and get matted down.',
  backyard: 'Real-life tip: mow a lap around trees and beds first. Then your straight passes have room to turn.',
  leaves: 'Real-life tip: mow leaves when they’re dry. If you can see grass through the confetti, you’re done.',
  checker: 'Real-life tip: taller grass shows patterns better. Set your deck to 3.5 to 4 inches.',
  spiral: 'Real-life tip: start the spiral with two laps around the outside edge, then work in.',
};

/* --------------------------------------------------------------------- game */
export function initGame(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const screen = root.querySelector('[data-screen]');
  const $ = (s) => root.querySelector(s);
  const ui = {
    level: $('[data-level]'), pass: $('[data-pass]'), score: $('[data-score]'),
    menu: $('[data-menu]'), menuTitle: $('[data-menu-title]'), menuBlurb: $('[data-menu-blurb]'),
    menuHow: $('[data-menu-how]'), menuBest: $('[data-menu-best]'),
    start: $('[data-start]'), prevYard: $('[data-prev-yard]'), nextYard: $('[data-next-yard]'),
    result: $('[data-result]'), grade: $('[data-grade]'), total: $('[data-total]'), stars: $('[data-stars]'),
    best: $('[data-best]'), tip: $('[data-tip]'), again: $('[data-again]'), next: $('[data-next]'),
    toast: $('[data-toast]'), brap: $('[data-brap]'), push: $('[data-push]'),
  };
  const ticket = document.querySelector('[data-ticket]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, img, data, staticLayer, staticAlpha, glowMask;
  let lawn, mask, cutV, cutH, uncutTone, cutVar, leaf, leafHit;
  let lane = 14, deck = 7;
  let passes = [], passIndex = 0, passScores = [], samples = [], prevMean = 0, bumpsThisPass = 0;
  let obstacles = [], dog = null, leafTotal = 0;
  let blowerPos = { x: 0, y: 0 };
  let levelIndex = 0;
  let state = 'menu'; // menu | play | turn | result | paused
  let turnT = 0, particles = [], shake = 0, bumpV = 0, stall = 0;
  let input = { x: 0, y: 0 }, keyPush = false, drag = null;
  let lastWidth = 0, seed = 1;
  const mower = { x: 0, y: 0, dir: 0, t: 0, lat: 0 };
  const pushing = () => drag !== null || keyPush;

  const store = {
    get: (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } },
  };

  /* ------------------------------------------------------------ build */
  function build() {
    const lvl = LEVELS[levelIndex];
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(2, Math.round(rect.width / 120));
    W = Math.max(100, Math.round(rect.width / scale));
    H = Math.max(140, Math.round(rect.height / scale));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    data = img.data;

    const side = lvl.side || 4;
    let top = lvl.top || 24;
    const bottom = H - 12;
    if (lvl.square) top = Math.max(top, bottom - (W - side * 2));
    lawn = { top, bottom, left: side, right: W - side };

    const n = W * H;
    mask = new Uint8Array(n);
    cutV = new Int8Array(n);
    cutH = new Int8Array(n);
    uncutTone = new Uint8Array(n);
    cutVar = new Uint8Array(n);
    leaf = new Uint8Array(n);
    leafHit = new Int16Array(n).fill(-1);
    glowMask = new Uint8Array(n);

    // obstacles for the backyard
    const lw = lawn.right - lawn.left, lh = lawn.bottom - lawn.top;
    obstacles = lvl.pattern === 'backyard'
      ? [
          { kind: 'tree', x: lawn.left + lw * 0.32, y: lawn.top + lh * 0.3, r: 9 },
          { kind: 'tree', x: lawn.left + lw * 0.7, y: lawn.top + lh * 0.68, r: 10 },
          { kind: 'gnome', x: lawn.left + lw * 0.78, y: lawn.top + lh * 0.2, r: 4 },
        ].map((o) => ({ ...o, x: Math.round(o.x), y: Math.round(o.y) }))
      : [];
    dog = null;

    leafTotal = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const inLawn = x >= lawn.left && x < lawn.right && y >= lawn.top && y < lawn.bottom;
        const blocked = obstacles.some((o) => (x - o.x) ** 2 + (y - o.y) ** 2 <= (o.r + 0.5) ** 2);
        if (inLawn && !blocked) mask[i] = 1;
        const clump = smooth(x, y, 5, 1), streak = smooth(x * 3, y, 4, 2), grain = hash(x, y, 3);
        let t = clump * 3.2 + streak * 2.2 + grain * 1.6 - 0.6;
        if (grain > 0.93) t += 1.5;
        uncutTone[i] = Math.max(0, Math.min(6, Math.floor(t)));
        cutVar[i] = hash(x, y, 4) > 0.55 ? 1 : 0;
        if (lvl.pattern === 'leaves' && mask[i] && smooth(x, y, 3, 77) + hash(x, y, 78) * 0.5 > 0.95) {
          leaf[i] = 2; leafTotal++;
        }
      }
    }
    blowerPos = { x: W - 22, y: 9 };
    buildStatic(lvl);
    passes = makePasses(lvl);
    passIndex = 0;
    placeAtPass(passes[0], 0);
    hud();
  }

  /* ----------------------------------------------------------- passes */
  function makePasses(lvl) {
    const r = { l: lawn.left + deck, rt: lawn.right - deck, t: lawn.top + deck, b: lawn.bottom - deck };
    const w = lawn.right - lawn.left, h = lawn.bottom - lawn.top;
    const list = [];
    const verticals = (doubled = false) => {
      const n = Math.max(4, Math.min(9, Math.round(w / 14)));
      lane = w / n;
      for (let k = 0; k < n; k++) {
        const x = lawn.left + lane * (k + 0.5);
        const up = { type: 'line', sx: x, sy: r.b, dx: 0, dy: -1, nx: 1, ny: 0, len: r.b - r.t, tv: -1 };
        const down = { type: 'line', sx: x, sy: r.t, dx: 0, dy: 1, nx: 1, ny: 0, len: r.b - r.t, tv: 1 };
        if (doubled) list.push({ ...up }, { ...down, same: true });
        else list.push(k % 2 === 0 ? up : down);
      }
    };
    if (lvl.pattern === 'vertical' || lvl.pattern === 'backyard') verticals();
    else if (lvl.pattern === 'leaves') verticals(true);
    else if (lvl.pattern === 'checker') {
      verticals();
      const m = Math.max(4, Math.round(h / lane));
      const laneH = h / m;
      for (let k = 0; k < m; k++) {
        const y = lawn.top + laneH * (k + 0.5);
        const right = k % 2 === 0;
        list.push({
          type: 'line', sx: right ? r.l : r.rt, sy: y, dx: right ? 1 : -1, dy: 0, nx: 0, ny: 1,
          len: r.rt - r.l, th: right ? 1 : -1, reset: k === 0,
        });
      }
    } else if (lvl.pattern === 'diagonal') {
      lane = 14;
      const s2 = Math.SQRT1_2;
      const d = [s2, -s2], nrm = [s2, s2];
      const corners = [[r.l, r.t], [r.rt, r.t], [r.l, r.b], [r.rt, r.b]].map(([x, y]) => x * nrm[0] + y * nrm[1]);
      const cmin = Math.min(...corners), cmax = Math.max(...corners);
      const count = Math.floor((cmax - cmin) / lane);
      const c0 = cmin + ((cmax - cmin) - count * lane) / 2 + lane / 2;
      let k = 0;
      for (let j = 0; j < count; j++) {
        const c = c0 + j * lane;
        const bx = nrm[0] * c, by = nrm[1] * c;
        const sx1 = (r.l - bx) / d[0], sx2 = (r.rt - bx) / d[0];
        const sy1 = (r.b - by) / d[1], sy2 = (r.t - by) / d[1];
        const smin = Math.max(Math.min(sx1, sx2), Math.min(sy1, sy2));
        const smax = Math.min(Math.max(sx1, sx2), Math.max(sy1, sy2));
        if (smax - smin < 10) continue;
        const fwd = k % 2 === 0;
        const s0 = fwd ? smin : smax;
        list.push({
          type: 'line', sx: bx + d[0] * s0, sy: by + d[1] * s0,
          dx: fwd ? d[0] : -d[0], dy: fwd ? d[1] : -d[1], nx: nrm[0], ny: nrm[1],
          len: smax - smin, tv: fwd ? -1 : 1,
        });
        k++;
      }
    } else if (lvl.pattern === 'spiral') {
      lane = 13;
      const cx = (lawn.left + lawn.right) / 2, cy = (lawn.top + lawn.bottom) / 2;
      const maxR = Math.min(w, h) / 2 - deck;
      for (let k = 0, rr = maxR; rr >= lane * 0.7; k++, rr -= lane) {
        list.push({ type: 'ring', cx, cy, r: rr, sign: k % 2 === 0 ? 1 : -1, len: Math.PI * 2 * rr, tv: k % 2 === 0 ? -1 : 1, last: rr - lane < lane * 0.7 });
      }
    }
    return list;
  }

  // position and steering normal for a pass at distance t and lateral offset lat
  function geom(p, t, lat) {
    if (p.type === 'line') {
      return { x: p.sx + p.dx * t + p.nx * lat, y: p.sy + p.dy * t + p.ny * lat, dx: p.dx, dy: p.dy, nx: p.nx, ny: p.ny };
    }
    const th = -Math.PI / 2 + p.sign * (t / p.r);
    const cs = Math.cos(th), sn = Math.sin(th);
    const rr = p.r + lat;
    return { x: p.cx + rr * cs, y: p.cy + rr * sn, dx: -sn * p.sign, dy: cs * p.sign, nx: cs, ny: sn };
  }

  function facing(dx, dy) {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  }

  function placeAtPass(p, lat) {
    mower.t = 0;
    mower.lat = lat;
    const g = geom(p, 0, lat);
    mower.x = g.x; mower.y = g.y;
    mower.dir = facing(g.dx, g.dy);
  }

  function startPass() {
    const p = passes[passIndex];
    const target = passIndex === 0 || p.reset ? 0 : prevMean;
    const miss = (Math.random() - 0.5) * lane * 0.5 * (passIndex === 0 ? 0.5 : 1);
    placeAtPass(p, Math.max(-lane, Math.min(lane, target + miss)));
    p.target = target;
    samples = [];
    bumpsThisPass = 0;
    bumpV = 0;
    seed = Math.floor(Math.random() * 1000);
    state = 'play';
    hud();
  }

  /* ------------------------------------------------------- scenery */
  function buildStatic(lvl) {
    staticLayer = new Uint8ClampedArray(W * H * 3);
    staticAlpha = new Uint8Array(W * H);
    const put = (x, y, c, glow = false) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      staticLayer[i * 3] = c[0]; staticLayer[i * 3 + 1] = c[1]; staticLayer[i * 3 + 2] = c[2];
      staticAlpha[i] = 1;
      if (glow) glowMask[i] = 1;
    };
    const band = lawn.top - 4;
    // ground everywhere that isn't lawn: mulch beds, cobble edging, curb and sidewalk
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = hash(x, y, 7), m = smooth(x, y, 3, 8);
        const mulch = C.mulch[Math.min(4, Math.floor(m * 3 + g * 2))];
        if (y < band) put(x, y, mulch);
        else if (y < lawn.top) {
          const rr = y - band;
          const seam = rr === 3 || ((x + (rr > 1 ? 2 : 0)) % 5 === 0);
          put(x, y, seam ? C.mulch[0] : C.cobble[rr === 0 ? 3 : Math.min(2, Math.floor(g * 3))]);
        } else if (y >= lawn.bottom + 3) {
          const joint = (x % 28 === 0) || y === lawn.bottom + 3;
          put(x, y, C.walk[Math.min(4, joint ? 0 : 2 + Math.floor(g * 2.2 + (y === lawn.bottom + 4 ? 1 : 0)))]);
        } else if (y >= lawn.bottom) {
          put(x, y, y === lawn.bottom ? C.curb[0] : C.curb[1]);
        } else if (x < lawn.left || x >= lawn.right) {
          const edge = x === lawn.left - 1 || x === lawn.right;
          put(x, y, edge ? C.cobble[1 + (y % 3 === 0 ? 0 : 1)] : mulch);
        }
      }
    }
    const blob = (cx, cy, rx, ry, pick) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1) continue;
        put(cx + x, cy + y, pick(x, y, d, cx + x, cy + y));
      }
    };
    const hedgeRow = (y0 = 1) => {
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
            put(x, y + y0, C.hedge[Math.max(0, Math.min(6, t))]);
          }
        }
      }
    };
    const rhodie = (cx, cy, k, rx = 9, ry = 6) => blob(cx, cy, rx, ry, (x, y, d, ax, ay) => {
      const n = smooth(ax, ay, 2, 30 + k);
      const lit = 0.6 - x / (rx * 2) - y / (ry * 2);
      if (d > 0.86) return C.hedge[1];
      return n > 0.55
        ? C.rhodie[Math.max(0, Math.min(4, Math.floor(lit * 3 + n * 2 + dither(x, y))))]
        : C.hedge[Math.max(1, Math.min(5, Math.floor(lit * 4 + 2 + dither(x, y))))];
    });
    const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, typeof c === 'function' ? c(x, y) : c); };

    if (lvl.scene === 'hedge' || lvl.scene === 'shed') {
      hedgeRow();
      [0.14, 0.5, 0.84].forEach((fx, k) => rhodie(Math.round(W * fx), 16, k));
      if (lvl.scene === 'shed') {
        const sx = W - 34, sw = 28;
        rect(sx - 2, 1, sw + 4, 5, (x, y) => C.roof[(x + y) % 3]);
        rect(sx, 6, sw, 13, (x, y) => (x - sx) % 4 === 0 ? C.barn[0] : C.barn[2]);
        rect(sx + 9, 9, 10, 10, C.trim[1]);
        rect(sx + 10, 10, 8, 9, C.barn[1]);
        rect(sx + 3, 9, 4, 4, C.trim[1]); rect(sx + 4, 10, 2, 2, C.pane[1]);
      }
    } else if (lvl.scene === 'victorian') {
      // a blue Victorian with white trim and a porch, rhododendrons out front
      const roofH = 5, porchTop = band - 14;
      rect(0, 0, W, roofH, (x, y) => C.roof[Math.floor(hash(x >> 1, y, 3) * 3)]);
      rect(0, roofH, W, 1, C.trim[0]);
      rect(0, roofH + 1, W, porchTop - roofH - 1, (x, y) => (y % 3 === 0 ? C.siding[0] : C.siding[1 + (hash(x, y, 2) > 0.8 ? 1 : 0)]));
      for (let wx = 6; wx < W - 10; wx += 20) {
        rect(wx, roofH + 4, 9, 11, C.trim[1]);
        rect(wx + 1, roofH + 5, 7, 9, (x, y) => (x === wx + 4 || y === roofH + 9) ? C.trim[1] : C.pane[(x + y) % 2]);
      }
      rect(0, porchTop, W, 2, C.trim[1]);
      rect(0, porchTop + 2, W, 10, C.siding[0]);
      for (let px = 3; px < W; px += 11) rect(px, porchTop + 2, 2, 10, C.trim[1]);
      rect(0, porchTop + 12, W, 2, C.trim[0]);
      const steps = Math.round(W / 2) - 8;
      for (let k = 0; k < 3; k++) rect(steps - k, porchTop + 12 + k * 2, 16 + k * 2, 2, C.trim[1 - (k % 2)]);
      rhodie(14, band - 3, 1, 12, 6);
      rhodie(W - 14, band - 3, 2, 12, 6);
    } else if (lvl.scene === 'autumn') {
      // maples in full color along the back
      for (let k = 0; k < 4; k++) {
        const cx = Math.round((W / 4) * (k + 0.5)), cy = 9;
        blob(cx, cy, 17, 11, (x, y, d, ax, ay) => {
          const n = smooth(ax, ay, 2, 50 + k);
          const lit = 0.65 - x / 34 - y / 22 + (n - 0.5) * 0.8;
          const t = d > 0.9 ? 0 : Math.floor(lit * 5 + dither(ax, ay) * 1.5 + 0.5);
          return C.maple[Math.max(0, Math.min(5, t))];
        });
      }
      // pumpkins in the side beds
      for (let y = lawn.top + 20; y < lawn.bottom - 10; y += 46) {
        for (const x of [Math.round(lawn.left / 2), Math.round((W + lawn.right) / 2)]) {
          blob(x, y, 4, 3, (dx, dy) => (dx === 0 || Math.abs(dx) === 2) ? C.pumpkin[0] : C.pumpkin[1]);
          put(x, y - 4, C.pumpkin[2]); put(x + 1, y - 5, C.pumpkin[2]);
        }
      }
    } else if (lvl.scene === 'club') {
      // the top of the yard is the course: rough, a bunker, a green and a flag
      rect(0, 0, W, band, (x, y) => C.rough[Math.min(3, Math.floor(smooth(x, y, 4, 60) * 3 + hash(x, y, 61)))]);
      blob(Math.round(W * 0.26), Math.round(band * 0.62), 16, 7, (x, y, d, ax, ay) => d > 0.82 ? C.sand[0] : C.sand[1 + (hash(ax, ay, 62) > 0.6 ? 1 : 0)]);
      const gx = Math.round(W * 0.66), gy = Math.round(band * 0.42);
      blob(gx, gy, 20, 11, (x, y, d, ax, ay) => d > 0.88 ? C.green[0] : C.green[1 + ((ax + ay) % 6 < 3 ? 1 : 0)]);
      rect(gx, gy - 16, 1, 16, C.trim[1]);
      for (let k = 0; k < 5; k++) rect(gx + 1, gy - 16 + k, 7 - k, 1, C.flag[0]);
      put(gx + 4, gy + 2, C.trim[1]); put(gx + 5, gy + 2, C.trim[0]);
    } else if (lvl.scene === 'night') {
      // dusk: dark woods, a red barn with the light on, a split-rail fence
      rect(0, 0, W, band, (x, y) => C.night[Math.min(3, Math.floor(smooth(x, y, 5, 70) * 3 + (y / band) * 1.5))]);
      const bx = Math.round(W * 0.58), bw = 30, by = Math.max(4, band - 34);
      for (let y = 0; y < 8; y++) rect(bx - y + 4, by + y, bw - 8 + y * 2, 1, C.roof[1]);
      rect(bx, by + 8, bw, 22, (x, y) => (x - bx) % 4 === 0 ? C.barn[0] : C.barn[1]);
      rect(bx, by + 8, 1, 22, C.trim[0]); rect(bx + bw - 1, by + 8, 1, 22, C.trim[0]);
      rect(bx + 9, by + 14, 12, 16, C.trim[0]);
      for (let y = by + 15; y < by + 30; y++) for (let x = bx + 10; x < bx + 20; x++) put(x, y, C.glow[hash(x, y, 71) > 0.7 ? 1 : 0], true);
      for (let y = by + 6; y < by + 8; y++) for (let x = bx + 13; x < bx + 17; x++) put(x, y, C.glow[1], true);
      // fence rails just above the lawn
      for (let x = 0; x < W; x++) {
        put(x, band - 9, C.rail[1]); put(x, band - 5, C.rail[1]);
        if (x % 18 === 4) for (let y = band - 12; y < band; y++) put(x, y, C.rail[(y & 1) ? 0 : 2]), put(x + 1, y, C.rail[0]);
      }
    }
    // the gas blower hiding somewhere up top (every yard has one)
    for (let y = 0; y < BLOWER.length; y++) for (let x = 0; x < BLOWER[y].length; x++) {
      const ch = BLOWER[y][x];
      if (ch !== '.') put(blowerPos.x + x, blowerPos.y + y, BLOWER_COL[ch]);
    }
  }

  /* ----------------------------------------------------------- render */
  function px(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  function darken(x, y, k) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    data[o] *= k; data[o + 1] *= k; data[o + 2] *= k;
  }

  function draw(dt) {
    const lvl = LEVELS[levelIndex];
    for (let i = 0, n = W * H; i < n; i++) {
      const o = i * 4;
      let c;
      if (staticAlpha[i]) {
        const s = i * 3;
        data[o] = staticLayer[s]; data[o + 1] = staticLayer[s + 1]; data[o + 2] = staticLayer[s + 2]; data[o + 3] = 255;
        continue;
      }
      const v = cutV[i], h = cutH[i];
      if (!v && !h) c = C.uncut[uncutTone[i]];
      else {
        // light when the grass leans away from you, dark when it leans toward you
        const t = Math.max(0, Math.min(4, 2 - v * 2 - h));
        c = (cutVar[i] ? C.cutAlt : C.cut)[t];
      }
      const lf = leaf[i];
      if (lf === 2) c = C.leafLawn[Math.floor(hash(i % W >> 1, (i / W) >> 1, 79) * 5)];
      else if (lf === 1 && hash(i, 0, 80) > 0.55) c = C.chopped[i & 1];
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    if (lvl.scene !== 'club' && lvl.scene !== 'night') {
      for (let y = lawn.top; y < lawn.top + 6; y++) {
        const k = 0.72 + (y - lawn.top) * 0.05;
        for (let x = lawn.left; x < lawn.right; x++) if (dither(x, y) < 0.9 - (y - lawn.top) * 0.12) darken(x, y, k);
      }
    }
    drawObstacles();
    drawMower();
    drawParticles(dt);
    if (lvl.scene === 'night') nightTint();
    ctx.putImageData(img, 0, 0);
  }

  function nightTint() {
    // porch light from the bottom of the screen, everything else falls off into dusk
    const lx = W / 2, ly = H + 10, reach = H * 1.05;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (glowMask[i]) continue;
      const d = Math.hypot(x - lx, y - ly) / reach;
      const k = 0.38 + 0.62 * Math.max(0, 1 - d * d);
      const o = i * 4;
      data[o] *= k * 0.92; data[o + 1] *= k; data[o + 2] *= Math.min(1, k * 1.08);
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.kind === 'tree') {
        for (let y = -o.r; y <= o.r; y++) for (let x = -o.r; x <= o.r; x++) {
          if (x * x + y * y <= o.r * o.r && dither(x, y) < 0.75) darken(o.x + x + 4, o.y + y + 5, 0.6);
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
        const G = ['...H...', '..HhH..', '.HHhHH.', '.FsssF.', '.BbbbB.', 'CBbbbBC', 'CCBbBCC', '.CCCCC.', '.K...K.'];
        const col = { H: C.gnomeHat[1], h: C.gnomeHat[0], F: C.skin, s: C.skin, B: C.gnomeBeard[1], b: C.gnomeBeard[0], C: C.gnomeCoat[1], K: C.ink };
        G.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) px(o.x - 3 + x, o.y - 5 + y, col[ch]); }));
      }
    }
    if (dog) {
      const flip = dog.vx < 0;
      DOG.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const xx = flip ? row.length - 1 - x : x;
        darken(dog.x + xx + 1, dog.y + y + 2, 0.7);
        px(dog.x + xx, dog.y + y, DOG_COL[ch]);
      }));
    }
  }

  function drawMower() {
    const map = MOWER[mower.dir];
    const [ax, ay] = MOWER_ANCHOR[mower.dir];
    const ox = Math.round(mower.x) - ax, oy = Math.round(mower.y) - ay;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.' && ch !== 'G' && ch !== 'g') darken(ox + x + 2, oy + y + 2, 0.6);
    }
    const jitter = state === 'play' && pushing() && stall <= 0 && !reduceMotion && (performance.now() / 60 | 0) % 2 ? 1 : 0;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.') px(ox + x + (mower.dir % 2 ? jitter : 0), oy + y + (mower.dir % 2 ? 0 : jitter), MOWER_COL[ch]);
    }
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      px(p.x, p.y, p.c);
    }
  }

  /* ----------------------------------------------------------- update */
  function cutAt(g, p) {
    const cx = Math.round(mower.x), cy = Math.round(mower.y);
    let fresh = 0, chopped = 0;
    for (let y = cy - deck; y < cy + deck; y++) {
      for (let x = cx - deck; x < cx + deck; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!mask[i]) continue;
        if (!cutV[i] && !cutH[i]) fresh++;
        if (p.th) cutH[i] = p.th;
        else cutV[i] = p.tv;
        // each pass chops a leaf one step: whole, then confetti, then gone
        if (leaf[i] && leafHit[i] !== passIndex) { leaf[i]--; leafHit[i] = passIndex; chopped++; }
      }
    }
    if ((fresh || chopped) && !reduceMotion && particles.length < 140) {
      const sx = -g.dy, sy = g.dx; // discharge chute on the mower's right
      particles.push({
        x: cx + sx * (deck + 1), y: cy + sy * (deck + 1),
        vx: sx * (25 + Math.random() * 30) + (Math.random() - 0.5) * 12,
        vy: sy * (25 + Math.random() * 30) + (Math.random() - 0.5) * 12,
        life: 0.35 + Math.random() * 0.3,
        c: chopped ? C.leafLawn[Math.floor(Math.random() * 4)] : C.clip[Math.floor(Math.random() * 3)],
      });
    }
  }

  function updateDog(dt) {
    if (LEVELS[levelIndex].pattern !== 'backyard') return;
    if (!dog && Math.random() < dt * 0.22) {
      const fromLeft = Math.random() > 0.5;
      dog = {
        x: fromLeft ? lawn.left - 10 : lawn.right,
        y: Math.round(lawn.top + 10 + Math.random() * (lawn.bottom - lawn.top - 24)),
        vx: fromLeft ? 46 : -46,
      };
    }
    if (dog) {
      dog.x += dog.vx * dt;
      if (dog.x < lawn.left - 14 || dog.x > lawn.right + 4) dog = null;
    }
  }

  function bump(msg) {
    bumpsThisPass++;
    stall = 0.5;
    shake = reduceMotion ? 0 : 0.22;
    mower.t = Math.max(0, mower.t - 4);
    toast(`${msg} −15`);
  }

  function update(dt) {
    if (state === 'turn') {
      turnT -= dt;
      if (turnT <= 0) startPass();
      return;
    }
    if (state !== 'play') return;
    const lvl = LEVELS[levelIndex];
    const p = passes[passIndex];
    updateDog(dt);
    const moving = pushing();
    ui.push?.classList.toggle('is-on', !moving);
    let g = geom(p, mower.t, mower.lat);
    // keyboard steering works even while parked, so you can line up first
    mower.lat += (input.x * g.nx + input.y * g.ny) * 34 * dt;
    if (stall > 0) { stall -= dt; }
    else if (moving) {
      let drift = (smooth(mower.t, 0, 14, seed) - 0.5) * 2 * lvl.drift + lvl.slope;
      if (lvl.bumps && Math.random() < lvl.bumps * dt) bumpV += (Math.random() > 0.5 ? 1 : -1) * (14 + Math.random() * 10);
      bumpV *= Math.pow(0.04, dt);
      mower.lat += (drift + bumpV) * dt;
      mower.t += lvl.speed * dt;
    }
    mower.lat = Math.max(-lane * 1.3, Math.min(lane * 1.3, mower.lat));
    g = geom(p, Math.min(mower.t, p.len), mower.lat);
    // keep the deck on the lawn
    for (let k = 0; k < 12 && (g.x < lawn.left + deck || g.x > lawn.right - deck || g.y < lawn.top + deck || g.y > lawn.bottom - deck); k++) {
      mower.lat *= 0.8;
      g = geom(p, Math.min(mower.t, p.len), mower.lat);
    }
    mower.x = g.x; mower.y = g.y;
    mower.dir = facing(g.dx, g.dy);

    if (moving && stall <= 0) {
      // after three bumps in one pass, you squeeze by (and keep the penalty)
      const hitObs = bumpsThisPass < 3 && obstacles.find((o) => Math.hypot(g.x - o.x, g.y - o.y) < o.r + deck - 1);
      if (hitObs) {
        // get knocked a little to the side so you can work around it
        const side = (g.x - hitObs.x) * g.nx + (g.y - hitObs.y) * g.ny;
        let dir = side >= 0 ? 1 : -1;
        if (Math.abs(mower.lat + dir * 4) > lane * 1.25) dir = -dir;
        mower.lat += dir * 4;
        return bump(hitObs.kind === 'gnome' ? 'Sorry, gnome.' : 'Bonk.');
      }
      if (dog && Math.abs(dog.x + 5 - g.x) < deck + 4 && Math.abs(dog.y + 3 - g.y) < deck + 2) {
        dog.vx *= 1.8;
        return bump('The dog is fine. Your score isn’t.');
      }
      // swerving around obstacles doesn't count against straightness
      const near = obstacles.some((o) => Math.hypot(g.x - o.x, g.y - o.y) < o.r + deck + 14);
      samples.push({ lat: mower.lat, near });
      cutAt(g, p);
    }
    if (mower.t >= p.len) finishPass();
  }

  function finishPass() {
    const p = passes[passIndex];
    const counted = samples.filter((s) => !s.near);
    const use = counted.length > 4 ? counted : samples;
    const mean = use.reduce((a, s) => a + s.lat, 0) / Math.max(1, use.length);
    const wobble = use.reduce((a, s) => a + Math.abs(s.lat - mean), 0) / Math.max(1, use.length);
    const straight = Math.max(0, 1 - wobble / 3.5);
    const offset = mean - (p.target || 0);
    const spacing = Math.max(0, 1 - Math.abs(offset) / (lane * 0.45));
    const score = Math.max(0, Math.round((straight * 0.65 + spacing * 0.35) * 100) - bumpsThisPass * 15);
    passScores.push(score);
    prevMean = mean;
    if (p.last) finishSpiralCenter(p);

    let note = score >= 95 ? 'Laser straight' : score >= 85 ? 'Clean' : score >= 70 ? 'Bit wobbly' : score >= 50 ? 'Wobbly' : 'Yikes';
    if (spacing < 0.6) note += (p.same ? ', missed your lane' : offset > 0 ? ', gap' : ', overlap');
    toast(`${score}  ${note}`);
    passIndex++;
    hud();
    if (passIndex >= passes.length) return endLevel();
    ui.push?.classList.remove('is-on');
    state = 'turn';
    turnT = 0.4;
  }

  function finishSpiralCenter(p) {
    // the last little circle in the middle gets mowed with the final ring
    const rr = Math.max(0, p.r - deck + 1);
    for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
      if (x * x + y * y > rr * rr) continue;
      const i = Math.round(p.cy + y) * W + Math.round(p.cx + x);
      if (mask[i]) cutV[i] = -p.tv;
    }
  }

  function endLevel() {
    state = 'result';
    ui.push?.classList.remove('is-on');
    setTouch(false);
    const lvl = LEVELS[levelIndex];
    let avg = Math.round(passScores.reduce((a, b) => a + b, 0) / passScores.length);
    let extra = '';
    if (lvl.pattern === 'leaves') {
      let left = 0;
      for (let i = 0; i < leaf.length; i++) if (leaf[i]) left++;
      const mulched = leafTotal ? 1 - left / leafTotal : 1;
      avg = Math.round(avg * 0.6 + mulched * 40);
      extra = `Leaves mulched: ${Math.round(mulched * 100)}%. `;
    }
    const total = avg * 10;
    const key = `mit-best-${levelIndex}`;
    const prevBest = store.get(key);
    if (total > prevBest) store.set(key, total);
    const stars = avg >= 90 ? 3 : avg >= 75 ? 2 : avg >= 55 ? 1 : 0;
    ui.grade.textContent = GRADES.find(([min]) => avg >= min)[1];
    ui.total.textContent = total;
    ui.stars.innerHTML = [0, 1, 2].map((k) => `<span class="star${k < stars ? ' is-on' : ''}"></span>`).join('');
    ui.stars.setAttribute('aria-label', `${stars} of 3 stars`);
    ui.best.textContent = extra + (total > prevBest
      ? (prevBest ? `New best on this yard. Old best: ${prevBest}.` : 'Your first score on this yard.')
      : `Your best on this yard: ${prevBest}.`);
    ui.tip.textContent = TIPS[lvl.pattern];
    ui.next.textContent = levelIndex < LEVELS.length - 1 ? 'Next yard' : 'Back to yard 1';
    show(ui.result);
  }

  /* ------------------------------------------------------------- flow */
  function openMenu() {
    state = 'menu';
    setTouch(false);
    build();
    const lvl = LEVELS[levelIndex];
    ui.menuTitle.textContent = `Yard ${levelIndex + 1}: ${lvl.name}`;
    ui.menuBlurb.textContent = lvl.blurb;
    ui.menuHow.textContent = lvl.how;
    const best = store.get(`mit-best-${levelIndex}`);
    ui.menuBest.textContent = best ? `Your best: ${best}` : '';
    ui.menuBest.hidden = !best;
    hide(ui.result);
    show(ui.menu);
  }

  function startLevel() {
    hide(ui.menu);
    build();
    passScores = []; prevMean = 0; particles = [];
    setTouch(true);
    startPass();
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }
  function setTouch(on) { canvas.style.touchAction = on ? 'none' : 'pan-y'; screen.classList.toggle('is-playing', on); }

  function hud() {
    ui.level.textContent = `${levelIndex + 1}/${LEVELS.length}`;
    const shown = state === 'menu' ? 0 : Math.min(passIndex + 1, passes.length);
    ui.pass.textContent = `${shown}/${passes.length}`;
    const avg = passScores.length ? Math.round(passScores.reduce((a, b) => a + b, 0) / passScores.length) : 0;
    ui.score.textContent = passScores.length ? avg * 10 : '–';
  }

  let toastTimer;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), 1100);
  }

  /* ------------------------------------------------------------ input */
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
    if (state !== 'play' && state !== 'turn') return;
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (state === 'play') {
      const r = canvas.getBoundingClientRect();
      // slide across your line to steer: only the part of the drag that crosses the pass counts
      const ddx = ((e.clientX - drag.x) / r.width) * W;
      const ddy = ((e.clientY - drag.y) / r.height) * H;
      const g = geom(passes[passIndex], Math.min(mower.t, passes[passIndex].len), mower.lat);
      mower.lat += ddx * g.nx + ddy * g.ny;
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, button')) return;
    if (state === 'play' || state === 'turn') {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (k) { input.x = k[0] || input.x; input.y = k[1] || input.y; e.preventDefault(); }
      if (e.key === ' ') { keyPush = true; e.preventDefault(); }
    }
    if ((e.key === 'b' || e.key === 'B') && document.activeElement === canvas) blowerPrank();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') input.x = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') input.y = 0;
    if (e.key === ' ') keyPush = false;
  });

  ui.start.addEventListener('click', startLevel);
  ui.again.addEventListener('click', () => { hide(ui.result); startLevel(); });
  ui.next.addEventListener('click', () => { levelIndex = (levelIndex + 1) % LEVELS.length; openMenu(); });
  ui.prevYard?.addEventListener('click', () => { levelIndex = (levelIndex - 1 + LEVELS.length) % LEVELS.length; openMenu(); });
  ui.nextYard?.addEventListener('click', () => { levelIndex = (levelIndex + 1) % LEVELS.length; openMenu(); });

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
    if (state === 'play' || state === 'turn') state = 'paused';
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
    if (state === 'menu') build();
  }).observe(canvas);

  openMenu();
  requestAnimationFrame(frame);
}
