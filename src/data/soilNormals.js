// Typical soil temperature by month for the month pages (°F, top ~3 inches, daily means).
// Default "Northeast" numbers are Westchester, NY (Bedford, 41.20, -73.64), 2021–2025, from
// Open-Meteo's historical archive (ERA5 reanalysis, soil_temperature_0_to_7cm_mean). Pulled Nov 16, 2026.
// early = average of days 1–7, late = days 24–end, avg = whole month, lo/hi = 10th/90th percentile days.
// Visitors with a ZIP get the same numbers for their spot, computed in the browser (MonthSoil.astro).
export const NE_SOIL = [
  { early: 37, late: 33, avg: 34, lo: 28, hi: 40 },
  { early: 32, late: 35, avg: 34, lo: 29, hi: 41 },
  { early: 38, late: 44, avg: 41, lo: 34, hi: 49 },
  { early: 45, late: 52, avg: 49, lo: 42, hi: 58 },
  { early: 54, late: 61, avg: 58, lo: 50, hi: 66 },
  { early: 65, late: 72, avg: 68, lo: 62, hi: 75 },
  { early: 73, late: 74, avg: 74, lo: 70, hi: 79 },
  { early: 72, late: 71, avg: 72, lo: 67, hi: 77 },
  { early: 68, late: 62, avg: 65, lo: 59, hi: 71 },
  { early: 61, late: 54, avg: 56, lo: 50, hi: 63 },
  { early: 51, late: 40, avg: 45, lo: 36, hi: 55 },
  { early: 38, late: 35, avg: 37, lo: 30, hi: 45 },
];
export const NE_YEARS = [2021, 2025];

// Same zones as the live soil thermometer (SoilGauge.astro).
export const SOIL_ZONES = [
  { id: 'asleep', min: 25, max: 40, name: 'Asleep', what: 'grass is dormant' },
  { id: 'waking', min: 40, max: 50, name: 'Waking up / winding down', what: 'roots work, blades barely grow' },
  { id: 'go', min: 50, max: 56, name: 'Go time', what: 'crabgrass sprouts near 55°F in spring; seed still sprouts in fall' },
  { id: 'growing', min: 56, max: 68, name: 'Prime growing', what: 'grass grows fast' },
  { id: 'heat', min: 68, max: 85, name: 'Heat stress', what: 'cool-season grass struggles' },
];
