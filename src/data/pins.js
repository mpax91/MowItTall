// Pinterest pins. Every blog post and guide gets a tall 1000x1500 pin image at /pin/<slug>.jpg, drawn at
// build time by src/pages/pin/[slug].jpg.js (same satori -> sharp setup as the share cards in og.js).
// New posts and guides are picked up automatically. Optional frontmatter overrides:
//   pinTitle: big headline on the pin (default: seoTitle for posts, title for guides). Keep it under ~60
//             characters and searchable: Pinterest is a search engine, so say what it is.
//   pinLine:  the yellow line under it, in Mike's voice (default: the post title, or the guide's short answer).
//   pinPhoto: which of Mike's photos to use: front-yard-may | backyard-stripes | spiral-pattern | frosty-stripes-november
//   pinTool:  the "Free tool inside" name (default: from PIN_TOOLS by widget).
// Base.astro adds a hidden pin image (data-pin-media) so Pinterest's Save button grabs the tall pin,
// and the "Share This" box (ShareBox.astro) on posts/guides pins it via Pinterest's pin builder. HQ → Social → Pinterest has the copy.
import { ogSlug } from './og.js';
import { SOCIAL } from './social.js';

export const PIN_W = 1000;
export const PIN_H = 1500;
// Bump when the pin design changes, so Pinterest and browsers fetch the new image.
export const PIN_V = 1;

// Mike's own photos only (no stock or licensed weed photos on pins: those need credits Pinterest drops).
// The spiral shot is left out by default: it's a dark night photo and gets blurry when cropped tall.
export const PIN_PHOTOS = ['front-yard-may', 'backyard-stripes', 'frosty-stripes-november', 'spiral-pattern'];

// What each post widget is called on the pin ("Free tool inside: …"). Add one when a new widget ships.
export const PIN_TOOLS = {
  'soil-translator': 'Soil Test Translator', 'bag-decoder': 'Fertilizer Bag Decoder', 'grass-picker': 'Grass Seed Picker',
  'feed-schedule': 'Holiday Feeding Calendar', 'mow-check': 'Can I Mow Right Now? Checker', 'mow-workout': 'Mowing Calorie Calculator',
  playlist: 'The 2-Hour Mowing Playlist', 'dad-jokes': 'The Groan Meter', 'seed-watch': 'Day-by-Day Seed Tracker',
  'hire-it': 'Hire It or DIY? Picker', pitch: 'Objection Handler', 'weed-playbook': 'Kid and Pet Safe Weed Plan',
  critters: 'Who Dug Up My Lawn? Cards', 'spot-fixer': 'Lawn Damage Fixer', spreader: 'Spreader Setting Helper',
  'gran-spray': 'Granules or Spray Picker', 'gift-finder': 'Lawn Gift Finder', resolutions: 'Resolution Checklist',
  'opening-day': 'First Mow Checklist', robot: 'Robot Mower Confessions', trees: 'Leaf Drop Verdicts',
  'stripe-picker': 'Stripe Pattern Picker', 'crew-split': 'Landscaper Bill Calculator', 'crew-text': 'Text-Your-Landscaper Builder',
  'crew-grade': 'Landscaper Report Card', 'program-decoder': 'Lawn Program Decoder', bracket: 'The Weed Bracket',
  'mower-letter': 'Mower Matchmaker', 'do-i-need': 'Do I Need This? Verdicts', 'seed-waits': 'Weed Killer Wait Times',
  'pre-post': 'Pre or Post? Picker', 'third-rule': '1/3 Rule Calculator', 'mulch-bag': 'Mulch or Bag Today?',
  party: 'Party Countdown Plan', tuneup: 'DIY Tune-Up Checklist', 'blade-check': 'Blade Sharpness Check',
  compliments: 'Compliment Comebacks', training: 'Off-Season Drills',
};

// Pinterest boards to file pins under (HQ shows the suggestion). Order = priority when a post has several topics.
export const PIN_BOARDS = {
  mowing: 'Mowing Tips & Lawn Stripes', feeding: 'Lawn Fertilizer Made Easy', seeding: 'Grass Seed & Overseeding',
  weeds: 'Lawn Weeds: ID & Easy Fixes', soil: 'Lawn Soil & pH', gear: 'Lawn Mowers & Gear',
  'got-a-guy': 'Working With Your Landscaper', 'dogs-kids': 'Lawns for Dogs & Kids', fun: 'Lawn Care Humor',
};
export const PIN_BOARD_DEFAULT = 'Lawn Care for Beginners';

