// Daily Bing Webmaster pull, run by GitHub Actions (.github/workflows/bing.yml).
// Bing often refuses calls from Cloudflare's shared Worker addresses, so this asks Bing from GitHub's machines
// and hands the answers to the site: POST https://mowittall.com/api/seo/bing-ingest (worker/seo.js → bingIngest).
// Needs one GitHub secret: BING_API_KEY (Bing Webmaster Tools → Settings → API access). Free, no AI.
//
//   BING_API_KEY=... node scripts/bing-pull.mjs
const KEY = process.env.BING_API_KEY;
const SITE = process.env.SITE_URL || 'https://mowittall.com/';
const INGEST = process.env.INGEST_URL || 'https://mowittall.com/api/seo/bing-ingest';
const HOSTS = ['https://ssl.bing.com/webmaster/api.svc/json', 'https://www.bing.com/webmaster/api.svc/json', 'https://api.bing.com/webmaster/api.svc/json'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!KEY) { console.error('Missing BING_API_KEY. Add it under GitHub → Settings → Secrets and variables → Actions.'); process.exit(1); }

async function call(method) {
  const tried = [];
  for (let round = 0; round < 3; round++) {
    for (const base of HOSTS) {
      const r = await fetch(`${base}/${method}?siteUrl=${encodeURIComponent(SITE)}&apikey=${encodeURIComponent(KEY)}`, { headers: { accept: 'application/json' } }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
      const body = await r.text().catch(() => '');
      let j = null; try { j = JSON.parse(body); } catch {}
      if (r.ok && j && !j.ErrorCode && Array.isArray(j.d)) return j.d;
      tried.push(`${new URL(base).host} ${r.status} ${(j?.Message || body).replace(/\s+/g, ' ').slice(0, 120)}`);
      if (r.status === 401 || /InvalidApiKey|NotAuthorized/i.test(body)) throw new Error(`Bing ${method}: the API key was refused. ${tried.at(-1)}`);
    }
    await sleep(20000 * (round + 1));
  }
  throw new Error(`Bing ${method} failed:\n  ${tried.join('\n  ')}`);
}

const queries = await call('GetQueryStats');
const pages = await call('GetPageStats');
console.log(`Bing answered: ${queries.length} query rows, ${pages.length} page rows.`);

const r = await fetch(INGEST, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bing-key': KEY }, body: JSON.stringify({ queries, pages }) });
const out = await r.text();
if (!r.ok) { console.error(`The site refused the data (${r.status}): ${out.slice(0, 300)}`); process.exit(1); }
console.log('Saved to the site:', out);
