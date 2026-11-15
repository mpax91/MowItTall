// "Which grass should I plant?" picker. Used on the grass types post, Lawn 101 and linked from Toolshed.
// Mixes follow UMass / UConn / Kentucky extension guidance for cool-season lawns. Mike reviews all copy.

export const QUESTIONS = [
  {
    id: 'sun',
    q: 'How much direct sun does the spot get?',
    hint: 'Count hours of actual sunshine on the grass, not just daylight.',
    options: [
      { v: 'full', t: '6+ hours', s: 'Full sun. Sunscreen territory.' },
      { v: 'part', t: '4 to 6 hours', s: 'Part sun. Some trees, some sky.' },
      { v: 'mixed', t: 'A mix', s: 'Sunny out front, shady in back.' },
      { v: 'low', t: 'Under 4 hours', s: 'The tree owns this yard.' },
    ],
  },
  {
    id: 'traffic',
    q: 'Who uses this lawn?',
    hint: 'Be honest. The dog counts.',
    options: [
      { v: 'heavy', t: 'Kids, dogs, backyard football', s: 'It gets beat up.' },
      { v: 'normal', t: 'Normal walking around', s: 'A few paths, a few barbecues.' },
      { v: 'light', t: 'Nobody. It’s for looks', s: 'Admired from the window.' },
    ],
  },
  {
    id: 'water',
    q: 'How do you water?',
    hint: 'No judgment. Okay, a little judgment.',
    options: [
      { v: 'auto', t: 'Sprinkler system', s: 'It runs on a timer.' },
      { v: 'hose', t: 'Hose, when it looks brown', s: 'When I remember.' },
      { v: 'never', t: 'I don’t', s: 'Rain or nothing.' },
    ],
  },
  {
    id: 'goal',
    q: 'What matters most?',
    hint: 'Pick the one you’d brag about.',
    options: [
      { v: 'stripes', t: 'Best stripes on the street', s: 'The neighbors should notice.' },
      { v: 'fast', t: 'Green, fast', s: 'Party, house sale, or a spouse asking.' },
      { v: 'easy', t: 'Low effort', s: 'Green enough. Leave me alone.' },
    ],
  },
];

// rate: pounds of seed per 1,000 sq ft for a new lawn [low, high]. Overseeding is about half.
export const RESULTS = {
  'kbg-rye': {
    name: 'Bluegrass and rye',
    tag: 'The Stripe Lord blend',
    mix: 'About 80% Kentucky bluegrass, 20% perennial rye',
    why: [
      'The rye pops up in about a week and holds the soil while the bluegrass takes its sweet time.',
      'Bluegrass spreads underground and fixes its own bare spots. Rye can’t do that.',
      'Both stripe like crazy and handle kids and dogs.',
    ],
    heads: 'Bluegrass takes 2 to 4 weeks to sprout. You will think you wasted your money. You didn’t. Keep watering.',
    rate: [3, 4],
  },
  rye: {
    name: 'Perennial rye',
    tag: 'Mike’s pick',
    mix: 'Mostly turf-type perennial rye. Get a blend of 2 or 3 varieties.',
    why: [
      'Sprouts in 5 to 10 days. Nothing is faster.',
      'Dark, shiny blades. The shine is what makes stripes pop.',
      'Tough enough for sports fields, so it can handle your kids.',
    ],
    heads: 'It doesn’t spread. Bare spots stay bare until you reseed, so overseed thin areas every fall. Water in the morning, not at night.',
    rate: [3, 5],
  },
  tttf: {
    name: 'Turf-type tall fescue',
    tag: 'The “I never water” pick',
    mix: 'About 90% turf-type tall fescue, 10% Kentucky bluegrass',
    why: [
      'Deepest roots of the bunch. It stays green the longest when nobody waters.',
      'Handles traffic and some shade.',
      'Needs less fertilizer than bluegrass or rye.',
    ],
    heads: 'Blades are a little wider and tougher. It grows in clumps, so overseed thin spots in fall, and don’t mix it with rye or fine fescue or it looks patchy.',
    rate: [6, 8],
  },
  sunshade: {
    name: 'Sun and shade mix',
    tag: 'Let them fight it out',
    mix: 'About 40% Kentucky bluegrass, 40% fine fescue, 20% perennial rye',
    why: [
      'Each grass wins its own turf: bluegrass in the sun, fine fescue in the shade.',
      'The rye fills in fast while the others get going.',
      'One bag for the whole yard.',
    ],
    heads: 'In a few years each part of the yard sorts itself out. That’s the point. Don’t overfeed the shady parts.',
    rate: [4, 5],
  },
  shade: {
    name: 'Fine fescue shade mix',
    tag: 'The introvert',
    mix: 'About 85% fine fescues (creeping red, chewings, hard), 15% perennial rye',
    why: [
      'The best grass for dry shade under trees.',
      'Needs very little water or fertilizer.',
      'Thin, soft blades. Mow it tall, 3 to 4 inches.',
    ],
    heads: 'It hates heavy traffic and too much fertilizer. If kids and dogs run on it every day, it won’t last.',
    rate: [4, 6],
  },
  deep: {
    name: 'Honestly? Not grass.',
    tag: 'The tree is winning',
    mix: 'Under 4 hours of direct sun is too little for any lawn grass.',
    why: [
      'Try fine fescue at the sunny edges.',
      'Mulch or a shade groundcover where it’s darkest.',
      'Or trim some low branches and let the light in.',
    ],
    heads: 'You’re not bad at lawns. You’re fighting a tree. And the tree is winning.',
    rate: null,
  },
};

export function pick({ sun, traffic, water, goal }) {
  if (sun === 'low') return 'deep';
  if (sun === 'mixed') return water === 'never' ? 'tttf' : 'sunshade';
  if (sun === 'part') {
    if (water === 'never' || traffic === 'heavy') return 'tttf';
    return traffic === 'light' && goal === 'easy' ? 'shade' : 'sunshade';
  }
  // full sun
  if (water === 'never' || goal === 'easy') return 'tttf';
  if (goal === 'fast') return 'rye';
  if (goal === 'stripes') return water === 'auto' ? 'rye' : 'kbg-rye';
  return 'kbg-rye';
}
