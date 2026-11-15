import { planFor, statusOf, windowText, fmt } from '../data/tasks.js';

const STEPS = [
  {
    id: 'zip',
    q: 'Where’s your lawn?',
    hint: 'Your ZIP code. We use it to time things for your area.',
    type: 'zip',
  },
  {
    id: 'look',
    q: 'Be honest. How does it look right now?',
    hint: 'Nobody’s grading this. Except the neighbors.',
    type: 'one',
    options: [
      { v: 'good', t: 'Honestly? Pretty good.', s: 'I’m here to make it great.' },
      { v: 'street', t: 'Fine from the street.', s: 'Just don’t look too close.' },
      { v: 'patchy', t: 'Patchy.', s: 'Like a teenager’s first beard.' },
      { v: 'weedy', t: 'More weeds than grass.', s: 'The dandelions pay rent at this point.' },
      { v: 'dirt', t: 'Dirt with ambitions.', s: 'We’re starting from the bottom.' },
    ],
  },
  {
    id: 'effort',
    q: 'How much effort are we talking?',
    hint: 'This sets everything else. Pick the real answer, not the New Year’s resolution answer.',
    type: 'one',
    options: [
      { v: 0, t: 'Couch Potato', s: 'I will mow. That’s the deal. Don’t make it weird.' },
      { v: 1, t: 'Coffee & Cruise', s: 'One Saturday morning a month, coffee in hand, back inside by 10.' },
      { v: 2, t: 'Curb Appeal Hunter', s: 'I want people to slow down when they drive by.' },
      { v: 3, t: 'Lawn Psycho', s: 'I’ve named my mower. I know my soil pH. Send help.' },
    ],
  },
  {
    id: 'problems',
    q: 'What’s bugging you?',
    hint: 'Pick all that apply. Or none, you overachiever.',
    type: 'many',
    options: [
      { v: 'weeds', t: 'Weeds', s: 'Dandelions, clover, the usual suspects.' },
      { v: 'crabgrass', t: 'Crabgrass', s: 'The wide, ugly grass that shows up in July.' },
      { v: 'bare', t: 'Bare spots', s: 'Dirt where grass should be.' },
      { v: 'brown', t: 'Turns brown in summer', s: 'Crispy by August.' },
      { v: 'grubs', t: 'Grubs', s: 'Brown patches that peel up like carpet.' },
      { v: 'neighbor', t: 'My neighbor’s lawn is nicer', s: 'This is personal.' },
    ],
  },
  {
    id: 'height',
    q: 'How high do you mow?',
    hint: 'Check the lever on your mower if you’re not sure.',
    type: 'one',
    options: [
      { v: 'unknown', t: 'No clue.', s: 'It came that way.' },
      { v: 'low', t: 'Short.', s: 'Means fewer mows, right? (Oh no.)' },
      { v: 'mid', t: 'Somewhere in the middle.', s: 'Seems reasonable.' },
      { v: 'high', t: 'As high as it goes.', s: 'A person of culture.' },
    ],
  },
  {
    id: 'sun',
    q: 'How much sun does it get?',
    hint: 'Think about the middle of a summer day.',
    type: 'one',
    options: [
      { v: 'full', t: 'Full sun', s: 'Out in the open most of the day.' },
      { v: 'part', t: 'Some shade', s: 'A few trees doing their thing.' },
      { v: 'shade', t: 'Mostly shade', s: 'It’s basically a forest.' },
    ],
  },
  {
    id: 'mower',
    q: 'Who actually does the mowing?',
    hint: 'The plan works either way.',
    type: 'one',
    options: [
      { v: 'me', t: 'Me', s: 'Every week. Mostly.' },
      { v: 'crew', t: 'A landscaping crew', s: 'They show up, they leave, things are shorter.' },
      { v: 'kid', t: 'A kid I pay', s: 'Cash and guilt, in roughly equal amounts.' },
      { v: 'robot', t: 'A robot', s: 'It’s the future and it lives in my yard.' },
    ],
  },
];

const PROFILES = [
  { name: 'The Bare Minimum Hero', blurb: 'You want a better lawn without becoming a lawn person. Respect. These are the few things that actually move the needle.' },
  { name: 'The Saturday Striper', blurb: 'A little effort, a lot of curb appeal. Coffee in one hand, spreader in the other.' },
  { name: 'The Curb Appeal Contender', blurb: 'You want people to slow down when they drive by. This plan gets you there.' },
  { name: 'The Stripe Lord', blurb: 'You already named the mower. This is the full program. Godspeed.' },
];

