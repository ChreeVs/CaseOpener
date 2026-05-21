import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

export const ROULETTE_FLOW = {
  delay: 8000,
  betting: 12000,
  closing: 2500,
  spin: 4700,
  release: 4500
};

export const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const ROULETTE_CHOICES = {
  red: { id: "red", label: "Rosso", multiplier: 2 },
  black: { id: "black", label: "Nero", multiplier: 2 },
  green: { id: "green", label: "Verde", multiplier: 35 }
};

const CHANNEL_NAME = "case-opener-live-roulette-v1";
const ROUND_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
const ROUND_DURATION = Object.values(ROULETTE_FLOW).reduce((sum, value) => sum + value, 0);
const betListeners = new Set();
const messageListeners = new Set();
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

function hashRound(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getRouletteNumberForRound(roundId) {
  return hashRound(`karambitquest-roulette:${roundId}`) % 37;
}

export function getRouletteColor(number) {
  if (Number(number) === 0) {
    return "green";
  }
  return ROULETTE_RED_NUMBERS.has(Number(number)) ? "red" : "black";
}

export function getRouletteChoiceLabel(choice) {
  return ROULETTE_CHOICES[choice]?.label || "Rosso";
}

export function getRouletteMultiplier(choice) {
  return ROULETTE_CHOICES[choice]?.multiplier || 0;
}

export function getRouletteRound(now = Date.now()) {
  const elapsedTotal = Math.max(0, now - ROUND_EPOCH);
  const roundId = Math.floor(elapsedTotal / ROUND_DURATION);
  const elapsed = elapsedTotal % ROUND_DURATION;
  const phases = [
    { key: "delay", label: "Delay", duration: ROULETTE_FLOW.delay },
    { key: "betting", label: "Accettazioni Puntate", duration: ROULETTE_FLOW.betting },
    { key: "closing", label: "Chiusura Puntate", duration: ROULETTE_FLOW.closing },
    { key: "spin", label: "Giro", duration: ROULETTE_FLOW.spin },
    { key: "release", label: "Rilascio Vincite", duration: ROULETTE_FLOW.release }
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
  const number = getRouletteNumberForRound(roundId);
  const color = getRouletteColor(number);
  return {
    roundId,
    elapsed,
    remaining: ROUND_DURATION - elapsed,
    phase: {
      ...phase,
      elapsed: phaseElapsed,
      remaining: Math.max(0, phase.duration - phaseElapsed),
      progress: Math.max(0, Math.min(1, phaseElapsed / Math.max(1, phase.duration)))
    },
    result: {
      number,
      color,
      label: getRouletteChoiceLabel(color)
    },
    duration: ROUND_DURATION
  };
}

export function buildRouletteReelNumbers(roundId, targetIndex = 46, total = 66) {
  const result = getRouletteNumberForRound(roundId);
  return Array.from({ length: total }, (_, index) => {
    if (index === targetIndex) {
      return result;
    }
    return hashRound(`roulette-reel:${roundId}:${index}`) % 37;
  });
}

function normalizeBet(payload = {}) {
  const choice = ROULETTE_CHOICES[payload.choice]?.id || "red";
  const roundId = Number(payload.roundId);
  return {
    id: cleanText(payload.id, `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`, 96),
    roundId: Number.isFinite(roundId) ? roundId : 0,
    playerId: cleanText(payload.playerId, "player", 96),
    sessionId: cleanText(payload.sessionId, "", 96),
    playerName: cleanText(payload.playerName, "Operatore", 24),
    choice,
    amount: money(payload.amount),
    at: Number(payload.at || Date.now())
  };
}

function normalizeMessage(payload = {}) {
  return {
    id: cleanText(payload.id, `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`, 96),
    type: cleanText(payload.type, "chat", 16),
    roundId: Number(payload.roundId || 0),
    playerId: cleanText(payload.playerId, "", 96),
    sessionId: cleanText(payload.sessionId, "", 96),
    playerName: cleanText(payload.playerName, "Operatore", 24),
    text: cleanText(payload.text, "", 220),
    tone: cleanText(payload.tone, "", 24),
    at: Number(payload.at || Date.now())
  };
}

export function isRouletteRealtimeAvailable() {
  return isSupabaseConfigured();
}

async function ensureRouletteChannel() {
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
        .on("broadcast", { event: "roulette_bet" }, ({ payload }) => {
          const bet = normalizeBet(payload);
          if (bet.amount <= 0) {
            return;
          }
          betListeners.forEach((listener) => listener(bet));
        })
        .on("broadcast", { event: "roulette_message" }, ({ payload }) => {
          const message = normalizeMessage(payload);
          if (!message.text) {
            return;
          }
          messageListeners.forEach((listener) => listener(message));
        })
        .subscribe((status) => {
          statusListeners.forEach((listener) => listener(status));
        });
      return channel;
    });
  }
  return channelPromise;
}

export async function subscribeRouletteMessages(onMessage, onStatus) {
  if (typeof onMessage === "function") {
    messageListeners.add(onMessage);
  }
  if (typeof onStatus === "function") {
    statusListeners.add(onStatus);
  }
  await ensureRouletteChannel();
  return () => {
    if (typeof onMessage === "function") {
      messageListeners.delete(onMessage);
    }
    if (typeof onStatus === "function") {
      statusListeners.delete(onStatus);
    }
  };
}

export async function subscribeRouletteBets(onBet, onStatus) {
  if (typeof onBet === "function") {
    betListeners.add(onBet);
  }
  if (typeof onStatus === "function") {
    statusListeners.add(onStatus);
  }
  await ensureRouletteChannel();
  return () => {
    if (typeof onBet === "function") {
      betListeners.delete(onBet);
    }
    if (typeof onStatus === "function") {
      statusListeners.delete(onStatus);
    }
  };
}

export async function publishRouletteBet(bet) {
  const activeChannel = await ensureRouletteChannel();
  if (!activeChannel) {
    throw new Error("Roulette realtime non configurata.");
  }
  const payload = normalizeBet(bet);
  if (payload.amount <= 0) {
    throw new Error("Puntata non valida.");
  }
  return activeChannel.send({
    type: "broadcast",
    event: "roulette_bet",
    payload
  });
}

export async function publishRouletteMessage(message) {
  const activeChannel = await ensureRouletteChannel();
  if (!activeChannel) {
    throw new Error("Chat roulette non configurata.");
  }
  const payload = normalizeMessage(message);
  if (!payload.text) {
    throw new Error("Messaggio vuoto.");
  }
  return activeChannel.send({
    type: "broadcast",
    event: "roulette_message",
    payload
  });
}
