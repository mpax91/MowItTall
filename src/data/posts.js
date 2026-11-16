// All blog posts, newest first. Import from pages that list posts.
export function allPosts(globbed) {
  return Object.values(globbed)
    .map((p) => ({ ...p.frontmatter, url: String(p.url).replace(/\/?$/, '/') }))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || String(a.title).localeCompare(String(b.title)));
}
