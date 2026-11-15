// Sharp satellite tiles from Esri World Imagery.
// Esri has zoom 20 photos across Westchester (and zoom 21 in some spots) but answers with a gray
// "Map data not yet available" tile where it doesn't. We ask for the sharpest level, spot the gray
// placeholder, and fall back to a cropped piece of the parent tile instead.

export const MAXZ = 20; // 21 exists in patches only, and mixing the two shows seams
export const TILE_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const cache = new Map();
const missing = new Set(); // blocks of tiles at a zoom level we know Esri doesn't have
let probe = null;

function isPlaceholder(img) {
  try {
    if (!probe) {
      probe = document.createElement('canvas');
      probe.width = probe.height = 16;
    }
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(img, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    let gray = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 192 && r < 216 && Math.abs(r - g) < 5 && Math.abs(g - b) < 5) gray++;
    }
    return gray > 180; // of 256
  } catch {
    return false;
  }
}

function load(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (cache.has(key)) return cache.get(key);
  const p = new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => res(z >= 20 && isPlaceholder(img) ? null : img);
    img.onerror = () => res(null);
    img.src = TILE_URL(z, x, y);
  });
  cache.set(key, p);
  if (cache.size > 600) cache.delete(cache.keys().next().value);
  return p;
}

// Resolves to { img, sx, sy, sw }: the square of `img` that shows tile z/x/y, or null.
export async function tileSource(z, x, y) {
  const block = `${z}/${x >> 3}/${y >> 3}`;
  if (z <= MAXZ && !missing.has(block)) {
    const img = await load(z, x, y);
    if (img) return { img, sx: 0, sy: 0, sw: 256 };
    if (z >= 20) missing.add(block);
  }
  if (z <= 1) return null;
  const p = await tileSource(z - 1, x >> 1, y >> 1);
  if (!p) return null;
  const h = p.sw / 2;
  return { img: p.img, sx: p.sx + (x & 1) * h, sy: p.sy + (y & 1) * h, sw: h };
}

// A Leaflet layer that draws each tile at the screen's real resolution (2x on phones).
export function satLayer(L, options = {}) {
  const Layer = L.GridLayer.extend({
    createTile(coords, done) {
      const dpr = window.devicePixelRatio || 1;
      const k = dpr > 1.2 ? 2 : 1;
      const c = document.createElement('canvas');
      c.width = c.height = 256 * k;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const z = coords.z + (k - 1);
      const jobs = [];
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          jobs.push(tileSource(z, coords.x * k + i, coords.y * k + j).then((s) => {
            if (s) ctx.drawImage(s.img, s.sx, s.sy, s.sw, s.sw, i * 256, j * 256, 256, 256);
          }));
        }
      }
      Promise.all(jobs).then(() => done(null, c));
      return c;
    },
  });
  return new Layer({ maxNativeZoom: MAXZ, ...options });
}
