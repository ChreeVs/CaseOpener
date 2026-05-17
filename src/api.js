import {
  API_URL,
  CRATES_API_URL,
  SAVE_KEY,
  DB_NAME,
  DB_STORE,
  SKIN_CACHE_KEY,
  SKIN_CACHE_TTL
} from "./config/apiConfig.js";
import {
  CASE_MAX_PRESTIGE_UNLOCK,
  CASE_PRICE_CREDIT_MULTIPLIER,
  CASE_PRESTIGE_ECONOMY,
  INVENTORY_PAGE_SIZE
} from "./config/gameConfig.js";
import {
  RARITY_ORDER,
  RARITIES,
  API_RARITY_TO_GAME
} from "./config/rarityConfig.js";
import {
  CASE_BLUEPRINTS
} from "./config/caseBlueprintsConfig.js";
import {
  DROP_PROFILES
} from "./config/dropProfilesConfig.js";
import {
  WEAR_TIERS
} from "./config/wearTiersConfig.js";

const CASE_ACCENTS = ["#ffd166", "#5e98d9", "#8fd14f", "#d32ce6", "#eb4b4b", "#64d7e3", "#a77cff", "#f2a541"];

const FALLBACK_CASE_PRICES_EUR = {
  "CS:GO Weapon Case": 110,
  "Operation Bravo Case": 78,
  "CS:GO Weapon Case 2": 18,
  "CS:GO Weapon Case 3": 10,
  "eSports 2013 Case": 42,
  "eSports 2013 Winter Case": 12,
  "eSports 2014 Summer Case": 8,
  "Operation Phoenix Weapon Case": 4.5,
  "Operation Breakout Weapon Case": 7.5,
  "Operation Vanguard Weapon Case": 3.5,
  "Chroma Case": 3,
  "Chroma 2 Case": 2.8,
  "Falchion Case": 1.2,
  "Shadow Case": 1.1,
  "Revolver Case": 1.3,
  "Operation Wildfire Case": 2.2,
  "Chroma 3 Case": 1.7,
  "Gamma Case": 2.4,
  "Gamma 2 Case": 2.5,
  "Glove Case": 5.5,
  "Spectrum Case": 3.2,
  "Operation Hydra Case": 16,
  "Spectrum 2 Case": 2.6,
  "Clutch Case": 0.8,
  "Horizon Case": 1.1,
  "Danger Zone Case": 0.9,
  "Prisma Case": 1,
  "CS20 Case": 1,
  "Shattered Web Case": 5,
  "Prisma 2 Case": 0.9,
  "Fracture Case": 0.8,
  "Operation Broken Fang Case": 4.2,
  "Snakebite Case": 0.6,
  "Dreams & Nightmares Case": 1.1,
  "Recoil Case": 0.6,
  "Revolution Case": 0.5,
  "Kilowatt Case": 1.2,
  "Gallery Case": 0.9
};

const CASE_PROFILE_PRICE = {
  budget: 7,
  standard: 8,
  premium: 15,
  collector: 27,
  jackpot: 58
};

const CASE_VALUE_SCALE = {
  budget: 0.88,
  standard: 0.96,
  premium: 1.04,
  collector: 1.12,
  jackpot: 1.22
};

const PROFILE_QUALITY = {
  budget: 0.15,
  standard: 0.32,
  premium: 0.52,
  collector: 0.72,
  jackpot: 0.92
};

