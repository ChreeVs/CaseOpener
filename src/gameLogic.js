import {
  ACHIEVEMENTS
} from "./config/achievementsConfig.js";
import {
  DROP_PROFILES
} from "./config/dropProfilesConfig.js";
import {
  ECONOMY_CONFIG,
  LIMITED_EVENTS,
  MARKET_TRENDS,
  MULTI_OPEN_LEVELS,
  OFFLINE_CAP_MS,
  PRESTIGE_TREE,
  UPGRADE_DEFINITIONS
} from "./config.js"; // These weren't split yet
import {
  RARITIES,
  RARITY_ORDER
} from "./config/rarityConfig.js";
import {
  CASE_MAX_PRESTIGE_UNLOCK,
  STARTING_CREDITS
} from "./config/gameConfig.js";
import {
  WEAR_TIERS
} from "./config/wearTiersConfig.js";

const UPGRADE_BY_ID = new Map(UPGRADE_DEFINITIONS.map((upgrade) => [upgrade.id, upgrade]));
const PRESTIGE_NODE_BY_ID = new Map(PRESTIGE_TREE.map((node) => [node.id, node]));
const MAX_PRESTIGE_LEVEL = CASE_MAX_PRESTIGE_UNLOCK;
const MARKETPLACE_ACTIVE_LISTING_LIMIT = 5;
const MARKETPLACE_MAX_PRICE = 1000000;

function emptyRarityCounts() {
  return RARITY_ORDER.reduce((counts, rarity) => {
    counts[rarity] = 0;
    return counts;
  }, {});
}

function createCaseStatsRecord() {
  return {
    opens: 0,
    spent: 0,
    totalDropValue: 0,
    soldValue: 0,
    autoSoldValue: 0,
    bestDropValue: 0,
    bestDropName: "",
    bestDropRarity: "",
    rarityCounts: emptyRarityCounts()
  };
}

/**
 * Creates the initial game state object with default values for credits, inventory, upgrades, and progression
 * @returns {Object} Complete game state including credits, inventory, stats, prestige level, and achievements
 */
export function createDefaultState() {
  return {
    version: 2,
    credits: STARTING_CREDITS,
    inventory: [],
    selectedCaseId: null,
    upgrades: UPGRADE_DEFINITIONS.reduce((upgrades, upgrade) => {
      upgrades[upgrade.id] = 0;
      return upgrades;
    }, {}),
    prestige: {
      level: 0,
      shards: 0,
      lifetimeShards: 0,
      totalResets: 0,
      nodes: PRESTIGE_TREE.reduce((nodes, node) => {
        nodes[node.id] = 0;
        return nodes;
      }, {})
    },
    stats: {
      casesOpened: 0,
      manualOpens: 0,
      autoOpens: 0,
      totalSpent: 0,
      totalEarned: 0,
      totalDropValue: 0,
      bestDrop: null,
      rarityCounts: emptyRarityCounts(),
      caseCounts: {},
      caseStats: {},
      luckyEvents: 0,
      jackpotHits: 0,
      contracts: 0,
      collections: 0,
      marketFlips: 0,
      limitedEvents: 0,
      autoSold: 0,
      insuranceEarned: 0,
      dailyClaims: 0,
      offlineEarned: 0,
      minigameSpent: 0,
      minigameEarned: 0
    },
    combo: {
      count: 0,
      best: 0,
      lastOpenAt: 0
    },
    event: {
      type: null,
      label: "",
      multiplier: 1,
      expiresAt: 0
    },
    limitedEvent: {
      id: null,
      label: "",
      description: "",
      expiresAt: 0,
      nextAt: 0
    },
    daily: {
      lastClaimDate: null,
      streak: 0
    },
    achievements: {},
    collections: {
      claimed: {},
      discovered: {},
      power: 0,
      archivePoints: 0
    },
    caseMastery: {},
    autoSell: {
      enabled: false,
      maxTier: ECONOMY_CONFIG.autoSellMinTier,
      maxValue: 12,
      minValue: 0,
      minFloat: 0,
      duplicateOnly: false,
      allowSpecial: false,
      keepFavorites: true
    },
    automation: {
      autoOpenerEnabled: true
    },
    casePrefs: {
      favorites: {}
    },
    settings: {
      audio: {
        muted: false,
        master: 0.72,
        reel: 0.42,
        drop: 0.68
      }
    },
    profile: {
      xp: 0,
      level: 1,
      name: "Operatore",
      title: "Case Runner",
      accent: "#7fe37c",
      team: "ct",
      avatarIcon: "shield",
      avatarImage: "",
      avatarProviderImage: "",
      configured: false
    },
    market: {
      lastRefreshAt: 0,
      trendId: "stable",
      trendExpiresAt: 0,
      offers: []
    },
    minigames: {
      dailyDate: null,
      dailyEarned: 0,
      played: 0,
      earned: 0,
      bestWin: 0,
      roulette: {
        bet: 4,
        choice: "red",
        autoPlay: true
      },
      pachinko: {
        bet: 4
      },
      crash: {
        bet: 4,
        autoCashout: 1.6,
        autoPlay: true,
        roundDelay: 6
      },
      upgrader: {
        itemId: "",
        itemIds: [],
        targetMultiplier: 2
      },
      coinflip: {
        bet: 4,
        side: "ct"
      },
      jackpot: {},
      history: []
    },
    goals: {
      contributions: {},
      claimed: {}
    },
    promoCodes: {
      redeemed: {},
      custom: {}
    },
    auctions: {
      listings: [],
      lastRefreshAt: 0
    },
    dropHistory: [],
    lastSeenAt: Date.now()
  };
}

export function normalizeState(raw) {
  const state = { ...createDefaultState(), ...(raw || {}) };
  state.upgrades = { ...createDefaultState().upgrades, ...(raw?.upgrades || {}) };
  state.prestige = { ...createDefaultState().prestige, ...(raw?.prestige || {}) };
  state.prestige.lifetimeShards = Math.max(state.prestige.lifetimeShards || 0, state.prestige.shards || 0);
  state.prestige.nodes = { ...createDefaultState().prestige.nodes, ...(raw?.prestige?.nodes || {}) };
  state.stats = { ...createDefaultState().stats, ...(raw?.stats || {}) };
  state.stats.rarityCounts = { ...emptyRarityCounts(), ...(raw?.stats?.rarityCounts || {}) };
  state.stats.caseCounts = { ...(raw?.stats?.caseCounts || {}) };
  state.stats.caseStats = Object.fromEntries(
    Object.entries(raw?.stats?.caseStats || {}).map(([caseId, caseStats]) => [
      caseId,
      {
        ...createCaseStatsRecord(),
        ...(caseStats || {}),
        rarityCounts: { ...emptyRarityCounts(), ...(caseStats?.rarityCounts || {}) }
      }
    ])
  );
  state.combo = { ...createDefaultState().combo, ...(raw?.combo || {}) };
  state.event = { ...createDefaultState().event, ...(raw?.event || {}) };
  state.limitedEvent = { ...createDefaultState().limitedEvent, ...(raw?.limitedEvent || {}) };
  state.daily = { ...createDefaultState().daily, ...(raw?.daily || {}) };
  state.achievements = { ...(raw?.achievements || {}) };
  state.collections = { ...createDefaultState().collections, ...(raw?.collections || {}) };
  state.collections.claimed = { ...(raw?.collections?.claimed || {}) };
  state.collections.discovered = { ...(raw?.collections?.discovered || {}) };
  state.collections.archivePoints = Number(raw?.collections?.archivePoints || 0);
  state.caseMastery = { ...(raw?.caseMastery || {}) };
  state.autoSell = { ...createDefaultState().autoSell, ...(raw?.autoSell || {}) };
  state.automation = { ...createDefaultState().automation, ...(raw?.automation || {}) };
  state.casePrefs = { ...createDefaultState().casePrefs, ...(raw?.casePrefs || {}) };
  state.casePrefs.favorites = { ...(raw?.casePrefs?.favorites || {}) };
  state.settings = { ...createDefaultState().settings, ...(raw?.settings || {}) };
  state.settings.audio = { ...createDefaultState().settings.audio, ...(raw?.settings?.audio || {}) };
  state.profile = { ...createDefaultState().profile, ...(raw?.profile || {}) };
  state.market = { ...createDefaultState().market, ...(raw?.market || {}) };
  state.minigames = { ...createDefaultState().minigames, ...(raw?.minigames || {}) };
  state.minigames.roulette = { ...createDefaultState().minigames.roulette, ...(raw?.minigames?.roulette || {}) };
  state.minigames.pachinko = { ...createDefaultState().minigames.pachinko, ...(raw?.minigames?.pachinko || {}) };
  state.minigames.crash = { ...createDefaultState().minigames.crash, ...(raw?.minigames?.crash || {}) };
  state.minigames.upgrader = { ...createDefaultState().minigames.upgrader, ...(raw?.minigames?.upgrader || {}) };
  state.minigames.upgrader.itemIds = Array.isArray(raw?.minigames?.upgrader?.itemIds) ? raw.minigames.upgrader.itemIds : [];
  state.minigames.coinflip = { ...createDefaultState().minigames.coinflip, ...(raw?.minigames?.coinflip || {}) };
  state.minigames.jackpot = { ...createDefaultState().minigames.jackpot, ...(raw?.minigames?.jackpot || {}) };
  state.minigames.history = Array.isArray(raw?.minigames?.history) ? raw.minigames.history.slice(0, 24) : [];
  state.goals = { ...createDefaultState().goals, ...(raw?.goals || {}) };
  state.goals.contributions = { ...(raw?.goals?.contributions || {}) };
  state.goals.claimed = { ...(raw?.goals?.claimed || {}) };
  state.promoCodes = { ...createDefaultState().promoCodes, ...(raw?.promoCodes || {}) };
  state.promoCodes.redeemed = { ...(raw?.promoCodes?.redeemed || {}) };
  state.promoCodes.custom = { ...(raw?.promoCodes?.custom || {}) };
  state.auctions = { ...createDefaultState().auctions, ...(raw?.auctions || {}) };
  state.auctions.listings = Array.isArray(raw?.auctions?.listings) ? raw.auctions.listings.slice(0, 50) : [];
  state.inventory = Array.isArray(raw?.inventory) ? raw.inventory : [];
  state.dropHistory = Array.isArray(raw?.dropHistory) ? raw.dropHistory.slice(0, 40) : [];
  return state;
}

export function formatCredits(value, compact = false) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);
  if (compact && absAmount >= 1000000) {
    return `${sign}\u20ac ${(absAmount / 1000000).toLocaleString("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    })}M`;
  }
  if (compact && absAmount >= 10000) {
    return `${sign}\u20ac ${(absAmount / 1000).toLocaleString("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}K`;
  }
  return `${sign}\u20ac ${absAmount.toLocaleString("it-IT", {
    minimumFractionDigits: absAmount < 100 ? 2 : 0,
    maximumFractionDigits: absAmount < 100 ? 2 : 0
  })}`;
}

export function getInventoryValue(state) {
  return state.inventory.reduce((sum, item) => sum + (item.value || 0), 0);
}

export function getNetWorth(state) {
  return state.credits + getInventoryValue(state);
}

export function getPrestigeNodeLevel(state, nodeId) {
  return state.prestige.nodes?.[nodeId] || 0;
}

export function getPrestigeNodeEffect(state, effect) {
  return PRESTIGE_TREE.reduce((total, node) => {
    const level = getPrestigeNodeLevel(state, node.id);
    return total + (node.effects?.[effect] || 0) * level;
  }, 0);
}

