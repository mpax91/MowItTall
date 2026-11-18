// "Save to Leaderboard" form for game result screens. Optional: players type 1-3 initials and get sent to
// /leaderboard/ with their row highlighted. One board per game (worker/scores.js).
//   saveScore(slot, { game: 'hero_stripe', score: 87, level: 'starter' })
// Call it every time a round ends; it replaces whatever was in the slot.

function device() {
  let d = '';
  try { d = localStorage.getItem('mit-device') || ''; } catch { /* private mode */ }
  if (!d) { d = crypto.randomUUID(); try { localStorage.setItem('mit-device', d); } catch { /* */ } }
  return d;
}

export function saveScore(slot, { game, score, level }) {
  if (!slot) return;
  let last = '';
  try { last = localStorage.getItem('mit-initials') || ''; } catch { /* */ }
  const board = `/leaderboard/?game=${game}`;
  slot.innerHTML = `
    <form class="lb-save" novalidate>
      <p class="lb-save-h">Save to the Leaderboard?</p>
      <div class="lb-save-row">
        <input class="lb-initials" name="initials" maxlength="3" autocomplete="off" autocapitalize="characters" spellcheck="false"
          inputmode="text" placeholder="AAA" aria-label="Your initials, up to 3 letters" />
        <button type="submit" class="btn lb-save-btn">Save Score</button>
      </div>
      <p class="lb-save-err" role="alert" hidden></p>
      <a class="lb-save-link" href="${board}">See the Leaderboard</a>
    </form>`;
  const form = slot.querySelector('form');
  const input = form.querySelector('input');
  const btn = form.querySelector('button');
  const err = form.querySelector('.lb-save-err');
  input.value = last;
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); err.hidden = true; });
  // keep game keyboard shortcuts (space = mow, arrows = drive) from firing while typing
  input.addEventListener('keydown', (e) => e.stopPropagation());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const initials = input.value.trim();
    if (!initials) { err.textContent = 'Type your initials first.'; err.hidden = false; input.focus(); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const r = await fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, score, level, initials, device: device() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.id) throw new Error(j.error || 'Couldn’t save that. Try again in a minute.');
      try { localStorage.setItem('mit-initials', initials); } catch { /* */ }
      window.mitTrack && window.mitTrack('score_save', { game_name: game, level_name: level || undefined, score });
      location.href = `${board}&id=${j.id}`;
    } catch (x) {
      err.textContent = x.message; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Save Score';
    }
  });
}
