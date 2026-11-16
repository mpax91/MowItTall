// Site-wide settings Mike fills in.

// Public contact email (Contact page, Privacy page, structured data).
export const CONTACT_EMAIL = 'MowItTall@gmail.com';

// "Buy me a beer" tip links. Paste a Ko-fi, Buy Me a Coffee or Stripe Payment Link URL.
// One link is fine (TIP_URL); if you make separate $5 / $10 Stripe links, fill TIP_5 / TIP_10 and they win.
// While all three are empty, the beer buttons show "Tip jar coming soon" instead of linking anywhere.
export const TIP_URL = '';
export const TIP_5 = '';
export const TIP_10 = '';
export const tipLink = (amt) => (amt === 5 ? TIP_5 : amt === 10 ? TIP_10 : '') || TIP_URL;
export const TIPS_ON = Boolean(TIP_URL || TIP_5 || TIP_10);

// Social profiles. Paste each full profile URL once the account exists (leave '' until then).
// Filled-in profiles show as icons in the footer and go into the site's structured data (sameAs),
// which is how Google and AI answer engines connect the website, the brand and Mike's accounts.
export const SOCIAL_PROFILES = {
  instagram: '',   // https://www.instagram.com/mowittall/
  facebook: '',    // https://www.facebook.com/mowittall
  youtube: '',     // https://www.youtube.com/@mowittall
  tiktok: '',      // https://www.tiktok.com/@mowittall
  x: '',           // https://x.com/mowittall
  threads: '',     // https://www.threads.com/@mowittall
  pinterest: '',   // https://www.pinterest.com/mowittall/
  reddit: '',      // https://www.reddit.com/user/mowittall/
  nextdoor: '',    // Nextdoor business page URL
};
export const X_HANDLE = ''; // '@mowittall' once the X account exists (adds twitter:site to every page)
export const SAME_AS = Object.values(SOCIAL_PROFILES).filter(Boolean);
