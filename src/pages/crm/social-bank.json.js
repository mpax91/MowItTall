// Content pool for the auto social calendar (worker/plan.js reads it through ASSETS; /crm/* is 404 to the public).
import { allPosts } from '../../data/posts.js';
import { allPins } from '../../data/pins.js';
import { bankItems } from '../../data/socialBank.js';

export async function GET() {
  const posts = allPosts(import.meta.glob('../blog/[a-z]*.md', { eager: true }));
  const guides = Object.entries(import.meta.glob('../guides/[a-z]*.md', { eager: true }));
  const items = bankItems({ posts, guides, pins: allPins() });
  return new Response(JSON.stringify({ built: new Date().toISOString(), items }), { headers: { 'content-type': 'application/json' } });
}
