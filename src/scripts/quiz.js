// The lawn plan quiz (/plan/). Ten questions max (Mike, Nov 17). Each pick gets a quick reaction line, then
// moves on. The results page is deliberately short: a personality, three steps, and the email sign-up.
// Everything else (amounts per job, the full year, tools, posts) goes out over time in the email drip.
// Plan logic lives in src/data/gamePlan.js so the welcome email says exactly what this page says.
import { buildPlan, SIZES, fmtDate } from '../data/gamePlan.js';
import { yardTotal, fmt as fmtN } from './yard.js';
import { getPlace, setZip } from './place.js';

const STEPS = [
  { id: 'zip', q: 'Where’s your lawn?', hint: 'Your ZIP code. It times everything for your area.', type: 'zip' },
  {
    id: 'look', q: 'Be honest. How does it look right now?', hint: 'Nobody’s grading this. Except the neighbors.', type: 'one',
    options: [
      { v: 'good', t: 'Honestly? Pretty good.', s: 'I’m here to make it great.', r: 'Look at you. Let’s make it obnoxious.' },
      { v: 'street', t: 'Fine from the street.', s: 'Just don’t look too close.', r: 'The classic. We can fix “up close.”' },
      { v: 'patchy', t: 'Patchy.', s: 'Like a teenager’s first beard.', r: 'Patchy is fixable. September is your month.' },
      { v: 'weedy', t: 'More weeds than grass.', s: 'The dandelions pay rent at this point.', r: 'Eviction notices are coming.' },
      { v: 'dirt', t: 'Dirt with ambitions.', s: 'We’re starting from the bottom.', r: 'Love a project. Now we’re here.' },
    ],
  },
  {
    id: 'size', q: 'How big is the lawn?', hint: 'A guess is fine. It’s for how much stuff to buy.', type: 'one',
    options: [
      { v: 'tiny', t: 'Postage stamp', s: 'I could mow it with scissors.', r: 'Small lawn, small bills. Smart.' },
      { v: 'normal', t: 'Normal suburban yard', s: 'Front, back, a little side strip.', r: 'The sweet spot.' },
      { v: 'quarter', t: 'Quarter acre-ish', s: 'Takes a podcast episode to mow.', r: 'A proper lawn. Respect.' },
      { v: 'big', t: 'Big. Like, riding-mower big', s: 'Half an acre or more.', r: 'You have a lot of stripes in your future.' },
      { v: 'unknown', t: 'No idea', s: 'It’s… green-sized.', r: 'No problem. You can measure it on a map later.' },
    ],
  },
  {
    id: 'effort', q: 'How much effort are we talking?', hint: 'Pick the real answer, not the New Year’s resolution answer.', type: 'one',
    options: [
      { v: 0, t: 'Couch Potato', s: 'I will mow. That’s the deal. Don’t make it weird.', r: 'Honest. I can work with honest.' },
      { v: 1, t: 'Good Enough Guy', s: 'A Saturday morning here and there. Nice lawn, no obsession.', r: 'Where most great lawns live.' },
      { v: 2, t: 'Curb Appeal Hunter', s: 'I want people to slow down when they drive by.', r: 'Cars will slow down. Promise.' },
      { v: 3, t: 'Lawn Psycho', s: 'I’ve named my mower. I know my soil pH. Send help.', r: 'Welcome home.' },
    ],
  },
  {
    id: 'problems', q: 'What’s bugging you?', hint: 'Pick all that apply. Or none, you overachiever.', type: 'many',
    options: [
      { v: 'weeds', t: 'Weeds', s: 'Dandelions, clover, the usual suspects.' },
      { v: 'crabgrass', t: 'Crabgrass', s: 'The wide, ugly grass that shows up in July.' },
      { v: 'bare', t: 'Bare spots', s: 'Dirt where grass should be.' },
      { v: 'brown', t: 'Turns brown in summer', s: 'Crispy by August.' },
      { v: 'grubs', t: 'Grubs or digging', s: 'Patches that peel up like carpet. Or a skunk party.' },
      { v: 'neighbor', t: 'My neighbor’s lawn is nicer', s: 'This is personal.' },
    ],
  },
  {
    id: 'height', q: 'How high do you mow?', hint: 'Check the lever by the wheel if you’re not sure.', type: 'one',
    options: [
      { v: 'unknown', t: 'No clue.', s: 'It came that way.', r: 'That’s about to be your best free fix.' },
      { v: 'low', t: 'Short.', s: 'Means fewer mows, right?', r: 'Oh no. We’ll talk.' },
      { v: 'mid', t: 'Somewhere in the middle.', s: 'Seems reasonable.', r: 'Close. One notch more.' },
      { v: 'high', t: 'As high as it goes.', s: 'A person of culture.', r: 'You get it. Mow it tall.' },
    ],
  },
  {
    id: 'sun', q: 'How much sun does it get?', hint: 'Think middle of a summer day.', type: 'one',
    options: [
      { v: 'full', t: 'Full sun', s: 'Out in the open most of the day.', r: 'Grass loves that.' },
      { v: 'part', t: 'Some shade', s: 'A few trees doing their thing.', r: 'Totally workable.' },
      { v: 'mixed', t: 'Sunny in front, shady in back', s: 'Two lawns in one.', r: 'Two lawns, one plan.' },
      { v: 'shade', t: 'Mostly shade', s: 'It’s basically a forest.', r: 'The trees are winning. We’ll negotiate.' },
    ],
  },
  {
    id: 'water', q: 'Do you water?', hint: 'No wrong answer. It changes which grass makes sense.', type: 'one',
    options: [
      { v: 'auto', t: 'Sprinkler system', s: 'It runs on a timer.', r: 'Fancy. We’ll make sure it’s not overdoing it.' },
      { v: 'hose', t: 'Hose, when it looks rough', s: 'When I remember.', r: 'Deep and rare beats daily. You’re fine.' },
      { v: 'never', t: 'Nope', s: 'Rain or nothing.', r: 'Totally fine. Tough grass, mow tall.' },
    ],
  },
  {
    id: 'uses', q: 'Who uses the lawn?', hint: 'Kids and dogs change what you put down.', type: 'one',
    options: [
      { v: 'kids', t: 'Kids', s: 'Soccer goals and bare spots.', r: 'A lawn that gets used is a good lawn.' },
      { v: 'dogs', t: 'Dogs', s: 'Yellow spots, worn paths.', r: 'Let the dog pee. We’ll fix the spots.' },
      { v: 'both', t: 'Kids and dogs', s: 'Chaos. Lovely chaos.', r: 'Chaos-proof plan coming up.' },
      { v: 'adults', t: 'Just grown-ups', s: 'Cookouts and lawn chairs.', r: 'Civilized.' },
      { v: 'looks', t: 'Nobody. It’s for looks', s: 'Admired from the window.', r: 'A museum lawn. Bold.' },
    ],
  },
  {
    id: 'mower', q: 'Who actually does the mowing?', hint: 'Last one. The plan works either way.', type: 'one',
    options: [
      { v: 'me', t: 'Me', s: 'Every week. Mostly.', r: 'Hero.' },
      { v: 'crew', t: 'A landscaper or lawn service', s: 'They show up, they leave, things are shorter.', r: 'Smart. I’ll split the jobs: his and yours.' },
      { v: 'kid', t: 'A kid I pay', s: 'Cash and guilt, in roughly equal amounts.', r: 'Pro tip: bonus for straight stripes.' },
      { v: 'robot', t: 'A robot', s: 'It’s the future and it lives in my yard.', r: 'The robot is judging you. Kindly.' },
    ],
  },
];

