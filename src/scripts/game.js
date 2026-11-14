// Mow It Tall — the stripe game.
// The mower rolls on its own. You steer left and right to keep each pass straight
// and tight against the last one, while the lawn tries to push you off line.

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
  { name: 'The front yard', blurb: 'Flat and friendly. A good place to start.', speed: 60, drift: 5, slope: 0, bumps: 0 },
  { name: 'The side yard', blurb: 'It’s a little lumpy. The mower will wander.', speed: 68, drift: 11, slope: 0, bumps: 0.7 },
  { name: 'The hill', blurb: 'Gravity wants you in the flower bed.', speed: 74, drift: 9, slope: 7, bumps: 1 },
];

const GRADES = [
  [95, 'Golf course material.'],
  [87, 'Neighborhood legend.'],
  [75, 'Respectable dad stripes.'],
  [60, 'The neighbors noticed. Not in a good way.'],
  [0, 'Did you mow this during a sneeze?'],
];

const TIPS = [
  'Real-life tip: pick a target at the far end of the yard and keep your eyes on it, not the mower.',
  'Real-life tip: overlap each pass by a couple of inches so you never leave a skinny strip.',
  'Real-life tip: taller grass shows stripes better. Set your deck to 3.5 to 4 inches.',
  'Real-life tip: mow a lap around the edges first. It gives you room to turn neatly.',
  'Real-life tip: switch your stripe direction every week so the grass doesn’t lean one way.',
];

