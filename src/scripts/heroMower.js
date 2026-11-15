// Homepage hero game: slide to line up the mower, hold to mow one straight pass.
// The mower only moves while the player holds the button. Up passes lay light stripes,
// down passes lay dark ones. Score = cover everything with little overlap, beat par,
// and don't mow into the neighbor's dog. The guide line fades after the first few passes.
import { C as K, hash, smooth, MOWER, MOWER_COL, MOWER_ANCHOR } from './pixelkit.js';

const C = { ...K, lawnBg: [23, 61, 39] };
const DECK = 12;          // mower cut width, in lawn pixels
const LANES = 8;          // a perfect job is 8 passes
const EDGE = 4;           // mulch edging on each side
const HEDGE = 7;          // hedge rows top and bottom
const W = DECK * LANES + EDGE * 2;
const H = 72;
const L0 = EDGE, L1 = W - EDGE;          // lawn x range [L0, L1)
const T0 = HEDGE, T1 = H - HEDGE;        // lawn y range [T0, T1)
const LAWN_PX = (L1 - L0) * (T1 - T0);
const SPEED = 52;         // lawn pixels per second
const PAR = 45;           // seconds; relaxed on purpose: about 4 seconds to line up each pass, plus dog waits
const DOG_HIT = 5;        // points lost for bumping the dog
const GUIDE_PASSES = 3;   // the guide line fades out over this many passes
const FINISH = 0.99;      // coverage that ends the round on its own
const DONE_AT = 0.95;     // coverage where "Call it done" shows up
const BEST_KEY = 'mit-hero-best';

