import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

function publicStateSnapshot(state) {
  return {
    ...state,
    selectedCaseId: state.selectedCaseId || null,
    lastSeenAt: Date.now()
  };
}

export function isCloudSaveAvailable() {
  return isSupabaseConfigured();
}

export async function getCloudSession() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session || null;
}

export async function signInCloudAnonymously() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase non configurato.");
  }
  const current = await getCloudSession();
  if (current?.user) {
    return current;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  return data.session || null;
}

export async function signOutCloud() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return;
  }
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    throw error;
  }
}

export async function upsertCloudProfile(state, session) {
  const supabase = await getSupabaseClient();
  const user = session?.user;
  if (!supabase || !user) {
    throw new Error("Account cloud non attivo.");
  }
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: state.profile?.name || "Operatore",
    team: state.profile?.team === "t" ? "t" : "ct",
    prestige: Number(state.prestige?.level || 0),
    level: Number(state.profile?.level || 1),
    updated_at: new Date().toISOString()
  });
  if (error) {
    throw error;
  }
}

export async function saveCloudState(state) {
  const supabase = await getSupabaseClient();
  const session = await getCloudSession();
  const user = session?.user;
  if (!supabase || !user) {
    throw new Error("Accedi al cloud prima di salvare.");
  }
  await upsertCloudProfile(state, session);
  const snapshot = publicStateSnapshot(state);
  const revision = Number(state.cloudRevision || 0) + 1;
  snapshot.cloudRevision = revision;
  const { error } = await supabase.from("player_states").upsert({
    player_id: user.id,
    revision,
    state: snapshot,
    updated_at: new Date().toISOString()
  });
  if (error) {
    throw error;
  }
  state.cloudRevision = revision;
  return { revision, userId: user.id };
}

export async function loadCloudState() {
  const supabase = await getSupabaseClient();
  const session = await getCloudSession();
  const user = session?.user;
  if (!supabase || !user) {
    throw new Error("Accedi al cloud prima di caricare.");
  }
  const { data, error } = await supabase
    .from("player_states")
    .select("revision, state, updated_at")
    .eq("player_id", user.id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data || null;
}
