// Shared: the visitor's measured lawn from /measure/ (localStorage 'mit-yard').
export function yardTotal() {
  try {
    const y = JSON.parse(localStorage.getItem('mit-yard') || 'null');
    return y && y.total > 0 ? Math.round(y.total) : 0;
  } catch { return 0; }
}
export const num = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
export const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const round1 = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
