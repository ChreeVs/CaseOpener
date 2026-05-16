import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const CHAT_LIMIT = 80;

function sanitizeTeam(team) {
  return String(team || "").toLowerCase() === "t" ? "t" : "ct";
}

function sanitizeMessage(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function mapChatRow(row) {
  return {
    id: row.id,
    name: row.player_name || "Operatore",
    team: sanitizeTeam(row.team),
    text: row.message || "",
    at: Date.parse(row.created_at || "") || Date.now()
  };
}

export function isSupabaseChatEnabled() {
  return isSupabaseConfigured();
}

export async function fetchSupabaseChatMessages() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, player_name, team, message, created_at")
    .order("created_at", { ascending: false })
    .limit(CHAT_LIMIT);
  if (error) {
    throw error;
  }
  return [...(data || [])].reverse().map(mapChatRow);
}

export async function sendSupabaseChatMessage({ name, team, text }) {
  const message = sanitizeMessage(text);
  if (!message) {
    throw new Error("Messaggio vuoto.");
  }
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { error } = await supabase.from("chat_messages").insert({
    player_name: String(name || "Operatore").replace(/\s+/g, " ").trim().slice(0, 24) || "Operatore",
    team: sanitizeTeam(team),
    message
  });
  if (error) {
    throw error;
  }
  return fetchSupabaseChatMessages();
}

export async function subscribeSupabaseChat(onMessage) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const channel = supabase
    .channel("case-opener-global-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => onMessage(mapChatRow(payload.new))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
