import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getServerClient } from "@/lib/supabase/server";

/** Exchanges the OAuth code for a session, then redirects back into the app. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code && supabaseEnabled) {
    const supabase = await getServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
