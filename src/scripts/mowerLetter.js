// "Letter to your spouse" generator for the mower post. All copy is Mike's voice; Mike reviews.
export const MOWERS = {
  self: { name: 'a self-propelled mower', short: 'self-propelled', width: 1.75, mph: 3.0, price: '$500 to $900' },
  battery: { name: 'a battery mower', short: 'battery mower', width: 1.75, mph: 3.0, price: '$500 to $1,000' },
  rider: { name: 'a riding mower', short: 'riding mower', width: 3.5, mph: 4.5, price: '$2,000 to $4,000' },
  zero: { name: 'a zero-turn', short: 'zero-turn', width: 4.0, mph: 6.5, price: '$3,500 to $7,000' },
  robot: { name: 'a robot mower', short: 'robot', width: 0, mph: 0, price: '$1,000 to $3,000' },
};
const PUSH = { width: 1.75, mph: 2.5 };

// Minutes per mow: path length (sq ft / cut width, ×1.15 for overlap and turns) at walking/driving speed.
export function minutes(sqft, m) {
  if (!m.width) return 0;
  return ((sqft / m.width) * 1.15) / (m.mph * 5280 / 60);
}

const pick = (arr, seed) => arr[seed % arr.length];

export function letter({ want, sqft, reason, spouse, me, tone }, seed = 0) {
  const m = MOWERS[want];
  const to = spouse.trim() || 'Honey';
  const from = me.trim() || 'Your loving lawn person';
  const acres = sqft / 43560;
  const acreTxt = acres >= 0.95 ? `${acres.toFixed(1).replace('.0', '')} acre${acres >= 1.05 ? 's' : ''}` : acres >= 0.2 ? `${acres < 0.4 ? 'a quarter' : acres < 0.7 ? 'half an' : 'three quarters of an'} acre` : 'our yard';
  const now = minutes(sqft, PUSH);
  const later = minutes(sqft, m);
  const savedPerMow = Math.max(0, now - later);
  const savedSeason = (savedPerMow * 26) / 60; // 26 mows, May–Oct
  const r = (n) => Math.round(n);

  const open = {
    sweet: pick([`Dear ${to},`, `My dearest ${to},`, `${to}, light of my life and co-owner of our lawn,`], seed),
    lawyer: pick([`RE: Capital Equipment Request (Lawn Division)\n\nDear ${to},`, `TO: ${to}\nFROM: ${from}\nRE: The mower\n\nDear ${to},`], seed),
    desperate: pick([`${to}. Please. Just read this whole thing.`, `${to}, I need you to sit down for this.`], seed),
  }[tone];

  const intro = {
    sweet: `You know I love you. You know I love the lawn. Today I’m asking you to help me love the lawn a little more efficiently.`,
    lawyer: `I am writing to formally request approval for the purchase of ${m.name}. Please find my arguments below. I have prepared exhibits.`,
    desperate: `The old mower and I have been through a lot. But it’s over. I’m asking for ${m.name}, and I am not too proud to beg.`,
  }[tone];

  const pitch = {
    self: `It’s ${m.name}. It pushes itself. I just walk behind it and steer, like a dignified person walking a very loud dog.`,
    battery: `It’s ${m.name}. No gas cans in the garage. No pull cord. No 7am engine roar for the neighbors. It starts with a button, like a microwave.`,
    rider: `It’s ${m.name}. I sit. It mows. There is a cupholder. I want you to know I already know about the cupholder, and it is not the reason. It is a reason.`,
    zero: `It’s ${m.name}. It spins in place. It mows like a race car. I would look incredible on it, and you know that.`,
    robot: `It’s ${m.name}. It mows the lawn by itself, a little every day, while I do things like spend time with you. Or nap. Mostly you.`,
  }[want];

  let numbers;
  if (want === 'robot') {
    numbers = `Right now mowing ${acreTxt} takes me about ${r(now)} minutes a week. Over a season that’s ${r((now * 26) / 60)} hours. With a robot it’s zero. Zero hours. I could learn an instrument. I won’t, but I could.`;
  } else if (savedPerMow >= 5) {
    numbers = `Right now mowing ${acreTxt} takes me about ${r(now)} minutes. With ${m.name}, about ${r(later)}. That’s ${r(savedSeason)} hours back every season. I did the math. It’s on this website.`;
  } else {
    numbers = `It won’t save much time on ${acreTxt}. I’m not going to lie to you. That’s how you know the rest of this letter is true.`;
  }

  const why = {
    time: `This is about time. Time with you. Time with the family. Time I currently spend walking in straight lines in the sun while you watch from the window.`,
    back: `This is about my back. My back has filed a formal complaint. My knees have co-signed it. ${want === 'self' || want === 'battery' ? 'I will still be walking, which is good for me, but the mower will do the pushing.' : 'Walking behind a mower is great exercise, and I will find other exercise. Probably.'}`,
    kids: `This is about the kids. Every hour I spend mowing is an hour I’m not at a soccer game. ${want === 'robot' ? 'The robot doesn’t have kids. It doesn’t mind.' : 'I want to be at the soccer game. Mostly.'}`,
    stripes: `This is about the stripes. People slow down when they drive past our house. I want them to keep slowing down. It’s about family pride.`,
    neighbor: `This is, I’ll be honest, a little bit about Dave next door. He got one. I see him on it. He waves. I can’t keep living like this.`,
  }[reason];

  const flag =
    want === 'zero' && acres < 0.5 ? `I know a zero-turn on ${acreTxt} is a lot of machine. It’s about the principle.` :
    want === 'rider' && acres < 0.3 ? `I know ${acreTxt} isn’t technically “riding mower” size. Neither was my first apartment, and we made that work.` :
    want === 'robot' ? `The robot can’t make stripes. I will still mow the front myself on Saturdays for the neighbors. I am not a monster.` :
    want === 'battery' ? `Yes, the batteries cost extra. So did your Peloton.` :
    `I promise to clean it after every mow and keep it in the garage where you can’t see it.`;

  const close = {
    sweet: `It would mean the world to me. Or at least the yard.\n\nForever yours (and the lawn’s),\n${from}`,
    lawyer: `Estimated cost: ${m.price}. Estimated return: a happier spouse and the best lawn on the street. I rest my case.\n\nRespectfully submitted,\n${from}`,
    desperate: `Please. I’ll do the dishes for a month. I’ll stop talking about soil temperature at dinner. I’ll watch your show.\n\nYours, desperately,\n${from}`,
  }[tone];

  return `${open}\n\n${intro}\n\n${pitch}\n\n${why}\n\n${numbers}\n\n${close}\n\nP.S. ${flag}`;
}
