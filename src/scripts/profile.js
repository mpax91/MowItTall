// Lawn profile sync for email subscribers. When someone on the list uses a tool on the site (measure the
// lawn, pick a grass, enter a soil pH, start a seed tracker, answer a one-tap email question), the answer
// is saved to their profile and every email after that uses it. The token comes from the quiz sign-up on
// this device, or from any email link (the click tracker adds ?mt=…, Base.astro stores it and strips it).
export const FIELDS = ['sqft', 'grass', 'sun', 'uses', 'water', 'ph', 'seeded', 'know', 'effort', 'mower', 'spreader'];
export function hasProfile() { try { return !!localStorage.getItem('mit-crm'); } catch { return false; } }
export function saveProfile(f, v) {
  if (!FIELDS.includes(f)) return false;
  let t = ''; try { t = localStorage.getItem('mit-crm') || ''; } catch { /* private mode */ }
  if (!t) return false;
  let d = ''; try { d = localStorage.getItem('mit-device') || ''; } catch { /* */ }
  const body = JSON.stringify({ t, f, v, d });
  try { if (navigator.sendBeacon && navigator.sendBeacon('/api/crm/update', new Blob([body], { type: 'application/json' }))) return true; } catch { /* fall through */ }
  fetch('/api/crm/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  return true;
}

// Quiz finished (or retaken) by someone already on the list: their new answers update the profile the emails use.
// Returns true if it sent. Profile answers gathered later (sun, grass, pH…) are kept on the server.
export function syncQuiz(answers) {
  let t = ''; try { t = localStorage.getItem('mit-crm') || ''; } catch { /* */ }
  if (!t || !answers) return false;
  const { done, at, ...a } = answers;
  fetch('/api/crm/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t, answers: a }), keepalive: true }).catch(() => {});
  return true;
}
