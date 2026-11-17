// Auto internal links for blog posts and guides (see src/lib/remark-mit.mjs).
// Each rule links the FIRST mention of `re` (case-insensitive regex source) to `to`, once per page.
// Skipped when the page is `to`, already links to `to`, or is listed in `not`.
// Keep phrases specific so links land where a reader would expect them. Put more specific rules first.
export const MAX_AUTO = 8;

export const LINKS = [
  // Running jokes and references that need context
  { re: 'super bowl of lawns|lawn super bowl|super bowl', to: '/blog/halloween-is-the-lawn-super-bowl/' },
  { re: 'lawn psychos?', to: '/calendar/' },
  // Feeding
  { re: 'holiday (?:fertilizer |feeding )?schedule|feed(?:ing)? on (?:the |three )?holidays', to: '/blog/holiday-lawn-fertilizer-schedule/' },
  { re: 'labor day feeding|feed(?:ing)? (?:on|around) labor day', to: '/blog/holiday-lawn-fertilizer-schedule/' },
  { re: 'fertilizer bag|the bag says|three numbers on the bag', to: '/blog/how-to-read-a-fertilizer-bag/' },
  { re: 'spreader settings?|half the setting|half rate', to: '/blog/spreader-settings-half-rate-twice/' },
  { re: 'slow-release|slowly available nitrogen|water[- ]insoluble nitrogen', to: '/guides/types-of-lawn-fertilizer/#slow-release' },
  { re: 'quick-release|fast-release|fast-acting nitrogen', to: '/guides/types-of-lawn-fertilizer/#quick-release' },
  { re: 'starter fertilizer', to: '/guides/types-of-lawn-fertilizer/#starter' },
  { re: 'organic fertilizer|natural organic', to: '/guides/types-of-lawn-fertilizer/#organic' },
  { re: 'weed and feed|weed-and-feed', to: '/guides/types-of-lawn-fertilizer/#weed-and-feed' },
  { re: 'winterizer', to: '/guides/types-of-lawn-fertilizer/#winterizer' },
  { re: 'iron (?:spray|supplement)|spray tan', to: '/blog/nitrogen-iron-lawn-before-party/' },
  { re: 'granules?(?: or | vs\\.? )spray', to: '/blog/granules-vs-spray/' },
  // Mowing
  { re: '1/3 rule|one-third rule|more than a third', to: '/blog/one-third-rule-mowing/' },
  { re: 'mow(?:ing)? tall|mowing height|3\\.5 inches', to: '/guides/how-high-to-mow-grass/' },
  { re: 'scalp(?:ing|ed)?', to: '/blog/your-landscaper-is-scalping-your-lawn/' },
  { re: 'sharp(?:en)? (?:the |your )?blade|dull blade|sharpen(?:ing)?', to: '/blog/sharpen-your-mower-blade/' },
  { re: 'leave the clippings|leaving the clippings', to: '/blog/stop-bagging-your-clippings/' },
  { re: 'mulch(?:ing)? (?:the |your )?leaves|mow (?:over )?the leaves', to: '/guides/should-i-mulch-leaves-into-lawn/' },
  { re: 'leaf blowers?', to: '/blog/you-never-needed-a-leaf-blower/' },
  { re: 'robot mowers?', to: '/blog/robot-mower-judging-you/' },
  { re: 'stripe patterns?|checkerboard', to: '/blog/lawn-stripe-patterns/' },
  { re: 'first mow(?: of (?:the year|spring))?', to: '/blog/opening-day-first-mow/' },
  { re: 'last mow(?: of the year)?|final cut', to: '/guides/when-to-stop-mowing/' },
  { re: 'too early to mow|mowing etiquette', to: '/blog/lawn-mowing-etiquette/' },
  { re: 'tune-up|mower maintenance', to: '/blog/lawn-mower-maintenance-diy/' },
  // Seed and soil
  { re: 'soil tests?', to: '/blog/lawn-soil-test/' },
  { re: 'lime', to: '/guides/does-my-lawn-need-lime/' },
  { re: 'soil thermometer|soil temperature', to: '/resources/lawn-soil-temperature/' },
  { re: 'spring seed(?:ing)?|seed(?:ing)? in (?:the )?spring', to: '/blog/spring-seeding/' },
  { re: 'mesotrione|tenacity|siduron', to: '/guides/weed-killer-and-grass-seed/' },
  { re: 'overseed(?:ing)?|seed(?:ing)? (?:the )?thin spots', to: '/guides/when-to-overseed-lawn/' },
  { re: 'bare spots?|dead patch(?:es)?', to: '/guides/fix-bare-spots-in-lawn/' },
  { re: 'kentucky bluegrass|perennial rye(?:grass)?|tall fescue|fine fescue', to: '/blog/grass-types-northeast/' },
  { re: 'germinat(?:e|ion|es)|new seed(?:lings)?', to: '/blog/is-my-grass-seed-growing/' },
  { re: 'aerat(?:e|ion|ing)', to: '/guides/should-i-aerate-my-lawn/' },
  { re: 'water(?:ing)? deep(?:ly)?|an inch (?:of water )?a week', to: '/guides/how-often-to-water-lawn/' },
  // Weeds and pests
  { re: 'crabgrass preventer|pre-emergent', to: '/guides/crabgrass-preventer-timing/' },
  { re: 'post-emergent|weed killer', to: '/blog/pre-emergent-vs-post-emergent/' },
  // Weeds: every named weed links to its weed page (first mention per page)
  { re: 'crabgrass', to: '/weeds/crabgrass/' },
  { re: 'dandelions?', to: '/weeds/dandelion/' },
  { re: '(?:white )?clover', to: '/weeds/clover/' },
  { re: 'creeping charlie|ground ivy', to: '/weeds/creeping-charlie/' },
  { re: '(?:yellow )?nutsedge', to: '/weeds/nutsedge/' },
  { re: '(?:yellow )?wood sorrel|oxalis', to: '/weeds/oxalis/' },
  { re: '(?:broadleaf )?plantain', to: '/weeds/plantain/' },
  { re: 'wild violets?|violets', to: '/weeds/violet/' },
  { re: '(?:purple )?deadnettle|henbit', to: '/weeds/deadnettle/' },
  { re: 'chickweed', to: '/weeds/chickweed/' },
  { re: 'annual bluegrass|poa annua', to: '/weeds/annual-bluegrass/' },
  { re: 'rough bluegrass|poa trivialis', to: '/weeds/rough-bluegrass/' },
  { re: 'nimblewill', to: '/weeds/nimblewill/' },
  { re: '(?:japanese )?stiltgrass', to: '/weeds/stiltgrass/' },
  { re: '(?<!peat )moss', to: '/weeds/moss/' },
  { re: 'grubs?', to: '/guides/grubs-in-lawn/' },
  { re: 'snow mold|voles?', to: '/guides/snow-mold-and-vole-damage/' },
  { re: 'skunks?|moles?', to: '/blog/animals-in-your-lawn/' },
  { re: 'dog pee|pee spots?', to: '/blog/dog-pee-kids-bouncy-houses-lawn/' },
  { re: 'kids and pets|kid-safe|pet-safe', to: '/blog/kid-and-pet-safe-lawn-care/' },
  // Landscapers
  { re: 'lawn (?:treatment )?programs?|spray programs?', to: '/blog/lawn-treatment-program-explained/' },
  { re: 'text your (?:landscaper|guy)|tell your (?:landscaper|guy)', to: '/blog/what-to-tell-your-landscaper/' },
  { re: 'lawn services?', to: '/blog/should-i-hire-a-lawn-service/' },
  { re: 'landscapers?', to: '/blog/pay-a-guy-or-diy-lawn-jobs/' },
  // Tools
  { re: 'measure your (?:yard|lawn)|how big (?:your|my) lawn is', to: '/measure/' },
  { re: 'rain meter|should i water', to: '/resources/should-i-water-my-lawn/' },
];
