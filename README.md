# Mow It Tall

The easy guide to a better lawn. Built with Astro, hosted on Cloudflare Pages.

- `npm install`, then `npm run dev` to work locally, `npm run build` to build into `dist/`.
- Cloudflare Pages settings: framework preset **Astro**, build command `npm run build`, output directory `dist`.
- Preview builds are kept out of search engines (`public/robots.txt`, `public/_headers`, and the robots meta tag). Remove all three when mowittall.com is connected.

## Adding a blog post or guide (checklist)

- Frontmatter: `title`, `description`, `seoTitle`, `seoDescription`, `date`, `topics`, `faq` (posts also `tag`, optional `widget`).
- **Post titles:** short and in Title Case (the H1 and listings). The long keyword version goes in `seoTitle`.
- **Posts:** `summary:` (1–3 plain sentences: what's in the post; shown in the "In Short" table at the top) and `related:` (3 hand-picked URLs, posts, guides or `/weeds/`, for Read These Next). No byline; read time is computed from the word count.
- **Internal links:** link related posts/guides in the text by hand where it reads naturally. `src/data/autolinks.js` also links the first mention of key phrases automatically at build time (max 6 per page; `autolink: false` turns it off for a page). Add a phrase there when you publish a page that owns a topic.
- Social copy: add a `SOCIAL['<slug>']` entry in `src/data/social.js`.
- **Pinterest (automatic):** every post and guide gets a 1000×1500 pin at `/pin/<blog|guides>-<slug>.jpg` (`src/data/pins.js`, drawn by `src/pages/pin/[slug].jpg.js`), a hidden `data-pin-media` image for the Save button, the Pinterest option in the "Share This" box (`ShareBox.astro`), and a card in HQ → Social → Pinterest. Check that:
  - `seoTitle` reads well as the pin's big headline (it says what the post is; under ~60 characters), or set `pinTitle`.
  - The yellow line works: by default it's the post title (or the guide's short answer) when that doesn't repeat the headline; set `pinLine` to control it.
  - A new `widget:` gets a friendly name in `PIN_TOOLS` (else the pin says "Free Interactive Tool").
  - Optional `pinPhoto:` (front-yard-may, backyard-stripes, frosty-stripes-november) for seasonal posts.
  - The build audit (`dist/_audit/report.json`, Share agent) warns if a pin is missing or the description is off.
  - When the pin design changes, bump `PIN_V` in `src/data/pins.js`.
