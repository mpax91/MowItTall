// "Can I seed now?" Live: soil temperature (6 cm) + 7-day forecast highs and rain from Open-Meteo (free, no key).
// Calendar windows are set for Westchester / Lower Hudson Valley. Mike reviews the cutoffs.
import { getPlace, noteFor } from './place.js';

const md = (d) => (d.getMonth() + 1) * 100 + d.getDate(); // e.g. Sep 15 = 915

export function verdict({ soilNow, soilNext, highs, rainTotal, rainMax, now = new Date() }) {
  const t = md(now);
  const hot = highs >= 86;
  let v;
  if (t >= 815 && t <= 930) {
    if (hot) v = { word: 'WAIT A FEW DAYS', tone: 'close', line: `It’s the right time of year, but highs near ${Math.round(highs)}°F will cook baby grass. Seed when this heat breaks.` };
    else if (soilNow > 78) v = { word: 'ALMOST', tone: 'close', line: `Soil is still ${Math.round(soilNow)}°F. A little warm. Another week and it’s perfect.` };
    else v = { word: 'YES. GO.', tone: 'yes', line: 'This is the best seeding window of the whole year. Warm soil, cooling air, fewer weeds. Get the seed down.' };
  } else if (t >= 1001 && t <= 1015) {
    v = soilNow >= 50
      ? { word: 'LAST CALL', tone: 'close', line: `Soil is ${Math.round(soilNow)}°F, still warm enough. Go now with perennial rye or tall fescue. Bluegrass is too slow this late.` }
      : { word: 'TOO LATE', tone: 'no', line: `Soil dropped to ${Math.round(soilNow)}°F. New grass won’t get tough enough before frost. Wait for spring, or dormant seed after Thanksgiving.` };
  } else if ((t >= 1116 || t <= 228) && soilNext < 40) {
    v = { word: 'DORMANT SEED IT?', tone: 'close', line: 'Too cold to sprout, which is the point. Seed thrown on frozen bare spots now just sits there and comes up in spring. Totally legit. Bit of a gamble.' };
  } else if (t >= 1016 && t <= 1231) {
    v = { word: 'NOT NOW', tone: 'no', line: `Too cold for new grass to get established (soil ${Math.round(soilNow)}°F), but not cold enough for dormant seeding yet. Wait until the ground stays cold, or until spring.` };
  } else if (t <= 314) {
    v = { word: 'NOT YET', tone: 'no', line: 'Ground’s still too cold. Dormant seeding works until the snow melts. Otherwise wait for spring.' };
  } else if (t <= 531) {
    if (soilNow < 50) v = { word: 'NOT YET', tone: 'no', line: `Soil is ${Math.round(soilNow)}°F. Grass seed wants 50°F or warmer to sprout. Give it a week or two.` };
    else v = { word: 'YES (FALL IS BETTER)', tone: 'close', line: 'Spring seeding works. The catch: the new grass has to survive summer, and crabgrass preventer stops seed too. Seed the bare spots and skip preventer there.' };
  } else if (t <= 814) {
    v = hot
      ? { word: 'TOO HOT', tone: 'no', line: `Highs near ${Math.round(highs)}°F. Seed would need watering three times a day and still struggle. Mark late August on the calendar.` }
      : { word: 'RISKY', tone: 'close', line: 'Summer seed fights heat and crabgrass. Small patches with a hose nearby? Fine. The real window opens around August 15.' };
  }
  let rain;
  if (rainMax >= 1.5) rain = `Heads-up: a downpour (about ${rainMax.toFixed(1)} in in a day) is coming. Heavy rain can wash seed around. Seed after it, or rake it in well.`;
  else if (rainTotal >= 0.5) rain = `About ${rainTotal.toFixed(1)} in of rain is coming this week. Free watering. Seed right before it.`;
  else if (rainTotal >= 0.15) rain = `A little rain coming (${rainTotal.toFixed(2)} in). You’ll still need the hose.`;
  else rain = 'Dry week ahead. New seed would need a light watering once or twice a day.';
  if (v.tone === 'no' || v.word.startsWith('DORMANT')) rain = '';
  return { ...v, rain, go: v.tone === 'yes' || v.word === 'LAST CALL' || v.word.startsWith('YES') };
}

let seq = 0;
export function initSeedNow(el) {
  load(el, getPlace());
  window.addEventListener('mit:place', (e) => load(el, e.detail));
}
async function load(el, place) {
  const mine = ++seq;
  const $ = (s) => el.querySelector(s);
  const note = $('[data-sn-note]');
  note.textContent = noteFor(place);
  note.hidden = !note.textContent;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}` +
    `&hourly=soil_temperature_6cm&daily=temperature_2m_max,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch` +
    `&timezone=America%2FNew_York&past_days=1&forecast_days=8`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (mine !== seq) return;
    const temps = j.hourly.soil_temperature_6cm, times = j.hourly.time;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
    let i = times.indexOf(key);
    if (i < 0) i = temps.findLastIndex((t) => t != null);
    const soilNow = temps[i];
    const ahead = temps.slice(i, i + 24 * 7).filter((t) => t != null);
    const soilNext = ahead.reduce((a, b) => a + b, 0) / ahead.length;
    const d = j.daily;
    const fut = d.time.map((t, k) => ({ t, hi: d.temperature_2m_max[k], rain: d.precipitation_sum[k] ?? 0 })).filter((x) => x.t >= key.slice(0, 10)).slice(0, 7);
    const highs = fut.reduce((a, x) => a + (x.hi ?? 0), 0) / fut.length;
    const rainTotal = fut.reduce((a, x) => a + x.rain, 0);
    const rainMax = Math.max(...fut.map((x) => x.rain));
    const v = verdict({ soilNow, soilNext, highs, rainTotal, rainMax, now });
    const w = $('[data-sn-word]');
    w.textContent = v.word;
    w.dataset.tone = v.tone;
    $('[data-sn-line]').textContent = v.line;
    $('[data-sn-rain]').textContent = v.rain;
    $('[data-sn-soil]').textContent = `${Math.round(soilNow)}°F`;
    $('[data-sn-next]').textContent = `${Math.round(soilNext)}°F`;
    $('[data-sn-high]').textContent = `${Math.round(highs)}°F`;
    $('[data-sn-rainv]').textContent = `${rainTotal < 0.05 ? 0 : rainTotal.toFixed(rainTotal < 1 ? 2 : 1)} in`;
    $('[data-sn-germ]').hidden = !v.go;
  } catch {
    if (mine !== seq) return;
    $('[data-sn-word]').textContent = 'CAN’T TELL';
    $('[data-sn-word]').dataset.tone = 'close';
    $('[data-sn-line]').textContent = 'Couldn’t reach the weather data. Rule of thumb: late August through September is the best time to seed around here.';
  }
}
