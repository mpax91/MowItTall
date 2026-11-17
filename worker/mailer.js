// Email rendering + sending for the drip (Cloudflare Email Service, `send_email` binding EMAIL).
// Blocks from worker/drip.js → one mobile-first HTML email + plain text. Every site link gets utm tags and
// goes through the click tracker (/api/m/c/<send>/<n>); a 1px pixel (/api/m/o/<send>.gif) counts opens.
// Unsubscribe: footer link + List-Unsubscribe / one-click headers (Gmail and Yahoo require both).
export const SITE = 'https://mowittall.com';
export const ADDRESS = 'Mow It Tall · 83 Main Street · Bedford Hills, NY 10507';

const C = { bg: '#173d27', panel: '#1f5234', paper: '#f1f6ec', ink: '#12301d', red: '#c8372d', leaf: '#9fd36a', sun: '#f6c945', soft: '#e3eed9', dim: '#4a5d4b' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const escA = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const txt = (h) => String(h || '').replace(/href="\//g, `href="https://mowittall.com/`).replace(/<br\s*\/?>/gi, '\n').replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

// Site link + utm tags (so GA4 and the first-party log can tell which email sent the visit).
export function siteUrl(url, key, variant) {
  const u = new URL(url, SITE);
  if (u.hostname !== 'mowittall.com') return u.toString();
  u.searchParams.set('utm_source', 'email');
  u.searchParams.set('utm_medium', 'email');
  u.searchParams.set('utm_campaign', key.replace(/:\d{4}$/, '').replace(/[^a-z0-9:/_-]/gi, '').slice(0, 80));
  if (variant) u.searchParams.set('utm_content', variant);
  return u.toString();
}

// Render. Returns { html, text, links } (links[n] = the real URL behind tracked link n).
export function render(email, { sendId, key, variant, token, pref = 'all' }) {
  const links = [];
  const track = (url) => { links.push(siteUrl(url, key, variant)); return sendId ? `${SITE}/api/m/c/${sendId}/${links.length - 1}` : links[links.length - 1]; };
  const linkify = (h) => String(h || '').replace(/href="([^"]+)"/g, (_, u) => `href="${escA(track(u))}" style="color:${C.ink};font-weight:700"`);
  const P = (h, extra = '') => `<p style="margin:0 0 14px;font:16px/1.55 ${FONT};color:${C.ink};${extra}">${linkify(h)}</p>`;
  const parts = [], plain = [];
  for (const b of email.blocks) {
    const [t, a, c] = b;
    if (t === 'p') { parts.push(P(a)); plain.push(txt(a)); }
    else if (t === 'h') { parts.push(`<h2 style="margin:22px 0 8px;font:800 20px/1.25 ${FONT};color:${C.ink}">${a}</h2>`); plain.push(`\n${a.toUpperCase()}`); }
    else if (t === 'box') { parts.push(`<div style="background:${C.soft};border-radius:10px;padding:12px 14px;margin:0 0 14px;font:15px/1.5 ${FONT};color:${C.ink}">${linkify(a)}</div>`); plain.push(txt(a)); }
    else if (t === 'ps') { if (a) { parts.push(P(a, `font-size:14px;color:${C.dim};margin-top:18px`)); plain.push(txt(a)); } }
    else if (t === 'list') { parts.push(`<ul style="margin:0 0 14px;padding-left:20px;font:16px/1.6 ${FONT};color:${C.ink}">${a.map((x) => `<li>${linkify(x)}</li>`).join('')}</ul>`); plain.push(a.map((x) => `- ${txt(x)}`).join('\n')); }
    else if (t === 'btn') {
      const href = track(c);
      parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="background:${C.red};border-radius:8px"><a href="${escA(href)}" style="display:inline-block;padding:14px 22px;font:800 16px/1.2 ${FONT};color:#ffffff;text-decoration:none">${a} &rarr;</a></td></tr></table>`);
      plain.push(`${a}: ${links[links.length - 1]}`);
    } else if (t === 'steps') {
      parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">${a.map((s, i) => `
        <tr><td valign="top" width="40" style="padding:0 0 14px"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${C.red};color:#fff;text-align:center;font:800 15px/30px ${FONT}">${i + 1}</div></td>
        <td valign="top" style="padding:0 0 14px">
          <div style="font:800 11px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#2f7d34">${s.k}</div>
          <div style="font:800 17px/1.3 ${FONT};color:${C.ink};margin:2px 0 4px">${s.title}</div>
          <div style="font:15px/1.5 ${FONT};color:${C.ink}">${linkify(s.text)}</div>
          ${s.extra ? `<div style="background:${C.soft};border-radius:8px;padding:8px 10px;margin-top:6px;font:14px/1.5 ${FONT};color:${C.ink}">${linkify(s.extra)}</div>` : ''}
          ${s.link ? `<div style="margin-top:6px;font:700 14px/1.4 ${FONT}"><a href="${escA(track(s.link[0]))}" style="color:${C.ink}">${s.link[1]} &rarr;</a></div>` : ''}
        </td></tr>`).join('')}</table>`);
      plain.push(a.map((s, i) => `${i + 1}. ${s.k.toUpperCase()}: ${s.title}\n   ${txt(s.text)}${s.extra ? `\n   ${txt(s.extra)}` : ''}`).join('\n'));
    } else if (t === 'ask') {
      // One-tap question: each answer is a tracked link to /saved/?f=<field>&v=<value> (saved by the browser there).
      const [, q, field, opts] = b;
      parts.push(`<div style="background:${C.soft};border-radius:12px;padding:14px 14px 8px;margin:0 0 16px"><p style="margin:0 0 10px;font:800 16px/1.4 ${FONT};color:${C.ink}">${q}</p>${opts.map(([v, label]) => `<a href="${escA(track(`/saved/?f=${field}&v=${v}`))}" style="display:inline-block;margin:0 6px 8px 0;padding:10px 14px;border-radius:999px;background:#ffffff;border:2px solid ${C.ink};font:700 15px/1.2 ${FONT};color:${C.ink};text-decoration:none">${label}</a>`).join('')}</div>`);
      plain.push(`${q}\n${opts.map(([v, label]) => `- ${label}: ${links[links.length - opts.length + opts.findIndex((o) => o[0] === v)]}`).join('\n')}`);
    } else if (t === 'hr') { parts.push(`<hr style="border:0;border-top:1px solid #cfdcc5;margin:18px 0">`); }
  }
  const unsub = `${SITE}/api/m/u?t=${token || ''}${sendId ? `&s=${sendId}` : ''}`;
  const pixel = sendId ? `<img src="${SITE}/api/m/o/${sendId}.gif" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : '';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escA(email.subject || '')}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escA(email.pre || '')}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:20px 12px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:4px 4px 14px"><a href="${escA(track('/'))}" style="text-decoration:none;font:800 24px/1 ${FONT};color:#eef5e6;letter-spacing:-.02em">Mow It <span style="color:${C.leaf}">TALL</span></a></td></tr>
    <tr><td style="background:${C.paper};border-radius:14px;padding:24px 22px 10px">${parts.join('\n')}</td></tr>
    <tr><td style="padding:16px 6px 0;font:13px/1.6 ${FONT};color:#b9d8b4;text-align:center">
      You’re getting this because you signed up at mowittall.com.<br>
      <a href="${escA(track('/account/'))}" style="color:#e3efdc">Your lawn profile</a> &nbsp;·&nbsp; ${pref === 'jobs' ? 'Job reminders only' : `<a href="${escA(unsub)}&o=jobs" style="color:#e3efdc">Just job reminders</a>`} &nbsp;·&nbsp; <a href="${escA(unsub)}" style="color:#e3efdc">Unsubscribe</a><br>
      ${ADDRESS}
    </td></tr>
  </table>
</td></tr></table>${pixel}</body></html>`;
  const text = `${plain.join('\n\n')}\n\n--\nYou’re getting this because you signed up at mowittall.com.\nUnsubscribe: ${unsub}\n${ADDRESS}`;
  return { html, text, links, unsub };
}

// Send through Cloudflare Email Service. Returns { ok, messageId } or { ok: false, code, error }.
export async function sendMail(env, { to, from, replyTo, subject, html, text, unsub, headers = {} }) {
  if (!env.EMAIL) return { ok: false, code: 'E_NO_BINDING', error: 'The EMAIL binding is missing (send_email in wrangler.jsonc).' };
  const h = { ...headers };
  if (unsub) { h['List-Unsubscribe'] = `<${unsub}&oc=1>, <mailto:${from.email}?subject=unsubscribe>`; h['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'; }
  try {
    const r = await env.EMAIL.send({ to, from, replyTo: replyTo || from, subject, html, text, headers: h });
    return { ok: true, messageId: r?.messageId || '' };
  } catch (e) {
    return { ok: false, code: e?.code || 'E_UNKNOWN', error: String(e?.message || e).slice(0, 300) };
  }
}
