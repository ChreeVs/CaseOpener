import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const TABLE = "global_promo_codes";

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeReward(reward = {}) {
  return {
    credits: Math.max(0, Math.floor(Number(reward.credits) || 0)),
    cases: Math.max(0, Math.floor(Number(reward.cases) || 0)),
    rewardTier: Math.max(1, Math.min(6, Math.floor(Number(reward.rewardTier) || 2))),
    weapons: Math.max(0, Math.min(24, Math.floor(Number(reward.weapons) || 0))),
    weaponRarity: String(reward.weaponRarity || "Mil-Spec")
  };
}

function mapPromo(row) {
  return {
    code: normalizeCode(row.code),
    reward: normalizeReward(row.reward || {}),
    active: row.active !== false,
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

export function isGlobalPromoCodesAvailable() {
  return isSupabaseConfigured();
}

export async function fetchGlobalPromoCodes() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("code, reward, active, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data || []).map(mapPromo);
}

export async function upsertGlobalPromoCode({ code, reward, active = true, adminId = "", adminPassword = "" } = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const normalized = normalizeCode(code);
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) {
    throw new Error("Codice promo non valido.");
  }
  if (adminId && adminPassword) {
    const { data, error } = await supabase.rpc("admin_upsert_global_promo_code", {
      admin_id: adminId,
      admin_password: adminPassword,
      promo_code: normalized,
      promo_reward: normalizeReward(reward),
      promo_active: Boolean(active)
    });
    if (error) {
      throw error;
    }
    return mapPromo(data);
  }
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({
      code: normalized,
      reward: normalizeReward(reward),
      active: Boolean(active),
      updated_at: new Date().toISOString()
    })
    .select("code, reward, active, created_at, updated_at")
    .single();
  if (error) {
    throw error;
  }
  return mapPromo(data);
}

export async function deleteGlobalPromoCode(code, { adminId = "", adminPassword = "" } = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return false;
  }
  const normalized = normalizeCode(code);
  if (!normalized) {
    return false;
  }
  if (adminId && adminPassword) {
    const { data, error } = await supabase.rpc("admin_delete_global_promo_code", {
      admin_id: adminId,
      admin_password: adminPassword,
      promo_code: normalized
    });
    if (error) {
      throw error;
    }
    return Boolean(data);
  }
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("code", normalized);
  if (error) {
    throw error;
  }
  return true;
}
