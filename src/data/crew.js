// "Got a Guy" content: for people with a landscaper or a lawn service. Used by CrewSplit (pay a guy or DIY),
// CrewText (what to text your landscaper), CrewGrade (grade your landscaper), the lawn-program decoder
// (ChipPicker) and the quiz plan's "Tell your guy" lines. All copy written by Claude in Mike's voice. Mike reviews.

// ---------------------------------------------------------------- Pay a guy or DIY? (ranked)
// Ranked from "pay someone, no shame" (1) to "never pay for this" (last).
// hire / diy = rough yearly cost range in dollars for a quarter-acre lot in Westchester (from the cost guide;
// spring cleanup, aeration, grubs and hedges are Claude's ballpark: Mike to sanity-check). hrs = DIY hours a year.
// fixed: true = not up for debate, no toggle.
export const SPLIT = [
  { id: 'trees', name: 'Tree work', word: 'PAY A PRO', tone: 'no', fixed: true,
    line: 'Chainsaws, ladders and gravity. Not a hobby. Hire a licensed, insured arborist and sleep at night.' },
  { id: 'mow', name: 'Weekly mowing', word: 'PAY IF YOU WANT', tone: 'close', hire: [1300, 1900], diy: [40, 75], hrs: 17, def: 'guy',
    line: 'You’re buying your Saturday back. Fair trade. Just make them mow tall.' },
  { id: 'leaves', name: 'Fall leaf cleanup', word: 'PAY IF YOU’RE BURIED', tone: 'close', hire: [300, 800], diy: [0, 0], hrs: 4, def: 'guy',
    line: 'Live in a forest? Pay. Normal yard? Mow over them. Free fertilizer.' },
  { id: 'spring', name: 'Spring cleanup', word: 'EITHER WAY', tone: 'close', hire: [250, 500], diy: [0, 20], hrs: 4, def: 'guy',
    line: 'Sticks, beds, a light rake. Fine to hire. Just no power raking a waking lawn.' },
  { id: 'hedges', name: 'Hedges and shrubs', word: 'EITHER WAY', tone: 'close', hire: [150, 400], diy: [0, 40], hrs: 4, def: 'guy',
    line: 'Short hedges are a fun Saturday. Ten-foot ones need a ladder. You know which you have.' },
  { id: 'aerate', name: 'Aeration + overseeding', word: 'RENT WITH A NEIGHBOR', tone: 'close', hire: [250, 450], diy: [100, 180], hrs: 4, def: 'guy',
    line: 'Heavy machine, one afternoon. Hiring is fine. Splitting a rental is cheaper. Either way, buy the seed yourself.' },
  { id: 'grubs', name: 'Grub control', word: 'CHECK FIRST', tone: 'yes', hire: [100, 200], diy: [0, 50], hrs: 1, def: 'guy',
    line: 'Most lawns don’t have a grub problem most years. Peel back a square foot in August and count before anyone sells you anything.' },
  { id: 'program', name: 'Fertilizer + weed program', word: 'DO IT YOURSELF', tone: 'yes', hire: [400, 900], diy: [150, 250], hrs: 3, def: 'guy',
    line: 'The best deal in lawn care: three holidays, a spreader, 15 minutes each. Cheaper and timed to your lawn, not the truck’s route.' },
];
export const SPLIT_SIZES = [
  { id: 'small', name: 'Small', note: 'Under ¼ acre', k: 0.7 },
  { id: 'quarter', name: '¼ acre', note: 'Typical', k: 1 },
  { id: 'half', name: '½ acre+', note: 'Big yard', k: 1.8 },
];

