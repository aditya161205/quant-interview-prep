import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitCompanies } from "@/lib/problems";

export const dynamic = "force-dynamic";

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];
/** Supabase caps one response at 1000 rows. */
const CHUNK = 1000;

interface Facets {
  categories: string[];
  companies: string[];
  difficulties: string[];
  /** How many problems carry each topic / difficulty, and the grand total. */
  categoryCounts: Record<string, number>;
  difficultyCounts: Record<string, number>;
  total: number;
}

type Admin = ReturnType<typeof getAdminClient>;
type Row = Record<string, unknown>;
/** One distinct value of a column, with how many rows carry it. */
type Tally = { value: string; count: number };

/** Collapse a column's values into a distinct-value tally. */
function count(values: string[]): Tally[] {
  const out = new Map<string, number>();
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
  return [...out].map(([value, c]) => ({ value, count: c }));
}

function totals(tallies: Tally[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { value, count: c } of tallies) if (value) out[value] = (out[value] ?? 0) + c;
  return out;
}

function shape(topics: Tally[], difficulties: Tally[], askedIn: Tally[]): Facets {
  const companies = new Set<string>();
  for (const { value } of askedIn) for (const c of splitCompanies(value)) companies.add(c);
  const categoryCounts = totals(topics);
  const difficultyCounts = totals(difficulties);
  return {
    categories: Object.keys(categoryCounts).sort(),
    companies: [...companies].sort(),
    difficulties: Object.keys(difficultyCounts).sort(
      (a, b) => DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b),
    ),
    categoryCounts,
    difficultyCounts,
    // Every problem has exactly one difficulty row in the tally, blank included.
    total: difficulties.reduce((s, t) => s + t.count, 0),
  };
}

/**
 * The distinct values of one column. PostgREST groups by the plain columns
 * whenever an aggregate is present, so this comes back as the handful of
 * distinct rows rather than the whole table. Returns null when the deployment
 * has aggregates turned off, or when the grouped result could itself have been
 * truncated, so the caller can fall back to a scan.
 */
async function distinct(
  admin: Admin,
  column: "topic" | "difficulty" | "asked_in",
): Promise<Tally[] | null> {
  const { data, error } = await admin.from("problems").select(`${column}, count()`);
  if (error || !data || data.length >= CHUNK) return null;
  return (data as Row[]).map((r) => ({
    value: (r[column] as string | null) ?? "",
    count: Number(r.count ?? 0),
  }));
}

/** Fallback for deployments without aggregates: one pass over three columns. */
async function scan(admin: Admin): Promise<Facets> {
  const topics: string[] = [];
  const difficulties: string[] = [];
  const askedIn: string[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await admin
      .from("problems")
      .select("topic, difficulty, asked_in")
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (error) throw new Error("query failed");
    for (const r of (data ?? []) as Row[]) {
      topics.push((r.topic as string | null) ?? "");
      difficulties.push((r.difficulty as string | null) ?? "");
      askedIn.push((r.asked_in as string | null) ?? "");
    }
    if (!data || data.length < CHUNK) break;
  }
  return shape(count(topics), count(difficulties), count(askedIn));
}

/**
 * These ~15 strings change essentially never, so they are derived once and
 * reused instead of being recomputed on every page load. `use cache` needs the
 * cacheComponents flag, which this app does not set, so unstable_cache is the
 * mechanism available here. Failures throw rather than return an empty shape —
 * a rejected call is never written to the cache.
 */
const readFacets = unstable_cache(
  async (): Promise<Facets> => {
    const admin = getAdminClient();
    const [topics, difficulties, askedIn] = await Promise.all([
      distinct(admin, "topic"),
      distinct(admin, "difficulty"),
      distinct(admin, "asked_in"),
    ]);
    if (topics && difficulties && askedIn) return shape(topics, difficulties, askedIn);
    return scan(admin);
  },
  ["problem-facets"],
  { revalidate: 86400, tags: ["problem-facets"] },
);

export async function GET() {
  // Same `not_configured` marker the list route uses, so the client can tell a
  // missing deploy config apart from a genuinely empty set.
  if (!problemsEnabled) {
    return NextResponse.json(
      { error: "not_configured", categories: [], companies: [], difficulties: [] },
      { status: 503 },
    );
  }
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await readFacets());
  } catch {
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
