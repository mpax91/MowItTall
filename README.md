# Mow It Tall

The easy guide to a better lawn. Built with Astro, hosted on Cloudflare Pages.

- `npm install`, then `npm run dev` to work locally, `npm run build` to build into `dist/`.
- Cloudflare Pages settings: framework preset **Astro**, build command `npm run build`, output directory `dist`.
- Preview builds are kept out of search engines (`public/robots.txt`, `public/_headers`, and the robots meta tag). Remove all three when mowittall.com is connected.

## Adding a blog post or guide (checklist)

- Frontmatter: `title`, `description`, `seoTitle`, `seoDescription`, `date`, `topics`, `faq` (posts also `tag`, `minutes`, optional `widget`).
- Social copy: add a `SOCIAL['<slug>']` entry in `src/data/social.js`.
- **Pinterest (automatic):** every post and guide gets a 1000×1500 pin at `/pin/<blog|guides>-<slug>.jpg` (`src/data/pins.js`, drawn by `src/pages/pin/[slug].jpg.js`), a hidden `data-pin-media` image for the Save button, a "Save to Pinterest" row, and a card in HQ → Social → Pinterest. Check that:
  - `seoTitle` reads well as the pin's big headline (it says what the post is; under ~60 characters), or set `pinTitle`.
  - The yellow line works: by default it's the post title (or the guide's short answer) when that doesn't repeat the headline; set `pinLine` to control it.
  - A new `widget:` gets a friendly name in `PIN_TOOLS` (else the pin says "Free Interactive Tool").
  - Optional `pinPhoto:` (front-yard-may, backyard-stripes, frosty-stripes-november) for seasonal posts.
  - The build audit (`dist/_audit/report.json`, Share agent) warns if a pin is missing or the description is off.
  - When the pin design changes, bump `PIN_V` in `src/data/pins.js`.
