
import { RARITIES, RARITY_ORDER } from "../../config/rarityConfig.js";
import { formatCredits, getSellReturn, getOpenDuration, getLuckMultiplier, isAutoOpenerEnabled, getAutoInterval, getMultiOpenCount, getPassiveRate, getMarketAnalystDiscount, getDropInsuranceRate, getCollectionMultiplier, getTradeUpInputCount } from "../../gameLogic.js";
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function percent(value) {
  return `${Math.round(value * 100)}%`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rarityClass(rarity) {
  return `rarity-${RARITIES[rarity]?.key || "unknown"}`;
}

export function compactTime(ms) {
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

export function casePoolPreview(caseDef) {
  return RARITY_ORDER
    .filter((rarity) => caseDef.pool[rarity]?.length)
    .map((rarity) => `<span style="--rarity:${RARITIES[rarity].color}">${RARITIES[rarity].short} ${caseDef.pool[rarity].length}</span>`)
    .join("");
}

export function formatPercent(value, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function parseTransformX(transformValue) {
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

export function dropFeedHeadline(item, count) {
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

export function upgradeBranch(upgradeId) {
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

export function iconMarkup(name, className = "") {
  const classes = ["ui-icon", className].filter(Boolean).join(" ");
  return `<i class="${classes}" data-lucide="${escapeHtml(name)}" aria-hidden="true"></i>`;
}

export function profileAvatarMarkup(profile, fallbackIcon = "shield", className = "") {
  const src = profile?.avatarImage || profile?.avatarProviderImage || "";
  if (src) {
    return `<img class="profile-avatar-img" src="${escapeHtml(src)}" alt="${escapeHtml(profile?.name || "Avatar")}" loading="lazy" />`;
  }
  return iconMarkup(fallbackIcon, className);
}

export function tabIcon(id) {
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

export async function hashText(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const PROFILE_ICON_OPTIONS = [
  { id: "shield", label: "Shield" },
  { id: "crosshair", label: "Crosshair" },
  { id: "sparkles", label: "Sparkles" },
  { id: "crown", label: "Crown" },
  { id: "rocket", label: "Rocket" },
  { id: "gem", label: "Gem" }
];

export const NAV_TABS = [
  ["cases", "Cases"],
  ["inventory", "Locker"],
  ["shop", "Economia"],
  ["market", "Marketplace"],
  ["stats", "Progress"],
  ["achievements", "Achievements"],
  ["prestige", "Prestige"],

  ["community", "Community"],
  ["admin", "Admin"]
];

export const ADMIN_STORAGE_KEY = "case-opener-admin-session-v1";
export const ADMIN_USER_ID = "salernitana";
export const ADMIN_PASSWORD_HASH = "9a2f5ce537e75c7c3daab92f3cff16791dff672efadbc4f6deb92c6a920daeeb";
export const ADMIN_ONLY_ACTIONS = new Set([
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

export const LOGIN_GATE_ACTIONS = new Set([
  "cloud-discord",
  "cloud-login-password",
  "cloud-register-password",
  "cloud-sign-in",
  "open-legal",
  "close-legal",
  "accept-cookies",
  "reject-cookies",
  "toggle-admin-gate",
  "admin-login",
  "tab",
  "page",
  "games-view",
  "close-open-result",
  "toggle-open-result-details",
  "select-case",
  "buy-case",
  "buy-cases",
  "open-case",
  "quick-open-case",
  "close-reveal",
  "case-page-jump",
  "clear-case-filters",
  "toggle-case-filters"
]);

export const TAB_GROUPS = {
  cases: ["cases"],
  inventory: ["inventory", "contracts", "collections"],
  shop: ["shop"],
  market: ["market"],
  stats: ["stats"],
  achievements: ["achievements"],
  prestige: ["prestige"],

  community: ["community"],
  admin: ["admin"],
  cheats: ["cheats"]
};

export const TAB_PARENT = Object.entries(TAB_GROUPS).reduce((map, [parent, tabs]) => {
  tabs.forEach((tab) => {
    map[tab] = parent;
  });
  return map;
}, {});

export function upgradeEffectText(state, upgrade) {
  const level = state.upgrades[upgrade.id] || 0;
  switch (upgrade.id) {
    case "openSpeed":
      return `${(getOpenDuration(state) / 1000).toFixed(2)}s animazione`;
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

export function itemCard(item, { compact = false, withSell = false, selectable = false, selected = false, state = null } = {}) {
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

export function statTile(label, value, sub = "") {
  return `
    <div class="stat-tile">
      <span>${label}</span>
      <strong>${value}</strong>
      ${sub ? `<small>${sub}</small>` : ""}
    </div>
  `;
}

export function casePriceLabel(caseDef, unlocked) {
  if (!unlocked) {
    return `Prestige ${caseDef.unlockPrestige}`;
  }
  if (caseDef.price <= 0) {
    return "Gratis";
  }
  return formatCredits(caseDef.price, true);
}

export function reelDisplayItem(item) {
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

