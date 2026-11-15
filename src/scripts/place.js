// Where the visitor's lawn is. Defaults to Bedford, NY. A visitor can type a ZIP or tap
// "Use my location" (GPS, only when they ask). The quiz ZIP fills it in too.
// Saved in localStorage; every widget listens for the 'mit:place' event.

export const BEDFORD = { zip: '10506', name: 'Bedford, NY', lat: 41.2043, lon: -73.6437, home: true };
const KEY = 'mit-place';
const QUIZ_KEY = 'mit-quiz';
const LOCAL_MILES = 50; // Westchester, Putnam, Rockland, Fairfield County: Bedford timing fits.
const NEAR_MILES = 150; // Rest of the cool-season Northeast near us: dates may shift a bit.

let table = null;
async function loadTable() {
  if (!table) {
    table = fetch('/data/zips-ne.json').then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).catch((e) => { table = null; throw e; });
  }
  return table;
}

export function miles(a, b) {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 'local' = Bedford timing fits, 'near' = Northeast but farther out, 'far' = outside our turf.
export function regionOf(p) {
  if (p.home) return 'local';
  const d = miles(BEDFORD, p);
  return d <= LOCAL_MILES ? 'local' : d <= NEAR_MILES ? 'near' : 'far';
}

export function noteFor(p) {
  const r = regionOf(p);
  if (r === 'near') return 'Dates on this site are set for Westchester & the Lower Hudson Valley. Yours may run a week or so different.';
  if (r === 'far') return 'Heads up: this site is built for cool-season lawns around Westchester. The soil reading is yours, but the dates may not fit.';
  return '';
}

export function getPlace() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && typeof p.lat === 'number' && typeof p.lon === 'number') return p;
  } catch { /* private mode */ }
  return BEDFORD;
}

function save(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('mit:place', { detail: p }));
  return p;
}

export function resetPlace() { return save(BEDFORD); }

// Returns { place } on success or { error } with a message in the site's voice.
export async function setZip(raw) {
  const zip = String(raw || '').replace(/\D/g, '').slice(0, 5);
  if (zip.length !== 5) return { error: 'ZIP codes are five numbers. I checked.' };
  if (zip === BEDFORD.zip) return { place: save(BEDFORD) };
  const n = Number(zip);
  if (n >= 20000) return { error: 'That’s outside my turf. This site is built for cool-season lawns in the Northeast, so I’ll stick with Bedford.' };
  let t;
  try { t = await loadTable(); } catch { return { error: 'Couldn’t load the ZIP list. Try again in a bit.' }; }
  const row = t[zip];
  if (!row) return { error: 'I don’t know that ZIP. Double-check it?' };
  const [lat, lon, city, state] = row;
  const place = { zip, name: `${city}, ${state}`, lat, lon };
  return { place: save(place) };
}

// Uses the phone's GPS. Only call from a tap.
export function useMyLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ error: 'Your browser won’t share a location. Type your ZIP instead.' });
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      let t;
      try { t = await loadTable(); } catch { return resolve({ error: 'Couldn’t load the ZIP list. Try again in a bit.' }); }
      let best = null, bestD = Infinity;
      for (const zip in t) {
        const [lat, lon] = t[zip];
        const d = miles(here, { lat, lon });
        if (d < bestD) { bestD = d; best = zip; }
      }
      if (!best || bestD > 25) {
        return resolve({ place: save({ zip: '', name: 'Your spot', lat: here.lat, lon: here.lon }) });
      }
      const [, , city, state] = t[best];
      resolve({ place: save({ zip: best, name: `${city}, ${state}`, lat: here.lat, lon: here.lon }) });
    }, () => resolve({ error: 'No location, no problem. Type your ZIP instead.' }), { timeout: 10000, maximumAge: 3600000 });
  });
}

// If someone took the quiz but never set a place, use their quiz ZIP.
export async function adoptQuizZip() {
  try {
    if (localStorage.getItem(KEY)) return;
    const zip = (JSON.parse(localStorage.getItem(QUIZ_KEY)) || {}).zip;
    if (zip && zip.length === 5 && zip !== BEDFORD.zip) await setZip(zip);
  } catch { /* ignore */ }
}