// ---------------------------------------------------------------- What to text your landscaper
// Each ask: chip label + the sentence it adds. group: mow | season | program.
export const ASKS = [
  { id: 'tall', group: 'mow', label: 'Mow higher', say: 'Could you raise the deck to 3.5 inches, or the highest notch? Taller grass shades out weeds and stays green longer in summer.' },
  { id: 'clippings', group: 'mow', label: 'Leave the clippings', say: 'Please leave the clippings on the lawn instead of bagging them. Free fertilizer.' },
  { id: 'blades', group: 'mow', label: 'Sharpen the blades', say: 'The grass tips look a little torn after a mow. Any chance the blades are due for a sharpening?' },
  { id: 'direction', group: 'mow', label: 'Switch directions', say: 'Could you switch up the mowing direction each week? It’s starting to leave tracks in the same spots.' },
  { id: 'wet', group: 'mow', label: 'Skip it when it’s wet', say: 'If the lawn is soaking wet, I’m totally fine pushing the mow a day.' },
  { id: 'drought', group: 'mow', label: 'Skip it in a drought', say: 'When it’s hot and dry and the grass isn’t really growing, feel free to skip a week.' },
  { id: 'street', group: 'mow', label: 'Clippings out of the street', say: 'When you blow off the driveway, could you blow the clippings back onto the lawn instead of into the street?' },
  { id: 'leaves', group: 'season', label: 'Mulch the leaves', say: 'For leaves on the lawn, I’d love for you to mow them up into the grass instead of hauling them away.' },
  { id: 'spring', group: 'season', label: 'Easy on the spring rake', say: 'For the spring cleanup, please skip power raking or dethatching the lawn. A light cleanup is perfect.' },
  { id: 'lastmow', group: 'season', label: 'Last mow a bit lower', say: 'For the last mow of the year, could you drop it a notch to about 3 inches?' },
  { id: 'seedtime', group: 'season', label: 'Seed in September', say: 'If we overseed this year, can we do it between late August and mid-September? That’s when it takes best.' },
  { id: 'diyfeed', group: 'program', label: 'I’ll handle fertilizer', say: 'I’m going to start doing the fertilizer and weed control myself, so you can drop those from my visits.' },
  { id: 'spot', group: 'program', label: 'Spot-spray only', say: 'For weeds, could you spot-spray just the weeds instead of spraying the whole lawn?' },
  { id: 'notice', group: 'program', label: 'Text me before you spray', say: 'Could you text me the day before you put anything down? I want to keep the kids and dog off it until it dries.' },
  { id: 'what', group: 'program', label: 'What are you putting down?', say: 'Could you send me what product and how much went down at each visit? I’m keeping a little lawn log. (Yes, really.)' },
];
export const ASK_GROUPS = [
  { id: 'mow', name: 'Mowing' },
  { id: 'season', name: 'Spring and fall' },
  { id: 'program', name: 'Fertilizer and spraying' },
];
export const TONES = [
  { id: 'nice', name: 'Friendly', open: 'Hi{name}! A couple of quick lawn requests when you get a chance:', close: 'Thanks so much. The place always looks great.' },
  { id: 'extra', name: 'Extra nice', open: 'Hi{name}! First, thank you. You guys work hard and it shows. A few small requests, only if they’re easy:', close: 'Seriously, thank you. Let me know if any of this is a pain and we’ll figure it out.' },
  { id: 'dad', name: 'Lawn dad', open: 'Hey{name}! Don’t hate me. I’ve been reading about lawns again. A few requests:', close: 'Thank you! Coffee’s on me next visit. My wife says I need to stop reading lawn blogs.' },
];

