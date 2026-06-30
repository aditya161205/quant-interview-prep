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
  const categories = new Set<string>();
  const companies = new Set<string>();
  const difficulties = new Set<string>();

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("problems")
      .select("topic, difficulty, asked_in")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
    for (const r of data ?? []) {
      if (r.topic) categories.add(r.topic as string);
      if (r.difficulty) difficulties.add(r.difficulty as string);
      for (const c of splitCompanies(r.asked_in as string | null)) companies.add(c);
    }
    if (!data || data.length < PAGE) break;
  }

  return NextResponse.json({
    categories: [...categories].sort(),
    companies: [...companies].sort(),
    difficulties: [...difficulties].sort(
      (a, b) => DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b),
    ),
  });
}
