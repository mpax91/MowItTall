// Live soil temperature for Bedford, NY from Open-Meteo (free, no key).
const BEDFORD = { lat: 41.2043, lon: -73.6437 };

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

export async function initSoil(el) {
  const valueEl = el.querySelector('[data-soil-value]');
  const adviceEl = el.querySelector('[data-soil-advice]');
  const barsEl = el.querySelector('[data-soil-bars]');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${BEDFORD.lat}&longitude=${BEDFORD.lon}` +
    `&hourly=soil_temperature_6cm&temperature_unit=fahrenheit&timezone=America%2FNew_York&past_days=7&forecast_days=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
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

    // One bar per day: the daily average over the last week.
    const days = [];
    for (let i = 0; i + 24 <= idx + 1; i += 24) {
      const slice = temps.slice(i, i + 24).filter((t) => t != null);
      days.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
    const recent = days.slice(-7);
    const lo = Math.min(...recent) - 6, hi = Math.max(...recent) + 4;
    barsEl.innerHTML = recent
      .map((t, k) => {
        const h = Math.max(4, Math.round(((t - lo) / (hi - lo)) * 100));
        const label = k === recent.length - 1 ? 'Today' : `${recent.length - 1 - k}d ago`;
        return `<span class="soil-bar" style="--h:${h}%" title="${label}: ${Math.round(t)}°F"></span>`;
      })
      .join('');
    barsEl.setAttribute('aria-label', `Daily soil temperature for the last week: ${recent.map((t) => Math.round(t) + '°F').join(', ')}`);
    el.classList.add('is-live');
  } catch (err) {
    valueEl.textContent = '--';
    adviceEl.textContent = 'Couldn’t reach the weather service. Try again in a bit.';
  }
}