// ---------------------------------------------------------------- Grade your landscaper
// Each question: 3 answers scored 2 / 1 / 0. ask = the CrewText ask to pre-fill when it's not a 2. fix = one-line fix.
export const GRADE_QS = [
  { id: 'height', q: 'Right after they mow, the grass is…', a: ['Ankle-high. Lush.', 'About 3 inches.', 'Golf course. I can see dirt.'], ask: 'tall', fix: 'Ask for 3.5 inches or the highest notch.' },
  { id: 'tips', q: 'Look close at the grass tips the next day.', a: ['Clean cut.', 'A little frayed.', 'White, shredded and brown.'], ask: 'blades', fix: 'Shredded tips = dull blades. Ask when they were last sharpened.' },
  { id: 'clippings', q: 'The clippings end up…', a: ['On the lawn, gone in a day.', 'Bagged and hauled away.', 'Blown into the street.'], ask: 'clippings', fix: 'Ask them to leave clippings on the lawn and off the road.' },
  { id: 'ruts', q: 'Wheel tracks and ruts?', a: ['None.', 'Faint lines in the same spots.', 'Ruts I could trip in.'], ask: 'direction', fix: 'Ask them to switch mowing direction every week.' },
  { id: 'wet', q: 'It poured last night. They…', a: ['Wait a day.', 'Mow anyway, but it looks fine.', 'Mow in the rain and leave green clumps.'], ask: 'wet', fix: 'Tell them you’re fine pushing a wet mow a day.' },
  { id: 'august', q: 'Dry August, lawn’s gone brown. They…', a: ['Skip it or mow high.', 'Mow on schedule anyway.', 'Mow the brown grass to dust.'], ask: 'drought', fix: 'Tell them to skip weeks when it isn’t growing.' },
  { id: 'leaves', q: 'Fall leaves are…', a: ['Mulched into the lawn.', 'Raked and hauled away.', 'Blown into the woods, the street or my neighbor’s yard.'], ask: 'leaves', fix: 'Ask them to mow the leaves into the lawn.' },
  { id: 'spray', q: 'When they spray or spread something…', a: ['They text me first.', 'Little flags just appear.', 'I find out when I smell it.'], ask: 'notice', fix: 'Ask for a heads-up text the day before.' },
  { id: 'talk', q: 'When I ask for something, they…', a: ['Listen and do it.', 'Nod and change nothing.', 'Ghost me.'], ask: '', fix: 'Put it in a text so it’s in writing. Still nothing? Get two more quotes.' },
];
export const GRADES = [
  { min: 0.9, g: 'A', word: 'KEEP THEM', tone: 'yes', line: 'This is a keeper. Tip well at the holidays and never tell them how much you read about lawns.' },
  { min: 0.75, g: 'B', word: 'SOLID', tone: 'yes', line: 'Good crew, a couple of habits. One friendly text fixes most of this.' },
  { min: 0.55, g: 'C', word: 'NEEDS A TALK', tone: 'close', line: 'Not bad people. Bad habits. Send the text below. Most crews will change if someone just asks.' },
  { min: 0.35, g: 'D', word: 'ON NOTICE', tone: 'no', line: 'Time for a real conversation. Send the text, give it a month, and quietly get two other quotes.' },
  { min: 0, g: 'F', word: 'FIRE THEM', tone: 'never', line: 'You’re paying someone to hurt your lawn. Thank them, part ways, and either find a new crew or buy a mower. It’s honestly faster.' },
];

