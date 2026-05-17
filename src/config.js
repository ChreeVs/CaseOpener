// Re-export all configuration for backward compatibility
export * from "./config/apiConfig.js";
export * from "./config/gameConfig.js";
export * from "./config/rarityConfig.js";
export * from "./config/wearTiersConfig.js";
export * from "./config/dropProfilesConfig.js";
export * from "./config/caseBlueprintsConfig.js";
export * from "./config/upgradeDefinitionsConfig.js";
export * from "./config/achievementsConfig.js";

// These configs weren't split in this pass but are kept here for now
export const ECONOMY_CONFIG = {
  sellFee: 0.07,
  tradeUpFloor: 0.58,
  tradeUpCeiling: 1.02,
  marketplaceRefreshMs: 1000 * 60 * 2,
  marketplaceOfferCount: 8,
  rareRevealTier: 4,
  collectionCreditBase: 22,
  collectionPermanentBonus: 0.006,
  autoSellMinTier: 1,
  eventRollBaseChance: 0.004,
  minigameDailySoftCap: 120,
  crashHouseEdge: 0.065,
  jackpotFee: 0.1,
  socialPotBotMultiplierMin: 0.8,
  socialPotBotMultiplierMax: 1.45,
  caseMasteryBaseRequirement: 8,
  caseMasteryRequirementScale: 6,
  caseMasteryRequirementGrowth: 1.42,
  caseMasteryLuckPerLevel: 0.004,
  caseMasteryLuckCap: 0.18
};

export const LIMITED_EVENTS = [
  {
    id: "operation_week",
    name: "Operation Week",
    description: "Piu' XP profilo, piu' contratti e un mercato piu' movimentato.",
    durationMs: 1000 * 60 * 8,
    cooldownMs: 1000 * 60 * 22,
    luckMultiplier: 1.08,
    valueMultiplier: 1.06,
    xpMultiplier: 1.5,
    marketMultiplier: 1.1
  },
  {
    id: "knife_fever",
    name: "Knife Fever",
    description: "Le chance Special Item respirano un po' di piu' per pochi minuti.",
    durationMs: 1000 * 60 * 5,
    cooldownMs: 1000 * 60 * 28,
    luckMultiplier: 1.12,
    rareMultiplier: 1.34,
    valueMultiplier: 1.04,
    marketMultiplier: 1
  },
  {
    id: "low_float_hunt",
    name: "Low Float Hunt",
    description: "Bonus valore per float bassi e Factory New.",
    durationMs: 1000 * 60 * 6,
    cooldownMs: 1000 * 60 * 24,
    luckMultiplier: 1.05,
    lowFloatMultiplier: 1.32,
    valueMultiplier: 1.05,
    marketMultiplier: 0.96
  },
  {
    id: "double_xp_weekend",
    name: "Double XP Weekend",
    description: "XP raddoppiata e idle income potenziato.",
    durationMs: 1000 * 60 * 7,
    cooldownMs: 1000 * 60 * 26,
    luckMultiplier: 1.03,
    valueMultiplier: 1,
    xpMultiplier: 2,
    passiveMultiplier: 1.35,
    marketMultiplier: 1
  }
];

export const PRESTIGE_TREE = [
  {
    id: "fortune",
    branch: "Fortuna",
    name: "Golden Instinct",
    description: "Bonus permanente a fortuna e valore drop.",
    maxLevel: 10,
    cost: 1,
    growth: 1.45,
    effects: { luck: 0.045, value: 0.025 }
  },
  {
    id: "automation",
    branch: "Automazione",
    name: "Case Engine",
    description: "Auto-opener piu' veloce e idle income piu' alto.",
    maxLevel: 10,
    cost: 1,
    growth: 1.5,
    effects: { autoSpeed: 0.055, passive: 0.08 }
  },
  {
    id: "inventory",
    branch: "Valore",
    name: "Collector Eye",
    description: "Aumenta valore inventario, vendite e ricompense collezione.",
    maxLevel: 10,
    cost: 1,
    growth: 1.55,
    effects: { value: 0.018, sell: 0.012, collection: 0.08 }
  },
  {
    id: "jackpot",
    branch: "Eventi",
    name: "Rare Circuit",
    description: "Lucky events piu' frequenti e Special Item leggermente piu' vicini.",
    maxLevel: 8,
    cost: 2,
    growth: 1.62,
    effects: { rare: 0.035, event: 0.12, crit: 0.006 }
  }
];

export const MARKET_TRENDS = [
  { id: "dip", name: "Market Dip", multiplier: 0.88, volatility: 0.22 },
  { id: "stable", name: "Stable Steam", multiplier: 1, volatility: 0.16 },
  { id: "hype", name: "Hype Spike", multiplier: 1.18, volatility: 0.28 },
  { id: "collector", name: "Collector Rush", multiplier: 1.34, volatility: 0.34 }
];

export const MULTI_OPEN_LEVELS = [1, 2, 3, 4, 5, 7, 10, 12, 15, 18, 22, 27, 32, 40, 50, 65];

export const TAB_LABELS = {
  cases: "Cases",
  inventory: "Inventario",
  shop: "Upgrade",
  stats: "Progress",
  prestige: "Prestige",
  games: "Giochi",
  community: "Community",
  achievements: "Achievement",
  contracts: "Contratti",
  collections: "Collezioni",
  market: "Marketplace",
  admin: "Admin",
  cheats: "Cheat"
};
