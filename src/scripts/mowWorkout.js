// "Is mowing a workout?" calculator. Rough estimates from lawn size, mower type and body weight.
// Calories use MET values from the Compendium of Physical Activities:
//   riding mower 2.5, power mower light/moderate 4.5, walking power mower moderate/vigorous 5.0, hand reel mower 6.0.
// Path length = lawn area / effective cut width x 1.2 (turns, trimming, overlap).
// Moderate exercise = 3+ METs (counts toward the 150 minutes a week in the US activity guidelines).

export const MOWERS = {
  push: { label: 'Push', met: 5.0, width: 1.6, mph: 2.5, walk: true },
  self: { label: 'Self-propelled', met: 4.5, width: 1.6, mph: 3.0, walk: true },
  reel: { label: 'Reel', met: 6.0, width: 1.2, mph: 2.5, walk: true },
  riding: { label: 'Riding', met: 2.5, width: 3.2, mph: 4.0, walk: false },
};

const STRIDE_FT = 2.2; // short steps while pushing
const PATH_FACTOR = 1.2;
const SEASON_MOWS = 26; // about weekly, May through October
const PIZZA = 285; // calories in a slice of cheese pizza

export function estimate(sqft, type, lbs) {
  const m = MOWERS[type] || MOWERS.push;
  const pathFt = (sqft / m.width) * PATH_FACTOR;
  const hours = pathFt / (m.mph * 5280);
  const minutes = hours * 60;
  const kg = lbs * 0.4536;
  const cal = m.met * kg * hours * 1.05; // MET x 3.5 x kg / 200 per minute
  const steps = m.walk ? pathFt / STRIDE_FT : 0;
  const counts = m.met >= 3;
  return {
    minutes,
    miles: pathFt / 5280,
    steps,
    cal,
    counts,
    pctWeek: counts ? (minutes / 150) * 100 : 0,
    season: { hours: (minutes * SEASON_MOWS) / 60, cal: cal * SEASON_MOWS, steps: steps * SEASON_MOWS, pizza: (cal * SEASON_MOWS) / PIZZA },
  };
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fmtTime = (min) => {
  const m = Math.max(1, Math.round(min));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60 ? `${m % 60} min` : ''}`.trim();
};

const VERDICT = {
  push: ['YES. THAT’S CARDIO.', 'Moderate exercise. You can talk, but you can’t sing. The guidelines count every minute.'],
  self: ['YES. IT COUNTS.', 'Moderate exercise, even with the wheels doing some of the work. Turn the drive off for a few passes and you’ll feel it.'],
  reel: ['ABSOLUTE UNIT.', 'A reel mower is real exercise. Moderate to hard. Bring water.'],
  riding: ['TECHNICALLY… NO.', 'Light activity. Better than the couch, but it doesn’t count toward your exercise minutes. You have a cupholder.'],
};

export function initMowWorkout(root) {
  const $ = (s) => root.querySelector(s);
  const sqftIn = $('[data-mw-sqft]');
  const lbsIn = $('[data-mw-lbs]');
  const src = $('[data-mw-src]');
  let type = 'push';

  function fromYard() {
    try {
      const d = JSON.parse(localStorage.getItem('mit-yard'));
      if (d && d.total > 0) return d.total;
    } catch { /* ignore */ }
    return 0;
  }

  function useYard() {
    const t = fromYard();
    if (t) {
      sqftIn.value = Math.round(t);
      root.dataset.mwFrom = 'map';
      src.innerHTML = '<b>Your real lawn size</b>, from your map. Change it if you like.';
    } else {
      // No map yet: 5,000 sq ft is a stand-in for a typical lawn. Say so.
      if (root.dataset.mwFrom === 'map') sqftIn.value = 5000;
      root.dataset.mwFrom = 'avg';
      src.innerHTML = root.dataset.measureHref
        ? `5,000 sq ft is a typical lawn, not yours. Type your size, or <a href="${root.dataset.measureHref}">measure your yard</a> in two minutes.`
        : '5,000 sq ft is a typical lawn, not yours. Type your size, or measure your yard on the map above and it fills in here.';
    }
  }

  function render() {
    const sqft = Math.min(Math.max(parseFloat(String(sqftIn.value).replace(/,/g, '')) || 0, 0), 2000000);
    const lbs = Math.min(Math.max(parseFloat(lbsIn.value) || 170, 80), 500);
    root.dataset.tone = type === 'riding' ? 'no' : 'yes';
    const [word, line] = VERDICT[type];
    $('[data-mw-word]').textContent = word;
    $('[data-mw-word]').dataset.tone = type === 'riding' ? 'close' : 'yes';
    $('[data-mw-line]').textContent = line;
    if (!sqft) {
      root.querySelectorAll('[data-mw-out]').forEach((el) => (el.textContent = '–'));
      $('[data-mw-season]').textContent = 'Put in your lawn size to see your season.';
      return;
    }
    const e = estimate(sqft, type, lbs);
    const out = (k, v) => ($(`[data-mw-out="${k}"]`).textContent = v);
    out('time', fmtTime(e.minutes));
    out('cal', fmt(e.cal));
    out('steps', e.steps ? fmt(Math.round(e.steps / 10) * 10) : '≈ 0');
    out('miles', e.miles >= 0.1 ? e.miles.toFixed(1) : '< 0.1');
    $('[data-mw-week]').textContent = e.counts
      ? `That’s ${Math.round(e.pctWeek)}% of the 150 minutes of exercise a week the guidelines ask for.${e.pctWeek >= 100 ? ' Every week. Just from mowing.' : ''}`
      : 'Counts toward your 150 minutes of exercise a week: 0%. Walk it next time.';
    const s = e.season;
    $('[data-mw-season]').textContent = e.steps
      ? `Mow weekly May to October and that’s about ${fmt(s.hours)} hours, ${fmt(Math.round(s.steps / 1000) * 1000)} steps and ${fmt(Math.round(s.cal / 100) * 100)} calories. That’s ${fmt(s.pizza)} slices of pizza. You earned them.`
      : `Mow weekly May to October and that’s about ${fmt(s.hours)} hours and ${fmt(s.cal)} calories. ${fmt(s.pizza)} slices of pizza. You did not earn them.`;
  }

  root.querySelectorAll('[data-mw-type]').forEach((b) =>
    b.addEventListener('click', () => {
      type = b.dataset.mwType;
      root.querySelectorAll('[data-mw-type]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    }),
  );
  sqftIn.addEventListener('input', () => {
    root.dataset.mwFrom = 'typed';
    src.textContent = '';
    render();
  });
  lbsIn.addEventListener('input', render);
  window.addEventListener('mit:yard', () => {
    useYard();
    render();
  });
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'mit-yard') {
      useYard();
      render();
    }
  });

  useYard();
  render();
}
