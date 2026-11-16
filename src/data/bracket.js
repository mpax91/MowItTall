// The Lawn Weed Bracket (blog post widget). 16 weeds from the weed board, 4 regions, seeds 1–4.
// Votes go to the worker (/api/bracket), one vote per matchup per phone, same D1 database as the Hall.
// Ids match src/data/weeds.js and the thumbnails at /img/weeds/<id>-thumb.webp. The worker keeps its own
// copy of the id list (BRACKET_IDS in worker/index.js): change both together. Copy: Claude, Mike reviews.
export const BRACKET_ID = 'weeds';

export const REGIONS = [
  { id: 'flower', name: 'The Flower Region' },
  { id: 'sneaky', name: 'The Sneaky Grass Region' },
  { id: 'ground', name: 'The Ground Crew Region' },
  { id: 'wild', name: 'The Wild Card Region' },
];

// Listed in bracket order: each region is [1 seed, 4 seed, 2 seed, 3 seed] so pairs line up as 1v4, 2v3.
export const ENTRANTS = [
  { id: 'dandelion', name: 'Dandelion', seed: 1, region: 'flower', line: 'Blows its seeds into your yard from three houses away. Smiling the whole time.' },
  { id: 'violet', name: 'Wild violet', seed: 4, region: 'flower', line: 'Looks innocent. Shrugs off weed killer like it’s a light mist.' },
  { id: 'creeping-charlie', name: 'Creeping Charlie', seed: 2, region: 'flower', line: 'Roots every few inches. Pull one, and it’s already in the next zip code.' },
  { id: 'clover', name: 'White clover', seed: 3, region: 'flower', line: 'Great PR team. Bees, luck, Instagram. Still a weed in your stripes.' },

  { id: 'crabgrass', name: 'Crabgrass', seed: 1, region: 'sneaky', line: 'Shows up in July like it owns the place. Dies in fall. Leaves the seeds as a tip.' },
  { id: 'annual-bluegrass', name: 'Annual bluegrass', seed: 4, region: 'sneaky', line: 'Flowers at a quarter inch. Dies the first hot week. Wildly dramatic.' },
  { id: 'nutsedge', name: 'Yellow nutsedge', seed: 2, region: 'sneaky', line: 'Grows twice as fast as your grass the day after you mow, just to make a point.' },
  { id: 'rough-bluegrass', name: 'Rough bluegrass', seed: 3, region: 'sneaky', line: 'Hides in cheap seed bags. Turns into lime-green patches. No spray kills it.' },

  { id: 'plantain', name: 'Broadleaf plantain', seed: 1, region: 'ground', line: 'Lies flat so the mower goes right over it. Smart. Too smart.' },
  { id: 'deadnettle', name: 'Purple deadnettle & henbit', seed: 4, region: 'ground', line: 'Turns your lawn purple every April. Gone by June. Pure chaos agent.' },
  { id: 'oxalis', name: 'Yellow wood sorrel (oxalis)', seed: 2, region: 'ground', line: 'Looks like clover, shoots seeds like a tiny cannon. Gets in everywhere.' },
  { id: 'chickweed', name: 'Chickweed', seed: 3, region: 'ground', line: 'Grows in the cold when nothing else does. Basically a winter sport.' },

  { id: 'stiltgrass', name: 'Japanese stiltgrass', seed: 1, region: 'wild', line: 'Invasive, fast and coming out of the woods line straight for your shady corner.' },
  { id: 'cannabis', name: 'Weed (the other kind)', seed: 4, region: 'wild', line: 'Here on a technicality. Came in through the bird feeder. Nothing survives the stripes.' },
  { id: 'nimblewill', name: 'Nimblewill', seed: 2, region: 'wild', line: 'Wiry, gray-green, and wakes up late in spring so you think it’s dead. It isn’t.' },
  { id: 'moss', name: 'Moss', seed: 3, region: 'wild', line: 'Doesn’t kill your grass. Just waits for it to give up. Very patient villain.' },
];

export const ROUNDS = [
  { id: 'r1', name: 'Round of 16', short: 'Round 1', games: 8 },
  { id: 'r2', name: 'Quarterfinals', short: 'Quarters', games: 4 },
  { id: 'r3', name: 'Semifinals', short: 'Semis', games: 2 },
  { id: 'r4', name: 'Championship', short: 'Final', games: 1 },
];
