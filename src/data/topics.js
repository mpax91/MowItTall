// Blog topics. Each post lists one or more topic slugs in `topics:` frontmatter.
// Every topic gets a page at /blog/topic/<slug>/ and a chip on the blog page.
export const TOPICS = [
  { slug: 'mowing', name: 'Mowing', blurb: 'Height, stripes, blades, etiquette and the mower itself.' },
  { slug: 'feeding', name: 'Fertilizer', blurb: 'What to feed, when, how much, and how to spread it without stripes.' },
  { slug: 'seeding', name: 'Seed & grass', blurb: 'Which grass, when to seed, and fixing bare spots.' },
  { slug: 'weeds', name: 'Weeds', blurb: 'Kill them, crowd them out, or make peace with them.' },
  { slug: 'soil', name: 'Soil', blurb: 'Soil tests, pH, lime and what is going on under the grass.' },
  { slug: 'dogs-kids', name: 'Dogs, kids & critters', blurb: 'Pee spots, bouncy houses, safety, and the animals that visit.' },
  { slug: 'gear', name: 'Gear', blurb: 'Mowers, spreaders, sprayers and the stuff you don’t need.' },
  { slug: 'fun', name: 'Just for fun', blurb: 'Jokes, playlists, rankings and Bedford nonsense.' },
];
export const topicBySlug = Object.fromEntries(TOPICS.map((t) => [t.slug, t]));
