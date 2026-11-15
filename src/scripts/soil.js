// Live soil temperature from Open-Meteo (free, no key). Bedford, NY unless the visitor picks a ZIP.
import { getPlace, noteFor } from './place.js';

function advice(temp, month) {
  const spring = month >= 2 && month <= 5; // Mar–Jun
  const fall = month >= 8 && month <= 10; // Sep–Nov
  if (temp < 40) return 'Your grass is resting. Nothing to do but mow the leaves into the lawn.';
  if (temp < 50) {
    if (spring) return 'Waking up. Crabgrass starts sprouting around 55°F, so get your crabgrass preventer ready.';
    return 'Grass is slowing down for winter. Good time for one last mow and a final feeding.';
  }
  if (temp < 56) {
    if (spring) return 'Crabgrass preventer time. Put it down this week if you haven’t yet.';
    if (fall) return 'Still great for seeding bare spots. Roots keep growing until the ground gets cold.';
    return 'Cool and comfortable. Your grass is happy.';
  }
  if (temp < 68) {
    if (fall) return 'Perfect for seeding. Fill in thin spots now and keep the seed damp.';
    return 'Prime growing weather. Mow every week and keep it tall.';
  }
  return 'Heat stress zone. Mow tall, water deep once or twice a week, and skip fertilizer.';
}

export function initSoil(el) {
  load(el, getPlace());
  window.addEventListener('mit:place', (e) => load(el, e.detail));
}

let seq = 0;
async function load(el, place) {
  const mine = ++seq;
  const noteEl = el.querySelector('[data-soil-note]');
  if (noteEl) { noteEl.textContent = noteFor(place); noteEl.hidden = !noteEl.textContent; }
  el.classList.remove('is-live');
  const valueEl = el.querySelector('[data-soil-value]');
  const adviceEl = el.querySelector('[data-soil-advice]');
  const trendEl = el.querySelector('[data-soil-trend]');
  const marker = el.querySelector('[data-marker]');
  const lo = Number(el.dataset.lo), hi = Number(el.dataset.hi);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}` +
    `&hourly=soil_temperature_6cm&temperature_unit=fahrenheit&timezone=America%2FNew_York&past_days=7&forecast_days=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (mine !== seq) return; // a newer place was picked while this was loading
    const times = json.hourly.time;
    const temps = json.hourly.soil_temperature_6cm;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
    let idx = times.indexOf(key);
    if (idx < 0) idx = temps.findLastIndex((t) => t != null);
    const current = Math.round(temps[idx]);
    valueEl.textContent = `${current}°F`;
    adviceEl.textContent = advice(current, now.getMonth());
    const pct = Math.max(0, Math.min(100, ((current - lo) / (hi - lo)) * 100));
    marker.style.left = `${pct}%`;
    el.querySelector('[data-thermo]').setAttribute('aria-label', `Soil thermometer reading ${current}°F`);

    for (const z of el.querySelectorAll('[data-zone]')) {
      const on = current >= Number(z.dataset.min) && current < Number(z.dataset.max);
      z.classList.toggle('is-current', on || (current < lo && z.dataset.min == lo) || (current >= hi && z.dataset.max == hi));
    }

    trendEl.textContent = '';
    const weekAgo = temps[idx - 24 * 7];
    if (weekAgo != null) {
      const diff = Math.round(current - weekAgo);
      trendEl.textContent = diff === 0
        ? 'Same as a week ago.'
        : `${Math.abs(diff)}° ${diff > 0 ? 'warmer' : 'cooler'} than a week ago${diff > 0 ? (now.getMonth() < 6 ? '. Spring is coming.' : '.') : (now.getMonth() > 7 ? '. Winter is coming.' : '.')}`;
    }
    el.classList.add('is-live');
  } catch (err) {
    if (mine !== seq) return;
    valueEl.textContent = '--';
    adviceEl.textContent = 'Couldn’t reach the weather service. Try again in a bit.';
  }
}
