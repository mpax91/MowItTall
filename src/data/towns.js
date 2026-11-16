// Town pages at /lawn-care/<slug>/. Each needs real local info or Google treats it as a doorway page.
// timing: 'same' (Bedford timing fits), 'early' (warmer, often ahead of Bedford), 'late' (higher/colder, a few days behind).
// The live soil reading on each page is for the town's own coordinates. Mike reviews every town's notes.
export const TOWNS = [
  {
    slug: 'bedford-ny', name: 'Bedford', state: 'NY', zip: '10506', lat: 41.2043, lon: -73.6437, county: 'Westchester County', timing: 'same', home: true,
    answer: 'Bedford lawns run on the standard northern Westchester schedule: crabgrass preventer in April when the forsythia blooms, a light feeding around Memorial Day, seeding from mid-August through September, and the big feeding around Labor Day. The real challenges here are shade, rocky soil and deer, not the calendar.',
    intro: 'This is home. My stripes are in Bedford, and every date on this site starts here. The town takes in three hamlets, Bedford Village, Bedford Hills and Katonah, and the lawns have a lot in common: big lots, old trees, stone walls and soil that grows rocks better than grass.',
    notes: [
      ['Shade is the big one', 'Mature oaks and maples cover a lot of Bedford yards. Grass wants at least 4 to 6 hours of sun. Under the big trees, use a fine fescue shade mix or call it a mulch bed.'],
      ['Rocky, thin soil', 'Stone walls exist for a reason: the ground is full of rocks. Spots over ledge dry out and brown first in summer. Topdress thin spots with compost when you seed.'],
      ['Acidic soil is common', 'Lots of Northeast soils run acidic, and moss is the tell. Get a soil test before buying lime.'],
      ['Deer and ticks', 'Deer don’t eat much lawn, but they eat everything around it. Keep grass short-ish near the woods edge (not scalped) to keep tick habitat down.'],
      ['Reservoir country', 'A lot of Bedford drains toward the reservoirs. Sweep fertilizer off driveways and keep it out of streams and wet spots.'],
    ],
    faq: [
      ['When should I put down crabgrass preventer in Bedford, NY?', 'Usually mid to late April, when soil holds around 55°F, about when the forsythia is in full bloom. Check the live soil reading on this page instead of guessing.'],
      ['When is the best time to seed a lawn in Bedford?', 'Mid-August through September. Spring works as a backup once soil passes 50°F, but fall-seeded grass is much stronger by summer.'],
      ['Why is there so much moss in my Bedford lawn?', 'Usually shade, plus acidic or compacted soil. Trim branches if you can, test the pH, and overseed with a shade mix in early fall.'],
    ],
    near: ['bedford-village-ny', 'bedford-hills-ny', 'katonah-ny', 'pound-ridge-ny'],
  },
  {
    slug: 'bedford-village-ny', name: 'Bedford Village', state: 'NY', zip: '10506', lat: 41.2043, lon: -73.6437, county: 'Westchester County', timing: 'same',
    answer: 'Bedford Village lawns follow the standard northern Westchester calendar: crabgrass preventer in April, seed from mid-August through September, feed around Labor Day. The local twist is old trees and old houses, so shade and tired soil are the usual problems.',
    intro: 'Bedford Village is the historic center of town: the green, the old colonial houses, the stone walls. Beautiful. Also, a lot of those trees have been shading the same lawn for a century.',
    notes: [
      ['Century-old shade', 'The big maples and oaks around the green and the older streets throw serious shade. Overseed shady areas with fine fescue, not bluegrass.'],
      ['Old yards, tired soil', 'Yards that have been lawns for generations can be compacted and low on organic matter. Core aerate in fall and topdress with compost when you seed.'],
      ['Stone walls and edges', 'The strip of grass next to a stone wall dries out fast and gets scalped by the mower. Mow it a notch higher and string-trim instead of scalping.'],
      ['Horse country on the edges', 'Out toward the back roads, lawns blend into pasture. If horses are nearby, keep creeping Charlie under control: it’s known to be toxic to horses.'],
    ],
    faq: [
      ['When should I seed my lawn in Bedford Village?', 'Mid-August through September is best. Shady yards do best with a fine fescue mix seeded in late August.'],
      ['Why is grass thin under the trees near the Bedford Village green?', 'Shade plus tree roots competing for water and food. Shade-tolerant fine fescue helps, but under very dense trees, mulch or a groundcover is the honest answer.'],
    ],
    near: ['bedford-ny', 'pound-ridge-ny', 'bedford-hills-ny', 'katonah-ny'],
  },
  {
    slug: 'bedford-hills-ny', name: 'Bedford Hills', state: 'NY', zip: '10507', lat: 41.2368, lon: -73.6948, county: 'Westchester County', timing: 'same',
    answer: 'Bedford Hills lawns run on the same schedule as the rest of Bedford: crabgrass preventer in April, a light Memorial Day feeding, seed in late August and September, and the big feeding around Labor Day. Smaller lots near the train mean more sun and more foot traffic.',
    intro: 'Bedford Hills is the train hamlet. Closer to the station you get neighborhood streets and smaller yards. Head out the back roads and it turns into classic Bedford: wooded, rocky and big.',
    notes: [
      ['Smaller, sunnier yards in town', 'Lots near the station tend to be smaller and sunnier than the rest of Bedford. That’s great for grass and also great for crabgrass. Don’t skip the April preventer.'],
      ['Kids, dogs and traffic', 'Smaller yards get used harder. Plantain and bare spots in the play area mean compacted soil. Aerate and seed in fall.'],
      ['Tight edges and sidewalks', 'Sidewalk and curb strips bake in summer and get road salt in winter. Seed them with tall fescue, which handles heat and abuse best.'],
      ['Wooded lots on the outskirts', 'Up the hills it’s shade and rock again. Shade mix and a soil test.'],
    ],
    faq: [
      ['What grass seed is best for a sunny Bedford Hills yard?', 'For a sunny yard with kids and dogs, a Kentucky bluegrass and perennial rye mix, or tall fescue if you won’t water. The grass picker on this site will tell you in four questions.'],
      ['How do I fix the dead strip by the road in Bedford Hills?', 'That’s usually road salt and the plow. Soak it with water in early spring to flush the salt, rake out the dead grass and reseed with tall fescue.'],
    ],
    near: ['bedford-ny', 'katonah-ny', 'mount-kisco-ny', 'bedford-village-ny'],
  },
  {
    slug: 'katonah-ny', name: 'Katonah', state: 'NY', zip: '10536', lat: 41.2590, lon: -73.6854, county: 'Westchester County', timing: 'same',
    answer: 'Katonah lawns follow the northern Westchester calendar: crabgrass preventer in April when the forsythia blooms, seed from mid-August through September, and the most important feeding around Labor Day. In the village, lots are smaller and sunnier; outside it, expect shade, rock and deer.',
    intro: 'Katonah is the hamlet that literally moved. The whole village relocated in the 1890s to make room for the reservoir, and some of the old houses rolled to their new spots. Your lawn has been through less than that. Probably.',
    notes: [
      ['Village lots vs. country lots', 'Around the Victorian houses near the train, yards are smaller and sunnier. Out toward the back roads it’s big, wooded and shady. Very different lawns, same town.'],
      ['Reservoir next door', 'Katonah sits right by the reservoirs. Go easy with fertilizer, keep it off driveways and out of the streams, and never feed right before a big storm.'],
      ['Old trees, old soil', 'Older village yards can be compacted with low organic matter. Aerate and topdress with compost when you seed in fall.'],
      ['Deer pressure', 'Deer won’t ruin your lawn, but they’ll eat the shrubs around it and bring ticks. Keep the woods edge mowed at a normal height.'],
    ],
    faq: [
      ['When should I put down crabgrass preventer in Katonah?', 'Usually mid to late April, when the soil holds around 55°F. Forsythia in full bloom is the cue. The live soil reading on this page is for Katonah.'],
      ['How often should I water my lawn in Katonah?', 'Only when rain falls short: about an inch a week in summer, in one or two deep waterings early in the morning. Spring and fall rain usually covers it.'],
    ],
    near: ['bedford-hills-ny', 'goldens-bridge-ny', 'bedford-ny', 'somers-ny'],
  },
  {
    slug: 'mount-kisco-ny', name: 'Mount Kisco', state: 'NY', zip: '10549', lat: 41.2043, lon: -73.7271, county: 'Westchester County', timing: 'same',
    answer: 'Mount Kisco lawns run on the standard northern Westchester schedule: crabgrass preventer in April, seed in late August and September, feed around Labor Day. Smaller, sunnier yards in the village mean crabgrass and heat are bigger issues than shade.',
    intro: 'Mount Kisco is the busy one. More houses, more sidewalks, smaller yards, more sun. Which means less shade to fight and more crabgrass to fight instead.',
    notes: [
      ['More sun, more crabgrass', 'Sunny yards near sidewalks and driveways are crabgrass heaven. Preventer in April along the hard edges, and mow at 3.5 to 4 inches all summer.'],
      ['Heat off the pavement', 'Grass next to driveways and streets bakes. Tall fescue handles it best. Water those strips first in a dry spell.'],
      ['Small lawns, big wins', 'On a small yard, a few minutes a week goes a long way. Leave the clippings, feed on the holidays and you’ll beat most of the street.'],
      ['Hills and slopes', 'Sloped yards dry out at the top and stay wet at the bottom. Water the high spots, and expect moss or nutsedge in the low ones.'],
    ],
    faq: [
      ['What is the best grass for a small, sunny Mount Kisco yard?', 'A Kentucky bluegrass and perennial rye mix if you water, or tall fescue if you don’t. Both handle sun well.'],
      ['How do I stop crabgrass along my driveway in Mount Kisco?', 'Put crabgrass preventer down along the edges in April when soil hits about 55°F, mow tall, and seed thin spots in fall so there’s no bare soil next spring.'],
    ],
    near: ['bedford-hills-ny', 'bedford-ny', 'katonah-ny', 'yorktown-ny'],
  },
  {
    slug: 'pound-ridge-ny', name: 'Pound Ridge', state: 'NY', zip: '10576', lat: 41.2087, lon: -73.5748, county: 'Westchester County', timing: 'late',
    answer: 'Pound Ridge follows the northern Westchester calendar, but wooded, higher spots can run a few days behind Bedford in spring: crabgrass preventer in mid to late April by soil temperature, seed from mid-August into September. Shade, rock, deer and well water shape everything here.',
    intro: 'Pound Ridge is the woods. Big lots, tall trees, rock everywhere, and the biggest park in Westchester next door. Lawns here are clearings, not carpets, and that’s OK.',
    notes: [
      ['Woods, not lawns', 'Most yards are carved out of the forest. Keep the lawn to the sunny part and let the shady edge be mulch, moss or woodland.'],
      ['Well water', 'Most homes here are on wells. Don’t run a sprinkler on a timer. Water deep only when the rain meter says so, or let the lawn go dormant in summer.'],
      ['Rock and ledge', 'Grass over ledge browns first in summer. Accept a little summer tan there.'],
      ['Deer and ticks', 'Deer and ticks are a fact of life. Keep the woods edge mowed and dry.'],
      ['Running a bit behind', 'Higher, shaded spots warm up later in spring. Go by soil temperature, not your neighbor in Mount Kisco.'],
    ],
    faq: [
      ['Should I water my lawn if I’m on a well in Pound Ridge?', 'Only when it’s really needed, deep and early in the morning, or let the lawn go dormant in summer. Cool-season grass usually greens up after real rain. Check the rain meter before you run the sprinkler.'],
      ['What grass grows in shade in Pound Ridge?', 'Fine fescue shade mixes do best in the shade. Under dense trees with less than about 4 hours of sun, mulch or a groundcover is the honest fix.'],
    ],
    near: ['bedford-village-ny', 'south-salem-ny', 'lewisboro-ny', 'bedford-ny'],
  },
  {
    slug: 'somers-ny', name: 'Somers', state: 'NY', zip: '10589', lat: 41.3279, lon: -73.6954, county: 'Westchester County', timing: 'same',
    answer: 'Somers lawns run on the northern Westchester calendar: crabgrass preventer in April, a light Memorial Day feeding, seed in late August and September, and the big feeding around Labor Day. Many Somers lawns are in newer neighborhoods, so thin topsoil and full sun are common.',
    intro: 'Somers is the birthplace of the American circus, which is the most fun fact any town can have. Your lawn shouldn’t be a circus, though. Somers has a lot of newer neighborhoods, and those come with their own lawn quirks.',
    notes: [
      ['Newer neighborhoods, thin topsoil', 'Newer subdivisions often got a thin layer of topsoil over packed fill. Lawns there dry out fast and thin out. Aerate in fall, topdress with compost and seed.'],
      ['Full sun', 'Open, sunny yards are great for grass and great for crabgrass. Preventer in April and mow tall.'],
      ['Shared lawns', 'In condo and HOA communities, the mowing is out of your hands. Ask what height they cut at. If it’s short, say something. Politely.'],
      ['Reservoirs and farms', 'Between the reservoirs and the old farm fields, go easy on fertilizer near water and keep it off the pavement.'],
    ],
    faq: [
      ['Why does my newer Somers lawn dry out so fast?', 'Newer neighborhoods often have thin topsoil over packed ground, so roots stay shallow. Core aerate in fall, topdress with compost and overseed. Mow at 3.5 to 4 inches to keep the soil shaded.'],
      ['When should I seed my lawn in Somers?', 'Mid-August through September. Spring is the backup once soil passes 50°F.'],
    ],
    near: ['katonah-ny', 'north-salem-ny', 'yorktown-ny', 'goldens-bridge-ny'],
  },
  {
    slug: 'lewisboro-ny', name: 'Lewisboro', state: 'NY', zip: '10590', lat: 41.2700, lon: -73.5900, county: 'Westchester County', timing: 'late',
    answer: 'Lewisboro lawns follow the northern Westchester calendar, with wooded and higher spots running a few days behind in spring: crabgrass preventer in mid to late April by soil temperature, seed from mid-August into September. Lakes, wells, shade and rock are the local factors.',
    intro: 'Lewisboro is a town of hamlets: South Salem, Goldens Bridge, Cross River, Vista and Waccabuc. Lakes, woods, stone walls and a lot of driveways that are longer than some people’s lawns.',
    notes: [
      ['Lake houses', 'Around Lake Waccabuc, Lake Truesdale and the other lakes, keep fertilizer well away from the shore. Use lawn food with a 0 in the middle unless a soil test says you need phosphorus. Leave an unmowed strip along the water.'],
      ['Wells', 'Most homes are on wells. Water only when it’s really needed, or let the lawn nap in summer.'],
      ['Shade and rock', 'Wooded lots mean shade mixes, soil tests and accepting that the grass ends where the trees begin.'],
      ['A few days behind', 'Higher, shaded spots warm up later in spring. Check the live soil reading before you put anything down.'],
    ],
    faq: [
      ['How do I care for a lawn near a lake in Lewisboro?', 'Keep fertilizer and grass clippings out of the water, skip phosphorus unless a soil test calls for it, and leave a strip of taller, unmowed plants along the shore to catch runoff.'],
      ['When should I put down crabgrass preventer in Lewisboro?', 'When soil holds around 55°F, usually mid to late April. Higher, shaded yards can be a few days behind Bedford.'],
    ],
    near: ['south-salem-ny', 'goldens-bridge-ny', 'pound-ridge-ny', 'north-salem-ny'],
  },
  {
    slug: 'south-salem-ny', name: 'South Salem', state: 'NY', zip: '10590', lat: 41.2490, lon: -73.5470, county: 'Westchester County', timing: 'late',
    answer: 'South Salem lawns run on the northern Westchester calendar, often a few days behind Bedford in spring on higher, wooded lots: crabgrass preventer in mid to late April by soil temperature, seed from mid-August into September. Plan around shade, rock, wells and deer.',
    intro: 'South Salem is the classic wooded Lewisboro hamlet: winding roads, stone walls, lakes and trees on every side. Gorgeous for a fall drive. Tough for grass.',
    notes: [
      ['Shade first', 'Most yards are under or next to woods. Use fine fescue shade mix and keep the lawn to the sunniest part of the yard.'],
      ['Wells and dry summers', 'On a well, don’t water on a timer. Let the lawn go dormant in a dry spell or water deep only when needed.'],
      ['Leaves, leaves, leaves', 'Wooded lots get buried in fall. Mow leaves into the lawn a few times a week in October so they don’t smother it.'],
      ['Near the lakes', 'Around Lake Truesdale and Lake Waccabuc, keep fertilizer off the shoreline and use a zero-phosphorus lawn food.'],
    ],
    faq: [
      ['What do I do with all the leaves on my South Salem lawn?', 'Mow them into the lawn while they’re dry, a few times a week when the trees are dropping. Only bag or rake if they’re too thick to see grass after mowing.'],
      ['Can I grow grass in the shade in South Salem?', 'With 4 to 6 hours of sun, a fine fescue shade mix works. With less, go with mulch, moss or a groundcover.'],
    ],
    near: ['lewisboro-ny', 'pound-ridge-ny', 'north-salem-ny', 'goldens-bridge-ny'],
  },
  {
    slug: 'north-salem-ny', name: 'North Salem', state: 'NY', zip: '10560', lat: 41.3343, lon: -73.5946, county: 'Westchester County', timing: 'late',
    answer: 'North Salem lawns follow the northern Westchester calendar, often a few days behind Bedford in spring: crabgrass preventer in mid to late April by soil temperature, seed from mid-August into September. Unlike most of the area, many yards here are open and sunny, so drought and heat matter more than shade.',
    intro: 'North Salem is horse country. Rolling fields, horse farms, the Titicus Reservoir and a Japanese stroll garden at the Hammond Museum. More sky than most of northern Westchester, which changes the lawn game.',
    notes: [
      ['Open, sunny yards', 'Big open lawns get full sun and wind, so they dry out faster than wooded towns. Mow at 3.5 to 4 inches and consider tall fescue if you won’t water.'],
      ['Horses nearby', 'Keep creeping Charlie out of anywhere horses graze. It’s known to be toxic to horses. Spray it in fall, around the first frost, away from paddocks, and follow the label.'],
      ['Pasture weeds blow in', 'Fields next door mean a steady supply of weed seed. Thick grass is your best defense: seed thin spots every fall.'],
      ['Wells', 'Most homes are on wells. Water only when the rain meter says so, or let the lawn go dormant in summer.'],
    ],
    faq: [
      ['What grass should I plant on a sunny, open North Salem lawn?', 'Tall fescue if you won’t water much, since its deep roots handle drought. A Kentucky bluegrass and rye mix if you want the best stripes and can water.'],
      ['Is creeping Charlie dangerous to horses?', 'It’s known to be toxic to horses. Keep it out of paddocks and pastures. If you spray it, keep animals off the area for as long as the label says.'],
    ],
    near: ['somers-ny', 'lewisboro-ny', 'goldens-bridge-ny', 'south-salem-ny'],
  },
  {
    slug: 'goldens-bridge-ny', name: 'Goldens Bridge', state: 'NY', zip: '10526', lat: 41.2937, lon: -73.6765, county: 'Westchester County', timing: 'same',
    answer: 'Goldens Bridge lawns run on the northern Westchester calendar: crabgrass preventer in April when the forsythia blooms, seed from mid-August through September, and the big feeding around Labor Day. Neighborhood lots are smaller and sunnier than the rest of Lewisboro.',
    intro: 'Goldens Bridge is the train-and-684 corner of Lewisboro, right near the Muscoot Reservoir. Commuter-friendly neighborhoods with real lawns, plus wooded lots as you head up the hills.',
    notes: [
      ['Neighborhood lawns', 'Closer-together houses mean sunnier yards and lawns your neighbors can see. Good stripe territory.'],
      ['Near the reservoir', 'Keep fertilizer off driveways and out of storm drains. Sweep it back onto the grass.'],
      ['Commuter-friendly schedule', 'If you’re on the train all week, the holiday feeding schedule was made for you: Memorial Day, Labor Day, Columbus Day.'],
      ['Mixed sun and shade', 'Many yards are half sun, half woods. A sun-and-shade mix of bluegrass, fine fescue and rye covers both.'],
    ],
    faq: [
      ['What grass seed should I use in Goldens Bridge?', 'For a mix of sun and shade, a blend of Kentucky bluegrass, fine fescue and perennial rye. Full sun: bluegrass and rye, or tall fescue if you won’t water.'],
      ['When should I fertilize my Goldens Bridge lawn?', 'Three times a year works well: lightly around Memorial Day, the big one around Labor Day, and again around Columbus Day.'],
    ],
    near: ['katonah-ny', 'lewisboro-ny', 'somers-ny', 'north-salem-ny'],
  },
  {
    slug: 'yorktown-ny', name: 'Yorktown', state: 'NY', zip: '10598', lat: 41.2709, lon: -73.7776, county: 'Westchester County', timing: 'same',
    answer: 'Yorktown lawns follow the northern Westchester calendar: crabgrass preventer in April, a light Memorial Day feeding, seed in late August and September, and the big feeding around Labor Day. Classic suburban lots mean more sun, more crabgrass and more neighbors comparing lawns.',
    intro: 'Yorktown is the big suburban town of northern Westchester: Yorktown Heights, Mohegan Lake, Shrub Oak, Jefferson Valley, Crompond. Lots of classic neighborhood lawns, which means lots of lawn competition. Good. Let’s win.',
    notes: [
      ['Suburban, sunny lots', 'Typical neighborhood yards get decent sun, so bluegrass and rye do well. So does crabgrass. Preventer in April, mow tall.'],
      ['Older neighborhoods, packed soil', 'Lawns that have been mowed and walked on for decades get compacted. Core aerate and overseed in early fall.'],
      ['Slopes and rock', 'Plenty of yards sit on slopes and rocky ground. Water the high spots, expect moss in the low ones.'],
      ['Lake neighborhoods', 'Near Mohegan Lake and other ponds, keep fertilizer away from the water and use zero-phosphorus lawn food.'],
    ],
    faq: [
      ['When should I put down crabgrass preventer in Yorktown?', 'Usually mid to late April, when soil holds around 55°F, about when the forsythia blooms. The live soil reading on this page is for Yorktown.'],
      ['Should I aerate my Yorktown lawn?', 'If the soil is hard, puddles after rain or gets a lot of traffic, yes. Core aerate in early fall and overseed right after.'],
    ],
    near: ['somers-ny', 'mount-kisco-ny', 'katonah-ny', 'bedford-hills-ny'],
  },
  {
    slug: 'mamaroneck-ny', name: 'Mamaroneck', state: 'NY', zip: '10543', lat: 40.9487, lon: -73.7326, county: 'Westchester County', timing: 'early',
    answer: 'Mamaroneck is down on Long Island Sound, so spring usually arrives sooner than in northern Westchester: crabgrass preventer often goes down a week or so earlier, by soil temperature. Seed from late August through September and feed around Labor Day. Smaller lots, salt air and flooding are the local factors.',
    intro: 'Mamaroneck is southern Westchester on the water. Smaller yards, a harbor, and soil that warms up earlier than mine up in Bedford. Same grass, different clock.',
    notes: [
      ['Earlier spring', 'Being on the Sound and farther south, soil here often warms ahead of northern Westchester. Watch the live reading in April. Preventer might be due before Bedford’s is.'],
      ['Flood-prone spots', 'Low areas near the rivers and the harbor can sit underwater after big storms. After a flood, rake out debris, check for dead patches and reseed in fall.'],
      ['Salt air and road salt', 'Near the water and busy roads, salt stress shows up as brown edges. Flush with water in spring and seed with tall fescue, which handles salt better.'],
      ['Small, sunny yards', 'Smaller lots mean every square foot shows. Leave clippings, mow tall, feed on the holidays. Done.'],
    ],
    faq: [
      ['When should I put down crabgrass preventer in Mamaroneck?', 'When soil holds around 55°F, which near the Sound can come a week or so earlier than in northern Westchester. Often early to mid-April. Check the live reading.'],
      ['How do I fix my lawn after flooding in Mamaroneck?', 'Rake out debris and silt once it dries, give it a couple of weeks to see what greens up, then reseed dead spots in late August or September.'],
    ],
    near: ['montclair-nj', 'yorktown-ny', 'mount-kisco-ny', 'bedford-ny'],
  },
  {
    slug: 'montclair-nj', name: 'Montclair', state: 'NJ', zip: '07042', lat: 40.8259, lon: -74.2090, county: 'Essex County', timing: 'early',
    answer: 'Montclair is a bit warmer than northern Westchester, so spring jobs often come a week or so earlier: crabgrass preventer in early to mid-April by soil temperature. Seed from late August through September and feed around Labor Day. Big old trees and small lots mean shade is the main fight.',
    intro: 'Montclair sits on the slope of the First Watchung Mountain, with grand old houses, huge street trees and the Presby Iris Gardens. Same cool-season grass as Westchester, a slightly earlier clock, and a lot more shade per square foot.',
    notes: [
      ['Big trees, small yards', 'Mature street and yard trees shade most Montclair lawns. Use a fine fescue shade mix and trim low branches to let light in.'],
      ['Earlier spring', 'Montclair usually warms up ahead of northern Westchester. Watch the live soil reading in late March and April.'],
      ['Slopes on the ridge', 'Up toward the mountain, yards slope. Seed washes downhill in heavy rain, so rake it in well and water lightly.'],
      ['Old house, old soil', 'Yards around older homes can be compacted and acidic. Core aerate, get a soil test and topdress when you seed.'],
    ],
    faq: [
      ['When should I seed my lawn in Montclair, NJ?', 'Late August through September is best. Shady yards should use a fine fescue shade mix.'],
      ['When should I put down crabgrass preventer in Montclair?', 'When soil holds around 55°F, often early to mid-April in Montclair, about a week ahead of northern Westchester. Check the live reading on this page.'],
    ],
    near: ['mamaroneck-ny', 'bedford-ny', 'yorktown-ny', 'mount-kisco-ny'],
  },
];

export const TIMING = {
  same: 'Bedford timing fits here.',
  early: 'Usually a week or so ahead of Bedford in spring.',
  late: 'Higher, wooded spots can run a few days behind Bedford in spring.',
};

// The core calendar for every town page (Bedford windows; shifted in copy by `timing`).
export const TOWN_CAL = [
  ['Crabgrass preventer', 'April, when soil holds ~55°F (forsythia in bloom)'],
  ['First mow at 3.5–4 inches', 'Late March to mid-April'],
  ['Light feeding', 'Around Memorial Day'],
  ['Grub prevention (only if you’ve had grubs)', 'June to mid-July'],
  ['Seed thin spots', 'Mid-August through September'],
  ['The big feeding', 'Around Labor Day'],
  ['Fall feeding + spray perennial weeds', 'Around Columbus Day, into October'],
  ['Mow leaves into the lawn', 'Mid-October through November'],
  ['Last mow', 'November, when the grass stops growing'],
];
