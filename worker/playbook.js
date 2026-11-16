// Mow It Tall HQ playbook: every to-do and how-to guide shown in /admin/. Served only to the logged-in
// owner through /api/admin/todos (never in the public HTML). Done state lives in D1 (todo_state).
// To add a to-do: add an item to TODOS with a new unique id. Never reuse or rename an id (it holds the done state).
// pri: 'now' | 'soon' | 'later'. who: 'You' | 'Claude' | 'Both'. done: true = shipped already (shows as done).

export const GROUPS = [
  { id: 'done', title: 'Shipped Tonight (Nov 15)', blurb: 'Already done and live after this deploy. Here so you can see what changed.' },
  { id: 'launch', title: 'Do First: Launch Check', blurb: 'Quick settings in Google, Bing, Cloudflare and GTM so everything counts from day one.' },
  { id: 'analytics', title: 'Analytics and Tracking', blurb: 'Make GA4, Clarity and Looker Studio tell you what’s working. Full steps on the Analytics tab.' },
  { id: 'social', title: 'Social Media Setup', blurb: 'Grab the names, fill out the profiles, link everything together. Full plan on the Social tab.' },
  { id: 'seo', title: 'SEO and AEO', blurb: 'Rank in Google and get quoted by ChatGPT, Perplexity, Copilot and Google’s AI answers.' },
  { id: 'pages', title: 'Pages to Create', blurb: 'New pages that win searches or build trust. I can build each one; say the word.' },
  { id: 'content', title: 'Articles to Write', blurb: 'Guides (for search, low on the site) and funny blog posts (front and center), in a sensible order.' },
  { id: 'site', title: 'Site Fixes and Usability', blurb: 'Smaller improvements and best practices.' },
  { id: 'crm', title: 'Members, Email, Reminders and Texts', blurb: 'Accounts, profiles, drips, alerts and texts. The full plan is in the project notes.' },
  { id: 'app', title: 'The App', blurb: 'Installable web app first, then Google Play, then the App Store. Details on the Build Plan tab.' },
  { id: 'products', title: 'Ebook and Course', blurb: 'Something to give away for emails, or sell. Details on the Build Plan tab.' },
  { id: 'money', title: 'Money', blurb: 'Tips, merch and affiliate links.' },
  { id: 'review', title: 'Review My Copy', blurb: 'Things I wrote in your voice that you haven’t signed off on yet.' },
];

