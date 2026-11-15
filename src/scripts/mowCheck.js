// "Can I mow right now?" — the official Mow It Tall etiquette checker.
// Neighbor etiquette, not anybody's law. Runs entirely in the browser.

export const HOURS = {
  weekday: { start: 8 * 60, end: 20 * 60, label: 'Weekdays', range: '8am to 8pm' },
  sat: { start: 9 * 60, end: 19 * 60, label: 'Saturday', range: '9am to 7pm' },
  sun: { start: 10 * 60, end: 18 * 60, label: 'Sunday', range: '10am to 6pm' },
  holiday: { start: 10 * 60, end: 12 * 60, label: 'Holiday', range: 'a quick cut, done by noon' },
};
const GRACE_QUIET = 30; // battery, electric and robot mowers get 30 minutes each way
const CLOSE = 30; // last 30 minutes of the window = "cutting it close"

// ---------- Holidays (US, the big cookout ones) ----------
function nthWeekday(year, month, weekday, n) {
  const d = new Date(year, month, 1);
  const shift = (weekday - d.getDay() + 7) % 7;
  return new Date(year, month, 1 + shift + (n - 1) * 7);
}
function lastWeekday(year, month, weekday) {
  const d = new Date(year, month + 1, 0);
  return new Date(year, month, d.getDate() - ((d.getDay() - weekday + 7) % 7));
}
function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}
export function holidayName(date) {
  const y = date.getFullYear();
  const same = (d) => d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
  const list = [
    [new Date(y, 0, 1), "New Year's Day"],
    [easter(y), 'Easter'],
    [nthWeekday(y, 4, 0, 2), "Mother's Day"],
    [lastWeekday(y, 4, 1), 'Memorial Day'],
    [nthWeekday(y, 5, 0, 3), "Father's Day"],
    [new Date(y, 6, 4), 'the Fourth of July'],
    [nthWeekday(y, 8, 1, 1), 'Labor Day'],
    [nthWeekday(y, 10, 4, 4), 'Thanksgiving'],
    [new Date(y, 11, 25), 'Christmas'],
  ];
  const hit = list.find(([d]) => same(d));
  return hit ? hit[1] : null;
}
export function dayTypeOf(date) {
  if (holidayName(date)) return 'holiday';
  const wd = date.getDay();
  return wd === 0 ? 'sun' : wd === 6 ? 'sat' : 'weekday';
}

