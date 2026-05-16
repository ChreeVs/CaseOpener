import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const TABLE = "community_goal_contributions";

function sanitizeName(value) {
  return String(value || "Operatore")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24) || "Operatore";
}

function normalizeAmount(value) {
  return Number(Math.max(0, Number(value || 0)).toFixed(2));
}

function sumRows(rows = []) {
  return rows.reduce((totals, row) => {
    const key = row.goal_key;
    if (!key) {
      return totals;
    }
    totals[key] = Number(((totals[key] || 0) + normalizeAmount(row.amount)).toFixed(2));
    return totals;
  }, {});
}

function mapContribution(row) {
  return {
    id: row.id,
    goalId: row.goal_id,
    goalKey: row.goal_key,
    amount: normalizeAmount(row.amount),
    playerName: row.player_name || "Operatore",
    createdAt: row.created_at || new Date().toISOString()
  };
}

export function isCommunityGoalsSyncAvailable() {
  return isSupabaseConfigured();
}

export async function fetchCommunityGoalTotals(goalKeys = []) {
  const keys = [...new Set(goalKeys.filter(Boolean))];
  if (!keys.length) {
    return {};
  }
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("goal_key, amount")
    .in("goal_key", keys)
    .limit(1000);
  if (error) {
    throw error;
  }
  return sumRows(data || []);
}

export async function submitCommunityGoalContribution({ goal, amount, playerName } = {}) {
  if (!goal?.key || goal.scope !== "community") {
    return null;
  }
  const value = normalizeAmount(amount);
  if (value <= 0) {
    throw new Error("Importo goal non valido.");
  }
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user || null;
  const { data, error } = await supabase.from(TABLE).insert({
    goal_id: goal.id,
    goal_key: goal.key,
    scope: "community",
    player_id: user?.id || null,
    player_name: sanitizeName(playerName),
    amount: value
  }).select("id, goal_id, goal_key, amount, player_name, created_at").single();
  if (error) {
    throw error;
  }
  return mapContribution(data);
}

export async function subscribeCommunityGoalContributions(onContribution) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const channel = supabase
    .channel("case-opener-community-goals")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE },
      (payload) => onContribution(mapContribution(payload.new))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
