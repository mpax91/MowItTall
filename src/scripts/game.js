// Mow It Tall — the stripe game.
// Pull-start the mower, then paint the stripes yourself: drag to drive, and every straight
// pass you lay down gets scored. Eight yards, from a starter home to a snowy Christmas lawn.
import { C, hash, smooth, dither, MOWER, MOWER_COL, MOWER_ANCHOR, BLOWER, BLOWER_COL } from './pixelkit.js';
import { saveScore } from './leaderboard.js';

/* ------------------------------------------------------------------ sprites */
const S = {
  dog: { map: ['k.........', 'kk.....kk.', '.BBBBBBbk.', 'BBBBBBBBBk', '.BbBBBBB..', '.k.k..k.k.'], col: { B: C.dog[2], b: C.dog[1], k: C.dog[3] } },
  turkey: {
    map: ['.kTkTk...', 'kTOTOTk..', 'kOTkTOk..', '.kkBBkkk.', '..kBBBWHk', '..kBbBkRk', '...kBBk..', '...y..y..'],
    col: { k: C.ink, T: C.turkey[0], O: C.turkey[4], B: C.turkey[1], b: C.turkey[0], H: C.turkey[5], W: C.trim[1], R: C.turkey[3], y: C.turkey[4] },
  },
  ghost: { map: ['..WWWW..', '.WWWWWW.', 'WWkWWkWW', 'WWWWWWWW', 'WWWkkWWW', 'WWWWWWWW', 'WWWWWWWW', 'W.WW.WW.'], col: { W: C.ghost[1], k: C.ghost[2] } },
  stone: { map: ['.SSSS.', 'SsSSsS', 'SSssSS', 'SsSSsS', 'SSSSSS', 'SSSSSS', 'ssssss'], col: { S: C.stone[1], s: C.stone[0] } },
  jack: { map: ['...g...', '.OOgOO.', 'OOOOOOO', 'OyOOOyO', 'OOOOOOO', 'OyyyyyO', '.OOOOO.'], col: { O: C.pumpkin[1], g: C.pumpkin[2], y: C.glow[0] } },
  snowman: {
    map: ['..kk..', '.kkkk.', '.WkWW.', '.WWOW.', '..WW..', '.WWkWW', 'WWWWWW', 'WWkWWW', '.WWWW.'],
    col: { W: C.snow[2], k: C.ink, O: C.blower[1] },
  },
  sleigh: {
    map: ['.R...........R..', 'RRR.........RRR.', '.B..rrrrrRSS.B..', '.BBBrrrrrRSSBB..', '..BrrrrrrrrrrB..', '...yyyyyyyyyy...'],
    col: { R: C.dog[1], B: C.dog[2], r: C.red[2], S: C.red[3], y: C.glow[0] },
  },
  gnome: {
    map: ['...H...', '..HhH..', '.HHhHH.', '.FsssF.', '.BbbbB.', 'CBbbbBC', 'CCBbBCC', '.CCCCC.', '.K...K.'],
    col: { H: C.gnomeHat[1], h: C.gnomeHat[0], F: C.skin, s: C.skin, B: C.gnomeBeard[1], b: C.gnomeBeard[0], C: C.gnomeCoat[1], K: C.ink },
  },
};

const UP = [0, -1], RIGHT = [1, 0], D1 = [Math.SQRT1_2, -Math.SQRT1_2], D2 = [-Math.SQRT1_2, -Math.SQRT1_2];

/* ------------------------------------------------------------------- levels */
// axes: the stripe directions this yard wants. Mowing along an axis lays a light stripe,
// mowing back lays a dark one. layer: leaves (two passes to mulch) or snow (one pass).
const LEVELS = [
  {
    id: 'starter', name: 'The starter home', short: 'Starter home', scene: 'hedge', axes: [UP],
    blurb: 'Flat, square, forgiving. Like a first apartment, but grass.',
    how: 'Paint straight stripes up and down the lawn.',
  },
  {
    id: 'victorian', name: 'The Victorian', short: 'Victorian', scene: 'victorian', top: 48, axes: [D1],
    blurb: 'Diagonal stripes, because this house has standards.',
    how: 'Paint every stripe corner to corner, on the diagonal.',
  },
  {
    id: 'backyard', name: 'The backyard', short: 'Backyard', scene: 'shed', axes: [UP],
    blurb: 'Two trees, a gnome and the neighbor’s dog supervising.',
    how: 'Straight stripes up and down. Mow around the trees and the gnome. The dog will get out of your way.',
    statics: [['tree', 0.32, 0.3, 9], ['tree', 0.7, 0.68, 10], ['gnome', 0.78, 0.2, 4]], movers: 'dog',
  },
  {
    id: 'ballpark', name: 'The ballpark', short: 'Ballpark', scene: 'ballpark', top: 30, axes: [D1, D2],
    blurb: 'Big league criss-cross. Stay off the infield dirt.',
    how: 'Paint diagonal stripes one way, then cross them the other way.',
    infield: true,
  },
  {
    id: 'club', name: 'The country club', short: 'Country club', scene: 'club', square: true, axes: [UP, RIGHT], both: true,
    blurb: 'Up and down, then side to side. Very fancy. Very petty.',
    how: 'Mow it all up and down, then all again side to side for a checkerboard.',
  },
  {
    id: 'halloween', name: 'The haunted lawn', short: 'Halloween', scene: 'halloween', axes: [UP], layer: 'leaves',
    blurb: 'Leaves everywhere, a few tombstones, and something floating around. Don’t mind it.',
    how: 'Straight stripes up and down. Mow over each strip twice to chop the leaves into confetti.',
    statics: [['stone', 0.25, 0.35, 4], ['stone', 0.72, 0.55, 4], ['jack', 0.5, 0.78, 4]], movers: 'ghost',
  },
  {
    id: 'thanksgiving', name: 'The turkey trot', short: 'Thanksgiving', scene: 'autumn', side: 18, axes: [UP], layer: 'leaves',
    blurb: 'Fall leaves and three turkeys who refuse to leave. Gobble gobble.',
    how: 'Straight stripes up and down. Mow over each strip twice to mulch the leaves. The turkeys will move.',
    movers: 'turkeys',
  },
  {
    id: 'christmas', name: 'The snow day', short: 'Christmas', scene: 'snowday', top: 48, axes: [UP], layer: 'snow',
    blurb: 'Nobody mows in December. You’re not nobody. Watch for the sleigh.',
    how: 'Clear every bit of snow in straight stripes up and down. Mow around the snowman.',
    statics: [['snowman', 0.72, 0.4, 5]], movers: 'santa',
  },
];