// ---------------------------------------------------------------- Lawn programs, decoded (ChipPicker items)
export const PROGRAM_GROUPS = [
  { id: 'visits', name: 'The visits' },
  { id: 'addons', name: 'The add-ons' },
  { id: 'ask', name: 'Ask before you sign' },
];
export const PROGRAM = [
  { id: 'v1', group: 'visits', label: 'Early spring', word: 'KEEP THE PREVENTER', tone: 'yes',
    title: 'Visit 1: crabgrass preventer (plus a little food).',
    lede: 'This is the one that matters most in spring. A preventer stops crabgrass before it sprouts. The catch: it should go down when soil hits about 55°F, around when the forsythia blooms. Not whenever the truck gets to your street in March.',
    sections: [{ h: 'Ask', list: ['“What week do you usually come?” Early April is right around here. Early March is wasted money.', '“Is this preventer safe if I want to seed this spring?” Most aren’t.'] }],
    more: { href: '/blog/pre-emergent-vs-post-emergent/', text: 'The bouncer and the hitman' } },
  { id: 'v2', group: 'visits', label: 'Late spring', word: 'KEEP', tone: 'yes',
    title: 'Visit 2: feeding + weed spray.',
    lede: 'A late spring feeding is good. That’s my Memorial Day feeding. The weed part is where you want to push: spray the weeds, not the whole lawn.',
    sections: [{ h: 'Ask', list: ['“Do you spot-spray or blanket-spray?”', '“Is the fertilizer slow-release?” Fast stuff in May makes you mow twice a week.'] }],
    more: { href: '/blog/holiday-lawn-fertilizer-schedule/', text: 'The holiday schedule' } },
  { id: 'v3', group: 'visits', label: 'Early summer', word: 'MAYBE', tone: 'close',
    title: 'Visit 3: feeding + grub control “just in case.”',
    lede: 'The grub part is the question. Most lawns don’t have grubs bad enough to treat most years. If you’ve never had grub damage, ask to skip it.',
    sections: [{ h: 'Ask', list: ['“Did you find grubs, or is this preventive?”', '“Can I skip it this year and you check in August?”'] }],
    more: { href: '/resources/whats-wrong-with-my-lawn/#dx-grubs', text: 'Is it really grubs?' } },
  { id: 'v4', group: 'visits', label: 'Summer', word: 'SKIP', tone: 'no',
    title: 'Visit 4: the “summer stress” feeding.',
    lede: 'Cool-season grass naps in July and August. Feeding a hot, unwatered lawn doesn’t wake it up. It just feeds the weeds. If you water a lot, a half dose of slow-release is fine. Otherwise, skip it.',
    more: { href: '/resources/should-i-water-my-lawn/', text: 'Should I water? (live)' } },
  { id: 'v5', group: 'visits', label: 'Early fall', word: 'THE BIG ONE', tone: 'yes',
    title: 'Visit 5: early fall feeding. The most important visit of the year.',
    lede: 'Labor Day-ish. Grass is waking back up and building roots for next year. If you only keep one visit, keep this one. Great time for fall weed control too.',
    more: { href: '/blog/holiday-lawn-fertilizer-schedule/', text: 'Why Labor Day is the big one' } },
  { id: 'v6', group: 'visits', label: 'Late fall', word: 'KEEP', tone: 'yes',
    title: 'Visit 6: the “winterizer.”',
    lede: 'A late fall feeding while the grass is still green is legit. That’s my Columbus Day or Thanksgiving feeding. Your lawn wakes up greener in spring. Just not after the ground freezes.' },
  { id: 'lime', group: 'addons', label: 'Lime', word: 'ONLY WITH A TEST', tone: 'close',
    title: 'Lime: only if a soil test says so.',
    lede: 'Lime fixes sour soil. If your soil isn’t sour, it does nothing, and too much is hard to undo. Ask to see the soil test. No test? Get one yourself for about $20 to $30.',
    more: { href: '/blog/lawn-soil-test/', text: 'Soil test translator' } },
  { id: 'aerate', group: 'addons', label: 'Aeration + seed', word: 'GOOD, IF TIMED', tone: 'yes',
    title: 'Aeration and overseeding: worth it, if it’s September.',
    lede: 'This is the best add-on they sell. Late August to mid-September is the window. Ask what seed they use. Cheap seed is how you get a lawn full of grass you didn’t ask for. And the watering after is on you either way.',
    sections: [{ h: 'Ask', list: ['“What seed is it, exactly?” Look for named varieties, not “contractor mix.”', '“What week?” Spring seeding is a long shot.'] }],
    more: { href: '/blog/grass-types-northeast/', text: 'Every grass seed, ranked' } },
  { id: 'fungus', group: 'addons', label: 'Disease control', word: 'ASK WHY', tone: 'close',
    title: 'Fungicide “just in case”: usually not needed.',
    lede: 'Most home lawns don’t need preventive fungicide. Lawn diseases mostly come from watering at night, mowing short and too much summer fertilizer. Fix those first. Have an actual spreading problem? Get it diagnosed.',
    more: { href: '/resources/whats-wrong-with-my-lawn/', text: 'What’s wrong with my lawn?' } },
  { id: 'q-what', group: 'ask', label: 'What goes down each visit?', word: 'ASK', tone: 'yes',
    title: '“What product, and how much, each visit?”',
    lede: 'A good company answers this in one text. A vague one says “our proprietary blend.” Nitrogen per 1,000 square feet is the number you want. About 1 lb per feeding, max.',
    more: { href: '/blog/how-to-read-a-fertilizer-bag/', text: 'How to read a fertilizer bag' } },
  { id: 'q-spot', group: 'ask', label: 'Spot or blanket spray?', word: 'ASK', tone: 'yes',
    title: '“Do you spray the weeds or the whole lawn?”',
    lede: 'Six dandelions don’t need the whole yard sprayed. Spot-spraying uses less product and is easier on kids, pets and bees.',
    more: { href: '/blog/kid-and-pet-safe-lawn-care/', text: 'The kid and pet safe playbook' } },
  { id: 'q-notice', group: 'ask', label: 'Will you tell me first?', word: 'ASK', tone: 'yes',
    title: '“Can you text me the day before?”',
    lede: 'So you can keep kids and dogs off until it dries, skip watering right before, and not mow the day after a weed spray.' },
  { id: 'q-skip', group: 'ask', label: 'Can I skip visits?', word: 'ASK', tone: 'yes',
    title: '“Can I pick my visits?”',
    lede: 'Some companies let you keep the good ones (early spring, early fall, late fall) and drop the rest. If the answer is “all or nothing,” that tells you who the program is built for.' },
  { id: 'q-renew', group: 'ask', label: 'Does it auto-renew?', word: 'READ IT', tone: 'close',
    title: '“Does this renew on its own?”',
    lede: 'Lots of programs roll over every year unless you cancel. Find the cancel rules before you sign, and put a reminder in your phone a month before renewal.' },
  { id: 'q-guarantee', group: 'ask', label: 'What’s the guarantee?', word: 'READ IT', tone: 'close',
    title: '“What happens if it doesn’t work?”',
    lede: 'Usually it means they come back and spray again for free. Not a refund. Good to know before the dandelions do.' },
];