export function getPrestigeNodeCost(state, nodeId) {
  const node = PRESTIGE_NODE_BY_ID.get(nodeId);
  const level = getPrestigeNodeLevel(state, nodeId);
  if (!node || level >= node.maxLevel) {
    return Infinity;
  }
  return Math.max(1, Math.ceil(node.cost * Math.pow(node.growth, level)));
}

export function buyPrestigeNode(state, nodeId) {
  const node = PRESTIGE_NODE_BY_ID.get(nodeId);
  if (!node) {
    return { ok: false, reason: "Nodo prestige inesistente." };
  }
  const level = getPrestigeNodeLevel(state, nodeId);
  if (level >= node.maxLevel) {
    return { ok: false, reason: "Nodo al massimo." };
  }
  const cost = getPrestigeNodeCost(state, nodeId);
  if (state.prestige.shards < cost) {
    return { ok: false, reason: "Shard insufficienti." };
  }
  state.prestige.shards -= cost;
  state.prestige.nodes[nodeId] = level + 1;
  return { ok: true, cost, node };
}

export function getCollectionMultiplier(state) {
  return 1 +
    (state.collections?.power || 0) * ECONOMY_CONFIG.collectionPermanentBonus +
    (state.upgrades.collectionHunter || 0) * 0.006;
}

export function getProfileSkillBonus(state) {
  const level = Math.max(1, Number(state.profile?.level || 1));
  const skillPoints = Math.max(0, level - 1);
  return {
    level,
    luck: Math.min(0.035, skillPoints * 0.001),
    sellFeeReduction: Math.min(0.025, Math.floor(skillPoints / 3) * 0.002),
    goalDiscount: Math.min(0.1, Math.floor(skillPoints / 5) * 0.01),
    collectionAssist: Math.floor(skillPoints / 10),
    auctionFeeReduction: Math.min(0.04, Math.floor(skillPoints / 4) * 0.004),
    passiveBoost: Math.min(0.12, skillPoints * 0.003)
  };
}

export function getSellReturn(state, item) {
  const marketAnalyst = state.upgrades.marketAnalyst || 0;
  const fee = Math.max(0, ECONOMY_CONFIG.sellFee - getPrestigeNodeEffect(state, "sell") - marketAnalyst * 0.001 - getProfileSkillBonus(state).sellFeeReduction);
  return Number(Math.max(0, (item.value || 0) * (1 - fee)).toFixed(2));
}

export function getDropInsuranceRate(state) {
  return Math.min(0.36, (state.upgrades.dropInsurance || 0) * 0.018);
}

export function getMarketAnalystDiscount(state) {
  return Math.min(0.22, (state.upgrades.marketAnalyst || 0) * 0.008);
}

export function getTradeUpInputCount(state) {
  return Math.max(6, 10 - Math.floor((state.upgrades.tradeUpSpecialist || 0) / 4));
}

export function getPrestigeMultiplier(state) {
  const level = Math.min(MAX_PRESTIGE_LEVEL, state.prestige.level || 0);
  return 1 + level * 0.032 + Math.sqrt(state.prestige.lifetimeShards || state.prestige.shards || 0) * 0.012;
}

export function getDropValueMultiplier(state) {
  const limited = getLimitedEventEffect(state);
  const level = Math.min(MAX_PRESTIGE_LEVEL, state.prestige.level || 0);
  return (1 + level * 0.018 + Math.sqrt(state.prestige.lifetimeShards || state.prestige.shards || 0) * 0.007) *
    getCollectionMultiplier(state) *
    (1 + getPrestigeNodeEffect(state, "value")) *
    (limited.valueMultiplier || 1);
}

function getPrestigeUpgradeEfficiency(state) {
  const prestigeLevel = Math.max(0, Number(state.prestige?.level) || 0);
  const efficiency = 1 / (1 + prestigeLevel * 0.055 + Math.pow(Math.max(0, prestigeLevel - 7), 1.35) * 0.018);
  return Math.min(1, Math.max(0.01, efficiency));
}

function getDiminishedUpgradeLevel(state, upgradeId, curve = 12) {
  const level = Math.max(0, Number(state.upgrades?.[upgradeId]) || 0);
  if (!level) {
    return 0;
  }
  const softLevel = curve * (1 - Math.exp(-level / curve));
  return softLevel * getPrestigeUpgradeEfficiency(state);
}

export function getUpgradeCost(state, upgradeId) {
  const definition = UPGRADE_BY_ID.get(upgradeId);
  const level = state.upgrades[upgradeId] || 0;
  if (!definition || level >= definition.maxLevel) {
    return Infinity;
  }
  const prestigeLevel = Math.max(0, Number(state.prestige?.level) || 0);
  const endgameScale = 1 + Math.pow(Math.max(0, prestigeLevel - 5), 1.62) * 0.11;
  const lateLevelScale = 1 + Math.pow(Math.max(0, level - 10), 1.28) * 0.075;
  return Math.floor(definition.baseCost * Math.pow(definition.growth + 0.018, level) * Math.pow(1.28, prestigeLevel) * endgameScale * lateLevelScale);
}

export function getOpenDuration(state) {
  const level = getDiminishedUpgradeLevel(state, "openSpeed", 14);
  return Math.max(760, Math.round(3800 * Math.pow(0.91, level)));
}

export function getCaseMasteryRequirement(level) {
  return Math.floor(
    ECONOMY_CONFIG.caseMasteryBaseRequirement +
      Math.pow(Math.max(0, level) + 1, ECONOMY_CONFIG.caseMasteryRequirementGrowth) *
        ECONOMY_CONFIG.caseMasteryRequirementScale
  );
}

function deriveCaseMasteryFromXp(totalXp) {
  const record = {
    level: 0,
    xp: Math.max(0, Number(totalXp) || 0),
    opens: 0
  };

  while (record.xp >= getCaseMasteryRequirement(record.level)) {
    record.xp -= getCaseMasteryRequirement(record.level);
    record.level += 1;
  }

  record.xp = Number(record.xp.toFixed(2));
  return record;
}

export function getCaseMastery(state, caseId) {
  const record = state.caseMastery?.[caseId] || {};
  const source = Object.keys(record).length
    ? record
    : deriveCaseMasteryFromXp(state.stats.caseCounts?.[caseId] || 0);
  const level = Math.max(0, Math.floor(Number(source.level) || 0));
  const xp = Math.max(0, Number(source.xp) || 0);
  const opens = Math.max(0, Math.floor(Number(source.opens) || state.stats.caseCounts?.[caseId] || 0));
  const required = getCaseMasteryRequirement(level);
  const luckBonus = Math.min(
    ECONOMY_CONFIG.caseMasteryLuckCap,
    level * ECONOMY_CONFIG.caseMasteryLuckPerLevel
  );

  return {
    level,
    xp,
    opens,
    required,
    progress: required > 0 ? Math.min(1, xp / required) : 1,
    luckBonus,
    luckMultiplier: 1 + luckBonus
  };
}

export function getCaseStats(state, caseId) {
  const stats = state.stats?.caseStats?.[caseId];
  return {
    ...createCaseStatsRecord(),
    ...(stats || {}),
    rarityCounts: { ...emptyRarityCounts(), ...(stats?.rarityCounts || {}) }
  };
}

function addCaseMasteryXp(state, caseDef, amount = 1) {
  state.caseMastery ||= {};
  const current = state.caseMastery[caseDef.id]
    ? getCaseMastery(state, caseDef.id)
    : deriveCaseMasteryFromXp(Math.max(0, (state.stats.caseCounts?.[caseDef.id] || 0) - amount));
  const record = {
    level: current.level,
    xp: current.xp + amount,
    opens: current.opens + amount
  };
  const levelUps = [];

  while (record.xp >= getCaseMasteryRequirement(record.level)) {
    record.xp -= getCaseMasteryRequirement(record.level);
    record.level += 1;
    levelUps.push(record.level);
  }

  record.xp = Number(record.xp.toFixed(2));
  state.caseMastery[caseDef.id] = record;
  return {
    record: getCaseMastery(state, caseDef.id),
    levelUps
  };
}

export function getCaseMasteryLuckMultiplier(state, caseDef) {
  return getCaseMastery(state, caseDef.id).luckMultiplier;
}

export function getLuckMultiplier(state) {
  const eventBonus = isEventActive(state) ? state.event.multiplier : 1;
  const limited = getLimitedEventEffect(state);
  const comboBonus = Math.min(0.22, Math.max(0, state.combo.count - 1) * 0.008);
  return (1 + getDiminishedUpgradeLevel(state, "luck", 14) * 0.032 + comboBonus + state.prestige.level * 0.007 + getPrestigeNodeEffect(state, "luck") + getProfileSkillBonus(state).luck) *
    eventBonus *
    (limited.luckMultiplier || 1);
}

export function getRareBoostMultiplier(state) {
  const limited = getLimitedEventEffect(state);
  return (1 + getDiminishedUpgradeLevel(state, "rareBoost", 12) * 0.021 + state.prestige.level * 0.007 + getPrestigeNodeEffect(state, "rare")) *
    (limited.rareMultiplier || 1);
}

export function getCritChance(state) {
  return Math.min(
    0.18,
    0.01 + getDiminishedUpgradeLevel(state, "critBonus", 10) * 0.0055 + getDiminishedUpgradeLevel(state, "luck", 14) * 0.0008 + getPrestigeNodeEffect(state, "crit")
  );
}

export function getMultiOpenCount(state) {
  const level = Math.max(0, Math.min(Number(state.upgrades?.multiOpen) || 0, MULTI_OPEN_LEVELS.length - 1));
  return MULTI_OPEN_LEVELS[level] || 1;
}

export function getPassiveRate(state) {
  const level = getDiminishedUpgradeLevel(state, "passiveIncome", 14);
  if (!level) {
    return 0;
  }
  const limited = getLimitedEventEffect(state);
  return (0.22 * level + Math.pow(level, 1.18) * 0.12) *
    getPrestigeMultiplier(state) *
    (1 + getPrestigeNodeEffect(state, "passive")) *
    (1 + getProfileSkillBonus(state).passiveBoost) *
    (limited.passiveMultiplier || 1);
}

export function getAutoInterval(state) {
  const level = getDiminishedUpgradeLevel(state, "autoOpener", 9);
  if (!level || state.automation?.autoOpenerEnabled === false) {
    return Infinity;
  }
  return Math.max(2200, (15000 - level * 880) * Math.max(0.58, 1 - getPrestigeNodeEffect(state, "autoSpeed")));
}

export function isAutoOpenerEnabled(state) {
  return Boolean((state.upgrades.autoOpener || 0) > 0 && state.automation?.autoOpenerEnabled !== false);
}

export function setAutoOpenerEnabled(state, enabled) {
  state.automation = {
    ...state.automation,
    autoOpenerEnabled: Boolean(enabled)
  };
  return state.automation.autoOpenerEnabled;
}

export function getProfileLevel(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 125)) + 1);
}

export function getPrestigeRequirement(state) {
  const nextLevel = Math.min(MAX_PRESTIGE_LEVEL, (state.prestige.level || 0) + 1);
  const endgameScale = nextLevel > 8 ? Math.pow(1.28, nextLevel - 8) : 1;
  return Math.floor(720 * Math.pow(nextLevel, 2.42) * endgameScale);
}

function getPrestigeResetCredits(level) {
  const prestigeLevel = Math.max(0, Number(level) || 0);
  return Math.round(STARTING_CREDITS + prestigeLevel * 12 + Math.pow(prestigeLevel, 2) * 14);
}