export function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`;
}

// ---------- The rules ----------
// Returns { tone: 'yes'|'close'|'no'|'never', word, line }
export function verdict({ day, mins, party, mower }) {
  const quiet = mower === 'quiet' || mower === 'robot';
  const H = HOURS[day];
  const start = H.start - (quiet && day !== 'holiday' ? GRACE_QUIET : 0);
  const end = H.end + (quiet && day !== 'holiday' ? GRACE_QUIET : 0);

  if (party) {
    return {
      tone: 'never', word: 'ABSOLUTELY NOT',
      line: mower === 'robot'
        ? 'Not even the robot. Nobody wants a Roomba with a blade bumping into the cornhole boards.'
        : 'There is no version of this where you’re the good guy. Not “just the front.” Not “real quick.” Go to the party or go inside.',
    };
  }

  if (mins < 6 * 60 + 30) {
    return {
      tone: 'never', word: 'ABSOLUTELY NOT',
      line: mower === 'robot'
        ? 'It’s quiet, sure. It’s also a spinning blade in the dark, and the bunnies and toads are out. Robot goes to bed when you do.'
        : 'That’s not mowing. That’s a home invasion with extra steps.',
    };
  }
  if (mins >= 21 * 60) {
    return {
      tone: 'never', word: 'ABSOLUTELY NOT',
      line: mower === 'robot'
        ? 'Night mowing is how robots run over toads. Set the schedule to daytime.'
        : 'If you need headlights, go inside. Nobody can see your stripes anyway.',
    };
  }

  if (day === 'holiday') {
    if (mins < start) return { tone: 'no', word: 'NOPE', line: 'It’s a holiday. Let people sleep in. If you really need to, a quick cut after 10, done by noon.' };
    if (mins >= end) return { tone: 'no', word: 'NOPE', line: 'Holidays are for burgers, not mowers. Should’ve mowed yesterday. That’s the rule: day before.' };
    return { tone: 'close', word: 'QUICK ONE', line: 'Fine, but make it fast. Front yard only, done by noon, before anyone’s guests pull in. Next time, mow the day before.' };
  }

  if (mins < start) {
    const wait = fmtTime(start);
    const lines = {
      weekday: `Too early. Half your street’s alarm hasn’t gone off yet. Wait till ${wait}.`,
      sat: `Saturday morning is sacred. People are sleeping, hungover, or both. ${wait}, minimum.`,
      sun: `Before ${wait} on a Sunday? Some neighbors are at church. Some are sleeping off Saturday. Both will hate you.`,
    };
    return { tone: 'no', word: 'TOO EARLY', line: lines[day] + (quiet ? '' : ' (Battery mower? You’d get 30 minutes of grace.)') };
  }
  if (mins >= end) {
    const lines = {
      weekday: 'It’s dinner time on your whole street. Nobody wants a side of engine noise with their pasta. Tomorrow.',
      sat: 'Saturday night is for grilling and sitting outside, and you’re ruining it for everyone. Mow tomorrow.',
      sun: 'Sunday night is for dreading Monday in peace. Let people have that.',
    };
    return { tone: 'no', word: 'TOO LATE', line: lines[day] };
  }
  if (end - mins <= CLOSE) {
    return { tone: 'close', word: 'CUTTING IT CLOSE', line: `You have until ${fmtTime(end)}. Do the front, save the back for tomorrow. Do not start a full mow now.` };
  }
  if (mins - start < CLOSE && !quiet) {
    return { tone: 'close', word: 'TECHNICALLY YES', line: 'You’re legal on the etiquette clock, but don’t be the first engine on the street. Start with the side farthest from the neighbors.' };
  }
  const yes = {
    weekday: 'Go mow. Nobody can say a word to you.',
    sat: 'Prime time. This is what Saturdays were invented for.',
    sun: 'Sunday afternoon mowing is a proud tradition. Go for it.',
  };
  return { tone: 'yes', word: 'YES', line: yes[day] + (mower === 'robot' ? ' Let the robot rip.' : '') };
}

// ---------- UI ----------
export function initMowCheck(root) {
  const $ = (s) => root.querySelector(s);
  const dayBtns = [...root.querySelectorAll('[data-mc-day]')];
  const mowerBtns = [...root.querySelectorAll('[data-mc-mower]')];
  const slider = $('[data-mc-time]');
  const timeOut = $('[data-mc-time-out]');
  const party = $('[data-mc-party]');
  const badge = $('[data-mc-word]');
  const line = $('[data-mc-line]');
  const note = $('[data-mc-note]');
  const nowBtn = $('[data-mc-now]');
  const shareBtn = $('[data-mc-share]');

  const state = { day: 'weekday', mins: 12 * 60, party: false, mower: 'gas', isNow: true };

  function setNow() {
    const d = new Date();
    state.day = dayTypeOf(d);
    const m = d.getHours() * 60 + d.getMinutes();
    state.mins = Math.min(Math.max(Math.round(m / 15) * 15, +slider.min), +slider.max);
    state.isNow = true;
    const h = holidayName(d);
    note.textContent = h ? `Heads up: today is ${h}.` : '';
    note.hidden = !h;
  }

  function render() {
    dayBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mcDay === state.day)));
    mowerBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mcMower === state.mower)));
    slider.value = state.mins;
    slider.setAttribute('aria-valuetext', fmtTime(state.mins));
    timeOut.textContent = fmtTime(state.mins);
    nowBtn.hidden = state.isNow;
    party.checked = state.party;
    const v = verdict(state);
    badge.textContent = v.word;
    badge.dataset.tone = v.tone;
    line.textContent = v.line;
    root.dataset.tone = v.tone;
  }

  dayBtns.forEach((b) => b.addEventListener('click', () => { state.day = b.dataset.mcDay; state.isNow = false; render(); }));
  mowerBtns.forEach((b) => b.addEventListener('click', () => { state.mower = b.dataset.mcMower; render(); }));
  slider.addEventListener('input', () => { state.mins = +slider.value; state.isNow = false; render(); });
  party.addEventListener('change', () => { state.party = party.checked; render(); });
  nowBtn.addEventListener('click', () => { setNow(); render(); });

  shareBtn?.addEventListener('click', async () => {
    const v = verdict(state);
    const when = `${HOURS[state.day].label} at ${fmtTime(state.mins)}${state.party ? ', party next door' : ''}`;
    const text = `Can I mow? ${when}: ${v.word}. ${v.line}`;
    const url = 'https://mowittall.com/blog/lawn-mowing-etiquette/';
    try {
      if (navigator.share) { await navigator.share({ title: 'Can I mow right now?', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      shareBtn.textContent = 'Copied!';
      setTimeout(() => { shareBtn.textContent = 'Send this to your neighbor'; }, 1800);
    } catch { /* share sheet closed */ }
  });

  setNow();
  render();
}
