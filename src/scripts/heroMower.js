// Homepage hero game: slide to line up the mower, hold to mow one straight pass.
// The mower only moves while the player holds the button. Up passes lay light stripes,
// down passes lay dark ones. Score = cover everything, with as little overlap as you can.
import { C as K, hash, smooth, MOWER, MOWER_COL, MOWER_ANCHOR } from './pixelkit.js';

const C = { ...K, lawnBg: [23, 61, 39] };
const DECK = 12;          // mower cut width, in lawn pixels
const LANES = 8;          // a perfect job is 8 passes
const EDGE = 4;           // mulch edging on each side
const HEDGE = 7;          // hedge rows top and bottom
const W = DECK * LANES + EDGE * 2;
const H = 82;
const L0 = EDGE, L1 = W - EDGE;          // lawn x range [L0, L1)
const T0 = HEDGE, T1 = H - HEDGE;        // lawn y range [T0, T1)
const LAWN_PX = (L1 - L0) * (T1 - T0);
const SPEED = 52;         // lawn pixels per second
const SNAP = 2.6;         // magnetic snap to an existing stripe edge
const FINISH = 0.99;      // coverage that ends the round
const BEST_KEY = 'mit-hero-best';

const RATINGS = [
  [96, 'Perfect stripes.', 'Ballpark grounds crew wants your number.'],
  [85, 'Neighbors noticed.', 'A couple of seams, but that’s a Saturday well spent.'],
  [70, 'Solid mow.', 'Tighter lines next time. The slider snaps to the last stripe if you get close.'],
  [0, 'It’s mowed. Technically.', 'Line each pass up right against the last one. No gaps, no double-cuts.'],
];