const RATINGS = [
  [96, 'Perfect stripes.', 'Ballpark grounds crew wants your number.'],
  [85, 'Neighbors noticed.', 'A couple of seams, but that’s a Saturday well spent.'],
  [70, 'Solid mow.', 'Line each pass right up against the last one. You’ve got time, par is relaxed.'],
  [0, 'It’s mowed. Technically.', 'Gaps and double-cuts add up. Take a second on the slider, and let the dog pass.'],
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
  const outBest = root.querySelector('[data-best]');
  const pop = root.querySelector('[data-pop]');
  const doneBtn = root.querySelector('[data-done]');
  const outTime = root.querySelector('[data-time]');
  const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
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
  let rowDone = -1, dogHits = 0, popT = 0, clock = 0, dogs = [], dogPlan = [], mx, my, dir, driving, pass, passes, overlap, fresh, started, done, particles, lastCov, growT;

  function reset() {
    cut.fill(0); passOf.fill(0); rowDone = -1;
    mx = xMin; my = yBottom; dir = 0; driving = false; dogHits = 0; clock = 0; dogs = [];
    dogPlan = [5 + Math.random() * 5, 15 + Math.random() * 7];   // two dogs, at random times
    doneBtn.hidden = true; pop.classList.remove('is-on');
    pass = 1; passes = 0; overlap = 0; fresh = 0; started = false; done = false;
    particles = []; lastCov = 0;
    result.hidden = true;
    hold.disabled = false;
    setKnob();
    outTime.textContent = '0:00'; outTime.classList.remove('is-over');
    stats();
  }

  /* ---------------------------------------------------------- slider */
  const frac = () => (mx - xMin) / (xMax - xMin);
  function setKnob() {
    knob.style.left = `calc(23px + (100% - 46px) * ${frac().toFixed(4)})`;
    track.setAttribute('aria-valuenow', String(Math.round(frac() * 100)));
  }
  function slideTo(clientX) {
    if (driving || done || growT > 0) return;
    const r = track.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left - 23) / (r.width - 46)));
    const nx = xMin + f * (xMax - xMin);
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
      rowDone = -1; pass++;
      setKnob(); dismissHint();
    }
  });

  /* ------------------------------------------------------------ hold */
  function startDrive(e) {
    if (e) e.preventDefault();
    if (done || growT > 0) return;
    driving = true; started = true; doneBtn.hidden = true;
    hold.classList.add('is-on'); holdLabel.textContent = 'Mowing…';
    dismissHint();
  }
  function stopDrive() {
    if (!driving) return;
    driving = false;
    hold.classList.remove('is-on'); holdLabel.textContent = 'Hold to mow';
    settle();
  }
  // after the mower comes to rest: end the round, or offer to call it
  function settle() {
    if (done) return;
    const cov = fresh / LAWN_PX;
    if (cov >= FINISH) finish();
    else doneBtn.hidden = cov < DONE_AT;
  }
  function showPop(text, kind, top) {
    pop.textContent = text;
    pop.className = `mow-pop is-on is-${kind} ${top ? 'at-top' : 'at-bottom'}`;
    popT = 1.1;
  }
  doneBtn.addEventListener('click', () => { if (!driving) finish(); });

  /* ------------------------------------------------------------- dogs */
  // the neighbor's dog trots across the lawn; don't mow into it
  const DOG_W = 14, DOG_H = 9;
  function spawnDog() {
    const fromLeft = Math.random() < 0.5;
    // cross somewhere the mower isn't sitting right now
    let y;
    for (let k = 0; k < 8; k++) { y = T0 + 6 + Math.random() * (T1 - T0 - 12 - DOG_H); if (Math.abs(y + DOG_H / 2 - my) > 16) break; }
    dogs.push({ x: fromLeft ? -DOG_W : W, y, vx: fromLeft ? 30 : -30, hit: false, t: 0 });
    showPop('Dog on the lawn!', 'warn', y > (T0 + T1) / 2);
  }
  const deckHitsDog = (y) => dogs.some((d) => {
    const over = mx + DECK / 2 > d.x + 1 && mx - DECK / 2 < d.x + DOG_W - 1 && y + DECK / 2 > d.y + 1 && y - DECK / 2 < d.y + DOG_H - 1;
    if (over && !d.hit) {
      d.hit = true; dogHits++;
      showPop(`Watch the dog! −${DOG_HIT}`, 'bad', d.y < (T0 + T1) / 2);
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    }
    return over;
  });
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
    if (popT > 0 && (popT -= dt) <= 0) pop.classList.remove('is-on');
    if (done) return;
    if (started) {
      clock += dt;
      if (dogPlan.length && clock >= dogPlan[0]) { dogPlan.shift(); spawnDog(); }
      outTime.textContent = fmtTime(clock);
      outTime.classList.toggle('is-over', clock > PAR);
    }
    for (const d of dogs) { d.x += d.vx * dt; d.t += dt; }
    dogs = dogs.filter((d) => d.x > -DOG_W - 2 && d.x < W + 2);
    if (!driving) return;
    const vy = dir === 0 ? -1 : 1;
    const ny = Math.max(yTop, Math.min(yBottom, my + vy * SPEED * dt));
    // the mower waits while the dog is in the way (and you lose points the first time you bump it)
    if (deckHitsDog(ny)) return;
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
      driving = false; hold.classList.remove('is-on'); holdLabel.textContent = 'Hold to mow';
      if (navigator.vibrate) navigator.vibrate(12);
      settle();
    }
    stats();
    if (fresh >= LAWN_PX && !done) finish();
  }

  function stats() {
    const cov = fresh / LAWN_PX;
    const pct = Math.min(100, Math.floor(cov * 100));
    if (pct !== lastCov) { outPct.textContent = `${pct}%`; lastCov = pct; }
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    outBest.textContent = best ? String(best) : '–';
  }

  function finish() {
    done = true;
    driving = false; doneBtn.hidden = true; hold.classList.remove('is-on'); holdLabel.textContent = 'Hold to mow';
    if (rowDone !== -1) passes++;   // a partial last pass still counts
    hold.disabled = true;
    const cov = fresh / LAWN_PX;
    const overlapPct = (overlap / LAWN_PX) * 100;
    const extra = Math.max(0, passes - LANES);
    const overPar = clock > PAR ? Math.min(20, Math.ceil((clock - PAR) / 2)) : 0;   // 1 point per 2 seconds over
    const score = Math.max(0, Math.min(100, Math.round(100 - overlapPct * 2 - extra * 3 - (1 - cov) * 500 - dogHits * DOG_HIT - overPar)));
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    const isBest = score > best;
    if (isBest) try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
    const [, title, tip] = RATINGS.find(([min]) => score >= min);
    result.querySelector('[data-score]').textContent = String(score);
    result.querySelector('[data-title]').textContent = title + (isBest && best ? ' New best!' : '');
    result.querySelector('[data-tip]').textContent = tip;
    const chips = [
      ['Passes', `${passes}/${LANES}`, passes <= LANES],
      ['Double-cut', overlapPct < 0.5 ? 'none' : Math.round(overlapPct) + '%', overlapPct < 0.5],
      ['Missed', cov >= 0.995 ? 'none' : Math.round((1 - cov) * 100) + '%', cov >= 0.995],
      ['Time', fmtTime(clock), clock <= PAR],
      ['Dog', dogHits ? (dogHits > 1 ? 'bumped twice' : 'bumped') : 'dodged', !dogHits],
    ];
    const ul = result.querySelector('[data-detail]');
    ul.replaceChildren(...chips.map(([k, v, ok]) => {
      const li = document.createElement('li');
      li.className = ok ? 'is-ok' : 'is-off';
      li.append(k + ' ');
      const b = document.createElement('b'); b.textContent = v; li.append(b);
      return li;
    }));
    stats();
    setTimeout(() => { result.hidden = false; result.querySelector('[data-again]').focus({ preventScroll: true }); }, 350);
  }

  /* ------------------------------------------------------------- draw */
  function put(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; }
  function mix(x, y, c, a) { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; for (let k = 0; k < 3; k++) data[o + k] += (c[k] - data[o + k]) * a; }
  function shade(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] *= 0.6; data[o + 1] *= 0.6; data[o + 2] *= 0.6; }

  // 14x9 dog facing right, two walking frames
  const DOG = [
    ['..........kk..', '.........kBBk.', 'k........kBBBn', '.kBBBBBBBBBbb.', '..BBBBBBBBBk..', '..BbBBBBBbB...', '..BBBBBBBBB...', '..k.k....k.k..', '..k.k....k.k..'],
    ['..........kk..', '.........kBBk.', '.k.......kBBBn', '..kBBBBBBBBbb.', '..BBBBBBBBBk..', '..BbBBBBBbB...', '..BBBBBBBBB...', '.k...k..k...k.', 'k.....kk.....k'],
  ];
  const DOG_COL = { B: C.dog[2], b: C.dog[1], k: C.dog[3], n: C.ink };
  function drawDog(d) {
    const map = DOG[(d.t * 6 | 0) % 2], flip = d.vx < 0;
    for (let y = 0; y < DOG_H; y++) for (let x = 0; x < DOG_W; x++) {
      const ch = map[y][flip ? DOG_W - 1 - x : x];
      if (ch === '.') continue;
      if (y === DOG_H - 1 || y === DOG_H - 2) shade(Math.round(d.x) + x + 1, Math.round(d.y) + y + 2);
      put(d.x + x, d.y + y, DOG_COL[ch]);
    }
  }
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
    const ga = 1 - passes / GUIDE_PASSES;
    if (!driving && !done && growT <= 0 && ga > 0) {
      const x0 = Math.round(mx - DECK / 2);
      for (let y = T0; y < T1; y += 2) { mix(x0, y, C.chalk[0], ga); mix(x0 + DECK - 1, y, C.chalk[0], ga); }
    }
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; put(p.x, p.y, p.c); }
    for (const d of dogs) drawDog(d);
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
