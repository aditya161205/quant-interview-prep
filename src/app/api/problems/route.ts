import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitCompanies, type ProblemMeta } from "@/lib/problems";

export const dynamic = "force-dynamic";

/** Supabase caps one response at 1000 rows, so wider spans are read in chunks. */
const CHUNK = 1000;
const DEFAULT_PAGE_SIZE = 25;
const COLUMNS = "id, question_name, topic, difficulty, asked_in";

type Row = Record<string, unknown>;

function toMeta(r: Row): ProblemMeta {
  return {
    id: r.id as number,
    title: (r.question_name as string) ?? "",
    category: (r.topic as string) ?? "",
    companies: splitCompanies(r.asked_in as string | null),
    difficulty: (r.difficulty as string) ?? "",
  };
}

/** A non-negative integer query param, or null when it is absent or garbage. */
function intParam(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function GET(request: Request) {
  // `not_configured` is a marker the client can act on: the deploy is missing
  // its Supabase credentials, which is not the same as "nothing matched".
  if (!problemsEnabled) {
    return NextResponse.json(
      { error: "not_configured", problems: [], total: 0 },
      { status: 503 },
    );
  }
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty");
  const category = searchParams.get("category");
  const company = searchParams.get("company");
  const search = searchParams.get("q");

  const admin = getAdminClient();

  // Every read below shares these filters and this ordering; only the
  // projection and the row span differ.
  const build = <Q extends string>(columns: Q, count?: { count: "exact" }) => {
    let query = admin
      .from("problems")
      .select(columns, count)
      .order("id", { ascending: true });
    if (difficulty) query = query.eq("difficulty", difficulty);
    if (category) query = query.eq("topic", category);
    if (company) query = query.ilike("asked_in", `%${company}%`);
    if (search) query = query.ilike("question_name", `%${search}%`);
    return query;
  };

  // Ids only. The Status filter lives in the browser's localStorage, so the
  // client needs the whole matching id set to apply it — a few KB of ids
  // instead of the ~158 KB the full rows would cost.
  if (searchParams.get("fields") === "ids") {
    const ids: number[] = [];
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await build("id").range(from, from + CHUNK - 1);
      if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
      for (const r of (data ?? []) as Row[]) ids.push(r.id as number);
      if (!data || data.length < CHUNK) break;
    }
    return NextResponse.json({ ids, total: ids.length });
  }

  // Hydrate an explicit id list — how the client fetches one page once the
  // Status filter has narrowed the set down on its side.
  const idList = searchParams.get("ids");
  if (idList !== null) {
    const ids = idList.split(",").map(Number).filter(Number.isInteger).slice(0, CHUNK);
    if (ids.length === 0) return NextResponse.json({ problems: [] });
    const { data, error } = await build(COLUMNS).in("id", ids);
    if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
    return NextResponse.json({ problems: ((data ?? []) as Row[]).map(toMeta) });
  }

  // One page of rows plus an exact total. Callers that ask for neither a page
  // nor a size still get the whole matching set — the profile and detail views
  // depend on that.
  const sizeParam = intParam(searchParams.get("pageSize") ?? searchParams.get("limit"));
  const pageParam = intParam(searchParams.get("page"));
  const offsetParam = intParam(searchParams.get("offset"));
  const size = Math.max(1, sizeParam ?? DEFAULT_PAGE_SIZE);
  const paged = sizeParam !== null || pageParam !== null || offsetParam !== null;
  const span = paged ? size : Number.MAX_SAFE_INTEGER;
  const offset = offsetParam ?? Math.max(0, (pageParam ?? 1) - 1) * size;

  const problems: ProblemMeta[] = [];
  let total = 0;
  while (problems.length < span) {
    const take = Math.min(CHUNK, span - problems.length);
    const from = offset + problems.length;
    // The count comes back with the first chunk, so paging costs one round trip.
    const { data, error, count } = await build(
      COLUMNS,
      problems.length === 0 ? { count: "exact" } : undefined,
    ).range(from, from + take - 1);
    if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
    if (from === offset) total = count ?? 0;
    for (const r of (data ?? []) as Row[]) problems.push(toMeta(r));
    if (!data || data.length < take) break;
  }

  return NextResponse.json({ problems, total });
}
