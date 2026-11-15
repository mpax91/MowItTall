// Builds public/data/zips-ne.json: Northeast ZIP codes -> [lat, lon, city, state].
// Regenerate with: npm i --no-save zipcodes && node scripts/build-zips.cjs  (data: zipcodes package, BSD license)
const fs = require('fs');
const path = require('path');
const zipcodes = require('zipcodes');
const out = {};
for (let n = 1000; n <= 19999; n++) {
  const zip = String(n).padStart(5, '0');
  const z = zipcodes.lookup(zip);
  if (!z || !z.latitude) continue;
  out[zip] = [Math.round(z.latitude * 1000) / 1000, Math.round(z.longitude * 1000) / 1000, z.city, z.state];
}
fs.writeFileSync(path.join(__dirname, '..', 'public', 'data', 'zips-ne.json'), JSON.stringify(out));
console.log(Object.keys(out).length, 'ZIPs');