function normalizeCachedPayload(cached) {
  const data = cached?.data;
  if (Array.isArray(data)) {
    return { skins: data, crates: [] };
  }
  return {
    skins: Array.isArray(data?.skins) ? data.skins : [],
    crates: Array.isArray(data?.crates) ? data.crates : []
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCache() {
  try {
    const db = await openDb();
    if (!db) {
      const raw = localStorage.getItem(SKIN_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    }

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(SKIN_CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Skin cache read failed", error);
    return null;
  }
}

async function writeCache(payload) {
  try {
    const db = await openDb();
    if (!db) {
      try {
        localStorage.setItem(SKIN_CACHE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn("Skin localStorage cache skipped", error);
      }
      return;
    }

    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Skin cache write failed", error);
  }
}

function fetchWithTimeout(url, timeoutMs = 8000) {
  return Promise.race([
    fetch(url, { cache: "no-cache" }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Fetch timeout: ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

export async function loadSkins({ forceRefresh = false } = {}) {
  const cached = await readCache();
  const cacheFresh = cached && Date.now() - cached.cachedAt < SKIN_CACHE_TTL;
  const cachedPayload = normalizeCachedPayload(cached);

  // If cache exists and is reasonably fresh, use it immediately (fail-fast fallback)
  if (!forceRefresh && cached && cachedPayload.skins.length && cachedPayload.crates.length) {
    // Return cache immediately, try to update in background if stale
    if (cacheFresh) {
      return {
        skins: cachedPayload.skins,
        crates: cachedPayload.crates,
        fromCache: true,
        cachedAt: cached.cachedAt
      };
    }

    // Cache is old, try to refresh but don't wait too long
    try {
      const [skinsResponse, cratesResponse] = await Promise.all([
        fetchWithTimeout(API_URL, 5000),
        fetchWithTimeout(CRATES_API_URL, 5000)
      ]);
      if (skinsResponse.ok && cratesResponse.ok) {
        const [skins, crates] = await Promise.all([
          skinsResponse.json(),
          cratesResponse.json()
        ]);
        const cachedAt = Date.now();
        await writeCache({ key: SKIN_CACHE_KEY, cachedAt, data: { skins, crates } });
        return { skins, crates, fromCache: false, cachedAt };
      }
    } catch (error) {
      console.warn("Failed to refresh API, using cached data", error);
    }

    // Return stale cache if API update failed
    return {
      skins: cachedPayload.skins,
      crates: cachedPayload.crates,
      fromCache: true,
      cachedAt: cached.cachedAt,
      warning: "La API non ha risposto: uso cache locale (data odierna potrebbe non essere aggiornata)."
    };
  }

  // No valid cache, must fetch from API
  try {
    const [skinsResponse, cratesResponse] = await Promise.all([
      fetchWithTimeout(API_URL, 8000),
      fetchWithTimeout(CRATES_API_URL, 8000)
    ]);
    if (!skinsResponse.ok) {
      throw new Error(`ByMykel skins API returned ${skinsResponse.status}`);
    }
    if (!cratesResponse.ok) {
      throw new Error(`ByMykel crates API returned ${cratesResponse.status}`);
    }
    const [skins, crates] = await Promise.all([
      skinsResponse.json(),
      cratesResponse.json()
    ]);
    const cachedAt = Date.now();
    await writeCache({ key: SKIN_CACHE_KEY, cachedAt, data: { skins, crates } });
    return { skins, crates, fromCache: false, cachedAt };
  } catch (error) {
    if (cachedPayload.skins.length) {
      return {
        skins: cachedPayload.skins,
        crates: cachedPayload.crates,
        fromCache: true,
        cachedAt: cached?.cachedAt || 0,
        warning: "La API non ha risposto: uso cache locale."
      };
    }
    throw error;
  }
}

export function normalizeSkin(raw) {
  const isSpecialItem = raw.name?.startsWith("\u2605") || ["Knives", "Gloves"].includes(raw.category?.name);
  const rarity = isSpecialItem ? "Rare Special Item" : API_RARITY_TO_GAME[raw.rarity?.name] || null;
  if (!rarity || !raw.image) {
    return null;
  }

  const collections = Array.isArray(raw.collections) ? raw.collections.map((collection) => collection.name).filter(Boolean) : [];
  const crates = Array.isArray(raw.crates) ? raw.crates.filter((crate) => crate?.name) : [];

  return {
    id: raw.id,
    name: raw.name,
    image: raw.image,
    weapon: raw.weapon?.name || "Unknown",
    category: raw.category?.name || "Skin",
    pattern: raw.pattern?.name || "",
    rarity,
    rarityColor: RARITIES[rarity].color,
    minFloat: Number.isFinite(raw.min_float) ? raw.min_float : 0,
    maxFloat: Number.isFinite(raw.max_float) ? raw.max_float : 1,
    stattrak: Boolean(raw.stattrak),
    souvenir: Boolean(raw.souvenir),
    collections,
    crates: crates.map((crate) => ({
      id: crate.id,
      name: crate.name,
      image: crate.image
    })),
    original: raw
  };
}

function createPool() {
  return RARITY_ORDER.reduce((pool, rarity) => {
    pool[rarity] = [];
    return pool;
  }, {});
}

function addSkinToPool(pool, skin) {
  if (!pool[skin.rarity]) {
    pool[skin.rarity] = [];
  }
  pool[skin.rarity].push(skin);
}

function clonePool(pool) {
  return RARITY_ORDER.reduce((copy, rarity) => {
    copy[rarity] = [...(pool[rarity] || [])];
    return copy;
  }, {});
}

function compactPool(pool) {
  return RARITY_ORDER.reduce((copy, rarity) => {
    const byId = new Map((pool[rarity] || []).map((skin) => [skin.id, skin]));
    copy[rarity] = [...byId.values()];
    return copy;
  }, {});
}

function countPool(pool) {
  return RARITY_ORDER.reduce((count, rarity) => count + (pool[rarity]?.length || 0), 0);
}

function findCrate(crateMap, name) {
  return [...crateMap.values()].find((crate) => crate.name.toLowerCase() === name.toLowerCase()) || null;
}

function pickCaseImage(crateMap, preferredName) {
  if (preferredName) {
    const crate = findCrate(crateMap, preferredName);
    if (crate?.image) {
      return crate.image;
    }
  }
  return [...crateMap.values()].find((crate) => crate.image)?.image || "";
}

function createSyntheticCase(blueprint, globalPool, crateMap) {
  const pool = createPool();
  const addMany = (rarity, limit) => {
    const skins = [...(globalPool[rarity] || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
    skins.forEach((skin) => addSkinToPool(pool, skin));
  };

  if (blueprint.synthetic === "free") {
    addMany("Consumer Grade", 320);
    addMany("Industrial Grade", 220);
    addMany("Mil-Spec", 120);
    addMany("Restricted", 28);
    addMany("Classified", 10);
    addMany("Covert", 4);
    addMany("Rare Special Item", 2);
  }

  if (blueprint.synthetic === "starter") {
    addMany("Consumer Grade", 260);
    addMany("Industrial Grade", 260);
    addMany("Mil-Spec", 180);
    addMany("Restricted", 100);
    addMany("Classified", 40);
    addMany("Covert", 20);
    addMany("Rare Special Item", 18);
  }

  if (blueprint.synthetic === "budget") {
    addMany("Industrial Grade", 220);
    addMany("Mil-Spec", 260);
    addMany("Restricted", 170);
    addMany("Classified", 85);
    addMany("Covert", 42);
    addMany("Rare Special Item", 28);
  }

  if (blueprint.synthetic === "jackpot") {
    addMany("Restricted", 190);
    addMany("Classified", 180);
    addMany("Covert", 130);
    addMany("Rare Special Item", 120);
  }

  const preferredImage =
    blueprint.synthetic === "jackpot" ? "Glove Case" :
    blueprint.synthetic === "free" ? "Gallery Case" :
    "Recoil Case";
  const image = pickCaseImage(crateMap, preferredImage);
  return toCaseDefinition(blueprint, {
    id: blueprint.id,
    name: blueprint.name,
    image,
    pool: compactPool(pool)
  });
}

function toCaseDefinition(blueprint, crate) {
  const pool = compactPool(crate.pool);
  const availableRarities = RARITY_ORDER.filter((rarity) => pool[rarity]?.length);
  const profile = DROP_PROFILES[blueprint.profile] || DROP_PROFILES.standard;

  return {
    id: blueprint.id || crate.id,
    sourceCrateId: crate.id,
    name: blueprint.name || crate.name,
    description: blueprint.description || "Real CS2 skin pool pulled from the ByMykel CSGO API.",
    image: crate.image,
    price: blueprint.price,
    profileName: blueprint.profile,
    profile,
    unlockPrestige: blueprint.unlockPrestige || 0,
    accent: blueprint.accent || "#ffd166",
    manualOnly: Boolean(blueprint.manualOnly),
    valueScale: Number(blueprint.valueScale || 1),
    pool,
    availableRarities,
    totalSkins: countPool(pool)
  };
}

function createCaseFromCrate(blueprint, crateMap) {
  const crate = findCrate(crateMap, blueprint.match);
  if (!crate) {
    return null;
  }
  return toCaseDefinition(blueprint, crate);
}

function buildGlobalPool(skins) {
  const pool = createPool();
  skins.forEach((skin) => addSkinToPool(pool, skin));
  return compactPool(pool);
}

function buildCrateMap(skins) {
  const crateMap = new Map();

  skins.forEach((skin) => {
    skin.crates.forEach((crate) => {
      if (!crateMap.has(crate.name)) {
        crateMap.set(crate.name, {
          id: crate.id || crate.name,
          name: crate.name,
          image: crate.image,
          pool: createPool()
        });
      }
      addSkinToPool(crateMap.get(crate.name).pool, skin);
    });
  });

  crateMap.forEach((crate) => {
    crate.pool = compactPool(crate.pool);
  });

  return crateMap;
}

function slugifyCaseId(value) {
  return String(value || "case")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseYear(dateValue) {
  const match = String(dateValue || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function estimateFallbackCasePrice(crate, pool) {
  const override = FALLBACK_CASE_PRICES_EUR[crate.name];
  if (override) {
    return Math.round(override * CASE_PRICE_CREDIT_MULTIPLIER);
  }

  const year = parseYear(crate.first_sale_date);
  const specialCount = pool["Rare Special Item"]?.length || 0;
  const covertCount = pool.Covert?.length || 0;
  let euros = 0.65;

  if (year && year <= 2014) {
    euros = 8;
  } else if (year && year <= 2016) {
    euros = 2.2;
  } else if (year && year <= 2018) {
    euros = 1.4;
  } else if (year && year <= 2020) {
    euros = 1;
  } else if (year && year >= 2024) {
    euros = 1.15;
  }

  euros += Math.min(1.8, specialCount * 0.012) + Math.min(0.8, covertCount * 0.08);
  return Math.max(35, Math.round(euros * CASE_PRICE_CREDIT_MULTIPLIER));
}

function roundGamePrice(value) {
  if (value <= 10) {
    return Math.max(1, Math.round(value));
  }
  if (value <= 30) {
    return Math.max(2, Math.round(value / 2) * 2);
  }
  if (value <= 100) {
    return Math.max(5, Math.round(value / 5) * 5);
  }
  if (value <= 500) {
    return Math.max(10, Math.round(value / 10) * 10);
  }
  if (value <= 1500) {
    return Math.max(25, Math.round(value / 25) * 25);
  }
  if (value <= 5000) {
    return Math.max(50, Math.round(value / 50) * 50);
  }
  return Math.max(100, Math.round(value / 100) * 100);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPrestigeEconomyTier(unlockPrestige = 0) {
  const index = clampNumber(Math.floor(Number(unlockPrestige) || 0), 0, CASE_PRESTIGE_ECONOMY.length - 1);
  return CASE_PRESTIGE_ECONOMY[index] || CASE_PRESTIGE_ECONOMY[0];
}

function estimateStaticCaseEv(caseDef, profileName, valueScale) {
  const profile = DROP_PROFILES[profileName] || DROP_PROFILES.standard;
  const available = profile.filter(([rarity]) => caseDef.pool[rarity]?.length);
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) {
    return 1;
  }
  const wearAverage = WEAR_TIERS.reduce((sum, wear) => sum + wear.multiplier, 0) / WEAR_TIERS.length;
  const critExpected = 1 + 0.01 * 0.72;
  return available.reduce((sum, [rarity, weight]) => {
    const probability = weight / totalWeight;
    return sum + RARITIES[rarity].baseValue * wearAverage * critExpected * valueScale * probability;
  }, 0);
}

function getCaseQualitySignal(caseDef, profileName, marketEuro) {
  const specialCount = caseDef.pool["Rare Special Item"]?.length || 0;
  const covertCount = caseDef.pool.Covert?.length || 0;
  const marketSignal = clampNumber(Math.log1p(Math.max(0, marketEuro)) / Math.log1p(120), 0, 1);
  const poolSignal = clampNumber(specialCount / 120 * 0.7 + covertCount / 140 * 0.3, 0, 1);
  return clampNumber((PROFILE_QUALITY[profileName] || 0.35) * 0.46 + marketSignal * 0.32 + poolSignal * 0.22, 0, 1);
}

function deriveBalancedProfile(caseDef) {
  const marketEuro = caseDef.realPriceEuro ?? (caseDef.fallbackPrice || caseDef.price || 0) / CASE_PRICE_CREDIT_MULTIPLIER;
  const year = parseYear(caseDef.firstSaleDate);
  const specialCount = caseDef.pool["Rare Special Item"]?.length || 0;
  const covertCount = caseDef.pool.Covert?.length || 0;
  const collectorName = /operation|weapon case|esports|hydra|shattered web/i.test(caseDef.name);
  const legacyBoost = year && year <= 2015 ? 2 : year && year <= 2018 ? 1 : 0;
  const priceSignal =
    marketEuro >= 18 ? 4 :
    marketEuro >= 6 ? 3 :
    marketEuro >= 2.4 ? 2 :
    marketEuro >= 0.9 ? 1 : 0;
  const poolSignal =
    specialCount >= 28 ? 2 :
    specialCount >= 12 || covertCount >= 18 ? 1 : 0;
  const score = priceSignal + legacyBoost + poolSignal + (collectorName ? 1 : 0);

  if (score >= 6) {
    return "jackpot";
  }
  if (score >= 4) {
    return "collector";
  }
  if (score >= 2) {
    return "premium";
  }
  if (marketEuro >= 0.8 || covertCount >= 8) {
    return "standard";
  }
  return "budget";
}

function rebalanceCaseDefinition(caseDef) {
  if (caseDef.price <= 0) {
    return caseDef;
  }

  const marketEuro = caseDef.realPriceEuro ?? (caseDef.fallbackPrice || caseDef.price || 0) / CASE_PRICE_CREDIT_MULTIPLIER;
  const profileName = deriveBalancedProfile(caseDef);
  const economy = getPrestigeEconomyTier(caseDef.unlockPrestige || 0);
  const qualitySignal = getCaseQualitySignal(caseDef, profileName, marketEuro);
  const baseScale = CASE_VALUE_SCALE[profileName] || 1;
  const valueScale = Number((economy.valueScale * baseScale * (0.92 + qualitySignal * 0.16)).toFixed(2));
  const estimatedEv = estimateStaticCaseEv(caseDef, profileName, valueScale);
  const targetRoi = clampNumber(economy.targetRoi - qualitySignal * 0.035, 0.56, 0.78);
  const prestigePrice = estimatedEv / targetRoi;
  const marketAnchor = Math.max(0, Math.log1p(marketEuro) / Math.log1p(120));
  const prestigeFloor = economy.minPrice + (economy.maxPrice - economy.minPrice) * clampNumber((qualitySignal * 0.52 + marketAnchor * 0.22) - 0.08, 0, 0.58);
  const price = roundGamePrice(clampNumber(
    Math.max(prestigePrice, prestigeFloor),
    economy.minPrice,
    economy.maxPrice
  ));

  return {
    ...caseDef,
    price,
    profileName,
    profile: DROP_PROFILES[profileName] || DROP_PROFILES.standard,
    valueScale
  };
}

function caseDescription(crate, priceSource = "fallback") {
  const date = crate.first_sale_date ? ` Prima vendita: ${crate.first_sale_date}.` : "";
  const source = priceSource === "steam"
    ? "Pool reale CS2 con riferimento Steam aggiornato."
    : "Pool reale CS2 con prezzo di gioco bilanciato.";
  return `${source}${date}`;
}

function createRealCaseDefinition(crate, crateMap, index) {
  const mapped = findCrate(crateMap, crate.name);
  if (!mapped) {
    return null;
  }
  const pool = compactPool(mapped.pool);
  const totalSkins = countPool(pool);
  if (totalSkins < 8) {
    return null;
  }

  const price = estimateFallbackCasePrice(crate, pool);
  const profileName = "standard";
  return {
    id: crate.id || slugifyCaseId(crate.name),
    sourceCrateId: crate.id,
    name: crate.name,
    description: caseDescription(crate),
    image: crate.image || mapped.image,
    price,
    fallbackPrice: price,
    realPriceEuro: null,
    steamRawPrice: "",
    priceSource: "fallback",
    marketHashName: crate.market_hash_name || crate.name,
    profileName,
    profile: DROP_PROFILES[profileName],
    valueScale: 1,
    manualOnly: false,
    unlockPrestige: 0,
    accent: CASE_ACCENTS[index % CASE_ACCENTS.length],
    pool,
    availableRarities: RARITY_ORDER.filter((rarity) => pool[rarity]?.length),
    totalSkins,
    firstSaleDate: crate.first_sale_date || "",
    originalCrate: crate
  };
}

function unlockTierFromPrice(price) {
  if (price >= 10000) {
    return 15;
  }
  if (price >= 8000) {
    return 14;
  }
  if (price >= 6200) {
    return 13;
  }
  if (price >= 4600) {
    return 12;
  }
  if (price >= 3300) {
    return 11;
  }
  if (price >= 2300) {
    return 10;
  }
  if (price >= 1600) {
    return 9;
  }
  if (price >= 1100) {
    return 8;
  }
  if (price >= 800) {
    return 7;
  }
  if (price >= 600) {
    return 6;
  }
  if (price >= 420) {
    return 5;
  }
  if (price >= 300) {
    return 4;
  }
  if (price >= 220) {
    return 3;
  }
  if (price >= 160) {
    return 2;
  }
  if (price >= 100) {
    return 1;
  }
  return 0;
}

function unlockTierFromReleaseRank(index, total) {
  if (index < 5 || total <= 1) {
    return 0;
  }
  const progress = clampNumber((index - 5) / Math.max(1, total - 6), 0, 1);
  return clampNumber(1 + Math.round(Math.pow(progress, 1.08) * (CASE_MAX_PRESTIGE_UNLOCK - 1)), 1, CASE_MAX_PRESTIGE_UNLOCK);
}

function assignPrestigeUnlocks(cases) {
  return cases.map((caseDef, index) => {
    if (index < 5) {
      return {
        ...caseDef,
        unlockPrestige: 0
      };
    }
    const unlockPrestige = Math.max(
      unlockTierFromReleaseRank(index, cases.length),
      unlockTierFromPrice(caseDef.fallbackPrice || caseDef.price)
    );
    return {
      ...caseDef,
      unlockPrestige
    };
  });
}

function buildRealCases(rawCrates, crateMap) {
  const cases = (Array.isArray(rawCrates) ? rawCrates : [])
    .filter((crate) => crate?.type === "Case")
    .map((crate, index) => createRealCaseDefinition(crate, crateMap, index))
    .filter(Boolean)
    .sort((a, b) => {
      const dateA = Date.parse(String(a.firstSaleDate || "").replaceAll("/", "-")) || 0;
      const dateB = Date.parse(String(b.firstSaleDate || "").replaceAll("/", "-")) || 0;
      return dateB - dateA || a.name.localeCompare(b.name);
    });
  return assignPrestigeUnlocks(cases).map((caseDef) => rebalanceCaseDefinition(caseDef));
}

export async function refreshCasePrices(cases) {
  const byMarketName = new Map(
    cases
      .filter((caseDef) => caseDef.marketHashName)
      .map((caseDef) => [caseDef.marketHashName, caseDef])
  );
  const names = [...byMarketName.keys()];
  let updated = 0;

  for (let index = 0; index < names.length; index += 12) {
    const chunk = names.slice(index, index + 12);
    try {
      const response = await fetch(`/api/steam-prices?names=${encodeURIComponent(chunk.join("|"))}`, { cache: "no-cache" });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      (payload.prices || []).forEach((entry) => {
        const caseDef = byMarketName.get(entry.name);
        if (!caseDef || !entry.ok || !Number.isFinite(entry.price)) {
          return;
        }
        caseDef.realPriceEuro = entry.price;
        caseDef.steamRawPrice = entry.raw || "";
        caseDef.priceSource = "steam";
        caseDef.description = caseDescription(caseDef.originalCrate || caseDef, "steam");
        Object.assign(caseDef, rebalanceCaseDefinition(caseDef));
        updated += 1;
      });
    } catch (error) {
      console.warn("Steam price refresh failed", error);
    }
  }

  return updated;
}

export function buildSkinData(rawSkins, rawCrates = []) {
  const skins = rawSkins.map(normalizeSkin).filter(Boolean);
  const byId = new Map(skins.map((skin) => [skin.id, skin]));
  const globalPool = buildGlobalPool(skins);
  const crateMap = buildCrateMap(skins);
  const realCases = buildRealCases(rawCrates, crateMap);
  const guaranteedCases = CASE_BLUEPRINTS
    .filter((blueprint) => blueprint.alwaysAvailable)
    .map((blueprint) => createSyntheticCase(blueprint, globalPool, crateMap))
    .filter(Boolean);
  const cases = realCases.length ? [...guaranteedCases, ...realCases] : [...guaranteedCases];

  if (!realCases.length) {
    CASE_BLUEPRINTS.forEach((blueprint) => {
      if (blueprint.alwaysAvailable) {
        return;
      }
      const definition = blueprint.synthetic
        ? createSyntheticCase(blueprint, globalPool, crateMap)
        : createCaseFromCrate(blueprint, crateMap);

      if (definition && definition.totalSkins >= 10) {
        cases.push(definition);
      }
    });
  }

  if (!realCases.length && cases.length < CASE_BLUEPRINTS.length) {
    const usedNames = new Set(cases.map((caseDef) => caseDef.name));
    const extras = [...crateMap.values()]
      .filter((crate) => !usedNames.has(crate.name) && countPool(crate.pool) >= 12)
      .sort((a, b) => countPool(b.pool) - countPool(a.pool))
      .slice(0, CASE_BLUEPRINTS.length - cases.length);

    extras.forEach((crate, index) => {
      cases.push(toCaseDefinition({
        id: `fallback-${index}-${crate.id}`,
        price: 80 + index * 18,
        profile: index > 3 ? "premium" : "standard",
        unlockPrestige: Math.max(0, index - 2),
        accent: index % 2 ? "#06d6a0" : "#f2a541"
      }, crate));
    });
  }

  return {
    skins,
    byId,
    globalPool: clonePool(globalPool),
    cases
  };
}