import { getPlace, setZip } from './place.js';
const KEY = 'mit-quiz';

export function initQuiz(root) {
  const $ = (s) => root.querySelector(s);
  const card = $('[data-card]');
  const result = $('[data-result]');
  let step = 0;
  let answers = {};
  try { answers = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { answers = {}; }

  if (answers.done) { showResult(); }
  else render();

  function save() { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch { /* private mode */ } }

  function render() {
    const s = STEPS[step];
    $('[data-bar]').style.width = `${(step / STEPS.length) * 100}%`;
    $('[data-count]').textContent = `Question ${step + 1} of ${STEPS.length}`;
    $('[data-q]').textContent = s.q;
    $('[data-hint]').textContent = s.hint;
    $('[data-back]').hidden = step === 0;
    const next = $('[data-next]');
    next.textContent = step === STEPS.length - 1 ? 'Show my plan' : 'Next';
    const body = $('[data-body]');

    if (s.type === 'zip') {
      body.innerHTML = `
        <label class="sr-only" for="zip">ZIP code</label>
        <input id="zip" class="quiz-input" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="10506" value="${answers.zip || (!getPlace().home && getPlace().zip) || ''}">
        <p class="quiz-note" data-note></p>`;
      const input = body.querySelector('input');
      const check = () => {
        const v = input.value.replace(/\D/g, '').slice(0, 5);
        input.value = v;
        answers.zip = v;
        const note = body.querySelector('[data-note]');
        if (v.length === 5 && !/^[01]/.test(v)) note.textContent = 'Heads up: timing is tuned for the Northeast for now, so dates may run a bit off where you are.';
        else if (v.length === 5) note.textContent = 'Nice. Northeast timing it is.';
        else note.textContent = '';
        next.disabled = v.length !== 5;
      };
      input.addEventListener('input', check);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !next.disabled) go(1); });
      check();
      return;
    }

    const multi = s.type === 'many';
    const current = answers[s.id];
    body.innerHTML = `<div class="quiz-options" role="group" aria-label="${s.q}">${s.options
      .map((o) => {
        const on = multi ? (current || []).includes(o.v) : current === o.v;
        return `<button type="button" class="quiz-opt" data-v="${o.v}" aria-pressed="${on}"><strong>${o.t}</strong><span>${o.s}</span></button>`;
      })
      .join('')}</div>`;
    body.querySelectorAll('.quiz-opt').forEach((b) => {
      b.addEventListener('click', () => {
        const opt = s.options.find((o) => String(o.v) === b.dataset.v);
        if (multi) {
          const set = new Set(answers[s.id] || []);
          set.has(opt.v) ? set.delete(opt.v) : set.add(opt.v);
          answers[s.id] = [...set];
          b.setAttribute('aria-pressed', String(set.has(opt.v)));
        } else {
          answers[s.id] = opt.v;
          body.querySelectorAll('.quiz-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          save();
          setTimeout(() => go(1), 180); // single choice moves on by itself
        }
        save();
        next.disabled = false;
      });
    });
    next.disabled = !multi && current === undefined;
  }

  function go(d) {
    // The quiz ZIP also sets the soil reading and location chips across the site.
    if (d > 0 && STEPS[step]?.type === 'zip' && answers.zip?.length === 5 && answers.zip !== getPlace().zip) setZip(answers.zip);
    step = Math.max(0, Math.min(STEPS.length, step + d));
    save();
    if (step === STEPS.length) { answers.done = true; save(); showResult(); return; }
    render();
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $('[data-next]').addEventListener('click', () => go(1));
  $('[data-back]').addEventListener('click', () => go(-1));

  function buildPlan() {
    const problems = answers.problems || [];
    let level = Number(answers.effort ?? 1);
    const flags = [...problems];
    if (answers.look === 'patchy') flags.push('patchy');
    if (answers.look === 'dirt') flags.push('bare', 'patchy');
    if (answers.look === 'weedy') flags.push('weeds');
    const petty = problems.includes('neighbor') && level < 3;
    if (petty) level += 1;
    const tasks = planFor(level, flags);
    const notes = [];
    if (answers.height === 'low' || answers.height === 'unknown') {
      notes.push('Your #1 move: raise the mower to 3.5–4 inches. Free, takes ten seconds, fixes half your problems.');
    }
    if (petty) notes.push('Neighbor envy detected. We bumped you up one effort level. Petty? Yes. Effective? Also yes.');
    if (answers.sun === 'shade') notes.push('Shady yard: when you seed, buy a shade mix heavy on fine fescue. Regular seed won’t make it.');
    if (answers.mower === 'crew') notes.push('Show this plan to your crew. The biggest ask: have them mow at 3.5 inches or higher.');
    if (answers.mower === 'kid') notes.push('Tip for your employee: pay a bonus for straight stripes. Watch quality skyrocket.');
    if (answers.mower === 'robot') notes.push('Set the robot to its highest cut height. It mows often, so tall and frequent is perfect.');
    return { level, tasks, notes };
  }

  function showResult() {
    card.hidden = true;
    root.querySelector('.quiz-intro').hidden = true;
    const { level, tasks, notes } = buildPlan();
    const profile = PROFILES[Math.min(3, level)];
    const today = new Date();
    const hours = Math.max(1, Math.round(tasks.reduce((a, t) => a + t.minutes, 0) / 60));
    // chronological, starting from what's happening now
    const ordered = tasks
      .map((t) => ({ t, s: statusOf(t, today) }))
      .sort((a, b) => rank(a) - rank(b));
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

    result.innerHTML = `
      <p class="plan-badge">Your lawn personality</p>
      <h2>${profile.name}</h2>
      <p>${profile.blurb}</p>
      <ul class="plan-stats">
        <li><b>${tasks.length}</b>things to do all year</li>
        <li><b>~${hours} ${hours === 1 ? 'hour' : 'hours'}</b>a year, not counting mowing</li>
        <li><b>${answers.zip || '—'}</b>Northeast timing</li>
      </ul>
      ${notes.length ? `<ul class="plan-notes">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
      <h3 class="sr-only">Your plan, starting now</h3>
      <ol class="plan-list">
        ${ordered.map(({ t, s }) => `
          <li class="plan-item" data-state="${s.state}">
            <p class="cal-window">${windowText(t)}</p>
            <h3>${t.title}</h3>
            <p>${t.short}</p>
            <p class="plan-why">${t.why}</p>
            <p class="cal-status">${
              s.state === 'now' ? `Do it now. ${plural(s.daysLeft, 'day')} left.`
              : `Starts ${fmt(t.start)}, in ${plural(s.days, 'day')}.`
            }</p>
          </li>`).join('')}
      </ol>
      <div class="plan-actions">
        <button type="button" class="btn" data-ics>Add reminders to my calendar</button>
        <button type="button" class="btn btn-quiet" data-print>Print or save as PDF</button>
        <button type="button" class="btn btn-quiet" data-restart>Retake the quiz</button>
      </div>`;
    result.hidden = false;
    result.querySelector('[data-ics]').addEventListener('click', () => downloadIcs(ordered, profile));
    result.querySelector('[data-print]').addEventListener('click', () => window.print());
    result.querySelector('[data-restart]').addEventListener('click', () => {
      answers = {}; save(); step = 0;
      result.hidden = true; card.hidden = false; root.querySelector('.quiz-intro').hidden = false;
      render();
    });
    result.scrollIntoView({ block: 'start' });
  }

  // now first, then upcoming by days away (past tasks wrap to next year)
  function rank({ s }) { return s.state === 'now' ? -1000 + s.daysLeft : s.days; }
}

function downloadIcs(ordered, profile) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const esc = (s) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const today = new Date();
  const events = ordered.map(({ t, s }) => {
    // remind on the window's start, or today if we're already inside it
    let d = s.state === 'now' ? today : new Date(today.getTime() + s.days * 86400000);
    const end = new Date(d.getTime() + 86400000);
    return [
      'BEGIN:VEVENT',
      `UID:${t.id}-${ymd(d)}@mowittall.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${esc('Lawn: ' + t.title)}`,
      `DESCRIPTION:${esc(`${t.short} ${t.why}\nGood window: ${windowText(t)}.\nFrom your Mow It Tall plan (${profile.name}).`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', `DESCRIPTION:${esc(t.title)}`, 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mow It Tall//Lawn plan//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mow-it-tall-lawn-plan.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