/* --------------------------------------------------------------------- game */
export function initGame(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const screen = root.querySelector('[data-screen]');
  const $ = (s) => root.querySelector(s);
  const ui = {
    level: $('[data-level]'), pass: $('[data-pass]'), score: $('[data-score]'),
    menu: $('[data-menu]'), menuTitle: $('[data-menu-title]'), menuBlurb: $('[data-menu-blurb]'), menuBest: $('[data-menu-best]'),
    start: $('[data-start]'),
    result: $('[data-result]'), grade: $('[data-grade]'), total: $('[data-total]'), stars: $('[data-stars]'),
    best: $('[data-best]'), tip: $('[data-tip]'), again: $('[data-again]'), next: $('[data-next]'),
    toast: $('[data-toast]'), brap: $('[data-brap]'), push: $('[data-push]'),
  };
  const ticket = document.querySelector('[data-ticket]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, img, data, staticLayer, staticAlpha;
  let lawn, mask, cutDir, uncutTone, cutVar;
  let lane = 14, passes = 7, deck = 7;
  let blowerPos = { x: 0, y: 0 };
  let levelIndex = 0;
  let state = 'menu'; // menu | play | turn | result | paused
  let pass = 0, passScores = [], samples = [], prevSamples = null, turnT = 0;
  let particles = [], shake = 0, bumpV = 0;
  let input = 0; // keyboard steer, -1..1
  let keyPush = false; // holding Up or Space
  const pushing = () => drag !== null || keyPush;
  let lastWidth = 0, seed = 1;
  const mower = { x: 0, y: 0, dir: 0 };

  const store = {
    get: (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } },
  };

  /* ------------------------------------------------------------ build */
  function build() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(2, Math.round(rect.width / 120));
    W = Math.max(100, Math.round(rect.width / scale));
    H = Math.max(140, Math.round(rect.height / scale));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    data = img.data;

    lawn = { top: 24, bottom: H - 12, left: 4, right: W - 4 };
    const lw = lawn.right - lawn.left;
    passes = Math.max(5, Math.min(9, Math.round(lw / 14)));
    lane = lw / passes;
    deck = Math.round(lane / 2);

    const n = W * H;
    mask = new Uint8Array(n);
    cutDir = new Int8Array(n);
    uncutTone = new Uint8Array(n);
    cutVar = new Uint8Array(n);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (x >= lawn.left && x < lawn.right && y >= lawn.top && y < lawn.bottom) mask[i] = 1;
        const clump = smooth(x, y, 5, 1), streak = smooth(x * 3, y, 4, 2), grain = hash(x, y, 3);
        let t = clump * 3.2 + streak * 2.2 + grain * 1.6 - 0.6;
        if (grain > 0.93) t += 1.5;
        uncutTone[i] = Math.max(0, Math.min(6, Math.floor(t)));
        cutVar[i] = hash(x, y, 4) > 0.55 ? 1 : 0;
      }
    }
    blowerPos = { x: W - 22, y: 9 };
    buildStatic();
    mower.x = lawn.left + lane / 2;
    mower.y = lawn.bottom - deck;
    mower.dir = 0;
    hud();
  }

  function buildStatic() {
    staticLayer = new Uint8ClampedArray(W * H * 3);
    staticAlpha = new Uint8Array(W * H);
    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      staticLayer[i * 3] = c[0]; staticLayer[i * 3 + 1] = c[1]; staticLayer[i * 3 + 2] = c[2];
      staticAlpha[i] = 1;
    };
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
          put(x, y, C.walk[Math.min(4, joint ? 0 : 2 + Math.floor(g * 2.2 + (y === lawn.bottom + 4 ? 1 : 0)))]);
        } else if (y >= lawn.bottom) {
          put(x, y, y === lawn.bottom ? C.curb[0] : C.curb[1]);
        } else if (x < lawn.left || x >= lawn.right) {
          const edge = x === lawn.left - 1 || x === lawn.right;
          put(x, y, edge ? C.cobble[1 + (y % 3 === 0 ? 0 : 1)] : mulch);
        }
      }
    }
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
    [0.14, 0.5, 0.84].forEach((fx, k) => {
      const cx = Math.round(W * fx), cy = 16;
      for (let y = -6; y <= 5; y++) {
        for (let x = -9; x <= 9; x++) {
          const d = (x * x) / 81 + (y * y) / 36;
          if (d > 1) continue;
          const n = smooth(cx + x, cy + y, 2, 30 + k);
          const lit = 0.6 - x / 18 - y / 12;
          let c = n > 0.55
            ? C.rhodie[Math.max(0, Math.min(4, Math.floor(lit * 3 + n * 2 + dither(x, y))))]
            : C.hedge[Math.max(1, Math.min(5, Math.floor(lit * 4 + 2 + dither(x, y))))];
          if (d > 0.86) c = C.hedge[1];
          put(cx + x, cy + y, c);
        }
      }
    });
    for (let y = 0; y < BLOWER.length; y++) for (let x = 0; x < BLOWER[y].length; x++) {
      const ch = BLOWER[y][x];
      if (ch !== '.') put(blowerPos.x + x, blowerPos.y + y, BLOWER_COL[ch]);
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

  function draw(dt) {
    for (let i = 0, n = W * H; i < n; i++) {
      const o = i * 4;
      if (staticAlpha[i]) {
        const s = i * 3;
        data[o] = staticLayer[s]; data[o + 1] = staticLayer[s + 1]; data[o + 2] = staticLayer[s + 2];
      } else {
        const d = cutDir[i];
        // mowed upward = grass leans away from you = light stripe
        const c = d === 0 ? C.uncut[uncutTone[i]] : (cutVar[i] ? C.cutAlt : C.cut)[d < 0 ? 4 : 0];
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      }
      data[o + 3] = 255;
    }
    for (let y = lawn.top; y < lawn.top + 6; y++) {
      const k = 0.72 + (y - lawn.top) * 0.05;
      for (let x = lawn.left; x < lawn.right; x++) if (dither(x, y) < 0.9 - (y - lawn.top) * 0.12) darken(x, y, k);
    }
    drawMower();
    drawParticles(dt);
    ctx.putImageData(img, 0, 0);
  }

  function drawMower() {
    const map = MOWER[mower.dir];
    const [ax, ay] = MOWER_ANCHOR[mower.dir];
    const ox = Math.round(mower.x) - ax, oy = Math.round(mower.y) - ay;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.' && ch !== 'G' && ch !== 'g') darken(ox + x + 2, oy + y + 2, 0.6);
    }
    const jitter = state === 'play' && pushing() && !reduceMotion && (performance.now() / 60 | 0) % 2 ? 1 : 0;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch !== '.') px(ox + x + (mower.dir % 2 ? jitter : 0), oy + y, MOWER_COL[ch]);
    }
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      px(Math.round(p.x), Math.round(p.y), p.c);
    }
  }

  /* ----------------------------------------------------------- update */
  function cutAt() {
    const dy = mower.dir === 0 ? -1 : 1;
    const cx = Math.round(mower.x), cy = Math.round(mower.y);
    let fresh = 0;
    for (let y = cy - deck; y < cy + deck; y++) {
      for (let x = cx - deck; x < cx + deck; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!mask[i]) continue;
        if (!cutDir[i]) fresh++;
        cutDir[i] = dy;
      }
    }
    if (fresh && !reduceMotion && particles.length < 120) {
      const side = mower.dir === 0 ? 1 : -1; // discharge chute on the mower's right
      particles.push({
        x: cx + side * (deck + 1), y: cy,
        vx: side * (25 + Math.random() * 30), vy: (Math.random() - 0.5) * 16,
        life: 0.35 + Math.random() * 0.3, c: C.clip[Math.floor(Math.random() * 3)],
      });
    }
  }

  function startPass() {
    mower.dir = pass % 2 === 0 ? 0 : 2;
    mower.y = mower.dir === 0 ? lawn.bottom - deck : lawn.top + deck;
    // swing around into roughly the next lane; lining it up is your job
    const ideal = prevSamples ? prevSamples.mean + lane : lawn.left + lane / 2;
    const miss = (Math.random() - 0.5) * lane * 0.5;
    mower.x = Math.max(lawn.left + deck, Math.min(lawn.right - deck, ideal + (pass === 0 ? miss * 0.5 : miss)));
    samples = [];
    bumpV = 0;
    seed = Math.floor(Math.random() * 1000);
    state = 'play';
  }

  function update(dt) {
    if (state === 'turn') {
      turnT -= dt;
      if (turnT <= 0) startPass();
      return;
    }
    if (state !== 'play') return;
    const lvl = LEVELS[levelIndex];
    const dy = mower.dir === 0 ? -1 : 1;
    const moving = pushing();
    ui.push?.classList.toggle('is-on', !moving);
    // keyboard steering works even while parked, so you can line up first
    mower.x += input * 34 * dt;
    mower.x = Math.max(lawn.left + deck, Math.min(lawn.right - deck, mower.x));
    if (!moving) return; // the mower only rolls while you push it
    // the lawn pushes back: lumps, a slope, the odd root
    let drift = (smooth(mower.y, 0, 14, seed) - 0.5) * 2 * lvl.drift + lvl.slope;
    if (lvl.bumps && Math.random() < lvl.bumps * dt) bumpV += (Math.random() > 0.5 ? 1 : -1) * (14 + Math.random() * 10);
    bumpV *= Math.pow(0.04, dt);
    mower.x += (drift + bumpV) * dt;
    mower.x = Math.max(lawn.left + deck, Math.min(lawn.right - deck, mower.x));
    mower.y += dy * lvl.speed * dt;
    samples.push(mower.x);
    cutAt();
    const doneUp = mower.dir === 0 && mower.y <= lawn.top + deck;
    const doneDown = mower.dir === 2 && mower.y >= lawn.bottom - deck;
    if (doneUp || doneDown) finishPass();
  }

  function finishPass() {
    // straightness: average wobble around the pass's own average line
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const wobble = samples.reduce((a, b) => a + Math.abs(b - mean), 0) / samples.length;
    const straight = Math.max(0, 1 - wobble / 3.5);
    // spacing: how far this pass sits from where it should, next to the last one
    const target = prevSamples ? prevSamples.mean + lane : lawn.left + lane / 2;
    const offset = mean - target;
    const spacing = Math.max(0, 1 - Math.abs(offset) / (lane * 0.45));
    const score = Math.round((straight * 0.65 + spacing * 0.35) * 100);
    passScores.push(score);
    prevSamples = { mean };

    let note = score >= 95 ? 'Laser straight' : score >= 85 ? 'Clean' : score >= 70 ? 'Bit wobbly' : score >= 50 ? 'Wobbly' : 'Yikes';
    if (spacing < 0.6) note += offset > 0 ? ', gap' : ', overlap';
    toast(`${score}  ${note}`);
    pass++;
    hud();
    if (pass >= passes) return endLevel();
    // turn around
    ui.push?.classList.remove('is-on');
    state = 'turn';
    turnT = 0.45;
    mower.dir = 1;
  }

  function endLevel() {
    state = 'result';
    ui.push?.classList.remove('is-on');
    setTouch(false);
    const avg = Math.round(passScores.reduce((a, b) => a + b, 0) / passScores.length);
    const total = avg * 10;
    const key = `mit-best-${levelIndex}`;
    const prevBest = store.get(key);
    if (total > prevBest) store.set(key, total);
    const stars = avg >= 90 ? 3 : avg >= 75 ? 2 : avg >= 55 ? 1 : 0;
    ui.grade.textContent = GRADES.find(([min]) => avg >= min)[1];
    ui.total.textContent = total;
    ui.stars.innerHTML = [0, 1, 2].map((k) => `<span class="star${k < stars ? ' is-on' : ''}"></span>`).join('');
    ui.stars.setAttribute('aria-label', `${stars} of 3 stars`);
    ui.best.textContent = total > prevBest
      ? (prevBest ? `New best on this yard. Old best: ${prevBest}.` : 'Your first score on this yard.')
      : `Your best on this yard: ${prevBest}.`;
    ui.tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
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
    const best = store.get(`mit-best-${levelIndex}`);
    ui.menuBest.textContent = best ? `Your best: ${best}` : '';
    ui.menuBest.hidden = !best;
    hide(ui.result);
    show(ui.menu);
  }

  function startLevel() {
    hide(ui.menu);
    build();
    pass = 0; passScores = []; prevSamples = null;
    setTouch(true);
    startPass();
    hud();
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }
  function setTouch(on) { canvas.style.touchAction = on ? 'none' : 'pan-y'; screen.classList.toggle('is-playing', on); }

  function hud() {
    ui.level.textContent = `${levelIndex + 1}/${LEVELS.length}`;
    ui.pass.textContent = `${Math.min(pass + (state === 'menu' ? 0 : 1), passes)}/${passes}`;
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
  let drag = null;
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
    drag = { x: e.clientX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || state !== 'play') { if (drag) drag.x = e.clientX; return; }
    const r = canvas.getBoundingClientRect();
    // steer relative to where your thumb started, 1:1 with the lawn
    mower.x += ((e.clientX - drag.x) / r.width) * W;
    mower.x = Math.max(lawn.left + deck, Math.min(lawn.right - deck, mower.x));
    drag.x = e.clientX;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, button')) return;
    if (state === 'play' || state === 'turn') {
      if (e.key === 'ArrowLeft') { input = -1; e.preventDefault(); }
      if (e.key === 'ArrowRight') { input = 1; e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === ' ') { keyPush = true; e.preventDefault(); }
    }
    if ((e.key === 'b' || e.key === 'B') && document.activeElement === canvas) blowerPrank();
  });
  window.addEventListener('keyup', (e) => {
    if ((e.key === 'ArrowLeft' && input < 0) || (e.key === 'ArrowRight' && input > 0)) input = 0;
    if (e.key === 'ArrowUp' || e.key === ' ') keyPush = false;
  });

  ui.start.addEventListener('click', startLevel);
  ui.again.addEventListener('click', () => { hide(ui.result); startLevel(); });
  ui.next.addEventListener('click', () => { levelIndex = (levelIndex + 1) % LEVELS.length; openMenu(); });

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
