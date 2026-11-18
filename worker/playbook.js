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
  { id: 'd-tech', group: 'done', done: true, title: 'Technical SEO cleanup', body: 'Fixed blog canonicals (they pointed at addresses without the trailing slash, which redirect). Search, admin, 404 and the link page are noindex. Sitemap has last-modified dates and skips those pages. robots.txt blocks /admin/ and /api/. Organization + Person structured data. Title-cased and keyword-first page titles. Caching and security headers.' },
  { id: 'd-aeo', group: 'done', done: true, title: 'llms.txt for AI answer engines', body: '<a href="/llms.txt" target="_blank">mowittall.com/llms.txt</a> lists every guide, tool and post with a one-line summary and your core advice, built automatically on every deploy.' },
  { id: 'd-pwa', group: 'done', done: true, title: 'App icons and install manifest', body: 'Home-screen icons (Android, iPhone), a web app manifest with shortcuts (Plan, Calendar, Weeds). Step one of the app.' },
  { id: 'd-ga4', group: 'done', done: true, title: 'GA4 events in the code', body: 'The site now sends 19 events into GTM’s dataLayer (quiz start/steps/complete, calendar downloads, tool use, games, shares, search, plan button clicks, Hall votes/uploads, tips, location, yard size) plus page_type and content_group on every page. <b>They reach GA4 only after you set up the GTM tag</b> (next group).' },
  { id: 'd-shortlinks', group: 'done', done: true, title: 'Short links (HQ → Short Links)', body: 'Make mowittall.com/anything point anywhere: add, edit, delete, see clicks and download a print-ready QR code. No code needed. Try the starter set.' },
  { id: 'd-ga4v2', group: 'done', done: true, title: 'Full event tracking (50+ events)', body: 'Every quiz question (with drop-off and abandon), blog and site searches (plus searches with no results), outbound clicks, forms, FAQs, scroll depth and finished articles, nav clicks, card flips, picker choices, measure tool steps, prints, 404s and script errors. Email, subscribe, sign-up, program and donate events are reserved and documented for when those features exist. Full list on the Analytics tab.' },
  { id: 'd-merch', group: 'done', done: true, title: 'Merch page visible to Google again', body: 'Removed the noindex and put it back in the sitemap.' },
  { id: 'd-hq', group: 'done', done: true, title: 'HQ: to-dos, SEO agents, rank tracker, guides', body: 'This list, the SEO & AEO tab (agents, rank tracker), Analytics tab (GA4/GTM/Clarity/Looker steps), social setup plan and Build Plan tab.' },

  /* ---------- launch */
  { id: 'l-gtm', group: 'launch', pri: 'now', who: 'You', time: '15 min', link: 'analytics', title: 'Set up the GA4 event tag in Google Tag Manager', body: 'The site is sending 50+ events, but GTM has to forward them to GA4. Fastest: Analytics tab → <b>GTM import file</b> → download → GTM Import Container (Merge). Then Preview and Publish. Without this, GA4 only sees page views.' },
  { id: 'l-ai-bots', group: 'launch', pri: 'now', who: 'You', time: '5 min', title: 'Make sure Cloudflare isn’t blocking AI search crawlers', body: 'Cloudflare can block AI bots by default on new domains, which would hide you from ChatGPT, Perplexity and Claude answers.<ol><li>Cloudflare dashboard → mowittall.com → <b>AI Crawl Control</b> (older accounts: Security → Bots).</li><li>Turn <b>off</b> “Block AI bots” and don’t let Cloudflare manage your robots.txt with AI blocks.</li><li>If you’d rather block AI <i>training</i> but allow AI <i>search</i>: allow OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User; block GPTBot, ClaudeBot, CCBot, Google-Extended. For max AEO, allow all.</li><li>Open <a href="/robots.txt" target="_blank">mowittall.com/robots.txt</a> and confirm it only says Allow / plus Disallow /admin/ and /api/.</li></ol>' },
  { id: 'l-sitemap', group: 'launch', pri: 'now', who: 'You', time: '5 min', title: 'Submit the sitemap to Google and Bing', body: '<ol><li>Search Console → Indexing → Sitemaps → enter <code>sitemap-index.xml</code> → Submit. Status should say Success.</li><li>Bing Webmaster Tools → Sitemaps → Submit sitemap → <code>https://mowittall.com/sitemap-index.xml</code>.</li><li>Resubmitting isn’t needed after deploys: Google rereads it, and Bing gets every change through IndexNow automatically.</li></ol>' },
  { id: 'l-inspect', group: 'launch', pri: 'now', who: 'You', time: '10 min', title: 'Ask Google to index your best pages', body: 'Search Console → URL Inspection (top search bar) → paste a URL → Request indexing. Do about 10 a day (Google limits it): home, /plan/, /guides/, /weeds/, /calendar/, /measure/, then the guides and your best posts. The exact list is split into 7 daily batches below (Nov 16–22).' },
  { id: 'l-index-1', group: 'launch', pri: 'now', who: 'You', time: '10 min', title: 'Request indexing, batch 1 of 7 (Mon Nov 16)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/ · https://mowittall.com/plan/ · https://mowittall.com/guides/ · https://mowittall.com/weeds/ · https://mowittall.com/calendar/ · https://mowittall.com/measure/ · https://mowittall.com/lawn-101/ · https://mowittall.com/resources/ · https://mowittall.com/blog/ · https://mowittall.com/guides/when-to-stop-mowing/' },
  { id: 'l-index-2', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Request indexing, batch 2 of 7 (Tue Nov 17)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/guides/how-high-to-mow-grass/ · https://mowittall.com/guides/when-to-overseed-lawn/ · https://mowittall.com/guides/crabgrass-preventer-timing/ · https://mowittall.com/guides/how-often-to-water-lawn/ · https://mowittall.com/guides/when-to-fertilize-lawn/ · https://mowittall.com/guides/grubs-in-lawn/ · https://mowittall.com/guides/should-i-aerate-my-lawn/ · https://mowittall.com/guides/fix-bare-spots-in-lawn/ · https://mowittall.com/guides/moss-in-lawn/ · https://mowittall.com/games/' },
  { id: 'l-index-3', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Request indexing, batch 3 of 7 (Wed Nov 18)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/blog/holiday-lawn-fertilizer-schedule/ · https://mowittall.com/blog/grass-types-northeast/ · https://mowittall.com/blog/lawn-soil-test/ · https://mowittall.com/blog/how-to-read-a-fertilizer-bag/ · https://mowittall.com/blog/lawn-mowing-etiquette/ · https://mowittall.com/blog/mowing-the-lawn-is-a-workout/ · https://mowittall.com/blog/fall-kill-weeds-or-plant-seed/ · https://mowittall.com/blog/is-my-grass-seed-growing/ · https://mowittall.com/blog/should-i-hire-a-lawn-service/ · https://mowittall.com/blog/pre-emergent-vs-post-emergent/' },
  { id: 'l-index-4', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Request indexing, batch 4 of 7 (Thu Nov 19)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/blog/mulching-vs-bagging/ · https://mowittall.com/blog/one-third-rule-mowing/ · https://mowittall.com/blog/sharpen-your-mower-blade/ · https://mowittall.com/blog/lawn-mower-maintenance-diy/ · https://mowittall.com/blog/walk-behind-vs-riding-vs-zero-turn-mower/ · https://mowittall.com/blog/kid-and-pet-safe-lawn-care/ · https://mowittall.com/blog/dog-pee-kids-bouncy-houses-lawn/ · https://mowittall.com/blog/granules-vs-spray/ · https://mowittall.com/blog/spreader-settings-half-rate-twice/ · https://mowittall.com/blog/your-landscaper-is-scalping-your-lawn/' },
  { id: 'l-index-5', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Request indexing, batch 5 of 7 (Fri Nov 20)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/blog/stop-bagging-your-clippings/ · https://mowittall.com/blog/mulch-rake-or-blow-leaves/ · https://mowittall.com/blog/power-ranking-every-excuse-for-a-bad-lawn/ · https://mowittall.com/blog/halloween-is-the-lawn-super-bowl/ · https://mowittall.com/blog/lawn-stuff-you-dont-need/ · https://mowittall.com/blog/nitrogen-iron-lawn-before-party/ · https://mowittall.com/blog/animals-in-your-lawn/ · https://mowittall.com/blog/lawn-off-season-training/ · https://mowittall.com/blog/explain-lawn-hobby-to-your-spouse/ · https://mowittall.com/blog/lawn-compliments/' },
  { id: 'l-index-6', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Request indexing, batch 6 of 7 (Sat Nov 21)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/blog/lawn-care-dad-jokes/ · https://mowittall.com/blog/lawn-mowing-playlist/ · https://mowittall.com/hall/ · https://mowittall.com/yards/ · https://mowittall.com/neighbor/ · https://mowittall.com/merch/ · https://mowittall.com/blog/topic/weeds/ · https://mowittall.com/blog/topic/feeding/ · https://mowittall.com/blog/topic/mowing/ · https://mowittall.com/blog/topic/seeding/' },
  { id: 'l-index-7', group: 'launch', pri: 'soon', who: 'You', time: '10 min', title: 'Request indexing, batch 7 of 7 (Sun Nov 22)', body: 'Search Console → URL Inspection → paste each → Request indexing: https://mowittall.com/blog/topic/soil/ · https://mowittall.com/blog/topic/gear/ · https://mowittall.com/blog/topic/dogs-kids/ · https://mowittall.com/blog/topic/fun/' },
  { id: 'h-votes-sheet', group: 'site', pri: 'soon', who: 'Both', time: '30 min', title: 'Send Hall of Fame/Shame votes to a Google Sheet', body: 'Apps Script web app (doPost) on a Google Sheet; you deploy it and paste its URL into a Cloudflare secret (VOTES_SHEET_URL). I make the Worker send each upvote/downvote (photo, board, vote, time; no personal data) and a nightly score snapshot per photo. D1 stays the source of truth; the Sheet is for tracking and charts.' },
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
  { id: 'a-bq', group: 'analytics', pri: 'soon', who: 'You', time: '15 min', done: true, title: 'Link GA4 to BigQuery (free)', body: 'Done Nov 16: Google Cloud project “Mow It Tall Analytics” (mow-it-tall-analytics), US, daily event export. It’s the free sandbox (no card), so BigQuery keeps a rolling 60 days, handy for Looker Studio. The forever copy is the site’s own event log (Analytics tab → Our Own Event Log).' },
  { id: 'a-mikecos', group: 'analytics', pri: 'later', who: 'Both', time: '20 min', title: 'Pull the event log into MikeCOS', body: 'Same idea as the Bedford Bee’s GA tables in MikeCOS. 1) Cloudflare → mowittall → Settings → Variables and Secrets → add a Secret named <code>EXPORT_KEY</code> (any long random password; read-only, it can only download the event log). 2) Ask Claude to add a nightly MikeCOS job that calls <code>https://mowittall.com/api/admin/events/export?table=ev_days&amp;from=…</code> (and ev_landing, ev_pages, ev_geo, ev_dims, ev_clicks, ev_events) with an <code>x-export-key</code> header, stores them like the bee_ga_* tables, and adds a Mow It Tall card next to the Bee.' },
  { id: 'a-explore', group: 'analytics', pri: 'soon', who: 'You', time: '30 min', link: 'analytics', title: 'Build the 4 GA4 explorations', body: 'Quiz funnel, tool popularity, content by topic, landing pages that convert. Analytics tab → Step 7.' },
  { id: 'a-dash', group: 'analytics', pri: 'later', who: 'Claude', time: '1–2 sessions', title: 'Build the analytics dashboards (after social data is connected)', body: 'Replaces the Looker Studio report. <b>Wait until everything is configured</b>, including pulling in social media data like the Bedford Bee. Then: 1) <b>HQ → Analytics</b> sub-tabs built from our own event log: Overview (already there), SEO (organic + AI Assistant visits by landing page; Google queries/rankings via the rank tracker uploads), Content (blog vs guides vs tools, by topic), Tools &amp; conversions (quiz drop-off by step, tool popularity, calendar downloads, Hall uploads), Social (visits by platform next to the dates you marked posts as posted, plus the social data once it’s pulled in). 2) <b>MikeCOS</b>: a summary card next to the Bee (visits, quiz completions, top page, trend) via the <code>a-mikecos</code> export.' },

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
  { id: 's-autopilot', group: 'seo', pri: 'now', who: 'Both', time: '10 min, once', link: 'seo', title: 'Connect the SEO Autopilot to Google and Bing', body: 'Free. (1) Google Cloud project “Mow It Tall Analytics” → IAM → Service accounts → create one (no roles) → Keys → Add key → JSON. (2) Search Console → Settings → Users and permissions → Add user → the service account’s email, Full. (3) Cloudflare → Workers & Pages → mowittall → Settings → Variables and Secrets → Add → Secret GSC_SERVICE_ACCOUNT = the whole JSON file. (4) Bing Webmaster Tools → Settings → API access → generate key → secret BING_API_KEY. Then HQ → SEO & AEO → Check now.' },
  { id: 's-backlinks', group: 'seo', pri: 'soon', who: 'You', time: 'ongoing', title: 'Earn local links', body: '<ul><li>The Bedford Bee: a link to Mow It Tall in a story or the footer (fair game, it’s yours).</li><li>Local garden clubs, the library, Katonah/Bedford community groups and PTA newsletters: offer a free “lawn in 10 minutes” talk or tip sheet.</li><li>Patch, Westchester Magazine, The Journal News, River Journal: pitch the Halloween Super Bowl or mowing etiquette as a fun seasonal story.</li><li>Answer reporter requests on Qwoted, Featured.com or Help a B2B Writer as a homeowner lawn expert.</li><li>YouTube descriptions and Pinterest pins link back too.</li></ul>' },
  { id: 's-competitors', group: 'seo', pri: 'soon', who: 'You', time: 'read 5 min', title: 'Know who you’re up against (and how to beat them)', body: '<p>Who ranks today for your core searches (checked Nov 15):</p><ul>' +
    '<li><b>Lawn service marketplaces with huge blogs:</b> Lawn Love (lawnlove.com) and LawnStarter: thousands of how-to and state-by-state pages (“best time to plant grass in the Northeast”). Biggest competitors on almost every term.</li>' +
    '<li><b>Programmatic city sites:</b> lawnbyseason.com has an auto-generated page per city (Manhattan, Brooklyn, Poughkeepsie, Stamford…) for overseeding, aeration and pre-emergent timing. Direct competitor on “when to overseed in [town]”. Their weakness: generic, no real person, no photos.</li>' +
    '<li><b>Brands selling product:</b> Jonathan Green (“When to Overseed Lawn in New York”), Scotts, Pennington, The Andersons, GreenView, Sunday. Strong domains, but every answer ends in “buy our bag”.</li>' +
    '<li><b>Big home publishers:</b> Bob Vila, The Spruce, HGTV, Home Depot, Angi, Tom’s Guide, House Digest. Win on broad terms like “how to stripe your lawn” and “lawn care calendar”.</li>' +
    '<li><b>DIY lawn sites:</b> Lawn Phix (a New England lawn calendar), DoMyOwn, plus YouTube creators like the Lawn Care Nut. Closest to your audience.</li>' +
    '<li><b>Universities:</b> Cornell, Penn State, UConn and UMass extension pages. Trusted by Google; you cite them rather than fight them.</li>' +
    '<li><b>Local landscapers’ blogs</b> on Westchester terms (“crabgrass Westchester County NY”), and Reddit threads.</li></ul>' +
    '<p><b>Where you win:</b> 1) <i>local</i> (Bedford/Westchester/Lower Hudson Valley timing with the live soil reading; nobody national does that well), 2) <i>tools</i> (calculator, seed-now, rain meter, quiz: things people bookmark and link to), 3) <i>a real person with real stripes</i> (photos, video, first-person proof that Google’s “experience” signals reward), 4) <i>funny and shareable</i> (gets links and social shares the brands can’t). Don’t chase “lawn care tips” head-on yet. Go after local and long-tail searches first (“when to overseed in Westchester”, “crabgrass preventer Bedford NY”, “holiday lawn fertilizer schedule”), then broader ones as links build up.</p>' +
    '<p>Where you rank for each search is in the Rank Tracker (SEO & AEO tab), updated daily. To see who’s above you, search the term in a private window.</p>' },
  { id: 's-linkplan', group: 'seo', pri: 'soon', who: 'You', time: '2 hr / month', title: 'External link plan: get other sites to link to you', body: '<p>Links from other sites are the biggest thing between you and page one. In order of payoff:</p><ol>' +
    '<li><b>Local first (easiest, most relevant):</b> The Bedford Bee (a story or footer link), Katonah/Bedford/Pound Ridge community Facebook groups and newsletters, the Katonah Village Library, garden clubs (Bedford Garden Club, Katonah Garden Club), the Bedford Historical Society, PTA newsletters, the American Legion post site, local Patch and River Journal. Offer a free tip sheet, a “Lawn in 10 Minutes” talk, or the Halloween Super Bowl bit as a fun seasonal piece.</li>' +
    '<li><b>Local press pitches (twice a year):</b> spring (“The neighbor-approved rules of mowing etiquette”) and fall (“Why Halloween is the Super Bowl of lawns”) to The Journal News/lohud, Westchester Magazine, Patch, News 12 Westchester. Short email, your photo, the post link.</li>' +
    '<li><b>Be the quote:</b> sign up as a source on Qwoted, Featured.com and Help a B2B Writer. Reporters at Bob Vila, The Spruce, House Digest and Real Simple constantly need a homeowner “lawn expert” quote, and they link the site.</li>' +
    '<li><b>Linkable assets (I build, you promote):</b> the lawn calculator, holiday feeding schedule, mowing etiquette checker, the soil-temperature tracker and a yearly “Westchester Lawn Report” with your Hall votes and soil data. Original data and free tools are what bloggers link to.</li>' +
    '<li><b>Communities (links + AI citations):</b> helpful answers on Reddit (r/lawncare, r/Westchester, r/homeowners), the Lawn Care Nut Facebook group, and Quora. Link only when your page is the best answer.</li>' +
    '<li><b>Your own channels:</b> YouTube descriptions, Pinterest pins (each pin is a link), Instagram link-in-bio, Nextdoor posts, your LinkedIn and Bedford Bee bios.</li>' +
    '<li><b>Partners:</b> local hardware and garden centers (a printed QR card by the seed aisle pointing to mowittall.com/seed), and friendly lawn YouTubers (guest video or a stripe challenge).</li>' +
    '<li><b>Fix lost links:</b> when the 404 report in GA4 (page_not_found) shows a broken incoming link, add a short link or redirect.</li></ol>' +
    '<p><b>Never:</b> buy links, join link swaps or “guest post” farms, or use blog networks. Google penalizes them. Five real local links beat 500 junk ones. Track every link you earn in a to-do so you remember to thank them.</p>' },
  { id: 's-refresh', group: 'seo', pri: 'later', who: 'Both', time: 'seasonal', title: 'Refresh seasonal posts before their season', body: 'Six weeks before each season, update the matching posts and guides (crabgrass in March, overseeding in July, Halloween in September) and bump their <code>updated:</code> date. Only when something real changed.' },

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
  { id: 'm-service', done: true, group: 'crm', pri: 'soon', who: 'You', time: '10 min', link: 'members', title: 'Pick the email service', body: 'Resend (simplest, free to ~3,000 emails/month) or Postmark (best delivery). Or a newsletter tool (beehiiv, Kit) if you mostly want newsletters. This unlocks everything below.' },
  { id: 'm-address', done: true, group: 'crm', pri: 'soon', who: 'You', time: '', title: 'Choose a mailing address for emails', body: 'Marketing emails need a physical address in the footer. A PO box or a virtual mailbox works.' },
  { id: 'm-cf-send', group: 'crm', pri: 'now', who: 'You', time: '10 min', link: 'members', title: 'Turn on email sending for mowittall.com in Cloudflare', body: '<p>Cloudflare dashboard → <b>Compute → Email Service → Email Sending</b> (or search “Email Service”) → <b>Onboard domain</b> → mowittall.com → let it add the DNS records (SPF, DKIM, DMARC). Takes a few minutes to verify.</p><p>Then HQ → Email → Settings → put your Gmail in “test address” → open any email in Year at a Glance → <b>Send Me a Test</b>.</p>' },
  { id: 'm-cf-route', group: 'crm', pri: 'now', who: 'You', time: '5 min', link: 'members', title: 'Route replies to HQ (Email Routing)', body: '<p>Cloudflare → mowittall.com → <b>Email → Email Routing</b> → enable if asked → Routing rules → <b>Create address</b>: <code>mike@mowittall.com</code> → Action <b>Send to a Worker</b> → <code>mowittall</code>. Replies then land in HQ → Email → Inbox.</p><p>Want a copy in Gmail too? Add your Gmail under Destination addresses, verify it, then put it in HQ → Email → Settings → “Also forward replies to”.</p>' },
  { id: 'm-cf-queue', group: 'crm', pri: 'soon', who: 'Both', time: '10 min', title: 'Bounce and spam-complaint events (queue)', body: '<p>Cloudflare → <b>Queues</b> → Create <code>mowittall-mail-events</code>. Then Email Service → mowittall.com → <b>Event subscriptions</b> → send all sending events to that queue. Tell Claude and I’ll add the consumer line to wrangler.jsonc (the code is ready). Until then, hard failures at send time still stop email to that address.</p>' },
  { id: 'm-test-run', group: 'crm', pri: 'now', who: 'You', time: '10 min', link: 'members', title: 'Test the drip on yourself, then go live', body: '<p>1. Take the quiz on your phone and sign up with your own email. 2. HQ → Email → People → you → <b>Mark as test</b>. 3. Settings → <b>Test people only</b>. Your welcome email comes on the next hourly run (or tap “Send today’s email now”). 4. Check it in Gmail on your phone. 5. Settings → <b>Live</b>.</p>' },
  { id: 'm-copy', group: 'crm', pri: 'soon', who: 'You', time: '30 min', link: 'members', title: 'Review the email copy', body: 'HQ → Email → Year at a Glance → flip through all four effort levels and tap any email to preview it. Welcome emails, job subject lines and the monthly emails are Claude’s copy in your voice. Weekly emails reuse your social hooks. Tell Claude what to change.' },
  { id: 'm-ga4-lead', group: 'crm', pri: 'soon', who: 'Both', time: '5 min', title: 'Mark generate_lead as a GA4 key event', body: 'The quiz sign-up fires <code>generate_lead</code> (method quiz). GA4 → Admin → Events → Create event → Create with code → <code>generate_lead</code>, mark as key event, no value. Same as quiz_complete.' },
  { id: 'm-ping', group: 'crm', pri: 'soon', who: 'Claude', time: '1 hr', title: 'Get pinged when someone signs up for a program', body: '<p><b>My recommendation:</b> build it into the CRM rather than as a separate Apps Script project. When someone joins (email plan, drip course, alerts, texts), the Worker already has the sign-up in hand, so it can (1) email you instantly through the same email service, (2) add a line to the Members tab, and (3) optionally post a row to a Google Sheet.</p><p><b>If you want the Sheet now</b> (before the CRM): make a Google Sheet → Extensions → Apps Script → paste a 15-line <code>doPost</code> script I write that appends a row and emails you with <code>MailApp</code> → Deploy as a web app (“Anyone”) → send me the URL. The Worker posts each sign-up to it. Free, no API keys (just that private URL, which I store as a Cloudflare secret). Hall uploads can use the same hook.</p>' },
  { id: 'm-phase1', done: true, group: 'crm', pri: 'soon', who: 'Claude', time: '1 day', title: 'Phase 1: “Email me my plan + reminders”', body: 'On the quiz results. Sends their plan, then holiday feeding, crabgrass and seeding reminders. Double opt-in, one-click unsubscribe. Sign-ups show on the Members tab. Becomes the main GA4 key event (generate_lead).' },
  { id: 'm-drip', done: true, group: 'crm', pri: 'soon', who: 'Both', time: '', title: 'Drip: a full year of lawn email', body: 'One short email a week after signing up, matched to the season. I draft, you edit. Doubles as the free course (see Ebook and Course).' },
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
  { id: '$-thanks', group: 'money', pri: 'soon', who: 'Claude', time: '20 min', title: 'Thank-you page so paid tips are tracked', body: 'When the Stripe Payment Link exists, set its “after payment” redirect to mowittall.com/thanks/. I build that page (funny, with a share prompt) and fire the <code>donate</code> event with the amount, so GA4 shows real tips, not just clicks.' },
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
<p>The SEO Autopilot covers Search Console, Bing, indexing and the SEO checks. What’s left can’t be automated for free, and none of it is urgent:</p>
<ol class="pb-steps">
<li><b>Clarity → Dashboard</b> (monthly or after a redesign): rage clicks, dead clicks, quick backs. Watch 3 phone recordings of your top landing page.</li>
<li><b>Bing Webmaster → Recommendations</b> (monthly): Bing’s own SEO suggestions.</li>
<li><b>AI assistants:</b> nothing to do. Analytics → AI Assistants counts visits from ChatGPT, Perplexity, Claude, Gemini and Copilot automatically.</li>
<li><b>Monthly:</b> one new guide or post, and one link-building ask.</li>
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
<p><b>Only needed if the autopilot isn’t connected</b> (or for a one-off date range): export from Search Console (or Bing) and upload the file here. Each upload is saved as a snapshot. The tracker compares the newest snapshot with the one before it.</p>
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
<p>These run by themselves on every deploy (the only time results can change): they read every built page the way a search engine does and check it against a list of rules. No AI, no API keys. Anything new since the deploy before gets a yellow <b>New</b> tag.</p>
<ul>
<li><b>Page Check:</b> title and description length, one H1, canonical, noindex, share image, structured data, missing alt text, thin content, few internal links, duplicate titles.</li>
<li><b>Link Check:</b> every internal link: broken links, redirect hops, and orphan pages nothing links to.</li>
<li><b>Sitemap Watch:</b> what was added or removed since the last deploy, robots.txt and llms.txt.</li>
<li><b>Share Card Check:</b> every page’s share image exists, is the right size, and has a title and description.</li>
<li><b>AEO Readiness:</b> answer-first opening, FAQ data, question headings, author, dates and sources on posts and guides.</li>
</ul>`,

  /* ===== Analytics tab ===== */
  ga4Events: [
    ['— Quiz (the funnel) —', '', ''],
    ['quiz_start', 'Tapped Next on the first question', 'quiz_name'],
    ['quiz_step', 'Answered a question (one per question, so you see drop-off at each)', 'quiz_name, step_number, question_id, step_type, answer (ZIP → first 3 digits)'],
    ['quiz_back', 'Went back a question', 'quiz_name, step_number, question_id'],
    ['quiz_abandon', 'Left the page mid-quiz', 'quiz_name, step_number, question_id'],
    ['quiz_complete', '<b>Finished and saw their plan (main conversion)</b>', 'quiz_name, effort_level, lawn_profile, grass_pick, task_count'],
    ['quiz_result_click', 'Tapped a link in their plan', 'link_url, link_text'],
    ['quiz_print', 'Printed / saved the plan as PDF', 'quiz_name'],
    ['quiz_retake', 'Started over', 'quiz_name'],
    ['— Tools —', '', ''],
    ['tool_use', 'First real interaction with any tool on the page', 'tool_name'],
    ['tool_choice', 'Tapped an option in a picker (damage report, hire it, do I need, etc.)', 'tool_name, choice'],
    ['card_flip', 'Flipped a tip card, calendar card or weed card', 'card_id'],
    ['calendar_download', '<b>Downloaded an .ics calendar</b> (plan, /calendar/, holidays, seed tracker)', 'file_name, tool_name'],
    ['file_download', 'Saved another file (yard map image)', 'file_name, file_extension'],
    ['measure_open', 'Opened the full-screen yard measurer', 'area_count'],
    ['measure_area_added', 'Finished drawing an area', 'area_count'],
    ['yard_measured', 'Saved a yard measurement', 'yard_size'],
    ['location_set', 'Set their ZIP or used GPS', 'zip3, method'],
    ['— Search —', '', ''],
    ['search', 'Searched (site search page or the blog search box), after they stop typing', 'search_term, search_location (site / blog), results_count, topic'],
    ['search_no_results', 'Searched and got nothing: your next article ideas', 'search_term, search_location'],
    ['blog_filter', 'Tapped a topic chip on the blog', 'topic'],
    ['— Reading and navigation —', '', ''],
    ['scroll_depth', 'Read 25 / 50 / 75 / 90% of a post or guide', 'percent'],
    ['article_complete', 'Reached the end of a post or guide', 'read_seconds'],
    ['faq_open', 'Opened an FAQ answer', 'question'],
    ['details_open', 'Opened any other expandable section', 'question'],
    ['internal_link_click', 'Tapped a related post / guide / topic link', 'link_url, link_area'],
    ['nav_click', 'Tapped a header, footer or breadcrumb link', 'nav_area, link_text, link_url'],
    ['plan_cta_click', 'Tapped any button or link to the quiz', 'cta_location, cta_text'],
    ['outbound_click', 'Clicked out to another website', 'link_domain, link_url, link_text, link_area'],
    ['contact_click', 'Tapped an email, phone or text link', 'method, link_text'],
    ['print_page', 'Printed any page', '(none)'],
    ['— Community and sharing —', '', ''],
    ['share', 'Used the share sheet or copied a link/text', 'method, content_type, item_id'],
    ['form_submit', 'Submitted any form', 'form_id, form_location'],
    ['hall_upload', '<b>Submitted a Hall photo</b>', 'board'],
    ['hall_vote', 'Voted in the Hall', 'vote'],
    ['neighbor_send', 'Printed a neighbor door note', 'method'],
    ['game_start', 'Started a game round (homepage mower: first Hold; stripe game: mower started; whack: Start)', 'game_name, level_name'],
    ['game_complete', 'Finished a game round', 'game_name, level_name, score, new_best, coverage'],
    ['score_save', '<b>Saved a score to a leaderboard</b>', 'game_name, level_name, score'],
    ['social_profile_click', 'Tapped a social profile link', 'platform'],
    ['link_page_click', 'Tapped a button on /links/', 'target'],
    ['app_installed', 'Installed the site to their home screen', '(none)'],
    ['— Money —', '', ''],
    ['tip_click', 'Tapped a Buy Me a Beer link (intent)', 'amount'],
    ['— Site health —', '', ''],
    ['page_not_found', 'Landed on the 404 page (find broken links)', 'page_path, page_referrer'],
    ['js_error', 'A script broke on the page (max 3 per page)', 'error_message, error_source'],
    ['— Reserved: fire once these features exist —', '', ''],
    ['generate_lead', '<b>Email submitted</b> (“email me my plan”, ebook download). Main key event once live.', 'method, form_id'],
    ['newsletter_subscribe', 'Confirmed the double opt-in email', 'method'],
    ['sign_up', 'Created an account', 'method'],
    ['login', 'Signed in', 'method'],
    ['program_join', 'Joined a program (drip course, alerts, texts)', 'program_name'],
    ['donate', '<b>Tip actually paid</b> (Stripe sends them to a thank-you page)', 'value, currency'],
    ['purchase', 'Bought merch, the ebook or the course', 'value, currency, items'],
  ],
  ga4Params: ['quiz_name', 'step_number', 'question_id', 'step_type', 'answer', 'effort_level', 'lawn_profile', 'grass_pick', 'task_count', 'game_name', 'level_name', 'score', 'new_best', 'coverage', 'tool_name', 'choice', 'file_name', 'file_extension', 'search_term', 'search_location', 'results_count', 'topic', 'method', 'content_type', 'item_id', 'cta_location', 'cta_text', 'link_url', 'link_text', 'link_area', 'link_domain', 'nav_area', 'card_id', 'question', 'form_id', 'form_location', 'percent', 'read_seconds', 'zip3', 'yard_size', 'area_count', 'vote', 'board', 'amount', 'platform', 'target', 'page_path', 'page_referrer', 'error_message', 'error_source', 'program_name', 'value', 'currency'],
  ga4Dims: ['page_type', 'post_tag', 'post_topics', 'quiz_name', 'step_number', 'question_id', 'answer', 'effort_level', 'lawn_profile', 'grass_pick', 'game_name', 'level_name', 'tool_name', 'choice', 'search_term', 'search_location', 'topic', 'method', 'content_type', 'cta_location', 'cta_text', 'link_area', 'link_domain', 'link_url', 'nav_area', 'card_id', 'question', 'form_id', 'zip3', 'yard_size', 'vote', 'board', 'platform', 'target', 'file_name', 'page_referrer', 'error_message', 'program_name'],
  ga4Metrics: ['score', 'task_count', 'results_count', 'percent', 'read_seconds', 'area_count', 'coverage', 'amount'],
  ga4Page: 'Every page also pushes <code>page_type</code> (home, post, guide, tool, hub, topic, fun, page) and <code>content_group</code> (Blog posts, Guides, Tools, Hubs, Home, …) before GTM loads, plus <code>post_tag</code>, <code>post_topics</code> and <code>published</code> on posts and guides.',
  ga4Steps: `
<h4>Step 1. The Google tag (probably done)</h4>
<p>GTM → Tags → you should have a <b>Google Tag</b> with your G- Measurement ID, firing on <b>Initialization – All Pages</b>. Open it → Configuration settings → add parameters: <code>content_group</code> = <code>{{DLV - content_group}}</code> and <code>page_type</code> = <code>{{DLV - page_type}}</code> (make those variables in Step 2 first). Now every page view carries its content group, and GA4’s built-in “Content group” dimension fills in.</p>
<h4>Step 2–4, the fast way: import the ready-made container</h4>
<p>Use the <b>GTM import file</b> box below: paste your G- Measurement ID, tap Download, then GTM → Admin → <b>Import Container</b> → choose the file → workspace: Existing (Default) → <b>Merge</b> → <b>Rename conflicting tags, triggers and variables</b> → Confirm. It adds one GA4 event tag, one trigger and a variable for every parameter. Then go to <b>Preview</b> (below). If the import errors out, do Steps 2–4 by hand.</p>
<h4>Step 2. Data Layer Variables (by hand)</h4>
<p>GTM → Variables → User-Defined → New → <b>Data Layer Variable</b>, one per name. Name each “DLV - name”, put the exact name in “Data Layer Variable Name”, version 2:</p>
<p><code>page_type, content_group, post_tag, post_topics, published</code> plus every parameter in the events table: <code>{{PARAMS}}</code></p>
<h4>Step 3. One trigger for every site event (never needs updating)</h4>
<p>Triggers → New → <b>Custom Event</b> → Event name <code>.*</code> → check <b>Use regex matching</b> → This trigger fires on <b>Some Custom Events</b> → <code>Event</code> <b>does not start with</b> <code>gtm.</code> → name it “CE - Mow It Tall events”. New events I add later flow through automatically.</p>
<h4>Step 4. One GA4 event tag</h4>
<p>Tags → New → <b>Google Analytics: GA4 Event</b> → Measurement ID → Event Name = <code>{{Event}}</code> → Event Parameters: one row per parameter (name = plain name, value = its DLV). Trigger = “CE - Mow It Tall events”. The site clears old parameters before every event, so values never leak from one event into the next, and a parameter an event doesn’t have is simply not sent.</p>
<p><b>Preview</b> (top right) → open the site → take the quiz, download a calendar, search the blog, open an FAQ, click out to a source link. Every event shows in Tag Assistant and in GA4 → Admin → DebugView. <b>Submit</b> → name it “GA4 events v2” → Publish.</p>
<p>Duplicate tip: GA4’s Enhanced measurement also logs outbound clicks as <code>click</code>. Keep it or turn “Outbound clicks” off; the site’s <code>outbound_click</code> has more detail.</p>
<h4>Step 5. Custom dimensions and metrics</h4>
<p>GA4 → Admin → Custom definitions → Create custom dimension (scope <b>Event</b>; name = parameter). Dimensions:</p>
<p><code>{{DIMS}}</code></p>
<p>Custom metrics (Standard): <code>{{METRICS}}</code>. Data only shows from the day you create them. (<code>content_group</code> is built in; GA4 allows 50 event dimensions, this uses about 38.)</p>
<h4>Step 5b. The drop-off reports you asked for</h4>
<ul>
<li><b>Quiz drop-off by question:</b> Explore → Funnel exploration → steps: <i>quiz_start</i> → <i>quiz_step where step_number = 2</i> → … <i>= 9</i> → <i>quiz_complete</i>. Shows exactly which question loses people. Also a Free form with rows = question_id, values = Event count for quiz_abandon.</li>
<li><b>Starts vs completions:</b> Free form, rows = Event name, filter = quiz_start or quiz_complete, columns = Date. Completion rate = completes ÷ starts.</li>
<li><b>What people search for:</b> Free form, rows = search_term, columns = search_location, values = Event count. Then search_no_results the same way: that list is your content backlog.</li>
<li><b>What people click out to:</b> rows = link_domain, link_url (outbound_click).</li>
</ul>
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
<li>Page tags: <b>built into the site</b> (Base.astro sends <code>page_type</code>, <code>content_group</code>, <code>post_tag</code>, <code>post_topics</code> to Clarity on every page). No GTM tag needed. In Clarity → Recordings → Filters → Custom tags, pick e.g. content_group = Guides.</li>
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
<tr><td>utm_content</td><td>Which version (optional)</td><td>reel, story, pin-a, pin-b; door notes use the note id (friendly, potential, called, dandelions, fan)</td></tr>
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
