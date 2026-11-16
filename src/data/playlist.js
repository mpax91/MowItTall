// The official mowing playlist. Shown on /blog/lawn-mowing-playlist/ (Playlist component).
// SPOTIFY_URL: paste Mike's playlist link (https://open.spotify.com/playlist/...) to turn on the embed + button.
// `len` is approximate (m:ss), only used for the running total. Spotify's number wins.
export const SPOTIFY_URL = '';

export const SETS = [
  {
    name: 'Pull-start',
    note: 'Warm-up. Gas check. Dew check.',
    songs: [
      { title: 'Start Me Up', artist: 'The Rolling Stones', year: 1981, len: '3:33',
        why: 'Two pulls is normal. Five pulls means it’s time for fresh gas. Last year’s gas is not your friend.' },
      { title: 'Here Comes the Sun', artist: 'The Beatles', year: 1969, len: '3:05',
        why: 'Wait for the dew to burn off. Wet grass clumps, clogs the deck and looks chewed. The sun is your starting gun.' },
      { title: 'Sharp Dressed Man', artist: 'ZZ Top', year: 1983, len: '4:13',
        why: 'Sharp blade, sharp lawn. A dull blade rips the tips and the whole yard turns a sad gray-brown. Sharpen it twice a season.' },
      { title: 'Wake Me Up Before You Go-Go', artist: 'Wham!', year: 1984, len: '3:51',
        why: 'Dedicated to the guy who fires up at 7am on Saturday. Buddy, the rule is 9.', link: '/blog/lawn-mowing-etiquette/' },
    ],
  },
  {
    name: 'Stripes',
    note: 'The real reason you’re out here.',
    songs: [
      { title: 'Straight Lines', artist: 'Silverchair', year: 2007, len: '4:17',
        why: 'The whole sport in two words. Pick a spot across the yard and drive at it. Don’t stare at the mower.' },
      { title: 'Back and Forth', artist: 'Aaliyah', year: 1994, len: '3:50',
        why: 'That’s all stripes are. Grass bent away from you looks light. Grass bent toward you looks dark. Back and forth. You’re welcome.' },
      { title: 'Turn! Turn! Turn!', artist: 'The Byrds', year: 1965, len: '3:50',
        why: 'Every pass ends with a turn. Do it on the sidewalk or on grass you already cut, not by twisting the wheels into the lawn.' },
      { title: 'Paint It, Black', artist: 'The Rolling Stones', year: 1966, len: '3:22',
        why: 'The dark stripe. Mowing toward the house? This is your pass.' },
      { title: 'A Whiter Shade of Pale', artist: 'Procol Harum', year: 1967, len: '4:03',
        why: 'And the light stripe on the way back. Play these two together and you have a matched set.' },
      { title: 'I Know What I Like (In Your Wardrobe)', artist: 'Genesis', year: 1973, len: '4:08',
        why: 'A prog-rock song about a guy who’s perfectly happy mowing lawns while everyone tells him to do more with his life. I have never related to anything more.' },
      { title: 'Lawn Boy', artist: 'Phish', year: 1990, len: '2:30',
        why: 'It has “lawn” in the title. It’s on the list. I make the rules.' },
    ],
  },
  {
    name: 'Mow it tall',
    note: 'The part of the playlist with a message.',
    songs: [
      { title: 'Higher Ground', artist: 'Stevie Wonder', year: 1973, len: '3:42',
        why: 'Raise the deck. Three to four inches. Tall grass shades out weeds and holds water. The Chili Peppers version is also allowed.' },
      { title: 'Stand Tall', artist: 'Burton Cummings', year: 1976, len: '3:30',
        why: 'Grass that stands tall grows deeper roots. The entire website, in one ’70s soft-rock ballad.' },
      { title: 'Tall Cool One', artist: 'Robert Plant', year: 1988, len: '4:40',
        why: 'Cool-season grass, mowed tall. Robert Plant gets it.' },
      { title: 'Low Rider', artist: 'War', year: 1975, len: '3:11',
        why: 'Great song. Terrible mowing height. Crank it, then make sure your deck isn’t on the bottom notch.' },
      { title: 'Green Grass and High Tides', artist: 'The Outlaws', year: 1975, len: '9:42',
        why: 'Almost ten minutes, so it covers the whole backyard. Green grass, kept high. Plus a guitar solo long enough to do the side yard.' },
    ],
  },
  {
    name: 'The grind',
    note: 'Halfway. Hydrate.',
    songs: [
      { title: 'Push It', artist: 'Salt-N-Pepa', year: 1987, len: '4:28',
        why: 'Let go of the self-propel bar. This is a workout now. I have the math.', link: '/blog/mowing-the-lawn-is-a-workout/' },
      { title: 'Walking on Sunshine', artist: 'Katrina and the Waves', year: 1985, len: '3:58',
        why: 'You’re walking about two and a half miles an hour behind a mower. In the sun. That’s cardio. Drink some water.' },
      { title: 'Have You Ever Seen the Rain', artist: 'Creedence Clearwater Revival', year: 1970, len: '2:40',
        why: 'The July question. If the answer is no, water deep once or twice a week, not a little every night. The rain meter will tell you.', link: '/resources/should-i-water-my-lawn/' },
      { title: 'Cruel Summer', artist: 'Bananarama', year: 1983, len: '3:35',
        why: 'August. Cool-season grass hates the heat. Mow tall, mow less often and skip the fertilizer until fall.' },
    ],
  },
  {
    name: 'Neighborhood rules',
    note: 'Etiquette, set to music.',
    songs: [
      { title: 'Saturday in the Park', artist: 'Chicago', year: 1972, len: '3:55',
        why: 'Saturday, 10 to 4. The sweet spot. Nobody on the street can say a word.' },
      { title: 'Sunday Morning', artist: 'The Velvet Underground', year: 1967, len: '2:56',
        why: 'A quiet song for a quiet morning, which is what Sunday mornings are for. Engine on at 10. Not 9:45.' },
      { title: 'Garden Party', artist: 'Rick Nelson', year: 1972, len: '3:45',
        why: 'Your neighbor is having people over. Can you mow? No. Never. Mow tomorrow.' },
      { title: 'Don’t Stand So Close to Me', artist: 'The Police', year: 1980, len: '4:04',
        why: 'When a neighbor walks over to talk, kill the engine. Don’t make them yell. Also don’t stand right behind a running mower.' },
      { title: 'Blowin’ in the Wind', artist: 'Bob Dylan', year: 1963, len: '2:48',
        why: 'The only leaf blower Bedford hasn’t banned.' },
    ],
  },
  {
    name: 'Cool-down',
    note: 'Fall, the best part of the year.',
    songs: [
      { title: 'Big Yellow Taxi', artist: 'Joni Mitchell', year: 1970, len: '2:15',
        why: 'A warning about paving things. Your front yard is not a future parking lot. Keep mowing.' },
      { title: 'Dandelion', artist: 'The Rolling Stones', year: 1967, len: '3:32',
        why: 'Bees love them. I tolerate them. Know your weeds before you go to war.', link: '/weeds/' },
      { title: 'September', artist: 'Earth, Wind & Fire', year: 1978, len: '3:35',
        why: 'The best month of the lawn year. This is when you seed. If you took the quiz, it’s already on your calendar.', link: '/plan/' },
      { title: 'Cool Change', artist: 'Little River Band', year: 1979, len: '5:14',
        why: 'Last song. Cool-season grass, cooling off. Shut it down, hose off the deck, leave the clippings where they fell.' },
    ],
  },
];

const secs = (len) => { const [m, s] = len.split(':').map(Number); return m * 60 + s; };
export const SONG_COUNT = SETS.reduce((n, s) => n + s.songs.length, 0);
export const TOTAL_MIN = Math.round(SETS.reduce((t, s) => t + s.songs.reduce((u, x) => u + secs(x.len), 0), 0) / 60);
export const setMinutes = (set) => Math.round(set.songs.reduce((u, x) => u + secs(x.len), 0) / 60);
export const spotifySearch = (song) =>
  `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
export const spotifyEmbed = (url) => {
  const m = String(url).match(/playlist\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/playlist/${m[1]}?utm_source=generator` : '';
};
