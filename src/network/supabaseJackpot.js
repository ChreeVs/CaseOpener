import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

export const JACKPOT_FLOW = {
  delay: 12000,
  deposit: 35000,
  closing: 5000,
  spin: 7000,
  release: 8000
};

export const JACKPOT_TIERS = [
  { id: "rookie", label: "Rookie", detail: "Prestige 0-2", minPrestige: 0, maxPrestige: 2, minValue: 1, maxValue: 25000 },
  { id: "veteran", label: "Veteran", detail: "Prestige 3-6", minPrestige: 3, maxPrestige: 6, minValue: 1, maxValue: 250000 },
  { id: "elite", label: "Elite", detail: "Prestige 7-12", minPrestige: 7, maxPrestige: 12, minValue: 1, maxValue: 2500000 },
  { id: "master", label: "Master", detail: "Prestige 13+", minPrestige: 13, maxPrestige: Infinity, minValue: 1, maxValue: 25000000 }
];

const CHANNEL_NAME = "case-opener-live-jackpot-v1";
const ROUND_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
const ROUND_DURATION = Object.values(JACKPOT_FLOW).reduce((sum, value) => sum + value, 0);
const MAX_ENTRY_ITEMS = 72;
const entryListeners = new Set();
const statusListeners = new Set();
let channelPromise = null;
let channel = null;

function cleanText(value, fallback = "", max = 120) {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || fallback;
}

function money(value) {
  return Number(Math.max(0, Number(value || 0)).toFixed(2));
}

function hashText(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getJackpotTier(tierId) {
  return JACKPOT_TIERS.find((tier) => tier.id === tierId) || JACKPOT_TIERS[0];
}

export function getJackpotTierForPrestige(prestige = 0) {
  const level = Math.max(0, Number(prestige) || 0);
  return JACKPOT_TIERS.find((tier) => level >= tier.minPrestige && level <= tier.maxPrestige) || JACKPOT_TIERS.at(-1);
}

export function isJackpotValueAllowedForTier(value = 0, tierId = "rookie") {
  const tier = getJackpotTier(tierId);
  const amount = money(value);
  return amount >= Number(tier.minValue || 0) && amount <= Number(tier.maxValue || Infinity);
}

export function getJackpotRound(now = Date.now()) {
  const elapsedTotal = Math.max(0, now - ROUND_EPOCH);
  const roundId = Math.floor(elapsedTotal / ROUND_DURATION);
  const elapsed = elapsedTotal % ROUND_DURATION;
  const phases = [
    { key: "delay", label: "Delay", duration: JACKPOT_FLOW.delay },
    { key: "deposit", label: "Deposito Skin", duration: JACKPOT_FLOW.deposit },
    { key: "closing", label: "Chiusura Depositi", duration: JACKPOT_FLOW.closing },
    { key: "spin", label: "Giro", duration: JACKPOT_FLOW.spin },
    { key: "release", label: "Rilascio Skin", duration: JACKPOT_FLOW.release }
  ];
  let cursor = 0;
  let phase = phases[0];
  for (const candidate of phases) {
    if (elapsed < cursor + candidate.duration) {
      phase = candidate;
      break;
    }
    cursor += candidate.duration;
  }
  const phaseElapsed = elapsed - cursor;
  return {
    roundId,
    elapsed,
    remaining: ROUND_DURATION - elapsed,
    duration: ROUND_DURATION,
    phase: {
      ...phase,
      elapsed: phaseElapsed,
      remaining: Math.max(0, phase.duration - phaseElapsed),
      progress: Math.max(0, Math.min(1, phaseElapsed / Math.max(1, phase.duration)))
    }
  };
}

function normalizeItem(item = {}) {
  return {
    id: cleanText(item.id, `skin-${Date.now()}-${Math.random().toString(36).slice(2)}`, 120),
    name: cleanText(item.name, "Skin", 96),
    image: String(item.image || ""),
    rarity: cleanText(item.rarity, "Mil-Spec", 48),
    rarityColor: cleanText(item.rarityColor, "#64d7e3", 24),
    wear: cleanText(item.wear, "", 48),
    value: money(item.value),
    weapon: cleanText(item.weapon, "", 64),
    category: cleanText(item.category, "", 48),
    collection: cleanText(item.collection, "", 96),
    float: Number(Number(item.float || 0).toFixed(6)),
    caseName: cleanText(item.caseName, "", 96),
    stattrak: Boolean(item.stattrak),
    souvenir: Boolean(item.souvenir),
    crit: Boolean(item.crit)
  };
}

export function normalizeJackpotEntry(payload = {}) {
  const tier = getJackpotTier(payload.tierId);
  const roundId = Number(payload.roundId);
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map(normalizeItem)
    .filter((item) => item.id && item.value >= 0)
    .slice(0, MAX_ENTRY_ITEMS);
  return {
    id: cleanText(payload.id, `jp-${Date.now()}-${Math.random().toString(36).slice(2)}`, 120),
    roundId: Number.isFinite(roundId) ? roundId : 0,
    tierId: tier.id,
    playerId: cleanText(payload.playerId, "player", 96),
    sessionId: cleanText(payload.sessionId, "", 96),
    playerName: cleanText(payload.playerName, "Operatore", 24),
    prestige: Math.max(0, Number(payload.prestige || 0)),
    avatarIcon: cleanText(payload.avatarIcon, "shield", 32),
    avatarImage: String(payload.avatarImage || ""),
    accent: cleanText(payload.accent, "#7fe37c", 24),
    items,
    itemCount: items.length,
    totalValue: money(items.reduce((sum, item) => sum + Number(item.value || 0), 0)),
    at: Number(payload.at || Date.now())
  };
}

export function isJackpotEntryAllowed(entry = {}) {
  const normalized = normalizeJackpotEntry(entry);
  return normalized.items.length > 0 && isJackpotValueAllowedForTier(normalized.totalValue, normalized.tierId);
}

export function getJackpotParticipants(entries = []) {
  const grouped = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const normalized = normalizeJackpotEntry(entry);
    if (!normalized.items.length || !isJackpotValueAllowedForTier(normalized.totalValue, normalized.tierId)) {
      return;
    }
    const id = normalized.playerId || normalized.sessionId || normalized.playerName;
    const existing = grouped.get(id) || {
      playerId: normalized.playerId,
      sessionId: normalized.sessionId,
      name: normalized.playerName,
      prestige: normalized.prestige,
      avatarIcon: normalized.avatarIcon,
      avatarImage: normalized.avatarImage,
      accent: normalized.accent,
      items: [],
      itemCount: 0,
      totalValue: 0,
      firstAt: normalized.at
    };
    existing.items.push(...normalized.items);
    existing.itemCount += normalized.items.length;
    existing.totalValue = money(existing.totalValue + normalized.totalValue);
    existing.firstAt = Math.min(existing.firstAt, normalized.at);
    grouped.set(id, existing);
  });
  return [...grouped.values()]
    .sort((a, b) => Number(b.totalValue || 0) - Number(a.totalValue || 0) || Number(b.itemCount || 0) - Number(a.itemCount || 0));
}

