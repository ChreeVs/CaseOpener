export const STARTING_CREDITS = 28;
export const AUTO_SAVE_MS = 4000;
export const ACTIVE_TICK_MS = 1000;
export const OFFLINE_CAP_MS = 1000 * 60 * 60 * 8; // 8 hours
export const INVENTORY_PAGE_SIZE = 72;
export const CASE_PRICE_CREDIT_MULTIPLIER = 100;

export const CASE_PRESTIGE_ECONOMY = [
  { minPrice: 1, maxPrice: 38, valueScale: 1, targetRoi: 0.74 },
  { minPrice: 32, maxPrice: 70, valueScale: 1.8, targetRoi: 0.72 },
  { minPrice: 58, maxPrice: 130, valueScale: 3.2, targetRoi: 0.7 },
  { minPrice: 105, maxPrice: 260, valueScale: 6, targetRoi: 0.69 },
  { minPrice: 220, maxPrice: 560, valueScale: 12, targetRoi: 0.68 },
  { minPrice: 520, maxPrice: 1250, valueScale: 25, targetRoi: 0.67 },
  { minPrice: 1050, maxPrice: 2600, valueScale: 52, targetRoi: 0.66 },
  { minPrice: 2300, maxPrice: 5400, valueScale: 105, targetRoi: 0.65 },
  { minPrice: 5200, maxPrice: 9800, valueScale: 165, targetRoi: 0.64 }
];
