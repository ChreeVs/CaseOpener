import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const TABLE = "community_goal_contributions";
const RESET_TABLE = "community_goal_resets";

function sanitizeName(value) {
  return String(value || "Operatore")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24) || "Operatore";
}

function normalizeAmount(value) {
  return Number(Math.max(0, Number(value || 0)).toFixed(2));
}

function goalIdFromKey(key) {
  return String(key || "").split(":")[0] || "";
}

function sumRows(rows = [], resetCutoffs = {}) {
  return rows.reduce((totals, row) => {
    const key = row.goal_key;
    if (!key) {
      return totals;
    }
    const rowAt = Date.parse(row.created_at || "") || 0;
    const resetAt = Number(resetCutoffs[key] || 0);
    if (resetAt && rowAt <= resetAt) {
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

function mapReset(row) {
  return {
    id: row.id,
    goalId: row.goal_id,
    goalKey: row.goal_key,
    adminName: row.admin_name || "Admin",
    resetAt: row.reset_at || row.created_at || new Date().toISOString()
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
    .select("goal_key, amount, created_at")
    .in("goal_key", keys)
    .limit(1000);
  if (error) {
    throw error;
  }
  const { data: resets, error: resetError } = await supabase
    .from(RESET_TABLE)
    .select("goal_key, reset_at")
    .in("goal_key", keys)
    .limit(200);
  if (resetError) {
    throw resetError;
  }
  const resetCutoffs = (resets || []).reduce((map, row) => {
    const at = Date.parse(row.reset_at || "") || 0;
    map[row.goal_key] = Math.max(Number(map[row.goal_key] || 0), at);
    return map;
  }, {});
  return sumRows(data || [], resetCutoffs);
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

export async function submitCommunityGoalReset(goalKeys = [], adminName = "Admin", adminCredentials = {}) {
  const keys = [...new Set(goalKeys.filter(Boolean))];
  if (!keys.length) {
    return [];
  }
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return [];
  }
  if (adminCredentials.adminId && adminCredentials.adminPassword) {
    const { data, error } = await supabase.rpc("admin_reset_community_goals", {
      admin_id: adminCredentials.adminId,
      admin_password: adminCredentials.adminPassword,
      goal_keys: keys
    });
    if (error) {
      throw error;
    }
    return (data || []).map(mapReset);
  }
  const resetAt = new Date().toISOString();
  const rows = keys.map((key) => ({
    goal_id: goalIdFromKey(key),
    goal_key: key,
    admin_name: sanitizeName(adminName),
    reset_at: resetAt
  }));
  const { data, error } = await supabase
    .from(RESET_TABLE)
    .insert(rows)
    .select("id, goal_id, goal_key, admin_name, reset_at, created_at");
  if (error) {
    throw error;
  }
  return (data || []).map(mapReset);
}

export async function subscribeCommunityGoalResets(onReset) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const channel = supabase
    .channel("case-opener-community-goal-resets")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: RESET_TABLE },
      (payload) => onReset(mapReset(payload.new))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
