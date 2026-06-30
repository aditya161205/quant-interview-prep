import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitCompanies, isNumericAnswer, type ProblemDetail } from "@/lib/problems";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!problemsEnabled) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const admin = getAdminClient();
  // Note: final_answer is read only to derive hasAnswer; it is NOT returned.
  const { data, error } = await admin
    .from("problems")
    .select("id, question_name, question_statement, topic, difficulty, asked_in, final_answer")
    .eq("id", numId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [prev, next] = await Promise.all([
    admin.from("problems").select("id").lt("id", numId).order("id", { ascending: false }).limit(1).maybeSingle(),
    admin.from("problems").select("id").gt("id", numId).order("id", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const detail: ProblemDetail = {
    id: data.id as number,
    title: (data.question_name as string) ?? "",
    statement: (data.question_statement as string) ?? "",
    category: (data.topic as string) ?? "",
    companies: splitCompanies(data.asked_in as string | null),
    difficulty: (data.difficulty as string) ?? "",
    hasAnswer: isNumericAnswer(data.final_answer as string | null),
    prevId: (prev.data?.id as number | undefined) ?? null,
    nextId: (next.data?.id as number | undefined) ?? null,
  };

  return NextResponse.json(detail);
}
