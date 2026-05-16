export const SUPABASE_CONFIG = {
  enabled: false,
  url: "",
  anonKey: ""
};

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG.enabled &&
      SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.anonKey &&
      !SUPABASE_CONFIG.url.includes("YOUR_PROJECT") &&
      !SUPABASE_CONFIG.anonKey.includes("YOUR_ANON_KEY")
  );
}
