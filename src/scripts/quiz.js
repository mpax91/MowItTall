import { planFor, statusOf, windowText, fmt } from '../data/tasks.js';
import { RESULTS as GRASS, pick as pickGrass } from '../data/grassPicker.js';
import { yardTotal, num, fmt as fmtN, round1 } from './yard.js';
import { fetchWater, verdict as waterVerdict, getGauge, VERDICTS } from './water.js';

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
      { v: 'mixed', t: 'Sunny in front, shady in back', s: 'Two lawns in one.' },
      { v: 'shade', t: 'Mostly shade', s: 'It’s basically a forest.' },
    ],
  },
  {
    id: 'water',
    q: 'Do you water?',
    hint: 'No wrong answer. It changes which grass and tips you get.',
    type: 'one',
    options: [
      { v: 'auto', t: 'Sprinkler system', s: 'It runs on a timer.' },
      { v: 'hose', t: 'Hose, when it looks rough', s: 'When I remember.' },
      { v: 'never', t: 'Nope', s: 'Rain or nothing.' },
    ],
  },
  {
    id: 'uses',
    q: 'Who uses the lawn?',
    hint: 'Kids and dogs change what you put down and which grass holds up.',
    type: 'one',
    options: [
      { v: 'kids', t: 'Kids', s: 'Soccer goals and bare spots.' },
      { v: 'dogs', t: 'Dogs', s: 'Yellow spots, worn paths.' },
      { v: 'both', t: 'Kids and dogs', s: 'Chaos. Lovely chaos.' },
      { v: 'adults', t: 'Just grown-ups', s: 'Cookouts and lawn chairs.' },
      { v: 'looks', t: 'Nobody. It’s for looks', s: 'Admired from the window.' },
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

// Every plan task points at the tool or guide that helps you do it.
const TOOLS = {
  blade: [['/blog/sharpen-your-mower-blade/', 'Is my blade dull?']],
  raise: [['/blog/one-third-rule-mowing/', 'The one-third rule']],
  cleanup: [['/resources/whats-wrong-with-my-lawn/', 'What’s wrong with my lawn?']],
  crabgrass: [['/blog/pre-emergent-vs-post-emergent/', 'Pre vs. post'], ['/blog/spreader-settings-half-rate-twice/', 'Spreader settings']],
  'spring-feed': [['/blog/holiday-lawn-fertilizer-schedule/', 'Holiday schedule'], ['/blog/how-to-read-a-fertilizer-bag/', 'Bag decoder'], ['/blog/spreader-settings-half-rate-twice/', 'Spreader settings']],
  'july4-feed': [['/blog/holiday-lawn-fertilizer-schedule/', 'Holiday schedule'], ['/resources/should-i-water-my-lawn/', 'Should I water?']],
  'fall-feed': [['/blog/holiday-lawn-fertilizer-schedule/', 'Holiday schedule'], ['/blog/how-to-read-a-fertilizer-bag/', 'Bag decoder']],
  'columbus-feed': [['/blog/halloween-is-the-lawn-super-bowl/', 'Why it peaks for Halloween'], ['/blog/how-to-read-a-fertilizer-bag/', 'Bag decoder']],
  'thanksgiving-feed': [['/blog/holiday-lawn-fertilizer-schedule/', 'Holiday schedule']],
  'spot-weeds': [['/weeds/', 'What’s that weed?']],
  grubs: [['/resources/whats-wrong-with-my-lawn/#dx-grubs', 'Is it really grubs?']],
  summer: [['/resources/should-i-water-my-lawn/', 'Should I water? (live)'], ['/blog/mowing-the-lawn-is-a-workout/', 'Is mowing a workout?']],
  'soil-test': [['/blog/lawn-soil-test/', 'How to read your soil test']],
  aerate: [['/resources/#ops-aerate', 'Aerating, step by step']],
  seed: [['/resources/can-i-seed-now/', 'Can I seed now? (live)'], ['/resources/can-i-seed-now/#seedwatch', 'Is my seed working?'], ['/resources/#ops-overseed', 'Seeding, step by step']],
  'fall-weeds': [['/blog/fall-kill-weeds-or-plant-seed/', 'Weeds or seed? Pick one']],
  leaves: [['/blog/mulching-vs-bagging/', 'Mulch or bag?']],
  lime: [['/blog/lawn-soil-test/', 'Soil test translator']],
  'last-mow': [['/blog/lawn-off-season-training/', 'Off-season training']],
  winter: [['/blog/lawn-mower-maintenance-diy/', 'Mower tune-up checklist']],
};
// "What's bugging you" → the fixes on the site
const FIXES = {
  weeds: { h: 'Weeds', p: 'Figure out what you’ve got first. The fix depends on the weed.', links: [['/weeds/', 'Weed ID with photos'], ['/blog/pre-emergent-vs-post-emergent/', 'Pre vs. post']] },
  crabgrass: { h: 'Crabgrass', p: 'Stop it before it starts: a preventer around Tax Day, when soil hits about 55°F. Mowing tall does half the work.', links: [['/blog/pre-emergent-vs-post-emergent/', 'The bouncer and the hitman'], ['/resources/can-i-seed-now/', 'Live soil temperature']] },
  bare: { h: 'Bare spots', p: 'Seed in late August through September. Pick the right grass, keep it damp, and don’t panic in week one.', links: [['/lawn-101/#grass', 'Pick your grass'], ['/resources/can-i-seed-now/', 'Can I seed now?'], ['/resources/can-i-seed-now/#seedwatch', 'Is my seed working?']] },
  brown: { h: 'Brown in summer', p: 'Mow tall and water deep, not daily. Some summer brown is just dormancy. It comes back.', links: [['/resources/should-i-water-my-lawn/', 'Should I water? (live)'], ['/resources/whats-wrong-with-my-lawn/#dx-summer-brown', 'Dead or just sleeping?']] },
  grubs: { h: 'Grubs', p: 'Check before you treat. Peel back a square foot of sod in late summer and count.', links: [['/resources/whats-wrong-with-my-lawn/#dx-grubs', 'Is it really grubs?'], ['/blog/animals-in-your-lawn/', 'Who’s digging?']] },
  neighbor: { h: 'The neighbor', p: 'Follow this plan and the problem fixes itself. Or send a friendly, anonymous nudge.', links: [['/neighbor/', 'Send to a neighbor'], ['/blog/lawn-compliments/', 'How to take a compliment']] },
};
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
    if (d > 0 && step === 0) window.mitTrack && window.mitTrack('quiz_start', { quiz_name: 'lawn_plan' });
    if (d > 0 && STEPS[step]) {
      const a = answers[STEPS[step].id];
      window.mitTrack && window.mitTrack('quiz_step', { quiz_name: 'lawn_plan', step_number: step + 1, question_id: STEPS[step].id, step_type: STEPS[step].type || 'choice',
        answer: STEPS[step].type === 'zip' ? String(a || '').slice(0, 3) : Array.isArray(a) ? a.join(',').slice(0, 90) : String(a ?? '').slice(0, 90) });
    }
    if (d < 0 && STEPS[step]) window.mitTrack && window.mitTrack('quiz_back', { quiz_name: 'lawn_plan', step_number: step + 1, question_id: STEPS[step].id });
    step = Math.max(0, Math.min(STEPS.length, step + d));
    save();
    if (step === STEPS.length) { answers.done = true; save(); showResult(true); return; }
    render();
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  let abandonSent = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && step > 0 && !answers.done && !abandonSent) {
      abandonSent = true;
      window.mitTrack && window.mitTrack('quiz_abandon', { quiz_name: 'lawn_plan', step_number: step + 1, question_id: STEPS[step]?.id || '' });
    }
  });
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
    const kids = ['kids', 'both'].includes(answers.uses), dogs = ['dogs', 'both'].includes(answers.uses);
    if (kids || dogs) notes.push(`${kids && dogs ? 'Kids and dogs' : kids ? 'Kids' : 'Dogs'} on the lawn: spot-treat weeds instead of blanket spraying, keep everyone off until it dries, and water in granules. <a href="/blog/kid-and-pet-safe-lawn-care/">The kid and pet safe playbook</a>.`);
    if (dogs) notes.push('Yellow dog spots: water the spot right after, and reseed the worst ones in fall. <a href="/blog/dog-pee-kids-bouncy-houses-lawn/">Fix dog spots</a>.');
    if (answers.water === 'never') notes.push('No watering is fine. Pick tough grass (tall fescue), mow tall, and let it go brown in a dry August. It comes back.');
    if (answers.mower === 'crew') notes.push('Show this plan to your crew. The biggest ask: have them mow at 3.5 inches or higher.');
    if (answers.mower === 'kid') notes.push('Tip for your employee: pay a bonus for straight stripes. Watch quality skyrocket.');
    if (answers.mower === 'robot') notes.push('Set the robot to its highest cut height. It mows often, so tall and frequent is perfect.');
    // grass recommendation: same rules as the grass picker
    const sunMap = { full: 'full', part: 'part', mixed: 'mixed', shade: 'low' };
    const trafficMap = { kids: 'heavy', dogs: 'heavy', both: 'heavy', adults: 'normal', looks: 'light' };
    const goal = problems.includes('neighbor') || level >= 2 ? 'stripes' : level === 0 ? 'easy' : '';
    const grassKey = pickGrass({ sun: sunMap[answers.sun] || 'full', traffic: trafficMap[answers.uses] || 'normal', water: answers.water || 'hose', goal });
    return { level, tasks, notes, grassKey, flags };
  }

  function showResult(fresh) {
    card.hidden = true;
    root.querySelector('.quiz-intro').hidden = true;
    const { level, tasks, notes, grassKey, flags } = buildPlan();
    const profile = PROFILES[Math.min(3, level)];
    if (fresh) window.mitTrack && window.mitTrack('quiz_complete', { quiz_name: 'lawn_plan', effort_level: level, lawn_profile: profile.name, grass_pick: grassKey, task_count: tasks.length });
    const today = new Date();
    const hours = Math.max(1, Math.round(tasks.reduce((a, t) => a + t.minutes, 0) / 60));
    const ordered = tasks
      .map((t) => ({ t, s: statusOf(t, today) }))
      .sort((a, b) => rank(a) - rank(b));
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const g = GRASS[grassKey];
    try { if (!localStorage.getItem('mit-grass') && g.rate) localStorage.setItem('mit-grass', grassKey); } catch { /* */ }
    const mapped = yardTotal();
    const seeding = tasks.some((t) => t.id === 'seed');
    const links = (id) => (TOOLS[id] || []).map(([h, t]) => `<a href="${h}">${t}</a>`).join('');
    const problems = (answers.problems || []).filter((p) => FIXES[p]);
    const place = getPlace();

    result.innerHTML = `
      <p class="plan-badge">Your lawn personality</p>
      <h2>${profile.name}</h2>
      <p>${profile.blurb}</p>
      <ul class="plan-stats">
        <li><b>${tasks.length}</b>things to do all year</li>
        <li><b>~${hours} ${hours === 1 ? 'hour' : 'hours'}</b>a year, not counting mowing</li>
        <li><b data-size-stat>${mapped ? fmtN(mapped) : '—'}</b>sq ft of lawn</li>
      </ul>
      ${notes.length ? `<ul class="plan-notes">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}

      <div class="plan-box plan-now" data-now>
        <h3>Right now in ${place.name}</h3>
        <div class="plan-now-grid">
          <p><span class="plan-k">Water?</span> <b data-now-water>Checking…</b> <small data-now-water-why></small></p>
          <p><span class="plan-k">Soil</span> <b data-now-soil>Checking…</b> <small data-now-soil-why></small></p>
        </div>
        <p class="plan-links"><a href="/resources/should-i-water-my-lawn/">Rain meter</a><a href="/resources/can-i-seed-now/">Can I seed now?</a><a href="/#local">Your lawn this week</a></p>
      </div>

      <div class="plan-box plan-grass">
        <h3>Your grass</h3>
        ${g.rate
          ? `<p><b>${g.name}</b>${g.mix ? ` · ${g.mix}` : ''}</p><p>${(g.why || [])[0] || ''}</p>`
          : `<p><b>${g.name}</b> ${(g.why || [])[0] || ''}</p>`}
        <p class="plan-links"><a href="/lawn-101/#grass">Pick again with more detail</a><a href="/blog/grass-types-northeast/">Every grass, ranked</a></p>
      </div>

      <div class="plan-box plan-numbers">
        <h3>Your lawn, by the numbers</h3>
        <label class="plan-size"><span>Lawn size (sq ft)</span>
          <input type="text" inputmode="numeric" data-size value="${mapped ? fmtN(mapped) : (answers.sqft ? fmtN(answers.sqft) : '')}" placeholder="e.g. 5,000" />
        </label>
        <p class="plan-src">${mapped ? 'From your map. Nice.' : 'Don’t know? <a href="/measure/">Measure it on a map</a> in a minute, or guess: a quarter acre is about 10,000.'}</p>
        <dl class="lc-list" data-numbers></dl>
      </div>

      ${problems.length ? `
      <div class="plan-box plan-fixes">
        <h3>Fix what’s bugging you</h3>
        ${problems.map((p) => `<div class="plan-fix"><h4>${FIXES[p].h}</h4><p>${FIXES[p].p}</p><p class="plan-links">${FIXES[p].links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</p></div>`).join('')}
      </div>` : ''}

      <h3 class="plan-list-h">Your plan, starting now</h3>
      <ol class="plan-list">
        ${ordered.map(({ t, s }) => `
          <li class="plan-item" data-state="${s.state}">
            <p class="cal-window">${windowText(t)}</p>
            <h3>${t.title}</h3>
            <p>${t.short}</p>
            <p class="plan-why">${t.why}</p>
            <p class="plan-amt" data-amt="${t.id}" hidden></p>
            ${TOOLS[t.id] ? `<p class="plan-links">${links(t.id)}</p>` : ''}
            <p class="cal-status">${
              s.state === 'now' ? `Do it now. ${plural(s.daysLeft, 'day')} left.`
              : `Starts ${fmt(t.start)}, in ${plural(s.days, 'day')}.`
            }</p>
          </li>`).join('')}
      </ol>

      <div class="plan-box plan-kit">
        <h3>Everything else in your toolkit</h3>
        <p class="plan-links">
          <a href="/resources/whats-wrong-with-my-lawn/">What’s wrong with my lawn?</a><a href="/weeds/">Weed ID</a><a href="/resources/lawn-calculator/">Lawn calculator</a>
          <a href="/blog/lawn-mowing-etiquette/">Can I mow right now?</a><a href="/blog/how-to-read-a-fertilizer-bag/">Bag decoder</a>
          <a href="/blog/lawn-soil-test/">Soil test translator</a><a href="/resources/#need">Do I need this?</a><a href="/blog/lawn-mower-maintenance-diy/">Mower tune-up</a>
          <a href="/blog/walk-behind-vs-riding-vs-zero-turn-mower/">Which mower?</a><a href="/blog/lawn-mowing-playlist/">Mowing playlist</a><a href="/games/">Games</a>
        </p>
      </div>

      <div class="plan-actions">
        <button type="button" class="btn" data-ics>Add Reminders to My Calendar</button>
        <button type="button" class="btn btn-quiet" data-print>Print or Save as PDF</button>
        <button type="button" class="btn btn-quiet" data-restart>Retake the Quiz</button>
      </div>`;
    result.hidden = false;

    /* ---------- amounts from lawn size */
    const bags = (a, cover) => { const n = a / cover; return n < 0.95 ? `${Math.max(10, Math.round(n * 10) * 10)}% of a bag` : `${Math.ceil(n - 0.05)} bag${Math.ceil(n - 0.05) === 1 ? '' : 's'}`; };
    const lb = (n) => (n < 10 ? round1(n) : fmtN(Math.round(n)));
    const row = (t, d) => `<div><dt>${t}</dt><dd>${d}</dd></div>`;
    function amounts() {
      const a = num(result.querySelector('[data-size]').value);
      answers.sqft = a || undefined; save();
      result.querySelector('[data-size-stat]').textContent = a ? fmtN(a) : '—';
      const k = a / 1000;
      const seedLb = g.rate ? (answers.look === 'dirt' ? [k * g.rate[0], k * g.rate[1]] : [k * g.rate[0] / 2, k * g.rate[1] / 2]) : null;
      const feed = `${bags(a, 5000)} of the 5,000 sq ft size, or ${bags(a, 15000)} of the 15,000 size`;
      const per = {
        crabgrass: `Buy: ${feed}.`,
        'spring-feed': `Buy: ${feed}.`, 'fall-feed': `Buy: ${feed}.`, 'columbus-feed': `Buy: ${feed}.`, 'thanksgiving-feed': `Buy: ${feed}.`,
        'july4-feed': `Half dose: ${bags(a / 2, 5000)} of the 5,000 sq ft size.`,
        seed: seedLb ? `Buy: about ${lb(seedLb[0])}–${lb(seedLb[1])} lb of ${g.name.toLowerCase()} seed${answers.look === 'dirt' ? ' (new lawn rate)' : ' to overseed'}.` : '',
        lime: `Only if the test says so: no more than ${fmtN(Math.round(k * 50))} lb per round (${Math.ceil(k * 50 / 40)} of the 40 lb bags).`,
        summer: `One inch of water is ${fmtN(Math.round(a * 0.623))} gallons for your lawn. Rain counts.`,
      };
      result.querySelectorAll('[data-amt]').forEach((el) => { const v = a >= 100 && per[el.dataset.amt]; el.hidden = !v; el.textContent = v || ''; });
      const out = result.querySelector('[data-numbers]');
      if (a < 100) { out.innerHTML = row('Shopping list', 'Put in your lawn size and I’ll tell you exactly how much to buy for every step.'); return; }
      const mins = Math.max(5, Math.round(((a / 1.75) * 1.15) / (2.5 * 88)));
      out.innerHTML = [
        row('Fertilizer, each feeding', `<b>${feed}</b>.`),
        tasks.some((t) => t.id === 'crabgrass') ? row('Crabgrass preventer (April)', `<b>${feed}</b>.`) : '',
        seedLb && (seeding || flags.includes('bare') || flags.includes('patchy')) ? row(`Seed (${g.name})`, `<b>${lb(seedLb[0])}–${lb(seedLb[1])} lb</b> ${answers.look === 'dirt' ? 'for a new lawn' : 'to overseed'}. Plus starter fertilizer: ${bags(a, 5000)} (5,000 size).`) : '',
        row('Push-mowing time', `About <b>${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`}</b> a mow.`),
        row('More math', '<a href="/resources/lawn-calculator/">Lawn calculator</a> for lime, compost, straw and water.'),
      ].join('');
    }
    result.querySelector('[data-size]').addEventListener('input', amounts);
    amounts();

    /* ---------- live: water + soil for their ZIP */
    (async () => {
      try {
        const v = waterVerdict(await fetchWater(place), getGauge());
        result.querySelector('[data-now-water]').textContent = VERDICTS[v.key].label;
        result.querySelector('[data-now-water-why]').textContent = v.line;
      } catch { result.querySelector('[data-now-water]').textContent = 'Can’t tell right now'; }
      try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}&current=soil_temperature_6cm&temperature_unit=fahrenheit&timezone=America%2FNew_York`;
        const t = Math.round((await (await fetch(u)).json()).current.soil_temperature_6cm);
        result.querySelector('[data-now-soil]').textContent = `${t}°F`;
        result.querySelector('[data-now-soil-why]').textContent =
          t < 40 ? 'Asleep. Nothing to do.' : t < 50 ? 'Waking up or winding down.' : t < 56 ? 'Go time: crabgrass preventer weather in spring.' : t < 68 ? 'Prime growing. Seed and feed weather.' : 'Hot. Mow tall, water deep.';
      } catch { result.querySelector('[data-now-soil]').textContent = 'Can’t tell right now'; }
    })();

    result.querySelector('[data-ics]').addEventListener('click', () => downloadIcs(ordered, profile));
    result.querySelector('[data-print]').addEventListener('click', () => { window.mitTrack && window.mitTrack('quiz_print', { quiz_name: 'lawn_plan' }); window.print(); });
    result.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (a) window.mitTrack && window.mitTrack('quiz_result_click', { link_url: a.getAttribute('href'), link_text: (a.textContent || '').trim().slice(0, 60) }); });
    result.querySelector('[data-restart]').addEventListener('click', () => {
      window.mitTrack && window.mitTrack('quiz_retake', { quiz_name: 'lawn_plan' });
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
