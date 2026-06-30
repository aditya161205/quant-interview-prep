import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitCompanies, type ProblemMeta } from "@/lib/problems";

export const dynamic = "force-dynamic";

const PAGE = 1000;

export async function GET(request: Request) {
  if (!problemsEnabled) return NextResponse.json({ problems: [] });
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty");
  const category = searchParams.get("category");
  const company = searchParams.get("company");
  const search = searchParams.get("q");

  const admin = getAdminClient();
  const all: ProblemMeta[] = [];

  // Page through to bypass Supabase's server-side "Max rows" cap.
  for (let from = 0; ; from += PAGE) {
    let query = admin
      .from("problems")
      .select("id, question_name, topic, difficulty, asked_in")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (difficulty) query = query.eq("difficulty", difficulty);
    if (category) query = query.eq("topic", category);
    if (company) query = query.ilike("asked_in", `%${company}%`);
    if (search) query = query.ilike("question_name", `%${search}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });

    for (const r of data ?? []) {
      all.push({
        id: r.id as number,
        title: (r.question_name as string) ?? "",
        category: (r.topic as string) ?? "",
        companies: splitCompanies(r.asked_in as string | null),
        difficulty: (r.difficulty as string) ?? "",
      });
    }
    if (!data || data.length < PAGE) break;
  }

  return NextResponse.json({ problems: all });
}
