// Every free tool on the site, in one place. Feeds the /resources/ hub grid, the "More Free Tools" row on
// tool pages, and the hub's ItemList structured data.
//
// How the grid is organized (Mike, Nov 17): by the question in the visitor's head, not by what kind of
// widget it is. Order runs from "do this once" → "I need an answer today" → "something's wrong" →
// the seasonal jobs (seed, feed) → doing a job right → mowing/gear → landscaper people → fun.
// Each section shows its top `show` cards; the rest sit behind "Show N More".
//
// Tool fields: id, name (Title Case), line (one short, funny line: what it answers), href,
// tag: 'Live' (uses live weather/soil) | 'Quiz' | 'Calculator' | 'Checklist' | 'Map' | 'Picker' | 'Game' | 'Fun'
// keys: extra words for the filter box. Tools that live inside a blog post link to `#tool`.

export const TOOL_CATS = [
  { id: 'start', name: 'Start Here', short: 'Start Here', why: 'Do these once. Every other tool gets smarter after.', show: 3, icon: 'flag' },
  { id: 'now', name: 'Right Now', short: 'Right Now', why: 'Live answers for your ZIP, this week. Check before you do anything.', show: 4, icon: 'sun' },
  { id: 'fix', name: 'Something’s Wrong', short: 'Something’s Wrong', why: 'Brown spots, weeds, holes, mystery mushrooms. Find out what it is and the fix.', show: 4, icon: 'glass' },
  { id: 'seed', name: 'Seed and Grass', short: 'Seed', why: 'What to plant, when to plant it, and whether it’s working.', show: 4, icon: 'seed' },
  { id: 'feed', name: 'Feed and Soil', short: 'Feed & Soil', why: 'Fertilizer, lime and soil tests, minus the chemistry class.', show: 4, icon: 'bag' },
  { id: 'job', name: 'Do the Job Right', short: 'Do It Right', why: 'Steps in order and exact amounts, so you buy once and do it once.', show: 4, icon: 'list' },
  { id: 'mow', name: 'Mowing and Gear', short: 'Mowing & Gear', why: 'How tall, how often, what to buy, and what to skip.', show: 4, icon: 'mower' },
  { id: 'crew', name: 'Got a Guy?', short: 'Got a Guy', why: 'For people with a landscaper. What to say, what to pay, and how to grade them.', show: 4, icon: 'phone' },
  { id: 'fun', name: 'Just for Fun', short: 'Fun', why: 'Lawn nonsense. Scientifically important lawn nonsense.', show: 4, icon: 'game' },
];

