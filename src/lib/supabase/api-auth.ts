import { getServerClient } from "./server";
import { supabaseEnabled } from "./config";

/** The signed-in user for an API route, or null. Auth is required in prod. */
export async function getApiUser() {
  if (!supabaseEnabled) return null;
  const supabase = await getServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
