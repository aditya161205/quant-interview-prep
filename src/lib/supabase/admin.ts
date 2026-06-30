import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** True when the server can talk to the locked-down problems table. */
export const problemsEnabled = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

/**
 * Admin Supabase client — service-role key, SERVER ONLY. Bypasses RLS, so it
 * is the only thing that can read the problems table. Never import this from a
 * client component (the "server-only" guard above throws if you try).
 */
export function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
