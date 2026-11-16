// Production deploy + IndexNow (Cloudflare Workers Builds "Deploy command": npm run deploy).
//   1. Read the live manifest (= what the previous deploy published).
//   2. npx wrangler deploy. If it fails, stop: nothing is submitted.
//   3. Wait until the live site serves this build's manifest (proof the deploy is live).
//   4. Submit only new, changed and deleted URLs to IndexNow (first run: every public URL once).
// IndexNow problems never fail the deploy; they're just logged.
//
//   node scripts/deploy.mjs              deploy, then submit
//   node scripts/deploy.mjs --dry-run    no deploy, no submit: print what would be sent vs. the live site
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOST, ORIGIN, MANIFEST_PATH, ENDPOINT, findKey } from './indexnow-lib.mjs';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const log = (...a) => console.log('[indexnow]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getManifest() {
  try {
    const r = await fetch(`${ORIGIN}/${MANIFEST_PATH}?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.urls ? j : null;
  } catch { return null; }
}

async function main() {
  // Anything going wrong in the IndexNow prep must never block the deploy itself.
  let cur = null, prev = null;
  try {
    cur = JSON.parse(readFileSync(join('dist', MANIFEST_PATH), 'utf8'));
    prev = await getManifest();
    log(prev ? `previous deploy: ${Object.keys(prev.urls).length} URLs (build ${prev.build})` : 'no previous manifest on the live site (first run)');
  } catch (e) { log(`prep failed (${e.message}); will deploy without IndexNow.`); }

  if (!DRY) {
    const r = spawnSync('npx', ['wrangler', 'deploy'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) { console.error('[deploy] wrangler deploy failed; nothing submitted to IndexNow.'); process.exit(r.status || 1); }
  }

  if (!cur) return;
  // Only production (main) submits. Workers Builds sets WORKERS_CI_BRANCH; local runs have none.
  const branch = process.env.WORKERS_CI_BRANCH;
  if (branch && branch !== 'main') return log(`branch "${branch}" is not main: skipping IndexNow.`);

  const key = findKey('public');
  if (!key) return log('no key file in public/: skipping IndexNow.');

  if (!DRY) {
    // Wait for the new build to be the one actually served.
    let live = null;
    for (let i = 0; i < 24 && (!live || live.build !== cur.build); i++) { await sleep(i ? 5000 : 1000); live = await getManifest(); }
    if (!live || live.build !== cur.build) return log('the new build is not live after 2 minutes: skipping IndexNow this time (the next deploy will catch up).');
    const kr = await fetch(`${ORIGIN}/${key}.txt?t=${Date.now()}`).catch(() => null);
    if (!kr || !kr.ok || (await kr.text()).trim() !== key) return log(`key file ${ORIGIN}/${key}.txt is not reachable: skipping IndexNow.`);
  }

  const now = cur.urls, before = prev ? prev.urls : {};
  const added = Object.keys(now).filter((u) => !(u in before));
  const changed = Object.keys(now).filter((u) => u in before && before[u] !== now[u]);
  const removed = Object.keys(before).filter((u) => !(u in now));
  log(`new ${added.length}, changed ${changed.length}, deleted ${removed.length}, unchanged ${Object.keys(now).length - added.length - changed.length}`);
  for (const [label, list] of [['new', added], ['changed', changed], ['deleted', removed]]) list.forEach((u) => log(`  ${label}: ${u}`));

  const urlList = [...added, ...changed, ...removed];
  if (!urlList.length) return log('nothing to submit.');
  if (DRY) return log(`dry run: would submit ${urlList.length} URL(s).`);

  for (let i = 0; i < urlList.length; i += 10000) {
    const batch = urlList.slice(i, i + 10000);
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: batch }),
      });
      const body = (await r.text()).slice(0, 300);
      log(`submitted ${batch.length} URL(s): HTTP ${r.status}${r.ok ? ' (accepted)' : ''}${body ? ` ${body}` : ''}`);
    } catch (e) {
      log(`submission failed: ${e.message}`);
    }
  }
}

main().catch((e) => { console.error('[indexnow] error (deploy itself is fine):', e.message); });
