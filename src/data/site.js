// Site-wide settings Mike fills in.

// "Buy me a beer" tip links. Paste a Ko-fi, Buy Me a Coffee or Stripe Payment Link URL.
// One link is fine (TIP_URL); if you make separate $5 / $10 Stripe links, fill TIP_5 / TIP_10 and they win.
// While all three are empty, the beer buttons show "Tip jar coming soon" instead of linking anywhere.
export const TIP_URL = '';
export const TIP_5 = '';
export const TIP_10 = '';
export const tipLink = (amt) => (amt === 5 ? TIP_5 : amt === 10 ? TIP_10 : '') || TIP_URL;
export const TIPS_ON = Boolean(TIP_URL || TIP_5 || TIP_10);
