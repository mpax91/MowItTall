// "The damage report" for the dog pee / kids / bouncy house post. Mike reviews all copy.
export const SPOT_GROUPS = [
  { id: 'dogs', name: 'The dogs' },
  { id: 'kids', name: 'The kids (and the adults)' },
];
export const SPOTS = [
  {
    id: 'pee', group: 'dogs', label: 'Pee spot', word: 'FIXABLE', tone: 'close',
    title: 'Brown circle with a dark green ring',
    lede: 'Classic. The middle got way too much nitrogen and salt and burned. The edge got just enough and turned into the greenest grass you own.',
    sections: [
      { h: 'Do this', ordered: true, list: [
        '<b>Hose it.</b> Soak the spot right after, or as soon as you notice. Watering it down is the single best fix.',
        '<b>Wait a week.</b> If it greens back up, it was just stunned. If it stays straw-brown and pulls out easy, it’s dead.',
        '<b>Scratch it out.</b> Rake the dead grass off so you can see dirt.',
        '<b>Seed it.</b> Toss a pinch of seed, rake it in, keep it damp for two weeks. Perennial rye pops in about a week. Fall is best. Spring works.',
      ] },
      { h: 'Skip', list: ['Fertilizing the spot. It already got plenty.'] },
    ],
  },
  {
    id: 'poop', group: 'dogs', label: 'Poop', word: 'PICK IT UP', tone: 'no',
    title: 'It is not fertilizer. Stop telling yourself that.',
    lede: 'Dog poop takes weeks to months to break down. Meanwhile it smothers and burns the grass under it and carries worms and bacteria for whoever walks through next. Usually you.',
    sections: [
      { h: 'Do this', list: ['Bag it the same day. Every time.', 'If it sat for a while, hose the spot and treat it like a pee spot.', 'Do a full sweep before you mow. Mowing over one is a mistake you make once.'] },
    ],
  },
  {
    id: 'neighbor', group: 'dogs', label: 'The neighbor’s dog', word: 'TALK, DON’T WAR', tone: 'close',
    title: 'Same pee. Worse feelings.',
    lede: 'Your dog’s pee spot is a fun little project. The neighbor’s dog’s pee spot is an act of war. It’s the same spot.',
    sections: [
      { h: 'Do this', list: [
        'Say something friendly, once. “Hey, mind steering Buddy to the strip by the road?” Most people just don’t think about it.',
        'Hose the spot when you see it happen. Petty? Yes. Effective? Also yes.',
        'Patch the curb strip every fall. That strip is the town fire hydrant. Accept it.',
        'Never put anything out that could hurt a dog. The dog didn’t make the decision.',
      ] },
    ],
  },
  {
    id: 'bounce', group: 'kids', label: 'Bouncy house', word: 'TOTALLY WORTH IT', tone: 'yes',
    title: 'Rent the bouncy house.',
    lede: 'One day under a bouncy house barely bothers grass. It’s the second and third day, in the sun, that cooks it.',
    sections: [
      { h: 'Do this', ordered: true, list: [
        'Set it up the morning of. Take it down that night.',
        'Step the stake holes closed when you pull them.',
        'Yellow square after? Water it and wait one to two weeks. It almost always comes back.',
        'Left it up all weekend in July? Brown square. Seed it in September and tell the story at Thanksgiving.',
      ] },
    ],
  },
  {
    id: 'pool', group: 'kids', label: 'Kiddie pool / Slip ’N Slide', word: 'MOVE IT DAILY', tone: 'yes',
    title: 'Grass under plastic cooks fast.',
    lede: 'A pool or a slide sitting in the sun turns the grass under it yellow in a day or two. Just move it.',
    sections: [
      { h: 'Do this', list: [
        'Move it to a new spot every day.',
        'Dump the water across the lawn, not in one place. One spot becomes a swamp.',
        'Yellow patch? Water and wait. It usually bounces back in a week or two.',
      ] },
    ],
  },
  {
    id: 'party', group: 'kids', label: 'Party / tent', word: 'HAVE THE PARTY', tone: 'yes',
    title: 'Feet are fine. Cars are not.',
    lede: 'Grass handles a backyard full of people. It’s built for it. What hurts is traffic on soaking wet or frozen grass, and anything with wheels.',
    sections: [
      { h: 'Do this', list: [
        'Mow a day or two before so it looks sharp and has time to recover.',
        'A tent for a day or two? Fine. Same rules as the bouncy house.',
        'Nobody parks on the lawn. Ruts last for months.',
        'After: pick up the trash, water it, rake out any matted spots.',
      ] },
    ],
  },
  {
    id: 'goal', group: 'kids', label: 'Soccer goal / play area', word: 'THAT’S WHAT IT’S FOR', tone: 'yes',
    title: 'A worn goal mouth is a trophy.',
    lede: 'That bare spot in front of the net means somebody had a childhood. Good.',
    sections: [
      { h: 'Do this', list: [
        'Slide the goal a few feet every couple of weeks to spread the wear.',
        'Seed the bare spots every September. Tall fescue and Kentucky bluegrass take a beating best.',
        'Fight the urge to yell “not on the lawn.” Seriously.',
      ] },
    ],
  },
  {
    id: 'tramp', group: 'kids', label: 'Trampoline / swing set', word: 'ACCEPT THE CIRCLE', tone: 'close',
    title: 'Grass loses this one.',
    lede: 'Shade from a trampoline and feet under a swing will beat grass every time.',
    sections: [
      { h: 'Do this', list: [
        'Move the trampoline every week or two in summer, or make peace with a circle.',
        'Under swings, put down mulch or rubber mats. Grass will never win there.',
        'Reseed the old spot when the trampoline moves for good.',
      ] },
    ],
  },
  {
    id: 'frost', group: 'kids', label: 'Walking on frost', word: 'GIVE IT AN HOUR', tone: 'no',
    title: 'The one time to stay off.',
    lede: 'Frozen grass blades snap when you step on them. A day later you’ll have perfect brown footprints from your car to the mailbox. Wait for the frost to melt.',
  },
];