export function canPrestige(state) {
  return state.prestige.level < MAX_PRESTIGE_LEVEL &&
    getNetWorth(state) >= getPrestigeRequirement(state) &&
    state.stats.casesOpened >= 60 + state.prestige.level * 8;
}

export function isCaseUnlocked(state, caseDef) {
  return state.prestige.level >= (caseDef.unlockPrestige || 0);
}

export function isEventActive(state) {
  return state.event?.expiresAt > Date.now();
}

export function isLimitedEventActive(state) {
  return state.limitedEvent?.expiresAt > Date.now();
}

export function getLimitedEventDefinition(state) {
  if (!isLimitedEventActive(state)) {
    return null;
  }
  return LIMITED_EVENTS.find((event) => event.id === state.limitedEvent.id) || null;
}

export function getLimitedEventEffect(state) {
  return getLimitedEventDefinition(state) || {};
}

export function clearExpiredEvent(state) {
  if (state.event.expiresAt && state.event.expiresAt <= Date.now()) {
    state.event = { type: null, label: "", multiplier: 1, expiresAt: 0 };
  }
  if (state.limitedEvent.expiresAt && state.limitedEvent.expiresAt <= Date.now()) {
    const current = LIMITED_EVENTS.find((event) => event.id === state.limitedEvent.id);
    state.limitedEvent = {
      id: null,
      label: "",
      description: "",
      expiresAt: 0,
      nextAt: Date.now() + (current?.cooldownMs || 1000 * 60 * 20)
    };
  }
}

export function maybeStartLimitedEvent(state, { force = false } = {}) {
  clearExpiredEvent(state);
  if (isLimitedEventActive(state)) {
    return null;
  }
  if (!force && state.limitedEvent.nextAt && state.limitedEvent.nextAt > Date.now()) {
    return null;
  }

  const chance = ECONOMY_CONFIG.eventRollBaseChance * (1 + getPrestigeNodeEffect(state, "event"));
  if (!force && Math.random() > chance) {
    return null;
  }

  const event = LIMITED_EVENTS[Math.floor(Math.random() * LIMITED_EVENTS.length)];
  state.limitedEvent = {
    id: event.id,
    label: event.name,
    description: event.description,
    expiresAt: Date.now() + event.durationMs,
    nextAt: Date.now() + event.durationMs + event.cooldownMs
  };
  state.stats.limitedEvents += 1;
  return state.limitedEvent;
}

export function applyPassiveIncome(state, elapsedMs, { offline = false } = {}) {
  const cappedMs = offline ? Math.min(elapsedMs, OFFLINE_CAP_MS) : elapsedMs;
  const earned = getPassiveRate(state) * (cappedMs / 1000);
  if (earned > 0) {
    state.credits += earned;
    if (offline) {
      state.stats.offlineEarned += earned;
    }
  }
  return earned;
}

export function claimOfflineIncome(state) {
  const elapsed = Math.max(0, Date.now() - (state.lastSeenAt || Date.now()));
  return applyPassiveIncome(state, elapsed, { offline: true });
}

export function buyUpgrade(state, upgradeId) {
  const definition = UPGRADE_BY_ID.get(upgradeId);
  if (!definition) {
    return { ok: false, reason: "Upgrade inesistente." };
  }

  const level = state.upgrades[upgradeId] || 0;
  if (level >= definition.maxLevel) {
    return { ok: false, reason: "Upgrade al massimo." };
  }

  const cost = getUpgradeCost(state, upgradeId);
  if (state.credits < cost) {
    return { ok: false, reason: "Crediti insufficienti." };
  }

  state.credits -= cost;
  state.upgrades[upgradeId] = level + 1;
  return { ok: true, cost };
}

function normalizeCheatNumber(value, { min = 0, max = 1000000000 } = {}) {
  const parsed = Math.floor(Number(value) || 0);
  return Math.max(min, Math.min(max, parsed));
}

export function cheatAddCredits(state, amount) {
  const value = normalizeCheatNumber(amount, { min: 1 });
  state.credits += value;
  return value;
}

export function cheatSetCredits(state, amount) {
  const value = normalizeCheatNumber(amount);
  state.credits = value;
  return value;
}

export function cheatAddPrestigeLevels(state, amount) {
  const levels = normalizeCheatNumber(amount, { min: 1, max: 50 });
  state.prestige.level += levels;
  return levels;
}

export function cheatAddShards(state, amount) {
  const shards = normalizeCheatNumber(amount, { min: 1, max: 100000 });
  state.prestige.shards += shards;
  state.prestige.lifetimeShards += shards;
  return shards;
}

export function cheatMaxUpgrades(state) {
  UPGRADE_DEFINITIONS.forEach((upgrade) => {
    state.upgrades[upgrade.id] = upgrade.maxLevel;
  });
  return UPGRADE_DEFINITIONS.length;
}

export function cheatUnlockAllCases(state, cases) {
  const requiredPrestige = Math.max(0, ...cases.map((caseDef) => caseDef.unlockPrestige || 0));
  state.prestige.level = Math.max(state.prestige.level, requiredPrestige);
  return requiredPrestige;
}

export function cheatSetCaseMastery(state, caseId, level) {
  const masteryLevel = normalizeCheatNumber(level, { min: 0, max: 999 });
  const opens = Array.from({ length: masteryLevel }, (_, index) => getCaseMasteryRequirement(index))
    .reduce((sum, requirement) => sum + requirement, 0);
  state.caseMastery ||= {};
  state.caseMastery[caseId] = {
    level: masteryLevel,
    xp: 0,
    opens: Math.max(getCaseMastery(state, caseId).opens, opens)
  };
  return getCaseMastery(state, caseId);
}

function weightedPick(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return entries[0]?.value;
  }

  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.value;
    }
  }
  return entries.at(-1)?.value;
}

function getAdjustedProfile(caseDef, state) {
  const profileMap = new Map(caseDef.profile || DROP_PROFILES.standard);
  RARITY_ORDER
    .filter((rarity) => (RARITIES[rarity]?.tier || 0) <= 2 && caseDef.pool[rarity]?.length && !profileMap.has(rarity))
    .forEach((rarity) => profileMap.set(rarity, 1));
  const profile = [...profileMap.entries()];
  const luck = getLuckMultiplier(state) * getCaseMasteryLuckMultiplier(state, caseDef);
  const rareBoost = getRareBoostMultiplier(state);

  const adjusted = profile
    .map(([rarity, weight]) => {
      const tier = RARITIES[rarity]?.tier || 0;
      let adjusted = weight;
      if (tier >= 4) {
        adjusted *= rareBoost;
      }
      if (tier >= 5) {
        adjusted *= 1 + (luck - 1) * 0.33;
      }
      if (tier >= 6) {
        adjusted *= 1 + (luck - 1) * 0.45;
      }
      if (!caseDef.pool[rarity]?.length) {
        adjusted = 0;
      }
      return { value: rarity, weight: adjusted };
    })
    .filter((entry) => entry.weight > 0);

  const lowTierEntries = adjusted.filter((entry) => (RARITIES[entry.value]?.tier || 0) <= 2);
  if (!lowTierEntries.length) {
    return adjusted;
  }

  const total = adjusted.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const lowTotal = lowTierEntries.reduce((sum, entry) => sum + entry.weight, 0);
  const prestigeLevel = Math.max(0, Number(state.prestige?.level) || 0);
  const collectionPity = Math.min(0.06, Math.max(0, state.collections?.power || 0) * 0.0015);
  const lowTierFloor = Math.max(0.12, 0.2 - prestigeLevel * 0.003) + collectionPity;
  const currentLowShare = lowTotal / total;
  if (currentLowShare >= lowTierFloor) {
    return adjusted;
  }

  const requiredLowWeight = (lowTierFloor * (total - lowTotal)) / Math.max(0.01, 1 - lowTierFloor);
  const lowScale = requiredLowWeight / Math.max(0.01, lowTotal);
  return adjusted.map((entry) => (
    (RARITIES[entry.value]?.tier || 0) <= 2
      ? { ...entry, weight: entry.weight * lowScale }
      : entry
  ));
}

function getProfileWithProbabilities(caseDef, state) {
  const adjusted = getAdjustedProfile(caseDef, state);
  const total = adjusted.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  return adjusted.map((entry) => ({
    rarity: entry.value,
    weight: entry.weight,
    probability: entry.weight / total
  }));
}

function estimateRarityValue(state, rarity, caseDef) {
  const wearAverage = WEAR_TIERS.reduce((sum, wear) => sum + wear.multiplier, 0) / WEAR_TIERS.length;
  const critExpected = 1 + getCritChance(state) * 0.72;
  return RARITIES[rarity].baseValue * wearAverage * getDropValueMultiplier(state) * critExpected * Number(caseDef?.valueScale || 1);
}

export function getCaseDropTable(state, caseDef) {
  const rows = getProfileWithProbabilities(caseDef, state).map((entry) => {
    const estimatedValue = estimateRarityValue(state, entry.rarity, caseDef);
    return {
      ...entry,
      color: RARITIES[entry.rarity].color,
      poolSize: caseDef.pool[entry.rarity]?.length || 0,
      estimatedValue,
      expectedValue: estimatedValue * entry.probability
    };
  });
  const expectedValue = rows.reduce((sum, row) => sum + row.expectedValue, 0);
  const roi = caseDef.price > 0 ? expectedValue / caseDef.price : 0;
  const bestRarity = [...rows].sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier)[0]?.rarity;
  const bestPool = bestRarity ? caseDef.pool[bestRarity] || [] : [];

  return {
    rows,
    expectedValue,
    roi,
    bestRarity,
    bestPreview: bestPool.slice(0, 4)
  };
}

function findFallbackRarity(caseDef, rarity) {
  const targetIndex = RARITY_ORDER.indexOf(rarity);
  const fallbackOrder = [
    ...RARITY_ORDER.slice(0, targetIndex).reverse(),
    ...RARITY_ORDER.slice(targetIndex + 1)
  ];
  return fallbackOrder.find((candidate) => caseDef.pool[candidate]?.length) || caseDef.availableRarities[0];
}

export function rollRarity(caseDef, state) {
  const profile = getAdjustedProfile(caseDef, state);
  const rarity = weightedPick(profile);
  return caseDef.pool[rarity]?.length ? rarity : findFallbackRarity(caseDef, rarity);
}

