// Mow It Tall — the hero lawn.
// A low-res canvas yard you mow with your thumb. Stripes come from the direction you
// mow, the same way real stripes do: grass bent away from you looks light, toward you looks dark.

const PAL = {
  uncut: ['#3a7634', '#427f38', '#4a873b', '#346d31'],
  uncutTip: '#6ea347',
  light: ['#8ac655', '#8ec958', '#91cc5c'],
  mid: ['#5f9f42', '#62a244', '#65a546'],
  dark: ['#2a6b2f', '#2c6e31', '#2e7133'],
  dandelion: '#ffd83a',
  dandelionDark: '#f0b81c',
  clover: '#e9f3dc',
  mulch: ['#3e271c', '#4a2f22', '#553626', '#2f1d15'],
  cobble: ['#9ea3a6', '#b8bcbe', '#858a8d'],
  hedgeDark: '#173f24',
  hedge: '#215a2d',
  hedgeMid: '#2d6e34',
  hedgeLight: '#4a8c3d',
  rhodie: ['#c9418f', '#e06aaa', '#f29bc9'],
  walk: ['#c9c4b8', '#d3cec3', '#bfb9ac'],
  walkJoint: '#a39d90',
  curb: '#8f897d',
  clip: ['#9fd15f', '#86c14f', '#b9df7a'],
  ink: '#241812',
  red: '#c8372d',
  redDark: '#962620',
  redLight: '#e2564a',
  steel: '#8a9095',
  steelDark: '#5b6166',
  steelLight: '#c3c9ce',
  handle: '#2e2e30',
  grip: '#141414',
  wheel: '#1c1c1e',
  blower: '#e8731a',
  blowerDark: '#b4540f',
  leaf: ['#d9822b', '#c4561f', '#e8a93a'],
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const RGB = {};
for (const [k, v] of Object.entries(PAL)) RGB[k] = Array.isArray(v) ? v.map(hexToRgb) : hexToRgb(v);

// Deterministic hash noise so the yard looks the same every frame.
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Push mower, facing up (handle trails below). K outline, R red deck, r dark red,
// H red highlight, G engine, g engine dark, L engine light, S handle, s grip, W wheel.
const MOWER_UP = [
  '.W.......W.',
  'WWKKKKKKKWW',
  'WKHHHHHHHRK',
  '.KHRRRRRRrK',
  '.KRRLGGGRrK',
  '.KRRGgggRrK',
  '.KRRGgGgRrK',
  '.KRRGgggRrK',
  '.KRRRGGRRrK',
  'WKrrrrrrrrK',
  'WWKKKKKKKWW',
  '.W.S...S.W.',
  '...S...S...',
  '...S...S...',
  '...S...S...',
  '...SSSSS...',
  '...s...s...',
];
const MOWER_COLORS = {
  K: 'ink', R: 'red', r: 'redDark', H: 'redLight', G: 'steel', g: 'steelDark',
  L: 'steelLight', S: 'handle', s: 'grip', W: 'wheel',
};

function rotateMap(map, quarterTurns) {
  let m = map.map((r) => [...r]);
  for (let t = 0; t < quarterTurns; t++) {
    const h = m.length, w = m[0].length;
    const out = Array.from({ length: w }, () => Array(h).fill('.'));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][h - 1 - y] = m[y][x];
    m = out;
  }
  return m;
}
// 0 = up, 1 = right, 2 = down, 3 = left
const MOWER = [0, 1, 2, 3].map((q) => rotateMap(MOWER_UP, q));

const BLOWER = [
  '....KK..',
  '...KOOK.',
  'KKKOOOOK',
  'SSKOoOOK',
  'S..KOOK.',
  'S...KK..',
];
const BLOWER_COLORS = { K: 'ink', O: 'blower', o: 'blowerDark', S: 'steelDark' };

