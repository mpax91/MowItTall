// The homepage toy: a strip of lawn you mow by dragging your thumb across it.
// No rules, no score. Mow up and it lays a light stripe, mow back and it lays a dark one.
import { C, hash, smooth, MOWER, MOWER_COL, MOWER_ANCHOR } from './pixelkit.js';

export function initHeroLawn(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hint = root.querySelector('[data-hint]');
  const regrow = root.querySelector('[data-regrow]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deck = 6;
  let W, H, img, data, cut, tV, tH, tone, vari, growT = 0;
  let mower = { x: 0, y: 0, hx: 0, hy: -1, dir: 0 }, target = null, particles = [], touched = false, lastW = 0;

  function build() {
    const r = canvas.getBoundingClientRect();
    const scale = Math.max(2, Math.round(r.width / 130));
    W = Math.max(80, Math.round(r.width / scale));
    H = Math.max(40, Math.round(r.height / scale));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H); data = img.data;
    cut = new Uint8Array(W * H); tV = new Int8Array(W * H); tH = new Int8Array(W * H);
    tone = new Uint8Array(W * H); vari = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, g = hash(x, y, 3);
      let t = smooth(x, y, 5, 1) * 3.2 + smooth(x * 3, y, 4, 2) * 2.2 + g * 1.6 - 0.6;
      if (g > 0.93) t += 1.5;
      tone[i] = Math.max(0, Math.min(6, Math.floor(t)));
      vari[i] = hash(x, y, 4) > 0.55 ? 1 : 0;
    }
    mower.x = Math.round(W * 0.12); mower.y = Math.round(H * 0.6);
    // a couple of stripes already mowed so it's obvious what this is
    if (!touched) for (let k = 0; k < 2; k++) {
      const x0 = Math.round(W * 0.06) + k * deck * 2;
      for (let y = 0; y < H; y++) for (let x = x0; x < x0 + deck * 2 && x < W; x++) { const i = y * W + x; cut[i] = 1; tV[i] = k % 2 ? 1 : -1; }
    }
  }

  function draw(dt) {
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      let c;
      if (!cut[i]) c = C.uncut[tone[i]];
      else c = (vari[i] ? C.cutAlt : C.cut)[Math.max(0, Math.min(4, 2 - tV[i] * 2 - tH[i]))];
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; put(p.x, p.y, p.c); }
    const map = MOWER[mower.dir], [ax, ay] = MOWER_ANCHOR[mower.dir];
    const j = target && !reduceMotion ? ((performance.now() / 45 | 0) % 2) : 0;
    const ox = Math.round(mower.x) - ax + (mower.dir % 2 ? 0 : j), oy = Math.round(mower.y) - ay + (mower.dir % 2 ? j : 0);
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) if (map[y][x] !== '.' && map[y][x] !== 'G' && map[y][x] !== 'g') shade(ox + x + 2, oy + y + 2);
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) if (map[y][x] !== '.') put(ox + x, oy + y, MOWER_COL[map[y][x]]);
    ctx.putImageData(img, 0, 0);
  }
  function put(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; }
  function shade(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] *= 0.6; data[o + 1] *= 0.6; data[o + 2] *= 0.6; }

  function update(dt) {
    if (growT > 0) {
      // grass grows back in, pixel by pixel
      growT -= dt;
      const n = Math.floor(W * H * dt * 1.6);
      for (let k = 0; k < n; k++) cut[Math.floor(Math.random() * W * H)] = 0;
      if (growT <= 0) cut.fill(0);
      return;
    }
    if (!target) return;
    const dx = target.x - mower.x, dy = target.y - mower.y, d = Math.hypot(dx, dy);
    if (d < 0.3) return;
    const step = Math.min(d, 110 * dt);
    mower.x += dx / d * step; mower.y += dy / d * step;
    const k = Math.min(1, dt * 14);
    mower.hx += (dx / d - mower.hx) * k; mower.hy += (dy / d - mower.hy) * k;
    const hl = Math.hypot(mower.hx, mower.hy) || 1; mower.hx /= hl; mower.hy /= hl;
    mower.dir = Math.abs(mower.hx) > Math.abs(mower.hy) ? (mower.hx > 0 ? 1 : 3) : (mower.hy > 0 ? 2 : 0);
    const v = Math.abs(mower.hy) > 0.7 ? (mower.hy < 0 ? -1 : 1) : 0;
    const h = Math.abs(mower.hx) > 0.7 ? (mower.hx < 0 ? -1 : 1) : 0;
    let fresh = 0;
    for (let y = Math.round(mower.y) - deck; y < Math.round(mower.y) + deck; y++) for (let x = Math.round(mower.x) - deck; x < Math.round(mower.x) + deck; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (!cut[i]) fresh++;
      cut[i] = 1;
      if (v) { tV[i] = v; tH[i] = 0; } else if (h) { tH[i] = h; }
    }
    if (fresh && !reduceMotion && particles.length < 120) {
      const sx = -mower.hy, sy = mower.hx;
      particles.push({ x: mower.x + sx * 8, y: mower.y + sy * 8, vx: sx * 40 + (Math.random() - 0.5) * 14, vy: sy * 40 + (Math.random() - 0.5) * 14, life: 0.4, c: C.clip[Math.floor(Math.random() * 3)] });
    }
    let c = 0; for (let i = 0; i < cut.length; i += 7) c += cut[i];
    if (c / (cut.length / 7) > 0.6) regrow.hidden = false;
  }

  const toLawn = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    target = toLawn(e);
    if (!touched) { touched = true; hint.classList.add('is-gone'); }
  });
  canvas.addEventListener('pointermove', (e) => { if (target) target = toLawn(e); });
  const end = () => { target = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  regrow.addEventListener('click', () => { growT = 0.9; regrow.hidden = true; });

  let last = performance.now(), visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) { update(dt); draw(dt); }
    requestAnimationFrame(frame);
  }
  new ResizeObserver(() => { const w = canvas.getBoundingClientRect().width; if (Math.abs(w - lastW) > 2) { lastW = w; build(); } }).observe(canvas);
  build();
  requestAnimationFrame(frame);
}
