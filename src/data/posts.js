// All blog posts, newest first. Import from pages that list posts.
export function allPosts(globbed) {
  return Object.values(globbed)
    .map((p) => ({ ...p.frontmatter, url: String(p.url).replace(/\/?$/, '/') }))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || String(a.title).localeCompare(String(b.title)));
}

// Honest read time for posts and guides: words in the rendered article (src/lib/autolink.js) at ~220 a minute,
// plus a minute for an interactive tool. Falls back to the old hand-set `minutes`.
export function readMinutes(fm, words) {
  if (!words) return fm.minutes || 3;
  return Math.max(2, Math.ceil(words / 220) + (fm.widget ? 1 : 0));
}