export const TOOLS = [
  // Start here
  { id: 'plan', cat: 'start', name: 'Your Free Lawn Plan', line: 'Seven questions. A plan made for your yard, then I’ll walk you through it all year.', href: '/plan/', tag: 'Quiz', keys: 'quiz plan schedule reminders' },
  { id: 'calendar', cat: 'start', name: 'Lawn Calendar', line: 'Every job for the year at your effort level. Couch Potato to Lawn Psycho.', href: '/calendar/', tag: 'Picker', keys: 'calendar schedule month when' },
  { id: 'measure', cat: 'start', name: 'Measure Your Yard', line: 'Trace your grass on a satellite map. Square feet written right on it.', href: '/measure/', tag: 'Map', keys: 'square feet size area map how big' },

  // Right now
  { id: 'water', cat: 'now', name: 'Should I Water?', line: 'Rain vs. what your lawn drank this week. Yes, no, or wait for the storm.', href: '/resources/should-i-water-my-lawn/', tag: 'Live', keys: 'water rain sprinkler drought' },
  { id: 'seed-now', cat: 'now', name: 'Can I Seed Now?', line: 'Soil temperature plus the forecast. A straight yes or no on seeding.', href: '/resources/can-i-seed-now/', tag: 'Live', keys: 'seed overseed plant grass when' },
  { id: 'soil-temp', cat: 'now', name: 'Soil Temperature', line: 'Live soil thermometer for your ZIP. It runs the whole lawn year.', href: '/resources/lawn-soil-temperature/', tag: 'Live', keys: 'soil temperature crabgrass preventer 55' },
  { id: 'mow-check', cat: 'now', name: 'Can I Mow Right Now?', line: 'Day, time and mower type. Find out if the neighbors will hate you.', href: '/blog/lawn-mowing-etiquette/#tool', tag: 'Live', keys: 'mow time early late sunday etiquette noise' },
  { id: 'mulch-bag', cat: 'now', name: 'Mulch or Bag Today?', line: 'Leave the clippings or bag them? It depends on today.', href: '/blog/mulching-vs-bagging/#tool', tag: 'Picker', keys: 'clippings mulch bag leaves' },

  // Something's wrong
  { id: 'dx', cat: 'fix', name: 'What’s Wrong With My Lawn?', line: 'Tap what you see. Get the likely cause, how to check, and the fix.', href: '/resources/whats-wrong-with-my-lawn/', tag: 'Picker', keys: 'brown spots dead patches yellow grubs fungus disease mushrooms' },
  { id: 'weeds', cat: 'fix', name: 'What’s That Weed?', line: 'Real photos of the 15 weeds you’ll actually find. Swipe, match, fix.', href: '/weeds/', tag: 'Picker', keys: 'weed id identify dandelion clover crabgrass' },
  { id: 'critters', cat: 'fix', name: 'Who Dug Up My Lawn?', line: 'Holes, tunnels and torn-up turf. Skunk, vole, mole or raccoon?', href: '/blog/animals-in-your-lawn/#tool', tag: 'Picker', keys: 'animals holes moles voles skunks grubs digging' },
  { id: 'spot-fixer', cat: 'fix', name: 'Dog Pee and Damage Fixer', line: 'Dog spots, bouncy house squares, kiddie pool circles. How to fix each one.', href: '/blog/dog-pee-kids-bouncy-houses-lawn/#tool', tag: 'Picker', keys: 'dog pee urine spots damage kids pool' },
  { id: 'pre-post', cat: 'fix', name: 'Pre or Post?', line: 'Preventer or weed killer? Tell me the weed and the month.', href: '/blog/pre-emergent-vs-post-emergent/#tool', tag: 'Picker', keys: 'pre-emergent post-emergent weed killer preventer' },
  { id: 'weed-playbook', cat: 'fix', name: 'Kid and Pet Safe Weed Plan', line: 'Kids and dogs on the lawn? The gentlest way to handle each weed.', href: '/blog/kid-and-pet-safe-lawn-care/#tool', tag: 'Picker', keys: 'kids pets dogs safe organic weeds' },

  // Seed and grass
  { id: 'grass', cat: 'seed', name: 'What Grass Seed Should I Buy?', line: 'Four questions about sun, kids and watering. One seed, plus how much.', href: '/resources/what-grass-seed-should-i-buy/', tag: 'Quiz', keys: 'grass type seed picker fescue rye bluegrass shade' },
  { id: 'seedwatch', cat: 'seed', name: 'Is My Grass Seed Working?', line: 'Slide through the next 8 weeks and see what your seed should look like.', href: '/resources/is-my-grass-seed-working/', tag: 'Calculator', keys: 'germination sprout how long grass seed growing timeline' },
  { id: 'seed-waits', cat: 'seed', name: 'Weed Killer Wait Times', line: 'Sprayed weeds and want to seed? How long to wait for each product type.', href: '/blog/fall-kill-weeds-or-plant-seed/#tool', tag: 'Picker', keys: 'weed killer seed wait how long' },

  // Feed and soil
  { id: 'feed-schedule', cat: 'feed', name: 'Holiday Feeding Calendar', line: 'Fertilize on holidays you already remember. Pick your effort, get the dates.', href: '/blog/holiday-lawn-fertilizer-schedule/#tool', tag: 'Picker', keys: 'fertilizer schedule when memorial labor day' },
  { id: 'bag', cat: 'feed', name: 'Fertilizer Bag Decoder', line: 'Type the three numbers on the bag. Find out what you actually bought.', href: '/blog/how-to-read-a-fertilizer-bag/#tool', tag: 'Calculator', keys: 'npk fertilizer numbers bag label' },
  { id: 'soil-test', cat: 'feed', name: 'Soil Test Translator', line: 'Plug in your soil report. Get what to buy and what to ignore.', href: '/blog/lawn-soil-test/#tool', tag: 'Calculator', keys: 'soil test ph lime phosphorus potassium' },
  { id: 'gran-spray', cat: 'feed', name: 'Granules or Spray?', line: 'Bag-and-spreader or hose-end bottle? Pick the job, get the answer.', href: '/blog/granules-vs-spray/#tool', tag: 'Picker', keys: 'granular liquid spray hose end' },

  // Do the job right
  { id: 'ops', cat: 'job', name: 'Lawn Jobs in the Right Order', line: 'Overseeding, aerating, liming. Pick the job, get the steps in order.', href: '/resources/lawn-care-order-of-operations/', tag: 'Checklist', keys: 'order steps overseed aerate lime how to' },
  { id: 'calc', cat: 'job', name: 'Lawn Calculator', line: 'Seed, fertilizer, lime, straw. Exact amounts and bags for your lawn.', href: '/resources/lawn-calculator/', tag: 'Calculator', keys: 'how much seed fertilizer lime bags pounds' },
  { id: 'spreader', cat: 'job', name: 'Spreader Settings', line: 'The bag lists your spreader’s number? Great. It doesn’t? Start here.', href: '/resources/spreader-settings/', tag: 'Calculator', keys: 'spreader setting broadcast drop' },
  { id: 'opening-day', cat: 'job', name: 'First Mow of the Year', line: 'Opening day checklist. Gas, blade, height, and what not to do.', href: '/blog/opening-day-first-mow/#tool', tag: 'Checklist', keys: 'spring first mow checklist' },
  { id: 'party', cat: 'job', name: 'Party-Ready Lawn Countdown', line: 'Big party coming? What to do 3 weeks, 1 week and 1 day out.', href: '/blog/nitrogen-iron-lawn-before-party/#tool', tag: 'Calculator', keys: 'party iron green fast event' },

  // Mowing and gear
  { id: 'third', cat: 'mow', name: '1/3 Rule Calculator', line: 'How low can you go today without stressing the grass?', href: '/blog/one-third-rule-mowing/#tool', tag: 'Calculator', keys: 'mowing height one third rule how tall' },
  { id: 'stripes', cat: 'mow', name: 'Stripe Pattern Picker', line: 'Straight, diagonal, checkerboard, diamonds. Difficulty and how-to for each.', href: '/blog/lawn-stripe-patterns/#tool', tag: 'Picker', keys: 'stripes pattern striping' },
  { id: 'blade', cat: 'mow', name: 'Blade Sharpness Check', line: 'Look at a grass tip. Find out if your blade is a butter knife.', href: '/blog/sharpen-your-mower-blade/#tool', tag: 'Checklist', keys: 'blade sharpen dull' },
  { id: 'mower-match', cat: 'mow', name: 'Mower Matchmaker', line: 'Push, self-propelled, riding or zero-turn? Swipe right on the right one.', href: '/blog/walk-behind-vs-riding-vs-zero-turn-mower/#tool', tag: 'Quiz', keys: 'buy mower riding zero turn push robot' },
  { id: 'need', cat: 'mow', name: 'Do I Need This?', line: 'Tap the thing your neighbor bought. Get my verdict.', href: '/blog/lawn-stuff-you-dont-need/#tool', tag: 'Picker', keys: 'buy gear dethatcher roller products' },
  { id: 'tuneup', cat: 'mow', name: 'Mower Tune-Up Checklist', line: 'The 30-minute DIY tune-up. Oil, plug, filter, blade.', href: '/blog/lawn-mower-maintenance-diy/#tool', tag: 'Checklist', keys: 'maintenance oil spark plug filter' },
  { id: 'workout', cat: 'mow', name: 'Mowing Calorie Calculator', line: 'Push mower = cardio. Riding mower = a hobby with a cupholder.', href: '/blog/mowing-the-lawn-is-a-workout/#tool', tag: 'Calculator', keys: 'calories exercise steps workout' },

  // Got a guy
  { id: 'crew-split', cat: 'crew', name: 'Pay a Guy or DIY?', line: 'Every lawn job ranked by what’s worth paying for. See the yearly bill.', href: '/blog/pay-a-guy-or-diy-lawn-jobs/#tool', tag: 'Calculator', keys: 'landscaper cost diy hire' },
  { id: 'crew-text', cat: 'crew', name: 'Text Your Landscaper', line: 'Tap what you want. Get a polite text you can send in one tap.', href: '/blog/what-to-tell-your-landscaper/#tool', tag: 'Picker', keys: 'landscaper text message ask mow higher' },
  { id: 'crew-grade', cat: 'crew', name: 'Landscaper Report Card', line: 'Nine questions. Your lawn guy gets a letter grade.', href: '/blog/is-my-landscaper-doing-a-good-job/#tool', tag: 'Quiz', keys: 'landscaper good job grade' },
  { id: 'program', cat: 'crew', name: 'Lawn Program Decoder', line: 'What each of those six treatment visits actually is.', href: '/blog/lawn-treatment-program-explained/#tool', tag: 'Picker', keys: 'treatment program service visits' },
  { id: 'hire-it', cat: 'crew', name: 'Hire It or DIY?', line: 'Should you hire a lawn service at all? Be honest.', href: '/blog/should-i-hire-a-lawn-service/#tool', tag: 'Quiz', keys: 'hire lawn service' },

  // Fun
  { id: 'games', cat: 'fun', name: 'Lawn Games', line: 'Stripe a yard. Whack some weeds. Avoid the blower patrol.', href: '/games/', tag: 'Game', keys: 'game stripe whack' },
  { id: 'bracket', cat: 'fun', name: 'The Weed Bracket', line: '16 weeds enter. One is crowned the worst. Vote.', href: '/blog/lawn-weed-bracket/#tool', tag: 'Game', keys: 'bracket vote weeds' },
  { id: 'hall', cat: 'fun', name: 'Lawn Hall of Fame', line: 'Post your lawn. Vote on everyone else’s. Fame or shame.', href: '/hall/', tag: 'Fun', keys: 'photos vote upload' },
  { id: 'neighbor', cat: 'fun', name: 'Send It to a Neighbor', line: 'Know a lawn that needs help? Send a free plan, anonymously.', href: '/neighbor/', tag: 'Fun', keys: 'neighbor note anonymous' },
  { id: 'jokes', cat: 'fun', name: 'The Groan Meter', line: 'Ten lawn dad jokes, ranked by how hard you’ll groan.', href: '/blog/lawn-care-dad-jokes/#tool', tag: 'Fun', keys: 'jokes dad' },
  { id: 'playlist', cat: 'fun', name: 'The Mowing Playlist', line: 'Nearly two hours. Zero skips. Built for a quarter acre.', href: '/blog/lawn-mowing-playlist/#tool', tag: 'Fun', keys: 'music songs playlist' },
  { id: 'pitch', cat: 'fun', name: 'Objection Handler', line: 'Your spouse thinks the lawn thing is a lot. Here are your answers.', href: '/blog/explain-lawn-hobby-to-your-spouse/#tool', tag: 'Fun', keys: 'spouse wife husband hobby' },
  { id: 'compliments', cat: 'fun', name: 'Compliment Comebacks', line: 'Someone praised your lawn. Respond like a professional.', href: '/blog/lawn-compliments/#tool', tag: 'Fun', keys: 'compliments' },
  { id: 'trees', cat: 'fun', name: 'Leaf Drop Verdicts', line: 'Ranking the trees by how much they ruin your fall.', href: '/blog/worst-trees-for-fall-leaves/#tool', tag: 'Fun', keys: 'trees leaves oak maple' },
  { id: 'robot', cat: 'fun', name: 'Robot Mower Confessions', line: 'What your robot mower really thinks of you.', href: '/blog/robot-mower-judging-you/#tool', tag: 'Fun', keys: 'robot mower' },
  { id: 'gifts', cat: 'fun', name: 'Lawn Gift Finder', line: 'Buying for a lawn guy? Pick his type, get the gift.', href: '/blog/lawn-gift-guide/#tool', tag: 'Picker', keys: 'gift christmas present' },
  { id: 'resolutions', cat: 'fun', name: 'Lawn Resolutions', line: 'New year, new lawn. Pick the ones you’ll actually keep.', href: '/blog/lawn-new-years-resolutions/#tool', tag: 'Checklist', keys: 'new year resolutions' },
  { id: 'training', cat: 'fun', name: 'Off-Season Drills', line: 'Winter training for the lawn obsessed.', href: '/blog/lawn-off-season-training/#tool', tag: 'Fun', keys: 'winter off season' },
];

export const toolsIn = (cat) => TOOLS.filter((t) => t.cat === cat);
export const toolById = (id) => TOOLS.find((t) => t.id === id);
// Tools related to one tool: same section first, then a few staples.
export function relatedTools(href, n = 6) {
  const me = TOOLS.find((t) => t.href === href || t.href.split('#')[0] === href);
  const same = me ? TOOLS.filter((t) => t.cat === me.cat && t !== me) : [];
  const staples = ['water', 'seed-now', 'dx', 'calc', 'grass', 'measure'].map(toolById).filter((t) => t && t !== me && !same.includes(t));
  return [...same, ...staples].slice(0, n);
}
