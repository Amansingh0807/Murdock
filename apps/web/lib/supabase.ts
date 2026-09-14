import { createClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client. Murdock uses Clerk for identity, so this client
 * deliberately does not persist a separate Supabase Auth session.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("your-project") || key.includes("replace_me")) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