// ---------------------------------------------------------------- Quiz plan: who does each task (crew mode)
// who: 'guy' (tell your guy) | 'you' (do it yourself). line = the one-liner shown on the plan.
export const CREW_TASKS = {
  blade: { who: 'guy', line: 'Ask: “When did the blades last get sharpened?”' },
  raise: { who: 'guy', line: 'Ask: “3.5 inches or the highest notch, please.”' },
  cleanup: { who: 'guy', line: 'Ask for a light cleanup. No power raking.' },
  crabgrass: { who: 'you', line: 'One bag, one spreader, 15 minutes. Cheaper than a visit, and you pick the week.' },
  'spring-feed': { who: 'you', line: 'One bag and a spreader. Or ask your guy to just do this one.' },
  'spot-weeds': { who: 'you', line: 'A spray bottle and the weeds you actually have.' },
  grubs: { who: 'you', line: 'Check before anyone sells you grub control.' },
  'july4-feed': { who: 'you', line: 'Only if you water. Skip the “summer stress” visit either way.' },
  summer: { who: 'guy', line: 'Ask: “Mow high and skip weeks when it’s not growing.”' },
  'soil-test': { who: 'you', line: 'A $20 to $30 kit. Nobody on the truck is doing this.' },
  aerate: { who: 'guy', line: 'Fine to hire. Ask for late August to September, and buy the seed yourself.' },
  seed: { who: 'you', line: 'Buy good seed yourself. The watering is on you either way.' },
  'fall-feed': { who: 'you', line: 'The most important feeding of the year. Worth 15 minutes of your time.' },
  'fall-weeds': { who: 'you', line: 'Spot-spray what’s there. Not the whole lawn.' },
  'columbus-feed': { who: 'you', line: 'One bag, 15 minutes, peak lawn for Halloween.' },
  leaves: { who: 'guy', line: 'Ask them to mow the leaves into the lawn instead of hauling them.' },
  lime: { who: 'you', line: 'Only if your soil test says so.' },
  'thanksgiving-feed': { who: 'you', line: 'Last call, before the freeze.' },
  'last-mow': { who: 'guy', line: 'Ask for the last mow at about 3 inches.' },
  winter: { who: 'guy', line: 'Their mower, their problem. Enjoy the winter.' },
};
// Asks pre-filled in the text builder from the plan
export const CREW_PLAN_ASKS = ['tall', 'clippings', 'leaves', 'spring', 'diyfeed'];