export function initHeroMower(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const track = root.querySelector('[data-mow-track]');
  const knob = root.querySelector('[data-knob]');
  const hold = root.querySelector('[data-hold]');
  const holdLabel = hold.querySelector('span');
  const hint = root.querySelector('[data-hint]');
  const result = root.querySelector('[data-result]');
  const outPct = root.querySelector('[data-pct]');
  const outPasses = root.querySelector('[data-passes]');
  const outBest = root.querySelector('[data-best]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  canvas.width = W; canvas.height = H;
  const img = ctx.createImageData(W, H), data = img.data;
  const base = new Uint8ClampedArray(W * H * 3);   // static background (hedge, edging, uncut grass)
  const cut = new Uint8Array(W * H);                // 0 uncut, 1 light (up), 2 dark (down)
  const passOf = new Uint16Array(W * H);
  const vari = new Uint8Array(W * H);

  // paint the static scene once
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, g = hash(x, y, 3);
    let c;
    if (y < T0) {
      // boxwood hedge: bumpy top, dark base shadow
      const bump = Math.round(1.6 + Math.sin(x * 0.55) * 1.2 + hash(x, 0, 8) * 0.8);
      const fromBase = T0 - 1 - y;
      let t = smooth(x, y, 3, 7) * 2.6 + g * 2 + (y - bump) * 0.55 - 0.6;
      if (fromBase === 0) t = g > 0.4 ? 0 : 1;
      c = y < bump ? C.lawnBg : C.hedge[Math.max(0, Math.min(5, Math.floor(t)))];
    } else if (y >= T1) {
      // sidewalk: a curb line, then concrete slabs with joints
      const r = y - T1;
      if (r === 0) c = C.curb[0];
      else if (x % 26 === 0) c = C.walk[0];
      else c = C.walk[Math.max(1, Math.min(4, Math.floor(1.6 + g * 2.2 + smooth(x, y, 4, 6))))];
    } else if (x < L0 || x >= L1) {
      c = C.mulch[Math.max(0, Math.min(4, Math.floor(g * 3.4 + smooth(x, y, 2, 9) * 1.8)))];
    } else {
      let t = smooth(x, y, 5, 1) * 2.4 + smooth(x * 3, y, 4, 2) * 1.8 + g * 2.2 - 1.4;
      if (g > 0.9) t += 2.6;            // bright blade tips
      c = C.uncut[Math.max(0, Math.min(6, Math.floor(t)))];
    }
    base[i * 3] = c[0]; base[i * 3 + 1] = c[1]; base[i * 3 + 2] = c[2];
    vari[i] = hash(x, y, 4) > 0.55 ? 1 : 0;
  }

  const xMin = L0 + DECK / 2, xMax = L1 - DECK / 2;
  const yBottom = T1 - DECK / 2, yTop = T0 + DECK / 2;
  let rowDone = -1, mx, my, dir, driving, pass, passes, overlap, fresh, started, done, particles, lastCov, growT;

  function reset() {
    cut.fill(0); passOf.fill(0); rowDone = -1;
    mx = xMin; my = yBottom; dir = 0; driving = false;
    pass = 1; passes = 0; overlap = 0; fresh = 0; started = false; done = false;
    particles = []; lastCov = 0;
    result.hidden = true;
    hold.disabled = false;
    setKnob();
    stats();
  }

  /* ---------------------------------------------------------- slider */
  const frac = () => (mx - xMin) / (xMax - xMin);
  function setKnob() {
    knob.style.left = `calc(23px + (100% - 46px) * ${frac().toFixed(4)})`;
    track.setAttribute('aria-valuenow', String(Math.round(frac() * 100)));
  }
  // pull the deck flush against a stripe edge when it's close
  function snap(x) {
    let best = x, bestD = SNAP;
    const row = Math.round(my) | 0;
    const probe = Math.min(T1 - 1, Math.max(T0, row));
    for (let c = L0 + 1; c < L1; c++) {
      const a = cut[probe * W + c - 1] ? 1 : 0, b = cut[probe * W + c] ? 1 : 0;
      if (a === b) continue;
      // edge between columns c-1 and c; deck can sit to its right (left edge = c) or left (right edge = c)
      for (const cand of [c + DECK / 2, c - DECK / 2]) {
        const d = Math.abs(cand - x);
        if (d < bestD) { bestD = d; best = cand; }
      }
    }
    return Math.max(xMin, Math.min(xMax, best));
  }
  function slideTo(clientX) {
    if (driving || done || growT > 0) return;
    const r = track.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left - 23) / (r.width - 46)));
    const nx = snap(xMin + f * (xMax - xMin));
    if (nx !== mx) { mx = nx; rowDone = -1; pass++; }
    setKnob();
    dismissHint();
  }
  let sliding = false;
  track.addEventListener('pointerdown', (e) => { sliding = true; track.setPointerCapture(e.pointerId); slideTo(e.clientX); });
  track.addEventListener('pointermove', (e) => { if (sliding) slideTo(e.clientX); });
  const stopSlide = () => { sliding = false; };
  track.addEventListener('pointerup', stopSlide);
  track.addEventListener('pointercancel', stopSlide);
  track.addEventListener('keydown', (e) => {
    if (driving || done) return;
    const step = e.shiftKey ? DECK : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      mx = Math.max(xMin, Math.min(xMax, mx + (e.key === 'ArrowLeft' ? -step : step)));
      if (!e.shiftKey) mx = snap(mx);
      rowDone = -1; pass++;
      setKnob(); dismissHint();
    }
  });

  /* ------------------------------------------------------------ hold */
  function startDrive(e) {
    if (e) e.preventDefault();
    if (done || growT > 0) return;
    driving = true; started = true;
    hold.classList.add('is-on'); holdLabel.textContent = 'Mowing…';
    dismissHint();
  }
  function stopDrive() {
    if (!driving) return;
    driving = false;
    hold.classList.remove('is-on'); holdLabel.textContent = 'Hold to mow';
    // end the round once you let go with (nearly) everything cut
    if (!done && fresh / LAWN_PX >= FINISH) finish();
  }
  hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); startDrive(e); });
  hold.addEventListener('pointerup', stopDrive);
  hold.addEventListener('pointercancel', stopDrive);
  hold.addEventListener('lostpointercapture', stopDrive);
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startDrive(e); });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stopDrive(); });
  root.querySelector('[data-again]').addEventListener('click', () => { result.hidden = true; growT = 0.8; });

  function dismissHint() { hint.classList.add('is-gone'); }

  /* ----------------------------------------------------------- update */
  function mowRow(y, mark) {
    const x0 = Math.round(mx - DECK / 2);
    let n = 0;
    for (let x = x0; x < x0 + DECK; x++) {
      if (x < L0 || x >= L1) continue;
      const i = y * W + x;
      if (!cut[i]) { n++; fresh++; }
      else if (passOf[i] !== pass) overlap++;
      cut[i] = mark; passOf[i] = pass;
    }
    return n;
  }

  function update(dt) {
    if (growT > 0) {
      growT -= dt;
      const n = Math.floor(LAWN_PX * dt * 1.8);
      for (let k = 0; k < n; k++) cut[(T0 + Math.floor(Math.random() * (T1 - T0))) * W + L0 + Math.floor(Math.random() * (L1 - L0))] = 0;
      if (growT <= 0) reset();
      return;
    }
    if (!driving || done) return;
    const vy = dir === 0 ? -1 : 1;
    const ny = Math.max(yTop, Math.min(yBottom, my + vy * SPEED * dt));
    // cut every row the deck's leading edge passed over
    const lead = (y) => (vy < 0 ? Math.floor(y - DECK / 2 + 0.5) : Math.ceil(y + DECK / 2 - 0.5) - 1);
    const from = rowDone;
    const to = lead(ny);
    const mark = dir === 0 ? 1 : 2;
    let got = 0;
    if (rowDone === -1) {
      // first touch of a pass: cut the whole deck footprint
      for (let y = Math.floor(Math.min(my, ny) - DECK / 2); y <= Math.ceil(Math.max(my, ny) + DECK / 2) - 1; y++) if (y >= T0 && y < T1) got += mowRow(y, mark);
    } else {
      const a = Math.min(from, to), b = Math.max(from, to);
      for (let y = a; y <= b; y++) if (y >= T0 && y < T1) got += mowRow(y, mark);
    }
    rowDone = to;
    my = ny;
    if (got && !reduceMotion && particles.length < 90) {
      for (let k = 0; k < 2; k++) particles.push({ x: mx + DECK / 2 + 1, y: my, vx: 30 + Math.random() * 25, vy: (Math.random() - 0.5) * 30, life: 0.35, c: C.clip[Math.floor(Math.random() * 3)] });
    }
    // reached the hedge: count the pass and turn around
    if ((dir === 0 && my <= yTop) || (dir === 2 && my >= yBottom)) {
      passes++; pass++; rowDone = -1;
      dir = dir === 0 ? 2 : 0;
      stopDrive();
      if (navigator.vibrate) navigator.vibrate(12);
    }
    stats();
    if (fresh >= LAWN_PX) finish();
  }

  function stats() {
    const cov = fresh / LAWN_PX;
    const pct = Math.min(100, Math.floor(cov * 100));
    if (pct !== lastCov) { outPct.textContent = `${pct}%`; lastCov = pct; }
    outPasses.textContent = String(passes);
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    outBest.textContent = best ? String(best) : '–';
  }

  function finish() {
    done = true;
    driving = false; hold.classList.remove('is-on'); holdLabel.textContent = 'Hold to mow';
    if (rowDone !== -1) passes++;   // a partial last pass still counts
    hold.disabled = true;
    const cov = fresh / LAWN_PX;
    const overlapPct = (overlap / LAWN_PX) * 100;
    const extra = Math.max(0, passes - LANES);
    const score = Math.max(0, Math.min(100, Math.round(100 - overlapPct * 2 - extra * 3 - (1 - cov) * 500)));
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    const isBest = score > best;
    if (isBest) try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
    const [, title, tip] = RATINGS.find(([min]) => score >= min);
    result.querySelector('[data-score]').textContent = String(score);
    result.querySelector('[data-title]').textContent = title + (isBest && best ? ' New best!' : '');
    result.querySelector('[data-tip]').textContent = tip;
    result.querySelector('[data-detail]').textContent =
      `${passes} ${passes === 1 ? 'pass' : 'passes'} (perfect is ${LANES}) · ${overlapPct < 0.5 ? 'no' : Math.round(overlapPct) + '%'} double-cut`;
    stats();
    setTimeout(() => { result.hidden = false; }, 350);
  }

  /* ------------------------------------------------------------- draw */
  function put(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; }
  function shade(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] *= 0.6; data[o + 1] *= 0.6; data[o + 2] *= 0.6; }

  function draw(dt) {
    for (let i = 0; i < W * H; i++) {
      const o = i * 4, k = cut[i];
      if (k) {
        // light stripe for up passes, dark for down; a little texture so it isn't flat
        const ramp = vari[i] ? C.cutAlt : C.cut;
        const c = ramp[k === 1 ? 4 - (hash(i, 1, 5) > 0.82 ? 1 : 0) : 2 - (hash(i, 2, 5) > 0.85 ? 1 : 0)];
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      } else {
        // uncut grass is shaggy, and casts a shadow onto fresh-cut grass next to it
        let f = 1;
        const x = i % W;
        if (x > L0 && x < L1 - 1 && (cut[i - 1] || cut[i + 1])) f = 0.62;
        data[o] = base[i * 3] * f; data[o + 1] = base[i * 3 + 1] * f; data[o + 2] = base[i * 3 + 2] * f;
      }
      data[o + 3] = 255;
    }
    // ghost guide showing where the next pass will cut
    if (!driving && !done && growT <= 0) {
      const x0 = Math.round(mx - DECK / 2);
      for (let y = T0; y < T1; y += 2) { put(x0, y, C.chalk[0]); put(x0 + DECK - 1, y, C.chalk[0]); }
    }
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; put(p.x, p.y, p.c); }
    const map = MOWER[dir], [ax, ay] = MOWER_ANCHOR[dir];
    const j = driving && !reduceMotion ? ((performance.now() / 45 | 0) % 2) : 0;
    const ox = Math.round(mx) - ax + j, oy = Math.round(my) - ay;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) if (map[y][x] !== '.' && map[y][x] !== 'G' && map[y][x] !== 'g') shade(ox + x + 2, oy + y + 2);
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) if (map[y][x] !== '.') put(ox + x, oy + y, MOWER_COL[map[y][x]]);
    ctx.putImageData(img, 0, 0);
  }

  growT = 0;
  reset();
  let last = performance.now(), visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (!visible) stopDrive(); }).observe(canvas);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) { update(dt); draw(dt); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
