import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnabled } from "@/lib/supabase/config";

// Routes the page-gate redirect must not touch (/api handles its own auth).
const PUBLIC_PATHS = ["/login", "/auth", "/api"];

// Firewall: vulnerability-scanner probes (WordPress, PHP, dotfiles, admin panels) get a 404 before any app code runs.
const PROBE = /\.(php\d?|asp|aspx|jsp|cgi|env|ini|sql|bak|git|svn|ds_store)(\/|$)|^\/(wp-|wordpress|phpmyadmin|xmlrpc|cgi-bin|\.well-known\/security\.txt\/)|\/\.(git|env|aws|ssh|svn|htaccess|htpasswd)/i;
const METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

// API rate limit: 120 requests a minute per IP.
// ponytail: per-instance memory, so the limit is per serverless instance; use Vercel WAF rate limiting for a global one.
const WINDOW_MS = 60_000;
const LIMIT = 120;
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    if (hits.size > 10_000) hits.clear();
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.n > LIMIT;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!METHODS.has(request.method)) return new NextResponse(null, { status: 405 });
  if (PROBE.test(path)) return new NextResponse(null, { status: 404 });
  if (path.startsWith("/api/")) {
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    if (limited(ip)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  // Without Supabase configured there's no auth, so the app stays open.
  if (!supabaseEnabled) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // Gate: must be signed in to reach anything that isn't a public route.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Already signed in → no need to sit on the login page.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