function jackpotWeight(participant = {}) {
  return Math.max(1, Math.round(Number(participant.totalValue || 0) * 100));
}

function pickWeightedParticipant(participants = [], seed = "") {
  const totalWeight = participants.reduce((sum, participant) => sum + jackpotWeight(participant), 0);
  if (!participants.length || totalWeight <= 0) {
    return null;
  }
  let cursor = (hashText(seed) / 0x100000000) * totalWeight;
  for (const participant of participants) {
    cursor -= jackpotWeight(participant);
    if (cursor < 0) {
      return participant;
    }
  }
  return participants[0] || null;
}

export function getJackpotWinner(entries = [], roundId = 0, tierId = "rookie") {
  const participants = getJackpotParticipants(entries);
  if (participants.length < 2) {
    return null;
  }
  return pickWeightedParticipant(participants, `jackpot:${tierId}:${roundId}`);
}

export function buildJackpotReelEntries(entries = [], roundId = 0, tierId = "rookie", targetIndex = 46, total = 66) {
  const participants = getJackpotParticipants(entries);
  const winner = getJackpotWinner(entries, roundId, tierId) || participants[0] || null;
  if (!participants.length) {
    return Array.from({ length: total }, () => null);
  }
  return Array.from({ length: total }, (_, index) => {
    if (index === targetIndex) {
      return winner;
    }
    return pickWeightedParticipant(participants, `jackpot-reel:${tierId}:${roundId}:${index}`) || participants[0];
  });
}

export function isJackpotRealtimeAvailable() {
  return isSupabaseConfigured();
}

async function ensureJackpotChannel() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (channel) {
    return channel;
  }
  if (!channelPromise) {
    channelPromise = getSupabaseClient().then((supabase) => {
      if (!supabase) {
        return null;
      }
      channel = supabase.channel(CHANNEL_NAME, {
        config: {
          broadcast: { self: true }
        }
      });
      channel
        .on("broadcast", { event: "jackpot_entry" }, ({ payload }) => {
          const entry = normalizeJackpotEntry(payload);
          if (!isJackpotEntryAllowed(entry)) {
            return;
          }
          entryListeners.forEach((listener) => listener(entry));
        })
        .subscribe((status) => {
          statusListeners.forEach((listener) => listener(status));
        });
      return channel;
    });
  }
  return channelPromise;
}

export async function subscribeJackpotEntries(onEntry, onStatus) {
  if (typeof onEntry === "function") {
    entryListeners.add(onEntry);
  }
  if (typeof onStatus === "function") {
    statusListeners.add(onStatus);
  }
  await ensureJackpotChannel();
  return () => {
    if (typeof onEntry === "function") {
      entryListeners.delete(onEntry);
    }
    if (typeof onStatus === "function") {
      statusListeners.delete(onStatus);
    }
  };
}

export async function publishJackpotEntry(entry) {
  const activeChannel = await ensureJackpotChannel();
  if (!activeChannel) {
    throw new Error("Jackpot realtime non configurato.");
  }
  const payload = normalizeJackpotEntry(entry);
  if (!isJackpotEntryAllowed(payload)) {
    throw new Error("Valore deposito fuori dai limiti del tier.");
  }
  return activeChannel.send({
    type: "broadcast",
    event: "jackpot_entry",
    payload
  });
}
