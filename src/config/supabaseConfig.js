export const SUPABASE_CONFIG = {
  enabled: true,
  url: "https://bupggkmnepkupxitnelg.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cGdna21uZXBrdXB4aXRuZWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjgzNDcsImV4cCI6MjA5NDUwNDM0N30.TxLn4U-IQr3acAtdK5MfhsYxQOkwXNG4dR3yCtEm3-w"
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