const KEY = 'mit-quiz';
const track = (e, p) => window.mitTrack && window.mitTrack(e, p);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function initQuiz(root) {
  const $ = (s) => root.querySelector(s);
  const card = $('[data-card]');
  const result = $('[data-result]');
  let step = 0, busy = false;
  let answers = {};
  try { answers = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { answers = {}; }

  if (answers.done) showResult();
  else render();

  function save() { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch { /* private mode */ } }

  function render() {
    const s = STEPS[step];
    $('[data-bar]').style.width = `${(step / STEPS.length) * 100}%`;
    $('[data-count]').textContent = `Question ${step + 1} of ${STEPS.length}`;
    $('[data-q]').textContent = s.q;
    const hint = $('[data-hint]');
    hint.textContent = s.hint; hint.classList.remove('is-react');
    $('[data-back]').hidden = step === 0;
    const next = $('[data-next]');
    next.textContent = step === STEPS.length - 1 ? 'Show My Plan' : 'Next';
    const body = $('[data-body]');

    if (s.type === 'zip') {
      body.innerHTML = `
        <label class="sr-only" for="zip">ZIP code</label>
        <input id="zip" class="quiz-input" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="10506" value="${answers.zip || (!getPlace().home && getPlace().zip) || ''}">
        <p class="quiz-note" data-note></p>`;
      const input = body.querySelector('input');
      const check = () => {
        const v = input.value.replace(/\D/g, '').slice(0, 5);
        input.value = v; answers.zip = v;
        const note = body.querySelector('[data-note]');
        note.textContent = v.length === 5 ? (/^[01]/.test(v) ? 'Nice. Northeast timing it is.' : 'Heads up: timing is tuned for the Northeast, so dates may run a bit off where you are.') : '';
        next.disabled = v.length !== 5;
      };
      input.addEventListener('input', check);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !next.disabled) go(1); });
      check();
      return;
    }

    const multi = s.type === 'many';
    let options = s.options;
    // A measured lawn beats a guess: offer it first.
    const mapped = s.id === 'size' ? yardTotal() : 0;
    if (mapped) options = [{ v: 'map', t: `From my map: ${fmtN(mapped)} sq ft`, s: 'You measured it. Nerd. (Compliment.)', r: 'Exact numbers. Love it.' }, ...options];
    const current = answers[s.id];
    body.innerHTML = `<div class="quiz-options" role="group" aria-label="${esc(s.q)}">${options
      .map((o) => {
        const on = multi ? (current || []).includes(o.v) : current === o.v;
        return `<button type="button" class="quiz-opt" data-v="${o.v}" aria-pressed="${on}"><strong>${o.t}</strong><span>${o.s}</span></button>`;
      }).join('')}</div>`;
    body.querySelectorAll('.quiz-opt').forEach((b) => {
      b.addEventListener('click', () => {
        if (busy) return;
        const opt = options.find((o) => String(o.v) === b.dataset.v);
        if (multi) {
          const set = new Set(answers[s.id] || []);
          set.has(opt.v) ? set.delete(opt.v) : set.add(opt.v);
          answers[s.id] = [...set];
          b.setAttribute('aria-pressed', String(set.has(opt.v)));
          next.textContent = set.size ? 'Next' : 'Nothing. I’m Perfect.';
          save();
          return;
        }
        answers[s.id] = opt.v;
        if (s.id === 'size') answers.sqft = opt.v === 'map' ? mapped : SIZES[opt.v] || undefined;
        body.querySelectorAll('.quiz-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        save();
        next.disabled = false;
        // The reaction line, then on to the next question.
        if (opt.r) { hint.textContent = opt.r; hint.classList.add('is-react'); }
        busy = true;
        setTimeout(() => { busy = false; go(1); }, opt.r ? 900 : 200);
      });
    });
    if (multi) next.textContent = (current || []).length ? 'Next' : 'Nothing. I’m Perfect.';
    next.disabled = !multi && current === undefined;
  }

  function go(d) {
    if (d > 0 && STEPS[step]?.type === 'zip' && answers.zip?.length === 5 && answers.zip !== getPlace().zip) setZip(answers.zip);
    if (d > 0 && step === 0) track('quiz_start', { quiz_name: 'lawn_plan' });
    if (d > 0 && STEPS[step]) {
      const a = answers[STEPS[step].id];
      track('quiz_step', { quiz_name: 'lawn_plan', step_number: step + 1, question_id: STEPS[step].id, step_type: STEPS[step].type || 'choice',
        answer: STEPS[step].type === 'zip' ? String(a || '').slice(0, 3) : Array.isArray(a) ? a.join(',').slice(0, 90) : String(a ?? '').slice(0, 90) });
    }
    if (d < 0 && STEPS[step]) track('quiz_back', { quiz_name: 'lawn_plan', step_number: step + 1, question_id: STEPS[step].id });
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
      track('quiz_abandon', { quiz_name: 'lawn_plan', step_number: step + 1, question_id: STEPS[step]?.id || '' });
    }
  });
  $('[data-next]').addEventListener('click', () => go(1));
  $('[data-back]').addEventListener('click', () => go(-1));

  /* ================================================================ results */
  function showResult(fresh) {
    card.hidden = true;
    root.querySelector('.quiz-intro').hidden = true;
    const sqft = yardTotal() || answers.sqft || 0;
    const plan = buildPlan(answers, { sqft });
    const { profile, level } = plan;
    if (fresh) track('quiz_complete', { quiz_name: 'lawn_plan', effort_level: level, lawn_profile: profile.name, grass_pick: plan.grassKey, task_count: plan.tasks.length });
    try { if (!localStorage.getItem('mit-grass') && plan.grass?.rate) localStorage.setItem('mit-grass', plan.grassKey); } catch { /* */ }
    let joined = false; try { joined = !!localStorage.getItem('mit-email'); } catch { /* */ }

    const linkA = (l, cls = 'gp-link') => (l ? `<a class="${cls}" href="${l[0]}">${esc(l[1])}</a>` : '');
    const extra = (j) => [
      j.who ? `<p class="gp-who"><b>${j.who.who === 'guy' ? 'Your guy' : 'You'}:</b> ${esc(j.who.line)}</p>` : '',
      j.amount ? `<p class="gp-amt"><b>For your lawn:</b> ${esc(j.amount)}.</p>` : '',
    ].join('');
    const now = plan.doNow, nx = plan.next;
    const stepNow = now
      ? `<li class="gp-step"><p class="gp-k">This Week</p><h3>${esc(now.title)}</h3><p>${esc(now.short)}</p>${extra(now)}
          <p class="gp-when">Good window ends ${fmtDate(new Date(now.on.getTime() + now.daysLeft * 86400000))}.</p>${linkA(now.link)}</li>`
      : `<li class="gp-step"><p class="gp-k">This Week</p><h3>Nothing. Enjoy it.</h3><p>Your lawn doesn’t need anything right now. The best thing you can do is leave it alone.</p></li>`;
    const stepFix = `<li class="gp-step"><p class="gp-k">Your Free Fix</p><h3>${esc(plan.fix.title)}</h3><p>${esc(plan.fix.short)}</p>${linkA(plan.fix.link)}</li>`;
    const stepNext = nx
      ? `<li class="gp-step"><p class="gp-k">Next Up · ${fmtDate(nx.on)}</p><h3>${esc(nx.title)}</h3><p>${esc(nx.short)}</p>${extra(nx)}</li>`
      : '';
    const more = Math.max(0, plan.tasks.length - (now ? 1 : 0) - (nx ? 1 : 0));

    result.innerHTML = `
      <p class="plan-badge">Your lawn personality</p>
      <h2>${profile.name}</h2>
      <p class="gp-blurb">${profile.blurb}${plan.petty ? ' <b>Neighbor envy detected:</b> I bumped you up one level. Petty? Yes. Effective? Also yes.' : ''}</p>

      <h3 class="gp-h">Your Game Plan</h3>
      <ol class="gp-steps">${stepNow}${stepFix}${stepNext}</ol>
      <p class="gp-total"><b>${plural(plan.tasks.length, 'job')} a year</b>, about ${plural(plan.hours, 'hour')}${plan.crew ? ' of your time' : ' plus mowing'}.${more ? ` <a href="/calendar/?level=${level}#cal">See all ${plan.tasks.length}</a>` : ''}</p>

      <div class="window gp-mail" data-mail>
        ${joined ? doneHTML(true) : `
        <h3>Get Your Lawn Year by Email</h3>
        <p>I’ll email you right before each job, with exactly how much to buy for your lawn. Plus the good stuff from the site, about once a week. No spam. One click to leave.</p>
        <form class="gp-form" data-mail-form novalidate>
          <label class="sr-only" for="mail-name">First name</label>
          <input id="mail-name" name="name" class="quiz-input" autocomplete="given-name" placeholder="First name (optional)" maxlength="40">
          <label class="sr-only" for="mail-email">Email</label>
          <input id="mail-email" name="email" class="quiz-input" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" required maxlength="120">
          <input name="website" class="gp-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button type="submit" class="btn">Send Me My Lawn Year</button>
          <p class="gp-msg" data-mail-msg role="status"></p>
        </form>`}
      </div>

      <div class="gp-actions">
        <button type="button" class="btn btn-quiet" data-ics>Add ${plural(plan.tasks.length, 'Job')} to My Calendar</button>
      </div>
      <p class="gp-fine"><button type="button" class="linkish" data-restart>Retake the quiz</button> · <button type="button" class="linkish" data-print>Print</button></p>`;
    result.hidden = false;

    result.querySelector('[data-ics]').addEventListener('click', () => downloadIcs(plan));
    result.querySelector('[data-print]').addEventListener('click', () => { track('quiz_print', { quiz_name: 'lawn_plan' }); window.print(); });
    result.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (a) track('quiz_result_click', { link_url: a.getAttribute('href'), link_text: (a.textContent || '').trim().slice(0, 60) }); });
    result.querySelector('[data-restart]').addEventListener('click', () => {
      track('quiz_retake', { quiz_name: 'lawn_plan' });
      answers = {}; save(); step = 0;
      result.hidden = true; card.hidden = false; root.querySelector('.quiz-intro').hidden = false;
      render();
    });
    const form = result.querySelector('[data-mail-form]');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); subscribe(form, plan); });
    result.scrollIntoView({ block: 'start' });
  }

  function doneHTML(again) {
    return `<h3>${again ? 'You’re on the List' : 'You’re In'}</h3><p>${again ? 'Your lawn year is coming by email. Check your inbox (and the Promotions tab) for the next one.' : 'Check your inbox for your game plan. Can’t find it? Look in Promotions or Spam and drag it to your inbox, so the reminders show up.'}</p>`;
  }

  async function subscribe(form, plan) {
    const msg = form.querySelector('[data-mail-msg]');
    const email = form.email.value.trim(), name = form.name.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'That email doesn’t look right.'; form.email.focus(); return; }
    const btn = form.querySelector('button'); btn.disabled = true; msg.textContent = 'Sending…';
    let sess = {}, device = ''; try { sess = JSON.parse(localStorage.getItem('mit-sess') || '{}'); device = localStorage.getItem('mit-device') || ''; } catch { /* */ }
    const { done, ...a } = answers;
    try {
      const r = await fetch('/api/crm/subscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, answers: a, sqft: plan.sqft, source: 'quiz', device, website: form.website.value, utm: { src: sess.src, med: sess.med, camp: sess.camp, land: sess.land } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something broke. Try again in a minute.');
      try { localStorage.setItem('mit-email', '1'); if (j.t) localStorage.setItem('mit-crm', j.t); } catch { /* */ }
      track('generate_lead', { method: 'quiz', form_id: 'lawn_year_email', effort_level: plan.level, lawn_profile: plan.profile.name });
      form.closest('[data-mail]').innerHTML = doneHTML(false);
    } catch (err) {
      msg.textContent = err.message; btn.disabled = false;
    }
  }
}

function downloadIcs(plan) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const esc2 = (s) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const jobs = [plan.doNow, ...plan.alsoNow, ...plan.upcoming].filter(Boolean);
  window.mitTrack && window.mitTrack('calendar_download', { tool_name: 'lawn_plan', task_count: jobs.length });
  const events = jobs.map((j) => {
    const d = j.on, end = new Date(d.getTime() + 86400000);
    return ['BEGIN:VEVENT', `UID:${j.id}-${ymd(d)}@mowittall.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${esc2('Lawn: ' + j.title)}`,
      `DESCRIPTION:${esc2(`${j.who ? `${j.who.who === 'guy' ? 'Your guy' : 'You'}: ${j.who.line}\n` : ''}${j.short} ${j.why}${j.amount ? `\nFor your lawn: ${j.amount}.` : ''}\nGood window: ${j.window}.\nhttps://mowittall.com${j.link ? j.link[0] : '/calendar/'}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', `DESCRIPTION:${esc2(j.title)}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mow It Tall//Lawn plan//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'mow-it-tall-lawn-plan.ics';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
