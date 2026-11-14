// Shared palette and a tiny map-to-SVG renderer for pixel sprites.
export const PALETTE = {
  a: '#173b22', // ink green
  g: '#3f8a3a', // grass
  l: '#86c14f', // light grass
  b: '#3b7fd1', // water
  w: '#f4f6ef', // white
  W: '#c9d6bf', // white shade
  s: '#6f767c', // steel dark
  S: '#c3c9ce', // steel light
  o: '#d9822b', // orange
  O: '#b4540f', // orange dark
  y: '#f6c945', // yellow
  Y: '#d99a1c', // yellow dark
  p: '#9a6ad6', // violet
  P: '#5e3a96', // violet dark
  r: '#c8372d', // red
  k: '#1a120d', // near black
  t: '#8a5a33', // soil
};

export function toSvg(map, size = 48, label = '') {
  const h = map.length, w = map[0].length;
  let rects = '';
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (PALETTE[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch]}"/>`;
    });
  });
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="pixel-icon" width="${size}" height="${size}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${a11y}>${rects}</svg>`;
}
