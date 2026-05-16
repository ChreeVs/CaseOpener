import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const EVENTS_TABLE = "shared_game_events";
const AUCTIONS_TABLE = "global_auction_listings";

function cleanText(value, fallback = "", max = 120) {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || fallback;
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function mapEvent(row) {
  return {
    id: row.id,
    mode: row.mode || "game",
    game: row.game || "Game",
    playerName: row.player_name || "Operatore",
    detail: row.detail || "",
    stake: money(row.stake),
    payout: money(row.payout),
    profit: money(row.profit),
    outcome: row.outcome || "",
    payload: row.payload || {},
    createdAt: row.created_at || new Date().toISOString()
  };
}

function mapAuction(row) {
  return {
    id: row.id,
    sellerName: row.seller_name || "Operatore",
    buyerName: row.buyer_name || "",
    item: row.item || {},
    price: money(row.price),
    status: row.status || "active",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

export function isSharedGamesAvailable() {
  return isSupabaseConfigured();
}

export async function fetchSharedGameEvents(limit = 40) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("id, mode, game, player_name, detail, stake, payout, profit, outcome, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(80, Number(limit) || 40)));
  if (error) {
    throw error;
  }
  return (data || []).map(mapEvent);
}

export async function publishSharedGameEvent(event = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .insert({
      mode: cleanText(event.mode, "game", 32),
      game: cleanText(event.game, "Game", 48),
      player_name: cleanText(event.playerName, "Operatore", 24),
      detail: cleanText(event.detail, "", 180),
      stake: money(event.stake),
      payout: money(event.payout),
      profit: money(event.profit),
      outcome: cleanText(event.outcome, "", 64),
      payload: event.payload || {}
    })
    .select("id, mode, game, player_name, detail, stake, payout, profit, outcome, payload, created_at")
    .single();
  if (error) {
    throw error;
  }
  return mapEvent(data);
}

export async function subscribeSharedGameEvents(onEvent) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const channel = supabase
    .channel("case-opener-shared-games")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: EVENTS_TABLE },
      (payload) => onEvent(mapEvent(payload.new))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchGlobalAuctions(limit = 40) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from(AUCTIONS_TABLE)
    .select("id, seller_name, buyer_name, item, price, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(80, Number(limit) || 40)));
  if (error) {
    throw error;
  }
  return (data || []).map(mapAuction);
}

export async function createGlobalAuction({ sellerName, item, price } = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from(AUCTIONS_TABLE)
    .insert({
      seller_name: cleanText(sellerName, "Operatore", 24),
      item,
      price: money(price),
      status: "active"
    })
    .select("id, seller_name, buyer_name, item, price, status, created_at, updated_at")
    .single();
  if (error) {
    throw error;
  }
  return mapAuction(data);
}

export async function buyGlobalAuction({ listingId, buyerName } = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data: listing, error: readError } = await supabase
    .from(AUCTIONS_TABLE)
    .select("id, seller_name, buyer_name, item, price, status, created_at, updated_at")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();
  if (readError) {
    throw readError;
  }
  if (!listing) {
    throw new Error("Asta non disponibile.");
  }
  const { data, error } = await supabase
    .from(AUCTIONS_TABLE)
    .update({
      status: "sold",
      buyer_name: cleanText(buyerName, "Operatore", 24),
      updated_at: new Date().toISOString()
    })
    .eq("id", listingId)
    .eq("status", "active")
    .select("id, seller_name, buyer_name, item, price, status, created_at, updated_at")
    .single();
  if (error) {
    throw error;
  }
  return mapAuction(data);
}

export async function subscribeGlobalAuctions(onAuction) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const channel = supabase
    .channel("case-opener-global-auctions")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: AUCTIONS_TABLE },
      (payload) => onAuction(mapAuction(payload.new))
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: AUCTIONS_TABLE },
      (payload) => onAuction(mapAuction(payload.new))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