const BY_SLUG = {
  'backyard-stripes': ['lawn-stripe-patterns', 'how-to-stripe-your-lawn', 'lawn-mowing-playlist', 'lawn-care-dad-jokes', 'lawn-compliments', 'halloween-is-the-lawn-super-bowl', 'robot-mower-judging-you', 'mowing-the-lawn-is-a-workout'],
  'frosty-stripes-november': ['lawn-off-season-training', 'lawn-new-years-resolutions', 'lawn-gift-guide', 'snow-mold-and-vole-damage', 'when-to-stop-mowing', 'should-i-mulch-leaves-into-lawn', 'mulch-rake-or-blow-leaves', 'worst-trees-for-fall-leaves'],
};
const BY_TOPIC = { feeding: 'front-yard-may', seeding: 'front-yard-may', soil: 'front-yard-may', 'got-a-guy': 'front-yard-may', fun: 'backyard-stripes', mowing: 'backyard-stripes', gear: 'backyard-stripes', weeds: 'backyard-stripes', 'dogs-kids': 'backyard-stripes' };

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const firstSentence = (s) => (strip(s).match(/^.+?[.!?](?=\s|$)/) || [strip(s)])[0];
const bold = (s) => { const m = String(s || '').match(/<b>(.+?)<\/b>/); return m ? strip(m[1]).replace(/[,;:.]$/, '') + '.' : ''; };
// Shorten a sentence at a natural break (; : —) if it's too long for the pin.
const shorten = (l, max) => { l = strip(l); if (l.length <= max) return l; const m = l.slice(0, max).match(/^(.{25,}?)(;|:| —| \(|, which)/); return m ? m[1].replace(/[,]$/, '') + '.' : ''; };
// Share of the headline's words that the line repeats (the yellow line should add something new).
const words = (s) => new Set(strip(s).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; B.forEach((w) => A.has(w) && n++); return B.size ? n / B.size : 1; };
const TAG_LABEL = { Bedford: 'Lawn Tips' };
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,;:]+\S*$/, '') + '…');

function pickPhoto(slug, fm) {
  if (PIN_PHOTOS.includes(fm.pinPhoto)) return fm.pinPhoto;
  for (const [photo, list] of Object.entries(BY_SLUG)) if (list.includes(slug)) return photo;
  for (const t of fm.topics || []) if (BY_TOPIC[t]) return BY_TOPIC[t];
  return PIN_PHOTOS[hash(slug) % 3];
}

function board(fm, kind) {
  if (kind === 'guide') return PIN_BOARD_DEFAULT;
  const t = (fm.topics || []).find((x) => PIN_BOARDS[x]);
  return t ? PIN_BOARDS[t] : PIN_BOARD_DEFAULT;
}

function buildPin(kind, slug, fm) {
  const path = `/${kind === 'guide' ? 'guides' : 'blog'}/${slug}/`;
  const title = strip(fm.pinTitle || (kind === 'guide' ? fm.title : fm.seoTitle || fm.title));
  // The yellow line: Mike's voice. Posts try the post title, then the social hook, then the social take's first sentence.
  const soc = SOCIAL[slug] || {};
  const lines = fm.pinLine ? [fm.pinLine] : kind === 'guide' ? [firstSentence(fm.answer), bold(fm.answer), fm.description]
    : [fm.title, soc.hook, firstSentence(soc.take), fm.description];
  const first3 = (l) => [...words(l)].slice(0, 3);
  const repeats = (l) => overlap(title, l) >= 0.6 || (overlap(title, l) >= 0.35 && first3(l).every((w) => words(title).has(w)));
  const max = title.length > 56 ? 80 : 110;
  const line = lines.filter(Boolean).map((l) => shorten(l, max)).find((l) => l && !repeats(l)) || '';
  const tool = fm.pinTool || (fm.widget && PIN_TOOLS[fm.widget]) || (fm.widget ? 'Free Interactive Tool' : '');
  // Pinterest copy: title ≤100 characters, description ≤500 (keyword-rich, plain sentences, no hashtag spam).
  const pinterestTitle = clip(title, 100);
  const desc = strip(fm.seoDescription || fm.description);
  const extra = tool ? ` Includes a free ${tool.replace(/^The /, '')}.` : kind === 'guide' ? ' Short answer first, then the details.' : '';
  const description = clip(`${desc}${extra} Easy lawn care for beginners from Mike at Mow It Tall (Northeast lawns).`, 500);
  return {
    path, slug: ogSlug(path), kind, title, line, tool, photo: pickPhoto(slug, fm),
    variant: hash(slug + 'v'), label: kind === 'guide' ? 'Lawn Guide' : TAG_LABEL[fm.tag] || fm.tag || 'Lawn Tips',
    pinterestTitle, description, board: board(fm, kind), alt: `${title}. Pin from Mow It Tall`,
  };
}

const slugOf = (k) => k.split('/').pop().replace(/\.md$/, '');

// { '/blog/lawn-soil-test/': pin, ... } for every post and guide.
export function allPins() {
  const posts = import.meta.glob('../pages/blog/[a-z]*.md', { eager: true, import: 'frontmatter' });
  const guides = import.meta.glob('../pages/guides/[a-z]*.md', { eager: true, import: 'frontmatter' });
  const out = {};
  for (const [k, fm] of Object.entries(posts)) { const p = buildPin('post', slugOf(k), fm); out[p.path] = p; }
  for (const [k, fm] of Object.entries(guides)) { const p = buildPin('guide', slugOf(k), fm); out[p.path] = p; }
  return out;
}

export const pinUrl = (pin) => `/pin/${pin.slug}.jpg?v=${PIN_V}`;
