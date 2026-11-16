// Rain meter: should I water the lawn? Open-Meteo (free, no key) for the visitor's place.
// Water balance: rain over the last 7 days vs. what the grass used (reference ET x 0.8 for
// cool-season turf), then the next 3 days of forecast rain. Bedford unless the visitor picks a ZIP.
import { getPlace, noteFor } from './place.js';

const KC = 0.8;              // cool-season lawn uses ~80% of reference evapotranspiration
const GAUGE_KEY = 'mit-gauge';
const DAY = 864e5;

export const VERDICTS = {
  asleep: { label: 'Not Needed', tone: 'ok' },
  skip: { label: 'Not Needed', tone: 'ok' },
  wait: { label: 'Wait for Rain', tone: 'wait' },
  maybe: { label: 'Recommended', tone: 'maybe' },
  water: { label: 'Needed', tone: 'water' },
};

const cache = new Map();
export async function fetchWater(place) {
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration,precipitation_probability_max,temperature_2m_max` +
    `&precipitation_unit=inch&temperature_unit=fahrenheit&timezone=America%2FNew_York&past_days=7&forecast_days=4`;
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((j) => {
    const d = j.daily;
    // index 0..6 = the 7 days before today, 7 = today so far, 8..10 = next 3 days
    return d.time.map((t, i) => ({
      date: t, rain: d.precipitation_sum[i] ?? 0, et: d.et0_fao_evapotranspiration[i] ?? 0,
      chance: d.precipitation_probability_max[i] ?? 0, high: d.temperature_2m_max[i],
      past: i < 7, today: i === 7, future: i > 7,
    }));
  });
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

export function getGauge() {
  try {
    const g = JSON.parse(localStorage.getItem(GAUGE_KEY) || 'null');
    if (g && Date.now() - g.at < 7 * DAY && g.inches >= 0) return g;
  } catch {}
  return null;
}
export function setGauge(inches) {
  try {
    if (inches == null) localStorage.removeItem(GAUGE_KEY);
    else localStorage.setItem(GAUGE_KEY, JSON.stringify({ inches, at: Date.now() }));
  } catch {}
}

export const fmtIn = (x) => (x < 0.02 ? '0 in' : `${parseFloat(x.toFixed(x < 1 ? 2 : 1))} in`);
const ofRain = (x) => (x < 0.02 ? 'no rain' : `${fmtIn(x)} of rain`);
const an = (n) => (String(n).startsWith('8') || n === 11 || n === 18 ? 'an' : 'a');
const dayName = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('en-US', { weekday: 'long' });

export function verdict(days, gauge, now = new Date()) {
  const week = days.slice(1, 8);                       // last 6 days + today so far
  const modelRain = week.reduce((s, d) => s + d.rain, 0);
  const rain = gauge ? gauge.inches : modelRain;
  const used = week.reduce((s, d) => s + d.et, 0) * KC;
  const ahead = days.filter((d) => d.future);
  const comingRain = ahead.reduce((s, d) => s + d.rain, 0);
  const wetDay = ahead.find((d) => d.rain >= 0.1 && d.chance >= 60);
  const avgHigh = week.reduce((s, d) => s + d.high, 0) / week.length;
  const hot = week.slice(-3).some((d) => d.high >= 88);
  const deficit = used - rain;
  const m = now.getMonth();
  const stats = { rain, modelRain, used, comingRain, deficit, gauge: !!gauge };

  // Cool-season grass goes dormant in winter: Dec–Feb always, Mar and Nov when it's been cold.
  const asleep = m === 11 || m <= 1 || ((m === 2 || m === 10) && avgHigh < 55);
  if (asleep) {
    return { key: 'asleep', ...stats,
      line: 'Lawn’s asleep for winter.',
      text: `The grass is resting, so no watering until it greens up in spring. ${ofRain(rain)[0].toUpperCase() + ofRain(rain).slice(1)} this week, for the record.` };
  }
  if (deficit <= 0.25) {
    return { key: 'skip', ...stats,
      line: `${fmtIn(rain)} of rain this week covers it.`,
      text: `You got ${fmtIn(rain)} this week and the lawn used about ${fmtIn(used)}. Put the hose away.` };
  }
  if (wetDay && comingRain >= Math.min(deficit, 0.5) * 0.6) {
    return { key: 'wait', ...stats,
      line: `Rain likely ${dayName(wetDay.date)}.`,
      text: `It’s a little dry (${ofRain(rain)} this week), but there’s ${an(wetDay.chance)} ${wetDay.chance}% chance of rain ${dayName(wetDay.date)}, about ${fmtIn(comingRain)} over the next 3 days. Let the sky do it.` };
  }
  if (deficit > 0.6 || (hot && deficit > 0.35)) {
    const soak = Math.min(1, Math.max(0.5, Math.round(deficit * 4) / 4));
    return { key: 'water', ...stats,
      line: rain < 0.02 ? 'No rain this week.' : `Only ${ofRain(rain)} this week.`,
      text: `${rain < 0.02 ? 'No rain' : `Only ${ofRain(rain)}`} this week${hot ? ' and it’s been hot' : ''}, and the lawn used about ${fmtIn(used)}. Give it one deep soak, about ${soak} inch${soak === 1 ? '' : 'es'}, early in the morning. Deep and rare beats a little every day.` };
  }
  return { key: 'maybe', ...stats,
    line: `A bit dry: ${ofRain(rain)} this week.`,
    text: `${ofRain(rain)[0].toUpperCase() + ofRain(rain).slice(1)} this week, and the lawn used about ${fmtIn(used)}. One good watering, about half an inch, keeps it happy. Skip it if footprints bounce right back.` };
}

/* ------------------------------------------------------------ homepage line */
export function initWaterLine(el) {
  const run = async (place) => {
    try {
      const v = verdict(await fetchWater(place), getGauge());
      el.querySelector('[data-water-verdict]').textContent = VERDICTS[v.key].label;
      el.querySelector('[data-water-verdict]').dataset.tone = VERDICTS[v.key].tone;
      el.querySelector('[data-water-why]').textContent = v.line;
      el.hidden = false;
    } catch { el.hidden = true; }
  };
  run(getPlace());
  window.addEventListener('mit:place', (e) => run(e.detail));
}

/* ------------------------------------------------------------ toolshed card */
export function initRainMeter(el) {
  const out = (k) => el.querySelector(`[data-${k}]`);
  let days = null;
  const render = () => {
    if (!days) return;
    const g = getGauge();
    const v = verdict(days, g);
    const vd = VERDICTS[v.key];
    out('rm-verdict').textContent = vd.label;
    out('rm-verdict').dataset.tone = vd.tone;
    out('rm-text').textContent = v.text;
    out('rm-rain').textContent = fmtIn(v.rain) + (g ? ' (your gauge)' : '');
    out('rm-used').textContent = fmtIn(v.used);
    out('rm-coming').textContent = fmtIn(v.comingRain);
    // bars: last 6 days + today + next 3
    const show = days.slice(1);
    const max = Math.max(0.5, ...show.map((d) => d.rain));
    out('rm-bars').replaceChildren(...show.map((d) => {
      const li = document.createElement('li');
      li.className = d.future ? 'is-future' : d.today ? 'is-today' : '';
      const bar = document.createElement('span');
      bar.className = 'rm-bar';
      bar.style.height = `${Math.max(2, (d.rain / max) * 100)}%`;
      const amt = document.createElement('b');
      amt.textContent = d.rain >= 0.05 ? String(parseFloat(d.rain.toFixed(2))) : '';
      const lab = document.createElement('small');
      lab.textContent = d.today ? 'Today' : new Date(`${d.date}T12:00`).toLocaleDateString('en-US', { weekday: 'short' });
      const ch = document.createElement('i');
      ch.textContent = d.future && d.chance ? `${d.chance}%` : '';
      li.append(amt, bar, lab, ch);
      li.setAttribute('aria-label', `${lab.textContent}: ${fmtIn(d.rain)}${d.future ? `, ${d.chance}% chance` : ''}`);
      return li;
    }));
    out('rm-gauge-on').hidden = !g;
    out('rm-gauge-form').hidden = !!g;
    el.classList.add('is-live');
  };
  const load = async (place) => {
    const note = out('rm-note');
    if (note) { note.textContent = noteFor(place); note.hidden = !note.textContent; }
    el.classList.remove('is-live');
    try { days = await fetchWater(place); render(); }
    catch {
      out('rm-verdict').textContent = '--';
      out('rm-text').textContent = 'Couldn’t reach the weather service. Try again in a bit.';
    }
  };
  out('rm-gauge-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = parseFloat(out('rm-gauge-input').value);
    if (!(n >= 0 && n < 20)) return;
    setGauge(n); render();
  });
  out('rm-gauge-clear').addEventListener('click', () => { setGauge(null); out('rm-gauge-input').value = ''; render(); });
  load(getPlace());
  window.addEventListener('mit:place', (e) => load(e.detail));
}
