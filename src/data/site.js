// Site-wide settings Mike fills in.

// Public contact email (Contact page, Privacy page, structured data).
export const CONTACT_EMAIL = 'MowItTall@gmail.com';

// "Buy me a beer" tip links. Paste a Ko-fi, Buy Me a Coffee or Stripe Payment Link URL.
// One link is fine (TIP_URL); if you make separate $5 / $10 Stripe links, fill TIP_5 / TIP_10 and they win.
// While all three are empty, the beer buttons show "Tip jar coming soon" instead of linking anywhere.
export const TIP_URL = 'https://buy.stripe.com/3cI3cu2C09wzfB62Kr6Ri00'; // Stripe pay-what-you-want: $5 suggested, $2–$100
export const TIP_5 = '';
export const TIP_10 = '';
export const tipLink = (amt) => (amt === 5 ? TIP_5 : amt === 10 ? TIP_10 : '') || TIP_URL;
export const TIPS_ON = Boolean(TIP_URL || TIP_5 || TIP_10);

// Social profiles (Mike's official @mowittall accounts). Paste each full profile URL once the account exists.
// Filled-in profiles show in the footer, on /links/ and /contact/, in /llms.txt, and in the Organization
// structured data (sameAs), which is how Google and AI answer engines connect the website and the brand's accounts.
// Order here = order on the site.
export const SOCIAL_PROFILES = {
  instagram: 'https://www.instagram.com/mowittall/',
  youtube: 'https://www.youtube.com/@MowItTALL',
  facebook: 'https://www.facebook.com/MowItTALL',
  threads: 'https://www.threads.com/@mowittall',
  x: 'https://x.com/MowItTALL',
  tiktok: '',      // https://www.tiktok.com/@mowittall
  pinterest: 'https://www.pinterest.com/mowittall/',
  reddit: 'https://www.reddit.com/user/MowItTALL/',
  bluesky: 'https://bsky.app/profile/mowittall.com',
  linkedin: '',    // https://www.linkedin.com/company/mowittall/
  nextdoor: 'https://nextdoor.com/page/mowittall-bedford-hills-ny',
};
export const SOCIAL_NAMES = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', x: 'X', threads: 'Threads', pinterest: 'Pinterest', reddit: 'Reddit', bluesky: 'Bluesky', linkedin: 'LinkedIn', nextdoor: 'Nextdoor' };
// [key, name, url, handle] for every filled-in profile, in order.
export const SOCIALS = Object.entries(SOCIAL_PROFILES).filter(([, u]) => u).map(([k, u]) => {
  const m = u.match(/@([\w.]+)|\.com\/([\w.]+)\/?$/);
  return [k, SOCIAL_NAMES[k] || k, u, m ? '@' + (m[1] || m[2]) : ''];
});
// The ones shown as buttons on the site. Every filled-in profile still goes into sameAs and /llms.txt.
export const SOCIAL_MAIN = ['facebook', 'instagram', 'threads', 'youtube', 'x', 'pinterest']; // shown in this order (Mike, Nov 16)
export const SOCIALS_MAIN = SOCIAL_MAIN.map((k) => SOCIALS.find(([x]) => x === k)).filter(Boolean);
export const SOCIALS_MORE = SOCIALS.filter(([k]) => !SOCIAL_MAIN.includes(k));
export const X_HANDLE = '@MowItTALL'; // adds twitter:site to every page
// Brand accounts go on the Organization. Mike's own personal profiles (if he ever wants them tied to the site)
// go here instead and land on the Person entity. Keep the two separate: a brand page isn't a person.
export const MIKE_PROFILES = [];
export const SAME_AS = SOCIALS.map(([, , u]) => u);
