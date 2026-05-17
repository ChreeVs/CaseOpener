export const STARTING_CREDITS = 28;
export const AUTO_SAVE_MS = 4000;
export const ACTIVE_TICK_MS = 1000;
export const OFFLINE_CAP_MS = 1000 * 60 * 60 * 8; // 8 hours
export const INVENTORY_PAGE_SIZE = 72;
export const CASE_PRICE_CREDIT_MULTIPLIER = 100;
export const CASE_MAX_PRESTIGE_UNLOCK = 15;

export const CASE_PRESTIGE_ECONOMY = [
  { minPrice: 1, maxPrice: 38, valueScale: 1, targetRoi: 0.74 },
  { minPrice: 32, maxPrice: 70, valueScale: 1.8, targetRoi: 0.72 },
  { minPrice: 58, maxPrice: 130, valueScale: 3.2, targetRoi: 0.7 },
  { minPrice: 105, maxPrice: 260, valueScale: 6, targetRoi: 0.69 },
  { minPrice: 220, maxPrice: 560, valueScale: 12, targetRoi: 0.68 },
  { minPrice: 520, maxPrice: 1250, valueScale: 25, targetRoi: 0.67 },
  { minPrice: 1050, maxPrice: 2600, valueScale: 52, targetRoi: 0.66 },
  { minPrice: 2300, maxPrice: 5400, valueScale: 105, targetRoi: 0.65 },
  { minPrice: 5200, maxPrice: 9800, valueScale: 165, targetRoi: 0.64 },
  { minPrice: 8500, maxPrice: 17000, valueScale: 260, targetRoi: 0.63 },
  { minPrice: 13500, maxPrice: 29000, valueScale: 420, targetRoi: 0.62 },
  { minPrice: 22000, maxPrice: 50000, valueScale: 680, targetRoi: 0.61 },
  { minPrice: 36000, maxPrice: 85000, valueScale: 1100, targetRoi: 0.6 },
  { minPrice: 60000, maxPrice: 145000, valueScale: 1750, targetRoi: 0.59 },
  { minPrice: 98000, maxPrice: 240000, valueScale: 2750, targetRoi: 0.58 },
  { minPrice: 160000, maxPrice: 390000, valueScale: 4200, targetRoi: 0.57 }
];
