// Runs after `astro build`: writes dist/indexnow/manifest.json, the list of public URLs + content fingerprints.
// deploy.mjs compares the live copy (previous deploy) with this one to find new, changed and deleted pages.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { HOST, MANIFEST_PATH, buildUrlMap } from './indexnow-lib.mjs';

let build = process.env.WORKERS_CI_COMMIT_SHA;
if (!build) { try { build = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {} }
build = `${build || 'local'}-${Date.now()}`;

const urls = buildUrlMap('dist');
const out = join('dist', MANIFEST_PATH);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ host: HOST, build, generated: new Date().toISOString(), urls }, null, 1));
console.log(`[indexnow] manifest: ${Object.keys(urls).length} public URLs (build ${build})`);
