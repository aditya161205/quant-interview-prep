import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitCompanies, type ProblemMeta } from "@/lib/problems";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!problemsEnabled) return NextResponse.json({ problems: [] });
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty");
  const category = searchParams.get("category");
  const company = searchParams.get("company");
  const q = searchParams.get("q");

  const admin = getAdminClient();
  let query = admin
    .from("problems")
    .select("id, question_name, topic, difficulty, asked_in")
    .order("id", { ascending: true })
    .range(0, 99999); // override PostgREST's default 1000-row cap

  if (difficulty) query = query.eq("difficulty", difficulty);
  if (category) query = query.eq("topic", category);
  if (company) query = query.ilike("asked_in", `%${company}%`);
  if (q) query = query.ilike("question_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });

  const problems: ProblemMeta[] = (data ?? []).map((r) => ({
    id: r.id as number,
    title: (r.question_name as string) ?? "",
    category: (r.topic as string) ?? "",
    companies: splitCompanies(r.asked_in as string | null),
    difficulty: (r.difficulty as string) ?? "",
  }));

  return NextResponse.json({ problems });
}
