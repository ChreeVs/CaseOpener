export const STARTING_CREDITS = 28;
export const AUTO_SAVE_MS = 4000;
export const ACTIVE_TICK_MS = 1000;
export const OFFLINE_CAP_MS = 1000 * 60 * 60 * 8; // 8 hours
export const INVENTORY_PAGE_SIZE = 72;
export const CASE_PRICE_CREDIT_MULTIPLIER = 100;
export const CASE_MAX_PRESTIGE_UNLOCK = 15;

export const CASE_PRESTIGE_ECONOMY = [
  { minPrice: 1, maxPrice: 95, valueScale: 1, targetRoi: 0.68 },
  { minPrice: 75, maxPrice: 190, valueScale: 1.85, targetRoi: 0.66 },
  { minPrice: 155, maxPrice: 380, valueScale: 3.35, targetRoi: 0.64 },
  { minPrice: 320, maxPrice: 760, valueScale: 6.4, targetRoi: 0.62 },
  { minPrice: 650, maxPrice: 1500, valueScale: 12.8, targetRoi: 0.60 },
  { minPrice: 1300, maxPrice: 3100, valueScale: 25.8, targetRoi: 0.58 },
  { minPrice: 2700, maxPrice: 6200, valueScale: 53, targetRoi: 0.56 },
  { minPrice: 5400, maxPrice: 11800, valueScale: 108, targetRoi: 0.54 },
  { minPrice: 9800, maxPrice: 20500, valueScale: 172, targetRoi: 0.53 },
  { minPrice: 17000, maxPrice: 35000, valueScale: 275, targetRoi: 0.52 },
  { minPrice: 28500, maxPrice: 56000, valueScale: 445, targetRoi: 0.51 },
  { minPrice: 46000, maxPrice: 90000, valueScale: 720, targetRoi: 0.50 },
  { minPrice: 74000, maxPrice: 142000, valueScale: 1160, targetRoi: 0.49 },
  { minPrice: 118000, maxPrice: 220000, valueScale: 1840, targetRoi: 0.48 },
  { minPrice: 180000, maxPrice: 325000, valueScale: 2860, targetRoi: 0.47 },
  { minPrice: 260000, maxPrice: 470000, valueScale: 4300, targetRoi: 0.46 }
];
