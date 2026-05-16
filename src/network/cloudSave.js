import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const USERNAME_EMAIL_DOMAIN = "caseopener.local";

function publicStateSnapshot(state) {
  return {
    ...state,
    selectedCaseId: state.selectedCaseId || null,
    lastSeenAt: Date.now()
  };
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 24);
}

function usernameToEmail(username) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9][a-z0-9_.-]{2,23}$/.test(normalized)) {
    throw new Error("Username non valido. Usa 3-24 caratteri: lettere, numeri, _, . o -.");
  }
  return `${normalized}@${USERNAME_EMAIL_DOMAIN}`;
}

function getRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function getSessionDisplayName(session) {
  const metadata = session?.user?.user_metadata || {};
  return String(
    metadata.display_name ||
      metadata.full_name ||
      metadata.name ||
      metadata.preferred_username ||
      metadata.user_name ||
      session?.user?.email?.split("@")[0] ||
      ""
  ).trim();
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

export async function signInWithDiscord() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase non configurato.");
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: getRedirectUrl()
    }
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function registerWithUsernamePassword(username, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase non configurato.");
  }
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = String(password || "");
  if (cleanPassword.length < 6) {
    throw new Error("Password troppo corta. Usa almeno 6 caratteri.");
  }
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(cleanUsername),
    password: cleanPassword,
    options: {
      data: {
        display_name: cleanUsername,
        username: cleanUsername
      }
    }
  });
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error("Account creato, ma Supabase richiede conferma email. Disattiva Confirm email per il login username.");
  }
  return data.session;
}

export async function signInWithUsernamePassword(username, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase non configurato.");
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password: String(password || "")
  });
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
