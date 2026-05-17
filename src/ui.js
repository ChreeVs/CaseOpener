import {
  ACHIEVEMENTS
} from "./config/achievementsConfig.js";
import {
  CASE_MAX_PRESTIGE_UNLOCK,
  ECONOMY_CONFIG,
  INVENTORY_PAGE_SIZE,
  PRESTIGE_TREE,
  TAB_LABELS,
  UPGRADE_DEFINITIONS
} from "./config.js"; // Not split yet
import {
  RARITIES,
  RARITY_ORDER
} from "./config/rarityConfig.js";
import { MINIGAME_DEFINITIONS } from "./systems/games/gameDefinitions.js";
import {
  fetchSupabaseChatMessages,
  isSupabaseChatEnabled,
  sendSupabaseChatMessage,
  subscribeSupabaseChat
} from "./network/supabaseChat.js";
import {
  fetchCommunityGoalTotals,
  isCommunityGoalsSyncAvailable,
  submitCommunityGoalContribution,
  submitCommunityGoalReset,
  subscribeCommunityGoalContributions,
  subscribeCommunityGoalResets
} from "./network/communityGoals.js";
import {
  deleteGlobalPromoCode,
  fetchGlobalPromoCodes,
  isGlobalPromoCodesAvailable,
  upsertGlobalPromoCode
} from "./network/globalPromoCodes.js";
import {
  buyGlobalAuction,
  createGlobalAuction,
  fetchGlobalAuctions,
  fetchSharedGameEvents,
  isSharedGamesAvailable,
  publishSharedGameEvent,
  subscribeGlobalAuctions,
  subscribeSharedGameEvents
} from "./network/sharedGames.js";
import {
  getSessionDisplayName,
  getCloudSession,
  isCloudSaveAvailable,
  loadCloudState,
  registerWithUsernamePassword,
  saveCloudState,
  signInWithDiscord,
  signInWithUsernamePassword,
  signInCloudAnonymously,
  signOutCloud
} from "./network/cloudSave.js";
import {
  buyMarketOffer,
  buyPrestigeNode,
  buyUpgrade,
  canPrestige,
  cheatAddCredits,
  cheatAddPrestigeLevels,
  cheatAddShards,
  cheatMaxUpgrades,
  cheatSetCaseMastery,
  cheatSetCredits,
  cheatCompleteCommunityGoals,
  cheatUnlockAllCases,
  claimCollectionReward,
  claimCommunityGoalReward,
  claimDailyReward,
  createAuctionListing,
  createPromoCode,
  clearExpiredEvent,
  deletePromoCode,
  deleteRewardCase,
  depositCommunityGoalCredits,
  formatCredits,
  getAchievementProgress,
  getAutoInterval,
  getCaseDropTable,
  getCaseMastery,
  getCaseStats,
  getCollectionGoals,
  getCollectionMultiplier,
  getCommunityGoals,
  getDropInsuranceRate,
  getDropValueMultiplier,
  getInventoryValue,
  getLuckMultiplier,
  getMarketAnalystDiscount,
  getMarketTrend,
  getMultiOpenCount,
  getNetWorth,
  getOpenDuration,
  getPassiveRate,
  getPrestigeNodeCost,
  getPrestigeNodeLevel,
  getPrestigeMultiplier,
  getPrestigeRequirement,
  getProfileSkillBonus,
  getSellReturn,
  getTradeUpInputCount,
  getUpgradeCost,
  isCaseUnlocked,
  isAutoOpenerEnabled,
  isEventActive,
  isLimitedEventActive,
  maybeStartLimitedEvent,
  openCases,
  openRewardCase,
  playCoinflip,
  playUpgrader,
  playJackpot,
  playPachinko,
  playRoulette,
  prestige,
  refreshMarket,
  settleCrashRound,
  startCrashRound,
  runTradeUpContract,
  sellItem,
  sellItems,
  settleAuctionListing,
  setAutoOpenerEnabled,
  redeemPromoCode,
  resetCommunityGoalState,
  syncAchievements,
  toggleItemFlag,
  updateAutoSell,
  normalizeState
} from "./gameLogic.js";
import { exportState, importState, resetState, saveState } from "./store.js";

const GAME_VERSION = "v1.0.2";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rarityClass(rarity) {
  return `rarity-${RARITIES[rarity]?.key || "unknown"}`;
}

function compactTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function casePoolPreview(caseDef) {
  return RARITY_ORDER
    .filter((rarity) => caseDef.pool[rarity]?.length)
    .map((rarity) => `<span style="--rarity:${RARITIES[rarity].color}">${RARITIES[rarity].short} ${caseDef.pool[rarity].length}</span>`)
    .join("");
}

function formatPercent(value, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function parseTransformX(transformValue) {
  if (!transformValue || transformValue === "none") {
    return 0;
  }
  try {
    return new DOMMatrixReadOnly(transformValue).m41 || 0;
  } catch (error) {
    const match = String(transformValue).match(/matrix(?:3d)?\((.+)\)/);
    if (!match) {
      return 0;
    }
    const parts = match[1].split(",").map((part) => Number(part.trim()));
    return parts.length === 16 ? (parts[12] || 0) : (parts[4] || 0);
  }
}

function dropFeedHeadline(item, count) {
  const tier = RARITIES[item.rarity]?.tier || 0;
  if (tier >= 6) {
    return count > 1 ? "Batch leggendario" : "Jackpot pieno";
  }
  if (tier >= 5) {
    return count > 1 ? "Bel colpo rosso" : "Drop pesante";
  }
  if (tier >= 4) {
    return "Apertura calda";
  }
  if (tier >= 3) {
    return "Batch pulito";
  }
  return count > 1 ? "Stack in arrivo" : "Drop confermato";
}

function upgradeBranch(upgradeId) {
  const branches = {
    openSpeed: "Apertura",
    multiOpen: "Apertura",
    luck: "Fortuna",
    rareBoost: "Fortuna",
    critBonus: "Fortuna",
    autoOpener: "Automazione",
    passiveIncome: "Automazione",
    marketAnalyst: "Economia",
    dropInsurance: "Economia",
    collectionHunter: "Collezioni",
    tradeUpSpecialist: "Contratti"
  };
  return branches[upgradeId] || "Economia";
}

function iconMarkup(name, className = "") {
  const classes = ["ui-icon", className].filter(Boolean).join(" ");
  return `<i class="${classes}" data-lucide="${escapeHtml(name)}" aria-hidden="true"></i>`;
}

function profileAvatarMarkup(profile, fallbackIcon = "shield", className = "") {
  const src = profile?.avatarImage || profile?.avatarProviderImage || "";
  if (src) {
    return `<img class="profile-avatar-img" src="${escapeHtml(src)}" alt="${escapeHtml(profile?.name || "Avatar")}" loading="lazy" />`;
  }
  return iconMarkup(fallbackIcon, className);
}

function tabIcon(id) {
  const icons = {
    inventory: "briefcase",
    cases: "package",
    shop: "banknote",
    stats: "bar-chart-3",
    prestige: "crown",
    games: "dice-5",
    community: "users-round",
    achievements: "trophy",
    contracts: "scroll-text",
    collections: "layers-3",
    market: "candlestick-chart",
    admin: "shield-check",
    cheats: "wrench"
  };
  return iconMarkup(icons[id] || "circle");
}

async function hashText(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const PROFILE_ICON_OPTIONS = [
  { id: "shield", label: "Shield" },
  { id: "crosshair", label: "Crosshair" },
  { id: "sparkles", label: "Sparkles" },
  { id: "crown", label: "Crown" },
  { id: "rocket", label: "Rocket" },
  { id: "gem", label: "Gem" }
];

const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const NAV_TABS = [
  ["cases", "Cases"],
  ["inventory", "Locker"],
  ["shop", "Economia"],
  ["market", "Marketplace"],
  ["stats", "Progress"],
  ["achievements", "Achievements"],
  ["prestige", "Prestige"],
  ["games", "Giochi"],
  ["community", "Community"],
  ["admin", "Admin"]
];

const ADMIN_STORAGE_KEY = "case-opener-admin-session-v1";
const ADMIN_USER_ID = "salernitana";
const ADMIN_PASSWORD_HASH = "9a2f5ce537e75c7c3daab92f3cff16791dff672efadbc4f6deb92c6a920daeeb";
const ADMIN_ONLY_ACTIONS = new Set([
  "toggle-session-panel",
  "refresh-api",
  "start-event",
  "export-save",
  "import-save",
  "reset-save",
  "cheat-add-credits",
  "cheat-set-credits",
  "cheat-add-prestige",
  "cheat-add-shards",
  "cheat-unlock-cases",
  "cheat-max-upgrades",
  "cheat-master-case",
  "cheat-reset-cooldowns",
  "cheat-complete-goals",
  "cheat-reset-community-goals",
  "admin-edit-promo",
  "admin-delete-promo",
  "admin-clear-promo-form",
  "admin-create-promo"
]);

const LOGIN_GATE_ACTIONS = new Set([
  "cloud-discord",
  "cloud-login-password",
  "cloud-register-password",
  "cloud-sign-in",
  "open-legal",
  "close-legal",
  "accept-cookies",
  "reject-cookies",
  "toggle-admin-gate",
  "admin-login"
]);

const TAB_GROUPS = {
  cases: ["cases"],
  inventory: ["inventory", "contracts", "collections"],
  shop: ["shop"],
  market: ["market"],
  stats: ["stats"],
  achievements: ["achievements"],
  prestige: ["prestige"],
  games: ["games"],
  community: ["community"],
  admin: ["admin"],
  cheats: ["cheats"]
};

const TAB_PARENT = Object.entries(TAB_GROUPS).reduce((map, [parent, tabs]) => {
  tabs.forEach((tab) => {
    map[tab] = parent;
  });
  return map;
}, {});

function upgradeEffectText(state, upgrade) {
  const level = state.upgrades[upgrade.id] || 0;
  switch (upgrade.id) {
    case "openSpeed":
      return `${(getOpenDuration(state) / 1000).toFixed(1)}s animazione`;
    case "luck":
      return `x${getLuckMultiplier(state).toFixed(2)} fortuna`;
    case "rareBoost":
      return `+${Math.round(level * 4.5)}% peso rari`;
    case "autoOpener":
      if (!level) {
        return "bloccato";
      }
      return isAutoOpenerEnabled(state) ? `ogni ${(getAutoInterval(state) / 1000).toFixed(1)}s` : "in pausa";
    case "multiOpen":
      return `${getMultiOpenCount(state)} casse/click`;
    case "passiveIncome":
      return `${formatCredits(getPassiveRate(state))}/s`;
    case "critBonus":
      return `+${Math.round(level * 1.2)}% crit`;
    case "marketAnalyst":
      return `${Math.round(getMarketAnalystDiscount(state) * 100)}% sconto market`;
    case "dropInsurance":
      return `${Math.round(getDropInsuranceRate(state) * 100)}% refund low-tier`;
    case "collectionHunter":
      return `x${getCollectionMultiplier(state).toFixed(2)} collezioni`;
    case "tradeUpSpecialist":
      return `${getTradeUpInputCount(state)} skin per contratto`;
    default:
      return `Livello ${level}`;
  }
}

function itemCard(item, { compact = false, withSell = false, selectable = false, selected = false, state = null } = {}) {
  if (item.type === "rewardCase") {
    return `
      <article class="item-card reward-case-card ${rarityClass(item.rarity)} ${item.locked ? "is-locked" : ""}" style="--rarity:${item.rarityColor}">
        <div class="item-art">
          ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />` : `<div class="reward-case-icon">${iconMarkup("package-open")}</div>`}
        </div>
        <div class="item-info">
          <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
          <span>Cassa speciale · Tier ${Number(item.rewardTier || 1)}</span>
          <span class="item-meta">${escapeHtml(item.caseName || "Reward")}</span>
        </div>
        <div class="item-value">${formatCredits(item.value || 0, compact)}</div>
        ${withSell ? `
          <div class="item-actions">
            <button class="primary-button tiny" data-action="open-owned-case" data-id="${item.id}">Apri</button>
            <button class="ghost-button tiny danger" data-action="delete-owned-case" data-id="${item.id}">Elimina</button>
          </div>
        ` : ""}
      </article>
    `;
  }
  const sellValue = state ? getSellReturn(state, item) : item.value;
  return `
    <article class="item-card ${rarityClass(item.rarity)} ${item.crit ? "is-crit" : ""} ${item.locked ? "is-locked" : ""} ${item.favorite ? "is-favorite" : ""}" style="--rarity:${item.rarityColor}">
      ${selectable ? `<button class="select-dot ${selected ? "is-selected" : ""}" data-action="toggle-select" data-id="${item.id}" aria-label="Seleziona skin"></button>` : ""}
      <div class="item-art" data-action="inspect-item" data-id="${item.id}">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
      </div>
      <div class="item-info" data-action="inspect-item" data-id="${item.id}">
        <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.wear)} - ${Number(item.float).toFixed(4)}</span>
        <span class="item-meta">${escapeHtml(item.rarity)} - ${escapeHtml(item.caseName)}</span>
      </div>
      <div class="item-value">${formatCredits(item.value, compact)}</div>
      ${withSell ? `
        <div class="item-actions">
          <button class="icon-button ${item.favorite ? "is-on" : ""}" data-action="toggle-favorite" data-id="${item.id}" title="Preferita" data-tip="${item.favorite ? "Rimuovi dai preferiti" : "Tieni questa skin in evidenza"}">&#9733;</button>
          <button class="icon-button ${item.locked ? "is-on" : ""}" data-action="toggle-lock" data-id="${item.id}" title="Blocco" data-tip="${item.locked ? "Sblocca la skin" : "Blocca la skin per evitare vendite"}">L</button>
          <button class="ghost-button tiny" data-action="sell-item" data-id="${item.id}" ${item.locked ? "disabled" : ""}>Vendi ${formatCredits(sellValue, true)}</button>
        </div>
      ` : ""}
    </article>
  `;
}

function statTile(label, value, sub = "") {
  return `
    <div class="stat-tile">
      <span>${label}</span>
      <strong>${value}</strong>
      ${sub ? `<small>${sub}</small>` : ""}
    </div>
  `;
}

function casePriceLabel(caseDef, unlocked) {
  if (!unlocked) {
    return `Prestige ${caseDef.unlockPrestige}`;
  }
  if (caseDef.price <= 0) {
    return "Gratis";
  }
  return formatCredits(caseDef.price, true);
}

function reelDisplayItem(item) {
  if (item.rarity !== "Rare Special Item") {
    return { ...item, hiddenSpecial: false };
  }
  return {
    ...item,
    name: "Rare Special Item",
    image: "",
    hiddenSpecial: true
  };
}

export class CaseOpenerUI {
  constructor(root, state, skinData, metadata) {
    this.root = root;
    this.state = state;
    this.skinData = skinData;
    this.metadata = metadata;
    this.activeTab = "cases";
    this.inventoryPage = 1;
    this.inventorySearch = "";
    this.inventoryRarity = "all";
    this.inventoryWear = "all";
    this.inventoryType = "all";
    this.inventorySort = "newest";
    this.gameInventorySearch = "";
    this.gameInventoryRarity = "all";
    this.gameInventoryType = "skins";
    this.caseSearch = "";
    this.caseStatus = "all";
    this.caseMaxPrice = "";
    this.caseSort = "progression";
    this.casePrestigeGroup = 0;
    this.caseCarouselPage = 0;
    this.caseFiltersOpen = false;
    this.selectedInventory = new Set();
    this.contractRarity = "Consumer Grade";
    this.selectedCase = this.getInitialCase();
    this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? this.casePrestigeGroup ?? 0;
    this.caseDetailsOpen = true;
    this.caseInfoOpenId = null;
    this.sessionPanelOpen = false;
    this.techMenuOpen = false;
    this.openerSettingsOpen = false;
    this.profileSetupOpen = !this.state.profile?.configured;
    this.gamesView = "roulette";
    this.promoCodeDraft = "";
    this.goalDepositAmounts = {};
    this.goalSyncBusy = new Set();
    this.sharedGoalTotals = {};
    this.sharedGoalStatus = isCommunityGoalsSyncAvailable() ? "Sync community in attesa" : "Sync community non configurata";
    this.lastSharedGoalSyncAt = 0;
    this.unsubscribeCommunityGoals = null;
    this.unsubscribeCommunityGoalResets = null;
    this.seenSharedGoalContributionIds = new Set();
    this.sharedGameEvents = [];
    this.sharedGamesStatus = isSharedGamesAvailable() ? "Sync giochi in attesa" : "Sync giochi non configurata";
    this.sharedAuctions = [];
    this.lastSharedGamesSyncAt = 0;
    this.seenSharedGameEventIds = new Set();
    this.unsubscribeSharedGameEvents = null;
    this.unsubscribeGlobalAuctions = null;
    this.auctionItemId = "";
    this.auctionPrice = "";
    this.upgraderAnimation = null;
    this.upgraderSelection = new Set();
    (this.state.minigames?.upgrader?.itemIds || []).forEach((id) => this.upgraderSelection.add(id));
    this.coinflipAnimation = null;
    this.globalPromoCodes = [];
    this.globalPromoStatus = isGlobalPromoCodesAvailable() ? "Promo globali in attesa" : "Promo globali non configurati";
    this.adminPromoCode = "";
    this.adminPromoCredits = "1000";
    this.adminPromoCases = "0";
    this.adminPromoTier = "2";
    this.adminPromoWeapons = "0";
    this.adminPromoRarity = "Mil-Spec";
    this.adminPromoEditingCode = "";
    this.jackpotSelection = new Set();
    this.isAnimating = false;
    this.pendingRevealIds = [];
    this.lastAutoAt = 0;
    this.audioContext = null;
    this.revealTimer = null;
    this.inspectedItem = null;
    this.lastOpenedDropIds = [];
    this.lastOpenResultData = null;
    this.openResultExpanded = false;
    this.openResultAutoTimer = null;
    this.reelTickFrame = 0;
    this.rouletteAnimation = null;
    this.rouletteLoopTimer = null;
    this.pachinkoAnimation = null;
    this.crashAnimation = null;
    this.crashTimer = null;
    this.crashLoopTimer = null;
    this.crashNextRoundAt = 0;
    this.crashBetLog = [];
    this.jackpotAnimation = null;
    this.jackpotTimer = null;
    this.jackpotLoopTimer = null;
    this.jackpotPreview = null;
    this.jackpotWinPopup = null;
    this.jackpotLobbyId = "";
    this.socialClient = null;
    this.socialState = null;
    this.socialClaimInFlight = false;
    this.socialSyncTimer = null;
    this.socialConnection = {
      connected: false,
      clientId: null,
      transport: "sse",
      error: ""
    };
    this.socialChatDraft = "";
    this.chatDockOpen = false;
    this.socialMarketItemId = "";
    this.socialMarketPrice = "";
    this.socialMarketSearch = "";
    this.socialMarketPage = 1;
    this.socialMarketPageSize = 25;
    this.socialTradeTargetId = "";
    this.socialTradeOfferItemId = "";
    this.socialTradeRequestedItemId = "";
    this.chatMessages = [];
    this.chatDraft = "";
    this.chatOpen = false;
    this.chatPollTimer = null;
    this.liveSyncTimer = null;
    this.chatBusy = false;
    this.chatCloudEnabled = isSupabaseChatEnabled();
    this.unsubscribeCloudChat = null;
    this.cloudAvailable = isCloudSaveAvailable();
    this.cloudSession = null;
    this.cloudBusy = false;
    this.cloudStatus = this.cloudAvailable ? "Cloud pronto" : "Cloud non configurato";
    this.authUsername = "";
    this.authPassword = "";
    this.adminAuthenticated = this.readAdminSession();
    this.adminGateOpen = false;
    this.adminUserId = "";
    this.adminPassword = "";
    this.adminPasswordSecret = "";
    this.adminStatus = this.adminAuthenticated ? "Profilo admin attivo." : "";
    this.cookieConsent = this.readCookieConsent();
    this.legalModal = null;
    this.session = this.createSessionState();
    this.toasts = [];
  }

  mount() {
    this.renderShell();
    this.bindEvents();
    this.renderAll();
    this.initCommunityGoalsSync();
    this.initSharedGamesSync();
    this.initGlobalPromoCodes();
    this.initCloudChat();
    this.refreshCloudSession();
    this.refreshChat();
    this.chatPollTimer = window.setInterval(() => this.refreshChat(), 3500);
    this.liveSyncTimer = window.setInterval(() => this.refreshLiveSync({ silent: true }), 15000);
    this.startAutomaticGameLoops();
  }

  dispose() {
    this.unsubscribeCloudChat?.();
    this.unsubscribeCloudChat = null;
    this.unsubscribeCommunityGoals?.();
    this.unsubscribeCommunityGoals = null;
    this.unsubscribeCommunityGoalResets?.();
    this.unsubscribeCommunityGoalResets = null;
    this.unsubscribeSharedGameEvents?.();
    this.unsubscribeSharedGameEvents = null;
    this.unsubscribeGlobalAuctions?.();
    this.unsubscribeGlobalAuctions = null;
    if (this.chatPollTimer) {
      window.clearInterval(this.chatPollTimer);
      this.chatPollTimer = null;
    }
    if (this.liveSyncTimer) {
      window.clearInterval(this.liveSyncTimer);
      this.liveSyncTimer = null;
    }
    if (this.crashTimer) {
      window.clearInterval(this.crashTimer);
      this.crashTimer = null;
    }
    if (this.crashLoopTimer) {
      window.clearTimeout(this.crashLoopTimer);
      this.crashLoopTimer = null;
    }
    if (this.jackpotTimer) {
      window.clearInterval(this.jackpotTimer);
      this.jackpotTimer = null;
    }
    if (this.jackpotLoopTimer) {
      window.clearTimeout(this.jackpotLoopTimer);
      this.jackpotLoopTimer = null;
    }
    window.clearTimeout(this.rouletteLoopTimer);
    if (this.openResultAutoTimer) {
      window.clearTimeout(this.openResultAutoTimer);
      this.openResultAutoTimer = null;
    }
  }

  getInitialCase() {
    const saved = this.skinData.cases.find((caseDef) => caseDef.id === this.state.selectedCaseId && isCaseUnlocked(this.state, caseDef));
    return saved || this.skinData.cases.find((caseDef) => isCaseUnlocked(this.state, caseDef)) || this.skinData.cases[0];
  }

  createSessionState() {
    return {
      startedAt: Date.now(),
      opens: 0,
      spent: 0,
      earned: 0,
      bestDrop: null,
      events: []
    };
  }

  resetSessionState() {
    this.session = this.createSessionState();
  }

  getCommunityGoalRows(now = Date.now()) {
    return getCommunityGoals(this.state, now, this.sharedGoalTotals);
  }

  getCommunityGoalKeys(now = Date.now()) {
    return this.getCommunityGoalRows(now)
      .filter((goal) => goal.scope === "community")
      .map((goal) => goal.key);
  }

  mergeSharedGoalTotals(totals = {}, { replace = false } = {}) {
    Object.entries(totals || {}).forEach(([key, value]) => {
      this.sharedGoalTotals[key] = replace
        ? Number(Number(value || 0).toFixed(2))
        : Number(Math.max(Number(this.sharedGoalTotals[key] || 0), Number(value || 0)).toFixed(2));
    });
  }

  applySharedGoalContribution(entry) {
    if (!entry?.goalKey || this.seenSharedGoalContributionIds.has(entry.id)) {
      return;
    }
    this.seenSharedGoalContributionIds.add(entry.id);
    this.sharedGoalTotals[entry.goalKey] = Number(((this.sharedGoalTotals[entry.goalKey] || 0) + Number(entry.amount || 0)).toFixed(2));
  }

  applyCommunityGoalReset(reset) {
    if (!reset?.goalKey) {
      return;
    }
    this.sharedGoalTotals[reset.goalKey] = 0;
    if (this.state.goals?.contributions) {
      delete this.state.goals.contributions[reset.goalKey];
    }
    if (this.state.goals?.claimed) {
      delete this.state.goals.claimed[reset.goalKey];
    }
  }

  async refreshCommunityGoals({ silent = false } = {}) {
    if (!isCommunityGoalsSyncAvailable()) {
      this.sharedGoalStatus = "Sync community non configurata";
      return;
    }
    const keys = this.getCommunityGoalKeys();
    if (!keys.length) {
      return;
    }
    try {
      const totals = await fetchCommunityGoalTotals(keys);
      if (totals) {
        const normalizedTotals = Object.fromEntries(keys.map((key) => [key, totals[key] || 0]));
        this.mergeSharedGoalTotals(normalizedTotals, { replace: true });
      }
      this.lastSharedGoalSyncAt = Date.now();
      this.sharedGoalStatus = "Sync community live";
      if (this.activeTab === "community") {
        this.renderTab();
      }
    } catch (error) {
      this.sharedGoalStatus = "Sync community non disponibile";
      if (!silent) {
        this.toast("Goal community: tabella Supabase non pronta.");
      }
    }
  }

  async initCommunityGoalsSync() {
    await this.refreshCommunityGoals({ silent: true });
    if (!isCommunityGoalsSyncAvailable()) {
      return;
    }
    try {
      this.unsubscribeCommunityGoals = await subscribeCommunityGoalContributions((entry) => {
        const activeKeys = new Set(this.getCommunityGoalKeys());
        if (!activeKeys.has(entry.goalKey)) {
          return;
        }
        this.applySharedGoalContribution(entry);
        this.sharedGoalStatus = "Sync community live";
        if (this.activeTab === "community") {
          this.renderTab();
        }
      });
      this.unsubscribeCommunityGoalResets = await subscribeCommunityGoalResets((reset) => {
        const activeKeys = new Set(this.getCommunityGoalKeys());
        if (!activeKeys.has(reset.goalKey)) {
          return;
        }
        this.applyCommunityGoalReset(reset);
        this.sharedGoalStatus = "Goal community resettati";
        this.toast(`Goal community resettato: ${reset.goalId}.`);
        this.renderAll();
      });
    } catch (error) {
      this.sharedGoalStatus = "Realtime community non disponibile";
    }
  }

  async initGlobalPromoCodes() {
    if (!isGlobalPromoCodesAvailable()) {
      this.globalPromoStatus = "Promo globali non configurati";
      return;
    }
    try {
      this.globalPromoCodes = await fetchGlobalPromoCodes();
      this.globalPromoStatus = "Promo globali online";
      this.syncGlobalPromoCodesToState();
      if (this.activeTab === "admin" || this.activeTab === "community") {
        this.renderTab();
      }
    } catch (error) {
      this.globalPromoStatus = "Promo globali non disponibili";
    }
  }

  syncGlobalPromoCodesToState() {
    this.state.promoCodes ||= { redeemed: {}, custom: {} };
    this.state.promoCodes.custom ||= {};
    this.globalPromoCodes
      .filter((promo) => promo.active)
      .forEach((promo) => {
        this.state.promoCodes.custom[promo.code] = {
          ...promo.reward,
          label: `Promo globale ${promo.code}`
        };
      });
  }

  applySharedGameEvent(entry) {
    if (!entry?.id || this.seenSharedGameEventIds.has(entry.id)) {
      return;
    }
    this.seenSharedGameEventIds.add(entry.id);
    this.sharedGameEvents = [entry, ...this.sharedGameEvents].slice(0, 40);
  }

  applySharedAuction(listing) {
    if (!listing?.id) {
      return;
    }
    const localListing = this.state.auctions?.listings?.find((entry) => entry.globalId === listing.id);
    if (localListing && localListing.status === "active" && listing.status !== "active") {
      localListing.status = listing.status;
      localListing.buyerName = listing.buyerName || "";
      localListing.updatedAt = Date.now();
      if (listing.status === "sold") {
        const fee = Math.max(0.03, 0.09 - getProfileSkillBonus(this.state).auctionFeeReduction);
        const payout = Number((Number(listing.price || localListing.price || 0) * (1 - fee)).toFixed(2));
        localListing.soldAt = Date.now();
        localListing.payout = payout;
        this.state.credits += payout;
        this.state.stats.totalEarned += payout;
        this.toast(`Marketplace venduto: +${formatCredits(payout)}.`);
        this.queueSocialProfileSync();
      }
    }
    const next = [listing, ...this.sharedAuctions.filter((entry) => entry.id !== listing.id)]
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
      .slice(0, 80);
    this.sharedAuctions = next;
  }

  async refreshSharedGames({ silent = false } = {}) {
    if (!isSharedGamesAvailable()) {
      this.sharedGamesStatus = "Sync giochi non configurata";
      return;
    }
    try {
      const [events, auctions] = await Promise.all([
        fetchSharedGameEvents(40),
        fetchGlobalAuctions(60)
      ]);
      this.sharedGameEvents = [];
      this.seenSharedGameEventIds.clear();
      events.reverse().forEach((entry) => this.applySharedGameEvent(entry));
      this.sharedAuctions = auctions;
      this.lastSharedGamesSyncAt = Date.now();
      this.sharedGamesStatus = "Sync giochi live";
      if (this.activeTab === "games") {
        this.renderTab();
      }
    } catch (error) {
      this.sharedGamesStatus = "Sync giochi non disponibile";
      if (!silent) {
        this.toast("Giochi condivisi: tabelle Supabase non pronte.");
      }
    }
  }

  async initSharedGamesSync() {
    await this.refreshSharedGames({ silent: true });
    if (!isSharedGamesAvailable()) {
      return;
    }
    try {
      this.unsubscribeSharedGameEvents = await subscribeSharedGameEvents((entry) => {
        this.applySharedGameEvent(entry);
        this.sharedGamesStatus = "Sync giochi live";
        if (this.activeTab === "games") {
          this.renderTab();
        }
      });
      this.unsubscribeGlobalAuctions = await subscribeGlobalAuctions((listing) => {
        this.applySharedAuction(listing);
        this.sharedGamesStatus = "Sync giochi live";
        if (this.activeTab === "games") {
          this.renderTab();
        }
      });
    } catch (error) {
      this.sharedGamesStatus = "Realtime giochi non disponibile";
    }
  }

  async refreshLiveSync({ silent = true } = {}) {
    await Promise.allSettled([
      this.refreshCommunityGoals({ silent }),
      this.refreshSharedGames({ silent })
    ]);
    if (!this.isEditingAppControl() && (this.activeTab === "community" || this.activeTab === "games")) {
      this.renderTab();
    }
  }

  publishSharedGameResult(mode, result, payload = {}) {
    if (!isSharedGamesAvailable() || !result) {
      return;
    }
    publishSharedGameEvent({
      mode,
      game: result.game || mode,
      playerName: this.state.profile?.name || "Operatore",
      detail: result.detail || result.label || "",
      stake: result.bet || 0,
      payout: result.payout || 0,
      profit: result.profit || 0,
      outcome: result.outcome || result.label || "",
      payload
    }).then((entry) => {
      if (entry) {
        this.applySharedGameEvent(entry);
      }
    }).catch(() => {
      this.sharedGamesStatus = "Sync giochi non disponibile";
    });
  }

  attachSocialClient(client) {
    this.socialClient = client;
  }

  updateSocialState(snapshot) {
    this.socialState = snapshot || null;
    const pendingCredits = Number(snapshot?.currentPlayer?.pendingCredits || 0);
    const pendingItems = Number(snapshot?.currentPlayer?.pendingItemsCount || 0);
    if (!this.socialClaimInFlight && (pendingCredits > 0 || pendingItems > 0)) {
      this.consumeSocialClaims();
    }
    this.renderGlobalChatDock();
    if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
      this.renderTab();
    }
  }

  setSocialConnection(connection = {}) {
    this.socialConnection = {
      ...this.socialConnection,
      ...connection
    };
    this.renderGlobalChatDock();
    if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
      this.renderTab();
    }
  }

  queueSocialProfileSync(delay = 180) {
    if (!this.socialClient?.syncProfile) {
      return;
    }
    window.clearTimeout(this.socialSyncTimer);
    this.socialSyncTimer = window.setTimeout(() => {
      this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    }, delay);
  }

  removeInventoryItems(ids = []) {
    const idSet = new Set(ids.filter(Boolean));
    if (!idSet.size) {
      return;
    }
    this.state.inventory = this.state.inventory.filter((item) => !idSet.has(item.id));
    [...idSet].forEach((id) => {
      this.selectedInventory.delete(id);
      this.jackpotSelection.delete(id);
    });
    this.lastOpenedDropIds = (this.lastOpenedDropIds || []).filter((id) => !idSet.has(id));
    if (this.inspectedItem?.id && idSet.has(this.inspectedItem.id)) {
      this.closeInspector();
    }
  }

  receiveInventoryItems(items = [], { prepend = true } = {}) {
    const receivedItems = (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      obtainedAt: item.obtainedAt || Date.now(),
      locked: Boolean(item.locked),
      favorite: Boolean(item.favorite)
    }));
    if (!receivedItems.length) {
      return [];
    }
    this.state.inventory = prepend
      ? [...receivedItems, ...this.state.inventory]
      : [...this.state.inventory, ...receivedItems];
    return receivedItems;
  }

  getSocialProfilePayload() {
    const lockerItems = [...(this.state.inventory || [])]
      .filter((item) => !item.locked)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || Number(b.value || 0) - Number(a.value || 0))
      .slice(0, 500)
      .map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
        rarity: item.rarity,
        rarityColor: item.rarityColor,
        wear: item.wear,
        value: Number(Number(item.value || 0).toFixed(2)),
        caseName: item.caseName,
        weapon: item.weapon,
        category: item.category,
        collection: item.collection,
        float: Number(Number(item.float || 0).toFixed(6))
      }));
    return {
      name: this.state.profile?.name || "Operatore",
      title: this.state.profile?.title || "Case Runner",
      accent: this.state.profile?.accent || "#7fe37c",
      avatarIcon: this.getProfileIconId(),
      avatarImage: this.state.profile?.avatarImage || this.state.profile?.avatarProviderImage || "",
      prestige: this.state.prestige?.level || 0,
      level: this.state.profile?.level || 1,
      credits: Number(Number(this.state.credits || 0).toFixed(2)),
      netWorth: Number(getNetWorth(this.state).toFixed(2)),
      lockerItems
    };
  }

  async consumeSocialClaims() {
    if (!this.socialClient?.claimRewards || this.socialClaimInFlight) {
      return;
    }
    this.socialClaimInFlight = true;
    try {
      const response = await this.socialClient.claimRewards();
      const claim = response?.claim || {};
      const credits = Number(claim.credits || 0);
      const items = Array.isArray(claim.items) ? claim.items : [];
      if (credits > 0) {
        this.state.credits += credits;
        this.session.earned += credits;
        this.recordSessionEvent("market", "Crediti condivisi", "Incasso multiplayer", credits);
        this.toast(`Marketplace globale: +${formatCredits(credits)} riscossi.`);
      }
      if (items.length) {
        const receivedItems = items.map((item) => ({
          ...item,
          obtainedAt: Date.now(),
          locked: false,
          favorite: false
        }));
        this.state.inventory = [...receivedItems, ...this.state.inventory];
        receivedItems.forEach((item) => this.noteSessionBestDrop(item));
        this.recordSessionEvent("trade", "Consegna trade", `${items.length} skin ricevute`, null);
        this.toast(`Ricevute ${items.length} skin dal multiplayer.`);
      }
      if (response?.snapshot) {
        this.socialState = response.snapshot;
      }
      if (credits > 0 || items.length) {
        this.socialClient.syncProfile(this.getSocialProfilePayload()).catch(() => {});
        this.renderAll();
      }
    } catch (error) {
      // keep quiet; claims are opportunistic
    } finally {
      this.socialClaimInFlight = false;
    }
  }

  recordSessionEvent(type, title, detail = "", value = null) {
    this.session.events = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        title,
        detail,
        value,
        at: Date.now()
      },
      ...(this.session.events || [])
    ].slice(0, 24);
  }

  noteSessionBestDrop(item) {
    if (!item) {
      return;
    }
    if (!this.session.bestDrop || Number(item.value || 0) >= Number(this.session.bestDrop.value || 0)) {
      this.session.bestDrop = {
        id: item.id,
        name: item.name,
        value: item.value,
        rarity: item.rarity,
        rarityColor: item.rarityColor,
        image: item.image
      };
    }
  }

  recordSessionOpen(caseDef, result, showcase) {
    const spent = Number(caseDef.price || 0) * Number(result.opened || 0);
    const batchValue = result.drops.reduce((sum, drop) => sum + Number(drop.item.value || 0), 0);
    const autoSoldValue = result.drops.reduce((sum, drop) => sum + Number(drop.autoSold ? drop.item.sellValue || 0 : 0), 0);
    this.session.opens += Number(result.opened || 0);
    this.session.spent += spent;
    this.session.earned += autoSoldValue;
    this.noteSessionBestDrop(showcase);
    this.recordSessionEvent(
      "open",
      caseDef.name,
      `${result.opened}x - ${showcase?.name || "drop"} - EV ${formatCredits(batchValue, true)}`,
      batchValue
    );
  }

  getSessionSummary() {
    const durationMs = Math.max(1000, Date.now() - (this.session.startedAt || Date.now()));
    const minutes = durationMs / 60000;
    const profit = this.session.earned - this.session.spent;
    return {
      durationMs,
      opens: this.session.opens || 0,
      spent: this.session.spent || 0,
      earned: this.session.earned || 0,
      profit,
      opensPerMinute: minutes > 0 ? (this.session.opens || 0) / minutes : 0,
      bestDrop: this.session.bestDrop || null,
      events: this.session.events || []
    };
  }

  getAudioSettings() {
    return this.state.settings?.audio || {
      muted: false,
      master: 0.72,
      reel: 0.42,
      drop: 0.68
    };
  }

  getAudioGain(channel) {
    const settings = this.getAudioSettings();
    if (settings.muted) {
      return 0;
    }
    const master = clamp(Number(settings.master ?? 0.72), 0, 1);
    const channelLevel = clamp(Number(settings[channel] ?? 0.6), 0, 1);
    return master * channelLevel;
  }

  setAudioSetting(key, value) {
    this.state.settings ||= {};
    this.state.settings.audio ||= this.getAudioSettings();
    this.state.settings.audio[key] = value;
  }

  isCaseFavorite(caseId) {
    return Boolean(this.state.casePrefs?.favorites?.[caseId]);
  }

  toggleCaseFavorite(caseId) {
    this.state.casePrefs ||= { favorites: {} };
    this.state.casePrefs.favorites ||= {};
    this.state.casePrefs.favorites[caseId] = !this.state.casePrefs.favorites[caseId];
    if (!this.state.casePrefs.favorites[caseId]) {
      delete this.state.casePrefs.favorites[caseId];
    }
    const caseDef = this.skinData.cases.find((candidate) => candidate.id === caseId);
    const label = this.state.casePrefs.favorites[caseId] ? "aggiunta ai preferiti" : "rimossa dai preferiti";
    this.toast(`${caseDef?.name || "Cassa"} ${label}.`);
    this.renderCases();
    this.renderSelectedCase();
  }

  getCaseAnalytics(caseDef) {
    const table = getCaseDropTable(this.state, caseDef);
    const row = (rarity) => table.rows.find((entry) => entry.rarity === rarity);
    const safeChance = table.rows.reduce((sum, entry) => {
      const threshold = caseDef.price <= 0 ? 0.18 : Math.max(caseDef.price * 0.85, caseDef.price - 1.5);
      return sum + (entry.estimatedValue >= threshold ? entry.probability : 0);
    }, 0);
    const specialChance = row("Rare Special Item")?.probability || 0;
    const hotChance = table.rows
      .filter((entry) => (RARITIES[entry.rarity]?.tier || 0) >= 5)
      .reduce((sum, entry) => sum + entry.probability, 0);
    const lowTierChance = table.rows
      .filter((entry) => (RARITIES[entry.rarity]?.tier || 0) <= 2)
      .reduce((sum, entry) => sum + entry.probability, 0);
    const valueScore = caseDef.price <= 0
      ? table.expectedValue * 32 + safeChance * 10
      : table.roi * 100 + safeChance * 28 + hotChance * 18;
    const safeScore = safeChance * 72 + lowTierChance * 14 + (caseDef.price <= 0 ? 18 : Math.min(22, table.roi * 12));
    const riskScore = specialChance * 360 + hotChance * 120 + Math.max(0, 1 - safeChance) * 42 + (caseDef.price > 0 ? Math.min(18, caseDef.price * 0.12) : 0);
    return {
      table,
      valueScore,
      safeScore,
      riskScore,
      safeChance,
      specialChance,
      hotChance,
      lowTierChance
    };
  }

  getCaseHighlightMap(cases = this.skinData.cases) {
    const candidates = cases
      .filter((caseDef) => isCaseUnlocked(this.state, caseDef))
      .map((caseDef) => ({ caseDef, analytics: this.getCaseAnalytics(caseDef) }));
    if (candidates.length < 2) {
      return {};
    }
    const pick = (key) => [...candidates]
      .sort((a, b) => b.analytics[key] - a.analytics[key] || a.caseDef.price - b.caseDef.price)
      .at(0)?.caseDef.id;
    return {
      bestValue: pick("valueScore"),
      safest: pick("safeScore"),
      highRisk: pick("riskScore")
    };
  }

  getCaseSignalBadges(caseDef, highlights = this.getCaseHighlightMap()) {
    const badges = [];
    if (highlights.bestValue === caseDef.id) {
      badges.push({ key: "best-value", label: "Best value", tip: "ROI stimato migliore tra le casse sbloccate." });
    }
    if (highlights.safest === caseDef.id) {
      badges.push({ key: "safest", label: "Safest", tip: "Probabilita' migliore di rientrare senza swing troppo duri." });
    }
    if (highlights.highRisk === caseDef.id) {
      badges.push({ key: "high-risk", label: "High risk", tip: "Picchi piu' alti, ma varianza molto piu' cattiva." });
    }
    return badges;
  }

  getProfileIconId(profile = this.state.profile) {
    const desired = profile?.avatarIcon || "shield";
    return PROFILE_ICON_OPTIONS.some((option) => option.id === desired) ? desired : "shield";
  }

  getPlayerInitials() {
    const source = String(this.state.profile?.name || "Operatore").trim();
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
    return (parts.map((part) => part[0]?.toUpperCase() || "").join("") || "OP").slice(0, 2);
  }

  refreshIcons() {
    try {
      window.lucide?.createIcons?.();
    } catch (error) {
      // Icon rendering is cosmetic.
    }
  }

  isMultiplayerTabActive() {
    return false;
  }

  renderShell() {
    this.root.innerHTML = `
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">CS2</div>
          <div>
            <p id="apiStatus"></p>
          </div>
        </div>
        <div class="topbar-main">
          <div class="top-stats" id="topStats"></div>
          <div class="player-dock">
            <button class="player-button" data-action="toggle-tech-menu" type="button" aria-expanded="false" id="playerButton">
              <span class="player-avatar" id="playerAvatar"></span>
              <span class="player-copy">
                <strong>Operatore</strong>
                <small>Account e impostazioni</small>
              </span>
              <span class="player-more">${iconMarkup("chevron-down")}</span>
            </button>
            <div class="tech-menu" id="techMenu" hidden></div>
          </div>
        </div>
      </header>

      <main class="main-grid">
        <aside class="nav-rail">
          <nav class="tabs" id="tabs"></nav>
        </aside>

        <aside class="panel case-panel">
          <div class="panel-heading">
            <span>Le mie casse</span>
            <small id="caseCarouselMeta"></small>
          </div>
          <div class="case-filters" id="caseFilters"></div>
          <div class="case-list" id="caseList"></div>
        </aside>

        <section class="opener-panel">
          <div class="reel-frame">
            <div class="reel-marker"></div>
            <div class="reel-track" id="reelTrack"></div>
          </div>
          <div class="opener-actions" id="openerActions"></div>
          <div class="selected-case" id="selectedCase"></div>
          <div class="drop-feed" id="dropFeed"></div>
        </section>

        <aside class="panel side-panel">
          <div class="panel-heading side-panel-heading">
            <span id="saveState" class="save-pill">Salvato</span>
          </div>
          <div class="session-box" id="sessionBox"></div>
          <div class="daily-box" id="dailyBox"></div>
          <div class="history-box" id="dropHistory"></div>
        </aside>

        <section class="workspace" id="workspace">
          <div class="tab-content" id="tabContent"></div>
        </section>
      </main>

      <div class="toast-stack" id="toastStack"></div>
      <div class="rare-reveal" id="rareReveal" hidden></div>
      <div class="open-result-overlay" id="openResultOverlay" hidden></div>
      <div class="jackpot-win-overlay" id="jackpotWinOverlay" hidden></div>
      <div class="skin-inspector" id="skinInspector" hidden></div>
      <div class="profile-setup" id="profileSetup" hidden></div>
      <div class="login-gate" id="loginGate" hidden></div>
      <div class="legal-layer" id="legalLayer"></div>
      <div class="global-chat-dock" id="globalChatDock"></div>
      <div class="app-version">${GAME_VERSION}</div>
    `;
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      if (this.techMenuOpen && !event.target.closest(".player-dock")) {
        this.techMenuOpen = false;
        this.renderTechMenu();
      }
      if (this.openerSettingsOpen && !event.target.closest(".opener-settings")) {
        this.openerSettingsOpen = false;
        this.renderOpenerActions();
      }
      const target = event.target.closest("[data-action]");
      if (!target) {
        return;
      }
      this.handleAction(target.dataset.action, target.dataset, target);
    });

    this.root.addEventListener("input", (event) => {
      const target = event.target;
      if (target.matches("#inventorySearch")) {
        this.inventorySearch = target.value;
        this.inventoryPage = 1;
        this.renderTab();
      }
      if (target.matches("#caseSearch")) {
        this.caseSearch = target.value;
        this.caseCarouselPage = 0;
        this.renderCases();
      }
      if (target.matches("#caseMaxPrice")) {
        this.caseMaxPrice = target.value;
        this.caseCarouselPage = 0;
        this.renderCases();
      }
      if (target.matches("#autoSellMaxValue, #quickAutoSellMaxValue")) {
        updateAutoSell(this.state, { maxValue: target.value });
      }
      if (target.matches("#audioMaster, #audioReel, #audioDrop")) {
        const key = target.id === "audioMaster" ? "master" : target.id === "audioReel" ? "reel" : "drop";
        const percentValue = clamp(Number(target.value), 0, 100);
        this.setAudioSetting(key, percentValue / 100);
        const valueNode = target.parentElement?.querySelector("strong");
        if (valueNode) {
          valueNode.textContent = `${Math.round(percentValue)}%`;
        }
      }
      if (target.matches("#crashBet")) {
        this.state.minigames.crash.bet = target.value;
      }
      if (target.matches("#crashAutoCashout")) {
        this.state.minigames.crash.autoCashout = target.value;
      }
      if (target.matches("#crashRoundDelay")) {
        this.state.minigames.crash.roundDelay = target.value;
      }
      if (target.matches("#socialChatInput, #footerChatInput")) {
        this.chatDraft = target.value.slice(0, 180);
        const sendButton = target.closest(".chat-footer-compose")?.querySelector("[data-action='send-chat']");
        if (sendButton) {
          sendButton.disabled = !this.chatDraft.trim() || this.chatBusy;
        }
      }
      if (target.matches("#socialMarketSearch")) {
        this.socialMarketSearch = target.value;
        this.socialMarketPage = 1;
        this.renderTab();
      }
      if (target.matches("#socialMarketPrice")) {
        this.socialMarketPrice = target.value;
      }
      if (target.matches("#promoCodeInput")) {
        this.promoCodeDraft = target.value;
      }
      if (target.matches("[data-goal-deposit-input]")) {
        this.goalDepositAmounts[target.dataset.goalDepositInput] = target.value;
      }
      if (target.matches("#upgraderMultiplier")) {
        this.state.minigames.upgrader.targetMultiplier = target.value;
        this.renderTab();
      }
      if (target.matches("#coinflipBet")) {
        this.state.minigames.coinflip.bet = target.value;
      }
      if (target.matches("#rouletteBet")) {
        this.state.minigames.roulette.bet = target.value;
      }
      if (target.matches("#auctionPrice")) {
        this.auctionPrice = target.value;
      }
      if (target.matches("#gameInventorySearch")) {
        this.gameInventorySearch = target.value;
        this.renderTab();
      }
      if (target.matches("#adminPromoCode")) {
        this.adminPromoCode = target.value;
      }
      if (target.matches("#adminPromoCredits")) {
        this.adminPromoCredits = target.value;
      }
      if (target.matches("#adminPromoCases")) {
        this.adminPromoCases = target.value;
      }
      if (target.matches("#adminPromoTier")) {
        this.adminPromoTier = target.value;
      }
      if (target.matches("#adminPromoWeapons")) {
        this.adminPromoWeapons = target.value;
      }
      if (target.matches("#authUsername")) {
        this.authUsername = target.value;
      }
      if (target.matches("#authPassword")) {
        this.authPassword = target.value;
      }
      if (target.matches("#adminUserId")) {
        this.adminUserId = target.value;
      }
      if (target.matches("#adminPassword")) {
        this.adminPassword = target.value;
      }
    });

    this.root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("#rarityFilter")) {
        this.inventoryRarity = target.value;
        this.inventoryPage = 1;
        this.renderTab();
      }
      if (target.matches("#sortFilter")) {
        this.inventorySort = target.value;
        this.inventoryPage = 1;
        this.renderTab();
      }
      if (target.matches("#wearFilter")) {
        this.inventoryWear = target.value;
        this.inventoryPage = 1;
        this.renderTab();
      }
      if (target.matches("#typeFilter")) {
        this.inventoryType = target.value;
        this.inventoryPage = 1;
        this.renderTab();
      }
      if (target.matches("#gameInventoryRarity")) {
        this.gameInventoryRarity = target.value;
        this.renderTab();
      }
      if (target.matches("#gameInventoryType")) {
        this.gameInventoryType = target.value;
        this.renderTab();
      }
      if (target.matches("#caseStatus")) {
        this.caseStatus = target.value;
        this.caseCarouselPage = 0;
        this.renderCases();
      }
      if (target.matches("#caseSort")) {
        this.caseSort = target.value;
        this.caseCarouselPage = 0;
        this.renderCases();
      }
      if (target.matches("#adminPromoRarity")) {
        this.adminPromoRarity = target.value;
      }
      if (target.matches("#contractRarity")) {
        this.contractRarity = target.value;
        this.renderTab();
      }
      if (target.matches("#autoOpenerEnabled, #quickAutoOpenerEnabled")) {
        setAutoOpenerEnabled(this.state, target.checked);
        this.renderAll();
      }
      if (target.matches("#autoSellEnabled, #quickAutoSellEnabled")) {
        updateAutoSell(this.state, { enabled: target.checked });
        this.renderAll();
      }
      if (target.matches("#autoSellMaxTier, #quickAutoSellMaxTier")) {
        updateAutoSell(this.state, { maxTier: target.value });
      }
      if (target.matches("#audioMuted")) {
        this.setAudioSetting("muted", target.checked);
      }
      if (target.matches("#profileAvatarIcon")) {
        this.state.profile.avatarIcon = target.value || "shield";
        this.renderProfileSetup();
      }
      if (target.matches("#profileAvatarUpload")) {
        this.loadProfileAvatarFile(target.files?.[0]);
      }
      if (target.matches("#crashAutoPlayEnabled")) {
        this.ensureAutomaticGameLoopState();
        this.scheduleCrashLoop();
        this.renderTab();
      }
      if (target.matches("#socialMarketItem")) {
        this.socialMarketItemId = target.value || "";
        if (!this.socialMarketPrice) {
          const source = this.state.inventory.find((item) => item.id === this.socialMarketItemId);
          if (source) {
            this.socialMarketPrice = Number(source.value || 0).toFixed(2);
          }
        }
        if (this.isMultiplayerTabActive()) {
          this.renderTab();
        }
      }
      if (target.matches("#socialTradeTarget")) {
        this.socialTradeTargetId = target.value || "";
        this.socialTradeRequestedItemId = "";
        if (this.isMultiplayerTabActive()) {
          this.renderTab();
        }
      }
      if (target.matches("#socialTradeOfferItem")) {
        this.socialTradeOfferItemId = target.value || "";
      }
      if (target.matches("#rouletteChoice")) {
        this.state.minigames.roulette.choice = target.value || "red";
      }
      if (target.matches("#upgraderItem")) {
        this.state.minigames.upgrader.itemId = target.value || "";
        this.renderTab();
      }
      if (target.matches("#coinflipSide")) {
        this.state.minigames.coinflip.side = target.value === "t" ? "t" : "ct";
      }
      if (target.matches("#auctionItem")) {
        this.auctionItemId = target.value || "";
        const item = this.state.inventory.find((candidate) => candidate.id === this.auctionItemId);
        if (item) {
          this.auctionPrice = getSellReturn(this.state, item).toFixed(2);
        }
        this.renderTab();
      }
    });

    this.root.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target.matches("#footerChatInput") && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.sendChat();
      }
      if (target.matches("#authUsername, #authPassword") && event.key === "Enter") {
        event.preventDefault();
        this.signInUsername();
      }
      if (target.matches("#adminUserId, #adminPassword") && event.key === "Enter") {
        event.preventDefault();
        this.loginAdmin();
      }
    });
  }

  isEditingSessionControls() {
    const active = document.activeElement;
    if (!active) {
      return false;
    }
    const sessionBox = this.root.querySelector("#sessionBox");
    return Boolean(sessionBox?.contains(active) && active.matches("input, select, textarea"));
  }

  isEditingAppControl() {
    const active = document.activeElement;
    return Boolean(active && this.root.contains(active) && active.matches("input, select, textarea"));
  }

  handleAction(action, data, element) {
    if (!this.isCloudLoggedIn?.() && !LOGIN_GATE_ACTIONS.has(action)) {
      this.toast("Accedi per giocare online.");
      this.renderLoginGate();
      return;
    }
    if ((ADMIN_ONLY_ACTIONS.has(action) || (action === "tab" && ["cheats", "admin"].includes(data.tab))) && !this.isAdmin()) {
      this.toast("Accesso admin richiesto.");
      return;
    }
    switch (action) {
      case "select-case":
        this.selectCase(data.id);
        break;
      case "toggle-tech-menu":
        this.techMenuOpen = !this.techMenuOpen;
        this.renderTechMenu();
        break;
      case "open-profile-setup":
        this.profileSetupOpen = true;
        this.techMenuOpen = false;
        this.renderTechMenu();
        this.renderProfileSetup();
        break;
      case "close-profile-setup":
        if (this.state.profile?.configured) {
          this.profileSetupOpen = false;
          this.renderProfileSetup();
        }
        break;
      case "save-profile":
        this.saveProfileCard();
        break;
      case "randomize-profile":
        this.randomizeProfileCard();
        break;
      case "clear-profile-avatar":
        this.state.profile.avatarImage = "";
        this.renderTopStats();
        this.renderProfileSetup();
        break;
      case "toggle-opener-settings":
        this.openerSettingsOpen = !this.openerSettingsOpen;
        this.renderOpenerActions();
        break;
      case "case-info":
        this.showCaseInfo(data.id);
        break;
      case "toggle-case-favorite":
        this.toggleCaseFavorite(data.id);
        break;
      case "case-page-prev":
        this.changeCasePrestigeGroup(-1);
        break;
      case "case-page-next":
        this.changeCasePrestigeGroup(1);
        break;
      case "case-page-jump":
        this.caseCarouselPage = Math.max(0, Number(data.page) || 0);
        this.renderCases();
        break;
      case "clear-case-filters":
        this.caseSearch = "";
        this.caseStatus = "all";
        this.caseMaxPrice = "";
        this.caseSort = "progression";
        this.caseCarouselPage = 0;
        this.renderCases();
        break;
      case "toggle-case-filters":
        this.caseFiltersOpen = !this.caseFiltersOpen;
        this.renderCaseFilters(this.getFilteredCases());
        break;
      case "select-case-group":
        this.casePrestigeGroup = Math.max(0, Number(data.group) || 0);
        this.caseCarouselPage = 0;
        this.caseInfoOpenId = null;
        if (this.selectedCase?.unlockPrestige !== this.casePrestigeGroup) {
          const nextVisible = this.getCasesForPrestigeGroup(this.casePrestigeGroup).find((caseDef) => isCaseUnlocked(this.state, caseDef));
          if (nextVisible) {
            this.selectedCase = nextVisible;
            this.state.selectedCaseId = nextVisible.id;
            this.renderSelectedCase();
            this.renderOpenerActions();
          }
        }
        this.renderCases();
        break;
      case "toggle-case-details":
        this.caseDetailsOpen = !this.caseDetailsOpen;
        this.renderSelectedCase();
        break;
      case "toggle-session-panel":
        this.sessionPanelOpen = !this.sessionPanelOpen;
        this.renderSession();
        this.renderDaily();
        this.renderTechMenu();
        break;
      case "open-case":
        this.openSelectedCase(false);
        break;
      case "open-one":
        this.openSelectedCase(false, 1);
        break;
      case "open-many":
        this.openSelectedCase(false, Number(data.count) || 1);
        break;
      case "sell-last-open":
        this.sellLastOpenedBatch();
        break;
      case "sell-result-item":
        this.sellResultItem(data.id);
        break;
      case "buy-upgrade":
        this.buyUpgrade(data.id);
        break;
      case "sell-item":
        this.sellItem(data.id);
        break;
      case "sell-filtered":
        this.sellFiltered();
        break;
      case "sell-consumer":
        this.sellByMaxTier(1);
        break;
      case "sell-selected":
        this.sellSelected();
        break;
      case "select-page":
        this.selectPage();
        break;
      case "clear-selection":
        this.selectedInventory.clear();
        this.renderTab();
        break;
      case "toggle-select":
        this.toggleSelected(data.id);
        break;
      case "toggle-favorite":
        this.toggleItemFlag(data.id, "favorite");
        break;
      case "toggle-lock":
        this.toggleItemFlag(data.id, "locked");
        break;
      case "toggle-result-lock":
        this.toggleResultLock(data.id, element);
        break;
      case "inspect-item":
        this.inspectItem(data.id);
        break;
      case "close-inspector":
        this.closeInspector();
        break;
      case "sell-inspected":
        this.sellInspected();
        break;
      case "claim-daily":
        this.claimDaily();
        break;
      case "prestige":
        this.doPrestige();
        break;
      case "buy-prestige-node":
        this.buyPrestigeNode(data.id);
        break;
      case "claim-collection":
        this.claimCollection(data.name);
        break;
      case "start-event":
        this.startLimitedEvent();
        break;
      case "close-reveal":
        this.root.querySelector("#rareReveal").hidden = true;
        break;
      case "close-open-result":
        this.closeOpenResultSummary();
        break;
      case "toggle-open-result-details":
        this.toggleOpenResultDetails();
        break;
      case "tab":
        this.activeTab = this.getAllowedTabIds().includes(data.tab) ? data.tab : "cases";
        this.techMenuOpen = false;
        this.renderTabs();
        this.renderTechMenu();
        this.renderTab();
        break;
      case "page":
        this.inventoryPage = Math.max(1, Number(data.page) || 1);
        this.renderTab();
        break;
      case "contract":
        this.runContract();
        break;
      case "buy-offer":
        this.buyOffer(data.id);
        break;
      case "refresh-market":
        this.state.market.lastRefreshAt = 0;
        refreshMarket(this.state, this.skinData, this.selectedCase);
        this.renderTab();
        break;
      case "games-view":
        this.gamesView = data.view || "roulette";
        this.renderTab();
        break;
      case "select-upgrader-item":
        this.toggleUpgraderItem(data.id);
        this.renderTab();
        break;
      case "clear-upgrader-selection":
        this.upgraderSelection.clear();
        this.state.minigames.upgrader.itemIds = [];
        this.renderTab();
        break;
      case "select-auction-item":
        this.auctionItemId = data.id || "";
        this.auctionPrice = "";
        this.renderTab();
        break;
      case "play-roulette":
        this.playRouletteGame();
        break;
      case "toggle-roulette-autoplay":
        this.ensureAutomaticGameLoopState();
        this.scheduleRouletteLoop(600);
        this.renderTab();
        break;
      case "play-pachinko":
        this.playPachinkoGame();
        break;
      case "play-upgrader":
        this.playUpgraderGame();
        break;
      case "play-coinflip":
        this.playCoinflipGame();
        break;
      case "set-coinflip-side":
        this.state.minigames.coinflip.side = data.side === "t" ? "t" : "ct";
        this.renderTab();
        break;
      case "play-crash":
        this.playCrashGame();
        break;
      case "cashout-crash":
        this.cashOutActiveCrash(false);
        break;
      case "toggle-crash-autoplay":
        this.ensureAutomaticGameLoopState();
        this.scheduleCrashLoop(600);
        this.renderTab();
        break;
      case "stop-crash-autoplay":
        this.ensureAutomaticGameLoopState();
        this.scheduleCrashLoop(600);
        this.renderTab();
        break;
      case "set-crash-bet":
        this.setCrashBetShortcut(data.mode);
        break;
      case "select-jackpot-lobby":
        this.jackpotLobbyId = data.id || "";
        this.jackpotSelection.clear();
        this.jackpotPreview = null;
        this.scheduleJackpotLoop(1200);
        this.renderTab();
        break;
      case "change-jackpot-lobby":
        this.jackpotLobbyId = "";
        this.jackpotSelection.clear();
        this.renderTab();
        break;
      case "toggle-jackpot-item":
        this.toggleJackpotItem(data.id);
        this.scheduleJackpotLoop(1200);
        break;
      case "clear-jackpot-selection":
        this.jackpotSelection.clear();
        this.scheduleJackpotLoop(3000);
        this.renderTab();
        break;
      case "play-jackpot":
        this.playJackpotGame();
        break;
      case "close-jackpot-win":
        this.jackpotWinPopup = null;
        this.renderJackpotWinPopup();
        break;
      case "redeem-promo":
        this.redeemPromo();
        break;
      case "deposit-goal":
        this.depositGoal(data.id);
        break;
      case "claim-goal":
        this.claimGoal(data.id);
        break;
      case "open-owned-case":
        this.openOwnedCase(data.id);
        break;
      case "delete-owned-case":
        this.deleteOwnedCase(data.id);
        break;
      case "create-auction":
        this.createAuction();
        break;
      case "settle-auction":
        this.settleAuction(data.id);
        break;
      case "buy-shared-auction":
        this.buySharedAuction(data.id);
        break;
      case "toggle-chat":
        this.chatOpen = !this.chatOpen;
        this.renderGlobalChatDock();
        if (this.chatOpen) {
          this.refreshChat();
        }
        break;
      case "send-chat":
        this.sendChat();
        break;
      case "set-chat-team":
        this.setChatTeam(data.team);
        break;
      case "accept-cookies":
        this.setCookieConsent("accepted");
        break;
      case "reject-cookies":
        this.setCookieConsent("rejected");
        break;
      case "open-legal":
        this.openLegalModal(data.page || "privacy");
        break;
      case "close-legal":
        this.closeLegalModal();
        break;
      case "cheat-add-credits":
        this.cheatAddCredits();
        break;
      case "cheat-set-credits":
        this.cheatSetCredits();
        break;
      case "cheat-add-prestige":
        this.cheatAddPrestige();
        break;
      case "cheat-add-shards":
        this.cheatAddShards();
        break;
      case "cheat-unlock-cases":
        this.cheatUnlockCases();
        break;
      case "cheat-max-upgrades":
        this.cheatMaxUpgrades();
        break;
      case "cheat-master-case":
        this.cheatMasterCase();
        break;
      case "cheat-reset-cooldowns":
        this.cheatResetCooldowns();
        break;
      case "cheat-complete-goals":
        this.cheatCompleteGoals();
        break;
      case "cheat-reset-community-goals":
        this.cheatResetCommunityGoals();
        break;
      case "admin-edit-promo":
        this.adminEditPromo(data.code);
        break;
      case "admin-delete-promo":
        this.adminDeletePromo(data.code);
        break;
      case "admin-clear-promo-form":
        this.adminClearPromoForm();
        break;
      case "admin-create-promo":
        this.adminCreatePromo();
        break;
      case "export-save":
        this.showExport(element);
        break;
      case "import-save":
        this.importSave();
        break;
      case "reset-save":
        this.resetSave();
        break;
      case "refresh-api":
        window.dispatchEvent(new CustomEvent("force-api-refresh"));
        break;
      case "cloud-sign-in":
        this.signInCloud();
        break;
      case "cloud-discord":
        this.signInDiscord();
        break;
      case "cloud-login-password":
        this.signInUsername();
        break;
      case "cloud-register-password":
        this.registerUsername();
        break;
      case "toggle-admin-gate":
        this.adminGateOpen = !this.adminGateOpen;
        this.renderTechMenu();
        break;
      case "admin-login":
        this.loginAdmin();
        break;
      case "admin-logout":
        this.logoutAdmin();
        break;
      case "cloud-save":
        this.saveToCloud();
        break;
      case "cloud-load":
        this.loadFromCloud();
        break;
      case "cloud-sign-out":
        this.signOutFromCloud();
        break;
      default:
        break;
    }
  }

  renderAll() {
    clearExpiredEvent(this.state);
    this.renderTopStats();
    this.renderTechMenu();
    this.renderCases();
    this.renderSelectedCase();
    this.renderOpenerActions();
    this.renderSession();
    this.renderDaily();
    this.renderHistory();
    this.renderTabs();
    this.renderTab();
    this.renderToasts();
    this.renderGlobalChatDock();
    this.renderLegalLayer();
    this.renderApiStatus();
    this.renderProfileSetup();
    this.renderLoginGate();
    this.renderJackpotWinPopup();
    this.refreshIcons();
  }

  renderApiStatus() {
    const status = this.root.querySelector("#apiStatus");
    if (status) {
      status.textContent = "";
    }
  }

  isCloudLoggedIn() {
    return Boolean(this.cloudSession?.user);
  }

  renderLoginGate() {
    const node = this.root.querySelector("#loginGate");
    if (!node) {
      return;
    }
    const locked = !this.isCloudLoggedIn();
    node.hidden = !locked;
    if (!locked) {
      node.innerHTML = "";
      return;
    }
    node.innerHTML = `
      <div class="login-gate-backdrop"></div>
      <section class="login-gate-card" role="dialog" aria-modal="true" aria-label="Login obbligatorio">
        <div class="login-gate-head">
          <span>${iconMarkup("cloud", "button-icon")} Online</span>
          <h2>Accedi per giocare</h2>
          <small>${escapeHtml(this.cloudStatus || "Serve un account cloud per usare il gioco.")}</small>
        </div>
        <div class="login-gate-form">
          <button class="discord-button" data-action="cloud-discord" ${this.cloudAvailable && !this.cloudBusy ? "" : "disabled"}>
            ${iconMarkup("message-circle", "button-icon")} Discord
          </button>
          <label>
            <span>Username</span>
            <input id="authUsername" value="${escapeHtml(this.authUsername)}" maxlength="24" autocomplete="username" placeholder="nomeutente" ${this.cloudBusy ? "disabled" : ""} />
          </label>
          <label>
            <span>Password</span>
            <input id="authPassword" type="password" value="${escapeHtml(this.authPassword)}" autocomplete="current-password" placeholder="min. 6 caratteri" ${this.cloudBusy ? "disabled" : ""} />
          </label>
          <div class="login-gate-actions">
            <button class="primary-button" data-action="cloud-login-password" ${this.cloudAvailable && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("log-in", "button-icon")} Accedi
            </button>
            <button class="ghost-button" data-action="cloud-register-password" ${this.cloudAvailable && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("user-plus", "button-icon")} Registrati
            </button>
          </div>
        </div>
      </section>
    `;
    this.refreshIcons();
  }

  renderJackpotWinPopup() {
    const node = this.root.querySelector("#jackpotWinOverlay");
    if (!node) {
      return;
    }
    const popup = this.jackpotWinPopup;
    node.hidden = !popup;
    if (!popup) {
      node.innerHTML = "";
      return;
    }
    const items = popup.items || [];
    node.innerHTML = `
      <div class="jackpot-win-backdrop" data-action="close-jackpot-win"></div>
      <article class="jackpot-win-card">
        <header>
          <div>
            <span>${iconMarkup("trophy", "button-icon")} Jackpot</span>
            <h2>Skin vinte</h2>
          </div>
          <button class="ghost-button small" data-action="close-jackpot-win">${iconMarkup("x", "button-icon")} Chiudi</button>
        </header>
        <div class="jackpot-win-grid">
          ${items.map((item) => itemCard(item, { compact: true })).join("")}
        </div>
      </article>
    `;
    this.refreshIcons();
  }

  renderTopStats() {
    const topStats = this.root.querySelector("#topStats");
    const playerAvatar = this.root.querySelector("#playerAvatar");
    const playerCopyStrong = this.root.querySelector(".player-copy strong");
    const playerCopySmall = this.root.querySelector(".player-copy small");
    const inventoryValue = getInventoryValue(this.state);
    const netWorth = getNetWorth(this.state);
    const level = this.state.profile.level;
    const totalXp = Math.round(this.state.profile.xp);
    const levelFloor = Math.max(0, Math.pow(Math.max(0, level - 1), 2) * 125);
    const levelCeil = Math.max(levelFloor + 125, Math.pow(level, 2) * 125);
    const levelXp = Math.max(0, totalXp - levelFloor);
    const levelXpNeed = Math.max(1, levelCeil - levelFloor);
    const levelProgress = Math.min(1, levelXp / levelXpNeed);
    const accent = this.state.profile?.accent || "#7fe37c";
    if (playerAvatar) {
      playerAvatar.style.setProperty("--player-accent", accent);
      playerAvatar.classList.toggle("has-image", Boolean(this.state.profile?.avatarImage || this.state.profile?.avatarProviderImage));
      playerAvatar.innerHTML = `
        ${profileAvatarMarkup(this.state.profile, this.getProfileIconId(), "player-avatar-icon")}
        <b>P${this.state.prestige.level}</b>
      `;
    }
    if (playerCopyStrong) {
      playerCopyStrong.textContent = this.state.profile?.name || "Operatore";
    }
    if (playerCopySmall) {
      playerCopySmall.textContent = this.isAdmin()
        ? `Lv ${level} · ${levelXp.toLocaleString("it-IT")}/${levelXpNeed.toLocaleString("it-IT")} XP · Admin`
        : `Lv ${level} · ${levelXp.toLocaleString("it-IT")}/${levelXpNeed.toLocaleString("it-IT")} XP`;
    }
    topStats.innerHTML = `
      <article class="top-stat-card top-stat-balance">
        <span>${iconMarkup("coins", "top-stat-mini")} CREDITI</span>
        <strong>${formatCredits(this.state.credits)}</strong>
        <small>saldo disponibile</small>
      </article>
      <article class="top-stat-card">
        <span>${iconMarkup("briefcase", "top-stat-mini")} LOCKER</span>
        <strong>${this.state.inventory.length.toLocaleString("it-IT")} skin</strong>
        <small>${formatCredits(inventoryValue)} in inventario</small>
      </article>
      <article class="top-stat-card">
        <span>${iconMarkup("gem", "top-stat-mini")} NET WORTH</span>
        <strong>${formatCredits(netWorth)}</strong>
        <small>Prestige ${this.state.prestige.level} - drop x${getDropValueMultiplier(this.state).toFixed(2)}</small>
      </article>
      <article class="top-stat-card top-stat-level">
        <div class="top-level-head">
          <span>${iconMarkup("shield", "top-stat-mini")} Profilo Lv ${level}</span>
          <small>${this.state.profile?.title || "Case Runner"}</small>
        </div>
        <div class="top-level-bar"><i style="width:${percent(levelProgress)}"></i></div>
        <small>${levelXp.toLocaleString("it-IT")} / ${levelXpNeed.toLocaleString("it-IT")} XP</small>
      </article>
    `;
    this.refreshIcons();
  }

  renderTechMenu() {
    const menu = this.root.querySelector("#techMenu");
    const button = this.root.querySelector("#playerButton");
    if (!menu || !button) {
      return;
    }
    const isAdmin = this.isAdmin();
    const audio = this.getAudioSettings();
    const profile = this.state.profile || {};
    const cloudUserId = this.cloudSession?.user?.id || "";
    const cloudLabel = !this.cloudAvailable
      ? "Non configurato"
      : this.cloudSession?.user
        ? `Connesso ${cloudUserId.slice(0, 8)}`
        : "Non connesso";
    const accountName = getSessionDisplayName(this.cloudSession) || profile.name || "Operatore";
    const accountProvider = this.cloudSession?.user?.app_metadata?.provider || "";
    button.setAttribute("aria-expanded", this.techMenuOpen ? "true" : "false");
    menu.hidden = !this.techMenuOpen;
    menu.innerHTML = `
      <div class="tech-menu-card">
        <div class="tech-menu-head">
          <strong>${escapeHtml(profile.name || "Operatore")}</strong>
          <small>${escapeHtml(profile.title || "Case Runner")} · P${this.state.prestige.level} · Lv ${this.state.profile.level}${isAdmin ? " · Admin" : ""}</small>
        </div>
        <div class="tech-menu-actions">
          <button class="ghost-button tiny" data-action="open-profile-setup">${iconMarkup("user-round-cog", "button-icon")} Scheda</button>
          ${isAdmin ? `
          <button class="ghost-button tiny ${this.sessionPanelOpen ? "is-active" : ""}" data-action="toggle-session-panel">
            ${iconMarkup("sliders-horizontal", "button-icon")} Sessione ${this.sessionPanelOpen ? "On" : "Off"}
          </button>
          <button class="ghost-button tiny" data-action="refresh-api">${iconMarkup("refresh-cw", "button-icon")} Aggiorna API</button>
          <button class="ghost-button tiny" data-action="tab" data-tab="cheats">${iconMarkup("wrench", "button-icon")} Cheat</button>
          <button class="ghost-button tiny" data-action="start-event">${iconMarkup("sparkles", "button-icon")} Forza evento</button>
          <button class="ghost-button tiny" data-action="export-save">${iconMarkup("download", "button-icon")} Export</button>
          <button class="ghost-button tiny" data-action="import-save">${iconMarkup("upload", "button-icon")} Import</button>
          <button class="ghost-button tiny danger" data-action="reset-save">${iconMarkup("rotate-ccw", "button-icon")} Reset save</button>
          ` : ""}
        </div>
        <div class="tech-menu-cloud">
          <div class="tech-menu-subhead">
            <strong>${iconMarkup("cloud", "button-icon")} Account cloud</strong>
            <span class="cloud-status ${this.cloudSession?.user ? "is-online" : ""}">${escapeHtml(cloudLabel)}</span>
          </div>
          <small>${escapeHtml(this.cloudStatus)}</small>
          ${this.cloudSession?.user ? `
            <div class="tech-account-card">
              <strong>${escapeHtml(accountName)}</strong>
              <span>${escapeHtml(accountProvider ? `Login ${accountProvider}` : "Sessione attiva")}</span>
            </div>
          ` : `
            <button class="discord-button" data-action="cloud-discord" ${this.cloudAvailable && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("message-circle", "button-icon")} Accedi con Discord
            </button>
            <div class="tech-auth-form">
              <label>
                <span>Username</span>
                <input id="authUsername" value="${escapeHtml(this.authUsername)}" maxlength="24" autocomplete="username" placeholder="nomeutente" ${this.cloudBusy ? "disabled" : ""} />
              </label>
              <label>
                <span>Password</span>
                <input id="authPassword" type="password" value="${escapeHtml(this.authPassword)}" autocomplete="current-password" placeholder="min. 6 caratteri" ${this.cloudBusy ? "disabled" : ""} />
              </label>
              <div class="tech-menu-actions compact">
                <button class="ghost-button tiny" data-action="cloud-login-password" ${this.cloudAvailable && !this.cloudBusy ? "" : "disabled"}>
                  ${iconMarkup("log-in", "button-icon")} Accedi
                </button>
                <button class="ghost-button tiny" data-action="cloud-register-password" ${this.cloudAvailable && !this.cloudBusy ? "" : "disabled"}>
                  ${iconMarkup("user-plus", "button-icon")} Registrati
                </button>
              </div>
              <small>Recupero password: usa Discord se vuoi recupero account. Username/password senza email richiede reset manuale admin.</small>
            </div>
          `}
          <div class="tech-menu-actions compact">
            ${isAdmin ? `<button class="ghost-button tiny" data-action="cloud-sign-in" ${this.cloudAvailable && !this.cloudSession?.user && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("log-in", "button-icon")} Accedi anon
            </button>` : ""}
            <button class="ghost-button tiny" data-action="cloud-save" ${this.cloudSession?.user && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("cloud-upload", "button-icon")} Salva cloud
            </button>
            <button class="ghost-button tiny" data-action="cloud-load" ${this.cloudSession?.user && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("cloud-download", "button-icon")} Carica cloud
            </button>
            <button class="ghost-button tiny" data-action="cloud-sign-out" ${this.cloudSession?.user && !this.cloudBusy ? "" : "disabled"}>
              ${iconMarkup("log-out", "button-icon")} Logout
            </button>
          </div>
        </div>
        <div class="tech-menu-audio">
          <div class="tech-menu-subhead">
            <strong>${iconMarkup("volume-2", "button-icon")} Audio</strong>
            <label class="tech-audio-mute" data-tip="Disattiva tutto l'audio del reel e dei drop.">
              <input id="audioMuted" type="checkbox" ${audio.muted ? "checked" : ""} />
              <span>Mute</span>
            </label>
          </div>
          <label class="tech-audio-row" data-tip="Volume globale del gioco.">
            <span>Master</span>
            <input id="audioMaster" type="range" min="0" max="100" step="1" value="${Math.round(audio.master * 100)}" />
            <strong>${Math.round(audio.master * 100)}%</strong>
          </label>
          <label class="tech-audio-row" data-tip="Ticchettio del reel durante l'apertura.">
            <span>Reel</span>
            <input id="audioReel" type="range" min="0" max="100" step="1" value="${Math.round(audio.reel * 100)}" />
            <strong>${Math.round(audio.reel * 100)}%</strong>
          </label>
          <label class="tech-audio-row" data-tip="Reveal finale e drop rari.">
            <span>Drop</span>
            <input id="audioDrop" type="range" min="0" max="100" step="1" value="${Math.round(audio.drop * 100)}" />
            <strong>${Math.round(audio.drop * 100)}%</strong>
          </label>
        </div>
        <div class="admin-gate ${isAdmin ? "is-active" : ""}">
          <div class="tech-menu-subhead">
            <strong>${iconMarkup("shield-check", "button-icon")} Staff</strong>
            ${isAdmin
              ? `<button class="ghost-button tiny" data-action="admin-logout">Logout</button>`
              : `<button class="ghost-button tiny" data-action="toggle-admin-gate">${this.adminGateOpen ? "Chiudi" : "Admin"}</button>`}
          </div>
          ${isAdmin ? `
            <small>Strumenti tecnici abilitati per questa sessione.</small>
          ` : this.adminGateOpen ? `
            <div class="tech-auth-form">
              <label>
                <span>ID staff</span>
                <input id="adminUserId" value="${escapeHtml(this.adminUserId)}" autocomplete="username" placeholder="id" />
              </label>
              <label>
                <span>Password</span>
                <input id="adminPassword" type="password" value="${escapeHtml(this.adminPassword)}" autocomplete="current-password" placeholder="password" />
              </label>
              <button class="primary-button small" data-action="admin-login">${iconMarkup("key-round", "button-icon")} Entra admin</button>
              ${this.adminStatus ? `<small>${escapeHtml(this.adminStatus)}</small>` : ""}
            </div>
          ` : ""}
        </div>
      </div>
    `;
    this.refreshIcons();
  }

  renderProfileSetup() {
    const node = this.root.querySelector("#profileSetup");
    if (!node) {
      return;
    }
    const profile = this.state.profile || {};
    const iconId = this.getProfileIconId(profile);
    const accent = profile.accent || "#7fe37c";
    const canClose = Boolean(profile.configured);
    node.hidden = !this.profileSetupOpen;
    if (!this.profileSetupOpen) {
      node.innerHTML = "";
      return;
    }
    node.innerHTML = `
      <div class="profile-setup-backdrop"></div>
      <div class="profile-setup-card" style="--player-accent:${accent}">
        <div class="profile-setup-copy">
          <span>${iconMarkup("id-card", "button-icon")} Profilo giocatore</span>
          <h2>Configura la tua scheda</h2>
          <p>Impostiamo identita', colore e badge del profilo per la progressione single-player.</p>
        </div>
        <div class="profile-setup-body">
          <div class="profile-setup-preview">
            <div class="profile-preview-avatar ${profile.avatarImage || profile.avatarProviderImage ? "has-image" : ""}">
              ${profileAvatarMarkup(profile, iconId, "profile-preview-icon")}
              <b>${this.getPlayerInitials()}</b>
            </div>
            <div class="profile-preview-copy">
              <strong>${escapeHtml(profile.name || "Operatore")}</strong>
              <small>${escapeHtml(profile.title || "Case Runner")}</small>
              <em>P${this.state.prestige.level} · Lv ${this.state.profile.level}</em>
            </div>
          </div>
          <div class="profile-setup-fields">
            <label>
              <span>Nome</span>
              <input id="profileName" value="${escapeHtml(profile.name || "")}" maxlength="18" placeholder="Operatore" />
            </label>
            <label>
              <span>Titolo</span>
              <input id="profileTitle" value="${escapeHtml(profile.title || "")}" maxlength="28" placeholder="Case Runner" />
            </label>
            <label>
              <span>Accent</span>
              <input id="profileAccent" type="color" value="${escapeHtml(accent)}" />
            </label>
            <label>
              <span>Avatar</span>
              <select id="profileAvatarIcon">
                ${PROFILE_ICON_OPTIONS.map((option) => `<option value="${option.id}" ${option.id === iconId ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Immagine profilo</span>
              <input id="profileAvatarUpload" type="file" accept="image/*" />
            </label>
          </div>
        </div>
        <div class="profile-setup-actions">
          ${canClose ? `<button class="ghost-button" data-action="close-profile-setup">${iconMarkup("x", "button-icon")} Chiudi</button>` : ""}
          <button class="ghost-button" data-action="clear-profile-avatar">${iconMarkup("image-off", "button-icon")} Reset avatar</button>
          <button class="ghost-button" data-action="randomize-profile">${iconMarkup("shuffle", "button-icon")} Random</button>
          <button class="primary-button" data-action="save-profile">${iconMarkup("check", "button-icon")} Salva scheda</button>
        </div>
      </div>
    `;
    this.refreshIcons();
  }

  syncCaseCarouselPage(visibleCases) {
    const cases = visibleCases || this.getFilteredCases();
    const totalPages = Math.max(1, cases.length);
    if (!cases.length) {
      this.caseCarouselPage = 0;
      return { totalPages };
    }
    this.caseCarouselPage = Math.max(0, Math.min(this.caseCarouselPage, totalPages - 1));
    return { totalPages };
  }

  getPrimaryTab(tabId = this.activeTab) {
    return TAB_PARENT[tabId] || tabId;
  }

  getAllowedTabIds() {
    return Object.values(TAB_GROUPS)
      .flat()
      .filter((tabId) => this.isAdmin() || !["cheats", "admin"].includes(tabId));
  }

  renderSectionTabs(groupId) {
    const tabs = TAB_GROUPS[groupId] || [groupId];
    if (tabs.length < 2) {
      return "";
    }
    return `
      <div class="workspace-tabs">
        ${tabs.map((tabId) => `
          <button
            class="workspace-tab ${this.activeTab === tabId ? "is-active" : ""}"
            data-action="tab"
            data-tab="${tabId}"
          >${escapeHtml(TAB_LABELS[tabId] || tabId)}</button>
        `).join("")}
      </div>
    `;
  }

  getSortedCases(cases) {
    return [...cases].sort((a, b) => {
      const favoriteDelta = Number(this.isCaseFavorite(b.id)) - Number(this.isCaseFavorite(a.id));
      if (favoriteDelta) {
        return favoriteDelta;
      }
      if (this.caseSort === "priceAsc") {
        return a.price - b.price || a.name.localeCompare(b.name);
      }
      if (this.caseSort === "priceDesc") {
        return b.price - a.price || a.name.localeCompare(b.name);
      }
      if (this.caseSort === "newest" || this.caseSort === "oldest") {
        const dateA = Date.parse(String(a.firstSaleDate || "").replaceAll("/", "-")) || 0;
        const dateB = Date.parse(String(b.firstSaleDate || "").replaceAll("/", "-")) || 0;
        return this.caseSort === "newest" ? dateB - dateA : dateA - dateB;
      }
      if (this.caseSort === "mastery") {
        const masteryA = getCaseMastery(this.state, a.id);
        const masteryB = getCaseMastery(this.state, b.id);
        return masteryB.level - masteryA.level || masteryB.opens - masteryA.opens || a.name.localeCompare(b.name);
      }
      if (this.caseSort === "skins") {
        return b.totalSkins - a.totalSkins || a.name.localeCompare(b.name);
      }
      const prestigeDelta = (a.unlockPrestige || 0) - (b.unlockPrestige || 0);
      if (prestigeDelta) {
        return prestigeDelta;
      }
      const dateA = Date.parse(String(a.firstSaleDate || "").replaceAll("/", "-")) || 0;
      const dateB = Date.parse(String(b.firstSaleDate || "").replaceAll("/", "-")) || 0;
      return dateB - dateA || a.name.localeCompare(b.name);
    });
  }

  getCasePrestigeGroups() {
    return [...new Set(this.skinData.cases.map((caseDef) => caseDef.unlockPrestige || 0))]
      .sort((a, b) => a - b);
  }

  getCasesForPrestigeGroup(group) {
    return this.skinData.cases.filter((caseDef) => (caseDef.unlockPrestige || 0) === group);
  }

  changeCasePrestigeGroup(delta) {
    const groups = this.getCasePrestigeGroups();
    const currentIndex = Math.max(0, groups.indexOf(this.casePrestigeGroup));
    const nextIndex = clamp(currentIndex + delta, 0, Math.max(0, groups.length - 1));
    const nextGroup = groups[nextIndex] ?? this.casePrestigeGroup;
    if (nextGroup === this.casePrestigeGroup) {
      return;
    }
    this.casePrestigeGroup = nextGroup;
    this.caseCarouselPage = 0;
    this.caseInfoOpenId = null;
    if (this.selectedCase?.unlockPrestige !== this.casePrestigeGroup) {
      const nextVisible = this.getCasesForPrestigeGroup(this.casePrestigeGroup).find((caseDef) => isCaseUnlocked(this.state, caseDef));
      if (nextVisible) {
        this.selectedCase = nextVisible;
        this.state.selectedCaseId = nextVisible.id;
        this.renderSelectedCase();
        this.renderOpenerActions();
      }
    }
    this.renderCases();
  }

  getFilteredCases() {
    return this.getSortedCases(this.skinData.cases.filter((caseDef) => {
      const matchesGroup = (caseDef.unlockPrestige || 0) === this.casePrestigeGroup;
      return matchesGroup;
    }));
  }

  renderCaseFilters(visibleCases) {
    const node = this.root.querySelector("#caseFilters");
    if (!node) {
      return;
    }
    const activeFilters =
      (this.caseSearch ? 1 : 0) +
      (this.caseStatus !== "all" ? 1 : 0) +
      (this.caseMaxPrice ? 1 : 0) +
      (this.caseSort !== "progression" ? 1 : 0);
    const groups = this.getCasePrestigeGroups();
    const groupCases = this.getCasesForPrestigeGroup(this.casePrestigeGroup);
    const unlockedCount = groupCases.filter((caseDef) => isCaseUnlocked(this.state, caseDef)).length;
    const affordableCount = groupCases.filter((caseDef) => isCaseUnlocked(this.state, caseDef) && this.state.credits >= caseDef.price).length;
    const favoriteCount = groupCases.filter((caseDef) => this.isCaseFavorite(caseDef.id)).length;
    node.innerHTML = `
      <div class="case-prestige-tabs">
        ${groups.map((group) => `
          <button class="case-prestige-tab ${this.casePrestigeGroup === group ? "is-active" : ""}" data-action="select-case-group" data-group="${group}" type="button">
            <span>Prestige ${group}</span>
            <small>${this.getCasesForPrestigeGroup(group).length}</small>
          </button>
        `).join("")}
      </div>
      <div class="case-filters-head">
        <div class="case-filters-meta">
          <span>Filtri casse</span>
          <small>${activeFilters ? `${activeFilters} attivi` : "nessun filtro"} - ${visibleCases.length}/${this.skinData.cases.length} casse</small>
        </div>
        <button
          class="session-toggle ${this.caseFiltersOpen ? "is-on" : ""}"
          data-action="toggle-case-filters"
          type="button"
          aria-pressed="${this.caseFiltersOpen ? "true" : "false"}"
        >${this.caseFiltersOpen ? "On" : "Off"}</button>
      </div>
      <div class="case-overview-strip">
        <div class="case-overview-chip">
          <span>Sbloccate</span>
          <strong>${unlockedCount}/${groupCases.length}</strong>
        </div>
        <div class="case-overview-chip">
          <span>Acquistabili</span>
          <strong>${affordableCount}</strong>
        </div>
        <div class="case-overview-chip">
          <span>Preferite</span>
          <strong>${favoriteCount}</strong>
        </div>
      </div>
      ${this.caseFiltersOpen ? `
        <div class="case-filters-body">
          <input id="caseSearch" value="${escapeHtml(this.caseSearch)}" placeholder="Cerca cassa..." />
          <div class="case-filter-row">
            <select id="caseStatus">
              <option value="all" ${this.caseStatus === "all" ? "selected" : ""}>Tutte</option>
              <option value="unlocked" ${this.caseStatus === "unlocked" ? "selected" : ""}>Sbloccate</option>
              <option value="affordable" ${this.caseStatus === "affordable" ? "selected" : ""}>Acquistabili</option>
              <option value="locked" ${this.caseStatus === "locked" ? "selected" : ""}>Bloccate</option>
            </select>
            <input id="caseMaxPrice" type="number" min="0" step="10" value="${escapeHtml(this.caseMaxPrice)}" placeholder="Max prezzo" />
          </div>
          <div class="case-filter-row">
            <select id="caseSort">
              <option value="progression" ${this.caseSort === "progression" ? "selected" : ""}>Progressione</option>
              <option value="priceAsc" ${this.caseSort === "priceAsc" ? "selected" : ""}>Prezzo crescente</option>
              <option value="priceDesc" ${this.caseSort === "priceDesc" ? "selected" : ""}>Prezzo decrescente</option>
              <option value="newest" ${this.caseSort === "newest" ? "selected" : ""}>Piu' nuove</option>
              <option value="oldest" ${this.caseSort === "oldest" ? "selected" : ""}>Piu' vecchie</option>
              <option value="mastery" ${this.caseSort === "mastery" ? "selected" : ""}>Mastery</option>
              <option value="skins" ${this.caseSort === "skins" ? "selected" : ""}>Skin nel pool</option>
            </select>
            <button class="ghost-button tiny" data-action="clear-case-filters">Reset</button>
          </div>
          <small>Saldo ${formatCredits(this.state.credits, true)}</small>
        </div>
      ` : ""}
    `;
    const filtersMeta = node.querySelector(".case-filters-meta small");
    if (filtersMeta) {
      filtersMeta.textContent = `${activeFilters ? `${activeFilters} attivi` : "nessun filtro"} - ${visibleCases.length}/${groupCases.length} casse`;
    }
    if (filtersMeta) {
      filtersMeta.textContent = `${activeFilters ? `${activeFilters} attivi` : "nessun filtro"} - ${visibleCases.length}/${groupCases.length} casse`;
    }
    return;
    node.innerHTML = `
      <input id="caseSearch" value="${escapeHtml(this.caseSearch)}" placeholder="Cerca cassa..." />
      <div class="case-filter-row">
        <select id="caseStatus">
          <option value="all" ${this.caseStatus === "all" ? "selected" : ""}>Tutte</option>
          <option value="unlocked" ${this.caseStatus === "unlocked" ? "selected" : ""}>Sbloccate</option>
          <option value="affordable" ${this.caseStatus === "affordable" ? "selected" : ""}>Acquistabili</option>
          <option value="locked" ${this.caseStatus === "locked" ? "selected" : ""}>Bloccate</option>
        </select>
        <input id="caseMaxPrice" type="number" min="0" step="10" value="${escapeHtml(this.caseMaxPrice)}" placeholder="Max prezzo" />
      </div>
      <div class="case-filter-row">
        <select id="caseSort">
          <option value="progression" ${this.caseSort === "progression" ? "selected" : ""}>Progressione</option>
          <option value="priceAsc" ${this.caseSort === "priceAsc" ? "selected" : ""}>Prezzo crescente</option>
          <option value="priceDesc" ${this.caseSort === "priceDesc" ? "selected" : ""}>Prezzo decrescente</option>
          <option value="newest" ${this.caseSort === "newest" ? "selected" : ""}>Piu' nuove</option>
          <option value="oldest" ${this.caseSort === "oldest" ? "selected" : ""}>Piu' vecchie</option>
          <option value="mastery" ${this.caseSort === "mastery" ? "selected" : ""}>Mastery</option>
          <option value="skins" ${this.caseSort === "skins" ? "selected" : ""}>Skin nel pool</option>
        </select>
        <button class="ghost-button tiny" data-action="clear-case-filters">Reset</button>
      </div>
      <small>${visibleCases.length}/${this.skinData.cases.length} casse - saldo ${formatCredits(this.state.credits, true)}</small>
    `;
  }

  renderCases() {
    const list = this.root.querySelector("#caseList");
    const visibleCases = this.getFilteredCases();
    const meta = this.root.querySelector("#caseCarouselMeta");
    this.renderCaseFilters(visibleCases);
    if (meta) {
      meta.textContent = `${visibleCases.length} casse`;
    }
    list.innerHTML = `
      <div class="case-list-stack">
        ${visibleCases
      .map((caseDef) => {
        const unlocked = isCaseUnlocked(this.state, caseDef);
        const active = this.selectedCase?.id === caseDef.id;
        const mastery = getCaseMastery(this.state, caseDef.id);
        const priceLabel = caseDef.price <= 0 ? "Gratis" : formatCredits(caseDef.price, true);
        return `
          <article class="case-row case-list-item ${active ? "is-active" : ""} ${unlocked ? "" : "is-locked"}" style="--case-accent:${caseDef.accent}">
            <button class="case-button"
              data-action="select-case"
              data-id="${caseDef.id}"
              ${unlocked ? "" : "disabled"}>
              <span class="case-art-shell">
                <img src="${caseDef.image}" alt="${escapeHtml(caseDef.name)}" loading="lazy" />
              </span>
              <span class="case-row-copy">
                <strong>${escapeHtml(caseDef.name)}</strong>
                <div class="case-compact-meta">
                  <small>${escapeHtml(priceLabel)}</small>
                  <small>Lv ${mastery.level}</small>
                </div>
                <div class="progress-line"><i style="width:${percent(mastery.progress)}"></i></div>
              </span>
            </button>
          </article>
        `;
      })
      .join("") || `<div class="empty-state small">Nessuna cassa con questi filtri.</div>`}
      </div>
    `;
    this.refreshIcons();
  }

  renderSelectedCase() {
    const node = this.root.querySelector("#selectedCase");
    const caseDef = this.selectedCase;
    const table = getCaseDropTable(this.state, caseDef);
    const openedToday = this.state.stats.caseCounts[caseDef.id] || 0;
    const cleanPriceNote = caseDef.priceSource === "steam"
      ? `Steam ${caseDef.steamRawPrice || `${caseDef.realPriceEuro?.toFixed(2)} euro`}`
      : "fallback bilanciato";
    const detailSummary = `${formatCredits(table.expectedValue)} EV - ${formatCredits(caseDef.price)} costo - ${openedToday} aperture`;
    const detailToggleIcon = this.caseDetailsOpen ? "-" : "+";
    node.innerHTML = `
      <div class="case-economy case-economy-main">
        <button class="case-details-toggle" data-action="toggle-case-details">
          <span>Dettagli cassa</span>
          <strong>${detailSummary}</strong>
          <i>${detailToggleIcon}</i>
        </button>
        ${this.caseDetailsOpen ? `
          <div class="case-details-panel">
            <div class="ev-strip">
              ${statTile("EV stimato", formatCredits(table.expectedValue), `ROI ${(table.roi * 100).toFixed(1)}%`)}
              ${statTile("Costo", formatCredits(caseDef.price), cleanPriceNote)}
              ${statTile("Best tier", table.bestRarity || "-", `${table.bestPreview.length} preview`)}
              ${statTile("Aperture", openedToday, "totali su questa cassa")}
            </div>
            <div class="drop-table">
              ${table.rows.map((row) => `
                <div class="drop-row" style="--rarity:${row.color}">
                  <span>${escapeHtml(row.rarity)}</span>
                  <div><i style="width:${percent(row.probability)}"></i></div>
                  <strong>${formatPercent(row.probability)}</strong>
                  <small>${formatCredits(row.estimatedValue, true)} EV</small>
                </div>
              `).join("")}
            </div>
            <div class="best-preview">
              ${table.bestPreview.map((skin) => `
                <div class="best-skin" style="--rarity:${RARITIES[skin.rarity].color}">
                  <img src="${skin.image}" alt="${escapeHtml(skin.name)}" loading="lazy" />
                  <span>${escapeHtml(skin.name)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
    const detailSummaryNode = node.querySelector(".case-details-toggle strong");
    if (detailSummaryNode) {
      detailSummaryNode.textContent = detailSummary;
    }
    const detailIconNode = node.querySelector(".case-details-toggle i");
    if (detailIconNode) {
      detailIconNode.textContent = detailToggleIcon;
    }
    const costNoteNode = node.querySelector(".ev-strip .stat-tile:nth-child(2) small");
    if (costNoteNode) {
      costNoteNode.textContent = cleanPriceNote;
    }
  }

  renderOpenerActions() {
    const node = this.root.querySelector("#openerActions");
    const multi = this.selectedCase.manualOnly ? 1 : getMultiOpenCount(this.state);
    const totalCost = this.selectedCase.price * multi;
    const lastBatch = this.getLastOpenedBatchState();
    const autoLevel = this.state.upgrades.autoOpener || 0;
    const autoEnabled = Boolean(autoLevel) && this.state.automation?.autoOpenerEnabled !== false && !this.selectedCase.manualOnly;
    const autoSellEnabled = Boolean(this.state.autoSell.enabled);
    node.innerHTML = `
      <button class="primary-button" data-action="open-case" ${this.isAnimating ? "disabled" : ""}>
        ${this.selectedCase.price <= 0 ? "Apri gratis" : `Apri x${multi}`}
        <span>${formatCredits(totalCost)}</span>
      </button>
      <button class="ghost-button" data-action="open-one" ${this.isAnimating ? "disabled" : ""}>Apri x1</button>
      <div class="opener-settings ${this.openerSettingsOpen ? "is-open" : ""}">
        <button
          class="ghost-button opener-settings-button"
          data-action="toggle-opener-settings"
          type="button"
          aria-expanded="${this.openerSettingsOpen ? "true" : "false"}"
          title="Automazioni"
        >
          <span aria-hidden="true">${iconMarkup("settings-2")}</span>
        </button>
        ${this.openerSettingsOpen ? `
          <div class="opener-settings-menu">
            <div class="opener-settings-head">
              <strong>Automazioni</strong>
              <small>${this.selectedCase.manualOnly ? "Questa cassa resta manuale." : "Controlli rapidi per apertura e vendita."}</small>
            </div>
            <label class="opener-toggle-row">
              <span>
                <strong>Auto-open</strong>
                <small>${autoLevel ? `${autoEnabled ? "Attivo" : "In pausa"} - ${compactTime(getAutoInterval(this.state))}` : "Compra l'upgrade per abilitarlo"}</small>
              </span>
              <input id="quickAutoOpenerEnabled" type="checkbox" ${this.state.automation?.autoOpenerEnabled !== false ? "checked" : ""} ${autoLevel && !this.selectedCase.manualOnly ? "" : "disabled"} />
            </label>
            <label class="opener-toggle-row">
              <span>
                <strong>Auto-sell</strong>
                <small>${autoSellEnabled ? `Fino a ${RARITY_ORDER[Number(this.state.autoSell.maxTier) || 0]} - max ${formatCredits(Number(this.state.autoSell.maxValue) || 0, true)}` : "Disattivato"}</small>
              </span>
              <input id="quickAutoSellEnabled" type="checkbox" ${autoSellEnabled ? "checked" : ""} />
            </label>
            <div class="opener-settings-grid">
              <select id="quickAutoSellMaxTier">
                ${RARITY_ORDER.slice(0, 5).map((rarity, index) => `<option value="${index}" ${Number(this.state.autoSell.maxTier) === index ? "selected" : ""}>${rarity}</option>`).join("")}
              </select>
              <input id="quickAutoSellMaxValue" type="number" min="0" step="5" value="${Number(this.state.autoSell.maxValue)}" />
            </div>
          </div>
        ` : ""}
      </div>
      ${lastBatch.count && !this.isAnimating ? `
        <button class="ghost-button result-sell-button" data-action="sell-last-open" ${this.isAnimating ? "disabled" : ""}>
          ${iconMarkup("banknote")} Vendi risultato
          <span>${lastBatch.count} - ${formatCredits(lastBatch.total, true)}</span>
        </button>
      ` : ""}
      <div class="speed-pill">${this.selectedCase.manualOnly ? "solo manuale" : `${(getOpenDuration(this.state) / 1000).toFixed(1)}s`}</div>
    `;
    const resultSellMeta = node.querySelector(".result-sell-button span");
    if (resultSellMeta && lastBatch.count) {
      resultSellMeta.textContent = `${lastBatch.count} - ${formatCredits(lastBatch.total, true)}`;
    }
    this.refreshIcons();
  }

  renderSession() {
    const node = this.root.querySelector("#sessionBox");
    if (!this.sessionPanelOpen) {
      node.hidden = true;
      node.innerHTML = "";
      return;
    }
    node.hidden = false;
    const eventActive = isEventActive(this.state);
    const limitedActive = isLimitedEventActive(this.state);
    const eventText = eventActive
      ? `${this.state.event.label} x${this.state.event.multiplier.toFixed(2)} - ${compactTime(this.state.event.expiresAt - Date.now())}`
      : "Nessun evento attivo";
    const limitedText = limitedActive
      ? `${this.state.limitedEvent.label} - ${compactTime(this.state.limitedEvent.expiresAt - Date.now())}`
      : this.state.limitedEvent.nextAt > Date.now()
        ? `Cooldown ${compactTime(this.state.limitedEvent.nextAt - Date.now())}`
        : "Pronto";
    const autoLevel = this.state.upgrades.autoOpener || 0;
    const autoEnabled = isAutoOpenerEnabled(this.state);
    const autoLabel = autoLevel ? (autoEnabled ? compactTime(getAutoInterval(this.state)) : "Pausa") : "Off";
    node.innerHTML = `
      ${statTile("Combo", `${this.state.combo.count}x`, `best ${this.state.combo.best}x`)}
      ${statTile("Fortuna", `x${getLuckMultiplier(this.state).toFixed(2)}`, eventText)}
      ${statTile("Evento", limitedActive ? this.state.limitedEvent.label : "Nessuno", limitedText)}
      ${statTile("Auto", autoLabel, `${formatCredits(getPassiveRate(this.state))}/s passivo`)}
      <div class="automation-card">
        <label>
          <input id="autoOpenerEnabled" type="checkbox" ${this.state.automation?.autoOpenerEnabled !== false ? "checked" : ""} ${autoLevel ? "" : "disabled"} />
          Auto-opener
        </label>
        <small>${this.selectedCase.manualOnly ? "La cassa gratuita resta solo manuale." : autoLevel ? `Livello ${autoLevel} - ${autoEnabled ? "attivo" : "disattivato"}` : "Compra l'upgrade per abilitarlo"}</small>
      </div>
      <div class="auto-sell-card">
        <label><input id="autoSellEnabled" type="checkbox" ${this.state.autoSell.enabled ? "checked" : ""} /> Auto-sell</label>
        <div class="auto-sell-simple">
          <select id="autoSellMaxTier">
            ${RARITY_ORDER.slice(0, 5).map((rarity, index) => `<option value="${index}" ${Number(this.state.autoSell.maxTier) === index ? "selected" : ""}>${rarity}</option>`).join("")}
          </select>
          <input id="autoSellMaxValue" type="number" min="0" step="5" value="${Number(this.state.autoSell.maxValue)}" />
        </div>
      </div>
    `;
  }

  renderDaily() {
    const node = this.root.querySelector("#dailyBox");
    if (!this.sessionPanelOpen) {
      node.hidden = true;
      node.innerHTML = "";
      return;
    }
    node.hidden = false;
    const today = new Date().toISOString().slice(0, 10);
    const claimed = this.state.daily.lastClaimDate === today;
    node.innerHTML = `
      <div class="daily-card">
        <div>
          <span>Reward giornaliero</span>
          <strong>Streak ${this.state.daily.streak || 0}</strong>
        </div>
        <button class="primary-button small" data-action="claim-daily" ${claimed ? "disabled" : ""}>
          ${claimed ? "Ritirato" : "Ritira"}
        </button>
      </div>
    `;
  }

  renderHistory() {
    const node = this.root.querySelector("#dropHistory");
    if (!node) {
      return;
    }
    const blockedIds = new Set(this.pendingRevealIds || []);
    const history = (this.state.dropHistory || [])
      .filter((item) => !blockedIds.has(item.id))
      .slice(0, 6);
    node.innerHTML = `
      <div class="panel-heading history-heading">
        <span>Ultimi drop</span>
        <small>${history.length}/6</small>
      </div>
      <div class="mini-history">
        ${history.length ? history.map((item) => `
          <div class="history-item" style="--rarity:${item.rarityColor}">
            <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
            <span>${escapeHtml(item.name)}</span>
            <strong>${item.autoSold ? "Auto" : formatCredits(item.value, true)}</strong>
          </div>
        `).join("") : `<div class="empty-state small">${blockedIds.size ? "Apertura in corso..." : "Apri una cassa per iniziare."}</div>`}
      </div>
    `;
  }

  renderQuickActions() {
    const node = this.root.querySelector("#quickActions");
    if (!node) {
      return;
    }
    const actions = [
      { count: 1, label: "Apri 1x", accent: "green" },
      { count: 10, label: "Apri 10x", accent: "blue" },
      { count: 50, label: "Apri 50x", accent: "pink" }
    ];
    node.innerHTML = `
      <div class="panel-heading quick-heading">
        <span>Azioni rapide</span>
      </div>
      <div class="quick-grid">
        ${actions.map((action) => `
          <button class="quick-open ${action.accent}" data-action="open-many" data-count="${action.count}">
            <span>${action.label}</span>
            <strong>${formatCredits(this.selectedCase.price * action.count)}</strong>
            <small>${escapeHtml(this.selectedCase.name)}</small>
          </button>
        `).join("")}
      </div>
    `;
  }

  renderTabs() {
    const tabs = this.root.querySelector("#tabs");
    const activePrimary = this.getPrimaryTab();
    tabs.innerHTML = NAV_TABS
      .filter(([id]) => this.isAdmin() || id !== "admin")
      .map(([id, label]) => `<button class="${activePrimary === id ? "is-active" : ""}" data-action="tab" data-tab="${id}" title="${escapeHtml(label)}"><span>${tabIcon(id)}</span><em>${escapeHtml(label)}</em></button>`)
      .join("");
    this.refreshIcons();
  }

  renderTab() {
    const content = this.root.querySelector("#tabContent");
    const workspace = this.root.querySelector("#workspace");
    const grid = this.root.querySelector(".main-grid");
    if (["cheats", "admin"].includes(this.activeTab) && !this.isAdmin()) {
      this.activeTab = "cases";
      this.renderTabs();
    }
    const isCases = this.activeTab === "cases";
    grid?.classList.toggle("is-workspace-mode", !isCases);
    workspace?.classList.toggle("is-collapsed", isCases);
    if (isCases) {
      content.innerHTML = "";
      this.refreshIcons();
      return;
    }
    const renderers = {
      inventory: () => this.renderInventory(),
      shop: () => this.renderShop(),
      stats: () => this.renderStats(),
      prestige: () => this.renderPrestige(),
      games: () => this.renderGames(),
      community: () => this.renderCommunityGoals(),
      achievements: () => this.renderAchievements(),
      contracts: () => this.renderContracts(),
      collections: () => this.renderCollections(),
      market: () => this.renderMarket(),
      admin: () => this.renderAdminPanel(),
      cheats: () => this.renderCheats()
    };
    content.innerHTML = renderers[this.activeTab]?.() || "";
    this.refreshIcons();
  }

  getFilteredInventory() {
    const query = this.inventorySearch.trim().toLowerCase();
    const filtered = this.state.inventory.filter((item) => {
      const matchesRarity = this.inventoryRarity === "all" || item.rarity === this.inventoryRarity;
      const matchesWear = this.inventoryWear === "all" || item.wear === this.inventoryWear;
      const isCase = item.type === "rewardCase";
      const matchesType = this.inventoryType === "all" ||
        (this.inventoryType === "cases" && isCase) ||
        (this.inventoryType === "skins" && !isCase);
      const matchesSearch = !query || `${item.name} ${item.weapon || ""} ${item.caseName || ""} ${item.wear || ""} ${isCase ? "cassa reward case" : "skin"}`.toLowerCase().includes(query);
      return matchesRarity && matchesWear && matchesType && matchesSearch;
    });

    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) {
        return Number(b.favorite) - Number(a.favorite);
      }
      if (a.locked !== b.locked) {
        return Number(b.locked) - Number(a.locked);
      }
      if (this.inventorySort === "value") {
        return b.value - a.value;
      }
      if (this.inventorySort === "rarity") {
        return RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.value - a.value;
      }
      if (this.inventorySort === "float") {
        return a.float - b.float;
      }
      return b.obtainedAt - a.obtainedAt;
    });

    return filtered;
  }

  renderInventory() {
    const items = this.getFilteredInventory();
    const pages = Math.max(1, Math.ceil(items.length / INVENTORY_PAGE_SIZE));
    this.inventoryPage = Math.min(this.inventoryPage, pages);
    const start = (this.inventoryPage - 1) * INVENTORY_PAGE_SIZE;
    const pageItems = items.slice(start, start + INVENTORY_PAGE_SIZE);
    const filteredValue = items.reduce((sum, item) => sum + item.value, 0);
    const selectedItems = this.state.inventory.filter((item) => this.selectedInventory.has(item.id));
    const selectedValue = selectedItems.reduce((sum, item) => sum + getSellReturn(this.state, item), 0);

    return `
      ${this.renderSectionTabs("inventory")}
      <div class="toolbar">
        <input id="inventorySearch" value="${escapeHtml(this.inventorySearch)}" placeholder="Cerca skin, arma, cassa..." />
        <select id="rarityFilter">
          <option value="all">Tutte le rarita'</option>
          ${RARITY_ORDER.map((rarity) => `<option value="${rarity}" ${this.inventoryRarity === rarity ? "selected" : ""}>${rarity}</option>`).join("")}
        </select>
        <select id="wearFilter">
          <option value="all">Tutte le usure</option>
          ${["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"].map((wear) => `<option value="${wear}" ${this.inventoryWear === wear ? "selected" : ""}>${wear}</option>`).join("")}
        </select>
        <select id="typeFilter">
          <option value="all" ${this.inventoryType === "all" ? "selected" : ""}>Skin e casse</option>
          <option value="skins" ${this.inventoryType === "skins" ? "selected" : ""}>Solo skin</option>
          <option value="cases" ${this.inventoryType === "cases" ? "selected" : ""}>Solo casse</option>
        </select>
        <select id="sortFilter">
          <option value="newest" ${this.inventorySort === "newest" ? "selected" : ""}>Piu' recenti</option>
          <option value="value" ${this.inventorySort === "value" ? "selected" : ""}>Valore</option>
          <option value="rarity" ${this.inventorySort === "rarity" ? "selected" : ""}>Rarita'</option>
          <option value="float" ${this.inventorySort === "float" ? "selected" : ""}>Float basso</option>
        </select>
        <button class="ghost-button" data-action="sell-filtered" ${items.length ? "" : "disabled"}>Vendi filtrate (${formatCredits(filteredValue)})</button>
        <button class="ghost-button" data-action="select-page" ${pageItems.length ? "" : "disabled"}>Seleziona pagina</button>
        <button class="ghost-button" data-action="sell-selected" ${selectedItems.length ? "" : "disabled"}>Vendi selezione (${formatCredits(selectedValue)})</button>
        <button class="ghost-button" data-action="clear-selection" ${selectedItems.length ? "" : "disabled"}>Deseleziona</button>
        <button class="ghost-button" data-action="sell-consumer">Vendi low-tier</button>
      </div>
      <div class="inventory-summary">
        ${statTile("Skin filtrate", items.length, `${pageItems.length} visibili`)}
        ${statTile("Valore filtrato", formatCredits(filteredValue), `Totale ${formatCredits(getInventoryValue(this.state))}`)}
        ${statTile("Selezione", selectedItems.length, `${formatCredits(selectedValue)} vendibili`)}
        ${statTile("Pagina", `${this.inventoryPage}/${pages}`, `${INVENTORY_PAGE_SIZE} per pagina`)}
      </div>
      <div class="inventory-grid">
        ${pageItems.length ? pageItems.map((item) => itemCard(item, {
          withSell: true,
          selectable: true,
          selected: this.selectedInventory.has(item.id),
          state: this.state
        })).join("") : `<div class="empty-state">Nessuna skin in inventario.</div>`}
      </div>
      <div class="pager">
        <button class="ghost-button" data-action="page" data-page="${this.inventoryPage - 1}" ${this.inventoryPage <= 1 ? "disabled" : ""}>Precedente</button>
        <button class="ghost-button" data-action="page" data-page="${this.inventoryPage + 1}" ${this.inventoryPage >= pages ? "disabled" : ""}>Successiva</button>
      </div>
    `;
  }

  renderShop() {
    const grouped = UPGRADE_DEFINITIONS.reduce((map, upgrade) => {
      const branch = upgradeBranch(upgrade.id);
      map[branch] ||= [];
      map[branch].push(upgrade);
      return map;
    }, {});

    return `
      ${this.renderSectionTabs("shop")}
      <div class="upgrade-tree">
        ${Object.entries(grouped).map(([branch, upgrades]) => `
          <section class="upgrade-branch">
            <div class="branch-title">
              <span>${escapeHtml(branch)}</span>
              <strong>${upgrades.reduce((sum, upgrade) => sum + (this.state.upgrades[upgrade.id] || 0), 0)} livelli</strong>
            </div>
            <div class="branch-lane">
              ${upgrades.map((upgrade) => {
                const level = this.state.upgrades[upgrade.id] || 0;
                const maxed = level >= upgrade.maxLevel;
                const cost = getUpgradeCost(this.state, upgrade.id);
                return `
                  <article class="upgrade-card branch-node">
                    <div>
                      <span>${escapeHtml(upgrade.name)}</span>
                      <strong>Lv ${level}/${upgrade.maxLevel}</strong>
                      <p>${escapeHtml(upgrade.description)}</p>
                      <small>${upgradeEffectText(this.state, upgrade)}</small>
                    </div>
                    <div class="progress-line"><i style="width:${percent(level / upgrade.maxLevel)}"></i></div>
                    <button class="primary-button small" data-action="buy-upgrade" data-id="${upgrade.id}" ${maxed || this.state.credits < cost ? "disabled" : ""}>
                      ${maxed ? "Max" : formatCredits(cost)}
                    </button>
                  </article>
                `;
              }).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  renderStats() {
    const profit = this.state.stats.totalEarned + getInventoryValue(this.state) - this.state.stats.totalSpent;
    const best = this.state.stats.bestDrop;
    const topMastery = this.skinData.cases
      .map((caseDef) => ({ caseDef, mastery: getCaseMastery(this.state, caseDef.id) }))
      .filter(({ mastery }) => mastery.opens > 0)
      .sort((a, b) => b.mastery.level - a.mastery.level || b.mastery.opens - a.mastery.opens)
      .slice(0, 8);
    const maxMastery = topMastery[0]?.mastery.level || 0;
    const skill = getProfileSkillBonus(this.state);
    return `
      ${this.renderSectionTabs("stats")}
      <div class="stats-grid">
        ${statTile("Casse aperte", this.state.stats.casesOpened.toLocaleString("it-IT"), `${this.state.stats.manualOpens} manuali - ${this.state.stats.autoOpens} auto`)}
        ${statTile("Speso", formatCredits(this.state.stats.totalSpent), "casse + market")}
        ${statTile("Venduto", formatCredits(this.state.stats.totalEarned), "incassi skin")}
        ${statTile("Profit / Loss", `${profit >= 0 ? "+" : ""}${formatCredits(profit)}`, "include inventario")}
        ${statTile("Special", this.state.stats.jackpotHits, "knife/gloves/special")}
        ${statTile("Offline", formatCredits(this.state.stats.offlineEarned), "idle income")}
        ${statTile("Collezioni", this.state.stats.collections, `bonus x${getCollectionMultiplier(this.state).toFixed(2)}`)}
        ${statTile("Economia", formatCredits(this.state.stats.insuranceEarned || 0), `${this.state.stats.autoSold} auto-sell - ${this.state.stats.marketFlips} flip`)}
        ${statTile("Mastery casse", `Lv ${maxMastery}`, `${topMastery.length} casse allenate`)}
      </div>
      <div class="split-layout">
        <section class="data-panel">
          <h3>Skill profilo</h3>
          <div class="rarity-bars">
            <div class="rarity-row"><span>Fortuna</span><div><i style="width:${percent(skill.luck / 0.035)}"></i></div><strong>+${(skill.luck * 100).toFixed(1)}%</strong></div>
            <div class="rarity-row"><span>Fee vendita</span><div><i style="width:${percent(skill.sellFeeReduction / 0.025)}"></i></div><strong>-${(skill.sellFeeReduction * 100).toFixed(1)}%</strong></div>
            <div class="rarity-row"><span>Goal solo</span><div><i style="width:${percent(skill.goalDiscount / 0.1)}"></i></div><strong>-${(skill.goalDiscount * 100).toFixed(0)}%</strong></div>
            <div class="rarity-row"><span>Archivio</span><div><i style="width:${percent(Math.min(1, skill.collectionAssist / 5))}"></i></div><strong>+${skill.collectionAssist}</strong></div>
          </div>
        </section>
        <section class="data-panel">
          <h3>Conteggio rarita'</h3>
          <div class="rarity-bars">
            ${RARITY_ORDER.map((rarity) => {
              const count = this.state.stats.rarityCounts[rarity] || 0;
              const total = Math.max(1, this.state.stats.casesOpened);
              return `
                <div class="rarity-row" style="--rarity:${RARITIES[rarity].color}">
                  <span>${rarity}</span>
                  <div><i style="width:${Math.max(2, (count / total) * 100)}%"></i></div>
                  <strong>${count}</strong>
                </div>
              `;
            }).join("")}
          </div>
        </section>
        <section class="data-panel">
          <h3>Miglior drop</h3>
          ${best ? itemCard(best, { compact: false }) : `<div class="empty-state">Ancora nessun drop.</div>`}
        </section>
        <section class="data-panel">
          <h3>Mastery casse</h3>
          <div class="case-mastery-list">
            ${topMastery.length ? topMastery.map(({ caseDef, mastery }) => `
              <div class="case-mastery-row">
                <img src="${caseDef.image}" alt="${escapeHtml(caseDef.name)}" loading="lazy" />
                <div>
                  <strong>${escapeHtml(caseDef.name)}</strong>
                  <span>Lv ${mastery.level} - +${Math.round(mastery.luckBonus * 1000) / 10}% fortuna - ${mastery.opens} aperture</span>
                  <div class="progress-line"><i style="width:${percent(mastery.progress)}"></i></div>
                </div>
              </div>
            `).join("") : `<div class="empty-state">Apri una cassa per iniziare la mastery.</div>`}
          </div>
        </section>
      </div>
    `;
  }

  renderPrestige() {
    const netWorth = getNetWorth(this.state);
    const requirement = getPrestigeRequirement(this.state);
    const ready = canPrestige(this.state);
    const nextCases = this.skinData.cases
      .filter((caseDef) => caseDef.unlockPrestige > this.state.prestige.level)
      .sort((a, b) => a.unlockPrestige - b.unlockPrestige || a.name.localeCompare(b.name));
    return `
      ${this.renderSectionTabs("prestige")}
      <div class="prestige-panel">
        <div>
          <span>Prestige ${this.state.prestige.level}/${CASE_MAX_PRESTIGE_UNLOCK}</span>
          <h3>Bonus permanente x${getPrestigeMultiplier(this.state).toFixed(2)}</h3>
          <p>Resetta saldo, upgrade e inventario. Mantieni statistiche, achievement, livello profilo e ottieni shard permanenti.</p>
        </div>
        <button class="primary-button" data-action="prestige" ${ready ? "" : "disabled"}>Rebirth</button>
      </div>
      <div class="stats-grid">
        ${statTile("Net worth", formatCredits(netWorth), `Richiesto ${formatCredits(requirement)}`)}
        ${statTile("Casse aperte", this.state.stats.casesOpened, `minimo ${60 + this.state.prestige.level * 8}`)}
        ${statTile("Shard", this.state.prestige.shards, `${this.state.prestige.lifetimeShards || 0} lifetime`)}
        ${statTile("Reset", this.state.prestige.totalResets, "totali")}
      </div>
      <div class="prestige-tree">
        ${PRESTIGE_TREE.map((node) => {
          const level = getPrestigeNodeLevel(this.state, node.id);
          const cost = getPrestigeNodeCost(this.state, node.id);
          return `
            <article class="tree-node">
              <div>
                <span>${escapeHtml(node.branch)}</span>
                <strong>${escapeHtml(node.name)}</strong>
                <p>${escapeHtml(node.description)}</p>
                <small>Lv ${level}/${node.maxLevel}</small>
              </div>
              <button class="primary-button small" data-action="buy-prestige-node" data-id="${node.id}" ${level >= node.maxLevel || this.state.prestige.shards < cost ? "disabled" : ""}>
                ${level >= node.maxLevel ? "Max" : `${cost} shard`}
              </button>
            </article>
          `;
        }).join("")}
      </div>
      <div class="unlock-list">
        ${nextCases.length ? nextCases.map((caseDef) => `
          <div class="unlock-row">
            <img src="${caseDef.image}" alt="${escapeHtml(caseDef.name)}" loading="lazy" />
            <span>${escapeHtml(caseDef.name)}</span>
            <strong>P${caseDef.unlockPrestige}</strong>
          </div>
        `).join("") : `<div class="empty-state">Tutte le casse sono sbloccate.</div>`}
      </div>
    `;
  }

  renderAchievements() {
    return `
      ${this.renderSectionTabs("achievements")}
      <div class="achievement-grid">
        ${ACHIEVEMENTS.map((achievement) => {
          const progress = getAchievementProgress(this.state, achievement);
          const done = Boolean(this.state.achievements[achievement.id]?.completedAt);
          return `
            <article class="achievement-card ${done ? "is-done" : ""}">
              <div>
                <span>${escapeHtml(achievement.name)}</span>
                <strong>${Math.min(progress, achievement.target).toLocaleString("it-IT")} / ${achievement.target.toLocaleString("it-IT")}</strong>
                <p>${escapeHtml(achievement.description)}</p>
              </div>
              <div class="progress-line"><i style="width:${percent(Math.min(1, progress / achievement.target))}"></i></div>
              <small>${done ? "Completato" : `Reward ${formatCredits(achievement.reward)}`}</small>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  renderContracts() {
    const inputCount = getTradeUpInputCount(this.state);
    const counts = RARITY_ORDER.reduce((map, rarity) => {
      map[rarity] = this.state.inventory.filter((item) => item.rarity === rarity && !item.locked && !item.favorite).length;
      return map;
    }, {});
    const inputs = this.state.inventory
      .filter((item) => item.rarity === this.contractRarity && !item.locked && !item.favorite && item.type !== "rewardCase")
      .sort((a, b) => a.value - b.value)
      .slice(0, inputCount);
    const inputValue = inputs.reduce((sum, item) => sum + getSellReturn(this.state, item), 0);
    const rarityIndex = RARITY_ORDER.indexOf(this.contractRarity);
    const nextRarity = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, rarityIndex + 1)] || this.contractRarity;
    const previewPool = this.selectedCase.pool?.[nextRarity]?.length
      ? this.selectedCase.pool[nextRarity]
      : this.skinData.globalPool?.[nextRarity] || [];
    const previewSkin = previewPool[0];
    const canRun = (counts[this.contractRarity] || 0) >= inputCount;
    return `
      ${this.renderSectionTabs("inventory")}
      <div class="contracts-layout">
        <section class="contracts-inventory">
          <div class="contract-panel">
            <div>
              <h3>Inventario</h3>
            </div>
            <div class="contract-controls">
              <select id="contractRarity">
                ${RARITY_ORDER.slice(0, -1).map((rarity) => `<option value="${rarity}" ${this.contractRarity === rarity ? "selected" : ""}>${rarity} (${counts[rarity] || 0})</option>`).join("")}
              </select>
              <button class="primary-button" data-action="contract" ${canRun ? "" : "disabled"}>Completa contratto</button>
            </div>
          </div>
          <div class="contract-input-grid">
            ${inputs.length ? inputs.map((item) => itemCard(item, { compact: true })).join("") : `<div class="empty-state">Nessuna skin valida per questa rarita'.</div>`}
          </div>
        </section>
        <section class="contracts-result">
          <div class="contract-result-card">
            <h3>Skin risultante</h3>
            ${previewSkin ? `
              <article class="item-card compact rarity-${RARITIES[nextRarity]?.key || "unknown"}" style="--rarity:${RARITIES[nextRarity]?.color || "#ffd166"}">
                <div class="item-art"><img src="${previewSkin.image}" alt="${escapeHtml(previewSkin.name)}" loading="lazy" /></div>
                <div class="item-info">
                  <strong title="${escapeHtml(previewSkin.name)}">${escapeHtml(previewSkin.name)}</strong>
                  <span>${escapeHtml(nextRarity)}</span>
                </div>
                <div class="item-value">${formatCredits(inputValue * Math.max(1, ECONOMY_CONFIG.tradeUpFloor), true)}</div>
              </article>
            ` : `<div class="empty-state">Pool risultato non disponibile.</div>`}
            <div class="inventory-summary">
              ${statTile("Input", `${inputs.length}/${inputCount}`, formatCredits(inputValue, true))}
              ${statTile("Rarita'", nextRarity, this.selectedCase.name)}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  renderCollections() {
    const goals = getCollectionGoals(this.state, this.skinData);
    const visible = goals.slice(0, 36);
    return `
      ${this.renderSectionTabs("inventory")}
      <div class="collection-header">
        ${statTile("Bonus riscossi", this.state.stats.collections, `Power ${this.state.collections.power}`)}
        ${statTile("Moltiplicatore", `x${getCollectionMultiplier(this.state).toFixed(2)}`, "valore e reward")}
        ${statTile("Pronte", goals.filter((goal) => goal.ready).length, `${goals.length} collezioni tracciate`)}
      </div>
      <div class="collection-grid">
        ${visible.map((goal) => `
          <article class="collection-card ${goal.claimed ? "is-done" : ""} ${goal.ready ? "is-ready" : ""}">
            <div>
              <span>${goal.claimed ? "Completata" : goal.ready ? "Pronta" : "In corso"}</span>
              <strong>${escapeHtml(goal.name)}</strong>
              <p>${goal.effectiveOwned}/${goal.target} progressi (${goal.owned} skin${goal.assisted ? ` + ${goal.assisted} archivio` : ""}) - ${goal.total} nel pool</p>
            </div>
            <div class="progress-line"><i style="width:${percent(goal.progress)}"></i></div>
            <button class="primary-button small" data-action="claim-collection" data-name="${escapeHtml(goal.name)}" ${goal.ready ? "" : "disabled"}>
              ${goal.claimed ? "Riscosso" : formatCredits(goal.reward)}
            </button>
          </article>
        `).join("")}
      </div>
    `;
  }

  renderMarket() {
    const offers = refreshMarket(this.state, this.skinData, this.selectedCase);
    const trend = getMarketTrend(this.state);
    return `
      <div class="marketplace-page">
        <div class="marketplace-hero">
          <div>
            <span class="marketplace-kicker">${iconMarkup("store", "button-icon")} Marketplace</span>
            <h2>Marketplace</h2>
            <p>Offerte economy e mercato globale dei giocatori in un'unica area.</p>
          </div>
          <div class="social-chip-stack">
            ${statTile("Trend", `x${trend.multiplier.toFixed(2)}`, trend.name)}
            ${statTile("Refresh", compactTime(Math.max(0, this.state.market.lastRefreshAt + ECONOMY_CONFIG.marketplaceRefreshMs - Date.now())), "offerte economy")}
            ${statTile("Globali", this.sharedAuctions.filter((listing) => listing.status === "active").length, "inserzioni live")}
          </div>
        </div>
        <section class="marketplace-economy-card">
          <div class="social-card-head">
            <div>
              <span class="marketplace-kicker">${iconMarkup("candlestick-chart", "button-icon")} Offerte economy</span>
              <h3>Marketplace economy</h3>
            </div>
            <button class="ghost-button" data-action="refresh-market">Refresh offerte</button>
          </div>
          <div class="market-grid">
            ${offers.map((offer) => `
              <article class="market-card">
                ${itemCard(offer.item, { compact: true })}
                <div class="market-meta">
                  <span>Fair ${formatCredits(offer.fairValue, true)}</span>
                  <span class="${offer.edge >= 0 ? "positive" : "negative"}">${offer.edge >= 0 ? "+" : ""}${offer.edge}% edge</span>
                  <span>Bot ${offer.botInterest}%</span>
                </div>
                <button class="primary-button small" data-action="buy-offer" data-id="${offer.id}" ${this.state.credits < offer.price ? "disabled" : ""}>
                  Compra ${formatCredits(offer.price)}
                </button>
              </article>
            `).join("")}
          </div>
        </section>
        ${this.renderAuctionHouse()}
      </div>
    `;
  }

  getJackpotSelectionState() {
    const inventoryIds = new Set(this.state.inventory.map((item) => item.id));
    [...this.jackpotSelection].forEach((id) => {
      if (!inventoryIds.has(id)) {
        this.jackpotSelection.delete(id);
      }
    });
    const selectedItems = this.state.inventory.filter((item) => this.jackpotSelection.has(item.id) && !item.locked);
    const selectedTotal = selectedItems.reduce((sum, item) => sum + getSellReturn(this.state, item), 0);
    const availableItems = this.getFilteredGameInventory([...this.state.inventory]
      .filter((item) => !item.locked)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.value - a.value)
      .slice(0, 80), { allowCases: false, limit: 24 });
    return {
      availableItems,
      selectedItems,
      selectedTotal: Number(selectedTotal.toFixed(2))
    };
  }

  getCrashHistoryEntries(limit = 10) {
    return (this.state.minigames?.history || [])
      .filter((entry) => entry.game === "Crash")
      .slice(0, limit);
  }

  getSocialLockerCandidates() {
    return [...(this.state.inventory || [])]
      .filter((item) => !item.locked)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || Number(b.value || 0) - Number(a.value || 0))
      .slice(0, 500);
  }

  getFilteredGameInventory(items = this.getSocialLockerCandidates(), { allowCases = false, limit = 80 } = {}) {
    const query = String(this.gameInventorySearch || "").trim().toLowerCase();
    return [...items]
      .filter((item) => {
        const isCase = item.type === "rewardCase";
        if (!allowCases && isCase) {
          return false;
        }
        const activeType = allowCases ? this.gameInventoryType : "skins";
        const matchesType = activeType === "all" ||
          (activeType === "cases" && isCase) ||
          (activeType === "skins" && !isCase);
        const matchesRarity = this.gameInventoryRarity === "all" || item.rarity === this.gameInventoryRarity;
        const haystack = `${item.name || ""} ${item.rarity || ""} ${item.wear || ""} ${item.caseName || ""} ${isCase ? "cassa reward case" : "skin"}`.toLowerCase();
        return matchesType && matchesRarity && (!query || haystack.includes(query));
      })
      .slice(0, limit);
  }

  renderGameInventoryFilters({ allowCases = false } = {}) {
    return `
      <div class="game-inventory-filters">
        <input id="gameInventorySearch" type="search" value="${escapeHtml(this.gameInventorySearch)}" placeholder="Filtra inventario..." />
        <select id="gameInventoryRarity">
          <option value="all">Tutte le rarita'</option>
          ${RARITY_ORDER.map((rarity) => `<option value="${rarity}" ${this.gameInventoryRarity === rarity ? "selected" : ""}>${rarity}</option>`).join("")}
        </select>
        <select id="gameInventoryType">
          <option value="skins" ${this.gameInventoryType === "skins" ? "selected" : ""}>Skin</option>
          ${allowCases ? `<option value="cases" ${this.gameInventoryType === "cases" ? "selected" : ""}>Casse</option><option value="all" ${this.gameInventoryType === "all" ? "selected" : ""}>Tutto</option>` : ""}
        </select>
      </div>
    `;
  }

  getSelectedTradeTarget() {
    return (this.socialState?.players || []).find((player) => player.id === this.socialTradeTargetId) || null;
  }

  getJackpotPresencePlayers() {
    const players = Array.isArray(this.socialState?.players) ? this.socialState.players : [];
    const seen = new Set();
    const normalized = [];
    players.forEach((player) => {
      if (!player?.id || seen.has(player.id)) {
        return;
      }
      seen.add(player.id);
      normalized.push(player);
    });
    const currentId = this.socialConnection?.clientId || this.socialState?.currentPlayer?.id;
    if (this.socialConnection?.connected && currentId && !seen.has(currentId)) {
      normalized.unshift({
        id: currentId,
        name: this.state.profile?.name || this.socialState?.currentPlayer?.name || "Tu",
        accent: this.state.profile?.accent || this.socialState?.currentPlayer?.accent || "#7fe37c"
      });
    }
    return normalized;
  }

  getJackpotOpponents() {
    const currentId = this.socialConnection?.clientId || this.socialState?.currentPlayer?.id;
    const liveParticipants = Array.isArray(this.socialState?.jackpot?.participants)
      ? this.socialState.jackpot.participants
      : [];
    const liveOpponents = liveParticipants
      .filter((participant) => participant?.id && participant.id !== currentId)
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        accent: participant.accent,
        total: participant.total || participant.value,
        itemCount: participant.itemCount || participant.itemsCount || participant.entries?.length || participant.items?.length,
        entries: participant.entries,
        items: participant.items
      }));
    if (liveOpponents.length) {
      return liveOpponents;
    }
    return this.getJackpotPresencePlayers()
      .filter((player) => player.id !== currentId)
      .map((player) => ({
        id: player.id,
        name: player.name,
        accent: player.accent,
        itemCount: 1
      }));
  }

  getJackpotLobbies() {
    const netWorth = getNetWorth(this.state);
    return [
      {
        id: "low",
        name: "Low Tier",
        range: "fino a 25K",
        detail: "Lobby per nuovi player e inventari leggeri.",
        compatible: netWorth < 25000
      },
      {
        id: "mid",
        name: "Mid Tier",
        range: "25K - 150K",
        detail: "Matchmaking per progressione intermedia.",
        compatible: netWorth >= 25000 && netWorth < 150000
      },
      {
        id: "high",
        name: "High Tier",
        range: "150K+",
        detail: "Pot alti per profili endgame.",
        compatible: netWorth >= 150000
      }
    ];
  }

  getSelectedJackpotLobby() {
    const lobbies = this.getJackpotLobbies();
    return lobbies.find((lobby) => lobby.id === this.jackpotLobbyId) || null;
  }

  getSingleplayerGoals() {
    const masteryDone = this.skinData.cases.filter((caseDef) => getCaseMastery(this.state, caseDef.id).level >= 8).length;
    const unlockedCases = this.skinData.cases.filter((caseDef) => isCaseUnlocked(this.state, caseDef)).length;
    const goals = [
      {
        label: `Raggiungi Prestige ${CASE_MAX_PRESTIGE_UNLOCK}`,
        progress: clamp((this.state.prestige?.level || 0) / CASE_MAX_PRESTIGE_UNLOCK, 0, 1),
        detail: `P${this.state.prestige?.level || 0}/${CASE_MAX_PRESTIGE_UNLOCK}`
      },
      {
        label: "Sblocca tutte le casse",
        progress: clamp(unlockedCases / Math.max(1, this.skinData.cases.length), 0, 1),
        detail: `${unlockedCases}/${this.skinData.cases.length} casse`
      },
      {
        label: "Porta il net worth a 25.000",
        progress: clamp(getNetWorth(this.state) / 25000, 0, 1),
        detail: `${formatCredits(getNetWorth(this.state), true)} / ${formatCredits(25000, true)}`
      },
      {
        label: "Allena 8 casse fino a mastery 8",
        progress: clamp(masteryDone / 8, 0, 1),
        detail: `${masteryDone}/8 mastery`
      }
    ];
    return goals;
  }

  getEndgameTracks() {
    const unlockedCases = this.skinData.cases.filter((caseDef) => isCaseUnlocked(this.state, caseDef)).length;
    const soloProgress = (
      clamp((this.state.prestige?.level || 0) / CASE_MAX_PRESTIGE_UNLOCK, 0, 1) +
      clamp(unlockedCases / Math.max(1, this.skinData.cases.length), 0, 1) +
      clamp(getNetWorth(this.state) / 60000, 0, 1)
    ) / 3;
    const socialPlayer = this.socialState?.currentPlayer || {};
    const socialProgress = (
      clamp((socialPlayer.rankPoints || 0) / 6600, 0, 1) +
      clamp(((socialPlayer.marketSales || 0) + (socialPlayer.tradesCompleted || 0)) / 50, 0, 1) +
      clamp((socialPlayer.multiplayerWins || 0) / 60, 0, 1)
    ) / 3;
    return [
      {
        title: "Vault Master",
        progress: soloProgress,
        detail: `P${this.state.prestige?.level || 0}/${CASE_MAX_PRESTIGE_UNLOCK} · ${unlockedCases}/${this.skinData.cases.length} casse · ${formatCredits(getNetWorth(this.state), true)} / ${formatCredits(60000, true)}`,
        copy: `Chiudi il loop singleplayer arrivando a Prestige ${CASE_MAX_PRESTIGE_UNLOCK}, arsenale completo e net worth alto abbastanza da sostenere qualunque strategia.`
      },
      {
        title: "Global Network",
        progress: socialProgress,
        detail: `${socialPlayer.rankName || "Silver I"} · ${(socialPlayer.marketSales || 0) + (socialPlayer.tradesCompleted || 0)}/50 deal · ${socialPlayer.multiplayerWins || 0}/60 win`,
        copy: "Chiudi il loop multiplayer diventando Global Elite, un trader riconosciuto e un player che lascia traccia in jackpot e crash."
      }
    ];
  }

  renderGoalRows(goals) {
    return `
      <div class="goal-list">
        ${goals.map((goal) => `
          <div class="goal-row">
            <div class="goal-copy">
              <strong>${escapeHtml(goal.label)}</strong>
              <small>${escapeHtml(goal.detail)}</small>
            </div>
            <div class="progress-line"><i style="width:${percent(goal.progress)}"></i></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  renderGameModeTabs() {
    const modes = [
      ["roulette", "Roulette"],
      ["pachinko", "Pachinko"],
      ["upgrader", "Upgrader"],
      ["coinflip", "Coinflip"],
      ["crash", "Crash"],
      ["jackpot", "Jackpot"]
    ];
    return `
      <div class="workspace-tabs game-mode-tabs">
        ${modes.map(([id, label]) => `
          <button class="workspace-tab ${this.gamesView === id ? "is-active" : ""}" data-action="games-view" data-view="${id}">
            ${escapeHtml(label)}
          </button>
        `).join("")}
      </div>
    `;
  }

  renderSharedGameFeed(mode = "") {
    const rows = this.sharedGameEvents
      .filter((entry) => !mode || entry.mode === mode)
      .slice(0, 8);
    return `
      <section class="data-panel shared-game-feed">
        <h3>Live feed globale</h3>
        <div class="mini-game-history">
          ${rows.length ? rows.map((entry) => `
            <div class="game-history-row ${entry.profit >= 0 ? "is-win" : "is-loss"}">
              <span>${escapeHtml(entry.playerName)}</span>
              <strong>${escapeHtml(entry.game)} - ${escapeHtml(entry.detail || entry.outcome)}</strong>
              <em>${entry.profit >= 0 ? "+" : ""}${formatCredits(entry.profit, true)}</em>
            </div>
          `).join("") : `<div class="empty-state small">Nessun evento condiviso ancora. Se la tabella Supabase non e' creata, il feed resta vuoto.</div>`}
        </div>
      </section>
    `;
  }

  getUpgraderTargetPreview(selected, multiplier) {
    if (!selected) {
      return null;
    }
    const targetRarity = RARITY_ORDER.find((candidate) =>
      RARITIES[candidate].baseValue >= RARITIES[selected.rarity].baseValue * Math.min(4, multiplier)
    ) || selected.rarity;
    const pool = this.skinData.globalPool?.[targetRarity]?.length
      ? this.skinData.globalPool[targetRarity]
      : this.skinData.skins.filter((skin) => skin.rarity === targetRarity);
    const seed = [...String(selected.id || selected.name)].reduce((sum, char) => sum + char.charCodeAt(0), 0) + Math.round(multiplier * 100);
    const skin = pool[seed % Math.max(1, pool.length)] || pool[0] || selected;
    return {
      ...skin,
      rarity: targetRarity,
      rarityColor: RARITIES[targetRarity].color,
      value: Number((selected.value * multiplier).toFixed(2))
    };
  }

  renderUpgraderGame() {
    const candidates = this.getFilteredGameInventory(this.getSocialLockerCandidates(), { allowCases: false, limit: 80 });
    const candidateIds = new Set(candidates.map((item) => item.id));
    [...this.upgraderSelection].forEach((id) => {
      if (!candidateIds.has(id) && !this.state.inventory.some((item) => item.id === id)) {
        this.upgraderSelection.delete(id);
      }
    });
    const selectedItems = this.state.inventory.filter((item) => this.upgraderSelection.has(item.id) && !item.locked && item.type !== "rewardCase");
    const selectedTotal = Number(selectedItems.reduce((sum, item) => sum + getSellReturn(this.state, item), 0).toFixed(2));
    const selected = selectedItems
      .slice()
      .sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.value - a.value)[0] || null;
    const effectiveSelectedItems = this.state.inventory.filter((item) => this.upgraderSelection.has(item.id) && !item.locked && item.type !== "rewardCase");
    const effectiveTotal = Number(effectiveSelectedItems.reduce((sum, item) => sum + getSellReturn(this.state, item), 0).toFixed(2));
    const primarySelected = effectiveSelectedItems
      .slice()
      .sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.value - a.value)[0] || selected;
    const multiplier = Math.max(1.25, Math.min(12, Number(this.state.minigames.upgrader?.targetMultiplier || 2)));
    const chance = Math.max(6, Math.min(72, (92 / multiplier) * (1 + getProfileSkillBonus(this.state).luck * 1.6)));
    const target = this.getUpgraderTargetPreview(primarySelected ? { ...primarySelected, value: effectiveTotal || primarySelected.value } : null, multiplier);
    const animation = this.upgraderAnimation;
    return `
      <article class="game-card full-width upgrader-card">
        <div class="social-card-head">
          <div>
            <span>${iconMarkup("arrow-up-circle", "button-icon")} Upgrader</span>
            <h3>Upgrader</h3>
          </div>
          <div class="social-chip-stack">
            ${statTile("Chance", `${chance.toFixed(1)}%`, `x${multiplier.toFixed(2)}`)}
            ${statTile("Input", formatCredits(effectiveTotal || 0, true), `${effectiveSelectedItems.length} skin`)}
            ${statTile("Target", effectiveTotal ? formatCredits(effectiveTotal * multiplier, true) : "-", "valore stimato")}
          </div>
        </div>
        <div class="upgrader-layout">
          <section class="upgrader-inventory-panel">
            <div class="social-card-head compact-head">
              <div>
                <h3>Inventario</h3>
              </div>
            </div>
            ${this.renderGameInventoryFilters()}
            <div class="upgrade-item-grid">
              ${candidates.length ? candidates.map((item) => `
                <button class="upgrade-item-card ${this.upgraderSelection.has(item.id) ? "is-selected" : ""}" data-action="select-upgrader-item" data-id="${item.id}" style="--rarity:${item.rarityColor}">
                  <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
                  <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
                  <span>${formatCredits(item.value, true)}</span>
                </button>
              `).join("") : `<div class="empty-state">Serve almeno una skin non bloccata.</div>`}
            </div>
          </section>
          <section class="upgrader-target-panel">
            <div class="upgrader-stage ${animation?.spinning ? "is-upgrading" : ""} ${animation && !animation.spinning ? (animation.won ? "is-win" : "is-loss") : ""}">
              <div class="upgrade-side">
                <span>Input</span>
                ${effectiveSelectedItems.length ? `
                  <div class="upgrader-selected-stack">
                    ${(animation?.consumedItems || effectiveSelectedItems).slice(0, 4).map((item) => itemCard(item, { compact: true })).join("")}
                    ${effectiveSelectedItems.length > 4 ? `<small>+${effectiveSelectedItems.length - 4} altre skin</small>` : ""}
                  </div>
                ` : `<div class="empty-state small">Nessuna skin</div>`}
              </div>
              <div class="upgrade-core">
                <div class="upgrade-energy">${iconMarkup("sparkles")}</div>
                <strong>${animation?.spinning ? "Upgrade in corso" : animation ? (animation.won ? "Upgrade riuscito" : "Skin bruciata") : `${chance.toFixed(1)}%`}</strong>
                <small>x${multiplier.toFixed(2)}</small>
              </div>
              <div class="upgrade-side">
                <span>Possibile premio</span>
                ${target ? `
                  <article class="item-card compact ${rarityClass(target.rarity)}" style="--rarity:${target.rarityColor}">
                    <div class="item-art"><img src="${target.image}" alt="${escapeHtml(target.name)}" loading="lazy" /></div>
                    <div class="item-info">
                      <strong title="${escapeHtml(target.name)}">${escapeHtml(target.name)}</strong>
                      <span>${escapeHtml(target.rarity)}</span>
                    </div>
                    <div class="item-value">${formatCredits(target.value, true)}</div>
                  </article>
                ` : `<div class="empty-state small">Scegli una skin</div>`}
              </div>
            </div>
            <div class="game-controls social-inline-controls upgrader-controls">
              <label class="field-inline">
                <span>Moltiplicatore</span>
                <input id="upgraderMultiplier" type="range" min="1.25" max="12" step="0.25" value="${multiplier}" />
                <strong>x${multiplier.toFixed(2)}</strong>
              </label>
              <button class="ghost-button" data-action="clear-upgrader-selection" ${effectiveSelectedItems.length && !animation?.spinning ? "" : "disabled"}>${iconMarkup("eraser", "button-icon")} Pulisci</button>
              <button class="primary-button" data-action="play-upgrader" ${effectiveSelectedItems.length && !animation?.spinning ? "" : "disabled"}>${iconMarkup("sparkles", "button-icon")} Upgrade</button>
            </div>
          </section>
        </div>
      </article>
      ${this.renderSharedGameFeed("upgrader")}
    `;
  }

  renderCoinflipGame() {
    const coin = this.state.minigames.coinflip || {};
    const animation = this.coinflipAnimation;
    const coinDelay = animation?.spinning ? -Math.min(Date.now() - (animation.startedAt || Date.now()), animation.durationMs || 1500) : 0;
    const coinFinalRotation = animation?.outcome === "t" ? 180 : 0;
    return `
      <article class="game-card full-width coinflip-card">
        <div class="social-card-head">
          <div>
            <span>${iconMarkup("coins", "button-icon")} Coinflip</span>
            <h3>Coinflip</h3>
          </div>
          <div class="social-chip-stack">
            ${statTile("Puntata", formatCredits(coin.bet || 4), "crediti")}
            ${statTile("Scelta", (coin.side || "ct").toUpperCase(), "lato")}
          </div>
        </div>
        <div class="coinflip-stage ${animation?.spinning ? "is-flipping" : ""} ${animation && !animation.spinning ? (animation.playerWon ? "is-win" : "is-loss") : ""}" style="--anim-delay:${coinDelay}ms; --coinflip-final:${coinFinalRotation}deg;">
          <div class="coinflip-coin">
            <span>CT</span>
            <span>T</span>
          </div>
          <div class="coinflip-readout">
            <strong>${animation?.spinning ? "In aria..." : animation ? `${String(animation.outcome || "").toUpperCase()} vince` : "Pronto"}</strong>
            <small>${animation && !animation.spinning ? `${animation.profit >= 0 ? "+" : ""}${formatCredits(animation.profit)}` : "Round condiviso nel feed globale"}</small>
          </div>
        </div>
        <div class="game-controls social-inline-controls">
          <input id="coinflipBet" type="text" inputmode="decimal" value="${escapeHtml(coin.bet || 4)}" />
          <div class="coin-side-buttons" role="group" aria-label="Lato coinflip">
            <button class="coin-side-button ${coin.side === "t" ? "is-active" : ""}" data-action="set-coinflip-side" data-side="t" type="button">T</button>
            <button class="coin-side-button ${coin.side !== "t" ? "is-active" : ""}" data-action="set-coinflip-side" data-side="ct" type="button">CT</button>
          </div>
          <button class="primary-button" data-action="play-coinflip" ${animation?.spinning ? "disabled" : ""}>${iconMarkup("rotate-3d", "button-icon")} Lancia</button>
        </div>
      </article>
      ${this.renderSharedGameFeed("coinflip")}
    `;
  }

  renderAuctionHouse() {
    const items = this.getFilteredGameInventory(this.getSocialLockerCandidates(), { allowCases: false, limit: 80 });
    const selected = items.find((item) => item.id === this.auctionItemId) || items[0];
    const fair = selected ? getSellReturn(this.state, selected) : 0;
    const localListings = this.state.auctions?.listings || [];
    const activeLocalListings = localListings.filter((listing) => listing.status === "active").length;
    const sharedListings = this.sharedAuctions.filter((listing) => listing.status === "active").slice(0, 24);
    const canPublish = Boolean(selected) && activeLocalListings < 5;
    return `
      <article class="game-card full-width auction-card">
        <div class="social-card-head">
          <div>
            <span>${iconMarkup("store", "button-icon")} Marketplace</span>
            <h3>Marketplace globale</h3>
            <p>Scegli una skin, imposta liberamente il prezzo e pubblicala nel mercato globale. Puoi tenere massimo 5 item attivi alla volta.</p>
          </div>
          <div class="social-chip-stack">
            ${statTile("Prezzo", selected ? formatCredits(fair, true) : "-", "riferimento skin")}
            ${statTile("Fee", `${Math.round((0.09 - getProfileSkillBonus(this.state).auctionFeeReduction) * 100)}%`, "ridotta dai livelli")}
            ${statTile("Attive", `${activeLocalListings}/5`, `${sharedListings.length} live`)}
          </div>
        </div>
        <div class="auction-layout">
          <section class="auction-inventory-panel">
            <div class="social-card-head compact-head">
              <div>
                <h3>Metti sul Marketplace</h3>
              </div>
            </div>
            ${this.renderGameInventoryFilters()}
            <div class="upgrade-item-grid auction-item-grid">
              ${items.length ? items.map((item) => `
                <button class="upgrade-item-card ${item.id === selected?.id ? "is-selected" : ""}" data-action="select-auction-item" data-id="${item.id}" style="--rarity:${item.rarityColor}">
                  <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
                  <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
                  <span>${formatCredits(item.value, true)}</span>
                </button>
              `).join("") : `<div class="empty-state">Nessuna skin disponibile.</div>`}
            </div>
            <div class="game-controls social-inline-controls auction-create-controls">
              <input id="auctionPrice" type="text" inputmode="decimal" value="${escapeHtml(this.auctionPrice || (fair ? fair.toFixed(2) : ""))}" placeholder="Prezzo" />
              <button class="primary-button" data-action="create-auction" ${canPublish ? "" : "disabled"}>${iconMarkup("plus", "button-icon")} Pubblica</button>
            </div>
          </section>
          <section class="auction-live-panel">
            <div class="social-card-head compact-head">
              <div>
                <span>Inserzioni attive</span>
                <h3>Compra</h3>
              </div>
            </div>
            <div class="auction-list-grid">
              ${sharedListings.length ? sharedListings.map((listing) => `
                <article class="auction-listing-card" style="--rarity:${listing.item?.rarityColor || "#ffd166"}">
                  <img src="${listing.item?.image || ""}" alt="${escapeHtml(listing.item?.name || "Skin")}" loading="lazy" />
                  <div>
                    <strong title="${escapeHtml(listing.item?.name || "Skin")}">${escapeHtml(listing.item?.name || "Skin")}</strong>
                    <small>${escapeHtml(listing.sellerName)} · ${escapeHtml(listing.item?.rarity || "")}</small>
                  </div>
                  <em>${formatCredits(listing.price, true)}</em>
                  <button class="ghost-button tiny" data-action="buy-shared-auction" data-id="${listing.id}" ${this.state.credits >= listing.price ? "" : "disabled"}>Compra</button>
                </article>
              `).join("") : `<div class="empty-state small">Nessuna inserzione globale attiva.</div>`}
            </div>
          </section>
        </div>
        <div class="mini-game-history">
          ${localListings.length ? localListings.slice(0, 6).map((listing) => `
            <div class="game-history-row ${listing.status === "sold" ? "is-win" : ""}">
              <span>${escapeHtml(listing.status)}</span>
              <strong>${escapeHtml(listing.item.name)}</strong>
              <em>${formatCredits(listing.price, true)}</em>
              <button class="ghost-button tiny" data-action="settle-auction" data-id="${listing.id}" ${listing.status === "active" ? "" : "disabled"}>Simula vendita</button>
            </div>
          `).join("") : `<div class="empty-state small">Nessuna inserzione locale creata.</div>`}
        </div>
      </article>
    `;
  }

  renderRouletteGame() {
    const minigames = this.state.minigames || {};
    const rouletteChoice = minigames.roulette?.choice || "red";
    const rouletteBet = minigames.roulette?.bet || 4;
    const roulette = this.rouletteAnimation;
    const rouletteProfit = roulette ? roulette.payout - roulette.bet : 0;
    const outcome = Math.max(0, Math.min(36, Number(roulette?.outcome || 0)));
    const rouletteCellWidth = 58;
    const rouletteTargetCycle = 5;
    const rouletteTargetIndex = rouletteTargetCycle * 37 + outcome;
    const rouletteOffset = roulette ? -(rouletteTargetIndex * rouletteCellWidth) : -(rouletteTargetCycle * 37 * rouletteCellWidth);
    const strip = Array.from({ length: 37 * 9 }, (_, index) => index % 37);
    const rouletteDelay = roulette?.spinning ? -Math.min(Date.now() - (roulette.startedAt || Date.now()), (roulette.durationMs || 2200) - 120) : 0;
    return `
      <article class="game-card full-width roulette-card modern-roulette-card">
        <div class="social-card-head">
          <div>
            <span>${iconMarkup("circle-dot", "button-icon")} Roulette</span>
            <h3>Roulette</h3>
          </div>
          <div class="social-chip-stack">
            ${statTile("Puntata", formatCredits(rouletteBet), "crediti")}
            ${statTile("Scelta", rouletteChoice, "target")}
            ${statTile("Rete", this.sharedGamesStatus.replace("Sync giochi ", ""), "globale")}
          </div>
        </div>
        <div class="roulette-modern-visual ${roulette?.spinning ? "is-spinning" : ""}" style="--roulette-offset:${rouletteOffset}px; --roulette-start-offset:${rouletteOffset + rouletteCellWidth * 26}px; --anim-delay:${rouletteDelay}ms;">
          <div class="roulette-scanline"></div>
          <div class="roulette-number-strip">
            ${strip.map((number) => {
              const type = number === 0 ? "green" : ROULETTE_RED_NUMBERS.has(number) ? "red" : "black";
              return `<span class="${type}">${number}</span>`;
            }).join("")}
          </div>
          <div class="roulette-modern-readout">
            <strong>${roulette?.spinning ? "Scanning..." : roulette ? escapeHtml(roulette.detail) : "Pronto"}</strong>
            <small>${roulette?.spinning ? "reveal in corso" : roulette ? `${rouletteProfit >= 0 ? "+" : ""}${formatCredits(rouletteProfit)}` : "scegli target e gira"}</small>
          </div>
        </div>
        <div class="game-controls social-inline-controls">
          <input id="rouletteBet" type="text" inputmode="decimal" value="${escapeHtml(rouletteBet)}" />
          <select id="rouletteChoice">
            ${[
              ["red", "Rosso x2"],
              ["black", "Nero x2"],
              ["green", "Verde x35"]
            ].map(([value, label]) => `<option value="${value}" ${rouletteChoice === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <button class="primary-button" data-action="play-roulette" ${roulette?.spinning ? "disabled" : ""}>Gira</button>
          <button class="ghost-button" data-action="toggle-roulette-autoplay">Auto attivo</button>
        </div>
      </article>
      ${this.renderSharedGameFeed("roulette")}
    `;
  }

  renderPachinkoGame() {
    const minigames = this.state.minigames || {};
    const pachinkoBet = minigames.pachinko?.bet || 4;
    const pachinko = this.pachinkoAnimation;
    const pachinkoProfit = pachinko ? pachinko.payout - pachinko.bet : 0;
    const pachinkoDelay = pachinko?.spinning ? -Math.min(Date.now() - (pachinko.startedAt || Date.now()), pachinko.durationMs || 2600) : 0;
    const binIndex = Math.max(0, Math.min(8, Number(pachinko?.binIndex ?? 4)));
    const landingLeft = 10 + binIndex * 10;
    const pathSteps = String(pachinko?.path || "").split("");
    let pathOffset = 0;
    const pathNodes = pathSteps.map((step, index) => {
      pathOffset += step === "R" ? 1 : -1;
      const left = 50 + pathOffset * 4.6;
      const top = 14 + index * 8.5;
      return `<i style="--step:${index}; --x:${left}%; --y:${top}%"></i>`;
    }).join("");
    const pegRows = Array.from({ length: 9 }, (_, row) => `
      <div class="plinko-peg-row" style="--row:${row}">
        ${Array.from({ length: row + 3 }, (_, peg) => `<i style="--peg:${peg}"></i>`).join("")}
      </div>
    `).join("");
    const bins = pachinko?.bins || [
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
    return `
      <article class="game-card full-width pachinko-card">
        <div class="social-card-head">
          <div>
            <span>${iconMarkup("waypoints", "button-icon")} Pachinko</span>
            <h3>Pachinko</h3>
          </div>
          <div class="social-chip-stack">
            ${statTile("Puntata", formatCredits(pachinkoBet), "crediti")}
            ${statTile("Ultimo", pachinko ? pachinko.label : "-", pachinko ? `${pachinkoProfit >= 0 ? "+" : ""}${formatCredits(pachinkoProfit, true)}` : "nessun drop")}
          </div>
        </div>
        <div class="pachinko-classic-board plinko-board ${pachinko?.spinning ? "is-dropping" : ""}" style="--chip-left:${landingLeft}%; --anim-delay:${pachinkoDelay}ms;">
          <div class="plinko-drop-slot"></div>
          <div class="plinko-path">${pathNodes}</div>
          <div class="pachinko-peg-field plinko-peg-field">${pegRows}</div>
          ${pachinko ? `<div class="pachinko-chip plinko-chip"><span></span></div>` : ""}
          <div class="pachinko-result plinko-result">
            <span>${pachinko?.spinning ? "Caduta..." : pachinko ? `${escapeHtml(pachinko.label)} x${Number(pachinko.outcome || 0).toFixed(2)}` : "Pronto"}</span>
            <strong>${pachinko?.spinning ? "..." : pachinko ? `${pachinkoProfit >= 0 ? "+" : ""}${formatCredits(pachinkoProfit)}` : "0"}</strong>
          </div>
          <div class="pachinko-bins plinko-bins">
            ${bins.map((bin, index) => `
              <span class="${index === binIndex && pachinko && !pachinko.spinning ? "is-hit" : ""}">
                <strong>x${Number(bin.multiplier).toFixed(Number(bin.multiplier) % 1 ? 1 : 0)}</strong>
                <small>${escapeHtml(bin.label)}</small>
              </span>
            `).join("")}
          </div>
        </div>
        <div class="game-controls social-inline-controls pachinko-controls">
          <input id="pachinkoBet" type="text" inputmode="decimal" value="${escapeHtml(pachinkoBet)}" />
          <button class="primary-button" data-action="play-pachinko" ${pachinko?.spinning ? "disabled" : ""}>Lancia pallina</button>
        </div>
      </article>
      ${this.renderSharedGameFeed("pachinko")}
    `;
  }

  renderGames() {
    const gameNav = this.renderGameModeTabs();
    if (this.gamesView === "roulette") {
      return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderRouletteGame()}</div>`;
    }
    if (this.gamesView === "pachinko") {
      return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderPachinkoGame()}</div>`;
    }
    if (this.gamesView === "upgrader") {
      return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderUpgraderGame()}</div>`;
    }
    if (this.gamesView === "coinflip") {
      return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderCoinflipGame()}</div>`;
    }
    if (this.gamesView === "crash") {
      return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderMultiplayerCrash()}</div>`;
    }
    if (this.gamesView === "jackpot") {
      return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderMultiplayerJackpot()}</div>`;
    }
    return `${this.renderSectionTabs("games")}<div class="games-shell">${gameNav}${this.renderRouletteGame()}</div>`;
  }

  renderMultiplayerSummaryHeader() {
    const minigames = this.state.minigames || {};
    const social = this.socialState || {};
    const onlinePlayers = Array.isArray(social.players) ? social.players : [];
    const liveJackpot = social.jackpot || null;
    const marketListings = Array.isArray(social.market?.listings) ? social.market.listings : [];
    const socialConnected = Boolean(this.socialConnection?.connected);
    const currentPlayer = social.currentPlayer || null;
    return `
      <div class="games-header">
        ${statTile("Hub", socialConnected ? "Live" : "Offline", socialConnected ? `${onlinePlayers.length} operatori` : (this.socialConnection?.error || "retry"))}
        ${statTile("Rank", currentPlayer?.rankName || "Unranked", currentPlayer ? `${currentPlayer.rankPoints} pt` : "in attesa")}
        ${statTile("Jackpot live", formatCredits(liveJackpot?.potValue || 0, true), `${liveJackpot?.participants?.length || 0} ticket`)}
        ${statTile("Market live", marketListings.length, "inserzioni")}
        ${statTile("Soft cap", formatCredits(Math.max(0, ECONOMY_CONFIG.minigameDailySoftCap - (minigames.dailyEarned || 0))), "profit pieno rimasto")}
      </div>
    `;
  }

  renderMultiplayer() {
    const current = TAB_GROUPS.multiplayer.includes(this.activeTab) ? this.activeTab : "multiplayer";
    const renderers = {
      multiplayer: () => this.renderMultiplayerHub(),
      multiplayerCrash: () => this.renderMultiplayerCrash(),
      multiplayerJackpot: () => this.renderMultiplayerJackpot(),
      multiplayerMarket: () => this.renderMultiplayerMarket(),
      multiplayerTrades: () => this.renderMultiplayerTrades(),
      multiplayerLeaderboard: () => this.renderMultiplayerLeaderboard(),
      multiplayerHistory: () => this.renderMultiplayerHistory()
    };
    return `
      ${this.renderSectionTabs("multiplayer")}
      <div class="games-shell multiplayer-shell">
        ${this.renderMultiplayerSummaryHeader()}
        ${renderers[current]?.() || renderers.multiplayer()}
      </div>
    `;
  }

  renderMultiplayerHub() {
    const social = this.socialState || {};
    const onlinePlayers = Array.isArray(social.players) ? social.players : [];
    const socialActivities = Array.isArray(social.activities) ? social.activities : [];
    const liveJackpot = social.jackpot || null;
    const marketListings = Array.isArray(social.market?.listings) ? social.market.listings : [];
    const socialConnected = Boolean(this.socialConnection?.connected);
    const currentPlayer = social.currentPlayer || null;
    const multiplayerGoals = Array.isArray(social.goals) ? social.goals : [];
    const singleplayerGoals = this.getSingleplayerGoals();
    const endgameTracks = this.getEndgameTracks();
    return `
      <div class="games-grid games-grid-social">
        <article class="game-card social-hero">
          <div>
            <span>${iconMarkup("trophy", "button-icon")} Hub multiplayer</span>
            <h3>Economia condivisa, rank e progressione stagione</h3>
            <p>Questo e' il ponte tra clicker e multiplayer: tieni viva la progressione locale, ma giochi un endgame sociale fatto di rank, market, trade e obiettivi di stagione.</p>
          </div>
          <div class="social-hero-pills">
            <span>${socialConnected ? "Hub live" : "Hub offline"}</span>
            <span>${onlinePlayers.length} operatori</span>
            <span>${marketListings.length} inserzioni market</span>
            <span>${liveJackpot?.participants?.length || 0} nel pot</span>
          </div>
        </article>
        <article class="game-card social-card">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("swords", "button-icon")} Goal singleplayer</span>
              <h3>Perche' continuare ad aprire casse</h3>
              <p>Il loop locale punta a costruire un arsenale, sbloccare tutte le casse e alzare il profilo fino a diventare una macchina da drop.</p>
            </div>
            <div class="social-chip-stack">
              ${statTile("Prestige", `P${this.state.prestige?.level || 0}`, `${this.state.stats.casesOpened || 0} aperture`)}
              ${statTile("Net worth", formatCredits(getNetWorth(this.state), true), "progressione locale")}
            </div>
          </div>
          ${this.renderGoalRows(singleplayerGoals)}
        </article>
        <article class="game-card social-card">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("medal", "button-icon")} Goal multiplayer</span>
              <h3>Perche' salire di rank</h3>
              <p>La parte social ha un obiettivo chiaro: arrivare a Global Elite, dominare il market e costruire reputazione nelle trade.</p>
            </div>
            <div class="social-chip-stack">
              ${statTile("Rank", currentPlayer?.rankName || "Silver I", currentPlayer ? `${currentPlayer.rankPoints} pt` : "sync")}
              ${statTile("Record", currentPlayer ? `${currentPlayer.multiplayerWins || 0}W` : "0W", currentPlayer ? `${currentPlayer.multiplayerLosses || 0}L` : "0L")}
            </div>
          </div>
          ${this.renderGoalRows(multiplayerGoals.length ? multiplayerGoals : [{ label: "Attendi sync multiplayer", progress: 0, detail: "Connetti l'hub per vedere i goal." }])}
        </article>
        <article class="game-card social-card endgame-card">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("flag", "button-icon")} Endgame</span>
              <h3>Due binari, una progressione coerente</h3>
              <p>Il singleplayer ti costruisce il capitale e le skin giuste. Il multiplayer ti chiede reputazione, costanza e gestione pulita del rischio.</p>
            </div>
          </div>
          <div class="endgame-track-list">
            ${endgameTracks.map((track) => `
              <div class="endgame-track">
                <div class="goal-copy">
                  <strong>${escapeHtml(track.title)}</strong>
                  <small>${escapeHtml(track.copy)}</small>
                </div>
                <div class="progress-line"><i style="width:${percent(track.progress)}"></i></div>
                <span class="hint">${escapeHtml(track.detail)}</span>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="game-card social-live-panel">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("radio", "button-icon")} Stato rete</span>
              <h3>Presenza, piatti live e feed</h3>
              <p>Chat, marketplace, leaderboard e trade stanno sopra questo hub condiviso. L'idea e' dare peso al multiplayer senza spaccare il clicker.</p>
            </div>
            <div class="social-chip-stack">
              ${statTile("Trasporto", social.transport || "sse", socialConnected ? "connesso" : "retry")}
              ${statTile("Client", this.socialConnection?.clientId ? this.socialConnection.clientId.slice(0, 6) : "-", socialConnected ? "sessione live" : (this.socialConnection?.error || "in attesa"))}
            </div>
          </div>
          <div class="social-live-grid">
            <section class="social-subpanel">
              <div class="social-subhead">
                <strong>Operatori live</strong>
                <small>${onlinePlayers.length} presenti</small>
              </div>
              <div class="social-presence-list">
                ${onlinePlayers.length
                  ? onlinePlayers.slice(0, 8).map((player) => `
                    <div class="presence-pill" style="--player-accent:${player.accent || "#7fe37c"}">
                      <b class="presence-icon">${iconMarkup(player.avatarIcon || "shield")}</b>
                      <span>${escapeHtml(player.name)}</span>
                      <small>P${player.prestige || 0} · Lv ${player.level || 1}</small>
                    </div>
                  `).join("")
                  : `<div class="empty-state small">Ancora nessun operatore live.</div>`}
              </div>
            </section>
            <section class="social-subpanel">
              <div class="social-subhead">
                <strong>Jackpot live</strong>
                <small>${liveJackpot?.status || "open"}</small>
              </div>
              ${liveJackpot ? `
                <div class="live-jackpot-card">
                  <div class="live-jackpot-top">
                    <strong>${formatCredits(liveJackpot.potValue || 0, true)}</strong>
                    <small>${liveJackpot.participants?.length || 0} partecipanti · ${liveJackpot.phaseLabel || "pot in corso"}</small>
                  </div>
                  <div class="jackpot-pot-list">
                    ${(liveJackpot.participants || []).slice(0, 6).map((participant) => `
                      <div class="jackpot-pot-row" style="--player-accent:${participant.accent || "#64d7e3"}">
                        <span>${escapeHtml(participant.name)}</span>
                        <div><i style="width:${Math.max(6, (participant.total / Math.max(1, liveJackpot.potValue || 1)) * 100)}%"></i></div>
                        <strong>${formatCredits(participant.total, true)}</strong>
                      </div>
                    `).join("")}
                  </div>
                </div>
              ` : `<div class="empty-state small">Pot non disponibile.</div>`}
            </section>
            <section class="social-subpanel">
              <div class="social-subhead">
                <strong>Marketplace live</strong>
                <small>${marketListings.length} inserzioni</small>
              </div>
              <div class="social-live-list">
                ${marketListings.length
                  ? marketListings.slice(0, 5).map((listing) => `
                    <div class="social-live-row">
                      <div>
                        <strong>${escapeHtml(listing.item?.name || "Skin")}</strong>
                        <small>${escapeHtml(listing.sellerName || "Player")} · ${escapeHtml(listing.item?.rarity || "Rarity")}</small>
                      </div>
                      <em>${formatCredits(listing.price || 0, true)}</em>
                    </div>
                  `).join("")
                  : `<div class="empty-state small">Nessuna inserzione live.</div>`}
              </div>
            </section>
            <section class="social-subpanel">
              <div class="social-subhead">
                <strong>Feed live</strong>
                <small>${socialActivities.length} eventi</small>
              </div>
              <div class="social-activity-list">
                ${socialActivities.length
                  ? socialActivities.slice(0, 8).map((entry) => `
                    <div class="social-activity-row ${entry.value > 0 ? "is-positive" : entry.value < 0 ? "is-negative" : ""}">
                      <span>${escapeHtml(entry.actorName || "Lobby")}</span>
                      <strong>${escapeHtml(entry.title || entry.type || "Evento")}</strong>
                      <small>${escapeHtml(entry.detail || "")}</small>
                      <em>${entry.value === null || entry.value === undefined ? "" : `${entry.value >= 0 ? "+" : ""}${formatCredits(entry.value, true)}`}</em>
                    </div>
                  `).join("")
                  : `<div class="empty-state small">Il feed si anima appena arrivano eventi live.</div>`}
              </div>
            </section>
          </div>
        </article>
      </div>
    `;
  }

  renderMultiplayerCrash() {
    const minigames = this.state.minigames || {};
    const crashBet = minigames.crash?.bet ?? 4;
    const crashAutoCashout = minigames.crash?.autoCashout ?? 1.6;
    const roundDelay = minigames.crash?.roundDelay ?? 6;
    const crash = this.crashAnimation;
    const displayPoint = Number(crash?.displayPoint || 1);
    const crashProfit = crash?.resolvedResult ? crash.resolvedResult.profit : 0;
    const crashProgress = crash
      ? clamp(Math.log(Math.max(1.0001, displayPoint)) / Math.log(Math.max(1.08, crash.crashPoint || 1.08)), 0, 1)
      : 0;
    const recentHistory = this.getCrashHistoryEntries(18);
    const showCashout = crash?.spinning && !crash?.cashedOutAt;
    const countdownMs = Math.max(0, (this.crashNextRoundAt || 0) - Date.now());
    const logRows = this.crashBetLog.slice(0, 9);
    const playerRows = [
      {
        name: this.state.profile?.name || "Tu",
        bet: Number(crash?.bet || crashBet || 0),
        multiplier: crash?.cashedOutAt || (crash?.spinning ? displayPoint : crash?.resolvedResult?.cashoutPoint || null),
        profit: crash?.spinning && !crash?.cashedOutAt ? null : crashProfit,
        live: Boolean(crash?.spinning && !crash?.cashedOutAt),
        accent: this.state.profile?.accent || "#f4c32f",
        icon: "coin"
      },
      ...logRows.map((entry, index) => ({
        name: ["Mosk", "FestusM", "joemick", "Durjoy244", "Keatonj", "Mantis", "Nova", "Rook"][index % 8],
        bet: entry.bet,
        multiplier: entry.cashoutPoint || entry.crashPoint || 1,
        profit: entry.profit,
        live: entry.status === "live",
        accent: entry.status === "win" ? "#2ed47a" : "#f15d5d",
        icon: entry.status === "win" ? "cash" : "coin"
      }))
    ].slice(0, 12);
    const playerTotal = playerRows.reduce((sum, row) => sum + Number(row.bet || 0), 0);
    const endpointX = 8 + crashProgress * 84;
    const endpointY = 84 - crashProgress * 58;
    const trailWidth = Math.max(0.08, crashProgress);
    const currentPayout = crash?.spinning
      ? Number((Number(crashBet || 0) * displayPoint).toFixed(2))
      : crash?.resolvedResult?.payout || 0;
    return `
      <article class="crash-casino-shell full-width">
        <aside class="crash-casino-sidebar">
          <header class="crash-casino-title">
            <b>${iconMarkup("rocket")}</b>
            <strong>Crash</strong>
          </header>
          <div class="crash-casino-tabs">
            <button class="" type="button" data-action="stop-crash-autoplay">MANUAL</button>
            <button class="is-active" type="button" data-action="toggle-crash-autoplay">AUTO</button>
          </div>
          <label class="crash-casino-field">
            <span>Bet Amount</span>
            <div>
              <i>$</i>
              <input id="crashBet" type="text" inputmode="decimal" value="${escapeHtml(crashBet)}" ${crash?.spinning ? "disabled" : ""} />
              <button type="button" data-action="set-crash-bet" data-mode="half" ${crash?.spinning ? "disabled" : ""}>1/2</button>
              <button type="button" data-action="set-crash-bet" data-mode="double" ${crash?.spinning ? "disabled" : ""}>2x</button>
              <button type="button" data-action="set-crash-bet" data-mode="max" ${crash?.spinning ? "disabled" : ""}>Max</button>
            </div>
          </label>
          <label class="crash-casino-field">
            <span>Auto Cashout</span>
            <div>
              <input id="crashAutoCashout" type="text" inputmode="decimal" value="${escapeHtml(crashAutoCashout)}" ${crash?.spinning ? "disabled" : ""} />
              <button type="button" data-action="set-crash-bet" data-mode="clear-auto" ${crash?.spinning ? "disabled" : ""}>x</button>
            </div>
          </label>
          <label class="crash-casino-field compact">
            <span>Round Delay</span>
            <div>
              <input id="crashRoundDelay" type="text" inputmode="numeric" value="${escapeHtml(roundDelay)}" ${crash?.spinning ? "disabled" : ""} />
              <em>${crash?.spinning ? "live" : compactTime(countdownMs)}</em>
            </div>
          </label>
          ${showCashout
            ? `<button class="crash-casino-play is-cashout" data-action="cashout-crash">Cashout x${displayPoint.toFixed(displayPoint >= 10 ? 1 : 2)}</button>`
            : `<button class="crash-casino-play" data-action="play-crash" ${crash?.spinning ? "disabled" : ""}>Play</button>`}
          ${crash?.spinning && crash?.cashedOutAt
            ? `<div class="crash-casino-locked">Incassato x${Number(crash.cashedOutAt).toFixed(2)}</div>`
            : ""}
          <section class="crash-player-board">
            <div class="crash-player-head">
              <strong>${playerRows.length} Players</strong>
              <span>${formatCredits(playerTotal, true)}</span>
            </div>
            <div class="crash-player-list">
              ${playerRows.map((row, index) => `
                <div class="crash-player-row ${row.live ? "is-live" : Number(row.profit || 0) > 0 ? "is-win" : Number(row.profit || 0) < 0 ? "is-loss" : ""}">
                  <span>${escapeHtml(index > 5 && index % 3 === 0 ? "(Hidden)" : row.name)}</span>
                  <strong>${formatCredits(row.bet || 0, true)}</strong>
                  <small>${row.multiplier ? `${Number(row.multiplier).toFixed(Number(row.multiplier) >= 10 ? 1 : 2)}x` : ""}</small>
                  <em>${row.profit === null || row.profit === undefined ? "" : `${row.profit >= 0 ? "+" : ""}${formatCredits(row.profit, true)}`}</em>
                  <b style="--player-accent:${row.accent}">${row.icon === "cash" ? iconMarkup("wallet") : iconMarkup("bitcoin")}</b>
                </div>
              `).join("")}
            </div>
          </section>
        </aside>
        <section class="crash-casino-stage ${crash?.spinning ? "is-live" : ""} ${crash?.crashed ? "is-crashed" : ""}">
          <div class="crash-stage-top">
            <span>${crash?.resolvedResult ? escapeHtml(crash.resolvedResult.detail) : "Max Profit"}</span>
            <strong>${crash?.resolvedResult ? `${crashProfit >= 0 ? "+" : ""}${formatCredits(crashProfit, true)}` : formatCredits(Math.max(0, this.state.credits * 35), true)}</strong>
          </div>
          <div class="crash-graph-grid">
            <span style="--y:16%">3.00x</span>
            <span style="--y:34%">2.50x</span>
            <span style="--y:52%">2.00x</span>
            <span style="--y:70%">1.50x</span>
            <span style="--y:88%">1.00x</span>
          </div>
          <svg class="crash-casino-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path class="crash-chart-shadow" pathLength="1" d="M0 92 C16 88 28 80 40 72 C55 61 66 52 78 36 C88 23 95 14 100 9" />
            <path class="crash-chart-line" pathLength="1" style="--trail:${trailWidth}" d="M0 92 C16 88 28 80 40 72 C55 61 66 52 78 36 C88 23 95 14 100 9" />
          </svg>
          <div class="crash-casino-rocket" style="left:${endpointX}%; top:${endpointY}%;">
            ${iconMarkup("rocket")}
          </div>
          <div class="crash-payout-readout">
            <strong>${displayPoint.toFixed(displayPoint >= 10 ? 1 : 2)}x</strong>
            <span>${crash?.spinning ? "Current Payout" : crash?.resolvedResult ? "Last Payout" : "Ready"}</span>
            <em>${formatCredits(currentPayout, true)}</em>
          </div>
          <div class="crash-tick-labels">
            <span>4s</span>
            <span>6s</span>
            <span>8s</span>
            <span>10s</span>
            <span>12s</span>
          </div>
          <div class="crash-history-strip crash-casino-history">
            ${recentHistory.length
              ? recentHistory.map((entry) => `
                <span class="crash-history-pill ${entry.playerWon ? "is-win" : "is-loss"}">
                  ${Number(entry.crashPoint || entry.outcome || 1).toFixed(Number(entry.crashPoint || entry.outcome || 1) >= 10 ? 1 : 2)}x
                </span>
              `).join("")
              : `<span class="crash-history-pill">Nessun round ancora</span>`}
          </div>
        </section>
      </article>
    `;
  }

  renderMultiplayerJackpot() {
    const lobbyOptions = this.getJackpotLobbies();
    const selectedLobby = this.getSelectedJackpotLobby();
    if (!selectedLobby) {
      return `
        <article class="game-card jackpot-card social-card full-width">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("coins", "button-icon")} Jackpot</span>
              <h3>Scegli lobby</h3>
            </div>
            <div class="social-chip-stack">
              ${statTile("Net worth", formatCredits(getNetWorth(this.state), true), "fascia account")}
            </div>
          </div>
          <div class="jackpot-lobby-grid">
            ${lobbyOptions.map((lobby) => `
              <button class="jackpot-lobby-card ${lobby.compatible ? "is-compatible" : ""}" data-action="select-jackpot-lobby" data-id="${lobby.id}" ${lobby.compatible ? "" : "disabled"}>
                <span>${escapeHtml(lobby.range)}</span>
                <strong>${escapeHtml(lobby.name)}</strong>
                <small>${escapeHtml(lobby.detail)}</small>
                <em>${lobby.compatible ? "Disponibile" : "Non compatibile"}</em>
              </button>
            `).join("")}
          </div>
        </article>
      `;
    }
    const jackpotState = this.getJackpotSelectionState();
    const jackpotPreview = this.jackpotPreview;
    const jackpotAnimation = this.jackpotAnimation;
    const liveParticipants = jackpotAnimation?.participants || jackpotPreview?.participants || [];
    const highlighted = jackpotAnimation?.highlightIndex ?? -1;
    const potItemCount = liveParticipants.reduce((sum, participant) => sum + (participant.itemCount || participant.entries?.length || 0), 0);
    const onlinePlayers = this.getJackpotPresencePlayers();
    const jackpotOpponents = this.getJackpotOpponents();
    const jackpotReady = onlinePlayers.length >= 2 && jackpotOpponents.length >= 1;
    return `
      <article class="game-card jackpot-card social-card full-width">
        <div class="social-card-head">
          <div>
            <span>${iconMarkup("coins", "button-icon")} Jackpot</span>
            <h3>${escapeHtml(selectedLobby.name)} Jackpot</h3>
          </div>
          <div class="social-chip-stack">
            ${statTile("Lobby", selectedLobby.name, selectedLobby.range)}
            ${statTile("Selezione", jackpotState.selectedItems.length, formatCredits(jackpotState.selectedTotal))}
            ${statTile("Utenti", `${onlinePlayers.length}/2`, jackpotReady ? `${jackpotOpponents.length} avversari online` : "in attesa")}
          </div>
        </div>
        <div class="game-controls social-inline-controls">
          <button class="ghost-button" data-action="change-jackpot-lobby" ${jackpotAnimation?.spinning ? "disabled" : ""}>${iconMarkup("layers-3", "button-icon")} Cambia lobby</button>
          <button class="ghost-button" data-action="clear-jackpot-selection" ${jackpotAnimation?.spinning ? "disabled" : ""}>${iconMarkup("undo-2", "button-icon")} Ritira puntata</button>
          <button class="primary-button" data-action="play-jackpot" ${jackpotState.selectedItems.length && jackpotReady && !jackpotAnimation?.spinning ? "" : "disabled"}>${iconMarkup("timer", "button-icon")} Entra nel countdown</button>
          <span class="hint">${jackpotReady ? "Countdown automatico pronto." : "In attesa di almeno 2 utenti online nella lobby."}</span>
        </div>
        ${this.renderGameInventoryFilters()}
        <div class="jackpot-item-grid">
          ${jackpotState.availableItems.length
            ? jackpotState.availableItems.map((item) => `
              <button
                class="jackpot-pick ${this.jackpotSelection.has(item.id) ? "is-selected" : ""} ${rarityClass(item.rarity)}"
                data-action="toggle-jackpot-item"
                data-id="${item.id}"
                style="--rarity:${item.rarityColor}"
                ${jackpotAnimation?.spinning ? "disabled" : ""}
              >
                <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
                <span>${escapeHtml(item.name)}</span>
                <strong>${formatCredits(getSellReturn(this.state, item), true)}</strong>
              </button>
            `).join("")
            : `<div class="empty-state">Ti servono skin in inventario per entrare nel jackpot.</div>`}
        </div>
        <div class="social-result ${jackpotAnimation?.spinning ? "is-spinning" : ""}">
          <div class="social-result-head">
            <strong>${jackpotAnimation?.spinning ? "Rolling..." : jackpotPreview ? escapeHtml(jackpotPreview.winnerName) : "In attesa"}</strong>
            <small>${jackpotAnimation?.spinning ? "Countdown chiuso: risultato gia' deciso, roulette in corso." : jackpotPreview ? escapeHtml(jackpotPreview.detail) : "Seleziona skin e attendi altri player."}</small>
          </div>
          <div class="jackpot-pot-list jackpot-pot-roller">
            ${liveParticipants.length ? liveParticipants.map((participant, index) => `
              <div class="jackpot-pot-row ${index === highlighted ? "is-highlighted" : ""}" style="--player-accent:${participant.accent}">
                <span><b class="jackpot-player-avatar">${escapeHtml(String(participant.name || "?").slice(0, 1).toUpperCase())}</b>${escapeHtml(participant.name)}</span>
                <div><i style="width:${Math.max(6, (participant.total / Math.max(1, (jackpotAnimation?.potValue || jackpotPreview?.potValue || 1))) * 100)}%"></i></div>
                <strong>${Math.round((participant.total / Math.max(1, (jackpotAnimation?.potValue || jackpotPreview?.potValue || 1))) * 100)}% · ${jackpotAnimation?.spinning ? `${participant.itemCount || participant.entries?.length || 0} item` : `${formatCredits(participant.total, true)}`}</strong>
              </div>
            `).join("") : `<div class="empty-state small">Nessun pot recente.</div>`}
          </div>
          ${jackpotPreview ? `
            <div class="jackpot-win-strip">
              <strong>${jackpotPreview.playerWon ? `Hai vinto ${jackpotPreview.wonItems.length} skin` : `Hai perso ${jackpotPreview.depositedItems?.length || 0} skin`}</strong>
              <small>${jackpotPreview.playerWon ? `Valore stimato ${formatCredits(jackpotPreview.payout, true)}` : "Il pot e' andato a un altro giocatore."}</small>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }

  renderMultiplayerMarket() {
    const social = this.socialState || {};
    const currentPlayer = social.currentPlayer || null;
    const listings = Array.isArray(social.market?.listings) ? social.market.listings : [];
    const lockerItems = this.getSocialLockerCandidates();
    const marketQuery = String(this.socialMarketSearch || "").trim().toLowerCase();
    const filteredLocker = lockerItems.filter((item) => {
      if (!marketQuery) {
        return true;
      }
      return `${item.name} ${item.rarity} ${item.wear} ${item.caseName}`.toLowerCase().includes(marketQuery);
    });
    const totalPages = Math.max(1, Math.ceil(filteredLocker.length / this.socialMarketPageSize));
    this.socialMarketPage = clamp(this.socialMarketPage, 1, totalPages);
    const start = (this.socialMarketPage - 1) * this.socialMarketPageSize;
    const visibleLocker = filteredLocker.slice(start, start + this.socialMarketPageSize);
    const selectedItem = lockerItems.find((item) => item.id === this.socialMarketItemId) || filteredLocker[0] || lockerItems[0] || null;
    const myListings = listings.filter((listing) => listing.sellerId === this.socialConnection?.clientId);
    const suggestedPrice = selectedItem ? Number(selectedItem.value || 0).toFixed(2) : "";
    const priceValue = this.socialMarketPrice || suggestedPrice;
    return `
      <div class="social-market-shell">
        <article class="game-card social-card">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("store", "button-icon")} Marketplace globale</span>
              <h3>Metti in vendita skin vere del tuo inventario</h3>
              <p>Le inserzioni sono condivise tra i player del server locale. Il market usa una fee del ${(social.market?.feeRate || 0.06) * 100}% e lascia libero il prezzo, con massimo 5 item attivi alla volta.</p>
            </div>
            <div class="social-chip-stack">
              ${statTile("Inserzioni", currentPlayer?.openListings || 0, "aperte")}
              ${statTile("Vendite", currentPlayer?.marketSales || 0, `${formatCredits(currentPlayer?.marketEarned || 0, true)} netti`)}
            </div>
          </div>
          <div class="market-listing-toolbar">
            <label class="field-inline">
              <span>Cerca nel locker</span>
              <input id="socialMarketSearch" type="search" value="${escapeHtml(this.socialMarketSearch)}" placeholder="Nome, rarita', cassa..." />
            </label>
            <label class="field-inline">
              <span>Prezzo vendita</span>
              <input id="socialMarketPrice" type="text" inputmode="decimal" value="${escapeHtml(priceValue)}" placeholder="Prezzo" />
            </label>
            <button class="primary-button" data-action="list-global-market" ${selectedItem && myListings.length < 5 ? "" : "disabled"}>${iconMarkup("tag", "button-icon")} Lista selezione</button>
          </div>
          <div class="market-locker-layout">
            <div class="market-locker-grid-paged">
              ${visibleLocker.length ? visibleLocker.map((item) => `
                <button class="market-locker-tile ${item.id === selectedItem?.id ? "is-selected" : ""} ${rarityClass(item.rarity)}" data-action="select-market-item" data-id="${item.id}" style="--rarity:${item.rarityColor}">
                  <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
                  <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                  <small>${escapeHtml(item.rarity)} · ${escapeHtml(item.wear)}</small>
                  <strong>${formatCredits(item.value, true)}</strong>
                </button>
              `).join("") : `<div class="empty-state small">Nessuna skin trovata nel locker.</div>`}
            </div>
            <div class="market-locker-side">
              <div class="market-pager">
                <button class="ghost-button tiny" data-action="social-market-page" data-page="${this.socialMarketPage - 1}" ${this.socialMarketPage <= 1 ? "disabled" : ""}>${iconMarkup("chevron-left", "button-icon")}</button>
                <span>${this.socialMarketPage}/${totalPages}</span>
                <button class="ghost-button tiny" data-action="social-market-page" data-page="${this.socialMarketPage + 1}" ${this.socialMarketPage >= totalPages ? "disabled" : ""}>${iconMarkup("chevron-right", "button-icon")}</button>
              </div>
              ${selectedItem ? `
                <div class="market-selected-card ${rarityClass(selectedItem.rarity)}" style="--rarity:${selectedItem.rarityColor}">
                  <img src="${selectedItem.image}" alt="${escapeHtml(selectedItem.name)}" loading="lazy" />
                  <strong title="${escapeHtml(selectedItem.name)}">${escapeHtml(selectedItem.name)}</strong>
                  <small>${escapeHtml(selectedItem.rarity)} · ${escapeHtml(selectedItem.wear)}</small>
                  <em>${formatCredits(selectedItem.value, true)}</em>
                </div>
              ` : `<div class="empty-state small">Seleziona una skin da listare.</div>`}
            </div>
          </div>
        </article>
        <article class="data-panel">
          <h3>Le tue inserzioni</h3>
          <div class="social-list-grid">
            ${myListings.length ? myListings.map((listing) => `
              <div class="social-list-row">
                <div class="social-list-copy">
                  <strong>${escapeHtml(listing.item.name)}</strong>
                  <small>${escapeHtml(listing.item.rarity)} - ${formatCredits(listing.price, true)}</small>
                </div>
                <button class="ghost-button tiny" data-action="cancel-global-listing" data-id="${listing.id}">Ritira</button>
              </div>
            `).join("") : `<div class="empty-state small">Nessuna inserzione aperta.</div>`}
          </div>
        </article>
        <article class="data-panel">
          <h3>Mercato live</h3>
          <div class="social-market-grid">
            ${listings.length ? listings.map((listing) => `
              <article class="social-market-card ${rarityClass(listing.item.rarity)}" style="--rarity:${listing.item.rarityColor}">
                <img src="${listing.item.image}" alt="${escapeHtml(listing.item.name)}" loading="lazy" />
                <strong title="${escapeHtml(listing.item.name)}">${escapeHtml(listing.item.name)}</strong>
                <small>${escapeHtml(listing.sellerName)} · ${escapeHtml(listing.item.rarity)}</small>
                <em>${formatCredits(listing.price, true)}</em>
                <button
                  class="primary-button small"
                  data-action="${listing.sellerId === this.socialConnection?.clientId ? "cancel-global-listing" : "buy-global-listing"}"
                  data-id="${listing.id}"
                  ${listing.sellerId !== this.socialConnection?.clientId && this.state.credits < listing.price ? "disabled" : ""}
                >${listing.sellerId === this.socialConnection?.clientId ? "Ritira" : "Compra"}</button>
              </article>
            `).join("") : `<div class="empty-state small">Mercato ancora vuoto.</div>`}
          </div>
        </article>
      </div>
    `;
  }

  renderMultiplayerTrades() {
    const social = this.socialState || {};
    const players = Array.isArray(social.players) ? social.players.filter((player) => player.id !== this.socialConnection?.clientId) : [];
    const target = this.getSelectedTradeTarget() || players[0] || null;
    const incoming = Array.isArray(social.trades?.incoming) ? social.trades.incoming : [];
    const outgoing = Array.isArray(social.trades?.outgoing) ? social.trades.outgoing : [];
    const myItems = this.getSocialLockerCandidates();
    const offerItemId = this.socialTradeOfferItemId || myItems[0]?.id || "";
    const offerItem = myItems.find((item) => item.id === offerItemId) || null;
    const targetItems = target?.lockerItems || [];
    const requestedId = this.socialTradeRequestedItemId || targetItems[0]?.id || "";
    const requestedItem = targetItems.find((item) => item.id === requestedId) || null;
    return `
      <div class="social-trade-shell">
        <article class="game-card social-card">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("handshake", "button-icon")} Trade tra player</span>
              <h3>Scambia skin con il locker pubblico degli altri</h3>
              <p>Le offerte usano escrow server-side: la tua skin esce dal locker quando invii il trade e torna indietro solo se l'offerta viene rifiutata o scade.</p>
            </div>
            <div class="social-chip-stack">
              ${statTile("Trade chiuse", social.currentPlayer?.tradesCompleted || 0, "storico")}
              ${statTile("In arrivo", incoming.length, `${outgoing.length} in uscita`)}
            </div>
          </div>
          <div class="trade-target-strip">
            ${players.length ? players.map((player) => `
              <button class="trade-target-chip ${target?.id === player.id ? "is-active" : ""}" data-action="select-trade-target" data-id="${player.id}" style="--player-accent:${player.accent}">
                <span>${escapeHtml(player.name)}</span>
                <small>${escapeHtml(player.rankName || "Silver I")}</small>
              </button>
            `).join("") : `<div class="empty-state small">Nessun altro player live per ora.</div>`}
          </div>
          ${target ? `
            <div class="trade-compose-grid">
              <div class="trade-compose-panel">
                <h4>La tua offerta</h4>
                <select id="socialTradeOfferItem">
                  ${myItems.map((item) => `<option value="${item.id}" ${offerItemId === item.id ? "selected" : ""}>${escapeHtml(item.name)} - ${formatCredits(item.value, true)}</option>`).join("")}
                </select>
                ${offerItem ? itemCard(offerItem, { compact: true }) : `<div class="empty-state small">Nessuna skin disponibile.</div>`}
              </div>
              <div class="trade-compose-panel">
                <h4>Richiesta a ${escapeHtml(target.name)}</h4>
                <div class="trade-locker-grid">
                  ${targetItems.length ? targetItems.map((item) => `
                    <button class="trade-locker-item ${requestedId === item.id ? "is-active" : ""}" data-action="pick-trade-request-item" data-id="${item.id}" data-target-id="${target.id}" style="--rarity:${item.rarityColor}">
                      <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />
                      <span>${escapeHtml(item.name)}</span>
                      <small>${formatCredits(item.value, true)}</small>
                    </button>
                  `).join("") : `<div class="empty-state small">Locker pubblico vuoto.</div>`}
                </div>
              </div>
            </div>
            <div class="game-controls social-inline-controls">
              <button class="primary-button" data-action="create-trade-offer" ${(offerItem && requestedItem) ? "" : "disabled"}>${iconMarkup("send", "button-icon")} Invia offerta</button>
              ${offerItem && requestedItem ? `<span class="hint">Scambio ${formatCredits(offerItem.value, true)} vs ${formatCredits(requestedItem.value, true)}</span>` : ""}
            </div>
          ` : ""}
        </article>
        <article class="data-panel">
          <h3>Offerte in arrivo</h3>
          <div class="social-list-grid">
            ${incoming.length ? incoming.map((offer) => `
              <div class="trade-offer-card">
                <div class="trade-offer-copy">
                  <strong>${escapeHtml(offer.creatorName)}</strong>
                  <small>${escapeHtml(offer.offeredItem.name)} per ${escapeHtml(offer.requestedItem.name)}</small>
                </div>
                <div class="trade-offer-actions">
                  <button class="primary-button small" data-action="accept-trade-offer" data-id="${offer.id}">Accetta</button>
                  <button class="ghost-button tiny" data-action="decline-trade-offer" data-id="${offer.id}">Rifiuta</button>
                </div>
              </div>
            `).join("") : `<div class="empty-state small">Nessuna trade in arrivo.</div>`}
          </div>
        </article>
        <article class="data-panel">
          <h3>Le tue offerte</h3>
          <div class="social-list-grid">
            ${outgoing.length ? outgoing.map((offer) => `
              <div class="trade-offer-card">
                <div class="trade-offer-copy">
                  <strong>${escapeHtml(offer.targetName)}</strong>
                  <small>${escapeHtml(offer.offeredItem.name)} -> ${escapeHtml(offer.requestedItem.name)}</small>
                </div>
                <span class="hint">in attesa</span>
              </div>
            `).join("") : `<div class="empty-state small">Nessuna offerta aperta.</div>`}
          </div>
        </article>
      </div>
    `;
  }

  renderMultiplayerLeaderboard() {
    const board = this.socialState?.leaderboard || {};
    const sections = [
      { label: "Rank competitivo", rows: Array.isArray(board.competitive) ? board.competitive : [], metric: (player) => `${player.rankName} · ${player.rankPoints} pt` },
      { label: "Net worth", rows: Array.isArray(board.wealth) ? board.wealth : [], metric: (player) => formatCredits(player.netWorth, true) },
      { label: "Trader", rows: Array.isArray(board.traders) ? board.traders : [], metric: (player) => `${player.marketSales || 0} vendite · ${player.tradesCompleted || 0} trade` }
    ];
    return `
      <div class="social-leaderboard-grid">
        ${sections.map((section) => `
          <article class="data-panel">
            <h3>${escapeHtml(section.label)}</h3>
            <div class="leaderboard-list">
              ${section.rows.length ? section.rows.map((player, index) => `
                <div class="leaderboard-row" style="--player-accent:${player.accent || "#64d7e3"}">
                  <span>#${index + 1}</span>
                  <div>
                    <strong>${escapeHtml(player.name)}</strong>
                    <small>P${player.prestige || 0} · Lv ${player.level || 1}</small>
                  </div>
                  <em>${escapeHtml(section.metric(player))}</em>
                </div>
              `).join("") : `<div class="empty-state small">Classifica in attesa di player.</div>`}
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  renderMultiplayerHistory() {
    const history = (this.state.minigames?.history || []).filter((entry) =>
      ["Crash", "Jackpot"].includes(entry.game)
    );
    return `
      <section class="data-panel game-history full-width">
        <h3>Storico multiplayer</h3>
        <div class="mini-game-history">
          ${history.length ? history.slice(0, 16).map((entry) => `
            <div class="game-history-row ${entry.profit >= 0 ? "is-win" : "is-loss"}">
              <span>${escapeHtml(entry.game)}</span>
              <strong>${escapeHtml(entry.label)} - ${escapeHtml(entry.detail)}</strong>
              <em>${entry.profit >= 0 ? "+" : ""}${formatCredits(entry.profit)}</em>
            </div>
          `).join("") : `<div class="empty-state small">Ancora nessun round multiplayer registrato.</div>`}
        </div>
      </section>
    `;
  }

  renderCommunityGoals() {
    const goals = this.getCommunityGoalRows();
    const promoRedeemed = Object.keys(this.state.promoCodes?.redeemed || {}).length;
    return `
      <div class="community-page">
        <div class="games-header">
          ${statTile("Codici riscattati", promoRedeemed, "promo")}
          ${statTile("Archivio collezioni", Math.floor(this.state.collections.archivePoints || 0), "punti assist")}
          ${statTile("Goal pronti", goals.filter((goal) => goal.ready && !goal.claimed).length, `${goals.length} attivi`)}
          ${statTile("Sync", this.sharedGoalStatus.replace("Sync community ", ""), "Supabase community")}
          ${statTile("Reward case", this.state.inventory.filter((item) => item.type === "rewardCase").length, "in inventario")}
        </div>
        <article class="game-card full-width promo-card">
          <div class="social-card-head">
            <div>
              <span>${iconMarkup("ticket", "button-icon")} Promo code</span>
              <h3>Riscatta codici evento</h3>
              <p>Il codice MARCUS assegna 10.000 crediti una sola volta per save.</p>
            </div>
          </div>
          <div class="game-controls social-inline-controls">
            <input id="promoCodeInput" value="${escapeHtml(this.promoCodeDraft)}" placeholder="Inserisci codice" />
            <button class="primary-button" data-action="redeem-promo">${iconMarkup("gift", "button-icon")} Riscatta</button>
          </div>
        </article>
        <div class="community-goal-grid">
          ${goals.map((goal) => {
            const isShared = goal.scope === "community";
            const busy = this.goalSyncBusy.has(goal.id);
            const canClaim = goal.ready && !goal.claimed;
            return `
            <article class="community-goal-card ${goal.ready ? "is-ready" : ""} ${goal.claimed ? "is-claimed" : ""}">
              <div>
                <span>${goal.scope === "solo" ? "Singolo" : "Community"} · scade ${compactTime(goal.endsAt - Date.now())}</span>
                <h3>${escapeHtml(goal.label)}</h3>
                <p>Deposita crediti per sbloccare ${goal.rewardCount} cassa/e reward Tier ${goal.rewardTier}.</p>
              </div>
              <div class="progress-line"><i style="width:${percent(goal.progress)}"></i></div>
              <div class="community-goal-meta">
                <strong>${formatCredits(goal.contributed, true)} / ${formatCredits(goal.target, true)}</strong>
                <small>${goal.claimed
                  ? "Reward ritirato"
                  : isShared
                    ? `${formatCredits(goal.personalContributed, true)} tuoi · ${formatCredits(goal.sharedContributed, true)} community`
                    : goal.ready ? "Pronto da ritirare" : "In corso"}</small>
              </div>
              <div class="game-controls compact-goal-controls">
                <input data-goal-deposit-input="${goal.id}" value="${escapeHtml(this.goalDepositAmounts[goal.id] || "")}" placeholder="Crediti" />
                <button class="ghost-button small" data-action="deposit-goal" data-id="${goal.id}" ${goal.claimed || busy ? "disabled" : ""}>${busy ? "Sync..." : "Deposita"}</button>
                <button class="primary-button small" data-action="claim-goal" data-id="${goal.id}" ${canClaim ? "" : "disabled"}>Ritira</button>
              </div>
            </article>
          `;
          }).join("")}
        </div>
      </div>
    `;
  }

  getAdminPromoRows() {
    const rows = new Map();
    this.globalPromoCodes.forEach((promo) => {
      rows.set(promo.code, {
        code: promo.code,
        reward: promo.reward || {},
        source: "Globale",
        active: promo.active !== false
      });
    });
    Object.entries(this.state.promoCodes?.custom || {}).forEach(([code, reward]) => {
      const normalized = String(code || "").trim().toUpperCase();
      const existing = rows.get(normalized);
      rows.set(normalized, {
        code: normalized,
        reward: existing?.reward || reward || {},
        source: existing ? "Globale + locale" : "Locale",
        active: existing?.active ?? true
      });
    });
    return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  renderAdminPanel() {
    if (!this.isAdmin()) {
      return `<div class="empty-state">Accesso admin richiesto.</div>`;
    }
    const promoRows = this.getAdminPromoRows();
    const globalSyncHint = isGlobalPromoCodesAvailable()
      ? (this.adminPasswordSecret ? this.globalPromoStatus : "Rifai login admin dopo un refresh per salvare online.")
      : "Promo globali non configurati.";
    return `
      <div class="admin-panel">
        <div class="cheat-console">
          <div class="cheat-header">
            <h3>Pannello admin</h3>
          </div>
          ${this.renderCheats()}
          <div class="cheat-grid">
            <section class="cheat-card">
              <span>Goal</span>
              <h4>Test reward</h4>
              <div class="cheat-controls">
                <button class="primary-button small" data-action="cheat-complete-goals">Completa/scade goal</button>
                <button class="ghost-button small danger" data-action="cheat-reset-community-goals">Reset community</button>
              </div>
            </section>
            <section class="cheat-card">
              <span>Promo code</span>
              <h4>${this.adminPromoEditingCode ? `Modifica ${escapeHtml(this.adminPromoEditingCode)}` : "Crea codice"}</h4>
              <p class="admin-sync-note">${escapeHtml(globalSyncHint)}</p>
              <div class="cheat-controls vertical">
                <label class="admin-promo-field">
                  <span>Codice</span>
                  <input id="adminPromoCode" value="${escapeHtml(this.adminPromoCode)}" placeholder="MARCUS2" ${this.adminPromoEditingCode ? "readonly" : ""} />
                  <small>3-24 caratteri, lettere/numeri/_/-</small>
                </label>
                <div class="admin-promo-grid">
                  <label class="admin-promo-field">
                    <span>Crediti</span>
                    <input id="adminPromoCredits" type="number" min="0" step="100" value="${escapeHtml(this.adminPromoCredits)}" placeholder="0" />
                  </label>
                  <label class="admin-promo-field">
                    <span>Casse reward</span>
                    <input id="adminPromoCases" type="number" min="0" step="1" value="${escapeHtml(this.adminPromoCases)}" placeholder="0" />
                  </label>
                  <label class="admin-promo-field">
                    <span>Tier casse</span>
                    <input id="adminPromoTier" type="number" min="1" max="5" step="1" value="${escapeHtml(this.adminPromoTier)}" placeholder="2" />
                  </label>
                  <label class="admin-promo-field">
                    <span>Armi</span>
                    <input id="adminPromoWeapons" type="number" min="0" max="12" step="1" value="${escapeHtml(this.adminPromoWeapons)}" placeholder="0" />
                  </label>
                </div>
                <label class="admin-promo-field">
                  <span>Rarita' armi</span>
                  <select id="adminPromoRarity">
                    ${RARITY_ORDER.map((rarity) => `<option value="${rarity}" ${this.adminPromoRarity === rarity ? "selected" : ""}>${rarity}</option>`).join("")}
                  </select>
                </label>
                <div class="admin-promo-preview">
                  <span>Reward generato</span>
                  <strong>${formatCredits(Number(this.adminPromoCredits || 0), true)} · ${Number(this.adminPromoCases || 0)} casse Tier ${Number(this.adminPromoTier || 1)} · ${Number(this.adminPromoWeapons || 0)} armi ${escapeHtml(this.adminPromoRarity)}</strong>
                </div>
                <div class="cheat-controls">
                  <button class="primary-button small" data-action="admin-create-promo">${this.adminPromoEditingCode ? "Aggiorna promo" : "Crea promo"}</button>
                  <button class="ghost-button small" data-action="admin-clear-promo-form">Pulisci</button>
                </div>
              </div>
              <div class="admin-promo-list">
                ${promoRows.length ? promoRows.map(({ code, reward, source, active }) => `
                  <div class="admin-promo-row">
                    <div>
                      <strong>${escapeHtml(code)}</strong>
                      <small>${escapeHtml(source)}${active ? "" : " · disattivo"} · ${formatCredits(reward.credits || 0, true)} · ${reward.cases || 0} casse T${reward.rewardTier || 1} · ${reward.weapons || 0} armi ${escapeHtml(reward.weaponRarity || "Mil-Spec")}</small>
                    </div>
                    <button class="ghost-button tiny" data-action="admin-edit-promo" data-code="${escapeHtml(code)}">Modifica</button>
                    <button class="ghost-button tiny danger" data-action="admin-delete-promo" data-code="${escapeHtml(code)}">Elimina</button>
                  </div>
                `).join("") : `<small>Nessun codice custom.</small>`}
              </div>
            </section>
          </div>
        </div>
      </div>
    `;
  }

  renderCheats() {
    const selectedMastery = getCaseMastery(this.state, this.selectedCase.id);
    const maxUnlock = Math.max(0, ...this.skinData.cases.map((caseDef) => caseDef.unlockPrestige || 0));
    return `
      <div class="cheat-console">
        <div class="cheat-header">
          <h3>Cheat menu</h3>
        </div>
        <div class="games-header">
          ${statTile("Saldo", formatCredits(this.state.credits), "saldo attuale")}
          ${statTile("Prestige", this.state.prestige.level, `max unlock P${maxUnlock}`)}
          ${statTile("Shard", this.state.prestige.shards, `${this.state.prestige.lifetimeShards || 0} lifetime`)}
          ${statTile("Cassa", `Lv ${selectedMastery.level}`, this.selectedCase.name)}
        </div>
        <div class="cheat-grid">
          <section class="cheat-card">
            <span>Economia</span>
            <h4>Saldo</h4>
            <div class="cheat-controls">
              <input id="cheatCredits" type="number" min="1" step="1000" value="10000" />
              <button class="primary-button small" data-action="cheat-add-credits">Aggiungi</button>
              <button class="ghost-button small" data-action="cheat-set-credits">Imposta</button>
            </div>
          </section>
          <section class="cheat-card">
            <span>Prestige</span>
            <h4>Progressione</h4>
            <div class="cheat-controls">
              <input id="cheatPrestige" type="number" min="1" step="1" value="1" />
              <button class="primary-button small" data-action="cheat-add-prestige">+ Prestige</button>
              <button class="ghost-button small" data-action="cheat-unlock-cases">Sblocca casse</button>
            </div>
          </section>
          <section class="cheat-card">
            <span>Shard</span>
            <h4>Albero Prestige</h4>
            <div class="cheat-controls">
              <input id="cheatShards" type="number" min="1" step="10" value="25" />
              <button class="primary-button small" data-action="cheat-add-shards">Aggiungi shard</button>
              <button class="ghost-button small" data-action="cheat-max-upgrades">Max upgrade</button>
            </div>
          </section>
          <section class="cheat-card">
            <span>Mastery</span>
            <h4>${escapeHtml(this.selectedCase.name)}</h4>
            <div class="cheat-controls">
              <input id="cheatCaseMastery" type="number" min="0" step="1" value="${Math.max(10, selectedMastery.level)}" />
              <button class="primary-button small" data-action="cheat-master-case">Imposta livello</button>
              <button class="ghost-button small" data-action="cheat-reset-cooldowns">Reset cooldown</button>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  renderCaseFilters(visibleCases) {
    const node = this.root.querySelector("#caseFilters");
    if (!node) {
      return;
    }
    const groups = this.getCasePrestigeGroups();
    const groupCases = this.getCasesForPrestigeGroup(this.casePrestigeGroup);
    const groupIndex = Math.max(0, groups.indexOf(this.casePrestigeGroup));
    node.innerHTML = `
      <div class="case-prestige-switch">
        <button class="ghost-button tiny case-carousel-arrow" data-action="case-page-prev" ${groupIndex <= 0 ? "disabled" : ""} aria-label="Prestige precedente">${iconMarkup("arrow-left")}</button>
        <strong>Prestige ${this.casePrestigeGroup}</strong>
        <button class="ghost-button tiny case-carousel-arrow" data-action="case-page-next" ${groupIndex >= groups.length - 1 ? "disabled" : ""} aria-label="Prestige successivo">${iconMarkup("arrow-right")}</button>
      </div>
      <div class="case-filters-head case-count-only">
        <div class="case-filters-meta">
          <span>${visibleCases.length}/${groupCases.length} casse</span>
          <small>Gruppo Prestige ${this.casePrestigeGroup}</small>
        </div>
      </div>
    `;
  }

  renderSelectedCase() {
    const node = this.root.querySelector("#selectedCase");
    const caseDef = this.selectedCase;
    const analytics = this.getCaseAnalytics(caseDef);
    const table = analytics.table;
    const caseStats = getCaseStats(this.state, caseDef.id);
    const openedTotal = caseStats.opens || this.state.stats.caseCounts[caseDef.id] || 0;
    const cleanPriceNote = caseDef.priceSource === "steam"
      ? `Steam ${caseDef.steamRawPrice || `${caseDef.realPriceEuro?.toFixed(2)} euro`}`
      : "fallback bilanciato";
    const detailSummary = `${formatCredits(table.expectedValue)} EV - ${formatCredits(caseDef.price)} costo - ${openedTotal} aperture`;
    const detailToggleIcon = this.caseDetailsOpen ? "-" : "+";
    const highlights = this.getCaseHighlightMap(this.skinData.cases);
    const badges = this.getCaseSignalBadges(caseDef, highlights);

    node.innerHTML = `
      <div class="case-economy case-economy-main">
        <button class="case-details-toggle" data-action="toggle-case-details">
          <span>Dettagli cassa</span>
          <strong>${detailSummary}</strong>
          <i>${detailToggleIcon}</i>
        </button>
        ${this.caseDetailsOpen ? `
          <div class="case-details-panel">
            <div class="case-signal-strip">
              ${badges.length
                ? badges.map((badge) => `<span class="case-signal-badge ${badge.key}" data-tip="${escapeHtml(badge.tip)}">${escapeHtml(badge.label)}</span>`).join("")
                : `<span class="case-signal-badge neutral" data-tip="Scheda neutra: nessun segnale speciale in questo momento.">Profilo stabile</span>`}
            </div>
            <div class="ev-strip">
              ${statTile("EV stimato", formatCredits(table.expectedValue), `ROI ${(table.roi * 100).toFixed(1)}%`)}
              ${statTile("Costo", formatCredits(caseDef.price), cleanPriceNote)}
              ${statTile("Best tier", table.bestRarity || "-", `${table.bestPreview.length} preview`)}
              ${statTile("Aperture", openedTotal, "totali su questa cassa")}
            </div>
            <section class="case-detail-card">
              <div class="case-detail-head">
                <strong>Statistiche cassa</strong>
                <small>${openedTotal ? "lifetime" : "nessuna apertura ancora"}</small>
              </div>
              <div class="case-stat-grid">
                ${statTile("Speso", formatCredits(caseStats.spent), `${openedTotal} aperture`)}
                ${statTile("Drop medi", formatCredits(openedTotal ? caseStats.totalDropValue / openedTotal : 0, true), "valore lordo medio")}
                ${statTile("Venduto", formatCredits(caseStats.soldValue), `${formatCredits(caseStats.autoSoldValue, true)} auto`)}
                ${statTile("Best drop", caseStats.bestDropName ? formatCredits(caseStats.bestDropValue, true) : "-", caseStats.bestDropRarity || "nessun record")}
              </div>
              ${caseStats.bestDropName ? `
                <div class="case-best-drop-inline" style="--rarity:${RARITIES[caseStats.bestDropRarity]?.color || "#f6c452"}">
                  <strong>${escapeHtml(caseStats.bestDropName)}</strong>
                  <small>${escapeHtml(caseStats.bestDropRarity)} - ${formatCredits(caseStats.bestDropValue, true)}</small>
                </div>
              ` : ""}
              <div class="case-rarity-mini">
                ${RARITY_ORDER.map((rarity) => {
                  const count = caseStats.rarityCounts[rarity] || 0;
                  const total = Math.max(1, openedTotal);
                  return `
                    <div class="case-rarity-mini-row" style="--rarity:${RARITIES[rarity].color}">
                      <span>${escapeHtml(rarity)}</span>
                      <div><i style="width:${Math.max(count ? 4 : 0, (count / total) * 100)}%"></i></div>
                      <strong>${count}</strong>
                    </div>
                  `;
                }).join("")}
              </div>
            </section>
            <div class="drop-table">
              ${table.rows.map((row) => `
                <div class="drop-row" style="--rarity:${row.color}">
                  <span>${escapeHtml(row.rarity)}</span>
                  <div><i style="width:${percent(row.probability)}"></i></div>
                  <strong>${formatPercent(row.probability)}</strong>
                  <small>${formatCredits(row.estimatedValue, true)} EV</small>
                </div>
              `).join("")}
            </div>
            <div class="best-preview">
              ${table.bestPreview.map((skin) => `
                <div class="best-skin" style="--rarity:${RARITIES[skin.rarity].color}">
                  <img src="${skin.image}" alt="${escapeHtml(skin.name)}" loading="lazy" />
                  <span>${escapeHtml(skin.name)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  renderStats() {
    const profit = this.state.stats.totalEarned + getInventoryValue(this.state) - this.state.stats.totalSpent;
    const best = this.state.stats.bestDrop;
    const session = this.getSessionSummary();
    const topMastery = this.skinData.cases
      .map((caseDef) => ({ caseDef, mastery: getCaseMastery(this.state, caseDef.id) }))
      .filter(({ mastery }) => mastery.opens > 0)
      .sort((a, b) => b.mastery.level - a.mastery.level || b.mastery.opens - a.mastery.opens)
      .slice(0, 8);
    const maxMastery = topMastery[0]?.mastery.level || 0;
    const skill = getProfileSkillBonus(this.state);
    const totalDrops = Math.max(1, RARITY_ORDER.reduce((sum, rarity) => sum + (this.state.stats.rarityCounts[rarity] || 0), 0));
    const rarityStops = [];
    let rarityCursor = 0;
    RARITY_ORDER.forEach((rarity) => {
      const next = rarityCursor + ((this.state.stats.rarityCounts[rarity] || 0) / totalDrops) * 100;
      rarityStops.push(`${RARITIES[rarity].color} ${rarityCursor.toFixed(2)}% ${next.toFixed(2)}%`);
      rarityCursor = next;
    });
    const minigameSpent = Number(this.state.stats.minigameSpent || 0);
    const minigameEarned = Number(this.state.stats.minigameEarned || 0);
    const economyTotal = Math.max(1, this.state.stats.totalSpent + this.state.stats.totalEarned + getInventoryValue(this.state) + minigameSpent);
    const spentPct = (this.state.stats.totalSpent / economyTotal) * 100;
    const earnedPct = (this.state.stats.totalEarned / economyTotal) * 100;
    const inventoryPct = (getInventoryValue(this.state) / economyTotal) * 100;
    const economyStops = [
      `#f05d5e 0% ${spentPct.toFixed(2)}%`,
      `#45c486 ${spentPct.toFixed(2)}% ${(spentPct + earnedPct).toFixed(2)}%`,
      `#64d7e3 ${(spentPct + earnedPct).toFixed(2)}% ${(spentPct + earnedPct + inventoryPct).toFixed(2)}%`,
      `#ffd166 ${(spentPct + earnedPct + inventoryPct).toFixed(2)}% 100%`
    ];
    return `
      ${this.renderSectionTabs("stats")}
      <div class="stats-grid">
        ${statTile("Casse aperte", this.state.stats.casesOpened.toLocaleString("it-IT"), `${this.state.stats.manualOpens} manuali - ${this.state.stats.autoOpens} auto`)}
        ${statTile("Speso", formatCredits(this.state.stats.totalSpent), "casse + market")}
        ${statTile("Venduto", formatCredits(this.state.stats.totalEarned), "incassi skin")}
        ${statTile("Profit / Loss", `${profit >= 0 ? "+" : ""}${formatCredits(profit)}`, "include inventario")}
        ${statTile("Special", this.state.stats.jackpotHits, "knife / gloves / special")}
        ${statTile("Collezioni", this.state.stats.collections, `bonus x${getCollectionMultiplier(this.state).toFixed(2)}`)}
        ${statTile("Minigiochi", `${minigameEarned - minigameSpent >= 0 ? "+" : ""}${formatCredits(minigameEarned - minigameSpent)}`, `${formatCredits(minigameSpent, true)} puntati`)}
        ${statTile("Sessione", session.opens, `${session.opensPerMinute.toFixed(1)}/min - ${compactTime(session.durationMs)}`)}
      </div>
      <div class="progress-chart-grid">
        <section class="data-panel progress-chart-card">
          <h3>Drop per rarita'</h3>
          <div class="pie-chart" style="--pie:${rarityStops.join(", ")}"></div>
          <div class="chart-legend">
            ${RARITY_ORDER.map((rarity) => `<span style="--rarity:${RARITIES[rarity].color}">${escapeHtml(rarity)} <strong>${this.state.stats.rarityCounts[rarity] || 0}</strong></span>`).join("")}
          </div>
        </section>
        <section class="data-panel progress-chart-card">
          <h3>Economia</h3>
          <div class="pie-chart" style="--pie:${economyStops.join(", ")}"></div>
          <div class="chart-legend">
            <span style="--rarity:#f05d5e">Speso <strong>${formatCredits(this.state.stats.totalSpent, true)}</strong></span>
            <span style="--rarity:#45c486">Venduto <strong>${formatCredits(this.state.stats.totalEarned, true)}</strong></span>
            <span style="--rarity:#64d7e3">Locker <strong>${formatCredits(getInventoryValue(this.state), true)}</strong></span>
            <span style="--rarity:#ffd166">Minigiochi <strong>${formatCredits(minigameSpent, true)}</strong></span>
          </div>
        </section>
      </div>
      <div class="split-layout">
        <section class="data-panel">
          <h3>Skill profilo</h3>
          <div class="rarity-bars">
            <div class="rarity-row"><span>Fortuna</span><div><i style="width:${percent(skill.luck / 0.035)}"></i></div><strong>+${(skill.luck * 100).toFixed(1)}%</strong></div>
            <div class="rarity-row"><span>Fee vendita</span><div><i style="width:${percent(skill.sellFeeReduction / 0.025)}"></i></div><strong>-${(skill.sellFeeReduction * 100).toFixed(1)}%</strong></div>
            <div class="rarity-row"><span>Goal solo</span><div><i style="width:${percent(skill.goalDiscount / 0.1)}"></i></div><strong>-${(skill.goalDiscount * 100).toFixed(0)}%</strong></div>
            <div class="rarity-row"><span>Archivio</span><div><i style="width:${percent(Math.min(1, skill.collectionAssist / 5))}"></i></div><strong>+${skill.collectionAssist}</strong></div>
          </div>
        </section>
        <section class="data-panel">
          <h3>Minigiochi</h3>
          <div class="rarity-bars">
            <div class="rarity-row"><span>Partite</span><div><i style="width:${percent(Math.min(1, (this.state.minigames?.played || 0) / 100))}"></i></div><strong>${this.state.minigames?.played || 0}</strong></div>
            <div class="rarity-row"><span>Puntato</span><div><i style="width:${percent(Math.min(1, minigameSpent / Math.max(1, minigameSpent + minigameEarned)))}"></i></div><strong>${formatCredits(minigameSpent, true)}</strong></div>
            <div class="rarity-row"><span>Payout</span><div><i style="width:${percent(Math.min(1, minigameEarned / Math.max(1, minigameSpent + minigameEarned)))}"></i></div><strong>${formatCredits(minigameEarned, true)}</strong></div>
            <div class="rarity-row"><span>Best win</span><div><i style="width:${percent(Math.min(1, (this.state.minigames?.bestWin || 0) / Math.max(1, minigameEarned)))}"></i></div><strong>${formatCredits(this.state.minigames?.bestWin || 0, true)}</strong></div>
          </div>
        </section>
        <section class="data-panel">
          <h3>Miglior drop</h3>
          ${best ? itemCard(best, { compact: false }) : `<div class="empty-state">Ancora nessun drop.</div>`}
        </section>
        <section class="data-panel">
          <h3>Mastery casse</h3>
          <div class="case-mastery-list">
            ${topMastery.length ? topMastery.map(({ caseDef, mastery }) => `
              <div class="case-mastery-row">
                <img src="${caseDef.image}" alt="${escapeHtml(caseDef.name)}" loading="lazy" />
                <div>
                  <strong>${escapeHtml(caseDef.name)}</strong>
                  <span>Lv ${mastery.level} - +${Math.round(mastery.luckBonus * 1000) / 10}% fortuna - ${mastery.opens} aperture</span>
                  <div class="progress-line"><i style="width:${percent(mastery.progress)}"></i></div>
                </div>
              </div>
            `).join("") : `<div class="empty-state">Apri una cassa per iniziare la mastery.</div>`}
          </div>
        </section>
        <section class="data-panel">
          <h3>Cronologia sessione</h3>
          <div class="session-history-list">
            ${session.events.length ? session.events.map((entry) => `
              <div class="session-history-row ${entry.value > 0 ? "is-positive" : entry.value < 0 ? "is-negative" : ""}">
                <span>${new Date(entry.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                <strong>${escapeHtml(entry.title)}</strong>
                <small>${escapeHtml(entry.detail)}</small>
                <em>${entry.value === null || entry.value === undefined ? "" : `${entry.value >= 0 ? "+" : ""}${formatCredits(entry.value, true)}`}</em>
              </div>
            `).join("") : `<div class="empty-state">Nessuna azione registrata in questa sessione.</div>`}
          </div>
        </section>
      </div>
      <div class="stats-grid session-rollup">
        ${statTile("Sessione spesa", formatCredits(session.spent), "solo questa sessione")}
        ${statTile("Sessione incasso", formatCredits(session.earned), "vendite e auto-sell")}
        ${statTile("Sessione saldo", `${session.profit >= 0 ? "+" : ""}${formatCredits(session.profit)}`, "flusso locale")}
        ${statTile("Best sessione", session.bestDrop ? formatCredits(session.bestDrop.value, true) : "-", session.bestDrop?.name || "nessun picco")}
        ${statTile("Mastery casse", `Lv ${maxMastery}`, `${topMastery.length} casse allenate`)}
      </div>
    `;
  }

  selectCase(id) {
    const next = this.skinData.cases.find((caseDef) => caseDef.id === id);
    if (!next) {
      return;
    }
    if (!isCaseUnlocked(this.state, next)) {
      this.toast(`Serve Prestige ${next.unlockPrestige} per ${next.name}.`);
      return;
    }
    this.selectedCase = next;
    this.state.selectedCaseId = next.id;
    this.casePrestigeGroup = next.unlockPrestige || 0;
    const visibleCases = this.getFilteredCases();
    const caseIndex = visibleCases.findIndex((caseDef) => caseDef.id === next.id);
    if (caseIndex >= 0) {
      this.caseCarouselPage = caseIndex;
    }
    this.lastOpenedDropIds = [];
    this.renderCases();
    this.renderSelectedCase();
    this.renderOpenerActions();
    if (this.activeTab === "contracts" || this.activeTab === "market" || this.isMultiplayerTabActive()) {
      this.renderTab();
    }
  }

  showCaseInfo(id) {
    const caseDef = this.skinData.cases.find((candidate) => candidate.id === id);
    if (!caseDef) {
      return;
    }
    this.caseInfoOpenId = this.caseInfoOpenId === id ? null : id;
    this.renderCases();
  }

  async openSelectedCase(auto = false, forcedCount = null) {
    if (!this.isCloudLoggedIn()) {
      if (!auto) {
        this.toast("Accedi per giocare online.");
        this.renderLoginGate();
      }
      return;
    }
    if (this.isAnimating && !auto) {
      return;
    }
    if (!auto) {
      this.closeOpenResultSummary();
    }

    const count = this.selectedCase.manualOnly ? 1 : (forcedCount || getMultiOpenCount(this.state));
    const result = openCases(this.state, this.selectedCase, this.skinData, count, auto ? "auto" : "manual");
    if (!result.ok) {
      if (!auto) {
        this.toast(result.reason);
      }
      return;
    }

    const achievements = syncAchievements(this.state);
    achievements.forEach((achievement) => this.toast(`Achievement: ${achievement.name} (+${formatCredits(achievement.reward)})`));
    if (result.masteryLevelUps?.length) {
      const level = result.masteryLevelUps.at(-1);
      this.toast(`${this.selectedCase.name}: livello cassa ${level}. Fortuna mastery +${Math.round(result.mastery.luckBonus * 1000) / 10}%.`);
    }
    result.drops.filter((drop) => drop.event).forEach((drop) => this.toast(`${drop.event.label} attivo!`));
    result.drops.filter((drop) => drop.limitedEvent).forEach((drop) => this.toast(`${drop.limitedEvent.label}: evento limitato attivo.`));
    this.pendingRevealIds = result.drops.map((drop) => drop.item.id);
    this.lastOpenedDropIds = [];
    this.renderOpenerActions();
    this.renderHistory();

    const showcase = result.drops
      .map((drop) => drop.item)
      .sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.value - a.value)[0];
    if (!auto || !this.isAnimating) {
      await this.animateDrop(showcase);
    }

    this.pendingRevealIds = [];
    this.lastOpenedDropIds = result.drops
      .filter((drop) => !drop.autoSold)
      .map((drop) => drop.item.id);
    this.recordSessionOpen(this.selectedCase, result, showcase);

    this.playDropSound(showcase);
    if (auto && RARITIES[showcase.rarity].tier >= ECONOMY_CONFIG.rareRevealTier) {
      this.showRareReveal(showcase, result.drops.length);
    }
    this.renderDrops(result.drops);
    this.renderAll();
    this.queueSocialProfileSync();
    if (!auto) {
      this.showOpenResultSummary(this.selectedCase, result, showcase);
    }
  }

  buildReelItems(resultItem) {
    const items = [];
    const rarityWeights = this.selectedCase.profile;
    for (let index = 0; index < 42; index += 1) {
      const [rarity] = rarityWeights[Math.floor(Math.random() * rarityWeights.length)];
      const pool = this.selectedCase.pool[rarity]?.length ? this.selectedCase.pool[rarity] : this.selectedCase.pool[this.selectedCase.availableRarities[0]];
      const skin = pool[Math.floor(Math.random() * pool.length)];
      items.push(reelDisplayItem({
        name: skin.name,
        image: skin.image,
        rarity: skin.rarity,
        rarityColor: RARITIES[skin.rarity].color
      }));
    }
    items[36] = reelDisplayItem(resultItem);
    return items;
  }

  animateDrop(item) {
    const track = this.root.querySelector("#reelTrack");
    const frame = this.root.querySelector(".reel-frame");
    const duration = getOpenDuration(this.state);
    this.isAnimating = true;
    window.cancelAnimationFrame(this.reelTickFrame);
    this.renderOpenerActions();
    frame.style.setProperty("--rarity", item.rarityColor);
    frame.classList.remove("rarity-consumer", "rarity-industrial", "rarity-milspec", "rarity-restricted", "rarity-classified", "rarity-covert", "rarity-rare");
    frame.classList.add(rarityClass(item.rarity));

    const reelItems = this.buildReelItems(item);
    track.style.transition = "none";
    track.style.transform = "translateX(0px)";
    track.innerHTML = reelItems
      .map((reelItem) => `
        <div class="reel-item ${rarityClass(reelItem.rarity)}" style="--rarity:${reelItem.rarityColor}">
          ${reelItem.hiddenSpecial ? `<div class="reel-special-token">?</div>` : `<img src="${reelItem.image}" alt="${escapeHtml(reelItem.name)}" loading="eager" />`}
          <span>${escapeHtml(reelItem.name)}</span>
        </div>
      `)
      .join("");

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const itemWidth = 138;
        const targetIndex = 36;
        const frameWidth = frame.getBoundingClientRect().width || 760;
        const jitter = Math.random() * 54 - 27;
        const target = targetIndex * itemWidth - frameWidth / 2 + itemWidth / 2 + jitter;
        track.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.08,1)`;
        track.style.transform = `translateX(${-target}px)`;
        let lastTickIndex = 0;
        const tickLoop = () => {
          if (!this.isAnimating) {
            return;
          }
          const translateX = Math.abs(parseTransformX(window.getComputedStyle(track).transform));
          const tickIndex = Math.floor(translateX / itemWidth);
          if (tickIndex > lastTickIndex) {
            lastTickIndex = tickIndex;
            this.playReelTick(Math.min(1, tickIndex / targetIndex));
          }
          this.reelTickFrame = window.requestAnimationFrame(tickLoop);
        };
        this.reelTickFrame = window.requestAnimationFrame(tickLoop);
        window.setTimeout(() => {
          window.cancelAnimationFrame(this.reelTickFrame);
          this.isAnimating = false;
          frame.classList.add("hit-flash");
          window.setTimeout(() => frame.classList.remove("hit-flash"), 420);
          resolve();
        }, duration + 80);
      });
    });
  }

  playDropSound(item) {
    try {
      const context = this.ensureAudioContext();
      if (!context) {
        return;
      }
      const outputLevel = this.getAudioGain("drop");
      if (outputLevel <= 0) {
        return;
      }
      const tier = RARITIES[item.rarity].tier;
      const now = context.currentTime;
      const sparkle = context.createGain();
      sparkle.gain.setValueAtTime(0.0001, now);
      sparkle.gain.exponentialRampToValueAtTime((0.045 + tier * 0.01) * outputLevel, now + 0.018);
      sparkle.gain.exponentialRampToValueAtTime(0.0001, now + 0.42 + tier * 0.03);
      sparkle.connect(context.destination);

      const body = context.createGain();
      body.gain.setValueAtTime(0.0001, now);
      body.gain.exponentialRampToValueAtTime((0.03 + tier * 0.007) * outputLevel, now + 0.012);
      body.gain.exponentialRampToValueAtTime(0.0001, now + 0.28 + tier * 0.025);
      body.connect(context.destination);

      [0, 0.07, 0.15].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = tier >= 5 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(220 + tier * 70 + index * 90, now + offset);
        oscillator.connect(sparkle);
        oscillator.start(now + offset);
        oscillator.stop(now + 0.42 + offset);
      });

      if (tier >= 4) {
        const thump = context.createOscillator();
        thump.type = "sine";
        thump.frequency.setValueAtTime(120 + tier * 18, now);
        thump.frequency.exponentialRampToValueAtTime(72, now + 0.18);
        thump.connect(body);
        thump.start(now);
        thump.stop(now + 0.2);
      }
    } catch (error) {
      // Audio is optional and can be blocked until user interaction.
    }
  }

  ensureAudioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    this.audioContext ||= new AudioCtor();
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  playReelTick(progress = 0) {
    try {
      const context = this.ensureAudioContext();
      if (!context) {
        return;
      }
      const outputLevel = this.getAudioGain("reel");
      if (outputLevel <= 0) {
        return;
      }
      const now = context.currentTime;
      const tilt = Math.max(0, Math.min(1, progress));
      const click = context.createGain();
      click.gain.setValueAtTime(0.0001, now);
      click.gain.exponentialRampToValueAtTime((0.012 + (1 - tilt) * 0.009) * outputLevel, now + 0.0035);
      click.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      click.connect(context.destination);

      const chime = context.createGain();
      chime.gain.setValueAtTime(0.0001, now);
      chime.gain.exponentialRampToValueAtTime((0.008 + (1 - tilt) * 0.006) * outputLevel, now + 0.004);
      chime.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      chime.connect(context.destination);

      const clickOscillator = context.createOscillator();
      clickOscillator.type = "square";
      clickOscillator.frequency.setValueAtTime(1380 - tilt * 540, now);
      clickOscillator.frequency.exponentialRampToValueAtTime(840 - tilt * 180, now + 0.045);
      clickOscillator.connect(click);
      clickOscillator.start(now);
      clickOscillator.stop(now + 0.05);

      const chimeOscillator = context.createOscillator();
      chimeOscillator.type = "triangle";
      chimeOscillator.frequency.setValueAtTime(920 - tilt * 160, now);
      chimeOscillator.frequency.exponentialRampToValueAtTime(760 - tilt * 120, now + 0.05);
      chimeOscillator.connect(chime);
      chimeOscillator.start(now);
      chimeOscillator.stop(now + 0.06);
    } catch (error) {
      // Audio is optional and can be blocked until user interaction.
    }
  }

  playUiPulse(kind = "neutral", strength = 0.5) {
    try {
      const context = this.ensureAudioContext();
      if (!context) {
        return;
      }
      const outputLevel = this.getAudioGain(kind === "tick" ? "reel" : "drop");
      if (outputLevel <= 0) {
        return;
      }
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.004, strength * 0.028) * outputLevel, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      gain.connect(context.destination);

      const oscillator = context.createOscillator();
      oscillator.type = kind === "warning" ? "square" : kind === "jackpot" ? "triangle" : "sine";
      const base = kind === "jackpot" ? 680 : kind === "warning" ? 220 : 480;
      oscillator.frequency.setValueAtTime(base + strength * 120, now);
      oscillator.frequency.exponentialRampToValueAtTime(base * 0.82, now + 0.18);
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch (error) {
      // Audio is optional and can be blocked until user interaction.
    }
  }

  showRareReveal(item, batchSize = 1) {
    const overlay = this.root.querySelector("#rareReveal");
    if (!overlay) {
      return;
    }
    window.clearTimeout(this.revealTimer);
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="rare-reveal-card ${rarityClass(item.rarity)}" style="--rarity:${item.rarityColor}">
        <span>${escapeHtml(item.rarity)} drop</span>
        <img src="${item.image}" alt="${escapeHtml(item.name)}" />
        <h2>${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(item.wear)} - float ${Number(item.float).toFixed(6)} - ${formatCredits(item.value)}</p>
        <small>${batchSize > 1 ? `Miglior drop del batch x${batchSize}` : "Drop raro"}</small>
        <button class="primary-button small" data-action="close-reveal">OK</button>
      </div>
    `;
    this.revealTimer = window.setTimeout(() => {
      overlay.hidden = true;
    }, 5200);
  }

  closeOpenResultSummary() {
    const overlay = this.root.querySelector("#openResultOverlay");
    if (!overlay) {
      return;
    }
    window.clearTimeout(this.openResultAutoTimer);
    this.openResultAutoTimer = null;
    this.openResultExpanded = false;
    this.lastOpenResultData = null;
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  showOpenResultSummary(caseDef, result, showcase, { autoClose = true } = {}) {
    const overlay = this.root.querySelector("#openResultOverlay");
    if (!overlay) {
      return;
    }
    this.lastOpenResultData = { caseDef, result, showcase };
    if (autoClose) {
      this.openResultExpanded = false;
    }
    const sortedDrops = [...(result.drops || [])].sort((a, b) =>
      (RARITIES[b.item.rarity]?.tier || 0) - (RARITIES[a.item.rarity]?.tier || 0) ||
      Number(b.item.value || 0) - Number(a.item.value || 0) ||
      Number(a.autoSold) - Number(b.autoSold)
    );
    const topDrop = [...sortedDrops].sort((a, b) => Number(b.item.value || 0) - Number(a.item.value || 0))[0] || sortedDrops[0];
    if (!topDrop) {
      overlay.hidden = true;
      overlay.innerHTML = "";
      return;
    }

    const grossValue = Number(sortedDrops.reduce((sum, drop) => sum + Number(drop.item.value || 0), 0).toFixed(2));
    const sellableTop = !topDrop.autoSold && this.state.inventory.some((item) => item.id === topDrop.item.id && !item.locked);
    const keptCount = sortedDrops.filter((drop) => !drop.autoSold).length;
    const autoSoldCount = sortedDrops.length - keptCount;
    const raritySummary = RARITY_ORDER
      .slice()
      .reverse()
      .map((rarity) => ({
        rarity,
        count: sortedDrops.filter((drop) => drop.item.rarity === rarity).length
      }))
      .filter((entry) => entry.count > 0);

    window.clearTimeout(this.openResultAutoTimer);
    this.openResultAutoTimer = null;
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="open-result-card" style="--rarity:${topDrop.item.rarityColor}">
        <div class="open-result-head">
          <div>
            <span>${escapeHtml(caseDef.name)} - risultato finale</span>
            <h2>${result.opened > 1 ? `${result.opened} aperture` : "1 apertura"}</h2>
            <p>Mostra solo la skin piu' costosa. Valore totale batch: ${formatCredits(grossValue)}.</p>
          </div>
          <strong class="open-result-total">${formatCredits(grossValue)}</strong>
        </div>
        <div class="open-result-hero ${rarityClass(topDrop.item.rarity)}" style="--rarity:${topDrop.item.rarityColor}">
          <div class="open-result-hero-art">
            <img src="${topDrop.item.image}" alt="${escapeHtml(topDrop.item.name)}" loading="eager" />
          </div>
          <div class="open-result-hero-copy">
            <span>${escapeHtml(topDrop.item.rarity)} - skin piu' costosa</span>
            <h3>${escapeHtml(topDrop.item.name)}</h3>
            <p>${escapeHtml(topDrop.item.wear)} - float ${Number(topDrop.item.float).toFixed(6)} - ${topDrop.autoSold ? "auto-sold" : "tenuta in inventario"}</p>
            <div class="open-result-hero-metrics">
              ${statTile("Top drop", formatCredits(topDrop.item.value), topDrop.item.rarity)}
              ${statTile("Valore batch", formatCredits(grossValue), `${keptCount} tenute - ${autoSoldCount} auto-sell`)}
              ${statTile("Aperture", result.opened, caseDef.profileName)}
            </div>
          </div>
        </div>
        <div class="open-result-tags">
          ${raritySummary.map((entry) => `
            <span style="--rarity:${RARITIES[entry.rarity].color}">
              ${escapeHtml(entry.rarity)} ${entry.count}
            </span>
          `).join("")}
        </div>
        ${this.openResultExpanded ? `
        <div class="open-result-grid is-expanded">
          ${sortedDrops.map((drop, index) => `
            <article class="open-result-item ${rarityClass(drop.item.rarity)} ${drop.item.id === topDrop.item.id ? "is-top" : ""}" style="--rarity:${drop.item.rarityColor}">
              <div class="open-result-item-head">
                <span>#${index + 1}</span>
                ${drop.autoSold ? `<small class="open-result-auto">Auto-sell</small>` : `<small>Tenuta</small>`}
              </div>
              <div class="open-result-item-art" data-action="inspect-item" data-id="${drop.item.id}">
                <img src="${drop.item.image}" alt="${escapeHtml(drop.item.name)}" loading="lazy" />
              </div>
              <div class="open-result-item-copy" data-action="inspect-item" data-id="${drop.item.id}">
                <strong title="${escapeHtml(drop.item.name)}">${escapeHtml(drop.item.name)}</strong>
                <small>${escapeHtml(drop.item.rarity)} - ${escapeHtml(drop.item.wear)}</small>
              </div>
              <div class="open-result-item-footer">
                <div class="open-result-item-value">${formatCredits(drop.item.value, true)}</div>
                <button
                  class="open-result-item-lock ${drop.item.locked ? "is-locked" : ""}"
                  data-action="toggle-result-lock"
                  data-id="${drop.item.id}"
                  type="button"
                  title="${drop.autoSold ? "Gia' venduta dall'auto-sell" : drop.item.locked ? "Sblocca" : "Blocca"}"
                  ${drop.autoSold ? "disabled" : ""}
                >
                  ${iconMarkup(drop.item.locked ? "lock-keyhole" : "lock")}
                </button>
              </div>
            </article>
          `).join("")}
        </div>
        ` : ""}
        <div class="open-result-foot">
          <button class="primary-button small" data-action="sell-result-item" data-id="${topDrop.item.id}" ${sellableTop ? "" : "disabled"}>Vendi</button>
          <button class="ghost-button small" data-action="close-open-result">Chiudi</button>
          <button class="ghost-button small" data-action="toggle-open-result-details" ${sortedDrops.length > 1 ? "" : "disabled"}>${this.openResultExpanded ? "Nascondi" : "Vedi tutto"}</button>
          <button class="ghost-button small danger result-sell-all" data-action="sell-last-open" ${keptCount ? "" : "disabled"}>Vendi tutto</button>
        </div>
      </div>
    `;
    this.refreshIcons();
    if (autoClose) {
      this.openResultAutoTimer = window.setTimeout(() => {
        this.closeOpenResultSummary();
      }, 8000);
    }
  }

  toggleOpenResultDetails() {
    const data = this.lastOpenResultData;
    if (!data) {
      return;
    }
    window.clearTimeout(this.openResultAutoTimer);
    this.openResultAutoTimer = null;
    this.openResultExpanded = !this.openResultExpanded;
    this.showOpenResultSummary(data.caseDef, data.result, data.showcase, { autoClose: false });
  }

  findItem(id) {
    return this.state.inventory.find((item) => item.id === id) ||
      (this.state.dropHistory || []).find((item) => item.id === id) ||
      this.state.market.offers.flatMap((offer) => [offer.item]).find((item) => item.id === id);
  }

  inspectItem(id) {
    const item = this.findItem(id);
    if (!item) {
      return;
    }
    this.inspectedItem = item;
    this.renderInspector();
  }

  closeInspector() {
    const node = this.root.querySelector("#skinInspector");
    if (node) {
      node.hidden = true;
    }
    this.inspectedItem = null;
  }

  renderInspector() {
    const node = this.root.querySelector("#skinInspector");
    const item = this.inspectedItem;
    if (!node || !item) {
      return;
    }
    const inInventory = this.state.inventory.some((candidate) => candidate.id === item.id);
    const sellValue = getSellReturn(this.state, item);
    const floatPercent = Math.max(0, Math.min(100, Number(item.float || 0) * 100));
    node.hidden = false;
    node.innerHTML = `
      <div class="inspector-card ${rarityClass(item.rarity)}" style="--rarity:${item.rarityColor}">
        <button class="inspector-close" data-action="close-inspector">X</button>
        <div class="inspector-art">
          <img src="${item.image}" alt="${escapeHtml(item.name)}" />
        </div>
        <div class="inspector-info">
          <span>${escapeHtml(item.rarity)} - ${escapeHtml(item.caseName || "Drop")}</span>
          <h2>${escapeHtml(item.name)}</h2>
          <p>${escapeHtml(item.weapon || item.category)} - ${escapeHtml(item.collection || "No Collection")}</p>
          <div class="float-meter">
            <div><i style="left:${floatPercent}%"></i></div>
            <strong>${escapeHtml(item.wear)} - ${Number(item.float).toFixed(6)}</strong>
          </div>
          <div class="inspector-stats">
            ${statTile("Valore", formatCredits(item.value), "stima locale")}
            ${statTile("Vendita", formatCredits(sellValue), `${Math.round((1 - sellValue / Math.max(1, item.value)) * 100)}% fee`)}
            ${statTile("Flag", `${item.favorite ? "Fav " : ""}${item.locked ? "Lock" : item.crit ? "Crit" : "Normale"}`, item.marketCost ? `cost ${formatCredits(item.marketCost)}` : "inventario")}
          </div>
          <div class="inspector-actions">
            <button class="ghost-button" data-action="toggle-favorite" data-id="${item.id}" ${inInventory ? "" : "disabled"}>${item.favorite ? "Unfavorite" : "Favorite"}</button>
            <button class="ghost-button" data-action="toggle-lock" data-id="${item.id}" ${inInventory ? "" : "disabled"}>${item.locked ? "Unlock" : "Lock"}</button>
            <button class="primary-button small" data-action="sell-inspected" ${inInventory && !item.locked ? "" : "disabled"}>Vendi ${formatCredits(sellValue)}</button>
          </div>
        </div>
      </div>
    `;
  }

  renderDrops(drops) {
    const feed = this.root.querySelector("#dropFeed");
    if (!feed) {
      return;
    }
    feed.innerHTML = "";
  }

  getLastOpenedBatchState() {
    const ids = new Set(this.lastOpenedDropIds || []);
    const items = this.state.inventory.filter((item) => ids.has(item.id));
    return {
      items,
      count: items.length,
      total: items.reduce((sum, item) => sum + getSellReturn(this.state, item), 0)
    };
  }

  sellLastOpenedBatch() {
    const batch = this.getLastOpenedBatchState();
    if (!batch.count) {
      this.lastOpenedDropIds = [];
      this.renderOpenerActions();
      return;
    }
    const ids = new Set(batch.items.map((item) => item.id));
    const result = sellItems(this.state, (item) => ids.has(item.id));
    this.lastOpenedDropIds = this.lastOpenedDropIds.filter((id) => !result.sold.some((item) => item.id === id));
    this.session.earned += result.total;
    this.recordSessionEvent("sell", "Vendi risultato", `${result.sold.length} skin`, result.total);
    this.toast(`${result.sold.length} skin del risultato vendute per ${formatCredits(result.total)}.`);
    syncAchievements(this.state);
    this.closeOpenResultSummary();
    this.renderAll();
    this.queueSocialProfileSync();
  }

  sellResultItem(id) {
    window.clearTimeout(this.openResultAutoTimer);
    this.openResultAutoTimer = null;
    const item = this.state.inventory.find((candidate) => candidate.id === id);
    if (!item || item.locked) {
      this.toast(item?.locked ? "Skin bloccata: sbloccala prima di venderla." : "Skin non disponibile.");
      return;
    }
    const sold = sellItem(this.state, id);
    if (sold) {
      this.selectedInventory.delete(id);
      this.lastOpenedDropIds = this.lastOpenedDropIds.filter((candidateId) => candidateId !== id);
      this.session.earned += Number(sold.sellValue || 0);
      this.recordSessionEvent("sell", sold.name, "Vendita top risultato", sold.sellValue || 0);
      this.toast(`${sold.name} venduta per ${formatCredits(sold.sellValue || sold.value)}.`);
    }
    syncAchievements(this.state);
    this.closeOpenResultSummary();
    this.renderAll();
    this.queueSocialProfileSync();
  }

  toggleResultLock(id, button) {
    const item = toggleItemFlag(this.state, id, "locked");
    if (!item) {
      return;
    }
    window.clearTimeout(this.openResultAutoTimer);
    this.openResultAutoTimer = null;
    button?.classList.toggle("is-locked", Boolean(item.locked));
    button?.setAttribute("title", item.locked ? "Sblocca" : "Blocca");
    if (button) {
      button.innerHTML = iconMarkup(item.locked ? "lock-keyhole" : "lock");
      this.refreshIcons();
    }
    this.toast(`${item.name}: lock ${item.locked ? "on" : "off"}.`);
    if (this.lastOpenResultData) {
      this.showOpenResultSummary(
        this.lastOpenResultData.caseDef,
        this.lastOpenResultData.result,
        this.lastOpenResultData.showcase,
        { autoClose: false }
      );
    } else {
      this.renderOpenerActions();
    }
    this.queueSocialProfileSync();
  }

  toggleSelected(id) {
    if (this.selectedInventory.has(id)) {
      this.selectedInventory.delete(id);
    } else {
      this.selectedInventory.add(id);
    }
    this.renderTab();
  }

  selectPage() {
    this.getFilteredInventory()
      .slice((this.inventoryPage - 1) * INVENTORY_PAGE_SIZE, this.inventoryPage * INVENTORY_PAGE_SIZE)
      .filter((item) => !item.locked)
      .forEach((item) => this.selectedInventory.add(item.id));
    this.renderTab();
  }

  sellSelected() {
    const ids = new Set(this.selectedInventory);
    const result = sellItems(this.state, (item) => ids.has(item.id));
    result.sold.forEach((item) => this.selectedInventory.delete(item.id));
    this.session.earned += result.total;
    this.recordSessionEvent("sell", "Vendita selezione", `${result.sold.length} skin`, result.total);
    this.toast(`${result.sold.length} skin selezionate vendute per ${formatCredits(result.total)}.`);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  sellInspected() {
    if (!this.inspectedItem) {
      return;
    }
    const id = this.inspectedItem.id;
    this.sellItem(id);
    this.closeInspector();
  }

  toggleItemFlag(id, flag) {
    const item = toggleItemFlag(this.state, id, flag);
    if (item) {
      this.toast(`${item.name}: ${flag === "locked" ? "lock" : "favorite"} ${item[flag] ? "on" : "off"}.`);
      if (this.inspectedItem?.id === id) {
        this.inspectedItem = item;
        this.renderInspector();
      }
    }
    this.renderAll();
  }

  buyUpgrade(id) {
    const result = buyUpgrade(this.state, id);
    if (result.ok) {
      const label = UPGRADE_DEFINITIONS.find((upgrade) => upgrade.id === id)?.name || id;
      this.session.spent += Number(result.cost || 0);
      this.recordSessionEvent("upgrade", "Upgrade", label, -Number(result.cost || 0));
    }
    this.toast(result.ok ? "Upgrade acquistato." : result.reason);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  buyPrestigeNode(id) {
    const result = buyPrestigeNode(this.state, id);
    this.toast(result.ok ? `${result.node.name} potenziato.` : result.reason);
    this.renderAll();
  }

  claimCollection(name) {
    const result = claimCollectionReward(this.state, name, this.skinData);
    if (result.ok) {
      this.session.earned += Number(result.goal.reward || 0);
      this.recordSessionEvent("collection", result.goal.name, "Bonus collezione", result.goal.reward);
    }
    this.toast(result.ok ? `${result.goal.name}: +${formatCredits(result.goal.reward)} e bonus permanente.` : result.reason);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  startLimitedEvent() {
    const event = maybeStartLimitedEvent(this.state, { force: true });
    if (event) {
      this.recordSessionEvent("event", event.label, "Evento attivato", null);
    }
    this.toast(event ? `${event.label} attivo.` : "Evento gia' attivo.");
    syncAchievements(this.state);
    this.renderAll();
  }

  sellItem(id) {
    const item = sellItem(this.state, id);
    if (item) {
      this.selectedInventory.delete(id);
      this.session.earned += Number(item.sellValue || 0);
      this.recordSessionEvent("sell", item.name, "Vendita singola", item.sellValue || 0);
      this.toast(`${item.name} venduta per ${formatCredits(item.sellValue || item.value)}.`);
    }
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  sellFiltered() {
    const ids = new Set(this.getFilteredInventory().map((item) => item.id));
    const result = sellItems(this.state, (item) => ids.has(item.id));
    this.session.earned += result.total;
    this.recordSessionEvent("sell", "Vendi filtrate", `${result.sold.length} skin`, result.total);
    this.toast(`${result.sold.length} skin vendute per ${formatCredits(result.total)}.`);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  sellByMaxTier(maxTier) {
    const result = sellItems(this.state, (item) => RARITIES[item.rarity].tier <= maxTier);
    this.session.earned += result.total;
    this.recordSessionEvent("sell", "Vendi low-tier", `${result.sold.length} skin`, result.total);
    this.toast(`${result.sold.length} skin low-tier vendute per ${formatCredits(result.total)}.`);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  claimDaily() {
    const result = claimDailyReward(this.state);
    if (result.ok) {
      this.session.earned += Number(result.reward || 0);
      this.recordSessionEvent("daily", "Reward giornaliero", `Streak ${result.streak}`, result.reward);
    }
    this.toast(result.ok ? `Reward: ${formatCredits(result.reward)}. Streak ${result.streak}.` : result.reason);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  doPrestige() {
    const result = prestige(this.state);
    if (result.ok) {
      this.recordSessionEvent("prestige", "Prestige", `+${result.gainedShards} shard`, null);
    }
    this.toast(result.ok ? `Prestige completato: +${result.gainedShards} shard.` : result.reason);
    syncAchievements(this.state);
    this.selectedCase = this.getInitialCase();
    this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
    this.lastOpenedDropIds = [];
    this.jackpotPreview = null;
    this.jackpotSelection.clear();
    this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    this.renderAll();
  }

  runContract() {
    const result = runTradeUpContract(this.state, this.contractRarity, this.selectedCase, this.skinData);
    if (result.ok) {
      this.noteSessionBestDrop(result.item);
      this.recordSessionEvent("contract", "Trade-up", result.item.name, result.item.value || 0);
    }
    this.toast(result.ok ? `Contratto riuscito: ${result.item.name}.` : result.reason);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  buyOffer(id) {
    const result = buyMarketOffer(this.state, id);
    if (result.ok) {
      this.session.spent += Number(result.offer.price || 0);
      this.recordSessionEvent("market", result.offer.item.name, "Acquisto market", -Number(result.offer.price || 0));
    }
    this.toast(result.ok ? `Acquistata ${result.offer.item.name}.` : result.reason);
    syncAchievements(this.state);
    this.renderAll();
    this.queueSocialProfileSync();
  }

  ensureAutomaticGameLoopState() {
    this.state.minigames ||= {};
    this.state.minigames.roulette = {
      bet: 4,
      choice: "red",
      ...(this.state.minigames.roulette || {}),
      autoPlay: true
    };
    this.state.minigames.crash = {
      bet: 4,
      autoCashout: 1.6,
      roundDelay: 6,
      ...(this.state.minigames.crash || {}),
      autoPlay: true
    };
    this.state.minigames.jackpot = {
      ...(this.state.minigames.jackpot || {}),
      autoPlay: true
    };
  }

  startAutomaticGameLoops() {
    if (!this.isCloudLoggedIn()) {
      return;
    }
    this.ensureAutomaticGameLoopState();
    if (!this.rouletteAnimation?.spinning && !this.rouletteLoopTimer) {
      this.scheduleRouletteLoop(900);
    }
    if (!this.crashAnimation?.spinning && !this.crashLoopTimer) {
      this.scheduleCrashLoop(900);
    }
    if (!this.jackpotAnimation?.spinning && !this.jackpotLoopTimer) {
      this.scheduleJackpotLoop(1200);
    }
  }

  scheduleRouletteLoop(delay = 2400) {
    window.clearTimeout(this.rouletteLoopTimer);
    this.ensureAutomaticGameLoopState();
    this.rouletteLoopTimer = window.setTimeout(() => {
      this.rouletteLoopTimer = null;
      if (!this.rouletteAnimation?.spinning) {
        this.playRouletteGame(true);
      }
    }, delay);
  }

  playRouletteGame(autoLoop = false) {
    const bet = this.root.querySelector("#rouletteBet")?.value ?? this.state.minigames?.roulette?.bet;
    const choice = this.root.querySelector("#rouletteChoice")?.value ?? this.state.minigames?.roulette?.choice;
    const result = playRoulette(this.state, { bet, choice });
    if (!result.ok) {
      if (autoLoop) {
        this.scheduleRouletteLoop(5000);
      } else {
        this.toast(result.reason);
      }
      return;
    }
    this.rouletteAnimation = {
      ...result,
      angle: (Number(result.outcome) / 37) * 360 + 4,
      startedAt: Date.now(),
      durationMs: 2200,
      spinning: true
    };
    this.playUiPulse("tick", 0.42);
    this.renderAll();
    window.setTimeout(() => {
      if (this.rouletteAnimation?.playedAt === result.playedAt) {
        this.rouletteAnimation.spinning = false;
        if (this.activeTab === "games") {
          this.renderTab();
        }
      }
      this.playUiPulse(result.profit >= 0 ? "jackpot" : "warning", 0.68);
      this.session.earned += Math.max(0, Number(result.payout || 0));
      this.session.spent += Number(result.bet || 0);
      this.recordSessionEvent("game", result.game, result.detail, result.profit);
      this.publishSharedGameResult("roulette", result, { choice });
      this.toast(`${result.game}: ${result.detail} - ${result.profit >= 0 ? "+" : ""}${formatCredits(result.profit)}.`);
      this.queueSocialProfileSync();
      this.scheduleRouletteLoop(2200);
    }, 2200);
  }

  playPachinkoGame() {
    const bet = this.root.querySelector("#pachinkoBet")?.value ?? this.state.minigames?.pachinko?.bet;
    const result = playPachinko(this.state, { bet });
    if (!result.ok) {
      this.toast(result.reason);
      return;
    }
    this.pachinkoAnimation = {
      ...result,
      startedAt: Date.now(),
      durationMs: 2600,
      spinning: true
    };
    this.playUiPulse("tick", 0.3);
    this.renderAll();
    window.setTimeout(() => {
      if (this.pachinkoAnimation?.playedAt === result.playedAt) {
        this.pachinkoAnimation.spinning = false;
        if (this.activeTab === "games") {
          this.renderTab();
        }
      }
      this.playUiPulse(result.profit >= 0 ? "jackpot" : "warning", 0.56);
      this.session.earned += Math.max(0, Number(result.payout || 0));
      this.session.spent += Number(result.bet || 0);
      this.recordSessionEvent("game", result.game, `${result.label} ${result.detail}`, result.profit);
      this.publishSharedGameResult("pachinko", result, { label: result.label });
      this.toast(`${result.game}: ${result.label} ${result.detail} - ${result.profit >= 0 ? "+" : ""}${formatCredits(result.profit)}.`);
      this.queueSocialProfileSync();
    }, 2600);
  }

  playUpgraderGame() {
    const fallback = this.getFilteredGameInventory(this.getSocialLockerCandidates(), { allowCases: false, limit: 80 })
      .find((item) => item.type !== "rewardCase" && !item.locked);
    const selectedIds = [...this.upgraderSelection];
    const itemId = selectedIds[0] || this.state.minigames.upgrader.itemId || fallback?.id;
    const targetMultiplier = this.root.querySelector("#upgraderMultiplier")?.value || this.state.minigames.upgrader.targetMultiplier;
    const result = playUpgrader(this.state, this.skinData, { itemId, itemIds: selectedIds.length ? selectedIds : [itemId], targetMultiplier });
    if (!result.ok) {
      this.toast(result.reason);
      return;
    }
    (result.consumedItems || [result.consumedItem]).filter(Boolean).forEach((item) => {
      this.selectedInventory.delete(item.id);
      this.upgraderSelection.delete(item.id);
    });
    this.state.minigames.upgrader.itemIds = [];
    this.upgraderAnimation = {
      ...result,
      won: Boolean(result.playerWon),
      spinning: true
    };
    this.playUiPulse("tick", 0.46);
    this.session.spent += Number(result.bet || 0);
    this.session.earned += Number(result.payout || 0);
    this.recordSessionEvent("game", result.game, result.detail, result.profit);
    syncAchievements(this.state);
    this.renderAll();
    window.setTimeout(() => {
      this.upgraderAnimation = {
        ...this.upgraderAnimation,
        spinning: false
      };
      this.playUiPulse(result.playerWon ? "jackpot" : "warning", 0.78);
      this.publishSharedGameResult("upgrader", result, {
        consumed: result.consumedItem?.name,
        upgraded: result.upgradedItem?.name || ""
      });
      this.toast(result.playerWon ? `Upgrader: ${result.upgradedItem.name}.` : `Upgrader fallito: ${result.consumedItem.name} persa.`);
      this.renderAll();
      this.queueSocialProfileSync();
    }, 1700);
  }

  playCoinflipGame() {
    const bet = this.root.querySelector("#coinflipBet")?.value ?? this.state.minigames.coinflip.bet;
    const side = this.state.minigames.coinflip.side;
    const result = playCoinflip(this.state, { bet, side });
    if (!result.ok) {
      this.toast(result.reason);
      return;
    }
    this.coinflipAnimation = {
      ...result,
      startedAt: Date.now(),
      durationMs: 1500,
      spinning: true
    };
    this.playUiPulse("tick", 0.44);
    this.session.spent += Number(result.bet || 0);
    this.session.earned += Number(result.payout || 0);
    this.recordSessionEvent("game", result.game, result.detail, result.profit);
    syncAchievements(this.state);
    this.renderAll();
    window.setTimeout(() => {
      this.coinflipAnimation = {
        ...this.coinflipAnimation,
        spinning: false
      };
      this.playUiPulse(result.playerWon ? "jackpot" : "warning", 0.54);
      this.publishSharedGameResult("coinflip", result, { side });
      this.toast(`Coinflip: ${result.detail} - ${result.profit >= 0 ? "+" : ""}${formatCredits(result.profit)}.`);
      this.renderAll();
      this.queueSocialProfileSync();
    }, 1500);
  }

  async redeemPromo() {
    if (isGlobalPromoCodesAvailable() && !this.globalPromoCodes.length) {
      await this.initGlobalPromoCodes();
    }
    this.syncGlobalPromoCodesToState();
    const code = this.root.querySelector("#promoCodeInput")?.value || this.promoCodeDraft;
    const result = redeemPromoCode(this.state, code, this.skinData);
    this.toast(result.ok
      ? `${result.code}: +${formatCredits(result.credits)}${result.cases?.length ? `, ${result.cases.length} casse reward` : ""}${result.weapons?.length ? `, ${result.weapons.length} armi` : ""}.`
      : result.reason);
    if (result.ok) {
      this.promoCodeDraft = "";
      this.renderAll();
      this.queueSocialProfileSync();
    }
  }

  async depositGoal(id) {
    if (this.goalSyncBusy.has(id)) {
      return;
    }
    const input = [...this.root.querySelectorAll("[data-goal-deposit-input]")]
      .find((node) => node.dataset.goalDepositInput === id);
    const amount = input?.value || this.goalDepositAmounts[id];
    const currentGoal = this.getCommunityGoalRows().find((goal) => goal.id === id);
    const result = depositCommunityGoalCredits(this.state, id, amount);
    if (!result.ok) {
      this.toast(result.reason);
      return;
    }

    if (result.goal.scope === "community") {
      if (!isCommunityGoalsSyncAvailable()) {
        this.toast("Goal community non sincronizzato: Supabase non configurato.");
      } else {
        this.goalSyncBusy.add(id);
        this.renderTab();
        try {
          const contribution = await submitCommunityGoalContribution({
            goal: result.goal,
            amount: result.deposited,
            playerName: this.state.profile?.name || "Operatore"
          });
          if (contribution) {
            this.applySharedGoalContribution(contribution);
            this.sharedGoalStatus = "Sync community live";
          }
        } catch (error) {
          if (currentGoal?.key) {
            this.mergeSharedGoalTotals({ [currentGoal.key]: result.goal.contributed }, { replace: false });
          }
          this.sharedGoalStatus = "Sync community non disponibile";
          this.toast("Deposito salvato in locale. Sync Supabase goal community non disponibile.");
          this.goalSyncBusy.delete(id);
        }
        this.goalSyncBusy.delete(id);
      }
    }

    this.toast(`Depositati ${formatCredits(result.deposited)} su ${result.goal.label}.`);
    this.goalDepositAmounts[id] = "";
    this.renderAll();
    this.queueSocialProfileSync();
  }

  claimGoal(id) {
    const result = claimCommunityGoalReward(this.state, id, Date.now(), this.sharedGoalTotals);
    this.toast(result.ok ? `${result.goal.label}: ricevute ${result.rewardCases.length} casse reward.` : result.reason);
    if (result.ok) {
      this.renderAll();
      this.queueSocialProfileSync();
    }
  }

  openOwnedCase(id) {
    const result = openRewardCase(this.state, id, this.skinData);
    this.toast(result.ok ? `${result.rewardCase.name}: ${result.item.name}.` : result.reason);
    if (result.ok) {
      this.noteSessionBestDrop(result.item);
      syncAchievements(this.state);
      this.renderAll();
      this.queueSocialProfileSync();
    }
  }

  deleteOwnedCase(id) {
    const result = deleteRewardCase(this.state, id);
    this.toast(result.ok ? `${result.item.name} eliminata.` : result.reason);
    if (result.ok) {
      this.renderAll();
      this.queueSocialProfileSync();
    }
  }

  createAuction() {
    const fallback = this.getSocialLockerCandidates().find((item) => item.type !== "rewardCase" && !item.locked);
    const itemId = this.auctionItemId || fallback?.id;
    const price = this.root.querySelector("#auctionPrice")?.value || this.auctionPrice;
    const result = createAuctionListing(this.state, itemId, Number(String(price).replace(",", ".")));
    this.toast(result.ok ? `Inserzione Marketplace creata a ${formatCredits(result.listing.price)}.` : result.reason);
    if (result.ok) {
      createGlobalAuction({
        sellerName: this.state.profile?.name || "Operatore",
        item: result.listing.item,
        price: result.listing.price
      }).then((listing) => {
        if (listing) {
          result.listing.globalId = listing.id;
          this.applySharedAuction(listing);
          this.renderAll();
        }
      }).catch(() => {
        this.sharedGamesStatus = "Marketplace globale non disponibile";
      });
      this.auctionItemId = "";
      this.auctionPrice = "";
      this.renderAll();
      this.queueSocialProfileSync();
    }
  }

  settleAuction(id) {
    const result = settleAuctionListing(this.state, id);
    this.toast(result.ok
      ? result.sold
        ? `Inserzione venduta: +${formatCredits(result.payout)}.`
        : "Nessun acquirente ancora: inserzione estesa."
      : result.reason);
    if (result.ok) {
      this.renderAll();
      this.queueSocialProfileSync();
    }
  }

  async buySharedAuction(id) {
    const listing = this.sharedAuctions.find((entry) => entry.id === id);
    if (!listing || listing.status !== "active") {
      this.toast("Inserzione non disponibile.");
      return;
    }
    if (this.state.credits < listing.price) {
      this.toast("Crediti insufficienti per questa inserzione.");
      return;
    }
    try {
      const sold = await buyGlobalAuction({
        listingId: id,
        buyerName: this.state.profile?.name || "Operatore"
      });
      if (!sold) {
        throw new Error("Inserzione non disponibile.");
      }
      const item = {
        ...sold.item,
        id: `${sold.item?.id || "auction"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        obtainedAt: Date.now(),
        locked: false
      };
      this.state.credits -= sold.price;
      this.state.inventory.unshift(item);
      this.session.spent += Number(sold.price || 0);
      this.recordSessionEvent("market", item.name || "Marketplace globale", "Acquisto Marketplace globale", -Number(sold.price || 0));
      this.applySharedAuction(sold);
      this.publishSharedGameResult("auction", {
        game: "Marketplace globale",
        detail: `${item.name || "Skin"} acquistata`,
        bet: sold.price,
        payout: 0,
        profit: -sold.price,
        outcome: "sold"
      });
      this.toast(`Marketplace: ${item.name || "skin"} acquistata per ${formatCredits(sold.price)}.`);
      this.renderAll();
      this.queueSocialProfileSync();
    } catch (error) {
      this.toast(error.message || "Inserzione non disponibile.");
    }
  }

  saveProfileCard() {
    const name = (this.root.querySelector("#profileName")?.value || "").trim().slice(0, 18) || "Operatore";
    const title = (this.root.querySelector("#profileTitle")?.value || "").trim().slice(0, 28) || "Case Runner";
    const accent = this.root.querySelector("#profileAccent")?.value || "#7fe37c";
    const avatarIcon = this.root.querySelector("#profileAvatarIcon")?.value || "shield";
    this.state.profile = {
      ...this.state.profile,
      name,
      title,
      accent,
      avatarIcon: PROFILE_ICON_OPTIONS.some((option) => option.id === avatarIcon) ? avatarIcon : "shield",
      configured: true
    };
    this.profileSetupOpen = false;
    this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    this.toast(`Profilo aggiornato: ${name}.`);
    this.renderAll();
  }

  loadProfileAvatarFile(file) {
    if (!file || !file.type?.startsWith("image/")) {
      return;
    }
    if (file.size > 450000) {
      this.toast("Avatar troppo pesante. Usa un'immagine sotto 450 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.state.profile = {
        ...this.state.profile,
        avatarImage: String(reader.result || "")
      };
      this.renderTopStats();
      this.renderProfileSetup();
    };
    reader.readAsDataURL(file);
  }

  randomizeProfileCard() {
    const names = ["Operatore", "Axiom", "Spectre", "Maverick", "Noctis", "Ranger", "Cipher", "Vortex"];
    const titles = ["Case Runner", "Drop Hunter", "Jackpot Caller", "Market Maker", "Steam Ghost", "Vault Diver"];
    const accents = ["#7fe37c", "#64d7e3", "#f2b84b", "#a77cff", "#ff8b5c", "#8fa8ff"];
    this.state.profile = {
      ...this.state.profile,
      name: names[Math.floor(Math.random() * names.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      accent: accents[Math.floor(Math.random() * accents.length)],
      avatarIcon: PROFILE_ICON_OPTIONS[Math.floor(Math.random() * PROFILE_ICON_OPTIONS.length)].id
    };
    this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    this.renderTopStats();
    this.renderTechMenu();
    this.renderProfileSetup();
  }

  toggleJackpotItem(id) {
    const item = this.state.inventory.find((candidate) => candidate.id === id && !candidate.locked);
    if (!item) {
      return;
    }
    if (this.jackpotSelection.has(id)) {
      this.jackpotSelection.delete(id);
    } else {
      this.jackpotSelection.add(id);
    }
    if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
      this.renderTab();
    }
  }

  toggleUpgraderItem(id) {
    const item = this.state.inventory.find((candidate) => candidate.id === id && !candidate.locked && candidate.type !== "rewardCase");
    if (!item) {
      return;
    }
    if (this.upgraderSelection.has(id)) {
      this.upgraderSelection.delete(id);
    } else {
      this.upgraderSelection.add(id);
    }
    this.state.minigames.upgrader.itemIds = [...this.upgraderSelection];
    this.state.minigames.upgrader.itemId = [...this.upgraderSelection][0] || "";
  }

  async sendSocialChat() {
    const fieldValue = this.root.querySelector("#footerChatInput")?.value ?? this.root.querySelector("#socialChatInput")?.value ?? this.socialChatDraft;
    const message = String(fieldValue || "").trim();
    if (!message) {
      return;
    }
    if (!this.socialClient?.sendChatMessage) {
      this.toast("Chat globale non disponibile.");
      return;
    }
    try {
      const response = await this.socialClient.sendChatMessage({ message });
      this.socialChatDraft = "";
      if (response?.snapshot) {
        this.socialState = response.snapshot;
      }
      this.renderGlobalChatDock();
      if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
        this.renderTab();
      }
    } catch (error) {
      this.toast(error?.message?.includes("429") ? "Chat troppo veloce, aspetta un attimo." : (error?.message || "Impossibile inviare il messaggio."));
    }
  }

  async listSelectedMarketItem() {
    if (!this.socialClient?.listMarketItem) {
      this.toast("Marketplace globale non disponibile.");
      return;
    }
    const lockerItems = this.getSocialLockerCandidates();
    const query = String(this.socialMarketSearch || "").trim().toLowerCase();
    const filteredLocker = lockerItems.filter((item) => !query || `${item.name} ${item.rarity} ${item.wear} ${item.caseName}`.toLowerCase().includes(query));
    const selectedItem = lockerItems.find((item) => item.id === this.socialMarketItemId) || filteredLocker[0] || lockerItems[0] || null;
    if (!selectedItem) {
      this.toast("Seleziona una skin da listare.");
      return;
    }
    const openListings = (this.socialState?.market?.listings || [])
      .filter((listing) => listing.sellerId === this.socialConnection?.clientId).length;
    if (openListings >= 5) {
      this.toast("Puoi avere massimo 5 item attivi sul Marketplace.");
      return;
    }
    const requestedPrice = Number(String(this.socialMarketPrice || selectedItem.value || 0).replace(",", "."));
    if (!Number.isFinite(requestedPrice) || requestedPrice <= 0) {
      this.toast("Prezzo non valido.");
      return;
    }
    try {
      const response = await this.socialClient.listMarketItem({
        item: {
          ...selectedItem,
          value: Number(Number(selectedItem.value || 0).toFixed(2))
        },
        price: requestedPrice
      });
      this.removeInventoryItems([selectedItem.id]);
      this.socialMarketItemId = "";
      this.socialMarketPrice = "";
      this.socialState = response?.snapshot || this.socialState;
      this.recordSessionEvent("market", "Lista globale", selectedItem.name, requestedPrice);
      this.toast(`${selectedItem.name} listata sul market globale.`);
      this.queueSocialProfileSync();
      this.renderAll();
    } catch (error) {
      this.toast(error?.message || "Impossibile creare l'inserzione globale.");
    }
  }

  async buyGlobalListing(listingId) {
    if (!listingId || !this.socialClient?.buyMarketItem) {
      this.toast("Market globale non disponibile.");
      return;
    }
    const listing = (this.socialState?.market?.listings || []).find((entry) => entry.id === listingId);
    if (!listing) {
      this.toast("Inserzione non piu' disponibile.");
      return;
    }
    if (listing.sellerId === this.socialConnection?.clientId) {
      await this.cancelGlobalListing(listingId);
      return;
    }
    if (this.state.credits < listing.price) {
      this.toast("Crediti insufficienti per questa inserzione.");
      return;
    }
    try {
      const response = await this.socialClient.buyMarketItem({ listingId });
      this.state.credits = Number(Math.max(0, this.state.credits - Number(listing.price || 0)).toFixed(2));
      const receivedItems = this.receiveInventoryItems([response?.item || listing.item]);
      receivedItems.forEach((item) => this.noteSessionBestDrop(item));
      this.session.spent += Number(listing.price || 0);
      this.recordSessionEvent("market", listing.item.name, "Acquisto globale", -Number(listing.price || 0));
      this.socialState = response?.snapshot || this.socialState;
      this.toast(`Acquistata ${listing.item.name} dal market globale.`);
      this.queueSocialProfileSync();
      this.renderAll();
    } catch (error) {
      this.toast(error?.message || "Impossibile completare l'acquisto globale.");
    }
  }

  async cancelGlobalListing(listingId) {
    if (!listingId || !this.socialClient?.cancelMarketListing) {
      this.toast("Market globale non disponibile.");
      return;
    }
    const listing = (this.socialState?.market?.listings || []).find((entry) => entry.id === listingId);
    try {
      const response = await this.socialClient.cancelMarketListing({ listingId });
      if (response?.item) {
        this.receiveInventoryItems([response.item]);
      } else if (listing?.item) {
        this.receiveInventoryItems([listing.item]);
      }
      this.socialState = response?.snapshot || this.socialState;
      this.recordSessionEvent("market", "Ritira inserzione", listing?.item?.name || "Skin", null);
      this.toast("Inserzione ritirata dal market globale.");
      this.queueSocialProfileSync();
      this.renderAll();
    } catch (error) {
      this.toast(error?.message || "Impossibile ritirare l'inserzione.");
    }
  }

  async createTradeOffer() {
    if (!this.socialClient?.createTradeOffer) {
      this.toast("Trade globale non disponibile.");
      return;
    }
    const players = Array.isArray(this.socialState?.players) ? this.socialState.players.filter((player) => player.id !== this.socialConnection?.clientId) : [];
    const target = this.getSelectedTradeTarget() || players[0] || null;
    const myItems = this.getSocialLockerCandidates();
    const offerItem = myItems.find((item) => item.id === (this.socialTradeOfferItemId || myItems[0]?.id)) || myItems[0] || null;
    const requestedItem = (target?.lockerItems || []).find((item) => item.id === this.socialTradeRequestedItemId) || target?.lockerItems?.[0] || null;
    if (!target || !offerItem || !requestedItem) {
      this.toast("Completa target, offerta e richiesta per inviare il trade.");
      return;
    }
    try {
      const response = await this.socialClient.createTradeOffer({
        targetId: target.id,
        offeredItem: {
          ...offerItem,
          value: Number(Number(offerItem.value || 0).toFixed(2))
        },
        requestedItemId: requestedItem.id
      });
      this.removeInventoryItems([offerItem.id]);
      this.socialTradeOfferItemId = "";
      this.socialState = response?.snapshot || this.socialState;
      this.recordSessionEvent("trade", "Offerta inviata", `${offerItem.name} -> ${target.name}`, null);
      this.toast(`Offerta trade inviata a ${target.name}.`);
      this.queueSocialProfileSync();
      this.renderAll();
    } catch (error) {
      this.toast(error?.message || "Impossibile inviare la trade.");
    }
  }

  async acceptTradeOffer(offerId) {
    if (!offerId || !this.socialClient?.respondTradeOffer) {
      this.toast("Trade globale non disponibile.");
      return;
    }
    const offer = (this.socialState?.trades?.incoming || []).find((entry) => entry.id === offerId);
    const requestedLocalItem = this.state.inventory.find((item) => item.id === offer?.requestedItem?.id && !item.locked);
    if (!offer || !requestedLocalItem) {
      this.toast("La skin richiesta non e' piu' nel tuo locker.");
      return;
    }
    try {
      const response = await this.socialClient.respondTradeOffer({
        offerId,
        action: "accept",
        requestedItem: {
          ...requestedLocalItem,
          value: Number(Number(requestedLocalItem.value || 0).toFixed(2))
        }
      });
      this.removeInventoryItems([requestedLocalItem.id]);
      const receivedItems = this.receiveInventoryItems([response?.receivedItem || offer.offeredItem]);
      receivedItems.forEach((item) => this.noteSessionBestDrop(item));
      this.socialState = response?.snapshot || this.socialState;
      this.recordSessionEvent("trade", "Trade completata", `${offer.creatorName} -> ${offer.offeredItem.name}`, null);
      this.toast(`Trade accettata con ${offer.creatorName}.`);
      this.queueSocialProfileSync();
      this.renderAll();
    } catch (error) {
      this.toast(error?.message || "Impossibile accettare la trade.");
    }
  }

  async declineTradeOffer(offerId) {
    if (!offerId || !this.socialClient?.respondTradeOffer) {
      this.toast("Trade globale non disponibile.");
      return;
    }
    try {
      const response = await this.socialClient.respondTradeOffer({
        offerId,
        action: "decline"
      });
      this.socialState = response?.snapshot || this.socialState;
      this.toast("Trade rifiutata.");
      if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
        this.renderTab();
      }
    } catch (error) {
      this.toast(error?.message || "Impossibile rifiutare la trade.");
    }
  }

  reportSocialGameResult(mode, result, extra = {}) {
    if (!this.socialClient?.reportResult || !result) {
      return;
    }
    this.socialClient.reportResult({
      mode,
      won: Boolean(result.playerWon),
      profit: Number(result.profit || 0),
      stake: Number(result.bet || 0),
      ...extra
    }).then((response) => {
      if (response?.snapshot) {
        this.socialState = response.snapshot;
      }
      if (Number.isFinite(response?.delta) && response.delta !== 0) {
        const sign = response.delta > 0 ? "+" : "";
        this.toast(`Rank ${sign}${response.delta} pt · ${response?.rank?.name || "ladder"}.`);
      }
      if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
        this.renderTab();
      }
    }).catch(() => {});
  }

  normalizeCrashConfig() {
    const raw = this.state.minigames?.crash || {};
    const bet = Math.max(1, Math.min(1000000, Number(String(raw.bet ?? 4).replace(",", ".")) || 0));
    const autoCashout = Math.max(1.05, Math.min(50, Number(String(raw.autoCashout ?? 1.6).replace(",", ".")) || 1.6));
    const roundDelay = Math.max(3, Math.min(30, Number(String(raw.roundDelay ?? 6).replace(",", ".")) || 6));
    this.state.minigames.crash.bet = Number(bet.toFixed(2));
    this.state.minigames.crash.autoCashout = Number(autoCashout.toFixed(2));
    this.state.minigames.crash.roundDelay = Number(roundDelay.toFixed(0));
    return { bet, autoCashout, roundDelay };
  }

  setCrashBetShortcut(mode) {
    if (this.crashAnimation?.spinning) {
      return;
    }
    this.state.minigames.crash ||= {};
    const current = Number(String(this.root.querySelector("#crashBet")?.value ?? this.state.minigames.crash.bet ?? 4).replace(",", ".")) || 1;
    if (mode === "half") {
      this.state.minigames.crash.bet = Math.max(1, Number((current / 2).toFixed(2)));
    } else if (mode === "double") {
      this.state.minigames.crash.bet = Math.min(this.state.credits, Number((current * 2).toFixed(2)));
    } else if (mode === "max") {
      this.state.minigames.crash.bet = Math.max(1, Number(this.state.credits || 1));
    } else if (mode === "clear-auto") {
      this.state.minigames.crash.autoCashout = 25;
    }
    this.renderTab();
  }

  scheduleCrashLoop(delayMs = null) {
    this.ensureAutomaticGameLoopState();
    if (this.crashAnimation?.spinning) {
      return;
    }
    const { roundDelay } = this.normalizeCrashConfig();
    window.clearTimeout(this.crashLoopTimer);
    const nextDelay = Number.isFinite(delayMs) ? Math.max(300, Number(delayMs)) : roundDelay * 1000;
    this.crashNextRoundAt = Date.now() + nextDelay;
    this.crashLoopTimer = window.setTimeout(() => {
      this.crashLoopTimer = null;
      this.crashNextRoundAt = 0;
      if (!this.crashAnimation?.spinning) {
        this.playCrashGame(true);
      }
    }, nextDelay);
  }

  cancelCrashLoop() {
    window.clearTimeout(this.crashLoopTimer);
    this.crashLoopTimer = null;
    this.crashNextRoundAt = 0;
  }

  addCrashLogEntry(round) {
    const entry = {
      id: round.roundId,
      at: Date.now(),
      bet: Number(round.bet || 0),
      autoCashout: Number(round.autoCashout || 0),
      status: "live",
      profit: 0,
      cashoutPoint: 0,
      crashPoint: 0
    };
    this.crashBetLog = [entry, ...this.crashBetLog].slice(0, 24);
  }

  updateCrashLogEntry(result, round) {
    const roundId = round?.roundId;
    this.crashBetLog = this.crashBetLog.map((entry) => {
      if (entry.id !== roundId) {
        return entry;
      }
      return {
        ...entry,
        status: result.playerWon ? "win" : "loss",
        profit: Number(result.profit || 0),
        cashoutPoint: Number(round?.cashedOutAt || 0),
        crashPoint: Number(round?.crashPoint || 0)
      };
    });
  }

  playCrashGame(autoLoop = false) {
    if (this.crashAnimation?.spinning) {
      return;
    }
    this.cancelCrashLoop();
    const { bet, autoCashout } = this.normalizeCrashConfig();
    const round = startCrashRound(this.state, { bet, autoCashout });
    if (!round.ok) {
      if (autoLoop) {
        this.scheduleCrashLoop(5000);
      } else {
        this.toast(round.reason);
      }
      return;
    }
    window.clearInterval(this.crashTimer);
    this.crashAnimation = {
      ...round,
      roundId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      autoLoop,
      startedAt: Date.now(),
      flightMs: Math.round(clamp(1600 + Math.log(Math.max(1.05, round.crashPoint)) * 2450, 1800, 10500)),
      displayPoint: 1,
      spinning: true,
      crashed: false,
      cashedOutAt: 0,
      resolvedResult: null
    };
    this.addCrashLogEntry(this.crashAnimation);
    this.playUiPulse("tick", 0.32);
    this.renderAll();
    this.crashTimer = window.setInterval(() => {
      if (!this.crashAnimation) {
        window.clearInterval(this.crashTimer);
        return;
      }
      const elapsed = Date.now() - this.crashAnimation.startedAt;
      const progress = Math.min(1, elapsed / Math.max(600, this.crashAnimation.flightMs || 3200));
      const exponent = Math.log(Math.max(1.03, this.crashAnimation.crashPoint || 1.03));
      const point = Math.exp(exponent * progress);
      this.crashAnimation.displayPoint = Number(Math.min(this.crashAnimation.crashPoint, point).toFixed(point >= 10 ? 1 : 2));
      if (!this.crashAnimation.cashedOutAt && this.crashAnimation.displayPoint >= this.crashAnimation.autoCashout) {
        this.cashOutActiveCrash(true);
      }
      if (Math.floor(elapsed / 220) !== Math.floor((elapsed - 60) / 220)) {
        this.playUiPulse(progress > 0.86 ? "warning" : "tick", 0.18 + progress * 0.16);
      }
      if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
        this.renderTab();
      }
      if (progress >= 1) {
        this.finishActiveCrashRound();
      }
    }, 60);
  }

  cashOutActiveCrash(auto = false) {
    if (!this.crashAnimation?.spinning || this.crashAnimation?.cashedOutAt) {
      return;
    }
    const cashoutPoint = Number(Math.max(1.01, Math.min(this.crashAnimation.displayPoint, this.crashAnimation.crashPoint)).toFixed(2));
    this.crashAnimation.cashedOutAt = cashoutPoint;
    this.crashAnimation.cashoutMode = auto ? "auto" : "manual";
    this.playUiPulse("jackpot", auto ? 0.3 : 0.42);
    if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
      this.renderTab();
    }
  }

  finishActiveCrashRound() {
    if (!this.crashAnimation) {
      return;
    }
    window.clearInterval(this.crashTimer);
    const activeRound = this.crashAnimation;
    activeRound.spinning = false;
    activeRound.crashed = true;
    activeRound.displayPoint = activeRound.crashPoint;
    const result = settleCrashRound(this.state, activeRound, {
      cashoutPoint: activeRound.cashedOutAt || 0
    });
    activeRound.resolvedResult = result;
    this.updateCrashLogEntry(result, activeRound);
    this.playUiPulse(result.profit >= 0 ? "jackpot" : "warning", 0.76);
    this.session.earned += Math.max(0, Number(result.payout || 0));
    this.session.spent += Number(result.bet || 0);
    this.recordSessionEvent("game", result.game, result.detail, result.profit);
    this.socialClient?.publishActivity?.("crash", {
      title: result.game,
      detail: result.detail,
      value: result.profit
    }).catch(() => {});
    this.publishSharedGameResult("crash", result, {
      crashPoint: activeRound.crashPoint,
      cashoutPoint: activeRound.cashedOutAt || 0
    });
    this.reportSocialGameResult("crash", result);
    this.queueSocialProfileSync();
    if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
      this.renderTab();
    }
    this.toast(`${result.game}: ${result.detail} - ${result.profit >= 0 ? "+" : ""}${formatCredits(result.profit)}.`);
    this.scheduleCrashLoop();
    window.setTimeout(() => {
      if (this.crashAnimation === activeRound) {
        this.crashAnimation = {
          ...activeRound,
          spinning: false
        };
        if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
          this.renderTab();
        }
      }
    }, 120);
  }

  scheduleJackpotLoop(delay = 2500) {
    window.clearTimeout(this.jackpotLoopTimer);
    this.ensureAutomaticGameLoopState();
    this.jackpotLoopTimer = window.setTimeout(() => {
      this.jackpotLoopTimer = null;
      this.tryStartJackpotLoop();
    }, Math.max(500, Number(delay) || 2500));
  }

  tryStartJackpotLoop() {
    if (this.jackpotAnimation?.spinning) {
      return;
    }
    const selectedLobby = this.getSelectedJackpotLobby();
    const jackpotState = this.getJackpotSelectionState();
    const onlinePlayers = this.getJackpotPresencePlayers();
    const opponents = this.getJackpotOpponents();
    if (selectedLobby?.compatible && jackpotState.selectedItems.length && onlinePlayers.length >= 2 && opponents.length) {
      this.playJackpotGame(true);
      return;
    }
    this.scheduleJackpotLoop(3000);
  }

  playJackpotGame(autoLoop = false) {
    const selectedLobby = this.getSelectedJackpotLobby();
    if (!selectedLobby?.compatible) {
      if (!autoLoop) {
        this.toast("Scegli una lobby compatibile prima di entrare nel jackpot.");
      }
      this.scheduleJackpotLoop(3000);
      this.renderTab();
      return;
    }
    const onlinePlayers = this.getJackpotPresencePlayers();
    const opponents = this.getJackpotOpponents();
    if (onlinePlayers.length < 2 || !opponents.length) {
      if (!autoLoop) {
        this.toast("Il jackpot aspetta almeno 2 utenti online.");
      }
      this.scheduleJackpotLoop(3000);
      this.renderTab();
      return;
    }
    const result = playJackpot(this.state, this.skinData, {
      itemIds: [...this.jackpotSelection],
      opponents
    });
    if (!result.ok) {
      if (!autoLoop) {
        this.toast(result.reason);
      }
      this.scheduleJackpotLoop(3000);
      return;
    }
    (result.depositedItems || []).forEach((item) => this.selectedInventory.delete(item.id));
    this.jackpotSelection.clear();
    window.clearInterval(this.jackpotTimer);
    this.jackpotPreview = null;
    this.jackpotAnimation = {
      ...result,
      spinning: true,
      highlightIndex: 0
    };
    this.playUiPulse("tick", 0.24);
    this.socialClient?.enterJackpot?.({
      value: result.bet,
      itemCount: result.depositedItems?.length || 0,
      items: (result.depositedItems || []).map((item) => ({
        ...item,
        value: Number(Number(item.value || 0).toFixed(2))
      })),
      detail: result.detail
    }).catch(() => {});
    this.renderAll();
    let tick = 0;
    const totalTicks = 28;
    this.jackpotTimer = window.setInterval(() => {
      tick += 1;
      if (!this.jackpotAnimation) {
        window.clearInterval(this.jackpotTimer);
        return;
      }
      const count = Math.max(1, this.jackpotAnimation.participants.length);
      this.jackpotAnimation.highlightIndex = tick % count;
      if (tick % 2 === 0) {
        this.playUiPulse("tick", 0.14 + tick / totalTicks * 0.12);
      }
      if (this.activeTab === "games" || this.isMultiplayerTabActive()) {
        this.renderTab();
      }
      if (tick >= totalTicks) {
        window.clearInterval(this.jackpotTimer);
        this.jackpotAnimation.spinning = false;
        this.jackpotPreview = result;
        this.jackpotAnimation = null;
        this.playUiPulse(result.profit >= 0 ? "jackpot" : "warning", 0.85);
        this.session.spent += Number(result.bet || 0);
        this.session.earned += Number(result.payout || 0);
        this.recordSessionEvent("game", result.game, result.detail, result.profit);
        this.publishSharedGameResult("jackpot", result, {
          winnerName: result.winnerName,
          participants: result.participants?.length || 0
        });
        this.reportSocialGameResult("jackpot", result);
        this.queueSocialProfileSync();
        if (result.playerWon && result.wonItems?.length) {
          this.jackpotWinPopup = { items: result.wonItems };
        }
        this.toast(`${result.game}: ${result.winnerName} - ${result.profit >= 0 ? "+" : ""}${formatCredits(result.profit)}.`);
        this.renderAll();
        this.scheduleJackpotLoop(3600);
      }
    }, 140);
  }

  cheatAddCredits() {
    const amount = cheatAddCredits(this.state, this.root.querySelector("#cheatCredits")?.value);
    this.toast(`Cheat: +${formatCredits(amount)}.`);
    this.renderAll();
  }

  cheatSetCredits() {
    const amount = cheatSetCredits(this.state, this.root.querySelector("#cheatCredits")?.value);
    this.toast(`Cheat: saldo impostato a ${formatCredits(amount)}.`);
    this.renderAll();
  }

  cheatAddPrestige() {
    const levels = cheatAddPrestigeLevels(this.state, this.root.querySelector("#cheatPrestige")?.value);
    this.selectedCase = this.getInitialCase();
    this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
    this.lastOpenedDropIds = [];
    this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    this.toast(`Cheat: +${levels} Prestige.`);
    this.renderAll();
  }

  cheatAddShards() {
    const shards = cheatAddShards(this.state, this.root.querySelector("#cheatShards")?.value);
    this.toast(`Cheat: +${shards} shard.`);
    this.renderAll();
  }

  cheatUnlockCases() {
    const required = cheatUnlockAllCases(this.state, this.skinData.cases);
    this.selectedCase = this.getInitialCase();
    this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
    this.lastOpenedDropIds = [];
    this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    this.toast(`Cheat: casse sbloccate fino a P${required}.`);
    this.renderAll();
  }

  cheatMaxUpgrades() {
    const count = cheatMaxUpgrades(this.state);
    this.toast(`Cheat: ${count} upgrade portati al massimo.`);
    this.renderAll();
  }

  cheatMasterCase() {
    const mastery = cheatSetCaseMastery(this.state, this.selectedCase.id, this.root.querySelector("#cheatCaseMastery")?.value);
    this.toast(`Cheat: ${this.selectedCase.name} mastery Lv ${mastery.level}.`);
    this.renderAll();
  }

  cheatResetCooldowns() {
    this.state.daily.lastClaimDate = null;
    this.state.limitedEvent.nextAt = 0;
    this.state.limitedEvent.expiresAt = 0;
    this.state.event.expiresAt = 0;
    this.toast("Cheat: cooldown daily/eventi resettati.");
    this.renderAll();
  }

  async cheatCompleteGoals() {
    const beforeGoals = this.getCommunityGoalRows();
    const goals = cheatCompleteCommunityGoals(this.state);
    if (isCommunityGoalsSyncAvailable()) {
      await Promise.all(beforeGoals
        .filter((goal) => goal.scope === "community")
        .map(async (goal) => {
          const missing = Math.max(0, goal.target - Math.max(goal.sharedContributed, goal.personalContributed));
          if (missing <= 0) {
            return;
          }
          try {
            const contribution = await submitCommunityGoalContribution({
              goal,
              amount: missing,
              playerName: "Admin"
            });
            if (contribution) {
              this.applySharedGoalContribution(contribution);
            }
          } catch (error) {
            this.sharedGoalStatus = "Sync community non disponibile";
          }
        }));
    }
    this.toast(`Goal pronti: ${goals.length}. Vai in Community per ritirare i reward.`);
    this.renderAll();
  }

  async cheatResetCommunityGoals() {
    const goals = this.getCommunityGoalRows();
    resetCommunityGoalState(this.state);
    this.sharedGoalTotals = {};
    this.seenSharedGoalContributionIds.clear();
    if (isCommunityGoalsSyncAvailable()) {
      try {
        const resets = await submitCommunityGoalReset(
          goals.filter((goal) => goal.scope === "community").map((goal) => goal.key),
          this.state.profile?.name || "Admin",
          this.getAdminRpcCredentials()
        );
        resets.forEach((reset) => this.applyCommunityGoalReset(reset));
        this.sharedGoalStatus = "Goal community resettati";
      } catch (error) {
        this.sharedGoalStatus = "Reset community non sincronizzato";
        this.toast("Reset locale completato, ma Supabase non ha accettato il reset globale.");
      }
    }
    this.toast("Goal community resettati.");
    this.renderAll();
  }

  async adminCreatePromo() {
    const result = createPromoCode(this.state, {
      code: this.adminPromoCode,
      credits: this.adminPromoCredits,
      cases: this.adminPromoCases,
      rewardTier: this.adminPromoTier,
      weapons: this.adminPromoWeapons,
      weaponRarity: this.adminPromoRarity
    });
    if (result.ok && isGlobalPromoCodesAvailable()) {
      try {
        const promo = await upsertGlobalPromoCode({
          code: result.code,
          reward: result.reward,
          active: true,
          ...this.getAdminRpcCredentials()
        });
        if (promo) {
          this.globalPromoCodes = [promo, ...this.globalPromoCodes.filter((entry) => entry.code !== promo.code)];
          this.globalPromoStatus = "Promo globali online";
          this.syncGlobalPromoCodesToState();
        }
      } catch (error) {
        this.globalPromoStatus = "Promo globale non salvato online";
        this.toast(error.message || "Promo locale creato, ma sync online fallita.");
      }
    }
    this.toast(result.ok ? `Promo ${result.code} ${this.adminPromoEditingCode ? "aggiornata" : "creata"}.` : result.reason);
    if (result.ok) {
      this.adminPromoCode = "";
      this.adminPromoEditingCode = "";
      this.adminPromoWeapons = "0";
      this.renderAll();
    }
  }

  adminEditPromo(code) {
    const normalized = String(code || "").trim().toUpperCase();
    const reward = this.globalPromoCodes.find((promo) => promo.code === normalized)?.reward ||
      this.state.promoCodes?.custom?.[normalized];
    if (!reward) {
      this.toast("Promo code non trovato.");
      return;
    }
    this.adminPromoEditingCode = normalized;
    this.adminPromoCode = normalized;
    this.adminPromoCredits = String(reward.credits || 0);
    this.adminPromoCases = String(reward.cases || 0);
    this.adminPromoTier = String(reward.rewardTier || 1);
    this.adminPromoWeapons = String(reward.weapons || 0);
    this.adminPromoRarity = reward.weaponRarity || "Mil-Spec";
    this.renderAll();
  }

  async adminDeletePromo(code) {
    const normalized = String(code || "").trim().toUpperCase();
    const isGlobal = this.globalPromoCodes.some((promo) => promo.code === normalized);
    const result = deletePromoCode(this.state, normalized);
    if (!result.ok && !isGlobal) {
      this.toast(result.reason);
      return;
    }
    if (isGlobalPromoCodesAvailable() && isGlobal) {
      try {
        await deleteGlobalPromoCode(normalized, this.getAdminRpcCredentials());
        this.globalPromoCodes = this.globalPromoCodes.filter((promo) => promo.code !== normalized);
        this.globalPromoStatus = "Promo globale eliminato";
      } catch (error) {
        this.globalPromoStatus = "Eliminazione promo online fallita";
        this.toast(error.message || "Promo eliminato localmente, ma non online.");
      }
    }
    this.toast(`Promo ${normalized} eliminata.`);
    if (this.adminPromoEditingCode === normalized) {
      this.adminClearPromoForm();
    } else {
      this.renderAll();
    }
  }

  adminClearPromoForm() {
    this.adminPromoEditingCode = "";
    this.adminPromoCode = "";
    this.adminPromoCredits = "1000";
    this.adminPromoCases = "0";
    this.adminPromoTier = "2";
    this.adminPromoWeapons = "0";
    this.adminPromoRarity = "Mil-Spec";
    this.renderAll();
  }

  showExport(button) {
    const payload = exportState(this.state);
    navigator.clipboard?.writeText(payload);
    button.textContent = "Copiato";
    window.setTimeout(() => {
      button.textContent = "Export";
    }, 1200);
    this.toast("Save esportato negli appunti.");
  }

  importSave() {
    const payload = window.prompt("Incolla il codice save esportato:");
    if (!payload) {
      return;
    }
    try {
      this.state = importState(payload);
      this.selectedCase = this.getInitialCase();
      this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
      this.lastOpenedDropIds = [];
      this.jackpotPreview = null;
      this.jackpotSelection.clear();
      this.profileSetupOpen = !this.state.profile?.configured;
      this.resetSessionState();
      this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
      this.toast("Save importato.");
      this.renderAll();
    } catch (error) {
      this.toast("Import non valido.");
    }
  }

  resetSave() {
    if (!window.confirm("Resettare completamente il save locale?")) {
      return;
    }
    this.state = resetState();
    this.selectedCase = this.getInitialCase();
    this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
    this.lastOpenedDropIds = [];
    this.jackpotPreview = null;
    this.jackpotSelection.clear();
    this.profileSetupOpen = !this.state.profile?.configured;
    this.resetSessionState();
    this.socialClient?.syncProfile?.(this.getSocialProfilePayload()).catch(() => {});
    this.toast("Save resettato.");
    this.renderAll();
  }

  tick() {
    clearExpiredEvent(this.state);
    this.startAutomaticGameLoops();
    this.renderTopStats();
    if (!this.isEditingSessionControls()) {
      this.renderSession();
    }
    this.renderOpenerActions();
    this.renderHistory();
    if (this.activeTab === "community" && Date.now() - this.lastSharedGoalSyncAt > 30000) {
      this.refreshCommunityGoals({ silent: true });
    }
    if (this.activeTab === "games" && isSharedGamesAvailable() && Date.now() - this.lastSharedGamesSyncAt > 30000) {
      this.refreshSharedGames({ silent: true });
    }
    if (!this.isEditingAppControl() && ["stats", "prestige", "market", "collections", "achievements", "shop", "community", "games"].includes(this.activeTab)) {
      this.renderTab();
    }
  }

  autoTick() {
    if (!this.isCloudLoggedIn()) {
      return;
    }
    const interval = getAutoInterval(this.state);
    if (this.isAnimating || !Number.isFinite(interval) || this.selectedCase.manualOnly || Date.now() - this.lastAutoAt < interval) {
      return;
    }
    this.lastAutoAt = Date.now();
    this.openSelectedCase(true, 1);
  }

  setSaved(saved) {
    const node = this.root.querySelector("#saveState");
    if (node) {
      node.textContent = saved ? "Salvato" : "Modificato";
      node.classList.toggle("is-dirty", !saved);
    }
  }

  toast(message) {
    const id = `${Date.now()}-${Math.random()}`;
    this.toasts = [...this.toasts, { id, message }].slice(-3);
    this.renderToasts();
    window.setTimeout(() => {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
      this.renderToasts();
    }, 3600);
  }

  renderToasts() {
    const node = this.root.querySelector("#toastStack");
    if (!node) {
      return;
    }
    node.innerHTML = this.toasts.map((toast) => `<div class="toast">${escapeHtml(toast.message)}</div>`).join("");
  }

  readCookieConsent() {
    try {
      return JSON.parse(localStorage.getItem("case-opener-cookie-consent-v1") || "null");
    } catch (error) {
      return null;
    }
  }

  setCookieConsent(status) {
    this.cookieConsent = {
      status: status === "accepted" ? "accepted" : "rejected",
      analytics: false,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem("case-opener-cookie-consent-v1", JSON.stringify(this.cookieConsent));
    } catch (error) {
      // Consent storage is non-critical; the banner can show again.
    }
    this.renderLegalLayer();
  }

  openLegalModal(page) {
    this.legalModal = ["privacy", "terms", "cookies"].includes(page) ? page : "privacy";
    this.renderLegalLayer();
  }

  closeLegalModal() {
    this.legalModal = null;
    this.renderLegalLayer();
  }

  getLegalCopy(page) {
    const updatedAt = "16/05/2026";
    const common = {
      privacy: {
        title: "Privacy Policy",
        intro: "Questa informativa descrive quali dati vengono usati dal gioco per account, salvataggi, chat e funzionamento dell'interfaccia.",
        rows: [
          ["Titolare e contatti", "Prima della pubblicazione ufficiale vanno indicati nome o ragione sociale del titolare, contatto email e canale per richieste privacy."],
          ["Dati account", "Se accedi con username/password vengono usati username tecnico, identificativo account Supabase e dati di sessione. Se accedi con Discord vengono letti nome/username Discord e identificativo provider forniti tramite Supabase Auth."],
          ["Dati di gioco", "Il gioco può salvare crediti virtuali, inventario virtuale, progressione, casse aperte, statistiche, preferenze audio/UI e profilo giocatore."],
          ["Economia virtuale", "Promo code, Marketplace, goal community, reward case e minigiochi usano solo dati virtuali interni al gioco e possono essere ribilanciati o resettati per sicurezza tecnica."],
          ["Chat", "I messaggi chat possono includere nome profilo, team scelto, testo del messaggio, identificativo tecnico e data/ora. La chat è visibile agli altri utenti del gioco."],
          ["Finalità", "I dati servono per autenticazione, salvataggio cloud, salvataggio locale, continuità della progressione, chat globale, sicurezza base e corretto funzionamento del gioco."],
          ["Base giuridica", "Le funzioni essenziali sono trattate per fornire il servizio richiesto. Eventuali funzioni facoltative come analytics, pubblicità o marketing richiederanno consenso separato prima dell'attivazione."],
          ["Conservazione", "I dati locali restano nel browser finché non vengono cancellati. I dati cloud restano associati all'account finché l'account o il relativo salvataggio non vengono rimossi."],
          ["Servizi esterni", "Supabase fornisce autenticazione, database e realtime. Discord può essere usato come provider di login. ByMykel CSGO API fornisce metadata e immagini delle skin."],
          ["Recupero account", "Il login username/password senza email non consente recupero automatico della password. Per recupero autonomo va usato Discord o va aggiunta una procedura email prima della pubblicazione."],
          ["Diritti utente", "Puoi chiedere accesso, rettifica, cancellazione, limitazione o portabilità dei dati quando applicabile. Prima del lancio pubblico va aggiunto il canale ufficiale per queste richieste."]
        ]
      },
      cookies: {
        title: "Cookie Policy",
        intro: "Il gioco usa storage locale e dati di sessione necessari. Non sono attivi cookie pubblicitari o analytics.",
        rows: [
          ["Storage necessario", "LocalStorage e IndexedDB possono salvare progressi, preferenze, cache delle skin, consenso cookie e impostazioni dell'interfaccia."],
          ["Sessione account", "Supabase può salvare token di sessione nel browser per mantenere l'accesso all'account e permettere cloud save e chat."],
          ["Terze parti", "Discord viene usato solo se scegli il login Discord. Le immagini e i metadata delle skin vengono caricati dalla ByMykel CSGO API."],
          ["Nessun tracking", "Non sono installati cookie di profilazione, advertising o analytics. Se verranno aggiunti in futuro, saranno disattivati finché non dai consenso esplicito."],
          ["Gestione", "Puoi uscire dall'account dal menu profilo e cancellare storage/cookie dalle impostazioni del browser. La cancellazione locale può rimuovere save e sessione."]
        ]
      },
      terms: {
        title: "Terms of Service",
        intro: "Regole d'uso del simulatore Case Opener. Il gioco è fan-made e non è affiliato a Valve, Steam o Counter-Strike.",
        rows: [
          ["Oggetti virtuali", "Crediti, casse, skin, inventario e ricompense sono solo elementi virtuali di gioco. Non hanno valore monetario reale, non sono riscattabili e non costituiscono prodotti Steam."],
          ["Niente gioco d'azzardo reale", "Il gioco non permette depositi o prelievi in denaro reale. Eventuali acquisti, pubblicità o monetizzazione futura dovranno mantenere separati denaro reale e ricompense virtuali."],
          ["Marketplace e promo", "Marketplace, promo code e goal community sono sistemi di progressione virtuale. Limiti tecnici e ricompense possono essere modificati o annullati in caso di exploit."],
          ["Account", "Se crei un account, sei responsabile della sicurezza delle credenziali. Non condividere password e non usare account di altri utenti."],
          ["Fair play", "Non usare bot esterni, exploit, manipolazioni del client, abuso di bug o comportamenti che danneggiano altri utenti."],
          ["Chat e condotta", "Non pubblicare spam, insulti, dati personali, contenuti illegali o contenuti che violano diritti altrui. I messaggi possono essere rimossi in caso di abuso."],
          ["Disponibilità", "Il gioco può cambiare, andare offline o perdere dati locali/cloud in caso di errori, reset tecnici o limiti dei servizi gratuiti utilizzati."],
          ["Contenuti e marchi", "Metadata e immagini provengono dalla ByMykel CSGO API. Marchi, nomi e asset collegati a Counter-Strike, Steam e Valve appartengono ai rispettivi titolari."],
          ["Aggiornamenti", "Regole, bilanciamento, economia virtuale e testi legali possono essere aggiornati. Continuando a usare il gioco accetti la versione più recente mostrata nell'interfaccia."]
        ]
      }
    };
    return { ...common[page], updatedAt };
  }

  renderLegalLayer() {
    const node = this.root.querySelector("#legalLayer");
    if (!node) {
      return;
    }
    const modal = this.legalModal ? this.getLegalCopy(this.legalModal) : null;
    node.innerHTML = `
      <div class="legal-links">
        <button data-action="open-legal" data-page="privacy" type="button">Privacy</button>
        <button data-action="open-legal" data-page="cookies" type="button">Cookie</button>
        <button data-action="open-legal" data-page="terms" type="button">Terms</button>
      </div>
      ${!this.cookieConsent ? `
        <section class="cookie-banner" role="dialog" aria-label="Cookie banner">
          <div>
            <strong>Cookie e salvataggi locali</strong>
            <p>Usiamo storage necessario per save, sessione account e preferenze. Nessun tracking pubblicitario e' attivo.</p>
          </div>
          <div class="cookie-actions">
            <button class="ghost-button small" data-action="reject-cookies" type="button">Solo necessari</button>
            <button class="ghost-button small" data-action="open-legal" data-page="cookies" type="button">Dettagli</button>
            <button class="primary-button small" data-action="accept-cookies" type="button">Ho capito</button>
          </div>
        </section>
      ` : ""}
      ${modal ? `
        <section class="legal-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(modal.title)}">
          <div class="legal-modal-backdrop" data-action="close-legal"></div>
          <article class="legal-modal-card">
            <header>
              <div>
                <span>Aggiornato ${escapeHtml(modal.updatedAt)}</span>
                <h2>${escapeHtml(modal.title)}</h2>
                <p>${escapeHtml(modal.intro)}</p>
              </div>
              <button class="ghost-button small" data-action="close-legal" type="button">${iconMarkup("x", "button-icon")} Chiudi</button>
            </header>
            <div class="legal-modal-body">
              ${modal.rows.map(([label, copy]) => `
                <div class="legal-row">
                  <strong>${escapeHtml(label)}</strong>
                  <p>${escapeHtml(copy)}</p>
                </div>
              `).join("")}
            </div>
            <footer>
              <small>Questi testi sono una base informativa e non sostituiscono una revisione legale prima della pubblicazione ufficiale.</small>
            </footer>
          </article>
        </section>
      ` : ""}
    `;
    this.refreshIcons();
  }

  getChatTeam() {
    return this.state.profile?.team === "t" ? "t" : "ct";
  }

  setChatTeam(team) {
    this.state.profile.team = team === "t" ? "t" : "ct";
    this.renderGlobalChatDock();
    this.save();
  }

  async initCloudChat() {
    if (!this.chatCloudEnabled || this.unsubscribeCloudChat) {
      return;
    }
    try {
      this.unsubscribeCloudChat = await subscribeSupabaseChat((message) => {
        if (!message?.id || this.chatMessages.some((entry) => entry.id === message.id)) {
          return;
        }
        this.chatMessages = [...this.chatMessages, message].slice(-80);
        this.renderGlobalChatDock();
      });
    } catch (error) {
      this.chatCloudEnabled = false;
    }
  }

  async refreshChat() {
    try {
      if (this.chatCloudEnabled) {
        const messages = await fetchSupabaseChatMessages();
        if (messages) {
          this.chatMessages = messages;
          this.renderGlobalChatDock();
        }
        return;
      }
      const response = await fetch("/api/chat", { cache: "no-cache" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      this.chatMessages = Array.isArray(payload.messages) ? payload.messages : [];
      this.renderGlobalChatDock();
    } catch (error) {
      // Chat is optional; keep the game usable if the endpoint is offline.
    }
  }

  async sendChat() {
    const text = String(this.chatDraft || this.root.querySelector("#footerChatInput")?.value || "").trim();
    if (!text || this.chatBusy) {
      return;
    }
    this.chatBusy = true;
    this.renderGlobalChatDock();
    try {
      if (this.chatCloudEnabled) {
        const messages = await sendSupabaseChatMessage({
          name: this.state.profile?.name || "Operatore",
          team: this.getChatTeam(),
          text
        });
        this.chatDraft = "";
        if (messages) {
          this.chatMessages = messages;
        }
        this.renderGlobalChatDock();
        return;
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: this.state.profile?.name || "Operatore",
          team: this.getChatTeam(),
          text
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.toast(payload.error || "Chat non disponibile.");
        return;
      }
      this.chatDraft = "";
      this.chatMessages = Array.isArray(payload.messages) ? payload.messages : this.chatMessages;
      this.renderGlobalChatDock();
    } catch (error) {
      this.toast("Chat non disponibile.");
    } finally {
      this.chatBusy = false;
      this.renderGlobalChatDock();
    }
  }

  renderGlobalChatDock() {
    const node = this.root.querySelector("#globalChatDock");
    if (!node) {
      return;
    }
    const chat = this.chatMessages.slice(-40);
    const unreadCount = this.chatOpen ? 0 : Math.min(9, chat.length);
    const team = this.getChatTeam();
    node.innerHTML = `
      <div class="chat-dock-shell">
        <button class="chat-dock-tab" data-action="toggle-chat" type="button" aria-expanded="${this.chatOpen ? "true" : "false"}" title="Chat">
          <span>${iconMarkup("messages-square")}</span>
          <em>${unreadCount || "●"}</em>
        </button>
        ${this.chatOpen ? `
          <div class="chat-footer">
            <div class="chat-footer-panel">
              <div class="chat-footer-head">
                <span>${iconMarkup("messages-square", "button-icon")} Chat ${this.chatCloudEnabled ? "Cloud" : "Locale"}</span>
                <div class="chat-team-switch" aria-label="Team chat">
                  <button class="${team === "ct" ? "is-active" : ""}" data-action="set-chat-team" data-team="ct" type="button">CT</button>
                  <button class="${team === "t" ? "is-active" : ""}" data-action="set-chat-team" data-team="t" type="button">T</button>
                </div>
                <button class="ghost-button tiny" data-action="toggle-chat" type="button" aria-label="Chiudi chat">${iconMarkup("x")}</button>
              </div>
              <div class="chat-footer-log">
                ${chat.length ? chat.map((entry) => `
                  <div class="chat-footer-message is-${entry.team === "t" ? "t" : "ct"}">
                    <strong>
                      <b>${entry.team === "t" ? "T" : "CT"}</b>
                      ${escapeHtml(entry.name)}
                      <small>${new Date(entry.at || Date.now()).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</small>
                    </strong>
                    <span>${escapeHtml(entry.text)}</span>
                  </div>
                `).join("") : `<div class="empty-state small">Nessun messaggio. Scrivi tu il primo.</div>`}
              </div>
              <div class="chat-footer-compose">
                <input id="footerChatInput" maxlength="180" value="${escapeHtml(this.chatDraft)}" placeholder="Scrivi in chat..." />
                <button class="primary-button small" data-action="send-chat" ${this.chatDraft.trim() && !this.chatBusy ? "" : "disabled"}>${iconMarkup("send-horizontal", "button-icon")}</button>
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
    this.refreshIcons();
    const log = node.querySelector(".chat-footer-log");
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }

  async refreshCloudSession() {
    if (!this.cloudAvailable) {
      return null;
    }
    try {
      this.cloudSession = await getCloudSession();
      this.cloudStatus = this.cloudSession?.user ? "Sessione cloud attiva." : "Accedi per salvare online.";
      if (this.cloudSession?.user) {
        this.applyCloudIdentityProfile(this.cloudSession);
        const cloud = await loadCloudState().catch(() => null);
        if (cloud?.state) {
          this.state = normalizeState(cloud.state);
          this.selectedInventory.clear();
          this.jackpotSelection.clear();
          this.upgraderSelection = new Set(this.state.minigames?.upgrader?.itemIds || []);
          this.selectedCase = this.getInitialCase();
          this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
          this.profileSetupOpen = false;
          this.cloudStatus = `Caricato cloud rev ${cloud.revision}.`;
          saveState(this.state);
          this.renderAll();
          this.startAutomaticGameLoops();
        }
        this.startAutomaticGameLoops();
      }
      this.renderTechMenu();
      this.renderLoginGate();
      return this.cloudSession;
    } catch (error) {
      this.cloudStatus = error.message || "Cloud non disponibile.";
      this.renderTechMenu();
      this.renderLoginGate();
      return null;
    }
  }

  readAdminSession() {
    try {
      const raw = sessionStorage.getItem(ADMIN_STORAGE_KEY);
      const session = raw ? JSON.parse(raw) : null;
      return session?.user === ADMIN_USER_ID;
    } catch (error) {
      return false;
    }
  }

  isAdmin() {
    return Boolean(this.adminAuthenticated);
  }

  getAdminRpcCredentials() {
    if (!this.adminPasswordSecret) {
      return {};
    }
    return {
      adminId: ADMIN_USER_ID,
      adminPassword: this.adminPasswordSecret
    };
  }

  getAdminCredentials() {
    const userId = (this.root.querySelector("#adminUserId")?.value || this.adminUserId || "").trim().toLowerCase();
    const password = this.root.querySelector("#adminPassword")?.value || this.adminPassword || "";
    this.adminUserId = userId;
    this.adminPassword = password;
    return { userId, password };
  }

  async validateAdminCredentials(userId, password) {
    if (userId !== ADMIN_USER_ID || !password || !globalThis.crypto?.subtle) {
      return false;
    }
    return (await hashText(password)) === ADMIN_PASSWORD_HASH;
  }

  async loginAdmin() {
    const { userId, password } = this.getAdminCredentials();
    const ok = await this.validateAdminCredentials(userId, password);
    if (!ok) {
      this.adminStatus = "Credenziali admin non valide.";
      this.toast("Accesso admin negato.");
      this.renderTechMenu();
      return false;
    }
    this.adminAuthenticated = true;
    this.adminPasswordSecret = password;
    this.adminPassword = "";
    this.adminStatus = "Profilo admin attivo.";
    try {
      sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ user: ADMIN_USER_ID, at: Date.now() }));
    } catch (error) {
      // Admin mode still works for the current in-memory session.
    }
    this.toast("Profilo admin attivo.");
    this.renderAll();
    return true;
  }

  logoutAdmin() {
    this.adminAuthenticated = false;
    this.adminGateOpen = false;
    this.adminUserId = "";
    this.adminPassword = "";
    this.adminPasswordSecret = "";
    this.adminStatus = "";
    this.sessionPanelOpen = false;
    if (this.activeTab === "cheats") {
      this.activeTab = "cases";
    }
    try {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (error) {
      // Session cleanup is best-effort.
    }
    this.toast("Profilo admin disattivato.");
    this.renderAll();
  }

  applyCloudIdentityProfile(session, { forceName = false } = {}) {
    const name = getSessionDisplayName(session).slice(0, 18);
    if (!name) {
      return false;
    }
    const provider = session?.user?.app_metadata?.provider || "";
    const metadata = session?.user?.user_metadata || {};
    const avatarProviderImage = String(metadata.avatar_url || metadata.picture || "").trim();
    const shouldApply = forceName || provider === "discord" || !this.state.profile?.configured || this.state.profile?.name === "Operatore";
    if (!shouldApply) {
      return false;
    }
    this.state.profile = {
      ...this.state.profile,
      name,
      title: provider === "discord" ? "Discord Player" : (this.state.profile?.title || "Case Runner"),
      avatarProviderImage: provider === "discord" ? avatarProviderImage : (this.state.profile?.avatarProviderImage || ""),
      configured: true
    };
    this.save();
    this.renderTopStats();
    this.renderProfileSetup();
    return true;
  }

  async signInCloud() {
    if (!this.cloudAvailable || this.cloudBusy) {
      return;
    }
    this.cloudBusy = true;
    this.cloudStatus = "Accesso cloud in corso...";
    this.renderTechMenu();
    try {
      this.cloudSession = await signInCloudAnonymously();
      this.cloudStatus = "Account anonimo cloud creato. Puoi salvare online.";
      this.toast("Cloud connesso.");
      await this.saveToCloud({ quiet: true });
    } catch (error) {
      this.cloudStatus = error.message?.includes("Anonymous sign-ins are disabled")
        ? "Abilita Anonymous Sign-Ins in Supabase Auth."
        : (error.message || "Accesso cloud fallito.");
      this.toast(this.cloudStatus);
    } finally {
      this.cloudBusy = false;
      this.renderTechMenu();
      this.renderLoginGate();
    }
  }

  getAuthCredentials() {
    const username = (this.root.querySelector("#authUsername")?.value || this.authUsername || "").trim();
    const password = this.root.querySelector("#authPassword")?.value || this.authPassword || "";
    this.authUsername = username;
    this.authPassword = password;
    return { username, password };
  }

  async signInDiscord() {
    if (!this.cloudAvailable || this.cloudBusy) {
      return;
    }
    this.cloudBusy = true;
    this.cloudStatus = "Redirect Discord in corso...";
    this.renderTechMenu();
    try {
      await signInWithDiscord();
    } catch (error) {
      this.cloudStatus = error.message || "Login Discord fallito.";
      this.toast(this.cloudStatus);
      this.cloudBusy = false;
      this.renderTechMenu();
    }
  }

  async signInUsername() {
    if (!this.cloudAvailable || this.cloudBusy) {
      return;
    }
    const { username, password } = this.getAuthCredentials();
    this.cloudBusy = true;
    this.cloudStatus = "Accesso username in corso...";
    this.renderTechMenu();
    try {
      this.cloudSession = await signInWithUsernamePassword(username, password);
      this.applyCloudIdentityProfile(this.cloudSession, { forceName: true });
      if (await this.validateAdminCredentials(username.trim().toLowerCase(), password)) {
        this.adminAuthenticated = true;
        this.adminStatus = "Profilo admin attivo.";
        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ user: ADMIN_USER_ID, at: Date.now() }));
        } catch (error) {
          // Admin mode still works for the current in-memory session.
        }
      }
      this.authPassword = "";
      this.cloudStatus = "Account connesso. Puoi salvare o caricare dal cloud.";
      this.toast("Accesso completato.");
      await this.saveToCloud({ quiet: true });
    } catch (error) {
      this.cloudStatus = error.message || "Accesso username fallito.";
      this.toast(this.cloudStatus);
    } finally {
      this.cloudBusy = false;
      this.renderTechMenu();
      this.renderLoginGate();
    }
  }

  async registerUsername() {
    if (!this.cloudAvailable || this.cloudBusy) {
      return;
    }
    const { username, password } = this.getAuthCredentials();
    this.cloudBusy = true;
    this.cloudStatus = "Registrazione username in corso...";
    this.renderTechMenu();
    try {
      this.cloudSession = await registerWithUsernamePassword(username, password);
      this.applyCloudIdentityProfile(this.cloudSession, { forceName: true });
      if (await this.validateAdminCredentials(username.trim().toLowerCase(), password)) {
        this.adminAuthenticated = true;
        this.adminStatus = "Profilo admin attivo.";
        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ user: ADMIN_USER_ID, at: Date.now() }));
        } catch (error) {
          // Admin mode still works for the current in-memory session.
        }
      }
      this.authPassword = "";
      this.cloudStatus = "Account creato e collegato al cloud.";
      this.toast("Registrazione completata.");
      await this.saveToCloud({ quiet: true });
    } catch (error) {
      this.cloudStatus = error.message || "Registrazione fallita.";
      this.toast(this.cloudStatus);
    } finally {
      this.cloudBusy = false;
      this.renderTechMenu();
      this.renderLoginGate();
    }
  }

  async saveToCloud({ quiet = false } = {}) {
    if (this.cloudBusy && !quiet) {
      return;
    }
    this.cloudBusy = true;
    this.cloudStatus = "Salvataggio cloud...";
    this.renderTechMenu();
    try {
      this.save();
      const result = await saveCloudState(this.state);
      this.cloudStatus = `Salvato cloud rev ${result.revision}.`;
      this.save();
      if (!quiet) {
        this.toast("Salvataggio cloud completato.");
      }
    } catch (error) {
      this.cloudStatus = error.message || "Salvataggio cloud fallito.";
      this.toast(this.cloudStatus);
    } finally {
      this.cloudBusy = false;
      this.renderTechMenu();
      this.renderLoginGate();
    }
  }

  async loadFromCloud() {
    if (this.cloudBusy) {
      return;
    }
    this.cloudBusy = true;
    this.cloudStatus = "Caricamento cloud...";
    this.renderTechMenu();
    try {
      const cloud = await loadCloudState();
      if (!cloud?.state) {
        this.cloudStatus = "Nessun salvataggio cloud trovato.";
        this.toast(this.cloudStatus);
        return;
      }
      const loaded = normalizeState(cloud.state);
      this.state = loaded;
      this.selectedInventory.clear();
      this.jackpotSelection.clear();
      this.selectedCase = this.getInitialCase();
      this.casePrestigeGroup = this.selectedCase?.unlockPrestige ?? 0;
      this.lastOpenedDropIds = [];
      this.resetSessionState();
      this.cloudStatus = `Caricato cloud rev ${cloud.revision}.`;
      saveState(this.state);
      this.toast("Salvataggio cloud caricato.");
      this.renderAll();
      this.startAutomaticGameLoops();
    } catch (error) {
      this.cloudStatus = error.message || "Caricamento cloud fallito.";
      this.toast(this.cloudStatus);
    } finally {
      this.cloudBusy = false;
      this.renderTechMenu();
      this.renderLoginGate();
    }
  }

  async signOutFromCloud() {
    if (this.cloudBusy) {
      return;
    }
    this.cloudBusy = true;
    this.cloudStatus = "Logout cloud...";
    this.renderTechMenu();
    try {
      await signOutCloud();
      this.cloudSession = null;
      this.cloudStatus = "Logout completato. Il save locale resta disponibile.";
      this.toast("Cloud disconnesso.");
    } catch (error) {
      this.cloudStatus = error.message || "Logout cloud fallito.";
      this.toast(this.cloudStatus);
    } finally {
      this.cloudBusy = false;
      this.renderTechMenu();
      this.renderLoginGate();
    }
  }

  save() {
    this.state.selectedCaseId = this.selectedCase.id;
    const ok = saveState(this.state);
    this.setSaved(ok);
    return ok;
  }
}
