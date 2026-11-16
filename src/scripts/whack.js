// Whack-a-Weed: tap the weeds, spare the bees, never touch the gas blower.
import { toSvg } from '../data/pixels.js';
import { WEEDS } from '../data/weeds.js';

const BEE = [
  '..ww..ww..',
  '.wWwwwwWw.',
  '..wwwwww..',
  '..kyykyy..',
  '.kyykyykk.',
  'kkyykyykkk',
  '.kyykyykk.',
  '..kyykyy..',
  '...k..k...',
  '..........',
];
const BLOWER = [
  '..........',
  '.....kk...',
  '....kook..',
  'kkkkooook.',
  'ssskoOoook',
  's..kooookk',
  's...kkkk..',
  '..........',
  '..........',
  '..........',
];
const icon = (id) => WEEDS.find((w) => w.id === id).icon;

const TYPES = [
  { id: 'dandelion', w: 48, pts: 10, label: 'Dandelion', svg: toSvg(icon('dandelion'), 56) },
  { id: 'clover', w: 20, pts: 5, label: 'Clover', svg: toSvg(icon('clover'), 56) },
  { id: 'crabgrass', w: 12, pts: 20, label: 'Crabgrass', svg: toSvg(icon('crabgrass'), 56) },
  { id: 'bee', w: 14, pts: -25, label: 'A bee', svg: toSvg(BEE, 56), say: 'Leave the bees alone!' },
  { id: 'blower', w: 6, pts: -50, label: 'A gas leaf blower', svg: toSvg(BLOWER, 56), say: 'Bedford would like a word.' },
];
const TOTAL_W = TYPES.reduce((a, t) => a + t.w, 0);
const pick = () => { let r = Math.random() * TOTAL_W; return TYPES.find((t) => (r -= t.w) < 0) || TYPES[0]; };

const GRADES = [
  [400, 'Weed assassin.'],
  [280, 'The dandelions fear you.'],
  [180, 'Solid weekend work.'],
  [90, 'The weeds are winning, but it’s close.'],
  [-1e9, 'You may have been working for the weeds.'],
];

export function initWhack(root) {
  const $ = (s) => root.querySelector(s);
  const holes = [...root.querySelectorAll('[data-hole]')];
  const timeEl = $('[data-w-time]'), scoreEl = $('[data-w-score]');
  const start = $('[data-w-start]'), end = $('[data-w-end]');
  const ROUND = 30;
  let score = 0, t = 0, running = false, timer, spawner;
  const best = () => { try { return Number(localStorage.getItem('mit-whack')) || 0; } catch { return 0; } };

  function setBest() { const b = best(); $('[data-w-best]').textContent = b ? `Your best: ${b}` : ''; }
  setBest();

  function clear(h) { h.innerHTML = ''; h.dataset.type = ''; h.setAttribute('aria-label', 'Empty patch'); h.disabled = true; }
  holes.forEach(clear);

  function spawn() {
    if (!running) return;
    const free = holes.filter((h) => !h.dataset.type);
    if (free.length) {
      const h = free[Math.floor(Math.random() * free.length)];
      const type = pick();
      h.dataset.type = type.id;
      h.innerHTML = `<span class="whack-sprite">${type.svg}</span>`;
      h.setAttribute('aria-label', `${type.label}. Tap to ${type.pts > 0 ? 'pull it' : 'regret it'}.`);
      h.disabled = false;
      const life = Math.max(650, 1100 - (ROUND - t) * 12);
      h._timeout = setTimeout(() => { if (h.dataset.type === type.id) clear(h); }, life);
    }
    spawner = setTimeout(spawn, Math.max(330, 650 - (ROUND - t) * 9));
  }

  function hit(h) {
    if (!running || !h.dataset.type) return;
    const type = TYPES.find((x) => x.id === h.dataset.type);
    clearTimeout(h._timeout);
    score += type.pts;
    scoreEl.textContent = score;
    const pop = document.createElement('span');
    pop.className = `whack-pop ${type.pts > 0 ? 'is-good' : 'is-bad'}`;
    pop.textContent = type.say ? `${type.pts} ${type.say}` : `+${type.pts}`;
    h.parentElement.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
    if (type.pts < 0) root.classList.add('is-ouch'), setTimeout(() => root.classList.remove('is-ouch'), 300);
    clear(h);
  }
  holes.forEach((h) => h.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(h); }));
  holes.forEach((h) => h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(h); } }));

  function go() {
    start.hidden = true; end.hidden = true;
    score = 0; t = ROUND; running = true;
    scoreEl.textContent = '0'; timeEl.textContent = `0:${ROUND}`;
    holes.forEach(clear);
    spawn();
    timer = setInterval(() => {
      t--;
      timeEl.textContent = `0:${String(Math.max(0, t)).padStart(2, '0')}`;
      if (t <= 0) finish();
    }, 1000);
  }

  function finish() {
    running = false;
    clearInterval(timer); clearTimeout(spawner);
    holes.forEach((h) => { clearTimeout(h._timeout); clear(h); });
    const prev = best();
    window.mitTrack && window.mitTrack('game_complete', { game_name: 'whack_a_weed', score, new_best: score > prev ? 1 : 0 });
    if (score > prev) { try { localStorage.setItem('mit-whack', String(score)); } catch { /* private mode */ } }
    $('[data-w-total]').textContent = score;
    $('[data-w-grade]').textContent = GRADES.find(([min]) => score >= min)[1];
    $('[data-w-note]').textContent = score > prev ? (prev ? `New best. Old best: ${prev}.` : 'First score on the board.') : `Your best: ${prev}.`;
    end.hidden = false;
    setBest();
  }

  root.querySelectorAll('[data-w-go]').forEach((b) => b.addEventListener('click', go));
}