export const TODOS = [
  /* ---------- shipped tonight */
  { id: 'd-og', group: 'done', done: true, title: 'Share cards for every page', body: 'Every page, post and guide now has its own 1200×630 share image (green game-window card with the title), so links look great in iMessage, texts, email, Facebook, LinkedIn, X and Slack. Plus og:image size/type/alt tags and Twitter cards.' },
  { id: 'd-crumbs', group: 'done', done: true, title: 'Breadcrumbs', body: 'Visible breadcrumbs on pages two levels deep (Home › Lawn 101 › Lawn Weeds, Home › Guides › …) and BreadcrumbList structured data on every inner page.' },
  { id: 'd-guides', group: 'done', done: true, title: '10 SEO guides at /guides/', body: 'Straight-answer articles for big searches: mowing height, when to overseed, crabgrass preventer timing, watering, when to fertilize, grubs, aeration, when to stop mowing, bare spots, moss. Linked from the footer, Lawn 101 answers and the bottom of related blog posts, not the homepage. Each has a Short Answer box, FAQ, sources and links back to the funny posts.' },
  { id: 'd-tech', group: 'done', done: true, title: 'Technical SEO cleanup', body: 'Fixed blog canonicals (they pointed at addresses without the trailing slash, which redirect). Search, merch, admin and 404 are now noindex. Sitemap has last-modified dates and skips those pages. robots.txt blocks /admin/ and /api/. Organization + Person structured data. Title-cased and keyword-first page titles. Caching and security headers.' },
  { id: 'd-aeo', group: 'done', done: true, title: 'llms.txt for AI answer engines', body: '<a href="/llms.txt" target="_blank">mowittall.com/llms.txt</a> lists every guide, tool and post with a one-line summary and your core advice, built automatically on every deploy.' },
  { id: 'd-pwa', group: 'done', done: true, title: 'App icons and install manifest', body: 'Home-screen icons (Android, iPhone), a web app manifest with shortcuts (Plan, Calendar, Weeds). Step one of the app.' },
  { id: 'd-ga4', group: 'done', done: true, title: 'GA4 events in the code', body: 'The site now sends 19 events into GTM’s dataLayer (quiz start/steps/complete, calendar downloads, tool use, games, shares, search, plan button clicks, Hall votes/uploads, tips, location, yard size) plus page_type and content_group on every page. <b>They reach GA4 only after you set up the GTM tag</b> (next group).' },
  { id: 'd-hq', group: 'done', done: true, title: 'HQ: to-dos, SEO agents, rank tracker, guides', body: 'This list, the SEO & AEO tab (agents, rank tracker, AI answer log), Analytics tab (GA4/GTM/Clarity/Looker steps), social setup plan and Build Plan tab.' },

  /* ---------- launch */
  { id: 'l-gtm', group: 'launch', pri: 'now', who: 'You', time: '30 min', link: 'analytics', title: 'Set up the GA4 event tag in Google Tag Manager', body: 'The site is sending events, but GTM has to forward them to GA4. Follow <b>Analytics tab → Step 1–4</b>. Without this, GA4 only sees page views.' },
  { id: 'l-ai-bots', group: 'launch', pri: 'now', who: 'You', time: '5 min', title: 'Make sure Cloudflare isn’t blocking AI search crawlers', body: 'Cloudflare can block AI bots by default on new domains, which would hide you from ChatGPT, Perplexity and Claude answers.<ol><li>Cloudflare dashboard → mowittall.com → <b>AI Crawl Control</b> (older accounts: Security → Bots).</li><li>Turn <b>off</b> “Block AI bots” and don’t let Cloudflare manage your robots.txt with AI blocks.</li><li>If you’d rather block AI <i>training</i> but allow AI <i>search</i>: allow OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User; block GPTBot, ClaudeBot, CCBot, Google-Extended. For max AEO, allow all.</li><li>Open <a href="/robots.txt" target="_blank">mowittall.com/robots.txt</a> and confirm it only says Allow / plus Disallow /admin/ and /api/.</li></ol>' },
  { id: 'l-sitemap', group: 'launch', pri: 'now', who: 'You', time: '5 min', title: 'Submit the sitemap to Google and Bing', body: '<ol><li>Search Console → Indexing → Sitemaps → enter <code>sitemap-index.xml</code> → Submit. Status should say Success.</li><li>Bing Webmaster Tools → Sitemaps → Submit sitemap → <code>https://mowittall.com/sitemap-index.xml</code>.</li><li>Resubmitting isn’t needed after deploys: Google rereads it, and Bing gets every change through IndexNow automatically.</li></ol>' },
  { id: 'l-inspect', group: 'launch', pri: 'now', who: 'You', time: '10 min', title: 'Ask Google to index your best pages', body: 'Search Console → URL Inspection (top search bar) → paste a URL → Request indexing. Do about 10 a day (Google limits it): home, /plan/, /guides/, /weeds/, /calendar/, /measure/, then the guides and your best posts.' },
  { id: 'l-links', group: 'launch', pri: 'now', who: 'You', time: '5 min', title: 'Link Search Console to GA4', body: 'GA4 → Admin → Product links → Search Console links → Link → choose the mowittall.com property and your web stream. Unlocks the Search Console reports inside GA4 and in Looker Studio.' },
  { id: 'l-internal', group: 'launch', pri: 'now', who: 'You', time: '5 min', link: 'analytics', title: 'Stop counting your own visits in GA4', body: 'GA4 → Admin → Data streams → your stream → Configure tag settings → Show all → Define internal traffic → add your home IP (google “what is my IP” at home). Then Admin → Data filters → Internal Traffic → set to <b>Active</b>. HQ pages already skip GTM.' },
  { id: 'l-history', group: 'launch', pri: 'now', who: 'You', time: '2 min', link: 'analytics', title: 'Turn off “history change” page views in GA4', body: 'The search page and a few tools update the address bar as you type, which GA4 can count as dozens of fake page views. GA4 → Admin → Data streams → web → Enhanced measurement (gear) → Page views → Show advanced settings → <b>uncheck</b> “Page changes based on browser history events.” Also turn on Site search with query parameter <code>q</code>, and turn off Form interactions.' },
  { id: 'l-retention', group: 'launch', pri: 'now', who: 'You', time: '1 min', title: 'Keep GA4 data for 14 months', body: 'GA4 → Admin → Data collection and modification → Data retention → Event data retention: 14 months → Save. The default is 2 months, which wrecks year-over-year comparisons in explorations.' },
  { id: 'l-share-test', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Test how links look when shared', body: '<ol><li>Facebook: <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener">Sharing Debugger</a> → paste a URL → Scrape Again (this also refreshes old cached previews).</li><li>LinkedIn: <a href="https://www.linkedin.com/post-inspector/" target="_blank" rel="noopener">Post Inspector</a>.</li><li>Text a link to yourself in iMessage and WhatsApp.</li><li>Or run the <b>Share Card Check</b> agent on the SEO tab.</li></ol>' },
  { id: 'l-preview-url', group: 'launch', pri: 'soon', who: 'Claude', time: '2 min', title: 'Retire the workers.dev preview address', body: 'mowittall.michaelpalladino.workers.dev still serves a full copy of the site. Canonical tags point Google at mowittall.com, so it’s low risk, but turning it off removes the duplicate. Say “turn off the preview address” and I’ll set <code>workers_dev: false</code>. Also make sure www.mowittall.com redirects to mowittall.com (Cloudflare → Rules → Redirect Rules → “Redirect from WWW to root” template).' },
  { id: 'l-gsc-email', group: 'launch', pri: 'soon', who: 'You', time: '1 min', title: 'Turn on Search Console and Bing email alerts', body: 'Search Console → Settings → Email preferences → all on. Bing Webmaster → Settings → Email preferences. These warn you about indexing drops, manual actions and security issues.' },

  /* ---------- analytics */
  { id: 'a-dims', group: 'analytics', pri: 'now', who: 'You', time: '20 min', link: 'analytics', title: 'Create GA4 custom dimensions and metrics', body: 'So you can slice reports by tool, quiz result, topic and more. List and steps: Analytics tab → Step 5.' },
  { id: 'a-key', group: 'analytics', pri: 'now', who: 'You', time: '5 min', link: 'analytics', title: 'Mark key events (conversions)', body: 'GA4 → Admin → Events → star <b>quiz_complete</b>, <b>calendar_download</b> and <b>hall_upload</b> (they appear after they’ve fired once). Later: email sign-ups.' },
  { id: 'a-clarity', group: 'analytics', pri: 'soon', who: 'You', time: '10 min', link: 'analytics', title: 'Connect Clarity to GA4 and add page tags', body: 'Analytics tab → Step 8. Lets you jump from a GA4 segment to the actual session recordings.' },
  { id: 'a-bq', group: 'analytics', pri: 'soon', who: 'You', time: '15 min', title: 'Link GA4 to BigQuery (free)', body: 'GA4 → Admin → Product links → BigQuery links → Link → create a Google Cloud project (free sandbox is fine) → Daily export. Keeps raw data forever (GA4 deletes after 14 months) and powers deeper Looker Studio reports later.' },
  { id: 'a-explore', group: 'analytics', pri: 'soon', who: 'You', time: '30 min', link: 'analytics', title: 'Build the 4 GA4 explorations', body: 'Quiz funnel, tool popularity, content by topic, landing pages that convert. Analytics tab → Step 7.' },
  { id: 'a-looker', group: 'analytics', pri: 'soon', who: 'You', time: '1 hr', link: 'analytics', title: 'Build the Looker Studio report and embed it in HQ', body: 'Five pages: Overview, SEO, Content, Tools & conversions, Social. Analytics tab → Looker Studio. Paste the embed link in HQ and it shows on the Analytics tab.' },
  { id: 'a-qr-utm', group: 'analytics', pri: 'later', who: 'Claude', time: '10 min', title: 'Tag the neighbor door-note QR codes', body: 'Add utm_source=door_note&utm_medium=qr to the QR codes on /neighbor/ so printed notes show up in GA4 as their own source.' },

  /* ---------- social */
  { id: 'so-handles', group: 'social', pri: 'now', who: 'You', time: '30 min', link: 'social', title: 'Grab @mowittall everywhere (even ones you won’t use yet)', body: 'Instagram, Facebook Page, YouTube, TikTok, X, Threads, Pinterest, Reddit. Same handle everywhere. Reserve Bluesky and LinkedIn too so nobody squats on it. Naming rules on the Social tab → Setup.' },
  { id: 'so-profiles', group: 'social', pri: 'now', who: 'You', time: '1 hr', link: 'social', title: 'Fill out every profile (photo, bio, link, category)', body: 'Copy-paste bios and the exact link for each platform are on the Social tab → Setup.' },
  { id: 'so-sameas', group: 'social', pri: 'now', who: 'Both', time: '5 min', title: 'Send me the profile links', body: 'Paste them in Social tab → Setup → “Your profile links” and tell me. I add them to the footer and to the site’s structured data (sameAs), which is how Google and AI engines connect your accounts to the site.' },
  { id: 'so-links-page', group: 'social', pri: 'now', who: 'You', time: '2 min', title: 'Use mowittall.com/links/ as your link in bio', body: 'Built tonight: a phone-friendly link page on your own site (no Linktree). Use it in the Instagram, TikTok and X bios with the platform’s tag, e.g. <code>https://mowittall.com/links/?utm_source=instagram&utm_medium=social&utm_campaign=bio</code>. The Social tab has the exact link per platform.' },
  { id: 'so-banners', group: 'social', pri: 'soon', who: 'Claude', time: '15 min', title: 'Make profile pictures and banners', body: 'I can generate the profile image (pixel mower) and banners in the share-card style at each platform’s size: Facebook cover 1640×624, X header 1500×500, YouTube 2560×1440, plus Pinterest board covers. Say “make the social banners.”' },
  { id: 'so-pins', group: 'social', pri: 'soon', who: 'Claude', time: '20 min', title: 'Pinterest pin images for every post and guide', body: 'Pinterest is a huge search engine for home and garden. I can auto-generate a 1000×1500 pin image per article at build time (like the share cards) and add the Pinterest domain verification tag once you send it.' },
  { id: 'so-meta', group: 'social', pri: 'soon', who: 'You', time: '10 min', title: 'Set up Meta Business Suite for scheduling', body: 'business.facebook.com → connect the Facebook Page and Instagram → Planner. Schedule a week of posts in one sitting (free). Use the HQ Social queue for the copy.' },
  { id: 'so-reddit', group: 'social', pri: 'later', who: 'You', time: 'ongoing', title: 'Be helpful on Reddit (r/lawncare, r/Westchester)', body: 'AI answer engines quote Reddit constantly. Answer questions with real help; link to a guide only when it’s the best answer (rule of thumb: 9 helpful comments for every 1 link). Never post the same link twice in a week.' },

  /* ---------- seo / aeo */
  { id: 's-weekly', group: 'seo', pri: 'now', who: 'You', time: '15 min / week', link: 'seo', title: 'Do the Monday SEO routine', body: 'Export Search Console, upload to the Rank Tracker, run the agents, check the indexing report. The checklist is at the top of the SEO & AEO tab. Uncheck this each week if you like it as a reminder.' },
  { id: 's-aeo-log', group: 'seo', pri: 'soon', who: 'You', time: '20 min / month', link: 'seo', title: 'Log whether AI engines quote you (monthly)', body: 'SEO & AEO tab → AI Answer Log. One-tap links ask ChatGPT, Perplexity, Google, Copilot and Claude your target questions; tick when they cite mowittall.com. Track it monthly.' },
  { id: 's-backlinks', group: 'seo', pri: 'soon', who: 'You', time: 'ongoing', title: 'Earn local links', body: '<ul><li>The Bedford Bee: a link to Mow It Tall in a story or the footer (fair game, it’s yours).</li><li>Local garden clubs, the library, Katonah/Bedford community groups and PTA newsletters: offer a free “lawn in 10 minutes” talk or tip sheet.</li><li>Patch, Westchester Magazine, The Journal News, River Journal: pitch the Halloween Super Bowl or mowing etiquette as a fun seasonal story.</li><li>Answer reporter requests on Qwoted, Featured.com or Help a B2B Writer as a homeowner lawn expert.</li><li>YouTube descriptions and Pinterest pins link back too.</li></ul>' },
  { id: 's-gsc-fix', group: 'seo', pri: 'soon', who: 'Both', time: 'as needed', title: 'Fix anything in Search Console → Indexing → Pages', body: '“Crawled, currently not indexed” on a guide or post = make it more useful or link to it more. “Duplicate without user-selected canonical” = tell me the URL. “Not found (404)” = tell me; I add a redirect.' },
  { id: 's-speed', group: 'seo', pri: 'later', who: 'Both', time: '15 min', title: 'Run PageSpeed on the top 5 pages', body: 'Run the agent’s PageSpeed links (SEO tab → Page Check → results) for home, /plan/, /weeds/, /measure/ and your top post. Send me anything under 90 on mobile.' },
  { id: 's-refresh', group: 'seo', pri: 'later', who: 'Both', time: 'seasonal', title: 'Refresh seasonal posts before their season', body: 'Six weeks before each season, update the matching posts and guides (crabgrass in March, overseeding in July, Halloween in September) and bump their <code>updated:</code> date. Only when something real changed.' },
  { id: 's-oldposts', group: 'seo', pri: 'soon', who: 'Claude', time: '30 min', title: 'Give the first four blog posts an answer-first opening and FAQs', body: 'The AEO Readiness agent flags them: scalping, excuses, leaf blower, bagging clippings. Each gets a bold one-line answer up top and 3 FAQs (structured data), same jokes. Also thin (under 250 words): a short extra section each. Your OK first since they’re in your voice.' },
  { id: 's-titlecase', group: 'seo', pri: 'soon', who: 'You', time: '1 min', title: 'Decide: title case for blog post titles?', body: 'Guides and page titles are in title case now. Blog post titles and headings are still sentence case (“A soil test is blood work for your lawn. Get one.”). Your call; I can convert them all in one go.' },

  /* ---------- pages to create */
  { id: 'p-about', group: 'pages', pri: 'now', who: 'Both', time: '20 min', title: 'About Mike page (/about/)', body: 'The biggest trust signal for Google and AI engines (“who wrote this and why should I believe them?”). Your story, the yard photos, how long you’ve been doing it, what you’re not (a pro, a company, selling chemicals), your social links. Send me a few facts and I’ll draft it.' },
  { id: 'p-privacy', group: 'pages', pri: 'now', who: 'Both', time: '15 min', title: 'Privacy page (/privacy/) and Contact page', body: 'Google Analytics and Microsoft Clarity both require a privacy policy that says you use them. Also covers Hall uploads, the measure tool (stays on the phone), and future emails. I’ll draft it (not legal advice). I just need the contact email to list.' },
  { id: 'p-weeds', group: 'pages', pri: 'soon', who: 'Claude', time: '2 hr', title: 'A page for each weed (/weeds/crabgrass/ …)', body: '“How to get rid of creeping Charlie” and friends are huge searches, and right now all 16 weeds share one page. Each weed gets its own page (photos, how to ID it, fixes, when, kid/pet notes, FAQ); the board stays as the hub. Best SEO win on the list.' },
  { id: 'p-tools', group: 'pages', pri: 'soon', who: 'Claude', time: '2 hr', link: 'seo', title: 'Give the big tools their own pages', body: 'Resources has 10 tools on one page. The ones people search for get dedicated pages with a short intro and FAQ: Should I Water My Lawn? · Can I Seed Now? · Lawn Calculator · What’s Wrong With My Lawn? · Lawn Soil Temperature · Spreader Settings. Resources stays as the hub. See “When to give a section its own page” on the SEO tab.' },
  { id: 'p-months', group: 'pages', pri: 'soon', who: 'Claude', time: '2 hr', title: 'Month pages (/calendar/november/ …)', body: '“Lawn care in April” style searches. Twelve pages generated from tasks.js (what to do, what to skip, live soil temperature, the matching guides), linked from /calendar/.' },
  { id: 'p-towns', group: 'pages', pri: 'later', who: 'Claude', time: '3 hr', title: 'Town pages (Bedford, Katonah, Pound Ridge …)', body: 'Live soil temperature and timing per town, local notes, links to the guides. Only worth it with real local info in each (otherwise Google treats them as doorway pages). Start with 5 towns you know well.' },
  { id: 'p-stripes', group: 'pages', pri: 'soon', who: 'Claude', time: '1 hr', title: '“How to stripe your lawn” (your signature topic)', body: 'You’re the stripes guy and the site doesn’t have the page yet. A guide plus a funny blog post with a stripe pattern picker (straight, diagonal, checkerboard, the spiral). Big search volume and great video content.' },

  /* ---------- articles to write */
  { id: 'c-g-leaves', group: 'content', pri: 'soon', who: 'Claude', time: '', title: 'Guide: Should I mulch leaves into my lawn?', body: 'Search: “mulching leaves into lawn”. Timely now. Low on the site (guides).' },
  { id: 'c-g-lime', group: 'content', pri: 'soon', who: 'Claude', time: '', title: 'Guide: Does my lawn need lime?', body: 'Search: “when to lime lawn”, “how much lime per 1000 sq ft”. Links to the soil test post.' },
  { id: 'c-g-spring', group: 'content', pri: 'soon', who: 'Claude', time: '', title: 'Guide: Spring lawn cleanup checklist (publish in February)', body: 'Search: “spring lawn care checklist”, “when to start mowing in spring”. Snow mold, vole tunnels, salt damage, first mow height.' },
  { id: 'c-g-snowmold', group: 'content', pri: 'later', who: 'Claude', time: '', title: 'Guide: Snow mold and vole damage', body: 'Search: “snow mold”, “vole damage lawn”. Publish early March.' },
  { id: 'c-g-clover', group: 'content', pri: 'later', who: 'Claude', time: '', title: 'Guide: How to get rid of clover (or keep it)', body: 'Becomes part of the weed pages if we build those.' },
  { id: 'c-g-cost', group: 'content', pri: 'later', who: 'Claude', time: '', title: 'Guide: How much does lawn care cost in Westchester?', body: 'DIY vs service, per year. You’d need to sanity-check local prices.' },
  { id: 'c-g-afterrain', group: 'content', pri: 'later', who: 'Claude', time: '', title: 'Guide: How long to wait to mow after rain, seed, fertilizer or weed killer', body: 'Lots of small “how long” searches answered in one table.' },
  { id: 'c-b-gifts', group: 'content', pri: 'now', who: 'Claude', time: '', title: 'Blog: Gift guide for lawn people (that isn’t a leaf blower)', body: 'Funny, timely for December, and a natural home for affiliate links later. Your picks needed.' },
  { id: 'c-b-resolutions', group: 'content', pri: 'soon', who: 'Claude', time: '', title: 'Blog: Lawn New Year’s resolutions you’ll actually keep (January)', body: 'Ties into the off-season training post.' },
  { id: 'c-b-bracket', group: 'content', pri: 'soon', who: 'Claude', time: '', title: 'Blog: March Madness bracket of lawn weeds (with a voting widget)', body: 'Very shareable. Uses the Hall voting backend. Publish early March.' },
  { id: 'c-b-opening', group: 'content', pri: 'soon', who: 'Claude', time: '', title: 'Blog: Opening Day. The official rules of the first mow (April)', body: 'Baseball framing, pairs with the Halloween Super Bowl bit.' },
  { id: 'c-b-robot', group: 'content', pri: 'later', who: 'Claude', time: '', title: 'Blog: Your robot mower is judging you', body: 'Hot take format.' },
  { id: 'c-b-leaves', group: 'content', pri: 'later', who: 'Claude', time: '', title: 'Blog: Power ranking the worst trees for fall leaves', body: 'October. Oaks are going down.' },

  /* ---------- site */
  { id: 'x-links-tools', group: 'site', pri: 'soon', who: 'Claude', time: '30 min', title: 'Link tools from the tip cards and calendar', body: 'From the backlog: the “Feed on the holidays” card → holiday schedule, “Seed in fall” → grass picker and seeding guide, calendar tasks → matching guides and tools. More internal links = better rankings and fewer dead ends.' },
  { id: 'x-404', group: 'site', pri: 'later', who: 'Claude', time: '15 min', title: 'Smarter 404 page', body: 'Search box plus the 4 most popular pages, and a GA4 event so you can see which broken links people hit.' },
  { id: 'x-header', group: 'site', pri: 'later', who: 'Claude', time: '30 min', title: 'Slimmer header on small iPhones', body: 'From the backlog. The header takes a lot of the screen on an iPhone SE.' },
  { id: 'x-desktop', group: 'site', pri: 'later', who: 'Claude', time: '1 hr', title: 'Wider desktop layouts on inner pages', body: 'From the backlog. Phones are 90%+ of traffic, so low priority.' },
  { id: 'x-a11y', group: 'site', pri: 'later', who: 'Claude', time: '1 hr', title: 'Accessibility pass', body: 'Color contrast on the small gray text, focus outlines, alt text on every photo (the Page Check agent flags missing ones), and making sure games have a skip option for screen readers.' },
  { id: 'x-hall-email', group: 'site', pri: 'later', who: 'Claude', time: '30 min', title: 'Email me when a Hall photo is waiting', body: 'Needs the email service from the CRM plan.' },

  /* ---------- crm */
  { id: 'm-service', group: 'crm', pri: 'soon', who: 'You', time: '10 min', link: 'members', title: 'Pick the email service', body: 'Resend (simplest, free to ~3,000 emails/month) or Postmark (best delivery). Or a newsletter tool (beehiiv, Kit) if you mostly want newsletters. This unlocks everything below.' },
  { id: 'm-address', group: 'crm', pri: 'soon', who: 'You', time: '', title: 'Choose a mailing address for emails', body: 'Marketing emails need a physical address in the footer. A PO box or a virtual mailbox works.' },
  { id: 'm-phase1', group: 'crm', pri: 'soon', who: 'Claude', time: '1 day', title: 'Phase 1: “Email me my plan + reminders”', body: 'On the quiz results. Sends their plan, then holiday feeding, crabgrass and seeding reminders. Double opt-in, one-click unsubscribe. Sign-ups show on the Members tab. Becomes the main GA4 key event (generate_lead).' },
  { id: 'm-drip', group: 'crm', pri: 'soon', who: 'Both', time: '', title: 'Drip: “Your First Great Lawn” 6-week email course', body: 'One short email a week after signing up, matched to the season. I draft, you edit. Doubles as the free course (see Ebook and Course).' },
  { id: 'm-accounts', group: 'crm', pri: 'later', who: 'Claude', time: '2–3 days', title: 'Phase 2: Accounts and profiles', body: 'Magic-link sign-in (no passwords). Saves their plan, yard map, grass, done list, ZIP and progress photos across devices. Members list, search and delete on the Members tab.' },
  { id: 'm-alerts', group: 'crm', pri: 'later', who: 'Claude', time: '1–2 days', title: 'Phase 3: Alerts', body: 'Weekly “water or skip”, “soil hit 55°F: crabgrass preventer this weekend”, “Labor Day is Monday: feed”, “you can seed now”. Built from the tools the site already has, sent by a scheduled Cloudflare job.' },
  { id: 'm-news', group: 'crm', pri: 'later', who: 'Both', time: '', title: 'Monthly newsletter', body: 'One email a month: what to do this month, the best new post, one Hall of Fame lawn. Write and send it from the Members tab.' },
  { id: 'm-photos', group: 'crm', pri: 'later', who: 'Claude', time: '1 day', title: 'Phase 4: Progress photos', body: 'Members upload before/after photos (GPS stripped), with a before/after slider they can share.' },
  { id: 'm-neighbor', group: 'crm', pri: 'later', who: 'Claude', time: '1 day', title: 'Phase 5: Anonymous “send to a neighbor” emails', body: 'Fixed funny templates only, one per recipient per season, opt-out list honored forever, rate limits and a captcha.' },
  { id: 'm-texts', group: 'crm', pri: 'later', who: 'Both', time: '1 week (mostly waiting)', title: 'Phase 6: Text message alerts', body: 'Twilio, only to people who opt in on the site. Carrier registration (10DLC) first, which takes 1–3 weeks. STOP/HELP handling built in.' },

  /* ---------- app */
  { id: 'ap-sw', group: 'app', pri: 'soon', who: 'Claude', time: '1 day', link: 'build', title: 'PWA step 2: offline mode + install button', body: 'A service worker so the calendar, plan, weed board and games work offline, and an “Add to Home Screen” button. Build Plan tab has the full path.' },
  { id: 'ap-push', group: 'app', pri: 'later', who: 'Claude', time: '1–2 days', link: 'build', title: 'PWA step 3: push notifications', body: 'Free web push (no paid service) for the alerts: soil temp, holiday feedings, watering. Works on Android and on iPhones once the site is added to the home screen.' },
  { id: 'ap-play', group: 'app', pri: 'later', who: 'Both', time: '1 day + 2 weeks testing', link: 'build', title: 'Google Play Store', body: 'Wrap the PWA as a Trusted Web Activity with PWABuilder. $25 one-time Google developer account. New personal accounts must run a closed test with 12 testers for 14 days before going public.' },
  { id: 'ap-ios', group: 'app', pri: 'later', who: 'Both', time: '2–3 days', link: 'build', title: 'Apple App Store', body: '$99/year Apple developer account. Apple rejects apps that are “just a website,” so wait until push alerts, offline and accounts exist. Then wrap with PWABuilder or Capacitor.' },

  /* ---------- products */
  { id: 'pr-ebook', group: 'products', pri: 'later', who: 'Both', time: '1–2 weeks', link: 'build', title: 'Ebook: the lazy lawn playbook', body: 'A 30–40 page PDF built from your own guides, calendar and photos (never from the Lawn Care Nut guides). Start as the free email sign-up gift; sell an expanded version later. Outline on the Build Plan tab.' },
  { id: 'pr-course', group: 'products', pri: 'later', who: 'Both', time: '', link: 'build', title: 'Course: Your First Great Lawn', body: 'Free 6-week email version first (the drip). Paid video version later, filmed in your yard through one season, hosted on the site behind accounts. Outline on the Build Plan tab.' },

  /* ---------- money */
  { id: '$-stripe', group: 'money', pri: 'soon', who: 'You', time: '20 min', link: 'money', title: 'Stripe tip link', body: 'Make a “Buy Mike a beer” Payment Link and send it to me. Every beer box on the site lights up.' },
  { id: '$-affiliate', group: 'money', pri: 'later', who: 'Both', time: '', title: 'Affiliate links (gear shelf)', body: 'Amazon Associates and Home Depot (through Impact). Needs a disclosure line on any page with links, and the Esri map terms checked before commercial use. Start with a “Mike’s gear shelf” page.' },
  { id: '$-merch', group: 'money', pri: 'later', who: 'Both', time: '', title: 'Merch', body: 'Print-on-demand (Printful or Printify) through Stripe or Shopify Starter. “Mow It TALL” hats first.' },

  /* ---------- review */
  { id: 'r-guides', group: 'review', pri: 'now', who: 'You', time: '30 min', title: 'Review the 10 new guides', body: 'Written in your voice. Especially: last-mow height (I said 2.5 to 3 inches; some experts say keep your normal height and the guide mentions both), grub thresholds, “aerate every 1–3 years”, fertilizer schedule table (matches your holiday plan). <a href="/guides/" target="_blank">Open the guides</a>.' },
  { id: 'r-titles', group: 'review', pri: 'soon', who: 'You', time: '5 min', title: 'Review the new page titles', body: 'Home: “Mow It Tall | Easy Lawn Care Tips, Free Plan and Tools”. Plan: “Free Lawn Care Plan: Take the 2-Minute Quiz”. Blog: “Lawn Care Blog: Short, Funny, Actually Useful”. Games, Lawn 101, Yards, Neighbor and topic pages were title-cased and keyword-first.' },
  { id: 'r-cards', group: 'review', pri: 'soon', who: 'You', time: '5 min', title: 'Review the share card kickers', body: 'The yellow label on each share card (e.g. “Free Lawn Plan”, “Weed Guide”, “Vote Now”). Text a few links to yourself.' },
  { id: 'r-old', group: 'review', pri: 'soon', who: 'You', time: '', title: 'Older copy still waiting on you', body: 'Homepage copy, seed guide, lawn service and spouse posts, calculator rates, quiz notes, Hall copy, social copy (src/data/social.js), calendar one-liners, water card reasons, /calendar/ month moods and holiday markers, the 7 newer weed cards, the first four blog posts.' },
  { id: 'r-waiting', group: 'review', pri: 'soon', who: 'You', time: '', title: 'Things I’m waiting on from you', body: 'Admin password check (ADMIN_KEY), Spotify playlist link, tip link, your wife’s rock line, the seed-safe product name, the Momoa meme choice.' },
];

/* ---------------------------------------------------------------- long-form guides (HTML) */
const SITE = 'https://mowittall.com';
const bio = (src, camp = 'bio') => `${SITE}/links/?utm_source=${src}&amp;utm_medium=social&amp;utm_campaign=${camp}`;

export const GUIDES = {
  /* ===== SEO tab ===== */
  seoRoutine: `
<ol class="pb-steps">
<li><b>Search Console → Performance → Search results.</b> Date: Compare → last 7 days vs previous 7. Sort Queries by Clicks. Then the Pages tab. Look for anything that jumped or fell.</li>
<li><b>Export it:</b> Export (top right) → Download CSV. Upload the .zip right here in the <b>Rank Tracker</b>. It works out the movers, new and lost searches and what to fix.</li>
<li><b>Indexing → Pages:</b> is “Indexed” going up? Open any “Why pages aren’t indexed” reason that’s growing.</li>
<li><b>Run the agents</b> below: Page Check and Link Check. Fix anything red.</li>
<li><b>Bing Webmaster Tools:</b> Search Performance (same idea as Google), and <b>Recommendations</b> (Bing’s free SEO checklist for your site).</li>
<li><b>GA4 → Reports → Engagement → Landing page:</b> which pages people arrive on, and their key event rate.</li>
<li><b>Clarity → Dashboard:</b> rage clicks, dead clicks, quick backs. Watch 3 recordings of your top landing page on a phone.</li>
<li><b>Monthly:</b> the AI Answer Log, one new guide or post, and one link-building ask.</li>
</ol>`,
  seoLinks: [
    ['Search Console: Performance', 'https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Amowittall.com'],
    ['Search Console: Pages (indexing)', 'https://search.google.com/search-console/index?resource_id=sc-domain%3Amowittall.com'],
    ['Search Console: Sitemaps', 'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Amowittall.com'],
    ['Bing Webmaster Tools', 'https://www.bing.com/webmasters/home?siteUrl=https://mowittall.com/'],
    ['Google Analytics', 'https://analytics.google.com/'],
    ['Microsoft Clarity', 'https://clarity.microsoft.com/projects'],
    ['Tag Manager', 'https://tagmanager.google.com/'],
    ['Looker Studio', 'https://lookerstudio.google.com/'],
    ['PageSpeed Insights (home)', 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fmowittall.com%2F&form_factor=mobile'],
    ['Rich Results Test (home)', 'https://search.google.com/test/rich-results?url=https%3A%2F%2Fmowittall.com%2F'],
    ['Schema validator', 'https://validator.schema.org/#url=https%3A%2F%2Fmowittall.com%2F'],
    ['Facebook Sharing Debugger', 'https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fmowittall.com%2F'],
    ['LinkedIn Post Inspector', 'https://www.linkedin.com/post-inspector/inspect/https:%2F%2Fmowittall.com%2F'],
    ['Cloudflare dashboard', 'https://dash.cloudflare.com/'],
    ['Your sitemap', '/sitemap-0.xml'],
    ['Your llms.txt', '/llms.txt'],
  ],
  seoNote: 'The Search Console links assume a <b>Domain</b> property (sc-domain:mowittall.com), which is what Cloudflare sets up. If you made a URL-prefix property instead, pick it from the property menu after the link opens.',
  rankHow: `
<p><b>How it works (no API, no tokens):</b> you export from Search Console (or Bing) and upload the file here. Each upload is saved as a snapshot. The tracker compares the newest snapshot with the one before it.</p>
<ul>
<li><b>Search Console:</b> Performance → set the date (Last 7 days or Last 28 days; use the same range every time) → Export → Download CSV → upload the .zip (it reads Queries.csv and Pages.csv).</li>
<li><b>Bing:</b> Search Performance → Keywords or Pages → Export → upload the CSV.</li>
</ul>
<p><b>What it flags:</b> <i>Movers</i> (position change of 3+), <i>New</i> and <i>Lost</i> searches, <i>Striking distance</i> (position 5 to 20 with real impressions, a nudge from page one), <i>Low click rate</i> (you show up but people don’t click: rewrite the title and description) and <i>Pages to watch</i> (pages losing clicks or position).</p>`,
  movePages: `
<p><b>Give a section its own page when any two of these are true:</b></p>
<ol>
<li>It answers a question people type into Google on its own (“should I water my lawn today”).</li>
<li>People share or bookmark it directly (you post <code>/resources/#water-h</code> on social, or GA4 shows lots of <code>tool_use</code> for it).</li>
<li>It needs more than a couple of sentences of explanation or its own FAQ to make sense.</li>
<li>The page it lives on already does more than about 6 jobs (Resources does 10).</li>
<li>It sits far below the fold on phones but gets used a lot (Clarity scroll maps show it).</li>
</ol>
<p><b>Keep it as a section when</b> it’s less than a screen of content, it only makes sense next to its neighbors, or a dedicated page would compete with an existing page for the same search.</p>
<p><b>What I’d move now:</b> Should I Water? · Can I Seed Now? · Lawn Calculator · What’s Wrong With My Lawn? · Soil Temperature · Spreader Settings → their own pages (Resources becomes the hub with cards). Each weed → its own page (the board stays). Each month of the calendar → its own page. The homepage stays as is.</p>`,
  aeo: `
<p>AEO = getting quoted in AI answers (Google AI Overviews, ChatGPT search, Perplexity, Copilot, Claude). They pull from pages that answer clearly, are easy to crawl, and come from someone credible.</p>
<p><b>Already in place</b></p>
<ul class="pb-done">
<li>Answer-first openings in posts and a “Short Answer” box on every guide</li>
<li>FAQ structured data on posts, guides and hubs; Article/BlogPosting with you as author</li>
<li>Organization + Person structured data; breadcrumbs</li>
<li><code>/llms.txt</code> with every page and your core advice</li>
<li>robots.txt allows all crawlers (check the Cloudflare AI setting on the To-Do list)</li>
<li>IndexNow pings Bing on every deploy (ChatGPT search and Copilot lean on Bing’s index)</li>
<li>Sitemap with last-modified dates; sources cited on guides; tables for quick facts</li>
</ul>
<p><b>Still to do</b></p>
<ul>
<li>About page with your story and photos (trust is the biggest AEO factor)</li>
<li>Social profiles linked both ways (sameAs) so engines know the site, Mike and @mowittall are one entity</li>
<li>Presence where AI engines read: Reddit answers, YouTube videos with transcripts, Pinterest</li>
<li>Original data nobody else has: Bedford soil temperature by week, Hall of Fame vote results, a reader survey (“What’s your mowing height?”). Original numbers get cited.</li>
<li>Question-style headings (“How often should I water?”) and keeping the Short Answer up to date</li>
</ul>`,
  aeoQuestions: [
    'when should I put down crabgrass preventer in Westchester NY',
    'what height should I mow my lawn in New York',
    'when to overseed lawn in New York',
    'holiday lawn fertilizer schedule',
    'how to read a fertilizer bag',
    'how often should I test my lawn soil',
    'is mowing the lawn good exercise',
    'what time is too early to mow the lawn',
    'best grass seed for the Northeast',
    'how many grubs per square foot is too many',
    'when to stop mowing in the fall Northeast',
    'how to get rid of moss in lawn',
  ],
  agents: `
<p>These run in your browser right now: they read your live pages the way a search engine does and check them against a list of rules. No AI, no API keys, nothing to install. Results are saved here so phone and laptop see the same thing.</p>
<ul>
<li><b>Page Check:</b> every page in the sitemap: title and description length, one H1, canonical, noindex, share image, structured data, missing alt text, thin content, few internal links, duplicate titles.</li>
<li><b>Link Check:</b> every internal link on every page: broken links, redirect hops, and orphan pages nothing links to.</li>
<li><b>Sitemap Watch:</b> what’s in the sitemap, what was added or removed since last run, robots.txt and llms.txt checks.</li>
<li><b>Share Card Check:</b> every page’s share image loads, is the right size, and has a title and description.</li>
<li><b>AEO Readiness:</b> answer-first opening, FAQ data, question headings, author, dates and sources on posts and guides.</li>
</ul>
<p>Run Page Check and Link Check weekly and after any big change.</p>`,

  /* ===== Analytics tab ===== */
  ga4Events: [
    ['quiz_start', 'Tapped Next on the first quiz question', 'quiz_name'],
    ['quiz_step', 'Answered each quiz question (funnel)', 'quiz_name, step_number, step_type'],
    ['quiz_complete', '<b>Finished the quiz and saw their plan (main conversion)</b>', 'quiz_name, effort_level, lawn_profile, grass_pick, task_count'],
    ['calendar_download', 'Downloaded an .ics calendar (quiz plan, /calendar/, holiday schedule, seed tracker)', 'file_name, tool_name'],
    ['file_download', 'Saved another file made on the page (yard map image)', 'file_name, file_extension'],
    ['tool_use', 'First real interaction with a tool or widget on that page view', 'tool_name'],
    ['game_complete', 'Finished a game round', 'game_name, level_name, score, new_best, coverage'],
    ['share', 'Used the share sheet or copied a link/text', 'method, content_type, item_id'],
    ['search', 'Searched the site (after they stop typing)', 'search_term, results_count'],
    ['plan_cta_click', 'Tapped any button or link to the quiz', 'cta_location, cta_text'],
    ['internal_link_click', 'Tapped a related post/guide/topic link', 'link_url, link_area'],
    ['location_set', 'Set their ZIP or used GPS', 'zip3, method'],
    ['yard_measured', 'Saved a yard measurement', 'yard_size'],
    ['hall_vote', 'Voted in the Hall', 'vote'],
    ['hall_upload', 'Submitted a Hall photo', 'board'],
    ['tip_click', 'Tapped a Buy Me a Beer link', 'amount'],
    ['social_profile_click', 'Tapped a social profile link in the footer', 'platform'],
    ['link_page_click', 'Tapped a button on the /links/ link-in-bio page', 'target'],
    ['app_installed', 'Installed the site to their home screen (Android/desktop)', '(none)'],
  ],
  ga4Page: 'Every page also pushes <code>page_type</code> (home, post, guide, tool, hub, topic, fun, page) and <code>content_group</code> (Blog posts, Guides, Tools, Hubs, Home, …) before GTM loads, plus <code>post_tag</code>, <code>post_topics</code> and <code>published</code> on posts and guides.',
  ga4Steps: `
<h4>Step 1. The Google tag (probably done)</h4>
<p>GTM → Tags → you should have a <b>Google Tag</b> with your G- Measurement ID, firing on <b>Initialization – All Pages</b>. Open it → Configuration settings → add parameters: <code>content_group</code> = <code>{{DLV - content_group}}</code> and <code>page_type</code> = <code>{{DLV - page_type}}</code> (make those variables in Step 2 first). Now every page view carries its content group, and GA4’s built-in “Content group” dimension fills in.</p>
<h4>Step 2. Data Layer Variables</h4>
<p>GTM → Variables → User-Defined → New → <b>Data Layer Variable</b>. Make one per name below. Name each “DLV - name” and put the exact name in “Data Layer Variable Name”:</p>
<p><code>page_type, content_group, post_tag, post_topics, published, quiz_name, step_number, step_type, effort_level, lawn_profile, grass_pick, task_count, game_name, level_name, score, new_best, coverage, tool_name, file_name, file_extension, search_term, results_count, method, content_type, item_id, cta_location, cta_text, link_url, link_area, zip3, yard_size, vote, board, amount, platform, target</code></p>
<p>Tip: GTM → Admin → Import Container can do it in one go if you’d rather I build an import file. Ask.</p>
<h4>Step 3. One trigger for all site events</h4>
<p>Triggers → New → <b>Custom Event</b> → Event name:</p>
<p><code>^(quiz_start|quiz_step|quiz_complete|calendar_download|file_download|tool_use|game_complete|share|search|plan_cta_click|internal_link_click|location_set|yard_measured|hall_vote|hall_upload|tip_click|social_profile_click|link_page_click|app_installed)$</code></p>
<p>Check <b>Use regex matching</b> → All Custom Events → name it “CE - Mow It Tall events”.</p>
<h4>Step 4. One GA4 event tag</h4>
<p>Tags → New → <b>Google Analytics: GA4 Event</b> → Measurement ID = your G- ID → Event Name = <code>{{Event}}</code> → Event Parameters: add a row for every DLV from Step 2 (Parameter name = the plain name, Value = the DLV). Parameters that a given event doesn’t have are simply left out. Trigger = “CE - Mow It Tall events”. Save.</p>
<p>Then <b>Preview</b> (top right), open the site, take the quiz, download a calendar, play a game, search. Every event should show in Tag Assistant and in GA4 → Admin → DebugView. <b>Submit</b> → name the version “GA4 events v1” → Publish.</p>
<h4>Step 5. Custom dimensions and metrics</h4>
<p>GA4 → Admin → Custom definitions → Create custom dimension (scope: <b>Event</b>). Dimension name and Event parameter the same:</p>
<p><code>page_type, post_tag, post_topics, tool_name, quiz_name, step_number, effort_level, lawn_profile, grass_pick, game_name, level_name, cta_location, link_area, zip3, yard_size, method, content_type, board, vote, platform, target, search_term</code></p>
<p>Custom metrics (Standard unit): <code>score, task_count, results_count</code>. Data only shows from the day you create them, so do this early. (<code>content_group</code> doesn’t need one; it’s built in.)</p>
<h4>Step 6. Key events</h4>
<p>GA4 → Admin → Events (after each has fired once) → star <b>quiz_complete</b>, <b>calendar_download</b>, <b>hall_upload</b>. When email sign-ups exist: <b>generate_lead</b>. Keep plan_cta_click and tool_use as normal events; they’re steps, not goals.</p>
<h4>Step 7. Explorations to build (GA4 → Explore)</h4>
<ul>
<li><b>Quiz funnel</b> (Funnel exploration): page_view where page path = /plan/ → quiz_start → quiz_step (step_number = 5) → quiz_complete → calendar_download. Breakdown: Device category. Shows exactly where people quit.</li>
<li><b>Tool popularity</b> (Free form): rows = tool_name, values = Event count, Total users. Filter event name = tool_use. Use it to decide which tools get their own page.</li>
<li><b>Content by topic</b> (Free form): rows = Content group, then post_topics; values = Views, Engaged sessions, Key events.</li>
<li><b>Landing pages that convert</b> (Free form): rows = Landing page + query string; values = Sessions, Key events, Session key event rate. Filter Session source/medium contains “organic”.</li>
<li><b>What brings people back</b> (Cohort): returning users by first landing content group.</li>
</ul>
<p>Also: Reports → Library → create a collection “Mow It Tall” with Traffic acquisition, Landing page, Events and a custom “Tools” report (tool_use by tool_name) so it’s in the left menu.</p>
<h4>Step 8. Microsoft Clarity</h4>
<ul>
<li>If Clarity isn’t in GTM yet: GTM → Tags → New → Tag Configuration → Discover more tag types in the Community Template Gallery → “Microsoft Clarity – Official” → your Clarity project ID → trigger All Pages.</li>
<li>Clarity → Settings → Setup → <b>Google Analytics integration</b> → connect GA4. Adds Clarity session links into GA4.</li>
<li>Page tags: GTM → New tag → Custom HTML → <code>&lt;script&gt;window.clarity &amp;&amp; clarity("set","page_type","{{DLV - page_type}}"); window.clarity &amp;&amp; clarity("set","content_group","{{DLV - content_group}}");&lt;/script&gt;</code> → trigger All Pages (DOM Ready). Now you can filter recordings to just guides or just tools.</li>
<li>Masking: keep the default (Balanced) so typed ZIP codes and the admin password field are hidden. HQ pages don’t load GTM at all.</li>
<li>Clarity → Funnels: /plan/ visit → quiz result visible. Heatmaps: homepage, /plan/, /weeds/, your top guide.</li>
</ul>
<h4>Step 9. Settings worth a minute</h4>
<ul>
<li>Data retention 14 months (To-Do list), internal traffic filter (To-Do list), Google signals on (Admin → Data collection) for age/interest reports.</li>
<li>Admin → Data streams → web → Configure tag settings → <b>List unwanted referrals</b>: add <code>checkout.stripe.com</code> once tips are live, so a tip doesn’t restart the visit.</li>
<li>Privacy: GA4 and Clarity both need a privacy policy on the site (the To-Do list has it). A cookie banner isn’t generally expected for a US-only site today; if EU visitors ever matter, add Google Consent Mode. Not legal advice.</li>
</ul>`,
  utm: `
<p>Every link you post anywhere gets tags, all lowercase, so GA4 → Reports → Acquisition → Traffic acquisition shows exactly what worked.</p>
<table class="pb-table"><thead><tr><th>Tag</th><th>Use</th><th>Examples</th></tr></thead><tbody>
<tr><td>utm_source</td><td>Where</td><td>instagram, facebook, youtube, tiktok, pinterest, x, threads, nextdoor, reddit, newsletter, door_note, bedford_bee</td></tr>
<tr><td>utm_medium</td><td>What kind</td><td>social, email, qr, referral, pwa</td></tr>
<tr><td>utm_campaign</td><td>Why</td><td>bio, profile, weekly, the post slug (e.g. lawn-soil-test), 2026-12-newsletter</td></tr>
<tr><td>utm_content</td><td>Which version (optional)</td><td>reel, story, pin-a, pin-b</td></tr>
</tbody></table>
<p>The Social queue already adds these. Never tag links between pages on your own site; it breaks the original source.</p>`,
  looker: `
<p>Looker Studio is free and pulls straight from GA4 and Search Console with your Google login. No tokens.</p>
<ol class="pb-steps">
<li><b>Create:</b> lookerstudio.google.com → Blank report → Add data → <b>Google Analytics</b> → your GA4 property. Then Add data → <b>Search Console</b> → mowittall.com → <b>URL impression</b> (add it again as <b>Site impression</b> for the totals).</li>
<li><b>Theme:</b> Theme and layout → custom colors #173d27 (background), #2f6e47 (cards), #f6c945 (accent). Add a date range control (default Last 28 days, compare to previous period) on every page.</li>
<li><b>Page 1: Overview.</b> Scorecards with comparison: Users, Sessions, Key events, Quiz completions (Event count where event name = quiz_complete), Quiz completion rate (quiz_complete ÷ quiz_start, as a calculated field), Search clicks, Impressions, Average position. Time series of Sessions and Clicks.</li>
<li><b>Page 2: SEO.</b> Search Console table: Query, Clicks, Impressions, CTR, Average position (sorted by clicks). Second table by Landing page. Calculated field “Branded” = <code>REGEXP_MATCH(LOWER(Query), ".*(mow it tall|mowittall|mow tall).*")</code> as a filter control.</li>
<li><b>Page 3: Content.</b> GA4 table: Content group, Page title, Views, Engaged sessions, Average engagement time, Key events. Bar chart by post_topics.</li>
<li><b>Page 4: Tools and conversions.</b> Bar chart: Event count by tool_name (filter event = tool_use). Funnel steps as a table: quiz_start, quiz_step, quiz_complete, calendar_download counts. Games: average score by game_name.</li>
<li><b>Page 5: Social and sources.</b> Sessions and Key events by Session source / medium and Session campaign. A filter for medium = social.</li>
<li><b>Email it to yourself:</b> Share → Schedule delivery → every Monday 8 a.m.</li>
<li><b>Put it in HQ:</b> File → Embed report → Enable embedding → copy the <b>Embed URL</b> → paste it in the box below. It shows here for you (you need to be signed in to Google in this browser).</li>
</ol>`,

  /* ===== Social tab ===== */
  socialSetup: `
<h4>Names</h4>
<ul>
<li><b>Handle: @mowittall everywhere.</b> If one is taken, use the same fallback everywhere: <b>@mowittallmike</b>. Not underscores or numbers (hard to say out loud).</li>
<li><b>Display name:</b> “Mow It Tall | Mike the Lawn Guy” where there’s room (Instagram, TikTok, X, YouTube). Facebook Page and Pinterest: “Mow It Tall”. Search inside each app matches the display name, so “lawn guy” in it helps people find you.</li>
<li><b>Same profile picture everywhere:</b> the pixel mower icon (best at tiny sizes), or a photo of you on the stripes. Pick one and use it on all of them.</li>
<li>Reserve the handle on Bluesky and LinkedIn too, even if you never post.</li>
</ul>
<h4>The bio formula</h4>
<p>Who you are + what you give + what to do next + the link. Keep the voice.</p>
<ul>
<li><b>Instagram / TikTok / Threads (150 chars):</b> <i>Bedford, NY’s lawn guy. Small changes, big stripes. Free 2-minute lawn plan below 👇</i></li>
<li><b>X (160 chars):</b> <i>The easy guide to a better lawn. Hot takes, stripes and zero gas leaf blowers. Bedford, NY. Free lawn plan 👇</i></li>
<li><b>YouTube (About):</b> <i>I’m Mike, the lawn guy from Bedford, NY. Short videos on mowing, stripes, seed and fixing lawns without becoming a lawn guy. New videos every week. Free lawn plan: mowittall.com/plan</i></li>
<li><b>Facebook Page (Intro):</b> <i>Easy, funny lawn care for regular homeowners in Westchester and the Northeast. Free lawn plan, live lawn tools and the Hall of Fame.</i> Category: <b>Home & Garden Website</b> (or Personal Blog).</li>
<li><b>Pinterest:</b> <i>Easy lawn care for beginners: mowing, seed, weeds, fertilizer and lawn stripes. Northeast cool-season lawns.</i> Business account (free).</li>
<li><b>Nextdoor:</b> post as yourself (neighbor first, never salesy). A business page only if you ever offer a service.</li>
</ul>
<h4>Exactly which link goes where</h4>
<table class="pb-table"><tbody>
<tr><td>Instagram bio</td><td><code>${bio('instagram')}</code></td></tr>
<tr><td>TikTok bio</td><td><code>${bio('tiktok')}</code> (TikTok shows a clickable link once you have 1,000 followers or switch to a business account)</td></tr>
<tr><td>X website</td><td><code>${bio('x')}</code></td></tr>
<tr><td>Threads bio</td><td><code>${bio('threads')}</code></td></tr>
<tr><td>Facebook Page website</td><td><code>${SITE}/?utm_source=facebook&amp;utm_medium=social&amp;utm_campaign=profile</code></td></tr>
<tr><td>YouTube channel links</td><td>1) Free lawn plan <code>${SITE}/plan/?utm_source=youtube&amp;utm_medium=social&amp;utm_campaign=profile</code> 2) Instagram 3) TikTok</td></tr>
<tr><td>YouTube video descriptions</td><td>First line: the matching guide or post, tagged <code>utm_source=youtube&amp;utm_medium=social&amp;utm_campaign=&lt;post-slug&gt;</code></td></tr>
<tr><td>Pinterest</td><td>Claim mowittall.com (Settings → Claimed accounts; send me the meta tag). Each pin links to its post with <code>utm_source=pinterest&amp;utm_medium=social&amp;utm_campaign=&lt;post-slug&gt;</code></td></tr>
<tr><td>Reddit profile</td><td><code>${SITE}/?utm_source=reddit&amp;utm_medium=social&amp;utm_campaign=profile</code></td></tr>
</tbody></table>
<p><b>Link it all together:</b> every profile links to the site; the site footer links to every profile (once you send me the links); YouTube links to Instagram and TikTok; Instagram links Threads automatically. That loop is how Google and AI engines learn they’re all you.</p>
<h4>What to post where (realistic version)</h4>
<ul>
<li><b>One short vertical video, three places:</b> Instagram Reels, TikTok and YouTube Shorts, 2–3 times a week. Stripe timelapses, before/after, “the 10-second tip,” hot takes to camera. No watermarks when cross-posting (download the clean file).</li>
<li><b>Facebook:</b> one link post a week from the HQ queue (Facebook shows the share card), plus the Reels.</li>
<li><b>Pinterest:</b> 5 pins a week (schedule them in Pinterest). Every guide and post deserves 2–3 pins.</li>
<li><b>YouTube long-form:</b> once a month, 5–8 minutes (“Fall overseeding start to finish in my yard”). These get found in Google for years.</li>
<li><b>X / Threads:</b> the hot takes. Low effort, reuse the hooks.</li>
<li><b>Nextdoor:</b> twice a month, seasonal and genuinely helpful.</li>
</ul>
<h4>Best practices</h4>
<ul>
<li>Hook in the first line or first 2 seconds. Captions on every video (most people watch muted).</li>
<li>3–5 specific hashtags on Instagram, not 30. The HQ queue adds them.</li>
<li>Reply to every comment in the first hour. Pin your best post to the top of each profile.</li>
<li>Write alt text on Instagram and Facebook photos. Keep faces, house numbers and street signs out of yard shots.</li>
<li>Never buy followers or use engagement pods. It kills reach.</li>
<li>Schedule in batches: Meta Business Suite (Facebook + Instagram), YouTube Studio, TikTok’s desktop scheduler, Pinterest’s built-in scheduler. All free.</li>
</ul>`,

  /* ===== Build plan tab ===== */
  app: `
<h4>1. Installable web app (PWA): started</h4>
<ul class="pb-done"><li>Icons, home-screen name, manifest with shortcuts (done tonight)</li></ul>
<ul>
<li><b>Next: offline mode.</b> A service worker caches the calendar, plan, weed board and games so they open with no signal (the backyard has bad Wi-Fi).</li>
<li><b>“Add to Home Screen” button</b> on Android, and a short how-to on iPhone (Share → Add to Home Screen).</li>
<li><b>Push notifications</b> for the alerts (soil temperature, holiday feedings, watering). Web push is free and works on Android and on iPhone once added to the home screen. Needs the alerts from the CRM plan.</li>
<li>Track installs in GA4 (an <code>app_installed</code> event and the <code>utm_source=pwa</code> start link already in the manifest).</li>
</ul>
<h4>2. Google Play Store</h4>
<ul>
<li>Package the PWA as a <b>Trusted Web Activity</b> with PWABuilder.com (free). The app is your live site, so updates ship with every deploy.</li>
<li>Google Play developer account: $25 once. Add <code>/.well-known/assetlinks.json</code> (I add it) so the app opens full-screen without a browser bar.</li>
<li>New personal developer accounts must run a <b>closed test with at least 12 testers for 14 days</b> before going public. Line up friends and neighbors with Android phones.</li>
<li>Store listing: screenshots of the plan, calendar, weed board and stripe game; the share-card style for the feature graphic (1024×500).</li>
</ul>
<h4>3. Apple App Store</h4>
<ul>
<li>Apple developer account: $99 a year.</li>
<li>Apple rejects apps that are basically a website (guideline 4.2). Wait until it has app-only value: push alerts, offline, accounts with saved plans, maybe a widget showing “today’s lawn job.”</li>
<li>Wrap with PWABuilder’s iOS package or Capacitor; you’ll need a Mac with Xcode (or a cloud Mac service) to submit.</li>
</ul>
<p><b>Order:</b> offline + install button → accounts and alerts (CRM) → push → Play Store → App Store.</p>`,
  products: `
<h4>Ebook: “The Lazy Lawn Playbook” (working title)</h4>
<ul>
<li><b>What:</b> 30–40 pages, phone-friendly PDF. Your voice, your photos, your rules. Built from your own guides and calendar, never from the Lawn Care Nut ebooks.</li>
<li><b>Outline:</b> 1) The 6 small changes · 2) Know your grass · 3) The year on one page (calendar) · 4) Mowing and stripes · 5) Feeding on the holidays · 6) Seed in fall, step by step · 7) Weeds: kill, crowd out or ignore · 8) Soil test in 20 minutes · 9) Fix it: bare spots, dog spots, grubs, moss · 10) Gear you need (and don’t) · Bonus: printable checklists.</li>
<li><b>Plan:</b> free in exchange for an email first (the best sign-up gift you can offer). Later, a paid “Pro” edition ($9–15) with the yard-by-yard plans, sold through Stripe.</li>
<li><b>How:</b> I draft from the site content and lay it out in the site’s style; you add stories and photos and approve every page.</li>
</ul>
<h4>Course: “Your First Great Lawn”</h4>
<ul>
<li><b>Free version (start here):</b> the 6-week email drip from the CRM plan. One email a week, matched to the season, each with one job.</li>
<li><b>Paid version (later):</b> short videos filmed in your yard through one full season (spring cleanup → summer mowing → fall overseeding), checklists and the ebook, behind member accounts on the site. Sell with Stripe; $29–49 is the usual range for a beginner course.</li>
<li><b>Film as you go:</b> every video doubles as YouTube and Reels content, so the course builds itself while you post.</li>
<li><b>Needs first:</b> email service + accounts (CRM phases 1–2) and the Stripe account.</li>
</ul>`,
};

export const PLAYBOOK = { updated: '2026-11-15', groups: GROUPS, todos: TODOS, guides: GUIDES };
