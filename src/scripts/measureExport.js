// Draws the "my lawn" image: satellite photo, each area outlined and labeled with its
// square feet, and a striped footer with the total. Runs in the browser, no server.

import polylabel from 'polylabel';
import { tileSource, MAXZ } from './satTiles.js';
const DISPLAY = '"Bricolage Grotesque Variable", "Atkinson Hyperlegible Next", system-ui, sans-serif';
const BODY = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
const Z = 19; // work in pixel space at this zoom

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function proj(lat, lng) {
  const s = 256 * 2 ** Z;
  const r = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * s, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// angle: how far the map is turned on screen (radians), so the image matches what you saw.
export async function renderImage(areas, { angle = 0 } = {}) {
  try {
    await Promise.all([
      document.fonts.load(`800 60px ${DISPLAY}`),
      document.fonts.load(`700 30px ${BODY}`),
      document.fonts.load(`400 24px ${BODY}`),
    ]);
  } catch { /* system font is fine */ }

  const W = 1200;
  const FOOT = 210;
  const world = areas.map((a) => a.pts.map(([lat, lng]) => proj(lat, lng)));
  const flat = world.flat();
  const C = [flat.reduce((t, p) => t + p[0], 0) / flat.length, flat.reduce((t, p) => t + p[1], 0) / flat.length];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const turnP = ([x, y]) => [(x - C[0]) * cos - (y - C[1]) * sin, (x - C[0]) * sin + (y - C[1]) * cos];
  const unturnP = ([x, y]) => [x * cos + y * sin + C[0], -x * sin + y * cos + C[1]];
  const rings = world.map((r) => r.map(turnP));
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  let minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const pad = Math.max(maxx - minx, maxy - miny) * 0.12 + 24;
  minx -= pad; maxx += pad; miny -= pad; maxy += pad;

  // Map area between 4:3 landscape and 4:5 portrait. Grow the short side to fit.
  const mapH = Math.round(Math.min(1500, Math.max(900, (W * (maxy - miny)) / (maxx - minx))));
  const want = mapH / W;
  let bw = maxx - minx, bh = maxy - miny;
  if (bh / bw < want) { const g = bw * want - bh; miny -= g / 2; maxy += g / 2; bh = bw * want; }
  else { const g = bh / want - bw; minx -= g / 2; maxx += g / 2; bw = bh / want; }
  const s = W / bw;
  const X = (x) => (x - minx) * s;
  const Y = (y) => (y - miny) * s;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = mapH + FOOT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a4a30';
  ctx.fillRect(0, 0, W, mapH);

  // Satellite tiles, drawn turned to match the map. Pick a tile zoom near real size.
  const corners = [[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy]].map(unturnP);
  const ux = corners.map((p) => p[0]), uy = corners.map((p) => p[1]);
  const uminx = Math.min(...ux), umaxx = Math.max(...ux), uminy = Math.min(...uy), umaxy = Math.max(...uy);
  let tz = Math.min(MAXZ, Math.max(1, Z + Math.ceil(Math.log2(s))));
  let f = 2 ** (tz - Z);
  const count = () => (Math.floor((umaxx * f) / 256) - Math.floor((uminx * f) / 256) + 1) * (Math.floor((umaxy * f) / 256) - Math.floor((uminy * f) / 256) + 1);
  while (count() > 120 && tz > 1) { tz--; f = 2 ** (tz - Z); }
  ctx.imageSmoothingQuality = 'high';
  const jobs = [];
  for (let tx = Math.floor((uminx * f) / 256); tx <= Math.floor((umaxx * f) / 256); tx++) {
    for (let ty = Math.floor((uminy * f) / 256); ty <= Math.floor((umaxy * f) / 256); ty++) {
      jobs.push(tileSource(tz, tx, ty).then((src) => ({ src, tx, ty })));
    }
  }
  const tiles = await Promise.all(jobs);
  // Stitch the tiles flat first, then turn the whole mosaic once, so no seams show.
  const tx0 = Math.floor((uminx * f) / 256), ty0 = Math.floor((uminy * f) / 256);
  const cols = Math.floor((umaxx * f) / 256) - tx0 + 1, rows = Math.floor((umaxy * f) / 256) - ty0 + 1;
  const mosaic = document.createElement('canvas');
  mosaic.width = cols * 256;
  mosaic.height = rows * 256;
  const mctx = mosaic.getContext('2d');
  mctx.imageSmoothingQuality = 'high';
  mctx.fillStyle = '#2a4a30';
  mctx.fillRect(0, 0, mosaic.width, mosaic.height);
  for (const { src, tx, ty } of tiles) {
    if (src) mctx.drawImage(src.img, src.sx, src.sy, src.sw, src.sw, (tx - tx0) * 256, (ty - ty0) * 256, 256, 256);
  }
  ctx.save();
  ctx.setTransform(s, 0, 0, s, -minx * s, -miny * s);
  ctx.rotate(angle);
  ctx.translate(-C[0], -C[1]);
  const size = 256 / f;
  ctx.drawImage(mosaic, tx0 * size, ty0 * size, cols * size, rows * size);
  ctx.restore();

  // Shapes: dark outline under a colored line so edges read on any photo.
  ctx.lineJoin = 'round';
  rings.forEach((ring, i) => {
    const c = areas[i].color;
    ctx.beginPath();
    ring.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = c;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(10,36,20,0.85)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = 4;
    ctx.stroke();
  });

  // Labels inside each shape.
  rings.forEach((ring, i) => {
    const a = areas[i];
    const pl = polylabel([[...ring, ring[0]]], 0.5);
    const cx = X(pl[0]), cy = Y(pl[1]), r = pl.distance * s;
    const big = Math.max(22, Math.min(44, r * 0.42));
    const showName = r > 48 && a.name;
    const nameSize = Math.round(big * 0.66);
    const num = `${fmt(a.sqft)} sq ft`;
    ctx.font = `800 ${big}px ${DISPLAY}`;
    const wNum = ctx.measureText(num).width;
    ctx.font = `700 ${nameSize}px ${BODY}`;
    const wName = showName ? ctx.measureText(a.name).width : 0;
    const padX = big * 0.45, bar = Math.max(8, big * 0.22);
    const w = Math.max(wNum, wName) + padX * 2 + bar;
    const h = big * 1.18 + (showName ? nameSize * 1.2 : 0) + big * 0.36;
    const x0 = cx - w / 2, y0 = cy - h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowOffsetY = 3;
    roundRect(ctx, x0, y0, w, h, 10);
    ctx.fillStyle = 'rgba(241,246,236,0.96)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x0, y0, w, h, 10);
    ctx.clip();
    ctx.fillStyle = a.color;
    ctx.fillRect(x0, y0, bar, h);
    ctx.restore();
    roundRect(ctx, x0, y0, w, h, 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0a2414';
    ctx.stroke();
    ctx.fillStyle = '#12301d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const mx = x0 + bar + (w - bar) / 2;
    let ty = y0 + big * 0.18;
    if (showName) {
      ctx.font = `700 ${nameSize}px ${BODY}`;
      ty += nameSize * 1.05;
      ctx.fillText(a.name, mx, ty);
    }
    ctx.font = `800 ${big}px ${DISPLAY}`;
    ty += big * 1.05;
    ctx.fillText(num, mx, ty);
  });

  // Imagery credit, required by the provider.
  ctx.font = `400 18px ${BODY}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const credit = 'Imagery © Esri, Maxar, Earthstar Geographics';
  const cw = ctx.measureText(credit).width;
  ctx.fillRect(W - cw - 20, mapH - 32, cw + 20, 32);
  ctx.fillStyle = '#fff';
  ctx.fillText(credit, W - 10, mapH - 10);

  // Footer: site stripes, total, wordmark.
  for (let x = 0; x < W; x += 144) {
    ctx.fillStyle = '#173d27';
    ctx.fillRect(x, mapH, 72, FOOT);
    ctx.fillStyle = '#1b452c';
    ctx.fillRect(x + 72, mapH, 72, FOOT);
  }
  ctx.fillStyle = '#eef5e6';
  ctx.fillRect(0, mapH, W, 4);

  const t = areas.reduce((sum, a) => sum + a.sqft, 0);
  const ac = t / 43560;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd36a';
  ctx.font = `700 24px ${BODY}`;
  ctx.fillText('TOTAL LAWN', 48, mapH + 58);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 76px ${DISPLAY}`;
  const totalText = `${fmt(t)} sq ft`;
  ctx.fillText(totalText, 46, mapH + 136);
  ctx.fillStyle = '#c9dcc0';
  ctx.font = `400 26px ${BODY}`;
  const n = areas.length;
  ctx.fillText(`${ac < 0.1 ? ac.toFixed(3) : ac.toFixed(2)} acres · ${n} area${n === 1 ? '' : 's'}`, 48, mapH + 176);

  // "Mow It TALL" with TALL stretched taller, like the site's wordmark.
  ctx.textAlign = 'right';
  ctx.font = `800 40px ${DISPLAY}`;
  const tallW = ctx.measureText('TALL').width;
  ctx.fillStyle = '#9fd36a';
  ctx.save();
  ctx.translate(W - 48, mapH + 110);
  ctx.scale(1, 1.3);
  ctx.fillText('TALL', 0, 0);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Mow It ', W - 48 - tallW, mapH + 110);
  ctx.fillStyle = '#c9dcc0';
  ctx.font = `400 24px ${BODY}`;
  ctx.fillText('mowittall.com', W - 48, mapH + 150);

  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/jpeg', 0.9));
}