export function pickSkin(caseDef, rarity, skinData) {
  const pool = caseDef?.pool?.[rarity]?.length ? caseDef.pool[rarity] : skinData?.globalPool?.[rarity] || skinData?.skins?.filter(s => s.rarity === rarity) || [];
  if (!pool.length) {
    const fallback = RARITY_ORDER.map((candidate) => caseDef?.pool?.[candidate] || skinData?.globalPool?.[candidate] || skinData?.skins?.filter(s => s.rarity === candidate) || []).find((items) => items.length);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getWearFromFloat(floatValue) {
  return WEAR_TIERS.find((wear) => floatValue >= wear.min && floatValue < wear.max) || WEAR_TIERS.at(-1);
}

export function rollFloat(skin) {
  const min = Math.max(0, Number.isFinite(skin.minFloat) ? skin.minFloat : 0);
  const max = Math.min(1, Number.isFinite(skin.maxFloat) ? skin.maxFloat : 1);
  return min + Math.random() * Math.max(0.001, max - min);
}

function calculateValue(skin, rarity, floatValue, state, flags, caseDef) {
  const wear = getWearFromFloat(floatValue);
  const rarityValue = RARITIES[rarity].baseValue;
  const floatEdge = Math.max(0, 1 - floatValue);
  const collectionBonus = skin.collections.length ? 1 + Math.min(0.22, skin.collections.length * 0.035) : 1;
  const variance = 0.78 + Math.random() * 0.62;
  const luckValue = 1 + Math.min(0.16, (getLuckMultiplier(state) - 1) * 0.105);
  const stattrak = flags.stattrak ? 1.38 : 1;
  const souvenir = flags.souvenir ? 1.22 : 1;
  const specialNameBonus = skin.name.startsWith("\u2605") || ["Knives", "Gloves"].includes(skin.category) ? 1.48 : 1;
  const limited = getLimitedEventEffect(state);
  const lowFloatBonus = (floatValue < 0.01 ? 1.9 : floatValue < 0.03 ? 1.35 : 1) * (limited.lowFloatMultiplier || 1);
  const crit = flags.crit ? 1.45 + Math.random() * 0.7 : 1;

  return Math.max(
    0.03,
    rarityValue *
      wear.multiplier *
      (1 + floatEdge * 0.35) *
      collectionBonus *
      variance *
      luckValue *
      stattrak *
      souvenir *
      specialNameBonus *
      lowFloatBonus *
      crit *
      Number(caseDef?.valueScale || 1) *
      getDropValueMultiplier(state)
  );
}

export function createInventoryItem(skin, rarity, caseDef, state) {
  const floatValue = rollFloat(skin);
  const wear = getWearFromFloat(floatValue);
  const flags = {
    stattrak: skin.stattrak && Math.random() < 0.1,
    souvenir: skin.souvenir && Math.random() < 0.035,
    crit: Math.random() < getCritChance(state)
  };
  const value = calculateValue(skin, rarity, floatValue, state, flags, caseDef);
  const prefix = flags.stattrak ? "StatTrak " : flags.souvenir ? "Souvenir " : "";

  return {
    id: `${skin.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    skinId: skin.id,
    name: `${prefix}${skin.name}`,
    baseName: skin.name,
    image: skin.image,
    weapon: skin.weapon,
    category: skin.category,
    rarity,
    rarityColor: RARITIES[rarity].color,
    wear: wear.name,
    float: Number(floatValue.toFixed(6)),
    value: Number(value.toFixed(2)),
    stattrak: flags.stattrak,
    souvenir: flags.souvenir,
    crit: flags.crit,
    locked: false,
    favorite: false,
    marketCost: 0,
    caseId: caseDef.id,
    caseName: caseDef.name,
    collection: skin.collections[0] || "No Collection",
    obtainedAt: Date.now()
  };
}

function updateCombo(state) {
  const now = Date.now();
  state.combo.count = now - state.combo.lastOpenAt < 9000 ? state.combo.count + 1 : 1;
  state.combo.lastOpenAt = now;
  state.combo.best = Math.max(state.combo.best, state.combo.count);
}

function maybeStartLuckyEvent(state, item) {
  if (isEventActive(state)) {
    return null;
  }

  const eventChance = ECONOMY_CONFIG.eventRollBaseChance +
    (state.upgrades.luck || 0) * 0.0007 +
    getPrestigeNodeEffect(state, "event") * 0.012 +
    (item.rarity === "Covert" ? 0.012 : 0) +
    (item.rarity === "Rare Special Item" ? 0.03 : 0);
  if (Math.random() > eventChance) {
    return null;
  }

  const event = Math.random() < 0.55
    ? { type: "lucky_window", label: "Lucky Window", multiplier: 1.45, duration: 45000 }
    : { type: "gold_pulse", label: "Gold Pulse", multiplier: 1.75, duration: 26000 };

  state.event = {
    type: event.type,
    label: event.label,
    multiplier: event.multiplier,
    expiresAt: Date.now() + event.duration
  };
  state.stats.luckyEvents += 1;
  return state.event;
}

function shouldAutoSell(state, item) {
  if (!state.autoSell?.enabled) {
    return false;
  }
  const tier = RARITIES[item.rarity]?.tier || 0;
  if (item.rarity === "Rare Special Item" && !state.autoSell.allowSpecial) {
    return false;
  }
  if (state.autoSell.duplicateOnly && !state.inventory.some((owned) => owned.skinId === item.skinId)) {
    return false;
  }
  return tier <= Number(state.autoSell.maxTier || 0) &&
    item.value >= Number(state.autoSell.minValue || 0) &&
    item.value <= Number(state.autoSell.maxValue || Infinity) &&
    item.float >= Number(state.autoSell.minFloat || 0);
}

function recordCollectionDiscovery(state, item) {
  if (!item.collection || item.collection === "No Collection") {
    return;
  }
  state.collections.discovered[item.collection] ||= {};
  state.collections.discovered[item.collection][item.skinId] = true;
}

function rememberDrop(state, item) {
  recordCollectionDiscovery(state, item);
  state.dropHistory = [item, ...(state.dropHistory || [])].slice(0, 40);
}

function grantCollectionArchivePoints(state, rarity) {
  state.collections ||= createDefaultState().collections;
  const tier = RARITIES[rarity]?.tier || 1;
  const amount = tier >= 5 ? 1.2 : tier >= 4 ? 0.8 : tier >= 3 ? 0.48 : 0.22;
  state.collections.archivePoints = Number(((state.collections.archivePoints || 0) + amount).toFixed(2));
}

function recordCaseDropStats(state, caseDef, item, { autoSold = false, soldValue = 0 } = {}) {
  state.stats.caseStats ||= {};
  const record = getCaseStats(state, caseDef.id);
  record.opens += 1;
  record.spent += Number(caseDef.price || 0);
  record.totalDropValue += Number(item.value || 0);
  if (autoSold) {
    record.autoSoldValue += Number(soldValue || 0);
    record.soldValue += Number(soldValue || 0);
  }
  record.rarityCounts[item.rarity] = (record.rarityCounts[item.rarity] || 0) + 1;
  if ((item.value || 0) >= (record.bestDropValue || 0)) {
    record.bestDropValue = Number(item.value || 0);
    record.bestDropName = item.name;
    record.bestDropRarity = item.rarity;
  }
  state.stats.caseStats[caseDef.id] = record;
}

function recordCaseSaleStats(state, item, returned) {
  if (!item?.caseId) {
    return;
  }
  state.stats.caseStats ||= {};
  const record = getCaseStats(state, item.caseId);
  record.soldValue += Number(returned || 0);
  state.stats.caseStats[item.caseId] = record;
}

/**
 * Opens one or more cases and generates corresponding drop items
 * @param {Object} state - Game state object
 * @param {Object} caseDef - Case definition with pricing and skin pool
 * @param {Object} skinData - Complete skin database
 * @param {number} requestedCount - Number of cases to open
 * @param {string} source - Source of the action: 'manual', 'auto', or 'contract'
 * @returns {Object} Result with ok flag, drops array, and metadata (experience, events, combos)
 */
export function openCases(state, caseDef, skinData, requestedCount, source = "manual") {
  try {
    clearExpiredEvent(state);
    let limitedEvent = null;
    const count = caseDef.manualOnly ? 1 : Math.max(1, Math.floor(requestedCount || 1));
    const affordable = caseDef.price > 0 ? Math.min(count, Math.floor(state.credits / caseDef.price)) : count;
    const drops = [];
    const masteryLevelUps = [];

    if (caseDef.manualOnly && source === "auto") {
    return { ok: false, reason: "Questa cassa si apre solo manualmente.", drops };
  }

  if (affordable <= 0) {
    return { ok: false, reason: "Crediti insufficienti.", drops };
  }

  limitedEvent = maybeStartLimitedEvent(state);

  for (let index = 0; index < affordable; index += 1) {
    state.credits -= caseDef.price;
    state.stats.totalSpent += caseDef.price;
    state.stats.casesOpened += 1;
    state.stats[source === "auto" ? "autoOpens" : "manualOpens"] += 1;
    state.stats.caseCounts[caseDef.id] = (state.stats.caseCounts[caseDef.id] || 0) + 1;

    updateCombo(state);

    const rarity = rollRarity(caseDef, state);
    const skin = pickSkin(caseDef, rarity, skinData);
    const item = createInventoryItem(skin, rarity, caseDef, state);
    if (RARITIES[rarity].tier <= 2 && item.value < caseDef.price) {
      const refund = Number((caseDef.price * getDropInsuranceRate(state)).toFixed(2));
      if (refund > 0) {
        state.credits += refund;
        state.stats.insuranceEarned += refund;
        item.insuranceRefund = refund;
      }
    }
    const autoSold = shouldAutoSell(state, item);
    if (autoSold) {
      const returned = getSellReturn(state, item);
      state.credits += returned;
      state.stats.totalEarned += returned;
      state.stats.autoSold += 1;
      item.autoSold = true;
      item.sellValue = returned;
      recordCaseDropStats(state, caseDef, item, { autoSold: true, soldValue: returned });
    } else {
      state.inventory.unshift(item);
      recordCaseDropStats(state, caseDef, item);
    }
    rememberDrop(state, item);
    grantCollectionArchivePoints(state, rarity);
    state.stats.rarityCounts[rarity] = (state.stats.rarityCounts[rarity] || 0) + 1;
    state.stats.totalDropValue += item.value;
    const xpMultiplier = getLimitedEventEffect(state).xpMultiplier || 1;
    state.profile.xp += Math.max(2, Math.round((Math.max(1, caseDef.price) * 0.55 + RARITIES[rarity].tier * 4) * xpMultiplier));
    state.profile.level = getProfileLevel(state.profile.xp);

    if (!state.stats.bestDrop || item.value > state.stats.bestDrop.value) {
      state.stats.bestDrop = item;
    }
    if (rarity === "Rare Special Item") {
      state.stats.jackpotHits += 1;
    }

    const event = maybeStartLuckyEvent(state, item);
    const mastery = addCaseMasteryXp(state, caseDef, 1);
    masteryLevelUps.push(...mastery.levelUps);
    drops.push({ item, event, limitedEvent: index === 0 ? limitedEvent : null, autoSold });
  }

  return {
    ok: true,
    drops,
    opened: affordable,
    requested: count,
    mastery: getCaseMastery(state, caseDef.id),
    masteryLevelUps
  };
  } catch (err) {
    console.error('[openCases] Error:', err);
    return { ok: false, reason: 'Errore durante l\'apertura cassa. Salvare lo stato per sicurezza.', drops: [] };
  }
}

export function sellItem(state, itemId) {
  const index = state.inventory.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return null;
  }
  if (state.inventory[index].locked) {
    return null;
  }
  const [item] = state.inventory.splice(index, 1);
  const returned = getSellReturn(state, item);
  state.credits += returned;
  state.stats.totalEarned += returned;
  recordCaseSaleStats(state, item, returned);
  if (item.marketCost && returned > item.marketCost * 1.05) {
    state.stats.marketFlips += 1;
  }
  item.sellValue = returned;
  return item;
}

export function sellItems(state, predicate) {
  const keep = [];
  const sold = [];
  state.inventory.forEach((item) => {
    if (!item.locked && !item.favorite && predicate(item)) {
      sold.push(item);
    } else {
      keep.push(item);
    }
  });
  state.inventory = keep;
  let total = 0;
  sold.forEach((item) => {
    const returned = getSellReturn(state, item);
    total += returned;
    recordCaseSaleStats(state, item, returned);
  });
  state.credits += total;
  state.stats.totalEarned += total;
  state.stats.marketFlips += sold.filter((item) => item.marketCost && getSellReturn(state, item) > item.marketCost * 1.05).length;
  return { sold, total };
}

export function toggleItemFlag(state, itemId, flag) {
  if (!["locked", "favorite"].includes(flag)) {
    return null;
  }
  const item = state.inventory.find((candidate) => candidate.id === itemId);
  if (!item) {
    return null;
  }
  item[flag] = !item[flag];
  return item;
}

export function updateAutoSell(state, patch) {
  state.autoSell = {
    ...state.autoSell,
    ...patch,
    maxTier: Math.max(0, Math.min(RARITY_ORDER.length - 1, Number(patch.maxTier ?? state.autoSell.maxTier))),
    maxValue: Math.max(0, Number(patch.maxValue ?? state.autoSell.maxValue)),
    minValue: Math.max(0, Number(patch.minValue ?? state.autoSell.minValue ?? 0)),
    minFloat: Math.max(0, Math.min(1, Number(patch.minFloat ?? state.autoSell.minFloat ?? 0))),
    duplicateOnly: Boolean(patch.duplicateOnly ?? state.autoSell.duplicateOnly),
    allowSpecial: Boolean(patch.allowSpecial ?? state.autoSell.allowSpecial)
  };
  return state.autoSell;
}

function getMinigameDay() {
  return new Date().toISOString().slice(0, 10);
}

function ensureMinigameState(state) {
  const defaults = createDefaultState().minigames;
  state.minigames = {
    ...defaults,
    ...(state.minigames || {}),
    roulette: { ...defaults.roulette, ...(state.minigames?.roulette || {}) },
    pachinko: { ...defaults.pachinko, ...(state.minigames?.pachinko || {}) },
    crash: { ...defaults.crash, ...(state.minigames?.crash || {}) },
    upgrader: { ...defaults.upgrader, ...(state.minigames?.upgrader || {}) },
    jackpot: { ...defaults.jackpot, ...(state.minigames?.jackpot || {}) },
    history: Array.isArray(state.minigames?.history) ? state.minigames.history : []
  };
  const today = getMinigameDay();
  if (state.minigames.dailyDate !== today) {
    state.minigames.dailyDate = today;
    state.minigames.dailyEarned = 0;
  }
  return state.minigames;
}

function normalizeBet(state, value) {
  const bet = Math.max(1, Number(String(value ?? 0).replace(",", ".")) || 0);
  return Number(Math.min(bet, Number(state.credits || 0)).toFixed(2));
}

/**
 * Sanitizes and validates input parameters for game actions
 * @param {Object} params - Parameters to validate
 * @param {string} actionType - Type of action (open, bet, trade, etc)
 * @returns {Object} Validated parameters or error object
 */
function validateInputParameters(params, actionType) {
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'Invalid parameters' };
  }

  if (actionType === 'bet') {
    const bet = Number(params.bet);
    if (!Number.isFinite(bet) || bet < 1 || bet > 1000000) {
      return { ok: false, reason: 'Bet must be between 1 and 1,000,000' };
    }
  }

  if (actionType === 'open') {
    const count = Number(params.count);
    if (!Number.isFinite(count) || count < 1 || count > 1000) {
      return { ok: false, reason: 'Open count must be between 1 and 1000' };
    }
  }

  return { ok: true };
}

function applySoftCap(state, bet, rawPayout) {
  const minigames = ensureMinigameState(state);
  if (rawPayout <= bet) {
    return rawPayout;
  }
  const profit = rawPayout - bet;
  const cap = ECONOMY_CONFIG.minigameDailySoftCap;
  if (minigames.dailyEarned >= cap) {
    return Number((bet + profit * 0.18).toFixed(2));
  }
  if (minigames.dailyEarned + profit <= cap) {
    return rawPayout;
  }
  const fullProfit = Math.max(0, cap - minigames.dailyEarned);
  const reducedProfit = (profit - fullProfit) * 0.18;
  return Number((bet + fullProfit + reducedProfit).toFixed(2));
}

function recordMinigame(state, entry) {
  const minigames = ensureMinigameState(state);
  const profit = entry.payout - entry.bet;
  const recorded = { ...entry, profit, playedAt: Date.now() };
  minigames.played += 1;
  minigames.earned += profit;
  minigames.dailyEarned += Math.max(0, profit);
  minigames.bestWin = Math.max(minigames.bestWin || 0, entry.payout);
  minigames.history = [recorded, ...minigames.history].slice(0, 24);
  state.stats.minigameSpent = (state.stats.minigameSpent || 0) + entry.bet;
  state.stats.minigameEarned = (state.stats.minigameEarned || 0) + entry.payout;
  return recorded;
}

const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/**
 * Plays roulette minigame with various betting options
 * @param {Object} state - Game state
 * @param {Object} options - Bet and choice options
 * @returns {Object} Game result with payout
 */
export function playRoulette(state, { bet, choice } = {}) {
  const amount = normalizeBet(state, bet);
  if (amount <= 0) {
    return { ok: false, reason: "Crediti insufficienti." };
  }

  const normalizedChoice = ["red", "black", "green"].includes(choice) ? choice : "red";
  state.credits -= amount;
  const number = Math.floor(Math.random() * 37);
  const isRed = ROULETTE_RED.has(number);
  const isGreen = number === 0;
  const matches = {
    red: isRed,
    black: !isRed && !isGreen,
    green: isGreen
  };
  const multiplier = normalizedChoice === "green" ? 35 : 2;
  const rawPayout = matches[normalizedChoice] ? amount * multiplier : 0;
  const payout = applySoftCap(state, amount, rawPayout);
  state.credits += payout;
  state.minigames.roulette = {
    ...(state.minigames.roulette || {}),
    bet: amount,
    choice: normalizedChoice,
    autoPlay: state.minigames.roulette?.autoPlay !== false
  };

  const labels = {
    red: "Rosso",
    black: "Nero",
    green: "Verde"
  };
  const entry = recordMinigame(state, {
    game: "Roulette",
    bet: amount,
    payout,
    outcome: number,
    label: labels[normalizedChoice],
    detail: `${number === 0 ? "Verde" : isRed ? "Rosso" : "Nero"} ${number}`
  });
  return { ok: true, ...entry };
}

/**
 * Plays Pachinko game with randomized multiplier outcomes
 * @param {Object} state - Game state
 * @param {Object} options - Bet configuration
 * @returns {Object} Game result with payout multiplier
 */
export function playPachinko(state, { bet } = {}) {
  const amount = normalizeBet(state, bet);
  if (amount <= 0) {
    return { ok: false, reason: "Crediti insufficienti." };
  }

  state.credits -= amount;
  const bins = [
    { label: "Jackpot", multiplier: 5 },
    { label: "Clutch", multiplier: 2.2 },
    { label: "Hot", multiplier: 1.2 },
    { label: "Safe", multiplier: 0.7 },
    { label: "Void", multiplier: 0 },
    { label: "Safe", multiplier: 0.7 },
    { label: "Hot", multiplier: 1.2 },
    { label: "Clutch", multiplier: 2.2 },
    { label: "Jackpot", multiplier: 5 }
  ];
  const pathSteps = Array.from({ length: 8 }, () => (Math.random() < 0.5 ? "L" : "R"));
  const binIndex = pathSteps.filter((step) => step === "R").length;
  const picked = bins[binIndex] || bins[4];
  const rawPayout = Number((amount * picked.multiplier).toFixed(2));
  const payout = applySoftCap(state, amount, rawPayout);
  const path = pathSteps.join("");
  state.credits += payout;
  state.minigames.pachinko = { bet: amount };

  const entry = recordMinigame(state, {
    game: "Pachinko",
    bet: amount,
    payout,
    outcome: picked.multiplier,
    label: picked.label,
    detail: `x${picked.multiplier.toFixed(2)} - ${path}`,
    binIndex,
    path,
    bins: bins.map((bin) => ({ label: bin.label, multiplier: bin.multiplier }))
  });
  return { ok: true, ...entry };
}

export function playCoinflip(state, { bet, side } = {}) {
  const amount = normalizeBet(state, bet);
  if (amount <= 0) {
    return { ok: false, reason: "Crediti insufficienti." };
  }
  const chosenSide = side === "t" ? "t" : "ct";
  state.credits -= amount;
  const winnerSide = Math.random() < 0.5 ? "ct" : "t";
  const won = chosenSide === winnerSide;
  const rawPayout = won ? amount * 1.94 : 0;
  const payout = applySoftCap(state, amount, rawPayout);
  state.credits += payout;
  state.minigames.coinflip = { bet: amount, side: chosenSide };
  const entry = recordMinigame(state, {
    game: "Coinflip",
    bet: amount,
    payout,
    outcome: winnerSide,
    label: chosenSide === "ct" ? "CT" : "T",
    detail: `${winnerSide === "ct" ? "CT" : "T"} vince`,
    playerWon: won
  });
  return { ok: true, ...entry };
}

export function playUpgrader(state, skinData, { itemId, itemIds = [], targetMultiplier } = {}) {
  const ids = Array.isArray(itemIds) && itemIds.length ? [...new Set(itemIds)] : [itemId].filter(Boolean);
  const selectedItems = state.inventory.filter((candidate) => ids.includes(candidate.id) && !candidate.locked && candidate.type !== "rewardCase");
  if (!selectedItems.length) {
    return { ok: false, reason: "Seleziona una skin non bloccata." };
  }
  const item = selectedItems
    .slice()
    .sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.value - a.value)[0];
  const inputValue = Number(selectedItems.reduce((sum, candidate) => sum + getSellReturn(state, candidate), 0).toFixed(2));
  const multiplier = Math.max(1.25, Math.min(12, Number(targetMultiplier) || 2));
  const winChance = Math.max(0.06, Math.min(0.72, (0.92 / multiplier) * (1 + getProfileSkillBonus(state).luck * 1.6)));
  const selectedIdSet = new Set(selectedItems.map((candidate) => candidate.id));
  state.inventory = state.inventory.filter((candidate) => !selectedIdSet.has(candidate.id));
  const won = Math.random() < winChance;
  let upgraded = null;
  if (won) {
    const targetValue = inputValue * multiplier;
    const rarity = RARITY_ORDER.find((candidate) => RARITIES[candidate].baseValue >= RARITIES[item.rarity].baseValue * Math.min(4, multiplier)) ||
      getNextRarity(item.rarity);
    const pool = skinData.globalPool?.[rarity]?.length ? skinData.globalPool[rarity] : skinData.skins.filter((skin) => skin.rarity === rarity);
    const skin = pool[Math.floor(Math.random() * pool.length)] || skinData.skins[Math.floor(Math.random() * skinData.skins.length)];
    upgraded = createInventoryItem(skin, rarity, { id: "upgrader", name: "Upgrader", valueScale: 1.04 + multiplier * 0.035 }, state);
    upgraded.value = Number(Math.max(upgraded.value, targetValue * (0.78 + Math.random() * 0.24)).toFixed(2));
    upgraded.name = `Upgraded ${upgraded.name}`;
    state.inventory.unshift(upgraded);
    rememberDrop(state, upgraded);
  }
  state.minigames.upgrader = { itemId: "", itemIds: [], targetMultiplier: multiplier };
  const entry = recordMinigame(state, {
    game: "Upgrader",
    bet: inputValue,
    payout: upgraded ? getSellReturn(state, upgraded) : 0,
    outcome: won ? "win" : "loss",
    label: `x${multiplier.toFixed(2)} · ${(winChance * 100).toFixed(1)}%`,
    detail: won ? upgraded.name : `${selectedItems.length} skin bruciate`,
    playerWon: won,
    consumedItem: item,
    consumedItems: selectedItems,
    upgradedItem: upgraded
  });
  return { ok: true, ...entry, chance: winChance };
}

function buildCrashPoint() {
  const houseEdge = clampNumber(ECONOMY_CONFIG.crashHouseEdge, 0, 0.18);
  if (Math.random() < 0.026 + houseEdge * 0.38) {
    return Number((1 + Math.random() * 0.04).toFixed(2));
  }
  const roll = Math.random();
  const point = (1 - houseEdge * 0.72) / Math.max(0.008, 1 - roll);
  return Number(Math.min(150, Math.max(1.03, point)).toFixed(point < 10 ? 2 : point < 100 ? 2 : 1));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

/**
 * Starts a crash game round with generated crash point
 * @param {Object} state - Game state
 * @param {Object} options - Bet and auto-cashout configuration
 * @returns {Object} Result with crash point and round data
 */
export function startCrashRound(state, { bet, autoCashout } = {}) {
  const amount = normalizeBet(state, bet);
  if (amount <= 0) {
    return { ok: false, reason: "Crediti insufficienti." };
  }

  const target = clampNumber(autoCashout, 1.05, 50) || createDefaultState().minigames.crash.autoCashout;
  state.credits -= amount;
  state.minigames.crash = {
    ...(state.minigames.crash || {}),
    bet: amount,
    autoCashout: target,
    autoPlay: state.minigames.crash?.autoPlay !== false
  };

  return {
    ok: true,
    game: "Crash",
    bet: amount,
    autoCashout: target,
    crashPoint: buildCrashPoint()
  };
}

/**
 * Settles a completed crash round: calculates payout based on cashout point
 * @param {Object} state - Game state
 * @param {Object} round - Completed round with crash point
 * @param {Object} options - Cashout point configuration
 * @returns {Object} Result with payout and settlement data
 */
export function settleCrashRound(state, round, { cashoutPoint = 0 } = {}) {
  const bet = Number(round?.bet || 0);
  if (bet <= 0) {
    return { ok: false, reason: "Round crash non valida." };
  }

  const crashPoint = clampNumber(round?.crashPoint, 1.01, 150);
  const cashedOutAt = clampNumber(cashoutPoint, 0, crashPoint);
  const rawPayout = cashedOutAt > 0 ? Number((bet * cashedOutAt).toFixed(2)) : 0;
  const payout = applySoftCap(state, bet, rawPayout);
  state.credits += payout;
  state.minigames.crash = {
    ...(state.minigames.crash || {}),
    bet,
    autoCashout: clampNumber(round?.autoCashout, 1.05, 50) || createDefaultState().minigames.crash.autoCashout,
    autoPlay: state.minigames.crash?.autoPlay !== false
  };

  const entry = recordMinigame(state, {
    game: "Crash",
    bet,
    payout,
    outcome: crashPoint,
    label: cashedOutAt > 0 ? `Cashout x${cashedOutAt.toFixed(2)}` : `Auto x${state.minigames.crash.autoCashout.toFixed(2)}`,
    detail: cashedOutAt > 0
      ? `cashout x${cashedOutAt.toFixed(2)} - crash x${crashPoint.toFixed(2)}`
      : `crash x${crashPoint.toFixed(2)}`,
    playerWon: cashedOutAt > 0,
    crashPoint,
    autoCashout: state.minigames.crash.autoCashout,
    cashoutPoint: cashedOutAt || null
  });
  return { ok: true, ...entry };
}

export function playCrash(state, { bet, autoCashout } = {}) {
  const round = startCrashRound(state, { bet, autoCashout });
  if (!round.ok) {
    return round;
  }
  const cashoutPoint = round.crashPoint >= round.autoCashout ? round.autoCashout : 0;
  return settleCrashRound(state, round, { cashoutPoint });
}

function normalizeJackpotOpponents(opponents, playerDeposit) {
  const seen = new Set();
  return (Array.isArray(opponents) ? opponents : [])
    .filter((opponent) => {
      if (!opponent?.id || seen.has(opponent.id) || opponent.id === "player") {
        return false;
      }
      seen.add(opponent.id);
      return true;
    })
    .map((opponent, index, list) => {
      const entries = Array.isArray(opponent.items) ? opponent.items : Array.isArray(opponent.entries) ? opponent.entries : [];
      const fallbackTotal = Number((playerDeposit * (0.82 + Math.random() * 0.36) / Math.max(1, Math.min(3, list.length))).toFixed(2));
      const explicitTotal = Number(opponent.total || opponent.value || 0);
      return {
        id: String(opponent.id),
        name: String(opponent.name || `Player ${index + 2}`),
        accent: opponent.accent || "#64d7e3",
        total: Number((explicitTotal > 0 ? explicitTotal : fallbackTotal).toFixed(2)),
        itemCount: Math.max(entries.length, Number(opponent.itemCount || opponent.itemsCount || 0), entries.length ? entries.length : 1),
        entries
      };
    })
    .filter((opponent) => opponent.total > 0)
    .slice(0, 7);
}

/**
 * Plays Jackpot multiplayer game: deposits items into a shared pot with real online users.
 * @param {Object} state - Game state
 * @param {Object} skinData - Skin database, kept for backward-compatible call sites
 * @param {Object} options - Game config with item IDs and online opponents
 * @returns {Object} Result with participants, winner, pot value, and player winnings
 */
export function playJackpot(state, skinData, { itemIds = [], opponents = [] } = {}) {
  const ids = Array.isArray(itemIds) ? [...new Set(itemIds)] : [];
  const depositedItems = state.inventory.filter((item) => ids.includes(item.id) && !item.locked);
  if (!depositedItems.length) {
    return { ok: false, reason: "Seleziona almeno una skin non bloccata per il jackpot." };
  }

  const playerDeposit = Number(
    depositedItems.reduce((sum, item) => sum + getSellReturn(state, item), 0).toFixed(2)
  );
  if (playerDeposit <= 0) {
    return { ok: false, reason: "Le skin selezionate non hanno valore utile per il jackpot." };
  }

  const normalizedOpponents = normalizeJackpotOpponents(opponents, playerDeposit);
  if (!normalizedOpponents.length) {
    return { ok: false, reason: "Il jackpot aspetta almeno 2 utenti online." };
  }
  state.inventory = state.inventory.filter((item) => !ids.includes(item.id));
  state.minigames.jackpot = {};

  const participants = [
    {
      id: "player",
      name: state.profile?.name || "Tu",
      accent: state.profile?.accent || "#7fe37c",
      total: playerDeposit,
      entries: depositedItems.map((item) => ({
        ...item,
        value: getSellReturn(state, item)
      }))
    },
    ...normalizedOpponents
  ];

  const totalPot = participants.reduce((sum, participant) => sum + Number(participant.total || 0), 0);

  const winner = weightedPick(participants.map((participant) => ({
    value: participant,
    weight: Math.max(0.01, participant.total)
  })));
  const wonItems = winner.id === "player"
    ? participants.flatMap((participant) => participant.entries.map((item) => ({
      ...item,
      locked: false,
      favorite: false
    })))
    : [];
  if (wonItems.length) {
    state.inventory = [...wonItems, ...state.inventory];
  }
  const payout = winner.id === "player"
    ? Number(wonItems.reduce((sum, item) => sum + getSellReturn(state, item), 0).toFixed(2))
    : 0;
  const wonCount = winner.id === "player" ? wonItems.length : 0;

  const entry = recordMinigame(state, {
    game: "Jackpot",
    bet: playerDeposit,
    payout,
    outcome: winner.name,
    label: `${participants.length} utenti nel pot`,
    detail: winner.id === "player"
      ? `${winner.name} prende ${wonCount} skin dal pot`
      : `${winner.name} prende ${participants.reduce((sum, participant) => sum + participant.entries.length, 0)} skin`,
    participants,
    potValue: Number(totalPot.toFixed(2)),
    feeRate: 0,
    playerWon: winner.id === "player",
    winnerName: winner.name,
    depositedItems: participants[0].entries,
    wonItems
  });
  return { ok: true, ...entry };
}

export function claimDailyReward(state) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.daily.lastClaimDate === today) {
    return { ok: false, reason: "Reward giornaliero gia' ritirato." };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.daily.streak = state.daily.lastClaimDate === yesterday ? state.daily.streak + 1 : 1;
  state.daily.lastClaimDate = today;
  const prestigeLevel = state.prestige.level || 0;
  const reward = Math.round(
    (18 + state.daily.streak * 5 + Math.pow(prestigeLevel, 2) * 9) *
      (1 + prestigeLevel * 0.08) *
      Math.max(1, getCollectionMultiplier(state))
  );
  state.credits += reward;
  state.stats.dailyClaims += 1;
  return { ok: true, reward, streak: state.daily.streak };
}

/**
 * Performs prestige reset: clears inventory/upgrades, grants shards for progression, and unlocks bonuses
 * @param {Object} state - Game state object
 * @returns {Object} Result with ok flag, gained shards, and net worth at reset
 */
export function prestige(state) {
  if (state.prestige.level >= MAX_PRESTIGE_LEVEL) {
    return { ok: false, reason: `Prestige massimo raggiunto (${MAX_PRESTIGE_LEVEL}).` };
  }
  if (!canPrestige(state)) {
    return { ok: false, reason: "Serve piu' net worth e piu' casse aperte." };
  }

  const netWorth = getNetWorth(state);
  const gainedShards = Math.max(1, Math.floor(Math.sqrt(netWorth / 120) + state.prestige.level * 0.65));
  state.prestige.level += 1;
  state.prestige.shards += gainedShards;
  state.prestige.lifetimeShards += gainedShards;
  state.prestige.totalResets += 1;
  state.credits = getPrestigeResetCredits(state.prestige.level);
  state.inventory = [];
  state.upgrades = UPGRADE_DEFINITIONS.reduce((upgrades, upgrade) => {
    upgrades[upgrade.id] = 0;
    return upgrades;
  }, {});
  state.combo = { count: 0, best: state.combo.best, lastOpenAt: 0 };
  state.event = { type: null, label: "", multiplier: 1, expiresAt: 0 };
  return { ok: true, gainedShards, netWorth };
}

function resolveMetric(state, metric, netWorth) {
  if (metric === "netWorth") {
    return netWorth;
  }
  if (metric === "prestige") {
    return state.prestige.level;
  }
  if (metric === "bestCombo") {
    return state.combo.best;
  }
  if (metric === "contracts") {
    return state.stats.contracts;
  }
  if (metric === "collections") {
    return state.stats.collections;
  }
  if (metric === "marketFlips") {
    return state.stats.marketFlips;
  }
  if (metric === "limitedEvents") {
    return state.stats.limitedEvents;
  }
  if (metric.startsWith("rarity.")) {
    return state.stats.rarityCounts[metric.replace("rarity.", "")] || 0;
  }
  return state.stats[metric] || 0;
}

export function syncAchievements(state) {
  const completed = [];
  const netWorth = getNetWorth(state);

  ACHIEVEMENTS.forEach((achievement) => {
    const progress = resolveMetric(state, achievement.metric, netWorth);
    const record = state.achievements[achievement.id];
    if (progress >= achievement.target && !record?.completedAt) {
      state.achievements[achievement.id] = {
        completedAt: Date.now(),
        reward: achievement.reward
      };
      state.credits += achievement.reward;
      completed.push(achievement);
    }
  });

  return completed;
}

export function getAchievementProgress(state, achievement) {
  return resolveMetric(state, achievement.metric, getNetWorth(state));
}

/**
 * Validates that game state maintains required invariants.
 * Returns error details if state is corrupted, otherwise returns ok: true.
 * @param {Object} state - Game state to validate
 * @returns {Object} Validation result with ok flag and optional error message
 */
export function validateGameState(state) {
  try {
    if (!state || typeof state !== 'object') {
      return { ok: false, reason: 'Invalid state object' };
    }

    if (!Number.isFinite(state.credits) || state.credits < 0) {
      return { ok: false, reason: 'Credits corrupted: reset required' };
    }

    if (!Array.isArray(state.inventory)) {
      return { ok: false, reason: 'Inventory corrupted: reset required' };
    }

    if (state.inventory.some(item => !item.id || !item.rarity)) {
      return { ok: false, reason: 'Inventory item missing fields' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[GameLogic] Validation error:', err);
    return { ok: false, reason: 'Validation failed' };
  }
}

export function getNextRarity(rarity) {
  const index = RARITY_ORDER.indexOf(rarity);
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, index + 1)];
}

/**
 * Executes a trade-up contract: 10 items of same rarity → 1 item of next rarity
 * @param {Object} state - Game state object
 * @param {string} rarity - Rarity tier of input items
 * @param {Object} caseDef - Case definition for new item generation
 * @param {Object} skinData - Complete skin database
 * @returns {Object} Result with ok flag, generated item, and inventory update
 */
export function runTradeUpContract(state, rarity, caseDef, skinData) {
  const nextRarity = getNextRarity(rarity);
  const inputCount = getTradeUpInputCount(state);
  if (!rarity || rarity === "Rare Special Item" || nextRarity === rarity) {
    return { ok: false, reason: "Questa rarita' non puo' essere contrattata." };
  }

  const candidates = state.inventory
    .filter((item) => item.rarity === rarity && !item.locked && !item.favorite)
    .sort((a, b) => a.value - b.value)
    .slice(0, inputCount);

  if (candidates.length < inputCount) {
    return { ok: false, reason: `Servono ${inputCount} skin della stessa rarita'.` };
  }

  const ids = new Set(candidates.map((item) => item.id));
  state.inventory = state.inventory.filter((item) => !ids.has(item.id));
  const inputValue = candidates.reduce((sum, item) => sum + item.value, 0);
  const skin = pickSkin(caseDef, nextRarity, skinData);
  const item = createInventoryItem(skin, nextRarity, caseDef, state);
  const specialist = state.upgrades.tradeUpSpecialist || 0;
  const floor = ECONOMY_CONFIG.tradeUpFloor + specialist * 0.012;
  const ceiling = ECONOMY_CONFIG.tradeUpCeiling + specialist * 0.009;
  item.value = Number(Math.max(item.value, inputValue * (floor + Math.random() * (ceiling - floor))).toFixed(2));
  item.name = `Contract ${item.name}`;
  state.inventory.unshift(item);
  rememberDrop(state, item);
  state.stats.contracts += 1;
  state.stats.rarityCounts[nextRarity] = (state.stats.rarityCounts[nextRarity] || 0) + 1;
  state.stats.totalDropValue += item.value;

  if (!state.stats.bestDrop || item.value > state.stats.bestDrop.value) {
    state.stats.bestDrop = item;
  }

  return { ok: true, item, consumed: candidates, inputValue };
}

export function getCollectionGoals(state, skinData) {
  const groups = new Map();
  skinData.skins.forEach((skin) => {
    const collection = skin.collections?.[0];
    if (!collection) {
      return;
    }
    if (!groups.has(collection)) {
      groups.set(collection, new Set());
    }
    groups.get(collection).add(skin.id);
  });

  const owned = new Map();
  Object.entries(state.collections.discovered || {}).forEach(([collection, ids]) => {
    owned.set(collection, new Set(Object.keys(ids || {})));
  });
  state.inventory.forEach((item) => {
    if (!item.collection || item.collection === "No Collection") {
      return;
    }
    if (!owned.has(item.collection)) {
      owned.set(item.collection, new Set());
    }
    owned.get(item.collection).add(item.skinId);
  });

  return [...groups.entries()]
    .filter(([, ids]) => ids.size >= 8)
    .map(([name, ids]) => {
      const ownedCount = owned.get(name)?.size || 0;
      const total = ids.size;
      const target = Math.min(total, Math.max(6, Math.ceil(total * 0.4)));
      const archiveAssist = Math.min(
        Math.max(0, target - ownedCount),
        Math.floor((state.collections.archivePoints || 0) / 42) + getProfileSkillBonus(state).collectionAssist
      );
      const effectiveOwned = Math.min(target, ownedCount + archiveAssist);
      const claimed = Boolean(state.collections.claimed[name]);
      const progress = Math.min(1, effectiveOwned / target);
      return {
        name,
        owned: ownedCount,
        assisted: archiveAssist,
        effectiveOwned,
        total,
        target,
        progress,
        ready: effectiveOwned >= target && !claimed,
        claimed,
        reward: Math.round((ECONOMY_CONFIG.collectionCreditBase + target * 185) *
          (1 + getPrestigeNodeEffect(state, "collection") + (state.upgrades.collectionHunter || 0) * 0.04))
      };
    })
    .sort((a, b) => Number(b.ready) - Number(a.ready) || b.progress - a.progress || a.name.localeCompare(b.name));
}

export function claimCollectionReward(state, collectionName, skinData) {
  const goal = getCollectionGoals(state, skinData).find((candidate) => candidate.name === collectionName);
  if (!goal) {
    return { ok: false, reason: "Collezione non trovata." };
  }
  if (goal.claimed) {
    return { ok: false, reason: "Bonus collezione gia' riscosso." };
  }
  if (!goal.ready) {
    return { ok: false, reason: "Collezione non ancora pronta." };
  }

  state.collections.claimed[collectionName] = Date.now();
  state.collections.power += 1;
  state.stats.collections += 1;
  state.credits += goal.reward;
  return { ok: true, goal };
}

export function getMarketTrend(state) {
  const now = Date.now();
  if (!state.market.trendId || state.market.trendExpiresAt <= now) {
    const trend = MARKET_TRENDS[Math.floor(Math.random() * MARKET_TRENDS.length)];
    state.market.trendId = trend.id;
    state.market.trendExpiresAt = now + 1000 * 60 * (4 + Math.floor(Math.random() * 5));
  }
  return MARKET_TRENDS.find((trend) => trend.id === state.market.trendId) || MARKET_TRENDS[1];
}

export function refreshMarket(state, skinData, selectedCase) {
  const now = Date.now();
  const trend = getMarketTrend(state);
  if (state.market.offers.length && now - state.market.lastRefreshAt < ECONOMY_CONFIG.marketplaceRefreshMs) {
    return state.market.offers;
  }

  const rarities = ["Mil-Spec", "Restricted", "Classified", "Covert"];
  const limited = getLimitedEventEffect(state);
  const offerCount = Math.max(1, (state.prestige?.level || 0) + 1);
  state.market.offers = Array.from({ length: offerCount }, (_, index) => {
    const rarity = rarities[Math.min(rarities.length - 1, Math.floor(Math.random() * rarities.length))];
    const skin = pickSkin(selectedCase, rarity, skinData);
    const fakeCase = selectedCase;
    const item = createInventoryItem(skin, rarity, fakeCase, state);
    const swing = 1 + (Math.random() * trend.volatility * 2 - trend.volatility);
    const trendMultiplier = trend.multiplier * (limited.marketMultiplier || 1);
    const deal = swing * trendMultiplier;
    item.value = Number((item.value * deal).toFixed(2));
    const edge = 0.78 + Math.random() * 0.62;
    const price = Number((item.value * edge * (1 - getMarketAnalystDiscount(state))).toFixed(2));
    return {
      id: `${item.id}-offer-${index}`,
      item,
      price,
      fairValue: item.value,
      trend: trend.name,
      edge: Number((((item.value - price) / Math.max(1, price)) * 100).toFixed(1)),
      botInterest: Math.min(98, Math.max(8, Math.round(52 + (item.value - price) / Math.max(1, price) * 80 + (state.upgrades.marketAnalyst || 0) * 1.2 + Math.random() * 18))),
      expiresAt: now + 1000 * 60 * (3 + index)
    };
  });
  state.market.lastRefreshAt = now;
  return state.market.offers;
}

export function buyMarketOffer(state, offerId) {
  const offer = state.market.offers.find((candidate) => candidate.id === offerId);
  if (!offer) {
    return { ok: false, reason: "Offerta non trovata." };
  }
  if (state.credits < offer.price) {
    return { ok: false, reason: "Crediti insufficienti." };
  }
  state.credits -= offer.price;
  state.stats.totalSpent += offer.price;
  const item = {
    ...offer.item,
    id: offer.item.id.replace("-offer", "-market"),
    marketCost: offer.price,
    obtainedAt: Date.now()
  };
  recordCollectionDiscovery(state, item);
  state.inventory.unshift(item);
  state.market.offers = state.market.offers.filter((candidate) => candidate.id !== offerId);
  return { ok: true, offer };
}

export const COMMUNITY_GOAL_DEFINITIONS = [
  { id: "solo-12h", label: "Rush personale", scope: "solo", durationMs: 12 * 60 * 60 * 1000, target: 450, rewardTier: 1, rewardCount: 1 },
  { id: "community-24h", label: "Drop della community", scope: "community", durationMs: 24 * 60 * 60 * 1000, target: 18000, rewardTier: 2, rewardCount: 1 },
  { id: "community-3d", label: "Operazione 3 giorni", scope: "community", durationMs: 3 * 24 * 60 * 60 * 1000, target: 62000, rewardTier: 3, rewardCount: 2 },
  { id: "community-7d", label: "Vault settimanale", scope: "community", durationMs: 7 * 24 * 60 * 60 * 1000, target: 160000, rewardTier: 4, rewardCount: 2 },
  { id: "solo-10d", label: "Contratto personale", scope: "solo", durationMs: 10 * 24 * 60 * 60 * 1000, target: 12500, rewardTier: 5, rewardCount: 3 }
];

const PROMO_CODE_REWARDS = {
  MARCUS: { credits: 10000, label: "MARCUS launch bonus" }
};

function goalWindowKey(goal, now = Date.now()) {
  return `${goal.id}:${Math.floor(now / goal.durationMs)}`;
}

function createRewardCase(goal, index = 0) {
  const names = ["Bronze", "Community", "Operation", "Elite", "Mythic"];
  const rarity = ["Mil-Spec", "Restricted", "Classified", "Covert", "Rare Special Item"][Math.max(0, Math.min(4, goal.rewardTier - 1))];
  return {
    id: `reward-case-${goal.id}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    type: "rewardCase",
    rewardTier: goal.rewardTier,
    name: `${names[Math.max(0, Math.min(4, goal.rewardTier - 1))]} Reward Case`,
    image: "",
    rarity,
    rarityColor: RARITIES[rarity].color,
    value: Math.round(60 * Math.pow(2.35, goal.rewardTier - 1)),
    caseName: goal.label,
    wear: "Sealed",
    float: 0,
    locked: false,
    favorite: false,
    obtainedAt: Date.now()
  };
}

function ensureGoalState(state) {
  state.goals ||= createDefaultState().goals;
  state.goals.contributions ||= {};
  state.goals.claimed ||= {};
  return state.goals;
}

export function getCommunityGoals(state, now = Date.now(), sharedContributions = {}) {
  const goalsState = ensureGoalState(state);
  const discount = getProfileSkillBonus(state).goalDiscount;
  return COMMUNITY_GOAL_DEFINITIONS.map((goal) => {
    const key = goalWindowKey(goal, now);
    const target = Math.max(1, Math.round(goal.target * (goal.scope === "solo" ? 1 - discount : 1)));
    const personalContributed = Number(goalsState.contributions[key] || 0);
    const sharedContributed = goal.scope === "community" ? Number(sharedContributions?.[key] || 0) : 0;
    const contributed = goal.scope === "community"
      ? Math.max(personalContributed, sharedContributed)
      : personalContributed;
    const progress = Math.min(1, contributed / target);
    return {
      ...goal,
      key,
      target,
      contributed,
      personalContributed,
      sharedContributed,
      progress,
      ready: contributed >= target,
      claimed: Boolean(goalsState.claimed[key]),
      endsAt: (Math.floor(now / goal.durationMs) + 1) * goal.durationMs
    };
  });
}

export function depositCommunityGoalCredits(state, goalId, amount) {
  const goal = getCommunityGoals(state).find((candidate) => candidate.id === goalId);
  if (!goal) {
    return { ok: false, reason: "Goal non trovato." };
  }
  const value = Math.max(1, Math.min(Math.floor(Number(amount) || 0), Math.floor(state.credits)));
  if (value <= 0) {
    return { ok: false, reason: "Crediti insufficienti." };
  }
  state.credits -= value;
  state.stats.totalSpent += value;
  ensureGoalState(state).contributions[goal.key] = Number(((state.goals.contributions[goal.key] || 0) + value).toFixed(2));
  return { ok: true, deposited: value, goal: getCommunityGoals(state).find((candidate) => candidate.id === goalId) };
}

export function claimCommunityGoalReward(state, goalId, now = Date.now(), sharedContributions = {}) {
  const goal = getCommunityGoals(state, now, sharedContributions).find((candidate) => candidate.id === goalId);
  if (!goal) {
    return { ok: false, reason: "Goal non trovato." };
  }
  if (!goal.ready) {
    return { ok: false, reason: "Soglia non raggiunta." };
  }
  if (goal.claimed) {
    return { ok: false, reason: "Reward gia' riscattato." };
  }
  const rewardCases = Array.from({ length: goal.rewardCount }, (_, index) => createRewardCase(goal, index));
  state.inventory.unshift(...rewardCases);
  state.goals.claimed[goal.key] = Date.now();
  return { ok: true, goal, rewardCases };
}

export function cheatCompleteCommunityGoals(state) {
  const goals = getCommunityGoals(state);
  goals.forEach((goal) => {
    ensureGoalState(state).contributions[goal.key] = Math.max(goal.target, Number(state.goals.contributions[goal.key] || 0));
  });
  return getCommunityGoals(state);
}

export function openRewardCase(state, itemId, skinData) {
  const rewardCase = state.inventory.find((item) => item.id === itemId && item.type === "rewardCase");
  if (!rewardCase) {
    return { ok: false, reason: "Cassa reward non trovata." };
  }
  state.inventory = state.inventory.filter((item) => item.id !== itemId);
  const tier = Math.max(1, Math.min(5, Number(rewardCase.rewardTier || 1)));
  const profiles = {
    1: [["Consumer Grade", 42], ["Industrial Grade", 33], ["Mil-Spec", 18], ["Restricted", 5.5], ["Classified", 1.3], ["Covert", 0.2]],
    2: [["Industrial Grade", 32], ["Mil-Spec", 38], ["Restricted", 20], ["Classified", 7], ["Covert", 2.4], ["Rare Special Item", 0.6]],
    3: [["Mil-Spec", 36], ["Restricted", 31], ["Classified", 18], ["Covert", 11], ["Rare Special Item", 4]],
    4: [["Restricted", 28], ["Classified", 32], ["Covert", 26], ["Rare Special Item", 14]],
    5: [["Classified", 28], ["Covert", 42], ["Rare Special Item", 30]]
  };
  const rarity = weightedPick(profiles[tier].map(([value, weight]) => ({ value, weight })));
  const pool = skinData.globalPool?.[rarity]?.length ? skinData.globalPool[rarity] : skinData.skins.filter((skin) => skin.rarity === rarity);
  const skin = pool[Math.floor(Math.random() * pool.length)] || skinData.skins[Math.floor(Math.random() * skinData.skins.length)];
  const item = createInventoryItem(skin, rarity, {
    id: `reward-${rewardCase.id}`,
    name: rewardCase.name,
    valueScale: 1 + tier * 0.08
  }, state);
  item.name = `${rewardCase.name} ${item.name}`;
  state.inventory.unshift(item);
  rememberDrop(state, item);
  state.stats.rarityCounts[rarity] = (state.stats.rarityCounts[rarity] || 0) + 1;
  state.stats.totalDropValue += item.value;
  if (!state.stats.bestDrop || item.value > state.stats.bestDrop.value) {
    state.stats.bestDrop = item;
  }
  return { ok: true, rewardCase, item };
}

export function deleteRewardCase(state, itemId) {
  const item = state.inventory.find((candidate) => candidate.id === itemId && candidate.type === "rewardCase");
  if (!item) {
    return { ok: false, reason: "Cassa non trovata." };
  }
  state.inventory = state.inventory.filter((candidate) => candidate.id !== itemId);
  return { ok: true, item };
}

export function redeemPromoCode(state, code, skinData = null) {
  const normalized = String(code || "").trim().toUpperCase();
  const reward = PROMO_CODE_REWARDS[normalized] || state.promoCodes?.custom?.[normalized];
  if (!reward) {
    return { ok: false, reason: "Codice promo non valido." };
  }
  state.promoCodes ||= createDefaultState().promoCodes;
  state.promoCodes.redeemed ||= {};
  if (state.promoCodes.redeemed[normalized]) {
    return { ok: false, reason: "Codice promo gia' usato." };
  }
  const credits = Math.max(0, Number(reward.credits || 0));
  state.credits += credits;
  state.promoCodes.redeemed[normalized] = Date.now();
  const cases = Array.from({ length: Math.max(0, Number(reward.cases || 0)) }, (_, index) => createRewardCase({
    id: `promo-${normalized}`,
    label: reward.label || normalized,
    rewardTier: Math.max(1, Number(reward.rewardTier || 2)),
    rewardCount: 1
  }, index));
  if (cases.length) {
    state.inventory.unshift(...cases);
  }
  const weapons = [];
  if (skinData && Number(reward.weapons || 0) > 0) {
    const rarity = RARITIES[reward.weaponRarity] ? reward.weaponRarity : "Mil-Spec";
    const pool = skinData.globalPool?.[rarity]?.length ? skinData.globalPool[rarity] : skinData.skins.filter((skin) => skin.rarity === rarity);
    for (let index = 0; index < Math.min(12, Number(reward.weapons || 0)); index += 1) {
      const skin = pool[Math.floor(Math.random() * pool.length)] || skinData.skins[Math.floor(Math.random() * skinData.skins.length)];
      const item = createInventoryItem(skin, rarity, { id: `promo-${normalized}`, name: `Promo ${normalized}`, valueScale: 1 }, state);
      item.name = `Promo ${item.name}`;
      weapons.push(item);
    }
    state.inventory.unshift(...weapons);
  }
  return { ok: true, code: normalized, credits, cases, weapons, label: reward.label || normalized };
}

export function createPromoCode(state, { code, credits = 0, cases = 0, rewardTier = 2, weapons = 0, weaponRarity = "Mil-Spec" } = {}) {
  const normalized = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
  if (normalized.length < 3) {
    return { ok: false, reason: "Codice troppo corto." };
  }
  state.promoCodes ||= createDefaultState().promoCodes;
  state.promoCodes.custom ||= {};
  state.promoCodes.custom[normalized] = {
    credits: Math.max(0, Math.floor(Number(credits) || 0)),
    cases: Math.max(0, Math.floor(Number(cases) || 0)),
    rewardTier: Math.max(1, Math.min(5, Math.floor(Number(rewardTier) || 2))),
    weapons: Math.max(0, Math.floor(Number(weapons) || 0)),
    weaponRarity: RARITIES[weaponRarity] ? weaponRarity : "Mil-Spec",
    label: `Admin promo ${normalized}`,
    createdAt: Date.now()
  };
  return { ok: true, code: normalized, reward: state.promoCodes.custom[normalized] };
}

export function deletePromoCode(state, code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized || PROMO_CODE_REWARDS[normalized]) {
    return { ok: false, reason: "Questo codice non puo' essere eliminato dal pannello locale." };
  }
  state.promoCodes ||= createDefaultState().promoCodes;
  state.promoCodes.custom ||= {};
  if (!state.promoCodes.custom[normalized]) {
    return { ok: false, reason: "Promo code non trovato." };
  }
  delete state.promoCodes.custom[normalized];
  return { ok: true, code: normalized };
}

export function resetCommunityGoalState(state) {
  state.goals = createDefaultState().goals;
  return getCommunityGoals(state);
}

export function createAuctionListing(state, itemId, price) {
  const item = state.inventory.find((candidate) => candidate.id === itemId && !candidate.locked && candidate.type !== "rewardCase");
  if (!item) {
    return { ok: false, reason: "Seleziona una skin non bloccata." };
  }
  state.auctions ||= createDefaultState().auctions;
  const activeListings = (state.auctions.listings || []).filter((listing) => listing.status === "active").length;
  if (activeListings >= MARKETPLACE_ACTIVE_LISTING_LIMIT) {
    return { ok: false, reason: `Puoi avere massimo ${MARKETPLACE_ACTIVE_LISTING_LIMIT} item attivi sul Marketplace.` };
  }
  const fair = getSellReturn(state, item);
  const listingPrice = Number(Number(price || 0).toFixed(2));
  if (!Number.isFinite(listingPrice) || listingPrice <= 0 || listingPrice > MARKETPLACE_MAX_PRICE) {
    return { ok: false, reason: `Prezzo valido: ${formatCredits(0.01)} - ${formatCredits(MARKETPLACE_MAX_PRICE)}.` };
  }
  state.inventory = state.inventory.filter((candidate) => candidate.id !== itemId);
  const listing = {
    id: `market-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    item,
    price: listingPrice,
    fair,
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 45,
    status: "active"
  };
  state.auctions.listings.unshift(listing);
  return { ok: true, listing };
}

export function settleAuctionListing(state, listingId) {
  const listing = state.auctions?.listings?.find((candidate) => candidate.id === listingId);
  if (!listing || listing.status !== "active") {
    return { ok: false, reason: "Inserzione Marketplace non trovata." };
  }
  const fair = getSellReturn(state, listing.item);
  const saleChance = Math.max(0.12, Math.min(0.92, 0.72 - (listing.price - fair) / Math.max(1, fair) * 0.85));
  const sold = Math.random() < saleChance || Date.now() >= listing.expiresAt;
  if (!sold) {
    listing.expiresAt = Date.now() + 1000 * 60 * 15;
    return { ok: true, sold: false, listing, chance: saleChance };
  }
  const fee = Math.max(0.03, 0.09 - getProfileSkillBonus(state).auctionFeeReduction);
  const payout = Number((listing.price * (1 - fee)).toFixed(2));
  state.credits += payout;
  state.stats.totalEarned += payout;
  listing.status = "sold";
  listing.soldAt = Date.now();
  listing.payout = payout;
  return { ok: true, sold: true, listing, payout, chance: saleChance };
}
