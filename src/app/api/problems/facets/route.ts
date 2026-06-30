import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitCompanies } from "@/lib/problems";

export const dynamic = "force-dynamic";

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];

export async function GET() {
  if (!problemsEnabled) return NextResponse.json({ categories: [], companies: [], difficulties: [] });
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("problems")
    .select("topic, difficulty, asked_in")
    .range(0, 99999); // override PostgREST's default 1000-row cap
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });

  const categories = new Set<string>();
  const companies = new Set<string>();
  const difficulties = new Set<string>();
  for (const r of data ?? []) {
    if (r.topic) categories.add(r.topic as string);
    if (r.difficulty) difficulties.add(r.difficulty as string);
    for (const c of splitCompanies(r.asked_in as string | null)) companies.add(c);
  }

  return NextResponse.json({
    categories: [...categories].sort(),
    companies: [...companies].sort(),
    difficulties: [...difficulties].sort(
      (a, b) => DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b),
    ),
  });
}