const GRADES = [
  [920, 'Golf course material.'],
  [820, 'Neighborhood legend.'],
  [700, 'Respectable dad stripes.'],
  [550, 'The neighbors noticed. Not in a good way.'],
  [0, 'Did you mow this during a sneeze?'],
];

const TIPS = {
  starter: 'Real-life tip: pick a target at the far end of the yard and walk toward it. Don’t stare at the mower.',
  victorian: 'Real-life tip: change your stripe direction every week so the grass doesn’t lean one way.',
  backyard: 'Real-life tip: mow a lap around trees and beds first, then your straight passes have room to turn.',
  ballpark: 'Real-life tip: stripes are just grass bent in different directions. A roller behind the mower makes them pop.',
  club: 'Real-life tip: taller grass shows patterns better. Set your deck to 3.5 to 4 inches.',
  halloween: 'Real-life tip: mow leaves when they’re dry. If you can see grass through the confetti, you’re done.',
  thanksgiving: 'Real-life tip: a light layer of chopped leaves feeds the lawn for free. Big piles? Blow or rake them off first.',
  christmas: 'Real-life tip: please don’t actually mow in the snow. Do the last cut of the year in November, a notch lower.',
};

/* --------------------------------------------------------------------- game */
export function initGame(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const screen = root.querySelector('[data-screen]');
  const $ = (s) => root.querySelector(s);
  const ui = {
    level: $('[data-level]'), pct: $('[data-pct]'), time: $('[data-time]'),
    picker: $('[data-picker]'), pickList: $('[data-pick-list]'), random: $('[data-random]'),
    ready: $('[data-ready]'), readyTitle: $('[data-ready-title]'), readyBlurb: $('[data-ready-blurb]'),
    readyHow: $('[data-ready-how]'), readyBest: $('[data-ready-best]'), cord: $('[data-cord]'), back: $('[data-back]'),
    result: $('[data-result]'), grade: $('[data-grade]'), total: $('[data-total]'), stars: $('[data-stars]'),
    detail: $('[data-detail]'), tip: $('[data-tip]'), again: $('[data-again]'), pick: $('[data-pick]'),
    toast: $('[data-toast]'), brap: $('[data-brap]'), push: $('[data-push]'),
  };
  const ticket = document.querySelector('[data-ticket]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, img, data, staticLayer, staticAlpha, overlay;
  let lawn, mask, cut, toneA, toneB, uncutTone, cutVar, layer, layerHit, grassTotal;
  const deck = 6;
  let level = LEVELS[0];
  let statics = [], movers = [];
  let blowerPos = { x: 0, y: 0 };
  let state = 'picker'; // picker | ready | play | result | paused
  let timeLeft = 0, timeLimit = 0, bumps = 0, stall = 0;
  let particles = [], shake = 0, smokeT = 0, coverT = 0, coverage = 0, flakes = [];
  let strokes = [], stroke = null, strokeId = 0;
  let target = null, drag = null, keys = { x: 0, y: 0 }, moved = false;
  let lastWidth = 0;
  const mower = { x: 0, y: 0, dir: 0, hx: 0, hy: -1 };

  const store = {
    get: (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } },
  };

  // yard picker buttons
  ui.pickList.innerHTML = LEVELS.map((l, i) => `<button type="button" class="pick" data-i="${i}">${l.short}</button>`).join('');

  /* ------------------------------------------------------------ build */
  function build() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(2, Math.round(rect.width / 120));
    W = Math.max(100, Math.round(rect.width / scale));
    H = Math.max(140, Math.round(rect.height / scale));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    data = img.data;

    const side = level.side || 4;
    let top = level.top || 24;
    const bottom = H - 12;
    if (level.square) top = Math.max(top, bottom - (W - side * 2));
    lawn = { top, bottom, left: side, right: W - side };
    const lw = lawn.right - lawn.left, lh = lawn.bottom - lawn.top;

    const n = W * H;
    mask = new Uint8Array(n);
    cut = new Uint8Array(n);
    toneA = new Int8Array(n);
    toneB = new Int8Array(n);
    uncutTone = new Uint8Array(n);
    cutVar = new Uint8Array(n);
    layer = new Uint8Array(n);
    layerHit = new Int32Array(n).fill(-1);
    overlay = new Uint8Array(n); // chalk lines drawn on top of the grass

    statics = (level.statics || []).map(([kind, fx, fy, r]) => ({ kind, r, x: Math.round(lawn.left + fx * lw), y: Math.round(lawn.top + fy * lh) }));
    movers = [];

    // ballpark: infield dirt diamond with bases, foul lines in chalk
    const home = { x: Math.round((lawn.left + lawn.right) / 2), y: lawn.bottom - 4 };
    const dia = Math.round(Math.min(lw * 0.36, lh * 0.3));
    const dc = { x: home.x, y: home.y - dia };
    level._diamond = { home, dia, dc };

    grassTotal = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let ok = x >= lawn.left && x < lawn.right && y >= lawn.top && y < lawn.bottom;
        if (ok && statics.some((o) => (x - o.x) ** 2 + (y - o.y) ** 2 <= (o.r + 0.5) ** 2)) ok = false;
        if (ok && level.infield) {
          const m = Math.abs(x - dc.x) + Math.abs(y - dc.y);
          const onPath = m <= dia + 4 && m >= dia - 4;
          const nearHome = (x - home.x) ** 2 + (y - home.y) ** 2 < 64;
          const mound = (x - dc.x) ** 2 + (y - dc.y) ** 2 < 16;
          if (onPath || nearHome || mound) ok = false;
          if (ok && (Math.abs((x - home.x) + (y - home.y)) < 1 || Math.abs((x - home.x) - (y - home.y)) < 1) && y < home.y) overlay[i] = 1;
        }
        if (ok) { mask[i] = 1; grassTotal++; }
        const clump = smooth(x, y, 5, 1), streak = smooth(x * 3, y, 4, 2), grain = hash(x, y, 3);
        let t = clump * 3.2 + streak * 2.2 + grain * 1.6 - 0.6;
        if (grain > 0.93) t += 1.5;
        uncutTone[i] = Math.max(0, Math.min(6, Math.floor(t)));
        cutVar[i] = hash(x, y, 4) > 0.55 ? 1 : 0;
        if (ok && level.layer === 'leaves' && smooth(x, y, 3, 77) + hash(x, y, 78) * 0.5 > 0.82) layer[i] = 2;
        if (ok && level.layer === 'snow' && smooth(x, y, 6, 90) + hash(x, y, 91) * 0.3 > 0.32) layer[i] = 1;
      }
    }
    blowerPos = { x: W - 22, y: 9 };
    buildStatic();
    mower.x = lawn.left + 8;
    mower.y = lawn.bottom - 8;
    mower.dir = 0; mower.hx = 0; mower.hy = -1;
    flakes = level.layer === 'snow' ? Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 6 + Math.random() * 8 })) : [];
    timeLimit = Math.round((grassTotal / (deck * 2 * 70)) * (level.both || level.axes.length > 1 ? 2.2 : 1.6) * (level.layer === 'leaves' ? 1.8 : 1) + 15);
    timeLeft = timeLimit;
    hud();
  }

  /* ------------------------------------------------------- scenery */
  function buildStatic() {
    staticLayer = new Uint8ClampedArray(W * H * 3);
    staticAlpha = new Uint8Array(W * H);
    const put = (x, y, c) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      staticLayer[i * 3] = c[0]; staticLayer[i * 3 + 1] = c[1]; staticLayer[i * 3 + 2] = c[2];
      staticAlpha[i] = 1;
    };
    const band = lawn.top - 4;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = hash(x, y, 7), m = smooth(x, y, 3, 8);
        const mulch = C.mulch[Math.min(4, Math.floor(m * 3 + g * 2))];
        const i = y * W + x;
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
        } else if (level.infield && !mask[i] && !statics.some((o) => (x - o.x) ** 2 + (y - o.y) ** 2 <= (o.r + 0.5) ** 2)) {
          put(x, y, C.dirt[Math.floor(hash(x, y, 33) * 3 + smooth(x, y, 3, 34))]);
        }
      }
    }
    const blob = (cx, cy, rx, ry, pick) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d <= 1) put(cx + x, cy + y, pick(x, y, d, cx + x, cy + y));
      }
    };
    const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, typeof c === 'function' ? c(x, y) : c); };
    const hedgeRow = () => {
      for (let x0 = -4; x0 < W + 6; x0 += 10) {
        const h = 15 + Math.floor(hash(x0, 1, 2) * 5), cx = x0 + 5;
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
    };
    const rhodie = (cx, cy, k, rx = 9, ry = 6) => blob(cx, cy, rx, ry, (x, y, d, ax, ay) => {
      const nn = smooth(ax, ay, 2, 30 + k);
      const lit = 0.6 - x / (rx * 2) - y / (ry * 2);
      if (d > 0.86) return C.hedge[1];
      return nn > 0.55
        ? C.rhodie[Math.max(0, Math.min(4, Math.floor(lit * 3 + nn * 2 + dither(x, y))))]
        : C.hedge[Math.max(1, Math.min(5, Math.floor(lit * 4 + 2 + dither(x, y))))];
    });
    const house = (snowy) => {
      const roofH = 5, porchTop = band - 14;
      rect(0, 0, W, roofH, (x, y) => snowy ? C.snow[(x + y) % 3] : C.roof[Math.floor(hash(x >> 1, y, 3) * 3)]);
      rect(0, roofH, W, 1, C.trim[0]);
      rect(0, roofH + 1, W, porchTop - roofH - 1, (x, y) => (y % 3 === 0 ? C.siding[0] : C.siding[1 + (hash(x, y, 2) > 0.8 ? 1 : 0)]));
      for (let wx = 6; wx < W - 10; wx += 20) {
        rect(wx, roofH + 4, 9, 11, C.trim[1]);
        rect(wx + 1, roofH + 5, 7, 9, (x, y) => (x === wx + 4 || y === roofH + 9) ? C.trim[1] : (snowy ? C.glow[(x + y) % 2] : C.pane[(x + y) % 2]));
      }
      rect(0, porchTop, W, 2, C.trim[1]);
      rect(0, porchTop + 2, W, 10, C.siding[0]);
      for (let px = 3; px < W; px += 11) rect(px, porchTop + 2, 2, 10, C.trim[1]);
      rect(0, porchTop + 12, W, 2, C.trim[0]);
      const steps = Math.round(W / 2) - 8;
      for (let k = 0; k < 3; k++) rect(steps - k, porchTop + 12 + k * 2, 16 + k * 2, 2, C.trim[1 - (k % 2)]);
      if (snowy) for (let x = 1; x < W; x += 3) put(x, porchTop + (x % 6 < 3 ? 1 : 2), C.lights[(x / 3 | 0) % 4]);
      rhodie(14, band - 3, 1, 12, 6);
      rhodie(W - 14, band - 3, 2, 12, 6);
      if (snowy) { for (let x = 2; x < 26; x++) put(x, band - 9 + Math.round(Math.sin(x) * 0.5), C.snow[2]); for (let x = W - 26; x < W - 2; x++) put(x, band - 9, C.snow[2]); }
    };

    switch (level.scene) {
      case 'hedge':
      case 'shed':
        hedgeRow();
        [0.14, 0.5, 0.84].forEach((fx, k) => rhodie(Math.round(W * fx), 16, k));
        if (level.scene === 'shed') {
          const sx = W - 34, sw = 28;
          rect(sx - 2, 1, sw + 4, 5, (x, y) => C.roof[(x + y) % 3]);
          rect(sx, 6, sw, 13, (x) => (x - sx) % 4 === 0 ? C.barn[0] : C.barn[2]);
          rect(sx + 9, 9, 10, 10, C.trim[1]); rect(sx + 10, 10, 8, 9, C.barn[1]);
        }
        break;
      case 'victorian': house(false); break;
      case 'snowday': house(true); break;
      case 'autumn':
        for (let k = 0; k < 4; k++) {
          const cx = Math.round((W / 4) * (k + 0.5));
          blob(cx, 9, 17, 11, (x, y, d, ax, ay) => {
            const nn = smooth(ax, ay, 2, 50 + k);
            const lit = 0.65 - x / 34 - y / 22 + (nn - 0.5) * 0.8;
            return C.maple[Math.max(0, Math.min(5, d > 0.9 ? 0 : Math.floor(lit * 5 + dither(ax, ay) * 1.5 + 0.5)))];
          });
        }
        for (let y = lawn.top + 20; y < lawn.bottom - 10; y += 46) {
          for (const x of [Math.round(lawn.left / 2), Math.round((W + lawn.right) / 2)]) {
            blob(x, y, 4, 3, (dx) => (dx === 0 || Math.abs(dx) === 2) ? C.pumpkin[0] : C.pumpkin[1]);
            put(x, y - 4, C.pumpkin[2]);
          }
        }
        break;
      case 'club': {
        rect(0, 0, W, band, (x, y) => C.rough[Math.min(3, Math.floor(smooth(x, y, 4, 60) * 3 + hash(x, y, 61)))]);
        blob(Math.round(W * 0.26), Math.round(band * 0.62), 16, 7, (x, y, d, ax, ay) => d > 0.82 ? C.sand[0] : C.sand[1 + (hash(ax, ay, 62) > 0.6 ? 1 : 0)]);
        const gx = Math.round(W * 0.66), gy = Math.round(band * 0.42);
        blob(gx, gy, 20, 11, (x, y, d, ax, ay) => d > 0.88 ? C.green[0] : C.green[1 + ((ax + ay) % 6 < 3 ? 1 : 0)]);
        rect(gx, gy - 16, 1, 16, C.trim[1]);
        for (let k = 0; k < 5; k++) rect(gx + 1, gy - 16 + k, 7 - k, 1, C.flag[0]);
        break;
      }
      case 'ballpark': {
        // outfield wall with a yellow top line and a scoreboard
        rect(0, 0, W, band, (x, y) => C.wall[(y < 2 ? 2 : Math.floor(hash(x, y, 40) * 2))]);
        rect(0, band - 2, W, 1, C.glow[0]);
        const sx = Math.round(W / 2) - 18;
        rect(sx, 2, 36, band - 6, C.night[1]);
        for (let k = 0; k < 9; k++) { put(sx + 4 + k * 3, 6, C.glow[k % 2]); put(sx + 4 + k * 3, 10, C.glow[(k + 1) % 2]); }
        // bases and home plate on the dirt
        const { home, dia, dc } = level._diamond;
        const base = (x, y) => rect(x - 1, y - 1, 3, 3, C.chalk[1]);
        base(dc.x + dia, dc.y); base(dc.x, dc.y - dia); base(dc.x - dia, dc.y);
        rect(home.x - 1, home.y - 1, 3, 2, C.chalk[1]); put(home.x, home.y + 1, C.chalk[1]);
        rect(dc.x - 1, dc.y, 3, 1, C.chalk[0]);
        break;
      }
      case 'halloween': {
        rect(0, 0, W, band, (x, y) => C.sky[Math.min(2, Math.floor((y / band) * 2.5 + hash(x, y, 81) * 0.4))]);
        blob(W - 16, 8, 5, 5, (x, y, d) => d > 0.7 ? C.moon[0] : C.moon[1]);
        for (const tx of [10, Math.round(W * 0.45)]) {
          rect(tx, 4, 2, band - 4, C.night[0]);
          for (let k = 0; k < 6; k++) { const bx = tx + (k % 2 ? 1 : -1) * (2 + k), by = 6 + k * 2; rect(Math.min(tx, bx), by, Math.abs(bx - tx) + 1, 1, C.night[0]); }
        }
        for (let x = 0; x < W; x++) { if (x % 6 < 2) rect(x, band - 8, 1, 8, C.night[1]); put(x, band - 6, C.night[1]); }
        for (const jx of [8, W - 30]) for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
          const ch = S.jack.map[y][x];
          if (ch !== '.') put(jx + x, band - 8 + y, S.jack.col[ch]);
        }
        break;
      }
    }
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
  function sprite(sp, x, y, flip = false, shadow = true) {
    const m = sp.map;
    m.forEach((row, yy) => [...row].forEach((ch, xx) => {
      if (ch === '.' || !sp.col[ch]) return;
      const fx = flip ? row.length - 1 - xx : xx;
      if (shadow) darken(x + fx + 1, y + yy + 2, 0.7);
    }));
    m.forEach((row, yy) => [...row].forEach((ch, xx) => {
      if (ch === '.' || !sp.col[ch]) return;
      px(x + (flip ? row.length - 1 - xx : xx), y + yy, sp.col[ch]);
    }));
  }

  function draw(dt) {
    for (let i = 0, n = W * H; i < n; i++) {
      const o = i * 4;
      if (staticAlpha[i]) {
        const s = i * 3;
        data[o] = staticLayer[s]; data[o + 1] = staticLayer[s + 1]; data[o + 2] = staticLayer[s + 2]; data[o + 3] = 255;
        continue;
      }
      let c;
      if (!cut[i]) c = C.uncut[uncutTone[i]];
      else {
        // light where the grass leans away from you, dark where it leans toward you
        const t = Math.max(0, Math.min(4, 2 - toneA[i] * 2 - toneB[i]));
        c = (cutVar[i] ? C.cutAlt : C.cut)[t];
      }
      const L = layer[i];
      if (L) {
        const x = i % W, y = (i / W) | 0;
        if (level.layer === 'snow') c = C.snow[Math.floor(hash(x, y, 92) * 3.2) % 4];
        else if (L === 2) c = C.leafLawn[Math.floor(hash(x >> 1, y >> 1, 79) * 5)];
        else if (hash(i, 0, 80) > 0.55) c = C.chopped[i & 1];
      }
      if (overlay[i]) c = C.chalk[0];
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    if (level.scene !== 'club' && level.scene !== 'ballpark') {
      for (let y = lawn.top; y < lawn.top + 6; y++) {
        const k = 0.72 + (y - lawn.top) * 0.05;
        for (let x = lawn.left; x < lawn.right; x++) if (dither(x, y) < 0.9 - (y - lawn.top) * 0.12) darken(x, y, k);
      }
    }
    drawThings();
    drawMower();
    drawParticles(dt);
    if (level.scene === 'halloween') tint(0.72, 0.68, 0.85);
    for (const f of flakes) {
      f.y += f.v * dt; f.x += Math.sin(f.y / 9) * 0.2;
      if (f.y > H) { f.y = -2; f.x = Math.random() * W; }
      px(f.x, f.y, C.snow[2]);
    }
    ctx.putImageData(img, 0, 0);
  }

  function tint(r, g, b) {
    for (let i = 0; i < W * H; i++) { const o = i * 4; data[o] *= r; data[o + 1] *= g; data[o + 2] *= b; }
  }

  function drawThings() {
    for (const o of statics) {
      if (o.kind === 'tree') {
        for (let y = -o.r; y <= o.r; y++) for (let x = -o.r; x <= o.r; x++) if (x * x + y * y <= o.r * o.r && dither(x, y) < 0.75) darken(o.x + x + 4, o.y + y + 5, 0.6);
        for (let y = -o.r - 2; y <= o.r + 2; y++) for (let x = -o.r - 2; x <= o.r + 2; x++) {
          const wob = (smooth(o.x + x, o.y + y, 3, 40) - 0.5) * 4;
          const d = Math.hypot(x, y);
          if (d > o.r + wob * 0.6) continue;
          const lit = 0.55 - (x + y) / (o.r * 2.6) + (smooth(o.x + x, o.y + y, 2, 41) - 0.5) * 0.6;
          let t = Math.floor(lit * 6 + dither(x, y) * 1.4 + 0.8);
          if (d > o.r + wob * 0.6 - 1) t = 0;
          px(o.x + x, o.y + y, C.canopy[Math.max(0, Math.min(6, t))]);
        }
      } else {
        const sp = S[o.kind];
        sprite(sp, o.x - (sp.map[0].length >> 1), o.y - (sp.map.length >> 1));
      }
    }
    for (const m of movers) {
      const sp = S[m.kind];
      sprite(sp, m.x - (sp.map[0].length >> 1), m.y - (sp.map.length >> 1), m.vx < 0, m.kind !== 'ghost');
    }
  }

  function drawMower() {
    const map = MOWER[mower.dir];
    const [ax, ay] = MOWER_ANCHOR[mower.dir];
    // a running engine rattles
    const j = state === 'play' && !reduceMotion ? ((performance.now() / 45 | 0) % 2) : 0;
    const ox = Math.round(mower.x) - ax + (mower.dir % 2 ? 0 : j), oy = Math.round(mower.y) - ay + (mower.dir % 2 ? j : 0);
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.' && ch !== 'G' && ch !== 'g') darken(ox + x + 2, oy + y + 2, 0.6);
    }
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.') px(ox + x, oy + y, MOWER_COL[ch]);
    }
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      px(p.x, p.y, p.c);
    }
  }

  /* ---------------------------------------------------------- mowing */
  function cutHere() {
    const cx = Math.round(mower.x), cy = Math.round(mower.y);
    const tA = toneFor(level.axes[0]), tB = level.axes[1] ? toneFor(level.axes[1]) : 0;
    let fresh = 0, chopped = 0;
    for (let y = cy - deck; y < cy + deck; y++) {
      for (let x = cx - deck; x < cx + deck; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!mask[i]) continue;
        if (!cut[i]) { cut[i] = 1; fresh++; }
        if (tA) toneA[i] = tA;
        if (tB) toneB[i] = tB;
        // each separate pass chops a leaf one step: whole, then confetti, then gone
        if (layer[i] && layerHit[i] !== strokeId) { layer[i]--; layerHit[i] = strokeId; chopped++; }
      }
    }
    if ((fresh || chopped) && !reduceMotion && particles.length < 160) {
      const sx = -mower.hy, sy = mower.hx; // discharge chute on the mower's right
      particles.push({
        x: cx + sx * (deck + 2), y: cy + sy * (deck + 2),
        vx: sx * (25 + Math.random() * 30) + (Math.random() - 0.5) * 12,
        vy: sy * (25 + Math.random() * 30) + (Math.random() - 0.5) * 12,
        life: 0.35 + Math.random() * 0.3,
        c: chopped ? (level.layer === 'snow' ? C.snow[2] : C.leafLawn[Math.floor(Math.random() * 4)]) : C.clip[Math.floor(Math.random() * 3)],
      });
    }
  }

  // +1 dark / -1 light when you're driving along an axis; 0 when you're crossing it
  function toneFor(axis) {
    const d = mower.hx * axis[0] + mower.hy * axis[1];
    return Math.abs(d) > 0.8 ? (d > 0 ? -1 : 1) : 0;
  }

  /* ---------------------------------------------------------- strokes */
  // A stroke is one straight-ish pass. It ends when you turn more than ~50 degrees.
  function strokePoint() {
    if (!stroke) { stroke = { pts: [[mower.x, mower.y]], len: 0, dir: null, bumps: 0 }; strokeId++; return; }
    const last = stroke.pts[stroke.pts.length - 1];
    const step = Math.hypot(mower.x - last[0], mower.y - last[1]);
    if (step < 0.6) return;
    stroke.pts.push([mower.x, mower.y]);
    stroke.len += step;
    if (!stroke.dir && stroke.len > 10) {
      const f = stroke.pts[0];
      const d = Math.hypot(mower.x - f[0], mower.y - f[1]) || 1;
      stroke.dir = [(mower.x - f[0]) / d, (mower.y - f[1]) / d];
    }
    if (stroke.dir) {
      const dot = mower.hx * stroke.dir[0] + mower.hy * stroke.dir[1];
      if (dot < 0.64) { endStroke(); strokePoint(); }
    }
  }

  function endStroke() {
    const s = stroke;
    stroke = null;
    if (!s || s.len < 28 || s.pts.length < 8) return;
    // best-fit line through the pass, then how far you wandered off it
    const n = s.pts.length;
    let mx = 0, my = 0;
    for (const [x, y] of s.pts) { mx += x; my += y; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of s.pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    let dev = 0;
    for (const [x, y] of s.pts) dev += ((x - mx) * -uy + (y - my) * ux) ** 2;
    const rms = Math.sqrt(dev / n);
    const straight = Math.max(0, 1 - rms / 2.4);
    // and how close that line is to the yard's stripe direction
    const align = Math.max(...level.axes.map((a) => Math.abs(ux * a[0] + uy * a[1])));
    const errDeg = Math.acos(Math.min(1, align)) * 180 / Math.PI;
    const aligned = Math.max(0, 1 - errDeg / 20);
    const score = Math.round((straight * 0.7 + aligned * 0.3) * 100);
    strokes.push({ score, len: s.len });
    const note = score >= 95 ? 'Laser straight' : score >= 85 ? 'Clean' : score >= 70 ? 'Bit wobbly' : score >= 50 ? 'Wobbly' : 'Yikes';
    toast(errDeg > 15 ? `${score}  ${note}, wrong angle` : `${score}  ${note}`);
  }

  /* ---------------------------------------------------------- movers */
  function updateMovers(dt) {
    const lw = lawn.right - lawn.left, lh = lawn.bottom - lawn.top;
    if (level.movers === 'dog' && !movers.length && Math.random() < dt * 0.2) {
      const l = Math.random() > 0.5;
      movers.push({ kind: 'dog', r: 4, x: l ? lawn.left - 6 : lawn.right + 6, y: lawn.top + 12 + Math.random() * (lh - 24), vx: l ? 46 : -46, vy: 0, cross: true });
    }
    if (level.movers === 'santa' && !movers.length && Math.random() < dt * 0.15) {
      const l = Math.random() > 0.5;
      movers.push({ kind: 'sleigh', r: 6, x: l ? -10 : W + 10, y: lawn.top + 14 + Math.random() * (lh - 30), vx: l ? 40 : -40, vy: 0, cross: true });
    }
    if (level.movers === 'ghost' && !movers.length) movers.push({ kind: 'ghost', r: 4, x: lawn.left + lw / 2, y: lawn.top + lh / 2, vx: 18, vy: 0, t: 0, ghost: true });
    if (level.movers === 'turkeys' && !movers.length) {
      for (let k = 0; k < 3; k++) movers.push({ kind: 'turkey', r: 4, x: lawn.left + lw * (0.25 + k * 0.25), y: lawn.top + lh * (0.25 + (k % 2) * 0.4), vx: 10, vy: 6, wander: true });
    }
    for (const m of movers) {
      if (m.ghost) {
        m.t += dt;
        m.x = lawn.left + lw / 2 + Math.sin(m.t * 0.5) * lw * 0.38;
        m.y = lawn.top + lh / 2 + Math.sin(m.t * 0.83) * lh * 0.38;
        m.vx = Math.cos(m.t * 0.5);
      } else if (m.wander) {
        if (Math.random() < dt * 0.6) { const a = Math.random() * Math.PI * 2; m.vx = Math.cos(a) * 10; m.vy = Math.sin(a) * 10; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < lawn.left + 5 || m.x > lawn.right - 5) m.vx = -m.vx;
        if (m.y < lawn.top + 5 || m.y > lawn.bottom - 5) m.vy = -m.vy;
        m.x = Math.max(lawn.left + 5, Math.min(lawn.right - 5, m.x));
        m.y = Math.max(lawn.top + 5, Math.min(lawn.bottom - 5, m.y));
        m.vx *= Math.pow(0.5, dt * 0.2) || 1;
      } else {
        m.x += m.vx * dt;
      }
    }
    movers = movers.filter((m) => !m.cross || (m.x > -20 && m.x < W + 20));
  }

  function bump(msg, away) {
    bumps++;
    stall = 0.5;
    shake = reduceMotion ? 0 : 0.22;
    if (away) { mower.x += away[0] * 5; mower.y += away[1] * 5; target = { x: mower.x, y: mower.y }; }
    endStroke();
    toast(`${msg} −15`);
  }

  /* ----------------------------------------------------------- update */
  function update(dt) {
    if (state !== 'play') return;
    timeLeft -= dt;
    updateMovers(dt);
    if (stall > 0) stall -= dt;

    // keyboard driving
    if (keys.x || keys.y) target = { x: (target?.x ?? mower.x) + keys.x * 70 * dt, y: (target?.y ?? mower.y) + keys.y * 70 * dt };

    if (target && stall <= 0) {
      target.x = Math.max(lawn.left + deck, Math.min(lawn.right - deck, target.x));
      target.y = Math.max(lawn.top + deck, Math.min(lawn.bottom - deck, target.y));
      const dx = target.x - mower.x, dy = target.y - mower.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.3) {
        const step = Math.min(dist, 80 * dt);
        mower.x += (dx / dist) * step;
        mower.y += (dy / dist) * step;
        // heading eases toward the direction of travel so turns read smoothly
        const k = Math.min(1, dt * 14);
        mower.hx += ((dx / dist) - mower.hx) * k;
        mower.hy += ((dy / dist) - mower.hy) * k;
        const hl = Math.hypot(mower.hx, mower.hy) || 1;
        mower.hx /= hl; mower.hy /= hl;
        mower.dir = Math.abs(mower.hx) > Math.abs(mower.hy) ? (mower.hx > 0 ? 1 : 3) : (mower.hy > 0 ? 2 : 0);
        if (!moved) { moved = true; ui.push?.classList.remove('is-on'); }
        cutHere();
        strokePoint();
        // trees, gnomes and the like just block the way: slide around them, no penalty
        for (const o of statics) {
          const d = Math.hypot(mower.x - o.x, mower.y - o.y);
          const min = o.r + deck - 1;
          if (d < min) {
            const k = (min - d) / (d || 1);
            mower.x += (mower.x - o.x) * k; mower.y += (mower.y - o.y) * k;
            target = { x: mower.x + (target.x - mower.x), y: mower.y + (target.y - mower.y) };
          }
        }
        // the animals and holiday guests step aside when you get close
        for (const m of movers) {
          const d = Math.hypot(m.x - mower.x, m.y - mower.y);
          if (d < 16 && (m.wander || m.ghost)) { m.vx = (m.x - mower.x) * 3; m.vy = (m.y - mower.y) * 3; if (m.ghost) m.t += 0.05; }
        }
      }
    }

    // exhaust puffs out the back while the engine runs
    smokeT -= dt;
    if (smokeT <= 0 && !reduceMotion) {
      smokeT = 0.12;
      particles.push({ x: mower.x - mower.hx * 10, y: mower.y - mower.hy * 10, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 6, life: 0.6, c: C.smoke[Math.floor(Math.random() * 3)] });
    }

    coverT -= dt;
    if (coverT <= 0) {
      coverT = 0.25;
      coverage = measure();
      hud();
      if (coverage >= (level.both ? 0.82 : 0.92)) endLevel();
    }
    if (timeLeft <= 0) endLevel();
  }

  function measure() {
    let c = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || !cut[i] || layer[i]) continue;
      if (level.both && !(toneA[i] && toneB[i])) continue;
      c++;
    }
    return c / grassTotal;
  }

  function endLevel() {
    endStroke();
    state = 'result';
    setTouch(false);
    ui.push?.classList.remove('is-on');
    coverage = measure();
    const totalLen = strokes.reduce((a, s) => a + s.len, 0);
    const straight = totalLen ? strokes.reduce((a, s) => a + s.score * s.len, 0) / totalLen : 0;
    const timeBonus = coverage >= 0.85 ? Math.round(Math.max(0, timeLeft / timeLimit) * 100) : 0;
    const total = Math.max(0, Math.round(straight * 6 + coverage * 300 + timeBonus));
    const key = `mit-best-${level.id}`;
    const prevBest = store.get(key);
    if (total > prevBest) store.set(key, total);
    window.mitTrack && window.mitTrack('game_complete', { game_name: 'stripe_game', level_name: level.id, score: total, new_best: total > prevBest ? 1 : 0 });
    const stars = total >= 900 ? 3 : total >= 750 ? 2 : total >= 550 ? 1 : 0;
    ui.grade.textContent = GRADES.find(([min]) => total >= min)[1];
    ui.total.textContent = total;
    ui.stars.innerHTML = [0, 1, 2].map((k) => `<span class="star${k < stars ? ' is-on' : ''}"></span>`).join('');
    ui.stars.setAttribute('aria-label', `${stars} of 3 stars`);
    const what = level.layer === 'leaves' ? 'Mowed and mulched' : level.layer === 'snow' ? 'Cleared' : level.both ? 'Checkerboarded' : 'Mowed';
    ui.detail.textContent = `Straightness ${Math.round(straight)}. ${what} ${Math.round(coverage * 100)}%. ${total > prevBest ? (prevBest ? `New best! Old best: ${prevBest}.` : 'First score on this yard.') : `Your best: ${prevBest}.`}`;
    ui.tip.textContent = TIPS[level.id];
    saveScore(ui.result.querySelector('[data-lb]'), { game: 'stripe_game', score: total, level: level.id });
    show(ui.result);
  }

  /* ------------------------------------------------------------- flow */
  function openPicker() {
    state = 'picker';
    setTouch(false);
    hide(ui.ready); hide(ui.result);
    show(ui.picker);
  }

  function chooseLevel(i) {
    level = LEVELS[i];
    build();
    state = 'ready';
    hide(ui.picker); hide(ui.result);
    ui.readyTitle.textContent = level.name;
    ui.readyBlurb.textContent = level.blurb;
    ui.readyHow.textContent = level.how;
    const best = store.get(`mit-best-${level.id}`);
    ui.readyBest.textContent = best ? `Your best here: ${best}` : '';
    ui.readyBest.hidden = !best;
    ui.cord.style.setProperty('--p', '0');
    ui.cord.textContent = 'Hold to Start the Mower';
    show(ui.ready);
    hud();
  }

  function startEngine() {
    hide(ui.ready);
    strokes = []; stroke = null; bumps = 0; particles = []; moved = false; target = null;
    coverage = 0; timeLeft = timeLimit;
    state = 'play';
    window.mitTrack && window.mitTrack('game_start', { game_name: 'stripe_game', level_name: level.id });
    setTouch(true);
    ui.push?.classList.add('is-on');
    shake = reduceMotion ? 0 : 0.3;
    for (let k = 0; k < 10 && !reduceMotion; k++) particles.push({ x: mower.x, y: mower.y + 8, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, life: 0.8, c: C.smoke[k % 3] });
    hud();
  }

  // pull-start: hold the button for a moment and the engine catches
  let cordT = null, cordRAF = 0;
  const HOLD = 1100;
  function cordDown(e) {
    e.preventDefault();
    if (cordT !== null) return;
    cordT = performance.now();
    ui.cord.textContent = 'Keep holding…';
    const tick = () => {
      const p = Math.min(1, (performance.now() - cordT) / HOLD);
      ui.cord.style.setProperty('--p', String(p));
      if (p >= 1) { cordT = null; ui.cord.textContent = 'Vroom!'; startEngine(); return; }
      cordRAF = requestAnimationFrame(tick);
    };
    cordRAF = requestAnimationFrame(tick);
  }
  function cordUp() {
    if (cordT === null) return;
    cancelAnimationFrame(cordRAF);
    cordT = null;
    ui.cord.style.setProperty('--p', '0');
    ui.cord.textContent = 'Sputter. Hold it a little longer';
  }
  ui.cord.addEventListener('pointerdown', cordDown);
  ui.cord.addEventListener('pointerup', cordUp);
  ui.cord.addEventListener('pointerleave', cordUp);
  ui.cord.addEventListener('pointercancel', cordUp);
  ui.cord.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) cordDown(e); });
  ui.cord.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cordUp(); });
  ui.cord.addEventListener('contextmenu', (e) => e.preventDefault());

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }
  function setTouch(on) { canvas.style.touchAction = on ? 'none' : 'pan-y'; screen.classList.toggle('is-playing', on); }

  function hud() {
    ui.level.textContent = level.short;
    ui.pct.textContent = `${Math.floor(coverage * 100)}%`;
    const t = Math.max(0, Math.ceil(timeLeft));
    ui.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  let toastTimer;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), 1100);
  }

  /* ------------------------------------------------------------ input */
  // Drag anywhere: the mower follows your thumb's movement (like a trackpad),
  // so your thumb never covers the mower.
  const toLawn = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLawn(e);
    if (p.x >= blowerPos.x - 3 && p.x <= blowerPos.x + 13 && p.y >= blowerPos.y - 4 && p.y <= blowerPos.y + 10) { blowerPrank(); return; }
    if (state !== 'play') return;
    drag = p;
    target = { x: mower.x, y: mower.y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || state !== 'play') return;
    const p = toLawn(e);
    target.x += p.x - drag.x;
    target.y += p.y - drag.y;
    drag = p;
  });
  const endDrag = () => { drag = null; if (target) target = { x: mower.x, y: mower.y }; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', (e) => {
    if (state !== 'play' || e.target.closest?.('input, textarea, select, button')) return;
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (k) { if (k[0]) keys.x = k[0]; if (k[1]) keys.y = k[1]; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') keys.x = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') keys.y = 0;
    if (!keys.x && !keys.y && state === 'play') target = { x: mower.x, y: mower.y };
  });

  ui.pickList.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) chooseLevel(Number(b.dataset.i)); });
  ui.random.addEventListener('click', () => chooseLevel(Math.floor(Math.random() * LEVELS.length)));
  ui.back.addEventListener('click', openPicker);
  ui.again.addEventListener('click', () => chooseLevel(LEVELS.indexOf(level)));
  ui.pick.addEventListener('click', openPicker);

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.25 }).observe(canvas);

  function blowerPrank() {
    if (!reduceMotion) {
      shake = 0.7;
      for (let k = 0; k < 44; k++) particles.push({ x: blowerPos.x, y: blowerPos.y + 3, vx: -40 - Math.random() * 100, vy: (Math.random() - 0.2) * 70, life: 0.8 + Math.random() * 0.9, c: C.leaf[k % 3] });
    }
    ui.brap.classList.remove('is-on');
    void ui.brap.offsetWidth;
    ui.brap.classList.add('is-on');
    if (state === 'play') { state = 'paused'; drag = null; }
    setTimeout(() => ticket?.showModal?.(), reduceMotion ? 0 : 750);
  }
  ticket?.addEventListener('close', () => { if (state === 'paused') { state = 'play'; target = { x: mower.x, y: mower.y }; } });

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
    if (state === 'picker' || state === 'ready') build();
  }).observe(canvas);

  build();
  openPicker();
  requestAnimationFrame(frame);
}
