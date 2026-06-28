"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnabled } from "./config";

let cached: SupabaseClient | null = null;

/** Browser Supabase client, or null when Supabase isn't configured. */
export function getBrowserClient(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!cached) cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