export function initLawn(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hud = root.querySelector('[data-hud]');
  const hint = root.querySelector('[data-hint]');
  const done = root.querySelector('[data-done]');
  const resetBtn = root.querySelector('[data-reset]');
  const ticket = document.querySelector('[data-ticket]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, scale, img, data;
  let cut, dirX, dirY, base, weed; // per-pixel state
  let lawnTop, lawnBottom, lawnLeft, lawnRight, lawnTotal, cutCount;
  let blowerPos;
  const mower = { x: 0, y: 0, vx: 0, vy: -1, facing: 0, speed: 0 };
  let target = null;
  let autopilot = !reduceMotion;
  let autoPath = [];
  let started = false;
  let celebrated = false;
  let particles = [];
  let shake = 0;
  let lastW = 0;

  function setup() {
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - lastW) < 2 && W) return; // ignore mobile URL-bar height jitter
    lastW = rect.width;
    scale = Math.max(3, Math.min(6, Math.round(rect.width / 130)));
    W = Math.max(80, Math.round(rect.width / scale));
    H = Math.max(120, Math.round(rect.height / scale));
    canvas.width = W;
    canvas.height = H;
    img = ctx.createImageData(W, H);
    data = img.data;

    lawnTop = 22;
    lawnBottom = H - 13;
    lawnLeft = 3;
    lawnRight = W - 3;
    const n = W * H;
    cut = new Uint8Array(n);
    dirX = new Float32Array(n);
    dirY = new Float32Array(n);
    base = new Uint8Array(n);
    weed = new Uint8Array(n);
    lawnTotal = (lawnBottom - lawnTop) * (lawnRight - lawnLeft);
    cutCount = 0;
    celebrated = false;
    done?.setAttribute('hidden', '');

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        base[i] = Math.floor(hash(x, y) * 256);
      }
    }
    // Scatter dandelions (2x2 with a stem) and clover dots in the uncut lawn.
    const weeds = Math.round(lawnTotal / 420);
    for (let k = 0; k < weeds; k++) {
      const x = lawnLeft + 2 + Math.floor(hash(k, 7, 3) * (lawnRight - lawnLeft - 4));
      const y = lawnTop + 3 + Math.floor(hash(k, 9, 5) * (lawnBottom - lawnTop - 6));
      const type = hash(k, 1, 1) > 0.35 ? 1 : 2;
      weed[y * W + x] = type;
      if (type === 1) { weed[y * W + x + 1] = 1; weed[(y - 1) * W + x] = 3; weed[(y - 1) * W + x + 1] = 1; }
    }

    blowerPos = { x: W - 20, y: 10 };
    mower.x = lawnLeft + 8;
    mower.y = lawnBottom - 6;
    mower.facing = 0;
    target = null;
    planAutopilot();
    if (reduceMotion) prestripe();
  }

  function planAutopilot() {
    autoPath = [];
    const lane = 11;
    let x = lawnLeft + 6;
    for (let k = 0; k < 3; k++) {
      autoPath.push({ x, y: lawnTop + 4 });
      x += lane;
      autoPath.push({ x, y: lawnTop + 4 });
      autoPath.push({ x, y: lawnBottom - 5 });
      x += lane;
      autoPath.push({ x, y: lawnBottom - 5 });
    }
  }

  // Reduced motion: show a half-striped lawn instead of an animated demo.
  function prestripe() {
    const lane = 11;
    for (let x = lawnLeft; x < lawnLeft + (lawnRight - lawnLeft) / 2; x++) {
      const up = Math.floor((x - lawnLeft) / lane) % 2 === 0;
      for (let y = lawnTop; y < lawnBottom; y++) markCut(x, y, 0, up ? -1 : 1);
    }
  }

  function markCut(x, y, dx, dy) {
    if (x < lawnLeft || x >= lawnRight || y < lawnTop || y >= lawnBottom) return;
    const i = y * W + x;
    if (!cut[i]) { cut[i] = 1; cutCount++; }
    dirX[i] = dx;
    dirY[i] = dy;
    weed[i] = 0;
  }

  function cutUnderMower() {
    const len = Math.hypot(mower.vx, mower.vy) || 1;
    const dx = mower.vx / len, dy = mower.vy / len;
    // Snap stripe direction to the dominant axis so lanes read clean.
    const sx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
    const sy = sx === 0 ? Math.sign(dy) || -1 : 0;
    const r = 5;
    const cx = Math.round(mower.x), cy = Math.round(mower.y);
    let fresh = 0;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const i = y * W + x;
        if (y >= lawnTop && y < lawnBottom && x >= lawnLeft && x < lawnRight && !cut[i]) fresh++;
        markCut(x, y, sx, sy);
      }
    }
    if (fresh > 0 && !reduceMotion && particles.length < 160) {
      // Side discharge: clippings shoot out to the mower's right.
      const px = -sy || 0, py = sx || 0;
      for (let k = 0; k < Math.min(3, fresh / 4); k++) {
        particles.push({
          x: cx + px * 6, y: cy + py * 6,
          vx: px * (20 + Math.random() * 30) + (Math.random() - 0.5) * 12,
          vy: py * (20 + Math.random() * 30) + (Math.random() - 0.5) * 12,
          life: 0.5 + Math.random() * 0.4,
          c: RGB.clip[Math.floor(Math.random() * 3)],
        });
      }
    }
  }

  function put(x, y, rgb) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
  }

  function drawSprite(map, colors, ox, oy) {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const ch = map[y][x];
        if (ch !== '.' && colors[ch]) put(ox + x, oy + y, RGB[colors[ch]]);
      }
    }
  }

  function drawYard() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const n = base[i];
        let c;
        if (y < lawnTop - 4) {
          c = RGB.mulch[n % 4];
        } else if (y < lawnTop) {
          // cobble edging between bed and lawn, like granite setts
          const row = y - (lawnTop - 4);
          const joint = (x + (row > 1 ? 2 : 0)) % 4 === 0 || row === 2;
          c = joint ? RGB.mulch[3] : RGB.cobble[n % 3];
        } else if (y >= lawnBottom + 2) {
          const joint = (x % 24 === 0) || y === lawnBottom + 2;
          c = joint ? RGB.walkJoint : RGB.walk[n % 3];
        } else if (y >= lawnBottom) {
          c = RGB.curb;
        } else if (x < lawnLeft || x >= lawnRight) {
          c = RGB.mulch[n % 4];
        } else if (cut[i]) {
          const d = dirY[i];
          const ramp = d < 0 ? RGB.light : d > 0 ? RGB.dark : RGB.mid;
          c = ramp[n % 3];
        } else {
          const w = weed[i];
          if (w === 1) c = (n & 1) ? RGB.dandelion : RGB.dandelionDark;
          else if (w === 2) c = RGB.clover;
          else if (w === 3) c = RGB.uncut[0];
          else {
            // shaggy uncut grass: vertical blade streaks with sparse light tips
            const streak = hash(x, Math.floor(y / 3), 11);
            c = streak > 0.86 && n > 200 ? RGB.uncutTip : RGB.uncut[(n + Math.floor(streak * 4)) % 4];
          }
        }
        put(x, y, c);
      }
    }
    drawHedge();
  }

  function drawHedge() {
    // Arborvitae row along the back bed, rhododendrons tucked in front.
    for (let x0 = -3; x0 < W; x0 += 9) {
      const h = 14 + Math.floor(hash(x0, 2, 4) * 4);
      for (let y = 0; y < h; y++) {
        const half = Math.floor(((y + 2) / (h + 2)) * 5);
        for (let dx = -half; dx <= half; dx++) {
          const x = x0 + 4 + dx;
          const n = hash(x, y, 9);
          let c = RGB.hedge;
          if (dx === -half || y === h - 1) c = RGB.hedgeDark;
          else if (dx < 0 && n > 0.55) c = RGB.hedgeLight;
          else if (n > 0.7) c = RGB.hedgeMid;
          put(x, 1 + y, c);
        }
      }
    }
    const bushes = [0.12, 0.47, 0.8];
    bushes.forEach((fx, k) => {
      const cx = Math.round(W * fx), cy = 14;
      for (let y = -5; y <= 4; y++) {
        for (let x = -7; x <= 7; x++) {
          if ((x * x) / 49 + (y * y) / 25 > 1) continue;
          const n = hash(cx + x, cy + y, 21 + k);
          let c = n > 0.55 ? RGB.rhodie[Math.floor(n * 3) % 3] : RGB.hedgeMid;
          if (y === 4 || (x * x) / 49 + (y * y) / 25 > 0.8) c = n > 0.5 ? RGB.hedge : RGB.rhodie[0];
          put(cx + x, cy + y, c);
        }
      }
    });
    drawSprite(BLOWER, BLOWER_COLORS, blowerPos.x, blowerPos.y);
  }

  function drawMower() {
    const map = MOWER[mower.facing];
    const h = map.length, w = map[0].length;
    // The deck centre is the cutting point; offset so the deck sits on it.
    let ox, oy;
    if (mower.facing === 0) { ox = -5; oy = -5; }
    else if (mower.facing === 2) { ox = -5; oy = -(h - 6); }
    else if (mower.facing === 1) { ox = -(w - 6); oy = -5; }
    else { ox = -5; oy = -5; }
    drawSprite(map, MOWER_COLORS, Math.round(mower.x) + ox, Math.round(mower.y) + oy);
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      put(Math.round(p.x), Math.round(p.y), p.c);
    }
  }

  function update(dt) {
    let goal = target;
    if (!goal && autopilot && autoPath.length) {
      goal = autoPath[0];
      if (Math.hypot(goal.x - mower.x, goal.y - mower.y) < 1.5) autoPath.shift();
    }
    if (goal) {
      const dx = goal.x - mower.x, dy = goal.y - mower.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.8) {
        const sp = Math.min(autopilot && !target ? 38 : 70, dist * 8);
        mower.vx = (dx / dist);
        mower.vy = (dy / dist);
        mower.x += mower.vx * sp * dt;
        mower.y += mower.vy * sp * dt;
        mower.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        mower.x = Math.max(lawnLeft + 2, Math.min(lawnRight - 3, mower.x));
        mower.y = Math.max(lawnTop + 2, Math.min(lawnBottom - 3, mower.y));
        cutUnderMower();
      }
    }
    const pct = Math.min(100, Math.round((cutCount / lawnTotal) * 100));
    if (hud) hud.textContent = `${pct}% mowed`;
    if (pct >= 80 && !celebrated) {
      celebrated = true;
      done?.removeAttribute('hidden');
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    drawYard();
    drawMower();
    drawParticles(dt);
    ctx.putImageData(img, 0, 0);
    if (shake > 0) {
      shake -= dt;
      const a = Math.round((Math.random() - 0.5) * 6);
      canvas.style.transform = `translate(${a}px, ${-a}px)`;
      if (shake <= 0) canvas.style.transform = '';
    }
    requestAnimationFrame(frame);
  }

  function toLawn(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function hitBlower(p) {
    return p.x >= blowerPos.x - 3 && p.x <= blowerPos.x + 11 && p.y >= blowerPos.y - 3 && p.y <= blowerPos.y + 9;
  }

  function startMowing() {
    if (!started) {
      started = true;
      autopilot = false;
      hint?.classList.add('is-gone');
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toLawn(e);
    if (hitBlower(p)) { blowerPrank(); return; }
    startMowing();
    canvas.setPointerCapture(e.pointerId);
    target = p;
  });
  canvas.addEventListener('pointermove', (e) => { if (target) target = toLawn(e); });
  const stop = () => { target = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  // Keyboard: arrow keys drive the mower.
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowUp: [0, -6], ArrowDown: [0, 6], ArrowLeft: [-6, 0], ArrowRight: [6, 0] }[e.key];
    if (!step) {
      if (e.key === 'b' || e.key === 'B') blowerPrank();
      return;
    }
    e.preventDefault();
    startMowing();
    target = { x: mower.x + step[0], y: mower.y + step[1] };
    clearTimeout(canvas._kt);
    canvas._kt = setTimeout(() => { target = null; }, 140);
  });

  resetBtn?.addEventListener('click', () => {
    lastW = 0;
    setup();
    started = true;
    autopilot = false;
  });

  // Easter egg: the gas blower hiding in the hedge.
  function blowerPrank() {
    if (!reduceMotion) {
      shake = 0.7;
      for (let k = 0; k < 40; k++) {
        particles.push({
          x: blowerPos.x, y: blowerPos.y + 3,
          vx: -40 - Math.random() * 90, vy: (Math.random() - 0.3) * 60,
          life: 0.8 + Math.random() * 0.8,
          c: RGB.leaf[k % 3],
        });
      }
    }
    root.querySelector('[data-brap]')?.classList.remove('is-on');
    void root.offsetWidth;
    root.querySelector('[data-brap]')?.classList.add('is-on');
    setTimeout(() => ticket?.showModal?.(), reduceMotion ? 0 : 700);
  }

  setup();
  new ResizeObserver(() => setup()).observe(canvas);
  requestAnimationFrame(frame);
}
